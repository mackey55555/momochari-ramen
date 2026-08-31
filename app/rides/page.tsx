import { supabase } from "@/lib/supabase";
import { formatJst } from "@/lib/format";

/**
 * 走行データページ（/rides）
 *
 * IoTデバイスから送られてきた計測点を、新しい順に一覧で表示します。
 * 「データがちゃんと届いているか」を画面で確認するためのページです。
 */

// このページを開くたびに Supabase へ最新データを取りに行く、という設定。
// これを書かないと Next.js は「ビルドしたときに 1 回だけ取得して固定」しようとするので、
// データが増えても画面が変わらない…という事故が起きます。
export const dynamic = "force-dynamic";

export default async function RidesPage() {
  // supabase-js の書き方:
  //   .from("ride_points")                        … ride_points テーブルから
  //   .select("*")                                … 全カラムを
  //   .order("recorded_at", { ascending: false }) … 計測時刻の新しい順で
  //   .limit(100)                                 … 100 件だけ取得
  //
  // limit を付けているのは、本番でデータが数万件に増えたときに
  // 画面が固まるのを防ぐためです。
  const { data: points, error } = await supabase
    .from("ride_points")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(100);

  // 取得に失敗したとき（URL やキーが間違っている、テーブルが無い、など）
  if (error) {
    return (
      <div className="p-8">
        <h1 className="mb-4 text-2xl font-bold">走行データ</h1>
        <p className="text-red-600">
          データの取得に失敗しました: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="mb-4 text-2xl font-bold">走行データ</h1>

      {points.length === 0 ? (
        <p>まだデータがありません</p>
      ) : (
        // 表は画面からはみ出しやすいので、この div で囲んで
        // 「表だけが横スクロールする」ようにしておく。
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
              {points.map((p) => (
                <tr key={p.id} className="odd:bg-white even:bg-gray-50">
                  {/* 日時は必ず formatJst を通す（理由は lib/format.ts のコメント参照） */}
                  <td className="border px-3 py-2 align-top">
                    {formatJst(p.recorded_at)}
                  </td>
                  <td className="border px-3 py-2 align-top">{p.device_id}</td>
                  {/* センサーが載っていない項目は null で入ってくるので「-」を出す */}
                  <td className="border px-3 py-2 align-top">{p.lat}</td>
                  <td className="border px-3 py-2 align-top">{p.lng}</td>
                  <td className="border px-3 py-2 align-top">
                    {p.accel_rms ?? "-"}
                  </td>
                  <td className="border px-3 py-2 align-top">
                    {p.co2_ppm ?? "-"}
                  </td>
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
