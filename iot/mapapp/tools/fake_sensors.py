"""
センサーが無くても地図アプリを試せるようにする、ニセのセンサー。

本物のセンサー側プログラムの代わりに、同じ場所・同じ形式で JSON を書きます。
これがあるので、ラズパイや GPS が手元に無くても開発できます。

    # 端末その 1（ニセのセンサー）
    python3 tools/fake_sensors.py

    # 端末その 2（地図アプリ）
    MOMOCHARI_FULLSCREEN=0 MOMOCHARI_HANDOFF_DIR=./_fake python3 app.py

岡山駅のまわりをゆっくり一周します。
Enter を押すと「ラーメンの計測結果」を 1 件書き込みます（画面下部が切り替わります）。
Ctrl + C で終了。
"""

import json
import math
import os
import sys
import threading
import time
from datetime import datetime, timezone

# tools/ から 1 つ上の階層にある config.py を読めるようにする
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config  # noqa: E402

# 岡山駅のまわりを、半径 300m くらいでゆっくり回る
CENTER_LAT = 34.6664
CENTER_LNG = 133.9183
RADIUS_M = 300.0
LAP_SEC = 180.0  # 一周にかかる時間

# Enter を押すたびに、この順で出る
SAMPLE_RESULTS = [
    "このラーメンは美味しい！",
    "塩分ひかえめ。あっさり系",
    "かなり濃いめ。飲み干し注意",
    "ちょうどいい塩加減",
]


def now_iso() -> str:
    """docs/api.md と同じ ISO 8601（UTC、末尾 Z）の形にする"""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def write_json(path: str, data: dict) -> None:
    """
    本物のセンサー側プログラムにお願いしているのと同じ書き方。

    一時ファイルに書いてから os.replace() で差し替えると、
    読む側からは「完全な JSON」か「ひとつ前の完全な JSON」しか見えなくなる。
    直接上書きすると、書きかけを読まれて相手が落ちる。
    """
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, path)


def gps_loop() -> None:
    """1 秒ごとに gps.json を上書きし続ける"""
    # 緯度 1 度 ≒ 111km。経度は緯度が上がるほど縮むので cos を掛ける。
    lat_per_m = 1.0 / 111000.0
    lng_per_m = 1.0 / (111000.0 * math.cos(math.radians(CENTER_LAT)))

    start = time.monotonic()
    while True:
        angle = 2 * math.pi * ((time.monotonic() - start) % LAP_SEC) / LAP_SEC
        lat = CENTER_LAT + RADIUS_M * math.sin(angle) * lat_per_m
        lng = CENTER_LNG + RADIUS_M * math.cos(angle) * lng_per_m

        write_json(
            config.GPS_FILE,
            {"lat": round(lat, 6), "lng": round(lng, 6), "ts": now_iso()},
        )
        time.sleep(1.0)


def main() -> None:
    os.makedirs(config.HANDOFF_DIR, exist_ok=True)
    print(f"書き込み先: {config.HANDOFF_DIR}")
    print("Enter を押すと計測結果を 1 件書き込みます（Ctrl + C で終了）")

    threading.Thread(target=gps_loop, daemon=True).start()

    index = 0
    try:
        while True:
            input()
            text = SAMPLE_RESULTS[index % len(SAMPLE_RESULTS)]
            index += 1
            write_json(config.RAMEN_FILE, {"text": text, "ts": now_iso()})
            print(f"  → {text}")
    except (KeyboardInterrupt, EOFError):
        print("\n終了します")


if __name__ == "__main__":
    main()
