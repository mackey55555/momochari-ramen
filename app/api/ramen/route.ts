import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { TablesInsert } from "@/lib/database.types";

/**
 * POST /api/ramen — ラーメンの計測結果（塩分濃度・温度など）を登録する
 *
 * ============================================================
 * 送信の例
 * ============================================================
 *
 *   curl -X POST http://localhost:3000/api/ramen \
 *     -H "Content-Type: application/json" \
 *     -H "x-device-key: ここに DEVICE_API_KEY の値" \
 *     -d '{
 *           "shop_id": "11111111-1111-4111-8111-111111111111",
 *           "salinity_pct": 1.3,
 *           "tds_ppm": 13000,
 *           "temp_c": 78.2,
 *           "memo": "中華そば（並）"
 *         }'
 *
 *   成功すると、登録された 1 件がそのまま返ってきます。
 *
 * - shop_id は必須。shops テーブルに存在する id を指定してください
 *   （Supabase の Table Editor か /shops ページで確認できます）。
 * - salinity_pct / tds_ppm / temp_c / memo は省略可。
 * ============================================================
 */

/** 値が数値なら数値のまま、そうでなければ null を返す */
function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function POST(request: Request) {
  // --- 1. 合言葉（APIキー）の確認 ---------------------------------
  // /api/ingest と同じ仕組み。詳しくはそちらのコメントを参照。
  const expectedKey = process.env.DEVICE_API_KEY;
  if (!expectedKey || request.headers.get("x-device-key") !== expectedKey) {
    return NextResponse.json(
      { error: "x-device-key が正しくありません" },
      { status: 401 },
    );
  }

  // --- 2. JSON として読む -----------------------------------------
  let body: {
    shop_id?: unknown;
    salinity_pct?: unknown;
    tds_ppm?: unknown;
    temp_c?: unknown;
    memo?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストボディを JSON として読めませんでした" },
      { status: 400 },
    );
  }

  // --- 3. 中身の検証 ----------------------------------------------
  const shopId = body.shop_id;
  if (typeof shopId !== "string" || shopId === "") {
    return NextResponse.json(
      { error: "shop_id（文字列）は必須です" },
      { status: 400 },
    );
  }

  const row: TablesInsert<"ramen_measurements"> = {
    shop_id: shopId,
    salinity_pct: toNumberOrNull(body.salinity_pct),
    tds_ppm: toNumberOrNull(body.tds_ppm),
    temp_c: toNumberOrNull(body.temp_c),
    memo: typeof body.memo === "string" ? body.memo : null,
    // measured_at は指定しない → DB 側の default now() で「今」が入る
  };

  // --- 4. DB に保存 -----------------------------------------------
  // .select().single() を付けると、保存した 1 件を返してくれる。
  // 自動で決まる id や measured_at を確認できるので付けています。
  const { data, error } = await supabase
    .from("ramen_measurements")
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error("ramen_measurements の insert に失敗:", error);
    return NextResponse.json(
      { error: `保存に失敗しました: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
