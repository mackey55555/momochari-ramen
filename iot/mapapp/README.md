# iot/mapapp/ — ラズパイの画面に出す地図アプリ

自分の現在地を中心にした地図と、一番近いラーメン屋の詳細を表示します。
塩分センサーの判定が届いたら、画面下部に割り込みで表示します。

```
      720 × 1280（縦置き）
┌──────────────────┐
│      ▲           │
│         ▲        │  上 65% : 地図
│     ●            │          自分は常に中央（地図のほうが動く）
│                  │          ▲ = お店。濃厚/ふつう/あっさりで色分け
│  ▲               │
├──────────────────┤
│ 🍜 ラーメン太郎   │  下 35% : 一番近いお店の詳細
│           180m   │          歩けば自動で入れ替わる
│ 醤油 ・ 岡山市... │
│ 濃厚              │  ← 計測が届くと、ここが15秒だけ結果表示に変わる
│ 計測 3回 ／ ...   │
└──────────────────┘
```

## このアプリがやらないこと

- **センサーを読むこと** … すでに動いている別のプログラムの仕事です
- **「美味しいか」を判定すること** … 塩分センサーのプログラムの仕事です
- **味の傾向（濃厚/ふつう/あっさり）を計算すること** … Web API の仕事です

**受け取って表示するだけ**です。この切り分けのおかげで、センサー側が落ちても
地図は出続けますし、このアプリが落ちても API への送信は止まりません。

データの受け取り方は [`docs/device-app.md`](../../docs/device-app.md) を参照。

## 必要なもの

|                |                                                      |
| -------------- | ---------------------------------------------------- |
| 本体           | Raspberry Pi Zero W                                  |
| 画面           | 14 インチのモバイルモニタ（縦置き）＋ mini-HDMI 変換 |
| OS             | **Raspberry Pi OS Lite (Bullseye)** を推奨           |
| Python         | 3.9 以上（OS に最初から入っています）                |
| 追加ライブラリ | **なし**（標準ライブラリだけで動きます）             |

> モバイルモニタは自前の電源が必要です。Zero W からは給電できません。

### なぜ Bullseye 推奨か

画面の回転設定が、Bookworm（KMS ドライバが標準）だと別のやり方になり、
Zero W まわりの情報が少ないためです。Bookworm を使う場合は
「画面を縦にする」の項を読み替えてください。

---

## セットアップ

### 1. 画面の設定（`/boot/firmware/config.txt`）

```ini
# ★重要★ フレームバッファを 720x1280 に落とす
#
# モニタが 1920x1080 でも、そのまま縦(1080x1920)で使うと約200万画素。
# ARMv6 シングルコアの Python では描画が追いつきません。
# 720x1280 なら描画量が 1/2.25 になり、14インチなら文字も十分読めます。
framebuffer_width=720
framebuffer_height=1280

# 画面を縦にする（0=通常, 1=90度, 2=180度, 3=270度）
display_rotate=1
```

> **Bookworm の場合** `display_rotate` は効きません。`/boot/firmware/cmdline.txt` の
> 行末に `video=HDMI-A-1:720x1280M@60,rotate=90` を追記してください（改行を入れないこと）。

### 2. 必要なパッケージ

Raspberry Pi OS Lite にはデスクトップ環境が入っていませんが、
**デスクトップは不要です。X だけあれば動きます。**

```bash
sudo apt update
sudo apt install --no-install-recommends \
  xserver-xorg xinit x11-xserver-utils \
  python3-tk \
  fonts-noto-cjk
```

| パッケージ             | 無いとどうなるか                                                            |
| ---------------------- | --------------------------------------------------------------------------- |
| `xserver-xorg` `xinit` | 画面が出ない                                                                |
| `python3-tk`           | `ModuleNotFoundError: No module named 'tkinter'`（Lite には入っていません） |
| `fonts-noto-cjk`       | 日本語が全部 □□□（豆腐）になる                                              |

ウィンドウマネージャは**入れません**。タイトルバーも何も無いので、
ウィンドウが自動的に画面いっぱいになります。

### 3. アプリを置く

```bash
# 手元のパソコンから
scp -r iot/mapapp pi@raspi.local:~/momochari/
```

`git clone` でも構いませんが、ファイルを置くだけで動きます。

### 4. 地図タイルを用意する

