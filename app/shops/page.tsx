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
        <ul className="list-disc pl-6">
          {/* 配列を .map() で <li> に変換して並べる。
              key には他と重複しない値（＝ id）を渡すのが React のお約束。 */}
          {shops.map((shop) => (
            <li key={shop.id} className="py-1">
              <Link href={`/shops/${shop.id}`} className="text-blue-600 hover:underline">
                {shop.name}
              </Link>
              {/* style は null のことがある（NOT NULL じゃないカラム）ので、
                  値があるときだけ出す。 */}
              {shop.style && (
                <span className="ml-2 text-sm text-gray-500">
                  （{shop.style}）
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
