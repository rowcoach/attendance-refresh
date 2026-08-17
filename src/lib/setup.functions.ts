import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import { requireAdmin } from "./coach.server";
import { WINDOW_AFTER_MS, WINDOW_BEFORE_MS, punctualityPoints } from "./scoring";

export const updateTeamSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(80).optional(),
        teamColor: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        gpsEnabled: z.boolean().optional(),
        punctualityEnabled: z.boolean().optional(),
        assistantLabel: z.string().trim().min(2).max(30).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, teamId } = await requireAdmin(context.userId);
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch["name"] = data.name;
    if (data.teamColor !== undefined) patch["team_color"] = data.teamColor;
    if (data.gpsEnabled !== undefined) patch["gps_enabled"] = data.gpsEnabled;
    if (data.punctualityEnabled !== undefined) patch["punctuality_enabled"] = data.punctualityEnabled;
    if (data.assistantLabel !== undefined) patch["assistant_admin_label"] = data.assistantLabel;
    await db.from("teams").update(patch).eq("id", teamId);
    return { ok: true };
  });

export const createGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ name: z.string().trim().min(1).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, teamId } = await requireAdmin(context.userId);
    const { data: existing } = await db
      .from("groups")
      .select("id")
      .eq("team_id", teamId)
      .eq("is_default", false);
    if ((existing ?? []).length >= 5) throw new Error("You can have up to 5 custom groups.");
    await db
      .from("groups")
      .insert({ team_id: teamId, name: data.name, sort_order: (existing ?? []).length + 1 });
    return { ok: true };
  });

export const deleteGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ groupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, teamId } = await requireAdmin(context.userId);
    const { data: group } = await db
      .from("groups")
      .select("id, is_default")
      .eq("id", data.groupId)
      .eq("team_id", teamId)
      .maybeSingle();
    if (!group) throw new Error("Group not found.");
    if (group.is_default) throw new Error("General Team cannot be deleted.");
    const { data: fallback } = await db
      .from("groups")
      .select("id")
      .eq("team_id", teamId)
      .eq("is_default", true)
      .maybeSingle();
    await db.from("users").update({ group_id: fallback?.id ?? null }).eq("group_id", data.groupId);
    await db.from("groups").delete().eq("id", data.groupId);
    return { ok: true };
  });

export const moveAthlete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), groupId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, teamId } = await requireAdmin(context.userId);
    await db
      .from("users")
      .update({ group_id: data.groupId })
      .eq("id", data.userId)
      .eq("team_id", teamId);
    return { ok: true };
  });

export const createLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(60),
        label: z.string().trim().max(80).default(""),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, teamId } = await requireAdmin(context.userId);
    const { data: location, error } = await db
      .from("locations")
      .insert({
        team_id: teamId,
        name: data.name,
        label: data.label || data.name,
        latitude: data.latitude,
        longitude: data.longitude,
      })
      .select("id")
      .single();
    if (error || !location) throw new Error("Could not save that location.");
    const { data: qr } = await db
      .from("qr_codes")
      .insert({
        team_id: teamId,
        type: "location",
        location_id: location.id,
        created_by: context.userId,
      })
      .select("token")
      .single();
    await db.from("locations").update({ qr_code_data: qr?.token ?? null }).eq("id", location.id);
    return { ok: true };
  });

export const deleteLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ locationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, teamId } = await requireAdmin(context.userId);
    await db.from("locations").delete().eq("id", data.locationId).eq("team_id", teamId);
    return { ok: true };
  });

export const getQrCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, teamId } = await requireAdmin(context.userId);
    const { data: codes } = await db
      .from("qr_codes")
      .select("id, token, type, gps_required, expiration, location_id, group_id, created_at")
      .eq("team_id", teamId)
      .order("created_at");
    const { data: locations } = await db
      .from("locations")
      .select("id, name, label, latitude, longitude")
      .eq("team_id", teamId)
      .order("name");
    const { data: team } = await db.from("teams").select("name").eq("id", teamId).maybeSingle();
    return { codes: codes ?? [], locations: locations ?? [], teamName: team?.name ?? "" };
  });

