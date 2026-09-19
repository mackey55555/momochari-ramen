"""
設定値をまとめた場所。調整したくなったらここだけ触ってください。

環境変数でも上書きできるようにしてあります。
理由は、手元の Mac で開発するときとラズパイ本番とで変えたい値があるからです。

    # Mac で試す（全画面にしない・受け渡しファイルを手元のフォルダにする）
    MOMOCHARI_FULLSCREEN=0 MOMOCHARI_HANDOFF_DIR=./_fake python app.py
"""

import os

# ============================================================
# 他のプログラムからデータを受け取る場所
# ============================================================
# ラズパイ上ですでに動いている 2 つのプログラムが、ここに JSON を書きます。
# 仕様は docs/device-app.md を参照。
#
# /run/ は tmpfs（＝ RAM 上のファイルシステム）なので、
# 毎秒書き込んでも SD カードが摩耗しません。再起動で消えるのも都合がいい
# （前回走ったときの古い位置が残らない）。
HANDOFF_DIR = os.environ.get("MOMOCHARI_HANDOFF_DIR", "/run/momochari")
GPS_FILE = os.path.join(HANDOFF_DIR, "gps.json")
RAMEN_FILE = os.path.join(HANDOFF_DIR, "ramen.json")

# GPS がこの秒数より古くなったら「ロスト」とみなす。
# トンネルやビルの谷間では普通に起きるので、エラーではなく通常の状態として扱う。
# 古い位置を現在地として描き続けないための仕組み。
GPS_STALE_SEC = float(os.environ.get("MOMOCHARI_GPS_STALE_SEC", "5"))

# 塩分の判定テキストを受け取ったとき、画面下部に出しておく秒数。
# この時間が過ぎたら「近くのお店」の表示に自動で戻る。
RAMEN_DISPLAY_SEC = float(os.environ.get("MOMOCHARI_RAMEN_DISPLAY_SEC", "15"))

# ============================================================
# Web API（お店の情報を取ってくる先）
# ============================================================
API_BASE = os.environ.get(
    "MOMOCHARI_API_BASE", "https://momochari-ramen.vercel.app"
)
SHOPS_REFRESH_SEC = float(os.environ.get("MOMOCHARI_SHOPS_REFRESH_SEC", "300"))
# API が応答しないときに、ここで長く待つと画面が固まる。短めに切る。
API_TIMEOUT_SEC = 10.0

# 取得したお店一覧を保存しておくファイル。
# 次に起動したとき、圏外でもいきなりお店が出せるようにするため。
SHOPS_CACHE_FILE = os.environ.get(
    "MOMOCHARI_SHOPS_CACHE", os.path.join(os.path.dirname(__file__), "shops_cache.json")
)

# ============================================================
# 画面
# ============================================================
# モバイルモニタを縦置きで使う想定。
#
# 既定は「画面の実サイズいっぱい」です。起動時に Tk へ問い合わせて決めるので、
# ここでは None にしておきます（app.py で埋まります）。
# 画面の解像度や回転を変えても、アプリ側は何も設定しなくて全画面になります。
#
# 環境変数を指定したときだけ、その大きさのウィンドウになります。
# 手元の Mac で試すとき（画面からはみ出すのを防ぐ）に使ってください:
#     MOMOCHARI_SCREEN_WIDTH=480 MOMOCHARI_SCREEN_HEIGHT=854 python3 app.py
#
# なお、描く画素数が増えるほど当然重くなります。1080x1920（約200万画素）が
# つらい場合は、アプリ側ではなく画面の解像度ごと落とすほうが効果的です。
# /boot/firmware/cmdline.txt の行末に（Bookworm 以降は KMS が標準なので config.txt ではなくこちら）:
#     video=HDMI-A-1:1280x720M@60,rotate=90   → 720x1280 の縦画面になる
def _optional_int(name):
    value = os.environ.get(name)
    return int(value) if value else None


SCREEN_WIDTH = _optional_int("MOMOCHARI_SCREEN_WIDTH")
SCREEN_HEIGHT = _optional_int("MOMOCHARI_SCREEN_HEIGHT")

# 画面の何割を地図にするか。残りが下部パネルになる。
# 縦画面なので「上に地図・下に情報」が素直に収まる。
MAP_RATIO = float(os.environ.get("MOMOCHARI_MAP_RATIO", "0.65"))

