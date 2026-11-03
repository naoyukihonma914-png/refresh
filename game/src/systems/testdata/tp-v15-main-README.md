# TP: authentic main schema15 input records

These six saves were generated on 2026-11-03 from **main `b508fb9`**, including PR #22 (fixed cursor dimensions) and PR #23 (desktop-screen naming and larger generator), before TP source changes.

The source was read using `git archive b508fb9 game` into `/tmp/tp-acceptance-main-b508fb9`. An independent Vite SSR process loaded the archived `systems/fixtures`, `state`, `pageDesign`, `desktop`, `save`, and `seed`. Every input passed that source's `isGameState`, `encodeSave`, and `decodeSave`, with `schemaVersion === 15`, before gzip. No new-format object had its version number changed backwards.

The fixed game timestamp is `1800000000000`. Debug budgets are fixture inputs, not measured play times or balance changes. The compressed JSON is an immutable old input for migration tests.

| File | Original state | Version | Workshop parts | Photos |
|---|---|---|---:|---:|
| tp-v15-main-seed-before-layout.json.gz | seed | v0.1 | 0 | 0 |
| tp-v15-main-seed-custom-layout.json.gz | seed | v0.1 | 0 | 0 |
| tp-v15-main-seed-inherited-layout.json.gz | seed | v2 | 0 | 0 |
| tp-v15-main-workshop-mid.json.gz | kumiki | v0.1 | 49 | 0 |
| tp-v15-main-desktop-records.json.gz | desktop | v1 | 31 | 3 |
| tp-v15-main-shipping.json.gz | release | v1 | 47 | 5 |

## How the states were constructed

- `seed-before-layout`: archived `createFixture('stage8a-seed-layout-before', now)`; color/font are made, layout is not.
- `seed-custom-layout`: archived `createFixture('seed-layout', now)`, then the real `actPageDesign` actions. The old generator container is `{x:192,y:480,width:1040,height:256}`, with old button `{width:400,height:96}`; background navy, text white, heading monospace. This deliberately exercises the old combined resources/generator/cursor container.
- `seed-inherited-layout`: the same custom page in v1, 100 fixture tokens, real `applySeedSkills(['inherit'])`, then `createSeedVersion(...,'v2')`. It starts with no constructed items, but an inherited custom layout. A migration must recognize that the player has already used layout instead of replaying a first-ever guide.
- `workshop-mid`: archived `createFixture('stage8a-part-files-sort-step-3-era1', now)`; paid materials and the selected sort part await real stage-four inspection.
- `desktop-records`: archived `createFixture('stage8b-files-archive-era2', now)`. The archived decoder read the existing genuine `v7-two-shots.json.gz`; its two immutable historical shots were copied into the save, and archived `takeScreenshot` created one format11 shot. This tests old four-part page/capture readers as well as a current source graph. Old screenshot data bytes must survive migration.
- `shipping`: archived `createFixture('stage7-sales-gen2', now)`; v1.0 shipping, frozen products and five screenshots.

Only the archived modules generated and validated these inputs. The new runtime must not import the old source. Tests should load the gzip as data, retain wallets/specs/skills/production/documents/products and screenshot data, then verify the migrated page geometry and records.

## SHA-256

```
1cf0ed8e1172820a88785fff802d773745cab70b340163f86c97e9223e5b9ce5  tp-v15-main-seed-before-layout.json.gz
20d93c8dbfeec60c482b02daa73e2817369f0b120ac2d0568b3d23eea7484f10  tp-v15-main-seed-custom-layout.json.gz
b129276317c303f04484dc6023a5a41cb354683ad2aba3501816e16d32a0981b  tp-v15-main-seed-inherited-layout.json.gz
24a5a5fc06c341f4dd4e83b57f085ac1142b9647f514b70b2e4ba28fcf46156b  tp-v15-main-workshop-mid.json.gz
f3a8ce1a93de55d603f031d5c874c2402836cfae072a8e71273c456ed095b027  tp-v15-main-desktop-records.json.gz
fb388a5fefcf82595a47da8b8ece8fad967cf3b71da01048387afcc36fbad0a5  tp-v15-main-shipping.json.gz
```
