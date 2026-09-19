import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { summarizeTaste, tasteColor, tasteLabel } from "@/lib/taste";
import type { RamenMeasurement } from "@/types";

/**
 * GET /api/shops — お店の一覧を、味の傾向つきで返す
 *
 * ============================================================
 * 何のためにあるか
 * ============================================================
 *
 * ラズパイ上で動く地図アプリ（iot/mapapp/）が、現在地の近くのお店を
 * 表示するために使います。ブラウザではなく Python から叩かれる API です。
 *
 *   curl https://momochari-ramen.vercel.app/api/shops
 *
 * ============================================================
 * なぜ「味の傾向」まで一緒に返すのか
 * ============================================================
 *
 * お店の情報だけ返して、濃厚 / ふつう / あっさり の判定はラズパイ側でやる、
 * という作りにもできます。が、それをやると lib/taste.ts のしきい値を
 * Python 側にコピーすることになり、**Web で調整したときに必ず食い違います**。
 *
 * 判定は lib/taste.ts の 1 箇所だけ。ラズパイは返ってきたラベルをそのまま出す。
 * こうしておけば「ラズパイの画面と Web の画面で言っていることが違う」が
 * 構造的に起きなくなります。色（color）まで返しているのも同じ理由です。
 *
 * ============================================================
 * 合言葉（x-device-key）が要らない理由
 * ============================================================
 *
 * /api/ingest と /api/ramen は「書き込み」なので合言葉で守っています。
 * こちらは読み取り専用で、中身は /shops のページで誰でも見られる情報と同じなので、
 * 合言葉なしにしています。ラズパイ側に鍵を持たせずに済むぶん、事故も減ります。
 * ============================================================
 */

/** 数値を小数第 n 位に丸める。null はそのまま null */
function round(value: number | null, digits: number) {
  if (value === null) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export async function GET() {
  // お店と計測を両方取る。片方ずつ await すると往復が 2 回分待ちになるので、
  // Promise.all でまとめて投げて待ち時間を 1 回分にしている。
  const [shopsResult, measurementsResult] = await Promise.all([
    supabase.from("shops").select("*").order("name"),
    supabase.from("ramen_measurements").select("*"),
  ]);

  if (shopsResult.error) {
    console.error("shops の取得に失敗:", shopsResult.error);
    return NextResponse.json(
      { error: `お店の取得に失敗しました: ${shopsResult.error.message}` },
      { status: 500 },
    );
  }

  // 計測のほうは、取れなくてもお店だけは返す。
  // ラズパイの画面から店名まで消えてしまうより、
  // 「味の傾向は計測なし」と出るほうがマシなので、ここでは 500 にしない。
  if (measurementsResult.error) {
    console.error(
      "ramen_measurements の取得に失敗（味の傾向なしで続行）:",
      measurementsResult.error,
    );
  }
  const measurements = measurementsResult.data ?? [];

  // お店ごとの計測をあらかじめ仕分けしておく。
  // お店 1 件ごとに measurements 全体を filter すると、
  // お店 × 計測 の回数だけ走査することになるので、先に 1 周して束ねる。
  const byShop = new Map<string, RamenMeasurement[]>();
  for (const measurement of measurements) {
    const list = byShop.get(measurement.shop_id);
    if (list) {
      list.push(measurement);
    } else {
      byShop.set(measurement.shop_id, [measurement]);
    }
  }

  const shops = shopsResult.data.map((shop) => {
    const taste = summarizeTaste(byShop.get(shop.id) ?? []);

    return {
      id: shop.id,
      name: shop.name,
      style: shop.style,
      address: shop.address,
      lat: shop.lat,
      lng: shop.lng,
      taste: {
        level: taste.level,
        // ラズパイ側が判定ロジックを持たなくて済むよう、表示に使う形まで作って渡す
        label: tasteLabel(taste.level),
        color: tasteColor(taste.level),
        count: taste.count,
        // 生の平均は桁が長いので、表示に使う精度に丸めてから返す
        // （Web の詳細パネルと同じ丸め方にそろえてある）
        avg_salinity_pct: round(taste.avgSalinity, 1),
        avg_richness_mv: round(taste.avgRichness, 0),
      },
    };
  });

  return NextResponse.json({
    shops,
    // ラズパイ側がキャッシュの鮮度を判断できるように、いつ作った一覧かを添える
    generated_at: new Date().toISOString(),
  });
}
