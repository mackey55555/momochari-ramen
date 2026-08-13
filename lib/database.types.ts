/**
 * このファイルは Supabase CLI が DB のスキーマから自動生成したものです。
 * 手で編集しないでください（次の生成で上書きされます）。
 *
 * 再生成コマンド（実行するのは槇原。学生は触らなくて OK）:
 *   npx supabase gen types typescript --project-id <プロジェクトID> > lib/database.types.ts
 *
 * DB のカラムを増やしたときの手順は docs/database.md を参照。
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      ramen_measurements: {
        Row: {
          id: string;
          shop_id: string;
          salinity_pct: number | null;
          tds_ppm: number | null;
          temp_c: number | null;
          memo: string | null;
          measured_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          salinity_pct?: number | null;
          tds_ppm?: number | null;
          temp_c?: number | null;
          memo?: string | null;
          measured_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          salinity_pct?: number | null;
          tds_ppm?: number | null;
          temp_c?: number | null;
          memo?: string | null;
          measured_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ramen_measurements_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      ride_points: {
        Row: {
          id: number;
          device_id: string;
          lat: number;
          lng: number;
          accel_rms: number | null;
          co2_ppm: number | null;
          lux: number | null;
          recorded_at: string;
          created_at: string;
        };
        Insert: {
          id?: never;
          device_id: string;
          lat: number;
          lng: number;
          accel_rms?: number | null;
          co2_ppm?: number | null;
          lux?: number | null;
          recorded_at: string;
          created_at?: string;
        };
        Update: {
          id?: never;
          device_id?: string;
          lat?: number;
          lng?: number;
          accel_rms?: number | null;
          co2_ppm?: number | null;
          lux?: number | null;
          recorded_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      shops: {
        Row: {
          id: string;
          name: string;
          style: string | null;
          address: string | null;
          lat: number;
          lng: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          style?: string | null;
          address?: string | null;
          lat: number;
          lng: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          style?: string | null;
          address?: string | null;
          lat?: number;
          lng?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database["public"];

/** テーブル 1 行分の型。例: Tables<"shops"> */
export type Tables<TableName extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][TableName]["Row"];

/** insert に渡す型。例: TablesInsert<"ride_points"> */
export type TablesInsert<TableName extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][TableName]["Insert"];

/** update に渡す型。例: TablesUpdate<"shops"> */
export type TablesUpdate<TableName extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][TableName]["Update"];
