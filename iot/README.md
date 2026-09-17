# iot/

Raspberry Pi（IoT デバイス）側で動かすスクリプトです。Web アプリ本体とは関係なく、ラズパイ上で直接実行します。

| ファイル           | 何をするか                                                   |
| ------------------ | ------------------------------------------------------------ |
| `check_mpu6050.py` | 振動センサー（MPU-6050）が読めるかだけ確かめる。送信はしない |
| `send_accel.py`    | 振動の強さを 1 秒ごとに計算し、10 点ずつ API に送る          |

ラズパイでの環境構築から実行までの手順は Notion の手順書を見てください。
ラズパイには Git を入れなくても、次のように直接ダウンロードできます。

```bash
curl -O https://raw.githubusercontent.com/mackey55555/momochari-ramen/main/iot/check_mpu6050.py
curl -O https://raw.githubusercontent.com/mackey55555/momochari-ramen/main/iot/send_accel.py
```
