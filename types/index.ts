import type { Tables } from "@/lib/database.types";

/**
 * アプリで使う型のまとめ。
 *
 * 中身は自分で書かず、DB のスキーマから自動生成された型
 * （lib/database.types.ts）をそのまま別名にしています。
 * こうしておくと DB にカラムを足したとき、型を直し忘れて食い違うことがありません。
 *
 * 使い方:
 *   import type { Shop } from "@/types";
 *   const shop: Shop = ...;
 */

/** ラーメン店 1 件 */
export type Shop = Tables<"shops">;

/** 走行計測点 1 件（IoTデバイスが送ってくる計測データ） */
export type RidePoint = Tables<"ride_points">;

/** ラーメン計測 1 件（塩分濃度・温度など） */
export type RamenMeasurement = Tables<"ramen_measurements">;
