import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BALANCE } from '../../config/balance';
import { createI18n, type I18n } from '../../content/i18n';
import { productLabel } from '../../content/products';
import { createFixture } from '../../systems/fixtures';
import { buySpec, canBuySpec, shippingProduct, SPEC_ORDER } from '../../systems/release';
import { softwarePresentation, type SoftwareStage } from '../../systems/releasePresentation';
import type { GameRuntime, RuntimeSnapshot } from '../../systems/runtime';
import { encodeSave } from '../../systems/save';
import type { GameState } from '../../systems/state';
import type { Screenshot } from '../../systems/desktopState';
import type { ProductRecord } from '../../systems/releaseState';
import { Release } from '../Release';
import { StorePage } from './StorePage';

// Only the nested game renderer is replaced. The parents, their generation
// branches, all information leaves and every button/select are the real UI.
vi.mock('../LegacyCapturePreview', () => ({
  LegacyCapturePreview: ({ shot }: { shot: Screenshot }) => createElement('div', { 'data-preview-shot': shot.id }),
}));
vi.mock('./ProductPreview', () => ({
  ProductPreview: ({ product }: { product: ProductRecord }) => createElement('div', { 'data-preview-product': product.id }),
}));

const now = 1_800_000_000_000;
const generations = [1, 2, 3] as const;
const languages = ['ja', 'en', 'en-XA'] as const;
const runtime = {
  showShipping: vi.fn(), purchaseSpec: vi.fn(), startNextVersion: vi.fn(),
  changeLanguage: vi.fn(), downloadData: vi.fn(), requestImport: vi.fn(),
  requestReset: vi.fn(), common: vi.fn(),
} as unknown as GameRuntime;

interface HtmlElement { tag: string; attrs: Record<string, string>; children: (HtmlElement | string)[] }
const isElement = (node: HtmlElement | string): node is HtmlElement => typeof node !== 'string';
const decodeEntities = (value: string) => value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (whole, key: string) => {
  if (key.startsWith('#x')) return String.fromCodePoint(parseInt(key.slice(2), 16));
  if (key.startsWith('#')) return String.fromCodePoint(Number(key.slice(1)));
  return ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' } as Record<string, string>)[key] ?? whole;
});
// Parse the small SSR result without adding a browser/DOM dependency to tests.
function parseHtml(html: string): HtmlElement {
  const root: HtmlElement = { tag: 'root', attrs: {}, children: [] }, stack = [root];
  for (const token of html.match(/<!--[\s\S]*?-->|<\/?[a-z][^>]*>|[^<]+/gi) ?? []) {
    if (token.startsWith('<!--')) continue;
    if (token.startsWith('</')) { stack.pop(); continue; }
    if (token.startsWith('<')) {
      const tag = token.match(/^<([\w-]+)/)![1]!.toLowerCase();
      const attrs: Record<string, string> = {};
      for (const match of token.slice(tag.length + 1).matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+)))?/g)) {
        attrs[match[1]!] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
      }
      const node = { tag, attrs, children: [] } as HtmlElement;
      stack.at(-1)!.children.push(node);
      if (!/\/>$/.test(token) && !['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'].includes(tag)) stack.push(node);
    } else stack.at(-1)!.children.push(decodeEntities(token));
  }
  return root;
}
function all(root: HtmlElement, predicate: (node: HtmlElement) => boolean): HtmlElement[] {
  return [...(predicate(root) ? [root] : []), ...root.children.filter(isElement).flatMap(child => all(child, predicate))];
}
const text = (node: HtmlElement): string => node.children.map(child => isElement(child) ? text(child) : child).join('').replace(/\s+/g, ' ').trim();
const byClass = (root: HtmlElement, name: string) => all(root, node => node.attrs.class?.split(' ').includes(name) ?? false);
function one(root: HtmlElement, attr: string, value: string): HtmlElement {
  const found = all(root, node => node.attrs[attr] === value);
  expect(found, `${attr}=${value} must be rendered exactly once`).toHaveLength(1);
  return found[0]!;
}
function variant(state: GameState, generation: typeof generations[number]): GameState {
  const next = structuredClone(state);
  shippingProduct(next)!.presentation = softwarePresentation(((generation - 1) * 2) as SoftwareStage);
  return next;
}
function snapshot(state: GameState, language: string): RuntimeSnapshot {
  return { state, language, status: 'ready', notice: null, offline: null, introVisible: false, releaseConfirmation: false, press: null };
}
function render(state: GameState, generation: typeof generations[number], i18n: I18n, kind: 'store' | 'report'): HtmlElement {
  return parseHtml(renderToStaticMarkup(createElement(kind === 'store' ? StorePage : Release, { runtime, snapshot: snapshot(variant(state, generation), i18n.language), i18n })));
}
function normalizeDate(value: string, i18n: I18n, at: number): string {
  return [i18n.date(at), i18n.legacyDate(at)].sort((a, b) => b.length - a.length).reduce((result, date) => result.split(date).join('[published]'), value);
}
function visibleInformation(root: HtmlElement, attr: 'data-store-info' | 'data-report-info', i18n: I18n, at: number) {
  return Object.fromEntries(all(root, node => Object.hasOwn(node.attrs, attr)).map(node => {
    const value = normalizeDate(text(node), i18n, at);
    // The older register prints the period without the newer form's caption.
    return [node.attrs[attr]!, node.attrs[attr] === 'period' ? value.replace(i18n.t('shipping.reportingPeriod'), '') : value];
  }).sort(([a], [b]) => a!.localeCompare(b!)));
}
function operation(node: HtmlElement) {
  return { label: text(node), name: node.attrs['aria-label'], disabled: Object.hasOwn(node.attrs, 'disabled') };
}

