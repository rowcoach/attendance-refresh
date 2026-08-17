import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import { requireAdmin, checklistState } from "./coach.server";
import {
  admin,
  activeSeason,
  closeDueSessions,
  seasonSessionIds,
  seasonTotals,
  sendSms,
} from "./tap.server";
import { UNEXCUSED_POINTS } from "./scoring";

/** Create a team + master admin for the signed-in coach. */
export const createTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        firstName: z.string().trim().min(1).max(50),
        lastName: z.string().trim().min(1).max(50),
        phone: z.string().trim().max(20).optional().default(""),
        teamName: z.string().trim().min(2).max(80),
        sport: z.string().trim().min(2).max(60),
        teamColor: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .default("#111111"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = admin();
    const { data: existing } = await db
      .from("user_roles")
      .select("team_id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();
    if (existing) return { teamId: existing.team_id as string };

    const { data: team, error } = await db
      .from("teams")
      .insert({ name: data.teamName, sport: data.sport, team_color: data.teamColor })
      .select("id")
      .single();
    if (error || !team) throw new Error("Could not create the team.");

    const { data: general } = await db
      .from("groups")
      .insert({ team_id: team.id, name: "General Team", is_default: true, sort_order: 0 })
      .select("id")
      .single();

    await db.from("users").insert({
      auth_user_id: context.userId,
      first_name: data.firstName,
      last_name: data.lastName,
      email: context.claims?.email ?? null,
      phone: data.phone || null,
      role: "master_admin",
      team_id: team.id,
    });
    await db
      .from("user_roles")
      .insert({ auth_user_id: context.userId, team_id: team.id, role: "master_admin" });

    await db.from("users").insert({
      first_name: "Test",
      last_name: "Athlete",
      role: "athlete",
      team_id: team.id,
      group_id: general?.id ?? null,
      is_test_account: true,
    });

    await db.from("qr_codes").insert({
      team_id: team.id,
      type: "signup",
      gps_required: false,
      created_by: context.userId,
    });

    return { teamId: team.id as string };
  });

/** Team, role, checklist and settings for the signed-in coach. */
export const getCoachContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = admin();
    const { data: role } = await db
      .from("user_roles")
      .select("team_id, role")
      .eq("auth_user_id", context.userId)
      .maybeSingle();
    if (!role) return { hasTeam: false as const };
    const { data: team } = await db.from("teams").select("*").eq("id", role.team_id).maybeSingle();
    const { data: profile } = await db
      .from("users")
      .select("first_name, last_name")
      .eq("auth_user_id", context.userId)
      .maybeSingle();
    const { data: groups } = await db
      .from("groups")
      .select("*")
      .eq("team_id", role.team_id)
      .order("sort_order");
    const season = await activeSeason(db, role.team_id);
    return {
      hasTeam: true as const,
      team,
      role: role.role as string,
      profile,
      groups: groups ?? [],
      season,
      checklist: await checklistState(db, role.team_id),
    };
  });

/** Today's sessions plus the live four-section attendance list. */
export const getDailyView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ groupId: z.string().uuid().nullable().default(null) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, teamId } = await requireAdmin(context.userId);
    await closeDueSessions(db, teamId);

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const { data: sessions } = await db
      .from("sessions")
      .select("*")
      .eq("team_id", teamId)
      .gte("scheduled_time", dayStart.toISOString())
      .lt("scheduled_time", dayEnd.toISOString())
      .order("scheduled_time");

    let athleteQuery = db
      .from("users")
      .select("id, first_name, last_name, group_id, is_test_account")
      .eq("team_id", teamId)
      .eq("role", "athlete")
      .eq("is_active", true);
    if (data.groupId) athleteQuery = athleteQuery.eq("group_id", data.groupId);
    const { data: athletes } = await athleteQuery;

    const sessionIds = (sessions ?? []).map((s) => s.id);
    const { data: attendance } = sessionIds.length
      ? await db.from("attendance").select("*").in("session_id", sessionIds)
      : { data: [] };

    return { sessions: sessions ?? [], athletes: athletes ?? [], attendance: attendance ?? [] };
  });

/** Coach override of a status and/or points. */
export const setAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        sessionId: z.string().uuid(),
        status: z.enum(["present", "excused", "unexcused"]),
        points: z.number().min(-100).max(100).nullable().default(null),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, teamId } = await requireAdmin(context.userId);
    const { data: session } = await db
      .from("sessions")
      .select("id")
      .eq("id", data.sessionId)
      .eq("team_id", teamId)
      .maybeSingle();
    if (!session) throw new Error("Session not found.");

    const { data: existing } = await db
      .from("attendance")
      .select("id, punctuality_points, status")
      .eq("user_id", data.userId)
      .eq("session_id", data.sessionId)
      .maybeSingle();

    let points = data.points;
    if (points === null) {
      if (data.status === "excused") points = 0;
      else if (data.status === "unexcused") points = UNEXCUSED_POINTS;
      else points = existing && existing.status === "present" ? Number(existing.punctuality_points) : 0;
    }

    await db.from("attendance").upsert(
      {
        user_id: data.userId,
        session_id: data.sessionId,
        team_id: teamId,
        status: data.status,
        punctuality_points: points,
        override_by: context.userId,
        override_at: new Date().toISOString(),
      },
      { onConflict: "user_id,session_id" },
    );
    return { ok: true };
  });

