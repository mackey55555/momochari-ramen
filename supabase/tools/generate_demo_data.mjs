// ============================================================
// 発表デモ用データの生成スクリプト
// ============================================================
// 使い方:
//   node supabase/tools/generate_demo_data.mjs > supabase/seed_demo.sql
//
// 岡山駅を中心に、お店・ラーメン計測・走行ログをまとめて作ります。
// 手で 1000 行書くのは無理なので、経路の「通過点」だけ決めて、
// その間を細かく埋める（＝自転車で走った風にする）形にしています。
//
// 乱数は自前の疑似乱数（seed 固定）です。実行するたびに値が変わると
// 「昨日の発表と数字が違う」ということが起きるので、毎回同じ結果にしています。
// ============================================================

/** 疑似乱数。seed が同じなら毎回同じ並びになる */
let seed = 20260919;
function random() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}

/** min〜max のあいだの数値（小数 digits 桁） */
function rand(min, max, digits = 2) {
  const value = min + random() * (max - min);
  return Number(value.toFixed(digits));
}

/** SQL の文字列にする（' を '' にエスケープ） */
function q(text) {
  return text === null ? "null" : `'${String(text).replace(/'/g, "''")}'`;
}

// ------------------------------------------------------------
// お店（すべて架空。岡山駅から半径 2km 以内）
// ------------------------------------------------------------
// id を固定値にしているのは、何度流し込んでも増殖しないようにするため。
const SHOPS = [
  [
    "d1000001-0000-4000-8000-000000000001",
    "麺処 旭川",
    "醤油",
    "岡山県岡山市北区出石町1-2-3",
    34.6703,
    133.9295,
  ],
  [
    "d1000002-0000-4000-8000-000000000002",
    "豚骨屋 桃太郎通り",
    "豚骨",
    "岡山県岡山市北区本町6-12",
    34.6661,
    133.9245,
  ],
  [
    "d1000003-0000-4000-8000-000000000003",
    "塩ら〜めん 西川",
    "塩",
    "岡山県岡山市北区幸町8-5",
    34.6659,
    133.9215,
  ],
  [
    "d1000004-0000-4000-8000-000000000004",
    "味噌蔵 岡北",
    "味噌",
    "岡山県岡山市北区伊島町2-4-1",
    34.6752,
    133.924,
  ],
  [
    "d1000005-0000-4000-8000-000000000005",
    "中華そば 奉還町",
    "醤油",
    "岡山県岡山市北区奉還町2-7-9",
    34.6672,
    133.9125,
  ],
  [
    "d1000006-0000-4000-8000-000000000006",
    "濃厚豚骨 大元",
    "豚骨",
    "岡山県岡山市北区大元1-3-8",
    34.6541,
    133.9152,
  ],
  [
    "d1000007-0000-4000-8000-000000000007",
    "家系 烏城軒",
    "豚骨",
    "岡山県岡山市北区天神町3-2",
    34.664,
    133.933,
  ],
  [
    "d1000008-0000-4000-8000-000000000008",
    "鶏白湯 後楽",
    "その他",
    "岡山県岡山市北区後楽園1-5",
    34.669,
    133.9355,
  ],
  [
    "d1000009-0000-4000-8000-000000000009",
    "あっさり中華 清水堂",
    "醤油",
    "岡山県岡山市北区田町1-9-4",
    34.662,
    133.919,
  ],
  [
    "d100000a-0000-4000-8000-00000000000a",
    "味噌ら〜めん 津島",
    "味噌",
    "岡山県岡山市北区津島中2-1-6",
    34.6885,
    133.9205,
  ],
  [
    "d100000b-0000-4000-8000-00000000000b",
    "塩そば 表町",
    "塩",
    "岡山県岡山市北区表町1-6-3",
    34.663,
    133.928,
  ],
  [
    "d100000c-0000-4000-8000-00000000000c",
    "つけ麺 岡山駅前",
    "その他",
    "岡山県岡山市北区駅元町5-2",
    34.6668,
    133.9195,
  ],
];

/** 既にいる 5 店（seed.sql で作ったもの）。計測だけ足す */
const EXISTING_SHOPS = [
  ["11111111-1111-4111-8111-111111111111", "醤油"],
  ["22222222-2222-4222-8222-222222222222", "豚骨"],
  ["33333333-3333-4333-8333-333333333333", "塩"],
  ["44444444-4444-4444-8444-444444444444", "味噌"],
  ["55555555-5555-4555-8555-555555555555", "醤油"],
];

// ジャンルごとの「らしい」値の範囲。
// 塩分はラーメンのスープとして現実的な 0.8〜1.8%、こってり度は 1100〜1600mV に収めている。
const STYLE_RANGE = {
  塩: { salinity: [0.8, 1.1], richness: [1100, 1250] },
  醤油: { salinity: [1.1, 1.4], richness: [1200, 1350] },
  味噌: { salinity: [1.3, 1.6], richness: [1350, 1500] },
  豚骨: { salinity: [1.5, 1.8], richness: [1450, 1620] },
  その他: { salinity: [1.0, 1.5], richness: [1250, 1450] },
};

