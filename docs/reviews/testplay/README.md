# テストプレイ修正 TP-1〜TP-3 の完成画像

2026-11-03。main b508fb9（PR #22・#23）からの修正。各UIの完成状態を1枚ずつ収録し、古い完成画像は差し替える。全言語・全寸法の画像と検査JSON/HTML/ZIPはGit管理外の `game/artifacts/testplay-final/`、個別部品324組は `game/artifacts/testplay-controls/` に生成する。

| UIの状態 | 完成画像 |
|---|---|
| 初回配置：文字のない輪郭の見本 | [seed-layout.png](seed-layout.png) |
| 生成ボタンだけ特大 | [seed-generator.png](seed-generator.png) |
| 部品の寸法・文字と全体のUIスケール | [seed-settings.png](seed-settings.png) |
| エディタ完成予想・8部品完成 | [seed-future.png](seed-future.png) |
| 2周目以降の既知UIの一括制作 | [seed-replay.png](seed-replay.png) |
| 工房の行き先・状態・模式図ヘルプ | [workshop-help.png](workshop-help.png) |
| 完成22パーツの未来のデスクトップ | [workshop-preview.png](workshop-preview.png) |
| スクロールバーの固有仕上げを操作中 | [workshop-finish.png](workshop-finish.png) |

## 確認

- 全体単体テスト651件、型検査、単一HTMLビルド、同梱書体3732文字の検査成功。
- 通常進行146条件：3言語・工房3段・1920×1080/1366×768、本線22個の実4工程、全12セット/53パーツの説明図、完成予想、連打の固定、最初の配置案内、帯を下へ移動、Space技能の取得前後、表示倍率、旧形式15の真正6セーブの通常読み込みと再読込。
- 個別の寸法と文字324組：6部品×3寸法×3文字段階×3言語×2画面サイズ（段0）。他部品の矩形を変えず、安全な空きがない指定は無効にする。
- 新規開始はノート読了後を0秒、毎秒1クリックと購入判断各4秒、デバッグ資源なしで色が59秒。全言語・2サイズで一致。
- 経済全体の時間合わせは行っていない。初動に限り保存40→20、カラー200→60。詳しい仮決めは [実装メモ](../../実装メモ.md) のTP-1〜TP-3。
- この環境は `file://` をChromiumの管理制限で拒否するため、ダブルクリックの実操作は未確認。ビルドした単一HTMLをHTTPで開き、外部通信を拒否して操作した。

## 再現

`game/` で `npm test` と `npm run build`。`game/dist/` を `/play/` として配信したあと、リポジトリのルートで次を実行する（Python PlaywrightとChromium、書体検査にはfonttools[woff]が必要）。

```sh
python tools/check_testplay.py --base-url http://127.0.0.1:4173 --keep-going
python tools/check_testplay.py --base-url http://127.0.0.1:4173 --step embedded --resume --keep-going
python tools/check_testplay.py --base-url http://127.0.0.1:4173 --step motion-scale --language ja --width 1920 --era 0 --resume --keep-going
python tools/check_testplay.py --base-url http://127.0.0.1:4173 --step motion-scale --language en-XA --width 1366 --era 2 --resume --keep-going
python tools/check_testplay_controls.py --base-url http://127.0.0.1:4173 --keep-going
python tools/vendor_fonts.py --check
```

スクリーンショットはすべてこの実装をChromiumで実操作して撮影したもの。参考画像の転載や、状態・資源をブラウザへ注入した結果ではない。検査用URLは実reducerで組み立てた状態から始める。新規開始・旧セーブ読み込みは通常URLで行う。
