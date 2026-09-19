"""
お店の情報を Web API から取ってくる部分と、距離の計算。

    GET https://momochari-ramen.vercel.app/api/shops

味の傾向（濃厚 / ふつう / あっさり）の判定は Web 側でやってもらっていて、
ここでは受け取ったラベルと色をそのまま使います。しきい値をこちらにコピーすると、
Web 側で調整したときに必ず食い違うためです（app/api/shops/route.ts のコメント参照）。

=== 「近くのお店」は必ずこちら側で計算する ===

毎秒 API に「今の近くの店を教えて」と聞く作りにはしていません。
圏外に入った瞬間に画面が死ぬからです。お店は数十件しかないので、
起動時に全件もらってメモリに置き、距離計算は手元でやるほうが速くて確実です。
"""

import json
import math
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import List, Optional, Tuple

import config


@dataclass
class Shop:
    id: str
    name: str
    style: Optional[str]
    address: Optional[str]
    lat: float
    lng: float
    # ここから下は Web 側が判定してくれた表示用の値
    taste_label: str
    taste_color: str
    taste_count: int
    avg_salinity_pct: Optional[float]
    avg_richness_mv: Optional[float]


def _to_shop(raw: dict) -> Optional[Shop]:
    """API のレスポンス 1 件を Shop にする。おかしければ None（その店だけ捨てる）"""
    lat = raw.get("lat")
    lng = raw.get("lng")
    if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
        # 座標が無いお店は地図に置けないので捨てる。
        # 1 件おかしいだけで全件ダメにしないよう、ここで個別に弾く。
        return None

    taste = raw.get("taste") or {}
    return Shop(
        id=str(raw.get("id", "")),
        name=str(raw.get("name", "名前なし")),
        style=raw.get("style"),
        address=raw.get("address"),
        lat=float(lat),
        lng=float(lng),
        taste_label=str(taste.get("label", "計測なし")),
        taste_color=str(taste.get("color", "#9ca3af")),
        taste_count=int(taste.get("count") or 0),
        avg_salinity_pct=taste.get("avg_salinity_pct"),
        avg_richness_mv=taste.get("avg_richness_mv"),
    )


def _parse(payload: dict) -> List[Shop]:
    raw_shops = payload.get("shops")
    if not isinstance(raw_shops, list):
        return []
    shops = [_to_shop(raw) for raw in raw_shops if isinstance(raw, dict)]
    return [shop for shop in shops if shop is not None]


def fetch_shops() -> List[Shop]:
    """
    API からお店の一覧を取ってくる。通信するので、必ず別スレッドから呼ぶこと。

    Tk は「画面を触るのは常にメインスレッドだけ」という決まりなので、
    ここでは画面に一切触りません。結果は呼び出し側がキューでメインスレッドに渡します。

    失敗したら例外を投げます（呼び出し側で握りつぶして、前回のキャッシュを使い続ける）。
    """
    url = f"{config.API_BASE}/api/shops"
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "momochari-mapapp/1.0"},
    )
    with urllib.request.urlopen(request, timeout=config.API_TIMEOUT_SEC) as response:
        body = response.read().decode("utf-8")

    payload = json.loads(body)
    shops = _parse(payload)

    # 取れたときだけキャッシュを更新する。
    # 「0 件が返ってきた」場合も上書きしてしまうと、次の起動でお店が消えるので、
    # 中身があるときだけ保存する。
    if shops:
        _save_cache(body)
    return shops


def _save_cache(body: str) -> None:
    """次の起動で圏外でもお店を出せるように、取得結果をそのまま保存しておく"""
    try:
        tmp = config.SHOPS_CACHE_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(body)
        # 書きかけのファイルを次回読んでしまわないよう、原子的に差し替える
        os.replace(tmp, config.SHOPS_CACHE_FILE)
    except OSError:
        # キャッシュが保存できなくてもアプリは動く。黙って諦める。
        pass


def load_cache() -> List[Shop]:
    """前回保存したお店一覧を読む。無ければ空リスト"""
    try:
        with open(config.SHOPS_CACHE_FILE, "r", encoding="utf-8") as f:
            payload = json.load(f)
    except (OSError, ValueError):
        return []
    return _parse(payload) if isinstance(payload, dict) else []


# ============================================================
# 距離の計算
# ============================================================

_EARTH_RADIUS_M = 6371000.0


def distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    2 点間の距離をメートルで返す（ハーバサインの公式）。

    地球を球とみなす簡易計算ですが、数キロの範囲なら誤差は数メートル以下なので
    「近くのお店はどれか」の用途には十分です。
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)

    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return 2 * _EARTH_RADIUS_M * math.asin(math.sqrt(a))


def nearest(
    shop_list: List[Shop], lat: float, lng: float
) -> Tuple[Optional[Shop], float]:
    """
    一番近いお店と、そこまでの距離（メートル）を返す。

    NEAREST_MAX_M より遠い場合は (None, 距離) を返します。
    遠く離れた店を「近くのお店」として出し続けても意味がないためです。
    """
    best: Optional[Shop] = None
    best_distance = float("inf")

    for shop in shop_list:
        d = distance_m(lat, lng, shop.lat, shop.lng)
        if d < best_distance:
            best = shop
            best_distance = d

    if best is None or best_distance > config.NEAREST_MAX_M:
        return None, best_distance
    return best, best_distance


def format_distance(meters: float) -> str:
    """距離を読みやすくする。1km 未満は m、それ以上は km"""
    if meters < 1000:
        return f"{int(round(meters))}m"
    return f"{meters / 1000:.1f}km"
