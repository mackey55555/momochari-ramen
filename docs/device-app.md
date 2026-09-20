# ラズパイ地図アプリへのデータ受け渡し仕様（IoTチーム向け）

ラズパイの画面に地図を出すアプリ（`iot/mapapp/`）を追加しました。
このアプリが動くために、**すでに動いているプログラムに 2 行ずつ追加**していただきたい、
というお願いです。

## お願いすることの全体像

```
[既存] センサー各種 → API送信プログラム ──┐ gps.json を書く
                                            ├→ [新規] 地図アプリ → 画面
[既存] 塩分センサー → 判定プログラム ──────┘ ramen.json を書く
```

地図アプリは**センサーを一切触りません**。ファイルを読むだけです。
なので既存プログラムから見ると「ファイルを 1 個書くようになった」だけで、
今までの API 送信の動きは何も変わりません。

**地図アプリが落ちていても、既存プログラムには何の影響もありません。**
ファイルに書くだけなので、読み手がいなくても失敗しないし、待たされることもありません。

---

## 1. 書く場所

| プログラム                    | 書き出すファイル            | いつ書くか                     |
| ----------------------------- | --------------------------- | ------------------------------ |
| センサーの API 送信プログラム | `/run/momochari/gps.json`   | GPS を取得するたび（1 秒ごと） |
| 塩分センサーの判定プログラム  | `/run/momochari/ramen.json` | 判定が出たときだけ             |

フォルダは起動時に作ってください（後述の `writeHandoff` の中でやっています）。

```javascript
fs.mkdirSync("/run/momochari", { recursive: true });
```

### なぜ `/run/` なのか

`/run/` は **tmpfs**、つまり RAM 上のファイルシステムです。

- **SD カードが摩耗しません。** GPS は 1 秒ごとに書き続けるので、
  SD カードに書くと数か月でカードが壊れます。これは実際によくある故障です
- **再起動すると消えます。** 前回走ったときの古い位置が残らないので、
  起動直後に「昨日いた場所」が現在地として表示される事故が起きません

---

## 2. 書く中身

### `gps.json`（1 秒ごとに上書き）

```json
{
  "lat": 34.6664,
  "lng": 133.9183,
  "ts": "2026-09-19T01:00:00.000Z"
}
```

| フィールド | 型     | 必須 | 説明                                   |
| ---------- | ------ | ---- | -------------------------------------- |
| `lat`      | number | ✅   | 緯度。数値で（文字列だと無視されます） |
| `lng`      | number | ✅   | 経度                                   |
| `ts`       | string | ✅   | 取得時刻（ISO 8601）                   |

**測位できていないときは書かないでください。** 上書きが止まれば、地図アプリ側が
「GPS を見失った」と判断して、自分マーカーを灰色にします。
`lat` / `lng` に 0 やダミー値を入れて書き続けると、アフリカ沖に飛ばされます。

### `ramen.json`（判定が出たときだけ書く）

```json
{
  "text": "このラーメンは美味しい！",
  "ts": "2026-09-19T01:23:45.678Z"
}
```

| フィールド | 型     | 必須 | 説明                         |
| ---------- | ------ | ---- | ---------------------------- |
| `text`     | string | ✅   | 画面下部にそのまま出す文字列 |
| `ts`       | string | ✅   | 判定した時刻（ISO 8601）     |

`text` の中身は**そちらで自由に決めてください**。地図アプリは中身を解釈せず、
受け取った文字列をそのまま画面に出します。文言を変えてもアプリの修正は不要です。

画面の幅の都合で、**20 文字くらいまで**だと綺麗に収まります（長くても折り返して出ます）。

---

## 3. 守っていただきたいこと 3 つ

### ① `renameSync` で差し替える（いちばん重要）

```javascript
const fs = require("fs");

function writeJson(filePath, data) {
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, filePath); // ← これ
}
```

**`fs.writeFileSync(filePath, ...)` で直接上書きしないでください。**

書いている途中の一瞬、ファイルは「`{"lat":34.6` まで書けていて、そこで切れている」
という壊れた状態になります。運悪くそのタイミングで地図アプリが読むと、
JSON として壊れたものを読むことになります。

一時ファイルに書いてから `fs.renameSync()` で差し替えると、この「途中の状態」が
外から見えなくなります（同じファイルシステム内の rename は原子的な操作です）。
読み手からは、常に**完全な新しい JSON** か
**完全なひとつ前の JSON** のどちらかしか見えません。

1 秒に 1 回の書き込みを何時間も続けるので、確率の低い事故でも必ず踏みます。

### ② 非同期版（`fs.promises` / `await`）を使わない

`writeFileSync` / `renameSync` の **Sync 版**を使ってください。

非同期にすると、1 秒ごとの書き込みが重なったときに**完了の順番が入れ替わる**
可能性があります。「新しい位置を書いた直後に、古い位置の書き込みが後から完了する」と、
地図が一瞬前の場所に戻ります。

書き込むのは数百バイトで、しかも `/run/` は RAM 上なので、
同期処理でもコストは実質ゼロです。素直に Sync を使うのが正解です。

### ③ `ts` を必ず入れる

省略しないでください。地図アプリはこれが無いと動けません。

```javascript
new Date().toISOString(); // → "2026-09-19T01:00:00.123Z"
```

`docs/api.md` で API に送っているのと同じ ISO 8601 形式がそのまま得られます。
`2026/09/19 10:00:00` のように自分で組み立てると **9 時間ずれる事故**が起きます。

