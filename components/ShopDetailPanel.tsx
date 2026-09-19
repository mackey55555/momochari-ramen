"use client";

import { useEffect } from "react";
import Link from "next/link";
import { formatJst } from "@/lib/format";
import { summarizeTaste, tasteColor, tasteLabel } from "@/lib/taste";
import type { RamenMeasurement, Shop } from "@/types";

/**
 * お店の詳細パネル。
 *
 * 地図のピンを押すと、覆いかぶさるように出てくる部品です。
 *   - パソコン … 画面の右から、幅 1/3 くらいでスライドイン
 *   - スマホ　 … 画面の下から、高さ 2/3 くらいでスライドイン
 *
 * 出したり消したりは、CSS の translate（ずらす）で行っています。
 * 閉じているときは画面の外にずらしてあるだけなので、開くときに滑って見えます。
 */

/** サンプル写真。お店ごとの写真はまだ持っていないので、仮でこの 4 枚を使い回している */
const SAMPLE_PHOTOS = [
  "/samples/ramen-1.jpg",
  "/samples/ramen-2.jpg",
  "/samples/ramen-3.jpg",
  "/samples/ramen-4.jpg",
];

/**
 * お店ごとに写真を 1 枚決める。
 *
 * ランダムにすると開くたびに写真が変わってしまうので、
 * お店の id の文字コードを足した値で決めて、毎回同じ写真になるようにしている。
 */
function samplePhoto(shopId: string) {
  let total = 0;
  for (const char of shopId) total += char.charCodeAt(0);
  return SAMPLE_PHOTOS[total % SAMPLE_PHOTOS.length];
}

type Props = {
  /** 表示するお店。null なら閉じている状態 */
  shop: Shop | null;
  /** そのお店の計測データ（新しい順に並べ替えて表示する） */
  measurements: RamenMeasurement[];
  onClose: () => void;
};

export default function ShopDetailPanel({
  shop,
  measurements,
  onClose,
}: Props) {
  const isOpen = shop !== null;

  // Esc キーでも閉じられるようにする。
  // useEffect の最後で removeEventListener しているのは、パネルを閉じたあとも
  // 見張りが残り続けないようにするため（残るとキーを押すたびに無駄に動く）。
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // 新しい順に並べ替える（元の配列を壊さないよう、コピーしてから並べ替え）
  const sorted = [...measurements].sort((a, b) =>
    a.measured_at < b.measured_at ? 1 : -1,
  );
  const taste = summarizeTaste(measurements);

  return (
    <>
      {/* 後ろの暗幕。押すと閉じる。閉じているときは触れないようにしておく */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[1100] bg-black/30 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden="true"
      />

      <aside
        // スマホ: 下から 2/3 の高さ／パソコン(md以上): 右から 1/3 の幅
        className={`fixed z-[1200] flex flex-col bg-white shadow-2xl transition-transform duration-300 ease-out
          inset-x-0 bottom-0 h-2/3 rounded-t-2xl
          md:inset-y-0 md:right-0 md:left-auto md:h-full md:w-1/3 md:rounded-none
          ${isOpen ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-y-0 md:translate-x-full"}`}
        aria-hidden={!isOpen}
      >
        {shop && (
          <>
            {/* 写真。object-cover で、縦横比を保ったまま枠いっぱいに切り抜く */}
            <div className="relative shrink-0">
              {/* サンプル画像なので next/image ではなく素の img を使っている */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={samplePhoto(shop.id)}
                alt={`${shop.name} のイメージ写真`}
                className="h-40 w-full object-cover md:h-48"
              />
              <button
                type="button"
                onClick={onClose}
                aria-label="詳細を閉じる"
                className="absolute top-3 right-3 rounded-full bg-black/50 px-3 py-1 text-white hover:bg-black/70"
              >
                ✕
              </button>
            </div>

            {/* 中身が多いときはここだけスクロールする */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <h2 className="text-xl font-bold text-gray-900">{shop.name}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {shop.style ?? "その他"}
                {shop.address ? ` ・ ${shop.address}` : ""}
              </p>

              {/* 過去データからの要約 */}
              <section className="mt-4 rounded-lg border border-gray-200 p-3">
                <h3 className="mb-2 text-sm font-medium text-gray-700">
                  これまでの計測のまとめ
                </h3>

                <p
                  className="text-lg font-bold"
                  style={{ color: tasteColor(taste.level) }}
                >
                  {tasteLabel(taste.level)}
                </p>

                {taste.count > 0 ? (
                  <dl className="mt-2 grid grid-cols-2 gap-y-1 text-sm text-gray-600">
                    <dt>計測した回数</dt>
                    <dd className="text-right">{taste.count}回</dd>

                    {taste.avgSalinity !== null && (
                      <>
                        <dt>塩分の平均</dt>
                        <dd className="text-right">
                          {taste.avgSalinity.toFixed(1)}%
                        </dd>
                      </>
                    )}

                    {taste.avgRichness !== null && (
                      <>
                        <dt>こってり度の平均</dt>
                        <dd className="text-right">
                          {Math.round(taste.avgRichness)}mV
                        </dd>
                      </>
                    )}
                  </dl>
                ) : (
                  <p className="mt-1 text-sm text-gray-500">
                    まだ使える計測がありません
                  </p>
                )}
              </section>

              {/* 過去の計測結果 */}
              <section className="mt-4">
                <h3 className="mb-2 text-sm font-medium text-gray-700">
                  過去の計測結果（{sorted.length}件）
                </h3>

                {sorted.length === 0 ? (
                  <p className="text-sm text-gray-500">まだ計測がありません</p>
                ) : (
                  <ul className="space-y-2">
                    {sorted.map((m) => (
                      <li
                        key={m.id}
                        className="rounded border border-gray-200 p-2 text-sm"
                      >
                        {/* 日時は必ず formatJst を通す（理由は lib/format.ts のコメント参照） */}
                        <p className="text-xs text-gray-500">
                          {formatJst(m.measured_at)}
                        </p>
                        <p className="mt-1 text-gray-700">
                          塩分 {m.salinity_pct ?? "-"}% ／ こってり{" "}
                          {m.richness_mv ?? "-"}mV ／ 温度 {m.temp_c ?? "-"}℃
                        </p>
                        {m.memo && (
                          <p className="mt-1 text-xs text-gray-500">{m.memo}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <Link
                href={`/shops/${shop.id}`}
                className="mt-4 inline-block text-sm text-blue-600 underline hover:text-blue-800"
              >
                お店のページを開く
              </Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
