REVOKE ALL ON FUNCTION public.current_team_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_master_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_team_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_team_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_master_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_team_admin(uuid) TO service_role;