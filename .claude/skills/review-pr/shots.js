// レビュー用の画面撮影。使い方：
//   node shots.js <dist/index.html のパス> <保存先フォルダ> <状態名...>
// 環境変数：LOCALES=ja-JP,en-US（既定）  SIZES=1920x1080,1366x768（既定）  WAIT=2800（ミリ秒）
// 各状態を ?state=<状態名> で開き、<状態名>-<言語>-<幅>.png を保存する。ページのエラーも表示する。
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const [dist, out, ...states] = process.argv.slice(2);
  if (!dist || !out || !states.length) { console.error('使い方: node shots.js <dist/index.html> <保存先> <状態名...>'); process.exit(1); }
  fs.mkdirSync(out, { recursive: true });
  const locales = (process.env.LOCALES || 'ja-JP,en-US').split(',');
  const sizes = (process.env.SIZES || '1920x1080,1366x768').split(',').map(s => s.split('x').map(Number));
  const wait = Number(process.env.WAIT || 2800);
  const browser = await chromium.launch();
  const errors = [];
  for (const locale of locales) for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height }, locale });
    page.on('pageerror', e => errors.push(`${locale} ${width}: ${e.message}`));
    for (const state of states) {
      await page.goto('file://' + path.resolve(dist) + '?state=' + encodeURIComponent(state));
      await page.waitForTimeout(wait);
      const file = path.join(out, `${state}-${locale.slice(0, 2)}-${width}.png`);
      await page.screenshot({ path: file });
      console.log(file);
    }
    await page.close();
  }
  await browser.close();
  console.log(errors.length ? 'ページのエラー:\n' + errors.join('\n') : 'ページのエラー: 0件');
})();
