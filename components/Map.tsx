"use client";

import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, CircleMarker } from "react-leaflet";
import { supabase } from "@/lib/supabase";
import {
  summarizeTaste,
  tasteColor,
  tasteLabel,
  type TasteSummary,
} from "@/lib/taste";
import ShopDetailPanel from "./ShopDetailPanel";
import type { Shop, RidePoint, RamenMeasurement } from "@/types";

// 地図を最初に表示する場所。
// ハッカソンの会場（岡山大学 津島キャンパス）を中心にしている。
// 会場で開いたときに、目の前の道のデータがすぐ見えるようにするため。
// 岡山駅まわりのデータも、この縮尺なら画面の下のほうに入る。
const MAP_CENTER: [number, number] = [34.6885, 133.9215];

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

// 振動は MPU-6050 の実測に合わせた目安。
// 止まっていると 0.01g、手で揺らして 0.5g くらいなので、
// 自転車で走ったときの「ガタガタ」は 0.6g も出れば十分に荒れた道。
function getAccelColor(value: number | null) {
  if (value === null) return "gray";
  if (value > 0.6) return "red";
  if (value > 0.3) return "orange";
  return "green";
}

// CO2 は「屋外」の目安で色を分ける。
// きれいな空気が 420ppm 前後、交通量の多い道で 700ppm 前後なので、
// 室内向けの 1000/1500ppm だと屋外では全部みどりになってしまう。
function getCo2Color(value: number | null) {
  if (value === null) return "gray";
  if (value > 700) return "red";
  if (value > 550) return "orange";
  return "green";
}

function getSpeedColor(value: number | null) {
  if (value === null) return "gray";
  if (value < 8) return "red"; // 止まりがち
  if (value < 15) return "orange"; // ゆっくり
  return "green"; // 快適
}

/** 地図に出す走行データの上限。これ以上は重くなるので新しいものから打ち切る */
const MAX_RIDE_POINTS = 3000;

/**
 * 走行データを取ってくる。
 *
 * === なぜループしているのか ===
 * Supabase の API は、1 回のリクエストで **1000 行までしか返しません**。
 * `.limit(3000)` と書いても 1000 行で切られます（設定で決まっている上限のため）。
 * 黙って切られるので「データを入れたのに地図に出ない」という事故になります。
 *
 * そこで `.range(何行目から, 何行目まで)` で続きを取りに行き、
 * 1000 行に満たない返事が来たら「もう無い」と判断して終わります。
 */
async function fetchRidePoints() {
  const PAGE_SIZE = 1000; // API が 1 回に返せる上限
  const all: RidePoint[] = [];

  for (let from = 0; from < MAX_RIDE_POINTS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("ride_points")
      .select("*")
      // 新しいものから取る。上限で打ち切られるとき、古いほうが捨てられるようにするため
      .order("recorded_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("走行データの取得に失敗:", error);
      break;
    }
    if (!data || data.length === 0) break;

    all.push(...data);

    // 1000 行に満たない ＝ これで全部
    if (data.length < PAGE_SIZE) break;
  }

  return all;
}

export default function Map() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [ridePoints, setRidePoints] = useState<RidePoint[]>([]);
  const [measurements, setMeasurements] = useState<RamenMeasurement[]>([]);
  const [metric, setMetric] = useState<"accel" | "co2" | "speed">("accel");

  // 詳細パネルで開いているお店の id。null なら閉じている。
  // （お店そのものではなく id を持っておくと、データを取り直しても中身がずれない）
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("shops")
      .select("*")
      .then(({ data }) => setShops(data ?? []));
    fetchRidePoints().then(setRidePoints);
    supabase
      .from("ramen_measurements")
      .select("*")
      .then(({ data }) => setMeasurements(data ?? []));
  }, []);

  /** お店 1 件分の計測だけを取り出す */
  const measurementsOf = (shopId: string) =>
    measurements.filter((m) => m.shop_id === shopId);

  /** お店 1 件分の味の傾向を出す */
  const getTaste = (shop: Shop): TasteSummary =>
    summarizeTaste(measurementsOf(shop.id));

  /** 詳細パネルに出すお店（選ばれていなければ null） */
  const selectedShop = shops.find((shop) => shop.id === selectedShopId) ?? null;

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
        center={MAP_CENTER}
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

        {shops.map((shop) => (
          <Marker
            key={shop.id}
            position={[shop.lat, shop.lng]}
            icon={createShopIcon(getTaste(shop))}
            // ピンを押したら、右（スマホでは下）から詳細パネルを出す
            eventHandlers={{ click: () => setSelectedShopId(shop.id) }}
          />
        ))}
      </MapContainer>

      {/* お店の詳細パネル（ピンを押すと出てくる） */}
      <ShopDetailPanel
        shop={selectedShop}
        measurements={selectedShop ? measurementsOf(selectedShop.id) : []}
        onClose={() => setSelectedShopId(null)}
      />

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
              多い（700ppm〜）
            </p>
            <p>
              <span className="mr-1 inline-block h-3 w-3 rounded-full bg-orange-500 align-middle" />
              やや多い（550〜700ppm）
            </p>
            <p>
              <span className="mr-1 inline-block h-3 w-3 rounded-full bg-green-500 align-middle" />
              きれい（〜550ppm）
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
