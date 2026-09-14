"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ジャンルの選択肢。一覧ページのバッジの色分けと合わせてある。
const STYLES = ["醤油", "豚骨", "塩", "味噌", "その他"];

/**
 * Google マップからコピーした「34.6656, 133.9200」の形を、緯度と経度に分ける。
 * 区切りは半角カンマ・全角カンマ・読点・スペースのどれでも読めるようにしている。
 * 読めなかったら null を返す。
 */
function parseLatLng(text: string): { lat: number; lng: number } | null {
  const parts = text.split(/[,，、\s]+/).filter((part) => part !== "");
  if (parts.length !== 2) return null;

  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
}

export default function ShopForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [style, setStyle] = useState("");
  const [address, setAddress] = useState("");
  const [latLngText, setLatLngText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // 入力中の座標を、その場で読み取って確認用に表示する
  const parsed = parseLatLng(latLngText);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (name.trim() === "") {
      setErrorMessage("店名を入力してください");
      return;
    }
    if (!parsed) {
      setErrorMessage(
        "場所（緯度, 経度）を読み取れませんでした。Google マップでコピーした「34.6656, 133.9200」の形で貼り付けてください",
      );
      return;
    }
    // 緯度と経度を逆に貼ると、エラーにならずに地球の反対側に店ができてしまうので止める
    if (Math.abs(parsed.lat) > 90) {
      setErrorMessage(
        "緯度と経度が逆になっているかもしれません。岡山なら「34.xx, 133.xx」の順です",
      );
      return;
    }

    setIsSubmitting(true);

    // .select("id").single() を付けると、登録したお店の id（UUID）が返ってくる。
    // 登録後にそのお店のページへ移動するために使う。
    const { data, error } = await supabase
      .from("shops")
      .insert({
        name: name.trim(),
        style: style === "" ? null : style,
        address: address.trim() === "" ? null : address.trim(),
        lat: parsed.lat,
        lng: parsed.lng,
      })
      .select("id")
      .single();

    if (error) {
      setErrorMessage(`登録に失敗しました: ${error.message}`);
      setIsSubmitting(false);
      return;
    }

    // 登録できたら、そのお店の詳細ページへ。そこで UUID を確認・コピーできる。
    router.push(`/shops/${data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      {errorMessage && <p className="text-red-600">{errorMessage}</p>}

      <div>
        <label htmlFor="shop-name" className="mb-1 block text-sm font-medium">
          店名 <span className="text-red-600">*</span>
        </label>
        <input
          id="shop-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={isSubmitting}
          className="w-full rounded border px-2 py-1"
        />
      </div>

      <div>
        <label htmlFor="shop-style" className="mb-1 block text-sm font-medium">
          ジャンル
        </label>
        <select
          id="shop-style"
          value={style}
          onChange={(event) => setStyle(event.target.value)}
          disabled={isSubmitting}
          className="w-full rounded border px-2 py-1"
        >
          <option value="">選択してください</option>
          {STYLES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="shop-address"
          className="mb-1 block text-sm font-medium"
        >
          住所
        </label>
        <input
          id="shop-address"
          type="text"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          disabled={isSubmitting}
          className="w-full rounded border px-2 py-1"
        />
      </div>

      <div>
        <label htmlFor="shop-latlng" className="mb-1 block text-sm font-medium">
          場所（緯度, 経度） <span className="text-red-600">*</span>
        </label>
        <input
          id="shop-latlng"
          type="text"
          inputMode="decimal"
          placeholder="34.6656, 133.9200"
          value={latLngText}
          onChange={(event) => setLatLngText(event.target.value)}
          disabled={isSubmitting}
          className="w-full rounded border px-2 py-1"
        />
        <p className="mt-1 text-xs text-gray-500">
          Google マップでお店の場所を長押し（PC
          は右クリック）すると、この形の数字がコピーできます。そのまま貼り付けてください。
        </p>
        {/* 読み取れたかをその場で見せる。貼り間違いにすぐ気づけるように */}
        {latLngText !== "" && (
          <p className="mt-1 text-xs">
            {parsed ? (
              <span className="text-green-700">
                読み取り: 緯度 {parsed.lat} / 経度 {parsed.lng}
              </span>
            ) : (
              <span className="text-red-600">まだ読み取れません</span>
            )}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-momo-500 px-4 py-2 text-white hover:bg-momo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "登録中..." : "登録する"}
      </button>
    </form>
  );
}
