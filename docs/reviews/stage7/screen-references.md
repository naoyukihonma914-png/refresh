# 段階7 画面修正の参考資料

## 今回の忠実度パス：ユーザー提供の参考パック

2026-11-02。提供された`stage7-refs.zip`をリポジトリ外へ展開し、主参考4枚と補助2枚の画素を直接目視してから作業した。READMEは内訳と出典の資料情報として読み、作業範囲はチャットの「画面・忠実度パス指示」に従った。画像は転載せず、構成・情報密度・余白/文字サイズのリズム・部品の形だけを取り入れた。

| 対象 | 主参考 | 取り入れた構成 | 既存情報だけに留めた点 |
| --- | --- | --- | --- |
| 製品・第2世代 | `steam-store-2013.jpg` | 暗い材質の帯、金属調の角張ったタブ、左の大きな画像と右の狭い情報欄、詰まった罫線/行 | ストアのトップ画面を製品詳細ページそのものとは扱わない。割引・別商品・ランキングは作らず、既存のタグ/公開情報/売上の記録を配置。 |
| 製品・第3世代 | `msstore-product-2026.png` | 広いグラデーション地の左へアイコン/大タイトル/作者/評価/既存タグ/紹介/主ボタンをまとめる。右は空け、写真節を画面の約65%の高さから始め、右に情報欄を置く | 主操作は従来の［売上を見る］。関連商品や年齢/AIの認証を足さず、右欄へ既存の環境/作者/公開情報を配置。 |
| 出荷・第2世代 | `analytics-2012.jpg` | 薄い上部と期間欄、低く幅広い折れ線、その下の裸の数値帯、下の明細表と補助の内訳 | 来訪者・直帰率・滞在時間や円グラフ用の分類を作らず、既存の7日分と売上/残高/初日/最終日の値を再配置。 |
| 出荷・第3世代 | `steamworks-sales-report.png` | 左上の小集計表、右の短いリンク群、細い期間帯、細かな明細表。大カードをやめ、推移は低い補助へ | 既存8リンクは実際に同じページへ移動。前期比/返金/税/販売経路別の値を作らず、期間は元の7日間の固定表示。 |

`itch-dashboard-analytics.png`は指標列/操作行の密度の補助、`msstore-win11-reveal.webp`は補助資料。後者の左製品パネル構成を主参考2026のヒーローに置き換えていない。ロゴ・製品名・文言・固有の配色/装飾/アイコンは借りず、図や色は自作UIのものを使う。

参考画像はゲームのリポジトリ/PR/報告用ZIPに含めていない。資料の照合情報（SHA-256先頭16桁）：

| 提供ファイル | 寸法 | SHA-256 |
| --- | --- | --- |
| `msstore-product-2026.png` | 800×500 | `f453b96a6570d93e` |
| `steamworks-sales-report.png` | 670×382 | `91b24f7b759ed4ea` |
| `itch-dashboard-analytics.png` | 1286×691 | `20fac900bd925594` |
| `steam-store-2013.jpg` | 1147×963 | `edef5413c9531729` |
| `analytics-2012.jpg` | 800×518 | `30ff58cf5608f3e8` |
| `msstore-win11-reveal.webp` | 670×449 | `dfc6bb185eb346b0` |

以下は前回までの調査記録。今回の見た目の基準は上記の提供画像である。

2026-11-02に公開資料を閲覧。借りたのは情報の順番・表やフォームの骨格・時代の密度のみ。ロゴ・商品名・既存アイコン・固有配色/装飾・文言はゲームへ転用しない。第三者の画面画像は保存・コミットしない。

