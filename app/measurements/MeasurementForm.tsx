"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Shop } from "@/types";

type MeasurementFormProps = {
  shops: Shop[];
};

export default function MeasurementForm({ shops }: MeasurementFormProps) {
  const router = useRouter();
  const [shopId, setShopId] = useState("");
  const [salinityPct, setSalinityPct] = useState("");
  const [tempC, setTempC] = useState("");
  const [memo, setMemo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [richnessMv, setRichnessMv] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!shopId || salinityPct === "" || tempC === "") {
      setErrorMessage("店舗、塩分濃度、温度を入力してください");
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.from("ramen_measurements").insert({
      shop_id: shopId,
      salinity_pct: Number(salinityPct),
      richness_mv: richnessMv === "" ? null : Number(richnessMv),
      temp_c: Number(tempC),
      memo: memo || null,
    });

    if (error) {
      setErrorMessage(`登録に失敗しました: ${error.message}`);
      setIsSubmitting(false);
      return;
    }

    setShopId("");
    setSalinityPct("");
    setRichnessMv("");
    setTempC("");
    setMemo("");
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-8 space-y-4 rounded border p-4">
      <h2 className="text-xl font-bold">計測結果を登録</h2>

      {errorMessage && <p className="text-red-600">{errorMessage}</p>}

      <div>
        <label htmlFor="shop-id" className="mb-1 block text-sm font-medium">
          店舗
        </label>
        <select
          id="shop-id"
          value={shopId}
          onChange={(event) => setShopId(event.target.value)}
          disabled={isSubmitting}
          className="w-full rounded border px-2 py-1"
        >
          <option value="">店舗を選択してください</option>
          {shops.map((shop) => (
            <option key={shop.id} value={shop.id}>
              {shop.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="salinity-pct"
          className="mb-1 block text-sm font-medium"
        >
          塩分濃度
        </label>
        <input
          id="salinity-pct"
          type="number"
          step="any"
          value={salinityPct}
          onChange={(event) => setSalinityPct(event.target.value)}
          disabled={isSubmitting}
          className="w-full rounded border px-2 py-1"
        />
      </div>

      <div>
        <label htmlFor="richness-mv" className="mb-1 block text-sm font-medium">
          こってり度
        </label>
        <input
          id="richness-mv"
          type="number"
          step="any"
          value={richnessMv}
          onChange={(event) => setRichnessMv(event.target.value)}
          disabled={isSubmitting}
          className="w-full rounded border px-2 py-1"
        />
      </div>

      <div>
        <label htmlFor="temp-c" className="mb-1 block text-sm font-medium">
          温度
        </label>
        <input
          id="temp-c"
          type="number"
          step="any"
          value={tempC}
          onChange={(event) => setTempC(event.target.value)}
          disabled={isSubmitting}
          className="w-full rounded border px-2 py-1"
        />
      </div>

      <div>
        <label htmlFor="memo" className="mb-1 block text-sm font-medium">
          メモ
        </label>
        <textarea
          id="memo"
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
          disabled={isSubmitting}
          className="w-full rounded border px-2 py-1"
          rows={3}
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "登録中..." : "登録する"}
      </button>
    </form>
  );
}
