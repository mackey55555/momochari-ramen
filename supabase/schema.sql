-- ============================================================
-- momochari-ramen スキーマ定義（常に最新の全体像）
-- ============================================================
-- 使い方:
--   Supabase ダッシュボード > SQL Editor にこのファイルの中身を貼り付けて実行する。
--   まっさらな DB に対して 1 回実行すれば、必要なテーブルが全部できます。
--
-- 大事なルール:
--   スキーマを変えたいときは supabase/migrations/ に差分 SQL を追加し、
--   このファイルにも同じ変更を反映すること。詳しくは docs/database.md を読んでください。
-- ============================================================

-- ------------------------------------------------------------
-- ラーメン店マスタ
-- ------------------------------------------------------------
create table shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  style text,                       -- ジャンル（醤油 / 豚骨 / 塩 / 味噌 など）
  address text,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 走行計測点（IoTデバイスから送信される生データ）
-- ------------------------------------------------------------
create table ride_points (
  id bigint generated always as identity primary key,
  device_id text not null,          -- デバイス識別子（例: "raspi-01"）
  lat double precision not null,
  lng double precision not null,
  accel_rms real,                   -- 振動の強さ（加速度RMS）。ガタガタ道指標
  co2_ppm real,                     -- CO2濃度
  lux real,                         -- 照度。暗い道指標
  recorded_at timestamptz not null, -- デバイス側の計測時刻
  created_at timestamptz not null default now()
);

-- 「最近の走行データを時刻順に取り出す」クエリが速くなるようにインデックスを張る
create index idx_ride_points_recorded_at on ride_points (recorded_at);

-- ------------------------------------------------------------
-- ラーメン計測
-- ------------------------------------------------------------
create table ramen_measurements (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  salinity_pct real,                -- 塩分濃度（%）
  tds_ppm real,                     -- TDS生値
  temp_c real,                      -- スープ温度（℃）
  memo text,
  measured_at timestamptz not null default now()
);

-- ============================================================
-- RLS（Row Level Security）について
-- ============================================================
-- ハッカソン期間中は RLS を無効のままにしています。
-- 無効 = Publishable key を知っていれば誰でも読み書きできる、という状態です。
-- 開発が速いのでこうしていますが、本番運用するなら必ず RLS を設定してください。
-- （読み取りのみ anon に許可し、書き込みは service_role だけにする、など）
-- ============================================================
