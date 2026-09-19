"""
地図タイルを事前にダウンロードしておくツール。

=== なぜ事前に落とすのか ===

走りながらネット越しにタイルを取ると、圏外に入った瞬間に地図が真っ白になります。
ラーメン屋は路地裏にもあるので、電波が怪しい場所ほど地図が欲しい。
だから岡山エリアぶんを先に落として、SD カードに入れておきます。

=== どこから落としているか ===

**地理院タイル（国土地理院）** です。OpenStreetMap ではありません。

OSM のタイルサーバーはボランティアが運営していて、利用ポリシーで
「まとめてダウンロードすること」自体が禁止されています。
このアプリは圏外対策で事前に落とす必要があるので、そもそも用途が合いません
（実際に試すとブロックされ、全部 "Access blocked" の画像が降ってきます）。

地理院タイルは国土地理院が提供している日本全国の地図で、API キー不要、
出典を表示すれば手元に保存して使えます。日本の地図なので地名も日本語です。

  利用規約: https://maps.gsi.go.jp/development/ichiran.html

出典表示（「出典: 国土地理院」）は地図の右下に出しています。消さないでください。

=== 使い方 ===

    # 手元の Mac で実行する（ラズパイでやると遅い）
    python3 tools/download_tiles.py

    # 範囲やズームを変えたいとき
    python3 tools/download_tiles.py --zoom 15 17 --bbox 34.62 133.85 34.72 133.98

落ちたら tiles/ ごとラズパイに送る:

    scp -r tiles pi@raspi.local:~/momochari/mapapp/
"""

import argparse
import hashlib
import math
import os
import sys
import time
import urllib.error
import urllib.request
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config  # noqa: E402

# 誰がアクセスしているか分かるようにしておく（サーバー運営側への礼儀）
USER_AGENT = (
    "momochari-ramen/1.0 (https://github.com/mackey55555/momochari-ramen)"
)

# 1 枚ごとの待ち時間（秒）。相手のサーバーへの配慮なので、短くしないこと。
SLEEP_SEC = 0.2

# 岡山駅を中心にした、だいたい 10km 四方
DEFAULT_BBOX = (34.60, 133.85, 34.73, 134.00)  # (南, 西, 北, 東)


def latlng_to_tile(lat: float, lng: float, zoom: int):
    """緯度経度が、ズーム zoom のどのタイルに入るか"""
    n = 2**zoom
    x = int((lng + 180.0) / 360.0 * n)
    lat_rad = math.radians(max(-85.05112878, min(85.05112878, lat)))
    y = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return x, y


def tile_range(bbox, zoom):
    """緯度経度の範囲を、タイル番号の範囲に直す"""
    south, west, north, east = bbox
    # タイルの y 番号は北が小さいので、北の緯度から始まる
    x_min, y_min = latlng_to_tile(north, west, zoom)
    x_max, y_max = latlng_to_tile(south, east, zoom)
    return x_min, x_max, y_min, y_max


def tile_path(zoom: int, x: int, y: int) -> str:
    return os.path.join(config.TILE_DIR, str(zoom), str(x), f"{y}.png")


def warn_if_all_same(hashes) -> None:
    """
    落としたタイルが全部同じ画像になっていないか確かめる。

    サーバーにブロックされたときは、エラーを返さずに「アクセスできません」と
    書かれた同じ画像が全タイルぶん降ってくることがあります。
    HTTP は 200 なので失敗として検出できず、地図が出せていないことに
    ラズパイに載せるまで気づけません。同じ絵ばかりなら、ここで警告します。
    """
    if len(hashes) < 5:
        return

    most_common, count = Counter(hashes).most_common(1)[0]
    if count / len(hashes) < 0.5:
        return

    print()
    print("!" * 60)
    print(f"警告: 落としたタイルの {count}/{len(hashes)} 枚が同じ画像です。")
    print("地図ではなくエラー画像を掴まされている可能性が高いです。")
    print("tiles/ の中の PNG を 1 枚開いて確かめてください。")
    print("エラー画像だった場合は tiles/ をまるごと消してから、")
    print("しばらく時間を空けて試すか、config.py の TILE_URL を見直してください。")
    print("!" * 60)


def download(bbox, zooms) -> None:
    jobs = []
    for zoom in zooms:
        x_min, x_max, y_min, y_max = tile_range(bbox, zoom)
        for x in range(x_min, x_max + 1):
            for y in range(y_min, y_max + 1):
                jobs.append((zoom, x, y))

    # すでに持っているものは飛ばす。途中で止めても、もう一度流せば続きから進む。
    todo = [job for job in jobs if not os.path.exists(tile_path(*job))]

    print(f"取得元      : {config.TILE_URL}")
    print(f"必要なタイル: {len(jobs)} 枚（うち未取得 {len(todo)} 枚）")
    print(f"保存先      : {config.TILE_DIR}")
    # 1 枚 20KB 前後。SD カードの残りが心配なときの目安に。
    print(f"想定サイズ  : およそ {len(jobs) * 20 / 1024:.0f} MB")
    print(f"想定時間    : およそ {len(todo) * SLEEP_SEC / 60:.0f} 分")

    if not todo:
        print("すべて取得済みです")
        return

    if input("ダウンロードしますか？ [y/N] ").strip().lower() != "y":
        print("中止しました")
        return

    failed = 0
    hashes = []

    for index, (zoom, x, y) in enumerate(todo, start=1):
        url = config.TILE_URL.format(z=zoom, x=x, y=y)
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                body = response.read()
        except (urllib.error.URLError, OSError) as error:
            failed += 1
            print(f"  失敗 z{zoom}/{x}/{y}: {error}")
            continue

        path = tile_path(zoom, x, y)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        # 書きかけのファイルが残らないよう、ここでも一時ファイル経由で置く
        tmp = path + ".tmp"
        with open(tmp, "wb") as f:
            f.write(body)
        os.replace(tmp, path)

        hashes.append(hashlib.md5(body).hexdigest())

        if index % 50 == 0 or index == len(todo):
            print(f"  {index}/{len(todo)} 枚")

        time.sleep(SLEEP_SEC)

    print(f"完了（失敗 {failed} 枚）")
    if failed:
        print("もう一度実行すると、失敗したぶんだけ取り直します")

    warn_if_all_same(hashes)


def main() -> None:
    parser = argparse.ArgumentParser(description="地図タイルを事前にダウンロードする")
    parser.add_argument(
        "--zoom",
        nargs=2,
        type=int,
        default=[config.ZOOM - 1, config.ZOOM + 1],
        metavar=("最小", "最大"),
        help="落とすズームの範囲（既定は config.ZOOM の前後 1）",
    )
    parser.add_argument(
        "--bbox",
        nargs=4,
        type=float,
        default=list(DEFAULT_BBOX),
        metavar=("南", "西", "北", "東"),
        help="落とす範囲の緯度経度（既定は岡山市中心部）",
    )
    args = parser.parse_args()

    zooms = list(range(args.zoom[0], args.zoom[1] + 1))
    download(tuple(args.bbox), zooms)


if __name__ == "__main__":
    main()
