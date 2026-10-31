// 見本（docs/mockups/*.html）を1920×1080で撮る。使い方：node mockup.js <見本のHTML> <保存するPNG>
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [src, out] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, locale: 'ja-JP' });
  await page.goto('file://' + path.resolve(src));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out });
  await browser.close();
})();
