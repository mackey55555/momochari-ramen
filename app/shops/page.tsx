import Link from "next/link";
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

function styleColor(style: string | null) {
  switch (style) {
    case "豚骨":
      return "bg-orange-100 text-orange-800";
    case "塩":
      return "bg-blue-100 text-blue-800";
    case "味噌":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default async function ShopsPage() {
  // supabase-js の書き方:
  //   .from("shops")   … shops テーブルから
  //   .select("*")     … 全カラムを
  //   .order("name")   … name の昇順で並べて取得
  //
  // 結果は { data, error } の形で返ってきます。例外は投げられないので、
  // error が入っていないかを自分で確認する必要があります。
  const { data: shops, error } = await supabase
    .from("shops")
    .select("*")
    .order("name");

  // 取得に失敗したとき（URL やキーが間違っている、テーブルが無い、など）
  if (error) {
    return (
      <div className="p-8">
        <h1 className="mb-4 text-2xl font-bold">ラーメン店一覧</h1>
        <p className="text-red-600">
          データの取得に失敗しました: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="mb-4 text-2xl font-bold">ラーメン店一覧</h1>

      {/* データが 0 件のときは、その旨を出しておくと原因調査がラク */}
      {shops.length === 0 ? (
        <p>
          まだ 1 件も登録されていません。supabase/seed.sql
          を実行してみてください。
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* 配列を .map() で <li> に変換して並べる。
              key には他と重複しない値（＝ id）を渡すのが React のお約束。 */}
          {shops.map((shop) => (
            <li
              key={shop.id}
              className="rounded-lg border border-gray-200 p-4 hover:shadow"
            >
              <Link
                href={`/shops/${shop.id}`}
                className="text-lg font-medium text-blue-600 hover:underline"
              >
                {shop.name}
              </Link>
              <div className="mt-3 space-y-2 text-sm text-gray-600">
                <p>
                  <span
                    className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${styleColor(shop.style)}`}
                  >
                    {shop.style ?? "その他"}
                  </span>
                </p>
                <p>{shop.address ?? "住所未登録"}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
