import { WINDOW_AFTER_MS, WINDOW_BEFORE_MS, punctualityPoints } from "./scoring";

/** Turn loose scans inside a backdated session's window into attendance rows. */
export async function backfillFromScans(
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

