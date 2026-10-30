# 同梱書体

| ファイル | 書体・用途 | 配布元のライセンス |
|---|---|---|
| noto-serif-jp.woff2 | Noto Serif JP、素の画面の日本語・英語 | notoserifjp-OFL.txt |
| biz-udpgothic-regular.woff2 / bold.woff2 | BIZ UDPGothic、設定や開発用小窓。後の世界のUIにも使用 | bizudpgothic-OFL.txt |
| dotgothic16.woff2 | DotGothic16、後の段階の組木用。現在は画面を作らず書体だけ同梱 | dotgothic16-OFL.txt |

配布元はGoogle Fontsの公式リポジトリ。すべてSIL Open Font License 1.1。
全グリフと元の書体情報を残してWOFF2に圧縮した。Segoe UIやTimes New Romanは同梱しない。
取得URLと圧縮前後のSHA-256は `manifest.json` に記録している。

通常のビルドには通信やPythonを必要としない。書体はCSSに埋め込み、ライセンスの全文も
最終HTML内の `font-licenses` 要素にJSONとして埋め込む。

更新するときだけ、Pythonの `fonttools[woff]` を用意し、リポジトリのルートで
`python tools/vendor_fonts.py` を実行する。ライセンスとmanifestの差分も確認する。