**GPS の場合** — 「測位できているか」の判断に使います。
`ts` が 5 秒以上古くなったら「ロスト」とみなし、地図を止めて自分マーカーを灰色にします。
これが無いと、トンネルに入って更新が止まったあとも、
古い位置を現在地として表示し続けてしまいます。

**塩分の場合** — 「新しく測ったか」の判断に使います。こちらは少し分かりにくいのですが、

```
1 杯目: {"text": "このラーメンは美味しい！", "ts": "...01:00:00Z"}
2 杯目: {"text": "このラーメンは美味しい！", "ts": "...01:15:00Z"}
```

同じ判定が続くと `text` が変わらないので、**中身を比べていると 2 杯目に気づけません**。
`ts` を見ていれば確実に拾えます。

---

## 4. コピーして使える追加ぶん

既存のプログラムに、この関数と呼び出し 1 行を足すだけです。

```javascript
const fs = require("fs");
const path = require("path");

const HANDOFF_DIR = "/run/momochari";

/** 地図アプリにデータを渡す。失敗しても本業（API送信）は止めない */
function writeHandoff(name, data) {
  try {
    fs.mkdirSync(HANDOFF_DIR, { recursive: true });
    const filePath = path.join(HANDOFF_DIR, name);
    const tmp = filePath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, filePath);
  } catch (error) {
    // 画面表示のためのオマケなので、書けなくても黙って続行する。
    // ここで例外を投げると、地図アプリのせいで API 送信が止まってしまう。
  }
}
```

**GPS 側** — 位置を取得した直後（今 API に送っているあたり）に 1 行:

```javascript
writeHandoff("gps.json", { lat, lng, ts: new Date().toISOString() });
```

**塩分側** — 判定が出た直後に 1 行:

```javascript
writeHandoff("ramen.json", {
  text: judgementText,
  ts: new Date().toISOString(),
});
```

`try` で囲んであるのがポイントです。ディスクが一杯でも権限が無くても、
**既存の API 送信が巻き添えで止まることはありません**。

日本語は `JSON.stringify` の既定でそのまま書き込まれるので、オプションは不要です。

> **`package.json` に `"type": "module"` がある場合**（`import` を使っているプロジェクト）は、
> 先頭の 2 行だけ差し替えてください。中身は同じです。
>
> ```javascript
> import fs from "node:fs";
> import path from "node:path";
> ```

### Python で書いている場合

同じことを Python でやるならこうです（`iot/send_accel.py` のように
Python で書かれたプログラムに足す場合）。

```python
import json
import os
from datetime import datetime, timezone

HANDOFF_DIR = "/run/momochari"


def write_handoff(name, data):
    """地図アプリにデータを渡す。失敗しても本業（API送信）は止めない"""
    try:
        os.makedirs(HANDOFF_DIR, exist_ok=True)
        path = os.path.join(HANDOFF_DIR, name)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        os.replace(tmp, path)
    except OSError:
        pass


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
```

```python
write_handoff("gps.json", {"lat": lat, "lng": lng, "ts": now_iso()})
write_handoff("ramen.json", {"text": judgement_text, "ts": now_iso()})
```

Python では `ensure_ascii=False` を付けないと日本語が `\u3053...` に化けます。
`os.replace()` が JavaScript の `fs.renameSync()` にあたります。

---

## 5. 確認のしかた

書き込みができているかは、ラズパイ上でこれを見るだけです。

```bash
# 中身を見る
cat /run/momochari/gps.json

# 1 秒ごとに更新されているか見る（Ctrl + C で終了）
watch -n 1 cat /run/momochari/gps.json
```

`ts` が毎秒変わっていれば成功です。

地図アプリ側も、起動時に受け渡しフォルダの状態を表示します。

```
受け渡し : /run/momochari にあるファイル: gps.json, ramen.json
```

### センサーを繋ぐ前に試す

塩分センサーが無くても、これだけで画面に出るところまで確認できます。

```bash
node -e '
const fs=require("fs");
fs.mkdirSync("/run/momochari",{recursive:true});
const p="/run/momochari/ramen.json";
fs.writeFileSync(p+".tmp",JSON.stringify({text:"テスト表示",ts:new Date().toISOString()}));
fs.renameSync(p+".tmp",p);
console.log("書き込みました");
'
```

地図アプリが動いていれば、画面下部に「テスト表示」が 15 秒出て、
そのあと「近くのお店」の表示に戻ります。

---

## 6. よくある質問

**Q. 地図アプリが起動していないときに書いても大丈夫？**
はい。ファイルが置いてあるだけの状態になります。アプリを起動したら読み始めます。

**Q. 書き込みに失敗したらどうなる？**
上の `try` で握りつぶしていれば、何も起きません。地図アプリ側は
「`ts` が古い」と判断して「GPS を待っています…」を表示します。

**Q. `text` に改行を入れてもいい？**
入れても表示されますが、画面下部の高さが決まっているので短いほうが綺麗です。

**Q. 履歴を残したい**
今の仕様は「最新の 1 件だけ」です。履歴が必要になったら、
`/var/log/` 側に 1 行 1 JSON（JSONL）で追記する形に拡張しましょう。
`/run/` は再起動で消えるので、残したいものは置かないでください。

**Q. 既存プログラムを 1 行も触りたくない**
最終手段として、systemd のログ（`journalctl -f -u サービス名`）を
地図アプリ側でパースする方法もあります。ただしログの文言が変わった瞬間に壊れるので、
2 行足せるなら足していただくほうが圧倒的に安全です。

---

## 関連ドキュメント

- [`docs/api.md`](api.md) — Web API の仕様（センサーデータの送信先）
- [`iot/mapapp/README.md`](../iot/mapapp/README.md) — 地図アプリ側のセットアップ手順
