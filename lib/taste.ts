import type { RamenMeasurement } from "@/types";

/**
 * ラーメンの計測値から「味の傾向」を出す。
 *
 * === 何をしているか ===
 * 塩分濃度（salinity_pct）と こってり度（richness_mv）を 0〜1 の点数に直して、
 * その平均を「濃厚さ」の点数にしています。点数が高いほど こってり寄り。
 *
 * === 大事な前提 ===
 * これは「美味しい / まずい」ではありません。センサーで測れるのは味の傾向だけで、
 * 美味しさは測れないので、そう見えるような言葉（★評価など）は使っていません。
 */

// ============================================================
// しきい値（ここだけ直せば判定が変わります）
//
// 実データがまだ揃っていないので、今の値は「仮」です。
// 計測が集まってきたら、この 4 つの数字を調整してください。
// ============================================================

/** 塩分濃度（%）：この値で あっさり 〜 濃厚 を割り振る */
const SALINITY_LIGHT = 1.0; // これ以下は あっさり寄り
const SALINITY_RICH = 1.6; // これ以上は 濃厚寄り

/** こってり度（mV）：同上 */
const RICHNESS_LIGHT = 1200;
const RICHNESS_RICH = 1450;

/**
 * 明らかにおかしい計測値を捨てるための範囲。
 *
 * センサーの校正前だったり、スープに入れる前に送ってしまったりすると、
 * 塩分 0% や 9% といった値が入ってきます（ラーメンのスープは 1〜2% くらい）。
 * そのまま平均すると味の傾向がめちゃくちゃになるので、範囲外は無かったことにします。
 */
const SALINITY_MIN = 0.3;
const SALINITY_MAX = 3.0;
const RICHNESS_MIN = 300;
const RICHNESS_MAX = 3000;

/** 味の傾向の 3 段階（計測がまだ無いお店は "unknown"） */
export type TasteLevel = "rich" | "medium" | "light" | "unknown";

export type TasteSummary = {
  level: TasteLevel;
  /** 濃厚さの点数（0〜1）。計測が無いときは null */
  score: number | null;
  /** 判定に使えた計測の件数 */
  count: number;
  /** 平均の塩分濃度（%）。使える値が無ければ null */
  avgSalinity: number | null;
  /** 平均のこってり度（mV）。使える値が無ければ null */
  avgRichness: number | null;
};

/** 値を 0〜1 に直す。low 以下なら 0、high 以上なら 1 */
function normalize(value: number, low: number, high: number) {
  if (value <= low) return 0;
  if (value >= high) return 1;
  return (value - low) / (high - low);
}

/** 数値の配列から平均を出す。空なら null */
function average(values: number[]) {
  if (values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return sum / values.length;
}

/** 使える計測値だけを取り出す（null と、範囲外のおかしな値を捨てる） */
function usableValues(
  measurements: RamenMeasurement[],
  key: "salinity_pct" | "richness_mv",
  min: number,
  max: number,
) {
  return measurements
    .map((m) => m[key])
    .filter((value): value is number => value !== null)
    .filter((value) => value >= min && value <= max);
}

/** お店 1 件分の計測から、味の傾向をまとめる */
export function summarizeTaste(measurements: RamenMeasurement[]): TasteSummary {
  const salinities = usableValues(
    measurements,
    "salinity_pct",
    SALINITY_MIN,
    SALINITY_MAX,
  );
  const richnesses = usableValues(
    measurements,
    "richness_mv",
    RICHNESS_MIN,
    RICHNESS_MAX,
  );

  const avgSalinity = average(salinities);
  const avgRichness = average(richnesses);

  // 片方のセンサーしか動いていないお店もあるので、
  // 「使えるほうだけ」で点数を出す（両方あれば 2 つの平均）。
  const scores: number[] = [];
  if (avgSalinity !== null) {
    scores.push(normalize(avgSalinity, SALINITY_LIGHT, SALINITY_RICH));
  }
  if (avgRichness !== null) {
    scores.push(normalize(avgRichness, RICHNESS_LIGHT, RICHNESS_RICH));
  }

  const score = average(scores);
  const count = Math.max(salinities.length, richnesses.length);

  if (score === null) {
    return {
      level: "unknown",
      score: null,
      count: 0,
      avgSalinity,
      avgRichness,
    };
  }

  // 0〜1 を 3 等分して、濃厚 / ふつう / あっさり に割り振る
  const level: TasteLevel =
    score >= 0.66 ? "rich" : score >= 0.33 ? "medium" : "light";

  return { level, score, count, avgSalinity, avgRichness };
}

/** 地図のピンや凡例に出す日本語のラベル */
export function tasteLabel(level: TasteLevel) {
  switch (level) {
    case "rich":
      return "濃厚";
    case "medium":
      return "ふつう";
    case "light":
      return "あっさり";
    default:
      return "計測なし";
  }
}

/** 地図のピンの色（CSS の色名）。凡例の色と必ず合わせること */
export function tasteColor(level: TasteLevel) {
  switch (level) {
    case "rich":
      return "#dc2626"; // red-600
    case "medium":
      return "#f59e0b"; // amber-500
    case "light":
      return "#2563eb"; // blue-600
    default:
      return "#9ca3af"; // gray-400
  }
}
