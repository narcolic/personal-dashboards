export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          country_code: string | null;
          created_at: string;
          id: string;
          industry_code: string | null;
          legal_name: string;
          sector_code: string | null;
          updated_at: string;
        };
        Insert: {
          country_code?: string | null;
          created_at?: string;
          id?: string;
          industry_code?: string | null;
          legal_name: string;
          sector_code?: string | null;
          updated_at?: string;
        };
        Update: {
          country_code?: string | null;
          created_at?: string;
          id?: string;
          industry_code?: string | null;
          legal_name?: string;
          sector_code?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "companies_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "companies_industry_code_fkey";
            columns: ["industry_code"];
            isOneToOne: false;
            referencedRelation: "industries";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "companies_industry_sector_fkey";
            columns: ["industry_code", "sector_code"];
            isOneToOne: false;
            referencedRelation: "industries";
            referencedColumns: ["code", "sector_code"];
          },
          {
            foreignKeyName: "companies_sector_code_fkey";
            columns: ["sector_code"];
            isOneToOne: false;
            referencedRelation: "sectors";
            referencedColumns: ["code"];
          },
        ];
      };
      company_provider_identifiers: {
        Row: {
          company_id: string;
          created_at: string;
          provider_code: string;
          provider_company_id: string;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          provider_code: string;
          provider_company_id: string;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          provider_code?: string;
          provider_company_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_provider_identifiers_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_provider_identifiers_provider_code_fkey";
            columns: ["provider_code"];
            isOneToOne: false;
            referencedRelation: "metadata_providers";
            referencedColumns: ["code"];
          },
        ];
      };
      countries: {
        Row: {
          code: string;
          created_at: string;
          name: string;
          region_code: string | null;
        };
        Insert: {
          code: string;
          created_at?: string;
          name: string;
          region_code?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string;
          name?: string;
          region_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "countries_region_code_fkey";
            columns: ["region_code"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["code"];
          },
        ];
      };
      exchanges: {
        Row: {
          code: string;
          country_code: string | null;
          created_at: string;
          id: string;
          mic: string | null;
          name: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          country_code?: string | null;
          created_at?: string;
          id?: string;
          mic?: string | null;
          name: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          country_code?: string | null;
          created_at?: string;
          id?: string;
          mic?: string | null;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exchanges_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
        ];
      };
      geographic_exposures: {
        Row: {
          code: string;
          country_code: string | null;
          created_at: string;
          exposure_scope: string;
          name: string;
          region_code: string | null;
        };
        Insert: {
          code: string;
          country_code?: string | null;
          created_at?: string;
          exposure_scope: string;
          name: string;
          region_code?: string | null;
        };
        Update: {
          code?: string;
          country_code?: string | null;
          created_at?: string;
          exposure_scope?: string;
          name?: string;
          region_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "geographic_exposures_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "geographic_exposures_region_code_fkey";
            columns: ["region_code"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["code"];
          },
        ];
      };
      industries: {
        Row: {
          code: string;
          created_at: string;
          name: string;
          review_status: string;
          reviewed_at: string | null;
          sector_code: string;
          source_provider_code: string | null;
        };
        Insert: {
          code: string;
          created_at?: string;
          name: string;
          review_status?: string;
          reviewed_at?: string | null;
          sector_code: string;
          source_provider_code?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string;
          name?: string;
          review_status?: string;
          reviewed_at?: string | null;
          sector_code?: string;
          source_provider_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "industries_sector_code_fkey";
            columns: ["sector_code"];
            isOneToOne: false;
            referencedRelation: "sectors";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "industries_source_provider_code_fkey";
            columns: ["source_provider_code"];
            isOneToOne: false;
            referencedRelation: "metadata_providers";
            referencedColumns: ["code"];
          },
        ];
      };
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
      market_exposure_categories: {
        Row: {
          code: string;
          created_at: string;
          name: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          name: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          name?: string;
        };
        Relationships: [];
      };
      metadata_providers: {
        Row: {
          code: string;
          created_at: string;
          name: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          name: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          name?: string;
        };
        Relationships: [];
      };
      portfolio_value_snapshots: {
        Row: {
          cost_basis_eur: number;
          cost_basis_usd: number;
          created_at: string;
          fx_metadata: Json;
          id: string;
          market_value_eur: number;
          market_value_usd: number;
          portfolio_id: string | null;
          portfolio_name: string | null;
          quote_metadata: Json;
          scope: string;
          scope_key: string;
          snapshot_at: string;
          snapshot_date: string;
          unrealized_eur: number;
          unrealized_usd: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cost_basis_eur?: number;
          cost_basis_usd?: number;
          created_at?: string;
          fx_metadata?: Json;
          id?: string;
          market_value_eur?: number;
          market_value_usd?: number;
          portfolio_id?: string | null;
          portfolio_name?: string | null;
          quote_metadata?: Json;
          scope: string;
          scope_key: string;
          snapshot_at: string;
          snapshot_date: string;
          unrealized_eur?: number;
          unrealized_usd?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cost_basis_eur?: number;
          cost_basis_usd?: number;
          created_at?: string;
          fx_metadata?: Json;
          id?: string;
          market_value_eur?: number;
          market_value_usd?: number;
          portfolio_id?: string | null;
          portfolio_name?: string | null;
          quote_metadata?: Json;
          scope?: string;
          scope_key?: string;
          snapshot_at?: string;
          snapshot_date?: string;
          unrealized_eur?: number;
          unrealized_usd?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "portfolio_value_snapshots_portfolio_id_fkey";
            columns: ["portfolio_id"];
            isOneToOne: false;
            referencedRelation: "portfolios";
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
          updated_at: string;
          user_id: string;
        };
        Insert: {
          broker?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          notes?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          broker?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      regions: {
        Row: {
          code: string;
          created_at: string;
          name: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          name: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          name?: string;
        };
        Relationships: [];
      };
      sectors: {
        Row: {
          code: string;
          created_at: string;
          name: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          name: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          name?: string;
        };
        Relationships: [];
      };
      securities: {
        Row: {
          company_id: string | null;
          created_at: string;
          geographic_exposure_code: string | null;
          id: string;
          market_exposure_category_code: string | null;
          name: string;
          primary_market_country_code: string | null;
          security_type_code: string;
          updated_at: string;
        };
        Insert: {
          company_id?: string | null;
          created_at?: string;
          geographic_exposure_code?: string | null;
          id?: string;
          market_exposure_category_code?: string | null;
          name: string;
          primary_market_country_code?: string | null;
          security_type_code: string;
          updated_at?: string;
        };
        Update: {
          company_id?: string | null;
          created_at?: string;
          geographic_exposure_code?: string | null;
          id?: string;
          market_exposure_category_code?: string | null;
          name?: string;
          primary_market_country_code?: string | null;
          security_type_code?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "securities_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "securities_geographic_exposure_code_fkey";
            columns: ["geographic_exposure_code"];
            isOneToOne: false;
            referencedRelation: "geographic_exposures";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "securities_market_exposure_category_code_fkey";
            columns: ["market_exposure_category_code"];
            isOneToOne: false;
            referencedRelation: "market_exposure_categories";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "securities_primary_market_country_code_fkey";
            columns: ["primary_market_country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "securities_security_type_code_fkey";
            columns: ["security_type_code"];
            isOneToOne: false;
            referencedRelation: "security_types";
            referencedColumns: ["code"];
          },
        ];
      };
      security_listing_provider_identifiers: {
        Row: {
          created_at: string;
          last_verified_at: string | null;
          listing_id: string;
          provider_code: string;
          provider_security_id: string | null;
          provider_symbol: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          last_verified_at?: string | null;
          listing_id: string;
          provider_code: string;
          provider_security_id?: string | null;
          provider_symbol: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          last_verified_at?: string | null;
          listing_id?: string;
          provider_code?: string;
          provider_security_id?: string | null;
          provider_symbol?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "security_listing_provider_identifiers_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "security_listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "security_listing_provider_identifiers_provider_code_fkey";
            columns: ["provider_code"];
            isOneToOne: false;
            referencedRelation: "metadata_providers";
            referencedColumns: ["code"];
          },
        ];
      };
      security_listings: {
        Row: {
          created_at: string;
          exchange_id: string | null;
          id: string;
          is_primary: boolean;
          security_id: string;
          status: string;
          symbol: string;
          trading_currency_code: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          exchange_id?: string | null;
          id?: string;
          is_primary?: boolean;
          security_id: string;
          status?: string;
          symbol: string;
          trading_currency_code?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          exchange_id?: string | null;
          id?: string;
          is_primary?: boolean;
          security_id?: string;
          status?: string;
          symbol?: string;
          trading_currency_code?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "security_listings_exchange_id_fkey";
            columns: ["exchange_id"];
            isOneToOne: false;
            referencedRelation: "exchanges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "security_listings_security_id_fkey";
            columns: ["security_id"];
            isOneToOne: false;
            referencedRelation: "securities";
            referencedColumns: ["id"];
          },
        ];
      };
      security_types: {
        Row: {
          code: string;
          created_at: string;
          name: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          name: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          name?: string;
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
      ticker_catalog: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          security_listing_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          security_listing_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          security_listing_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticker_catalog_security_listing_id_fkey";
            columns: ["security_listing_id"];
            isOneToOne: false;
            referencedRelation: "security_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: {
          action: string;
          created_at: string;
          id: string;
          notes: string | null;
          portfolio_id: string | null;
          price: number;
          security_listing_id: string;
          shares: number;
          transaction_currency: string;
          transaction_date: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          action?: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          portfolio_id?: string | null;
          price?: number;
          security_listing_id: string;
          shares: number;
          transaction_currency?: string;
          transaction_date?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          portfolio_id?: string | null;
          price?: number;
          security_listing_id?: string;
          shares?: number;
          transaction_currency?: string;
          transaction_date?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "positions_portfolio_id_fkey";
            columns: ["portfolio_id"];
            isOneToOne: false;
            referencedRelation: "portfolios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_security_listing_id_fkey";
            columns: ["security_listing_id"];
            isOneToOne: false;
            referencedRelation: "security_listings";
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
      portfolio_mcp_access_token_hook: { Args: { event: Json }; Returns: Json };
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
