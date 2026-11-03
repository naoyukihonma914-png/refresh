# テストプレイ修正とお手本の完成画像

2026-11-03。TP-1〜TP-3を実装し、main `15405ab`（PR #25）の仕様書1.2-10・4.2と付録C4に従って、お手本と制作の二層を追加した。最終のブランチはこのmainへ付け替え、仕様書と付録Aの本文はmainの正本を保持する。各UIの完成形だけを1枚ずつ収録し、従来8枚を差し替え、追加5枚と合わせて13枚にした。

| UIの状態 | 完成画像 |
|---|---|
| 初回配置：文字のない輪郭と次の手 | [seed-layout.png](seed-layout.png) |
| 生成ボタンだけ特大 | [seed-generator.png](seed-generator.png) |
| 素の画面のお手本設定・寸法・文字・UIスケール | [seed-settings.png](seed-settings.png) |
| エディタ完成予想・8部品完成 | [seed-future.png](seed-future.png) |
| 次版の既知UIの一括制作 | [seed-replay.png](seed-replay.png) |
| 工房の行き先・状態・模式図ヘルプ | [workshop-help.png](workshop-help.png) |
| 標準の組み立てで22パーツ完成・出口へ | [workshop-preview.png](workshop-preview.png) |
| スクロールバーの固有仕上げを操作中 | [workshop-finish.png](workshop-finish.png) |
| 工房の見た目に合わせたお手本設定 | [workshop-settings.png](workshop-settings.png) |
| デスクトップの設定アプリでお手本をOFFにする | [desktop-settings.png](desktop-settings.png) |
| 近くへ置くと輪郭に嵌る反応 | [workshop-outline-snap.png](workshop-outline-snap.png) |
| おまかせの本線と、いつでも開けるこだわり | [workshop-auto.png](workshop-auto.png) |
| 基本毎秒が飛び、実合計の数字が増える途中 | [workshop-completion.png](workshop-completion.png) |

全画像・検査JSON・HTMLギャラリー・ZIPはGit管理外の `game/artifacts/examples-final/`。主検査146条件の2,293枚に、お手本ONでの旧受け入れ回帰9条件・164枚と、最後の表示修正の確認を添える。個別の寸法・文字324組の432枚は `game/artifacts/testplay-controls-examples/`。この13枚は撮影元のPNGとバイト一致する一次画像で、参考画像の転載ではない。

## お手本追加後の確認

- 全体単体テスト708件・172スイートがすべて成功。型検査、単一HTMLビルド、同梱書体3,732文字の検査も成功。
- 主検査146条件がすべて成功。ページ例外、consoleの警告／エラー、外部要求は0件。
- お手本ON/OFFで同じ時刻・操作なら工程払い・毎秒が一致する。工程3のおまかせは標準値を明示的に適用して1回だけ進め、自由な設計は切り替えだけでは戻らない。
- 本線22パーツは具体的な次の手を辿り、標準のまま実4工程で完成・エクスポートできた。工程4は従来の部品ごとの実操作を使う。
- 工程1の近接吸着、遠くとOFFでは自由な配置、音OFF、弱い反応の収束を実操作で確認した。完成の反応は新しい完成だけに出て、再試用・編集・エクスポート・再読込で再演しない。
- 未採用の世界3の材料は実合計へ二重に加えず、アプリへ組み込むと加わる値として知らせる。連続ボーナスはお手本から独立し、工程払いだけに掛かり、15秒を過ぎれば等倍へ戻る。
- 旧形式15と真正な形式16を各6入力、3言語・2サイズで通常Import／Export／再読込した。通貨を失わず、制作状態・自由な設計・写真・製品を保持した。形式17への移行で過去の完成を再入金しない。

