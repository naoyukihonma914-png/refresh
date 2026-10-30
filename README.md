# REFRESH（仮題）

旧題「UIアルケミスト」の作り直し。
PCブラウザ向けインクリメンタルゲーム。Created by PLATINA。

いまは**段階1（土台）まで実装済み**。世界1の生成・購入は次の段階で実装する。

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

## ゲームの土台を確認する

Node.js 22.12 以上で、`game/` を作業フォルダにして実行する。

```sh
npm ci
npm test
npm run build
npm run dev
```

ビルド結果は `game/dist/index.html` だけ。ダブルクリックして開ける。
Pages の次回公開では、見本を残したまま `/refresh/play/` にゲームが加わる。

通常画面には目標・所持数・保存状況のみを表示する。生成・購入・世界の遷移はまだない。
URL に `?debug=1` を付けると、保存の解禁・ピクセル追加・性能変更・データ入出力を確認できる。
データ入出力は、各世界の設定画面ができるまでは開発用小窓に置く。

画面確認用の入口（実セーブから隔離され、ページを閉じると変更は消える）：

- `?state=foundation-start`：初期状態
- `?state=foundation-saved&debug=1`：保存解禁済み・自動生成あり
- `?state=foundation-offline-capped`：3時間不在から再開し、初期上限の2時間分だけ加算

単体テストは `npm test`。ブラウザでの確認手順と結果は `docs/実装メモ.md` に記録する。