const MEMOS = [
  "中華そば（並）",
  "特製のせ",
  "大盛り",
  "替え玉あり",
  "あっさりめ",
  "スープをよく混ぜてから計測",
  "着丼から3分後に計測",
  "ランチタイム",
  "夜の部",
];

// ------------------------------------------------------------
// 走行ルート
// ------------------------------------------------------------
// [緯度, 経度] の通過点と、その道の性格（路面・交通量・流れ）。
//   surface: "smooth"（舗装よし）/ "normal" / "rough"（ガタガタ）
//   traffic: "low" / "mid" / "high"（CO2 に効く）
//   flow:    "fast" / "slow" / "stop"（速度に効く）
const ROUTES = [
  {
    name: "岡山駅 → 桃太郎大通り → 城下 → 後楽園",
    points: [
      [34.6664, 133.9183],
      [34.6662, 133.921],
      [34.666, 133.9245],
      [34.6657, 133.928],
      [34.6653, 133.931],
      [34.6656, 133.934],
      [34.6672, 133.9352],
      [34.669, 133.9358],
    ],
    surface: "smooth",
    traffic: "high",
    flow: "fast",
  },
  {
    name: "後楽園 → 旭川沿い → 出石町",
    points: [
      [34.669, 133.9358],
      [34.6702, 133.933],
      [34.6706, 133.93],
      [34.67, 133.9275],
    ],
    surface: "rough",
    traffic: "low",
    flow: "slow",
  },
  {
    name: "城下 → 表町商店街 → 田町",
    points: [
      [34.6653, 133.931],
      [34.664, 133.9296],
      [34.663, 133.9282],
      [34.6622, 133.925],
      [34.6618, 133.921],
    ],
    surface: "rough",
    traffic: "mid",
    flow: "stop",
  },
  {
    name: "岡山駅 → 奉還町商店街",
    points: [
      [34.6668, 133.9178],
      [34.667, 133.9155],
      [34.6672, 133.9128],
      [34.6673, 133.9105],
    ],
    surface: "rough",
    traffic: "low",
    flow: "slow",
  },
  {
    name: "岡山駅 → 国道53号 → 津島",
    points: [
      [34.6672, 133.919],
      [34.671, 133.9205],
      [34.676, 133.9212],
      [34.682, 133.9208],
      [34.688, 133.9203],
    ],
    surface: "smooth",
    traffic: "high",
    flow: "fast",
  },
  {
    name: "岡山駅 → 西川緑道公園 → 大元",
    points: [
      [34.666, 133.9196],
      [34.663, 133.92],
      [34.66, 133.9192],
      [34.657, 133.9175],
      [34.6545, 133.9155],
    ],
    surface: "smooth",
    traffic: "low",
    flow: "slow",
  },
];

// 道の性格ごとの値の範囲。
// accel_rms は MPU-6050 の実測感（止まっていて 0.01、手で揺らして 0.5）に合わせ、
// 荒れた路面でも 1.2g 程度までに収めている。
const SURFACE = {
  smooth: [0.04, 0.22],
  normal: [0.15, 0.45],
  rough: [0.35, 1.15],
};
// co2_ppm は屋外の現実的な値。きれいな空気 420ppm 前後、交通量が多い道で 700ppm 前後。
const TRAFFIC = {
  low: [405, 480],
  mid: [470, 600],
  high: [560, 780],
};
const FLOW = {
  fast: [15, 24],
  slow: [9, 16],
  stop: [2, 10],
};

/** 2 点間を distanceM メートル間隔で埋める */
function interpolate(from, to, distanceM) {
  // 岡山あたりでは緯度 1 度 ≒ 111km、経度 1 度 ≒ 91.6km
  const dLat = (to[0] - from[0]) * 111000;
  const dLng = (to[1] - from[1]) * 91600;
  const totalM = Math.hypot(dLat, dLng);
  const steps = Math.max(1, Math.round(totalM / distanceM));

  const points = [];
  for (let i = 0; i < steps; i++) {
    const ratio = i / steps;
    points.push([
      from[0] + (to[0] - from[0]) * ratio,
      from[1] + (to[1] - from[1]) * ratio,
    ]);
  }
  return points;
}

// ------------------------------------------------------------
// ここから SQL を組み立てる
// ------------------------------------------------------------
const lines = [];
const say = (text = "") => lines.push(text);

say("-- ============================================================");
say("-- 発表デモ用の追加データ（岡山駅まわり）");
say("-- ============================================================");
say("-- supabase/tools/generate_demo_data.mjs が作ったファイルです。");
say("-- 手で直さず、スクリプトのほうを直して作り直してください。");
say("--");
say("-- 使い方:");
say("--   Supabase ダッシュボード > SQL Editor に貼り付けて実行。");
say("--   seed.sql と違い、既存データは消しません（足すだけ）。");
say("--   同じ id を使っているので、2 回実行しても増えません。");
say("-- ============================================================");
say();

