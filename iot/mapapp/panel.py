"""
画面下部のパネル。

出すものは 3 通りあって、**枠は 1 つを取り合います**。優先順位は上から順に:

  1. ラーメンの計測結果   … 塩分センサーのプログラムから届いた文字列（15 秒間）
  2. 近くのお店の詳細     … Web の詳細パネルと同じ情報
  3. お知らせ             … 「GPS 取得中…」など

画面を増やさずに全部さばくための作りです。計測した瞬間に結果が出て、
しばらくすると勝手に「近くのお店」に戻ります。

Tk の作法として、3 つぶんのウィジェットは最初に作っておいて、
表示するときに pack / 隠すときに pack_forget で出し入れしています。
毎回ウィジェットを作り直すより速く、Zero W では効きます。
"""

import tkinter as tk
from typing import Optional

import config
from shops import Shop, format_distance

# 色。Web 側の見た目（Tailwind の gray 系）にだいたい合わせてある。
BG = "#ffffff"
BG_RAMEN = "#fff7ed"  # 計測結果のときだけ背景を変えて、違うものだと分かるようにする
FG_MAIN = "#111827"
FG_SUB = "#6b7280"


class Panel:
    def __init__(self, parent: tk.Misc, width: int, height: int):
        self.width = width
        self.height = height

        # 720px 幅を基準に文字の大きさを決める。
        # 解像度を変えたときに、文字だけ極端に小さく（大きく）ならないようにするため。
        self._scale = width / 720.0

        self.frame = tk.Frame(parent, bg=BG, width=width, height=height)
        # これを入れないと、中の文字の量に合わせて枠の高さが勝手に変わってしまう。
        # 地図とパネルの境目が動くと目障りなので、高さを固定する。
        self.frame.pack_propagate(False)

        self._build_shop()
        self._build_ramen()
        self._build_message()

        self._current: Optional[tk.Frame] = None

    def _font(self, size: int, bold: bool = False) -> tuple:
        return (
            config.FONT_FAMILY,
            max(9, int(size * self._scale)),
            "bold" if bold else "normal",
        )

    def _pad(self) -> int:
        return int(20 * self._scale)

    # ------------------------------------------------------------
    # 「近くのお店」表示
    # ------------------------------------------------------------

    def _build_shop(self) -> None:
        frame = tk.Frame(self.frame, bg=BG)
        pad = self._pad()

        # 1 行目: 店名と距離。距離は右端に寄せる。
        header = tk.Frame(frame, bg=BG)
        header.pack(fill="x", padx=pad, pady=(pad, 0))

        self._shop_name = tk.Label(
            header,
            text="",
            font=self._font(34, bold=True),
            bg=BG,
            fg=FG_MAIN,
            anchor="w",
            justify="left",
        )
        self._shop_name.pack(side="left", fill="x", expand=True)

        self._shop_distance = tk.Label(
            header,
            text="",
            font=self._font(30, bold=True),
            bg=BG,
            fg="#2563eb",
            anchor="e",
        )
        self._shop_distance.pack(side="right", padx=(pad, 0))

        # 2 行目: ジャンルと住所（Web の詳細パネルと同じ並び）
        self._shop_sub = tk.Label(
            frame,
            text="",
            font=self._font(18),
            bg=BG,
            fg=FG_SUB,
            anchor="w",
            justify="left",
            wraplength=self.width - pad * 2,
        )
        self._shop_sub.pack(fill="x", padx=pad, pady=(int(6 * self._scale), 0))

        # 3 行目: 味の傾向。色は Web 側が返してきた値をそのまま使うので、
        # 地図のピンの色・Web サイトの表示と必ず一致する。
        self._shop_taste = tk.Label(
            frame,
            text="",
            font=self._font(30, bold=True),
            bg=BG,
            anchor="w",
        )
        self._shop_taste.pack(fill="x", padx=pad, pady=(int(12 * self._scale), 0))

        # 4 行目: 計測のまとめ
        self._shop_detail = tk.Label(
            frame,
            text="",
            font=self._font(18),
            bg=BG,
            fg=FG_SUB,
            anchor="w",
            justify="left",
            wraplength=self.width - pad * 2,
        )
        self._shop_detail.pack(fill="x", padx=pad, pady=(int(4 * self._scale), 0))

        self._shop_frame = frame

    def show_shop(self, shop: Shop, distance: float) -> None:
        self._shop_name.config(text=f"🍜 {shop.name}")
        self._shop_distance.config(text=format_distance(distance))

        parts = [shop.style or "その他"]
        if shop.address:
            parts.append(shop.address)
        self._shop_sub.config(text=" ・ ".join(parts))

        self._shop_taste.config(text=shop.taste_label, fg=shop.taste_color)

        if shop.taste_count > 0:
            detail = [f"計測 {shop.taste_count}回"]
            if shop.avg_salinity_pct is not None:
                detail.append(f"塩分の平均 {shop.avg_salinity_pct}%")
            if shop.avg_richness_mv is not None:
                detail.append(f"こってり度の平均 {int(shop.avg_richness_mv)}mV")
            self._shop_detail.config(text=" ／ ".join(detail))
        else:
            self._shop_detail.config(text="まだ使える計測がありません")

        self._switch_to(self._shop_frame)

    # ------------------------------------------------------------
    # 「ラーメンの計測結果」表示
    # ------------------------------------------------------------

    def _build_ramen(self) -> None:
        frame = tk.Frame(self.frame, bg=BG_RAMEN)
        pad = self._pad()

        tk.Label(
            frame,
            text="📊 計測結果",
            font=self._font(20, bold=True),
            bg=BG_RAMEN,
            fg=FG_SUB,
            anchor="w",
        ).pack(fill="x", padx=pad, pady=(pad, 0))

        # 届いた文字列をそのまま出す。
        # 「美味しい / 美味しくない」の判定は塩分センサー側のプログラムの仕事で、
        # こちらは中身を解釈しません。文言が変わってもこのアプリの修正は不要です。
        self._ramen_text = tk.Label(
            frame,
            text="",
            font=self._font(40, bold=True),
            bg=BG_RAMEN,
            fg=FG_MAIN,
            anchor="w",
            justify="left",
            wraplength=self.width - pad * 2,
        )
        self._ramen_text.pack(fill="x", padx=pad, pady=(int(10 * self._scale), 0))

        self._ramen_frame = frame

    def show_ramen(self, text: str) -> None:
        self._ramen_text.config(text=text)
        self._switch_to(self._ramen_frame)

    # ------------------------------------------------------------
    # 「お知らせ」表示
    # ------------------------------------------------------------

    def _build_message(self) -> None:
        frame = tk.Frame(self.frame, bg=BG)
        self._message_label = tk.Label(
            frame,
            text="",
            font=self._font(24),
            bg=BG,
            fg=FG_SUB,
            justify="center",
            wraplength=self.width - self._pad() * 2,
        )
        # expand=True で枠の中央に置く。お知らせは短いので中央のほうが収まりがいい。
        self._message_label.pack(expand=True)
        self._message_frame = frame

    def show_message(self, text: str) -> None:
        self._message_label.config(text=text)
        self._switch_to(self._message_frame)

    # ------------------------------------------------------------

    def _switch_to(self, frame: tk.Frame) -> None:
        """表示するものを切り替える。すでに出ていれば何もしない（ちらつき防止）"""
        if self._current is frame:
            return
        if self._current is not None:
            self._current.pack_forget()
        frame.pack(fill="both", expand=True)
        self._current = frame
