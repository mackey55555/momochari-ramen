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
  const [
    { count, error: countError },
    { data: latestPoint, error: latestError },
  ] = await Promise.all([
    supabase.from("ride_points").select("*", { count: "exact", head: true }),
    supabase
      .from("ride_points")
      .select("recorded_at, device_id")
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  // supabase-js の書き方:
  //   .from("ride_points")                        … ride_points テーブルから
  //   .select("*")                                … 全カラムを
  //   .order("recorded_at", { ascending: false }) … 計測時刻の新しい順で
  //   .limit(100)                                 … 100 件だけ取得
  //
  // limit を付けているのは、本番でデータが数万件に増えたときに
  // 画面が固まるのを防ぐためです。
  const { data: pointsData, error } = await supabase
    .from("ride_points")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(100);
  const points = pointsData ?? [];
  const fetchError = error ?? countError ?? latestError;

  // 取得に失敗したとき（URL やキーが間違っている、テーブルが無い、など）
  if (fetchError) {
    return (
      <div className="p-8">
        <h1 className="mb-4 text-2xl font-bold">走行データ</h1>
        <p className="text-red-600">
          データの取得に失敗しました: {fetchError.message}
        </p>
      </div>
    );
  }

  const totalCount = count ?? 0;
  const minutesSinceLatest = latestPoint
    ? Math.floor(
        (Date.now() - new Date(latestPoint.recorded_at).getTime()) / 60000,
      )
    : null;
  const isStale = minutesSinceLatest !== null && minutesSinceLatest >= 10;

  return (
    <div className="p-8">
      <h1 className="mb-4 text-2xl font-bold">
        走行データ{" "}
        <span className="text-sm font-normal text-gray-500">
          一覧 {totalCount}件
        </span>
      </h1>

      <section className="mb-6 rounded-lg border border-gray-200 p-4">
        <h2 className="mb-3 text-lg font-medium">データ受信状況</h2>
        {latestPoint ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <p>デバイス: {latestPoint.device_id}</p>
            <p className={isStale ? "text-red-600" : "text-green-600"}>
              最終受信: {minutesSinceLatest}分前
            </p>
          </div>
        ) : (
          <p className="text-gray-600">受信データがありません</p>
        )}
      </section>

      {points.length === 0 ? (
        <p>まだデータがありません</p>
      ) : (
        // 表は画面からはみ出しやすいので、この div で囲んで
        // 「表だけが横スクロールする」ようにしておく。
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-200">
            <thead className="bg-gray-50 font-medium">
              <tr>
                <th className="border px-3 py-2 text-left">計測時刻</th>
                <th className="border px-3 py-2 text-left">デバイスID</th>
                <th className="border px-3 py-2 text-right">緯度</th>
                <th className="border px-3 py-2 text-right">経度</th>
                <th className="border px-3 py-2 text-right">振動(g)</th>
                <th className="border px-3 py-2 text-right">CO2(ppm)</th>
                <th className="border px-3 py-2 text-right">速度(km/h)</th>
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
                  <td className="border px-3 py-2 text-right align-top">
                    {p.lat.toFixed(6)}
                  </td>
                  <td className="border px-3 py-2 text-right align-top">
                    {p.lng.toFixed(6)}
                  </td>
                  <td className="border px-3 py-2 text-right align-top">
                    {p.accel_rms ?? "-"}
                  </td>
                  <td className="border px-3 py-2 text-right align-top">
                    {p.co2_ppm ?? "-"}
                  </td>
                  <td className="border px-3 py-2 text-right align-top">
                    {p.speed_kmh ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
