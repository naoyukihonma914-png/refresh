// docs/経済の仮値.md に対応。未調整の数値はここだけに置く。
// w1 のキー名は tools/economy_sim.py の CONFIG と対応させる。
export const BALANCE = {
  accessibility: { uiScales: [0.75, 1, 1.25, 1.5], defaultUiScale: 1 },
  workshopHelp: {
    "width": 320,
    "height": 190,
    "highlight": "#c8553d",
    "window": {
      "x": 55,
      "y": 18,
      "width": 250,
      "height": 142
    },
    "regions": {
      "common-frame": {
        "x": 55,
        "y": 18,
        "width": 250,
        "height": 142
      },
      "common-scrollbar": {
        "x": 292,
        "y": 48,
        "width": 10,
        "height": 109
      },
      "common-button": {
        "x": 194,
        "y": 127,
        "width": 76,
        "height": 20
      },
      "common-heading": {
        "x": 66,
        "y": 50,
        "width": 192,
        "height": 14
      },
      "common-progress": {
        "x": 66,
        "y": 101,
        "width": 198,
        "height": 16
      },
      "foundation-taskbar": {
        "x": 2,
        "y": 171,
        "width": 316,
        "height": 17
      },
      "foundation-desktop": {
        "x": 2,
        "y": 2,
        "width": 316,
        "height": 166
      },
      "foundation-icons": {
        "x": 6,
        "y": 12,
        "width": 34,
        "height": 140
      },
      "foundation-notification": {
        "x": 226,
        "y": 119,
        "width": 90,
        "height": 49
      },
      "foundation-wallpaper": {
        "x": 44,
        "y": 5,
        "width": 270,
        "height": 160
      },
      "foundation-upgrades": {
        "x": 2,
        "y": 89,
        "width": 144,
        "height": 80
      },
      "files-list": {
        "x": 117,
        "y": 71,
        "width": 168,
        "height": 53
      },
      "files-back": {
        "x": 63,
        "y": 48,
        "width": 18,
        "height": 16
      },
      "files-sort": {
        "x": 91,
        "y": 48,
        "width": 65,
        "height": 16
      },
      "files-search": {
        "x": 164,
        "y": 48,
        "width": 122,
        "height": 16
      },
      "files-large": {
        "x": 249,
        "y": 129,
        "width": 37,
        "height": 19
      },
      "files-storage": {
        "x": 65,
        "y": 130,
        "width": 120,
        "height": 17
      },
      "mail-list": {
        "x": 65,
        "y": 49,
        "width": 85,
        "height": 82
      },
      "mail-body": {
        "x": 157,
        "y": 49,
        "width": 127,
        "height": 82
      },
      "mail-reply": {
        "x": 203,
        "y": 135,
        "width": 81,
        "height": 17
      },
      "mail-folders": {
        "x": 65,
        "y": 137,
        "width": 86,
        "height": 15
      },
      "mail-unread": {
        "x": 130,
        "y": 55,
        "width": 13,
        "height": 8
      },
      "photo-display": {
        "x": 65,
        "y": 49,
        "width": 132,
        "height": 86
      },
      "photo-brightness": {
        "x": 205,
        "y": 49,
        "width": 80,
        "height": 16
      },
      "photo-tone": {
        "x": 205,
        "y": 75,
        "width": 80,
        "height": 16
      },
      "photo-wallpaper": {
        "x": 205,
        "y": 115,
        "width": 80,
        "height": 18
      },
      "photo-crop": {
        "x": 65,
        "y": 137,
        "width": 70,
        "height": 15
      },
      "photo-compare": {
        "x": 140,
        "y": 137,
        "width": 65,
        "height": 15
      },
      "photo-switch": {
        "x": 210,
        "y": 137,
        "width": 75,
        "height": 15
      },
      "bin-list": {
        "x": 65,
        "y": 49,
        "width": 220,
        "height": 80
      },
      "bin-undo": {
        "x": 65,
        "y": 136,
        "width": 102,
        "height": 18
      },
      "bin-empty": {
        "x": 183,
        "y": 136,
        "width": 102,
        "height": 18
      },
      "clock-time": {
        "x": 65,
        "y": 49,
        "width": 120,
        "height": 30
      },
      "clock-timer": {
        "x": 65,
        "y": 89,
        "width": 120,
        "height": 62
      },
      "clock-calendar": {
        "x": 199,
        "y": 49,
        "width": 87,
        "height": 102
      },
      "theme-mode": {
        "x": 65,
        "y": 49,
        "width": 220,
        "height": 17
      },
      "theme-accent": {
        "x": 65,
        "y": 71,
        "width": 106,
        "height": 17
      },
      "theme-radius": {
        "x": 179,
        "y": 71,
        "width": 106,
        "height": 17
      },
      "theme-slideshow": {
        "x": 65,
        "y": 94,
        "width": 220,
        "height": 20
      },
      "theme-icons": {
        "x": 65,
        "y": 122,
        "width": 220,
        "height": 20
      },
      "terminal-output": {
        "x": 65,
        "y": 49,
        "width": 145,
        "height": 66
      },
      "terminal-commands": {
        "x": 218,
        "y": 49,
        "width": 67,
        "height": 65
      },
      "terminal-interval": {
        "x": 65,
        "y": 123,
        "width": 70,
        "height": 16
      },
      "terminal-run": {
        "x": 142,
        "y": 123,
        "width": 66,
        "height": 16
      },
      "terminal-history": {
        "x": 65,
        "y": 143,
        "width": 220,
        "height": 10
      },
      "manager-processes": {
        "x": 65,
        "y": 49,
        "width": 135,
        "height": 102
      },
      "manager-performance": {
        "x": 209,
        "y": 49,
        "width": 76,
        "height": 102
      },
      "plugin-tabs": {
        "x": 65,
        "y": 49,
        "width": 220,
        "height": 18
      },
      "plugin-table": {
        "x": 65,
        "y": 76,
        "width": 220,
        "height": 76
      },
      "stream-preview": {
        "x": 65,
        "y": 49,
        "width": 140,
        "height": 86
      },
      "stream-sources": {
        "x": 214,
        "y": 49,
        "width": 72,
        "height": 27
      },
      "stream-scenes": {
        "x": 65,
        "y": 141,
        "width": 140,
        "height": 13
      },
      "stream-comments": {
        "x": 214,
        "y": 84,
        "width": 72,
        "height": 68
      }
    }
  },
  examples: {
    "desktopNextWidth": 240,
    "desktopNextCompactWidth": 160,
    "desktopCompactScreenWidth": 1024,
    "desktopTaskbarGlassAppWidth": 48,
    "desktopTaskbarFlatAppMinWidth": 46
  },
  w1: {
    items: [
      { id: 'border', cost: 10, perSecond: 0.05 },
      { id: 'save', cost: 20, perSecond: 0.1 },
      { id: 'color', cost: 60, perSecond: 0.5 },
      { id: 'font', cost: 700, perSecond: 1 },
      { id: 'layout', cost: 2_000, perSecond: 2 },
      { id: 'motion', cost: 4_500, perSecond: 4 },
      { id: 'bars', cost: 6_500, perSecond: 6 },
      { id: 'workspace', cost: 9_000, perSecond: 8 },
      { id: 'export', cost: 12_000, perSecond: 10 },
    ],
    futurePreview: {
      width: 320, reservedWidth: 624, right: 288, top: 168, footerHeight: 88,
      schematicWidth: 320, schematicHeight: 264,
      editor: { x: 8, y: 8, width: 304, height: 148 },
      title: { x: 8, y: 8, width: 304, height: 22 },
      status: { x: 8, y: 142, width: 304, height: 14 },
      palette: { x: 16, y: 40, width: 16, height: 16, gap: 4, count: 4 },
      heading: { x: 48, y: 44, width: 156, height: 6, lineGap: 12 },
      canvas: { x: 48, y: 78, width: 152, height: 52 },
      panel: { x: 220, y: 40, width: 56, height: 90 },
      button: { x: 94, y: 96, width: 60, height: 20 },
      tool: { x: 286, y: 40, width: 16, height: 90 },
      export: { x: 250, y: 13, width: 52, height: 12 },
      desktop: { x: 8, y: 184, width: 304, height: 72 },
      taskbar: { x: 8, y: 244, width: 304, height: 12 },
      futureWindow: { x: 64, y: 196, width: 170, height: 42 },
    },
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
    cursorTierCounts: [10, 30, 100],
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
  // World2 naming retained only for generic integration settings during 8a.
  w2: { desktopCost: 200_000, hintMs: 300_000, enterMs: 1_200, upgradeMs: 2_000, maxName: 80 },
  workshop: {
    feedback: { flightMs:650, pulseMs:1100, messageMs:1800, frameMs:33, originLift:12, maxWidth:260, queueLimit:4 },
    // 4.2 お手本/連続制作: 付録Cに具体値がないため一括で置いた仮値。
    examples: { snapDistance: 16, snapPulseMs: 480, comboWindowMs: 15_000, comboStepBonus: .02, comboMaxBonus: .10 },
    testplay: {
      "fillMs": 900,
      "scrollOverflowPx": 160,
      "minimumScrollPixels": 1,
      "selectionMinSize": 8,
      "preview": {
        "width": 240,
        "height": 148,
        "runMs": 2600,
        "frameMs": 50
      }
    },
    // 第3版の個別毎秒・工程払い。全て調整前の仮値。
    setCosts: { common: 4_000, foundation: 30_000, files: 65_000, mail: 90_000,
      photo: 180_000, bin: 35_000, clock: 8_000, theme: 80_000,
      terminal: 1_400_000, manager: 12_000, extras: 0, stream: 2_000_000 },
    partRates: {
      'common-frame': 12, 'common-scrollbar': 8, 'common-button': 10, 'common-heading': 6, 'common-progress': 9,
      'foundation-taskbar': 25, 'foundation-desktop': 20, 'foundation-icons': 22,
      'foundation-notification': 18, 'foundation-wallpaper': 16, 'foundation-upgrades': 24,
      'files-list': 40, 'files-back': 28, 'files-sort': 38, 'files-search': 45, 'files-large': 34, 'files-storage': 36,
      'mail-list': 48, 'mail-body': 44, 'mail-reply': 52, 'mail-folders': 46, 'mail-unread': 32,
      'photo-display': 70, 'photo-brightness': 64, 'photo-tone': 62, 'photo-wallpaper': 58,
      'photo-crop': 85, 'photo-compare': 78, 'photo-switch': 55,
      'bin-list': 26, 'bin-undo': 24, 'bin-empty': 28,
      'clock-time': 8, 'clock-timer': 12, 'clock-calendar': 10,
      'theme-mode': 28, 'theme-accent': 30, 'theme-radius': 26, 'theme-slideshow': 36, 'theme-icons': 32,
      'terminal-output': 180, 'terminal-commands': 220, 'terminal-interval': 160,
      'terminal-run': 240, 'terminal-history': 190,
      'manager-processes': 14, 'manager-performance': 16, 'plugin-tabs': 0, 'plugin-table': 0,
      'stream-preview': 200, 'stream-sources': 120, 'stream-scenes': 140, 'stream-comments': 120,
    },
    categoryStepRewards: { small: [20, 25, 30, 40], medium: [40, 50, 60, 80], large: [80, 100, 120, 160] },
    finishRewards: { small: 120, medium: 250, large: 500 },
    efficiencyMultiplier: 1.25, exportTokens: 1, achievementParts: [6, 10],
    assistStepMs: 45_000,
    enterMs: 1_200, hintMs: 300_000, zoomMin: 0.5, zoomMax: 2, zoomStep: 0.25,
    zoomOptions: [0.5, 0.75, 1, 1.25, 1.5, 2],
    partMinSizes: {
      frame: { width: 240, height: 72 }, scrollbar: { width: 120, height: 64 },
      button: { width: 144, height: 48 }, heading: { width: 160, height: 48 },
      progress: { width: 192, height: 72 }, list: { width: 192, height: 72 },
      surface: { width: 192, height: 72 }, slider: { width: 200, height: 72 },
      input: { width: 200, height: 72 }, toggle: { width: 160, height: 64 },
      select: { width: 176, height: 64 }, timer: { width: 176, height: 64 },
      calendar: { width: 192, height: 72 }, table: { width: 192, height: 72 },
      tabs: { width: 176, height: 64 },
    },
    defaultPlacement: { x: 16, y: 16, columns: 2, columnStep: 312, rowStep: 96, width: 296, height: 80 },
    layouts: {
      'stream-preview': { x:16, y:16, width:400, height:240 },
      'stream-sources': { x:432, y:16, width:192, height:72 },
      'stream-scenes': { x:16, y:272, width:400, height:128 },
      'stream-comments': { x:432, y:112, width:192, height:288 },
      'common-scrollbar': { x:488, y:48, width:128, height:256 },
      'common-button': { x:24, y:48, width:192, height:48 },
      'common-heading': { x:24, y:112, width:416, height:48 },
      'common-progress': { x:24, y:184, width:416, height:72 },
      'foundation-taskbar': { x:16, y:320, width:608, height:72 },
      'foundation-desktop': { x:16, y:16, width:400, height:160 },
      'foundation-icons': { x:432, y:16, width:192, height:128 },
      'foundation-notification': { x:432, y:176, width:192, height:112 },
      'foundation-wallpaper': { x:16, y:192, width:192, height:96 },
      'foundation-upgrades': { x:224, y:192, width:192, height:96 },
      'files-list': { x:16, y:160, width:608, height:224 },
      'files-back': { x:16, y:16, width:144, height:48 },
      'files-sort': { x:176, y:16, width:248, height:64 },
      'files-search': { x:16, y:80, width:400, height:72 },
      'files-large': { x:432, y:16, width:192, height:64 },
      'files-storage': { x:432, y:80, width:192, height:72 },
      'mail-list': { x:16, y:96, width:608, height:112 },
      'mail-body': { x:16, y:224, width:608, height:176 },
      'mail-reply': { x:224, y:16, width:192, height:48 },
      'mail-folders': { x:16, y:16, width:192, height:72 },
      'mail-unread': { x:432, y:16, width:192, height:64 },
      'photo-display': { x:16, y:16, width:400, height:288 },
      'photo-brightness': { x:432, y:16, width:200, height:80 },
      'photo-tone': { x:432, y:112, width:200, height:80 },
      'photo-wallpaper': { x:432, y:208, width:200, height:72 },
      'photo-crop': { x:16, y:320, width:192, height:72 },
      'photo-compare': { x:224, y:320, width:176, height:64 },
      'photo-switch': { x:416, y:320, width:208, height:64 },
    },
    preview: { iconSizes: [32, 48, 64], initialValue: 50, rangeMin: 0, rangeMax: 100, rangeStep: 25,
      timerTickMs: 1_000, calendarDays: 28, listRows: 16, clockFormat12: 12, clockFormat24: 24,
      intervals: [1, 5, 10, 30, 50, 60], themeAccents: ['#000080', '#008080', '#800000'],
      sampleItems: [0, 1, 2], fileListRepeats: 8, terminalRows: 12, processRows: 10,
      brightnessNeutral: 50, percentDivisor: 100, cropMin: 20, cropMax: 95, cropKeyStep: 5,
      storageUsed: 50, storageAfterClear: 35, slideshowMs: 1_000, processRateStep: 10,
    },
    measurement: { clicksPerSecond: 2.5, decisionSeconds: 4, guideSeconds: 15,
      partSeconds: [90, 135, 180], averageMomentum: 1.3, cursorPaybackSeconds: 120,
      maxSeconds: 86_400, targetMinutes: [40, 60] },
    canvas: { width: 640, height: 416, frameExtraWidth: 8, frameExtraHeight: 32, layerStripHeight: 40, layerStripButtonHeight: 28, inset: 8, minWidth: 72, minHeight: 32, grid: 8, resolutionGrid: [8, 4, 2, 1] },
    design: { color: '#3a3450', textColor: '#f4efe4', radius: 0, radiusMax: 24,
      fontSize: 14, fontSizeMin: 12, fontSizeMax: 28, scrollbarWidth: 16,
      scrollbarMin: 8, scrollbarMax: 32, progressHeight: 16, progressHeightMin: 8, progressHeightMax: 40, minContrast: 4.5 },
    customization: { accent: '#d0523a', background: '#3a3450', nativeBackgrounds: ['#5d6f7d', '#29292f', '#2b2b2b'], panelWidth: 256,
      panelMin: 192, panelMax: 384, gridSpacing: 8, gridMin: 4, gridMax: 32,
      fontSize: 14, fontMin: 12, fontMax: 20, maxPresets: 12 },
    skills: [
      { id: 'batch', band: 1, cost: 2 }, { id: 'dimensions', band: 1, cost: 3 },
      { id: 'layers', band: 1, cost: 1 }, { id: 'eyedropper', band: 1, cost: 1 },
      { id: 'presets', band: 1, cost: 1 }, { id: 'snap', band: 2, cost: 15 },
      { id: 'motion', band: 2, cost: 20 }, { id: 'extraParts', band: 2, cost: 15 },
      { id: 'efficiency', band: 2, cost: 10 }, { id: 'update', band: 1, cost: 3 },
      { id: 'modern', band: 2, cost: 25 },
    ],
  },
  world4: { minimumVersion: 'v2', requiredRefreshLevel: 1, refreshHz: [30, 60, 120, 240] },
  capture: {
    pixelsPerPart: 1, recyclePixelsPerPart: 0.1,
    maxElements: 1024, maxVisibleRects: 256,
    photoQualityParts: 60, photoQualityKinds: 8, photoQualityWeights: { parts: 0.6, kinds: 0.4 },
    photoControls: { brightnessMin: 0.5, brightnessMax: 1.5, brightnessStep: 0.05, toneMin: -50, toneMax: 50, cropMin: 0, cropMax: 40 },
    frameBorders: [2, 1, 1, 8], frameTopBorders: [2, 1, 1, 0], framePaddings: [0, 3, 5, 0],
    titleHeights: [18, 26, 30, 30], controlHeights: [18, 26, 20, 26],
    contentMargins: [2, 0, 0, 0], contentBorders: [1, 0, 1, 0],
    chromeControlsWidths: [54, 74, 96, 104], nativeFontPadding: 8,
    controlWidths: [16, 21, 27, 29], closeControlWidths: [16, 21, 46, 46], controlGaps: [2, 2, 0, 0],
    geometry: {
      coordinateUnit: 1 / 1024,
      windowLayer: 10, notificationLayer: 35, taskbarLayer: 40,
      shortcutWidth: 78, shortcutMinHeight: 76, shortcutCaption: 36,
      resourcePanel: { right: 16, top: 86, width: 180, height: 160, inset: 12, pixelHeight: 52, tokenHeight: 28 },
      notification: { right: 12, gap: 12, width: 364, height: 180, flatTop: 110 },
      taskbar: { productWidth: 136, controlWidth: 96, iconWidth: 18, textGap: 4, itemWidth: 64 },
      editor: { toolbarHeight: 112, paletteWidth: 44, toolWidth: 46, panelInset: 12, targetHeader: 24 },
    },
  },
  w3: {
    offerOrder: ['files', 'mail', 'jobs', 'manager', 'photo', 'bin', 'clock', 'theme', 'terminal'],
    jobUnlockCost: 730_000,
    capturePreviewDepth: 4, // Presentation-only budget for recursive screenshot references.
    apps: [
      { id: 'files', cost: 300_000 }, { id: 'sort', cost: 380_000 },
      { id: 'mail', cost: 470_000 }, { id: 'draft', cost: 590_000 },
      { id: 'jobs', cost: 730_000 }, { id: 'manager', cost: 920_000 },
      { id: 'search', cost: 1_500_000 }, { id: 'large', cost: 2_400_000 },
      { id: 'photo', cost: 4_000_000 }, { id: 'crop', cost: 6_500_000 }, { id: 'compare', cost: 11_000_000 },
      { id: 'bin', cost: 17_000_000 }, { id: 'undo', cost: 28_000_000 }, { id: 'folders', cost: 46_000_000 },
      { id: 'clock', cost: 75_000_000 }, { id: 'timer', cost: 120_000_000 }, { id: 'calendar', cost: 200_000_000 },
      { id: 'theme', cost: 320_000_000 }, { id: 'slideshow', cost: 530_000_000 }, { id: 'iconSize', cost: 860_000_000 },
      { id: 'terminal', cost: 1_400_000_000 },
    ],
    jobs: {
      tessera: { rate: 40, cost: 30_000 }, files: { rate: 150, cost: 150_000 },
      photo: { rate: 700, cost: 1_500_000 }, terminal: { rate: 6_000, cost: 40_000_000 },
    },
    cursorGrowth: 1.15, updateBase: 15, updateGrowth: 6, updateMultiplier: 2, featureMultiplier: 1.25,
    // Legacy stage6.5 measurement input; not used by current capture evaluation.
    featureParts: 2,
    autoFeedbackMultiplier:0.5, sortedMailCapacity:5, extraPosts:1, burstMultiplier:2/3,
    daylight:{morningHour:6,dayHour:10,nightHour:18,morningBrightness:1.15,dayTone:5},
    timerRequestDelayMs:300_000, timerOfflineMultiplier: 0.5, timerMaxDays: 7, terminalIntervals: [60_000, 3_600_000],
    maxVisibleJobCursors: 5, jobAnimationMs: 2_000, historyMs: 600_000, maxShotHistory: 400,
    stallMinMs: 180_000, stallMaxMs: 360_000, restartSeconds: 60,
    screensaverMs: 120_000, screensaverFrameMs: 5_000, slideshowMs: 60_000,
    maxNoteLog: 20, maxCommands: 8,
    skills: [
      { id: 'major1', band: 1, cost: 4, playful: false }, { id: 'major2', band: 2, cost: 20, playful: false }, { id: 'major3', band: 2, cost: 40, playful: false },
      { id: 'snap', band: 1, cost: 2, playful: false }, { id: 'direct', band: 1, cost: 2, playful: false },
      { id: 'burst', band: 1, cost: 4, playful: false }, { id: 'daylight', band: 1, cost: 3, playful: true },
      { id: 'posts', band: 2, cost: 15, playful: false }, { id: 'sortMail', band: 2, cost: 15, playful: false },
      { id: 'virtual', band: 2, cost: 25, playful: true }, { id: 'screensaver', band: 2, cost: 10, playful: true },
      { id: 'autoFeedback', band: 2, cost: 20, playful: false },
    ],
    enterMs: 2_000, maxPending: 3, feedbackTokens: 2, redrawCells: 10,
    shotResolutionMultiplier: 1.25,
    baseShotCapacity: 50, storageCapacityMultiplier: 2, requiredApps: 6, requiredFeedback: 10,
    maxNote: 20_000, compactCursors: 8,
  },
  longPlay:{achievementNoticeMs:4000,achievementBonus:.01,contractBonus:.05,partBonus:.005,partCap:50,shotMilestone:50,cursorBonus:.001,bulkUnlock:10,cursorLimit:10000,strayMinMs:120000,strayMaxMs:240000,strayLifeMs:30000,straySeconds:20,secretPresses:100,secretPartColor:'#c8553d',secretClockClicks:10,clockChainMs:5000,refreshCooldownMs:30000,refreshSeconds:30,soundVolume:.15,soundPerSecond:8},
  pageDesign: {
    guideDemoMs: 2200, gripOffset: 22,
    buttonFontMin:12,buttonFontMax:36,buttonMinWidth:160,buttonMinHeight:40,
    width:1920,height:920,grid:8,minWidth:320,minCanvasWidth:352,minCanvasHeight:720,maxWidth:1920,maxHeight:1080,
    layoutBreakpoint:1000,gap:16,contentInset:80,sidebarFraction:.28,
    minWidths:{heading:240,notice:240,pixels:240,generator:160,cursors:160,upgrades:288},
    minHeights:{heading:64,notice:64,pixels:48,generator:40,cursors:64,upgrades:160},
    partSizes:{
      heading:{small:{width:320,height:64},large:{width:560,height:96},extraLarge:{width:800,height:128}},
      notice:{small:{width:320,height:96},large:{width:560,height:160},extraLarge:{width:800,height:240}},
      pixels:{small:{width:320,height:48},large:{width:560,height:64},extraLarge:{width:800,height:80}},
      generator:{small:{width:160,height:40},large:{width:320,height:80},extraLarge:{width:480,height:160}},
      cursors:{small:{width:160,height:64},large:{width:320,height:96},extraLarge:{width:480,height:128}},
      upgrades:{small:{width:320,height:224},large:{width:480,height:352},extraLarge:{width:640,height:512}},
    },
    partFontSizes:{small:14,normal:18,large:28},
    recommendedHeights:{heading:80,notice:128,pixels:64,generator:160,cursors:96,upgrades:224},
    compactHeights:{heading:64,notice:96,pixels:64,generator:160,cursors:80,upgrades:160},
  },
  legacyHome:{switchRefund:20_000,sliderRefund:32_000},
  appBuild:{minWidth:160,minHeight:100,maxWidth:1920,maxHeight:1080,fontSizes:[10,12,14,16,18,20,24,28],rowHeights:[20,24,28,32,40],width:640,height:416,grid:8,bodyMinWidth:112,bodyMinHeight:64,controlMinWidth:112,controlMinHeight:48,history:30},
  appearance:{transitionMs:2_000,gessoRequirement:2,screens:[{width:800,height:600},{width:1024,height:768},{width:1366,height:768},{width:1366,height:768}]},
  release: {
    maxProductName: 20,
    base: 25, pixelUnit: 10_000, exponent: 0.4, perElement: 0.05,
    animationMs: 8_000, restartMs: 1_000,
    dailyWeights: [88, 61, 47, 38, 29, 22, 18],
    prototypeColorLevel: 1, prototypeParts: 3,
    v1RefreshLevel: 1,
    storeAnimationMs: 3_000, storeMaxScreenshots: 6,
    storeUnitPrice: 5, storeDownloadsPerDollar: 4,
    screenshotBonusMax: .1,
    contentWeights: { seedParts: 1, parts: 1, apps: 1, sets: 1 },
  },
  spec: {
    color: [
      { price: 0, multiplier: 1 },
      { price: 200, multiplier: 1.5 },
      { price: 20_000, multiplier: 2.5 },
      { price: 20_000_000, multiplier: 4 },
    ],
    resolution: [
      { price: 0, grid: 16, tokens: 1 },
      { price: 1_500, grid: 32, tokens: 2 },
      { price: 500_000, grid: 64, tokens: 3 },
      { price: 500_000_000, grid: 128, tokens: 5 },
    ],
    refresh: [
      { price: 0, multiplier: 1, animationFps: 15 },
      { price: 5_000, multiplier: 2, animationFps: 30 },
      { price: 300_000, multiplier: 4, animationFps: 60 },
      { price: 300_000_000, multiplier: 8, animationFps: null },
    ],
    memory: [
      { price: 0, posts: 3 },
      { price: 800, posts: 4 },
      { price: 40_000, posts: 5 },
      { price: 100_000_000, posts: 6 },
      { price: 5_000_000_000, posts: 8 },
    ],
    storage: [
      { price: 0, offlineHours: 2 },
      { price: 60, offlineHours: 4 },
      { price: 8_000, offlineHours: 8 },
      { price: 1_000_000, offlineHours: 12 },
      { price: 1_000_000_000, offlineHours: 24 },
    ],
    network: [
      { price: 0, mailIntervalSeconds: 240 },
      { price: 3_000, mailIntervalSeconds: 180 },
      { price: 450_000, mailIntervalSeconds: 120 },
    ],
    graphics: [
      { price: 0, shotCooldownSeconds: 30 },
      { price: 6_000, shotCooldownSeconds: 20 },
      { price: 14_000_000, shotCooldownSeconds: 12 },
      { price: 400_000_000, shotCooldownSeconds: 8 },
    ],
  },
  measurementStage8b: {
    startAt: 1_800_000_000_000,
    clicksPerSecond: 2.5, partSeconds: [90, 135, 180], decisionSeconds: 4, guideSeconds: 15,
    desktopActiveFraction: 0.5, cursorPaybackSeconds: 120, jobPaybackSeconds: 600,
    maxPhaseSeconds: 86_400, prototypeGoalMinutes: 50, v1GoalMinutes: 330,
    feedbackTrashBatch: 3, feedbackOpenWindows: 2,
  },
  estimate: { maxHours: 99, minuteRoundingAfterSeconds: 600, hourRoundingAfterSeconds: 3600, minuteStep: 60, hourStep: 600, improvement: 0.1, transitionMs: 2_000 },
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
export type SpecKey = keyof typeof BALANCE.spec;

export type DesktopUpgrade = (typeof BALANCE.w3.apps)[number]['id'];
export type DesktopSkill = (typeof BALANCE.w3.skills)[number]['id'];

export type EditorSkill = (typeof BALANCE.workshop.skills)[number]['id'];
