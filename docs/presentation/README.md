# 発表用の素材

Canva などのスライドに貼るためのファイルを置いています。

| ファイル | 用途 |
| --- | --- |
| `system-architecture.png` | システム構成図（3840×2160 = 16:9、**背景透明**）。スライドの背景色に馴染ませたいとき |
| `system-architecture-white.png` | 同じ図の白背景版 |
| `system-architecture.svg` | 同じ図のベクター版。拡大しても字がぼやけない |
| `generate_architecture.mjs` | 上の図を作るスクリプト |

## 図を直したいとき

`generate_architecture.mjs` の中の座標を書き換えて、作り直します。

```bash
node docs/presentation/generate_architecture.mjs docs/presentation/system-architecture.svg
```

PNG は SVG をブラウザで開いてスクリーンショットを撮って作っています（`scratchpad/svg2png.mjs` と同じ要領）。
SVG だけ差し替えて、PNG は後から作り直しても構いません。

## 話す内容

Notion にまとめています。

- 発表用：システム構成の説明台本
- 【学生向け】このシステムはどう動いているのか（補足）
