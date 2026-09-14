import Link from "next/link";
import ShopForm from "./ShopForm";

/**
 * お店の登録ページ（/shops/new）
 *
 * 当日回るラーメン店を、現地でもスマホから登録できるようにするためのページ。
 * 登録するとお店の詳細ページに移動し、IoT の計測スクリプトで使う
 * 店舗 ID（UUID）をそこでコピーできる。
 *
 * フォルダ名が「new」なので、/shops/[id] より優先してこのページが表示される。
 */
export default function NewShopPage() {
  return (
    <div className="p-8">
      <p className="mb-2 text-sm">
        <Link href="/shops" className="text-blue-600 hover:underline">
          ← ラーメン店一覧
        </Link>
      </p>
      <h1 className="mb-6 text-2xl font-bold">お店を登録</h1>
      <ShopForm />
    </div>
  );
}
