#!/bin/sh
# 地図アプリの起動スクリプト。X の準備をしてからアプリを起動します。
#
# 使い方:
#     startx /home/pi/momochari/mapapp/run.sh
#
# 自動起動にするときは ~/.xinitrc から呼んでください（README 参照）。
#
# 画面を回す向きを変えたいとき:
#     MOMOCHARI_ROTATE=right startx /home/pi/momochari/mapapp/run.sh
#     指定できるのは left / right / inverted / normal（normal なら回さない）

set -e

# ------------------------------------------------------------
# 画面を縦にする
# ------------------------------------------------------------
# Raspberry Pi OS も Bookworm 以降は KMS ドライバが標準になったため、
# /boot/firmware/config.txt の display_rotate は効きません。
# ここで xrandr を使って X の側で回しています。
#
# 出力の名前（HDMI-1 など）は機種や接続で変わるので、決め打ちせず
# 「つながっている最初の出力」を自動で拾います。
ROTATE="${MOMOCHARI_ROTATE:-left}"

if [ "$ROTATE" != "normal" ]; then
    OUTPUT=$(xrandr | awk '/ connected/{print $1; exit}')
    if [ -n "$OUTPUT" ]; then
        # 回転に失敗してもアプリは起動させる（横向きでも表示はできるため）
        xrandr --output "$OUTPUT" --rotate "$ROTATE" || true
    fi
fi

# ------------------------------------------------------------
# 画面が消えないようにする
# ------------------------------------------------------------
# 放っておくとスクリーンセーバーと省電力で画面が真っ暗になります。
# 走っている間ずっと点いていてほしいアプリなので、3 つとも切ります。
xset s off || true
xset -dpms || true
xset s noblank || true

# ------------------------------------------------------------
# アプリを起動
# ------------------------------------------------------------
# このスクリプトと同じ場所にある app.py を実行する。
# そうしておくと、置き場所を変えてもスクリプトを直さずに済む。
#
# 画面の大きさはアプリが Tk に問い合わせて自動で決めるので、
# 解像度や向きを変えてもここに書くことはありません。
exec python3 "$(dirname "$0")/app.py"