| 検査群 | 条件数 | 範囲 |
|---|---:|---|
| 設定・本線・吸着・調整・経済 | 90 | 5群×工房3段×3言語×2サイズ |
| デスクトップ | 24 | 段0〜3×3言語×2サイズ。設定・次の手・最大化と撮影つまみ・タスクバー |
| 未採用材料の完成 | 24 | デスクトップ段0〜3×3言語×2サイズ |
| 旧保存の移行 | 6 | 3言語×2サイズ。それぞれ真正な旧15／16を計12入力 |
| 動きを減らす設定 | 2 | 日本語1920×1080の段0、試験用言語1366×768の段2 |
| お手本ONでの旧受け入れ回帰 | 9 | 固定位置・初回配置・帯・本線22・全12セット／53パーツの説明・一括制作 |
| 未カラー背景の最終確認 | 2 | 新規／次版の完成予想と次の手は白地・黒文字（21:1）。次版の一括制作も実操作 |
| 配置取っ手の最終確認 | 6 | 3言語×2サイズ。全36取っ手を画面内へ収め、名前の全文も保持 |
| 個別の寸法と文字 | 324 | 6部品×3寸法×3文字段階×3言語×2サイズ。お手本ON、段0 |

OFFで止めるのは工程ごとの具体的な次の手・輪郭・お手本専用の吸着・おまかせ。TP-2の本線の道標「次はこれ」、一覧と状態、人物の台本、ヘルプは別として残す。世界1の初回配置見本もOFFでは止め、未表示のままONへ戻した時に一度だけ案内する。手動の自由配置と常設の完成予想は残す。

吸着16px、連続ボーナス15秒・1段2%・上限10%は今回の仮値。世界1の初動に限り保存40→20px、カラー200→60pxとし、v1全体の時間合わせは行っていない。判定の順序、表示と生産の分離、旧セーブの扱いは [実装メモ](../../実装メモ.md) を参照。

## TP-1〜TP-3を区切った時点の確認（`7005674`）

- 全体単体テスト651件、型検査、単一HTMLビルド、書体検査成功。
- 通常進行146条件が成功。3言語・工房3段・1920×1080／1366×768で固定位置の連打、初回配置、独立リサイズ、帯を下へ移した時の上部資源、Space技能、表示倍率、固有仕上げ22個、全12セット／53パーツの説明、旧形式15の読み込みを確認した。
- 個別の寸法と文字324組が成功。他部品の矩形を変えず、安全な空きのない指定は無効になる。
- 新規開始はノート読了後を0秒、毎秒1クリックと購入判断各4秒、デバッグ資源なしでカラーが59秒。3言語・2サイズで一致した。
- この区切りの全画像と検査は `game/artifacts/testplay-final/`、個別部品は `game/artifacts/testplay-controls/` に保持する。お手本追加後の結果とは分けて記録した。

## 再現

`game/` で `npm test` と `npm run build`。`game/dist/` を `/play/` として配信したあと、リポジトリのルートで次を実行する。Python PlaywrightとChromium、書体検査にはfonttools[woff]が必要。

```sh
python tools/check_examples.py --base-url http://127.0.0.1:4173 --output-dir game/artifacts/examples-final --keep-going
python tools/check_examples.py --base-url http://127.0.0.1:4173 --output-dir game/artifacts/examples-final --step reduced --language ja --width 1920 --era 0 --resume --keep-going
python tools/check_examples.py --base-url http://127.0.0.1:4173 --output-dir game/artifacts/examples-final --step reduced --language en-XA --width 1366 --era 2 --resume --keep-going
python tools/check_testplay_controls.py --base-url http://127.0.0.1:4173 --output-dir game/artifacts/testplay-controls-examples --keep-going
python tools/check_testplay.py --base-url http://127.0.0.1:4173 --output-dir game/artifacts/examples-regression-ja --step tp1 --step shell --step route --step help --step replay --language ja --width 1920 --era 0 --keep-going
python tools/check_testplay.py --base-url http://127.0.0.1:4173 --output-dir game/artifacts/examples-regression-xa --step tp1 --step shell --step route --step help --language en-XA --width 1366 --era 2 --keep-going
python tools/vendor_fonts.py --check
```

スクリーンショットはChromiumで実操作して撮影した。検査用URLは実reducerで組み立てた状態から始め、新規開始と旧セーブ読み込みは通常URLで行う。ブラウザへ資源や完成状態を注入する方法で合格にしていない。この環境では管理Chromiumが `file://` の起動を拒否するため、ダブルクリックの実操作は未確認。ビルドした単一HTMLをHTTPで開き、外部通信を拒否して操作した。
