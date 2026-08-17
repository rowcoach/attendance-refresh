import { admin, type Admin } from "./tap.server";

export async function adminContext(userId: string) {
  const db = admin();
  const { data: role } = await db
    .from("user_roles")
    .select("team_id, role")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (!role) return null;
  const { data: profile } = await db
    .from("users")
    .select("*")
    .eq("auth_user_id", userId)
    .maybeSingle();
  return { db, teamId: role.team_id as string, role: role.role as string, profile };
}

export async function requireAdmin(userId: string) {
  const context = await adminContext(userId);
  if (!context) throw new Error("No team is linked to this account yet.");
  return context;
}

export async function checklistState(db: Admin, teamId: string) {
  const [groups, seasons, qrCodes, sessions, athletes, admins] = await Promise.all([
    db.from("groups").select("id").eq("team_id", teamId).eq("is_default", false),
    db.from("seasons").select("id").eq("team_id", teamId),
    db.from("qr_codes").select("id").eq("team_id", teamId).eq("type", "location"),
    db.from("sessions").select("id").eq("team_id", teamId),
    db.from("users").select("id").eq("team_id", teamId).eq("role", "athlete"),
    db.from("user_roles").select("id").eq("team_id", teamId).eq("role", "assistant_admin"),
  ]);
  return {
    groups: (groups.data ?? []).length > 0,
    season: (seasons.data ?? []).length > 0,
    location: (qrCodes.data ?? []).length > 0,
    schedule: (sessions.data ?? []).length > 0,
    athletes: (athletes.data ?? []).length > 0,
    assistant: (admins.data ?? []).length > 0,
  };
}