// 発表用のシステム構成図（1920×1080 = 16:9）を SVG で組み立てる。
// mermaid の自動レイアウトだと線が交差して読みにくかったので、位置を自分で決めている。
import fs from "node:fs";

const W = 1920, H = 1080;
const FONT = "'Hiragino Sans','Noto Sans JP','Yu Gothic',sans-serif";

const COLORS = {
  sensor: { fill: "#fef3c7", stroke: "#d97706" },
  pi: { fill: "#ffe4e6", stroke: "#e11d48" },
  web: { fill: "#dbeafe", stroke: "#2563eb" },
  db: { fill: "#dcfce7", stroke: "#16a34a" },
  ext: { fill: "#f1f5f9", stroke: "#94a3b8" },
};

const out = [];
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** パネル（グループの枠） */
function panel(x, y, w, h, title, accent = "#64748b") {
  out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18"
    fill="#ffffff" stroke="${accent}" stroke-width="2" stroke-dasharray="6 6" opacity="0.95"/>`);
  out.push(`<text x="${x + 24}" y="${y + 38}" font-family="${FONT}" font-size="25"
    font-weight="700" fill="${accent}">${esc(title)}</text>`);
}

/** 箱。lines は [太字の1行目, 以降の行...] */
function box(x, y, w, h, kind, lines, opts = {}) {
  const c = COLORS[kind];
  out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12"
    fill="${c.fill}" stroke="${c.stroke}" stroke-width="2.5"/>`);

  const size = opts.size ?? 22;
  const small = opts.small ?? 19;
  const lineH = opts.lineH ?? 28;
  const total = size + (lines.length - 1) * lineH;
  let ty = y + h / 2 - total / 2 + size * 0.8;

  lines.forEach((line, i) => {
    out.push(`<text x="${x + w / 2}" y="${ty}" text-anchor="middle" font-family="${FONT}"
      font-size="${i === 0 ? size : small}" font-weight="${i === 0 ? 700 : 400}"
      fill="#1f2937">${esc(line)}</text>`);
    ty += i === 0 ? lineH : lineH - 3;
  });
}

