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
      alumnos: {
        Row: {
          alergias: string | null
          ci: string
          condiciones: string | null
          created_at: string
          direccion: string | null
          grado: string | null
          id: string
          nacimiento: string | null
          nombre: string
          rep_email: string | null
          rep_nombre: string | null
          rep_parentesco: string | null
          rep_telefono: string | null
          sangre: string | null
          seccion: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          alergias?: string | null
          ci: string
          condiciones?: string | null
          created_at?: string
          direccion?: string | null
          grado?: string | null
          id?: string
          nacimiento?: string | null
          nombre: string
          rep_email?: string | null
          rep_nombre?: string | null
          rep_parentesco?: string | null
          rep_telefono?: string | null
          sangre?: string | null
          seccion?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          alergias?: string | null
          ci?: string
          condiciones?: string | null
          created_at?: string
          direccion?: string | null
          grado?: string | null
          id?: string
          nacimiento?: string | null
          nombre?: string
          rep_email?: string | null
          rep_nombre?: string | null
          rep_parentesco?: string | null
          rep_telefono?: string | null
          sangre?: string | null
          seccion?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      app_config: {
        Row: {
          id: number
          lapsos_count: number
          materias_list: string[] | null
          evaluaciones_por_lapso: number | null
          materias_por_grado: Json | null
          updated_at: string
        }
        Insert: {
          evaluaciones_por_lapso?: number | null
          id?: number
          lapsos_count?: number
          materias_list?: string[] | null
          materias_por_grado?: Json | null
          updated_at?: string
        }
        Update: {
          evaluaciones_por_lapso?: number | null
          id?: number
          lapsos_count?: number
          materias_list?: string[] | null
          materias_por_grado?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      bot_config: {
        Row: {
          enabled: boolean
          id: number
          telegram_chat_id: string | null
          telegram_token: string | null
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          id?: number
          telegram_chat_id?: string | null
          telegram_token?: string | null
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          id?: number
          telegram_chat_id?: string | null
          telegram_token?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notas: {
        Row: {
          alumno_id: string
          autorizado: boolean
          created_at: string
          estado: string
          id: string
          materia: string
          promedio: number
          t1_sub: Json | null
          t2_sub: Json | null
          t3_sub: Json | null
          tramo1: number
          tramo2: number
          tramo3: number
          updated_at: string
        }
        Insert: {
          alumno_id: string
          autorizado?: boolean
          created_at?: string
          estado?: string
          id?: string
          materia: string
          promedio?: number
          t1_sub?: Json | null
          t2_sub?: Json | null
          t3_sub?: Json | null
          tramo1?: number
          tramo2?: number
          tramo3?: number
          updated_at?: string
        }
        Update: {
          alumno_id?: string
          autorizado?: boolean
          created_at?: string
          estado?: string
          id?: string
          materia?: string
          promedio?: number
          t1_sub?: Json | null
          t2_sub?: Json | null
          t3_sub?: Json | null
          tramo1?: number
          tramo2?: number
          tramo3?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "alumnos"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_audit: {
        Row: {
          action: string
          alumno_id: string | null
          changed_by: string | null
          changed_by_name: string | null
          created_at: string
          id: string
          new_values: Json | null
          nota_id: string | null
          old_values: Json | null
        }
        Insert: {
          action: string
          alumno_id?: string | null
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          nota_id?: string | null
          old_values?: Json | null
        }
        Update: {
          action?: string
          alumno_id?: string | null
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          nota_id?: string | null
          old_values?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ci: string | null
          created_at: string
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          ci?: string | null
          created_at?: string
          id: string
          nombre?: string
          updated_at?: string
        }
        Update: {
          ci?: string | null
          created_at?: string
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "root" | "admin" | "docente" | "student"
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
      app_role: ["root", "admin", "docente", "student"],
    },
  },
} as const