export const createQrCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        type: z.enum(["signup", "adhoc"]),
        groupId: z.string().uuid().nullable().default(null),
        expiresInHours: z.number().min(1).max(720).nullable().default(null),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, teamId } = await requireAdmin(context.userId);
    await db.from("qr_codes").insert({
      team_id: teamId,
      type: data.type,
      group_id: data.groupId,
      gps_required: false,
      created_by: context.userId,
      expiration: data.expiresInHours
        ? new Date(Date.now() + data.expiresInHours * 3600000).toISOString()
        : null,
    });
    return { ok: true };
  });

export const createSeason = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(60),
        startDate: z.string().min(8).max(10),
        endDate: z.string().min(8).max(10),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, teamId } = await requireAdmin(context.userId);
    await db.from("seasons").update({ is_active: false }).eq("team_id", teamId);
    await db.from("seasons").insert({
      team_id: teamId,
      name: data.name,
      start_date: data.startDate,
      end_date: data.endDate,
      is_active: true,
    });
    return { ok: true };
  });

export const getSeasons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, teamId } = await requireAdmin(context.userId);
    const { data } = await db
      .from("seasons")
      .select("*")
      .eq("team_id", teamId)
      .order("start_date", { ascending: false });
    return { seasons: data ?? [] };
  });

export const activateSeason = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ seasonId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, teamId } = await requireAdmin(context.userId);
    await db.from("seasons").update({ is_active: false }).eq("team_id", teamId);
    await db
      .from("seasons")
      .update({ is_active: true })
      .eq("id", data.seasonId)
      .eq("team_id", teamId);
    return { ok: true };
  });

export const getSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ from: z.string(), to: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, teamId } = await requireAdmin(context.userId);
    const { data: sessions } = await db
      .from("sessions")
      .select("*")
      .eq("team_id", teamId)
      .gte("scheduled_time", data.from)
      .lte("scheduled_time", data.to)
      .order("scheduled_time");
    return { sessions: sessions ?? [] };
  });

export const createSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(60),
        locationReference: z.string().trim().max(80).default(""),
        scheduledTime: z.string().min(10),
        expectedGroupIds: z.array(z.string().uuid()).default([]),
        repeatWeekly: z.boolean().default(false),
        repeatEndDate: z.string().nullable().default(null),
        isScored: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, teamId } = await requireAdmin(context.userId);
    const { data: season } = await db
      .from("seasons")
      .select("id")
      .eq("team_id", teamId)
      .eq("is_active", true)
      .maybeSingle();

    const first = new Date(data.scheduledTime);
    const dates: Date[] = [first];
    if (data.repeatWeekly && data.repeatEndDate) {
      const end = new Date(`${data.repeatEndDate}T23:59:59`);
      let cursor = new Date(first.getTime() + 7 * 86400000);
      while (cursor <= end && dates.length < 60) {
        dates.push(new Date(cursor));
        cursor = new Date(cursor.getTime() + 7 * 86400000);
      }
    }
    const repeatGroupId = crypto.randomUUID();
    const { data: inserted } = await db
      .from("sessions")
      .insert(
      dates.map((date) => ({
        team_id: teamId,
        season_id: season?.id ?? null,
        name: data.name,
        location_reference: data.locationReference || null,
        scheduled_time: date.toISOString(),
        repeat_pattern: data.repeatWeekly ? "weekly" : null,
        repeat_end_date: data.repeatEndDate,
        repeat_group_id: data.repeatWeekly ? repeatGroupId : null,
        expected_group_ids: data.expectedGroupIds,
          is_scored: data.isScored,
      })),
      )
      .select("id, scheduled_time, expected_group_ids, is_scored");

    // Backdated sessions: adopt already-logged scans that fall in their window.
    for (const session of inserted ?? []) {
      if (new Date(session.scheduled_time) < new Date()) {
        await backfillFromScans(db, teamId, session);
      }
    }
    return { created: dates.length };
  });