| 様式 | 公開資料 | 適用した構造 |
| --- | --- | --- |
| 第1世代・製品 | [Vectorのソフト詳細](https://www.vector.co.jp/soft/win95/util/se169348.html) | パン屑、詳細/画像/評価/配布の案内、名前と説明、環境/作者の項目表、配布情報と評価。現在の公開ページであり、2005年の保存画面とは区別する。 |
| 第1世代・出荷 | [作者向け利用状況照会の公式ヘルプ](https://www.vector.co.jp/swauth/man/help/pagehelp06.html)・[作者情報のヘルプ](https://www.vector.co.jp/swauth/man/help/pagehelp02.html) | 作品・期間・形式の条件欄、件数/金額の集計、取引明細という表中心のWeb照会。ゲームでは既存の対象製品・7日・日別売上に限る。 |
| 当時の存在 | [2005年のシェアレジ紹介記事](https://forest.watch.impress.co.jp/article/2005/12/09/vectorreg.html) | 作者向け登録サービスの時代的な裏付け。記事ページの構図は製品ページに使わない。 |
| 第2世代・製品 | [2012年の製品ストア実演記録](https://news.microsoft.com/speeches/steven-sinofsky-tami-reller-julie-larson-green-antoine-leblond-and-michael-angiulo-windows-8-consumer-preview/) | 画像、詳細、評価、レビュー、導入操作をまとめる製品詳細。 |
| 第2世代・出荷 | [2013年の財務レポート](https://blogs.windows.com/windowsdeveloper/2013/09/13/just-updated-dev-center-app-and-financial-reporting/)・[2015年の財務画面紹介](https://blogs.windows.com/windowsdeveloper/2015/03/24/new-windows-phone-dev-center-financial-reporting/) | 期間・要約・製品別の表・明細・出力というオンライン管理の骨格。新しい金融状態はゲームへ持ち込まない。 |
| 第3世代・製品 | [実際のソフト販売ページ](https://store.steampowered.com/app/431730/Aseprite/) | 横長の画像と一覧、作者/発売情報、タグ、評価の要約という情報配置。実商品の見た目や名前は使わない。 |
| 第3世代・出荷 | [パートナー向け売上報告の公式資料](https://partner.steamgames.com/doc/finance/payments_salesreporting) | 収益の要約、期間比較、推移、明細と出力。ゲームに存在する7日分だけを表示する。 |
| OSゴシックの確認 | [IPA Pゴシック003.03](https://moji.or.jp/ipafont/ipa00303/)・[ライセンス](https://moji.or.jp/ipafont/license/) | 確認用Linuxへ一時配置する代替OS書体。2011年版で、MS Pゴシックや2005年当時の書体と同一とは主張しない。Webフォントとしてゲームへ追加しない。 |

2004〜2007年のWayback保存ページは閲覧ツールから取得できず、公開availability APIもHTTP 429だった。認証後の作者ページ本体は未閲覧。公開ヘルプ本文で構成を確かめたが、当時の保存画像を目視して寸法や配色を実測したという確認ではない。固定幅・文字サイズ・色・ボタン寸法は今回の指示を根拠とする。


## PR #16 再作業：第3世代の骨格の目視確認

2026-11-02。現在公開されている製品HTMLと、公式の公開画面資料を確認し、次の画像の画素を目視した。参考画像・取得HTMLは`/tmp`の確認用だけに置き、リポジトリへ入れていない。

| 資料 | 実際に確認した配置と今回の適用 |
| --- | --- |
| [Microsoft Store 2024年の製品画面更新](https://blogs.windows.com/windows-insider/2024/10/16/microsoft-store-october-2024-update-rolling-out-to-windows-insiders/)・[更新画面の掲載記事](https://www.neowin.net/news/windows-insiders-can-try-out-a-new-microsoft-store-update-with-revamped-app-and-game-pages/) | 大きな製品ヒーロー、カプセル/タイトル/評価/主操作、下に横に続く大きなスクリーンショット。公式ブログの画像本体は取得できず、同更新の報道掲載画像を目視。2026年現在の同ページ全景を実測したものではない。 |
| [Store追加情報の公式画像](https://learn.microsoft.com/en-us/windows/apps/publish/images/last-update-date.png) | 下部の追加情報を独立したカードと複数列でまとめる。これは画面の部分画像で、ヒーローの根拠とは区別する。 |
| [Partner Centerワークスペース](https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/partner-center-workspaces)・[公式Earnings画面](https://learn.microsoft.com/en-us/windows/apps/publish/images/partner-center-earnings.png) | 上部のアプリ枠、左のナビゲーション、広い本文、タイトルの右の期間欄、要約パネル。 |
| [Revenue dashboard](https://learn.microsoft.com/en-us/partner-center/insights/revenue-dashboard)・[KPI画像](https://learn.microsoft.com/en-us/partner-center/media/revenue-dashboard/gross-revenue-view.png)・[推移画像](https://learn.microsoft.com/en-us/partner-center/media/revenue-dashboard/revenue-payout.png) | 上の同じ高さのKPI群、大きな推移グラフと薄い罫線、下の日付や明細。ゲームにない支払状態や前期比は足さない。 |
| [Partner Center分析の公式画像](https://learn.microsoft.com/en-us/windows/apps/publish/images/partner-center-analytics.png) | 広い折れ線グラフ、見出し/補助欄、下の凡例。全体シェルとは別の部分資料。 |
| [Steamworksの公開トラフィック分析](https://partner.steamgames.com/doc/marketing/traffic_reporting?l=english)・[公式画像](https://shared.fastly.steamstatic.com/community_assets/images/steamworks_docs/english/trafficReportsScreenshot.jpg) | 3つのKPI→幅広の推移→明細表。認証内の売上ページではなく、公開の分析画面という範囲で参考にする。 |

現行のSteam製品ページはHTMLでカプセル・レビュー集計・タグ・紹介・動作環境を、Microsoft Storeは公開HTMLと商品データを確認した。直接Chromiumでの外部サイト表示は環境の証明書検証で失敗したため、通常の証明書検証を使う取得と公開画面画像の目視に切り替えた。直接操作した現行Webページの完成画面を見たという扱いにはしない。

今回使うのは、大きなヒーロー/横メディア列/下部セクション、または左レール/KPI/大グラフ/下部明細という配置の骨格。資料固有の色、ブランド、ロゴ、アイコン、実値、文言は使わない。
