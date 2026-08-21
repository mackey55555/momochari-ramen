/**
 * 走行データページ（/rides）
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

export default async function RidesPage() {
  // supabase-js の書き方:
  //   .from("shops")   … shops テーブルから
  //   .select("*")     … 全カラムを
  //   .order("name")   … name の昇順で並べて取得
  //
  // 結果は { data, error } の形で返ってきます。例外は投げられないので、
  // error が入っていないかを自分で確認する必要があります。
  const { data: points, error } = await supabase
    .from("ride_points")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="p-8">
        <h1 className="mb-4 text-2xl font-bold">走行データ</h1>
        <p className="text-red-600">データの取得に失敗しました: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="mb-4 text-2xl font-bold">走行データ</h1>

      {(!points || points.length === 0) ? (
        <p>まだデータがありません</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border px-3 py-2 text-left">計測時刻</th>
                <th className="border px-3 py-2 text-left">デバイスID</th>
                <th className="border px-3 py-2 text-left">緯度</th>
                <th className="border px-3 py-2 text-left">経度</th>
                <th className="border px-3 py-2 text-left">振動</th>
                <th className="border px-3 py-2 text-left">CO2</th>
                <th className="border px-3 py-2 text-left">照度</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p: any) => (
                <tr key={p.id} className="odd:bg-white even:bg-gray-50">
                  <td className="border px-3 py-2 align-top">
                    {p.recorded_at ? new Date(p.recorded_at).toLocaleString("ja-JP") : "-"}
                  </td>
                  <td className="border px-3 py-2 align-top">{p.device_id ?? "-"}</td>
                  <td className="border px-3 py-2 align-top">{p.latitude ?? p.lat ?? "-"}</td>
                  <td className="border px-3 py-2 align-top">{p.longitude ?? p.lng ?? "-"}</td>
                  <td className="border px-3 py-2 align-top">{p.accel_rms ?? "-"}</td>
                  <td className="border px-3 py-2 align-top">{p.co2_ppm ?? "-"}</td>
                  <td className="border px-3 py-2 align-top">{p.lux ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


/*
export default function RidesPage() {
  return (
    <div className="p-8">
      <h1 className="mb-2 text-2xl font-bold">走行データ</h1>
      <p className="mb-6 text-sm text-gray-500">
        IoTデバイスから送られてきた計測点を見るページです。
      </p>

      <div className="rounded border border-dashed border-gray-300 p-6 text-sm text-gray-600">
        <p className="mb-2 font-medium">ここはこれから作るところです</p>
        <ul className="list-disc pl-5">
          <li>
            ride_points を新しい順に一覧表示する（何件届いているかの確認用）
          </li>
          <li>デバイスごと・日付ごとの絞り込み</li>
        </ul>
      </div>
    </div>
  );
}
*/