/** Roster with season totals. */
export const getRoster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, teamId } = await requireAdmin(context.userId);
    await closeDueSessions(db, teamId);
    const season = await activeSeason(db, teamId);
    const sessionIds = await seasonSessionIds(db, teamId, season?.id ?? null);
    const totals = await seasonTotals(db, teamId, sessionIds);
    const { data: athletes } = await db
      .from("users")
      .select("id, first_name, last_name, phone, group_id, is_active, is_test_account")
      .eq("team_id", teamId)
      .eq("role", "athlete")
      .order("last_name");
    const { data: groups } = await db
      .from("groups")
      .select("id, name")
      .eq("team_id", teamId)
      .order("sort_order");
    return {
      groups: groups ?? [],
      athletes: (athletes ?? []).map((a) => ({
        ...a,
        totals: totals.get(a.id) ?? {
          present: 0,
          excused: 0,
          unexcused: 0,
          total: 0,
          points: 0,
          percent: 100,
        },
      })),
      seasonName: season?.name ?? null,
      sessionCount: sessionIds.length,
    };
  });

/** One athlete's session-by-session log. */
export const getAthleteDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, teamId } = await requireAdmin(context.userId);
    const { data: athlete } = await db
      .from("users")
      .select("id, first_name, last_name, phone, group_id")
      .eq("id", data.userId)
      .eq("team_id", teamId)
      .maybeSingle();
    if (!athlete) throw new Error("Athlete not found.");
    const { data: rows } = await db
      .from("attendance")
      .select(
        "id, status, scan_time, punctuality_points, punctuality_visible, sessions(id, name, scheduled_time, location_reference)",
      )
      .eq("user_id", data.userId)
      .limit(300);
    return { athlete, rows: rows ?? [] };
  });

/** Leaderboards: top 3 per group plus group standings. */
export const getLeaderboards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, teamId } = await requireAdmin(context.userId);
    await closeDueSessions(db, teamId);
    const season = await activeSeason(db, teamId);
    const sessionIds = await seasonSessionIds(db, teamId, season?.id ?? null);
    const totals = await seasonTotals(db, teamId, sessionIds);
    const { data: groups } = await db
      .from("groups")
      .select("id, name")
      .eq("team_id", teamId)
      .order("sort_order");
    const { data: athletes } = await db
      .from("users")
      .select("id, first_name, last_name, group_id")
      .eq("team_id", teamId)
      .eq("role", "athlete")
      .eq("is_active", true)
      .eq("is_test_account", false);

    const byGroup = (groups ?? []).map((group) => {
      const members = (athletes ?? []).filter((a) => a.group_id === group.id);
      const rows = members
        .map((a) => ({
          id: a.id,
          name: `${a.first_name} ${a.last_name}`,
          points: totals.get(a.id)?.points ?? 0,
          percent: totals.get(a.id)?.percent ?? 100,
        }))
        .sort((a, b) => b.points - a.points);
      const present = members.reduce((sum, m) => sum + (totals.get(m.id)?.present ?? 0), 0);
      const counted = members.reduce(
        (sum, m) => sum + (totals.get(m.id)?.present ?? 0) + (totals.get(m.id)?.unexcused ?? 0),
        0,
      );
      return {
        id: group.id,
        name: group.name,
        rows,
        percent: counted ? Math.round((present / counted) * 100) : 100,
        members: members.length,
      };
    });
    return { groups: byGroup, seasonName: season?.name ?? null };
  });

/** SMS megaphone. */
export const sendMegaphone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        targetType: z.enum(["all", "group", "selected"]),
        groupId: z.string().uuid().nullable().default(null),
        userIds: z.array(z.string().uuid()).max(300).default([]),
        message: z.string().trim().min(1).max(600),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, teamId } = await requireAdmin(context.userId);
    let query = db
      .from("users")
      .select("id, phone")
      .eq("team_id", teamId)
      .eq("role", "athlete")
      .eq("is_active", true)
      .eq("is_test_account", false)
      .not("phone", "is", null);
    if (data.targetType === "group" && data.groupId) query = query.eq("group_id", data.groupId);
    if (data.targetType === "selected") query = query.in("id", data.userIds);
    const { data: recipients } = await query;

    let cost = 0;
    for (const recipient of recipients ?? []) {
      const result = await sendSms(recipient.phone!, data.message);
      cost += result.cost;
    }

    await db.from("sms_messages").insert({
      team_id: teamId,
      sent_by: context.userId,
      target_type: data.targetType,
      target_group_id: data.groupId,
      target_user_ids: data.targetType === "selected" ? data.userIds : null,
      message_text: data.message,
      recipient_count: (recipients ?? []).length,
      cost: Math.round(cost * 10000) / 10000,
    });
    return { recipientCount: (recipients ?? []).length };
  });

export const getMessageHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, teamId } = await requireAdmin(context.userId);
    const { data: messages } = await db
      .from("sms_messages")
      .select("*")
      .eq("team_id", teamId)
      .order("sent_at", { ascending: false })
      .limit(50);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const thisMonth = (messages ?? []).filter((m) => new Date(m.sent_at) >= monthStart);
    return {
      messages: messages ?? [],
      monthCount: thisMonth.reduce((sum, m) => sum + m.recipient_count, 0),
      totalCost: (messages ?? []).reduce((sum, m) => sum + Number(m.cost), 0),
    };
  });