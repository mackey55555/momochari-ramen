# API 仕様（IoTチーム向け）

デバイスと Web サーバーの間でデータをやり取りするための仕様です。

| やりたいこと                   | エンドポイント     |
| ------------------------------ | ------------------ |
| 走行中の計測データを送る       | `POST /api/ingest` |
| ラーメンの計測結果を送る       | `POST /api/ramen`  |
| お店の一覧を取得する（読取り） | `GET /api/shops`   |

送るのは上の 2 つだけです。`GET /api/shops` はラズパイの地図アプリ
（[`iot/mapapp/`](../iot/mapapp/README.md)）がお店を表示するために使う読み取り専用の API で、
合言葉は要りません。

## 送り先の URL

| 環境           | ベース URL                           |
| -------------- | ------------------------------------ |
| ローカル開発   | `http://localhost:3000`              |
| 本番（Vercel） | `https://momochari-ramen.vercel.app` |

**合言葉（`x-device-key`）はローカルと本番で別の値です。** 本番用の値は Slack で共有します。

## 共通ルール

- メソッドは `POST` のみ。
- ヘッダーに **必ず** 次の 2 つを付けること。
  - `Content-Type: application/json`
  - `x-device-key: <合言葉>` … 合言葉はチーム内で共有します（Slack で聞いてください）。
    間違っていると `401` が返ります。
- ボディは JSON。
- 日時は **ISO 8601 形式** で送ってください。
  - JavaScript なら `new Date().toISOString()` が確実です（`2026-09-19T01:00:00.000Z` の形になります）
  - NG: `2025/09/19 10:00:00` のように自分で組み立てる → **9 時間ずれる事故**が起きます
  - 表示は Web 側で日本時間に直すので、送るときは世界標準時のままで構いません

---

## POST /api/ingest — 走行データ

自転車で走りながら測った点（位置＋センサー値）を送ります。
**配列でまとめて送れます**（バッチ送信）。1 点ずつ毎秒送るより、
10〜60 点ためて送るほうが電池にも回線にも優しいです。

### リクエストボディ

```json
{
  "device_id": "raspi-01",
  "points": [
    {
      "lat": 34.6664,
      "lng": 133.9183,
      "accel_rms": 0.42,
      "co2_ppm": 480,
      "speed_kmh": 14.2,
      "recorded_at": "2026-09-19T01:00:00.000Z"
    },
    {
      "lat": 34.667,
      "lng": 133.919,
      "accel_rms": 1.85,
      "co2_ppm": 610,
      "speed_kmh": 8.7,
      "recorded_at": "2026-09-19T01:00:01.000Z"
    }
  ]
}
```

| フィールド             | 型     | 必須 | 説明                                           |
| ---------------------- | ------ | ---- | ---------------------------------------------- |
| `device_id`            | string | ✅   | デバイスの識別子。例: `"raspi-01"`             |
| `points`               | array  | ✅   | 1 件以上。1 回のリクエストで最大 1000 件       |
| `points[].lat`         | number | ✅   | 緯度。GPS が無い機体は `0` で送る（下記）      |
| `points[].lng`         | number | ✅   | 経度。GPS が無い機体は `0` で送る（下記）      |
| `points[].recorded_at` | string | ✅   | 計測時刻（ISO 8601）                           |
| `points[].accel_rms`   | number |      | 加速度 RMS（単位 g）。振動＝ガタガタ道の指標   |
| `points[].co2_ppm`     | number |      | CO2 濃度（ppm）。屋外は 400〜700 程度          |
| `points[].speed_kmh`   | number |      | 速度（km/h）。GPS が返す値。流れの悪い道の指標 |

省略した項目は `null` として保存されます（センサーが載っていない場合はそれで OK）。

### GPS が付いていない機体から送るとき

センサーを 1 台のラズパイに全部つなげなかったので、**GPS が無い機体からもデータが届きます**。
その場合は **`lat` と `lng` を `0` で送ってください**。

サーバー側で、**直近に届いた「GPS 付きの点」の位置に差し替えて**保存します。
つまり「GPS 機がさっきいた場所で測った」という扱いになります。

```json
{
  "lat": 0,
  "lng": 0,
  "accel_rms": 0.42,
  "recorded_at": "2026-09-19T01:00:00.000Z"
}
```

位置を借りたときは、レスポンスにその旨が付きます。

```json
{
  "inserted": 2,
  "position_borrowed": 2,
  "position_borrowed_from": "2026-09-19T07:56:32+00:00"
}
```

- `position_borrowed` … 位置を借りた点の数
- `position_borrowed_from` … 借りた元の点の計測時刻

**GPS 付きの点がまだ 1 件も届いていないときは `400` を返します。**
借りられる位置が無いのに `0` のまま保存しても、アフリカ沖に点が並ぶだけで使えないためです。
その場合は、GPS を載せた機体から先に送ってください。

