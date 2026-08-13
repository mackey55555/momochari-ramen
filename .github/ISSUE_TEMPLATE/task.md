---
name: タスク
about: 実装タスク用のテンプレート
title: ""
labels: ""
assignees: ""
---

## やること

<!-- 何を作るのかを 1〜3 行で -->

## なぜ

<!-- これがあると何が嬉しいのか。デモで何を見せたいのか -->

## 完了の条件

<!-- 「これができたら終わり」と言える状態を、確認できる形で書く -->

- [ ]
- [ ]

## 触るファイルの見当

<!-- 分かる範囲で。分からなければ空でも OK -->

- `app/`
- `components/`

## ヒント

<!-- 参考になるファイル・ドキュメント・URL -->

- Supabase からデータを取る書き方 → `app/shops/page.tsx` がお手本
- DB の中身を見る → Supabase ダッシュボードの Table Editor（`docs/database.md`）
- 地図の実装 → `components/Map.tsx`

## 作業の流れ（毎回これ）

```bash
git switch main
git pull
git switch -c feat/<Issue番号>-<短い説明>
# ...実装...
git add -A && git commit -m "作業内容"
git push -u origin feat/<Issue番号>-<短い説明>
# GitHub で PR を作成 → 槇原がレビュー
```
