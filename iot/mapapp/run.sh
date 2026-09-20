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
echo "[run.sh] MOMOCHARI_ROTATE=$ROTATE"

if [ "$ROTATE" != "normal" ]; then
    OUTPUT=$(xrandr 2>/dev/null | awk '/ connected/{print $1; exit}')

    # 回転に失敗してもアプリは起動させる（横向きでも表示はできるため）。
    # ただし黙って失敗すると「指定したのに回らない」の原因が分からなくなるので、
    # 何をして何が起きたかは必ずログに出す。
    if [ -z "$OUTPUT" ]; then
        echo "[run.sh] 接続中の出力が見つかりません（xrandr は使えていますか？）" >&2
    elif xrandr --output "$OUTPUT" --rotate "$ROTATE"; then
        echo "[run.sh] $OUTPUT を $ROTATE に回転しました"
    else
        echo "[run.sh] $OUTPUT を $ROTATE に回転できませんでした" >&2
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
