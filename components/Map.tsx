"use client";

import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from "react-leaflet";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Shop } from "@/types";

// 岡山駅の座標
const OKAYAMA_STATION: [number, number] = [34.6664, 133.9183];

L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetinaUrl.src,
  iconUrl: iconUrl.src,
  shadowUrl: shadowUrl.src,
});

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

function getLuxColor(value: number | null) {
  if (value === null) return "gray";
  if (value < 50) return "red"; 
  if (value < 200) return "orange";
  return "green"; 
}

export default function Map() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [ridePoints, setRidePoints] = useState<any[]>([]);
  const [metric, setMetric] = useState<"accel" | "co2" | "lux">("accel");

  useEffect(() => {
    supabase.from("shops").select("*").then(({ data }) => setShops(data ?? []));
    supabase.from("ride_points").select("*").then(({ data }) => setRidePoints(data ?? []));
  }, []);

  const getPointColor = (p: any) => {
    if (metric === "accel") return getAccelColor(p.accel_rms);
    if (metric === "co2") return getCo2Color(p.co2_ppm);
    if (metric === "lux") return getLuxColor(p.lux);
    return "gray";
  };

  return (
    <div className="relative h-full w-full">
      {/* 切り替えボタン */}
      <div className="absolute left-16 top-4 z-[1000] flex gap-2 rounded bg-white/90 p-2 shadow-md">
        <button
          onClick={() => setMetric("accel")}
          className={`rounded px-3 py-1 text-sm font-medium ${
            metric === "accel" ? "bg-momo-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          ガタガタ (振動)
        </button>
        <button
          onClick={() => setMetric("co2")}
          className={`rounded px-3 py-1 text-sm font-medium ${
            metric === "co2" ? "bg-momo-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          CO2
        </button>
        <button
          onClick={() => setMetric("lux")}
          className={`rounded px-3 py-1 text-sm font-medium ${
            metric === "lux" ? "bg-momo-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          暗さ (照度)
        </button>
      </div>

      <MapContainer center={OKAYAMA_STATION} zoom={14} scrollWheelZoom={true} className="z-0 h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
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

        {shops.map((shop) => (
          <Marker key={shop.id} position={[shop.lat, shop.lng]}>
            <Popup>
              <div className="flex flex-col gap-1 text-center">
                <span className="font-bold text-gray-900">{shop.name}</span>
                <span className="text-xs text-gray-500">{shop.style}</span>
                <Link href={`/shops/${shop.id}`} className="mt-1 text-xs text-blue-600 underline hover:text-blue-800">
                  詳細を見る
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* 凡例（Task 13 対応） */}
      <div className="absolute right-4 bottom-8 z-[1000] rounded bg-white/90 p-3 text-xs shadow">
        <p className="mb-1 font-medium">
          {metric === "accel" && "振動（道の荒れ具合）"}
          {metric === "co2" && "二酸化炭素（CO2）"}
          {metric === "lux" && "照度（道の暗さ）"}
        </p>
        
        {metric === "accel" && (
          <>
            <p><span className="mr-1 inline-block h-3 w-3 rounded-full bg-red-500 align-middle" />ガタガタ</p>
            <p><span className="mr-1 inline-block h-3 w-3 rounded-full bg-orange-500 align-middle" />やや揺れる</p>
            <p><span className="mr-1 inline-block h-3 w-3 rounded-full bg-green-500 align-middle" />なめらか</p>
          </>
        )}
        
        {metric === "co2" && (
          <>
            <p><span className="mr-1 inline-block h-3 w-3 rounded-full bg-red-500 align-middle" />高い（1500〜）</p>
            <p><span className="mr-1 inline-block h-3 w-3 rounded-full bg-orange-500 align-middle" />やや高い（1000〜）</p>
            <p><span className="mr-1 inline-block h-3 w-3 rounded-full bg-green-500 align-middle" />低い（〜1000）</p>
          </>
        )}
        
        {metric === "lux" && (
          <>
            <p><span className="mr-1 inline-block h-3 w-3 rounded-full bg-red-500 align-middle" />暗くて危険（〜50）</p>
            <p><span className="mr-1 inline-block h-3 w-3 rounded-full bg-orange-500 align-middle" />やや暗い（〜200）</p>
            <p><span className="mr-1 inline-block h-3 w-3 rounded-full bg-green-500 align-middle" />明るい（200〜）</p>
          </>
        )}
      </div>
    </div>
  );
}