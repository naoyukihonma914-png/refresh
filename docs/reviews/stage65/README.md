# 段階6.5の画面と検査

2026-11-01。Chromiumでビルド済みの単一HTMLをループバック配信し、実際の生成・購入・設定・撮影・ファイル表示を操作した。固定状態とセーブの読み込みは実セーブから隔離している。

検査は `tools/check_stage65.py --matrix-only`／`--functional-only`／`--extras-only`／`--notices-only`／`--legacy-only`。日本語・英語・約1.4倍の試験用言語、1920×1080・1366×768。各時代の設定を開き、音量はキーボードでも操作した。ページエラー0件。ここには代表画像を残し、全撮影は再実行時の `game/artifacts/stage65/` に出す。

| 確認 | 画像 |
|---|---|
| 素の画面の記録と音 | [記録](seed-records-ja-1920.png)・[音](seed-sound-ja-1920.png) |
| Tessera①・②・Gessoの記録 | [①](editor-records-0-ja-1920.png)・[②](editor-records-1-ja-1920.png)・[Gesso](editor-records-2-ja-1920.png) |
| Gessoの音、試験用言語・小サイズ | [音](editor-sound-2-en-XA-1366.png) |
| デスクトップ95風・XP風の記録 | [95風](desktop-records-0-ja-1920.png)・[XP風](desktop-records-1-ja-1920.png) |
| 95風の音、試験用言語・小サイズ／ガラス風の音 | [95風](desktop-sound-0-en-XA-1366.png)・[ガラス風](desktop-sound-2-ja-1920.png) |
| タスクマネージャー | [倍率の内訳](manager-2-ja-1920.png) |
| ジョブのまとめ買い、95風・試験用言語・小サイズ | [最大数の見積もり](bulk-job-0-en-XA-1366.png) |
| 生成量が増えて推定時間が短縮した瞬間 | [旧値と新値](estimate-ja-1920.png) |
| カラーを作らない案件を購入ボタンで完了 | [完了後のTessera](contract-no-color-complete.png) |
| 下絵の外へ描いたアイコンから手紙を読む | [手紙](secret-letter.png) |
| 音量を撮影後に変えても撮影は20%のまま | [場面形式8](capture-common-frozen.png) |

[42条件の画面検査](matrix.json)、[案件・出来事・隠し要素・旧保存の実操作](functional.json)、[推定時間・ジョブの実購入・撮影](extras.json)。

[旧撮影の操作を維持する検査](legacy.json)・[旧形式7の表示](legacy-capture-without-new-controls.png)。

[18条件の通知検査](notices.json)。通知は [95風](notices-0-ja-1920.png)・[XP風](notices-1-ja-1920.png)・[ガラス風](notices-2-ja-1920.png) の素材で、フィードバックと実績を重ねずに並べる。

[経済の計算結果](economy.json)は `node tools/measure_stage65.mjs` で再現できる。付録Eの元のモデル6時間40分7秒に対して、実装の価格と6.3後の部品・練習10個・永続実績・累積アイコンを反映するとv1は7時間41分3秒。写真以降をさらに3倍にすると10時間5分23秒。平均化の前提・限界・価格の食い違いの判断は [実装メモ](../../実装メモ.md) に記載した。