describe('製品ページは別の骨格でも同じ製品と操作を表示する', () => {
  it.each(languages.flatMap(language => [false, true].map(complete => ({ language, complete }))))('$language / 購入集計完了=$complete: 親の分岐を通って情報と売上ボタンが一致する', ({ language, complete }) => {
    const state = createFixture('stage7-store', now)!, product = shippingProduct(state)!, i18n = createI18n(language);
    if (!complete) state.run.shipping!.storeElapsedMs = 0;
    const before = encodeSave(state), trees = generations.map(generation => render(state, generation, i18n, 'store'));
    const information = trees.map(tree => visibleInformation(tree, 'data-store-info', i18n, product.releasedAt));
    expect(information[1]).toEqual(information[0]); expect(information[2]).toEqual(information[0]);
    for (const tree of trees) {
      for (const key of ['title', 'author', 'description', 'screenshots', 'release-details', 'environment', 'publisher', 'reviews', 'revenue-counts', 'rating-summary']) one(tree, 'data-store-info', key);
      expect(text(one(tree, 'data-store-info', 'title'))).toBe(productLabel(i18n, product.name, i18n.t('release.version.v1')));
      const description = text(one(tree, 'data-store-info', 'description'));
      expect(description).toContain(i18n.t('store.description.desktop', { built: product.builtCount, icons: product.exports.length, apps: 1 + state.run.desktop.apps.length }));
      const environment = text(one(tree, 'data-store-info', 'environment'));
      for (const key of ['color', 'resolution', 'refresh'] as const) expect(environment).toContain(i18n.spec(key, product.screen.specs[key]));
      const reviews = one(tree, 'data-store-info', 'reviews');
      expect(all(reviews, node => node.tag === 'article')).toHaveLength(3);
      expect(all(reviews, node => node.attrs['data-stars'] !== undefined).map(node => node.attrs['data-stars'])).toEqual(['5', '4', '5']);
      for (const sender of ['hikari', 'ren', 'maki'] as const) expect(text(reviews)).toContain(i18n.t(`store.review.${sender}.body`));
      const downloads = all(tree, node => Object.hasOwn(node.attrs, 'data-store-downloads'));
      const purchases = all(tree, node => Object.hasOwn(node.attrs, 'data-store-purchases'));
      expect(downloads).toHaveLength(1); expect(purchases).toHaveLength(1);
      for (const [nodes, attr, key] of [[downloads, 'data-store-downloads', 'store.downloads'], [purchases, 'data-store-purchases', 'store.purchases']] as const) {
        const count = Number(nodes[0]!.attrs[attr]);
        expect(count).toBe(complete ? Math.floor(product.revenue * (key === 'store.downloads' ? BALANCE.release.storeDownloadsPerDollar : 1 / BALANCE.release.storeUnitPrice)) : 0);
        expect(text(nodes[0]!)).toBe(i18n.t(key, { count }));
      }
      const action = one(tree, 'data-store-action', 'sales');
      expect(action.tag).toBe('button'); expect(operation(action)).toEqual({ label: i18n.t('store.viewSales'), name: undefined, disabled: !complete });
      expect(byClass(tree, 'store-orders-pending')).toHaveLength(complete ? 0 : 1);
    }
    expect(encodeSave(state)).toBe(before);
  });

  it('同じ情報を、単列ディレクトリ・右情報列のストア・縦に積むヒーローの別DOMへ配置する', () => {
    const state = createFixture('stage7-store', now)!, i18n = createI18n('ja');
    const [classic, portal, modern] = generations.map(generation => render(state, generation, i18n, 'store')) as [HtmlElement, HtmlElement, HtmlElement];
    one(classic, 'data-store-layout', 'classic'); one(portal, 'data-store-layout', 'portal'); one(modern, 'data-store-layout', 'modern');
    expect(byClass(classic, 'store-sheet')).toHaveLength(1);
    expect(byClass(classic, 'store-portal-columns')).toHaveLength(0); expect(byClass(classic, 'store-modern-product-hero')).toHaveLength(0);
    const rail = byClass(portal, 'store-portal-rail')[0]!;
    expect(rail.tag).toBe('aside'); one(rail, 'data-store-info', 'environment'); one(rail, 'data-store-info', 'publisher');
    expect(byClass(portal, 'store-portal-columns')[0]!.children.filter(isElement).map(node => node.tag)).toEqual(['article', 'aside']);
    one(byClass(portal, 'store-portal-order')[0]!, 'data-store-action', 'sales');
    expect(byClass(modern, 'store-sheet')).toHaveLength(0);
    const hero = byClass(modern, 'store-modern-product-hero')[0]!;
    const introduction = byClass(hero, 'store-modern-introduction')[0]!;
    for (const key of ['title', 'rating-summary', 'description']) one(introduction, 'data-store-info', key);
    one(introduction, 'data-store-action', 'sales');
    expect(all(hero, node => node.attrs['data-store-info'] === 'revenue-counts')).toHaveLength(0);
    expect(all(hero, node => node.attrs['data-store-info'] === 'screenshots')).toHaveLength(0);
    one(byClass(modern, 'store-modern-media-strip')[0]!, 'data-store-info', 'screenshots');
    const facts = byClass(modern, 'store-modern-facts')[0]!;
    expect(facts.tag).toBe('aside');
    for (const key of ['environment', 'publisher', 'release-details', 'revenue-counts']) one(facts, 'data-store-info', key);
    expect(byClass(modern, 'store-modern-content-rail')[0]!.children.filter(isElement).map(node => node.tag)).toEqual(['article', 'aside']);
  });

  it('写真切替の一覧と最初の選択状態を全世代に残す', () => {
    const state = createFixture('stage7-store', now)!, product = shippingProduct(state)!;
    product.screenshots = [product.screenshots![0]!, product.capture!];
    for (const generation of generations) {
      const tree = render(state, generation, createI18n('en'), 'store');
      const photos = one(tree, 'data-store-photo-choices', 'true');
      const buttons = photos.children.filter(isElement).filter(node => node.tag === 'button');
      expect(buttons).toHaveLength(2);
      expect(buttons.map(node => node.attrs['aria-pressed'])).toEqual(['true', 'false']);
      expect(buttons.map(node => Object.hasOwn(node.attrs, 'disabled'))).toEqual([false, false]);
      expect(buttons.map(button => all(button, node => Object.hasOwn(node.attrs, 'data-preview-shot')).map(node => Number(node.attrs['data-preview-shot'])))).toEqual(product.screenshots.map(shot => [shot.id]));
      const displayedIds = all(one(tree, 'data-store-info', 'screenshots'), node => Object.hasOwn(node.attrs, 'data-preview-shot')).map(node => Number(node.attrs['data-preview-shot']));
      expect(new Set(displayedIds)).toEqual(new Set(product.screenshots.map(shot => shot.id)));
    }
  });

  it('作者未入力・写真なし・試作版でも同じ欠落条件とホーム画面の代替表示になる', () => {
    const state = createFixture('stage7-freeware', now)!, product = shippingProduct(state)!, i18n = createI18n('ja');
    product.author = null; product.screenshots = []; delete product.capture;
    const trees = generations.map(generation => render(state, generation, i18n, 'store'));
    expect(visibleInformation(trees[1]!, 'data-store-info', i18n, now)).toEqual(visibleInformation(trees[0]!, 'data-store-info', i18n, now));
    expect(visibleInformation(trees[2]!, 'data-store-info', i18n, now)).toEqual(visibleInformation(trees[0]!, 'data-store-info', i18n, now));
    for (const tree of trees) {
      expect(all(tree, node => node.attrs['data-store-info'] === 'author')).toHaveLength(0);
      expect(all(tree, node => Object.hasOwn(node.attrs, 'data-store-purchases'))).toHaveLength(0);
      expect(all(one(tree, 'data-store-info', 'screenshots'), node => Object.hasOwn(node.attrs, 'data-preview-product'))).toHaveLength(1);
      expect(byClass(tree, 'store-photo-list')).toHaveLength(0);
      expect(text(one(tree, 'data-store-info', 'reviews'))).toContain(i18n.t('store.review.prototype.body'));
      expect(text(one(tree, 'data-store-info', 'publisher'))).not.toContain(i18n.t('release.author'));
    }
  });
});

