"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { MapContainer, TileLayer } from "react-leaflet";

// 岡山駅の座標。地図の初期表示はここを中心にする。
const OKAYAMA_STATION: [number, number] = [34.6664, 133.9183];

// Leaflet のピン画像は「ライブラリと同じ場所に画像ファイルがある」前提で
// URL を組み立てるので、Next.js のビルドだと 404 になってピンが表示されない。
// ここで画像を import して URL を教え直しておく。
// （<Marker> を使う Issue に着手したとき、いきなりハマらないように先に入れてあります）
L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetinaUrl.src,
  iconUrl: iconUrl.src,
  shadowUrl: shadowUrl.src,
});

/**
 * 地図本体。
 *
 * このコンポーネントは Leaflet（ブラウザの window を使うライブラリ）を読み込むため、
 * サーバー側では動きません。使う側で dynamic import（ssr: false）してください。
 * → app/page.tsx を見るとやり方が分かります。
 *
 * ここに走行データの線やラーメン店のピンを足していくのが、これからの Issue です。
 * 例: <MapContainer> の中に <Marker position={[lat, lng]}><Popup>店名</Popup></Marker> を並べる
 */
export default function Map() {
  return (
    <MapContainer
      center={OKAYAMA_STATION}
      zoom={14}
      scrollWheelZoom={true}
      // MapContainer は自分で高さを持たないので、親いっぱいに広げる指定が必須。
      // これを忘れると地図が真っ白（高さ 0）になります。
      className="h-full w-full"
    >
      {/* 地図の画像タイル。OpenStreetMap は無料で API キーもいらない。
          attribution（出典表示）は利用規約で必須なので消さないこと。 */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
    </MapContainer>
  );
}
