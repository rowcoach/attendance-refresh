import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  admin,
  athleteFromDevice,
  activeSeason,
  closeDueSessions,
  randomToken,
  seasonSessionIds,
  seasonTotals,
  sendSms,
  sixDigitCode,
} from "./tap.server";
import { normalizePhone } from "./format";
import {
  WINDOW_AFTER_MS,
  WINDOW_BEFORE_MS,
  matchSession,
  punctualityPoints,
} from "./scoring";
import { distanceMeters } from "./format";

/** Look up a QR token so the landing page knows what it is. */
export const readQrToken = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(4).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const db = admin();
    const { data: qr } = await db
      .from("qr_codes")
      .select("id, type, team_id, location_id, group_id, gps_required, expiration")
      .eq("token", data.token)
      .maybeSingle();
    if (!qr) return { found: false as const };
    if (qr.expiration && new Date(qr.expiration) < new Date()) return { found: false as const };
    const { data: team } = await db
      .from("teams")
      .select("id, name, team_color, logo_url, gps_enabled, punctuality_enabled")
      .eq("id", qr.team_id)
      .maybeSingle();
    const { data: location } = qr.location_id
      ? await db.from("locations").select("id, name, label").eq("id", qr.location_id).maybeSingle()
      : { data: null };
    const { data: groups } = await db
      .from("groups")
      .select("id, name")
      .eq("team_id", qr.team_id)
      .order("sort_order");
    return { found: true as const, qr, team, location, groups: groups ?? [] };
  });

/** Athlete signup step 1 — send a verification code. */
export const requestAthleteCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(4).max(64),
        firstName: z.string().trim().min(1).max(50),
        lastName: z.string().trim().min(1).max(50),
        phone: z.string().trim().min(7).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = admin();
    const { data: qr } = await db
      .from("qr_codes")
      .select("team_id, type")
      .eq("token", data.token)
      .maybeSingle();
    if (!qr || qr.type !== "signup") throw new Error("This signup link is not valid.");

    const phone = normalizePhone(data.phone);
    const hourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count: recentCount } = await db
      .from("phone_verifications")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", hourAgo);
    if ((recentCount ?? 0) >= 3) {
      throw new Error("Too many codes requested. Try again in an hour.");
    }
    const code = sixDigitCode();
    await db.from("phone_verifications").insert({ phone, team_id: qr.team_id, code });
    await sendSms(phone, `Your TAP4Teams verification code is ${code}`);
    return { ok: true };
  });

/** Athlete signup step 2 — verify the code, create the athlete, bind the device. */
export const verifyAthleteCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(4).max(64),
        firstName: z.string().trim().min(1).max(50),
        lastName: z.string().trim().min(1).max(50),
        phone: z.string().trim().min(7).max(20),
        code: z.string().trim().length(6),
        groupId: z.string().uuid().nullable(),
        smsOptIn: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = admin();
    const phone = normalizePhone(data.phone);
    const { data: qr } = await db
      .from("qr_codes")
      .select("team_id, group_id, type")
      .eq("token", data.token)
      .maybeSingle();
    if (!qr || qr.type !== "signup") throw new Error("This signup link is not valid.");

    const { data: verification } = await db
      .from("phone_verifications")
      .select("id, code, expires_at, consumed_at, attempts")
      .eq("phone", phone)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!verification || new Date(verification.expires_at) < new Date()) {
      throw new Error("That code is not right or has expired. Ask for a new one.");
    }
    if ((verification.attempts ?? 0) >= 5) {
      throw new Error("Too many wrong tries on that code. Ask for a new one.");
    }
    if (verification.code !== data.code) {
      const attempts = (verification.attempts ?? 0) + 1;
      await db.from("phone_verifications").update({ attempts }).eq("id", verification.id);
      throw new Error(
        attempts >= 5
          ? "Too many wrong tries on that code. Ask for a new one."
          : "That code is not right or has expired. Ask for a new one.",
      );
    }
    await db
      .from("phone_verifications")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", verification.id);

    let groupId = qr.group_id ?? data.groupId;
    if (!groupId) {
      const { data: fallback } = await db
        .from("groups")
        .select("id")
        .eq("team_id", qr.team_id)
        .eq("is_default", true)
        .maybeSingle();
      groupId = fallback?.id ?? null;
    }

    const { data: existing } = await db
      .from("users")
      .select("id")
      .eq("team_id", qr.team_id)
      .eq("phone", phone)
      .maybeSingle();

    let userId = existing?.id as string | undefined;
    if (userId) {
      await db
        .from("users")
        .update({
          first_name: data.firstName,
          last_name: data.lastName,
          group_id: groupId,
          is_active: true,
          sms_opt_in: data.smsOptIn,
        })
        .eq("id", userId);
    } else {
      const { data: created, error } = await db
        .from("users")
        .insert({
          first_name: data.firstName,
          last_name: data.lastName,
          phone,
          role: "athlete",
          team_id: qr.team_id,
          group_id: groupId,
          sms_opt_in: data.smsOptIn,
        })
        .select("id")
        .single();
      if (error) throw new Error("Could not create your account.");
      userId = created.id;
    }

    const deviceToken = randomToken();
    await db.from("athlete_devices").delete().eq("user_id", userId!);
    await db.from("athlete_devices").insert({ user_id: userId!, device_token: deviceToken });
    await db.from("users").update({ device_id: deviceToken.slice(0, 12) }).eq("id", userId!);

    const { data: group } = groupId
      ? await db.from("groups").select("name").eq("id", groupId).maybeSingle()
      : { data: null };

    return { deviceToken, firstName: data.firstName, groupName: group?.name ?? "General Team" };
  });

