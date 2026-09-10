-- ① 先に既存の重複を消す（同じ組み合わせのうち、古い1件だけ残す）
delete from ride_points a
using ride_points b
where a.id > b.id
  and a.device_id = b.device_id
  and a.recorded_at = b.recorded_at;

-- ② そのあとで index を張る
create unique index idx_ride_points_device_recorded
  on ride_points (device_id, recorded_at);