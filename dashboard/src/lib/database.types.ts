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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_advisor_daily: {
        Row: {
          analysis: Json | null
          analysis_updated_at: string | null
          date: string
          last_call_at: string | null
          model_used: string | null
          primary_count: number
          total_calls: number
        }
        Insert: {
          analysis?: Json | null
          analysis_updated_at?: string | null
          date: string
          last_call_at?: string | null
          model_used?: string | null
          primary_count?: number
          total_calls?: number
        }
        Update: {
          analysis?: Json | null
          analysis_updated_at?: string | null
          date?: string
          last_call_at?: string | null
          model_used?: string | null
          primary_count?: number
          total_calls?: number
        }
        Relationships: []
      }
      daily_weather: {
        Row: {
          date: string
          precipitation_mm: number
          shortwave_radiation_mj: number
          source: string
          sunshine_duration_s: number
          temperature_max_c: number
          temperature_min_c: number
          updated_at: string
          weather_code: number
        }
        Insert: {
          date: string
          precipitation_mm: number
          shortwave_radiation_mj: number
          source: string
          sunshine_duration_s: number
          temperature_max_c: number
          temperature_min_c: number
          updated_at?: string
          weather_code: number
        }
        Update: {
          date?: string
          precipitation_mm?: number
          shortwave_radiation_mj?: number
          source?: string
          sunshine_duration_s?: number
          temperature_max_c?: number
          temperature_min_c?: number
          updated_at?: string
          weather_code?: number
        }
        Relationships: []
      }
      inverter_daily_history: {
        Row: {
          brand: string
          created_at: string | null
          date: string
          id: number
          inverter_id: string
          inverter_name: string
          is_estimated: boolean | null
          kwh: number
          notes: string | null
          source: string | null
        }
        Insert: {
          brand: string
          created_at?: string | null
          date: string
          id?: never
          inverter_id: string
          inverter_name: string
          is_estimated?: boolean | null
          kwh: number
          notes?: string | null
          source?: string | null
        }
        Update: {
          brand?: string
          created_at?: string | null
          date?: string
          id?: never
          inverter_id?: string
          inverter_name?: string
          is_estimated?: boolean | null
          kwh?: number
          notes?: string | null
          source?: string | null
        }
        Relationships: []
      }
      inverter_monthly_history: {
        Row: {
          brand: string
          created_at: string | null
          id: number
          inverter_id: string
          inverter_name: string
          is_estimated: boolean | null
          kwh: number
          month: string
          notes: string | null
          source: string | null
        }
        Insert: {
          brand: string
          created_at?: string | null
          id?: never
          inverter_id: string
          inverter_name: string
          is_estimated?: boolean | null
          kwh: number
          month: string
          notes?: string | null
          source?: string | null
        }
        Update: {
          brand?: string
          created_at?: string | null
          id?: never
          inverter_id?: string
          inverter_name?: string
          is_estimated?: boolean | null
          kwh?: number
          month?: string
          notes?: string | null
          source?: string | null
        }
        Relationships: []
      }
      solar_telemetry: {
        Row: {
          capacity_factor_pct: number | null
          created_at: string
          id: number
          inverters_count: number
          inverters_data: Json
          plant_name: string
          recorded_at: string
          total_lifetime_kwh: number
          total_nominal_capacity_kw: number
          total_power_kw: number
          total_power_w: number
          total_today_kwh: number
        }
        Insert: {
          capacity_factor_pct?: number | null
          created_at?: string
          id?: never
          inverters_count?: number
          inverters_data: Json
          plant_name?: string
          recorded_at?: string
          total_lifetime_kwh: number
          total_nominal_capacity_kw?: number
          total_power_kw: number
          total_power_w: number
          total_today_kwh: number
        }
        Update: {
          capacity_factor_pct?: number | null
          created_at?: string
          id?: never
          inverters_count?: number
          inverters_data?: Json
          plant_name?: string
          recorded_at?: string
          total_lifetime_kwh?: number
          total_nominal_capacity_kw?: number
          total_power_kw?: number
          total_power_w?: number
          total_today_kwh?: number
        }
        Relationships: []
      }
      utility_data: {
        Row: {
          cpf: string
          created_at: string
          distribuidora: string
          id: number
          perfil_usuario: Json | null
          tarifa_referencia: Json | null
          titular: string
          unidades_consumidoras: Json
          updated_at: string
        }
        Insert: {
          cpf: string
          created_at?: string
          distribuidora?: string
          id?: never
          perfil_usuario?: Json | null
          tarifa_referencia?: Json | null
          titular: string
          unidades_consumidoras: Json
          updated_at?: string
        }
        Update: {
          cpf?: string
          created_at?: string
          distribuidora?: string
          id?: never
          perfil_usuario?: Json | null
          tarifa_referencia?: Json | null
          titular?: string
          unidades_consumidoras?: Json
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      daily_generation: {
        Row: {
          date: string | null
          kwh: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      increment_ai_quota: {
        Args: { p_date: string; p_is_primary: boolean }
        Returns: {
          primary_count: number
          total_calls: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