describe('出荷は別の骨格でも同じ帳簿と購入条件を表示する', () => {
  it.each(languages.flatMap(language => [false, true].map(complete => ({ language, complete }))))('$language / 集計完了=$complete: 製品・7日分・財布・7性能・次版の情報が一致する', ({ language, complete }) => {
    const state = createFixture('stage7-complete', now)!, product = shippingProduct(state)!, i18n = createI18n(language);
    if (!complete) state.run.shipping!.elapsedMs = 0;
    const before = encodeSave(state), trees = generations.map(generation => render(state, generation, i18n, 'report'));
    const information = trees.map(tree => visibleInformation(tree, 'data-report-info', i18n, product.releasedAt));
    expect(information[1]).toEqual(information[0]); expect(information[2]).toEqual(information[0]);
    for (const tree of trees) {
      for (const key of ['product', 'period', 'revenue', 'available', 'daily-sales', 'specifications', 'publisher-notes', 'next-version', 'data-tools']) one(tree, 'data-report-info', key);
      const table = one(tree, 'data-report-info', 'daily-sales');
      const daily = byClass(table, 'day-sales'), amounts = daily.map(node => Number(node.attrs['data-value']));
      const cumulative = all(table, node => Object.hasOwn(node.attrs, 'data-cumulative')).map(node => Number(node.attrs['data-cumulative']));
      expect(daily).toHaveLength(7); expect(cumulative).toHaveLength(7);
      expect(amounts.reduce((sum, amount) => sum + amount, 0)).toBe(complete ? product.revenue : 0);
      expect(cumulative.at(-1)).toBe(complete ? product.revenue : 0);
      expect(Number(table.attrs['data-first-day'])).toBe(amounts[0]); expect(Number(table.attrs['data-last-day'])).toBe(amounts[6]);
      daily.forEach((node, index) => expect(text(node)).toBe(i18n.t('release.dollars', { count: amounts[index]! })));
      expect(text(one(tree, 'data-report-info', 'revenue'))).toBe(i18n.t('release.dollars', { count: complete ? product.revenue : 0 }));
      expect(text(one(tree, 'data-report-info', 'available'))).toBe(i18n.t('release.dollars', { count: state.resources.dollars - (complete ? 0 : product.revenue) }));
      const rows = all(tree, node => Object.hasOwn(node.attrs, 'data-spec'));
      expect(rows.map(node => node.attrs['data-spec'])).toEqual([...SPEC_ORDER]);
      for (const key of SPEC_ORDER) {
        const row = one(tree, 'data-spec', key), current = row.children.filter(isElement).find(node => node.tag === 'td')!;
        expect(text(current)).toBe(i18n.spec(key, state.persistent.specs[key]));
        const buttons = all(row, node => node.tag === 'button'); expect(buttons).toHaveLength(1);
        expect(operation(buttons[0]!).disabled).toBe(!canBuySpec(state, key));
        if (!complete) expect(operation(buttons[0]!).disabled).toBe(true);
      }
      const action = all(one(tree, 'data-report-info', 'next-version'), node => node.tag === 'button');
      expect(action).toHaveLength(1); expect(operation(action[0]!).disabled).toBe(true);
      expect(text(action[0]!)).toBe(i18n.t('release.startNext'));
      const contracts = all(tree, node => node.attrs['data-report-info'] === 'contracts');
      expect(contracts).toHaveLength(complete ? 1 : 0);
      if (complete) expect(all(contracts[0]!, node => node.tag === 'option').map(text)).toEqual([i18n.t('contract.none'), i18n.t('contract.no-cursors'), i18n.t('contract.no-color')]);
      const dataButtons = all(one(tree, 'data-report-info', 'data-tools'), node => node.tag === 'button');
      expect(dataButtons.map(operation)).toEqual(['data.export', 'data.import', 'data.reset'].map(key => ({ label: i18n.t(key as 'data.export'), name: undefined, disabled: false })));
    }
    expect(encodeSave(state)).toBe(before);
  });

  it('レジの照会・折れ線と棒のポータル・密な要約表の販売管理へ実際に分岐する', () => {
    const state = createFixture('stage7-complete', now)!, i18n = createI18n('ja');
    const [first, second, third] = generations.map(generation => render(state, generation, i18n, 'report')) as [HtmlElement, HtmlElement, HtmlElement];
    one(first, 'data-report-layout', 'register-inquiry'); one(second, 'data-report-layout', 'publisher-portal'); one(third, 'data-report-layout', 'partner-console');
    expect(byClass(first, 'shipping-report-main')).toHaveLength(1);
    expect(byClass(first, 'shipping-portal-layout')).toHaveLength(0); expect(byClass(first, 'shipping-app-layout')).toHaveLength(0);
    one(byClass(second, 'shipping-portal-sidebar')[0]!, 'data-report-info', 'product');
    expect(all(second, node => Object.hasOwn(node.attrs, 'data-report-chart')).map(node => node.attrs['data-report-chart'])).toEqual(['line', 'bars']);
    expect(byClass(second, 'shipping-portal-summary')[0]!.tag).toBe('table');
    expect(byClass(second, 'shipping-app-layout')).toHaveLength(0);
    expect(byClass(third, 'shipping-kpi-cards')).toHaveLength(0);
    const summary = byClass(third, 'shipping-finance-summary')[0]!;
    expect(summary.tag).toBe('table');
    one(summary, 'data-report-info', 'revenue'); one(summary, 'data-report-info', 'available');
    one(third, 'data-report-chart', 'line');
    expect(all(third, node => node.attrs['data-report-info'] === 'daily-sales' || node.attrs['data-report-chart'] === 'line').map(node => node.attrs['data-report-info'] ?? node.attrs['data-report-chart'])).toEqual(['daily-sales', 'line']);
    const outline = all(third, node => node.attrs.class?.split(' ').includes('shipping-finance-summary') || node.attrs['data-report-info'] === 'period' || node.attrs['data-report-info'] === 'daily-sales' || node.attrs['data-report-chart'] === 'line');
    expect(outline).toEqual([summary, one(third, 'data-report-info', 'period'), one(third, 'data-report-info', 'daily-sales'), one(third, 'data-report-chart', 'line')]);
    const jumps = all(third, node => Object.hasOwn(node.attrs, 'data-report-jump'));
    expect(jumps.map(node => node.attrs['data-report-jump'])).toEqual(['overview', 'trend', 'daily', 'product', 'specs', 'notes', 'contracts', 'next-version']);
    expect(jumps.every(node => node.tag === 'button' && !Object.hasOwn(node.attrs, 'disabled'))).toBe(true);
    const shortcuts = all(third, node => Object.hasOwn(node.attrs, 'data-report-shortcut'));
    expect(shortcuts.every(node => ['product', 'specs', 'notes'].includes(node.attrs['data-report-shortcut']!) && node.tag === 'button' && !Object.hasOwn(node.attrs, 'disabled'))).toBe(true);
  });

  it('数え上げの途中も7日の実額・累計・表示残高をそろえ、性能の購入はまだ許可しない', () => {
    const state = createFixture('stage7-shipping', now)!, product = shippingProduct(state)!, i18n = createI18n('en');
    const trees = generations.map(generation => render(state, generation, i18n, 'report'));
    const information = trees.map(tree => visibleInformation(tree, 'data-report-info', i18n, product.releasedAt));
    expect(information[1]).toEqual(information[0]); expect(information[2]).toEqual(information[0]);
    for (const tree of trees) {
      const days = byClass(one(tree, 'data-report-info', 'daily-sales'), 'day-sales').map(node => Number(node.attrs['data-value']));
      const total = days.reduce((sum, amount) => sum + amount, 0);
      expect(total).toBeGreaterThan(0); expect(total).toBeLessThan(product.revenue);
      expect(text(one(tree, 'data-report-info', 'revenue'))).toBe(i18n.t('release.dollars', { count: total }));
      expect(text(one(tree, 'data-report-info', 'available'))).toBe(i18n.t('release.dollars', { count: state.resources.dollars - product.revenue + total }));
      expect(all(one(tree, 'data-report-info', 'specifications'), node => node.tag === 'button').every(node => Object.hasOwn(node.attrs, 'disabled'))).toBe(true);
    }
  });

  it('必須の60Hz購入後は全世代で次版を開始でき、買い切った項目は再購入できない', () => {
    let state = createFixture('stage7-complete', now)!;
    state = buySpec(state, 'refresh');
    expect(state.persistent.specs.refresh).toBe(1);
    state.persistent.specs.memory = BALANCE.spec.memory.length - 1;
    const i18n = createI18n('en');
    for (const generation of generations) {
      const tree = render(state, generation, i18n, 'report');
      const next = all(one(tree, 'data-report-info', 'next-version'), node => node.tag === 'button')[0]!;
      expect(operation(next).disabled).toBe(false);
      const memory = one(tree, 'data-spec', 'memory');
      expect(all(memory, node => node.tag === 'button')).toHaveLength(0); expect(text(memory)).toContain(i18n.t('release.maximum'));
    }
  });

  it('資金を使い切ったときは全世代の購入を止め、作者のない試作版には受託案件を出さない', () => {
    const unfunded = createFixture('stage7-complete', now)!; unfunded.resources.dollars = 0;
    const prototype = createFixture('stage7-freeware-sales', now)!; shippingProduct(prototype)!.author = null;
    const i18n = createI18n('ja');
    for (const generation of generations) {
      const tree = render(unfunded, generation, i18n, 'report');
      for (const row of all(tree, node => Object.hasOwn(node.attrs, 'data-spec'))) expect(all(row, node => node.tag === 'button').every(node => operation(node).disabled)).toBe(true);
      const trial = render(prototype, generation, i18n, 'report');
      expect(all(trial, node => node.attrs['data-report-info'] === 'contracts')).toHaveLength(0);
      const product = one(trial, 'data-report-info', 'product');
      expect(text(product)).not.toContain(i18n.t('release.author'));
      expect(text(product)).toContain(i18n.t('release.prototype'));
    }
  });

  it('完了した受託案件は全世代で選び直せず、未完了の案件と選ばない操作は残す', () => {
    const state = createFixture('stage7-complete', now)!;
    state.persistent.progress.completed['no-cursors'] = now;
    for (const generation of generations) {
      const tree = render(state, generation, createI18n('ja'), 'report');
      const options = all(one(tree, 'data-report-info', 'contracts'), node => node.tag === 'option');
      expect(options.map(node => [node.attrs.value, Object.hasOwn(node.attrs, 'disabled')])).toEqual([['', false], ['no-cursors', true], ['no-color', false]]);
    }
  });
});