FULLSCREEN = os.environ.get("MOMOCHARI_FULLSCREEN", "1") != "0"

# 日本語フォント。Raspberry Pi OS Lite には日本語フォントが入っていないので
#     sudo apt install fonts-noto-cjk
# を忘れると、画面が全部 □□□（豆腐）になります。
FONT_FAMILY = os.environ.get("MOMOCHARI_FONT", "Noto Sans CJK JP")

# ============================================================
# 地図
# ============================================================
# 地図タイルの置き場所。tiles/{z}/{x}/{y}.png の形で置く。
# tools/download_tiles.py で事前にダウンロードしておく。
TILE_DIR = os.environ.get(
    "MOMOCHARI_TILE_DIR", os.path.join(os.path.dirname(__file__), "tiles")
)
TILE_SIZE = 256

# ============================================================
# 地図タイルの入手元：地理院タイル（国土地理院）
# ============================================================
# ★ OpenStreetMap のタイルサーバーは使っていません ★
#
# OSM のタイルはボランティアが運営していて、利用ポリシーで
# 「まとめてダウンロードすること」自体が禁止されています。
# このアプリは圏外対策でタイルを事前に落とす必要があるので、そもそも用途が合いません。
# （実際に試したらブロックされ、全タイルが "Access blocked" の画像になりました）
#
# 地理院タイルは国土地理院が提供している日本全国の地図で、
#   ・API キー不要
#   ・出典を表示すれば、事前ダウンロードして手元に置く使い方もできる
#   ・日本の地図なので地名が日本語で、OSM より圧倒的に見やすい
# と、この用途にぴったりです。
#
# 利用規約: https://maps.gsi.go.jp/development/ichiran.html
#
# "pale"（淡色地図）を選んでいるのは、色が薄くて
# お店のピン（赤・オレンジ・青）が上に乗ったときに埋もれないからです。
# 標準地図にしたければ pale を std に変えてください。
TILE_URL = os.environ.get(
    "MOMOCHARI_TILE_URL",
    "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png",
)

# 地図の隅に出す出典表示。地理院タイルの利用条件なので消さないこと。
TILE_ATTRIBUTION = os.environ.get("MOMOCHARI_TILE_ATTRIBUTION", "出典: 国土地理院")

# ズームレベル。16 だと「徒歩で店を探す」くらいの見え方になる。
# 大きくするほど詳しくなるが、必要なタイル枚数が 4 倍ずつ増えることに注意。
ZOOM = int(os.environ.get("MOMOCHARI_ZOOM", "16"))

# メモリに載せておくタイル画像の上限枚数。
# Tk の PhotoImage は 256x256 でも約 260KB 使うので、無制限にすると
# 走り続けるうちにじわじわメモリを食う。60 枚 ≒ 15MB で頭打ちにする。
TILE_CACHE_SIZE = int(os.environ.get("MOMOCHARI_TILE_CACHE", "60"))

# 一度も測位できていないときに、とりあえず地図の中心にする場所（岡山駅）。
# 真っ白な画面より「どこかの地図が出ている」ほうが、
# 起動できているのか壊れているのかの区別が付きます。
FALLBACK_LAT = float(os.environ.get("MOMOCHARI_FALLBACK_LAT", "34.6664"))
FALLBACK_LNG = float(os.environ.get("MOMOCHARI_FALLBACK_LNG", "133.9183"))

# 前回描いた位置からこの距離（メートル）以上動いたときだけ地図を描き直す。
#
# GPS は止まっていても値が数メートル揺れるので、毎秒追従すると
# 画面がプルプルするうえ、CPU を無駄に食う。信号待ちの間は何もしないのが正解。
MOVE_THRESHOLD_M = float(os.environ.get("MOMOCHARI_MOVE_THRESHOLD_M", "5"))

# ============================================================
# 近くのお店
# ============================================================
# これより遠いお店は「近くにない」扱いにする（画面下部に出さない）。
NEAREST_MAX_M = float(os.environ.get("MOMOCHARI_NEAREST_MAX_M", "2000"))

# 画面を更新する間隔（ミリ秒）。GPS が 1Hz なので 1 秒で十分。
TICK_MS = int(os.environ.get("MOMOCHARI_TICK_MS", "1000"))