// --- お店 -----------------------------------------------------
say("-- ------------------------------------------------------------");
say(`-- ラーメン店（架空の ${SHOPS.length} 件。岡山駅から半径 2km 以内）`);
say("-- ------------------------------------------------------------");
say("insert into shops (id, name, style, address, lat, lng) values");
say(
  SHOPS.map(
    ([id, name, style, address, lat, lng]) =>
      `  (${q(id)}, ${q(name)}, ${q(style)}, ${q(address)}, ${lat.toFixed(6)}, ${lng.toFixed(6)})`,
  ).join(",\n") + "\non conflict (id) do nothing;",
);
say();

// --- ラーメン計測 ---------------------------------------------
const measurementRows = [];
const allShops = [
  ...SHOPS.map(([id, , style]) => [id, style]),
  ...EXISTING_SHOPS,
];

// 計測日時は「発表の直前 10 日間」に散らす
const measuredBase = Date.parse("2026-09-09T02:00:00.000Z");

for (const [shopId, style] of allShops) {
  const range = STYLE_RANGE[style] ?? STYLE_RANGE["その他"];
  const count = 2 + Math.floor(random() * 3); // 2〜4 件

  for (let i = 0; i < count; i++) {
    const salinity = rand(range.salinity[0], range.salinity[1], 2);
    const richness = Math.round(rand(range.richness[0], range.richness[1], 0));
    // TDS は塩分に比例する生値。ざっくり salinity% × 10000ppm 前後
    const tds = Math.round(salinity * 10000 + rand(-600, 600, 0));
    const temp = rand(72, 84, 1);
    const memo = MEMOS[Math.floor(random() * MEMOS.length)];
    const measuredAt = new Date(
      measuredBase + Math.floor(random() * 10 * 86400000),
    ).toISOString();

    measurementRows.push(
      `  (${q(shopId)}, ${salinity}, ${tds}, ${richness}, ${temp}, ${q(memo)}, ${q(measuredAt)})`,
    );
  }
}

say("-- ------------------------------------------------------------");
say(
  `-- ラーメン計測（全 ${allShops.length} 店に 2〜4 件ずつ、計 ${measurementRows.length} 件）`,
);
say("-- ------------------------------------------------------------");
say("-- ジャンルごとに値の範囲を変えているので、地図のピンの色が");
say("-- 豚骨＝濃厚（赤）、塩＝あっさり（青）のように分かれます。");
say(
  "insert into ramen_measurements (shop_id, salinity_pct, tds_ppm, richness_mv, temp_c, memo, measured_at) values\n" +
    measurementRows.join(",\n") +
    ";",
);
say();

// --- 走行ログ -------------------------------------------------
const rideRows = [];
// 走り始めの時刻。1 点 1 秒で進めていく
let clock = Date.parse("2026-09-18T01:30:00.000Z");
const DEVICE_ID = "demo-01";

for (const route of ROUTES) {
  const accelRange = SURFACE[route.surface];
  const co2Range = TRAFFIC[route.traffic];
  const speedRange = FLOW[route.flow];

  for (let i = 0; i < route.points.length - 1; i++) {
    // 2 秒に 1 点、時速 16km なら 9m ほど進む
    for (const [lat, lng] of interpolate(
      route.points[i],
      route.points[i + 1],
      9,
    )) {
      // 交差点で止まる感じを出すため、たまに速度を落とす
      const stopping = random() < 0.08;
      const speed = stopping
        ? rand(0, 4, 1)
        : rand(speedRange[0], speedRange[1], 1);

      rideRows.push(
        `  (${q(DEVICE_ID)}, ${lat.toFixed(6)}, ${lng.toFixed(6)}, ` +
          `${rand(accelRange[0], accelRange[1], 3)}, ` +
          `${Math.round(rand(co2Range[0], co2Range[1], 0))}, ` +
          `${speed}, ${q(new Date(clock).toISOString())})`,
      );
      clock += 2000;
    }
  }
  // ルートの切れ目は 3 分あける（お店に寄った、信号待ちが長かった、など）
  clock += 180000;
}

say("-- ------------------------------------------------------------");
say(`-- 走行データ（device_id = ${DEVICE_ID}、計 ${rideRows.length} 点）`);
say("-- ------------------------------------------------------------");
say("-- 道ごとに性格を変えてあります。");
for (const route of ROUTES) {
  say(
    `--   ${route.name}（路面 ${route.surface} / 交通量 ${route.traffic} / 流れ ${route.flow}）`,
  );
}
say("--");
say(
  "-- 本物のセンサーのデータと混ざらないよう、device_id は demo-01 にしています。",
);
say(
  "-- 発表後に消すときは: delete from ride_points where device_id = 'demo-01';",
);

// 1 回の insert が長くなりすぎないよう 200 行ずつに分ける
for (let i = 0; i < rideRows.length; i += 200) {
  say(
    "insert into ride_points (device_id, lat, lng, accel_rms, co2_ppm, speed_kmh, recorded_at) values\n" +
      rideRows.slice(i, i + 200).join(",\n") +
      "\non conflict (device_id, recorded_at) do nothing;",
  );
}

process.stdout.write(lines.join("\n") + "\n");
