# 段階7 画面修正の参考資料

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
