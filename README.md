# REFRESH（仮題）

旧題「UIアルケミスト」の作り直し。
PCブラウザ向けインクリメンタルゲーム。Created by PLATINA。

いまは**段階6.2（アプリを作って入れる）まで実装済み**。基本8アプリの空のひな型をTessera／Gessoで組み立て、デスクトップに入れて使える。配置・色・文字・行の高さ・しま模様を変え、入れた後も組み直せる。取得済みの姿は選び直せる。段階6.5には進んでいない。製品ページ（仕様書4.6）は段階7のv1.0リリースと一緒に実装する。

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

ビルド結果は書体とライセンスを含む `game/dist/index.html` だけ（約5.73MB）。外部への通信は不要。
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
絵・トークン・プラグイン・名前・やりとり・製品の記録は残る。保存形式は第11版で、第1〜第10版から移行できる。購入済みのアプリ・小さな機能は、追加の支払いなしでおすすめの配置へ移行する。撮影は独立した場面形式6と共有データとして別保存し、旧形式1〜5もそのまま読める。エクスポートでは内容を含む1つのJSONにまとまる。
実際の生成・購入・1.5マス/秒の描画による自動プレイでは40.20分で出荷し、268ドルで256色を買えた。
作り直したTesseraでは前のアイコンをテンプレートに使え、またピクセルとトークンを得られる。256色・タスクバー・20万ピクセルがそろうとデスクトップとして組み立てられる。

製品名は最初の出荷確認で入力できる（空なら「無題」、20文字まで）。作者名とは別に保存する。
Tesseraは最初は明るいベージュの大きな道具で、1周目から3トークンで暗い小さな道具へ更新できる。デスクトップは灰色の立体枠から始まり、大型アップデート（4・20トークン）で青いつやのある枠、ガラスの枠へ進む。2回目を取得すると、Tesseraから25トークンでGessoへ乗り換えられる。取得済みの動作環境で判定するので、以前のデスクトップの姿を選んでいてもよい。Tessera・Gessoの姿はプラグイン、デスクトップの姿は設定の「全般」から戻せる。

デスクトップの論理画面は段0が800×600、段1が1024×768、段2が1366×768。古い段ほど文字や窓が大きく見え、4:3の段0・1は左右に黒い余白が出る。撮影もその縦横比で残る。Gessoの「描く・組む・書き出す」では使うパネルが切り替わる。

デスクトップでは、窓とアイコンを動かし、ピクセル表示からアプリのひな型と機能のパーツを順に作れる。ひな型はペイントソフトの「アプリの書類」からも開けるので、ファイルアプリを作る前でも組み立てられる。稼働中の形と編集中の形は別に保存し、「デスクトップに入れる」で反映する。ジョブは窓ごとにカーソルを買い、更新で効率を上げる。写真の現像、ごみ箱、時計の予約、テーマ、定期撮影を実際に使える。制作ノートも編集して保存できる。
画面を撮ると、撮影時の状態をファイルから見返せる。フィードバックは実際に操作すると完了し、2トークンが入る。
毎秒の量・生成量の変わる買い物の効き目・不足時の推定時間を表示する。京・垓・𥝱にも対応し、既存の設定から指数表記へ切り替えられる。

日本語・英語は素の画面の本文末尾、Tesseraのプラグイン、デスクトップの設定または制作ノートの下から切り替えられる。

言語は保存済みの設定、ブラウザの対応する希望言語、英語の順で選ぶ。
日本語・英語（下訳）・約1.4倍に伸ばした試験用言語を確認できる。試験用言語は次回起動には残さない。
言語ファイルと用語集は `game/src/content/locales/`、ブラウザ機能の窓口は `game/src/platform/`。

画面確認用の入口（実セーブから隔離され、ページを閉じると変更は消える）：

- `?state=editor-stage0` / `editor-stage1` / `editor-stage2`：Tessera①・②・Gesso③（取得済みの全機能を保った比較用）
- `?state=desktop-stage0` / `desktop-stage1` / `desktop-stage2`：同じ窓・アプリ・壁紙で段0〜2を比較
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
- `?state=kumiki-modern`：次のバージョン帯の確認用。Gessoの道具・256色・2コマ・追加部品。リリースを実行した状態ではない
- `?state=release-ready`：3条件がそろい、出荷前の確認を開ける
- `?state=release-counting`：売上を集計している途中
- `?state=release-complete`：見本04に合わせた303ドルの出荷画面
- `?state=release-rich`：7項目の性能購入を試すための、ドルを増やした固定状態
- `?state=release-restarting`：256色を買ってv1へ戻った直後
- `?state=release-rebuilt`：v1でカラーまで作り直した素の画面
- `?state=release-v1-tessera`：v1のTessera。前のテンプレートとデスクトップへの組み立てを確認できる

- `?state=desktop-early`：Tessera・制作ノート・タスクバーだけの入口
- `?state=desktop-wait`：アップグレードの推定時間と短縮の表示
- `?state=desktop-files`：ファイルの一覧と過去のエクスポート
- `?state=desktop-mail`：フィードバック3件とメール
- `?state=desktop-modern`：デスクトップの中のGesso
- `?state=desktop-full`：スクリーンショット50枚で保存上限

- `?state=desktop-jobs`：ジョブの割り当て・購入・更新
- `?state=desktop-photo`：写真の現像・切り抜き・比較
- `?state=desktop-ready`：全アプリ・12機能、撮影とジョブ
- `?state=desktop-stalled`：応答なしからの再起動

単体テストは `npm test`（277件）。ブラウザ確認は `tools/check_stage6.py`、 `tools/check_stage5_review.py`、`tools/check_desktop.py`、`tools/check_release.py`、`tools/check_stage3_updates.py`、`tools/check_kumiki.py`、`tools/check_seed.py`、`tools/check_foundation.py`、`tools/check_review_fixes.py`。
実行の前提と結果は `docs/実装メモ.md` に記録する。

書体の再生成は `tools/vendor_fonts.py`。対象文字の一覧と取得元は `tools/font_subsets/`、
ライセンスと生成の記録は `game/src/assets/fonts/` にある。通常のビルドでは再生成しない。

200枚・400枚の保存の計測は `node tools/measure_capture_save.mjs --exports game/artifacts/review5/exports`。
続けて `python tools/check_stage5_review.py` で実際のブラウザー保存を確認する。測定値と条件は実装メモの冒頭に記録している。

段階6.1の画面・操作の確認は、ビルド後に `python tools/check_stage61.py --base-url http://127.0.0.1:4173`（`/play/` と `/docs/mockups/` を配信するローカルサーバーが必要）。画像と結果は `game/artifacts/review7/` に出る。代表画像は [確認画像の一覧](docs/reviews/pr7/README.md) にある。

段階6.2の確認は、ビルド後に `python tools/check_stage62.py --base-url http://127.0.0.1:4173`（`game/dist/` を `/play/` として配信するループバックのローカルサーバーが必要）。`--functional-only`／`--layouts-only` で分けて実行できる。3言語×デスクトップ段0〜2×2画面サイズ×8アプリの144画面と、組み立て・復旧・撮影・旧セーブ移行を検査する。結果は `game/artifacts/stage62/`、代表画像は [確認画像の一覧](docs/reviews/stage62/README.md)。

- `?state=app-build-empty`：空の「ファイル.app」を組み立てる入口
- `?state=app-build-files`：標準の配置から並べ替えパーツを足す入口
- `?state=app-build-missing`：並べ替えパーツを外した依頼から復旧する入口
