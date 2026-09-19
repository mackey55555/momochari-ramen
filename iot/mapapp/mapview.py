"""
地図の描画だけを担当する部分。

=== なぜ地図ライブラリを使わないのか ===

tkintermapview のような既成のウィジェットもありますが、使っていません。

  1. このアプリの地図は **常に自分が中央** で、ドラッグもズーム操作もしない。
     汎用ライブラリの機能の大半が不要で、代わりに裏でタイル読み込みスレッドが
     動くぶん、Zero W では損になる。
  2. Tk 8.6 の PhotoImage は PNG をそのまま読める。つまり Pillow も要らない。
     結果、このアプリは **Python 標準ライブラリだけで動く**（pip install が一切不要）。
     ラズパイに scp して python app.py で動く、という目標がこれで達成できる。

もし Zero W で描画が遅すぎたら、差し替えるのはこのファイルだけです。
app.py からは render() しか呼んでいないので、pygame 版を同じ形で作れば載せ替えられます。

=== 座標の話 ===

地図タイルは「Web メルカトル」という方式で並んでいます。
ズーム z のとき、世界全体が 2^z × 2^z 枚のタイルに分割されていて、
1 枚が 256×256 ピクセル。つまり世界全体は 256 * 2^z ピクセル四方の 1 枚の絵で、
緯度経度はその絵の中の座標（ワールドピクセル）に変換できます。

あとは「自分のワールドピクセルが画面中央に来るようにずらして描く」だけです。
"""

import math
import os
import tkinter as tk
from collections import OrderedDict
from typing import Dict, List, Optional, Tuple

import config
from shops import Shop

# メルカトル図法は極に近づくと無限に伸びるため、地図として扱える緯度には上限がある。
# この値を超える座標が来ても計算が壊れないように挟み込む。
_MAX_LAT = 85.05112878


