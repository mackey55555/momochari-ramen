import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatJst } from "@/lib/format";

export const dynamic = "force-dynamic";

// params は「あとから届く箱」なので、型も Promise 前提のものを使う。
// PageProps は Next.js が自動生成してくれるので import は不要。
export default async function ShopDetailPage({
  params,
}: PageProps<"/shops/[id]">) {
  const { id } = await params;

  const { data: shop, error } = await supabase
    .from("shops")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !shop) {
    return notFound();
  }

  const { data: measurements, error: measurementsError } = await supabase
    .from("ramen_measurements")
    .select("*")
    .eq("shop_id", id)
    .order("measured_at", { ascending: false });

  return (
    <div className="p-8">
      <h1 className="mb-4 text-2xl font-bold">{shop.name ?? "-"}</h1>

      <div className="space-y-2 text-sm text-gray-700">
        <p>
          <strong>ジャンル: </strong>
          {shop.style ?? "-"}
        </p>
        <p>
          <strong>住所: </strong>
          {shop.address ?? "-"}
        </p>
        <p>
          <strong>緯度・経度: </strong>
          {shop.lat ?? "-"}, {shop.lng ?? "-"}
        </p>
      </div>

      <h2 className="mb-4 mt-8 text-xl font-bold">計測履歴</h2>

      {measurementsError ? (
        <p className="text-red-600">
          計測履歴の取得に失敗しました: {measurementsError.message}
        </p>
      ) : measurements.length === 0 ? (
        <p>まだ計測がありません</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto border-collapse">
            <thead>
              <tr className="text-left">
                <th className="px-2 py-1">計測日時</th>
                <th className="px-2 py-1">塩分濃度</th>
                <th className="px-2 py-1">温度</th>
                <th className="px-2 py-1">メモ</th>
              </tr>
            </thead>
            <tbody>
              {measurements.map((measurement) => (
                <tr key={measurement.id} className="border-t">
                  <td className="px-2 py-2">
                    {formatJst(measurement.measured_at)}
                  </td>
                  <td className="px-2 py-2">
                    {measurement.salinity_pct ?? "-"}
                  </td>
                  <td className="px-2 py-2">{measurement.temp_c ?? "-"}</td>
                  <td className="px-2 py-2">{measurement.memo ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