走行中に圏外になると地図が真っ白になるので、岡山エリアを事前に落としておきます。

```bash
# ★手元の Mac で実行してください（ラズパイでやると何時間もかかります）
cd iot/mapapp
python3 tools/download_tiles.py

# 落ちたらラズパイに送る
scp -r tiles pi@raspi.local:~/momochari/mapapp/
```

範囲やズームを変えたいときは `--bbox` `--zoom` を指定できます（`--help` 参照）。

タイルは**地理院タイル（国土地理院）**からもらっています。OpenStreetMap ではありません。

> **なぜ OSM を使わないか**
> OSM のタイルサーバーはボランティア運営で、利用ポリシーにより
> 「まとめてダウンロードすること」自体が禁止されています。圏外対策で事前に
> 落とすという用途に合いません（実際に試すとブロックされ、全タイルが
> "Access blocked" の画像になります）。
> 地理院タイルは API キー不要で、出典を表示すれば手元に保存して使えます。
> 日本の地図なので地名が日本語なのも利点です。
> 利用規約: https://maps.gsi.go.jp/development/ichiran.html

地図の右下に出る「出典: 国土地理院」は利用条件なので消さないでください。
広い範囲を一気に落とさないこと、スクリプトが入れている待ち時間も縮めないこと。

### 5. 動かす

```bash
startx /usr/bin/python3 /home/pi/momochari/mapapp/app.py
```

> `startx ./app.py` とは書けません。`app.py` に shebang も実行権限も付けていないので、
> 起動するプログラム（`/usr/bin/python3`）から絶対パスで指定してください。

終了は **Esc キー**です（全画面なので閉じるボタンがありません）。

---

## 電源を入れたら自動で起動させる

### 1. 自動ログインにする

```bash
sudo raspi-config
# → 1 System Options → S5 Boot / Auto Login → B2 Console Autologin
```

### 2. `~/.xinitrc` を作る

```sh
#!/bin/sh
# 放っておくと画面が省電力で消えてしまうので、切っておく。
# 自転車で走っている間ずっと点いていてほしいアプリなので、これは必須。
xset s off
xset -dpms
xset s noblank

exec python3 /home/pi/momochari/mapapp/app.py
```

```bash
chmod +x ~/.xinitrc
```

### 3. `~/.bash_profile` に追記

```sh
# tty1（＝モニタに繋がっている画面）でログインしたときだけ X を起動する。
# この条件を付けないと、SSH でログインするたびに X が立ち上がろうとします。
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  exec startx
fi
```

これで、電源を入れれば地図が出てくる状態になります。

---

## 手元の Mac で試す

ラズパイや GPS が無くても開発できます。センサーの代わりになるスクリプトを同梱しています。

### 先に必要な準備（Mac のみ・1 回だけ）

```bash
brew install python-tk@3.14
```

> **これは必須です。** macOS に最初から入っている `/usr/bin/python3` は Tk 8.5.9
> （2010 年）で、最近の macOS では**ウィンドウが真っ黒のまま何も描画されません**。
> PNG も読めないので地図タイルも出ません。ラズパイは Tk 8.6 なので、この作業は
> Mac で試すときだけの話です。

### 3 つの端末で動かす

```bash
# 端末その1: Web サーバー（GET /api/shops が要るため）
npm run dev

# 端末その2: ニセのセンサー（岡山駅のまわりを3分で一周します）
cd iot/mapapp
MOMOCHARI_HANDOFF_DIR=./_fake python3 tools/fake_sensors.py
#   → Enter を押すと「ラーメンの計測結果」が 1 件飛びます

# 端末その3: 地図アプリ
cd iot/mapapp
MOMOCHARI_FULLSCREEN=0 \
MOMOCHARI_HANDOFF_DIR=./_fake \
MOMOCHARI_API_BASE=http://localhost:3000 \
MOMOCHARI_SCREEN_WIDTH=480 MOMOCHARI_SCREEN_HEIGHT=854 \
python3.14 app.py
```

- `MOMOCHARI_HANDOFF_DIR` は**端末2と3で同じ値**にすること（データの受け渡し場所なので）
- 画面サイズを 480×854 にしているのは、本番の 720×1280 だと Mac の画面から
  はみ出すためです（縦横比は同じ）
- 終了は **Esc キー**

---

## ファイル構成

