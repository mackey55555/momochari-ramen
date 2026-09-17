"""
MPU-6050 の動作確認用スクリプト（インターネットには送りません）

センサーの配線と I2C が正しく動いているかだけを確かめます。
Ctrl + C で止まります。

使い方:
    python check_mpu6050.py
"""

import math
import time

from smbus2 import SMBus

MPU6050_ADDR = 0x68  # i2cdetect で 68 と表示されたアドレス

with SMBus(1) as bus:
    # MPU-6050 はスリープ状態で起動するので、起こす
    bus.write_byte_data(MPU6050_ADDR, 0x6B, 0)
    time.sleep(0.1)

    while True:
        # 加速度 X/Y/Z を 6 バイトまとめて読む（1 回の通信で済むので速い）
        raw = bus.read_i2c_block_data(MPU6050_ADDR, 0x3B, 6)
        values = []
        for i in range(0, 6, 2):
            value = (raw[i] << 8) | raw[i + 1]
            if value >= 32768:  # マイナスの値に直す
                value -= 65536
            values.append(value / 16384.0)  # 初期設定（±2g）では 16384 で 1g
        ax, ay, az = values
        total = math.sqrt(ax**2 + ay**2 + az**2)

        # 机に置いて止まっているときに「合計」がだいたい 1.00 なら正常（重力 1g）
        print(f"X={ax:+.2f}g  Y={ay:+.2f}g  Z={az:+.2f}g  合計={total:.2f}g")
        time.sleep(0.5)
