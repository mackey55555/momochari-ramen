"""
他のプログラムからデータを受け取る部分。

ラズパイ上ではすでに 2 つのプログラムが動いていて、それぞれが JSON ファイルを
書き出してくれます（仕様は docs/device-app.md）。このファイルはそれを読むだけです。

    /run/momochari/gps.json    … GPS。1 秒ごとに上書きされる
    /run/momochari/ramen.json  … 塩分センサーの判定テキスト。測ったときだけ書かれる

=== このファイルの鉄則 ===

**何があっても例外を投げない。** 読めなければ None を返す。

ファイルがまだ無い / 書きかけ / 中身が壊れている / 時刻の形式が違う、は
全部「普通に起きること」です。ここで例外が出るとアプリごと落ちて、
地図が消えます。GPS が一瞬読めないくらいで画面が死ぬのは論外なので、
判断は呼び出し側（app.py）に任せて、ここでは黙って None を返します。
"""

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

import config


@dataclass
class Gps:
    """GPS の 1 点。age_sec は「この値が何秒前のものか」"""

    lat: float
    lng: float
    age_sec: float

    @property
    def is_fresh(self) -> bool:
        """新しいか。古ければ、地図を動かさず「GPS 取得中」を出す"""
        return self.age_sec <= config.GPS_STALE_SEC


@dataclass
class Ramen:
    """塩分センサーのプログラムから受け取った判定テキスト"""

    text: str
    # 新着かどうかの判定にだけ使う。中身の比較では判定できない（後述）
    ts: str
    age_sec: float


def _parse_iso(text: str) -> Optional[datetime]:
    """
    ISO 8601 の文字列を datetime にする。

    ラズパイ (Raspberry Pi OS Bullseye) の Python は 3.9 で、
    3.9 の fromisoformat は末尾の "Z" を受け付けません（3.11 から対応）。
    書く側は "...Z" で送ってくる想定なので、ここで +00:00 に直してから渡します。
    """
    if not isinstance(text, str) or not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None

    if dt.tzinfo is None:
        # タイムゾーンが付いていない場合は「ラズパイのローカル時刻」とみなす。
        #
        # UTC とみなすほうが仕様には忠実ですが、書く側が日本時間をそのまま
        # 入れていた場合、9 時間前の値に見えて「永遠に GPS ロスト」になります。
        # 原因が分かりにくい壊れ方なので、動くほうに倒しています。
        dt = dt.astimezone()
    return dt


def _read_json(path: str) -> Optional[dict]:
    """JSON ファイルを読む。読めなければ None（例外は投げない）"""
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        # OSError   … ファイルが無い、権限が無い
        # ValueError… JSON として壊れている（JSONDecodeError は ValueError の一種）
        #
        # 書く側が os.replace() を使ってくれていれば「書きかけ」は見えないはずですが、
        # 守ってもらえなかった場合に備えて、ここでも黙って捨てられるようにしておく。
        return None
    return data if isinstance(data, dict) else None


def _age_sec(data: dict) -> Optional[float]:
    """ts から「何秒前の値か」を出す"""
    dt = _parse_iso(data.get("ts", ""))
    if dt is None:
        return None
    age = (datetime.now(timezone.utc) - dt).total_seconds()
    # 書く側とこちらで時刻がわずかにずれると未来の値に見えることがある。
    # 「未来 ＝ 今できたばかり」なので 0 に丸める。
    return max(0.0, age)


def read_gps() -> Optional[Gps]:
    """gps.json を読む。読めない・中身が足りないときは None"""
    data = _read_json(config.GPS_FILE)
    if data is None:
        return None

    lat = data.get("lat")
    lng = data.get("lng")
    # bool は int の一種なので isinstance(True, (int, float)) が True になってしまう。
    # 座標に True が入ることはまず無いが、弾いておいて損はない。
    if not isinstance(lat, (int, float)) or isinstance(lat, bool):
        return None
    if not isinstance(lng, (int, float)) or isinstance(lng, bool):
        return None

    age = _age_sec(data)
    if age is None:
        return None

    return Gps(lat=float(lat), lng=float(lng), age_sec=age)


def read_ramen() -> Optional[Ramen]:
    """ramen.json を読む。読めない・中身が足りないときは None"""
    data = _read_json(config.RAMEN_FILE)
    if data is None:
        return None

    text = data.get("text")
    ts = data.get("ts")
    if not isinstance(text, str) or not text:
        return None
    if not isinstance(ts, str) or not ts:
        # ts が無いと新着かどうかを判定できないので、無効扱いにする。
        #
        # なぜ text の比較ではダメか:
        #   1 杯目「美味しい！」→ 2 杯目「美味しい！」
        # のように同じ判定が続くと、中身が変わらないので 2 杯目に気づけません。
        # ts を見ていれば確実に拾えます。
        return None

    age = _age_sec(data)
    if age is None:
        return None

    return Ramen(text=text, ts=ts, age_sec=age)


def describe_handoff_dir() -> str:
    """
    受け渡しフォルダの状態を一言で返す（起動時のログ用）。

    「画面に何も出ない」ときの原因は、だいたい
    パスが違う / フォルダが無い / まだ誰も書いていない のどれかなので、
    起動時にそれが分かるようにしておく。
    """
    if not os.path.isdir(config.HANDOFF_DIR):
        return f"{config.HANDOFF_DIR} が存在しません（センサー側プログラムが未起動かもしれません）"

    found = [
        name
        for name, path in (("gps.json", config.GPS_FILE), ("ramen.json", config.RAMEN_FILE))
        if os.path.exists(path)
    ]
    if not found:
        return f"{config.HANDOFF_DIR} はありますが、まだ JSON がありません"
    return f"{config.HANDOFF_DIR} にあるファイル: {', '.join(found)}"
