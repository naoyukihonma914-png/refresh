# 書体を絞るための入力

`joyo.txt` はUnicode 17.0.0のUnihanデータにある `kJoyoKanji` の文字を並べたもの。
値が `2010` の常用漢字2,136字と、別の符号位置へ対応づけられた4字を含む。

- 取得元：https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip
- ZIPのSHA-256：`f7a48b2b545acfaa77b2d607ae28747404ce02baefee16396c5d2d7a8ef34b5e`
- 取得方法：ZIP内のテキストの `U+符号位置<TAB>kJoyoKanji<TAB>値` という行から符号位置を取り出し、昇順に並べる。
- ライセンス：同梱の `UNICODE-LICENSE.txt`。

これに `tools/vendor_fonts.py` の `RANGES` と、言語ファイル・用語集の文字を加える。
英数字はASCII・Latin-1・Latin Extended-A、かなはひらがな・カタカナ・小書きかな・全角半角を対象とする。
漢字全体のUnicode範囲は指定しない。通常のビルドは同梱済みの書体を使い、これらの取得やPythonは不要。
