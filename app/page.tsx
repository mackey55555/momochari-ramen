"use client";

import dynamic from "next/dynamic";

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
  // h-full で、サイドメニューの右側いっぱいに地図を広げる。
  return (
    <div className="h-full w-full">
      <Map />
    </div>
  );
}