| ファイル                  | 役割                                                |
| ------------------------- | --------------------------------------------------- |
| `app.py`                  | 全体の司令塔。1 秒ごとに読んで画面を更新する        |
| `config.py`               | 設定値。調整はここだけ触れば済む                    |
| `handoff.py`              | 他のプログラムが書いた JSON を読む                  |
| `shops.py`                | Web API からお店を取得・距離計算                    |
| `mapview.py`              | 地図の描画（遅かったら差し替えるのはここだけ）      |
| `panel.py`                | 画面下部のパネル                                    |
| `tools/fake_sensors.py`   | 開発用。センサーの代わりに JSON を書く              |
| `tools/download_tiles.py` | 地図タイルの事前ダウンロード                        |
| `tiles/`                  | 地図タイル（`{z}/{x}/{y}.png`）。git には入れません |
| `shops_cache.json`        | 前回取得したお店。圏外での起動用。自動生成          |

## 設定を変えたいとき

`config.py` を読んでください。すべて環境変数でも上書きできます。
よく触りそうなものだけ挙げると:

| 環境変数                      | 既定値 | 説明                                                |
| ----------------------------- | ------ | --------------------------------------------------- |
| `MOMOCHARI_ZOOM`              | 16     | 地図の拡大率。上げると詳しくなるがタイルが 4 倍必要 |
| `MOMOCHARI_MAP_RATIO`         | 0.65   | 画面の何割を地図にするか                            |
| `MOMOCHARI_NEAREST_MAX_M`     | 2000   | 何 m 以内の店を「近く」とみなすか                   |
| `MOMOCHARI_RAMEN_DISPLAY_SEC` | 15     | 計測結果を何秒出しておくか                          |
| `MOMOCHARI_MOVE_THRESHOLD_M`  | 5      | 何 m 動いたら地図を描き直すか（大きいほど軽い）     |

---

## 困ったとき

アプリは起動時に状態を表示します。まずこれを見てください。

```
============================================================
momochari-ramen 地図アプリ
============================================================
受け渡し : /run/momochari にあるファイル: gps.json
地図タイル: /home/pi/momochari/mapapp/tiles
API      : https://momochari-ramen.vercel.app/api/shops
お店      : キャッシュから 5 件読み込み
終了するには Esc キー
============================================================
```

| 症状                                | 確認すること                                                                                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 文字が全部 □□□                      | `sudo apt install fonts-noto-cjk`                                                                                                                    |
| `No module named 'tkinter'`         | `sudo apt install python3-tk`                                                                                                                        |
| 地図が背景色のまま                  | タイル未取得。`tools/download_tiles.py` を実行して `tiles/` を送る                                                                                   |
| 地図が "Access blocked" だらけ      | OSM のタイルを掴んでいる。`tiles/` を消して取り直す（今は地理院タイルを使う設定）                                                                    |
| ウィンドウが真っ黒（Mac のみ）      | Apple 同梱の Tk 8.5.9 は今の macOS で描画できない。`brew install python-tk@3.14` を入れ `python3.14` で起動                                          |
| 「GPS を待っています…」から進まない | `cat /run/momochari/gps.json` で `ts` が毎秒変わっているか確認。変わっていなければセンサー側の問題（[docs/device-app.md](../../docs/device-app.md)） |
| 「お店の一覧を取得中…」から進まない | ネットに繋がっているか。`curl https://momochari-ramen.vercel.app/api/shops`                                                                          |
| 計測結果が出ない                    | `cat /run/momochari/ramen.json` に `ts` が入っているか。無いと無視されます                                                                           |
| 動きがカクカク                      | `framebuffer_width/height` を 720x1280 にしたか。`MOMOCHARI_MOVE_THRESHOLD_M` を大きくする                                                           |
| しばらくすると画面が消える          | `~/.xinitrc` の `xset s off` `xset -dpms`                                                                                                            |

### それでも遅いとき

`mapview.py` を pygame 版に差し替えます。X すら不要になり、
タイル画像を直接貼るだけになるので大幅に軽くなります。
`app.py` は `MapView.render()` しか呼んでいないので、
同じ形のクラスを作れば載せ替えられます。

## 関連ドキュメント

- [`docs/device-app.md`](../../docs/device-app.md) — センサー側プログラムへのお願い（受け渡し仕様）
- [`docs/api.md`](../../docs/api.md) — Web API の仕様
