# Frozen schema14 saves

The three `v14-stage8a-*.json.gz` files were generated from the published main commit `1f0d72a` (PR18 + PR19), before the stage8b source changes. The original commit's `createFixture` and `isGameState` were loaded through Vite SSR from a read-only `git archive`, then JSON was gzipped. Fixtures: `stage8a-part-common-frame-step-2-era0`, `stage8a-desktop-common-custom-era1`, and `stage7-store`, with the fixed test timestamp 1800000000000.

They are immutable old input records, not new-format objects with a changed schemaVersion. Tests verify schema15 migration preserves wallets, production, set documents, native window state, screenshots, released products, and repeat save/load. No historical game code is loaded by the new runtime.
