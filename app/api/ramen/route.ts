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
 *           "richness_mv": 1250,
 *           "temp_c": 78.2,
 *           "memo": "中華そば（並）"
 *         }'
 *
 *   成功すると、登録された 1 件がそのまま返ってきます。
 *
 * - shop_id は必須。shops テーブルに存在する id を指定してください
 *   （Supabase の Table Editor か /shops ページで確認できます）。
 * - salinity_pct / tds_ppm / richness_mv / temp_c / memo は省略可。
 * - richness_mv は「こってり度」。静電容量式センサーの出力電圧(mV)をそのまま送る。
 * ============================================================
 */

/** 省略された（送られてこなかった）項目かどうか */
function isOmitted(value: unknown): boolean {
  return value === undefined || value === null;
}

/** 数値として使える値かどうか */
function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
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
    richness_mv?: unknown;
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

  // 数値の項目は省略できるが、送るなら数値で送ってもらう（理由は /api/ingest と同じ）
  for (const key of [
    "salinity_pct",
    "tds_ppm",
    "richness_mv",
    "temp_c",
  ] as const) {
    const value = body[key];
    if (!isOmitted(value) && !isNumber(value)) {
      return NextResponse.json(
        {
          error: `${key}: 数値で送ってください（"78.2" のように引用符で囲むとエラーになります）`,
        },
        { status: 400 },
      );
    }
  }

  const row: TablesInsert<"ramen_measurements"> = {
    shop_id: shopId,
    salinity_pct: isNumber(body.salinity_pct) ? body.salinity_pct : null,
    tds_ppm: isNumber(body.tds_ppm) ? body.tds_ppm : null,
    richness_mv: isNumber(body.richness_mv) ? body.richness_mv : null,
    temp_c: isNumber(body.temp_c) ? body.temp_c : null,
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

    // 22P02 は PostgreSQL の「値の形式が違う」。
    // shop_id が UUID の形になっていない（デバイス名や連番を入れた）ときに起きる。
    // 送る側のミスなので 400 で返し、何を入れるべきかまで伝える。
    if (error.code === "22P02") {
      return NextResponse.json(
        {
          error:
            "shop_id の形式が正しくありません。お店の ID は 11111111-1111-4111-8111-111111111111 のような UUID です（デバイス名や連番ではありません）。/shops のページで確認できます",
        },
        { status: 400 },
      );
    }

    // 23503 は PostgreSQL の「外部キー制約違反」＝ shops に無い shop_id を指定した、ということ。
    // これは送る側のミスなので、サーバー障害（500）ではなく 400 で返して原因を伝える。
    if (error.code === "23503") {
      return NextResponse.json(
        {
          error:
            "shop_id に対応するお店が見つかりません。shops テーブルに存在する id を指定してください",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: `保存に失敗しました: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
