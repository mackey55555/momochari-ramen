"use client";

import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
} from "react-leaflet";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  summarizeTaste,
  tasteColor,
  tasteLabel,
  type TasteSummary,
} from "@/lib/taste";
import type { Shop, RidePoint, RamenMeasurement } from "@/types";

// 岡山駅の座標
const OKAYAMA_STATION: [number, number] = [34.6664, 133.9183];

// Leaflet のピン画像は「ライブラリと同じ場所に画像ファイルがある」前提で URL を組み立てるため、
// Next.js のビルドではそのままだと 404 になり、ピンが表示されない。
// public/leaflet/ に画像を置いて、その URL を教え直しておく。
//
// 以前は import した画像の .src を渡していたが、Next.js 16 では画像を import すると
// URL の文字列がそのまま返るため .src が undefined になり、ピンが壊れていた。
// public/ 配下のパスを直接書けば、この違いに左右されない。
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  iconUrl: "/leaflet/marker-icon.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});

/**
 * お店のピンを作る。
 *
 * Leaflet の標準ピンは画像なので色を変えられない。
 * divIcon を使うと HTML をそのままピンにできるので、味の傾向で色を塗り分けている。
 */
function createShopIcon(summary: TasteSummary) {
  const color = tasteColor(summary.level);
  return L.divIcon({
    className: "", // Leaflet が付ける初期スタイルを消す
    // 走行データの点（小さい丸）と見分けがつくように、お店には 🍜 を入れている
    html: `<div style="
      width: 26px; height: 26px; border-radius: 9999px;
      background: ${color}; border: 3px solid white;
      box-shadow: 0 1px 4px rgba(0,0,0,.4);
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; line-height: 1;
    ">🍜</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13], // 円の中心をお店の位置に合わせる
    popupAnchor: [0, -13],
  });
}

function getAccelColor(value: number | null) {
  if (value === null) return "gray";
  if (value > 1.5) return "red";
  if (value > 0.8) return "orange";
  return "green";
}

function getCo2Color(value: number | null) {
  if (value === null) return "gray";
  if (value > 1500) return "red";
  if (value > 1000) return "orange";
  return "green";
}

function getSpeedColor(value: number | null) {
  if (value === null) return "gray";
  if (value < 8) return "red"; // 止まりがち
  if (value < 15) return "orange"; // ゆっくり
  return "green"; // 快適
}

export default function Map() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [ridePoints, setRidePoints] = useState<RidePoint[]>([]);
  const [measurements, setMeasurements] = useState<RamenMeasurement[]>([]);
  const [metric, setMetric] = useState<"accel" | "co2" | "speed">("accel");

  useEffect(() => {
    supabase
      .from("shops")
      .select("*")
      .then(({ data }) => setShops(data ?? []));
    supabase
      .from("ride_points")
      .select("*")
      .limit(2000)
      .then(({ data }) => setRidePoints(data ?? []));
    supabase
      .from("ramen_measurements")
      .select("*")
      .then(({ data }) => setMeasurements(data ?? []));
  }, []);

  /** お店 1 件分の味の傾向を出す（そのお店の計測だけ集めて渡す） */
  const getTaste = (shop: Shop): TasteSummary =>
    summarizeTaste(measurements.filter((m) => m.shop_id === shop.id));

  const getPointColor = (p: RidePoint) => {
    if (metric === "accel") return getAccelColor(p.accel_rms);
    if (metric === "co2") return getCo2Color(p.co2_ppm);
    if (metric === "speed") return getSpeedColor(p.speed_kmh);
    return "gray";
  };

  return (
    <div className="relative h-full w-full">
      {/* 切り替えボタン */}
      <div className="absolute left-16 top-4 z-[1000] flex gap-2 rounded bg-white/90 p-2 shadow-md">
        <button
          onClick={() => setMetric("accel")}
          className={`rounded px-3 py-1 text-sm font-medium ${
            metric === "accel"
              ? "bg-momo-500 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          ガタガタ (振動)
        </button>
        <button
          onClick={() => setMetric("co2")}
          className={`rounded px-3 py-1 text-sm font-medium ${
            metric === "co2"
              ? "bg-momo-500 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          CO2
        </button>
        <button
          onClick={() => setMetric("speed")}
          className={`rounded px-3 py-1 text-sm font-medium ${
            metric === "speed"
              ? "bg-momo-500 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          速度
        </button>
      </div>

      <MapContainer
        center={OKAYAMA_STATION}
        zoom={14}
        scrollWheelZoom={true}
        className="z-0 h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {ridePoints.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={4}
            pathOptions={{ color: getPointColor(p) }}
          />
        ))}

        {shops.map((shop) => {
          const taste = getTaste(shop);
          return (
            <Marker
              key={shop.id}
              position={[shop.lat, shop.lng]}
              icon={createShopIcon(taste)}
            >
              <Popup>
                <div className="flex flex-col gap-1 text-center">
                  <span className="font-bold text-gray-900">{shop.name}</span>
                  <span className="text-xs text-gray-500">{shop.style}</span>

                  {/* 味の傾向。計測がまだ無いお店は、その旨だけ出す */}
                  <span
                    className="text-sm font-medium"
                    style={{ color: tasteColor(taste.level) }}
                  >
                    {tasteLabel(taste.level)}
                    {taste.count > 0 && `（${taste.count}件の計測から）`}
                  </span>

                  {taste.avgSalinity !== null && (
                    <span className="text-xs text-gray-500">
                      塩分 {taste.avgSalinity.toFixed(1)}%
                    </span>
                  )}
                  {taste.avgRichness !== null && (
                    <span className="text-xs text-gray-500">
                      こってり度 {Math.round(taste.avgRichness)}mV
                    </span>
                  )}

                  <Link
                    href={`/shops/${shop.id}`}
                    className="mt-1 text-xs text-blue-600 underline hover:text-blue-800"
                  >
                    詳細を見る
                  </Link>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* 凡例（Task 13 対応） */}
      <div className="absolute right-4 bottom-8 z-[1000] rounded bg-white/90 p-3 text-xs shadow">
        {/* お店のピンの色：味の傾向 */}
        <p className="mb-1 font-medium">お店（味の傾向）</p>
        {(["rich", "medium", "light", "unknown"] as const).map((level) => (
          <p key={level}>
            <span
              className="mr-1 inline-block h-3 w-3 rounded-full align-middle"
              style={{ backgroundColor: tasteColor(level) }}
            />
            {tasteLabel(level)}
          </p>
        ))}

        <hr className="my-2 border-gray-200" />

        <p className="mb-1 font-medium">
          {metric === "accel" && "振動（道の荒れ具合）"}
          {metric === "co2" && "二酸化炭素（CO2）"}
          {metric === "speed" && "速度"}
        </p>

        {metric === "accel" && (
          <>
            <p>
              <span className="mr-1 inline-block h-3 w-3 rounded-full bg-red-500 align-middle" />
              ガタガタ
            </p>
            <p>
              <span className="mr-1 inline-block h-3 w-3 rounded-full bg-orange-500 align-middle" />
              やや揺れる
            </p>
            <p>
              <span className="mr-1 inline-block h-3 w-3 rounded-full bg-green-500 align-middle" />
              なめらか
            </p>
          </>
        )}

        {metric === "co2" && (
          <>
            <p>
              <span className="mr-1 inline-block h-3 w-3 rounded-full bg-red-500 align-middle" />
              高い（1500〜）
            </p>
            <p>
              <span className="mr-1 inline-block h-3 w-3 rounded-full bg-orange-500 align-middle" />
              やや高い（1000〜）
            </p>
            <p>
              <span className="mr-1 inline-block h-3 w-3 rounded-full bg-green-500 align-middle" />
              低い（〜1000）
            </p>
          </>
        )}

        {metric === "speed" && (
          <>
            <p>
              <span className="mr-1 inline-block h-3 w-3 rounded-full bg-red-500 align-middle" />
              遅い・止まりがち（〜8km/h）
            </p>
            <p>
              <span className="mr-1 inline-block h-3 w-3 rounded-full bg-orange-500 align-middle" />
              ゆっくり（8〜15km/h）
            </p>
            <p>
              <span className="mr-1 inline-block h-3 w-3 rounded-full bg-green-500 align-middle" />
              快適（15km/h〜）
            </p>
          </>
        )}
      </div>
    </div>
  );
}
