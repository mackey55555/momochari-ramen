"""
MPU-6050 の振動データを Web の API に送るスクリプト（振動センサー単体のテスト用）

1 秒ごとに「その 1 秒間の揺れの強さ」を計算し、10 点たまったらまとめて送ります。
Ctrl + C で止まります。

使い方:
    export DEVICE_API_KEY=Slackで共有した合言葉
    python send_accel.py

注意:
    GPS をまだつないでいないので、位置は岡山駅の固定値で送ります。
    テスト用なので device_id を "accel-test" にしてあります。
    テストが終わったら槇原に連絡してください（まとめて削除します）。
"""

import math
import os
import sys
import time
from datetime import datetime, timezone

import requests
from smbus2 import SMBus

API_URL = "https://momochari-ramen.vercel.app/api/ingest"
DEVICE_ID = "accel-test"

# GPS をつなぐまでの仮の位置（岡山駅）。GPS の値に置き換える予定
TEST_LAT = 34.6664
TEST_LNG = 133.9183

MPU6050_ADDR = 0x68
SAMPLES_PER_SECOND = 100  # 1 秒間に何回センサーを読むか
POINTS_PER_SEND = 10  # 何点たまったら送るか

# 合言葉はプログラムに直接書かない（GitHub などに上げると漏れるため）
DEVICE_KEY = os.environ.get("DEVICE_API_KEY")
if not DEVICE_KEY:
    print("合言葉が設定されていません。先に次を実行してください:")
    print("  export DEVICE_API_KEY=Slackで共有した合言葉")
    sys.exit(1)


def read_accel(bus):
    """加速度 X/Y/Z を g 単位で読む"""
    raw = bus.read_i2c_block_data(MPU6050_ADDR, 0x3B, 6)
    values = []
    for i in range(0, 6, 2):
        value = (raw[i] << 8) | raw[i + 1]
        if value >= 32768:
            value -= 65536
        # ±4g の設定にしているので 8192 で 1g
        values.append(value / 8192.0)
    return values


def measure_vibration_rms(bus):
    """
    1 秒間センサーを読み続けて、揺れの強さ（RMS、単位 g）を返す。

    加速度の大きさには、止まっていても重力の 1g が含まれる。
    そのまま使うと「止まっていても 1 近い値」になってしまうので、
    毎回 1g を引いて「重力以外の揺れ」だけを取り出してから平均する。
    """
    total = 0.0
    for _ in range(SAMPLES_PER_SECOND):
        ax, ay, az = read_accel(bus)
        magnitude = math.sqrt(ax**2 + ay**2 + az**2)
        shake = magnitude - 1.0  # 重力の分を引く
        total += shake**2
        time.sleep(1.0 / SAMPLES_PER_SECOND)
    return math.sqrt(total / SAMPLES_PER_SECOND)


def send(points):
    """たまった点をまとめて API に送る"""
    response = requests.post(
        API_URL,
        headers={"x-device-key": DEVICE_KEY},
        json={"device_id": DEVICE_ID, "points": points},
        timeout=10,
    )
    print(f"送信 {len(points)} 点 → ステータス {response.status_code}: {response.text}")
    return response.ok


with SMBus(1) as bus:
    bus.write_byte_data(MPU6050_ADDR, 0x6B, 0)  # スリープ解除
    bus.write_byte_data(MPU6050_ADDR, 0x1C, 0x08)  # 測れる範囲を ±4g に（自転車の段差は 2g を超えるため）
    time.sleep(0.1)

    buffer = []
    while True:
        rms = measure_vibration_rms(bus)
        point = {
            "lat": TEST_LAT,
            "lng": TEST_LNG,
            "accel_rms": round(rms, 3),
            # 時刻は必ず世界標準時の ISO 形式で（Web 側で日本時間に直す）
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        }
        buffer.append(point)
        print(f"計測: 揺れ {point['accel_rms']}g（{len(buffer)}/{POINTS_PER_SEND}）")

        if len(buffer) >= POINTS_PER_SEND:
            try:
                if send(buffer):
                    buffer = []  # 送れたら空にする
                # 送れなかったら buffer を残して、次の回にまとめて送り直す
            except requests.RequestException as error:
                print("通信エラー（次の回に送り直します）:", error)