### レスポンス

受け付けた件数が返ります。

```json
{ "inserted": 2 }
```

同じ `device_id` と `recorded_at` の点がすでに保存されている場合、その点は保存されずに捨てられます（再送しても二重にならないようにするため）。**`inserted` はあくまで「受け付けた件数」で、この捨てられた分も含みます。** 実際に何件入ったかは [/rides](https://momochari-ramen.vercel.app/rides) で確認してください。

### curl の例

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-device-key: ここに合言葉" \
  -d '{
        "device_id": "raspi-01",
        "points": [
          {
            "lat": 34.6664,
            "lng": 133.9183,
            "accel_rms": 0.42,
            "co2_ppm": 480,
            "speed_kmh": 14.2,
            "recorded_at": "2026-09-19T01:00:00.000Z"
          }
        ]
      }'
```

### JavaScript の例（Raspberry Pi 想定）

センサーが届く前でも、この形でダミー値を送れば疎通確認ができます。

```javascript
const API_URL = "http://localhost:3000/api/ingest";
const DEVICE_KEY = "ここに合言葉";

async function send(points) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-device-key": DEVICE_KEY,
    },
    body: JSON.stringify({ device_id: "raspi-01", points }),
  });
  console.log(res.status, await res.text());
}

send([
  {
    lat: 34.6664,
    lng: 133.9183,
    accel_rms: 0.42,
    co2_ppm: 480,
    speed_kmh: 14.2,
    recorded_at: new Date().toISOString(),
  },
]);
```

---

## POST /api/ramen — ラーメン計測

お店で測った塩分濃度・温度を送ります。1 回のリクエストで 1 件です。

### リクエストボディ

```json
{
  "shop_id": "11111111-1111-4111-8111-111111111111",
  "salinity_pct": 1.3,
  "tds_ppm": 13000,
  "richness_mv": 1250,
  "temp_c": 78.2,
  "memo": "中華そば（並）"
}
```

| フィールド     | 型           | 必須 | 説明                                                     |
| -------------- | ------------ | ---- | -------------------------------------------------------- |
| `shop_id`      | string(uuid) | ✅   | お店の ID。**UUID 形式**。デバイス名や連番ではありません |
| `salinity_pct` | number       |      | 塩分濃度（%）                                            |
| `tds_ppm`      | number       |      | TDS の生値                                               |
| `richness_mv`  | number       |      | こってり度。静電容量式センサーの出力電圧（mV）           |
| `temp_c`       | number       |      | スープ温度（℃）                                          |
| `memo`         | string       |      | メモ（食べたメニューなど）                               |

計測時刻（`measured_at`）はサーバー側で「受け取った時刻」が自動で入ります。

`shop_id` は Web の [店一覧ページ](../app/shops/page.tsx)（`/shops`）か、
Supabase ダッシュボードの Table Editor で確認できます。

### レスポンス

保存された 1 件がそのまま返ります（ステータス `201`）。

```json
{
  "id": "8a2f...",
  "shop_id": "11111111-1111-4111-8111-111111111111",
  "salinity_pct": 1.3,
  "tds_ppm": 13000,
  "richness_mv": 1250,
  "temp_c": 78.2,
  "memo": "中華そば（並）",
  "measured_at": "2026-09-19T01:23:45.678Z"
}
```

### curl の例

```bash
curl -X POST http://localhost:3000/api/ramen \
  -H "Content-Type: application/json" \
  -H "x-device-key: ここに合言葉" \
  -d '{
        "shop_id": "11111111-1111-4111-8111-111111111111",
        "salinity_pct": 1.3,
        "tds_ppm": 13000,
        "richness_mv": 1250,
        "temp_c": 78.2,
        "memo": "中華そば（並）"
      }'
