export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      athlete_devices: {
        Row: {
          created_at: string
          device_token: string
          id: string
          last_seen_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_token: string
          id?: string
          last_seen_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_token?: string
          id?: string
          last_seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          created_at: string
          id: string
          override_at: string | null
          override_by: string | null
          punctuality_points: number
          punctuality_visible: boolean
          scan_time: string | null
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          override_at?: string | null
          override_by?: string | null
          punctuality_points?: number
          punctuality_visible?: boolean
          scan_time?: string | null
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          override_at?: string | null
          override_by?: string | null
          punctuality_points?: number
          punctuality_visible?: boolean
          scan_time?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          sort_order: number
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          created_at: string
          id: string
          label: string | null
          latitude: number | null
          longitude: number | null
          name: string
          qr_code_data: string | null
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          qr_code_data?: string | null
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          qr_code_data?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_verifications: {
        Row: {
          attempts: number
          code: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone: string
          team_id: string | null
        }
        Insert: {
          attempts?: number
          code: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone: string
          team_id?: string | null
        }
        Update: {
          attempts?: number
          code?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phone_verifications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_codes: {
        Row: {
          created_at: string
          created_by: string | null
          expiration: string | null
          gps_required: boolean
          group_id: string | null
          id: string
          location_id: string | null
          team_id: string
          token: string
          type: Database["public"]["Enums"]["qr_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expiration?: string | null
          gps_required?: boolean
          group_id?: string | null
          id?: string
          location_id?: string | null
          team_id: string
          token?: string
          type: Database["public"]["Enums"]["qr_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expiration?: string | null
          gps_required?: boolean
          group_id?: string | null
          id?: string
          location_id?: string | null
          team_id?: string
          token?: string
          type?: Database["public"]["Enums"]["qr_type"]
        }
        Relationships: [
          {
            foreignKeyName: "qr_codes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_codes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_codes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      scans: {
        Row: {
          created_at: string
          id: string
          is_adhoc: boolean
          location_id: string | null
          qr_code_id: string | null
          scan_time: string
          session_id: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_adhoc?: boolean
          location_id?: string | null
          qr_code_id?: string | null
          scan_time?: string
          session_id?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_adhoc?: boolean
          location_id?: string | null
          qr_code_id?: string | null
          scan_time?: string
          session_id?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scans_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scans_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scans_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scans_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          name: string
          start_date: string
          team_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          name: string
          start_date: string
          team_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          closed_at: string | null
          created_at: string
          expected_group_ids: string[]
          id: string
          is_cancelled: boolean
          location_reference: string | null
          name: string
          repeat_end_date: string | null
          repeat_group_id: string | null
          repeat_pattern: string | null
          scheduled_time: string
          season_id: string | null
          team_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          expected_group_ids?: string[]
          id?: string
          is_cancelled?: boolean
          location_reference?: string | null
          name: string
          repeat_end_date?: string | null
          repeat_group_id?: string | null
          repeat_pattern?: string | null
          scheduled_time: string
          season_id?: string | null
          team_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          expected_group_ids?: string[]
          id?: string
          is_cancelled?: boolean
          location_reference?: string | null
          name?: string
          repeat_end_date?: string | null
          repeat_group_id?: string | null
          repeat_pattern?: string | null
          scheduled_time?: string
          season_id?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_messages: {
        Row: {
          cost: number
          id: string
          message_text: string
          recipient_count: number
          sent_at: string
          sent_by: string | null
          target_group_id: string | null
          target_type: Database["public"]["Enums"]["sms_target"]
          target_user_ids: string[] | null
          team_id: string
        }
        Insert: {
          cost?: number
          id?: string
          message_text: string
          recipient_count?: number
          sent_at?: string
          sent_by?: string | null
          target_group_id?: string | null
          target_type: Database["public"]["Enums"]["sms_target"]
          target_user_ids?: string[] | null
          team_id: string
        }
        Update: {
          cost?: number
          id?: string
          message_text?: string
          recipient_count?: number
          sent_at?: string
          sent_by?: string | null
          target_group_id?: string | null
          target_type?: Database["public"]["Enums"]["sms_target"]
          target_user_ids?: string[] | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_target_group_id_fkey"
            columns: ["target_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          assistant_admin_label: string
          billing_plan: Database["public"]["Enums"]["billing_plan"] | null
          billing_status: Database["public"]["Enums"]["billing_status"]
          created_at: string
          gps_enabled: boolean
          id: string
          logo_url: string | null
          name: string
          punctuality_enabled: boolean
          sms_enabled: boolean
          sport: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          team_color: string
          trial_end_date: string | null
          trial_start_date: string | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          assistant_admin_label?: string
          billing_plan?: Database["public"]["Enums"]["billing_plan"] | null
          billing_status?: Database["public"]["Enums"]["billing_status"]
          created_at?: string
          gps_enabled?: boolean
          id?: string
          logo_url?: string | null
          name: string
          punctuality_enabled?: boolean
          sms_enabled?: boolean
          sport: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          team_color?: string
          trial_end_date?: string | null
          trial_start_date?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          assistant_admin_label?: string
          billing_plan?: Database["public"]["Enums"]["billing_plan"] | null
          billing_status?: Database["public"]["Enums"]["billing_status"]
          created_at?: string
          gps_enabled?: boolean
          id?: string
          logo_url?: string | null
          name?: string
          punctuality_enabled?: boolean
          sms_enabled?: boolean
          sport?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          team_color?: string
          trial_end_date?: string | null
          trial_start_date?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          auth_user_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          team_id: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          team_id: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string | null
          created_at: string
          device_id: string | null
          email: string | null
          first_name: string
          group_id: string | null
          id: string
          is_active: boolean
          is_test_account: boolean
          last_name: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          team_id: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          device_id?: string | null
          email?: string | null
          first_name: string
          group_id?: string | null
          id?: string
          is_active?: boolean
          is_test_account?: boolean
          last_name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          team_id?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          device_id?: string | null
          email?: string | null
          first_name?: string
          group_id?: string | null
          id?: string
          is_active?: boolean
          is_test_account?: boolean
          last_name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_team_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _auth_user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      is_master_admin: { Args: { _team_id: string }; Returns: boolean }
      is_team_admin: { Args: { _team_id: string }; Returns: boolean }
    }
    Enums: {
      account_type: "paid" | "trial" | "beta"
      app_role:
        | "athlete"
        | "assistant_admin"
        | "master_admin"
        | "tap4teams_admin"
      attendance_status: "present" | "excused" | "unexcused"
      billing_plan: "monthly" | "annual"
      billing_status: "active" | "past_due" | "cancelled" | "read_only"
      qr_type: "location" | "signup" | "adhoc"
      sms_target: "all" | "group" | "selected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: ["paid", "trial", "beta"],
      app_role: [
        "athlete",
        "assistant_admin",
        "master_admin",
        "tap4teams_admin",
      ],
      attendance_status: ["present", "excused", "unexcused"],
      billing_plan: ["monthly", "annual"],
      billing_status: ["active", "past_due", "cancelled", "read_only"],
      qr_type: ["location", "signup", "adhoc"],
      sms_target: ["all", "group", "selected"],
    },
  },
} as const