def latlng_to_world_px(lat: float, lng: float, zoom: int) -> Tuple[float, float]:
    """緯度経度を、ズーム zoom における世界全体の絵の中のピクセル座標に変換する"""
    world_size = config.TILE_SIZE * (2**zoom)

    x = (lng + 180.0) / 360.0 * world_size

    lat = max(-_MAX_LAT, min(_MAX_LAT, lat))
    lat_rad = math.radians(lat)
    # asinh(tan(φ)) は ln(tan(φ) + sec(φ)) と同じ。メルカトル図法の縦方向の式。
    y = (1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * world_size

    return x, y


class MapView:
    """地図を描く Canvas。使うのは render() だけ。"""

    def __init__(self, parent: tk.Misc, width: int, height: int):
        self.width = width
        self.height = height
        self.zoom = config.ZOOM

        self.canvas = tk.Canvas(
            parent,
            width=width,
            height=height,
            # タイルが無い場所の色。OpenStreetMap の地の色に近いグレーにして、
            # 「タイルが抜けている」のが不自然に目立たないようにする。
            bg="#e8e6e1",
            highlightthickness=0,
        )

        # 読み込んだタイル画像を持っておく。
        #
        # Tk の PhotoImage は、Python 側が参照を持っていないと勝手に捨てられて
        # 画像が真っ白になるという有名な落とし穴があるので、必ずここで抱えておく。
        # OrderedDict にしているのは、古いものから捨てる（LRU）ため。
        self._tiles: "OrderedDict[Tuple[int, int, int], tk.PhotoImage]" = OrderedDict()

        # 見つからなかったタイルを覚えておく。
        # 毎回 os.path.exists を呼ぶより、1 回調べて覚えておくほうが速い。
        self._missing: Dict[Tuple[int, int, int], bool] = {}

    # ------------------------------------------------------------
    # タイルの読み込み
    # ------------------------------------------------------------

    def _tile_image(self, tx: int, ty: int) -> Optional[tk.PhotoImage]:
        """タイル 1 枚を読む。無ければ None（その場所は背景色のまま）"""
        key = (self.zoom, tx, ty)

        cached = self._tiles.get(key)
        if cached is not None:
            # 使ったものを末尾に移す = 「最近使った」印。先頭から捨てれば LRU になる。
            self._tiles.move_to_end(key)
            return cached

        if key in self._missing:
            return None

        path = os.path.join(config.TILE_DIR, str(self.zoom), str(tx), f"{ty}.png")
        if not os.path.exists(path):
            self._missing[key] = True
            return None

        try:
            image = tk.PhotoImage(file=path, master=self.canvas)
        except tk.TclError:
            # PNG が壊れている場合。1 枚のせいで地図全体を諦める必要はない。
            self._missing[key] = True
            return None

        self._tiles[key] = image

        # 上限を超えたぶんは古いものから捨てる。
        # 画面に出ている枚数（20 枚前後）より上限のほうがずっと大きいので、
        # 「今表示中の画像を捨ててしまう」ことは起きない。
        while len(self._tiles) > config.TILE_CACHE_SIZE:
            self._tiles.popitem(last=False)

        return image

    # ------------------------------------------------------------
    # 描画
    # ------------------------------------------------------------

    def render(
        self,
        lat: float,
        lng: float,
        shop_list: List[Shop],
        highlight_id: Optional[str] = None,
        gps_fresh: bool = True,
    ) -> None:
        """
        自分の位置を中央にして地図を描き直す。

        毎回まるごと消して描き直しています。タイル画像はキャッシュ済みなので
        実際の作業は Canvas の図形を作り直すだけで、20 枚 + ピン数十個なら
        Zero W でもこの頻度（動いたときだけ）なら十分間に合います。

        もし遅ければ、次の一手は「消さずに coords() で位置だけ動かす」です。
        """
        canvas = self.canvas
        canvas.delete("all")

        center_x, center_y = latlng_to_world_px(lat, lng, self.zoom)

        # 画面左上の角が、世界の絵のどのピクセルにあたるか。
        # これを引けば ワールドピクセル → 画面ピクセル に変換できる。
        origin_x = center_x - self.width / 2
        origin_y = center_y - self.height / 2

        self._draw_tiles(origin_x, origin_y)
        self._draw_shops(shop_list, origin_x, origin_y, highlight_id)
        self._draw_self(gps_fresh)
        self._draw_attribution()

    def _draw_tiles(self, origin_x: float, origin_y: float) -> None:
        size = config.TILE_SIZE
        max_tile = 2**self.zoom - 1

        # 画面に掛かるタイルの範囲を出す。
        # 左上の角が含まれるタイルから、右下の角が含まれるタイルまで。
        first_tx = int(math.floor(origin_x / size))
        first_ty = int(math.floor(origin_y / size))
        last_tx = int(math.floor((origin_x + self.width) / size))
        last_ty = int(math.floor((origin_y + self.height) / size))

        for tx in range(first_tx, last_tx + 1):
            for ty in range(first_ty, last_ty + 1):
                # 世界の端より外は存在しないので飛ばす
                if not (0 <= tx <= max_tile and 0 <= ty <= max_tile):
                    continue

                image = self._tile_image(tx, ty)
                if image is None:
                    continue

                screen_x = tx * size - origin_x
                screen_y = ty * size - origin_y
                self.canvas.create_image(screen_x, screen_y, image=image, anchor="nw")

    def _draw_shops(
        self,
        shop_list: List[Shop],
        origin_x: float,
        origin_y: float,
        highlight_id: Optional[str],
    ) -> None:
        for shop in shop_list:
            world_x, world_y = latlng_to_world_px(shop.lat, shop.lng, self.zoom)
            x = world_x - origin_x
            y = world_y - origin_y

            # 画面の外にある店は描かない。
            # 少しはみ出す程度なら描いておきたいので余白を取る。
            margin = 40
            if not (-margin <= x <= self.width + margin):
                continue
            if not (-margin <= y <= self.height + margin):
                continue

            is_target = shop.id == highlight_id
            radius = 18 if is_target else 12

            # 味の傾向で色分け。色は Web 側（lib/taste.ts）が決めた値をそのまま使うので、
            # 地図アプリと Web サイトでピンの色が必ず一致する。
            self.canvas.create_oval(
                x - radius,
                y - radius,
                x + radius,
                y + radius,
                fill=shop.taste_color,
                outline="#ffffff",
                width=3,
            )

            # 下部パネルに出ている店だけ、地図の上でも名前を出す。
            # 全店に名前を付けると重なって読めなくなるので、1 件だけにしている。
            if is_target:
                self.canvas.create_text(
                    x,
                    y + radius + 14,
                    text=shop.name,
                    fill="#111111",
                    font=(config.FONT_FAMILY, 14, "bold"),
                    anchor="n",
                )

    def _draw_self(self, gps_fresh: bool) -> None:
        """自分の位置。地図が動くので、これは常に画面のど真ん中に描く"""
        x = self.width / 2
        y = self.height / 2

        # GPS が新しいときは青、見失っているときは灰色。
        # 「今の位置なのか、さっきの位置なのか」がひと目で分かるようにするため。
        color = "#2563eb" if gps_fresh else "#9ca3af"

        self.canvas.create_oval(x - 16, y - 16, x + 16, y + 16, fill="#ffffff", outline="")
        self.canvas.create_oval(x - 11, y - 11, x + 11, y + 11, fill=color, outline="")

    def _draw_attribution(self) -> None:
        """地理院タイルを使う条件として、出典の表示が必要（消さないこと）"""
        self.canvas.create_text(
            self.width - 6,
            self.height - 6,
            text=config.TILE_ATTRIBUTION,
            fill="#555555",
            font=(config.FONT_FAMILY, 10),
            anchor="se",
        )
