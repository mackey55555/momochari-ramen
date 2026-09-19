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

|                |                                                   |
| -------------- | ------------------------------------------------- |
| 本体           | Raspberry Pi Zero 2 W（arm64）で動作確認済み      |
| 画面           | モバイルモニタ（縦置きで使う）＋ mini-HDMI 変換   |
| OS             | Raspberry Pi OS **Lite**（Trixie で動作確認済み） |
| Python         | 3.9 以上（OS に最初から入っています）             |
| 追加ライブラリ | **なし**（標準ライブラリだけで動きます）          |

> モバイルモニタは自前の電源が必要です。Zero 2 W からは給電できません。

画面の大きさはアプリが起動時に自動で判定するので、解像度や向きを変えても
アプリ側の設定を触る必要はありません。

---

## セットアップ

### 1. 必要なパッケージ

Raspberry Pi OS Lite にはデスクトップ環境が入っていませんが、
**デスクトップは不要です。X だけあれば動きます。**

```bash
sudo apt update
sudo apt install --no-install-recommends \
  xserver-xorg xserver-xorg-legacy xinit x11-xserver-utils \
  python3-tk \
  fonts-noto-cjk
```

| パッケージ             | 無いとどうなるか                                                            |
| ---------------------- | --------------------------------------------------------------------------- |
| `xserver-xorg` `xinit` | 画面が出ない                                                                |
| `xserver-xorg-legacy`  | **SSH から `startx` できない**（下記）                                      |
| `x11-xserver-utils`    | `xrandr` が無く、画面を縦にできない                                         |
| `python3-tk`           | `ModuleNotFoundError: No module named 'tkinter'`（Lite には入っていません） |
| `fonts-noto-cjk`       | 日本語が全部 □□□（豆腐）になる                                              |

> **`xserver-xorg-legacy` を忘れないでください。** `--no-install-recommends` を付けると
> 一緒に入りません。無いまま SSH から `startx` すると、こう出て起動できません。
>
> ```
> parse_vt_settings: Cannot open /dev/tty0 (Permission denied)
> ```
>
> あわせて、SSH から起動したい場合は次も必要です（ラズパイに直接キーボードを
> 挿して使うなら不要）。
>
> ```bash
> sudo tee /etc/X11/Xwrapper.config >/dev/null <<'EOF'
> allowed_users=anybody
> needs_root_rights=yes
> EOF
> ```

ウィンドウマネージャは**入れません**。タイトルバーも何も無いので、
ウィンドウが自動的に画面いっぱいになります。

### 2. アプリを置く

Git は不要です。公開リポジトリなので、そのままダウンロードできます。

```bash
mkdir -p ~/momochari && cd ~/momochari
curl -sL https://github.com/mackey55555/momochari-ramen/archive/refs/heads/main.tar.gz \
  | tar xz --strip-components=2 momochari-ramen-main/iot/mapapp
```

更新したいときは、同じコマンドをもう一度実行すれば上書きされます。
手元にリポジトリがあるなら `scp -r iot/mapapp pi@raspi.local:~/momochari/` でも構いません。

### 3. 地図タイルを用意する

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

### 4. 動かす

```bash
startx /home/pi/momochari/mapapp/run.sh
```

終了は **Esc キー**です（全画面なので閉じるボタンがありません）。

`run.sh` は X の準備をしてからアプリを起動するスクリプトです。やっているのは 3 つだけ:

1. **画面を縦にする**（`xrandr --rotate left`）
2. **スクリーンセーバーと省電力を切る**（走行中に画面が消えないように）
3. `app.py` を起動する

回る向きが逆なら:

```bash
MOMOCHARI_ROTATE=right startx /home/pi/momochari/mapapp/run.sh
```

指定できるのは `left` / `right` / `inverted` / `normal`（`normal` なら回しません）。

> **なぜ `config.txt` で回さないのか**
> Raspberry Pi OS も Bookworm 以降は KMS ドライバが標準になったため、
> `config.txt` の `display_rotate` と `framebuffer_width/height` は**効きません**。
> 起動スクリプト側で `xrandr` を使うほうが、再起動も要らず確実です。

> **`startx ./app.py` とは書けません。** `app.py` には shebang も実行権限も
> 付けていないためです。`run.sh` を使わずに直接起動したい場合は
> `startx /usr/bin/python3 /home/pi/momochari/mapapp/app.py` のように、
> 起動するプログラムを絶対パスで指定してください。

#### 画面が重いとき

アプリは画面の実サイズいっぱいに描くので、1080x1920（約 200 万画素）だと
それなりの負荷になります。もたつく場合は、**アプリではなく画面の解像度ごと**
落とすのが効果的です。`/boot/firmware/cmdline.txt` の行末に半角スペース＋

