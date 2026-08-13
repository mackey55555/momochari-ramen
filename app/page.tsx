"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

// Leaflet はブラウザの window / document を直接触るライブラリなので、
// サーバー側（Next.js のサーバーレンダリング）で実行するとエラーになる。
// dynamic + ssr: false で「ブラウザでだけ読み込む」ようにしている。
// なお ssr: false はクライアントコンポーネントでしか使えないため、
// このファイルの先頭に "use client" が付いています。
const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => <p className="p-4">地図を読み込み中...</p>,
});

export default function Home() {
  return (
    <main className="relative h-full w-full">
      <Map />

      {/* 地図の上に重ねるリンク。
          Leaflet が地図の部品に z-index 400〜800 を使うので、
          それより大きい z-index を付けないと地図の下に隠れてしまう。 */}
      <Link
        href="/shops"
        className="absolute top-4 right-4 z-[1000] rounded bg-white px-3 py-2 text-sm shadow hover:bg-gray-100"
      >
        店一覧 →
      </Link>
    </main>
  );
}