```

---

## GET /api/shops — お店の一覧（読み取り専用）

登録されているお店を、**味の傾向つき**でまとめて返します。
ラズパイの地図アプリが、現在地の近くのお店を表示するために使います。

- メソッドは `GET`。**合言葉（`x-device-key`）は不要**です。
  書き込みではなく、[/shops](https://momochari-ramen.vercel.app/shops) のページで
  誰でも見られる情報と同じものを返すだけなので、鍵をかけていません。
- お店は数十件しかないので、**全件まとめて返します**。
  「近くのお店はどれか」の計算は、受け取った側でやってください。
  毎回サーバーに聞きに行く作りにすると、圏外に入った瞬間に画面が止まります。

### なぜ味の傾向まで返すのか

濃厚 / ふつう / あっさり の判定は [`lib/taste.ts`](../lib/taste.ts) の 1 箇所だけで行い、
**ラベルも色も、表示に使う形まで作ってから返しています。**

判定のしきい値を受け取り側にコピーすると、Web 側で調整したときに必ず食い違います。
「ラズパイの画面と Web サイトで言っていることが違う」を構造的に起こさないための作りなので、
受け取った `label` と `color` はそのまま使ってください。

### レスポンス

```json
{
  "shops": [
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "name": "ラーメン 吉備乃家",
      "style": "豚骨",
      "address": "岡山県岡山市北区表町2-3-4",
      "lat": 34.6633,
      "lng": 133.928,
      "taste": {
        "level": "rich",
        "label": "濃厚",
        "color": "#dc2626",
        "count": 2,
        "avg_salinity_pct": 1.7,
        "avg_richness_mv": 1508
      }
    }
  ],
  "generated_at": "2026-09-19T01:00:00.000Z"
}
```

| フィールド               | 型     | 説明                                                        |
| ------------------------ | ------ | ----------------------------------------------------------- |
| `shops[].id`             | string | お店の UUID。`POST /api/ramen` の `shop_id` に使える値      |
| `shops[].name`           | string | 店名                                                        |
| `shops[].style`          | string | ジャンル（醤油 / 豚骨 / 塩 / 味噌 など）。未登録なら `null` |
| `shops[].address`        | string | 住所。未登録なら `null`                                     |
| `shops[].lat` / `lng`    | number | 緯度・経度                                                  |
| `taste.level`            | string | `"rich"` / `"medium"` / `"light"` / `"unknown"`             |
| `taste.label`            | string | 画面に出す日本語（濃厚 / ふつう / あっさり / 計測なし）     |
| `taste.color`            | string | 地図のピンに使う色。Web の地図と同じ色になる                |
| `taste.count`            | number | 判定に使えた計測の件数。0 なら計測なし                      |
| `taste.avg_salinity_pct` | number | 塩分濃度の平均（%）。使える計測が無ければ `null`            |
| `taste.avg_richness_mv`  | number | こってり度の平均（mV）。使える計測が無ければ `null`         |
| `generated_at`           | string | この一覧を作った時刻（ISO 8601）                            |

`taste` は「**味の傾向**」であって、美味しさの評価ではありません。
センサーで測れるのは塩分とこってり度だけなので、★評価のような言葉は使っていません
（詳しくは [`lib/taste.ts`](../lib/taste.ts) の冒頭のコメント）。

### curl の例

```bash
curl https://momochari-ramen.vercel.app/api/shops
```

### 圏外のときの扱い

地図アプリ側では、取得できた一覧をファイルに保存しておき、
次に圏外で起動しても前回のお店を表示できるようにしています。
お店の情報は頻繁には変わらないので、取得は 5 分おきで十分です。

---

## エラーレスポンス

失敗したときは `{ "error": "理由" }` が返ります。

| ステータス | 意味                       | 確認すること                                                                                                                                                                  |
| ---------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`      | リクエストの中身がおかしい | `error` に理由が入っています。必須項目の抜け・型（数値を文字列で送っていないか）を確認。`/api/ramen` で「お店が見つかりません」と出る場合は `shop_id` が `shops` に存在しない |
| `401`      | 合言葉が違う               | `x-device-key` ヘッダーの値。ヘッダー名のタイポにも注意                                                                                                                       |
| `405`      | メソッドが違う             | `POST` で送っているか                                                                                                                                                         |
| `500`      | サーバー側の失敗           | DB への保存に失敗しています。Web 担当（槇原）に連絡してください                                                                                                               |

## よくある間違い

**① `shop_id` にデバイス名や連番を入れる**

```json
{ "shop_id": "raspi-01", "temp_c": 78.2 }   ← エラーになります
```

`shop_id` は**お店を指す UUID** です。`11111111-1111-4111-8111-111111111111` のような形で、[/shops](https://momochari-ramen.vercel.app/shops) のページから確認できます。

**② 数値をクォートで囲む**

```json
{ "temp_c": "78.2" }   ← エラーになります
{ "temp_c": 78.2 }     ← これが正しい
```

センサーの値を文字列として組み立ててしまうとこうなります。JSON に入れる前に数値へ変換してください（JavaScript なら `Number(value)`）。

## つまずいたときのチェックリスト

1. `401` が返る → `x-device-key` の値が合っているか。ローカルなら `.env.local` の `DEVICE_API_KEY` と一致している必要があります
2. `400` が返る → レスポンスの `error` を読む。だいたい必須項目の抜けです
3. 送れたのに地図に出ない → まず Supabase の Table Editor で `ride_points` に行が増えているか確認。
   増えていれば送信は成功しているので、Web 側の表示の問題です
4. 何も返ってこない → URL が合っているか。ローカルの場合、Web 側で `npm run dev` が動いている必要があります