```
video=HDMI-A-1:1280x720M@60,rotate=90
```

を追記して再起動すると、画面が 720x1280 の縦になり描画量が半分以下になります
（このとき `run.sh` の回転は `MOMOCHARI_ROTATE=normal` で切ってください）。

---

## 電源を入れたら自動で起動させる

仕組みはこうです。どこか 1 つ欠けても動かないので、順番に確認してください。

```
電源 ON
  → getty@tty1 が起動          … ★1
  → pi で自動ログイン           … ★2
  → ~/.bash_profile が startx   … ★3
  → ~/.xinitrc が run.sh を起動 … ★4
  → 地図が出る
```

### 0. 初回セットアップウィザードを片付ける（★1 の前提）

**SSH だけで作業していると、ここで必ずハマります。**

Raspberry Pi OS には初回起動時にユーザーを作るウィザード（`userconfig.service`）があり、
これが tty1 を占有します。SSH しか使っていないと物理画面を見ないので、
ウィザードが待機したままになっていることに気づけません。

```bash
systemctl is-enabled userconfig.service
```

`enabled` と返ってきたら、`pi` ユーザーは既にあるので不要です。止めてください。

```bash
sudo systemctl disable --now userconfig.service
```

> **止めたあとが本題です。** このウィザードは「完了したら getty@tty1 を有効に戻す」
> 動きをするため、完了前に止めると **getty@tty1 が無効のまま残ります**。
> `autologin.conf` があっても getty がいないので自動ログインは発火しません。
> 次の手順で必ず有効化してください。

```bash
sudo systemctl enable --now getty@tty1.service
systemctl is-enabled getty@tty1.service   # → enabled
```

### 1. 自動ログインにする（★2）

```bash
sudo raspi-config
```

**Boot と Auto Login は別項目です**（raspi-config の版によっては 1 つにまとまっています）。
両方やってください。

| 項目              | 選ぶもの                                                             |
| ----------------- | -------------------------------------------------------------------- |
| **S5 Boot**       | `B1 Console Text console`（`B2 Desktop` ではありません）             |
| **S6 Auto Login** | 「Would you like to automatically log in to the console?」→ **はい** |

`Console autologin is enabled` と出れば成功です。
確認メッセージが `to the console` になっていれば、S5 が Console になっている証拠です。

### 2. `~/.xinitrc` を作る（★4）

画面の回転も省電力の解除も `run.sh` の中でやっているので、呼ぶだけです。
**出力をファイルに残しておいてください。** X が起動すると画面が切り替わって
エラーが読めなくなるので、これが無いと原因調査が詰みます。

```bash
cat > ~/.xinitrc <<'EOF'
#!/bin/sh
exec /home/pi/momochari/mapapp/run.sh > /tmp/mapapp.log 2>&1
EOF
chmod +x ~/.xinitrc
```

### 3. `~/.bash_profile` を作る（★3）

```bash
cat > ~/.bash_profile <<'EOF'
# .bash_profile を作ると bash は .profile を読まなくなるので、明示的に読む
[ -f ~/.profile ] && . ~/.profile

# tty1（＝モニタに繋がっている画面）でログインしたときだけ X を起動する。
# この条件が無いと、SSH でログインするたびに X が立ち上がろうとします。
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  exec startx
fi
EOF
```

### 4. 動かして確認する

再起動せずに試せます。

```bash
sudo systemctl restart getty@tty1.service
```

モニタに地図が出れば完成です。最後に `sudo reboot` で、電源 ON からの通しも確認してください。

> **黒い画面とログが繰り返し流れるループに入ったら**、すぐ止めてください。
>
> ```bash
> sudo systemctl stop getty@tty1.service
> cat /tmp/mapapp.log
> ```
>
> これは `.xinitrc` が起動しようとしたものが即終了したときの症状です
> （X が落ちる → 自動ログインし直し → また startx、の繰り返し）。
> いちばん多い原因は **`run.sh` が存在しない**ことです。
> `ls -l ~/momochari/mapapp/run.sh` で確認し、無ければアプリを取り直してください。

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
- 画面サイズを 480×854 に指定しているのは、Mac だと既定（＝画面いっぱい）では
  大きすぎて扱いにくいためです。ラズパイでは指定不要です
- 終了は **Esc キー**

---

## ファイル構成

| ファイル                  | 役割                                                |
| ------------------------- | --------------------------------------------------- |
| `run.sh`                  | 起動スクリプト。画面を縦にして app.py を起動する    |
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

