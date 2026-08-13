import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { TablesInsert } from "@/lib/database.types";

/**
 * POST /api/ingest — IoTデバイスから走行データを受け取る
 *
 * ============================================================
 * IoTチーム向け: 送信の例
 * ============================================================
 *
 *   curl -X POST http://localhost:3000/api/ingest \
 *     -H "Content-Type: application/json" \
 *     -H "x-device-key: ここに DEVICE_API_KEY の値" \
 *     -d '{
 *           "device_id": "raspi-01",
 *           "points": [
 *             {
 *               "lat": 34.6664,
 *               "lng": 133.9183,
 *               "accel_rms": 0.42,
 *               "co2_ppm": 480,
 *               "lux": 320,
 *               "recorded_at": "2025-09-19T10:00:00+09:00"
 *             },
 *             {
 *               "lat": 34.6670,
 *               "lng": 133.9190,
 *               "accel_rms": 1.85,
 *               "co2_ppm": 610,
 *               "lux": 210,
 *               "recorded_at": "2025-09-19T10:00:10+09:00"
 *             }
 *           ]
 *         }'
 *
 *   成功すると {"inserted":2} が返ります。
 *
 * - points は配列なので、まとめ送り（バッチ）ができます。
 *   1 点ずつ毎秒送るより、10〜60 点ためて送るほうが電池にも回線にも優しいです。
 * - lat / lng / recorded_at は必須。accel_rms / co2_ppm / lux は省略可（センサーが無い場合など）。
 * - recorded_at は ISO 8601 形式（例: "2025-09-19T10:00:00+09:00"）。
 *   タイムゾーンを付け忘れると UTC 扱いになり 9 時間ずれるので注意。
 *
 * 詳しい仕様は docs/api.md にも書いてあります。
 * ============================================================
 */

/** リクエストで送られてくる 1 点分のデータ（まだ検証していない生の形） */
type RawPoint = {
  lat?: unknown;
  lng?: unknown;
  accel_rms?: unknown;
  co2_ppm?: unknown;
  lux?: unknown;
  recorded_at?: unknown;
};

/** 1 回のリクエストで受け付ける最大の点数（巨大な JSON でサーバーが詰まるのを防ぐ） */
const MAX_POINTS = 1000;

/** 値が数値なら数値のまま、そうでなければ null を返す（省略されたセンサー値の扱い用） */
function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function POST(request: Request) {
  // --- 1. 合言葉（APIキー）の確認 ---------------------------------
  // 誰でも書き込めると困るので、ヘッダーの x-device-key が
  // 環境変数 DEVICE_API_KEY と一致したときだけ受け付ける。
  const expectedKey = process.env.DEVICE_API_KEY;
  if (!expectedKey || request.headers.get("x-device-key") !== expectedKey) {
    return NextResponse.json(
      { error: "x-device-key が正しくありません" },
      { status: 401 },
    );
  }

  // --- 2. JSON として読む -----------------------------------------
  let body: { device_id?: unknown; points?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストボディを JSON として読めませんでした" },
      { status: 400 },
    );
  }

  // --- 3. 中身の検証 ----------------------------------------------
  const deviceId = body.device_id;
  if (typeof deviceId !== "string" || deviceId === "") {
    return NextResponse.json(
      { error: "device_id（文字列）は必須です" },
      { status: 400 },
    );
  }

  const points = body.points;
  if (!Array.isArray(points) || points.length === 0) {
    return NextResponse.json(
      { error: "points（1 件以上の配列）は必須です" },
      { status: 400 },
    );
  }

  if (points.length > MAX_POINTS) {
    return NextResponse.json(
      { error: `points は一度に ${MAX_POINTS} 件までにしてください` },
      { status: 400 },
    );
  }

  // 1 点ずつ確認しながら、DB に入れる形（rows）に組み替えていく。
  const rows: TablesInsert<"ride_points">[] = [];
  for (const [index, point] of (points as RawPoint[]).entries()) {
    const lat = point?.lat;
    const lng = point?.lng;
    const recordedAt = point?.recorded_at;

    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json(
        { error: `points[${index}]: lat と lng は数値で必須です` },
        { status: 400 },
      );
    }
    if (typeof recordedAt !== "string" || recordedAt === "") {
      return NextResponse.json(
        {
          error: `points[${index}]: recorded_at（ISO 8601 の文字列）は必須です`,
        },
        { status: 400 },
      );
    }

    rows.push({
      device_id: deviceId,
      lat,
      lng,
      // センサーが付いていない・値が取れなかった場合は null で入れておく
      accel_rms: toNumberOrNull(point.accel_rms),
      co2_ppm: toNumberOrNull(point.co2_ppm),
      lux: toNumberOrNull(point.lux),
      recorded_at: recordedAt,
    });
  }

  // --- 4. DB に保存 -----------------------------------------------
  // 配列を渡すと、まとめて INSERT してくれる（1 件ずつより速い）。
  const { error } = await supabase.from("ride_points").insert(rows);

  if (error) {
    // 何が起きたかログに残しておくと、Vercel のログから原因を追える
    console.error("ride_points の insert に失敗:", error);
    return NextResponse.json(
      { error: `保存に失敗しました: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ inserted: rows.length });
}
