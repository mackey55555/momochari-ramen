# DB の触り方・変え方

このプロジェクトの DB は **Supabase（PostgreSQL）** です。
「見たい」「直したい」「カラムを増やしたい」でやることが違うので、順に説明します。

## 大前提

- **チーム全員が同じ Supabase プロジェクト（開発用）を共有します。**
  自分のパソコンに DB を立てる必要はありません。
- スキーマ（テーブルの定義）の正解は **`supabase/schema.sql`** です。
  「今どうなっているか」を知りたいときは、まずこのファイルを読んでください。
- 入っているのは全部**開発用の練習データ**です。壊しても大丈夫。
  `supabase/seed.sql` を流し直せば元に戻ります（手順は下に）。

## テーブル一覧

| テーブル             | 中身                                                       |
| -------------------- | ---------------------------------------------------------- |
| `shops`              | ラーメン店のマスタ（名前・ジャンル・住所・緯度経度）       |
| `ride_points`        | 走行中の計測点。IoTデバイスが送ってくる生データ            |
| `ramen_measurements` | ラーメンの計測結果（塩分濃度・温度など）。`shops` に紐づく |

---

## 1. データを見る・直す

Supabase ダッシュボードの **Table Editor** を自由に使ってください。

1. https://supabase.com/dashboard にログイン
2. プロジェクトを選ぶ
3. 左メニューの **Table Editor**
4. 見たいテーブルをクリック

Excel みたいに直接セルを編集できます。行の追加・削除も自由です。
**開発用データなので、壊すのを怖がらなくて大丈夫です。**

SQL を書いて調べたいときは、左メニューの **SQL Editor** で `select` を実行できます。

```sql
-- 例: 振動が大きかった地点トップ10
select lat, lng, accel_rms, recorded_at
from ride_points
order by accel_rms desc
limit 10;
```

### データを元に戻す（リセット）

ぐちゃぐちゃにしてしまったら、次の手順で初期状態に戻せます。

1. Supabase ダッシュボード > **SQL Editor** を開く
2. `supabase/seed.sql` の中身を**全部**コピーして貼り付ける
3. **Run** を押す

`seed.sql` は最初に既存データを全部消してから入れ直すので、
何度実行しても同じ状態になります。

> ⚠️ 全員が同じ DB を共有しています。リセットすると
> **他のメンバーが入れたデータも消えます。**
> 実行する前に Slack で一声かけてください。

---

## 2. スキーマを変えたいとき（カラム追加・テーブル追加）

「お店に電話番号を持たせたい」「新しいテーブルを足したい」というときの手順です。

### ⚠️ 一番やってはいけないこと

**Supabase の画面でカラムを追加して、それで終わりにすること。**

DB だけ変わってコードに記録が残らないと、

- 他のメンバーの手元では「そんなカラム無いよ」となる
- 何をどう変えたのか、誰にも分からなくなる
- 本番用の DB を作り直すときに再現できない

…という一番つらい事故が起きます。**必ず SQL をファイルに残してから DB を変えてください。**

### 手順

#### ① `supabase/migrations/` に差分の SQL を追加する

連番のファイル名で作ります。中身は「今の状態から何を変えるか」の SQL だけです。

ファイル名の例: `supabase/migrations/002_add_phone_to_shops.sql`

```sql
-- shops に電話番号を追加する
alter table shops add column phone text;
```

> ファイル名の連番は、`supabase/migrations/` の中を見て、
> 今ある一番大きい番号 + 1 にしてください（最初の 1 本は `001_` から）。

#### ② `supabase/schema.sql` にも同じ変更を反映する

`schema.sql` は「**常に最新の全体像**」を表すファイルです。
まっさらな DB にこれを 1 回実行すれば、今と同じテーブルができる状態を保ちます。

上の例なら、`create table shops (...)` の中に 1 行足します。

```sql
create table shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  style text,
  address text,
  phone text,                       -- ← 追加
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);
```

> **なぜ 2 か所に書くのか**
> migration は「変更の履歴」、schema.sql は「現在の設計図」で、役割が違うからです。
> 履歴だけだと今の姿を知るのに全部読む必要があり、設計図だけだと
> 既にある DB をどう変えればいいか分かりません。両方あると両方できます。

#### ③ ①②とコードの変更をまとめて PR を出す

「カラムを足す SQL」と「そのカラムを使う画面のコード」は同じ PR に入れてください。

#### ④ マージ後、**槇原が** DB に反映する

学生側の作業はここまでです。以降は槇原がやります（Supabase CLI のセットアップは不要）。

1. Supabase ダッシュボード > SQL Editor で、追加された migration の SQL を実行する
2. TypeScript の型を再生成してコミットする

   ```bash
   npx supabase gen types typescript --project-id <プロジェクトID> > lib/database.types.ts
   ```

型を再生成すると、`shop.phone` のようにエディタで補完が効くようになります。
**型が更新されるまでは、自分が足したカラムはコードから見えません。**
PR を出したあと、槇原が反映して `main` を更新するのを待ってから
`git pull` してください。

---

## 3. 型（`lib/database.types.ts`）について

`lib/database.types.ts` は Supabase CLI が DB のスキーマから**自動生成**したファイルです。

- **手で編集しないでください。** 次の生成で上書きされます
- 生成するのは槇原の担当です
- アプリのコードから使うときは、`types/index.ts` の `Shop` / `RidePoint` /
  `RamenMeasurement` を import すると読みやすいです

```ts
import type { Shop } from "@/types";
```

---

## 4. RLS（Row Level Security）について

Supabase には「この行を誰が読み書きできるか」を制御する RLS という仕組みがありますが、
**このプロジェクトでは無効のままにしています。**

- 無効 = anon key を知っていれば誰でも読み書きできる状態です
- ハッカソン期間中は、開発の速さを優先してこうしています
- **本番として運用するなら、必ず RLS を設定してください。**
  （読み取りだけ anon に許可し、書き込みは service_role のみにする、など）
