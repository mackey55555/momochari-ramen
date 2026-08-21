import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ShopDetailPage({ params }: { params: { id: string } }) {
  const { id } = await params;

  const { data: shop, error } = await supabase
    .from("shops")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !shop) {
    return notFound();
  }

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
    </div>
  );
}
