# momochari-ramen

Web×IoT メイカーズチャレンジ 岡山 / チーム F「ももとちゃりと時々ラーメン」の Web システムです。

自転車で走りながら測ったデータ（振動・CO2・照度）と、
ラーメン屋で測ったデータ（塩分濃度・温度）を、岡山の地図の上で見られるようにします。

## 目次

- [使っている技術](#使っている技術)
- [セットアップ](#セットアップ)
- [画面](#画面)
- [開発ルール](#開発ルール)
- [ディレクトリの説明](#ディレクトリの説明)
- [困ったときは](#困ったときは)

## 使っている技術

| 何に使うか       | 使うもの                                                                |
| ---------------- | ----------------------------------------------------------------------- |
| Web アプリの土台 | [Next.js](https://nextjs.org/)（App Router）+ TypeScript                |
| 見た目（CSS）    | [Tailwind CSS](https://tailwindcss.com/)                                |
| データベース     | [Supabase](https://supabase.com/)（PostgreSQL）                         |
| 地図             | [Leaflet](https://leafletjs.com/) + OpenStreetMap（API キー不要・無料） |
| 公開             | [Vercel](https://vercel.com/)（`main` にマージすると自動でデプロイ）    |

---

## セットアップ

はじめての人向けに、1 つずつ書いてあります。上から順にやってください。

### 0. 必要なもの

- **Node.js 20 以上**（[公式サイト](https://nodejs.org/)から LTS 版を入れてください）
  - 入っているか確認: ターミナルで `node -v` → `v20.x.x` などと出れば OK
- **Git**
- **エディタ**（VS Code 推奨）

### 1. リポジトリを手元に持ってくる

```bash
git clone git@github.com:mackey55555/momochari-ramen.git
cd momochari-ramen
```

### 2. ライブラリをインストールする

```bash
npm install
```

`node_modules` というフォルダができます（これは Git には入りません）。
少し時間がかかります。

### 3. 環境変数を設定する

Supabase につなぐための情報を書いたファイルを作ります。

```bash
cp .env.example .env.local
```

`.env.local` をエディタで開いて、`=` の右側に値を書きます。

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx...
DEVICE_API_KEY=適当な長い文字列
```

**値は槇原に聞いてください**（Slack で共有します）。
Supabase の URL と Publishable key は、ダッシュボードの
**Project Settings > API Keys** からも確認できます。

> ネットの記事だと `NEXT_PUBLIC_SUPABASE_ANON_KEY` / 「anon key」という名前で
> 出てくることがあります。Supabase がキーの名前を変えただけで、役割は同じものです。
> このリポジトリでは今の名前（Publishable key）に揃えています。

> `.env.local` は `.gitignore` に入っているので、Git にはコミットされません。
> 秘密の値を書いても大丈夫です（逆に、この 3 つを他の場所に書かないこと）。

### 4. DB にテーブルとデータを用意する

**すでに槇原がセットアップ済みの Supabase プロジェクトを共有する場合、この手順は不要です。**
3 まで終わったら 5 に進んでください。

新しく Supabase プロジェクトを作った場合のみ、次をやります。

1. Supabase ダッシュボード > **SQL Editor** を開く
2. `supabase/schema.sql` の中身を貼り付けて **Run**（テーブルができる）
3. `supabase/seed.sql` の中身を貼り付けて **Run**（練習用データが入る）

### 5. 起動する

```bash
npm run dev
```

ターミナルに `http://localhost:3000` と出たら、ブラウザで開いてください。
岡山駅を中心にした地図が出れば成功です。

止めるときは、ターミナルで `Ctrl + C`。

> **地図が真っ白 / エラーが出る場合**
> `.env.local` を作ったあとに `npm run dev` を再起動しましたか？
> 環境変数は起動時にしか読まれないので、変更したら必ず再起動が必要です。

### よく使うコマンド

| コマンド         | 何をするか                                               |
| ---------------- | -------------------------------------------------------- |
| `npm run dev`    | 開発用に起動する（普段使うのはこれ）                     |
| `npm run build`  | 本番と同じ形でビルドできるか確かめる。PR を出す前に 1 回 |
| `npm run lint`   | コードの書き方をチェックする                             |
| `npm run format` | コードの見た目（インデントなど）を自動で整える           |

---

## 画面

| URL      | 中身                                                            |
| -------- | --------------------------------------------------------------- |
| `/`      | 地図ページ。岡山駅中心の地図を全画面表示                        |
| `/shops` | ラーメン店の一覧。**Supabase からデータを取って表示するお手本** |

新しくデータを表示する画面を作るときは、まず `app/shops/page.tsx` を読んでください。
コメントで 1 行ずつ説明してあります。

---

## 開発ルール

### `main` に直接 push しない

`main` は Vercel の本番につながっています。壊れたコードが入ると、そのまま公開されます。
**必ずブランチを切って PR を出してください。**

### 1 Issue = 1 ブランチ = 1 PR

「あれもこれも」を 1 つの PR に入れないでください。レビューが大変になり、
何か問題が起きたときに切り戻せなくなります。

### ブランチ名

```
feat/<Issue番号>-<短い説明>
```

例: `feat/12-map-shop-pins`、`feat/7-shop-detail-page`

### 作業の流れ

```bash
# 1. main を最新にする
git switch main
git pull

# 2. ブランチを切る
git switch -c feat/12-map-shop-pins

# 3. 実装する

# 4. 動作確認（大事！）
npm run dev     # 実際にブラウザで見る
npm run build   # ビルドが通るか

# 5. コミットして push
git add -A
git commit -m "地図にラーメン店のピンを表示"
git push -u origin feat/12-map-shop-pins

# 6. GitHub で PR を作る（テンプレートが自動で出ます）
```

### レビュー

PR は**槇原がレビューしてマージ**します。自分ではマージしないでください。

- 分からないところは PR の「相談したいこと」に書いてください。それが一番助かります
- 指摘は「直してほしい」であって「ダメ出し」ではないので、気楽にどうぞ
- マージされると Vercel が自動でデプロイします

---

## ディレクトリの説明

```
app/
  page.tsx              # 地図ページ（/）
  shops/page.tsx        # 店一覧（/shops）。データ取得のお手本
  api/ingest/route.ts   # 走行データの受け口（IoTデバイスがここに送る）
  api/ramen/route.ts    # ラーメン計測の受け口
components/
  Map.tsx               # 地図本体。ピンや線を足すのはここ
lib/
  supabase.ts           # Supabase につなぐ設定。import して使う
  database.types.ts     # DB から自動生成した型。手で編集しないこと
types/
  index.ts              # Shop / RidePoint / RamenMeasurement 型
supabase/
  schema.sql            # テーブル定義（常に最新の全体像）
  seed.sql              # 練習用データ
  migrations/           # スキーマ変更の履歴（連番SQL）
docs/
  api.md                # IoTチーム向けの送信仕様
  database.md           # DB の触り方・変え方
```

---

## 困ったときは

| 症状                                                   | まず確認すること                                                            |
| ------------------------------------------------------ | --------------------------------------------------------------------------- |
| `npm run dev` でエラー「環境変数が設定されていません」 | `.env.local` を作りましたか？ 作ったあと `npm run dev` を再起動しましたか？ |
| 地図が真っ白                                           | ブラウザの開発者ツール（F12）の Console にエラーが出ていないか              |
| `/shops` が「データの取得に失敗しました」              | `.env.local` の URL とキーが正しいか。Supabase に `shops` テーブルがあるか  |
| `/shops` が「まだ 1 件も登録されていません」           | `supabase/seed.sql` を実行しましたか？                                      |
| その他                                                 | Slack で聞いてください。30 分悩んだら聞くのがおすすめです                   |

### 関連ドキュメント

- **IoTチームの人** → [docs/api.md](docs/api.md) にデータの送り方（curl の例つき）があります
- **DB を触りたい / カラムを足したい** → [docs/database.md](docs/database.md) を読んでください
