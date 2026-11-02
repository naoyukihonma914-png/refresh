# 検証ツール

第3版・段階8aの現行の入口は次の2つです。

- `python tools/check_stage8a.py --base-url http://127.0.0.1:4173`：新しい世界1、制作の4工程、共通部品とエディタの設定を実操作する。PlaywrightとChromiumが必要。`--step 8a1` 等で個別実行できる。詳細な引数は `--help`。
- `node tools/measure_stage8a.mjs`：実装のreducerと付録A/Cの仮の操作時間で、必須セットを完成させ出口へ着くまでを診断する。v1全体の時間合わせは行わない。

`cd game && npm test` と `npm run build` が現行の単体検査と単一HTMLのビルド。描画、旧ホーム書類、旧7部品の世界1を操作する専用のブラウザ検査は新しい検査へ置き換えて撤去した。

その他の `check_review*`・`check_stage*`・`check_foundation.py`・`check_desktop.py` は、その段階/PR時点の手動レビューを再現するための履歴であり、現在の受け入れコマンドではない。対象コミットは実装メモとGitの履歴を参照する。

`economy_sim.py`・`economy_macro.py`・`economy_stage65.py`・`measure_stage65.mjs` は第2版までの経済と付録Eの前提を記録したもの。第3版の制作モデルやv1所要時間の根拠には使わない。第3版のv1全体の計測は、世界3の経済を組み直す8b以降で行う。仕様書・付録の旧記述は、この工程では書き換えていない。
