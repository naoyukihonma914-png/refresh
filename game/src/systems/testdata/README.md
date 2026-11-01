# 旧形式の撮影入りセーブ

`v6-two-shots.json.gz` はPR #5の初回コミット `ac7613235dfd2f6672fc1670e63b378a1fdc7163` のコードで作った、第6版の実際のセーブ。
`desktop-files` を土台に制作ノートと窓位置を変えて2回撮影した。画像の中身には当時のGameStateが入っている。
JSONをgzipでまとめただけで、変換後の型に合わせた書き換えはしていない。

再生成は当時のコードを別フォルダーへ展開し、`tools/measure_capture_save.mjs --root /path/to/old/game --legacy-fixture game/src/systems/testdata/v6-two-shots.json.gz`。
テストでは展開して `decodeSave` に渡し、資源・製品・窓・撮影時の本文と表示データを確認する。


`v8-two-shots.json.gz` はPR #6レビュー修正後の `eff7086` のコードから作った第8版の実セーブ。
同じ計測スクリプトで2回撮影した場面形式2を含み、段階6.1の型に合わせた加工はしていない。
第9版への移行で、資源・製品・窓・撮影データを保つことを検査する。
既存の `v7-two-shots.json.gz`（場面形式1）と併せて、旧形式1・2と新形式3の混在も確認する。
