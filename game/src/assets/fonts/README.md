# 同梱書体

| ファイル | 書体・用途 | 配布元のライセンス |
|---|---|---|
| noto-serif-jp.woff2 | Noto Serif JP、素の画面の日本語・英語 | notoserifjp-OFL.txt |
| noto-sans-jp.woff2 | Noto Sans JP、「フォント」を作った後の素の画面 | notosansjp-OFL.txt |
| biz-udpgothic-regular.woff2 / bold.woff2 | BIZ UDPGothic、設定や開発用小窓。後の世界のUIにも使用 | bizudpgothic-OFL.txt |
| dotgothic16.woff2 | DotGothic16、Tesseraの古い道具 | dotgothic16-OFL.txt |
| mplus1p-regular.woff2 | M PLUS 1p、ガラスのデスクトップの日本語フォールバック | mplus1p-OFL.txt |
| biz-udgothic-regular.woff2 | BIZ UDGothic、導入の制作ノート。日本語は全角、英数字は半角の等幅 | bizudgothic-OFL.txt |

配布元はGoogle Fontsの公式リポジトリ。すべてSIL Open Font License 1.1。
Unicode 17.0.0の常用漢字2,136字（関連字形4字も含む）、かな・英数字・記号、
言語ファイルと用語集で使う文字に絞ってWOFF2に圧縮した。書体7ファイルの合計は約3.35MB。
Segoe UIやTimes New Romanは同梱しない。配布元はコミットを固定し、取得URL、
入力・出力・文字集合のSHA-256とFontToolsの版を `manifest.json` に記録している。

Noto Serif JP、Noto Sans JP、BIZ UDPGothic、BIZ UDGothicは常用漢字2,136字をすべて含む。
DotGothic16の配布元には「𠮟」（U+20B9F）がない。この文字はUI用書体に含まれているため、
後にドット書体を使うときもUI用書体をフォールバックに指定する。

通常のビルドには通信やPythonを必要としない。書体はCSSに埋め込み、ライセンスの全文も
最終HTML内の `font-licenses` 要素にJSONとして埋め込む。

更新するときだけ、Pythonの `fonttools[woff]` を用意し、リポジトリのルートで
`python tools/vendor_fonts.py` を実行する。ライセンスとmanifestの差分も確認する。
翻訳で新しい文字を加えたときも再生成する。`python tools/vendor_fonts.py --check` では
通信せずに、文字集合・チェックサム・翻訳に使う文字の収録を確認できる。
元の書体は一時フォルダにキャッシュする。通常の横組みに使う組版機能を残し、縦組みや旧字形への切り替えは含めない。
