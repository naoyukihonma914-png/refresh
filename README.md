# REFRESH（仮題）

旧題「UIアルケミスト」の作り直し。
PCブラウザ向けインクリメンタルゲーム。Created by PLATINA。

いまは**段階4（試作版 v0.1 のリリース）まで実装済み**。素の画面からTesseraを作り、試作版を出荷して売上で256色を買い、v1の素の画面を作り直せる。段階5のデスクトップはまだ作っていない。

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

ビルド結果は書体とライセンスを含む `game/dist/index.html` だけ（約4.51MB）。外部への通信は不要。
ダブルクリック起動はユーザー側で検証成功済み（2026-10-31）。今回も外部参照のない単一HTMLの構成を維持している。
Pages の次回公開では、見本を残したまま `/refresh/play/` にゲームが加わる。

新規開始では、等幅の文字による「制作ノート.txt」を読んで「はじめる」を押す。
生成ボタンでピクセルを集め、ボーダー・セーブ・オートカーソル・カラー・フォント・レイアウト・アニメーションの順に作る。
セーブを作ると自動保存が始まり、カラーを作ると余白社からお知らせが届く。
オートカーソルを作ってから毎秒の生成量を小数1桁までで表示し、生成量の変わる購入には短い数値の効き目を添える。
最初から始めた場合、付録Eと同じ操作速度の自動プレイで約9.3分でTesseraを作れる（導入を読む時間を除く）。
URL に `?debug=1` を付けると、保存の解禁・ピクセル追加・性能変更・データ入出力・言語の切り替えを確認できる。
Tesseraでは薄いテンプレートを描いてピクセルを稼ぎ、完成したアイコンと作ったパーツをエクスポートしてトークンを得る。
パーツはホーム画面に置いて初めて働く。「プラグイン」を作ると、Tesseraの道具と「このページの設定」を開ける。
初回は16色の壁に当たると試作版の3条件が現れる。そろったら、手放すものと残るものを確認してリリースする。
出荷画面で7日分の売上が入り、性能を購入できる。256色を買って「次のバージョンを作り始める」と、v1の素の画面へ戻る。
絵・トークン・プラグイン・名前・やりとり・製品の記録は残る。保存形式は第5版で、第1〜第4版から移行できる。
実際の生成・購入・1.5マス/秒の描画による自動プレイでは40.20分で出荷し、268ドルで256色を買えた。
作り直したTesseraでは前のアイコンをテンプレートに使え、またピクセルとトークンを得られる。デスクトップへ進む操作は次の段階でつなぐ。

日本語・英語は通常画面の本文末尾からも、最初から切り替えられる。

言語は保存済みの設定、ブラウザの対応する希望言語、英語の順で選ぶ。
日本語・英語（下訳）・約1.4倍に伸ばした試験用言語を確認できる。試験用言語は次回起動には残さない。
言語ファイルと用語集は `game/src/content/locales/`、ブラウザ機能の窓口は `game/src/platform/`。

画面確認用の入口（実セーブから隔離され、ページを閉じると変更は消える）：

- `?state=intro`：制作ノート（実セーブとは別の確認用）
- `?state=foundation-start`：導入を読み終えた直後の初期状態
- `?state=foundation-saved&debug=1`：保存解禁済み・自動生成あり
- `?state=foundation-offline-capped`：3時間不在から再開し、初期上限の2時間分だけ加算
- `?state=seed-start`：見本01と同じ7ピクセルの開始直後
- `?state=seed-border` / `seed-saved` / `seed-color` / `seed-font` / `seed-layout` / `seed-motion`：購入段階ごとの姿
- `?state=seed-complete`：段階2の終了画面を残した比較用の固定状態。通常プレイと旧セーブの再開ではTesseraへ移る
- `?state=seed-return`：256色・トークン40の再訪用状態。ページ下部から設定を開ける
- `?state=seed-inheriting`：前の構成を約10秒で順に組み立てる確認
- `?state=kumiki-early`：Tesseraに入った直後。鉛筆・フォルダのテンプレート・次の選択ツール
- `?state=kumiki-mature`：ボタンとスイッチを作り、時計を描いている途中
- `?state=kumiki-wall`：初回の16色の壁と試作版の条件確認
- `?state=kumiki-drift`：部品がずれている状態。ドラッグして元へ戻せる
- `?state=kumiki-modern`：次のバージョン帯の確認用。新調した道具・256色・2コマ・追加部品。リリースを実行した状態ではない
- `?state=release-ready`：3条件がそろい、出荷前の確認を開ける
- `?state=release-counting`：売上を集計している途中
- `?state=release-complete`：見本04に合わせた303ドルの出荷画面
- `?state=release-rich`：7項目の性能購入を試すための、ドルを増やした固定状態
- `?state=release-restarting`：256色を買ってv1へ戻った直後
- `?state=release-rebuilt`：v1でカラーまで作り直した素の画面
- `?state=release-v1-tessera`：v1のTessera。前のテンプレートと段階5の手前を確認できる

単体テストは `npm test`（171件）。ブラウザ確認は `tools/check_release.py`、`tools/check_stage3_updates.py`、`tools/check_kumiki.py`、`tools/check_seed.py`、`tools/check_foundation.py`、`tools/check_review_fixes.py`。
実行の前提と結果は `docs/実装メモ.md` に記録する。

書体の再生成は `tools/vendor_fonts.py`。対象文字の一覧と取得元は `tools/font_subsets/`、
ライセンスと生成の記録は `game/src/assets/fonts/` にある。通常のビルドでは再生成しない。
