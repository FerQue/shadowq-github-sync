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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          decided_at: string | null
          duration_days: number | null
          escalated_at: string | null
          id: string
          kind: string
          reason: string
          requested_class: number
          requester_id: string
          route: Database["public"]["Enums"]["route"]
          service_id: string
          status: Database["public"]["Enums"]["request_status"]
          submitted_at: string
        }
        Insert: {
          decided_at?: string | null
          duration_days?: number | null
          escalated_at?: string | null
          id?: string
          kind?: string
          reason: string
          requested_class: number
          requester_id: string
          route: Database["public"]["Enums"]["route"]
          service_id: string
          status?: Database["public"]["Enums"]["request_status"]
          submitted_at?: string
        }
        Update: {
          decided_at?: string | null
          duration_days?: number | null
          escalated_at?: string | null
          id?: string
          kind?: string
          reason?: string
          requested_class?: number
          requester_id?: string
          route?: Database["public"]["Enums"]["route"]
          service_id?: string
          status?: Database["public"]["Enums"]["request_status"]
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "employees_pseudo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "ai_services"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_services: {
        Row: {
          agentic: boolean | null
          approved_at: string | null
          category: string | null
          ceiling: number | null
          conditions: string | null
          data_region: string | null
          embedded_in: string | null
          expires_at: string | null
          first_seen_at: string
          has_assurance: boolean | null
          has_dpa: boolean | null
          id: string
          is_default_alternative: boolean
          kill_switch: boolean
          name: string
          owner_id: string | null
          retention_days: number | null
          risk_tier: Database["public"]["Enums"]["risk_tier"]
          sso_and_audit_logs: boolean | null
          status: Database["public"]["Enums"]["service_status"]
          trains_on_inputs: boolean | null
          vendor: string | null
          vendor_changed: boolean
        }
        Insert: {
          agentic?: boolean | null
          approved_at?: string | null
          category?: string | null
          ceiling?: number | null
          conditions?: string | null
          data_region?: string | null
          embedded_in?: string | null
          expires_at?: string | null
          first_seen_at?: string
          has_assurance?: boolean | null
          has_dpa?: boolean | null
          id: string
          is_default_alternative?: boolean
          kill_switch?: boolean
          name: string
          owner_id?: string | null
          retention_days?: number | null
          risk_tier?: Database["public"]["Enums"]["risk_tier"]
          sso_and_audit_logs?: boolean | null
          status?: Database["public"]["Enums"]["service_status"]
          trains_on_inputs?: boolean | null
          vendor?: string | null
          vendor_changed?: boolean
        }
        Update: {
          agentic?: boolean | null
          approved_at?: string | null
          category?: string | null
          ceiling?: number | null
          conditions?: string | null
          data_region?: string | null
          embedded_in?: string | null
          expires_at?: string | null
          first_seen_at?: string
          has_assurance?: boolean | null
          has_dpa?: boolean | null
          id?: string
          is_default_alternative?: boolean
          kill_switch?: boolean
          name?: string
          owner_id?: string | null
          retention_days?: number | null
          risk_tier?: Database["public"]["Enums"]["risk_tier"]
          sso_and_audit_logs?: boolean | null
          status?: Database["public"]["Enums"]["service_status"]
          trains_on_inputs?: boolean | null
          vendor?: string | null
          vendor_changed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_services_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_services_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "employees_pseudo"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          approver_id: string
          ceiling: number | null
          conditions: string | null
          decision: string
          expires_at: string | null
          id: number
          request_id: string
          role: Database["public"]["Enums"]["app_role"]
          signed_at: string
        }
        Insert: {
          approver_id: string
          ceiling?: number | null
          conditions?: string | null
          decision: string
          expires_at?: string | null
          id?: number
          request_id: string
          role: Database["public"]["Enums"]["app_role"]
          signed_at?: string
        }
        Update: {
          approver_id?: string
          ceiling?: number | null
          conditions?: string | null
          decision?: string
          expires_at?: string | null
          id?: number
          request_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          signed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "employees_pseudo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "access_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "overdue_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          details: Json
          entity: string
          entity_id: string
          id: number
          policy_version: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          details?: Json
          entity: string
          entity_id: string
          id?: number
          policy_version?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          details?: Json
          entity?: string
          entity_id?: string
          id?: number
          policy_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "employees_pseudo"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          action: Database["public"]["Enums"]["policy_action"]
          alternative_id: string | null
          at: string
          class_source: string | null
          department_id: string
          effective_class: number | null
          employee_id: string
          exception_id: string | null
          id: string
          policy_version: string
          rule: string
          service_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["policy_action"]
          alternative_id?: string | null
          at?: string
          class_source?: string | null
          department_id: string
          effective_class?: number | null
          employee_id: string
          exception_id?: string | null
          id?: string
          policy_version: string
          rule: string
          service_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["policy_action"]
          alternative_id?: string | null
          at?: string
          class_source?: string | null
          department_id?: string
          effective_class?: number | null
          employee_id?: string
          exception_id?: string | null
          id?: string
          policy_version?: string
          rule?: string
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decisions_alternative_id_fkey"
            columns: ["alternative_id"]
            isOneToOne: false
            referencedRelation: "ai_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_pseudo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "ai_services"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          default_class: number
          id: string
          name: string
        }
        Insert: {
          default_class: number
          id: string
          name: string
        }
        Update: {
          default_class?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          auth_user_id: string | null
          created_at: string
          department_id: string
          display_name: string
          id: string
          manager_id: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          department_id: string
          display_name: string
          id: string
          manager_id?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          department_id?: string
          display_name?: string
          id?: string
          manager_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees_pseudo"
            referencedColumns: ["id"]
          },
        ]
      }
      exceptions: {
        Row: {
          department_id: string | null
          employee_id: string | null
          expires_at: string
          granted_by: string
          id: string
          max_class: number
          request_id: string | null
          service_id: string
        }
        Insert: {
          department_id?: string | null
          employee_id?: string | null
          expires_at: string
          granted_by: string
          id: string
          max_class: number
          request_id?: string | null
          service_id: string
        }
        Update: {
          department_id?: string | null
          employee_id?: string | null
          expires_at?: string
          granted_by?: string
          id?: string
          max_class?: number
          request_id?: string | null
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exceptions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exceptions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exceptions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_pseudo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exceptions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exceptions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "employees_pseudo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exceptions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "access_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exceptions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "overdue_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exceptions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "ai_services"
            referencedColumns: ["id"]
          },
        ]
      }
      signals: {
        Row: {
          detail: Json
          employee_id: string
          id: number
          observed_at: string
          service_id: string
          source: string
        }
        Insert: {
          detail?: Json
          employee_id: string
          id?: number
          observed_at: string
          service_id: string
          source: string
        }
        Update: {
          detail?: Json
          employee_id?: string
          id?: number
          observed_at?: string
          service_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "signals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_pseudo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "ai_services"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          declared_class: number | null
          employee_id: string
          id: number
          observed_at: string
          service_id: string
          sources: string[]
        }
        Insert: {
          declared_class?: number | null
          employee_id: string
          id?: number
          observed_at: string
          service_id: string
          sources: string[]
        }
        Update: {
          declared_class?: number | null
          employee_id?: string
          id?: number
          observed_at?: string
          service_id?: string
          sources?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_pseudo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "ai_services"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          employee_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          employee_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          employee_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_pseudo"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      employees_pseudo: {
        Row: {
          department_id: string | null
          id: string | null
          manager_id: string | null
        }
        Insert: {
          department_id?: string | null
          id?: string | null
          manager_id?: string | null
        }
        Update: {
          department_id?: string | null
          id?: string | null
          manager_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees_pseudo"
            referencedColumns: ["id"]
          },
        ]
      }
      overdue_requests: {
        Row: {
          business_days_open: number | null
          decided_at: string | null
          duration_days: number | null
          escalate_to: string | null
          escalated_at: string | null
          id: string | null
          kind: string | null
          reason: string | null
          requested_class: number | null
          requester_id: string | null
          route: Database["public"]["Enums"]["route"] | null
          service_id: string | null
          status: Database["public"]["Enums"]["request_status"] | null
          submitted_at: string | null
          target_days: number | null
        }
        Insert: {
          business_days_open?: never
          decided_at?: string | null
          duration_days?: number | null
          escalate_to?: never
          escalated_at?: string | null
          id?: string | null
          kind?: string | null
          reason?: string | null
          requested_class?: number | null
          requester_id?: string | null
          route?: Database["public"]["Enums"]["route"] | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["request_status"] | null
          submitted_at?: string | null
          target_days?: never
        }
        Update: {
          business_days_open?: never
          decided_at?: string | null
          duration_days?: number | null
          escalate_to?: never
          escalated_at?: string | null
          id?: string | null
          kind?: string | null
          reason?: string | null
          requested_class?: number | null
          requester_id?: string | null
          route?: Database["public"]["Enums"]["route"] | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["request_status"] | null
          submitted_at?: string | null
          target_days?: never
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "employees_pseudo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "ai_services"
            referencedColumns: ["id"]
          },
        ]
      }
      priority_reviews: {
        Row: {
          distinct_employees: number | null
          name: string | null
          service_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decisions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "ai_services"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      business_days_between: { Args: { a: string; b: string }; Returns: number }
      can_review: {
        Args: { req: Database["public"]["Tables"]["access_requests"]["Row"] }
        Returns: boolean
      }
      claim_persona: { Args: { p_employee_id: string }; Returns: string }
      current_employee_id: { Args: never; Returns: string }
      has_role: {
        Args: { r: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      my_persona: { Args: never; Returns: Json }
      route_roles: {
        Args: { r: Database["public"]["Enums"]["route"] }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      set_kill_switch: {
        Args: { p_on: boolean; p_service_id: string }
        Returns: undefined
      }
      sign_request: {
        Args: {
          p_ceiling?: number
          p_conditions?: string
          p_decision: string
          p_expires_at?: string
          p_request_id: string
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "employee"
        | "manager"
        | "governance_lead"
        | "security"
        | "privacy"
        | "secops"
      policy_action:
        | "allow"
        | "coach"
        | "redirect"
        | "request_approval"
        | "block"
        | "allow_with_alert"
      request_status:
        | "open"
        | "approved"
        | "rejected"
        | "exception_granted"
        | "withdrawn"
      risk_tier: "low" | "medium" | "high"
      route: "low" | "medium" | "high"
      service_status: "approved" | "under_review" | "unknown" | "prohibited"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "employee",
        "manager",
        "governance_lead",
        "security",
        "privacy",
        "secops",
      ],
      policy_action: [
        "allow",
        "coach",
        "redirect",
        "request_approval",
        "block",
        "allow_with_alert",
      ],
      request_status: [
        "open",
        "approved",
        "rejected",
        "exception_granted",
        "withdrawn",
      ],
      risk_tier: ["low", "medium", "high"],
      route: ["low", "medium", "high"],
      service_status: ["approved", "under_review", "unknown", "prohibited"],
    },
  },
} as const