/** Everything the athlete home screen shows. */
export const getAthleteHome = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ deviceToken: z.string().min(8).max(128) }).parse(d))
  .handler(async ({ data }) => {
    const db = admin();
    const me = await athleteFromDevice(db, data.deviceToken);
    if (!me) return { signedIn: false as const };

    await closeDueSessions(db, me.team_id);

    const { data: team } = await db
      .from("teams")
      .select("id, name, team_color, logo_url, punctuality_enabled")
      .eq("id", me.team_id)
      .maybeSingle();
    const { data: group } = me.group_id
      ? await db.from("groups").select("id, name").eq("id", me.group_id).maybeSingle()
      : { data: null };
    const season = await activeSeason(db, me.team_id);

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const { data: today } = await db
      .from("sessions")
      .select("id, name, location_reference, scheduled_time, is_cancelled")
      .eq("team_id", me.team_id)
      .gte("scheduled_time", dayStart.toISOString())
      .lt("scheduled_time", dayEnd.toISOString())
      .order("scheduled_time");

    const sessionIds = await seasonSessionIds(db, me.team_id, season?.id ?? null);
    const totals = await seasonTotals(db, me.team_id, sessionIds);
    const mine = totals.get(me.id);

    const { data: teammates } = await db
      .from("users")
      .select("id, first_name, last_name, group_id")
      .eq("team_id", me.team_id)
      .eq("role", "athlete")
      .eq("is_active", true)
      .eq("is_test_account", false);

    const inGroup = (teammates ?? []).filter((t) => t.group_id === me.group_id);
    const ranked = inGroup
      .map((t) => ({
        id: t.id,
        name: `${t.first_name} ${t.last_name}`,
        points: totals.get(t.id)?.points ?? 0,
      }))
      .sort((a, b) => b.points - a.points);
    const myRank = ranked.findIndex((row) => row.id === me.id) + 1;

    const { data: groups } = await db
      .from("groups")
      .select("id, name")
      .eq("team_id", me.team_id)
      .order("sort_order");
    const groupStandings = (groups ?? [])
      .map((g) => {
        const members = (teammates ?? []).filter((t) => t.group_id === g.id);
        const stats = members.map((m) => totals.get(m.id));
        const present = stats.reduce((sum, s) => sum + (s?.present ?? 0), 0);
        const counted = stats.reduce((sum, s) => sum + (s?.present ?? 0) + (s?.unexcused ?? 0), 0);
        return {
          id: g.id,
          name: g.name,
          percent: counted ? Math.round((present / counted) * 100) : 100,
          members: members.length,
        };
      })
      .filter((g) => g.members > 0)
      .sort((a, b) => b.percent - a.percent);

    return {
      signedIn: true as const,
      me: { id: me.id, firstName: me.first_name, lastName: me.last_name },
      team,
      group,
      season: season ? { id: season.id, name: season.name } : null,
      today: today ?? [],
      stats: {
        present: mine?.present ?? 0,
        excused: mine?.excused ?? 0,
        unexcused: mine?.unexcused ?? 0,
        total: (mine?.present ?? 0) + (mine?.unexcused ?? 0),
        percent: mine?.percent ?? 100,
        points: mine?.points ?? 0,
      },
      rank: myRank || null,
      leaders: ranked.slice(0, 3),
      groupStandings,
    };
  });

/** Session-by-session log for the athlete. */
export const getAthleteSessions = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ deviceToken: z.string().min(8).max(128) }).parse(d))
  .handler(async ({ data }) => {
    const db = admin();
    const me = await athleteFromDevice(db, data.deviceToken);
    if (!me) return { signedIn: false as const };
    const { data: team } = await db
      .from("teams")
      .select("punctuality_enabled, name, team_color")
      .eq("id", me.team_id)
      .maybeSingle();
    const { data: rows } = await db
      .from("attendance")
      .select(
        "id, status, scan_time, punctuality_points, punctuality_visible, sessions(id, name, scheduled_time, location_reference)",
      )
      .eq("user_id", me.id)
      .order("created_at", { ascending: false })
      .limit(200);
    return { signedIn: true as const, team, rows: rows ?? [] };
  });

