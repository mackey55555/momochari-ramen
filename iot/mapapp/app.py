"""
ラズパイの画面に出す地図アプリ。

    python3 app.py

=== このアプリがやること ===

  ・自分を中心にした地図を出す（自分は常に画面の真ん中、地図のほうが動く）
  ・一番近いラーメン屋の詳細を画面下部に出す
  ・ラーメンの計測結果が届いたら、画面下部に 15 秒だけ割り込みで出す

=== このアプリがやらないこと ===

  ・センサーを読むこと
  ・「美味しいかどうか」を判定すること
  ・味の傾向（濃厚 / ふつう / あっさり）を計算すること

センサーはすでに動いている別のプログラムが読んでいて、結果を JSON ファイルに
書いてくれます（docs/device-app.md）。味の判定は Web 側の API がやります。
このアプリは **受け取って表示するだけ** です。

こう切り分けてあるので、センサー側のプログラムが落ちても地図は出続けますし、
逆にこのアプリが落ちても API への送信は止まりません。
"""

import os
import queue
import sys
import threading
import time
import tkinter as tk
from typing import List, Optional, Tuple

import config
import handoff
import shops
from mapview import MapView
from panel import Panel


class App:
    def __init__(self) -> None:
        self.root = tk.Tk()
        self.root.title("momochari-ramen")
        self.root.configure(bg="#000000")

        # ウィンドウマネージャを入れない構成（Raspberry Pi OS Lite + xinit）では
        # 装飾が無いので、画面サイズちょうどの geometry を指定すれば全画面になる。
        self.root.geometry(f"{config.SCREEN_WIDTH}x{config.SCREEN_HEIGHT}+0+0")
        if config.FULLSCREEN:
            try:
                # デスクトップ環境や Mac で試すときのため。
                # ウィンドウマネージャがいない環境では無視されるだけなので、失敗しても構わない。
                self.root.attributes("-fullscreen", True)
            except tk.TclError:
                pass

        # 全画面にすると閉じるボタンが無くなるので、逃げ道を用意しておく。
        # 現地でキーボードを挿したときにこれが無いと詰む。
        self.root.bind("<Escape>", lambda _event: self.root.destroy())

        map_height = int(config.SCREEN_HEIGHT * config.MAP_RATIO)
        panel_height = config.SCREEN_HEIGHT - map_height

        self.mapview = MapView(self.root, config.SCREEN_WIDTH, map_height)
        self.mapview.canvas.pack(side="top")

        self.panel = Panel(self.root, config.SCREEN_WIDTH, panel_height)
        self.panel.frame.pack(side="bottom", fill="both", expand=True)

        # --- お店の一覧 ---------------------------------------------
        # 前回保存したものをまず読む。圏外で起動しても、いきなりお店を出せる。
        self.shop_list: List[shops.Shop] = shops.load_cache()
        self._shops_dirty = True
        self._fetching = False
        self._last_fetch_at = 0.0
        # 別スレッドの取得結果を受け取る箱。
        # Tk は「画面を触るのはメインスレッドだけ」という決まりなので、
        # 取得スレッドから直接 Label を書き換えてはいけない。必ずここを経由する。
        self._fetch_result: "queue.Queue" = queue.Queue()

        # --- 位置 ---------------------------------------------------
        # 最後に測位できた位置。GPS を見失っても、ここを使って地図を出し続ける。
        self._last_fix: Optional[Tuple[float, float]] = None
        # 前回地図を描いたときの状態。変化が無ければ描き直さない（Zero W 対策）。
        self._rendered: Optional[tuple] = None

        # --- ラーメンの計測結果 --------------------------------------
        self._ramen_text = ""
        self._ramen_until = 0.0
        self._seen_ramen_ts = self._initial_ramen_ts()

        self._print_startup_info()

    # ------------------------------------------------------------
    # 起動時の準備
    # ------------------------------------------------------------

    def _initial_ramen_ts(self) -> Optional[str]:
        """
        起動した時点で ramen.json に残っている計測を「見たこと済み」にするかどうか。

        アプリを再起動するたびに、何時間も前に食べたラーメンの判定が
        画面に出てくるのは変なので、基本は既読扱いにします。
        ただし、ついさっき測ったばかり（表示時間内）のものは見せます。
        アプリが落ちて再起動したときに、計測結果が消えてしまわないようにするため。
        """
        ramen = handoff.read_ramen()
        if ramen is None:
            return None
        if ramen.age_sec < config.RAMEN_DISPLAY_SEC:
            return None  # 未読のままにする → 起動直後に表示される
        return ramen.ts

    def _print_startup_info(self) -> None:
        """
        「画面に何も出ない」ときの原因調べを楽にするための起動ログ。

        現地でハマる原因はだいたい次の 3 つなので、起動時に全部出しておく。
          ・受け渡しフォルダのパスが違う / センサー側がまだ起動していない
          ・地図タイルを置き忘れた
          ・お店の一覧をまだ 1 回も取れていない
        """
        print("=" * 60)
        print("momochari-ramen 地図アプリ")
        print("=" * 60)
        print(f"受け渡し : {handoff.describe_handoff_dir()}")
        print(f"地図タイル: {config.TILE_DIR}")

        # Tk が PNG を読めるのは 8.6 から。8.5 だと地図が背景色のままになる。
        # Raspberry Pi OS は 8.6 なので本番では起きないが、
        # 古い環境で試したときに「地図だけ出ない」理由が分からず悩むのを防ぐ。
        if tk.TkVersion < 8.6:
            print("  ※ Tk が 8.6 未満です。PNG を読めないため地図が出ません")
        if not os.path.isdir(config.TILE_DIR):
            print("  ※ タイルがありません（tools/download_tiles.py で取得してください）")

        print(f"API      : {config.API_BASE}/api/shops")
        print(f"お店      : キャッシュから {len(self.shop_list)} 件読み込み")
        print("終了するには Esc キー")
        print("=" * 60)
        sys.stdout.flush()

    # ------------------------------------------------------------
    # メインループ（1 秒ごと）
    # ------------------------------------------------------------

    def run(self) -> None:
        self._tick()
        self.root.mainloop()

    def _tick(self) -> None:
        now = time.monotonic()

        self._drain_fetch_result()
        self._maybe_fetch_shops(now)

        gps = handoff.read_gps()
        position, is_fresh = self._resolve_position(gps)

        nearest_shop, distance = (None, float("inf"))
        if position is not None and self.shop_list:
            nearest_shop, distance = shops.nearest(
                self.shop_list, position[0], position[1]
            )

        self._update_map(position, is_fresh, nearest_shop)
        self._update_panel(now, position, nearest_shop, distance)

        # after で自分自身を呼び直すのが Tk の定石。
        # while ループ + sleep にすると画面が固まる（Tk がイベントを処理できなくなる）。
        self.root.after(config.TICK_MS, self._tick)

    # ------------------------------------------------------------
    # 位置
    # ------------------------------------------------------------

    def _resolve_position(
        self, gps: Optional[handoff.Gps]
    ) -> Tuple[Optional[Tuple[float, float]], bool]:
        """
        今どこを地図の中心にするかを決める。戻り値は (位置, GPS が新しいか)。

        トンネルやビルの谷間で GPS を見失うのは日常茶飯事なので、
        そのたびに地図が消えないよう、最後に測位できた位置を使い続けます。
        「今の位置なのか、さっきの位置なのか」は自分マーカーの色で示します。
        """
        if gps is not None and gps.is_fresh:
            self._last_fix = (gps.lat, gps.lng)
            return self._last_fix, True

        if self._last_fix is not None:
            return self._last_fix, False

        # 一度も測位できていない。地図だけでも出しておく。
        return (config.FALLBACK_LAT, config.FALLBACK_LNG), False

    def _update_map(
        self,
        position: Optional[Tuple[float, float]],
        is_fresh: bool,
        nearest_shop: Optional[shops.Shop],
    ) -> None:
        if position is None:
            return

        lat, lng = position
        highlight_id = nearest_shop.id if nearest_shop else None

        # 描き直す必要があるかを判断する。
        #
        # GPS は止まっていても値が数メートル揺れるので、毎秒描き直すと
        # 画面がプルプルするうえ CPU を食う。信号待ちの間は何もしないのが正解。
        if self._rendered is not None:
            prev_lat, prev_lng, prev_fresh, prev_highlight, prev_dirty = self._rendered
            moved = shops.distance_m(prev_lat, prev_lng, lat, lng)
            unchanged = (
                moved < config.MOVE_THRESHOLD_M
                and prev_fresh == is_fresh
                and prev_highlight == highlight_id
                and prev_dirty == self._shops_dirty
            )
            if unchanged:
                return

        self.mapview.render(
            lat,
            lng,
            self.shop_list,
            highlight_id=highlight_id,
            gps_fresh=is_fresh,
        )
        self._rendered = (lat, lng, is_fresh, highlight_id, self._shops_dirty)
        self._shops_dirty = False

    # ------------------------------------------------------------
    # 画面下部
    # ------------------------------------------------------------

    def _update_panel(
        self,
        now: float,
        position: Optional[Tuple[float, float]],
        nearest_shop: Optional[shops.Shop],
        distance: float,
    ) -> None:
        # --- 1. ラーメンの計測結果が来ていないか見る ---------------------
        ramen = handoff.read_ramen()
        if ramen is not None and ramen.ts != self._seen_ramen_ts:
            # ts が前回と違う ＝ 新しく測った。
            #
            # text の比較ではダメなことに注意。同じ判定（「美味しい！」など）が
            # 2 杯続くと中身が変わらないので、2 杯目に気づけない。
            self._seen_ramen_ts = ramen.ts
            self._ramen_text = ramen.text
            self._ramen_until = now + config.RAMEN_DISPLAY_SEC
            print(f"[ramen] {ramen.text}")
            sys.stdout.flush()

        # --- 2. 優先順位にしたがって出すものを決める ---------------------
        if now < self._ramen_until:
            self.panel.show_ramen(self._ramen_text)
            return

        if self._last_fix is None:
            # まだ一度も測位できていない。屋外でも数十秒〜数分かかるので、
            # これは異常ではなく通常の状態。
            self.panel.show_message("GPS を待っています…")
            return

        if not self.shop_list:
            self.panel.show_message("お店の一覧を取得中…")
            return

        if nearest_shop is None:
            self.panel.show_message("近くにお店がありません")
            return

        self.panel.show_shop(nearest_shop, distance)

    # ------------------------------------------------------------
    # お店の一覧の取得（別スレッド）
    # ------------------------------------------------------------

    def _maybe_fetch_shops(self, now: float) -> None:
        if self._fetching:
            return
        if self._last_fetch_at and now - self._last_fetch_at < config.SHOPS_REFRESH_SEC:
            return

        self._fetching = True
        self._last_fetch_at = now
        # daemon=True にしておくと、通信待ちのままでもアプリを終了できる。
        threading.Thread(target=self._fetch_worker, daemon=True).start()

    def _fetch_worker(self) -> None:
        """別スレッドで動く。ここから画面を触ってはいけない（結果はキューに入れる）"""
        try:
            self._fetch_result.put(shops.fetch_shops())
        except Exception as error:  # noqa: BLE001
            # 通信の失敗の仕方は多岐にわたる（圏外、DNS、タイムアウト、証明書…）。
            # どれが来てもアプリを落としたくないので、まとめて受け止めて
            # メインスレッドに渡し、前回のキャッシュを使い続ける。
            self._fetch_result.put(error)

    def _drain_fetch_result(self) -> None:
        while True:
            try:
                result = self._fetch_result.get_nowait()
            except queue.Empty:
                break

            self._fetching = False

            if isinstance(result, Exception):
                print(f"[shops] 取得に失敗（前回のデータを使い続けます）: {result}")
                sys.stdout.flush()
                continue

            if result:
                self.shop_list = result
                self._shops_dirty = True
                print(f"[shops] {len(result)} 件を取得")
                sys.stdout.flush()


def main() -> None:
    app = App()
    try:
        app.run()
    except KeyboardInterrupt:
        print("\n終了します")


if __name__ == "__main__":
    main()
