/**
 * ラーメン計測ページ（/measurements）
 *
 * まだ中身は空です。ここを作るのが Issue になります。
 * データの取り方は app/shops/page.tsx がお手本になります。
 */

import { supabase } from "@/lib/supabase";

/**
 * ラーメン店の一覧ページ（/shops）
 *
 * === このファイルは「Supabase からデータを取って表示する」お手本です ===
 *
 * 新しいページを作るときは、だいたいこの形をコピーすれば動きます。
 * ポイントは 3 つだけです。
 *
 *   1. コンポーネントに async を付ける（サーバー側で動くので await が書ける）
 *   2. supabase.from("テーブル名").select() でデータを取る
 *   3. 返ってきた配列を .map() で並べる
 */

// このページを開くたびに Supabase へ最新データを取りに行く、という設定。
// これを書かないと Next.js は「ビルドしたときに 1 回だけ取得して固定」しようとするので、
// 店を追加しても画面が変わらない…という事故が起きます。
export const dynamic = "force-dynamic";

export default async function MeasurementsPage() {
  // supabase-js の書き方:
  //   .from("ramen_measurements")   … ramen_measurements テーブルから
  //   .select("*, shops(name, style)")     … 全カラムを取得し、shops テーブルと結合
  //   .order("created_at", { ascending: false })   … created_at の降順で並べて取得
  //
  // 結果は { data, error } の形で返ってきます。例外は投げられないので、
  // error が入っていないかを自分で確認する必要があります。
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

  const rows = measurements ?? [];

  return (
    <div className="p-8">
      <h1 className="mb-4 text-2xl font-bold">ラーメン計測</h1>

      {rows.length === 0 ? (
        <p>データがありません</p>
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
              {rows.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="px-2 py-2">
                    {m.measured_at
                      ? new Date(m.measured_at).toLocaleString()
                      : "-"}
                  </td>
                  <td className="px-2 py-2">{m.shops?.name ?? "-"}</td>
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





/*export default function MeasurementsPage() {
  return (
    <div className="p-8">
      <h1 className="mb-2 text-2xl font-bold">ラーメン計測</h1>
      <p className="mb-6 text-sm text-gray-500">
        塩分濃度・温度の計測結果を見るページです。
      </p>

      <div className="rounded border border-dashed border-gray-300 p-6 text-sm text-gray-600">
        <p className="mb-2 font-medium">ここはこれから作るところです</p>
        <ul className="list-disc pl-5">
          <li>
            ramen_measurements を新しい順に一覧表示する（お店の名前つきで）
          </li>
          <li>手入力フォーム（デバイスが壊れたときのバックアップ用）</li>
        </ul>
      </div>
    </div>
  );
}
*/