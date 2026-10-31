# 翻訳用の用語集

英語は下訳。正式な訳は人の手で確認する。アプリ名・人名・社名は今後もこの表に追記する。

| 日本語 | 英語の下訳 | 意味・方針 |
|---|---|---|
| REFRESH | REFRESH | 仮題。ブラウザの題名だけに使用 |
| Tessera | Tessera | 画面のパーツを作るアプリ。日本語の最初の案内だけ「Tessera（テッセラ）」 |
| 余白社 | Yohaku | デザインの「余白」から。架空の小さな販売元 |
| 榎本 湊 | Minato Enomoto | 余白社の担当。姓はEnomoto、名はMinato |
| 高瀬 蓮 | Ren Takase | 架空の利用者。姓はTakase、名はRen |
| 佐伯 真紀 | Maki Saeki | 架空の利用者。姓はSaeki、名はMaki |
| 水野 ひかり | Hikari Mizuno | 架空の利用者。姓はMizuno、名はHikari |
| ピクセル | pixel / pixels | 画面の中身を作る資源。英語は数に合わせる |
| トークン | token / tokens | 道具や設定を便利にする資源 |
| オートカーソル | auto cursor | 画面の中で働く矢印。ゲームの外の操作を意味しない |
| リリース | release | 製品を世に出すこと。仕組みの専門用語に置き換えない |

新しい言語は `_meta` と同じキーを持つ `messages` をJSONファイルに追加する。
本文の差し込み（`{count}`・`{time}`など）は削除せず、文全体を訳す。
複数形が必要な言語は `one`・`other` などIntl.PluralRulesの区分を使う。

仕様書0.1の呼び方に従う。内部の識別子は保存の互換性のため従来のまま。

| 日本語の表示 | 英語の表示 |
|---|---|
| パーツ | Parts |
| プラグイン | Plugins |
| テンプレート | Template |
| スケッチ | Sketch |
| エクスポート | Export |
| ボーダー・セーブ・カラー・フォント・レイアウト・アニメーション | Border, Save, Color, Font, Layout, Animation |
| アップグレード | Upgrades |
| ジョブ | Job |
| フィードバック | Feedback |
| スクリーンショット | Screenshot |
| フォーカスモード | Focus mode |
| 制作ノート.txt | Production notes.txt |