/** The whole scan decision tree. */
export const processScan = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(4).max(64),
        deviceToken: z.string().max(128),
        lat: z.number().nullable(),
        lng: z.number().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = admin();
    const { data: qr } = await db
      .from("qr_codes")
      .select("id, type, team_id, location_id, gps_required, expiration")
      .eq("token", data.token)
      .maybeSingle();
    if (!qr) return { result: "invalid" as const };
    if (qr.expiration && new Date(qr.expiration) < new Date()) return { result: "invalid" as const };

    const me = await athleteFromDevice(db, data.deviceToken);
    if (!me || me.team_id !== qr.team_id) return { result: "ignored" as const };

    const { data: team } = await db
      .from("teams")
      .select("gps_enabled, punctuality_enabled, name")
      .eq("id", qr.team_id)
      .maybeSingle();
    const { data: location } = qr.location_id
      ? await db
          .from("locations")
          .select("id, name, latitude, longitude")
          .eq("id", qr.location_id)
          .maybeSingle()
      : { data: null };

    const now = new Date();

    if (qr.type === "adhoc") {
      await db.from("scans").insert({
        user_id: me.id,
        team_id: qr.team_id,
        qr_code_id: qr.id,
        location_id: qr.location_id,
        scan_time: now.toISOString(),
        is_adhoc: true,
      });
      return {
        result: "adhoc" as const,
        time: now.toISOString(),
        locationName: location?.name ?? null,
      };
    }

    const gpsOn = (team?.gps_enabled ?? true) && qr.gps_required;
    if (gpsOn && location?.latitude != null && location.longitude != null) {
      if (data.lat == null || data.lng == null) return { result: "needs_location" as const };
      const meters = distanceMeters(
        { lat: data.lat, lng: data.lng },
        { lat: location.latitude, lng: location.longitude },
      );
      if (meters > 30) return { result: "too_far" as const };
    }

    await closeDueSessions(db, qr.team_id);

    const windowStart = new Date(now.getTime() - WINDOW_AFTER_MS).toISOString();
    const windowEnd = new Date(now.getTime() + WINDOW_BEFORE_MS).toISOString();
    let query = db
      .from("sessions")
      .select("id, name, scheduled_time, is_cancelled, expected_group_ids, is_scored")
      .eq("team_id", qr.team_id)
      .eq("is_cancelled", false)
      .gte("scheduled_time", windowStart)
      .lte("scheduled_time", windowEnd);
    const { data: candidates } = await query;
    const session = matchSession(candidates ?? [], now, me.group_id ?? null);

    await db.from("scans").insert({
      user_id: me.id,
      team_id: qr.team_id,
      qr_code_id: qr.id,
      location_id: qr.location_id,
      scan_time: now.toISOString(),
      session_id: session?.id ?? null,
      is_adhoc: false,
    });

    if (!session) {
      const { data: anyCandidate } = await db
        .from("sessions")
        .select("id")
        .eq("team_id", qr.team_id)
        .eq("is_cancelled", false)
        .gte("scheduled_time", windowStart)
        .lte("scheduled_time", windowEnd)
        .limit(1);
      return {
        result: "logged" as const,
        time: now.toISOString(),
        locationName: location?.name ?? null,
        message: (anyCandidate ?? []).length
          ? "Scan logged — outside your group's check-in window."
          : "Scan logged — outside the check-in window.",
      };
    }

    const { data: existingAttendance } = await db
      .from("attendance")
      .select("id, scan_time, punctuality_points, punctuality_visible")
      .eq("user_id", me.id)
      .eq("session_id", session.id)
      .maybeSingle();

    const scored = session.is_scored !== false;

    if (existingAttendance) {
      const originalTime = existingAttendance.scan_time ?? now.toISOString();
      return {
        result: "already" as const,
        time: originalTime,
        locationName: location?.name ?? null,
        sessionName: session.name,
        points: Number(existingAttendance.punctuality_points ?? 0),
        showPoints:
          scored &&
          (team?.punctuality_enabled ?? true) &&
          existingAttendance.punctuality_visible !== false,
        message: `Already checked in at ${new Date(originalTime).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })}`,
      };
    }

    const points = scored ? punctualityPoints(session.scheduled_time, now) : 0;
    await db.from("attendance").insert({
        user_id: me.id,
        session_id: session.id,
        team_id: qr.team_id,
        status: "present",
        scan_time: now.toISOString(),
        punctuality_points: points,
      punctuality_visible: scored && (team?.punctuality_enabled ?? true),
    });

    return {
      result: "checked_in" as const,
      time: now.toISOString(),
      locationName: location?.name ?? null,
      sessionName: session.name,
      points,
      showPoints: scored && (team?.punctuality_enabled ?? true),
    };
  });