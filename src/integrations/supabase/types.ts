export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      job_catalog: {
        Row: {
          category: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      manual_reminders: {
        Row: {
          created_at: string;
          due_date: string | null;
          id: string;
          is_done: boolean;
          notes: string | null;
          title: string;
          user_id: string;
          vehicle_id: string;
        };
        Insert: {
          created_at?: string;
          due_date?: string | null;
          id?: string;
          is_done?: boolean;
          notes?: string | null;
          title: string;
          user_id: string;
          vehicle_id: string;
        };
        Update: {
          created_at?: string;
          due_date?: string | null;
          id?: string;
          is_done?: boolean;
          notes?: string | null;
          title?: string;
          user_id?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "manual_reminders_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      portfolios: {
        Row: {
          broker: string | null;
          created_at: string;
          id: string;
          name: string;
          notes: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          broker?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          notes?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          broker?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      ticker_catalog: {
        Row: {
          asset_type: string | null;
          created_at: string;
          currency: string | null;
          id: string;
          is_active: boolean;
          market: string | null;
          name: string | null;
          ticker: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          asset_type?: string | null;
          created_at?: string;
          currency?: string | null;
          id?: string;
          is_active?: boolean;
          market?: string | null;
          name?: string | null;
          ticker: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          asset_type?: string | null;
          created_at?: string;
          currency?: string | null;
          id?: string;
          is_active?: boolean;
          market?: string | null;
          name?: string | null;
          ticker?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      service_jobs: {
        Row: {
          category_snapshot: string | null;
          created_at: string;
          id: string;
          is_custom: boolean;
          job_catalog_id: string | null;
          job_name_snapshot: string;
          line_total_ex_vat: number;
          notes: string | null;
          quantity: number;
          service_visit_id: string;
          unit_price_ex_vat: number;
          updated_at: string;
        };
        Insert: {
          category_snapshot?: string | null;
          created_at?: string;
          id?: string;
          is_custom?: boolean;
          job_catalog_id?: string | null;
          job_name_snapshot: string;
          line_total_ex_vat: number;
          notes?: string | null;
          quantity?: number;
          service_visit_id: string;
          unit_price_ex_vat: number;
          updated_at?: string;
        };
        Update: {
          category_snapshot?: string | null;
          created_at?: string;
          id?: string;
          is_custom?: boolean;
          job_catalog_id?: string | null;
          job_name_snapshot?: string;
          line_total_ex_vat?: number;
          notes?: string | null;
          quantity?: number;
          service_visit_id?: string;
          unit_price_ex_vat?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_jobs_job_catalog_id_fkey";
            columns: ["job_catalog_id"];
            isOneToOne: false;
            referencedRelation: "job_catalog";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_jobs_service_visit_id_fkey";
            columns: ["service_visit_id"];
            isOneToOne: false;
            referencedRelation: "service_visits";
            referencedColumns: ["id"];
          },
        ];
      };
      service_reminders: {
        Row: {
          created_at: string;
          id: string;
          interval_km: number | null;
          interval_months: number | null;
          is_active: boolean;
          job_name: string;
          notes: string | null;
          user_id: string;
          vehicle_id: string;
          warning_days: number | null;
          warning_km: number | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          interval_km?: number | null;
          interval_months?: number | null;
          is_active?: boolean;
          job_name: string;
          notes?: string | null;
          user_id: string;
          vehicle_id: string;
          warning_days?: number | null;
          warning_km?: number | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          interval_km?: number | null;
          interval_months?: number | null;
          is_active?: boolean;
          job_name?: string;
          notes?: string | null;
          user_id?: string;
          vehicle_id?: string;
          warning_days?: number | null;
          warning_km?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "service_reminders_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      service_visits: {
        Row: {
          created_at: string;
          id: string;
          is_annual_service: boolean;
          notes: string | null;
          odometer_km: number;
          service_date: string;
          subtotal_ex_vat: number;
          total_amount: number;
          updated_at: string;
          user_id: string;
          vat_amount: number;
          vat_rate: number;
          vehicle_id: string;
          workshop: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_annual_service?: boolean;
          notes?: string | null;
          odometer_km: number;
          service_date: string;
          subtotal_ex_vat?: number;
          total_amount?: number;
          updated_at?: string;
          user_id: string;
          vat_amount?: number;
          vat_rate?: number;
          vehicle_id: string;
          workshop?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_annual_service?: boolean;
          notes?: string | null;
          odometer_km?: number;
          service_date?: string;
          subtotal_ex_vat?: number;
          total_amount?: number;
          updated_at?: string;
          user_id?: string;
          vat_amount?: number;
          vat_rate?: number;
          vehicle_id?: string;
          workshop?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "service_visits_vehicle_fk";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: {
          asset_type: string | null;
          created_at: string;
          currency: string | null;
          id: string;
          market: string | null;
          name: string | null;
          notes: string | null;
          portfolio_id: string | null;
          price: number | null;
          shares: number | null;
          ticker: string | null;
          transaction_date: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          asset_type?: string | null;
          created_at?: string;
          currency?: string | null;
          id?: string;
          market?: string | null;
          name?: string | null;
          notes?: string | null;
          portfolio_id?: string | null;
          price?: number | null;
          shares?: number | null;
          ticker?: string | null;
          transaction_date?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          asset_type?: string | null;
          created_at?: string;
          currency?: string | null;
          id?: string;
          market?: string | null;
          name?: string | null;
          notes?: string | null;
          portfolio_id?: string | null;
          price?: number | null;
          shares?: number | null;
          ticker?: string | null;
          transaction_date?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_portfolio_id_fkey";
            columns: ["portfolio_id"];
            isOneToOne: false;
            referencedRelation: "portfolios";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicles: {
        Row: {
          created_at: string;
          id: string;
          make: string | null;
          model: string | null;
          name: string;
          plate: string | null;
          updated_at: string;
          user_id: string;
          year: number | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          make?: string | null;
          model?: string | null;
          name: string;
          plate?: string | null;
          updated_at?: string;
          user_id: string;
          year?: number | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          make?: string | null;
          model?: string | null;
          name?: string;
          plate?: string | null;
          updated_at?: string;
          user_id?: string;
          year?: number | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      recalculate_service_visit_totals: {
        Args: { p_service_visit_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
