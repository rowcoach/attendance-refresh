
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('athlete','assistant_admin','master_admin','tap4teams_admin');
CREATE TYPE public.account_type AS ENUM ('paid','trial','beta');
CREATE TYPE public.billing_plan AS ENUM ('monthly','annual');
CREATE TYPE public.billing_status AS ENUM ('active','past_due','cancelled','read_only');
CREATE TYPE public.qr_type AS ENUM ('location','signup','adhoc');
CREATE TYPE public.attendance_status AS ENUM ('present','excused','unexcused');
CREATE TYPE public.sms_target AS ENUM ('all','group','selected');

-- TEAMS
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sport text NOT NULL,
  team_color text NOT NULL DEFAULT '#111111',
  logo_url text,
  gps_enabled boolean NOT NULL DEFAULT true,
  punctuality_enabled boolean NOT NULL DEFAULT true,
  assistant_admin_label text NOT NULL DEFAULT 'Assistant Admin',
  account_type public.account_type NOT NULL DEFAULT 'beta',
  trial_start_date timestamptz,
  trial_end_date timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  billing_plan public.billing_plan,
  billing_status public.billing_status NOT NULL DEFAULT 'active',
  sms_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- GROUPS
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- USERS (app users; coaches also have an auth account)
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  role public.app_role NOT NULL DEFAULT 'athlete',
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  device_id text,
  is_active boolean NOT NULL DEFAULT true,
  is_test_account boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_team_phone_idx ON public.users (team_id, phone) WHERE phone IS NOT NULL;

-- ROLE AUTHORITY (separate from users to prevent privilege escalation)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auth_user_id, team_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_auth_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE auth_user_id = _auth_user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_team_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT team_id FROM public.user_roles WHERE auth_user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin(_team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE auth_user_id = auth.uid() AND team_id = _team_id
      AND role IN ('assistant_admin','master_admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_master_admin(_team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE auth_user_id = auth.uid() AND team_id = _team_id AND role = 'master_admin'
  )
$$;

-- LOCATIONS
CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  label text,
  latitude double precision,
  longitude double precision,
  qr_code_data text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- QR CODES
CREATE TABLE public.qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12),'hex'),
  type public.qr_type NOT NULL,
  location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  gps_required boolean NOT NULL DEFAULT true,
  expiration timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- SEASONS
CREATE TABLE public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- SESSIONS
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  season_id uuid REFERENCES public.seasons(id) ON DELETE CASCADE,
  name text NOT NULL,
  location_reference text,
  scheduled_time timestamptz NOT NULL,
  repeat_pattern text,
  repeat_end_date date,
  repeat_group_id uuid,
  is_cancelled boolean NOT NULL DEFAULT false,
  expected_group_ids uuid[] NOT NULL DEFAULT '{}',
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- SCANS
CREATE TABLE public.scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  qr_code_id uuid REFERENCES public.qr_codes(id) ON DELETE SET NULL,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  scan_time timestamptz NOT NULL DEFAULT now(),
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  is_adhoc boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ATTENDANCE
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  status public.attendance_status NOT NULL,
  scan_time timestamptz,
  punctuality_points numeric NOT NULL DEFAULT 0,
  punctuality_visible boolean NOT NULL DEFAULT true,
  override_by uuid,
  override_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_id)
);

-- SMS MESSAGES
CREATE TABLE public.sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  sent_by uuid,
  target_type public.sms_target NOT NULL,
  target_group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  target_user_ids uuid[],
  message_text text NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  cost numeric NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now()
);

-- ATHLETE PHONE VERIFICATION + DEVICE SESSIONS
CREATE TABLE public.phone_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  code text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.athlete_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_token text NOT NULL UNIQUE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seasons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT SELECT, INSERT ON public.sms_messages TO authenticated;
GRANT ALL ON public.teams, public.groups, public.users, public.user_roles, public.locations,
  public.qr_codes, public.seasons, public.sessions, public.scans, public.attendance,
  public.sms_messages, public.phone_verifications, public.athlete_devices TO service_role;

-- RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read own team" ON public.teams FOR SELECT TO authenticated USING (public.is_team_admin(id));
CREATE POLICY "master admin updates team" ON public.teams FOR UPDATE TO authenticated USING (public.is_master_admin(id)) WITH CHECK (public.is_master_admin(id));

CREATE POLICY "admins read roles of their team" ON public.user_roles FOR SELECT TO authenticated USING (public.is_team_admin(team_id));

CREATE POLICY "admins manage groups" ON public.groups FOR ALL TO authenticated USING (public.is_team_admin(team_id)) WITH CHECK (public.is_team_admin(team_id));
CREATE POLICY "admins manage users" ON public.users FOR ALL TO authenticated USING (public.is_team_admin(team_id)) WITH CHECK (public.is_team_admin(team_id));
CREATE POLICY "admins manage locations" ON public.locations FOR ALL TO authenticated USING (public.is_team_admin(team_id)) WITH CHECK (public.is_team_admin(team_id));
CREATE POLICY "admins manage qr codes" ON public.qr_codes FOR ALL TO authenticated USING (public.is_team_admin(team_id)) WITH CHECK (public.is_team_admin(team_id));
CREATE POLICY "admins manage seasons" ON public.seasons FOR ALL TO authenticated USING (public.is_team_admin(team_id)) WITH CHECK (public.is_team_admin(team_id));
CREATE POLICY "admins manage sessions" ON public.sessions FOR ALL TO authenticated USING (public.is_team_admin(team_id)) WITH CHECK (public.is_team_admin(team_id));
CREATE POLICY "admins manage scans" ON public.scans FOR ALL TO authenticated USING (public.is_team_admin(team_id)) WITH CHECK (public.is_team_admin(team_id));
CREATE POLICY "admins manage attendance" ON public.attendance FOR ALL TO authenticated USING (public.is_team_admin(team_id)) WITH CHECK (public.is_team_admin(team_id));
CREATE POLICY "admins read sms" ON public.sms_messages FOR SELECT TO authenticated USING (public.is_team_admin(team_id));
CREATE POLICY "admins insert sms" ON public.sms_messages FOR INSERT TO authenticated WITH CHECK (public.is_team_admin(team_id));

-- REALTIME
ALTER TABLE public.attendance REPLICA IDENTITY FULL;
ALTER TABLE public.scans REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scans;
