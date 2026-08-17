import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { SESSION_WINDOW_MS, UNEXCUSED_POINTS } from "./scoring";

export type Admin = SupabaseClient<any, "public", any>;

export function admin(): Admin {
  return createClient(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  ) as Admin;
}

export function randomToken(bytes = 24): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function sixDigitCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String((array[0]! % 900000) + 100000);
}

/** Resolve an athlete from their bound device token. */
export async function athleteFromDevice(db: Admin, deviceToken: string) {
  if (!deviceToken) return null;
  const { data: device } = await db
    .from("athlete_devices")
    .select("id, user_id")
    .eq("device_token", deviceToken)
    .maybeSingle();
  if (!device) return null;
  const { data: user } = await db
    .from("users")
    .select("*")
    .eq("id", device.user_id)
    .eq("is_active", true)
    .maybeSingle();
  if (!user) return null;
  await db
    .from("athlete_devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", device.id);
  return user;
}

export async function activeSeason(db: Admin, teamId: string) {
  const { data } = await db
    .from("seasons")
    .select("*")
    .eq("team_id", teamId)
    .eq("is_active", true)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/**
 * Close any session whose window has passed: every expected athlete who did not
 * scan and was not excused becomes unexcused at -45 points.
 */
export async function closeDueSessions(db: Admin, teamId: string) {
  const cutoff = new Date(Date.now() - SESSION_WINDOW_MS).toISOString();
  const { data: due } = await db
    .from("sessions")
    .select("id, expected_group_ids")
    .eq("team_id", teamId)
    .eq("is_cancelled", false)
    .eq("is_scored", true)
    .is("closed_at", null)
    .lt("scheduled_time", cutoff);
  if (!due?.length) return;

  const { data: team } = await db
    .from("teams")
    .select("punctuality_enabled")
    .eq("id", teamId)
    .maybeSingle();

  for (const session of due) {
    let query = db
      .from("users")
      .select("id, group_id")
      .eq("team_id", teamId)
      .eq("role", "athlete")
      .eq("is_active", true)
      .eq("is_test_account", false);
    const groups = (session.expected_group_ids ?? []) as string[];
    if (groups.length) query = query.in("group_id", groups);
    const { data: expected } = await query;

    const { data: existing } = await db
      .from("attendance")
      .select("user_id")
      .eq("session_id", session.id);
    const already = new Set((existing ?? []).map((row) => row.user_id));

    const rows = (expected ?? [])
      .filter((athlete) => !already.has(athlete.id))
      .map((athlete) => ({
        user_id: athlete.id,
        session_id: session.id,
        team_id: teamId,
        status: "unexcused" as const,
        punctuality_points: UNEXCUSED_POINTS,
        punctuality_visible: team?.punctuality_enabled ?? true,
      }));
    if (rows.length) await db.from("attendance").insert(rows);
    await db.from("sessions").update({ closed_at: new Date().toISOString() }).eq("id", session.id);
  }
}

export type AthleteTotals = {
  userId: string;
  present: number;
  excused: number;
  unexcused: number;
  total: number;
  points: number;
  percent: number;
};

export async function seasonTotals(
  db: Admin,
  teamId: string,
  sessionIds: string[],
): Promise<Map<string, AthleteTotals>> {
  const totals = new Map<string, AthleteTotals>();
  if (!sessionIds.length) return totals;
  const { data } = await db
    .from("attendance")
    .select("user_id, status, punctuality_points")
    .eq("team_id", teamId)
    .in("session_id", sessionIds);

  for (const row of data ?? []) {
    const current =
      totals.get(row.user_id) ??
      ({
        userId: row.user_id,
        present: 0,
        excused: 0,
        unexcused: 0,
        total: 0,
        points: 0,
        percent: 0,
      } satisfies AthleteTotals);
    if (row.status === "present") current.present += 1;
    if (row.status === "excused") current.excused += 1;
    if (row.status === "unexcused") current.unexcused += 1;
    current.total += 1;
    current.points += Number(row.punctuality_points ?? 0);
    totals.set(row.user_id, current);
  }
  for (const value of totals.values()) {
    const counted = value.present + value.unexcused;
    value.percent = counted ? Math.round((value.present / counted) * 100) : 100;
    value.points = Math.round(value.points * 10) / 10;
  }
  return totals;
}

export async function seasonSessionIds(db: Admin, teamId: string, seasonId: string | null) {
  let query = db.from("sessions").select("id").eq("team_id", teamId).eq("is_cancelled", false);
  if (seasonId) query = query.eq("season_id", seasonId);
  const { data } = await query;
  return (data ?? []).map((row) => row.id as string);
}

/** Send an SMS through the Twilio connector gateway when configured. */
export async function sendSms(to: string, body: string): Promise<{ sent: boolean; cost: number }> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const twilioKey = process.env["TWILIO_API_KEY"];
  const from = process.env["TWILIO_FROM_NUMBER"];
  if (!lovableKey || !twilioKey || !from) {
    console.warn("[sms] Twilio not configured — message not sent to", to.slice(-4));
    return { sent: false, cost: 0 };
  }
  const response = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": twilioKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  if (!response.ok) {
    const text = await response.text();
    console.error(`[sms] send failed [${response.status}]: ${text}`);
    return { sent: false, cost: 0 };
  }
  const json = (await response.json()) as { price?: string | null };
  return { sent: true, cost: Math.abs(Number(json.price ?? 0)) || 0.0079 };
}