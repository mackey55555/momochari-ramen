-- 同じデバイスの同じ時刻の点は 1 つだけにする
create unique index idx_ride_points_device_recorded
  on ride_points (device_id, recorded_at);