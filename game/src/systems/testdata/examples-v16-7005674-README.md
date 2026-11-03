# Examples: authentic schema16 saves from 7005674

These six immutable inputs were generated on 2026-11-03 from **commit `70056745bcffd8afce225a90e3b3628069f568c0`**, the TP-1..TP-3 checkpoint before the examples/combo implementation.

`git archive 7005674 game` was extracted into `/tmp/examples-baseline-7005674`; an independent Vite SSR process loaded only those archived fixtures/domain reducers/validator/save codec. Every state passed that source's `isGameState`, `encodeSave`, and `decodeSave`, with `schemaVersion === 16`. The JSON roundtrip was compared as structured values. No schema17 state had its version number rewritten. `persistent.examplesEnabled` and `run.workshop.combo` do not exist in these source saves.

The deterministic timestamp is `1800000000000`. Fixture debug budgets skip waiting; they are not timing measurements or balance adjustments. Only the gzip data is used by the new runtime/tests, never the archived implementation.

| Input | World/version | Workshop parts | Photo formats | Frozen products |
|---|---|---:|---|---:|
| examples-v16-7005674-desktop-records.json.gz | desktop/v1 | 31 | 1, 1, 11, 12 | 0 |
| examples-v16-7005674-next-run.json.gz | seed/v2 | 0 | 12, 12, 12, 12, 12 | 1 |
| examples-v16-7005674-seed-customized.json.gz | seed/v1 | 0 | none | 0 |
| examples-v16-7005674-shipping.json.gz | release/v1 | 47 | 12, 12, 12, 12, 12 | 1 |
| examples-v16-7005674-workshop-step2.json.gz | kumiki/v1 | 17 | none | 0 |
| examples-v16-7005674-workshop-step3-free.json.gz | kumiki/v2 | 5 | none | 0 |

## Rebased checkpoint

After PR #24 was rebased onto main `15405ab` (PR #25), the same TP-3 source is available at **`9c1096645c53b996da1665ea0c2b53ca702bd579`**. Its `game` tree is `2f9c31b04f202fa29a7900ace15cbf305a3b6d44`, identical to the original `7005674:game`. To reproduce the archived input generator after the branch history changes, use `git archive 9c1096645c53b996da1665ea0c2b53ca702bd579 game`. The input names and gzip bytes keep their original provenance.

## Construction

- `seed-customized`: archived `tp1-stable-era1`, followed by real page actions: generator extra-large, heading text size large, heading monospace, navy background/white text, and a custom heading. The six independent page parts and prior layout-onboarding history remain intact.
- `workshop-step2`: archived `tp3-progress-11-era1`, buy the file set, select/place `files-sort`, add every required element, and adjust radius to 8 with shadow enabled. It awaits adjustment confirmation at step2; its nonstandard design must not silently reset when examples are first enabled by migration.
- `workshop-step3-free`: archived `tp3-finish-common-progress-era2`, then real adjustment actions for radius8/shadow. Four previous pieces are complete; this one awaits the native fill-bar finish operation.
- `desktop-records`: the archived schema16 decoder imports the genuine schema15 desktop record fixture (two format1 captures and one format11 capture), then archived `takeScreenshot` adds a genuine format12 capture. Migration must preserve every historical `data` string byte-for-byte.
- `next-run`: archived `tp3-second-run-era2` uses actual product release/shipping/spec purchase/next-version actions. It contains the frozen v1.0 product and its photos, while the new v2 starts with no made seed items or workshop pieces.
- `shipping`: archived `stage7-sales-gen2`, with the frozen product/report, five captures, and earned wallet. Adding examples/combo fields must not rewrite product or screenshot payloads.

## SHA-256

```
064fabc65e5099096879d9223304d687d9228ea35a8023551c841f8effcf2894  examples-v16-7005674-desktop-records.json.gz
9fa6eeca2331fc10211402b8d56654b9e7521c4e9ef94fe33d422878e3ff5d98  examples-v16-7005674-next-run.json.gz
e4cdf99c47853dc92505dd16c991026c53a6330831b2a61a728615efd193ec70  examples-v16-7005674-seed-customized.json.gz
42118fbda172e00c551a9d3f8dd52ac41256b5fe09545881ca8e50f4105f103f  examples-v16-7005674-shipping.json.gz
0adb70b90c8fb7859f0f20b647de7ac38dd8827c9d5dd850b5d92ae8556558a7  examples-v16-7005674-workshop-step2.json.gz
492f37c3b0a3a502a258c84543ea7b53e75e9e72446521f9b2a6ee2318911b15  examples-v16-7005674-workshop-step3-free.json.gz
```