/** 矢印。points は [[x,y],...]。dashed で点線 */
function arrow(points, opts = {}) {
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const color = opts.color ?? "#475569";
  out.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${opts.width ?? 3}"
    ${opts.dashed ? 'stroke-dasharray="9 7"' : ""} marker-end="url(#head)" stroke-linejoin="round"/>`);
  if (opts.label) {
    const [lx, ly] = opts.labelAt ?? points[Math.floor(points.length / 2)];
    const padX = 10;
    const wEst = opts.label.length * 13 + padX * 2;
    out.push(`<rect x="${lx - wEst / 2}" y="${ly - 19}" width="${wEst}" height="32" rx="7"
      fill="#ffffff" stroke="${color}" stroke-width="1.5"/>`);
    out.push(`<text x="${lx}" y="${ly + 3}" text-anchor="middle" font-family="${FONT}"
      font-size="19" fill="#334155">${esc(opts.label)}</text>`);
  }
}

// ============================================================
// 図の中身
// ============================================================
out.push(`<defs>
  <marker id="head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill="#475569"/>
  </marker>
</defs>`);

// --- ① 自転車 -------------------------------------------------
panel(40, 60, 500, 960, "① 自転車の Raspberry Pi Zero W", "#e11d48");
box(70, 120, 215, 185, "sensor", [
  "走行センサー",
  "MPU-6050（振動）",
  "MH-Z19C（CO2）",
  "NEO-6M（GPS）",
], { size: 20, small: 17, lineH: 26 });
box(325, 120, 185, 185, "sensor", [
  "ラーメンセンサー",
  "DS18B20",
  "（スープ温度）",
  "SEN0308",
  "（塩分濃度）",
], { size: 19, small: 17, lineH: 25 });
box(70, 370, 215, 110, "pi", ["送信プログラム", "Python"], { size: 21, small: 18 });
box(325, 370, 185, 110, "pi", ["おいしさ判定", "温度＋塩分濃度"], { size: 21, small: 17 });
box(70, 570, 440, 140, "pi", [
  "地図アプリ mapapp",
  "地図タイルは事前にダウンロード",
  "（圏外でも地図が出る）",
]);
box(70, 780, 440, 120, "pi", ["モニタ", "720×1280 を縦置き"]);

arrow([[177, 305], [177, 370]]);                       // 走行センサー → 送信プログラム
arrow([[417, 305], [417, 370]]);                       // ラーメンセンサー → おいしさ判定
arrow([[325, 240], [300, 240], [300, 330], [230, 330], [230, 370]]); // ラーメン → 送信プログラム
arrow([[417, 480], [417, 525], [290, 525], [290, 570]], {
  label: "ファイルで受け渡し", labelAt: [350, 527],
});
arrow([[290, 710], [290, 780]]);                       // 地図アプリ → モニタ

// --- ② Vercel -------------------------------------------------
panel(600, 60, 620, 960, "② Vercel（Next.js）", "#2563eb");
box(630, 120, 560, 110, "web", ["POST /api/ingest", "走行データを受け取る"]);
box(630, 260, 560, 110, "web", ["POST /api/ramen", "ラーメン計測を受け取る"]);
box(630, 430, 560, 150, "web", [
  "味の傾向を判定",
  "塩分濃度から 濃厚／ふつう／あっさり",
  "判定はこの 1 か所だけ（lib/taste.ts）",
]);
box(630, 640, 560, 130, "web", ["GET /api/shops", "お店＋味の傾向を返す"]);
box(630, 830, 560, 150, "web", [
  "ダッシュボード画面",
  "地図／ラーメン店／計測／走行データ",
  "味の傾向つきで表示",
]);

arrow([[285, 400], [570, 400], [570, 175], [630, 175]], {
  label: "x-device-key", labelAt: [570, 250],
});
arrow([[285, 450], [585, 450], [585, 315], [630, 315]], {
  label: "x-device-key", labelAt: [585, 372],
});
arrow([[910, 580], [910, 640]]);                       // 味の傾向 → /api/shops
arrow([[630, 705], [570, 705], [570, 660], [510, 660]], {
  dashed: true, label: "お店を取得", labelAt: [570, 760],
});

// --- ③ Supabase -----------------------------------------------
panel(1280, 60, 600, 640, "③ Supabase（PostgreSQL）", "#16a34a");
box(1310, 130, 540, 120, "db", ["ride_points", "走行データ（位置・振動・CO2・速度）"], { small: 18 });
box(1310, 280, 540, 120, "db", ["ramen_measurements", "ラーメン計測（塩分・温度）"], { small: 18 });
box(1310, 430, 540, 120, "db", ["shops", "お店（名前・ジャンル・場所）"], { small: 18 });
box(1310, 580, 540, 90, "ext", ["OpenStreetMap ／ 地理院タイル", "地図の下敷きに使う"], { size: 20, small: 17, lineH: 26 });

arrow([[1190, 175], [1310, 175]]);                                   // ingest → ride_points
arrow([[1190, 315], [1250, 315], [1250, 340], [1310, 340]]);         // ramen → ramen_measurements
arrow([[1310, 470], [1258, 470], [1258, 505], [1230, 505]], {
  dashed: true, label: "読み取り", labelAt: [1258, 425],
});
arrow([[1310, 540], [1232, 540], [1232, 950], [1190, 950]], {
  dashed: true, label: "読み取り", labelAt: [1232, 700],
});

// --- ④ 見る人 -------------------------------------------------
panel(1280, 760, 600, 260, "④ 見る人", "#64748b");
box(1310, 830, 540, 130, "web", ["来場者のスマホ・PC", "momochari-ramen.vercel.app"]);
arrow([[1190, 870], [1310, 870]]);

// 凡例
const legend = [
  ["sensor", "センサー"],
  ["pi", "ラズパイ上のプログラム"],
  ["web", "Web（Vercel）"],
  ["db", "データベース"],
  ["ext", "外部の地図データ"],
];
let lx = 60;
legend.forEach(([kind, label]) => {
  const c = COLORS[kind];
  out.push(`<rect x="${lx}" y="1032" width="26" height="26" rx="6" fill="${c.fill}" stroke="${c.stroke}" stroke-width="2"/>`);
  out.push(`<text x="${lx + 36}" y="1052" font-family="${FONT}" font-size="20" fill="#334155">${esc(label)}</text>`);
  lx += 42 + label.length * 21;
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
${out.join("\n")}
</svg>`;

fs.writeFileSync(process.argv[2] ?? "arch.svg", svg);
console.log("書き出した:", process.argv[2] ?? "arch.svg");
