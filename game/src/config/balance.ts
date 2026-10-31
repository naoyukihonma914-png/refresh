// docs/経済の仮値.md に対応。未調整の数値はここだけに置く。
// w1 のキー名は tools/economy_sim.py の CONFIG と対応させる。
export const BALANCE = {
  w1: {
    items: [
      { id: 'border', cost: 10 },
      { id: 'save', cost: 40 },
      { id: 'color', cost: 200 },
      { id: 'font', cost: 700 },
      { id: 'layout', cost: 2_000 },
      { id: 'motion', cost: 4_500 },
      { id: 'kumiki', cost: 12_000 },
    ],
    cursor_cost: 15,
    cursor_growth: 1.15,
    cursor_press_per_sec: 0.5,
    base_click: 1,
    border_bonus: 1,
    font_mult: 2,
    color_cursor_mult: 1.5,
    momentum: { chainMs: 1_000, decayMs: 2_000, increment: 0.06, max: 1.6 },
    holdPressesPerSecond: 4,
    maxVisibleCursors: 20,
    previewItems: 2,
    floatMs: 800,
    maxFloatingGains: 12,
    gainOffsets: [-24, 24, -48, 48, 0, -72, 72],
    numberRollMs: 180,
    hintAfterMs: 300_000,
    inheritMs: 10_000,
    skills: [
      { id: 'keyboard', band: 1, cost: 1, playful: false },
      { id: 'history', band: 1, cost: 1, playful: false },
      { id: 'pattern', band: 1, cost: 2, playful: true },
      { id: 'inherit', band: 2, cost: 12, playful: false },
      { id: 'hold', band: 2, cost: 10, playful: false },
      { id: 'marquee', band: 2, cost: 10, playful: true },
    ],
  },
  w2: {
    items: [
      { id: 'select', cost: 4_000 }, { id: 'button', cost: 9_000 },
      { id: 'extensions', cost: 15_000 }, { id: 'switch', cost: 20_000 },
      { id: 'slider', cost: 32_000 }, { id: 'input', cost: 45_000 },
      { id: 'frame', cost: 65_000 }, { id: 'taskbar', cost: 90_000 },
    ],
    desktopCost: 200_000, dotValue: 10, focusMultiplier: 2, buttonMultiplier: 1.5,
    partTokens: 1, intervalMin: 1, intervalMax: 10, sliderMultiplier: 1.2,
    driftMinMs: 180_000, driftMaxMs: 360_000, driftMinPx: 6, driftMaxPx: 14,
    driftAngle: 3, snapPx: 8, repairSeconds: 30, hintMs: 300_000,
    enterMs: 1_200, upgradeMs: 2_000, undoLimit: 30, maxName: 80,
    animationFrameMs: 500, generationLogLimit: 20,
    skills: [
      { id: 'fill', band: 1, cost: 2 }, { id: 'mirror', band: 1, cost: 3 },
      { id: 'layers', band: 1, cost: 1 }, { id: 'eyedropper', band: 1, cost: 1 },
      { id: 'expand', band: 1, cost: 1 }, { id: 'snap', band: 2, cost: 15 },
      { id: 'outline', band: 2, cost: 20 }, { id: 'animation', band: 2, cost: 20 },
      { id: 'extraParts', band: 2, cost: 15 }, { id: 'wallpaper', band: 2, cost: 10 },
      { id: 'modern', band: 2, cost: 25 },
    ],
  },
  spec: {
    color: [
      { price: 0, multiplier: 1 },
      { price: 200, multiplier: 1.5 },
      { price: 15_000, multiplier: 2.5 },
      { price: 250_000, multiplier: 4 },
    ],
    resolution: [
      { price: 0, grid: 16, tokens: 1 },
      { price: 1_500, grid: 32, tokens: 2 },
      { price: 20_000, grid: 64, tokens: 3 },
      { price: 300_000, grid: 128, tokens: 5 },
    ],
    refresh: [
      { price: 0, multiplier: 1, animationFps: 15 },
      { price: 5_000, multiplier: 2, animationFps: 30 },
      { price: 60_000, multiplier: 4, animationFps: 60 },
      { price: 700_000, multiplier: 8, animationFps: null },
    ],
    memory: [
      { price: 0, posts: 3 },
      { price: 800, posts: 4 },
      { price: 8_000, posts: 5 },
      { price: 90_000, posts: 6 },
      { price: 1_000_000, posts: 8 },
    ],
    storage: [
      { price: 0, offlineHours: 2 },
      { price: 100, offlineHours: 4 },
      { price: 2_000, offlineHours: 8 },
      { price: 25_000, offlineHours: 12 },
      { price: 300_000, offlineHours: 24 },
    ],
    network: [
      { price: 0, mailIntervalSeconds: 240 },
      { price: 3_000, mailIntervalSeconds: 180 },
      { price: 40_000, mailIntervalSeconds: 120 },
    ],
    graphics: [
      { price: 0, shotCooldownSeconds: 30 },
      { price: 6_000, shotCooldownSeconds: 20 },
      { price: 80_000, shotCooldownSeconds: 12 },
      { price: 900_000, shotCooldownSeconds: 8 },
    ],
  },
  time: {
    tickMs: 100,
    autosaveMs: 10_000,
    inactivityGapMs: 5_000,
    clockDriftToleranceMs: 1_000,
    offlineNoticeMinMs: 1_000,
    millisecondsPerSecond: 1_000,
    millisecondsPerHour: 3_600_000,
  },
  tab: { heartbeatMs: 3_000, leaseMs: 15_000, settleMs: 80 },
  debug: { addPixels: 1_000, offlineFixtureHours: 3 },
} as const;

export type SeedItem = (typeof BALANCE.w1.items)[number]['id'];
export type SeedSkill = (typeof BALANCE.w1.skills)[number]['id'];
export type KumikiItem = (typeof BALANCE.w2.items)[number]['id'];
export type KumikiSkill = (typeof BALANCE.w2.skills)[number]['id'];
export type PartId = Exclude<KumikiItem, 'select' | 'extensions'> | 'tabs' | 'table';
export type SpecKey = keyof typeof BALANCE.spec;