/** Turn loose scans inside a backdated session's window into attendance rows. */
async function backfillFromScans(
  db: any,
  teamId: string,
  session: { id: string; scheduled_time: string; expected_group_ids: string[]; is_scored: boolean },
) {
  const scheduled = new Date(session.scheduled_time).getTime();
  const from = new Date(scheduled - WINDOW_BEFORE_MS).toISOString();
  const to = new Date(scheduled + WINDOW_AFTER_MS).toISOString();

  const { data: scans } = await db
    .from("scans")
    .select("id, user_id, scan_time")
    .eq("team_id", teamId)
    .is("session_id", null)
    .eq("is_adhoc", false)
    .gte("scan_time", from)
    .lte("scan_time", to)
    .order("scan_time");
  if (!scans?.length) return;

  const groups = (session.expected_group_ids ?? []) as string[];
  let athleteQuery = db
    .from("users")
    .select("id")
    .eq("team_id", teamId)
    .eq("role", "athlete")
    .in("id", [...new Set(scans.map((s: any) => s.user_id))]);
  if (groups.length) athleteQuery = athleteQuery.in("group_id", groups);
  const { data: eligible } = await athleteQuery;
  const allowed = new Set((eligible ?? []).map((a: any) => a.id));
  if (!allowed.size) return;

  const { data: team } = await db
    .from("teams")
    .select("punctuality_enabled")
    .eq("id", teamId)
    .maybeSingle();
  const { data: existing } = await db
    .from("attendance")
    .select("user_id")
    .eq("session_id", session.id);
  const already = new Set((existing ?? []).map((r: any) => r.user_id));

  const firstScan = new Map<string, string>();
  for (const scan of scans) {
    if (!allowed.has(scan.user_id) || already.has(scan.user_id)) continue;
    if (!firstScan.has(scan.user_id)) firstScan.set(scan.user_id, scan.scan_time);
  }
  if (!firstScan.size) return;

  const scored = session.is_scored !== false;
  await db.from("attendance").insert(
    [...firstScan.entries()].map(([userId, scanTime]) => ({
      user_id: userId,
      session_id: session.id,
      team_id: teamId,
      status: "present" as const,
      scan_time: scanTime,
      punctuality_points: scored ? punctualityPoints(session.scheduled_time, scanTime) : 0,
      punctuality_visible: scored && (team?.punctuality_enabled ?? true),
    })),
  );
  await db
    .from("scans")
    .update({ session_id: session.id })
    .in(
      "id",
      scans
        .filter((s: any) => firstScan.get(s.user_id) === s.scan_time)
        .map((s: any) => s.id),
    );
}

/** Edit a single session without touching its repeat siblings. */
export const updateSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        name: z.string().trim().min(1).max(60),
        locationReference: z.string().trim().max(80).default(""),
        scheduledTime: z.string().min(10),
        expectedGroupIds: z.array(z.string().uuid()).default([]),
        isScored: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, teamId } = await requireAdmin(context.userId);
    const { error } = await db
      .from("sessions")
      .update({
        name: data.name,
        location_reference: data.locationReference || null,
        scheduled_time: new Date(data.scheduledTime).toISOString(),
        expected_group_ids: data.expectedGroupIds,
        is_scored: data.isScored,
      })
      .eq("id", data.sessionId)
      .eq("team_id", teamId);
    if (error) throw new Error("Could not update that session.");
    return { ok: true };
  });

export const cancelSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ sessionId: z.string().uuid(), cancelled: z.boolean().default(true) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { db, teamId } = await requireAdmin(context.userId);
    await db
      .from("sessions")
      .update({ is_cancelled: data.cancelled })
      .eq("id", data.sessionId)
      .eq("team_id", teamId);
    return { ok: true };
  });

export const deleteSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, teamId } = await requireAdmin(context.userId);
    await db.from("sessions").delete().eq("id", data.sessionId).eq("team_id", teamId);
    return { ok: true };
  });

export const getTestAthleteDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, teamId } = await requireAdmin(context.userId);
    const { data: test } = await db
      .from("users")
      .select("id")
      .eq("team_id", teamId)
      .eq("is_test_account", true)
      .maybeSingle();
    if (!test) throw new Error("No test athlete on this team.");
    const { data: device } = await db
      .from("athlete_devices")
      .select("device_token")
      .eq("user_id", test.id)
      .maybeSingle();
    if (device) return { deviceToken: device.device_token as string };
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    await db.from("athlete_devices").insert({ user_id: test.id, device_token: token });
    return { deviceToken: token };
  });