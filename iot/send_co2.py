"""
MH-Z19C の CO2 濃度を Web の API に送るスクリプト

1 秒ごとに測って、10 点たまったらまとめて送ります。Ctrl + C で止まります。

使い方:
    export DEVICE_API_KEY=合言葉
    python send_co2.py

GPS について:
    この機体には GPS がつながっていないので、lat / lng は 0 で送ります。
    Web 側が「直近に届いた GPS 付きの点」の位置に差し替えて保存してくれます。
    そのため、**GPS を載せた機体を先に動かしておいてください**。
    GPS 付きの点が 1 件も無いと、API は 400 を返します。

配線・設定のメモ:
    MH-Z19C の TX → ラズパイの 10 番ピン（RXD）
    MH-Z19C の RX → ラズパイの 8 番ピン（TXD）
    電源は 5V。GND は共通にすること。

    シリアルを使うので、先に raspi-config で設定が要ります。
        sudo raspi-config
        → 3 Interface Options → I6 Serial Port
        → "login shell" は No、"serial port hardware" は Yes
        → 再起動

    /dev/serial0 が見えていれば OK です（ls /dev/serial0 で確認）。
"""

import os
import sys
import time
from datetime import datetime, timezone

import requests
import serial

API_URL = "https://momochari-ramen.vercel.app/api/ingest"

# device_id は「どの機体から届いたか」の名前。URL ではないので注意。
DEVICE_ID = "co2-01"

CO2_PORT = "/dev/serial0"
CO2_BAUD = 9600

POINTS_PER_SEND = 10  # 何点たまったら送るか
PREHEAT_SECONDS = 60  # 電源を入れた直後は値が安定しないので、最初はこの秒数だけ捨てる
MAX_BUFFER = 600  # 送れないときに、ためておく上限（10 分ぶん）

# 合言葉はプログラムに直接書かない。
# このリポジトリは公開しているので、書いて push すると誰でも読めてしまう。
DEVICE_KEY = os.environ.get("DEVICE_API_KEY")
if not DEVICE_KEY:
    print("合言葉が設定されていません。先に次を実行してください:")
    print("  export DEVICE_API_KEY=合言葉")
    sys.exit(1)

# MH-Z19C に「今の CO2 濃度を教えて」と聞くためのコマンド（固定値）
READ_COMMAND = bytes([0xFF, 0x01, 0x86, 0x00, 0x00, 0x00, 0x00, 0x00, 0x79])


def checksum(packet):
    """MH-Z19C の返事が壊れていないかを確かめるための計算"""
    total = sum(packet[1:8]) & 0xFF
    return (0xFF - total + 1) & 0xFF


def read_co2(ser):
    """CO2 濃度（ppm）を 1 回読む。読めなければ None"""
    # 前回の残りが混ざると読み違えるので、読む前に捨てておく
    ser.reset_input_buffer()
    ser.write(READ_COMMAND)

    response = ser.read(9)
    if len(response) != 9:
        return None
    if response[0] != 0xFF or response[1] != 0x86:
        return None
    # 返事が途中で化けていないか確認する
    if response[8] != checksum(response):
        return None

    co2 = response[2] * 256 + response[3]

    # MH-Z19C が測れるのは 400〜5000ppm。外れた値は読み違えなので捨てる。
    # （屋外のきれいな空気が 400ppm 台、交通量が多い道で 700ppm 前後）
    if co2 < 400 or co2 > 5000:
        return None

    return co2


def now_iso():
    """API に送る時刻（世界標準時）。自分で組み立てると 9 時間ずれるので必ずこれを使う"""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def send(points):
    """まとめて送る。送れたら True"""
    body = {"device_id": DEVICE_ID, "points": points}

    try:
        response = requests.post(
            API_URL,
            headers={
                "Content-Type": "application/json",
                "x-device-key": DEVICE_KEY,
            },
            json=body,
            timeout=10,
        )
    except requests.RequestException as e:
        print(f"送信できませんでした（{e}）。次の回にまとめて送り直します")
        return False

    print(f"送信 {len(points)} 点 → ステータス {response.status_code}: {response.text}")

    if response.status_code == 400 and "位置" in response.text:
        print("  ※ GPS を載せた機体から先にデータを送ってください")

    # 400 番台は送り方がおかしいので、ためておいても直らない。捨てる。
    return response.status_code < 500


def main():
    ser = serial.Serial(CO2_PORT, baudrate=CO2_BAUD, timeout=2)
    print(f"CO2 の送信を始めます（device_id: {DEVICE_ID}）。止めるときは Ctrl + C")

    # 電源を入れた直後は 400 や 500 が出続けるので、その間は送らない。
    # ここで送ってしまうと「どこも空気がきれい」という嘘のデータが残る。
    print(f"センサーが温まるまで {PREHEAT_SECONDS} 秒待ちます…")
    for remaining in range(PREHEAT_SECONDS, 0, -10):
        print(f"  あと {remaining} 秒")
        time.sleep(10)

    points = []
    try:
        while True:
            co2 = read_co2(ser)

            if co2 is None:
                print("CO2 読み取り失敗（配線とシリアルの設定を確認してください）")
            else:
                print(f"CO2: {co2} ppm（{len(points) + 1}/{POINTS_PER_SEND}）")
                points.append(
                    {
                        # この機体には GPS が無いので 0 を送る。
                        # Web 側が直近の位置に差し替えてくれる。
                        "lat": 0,
                        "lng": 0,
                        "co2_ppm": co2,
                        "recorded_at": now_iso(),
                    }
                )

            if len(points) >= POINTS_PER_SEND:
                if send(points):
                    points = []
                elif len(points) > MAX_BUFFER:
                    # 圏外が長く続いたとき、古い分から捨てる（メモリを食い潰さないため）
                    print(f"ためすぎたので古い {len(points) - MAX_BUFFER} 点を捨てます")
                    points = points[-MAX_BUFFER:]

            time.sleep(1)

    except KeyboardInterrupt:
        print("終了します")
        if points:
            print(f"残っている {len(points)} 点を送ります")
            send(points)
    finally:
        ser.close()


if __name__ == "__main__":
    main()