| 環境変数                        | 既定値         | 説明                                                |
| ------------------------------- | -------------- | --------------------------------------------------- |
| `MOMOCHARI_ROTATE`              | left           | 画面を回す向き（left / right / inverted / normal）  |
| `MOMOCHARI_SCREEN_WIDTH/HEIGHT` | 画面の実サイズ | ウィンドウの大きさ。既定は全画面なので普段は不要    |
| `MOMOCHARI_ZOOM`                | 16             | 地図の拡大率。上げると詳しくなるがタイルが 4 倍必要 |
| `MOMOCHARI_MAP_RATIO`           | 0.65           | 画面の何割を地図にするか                            |
| `MOMOCHARI_NEAREST_MAX_M`       | 2000           | 何 m 以内の店を「近く」とみなすか                   |
| `MOMOCHARI_RAMEN_DISPLAY_SEC`   | 15             | 計測結果を何秒出しておくか                          |
| `MOMOCHARI_MOVE_THRESHOLD_M`    | 5              | 何 m 動いたら地図を描き直すか（大きいほど軽い）     |

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

| 症状                                        | 確認すること                                                                                                                                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 文字が全部 □□□                              | `sudo apt install fonts-noto-cjk`                                                                                                                                                                                          |
| `No module named 'tkinter'`                 | `sudo apt install python3-tk`                                                                                                                                                                                              |
| 地図が背景色のまま                          | タイル未取得。`tools/download_tiles.py` を実行して `tiles/` を送る                                                                                                                                                         |
| 地図が "Access blocked" だらけ              | OSM のタイルを掴んでいる。`tiles/` を消して取り直す（今は地理院タイルを使う設定）                                                                                                                                          |
| ウィンドウが真っ黒（Mac のみ）              | Apple 同梱の Tk 8.5.9 は今の macOS で描画できない。`brew install python-tk@3.14` を入れ `python3.14` で起動                                                                                                                |
| 「GPS を待っています…」から進まない         | `cat /run/momochari/gps.json` で `ts` が毎秒変わっているか確認。変わっていなければセンサー側の問題（[docs/device-app.md](../../docs/device-app.md)）                                                                       |
| 「お店の一覧を取得中…」から進まない         | ネットに繋がっているか。`curl https://momochari-ramen.vercel.app/api/shops`                                                                                                                                                |
| 計測結果が出ない                            | `cat /run/momochari/ramen.json` に `ts` が入っているか。無いと無視されます                                                                                                                                                 |
| 動きがカクカク                              | 画面の解像度が高すぎる。`cmdline.txt` の `video=...1280x720M@60,rotate=90` で落とす。`MOMOCHARI_MOVE_THRESHOLD_M` を大きくするのも効く                                                                                     |
| 黒画面とログが繰り返し流れるループ          | `.xinitrc` が起動するものが即終了している。`sudo systemctl stop getty@tty1.service` で止めて `/tmp/mapapp.log` を読む。最多の原因は `run.sh` が無いこと（アプリを取り直す）                                                |
| 物理画面に `Please enter new username:`     | 初回セットアップウィザードが tty1 を占有している。**ユーザー名を入力しないこと**（`/home/pi` のパスが壊れます）。`sudo systemctl disable --now userconfig.service` のあと `sudo systemctl enable --now getty@tty1.service` |
| 自動ログインしない（画面が止まる）          | `systemctl is-enabled getty@tty1.service` が `disabled` なら `sudo systemctl enable --now getty@tty1.service`                                                                                                              |
| 自動起動しないが手動なら動く                | `~/.xinitrc` と `~/.bash_profile` があるか。`ls -l ~/.xinitrc ~/.bash_profile`                                                                                                                                             |
| `Cannot open /dev/tty0 (Permission denied)` | SSH から `startx` している。`xserver-xorg-legacy` を入れて `/etc/X11/Xwrapper.config` を設定（セットアップ手順1を参照）                                                                                                    |
| 画面が横向きのまま                          | `x11-xserver-utils`（`xrandr`）が入っているか。向きが逆なら `MOMOCHARI_ROTATE=right`                                                                                                                                       |
| ウィンドウの周りに黒い余白                  | 古い版を使っている。`curl` で取り直す（今の版は画面サイズを自動判定します）                                                                                                                                                |
| しばらくすると画面が消える                  | `~/.xinitrc` の `xset s off` `xset -dpms`                                                                                                                                                                                  |

### それでも遅いとき

`mapview.py` を pygame 版に差し替えます。X すら不要になり、
タイル画像を直接貼るだけになるので大幅に軽くなります。
`app.py` は `MapView.render()` しか呼んでいないので、
同じ形のクラスを作れば載せ替えられます。

## 関連ドキュメント

- [`docs/device-app.md`](../../docs/device-app.md) — センサー側プログラムへのお願い（受け渡し仕様）
- [`docs/api.md`](../../docs/api.md) — Web API の仕様
