// docs/経済の仮値.md に対応。未調整の数値はここだけに置く。
// w1 のキー名は tools/economy_sim.py の CONFIG と対応させる。
export const BALANCE = {
  w1: {
    items: [
      { id: 'border', name: '枠線', cost: 10 },
      { id: 'save', name: '保存', cost: 40 },
      { id: 'color', name: '色', cost: 200 },
      { id: 'font', name: '書体', cost: 700 },
      { id: 'layout', name: '配置', cost: 2_000 },
      { id: 'motion', name: '動き', cost: 4_500 },
      { id: 'kumiki', name: '組木を作る', cost: 12_000 },
    ],
    cursor_cost: 15,
    cursor_growth: 1.15,
    cursor_press_per_sec: 0.5,
    base_click: 1,
    border_bonus: 1,
    font_mult: 2,
    color_cursor_mult: 1.5,
  },
  spec: {
    color: [
      { name: '16色', price: 0, multiplier: 1 },
      { name: '256色', price: 200, multiplier: 1.5 },
      { name: 'フルカラー', price: 15_000, multiplier: 2.5 },
      { name: 'HDR', price: 250_000, multiplier: 4 },
    ],
    resolution: [
      { name: '低', price: 0, grid: 16, tokens: 1 },
      { name: '中', price: 1_500, grid: 32, tokens: 2 },
      { name: '高', price: 20_000, grid: 64, tokens: 3 },
      { name: '超高', price: 300_000, grid: 128, tokens: 5 },
    ],
    refresh: [
      { name: '30Hz', price: 0, multiplier: 1, animationFps: 15 },
      { name: '60Hz', price: 5_000, multiplier: 2, animationFps: 30 },
      { name: '120Hz', price: 60_000, multiplier: 4, animationFps: 60 },
      { name: '240Hz', price: 700_000, multiplier: 8, animationFps: null },
    ],
    memory: [
      { name: '4GB', price: 0, posts: 3 },
      { name: '8GB', price: 800, posts: 4 },
      { name: '16GB', price: 8_000, posts: 5 },
      { name: '32GB', price: 90_000, posts: 6 },
      { name: '64GB', price: 1_000_000, posts: 8 },
    ],
    storage: [
      { name: '128GB', price: 0, offlineHours: 2 },
      { name: '256GB', price: 100, offlineHours: 4 },
      { name: '512GB', price: 2_000, offlineHours: 8 },
      { name: '1TB', price: 25_000, offlineHours: 12 },
      { name: '2TB', price: 300_000, offlineHours: 24 },
    ],
    network: [
      { name: '低', price: 0, mailIntervalSeconds: 240 },
      { name: '中', price: 3_000, mailIntervalSeconds: 180 },
      { name: '高', price: 40_000, mailIntervalSeconds: 120 },
    ],
    graphics: [
      { name: '低', price: 0, shotCooldownSeconds: 30 },
      { name: '中', price: 6_000, shotCooldownSeconds: 20 },
      { name: '高', price: 80_000, shotCooldownSeconds: 12 },
      { name: '最高', price: 900_000, shotCooldownSeconds: 8 },
    ],
  },
  time: {
    tickMs: 100,
    autosaveMs: 10_000,
    activeGapMs: 1_000,
    offlineNoticeMinMs: 1_000,
    millisecondsPerSecond: 1_000,
    millisecondsPerHour: 3_600_000,
  },
  tab: { heartbeatMs: 3_000, leaseMs: 15_000, settleMs: 80 },
  debug: { addPixels: 1_000, offlineFixtureHours: 3 },
} as const;

export type SeedItem = (typeof BALANCE.w1.items)[number]['id'];
export type SpecKey = keyof typeof BALANCE.spec;
