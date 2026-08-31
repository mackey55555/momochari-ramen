import { supabase } from "@/lib/supabase";
import { formatJst } from "@/lib/format";

/**
 * ラーメン計測ページ（/measurements）
 *
 * 塩分濃度・温度の計測結果を、新しい順に一覧で表示します。
 * お店の名前も一緒に出すために、shops テーブルと結合して取得しています。
 */

// このページを開くたびに Supabase へ最新データを取りに行く、という設定。
export const dynamic = "force-dynamic";

export default async function MeasurementsPage() {
  // supabase-js の書き方:
  //   .from("ramen_measurements")                 … ramen_measurements テーブルから
  //   .select("*, shops(name, style)")            … 全カラム + 紐づく shops の一部を
  //   .order("measured_at", { ascending: false }) … 計測時刻の新しい順で取得
  //
  // select の中に shops(name, style) と書くだけでお店の情報がくっついてきます。
  // schema.sql で shop_id が shops(id) を参照する設定になっており、
  // Supabase がその関係を知っているためです。
  const { data: measurements, error } = await supabase
    .from("ramen_measurements")
    .select("*, shops(name, style)")
    .order("measured_at", { ascending: false });

  // 取得に失敗したとき（URL やキーが間違っている、テーブルが無い、など）
  if (error) {
    return (
      <div className="p-8">
        <h1 className="mb-4 text-2xl font-bold">ラーメン計測</h1>
        <p className="text-red-600">
          データの取得に失敗しました: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="mb-4 text-2xl font-bold">ラーメン計測</h1>

      {measurements.length === 0 ? (
        <p>まだ計測がありません</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto border-collapse">
            <thead>
              <tr className="text-left">
                <th className="px-2 py-1">計測日時</th>
                <th className="px-2 py-1">店名</th>
                <th className="px-2 py-1">塩分濃度</th>
                <th className="px-2 py-1">温度</th>
                <th className="px-2 py-1">メモ</th>
              </tr>
            </thead>
            <tbody>
              {measurements.map((m) => (
                <tr key={m.id} className="border-t">
                  {/* 日時は必ず formatJst を通す（理由は lib/format.ts のコメント参照） */}
                  <td className="px-2 py-2">{formatJst(m.measured_at)}</td>
                  <td className="px-2 py-2">{m.shops.name}</td>
                  <td className="px-2 py-2">{m.salinity_pct ?? "-"}</td>
                  <td className="px-2 py-2">{m.temp_c ?? "-"}</td>
                  <td className="px-2 py-2">{m.memo ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
