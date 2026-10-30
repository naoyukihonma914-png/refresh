# REFRESH（仮題）

旧題「UIアルケミスト」の作り直し。
PCブラウザ向けインクリメンタルゲーム。Created by PLATINA。

いまは**段階2（素の画面）まで実装済み**。生成・購入・自動カーソル・勢い・ガイドのお知らせ・このページの設定を含む。「組木を作る」の購入でこの段階は完了し、組木の編集画面はまだ開かない。

## フォルダ
| 場所 | 中身 |
|---|---|
| `CLAUDE.md` | Claude Code 向けの進め方と、次にやることの一覧 |
| `AGENTS.md` | Codex 向けの作業ルール |
| `docs/企画メモ.md` | 経緯と判断の理由 |
| `docs/spec.md` | 仕様書（正本） |
| `docs/実装メモ.md` | 段階ごとの実装範囲・確認結果・仮の判断 |
| `game/` | TypeScript・Vite・React によるゲーム本体 |
| `docs/mockups/` | 画面の見本。`index.html` をブラウザで開く |
| `docs/handoff/` | ChatGPTからの引継ぎ資料、元ゲーム、最新試作（参考・編集しない） |

## 見本を見る
- パソコン：`docs/mockups/index.html` をダブルクリック
- スマホ・PCのブラウザ：https://naoyukihonma914-png.github.io/refresh/ （`main` に push すると自動で更新される）

## ゲームを動かす

Node.js 22.12 以上で、`game/` を作業フォルダにして実行する。

```sh
npm ci
npm test
npm run build
npm run dev
```

ビルド結果は書体とライセンスを含む `game/dist/index.html` だけ（約3.80MB）。外部への通信は不要。
ダブルクリックで開ける構成だが、検証環境のブラウザは `file://` を拒否するため、その実動作だけ未確認。
Pages の次回公開では、見本を残したまま `/refresh/play/` にゲームが加わる。

生成ボタンでピクセルを集め、枠線・保存・自動カーソル・色・書体・配置・動きの順に作る。
保存を作ると自動保存が始まり、色を作ると余白社からお知らせが届く。
最初から始めた場合、付録Eと同じ操作速度の自動プレイで約9.3分で組木を作れる。
URL に `?debug=1` を付けると、保存の解禁・ピクセル追加・性能変更・データ入出力・言語の切り替えを確認できる。
「このページの設定」は初回は組木の拡張機能から開く仕様なので、この段階の初回プレイではまだ開かない。
設定部品は実装済みで、後述の `seed-return` からチェックボックスと適用、データ入出力を確認できる。

日本語・英語は通常画面の本文末尾からも、最初から切り替えられる。

言語は保存済みの設定、ブラウザの対応する希望言語、英語の順で選ぶ。
日本語・英語（下訳）・約1.4倍に伸ばした試験用言語を確認できる。試験用言語は次回起動には残さない。
言語ファイルと用語集は `game/src/content/locales/`、ブラウザ機能の窓口は `game/src/platform/`。

画面確認用の入口（実セーブから隔離され、ページを閉じると変更は消える）：

- `?state=foundation-start`：初期状態
- `?state=foundation-saved&debug=1`：保存解禁済み・自動生成あり
- `?state=foundation-offline-capped`：3時間不在から再開し、初期上限の2時間分だけ加算
- `?state=seed-start`：見本01と同じ7ピクセルの開始直後
- `?state=seed-border` / `seed-saved` / `seed-color` / `seed-font` / `seed-layout` / `seed-motion`：購入段階ごとの姿
- `?state=seed-complete`：「組木を作る」の購入済み
- `?state=seed-return`：256色・トークン40の再訪用状態。ページ下部から設定を開ける
- `?state=seed-inheriting`：前の構成を約10秒で順に組み立てる確認

単体テストは `npm test`（98件）。ブラウザ確認は `tools/check_seed.py`、`tools/check_foundation.py`、`tools/check_review_fixes.py`。
実行の前提と結果は `docs/実装メモ.md` に記録する。

書体の再生成は `tools/vendor_fonts.py`。対象文字の一覧と取得元は `tools/font_subsets/`、
ライセンスと生成の記録は `game/src/assets/fonts/` にある。通常のビルドでは再生成しない。
