# Token Launch Radar v7 — test record

Measurement scripts: `~/workspace/makefun/tests_v7_numbers.py` (+ `tests_v7_numbers.json`, authoritative),
`tests_v7_slope.py`, `tests_v7_odds.py` (corrected protocol), `tests_v6_odds.py`, `tests_v6_odds_verify.py`,
`tests_v5_experiments.py`, `tests_v5_constants.py`. The shipped TS model was also run directly
(`v7-ts-odds-check.ts`, deleted before commit) to measure the exact numbers the dashboard ships.

## 1. Exact-trim definition (84 comps)

Drop the 4 lowest + 4 highest mcap/TVL ratios **by rank** from the 92 rule comps. This reproduces the
shipped V6 beta exactly ([5.3332, 0.6250, −0.2062]). The study's T1 code (`hi = ratios[86]`) gives 83 comps
and the wrong beta ([5.0191, 0.6411]); `np.percentile` gives 82 comps ([4.6633, 0.6579]).

## 2. Slope grid (84 exact-trim comps, k=8 category factor)

Median miss = exp(median |log error|). WF = listing-date walk-forward, median of the three main cutoffs
(2024-07-15 / 2024-01-01 / 2025-01-01). Combined = LOO miss + WF median miss. The adoption rule: minimise
the combined score AND beat the free slope on LOO and all three WFs.

| slope | LOO miss (f / no-factor) | LOO log-RMSE (f / nf) | WF 2024-07-15 | WF 2024-01-01 | WF 2025-01-01 | WF median | Combined |
|------:|-------------------------:|----------------------:|--------------:|--------------:|--------------:|----------:|---------:|
| 0.35 | 2.58 / 2.58 | 1.656 / 1.623 | 2.09 | 2.10 | 2.44 | 2.10 | 4.68 |
| **0.40** | **2.53 / 2.54** | **1.637 / 1.604** | **2.05** | **2.02** | **2.32** | **2.05** | **4.58** |
| 0.45 | 2.46 / 2.53 | 1.623 / 1.589 | 2.12 | 2.10 | 2.47 | 2.12 | 4.58 |
| 0.50 | 2.55 / 2.66 | 1.611 / 1.578 | 2.20 | 2.15 | 2.64 | 2.20 | 4.75 |
| 0.55 | 2.68 / 2.73 | 1.604 / 1.571 | 2.33 | 2.49 | 2.67 | 2.49 | 5.17 |
| free (0.625) | 3.07 / 2.91 | 1.613 / 1.580 | 2.40 | 2.15 | 2.56 | 2.40 | 5.47 |

- **Decision: slope 0.40 for variant 1.** Exact tie-break vs 0.45: combined 4.5768 vs 4.5826 (with factor),
  4.5884 vs 4.6520 (no factor); 0.40 wins all three WFs and the 4th cutoff (2023-07-01: 2.13 vs 2.15).
  0.45 wins only LOO (2.46 vs 2.53). 0.50/0.55 fail the rule (WF0101 ties, WF2501 worse than free).
- Shipped beta at 0.40: intercept 9.2420, chains −0.2212, R² 0.252 (no-factor convention; with factor 0.280),
  resid sd (with factor) 1.5636, P90 factor ×7.42.
- WF value at 0.40, all 4 cutoffs (with factor; no-factor WF is identical on median miss): 2023-07-01
  train 21 / test 42, ×2.13 (RMSE 1.4129) vs base ×2.55 (1.4132), coverage 30/42; 2024-01-01 27/36, ×2.02
  (1.4528) vs base ×2.40 (1.4466), cov 25/36; 2024-07-15 33/30, ×2.05 (1.3692) vs base ×2.56 (1.4015),
  cov 21/30; 2025-01-01 39/24, ×2.32 (1.3439) vs base ×2.05 (1.3172) — **loses to base**, as at the free
  slope. Range coverage: LOO 62/84 (73.8%), WF 21/30 (70.0%, train-sd protocol).
- **Bootstrap s.e. (200 refits, seed 11):** free slope 0.627 ± 0.092, 95% CI [0.446, 0.815]. 0.40 is 2.45 s.e.
  below the OLS estimate 0.625 and just outside the 95% CI; 0.45 sits just inside it. The shipped slope is
  chosen on held-out miss, not in-sample fit — the dashboard says so plainly.
- **Split-half (20 seeds):** slope 0.40 log-RMSE mean 1.596 (range 1.404–1.831) vs flat 1.815; free slope 1.621.
- **Category holdout at 0.40** (bias = mean predicted − actual, v5 convention): Lending n=14, RMSE 2.283,
  bias +1.141; Dexs n=11, 2.094, −0.173; RWA n=9, 0.678, −0.440; Yield n=8, 1.413, +0.101. Lending bias is
  slightly larger than v5's +1.068 — the factor justification stands.
- **Category-factor sweep at 0.40** (LOO log-RMSE, factors refit in-fold): k=0: 1.804, k=2: 1.691, k=4: 1.649,
  k=8: 1.637, k=16: 1.604, k=32: 1.604, k=64: 1.604, no factor: 1.604. The factor costs 0.033 log-RMSE and is
  tied on median miss (2.53 vs 2.54) — kept only for the Lending-bias correction.
- **Flat baselines — two definitions, do not confuse them.** The shipped flat (dashboard + TEST_RESULTS) is
  the **constant median-log-mcap** predictor: LOO log-RMSE 1.817, median miss ×3.12. `tests_v7_numbers.py`
  also measures a **median-ratio flat** (predict mcap = median train mcap/TVL × TVL): LOO median miss ×4.49,
  log-RMSE 1.661. Only the constant flat appears on the dashboard.

## 3. Odds B0 vs B2 (corrected protocol)

The study's odds table was invalid: its script used a hardcoded 0.5488 fallback for categories absent from
the fitting set; `lib/model.ts` `catRateFor` falls back to the fitting set's base rate. 16 test protocols at
the primary cutoff have categories absent from train — the wrong fallback cost ~0.017 Brier and ~0.044 AUC.
Corrected protocol (fallback = fitting-set base; OOF category rates per fold-train) reproduces the shipped TS
model exactly (verified by running `lib/model.ts` directly).

| model | OOF log-loss | OOF AUC | OOF Brier | WF Brier vs test-mean (passes) | WF Brier vs train-rate (passes) |
|-------|------------:|--------:|----------:|-------------------------------:|--------------------------------:|
| **B0 (shipped, 10 feats)** | **0.585** | **0.754** | **0.201** | 1/4 (primary only) | **4/4** |
| B2 (no age bands, 5 feats) | 0.613 | 0.717 | 0.213 | 2/4 (primary + 2025-01-01) | 4/4 |

- **Adoption rule for B2:** OOF log-loss worsens ≤ 0.01 AND passes ≥ 2/4 vs test-mean. B2 worsens 0.028 —
  **rule FAILS, B0 kept.** (B0 and B2 WF are identical at 3 cutoffs because age bands are constant in those
  train cohorts — all train protocols 730+ days old, band weights fit to 0; bands only matter at 2025-01-01.)
- Odds WF, shipped TS values (what the dashboard shows):

| cutoff | train n / rate | test n / rate | WF Brier | train-rate Brier | margin | test-mean Brier | WF AUC | WF log-loss |
|--------|--------------:|--------------:|---------:|-----------------:|-------:|----------------:|-------:|------------:|
| 2023-07-01 | 128 / 0.781 | 357 / 0.490 | 0.265 | 0.335 | 0.070 | 0.250 | 0.667 | 0.728 |
| 2024-01-01 | 172 / 0.785 | 313 / 0.447 | 0.327 | 0.361 | 0.033 | 0.247 | 0.605 | 0.891 |
| 2024-07-15 | 239 / 0.732 | 246 / 0.407 | 0.233 | 0.347 | **0.114** | 0.241 | 0.626 | 0.662 |
| 2025-01-01 | 322 / 0.658 | 163 / 0.387 | 0.242 | 0.311 | 0.070 | 0.237 | 0.615 | 0.698 |

- Primary-cutoff margin 0.114 ≈ kiencx 0.105 / kevin 0.119.
- **Cross-implementation agreement:** an independent Python reimplementation scores WF Brier 0.267/0.328/
  0.233/0.241 and WF log-loss 0.735/0.896/0.662/0.694 — within 0.002 Brier and 0.007 log-loss of the shipped
  TS values. The dashboard shows the shipped TS values everywhere.
- **train_token_rate corrections** (confirmed by two independent implementations, Python + TS):
  2023-07-01: **0.781** (100/128; model.ts said 0.852); 2024-01-01: **0.785** (135/172; model.ts said 0.791);
  2024-07-15: **0.732** (175/239 — model.ts correct); 2025-01-01: **0.658** (212/322; model.ts said 0.689).
- Dashboard OOF numbers (0.583 / 0.757 / 0.200) come from the 11-feature verify-script builder, which carries
  a duplicated miss column (5 age bands incl. missing band + a separate miss indicator); the shipped
  10-feature TS model scores 0.585 / 0.754 / 0.201. Difference 0.002, documented in the method panel.

## 4. Farm capital charge (slope 0.40, B0 odds, from the V6 board)

| variant | charge base | FARM / THIN / SKIP | net/h min | net/h max |
|---------|------------|-------------------:|----------:|----------:|
| A (rejected) | 2%/yr on the standard stake (0.02% TVL) over 8 weeks | 9 / 81 / 108 | −$669.16 | $49.60 |
| **B (shipped)** | 2%/yr on the plan minimum capital ($50/$100/$150/$250 by TVL tier) | **31 / 109 / 58** | **−$18.90** | **$86.22** |
| C (no charge) | — | 31 / 109 / 58 | −$18.84 | $86.34 |

- Variant A collapses FARM because the charge scales with TVL (deposit = 0.02% TVL) while the expected drop
  does not (drop = EV × 7.5% × 0.0002, independent of TVL) — e.g. Veda: $962 charge vs $439 drop at V6
  numbers ($180 at V7). The standard stake is a pro-rata pricing share, not deployed cash — the V6 app.js
  comment already said a charge on it "would dwarf the drop".
- Variant B charge on this board: $0.15–$0.46 (no board row reaches the $250 tier; max TVL Sentora $2.76B →
  $150 tier → $0.46). Charge flips zero verdicts vs no-charge.
- Variant A FARM slugs: lofty, nado-spot, project-x, xrpl-dex, agni-finance, fstswap, marginfi-lending,
  manifest-trade, katana-dex.

## 5. Verdict sweep + breakeven (V7 board, 198 rows)

- Net/h thresholds at odds ≥ 45%: $15 → 47 FARM, $25 → 31, $40 → 13, $60 → 5.
- Odds floors at net/h ≥ $25: 0.40 → 34 (enters usdd, veda, doppler-finance), 0.45 → 31, 0.50 → 31 (none leave).
- Literal implied formula (no odds): 136 FARM / 62 THIN / 0 SKIP.
- Breakeven odds (numpy median / linear p90): median 19.9%, p90 50.1%, max 99.3% (mev-capital); 27 rows
  >45%, 0 rows >100%. (First written 19.8%/49.8% with the lower-index convention; corrected to the standard
  convention in this build.)

## 6. Board checks (built board.json, /tmp/v7out4)

- 198 rows, sorted by implied value desc; EV ranks a 1–198 permutation; watchlist 40/40 (data.js).
- Verdicts 31 / 109 / 58; net/h −$18.90 to $86.22; capital charge $0.15–$0.46 on every row.
- All 198 rows have exactly 6 farm steps, 136–251 chars each (gate: 20–600).
- 7D nulls: 2 rows (render "n/a"); Age nulls: 7 rows (render "unknown").
- Top-10 implied / EV and per-protocol figures: see V7-BUILD.md.

## 7. Byte budget, determinism, gate, screenshots

- Dashboard: **65,380 / 65,536 (156 bytes free)** — index.html 453 + app.js 54,511 + app.css 10,416.
  (V6: 64,477. P3–P5 cost ~900 net; funded by ~1,590 bytes of method-panel trims.)
- Determinism: three `main.ts` runs byte-identical (`diff -r` empty, incl. dossier.json); the repo `out/`
  matches the /tmp runs.
- Kit check (`node cli/makefun.mjs check --kit . --repo ../token-radar-01`, with and without `--worktree`):
  **4 passed, 1 failed, 15 skipped, 5 checked at submission** — same pattern as V6. The 1 failed is
  `transcripts_present` (expected: no bundle yet, build-only task). The 4 passed: competition_open,
  snapshot, license_osi, entrypoint.
- Self-check strip in the rendered page: **8/8 PASS** (watchlist 40/40, board sorted by implied, EV ranks
  1–198, row 1 re-priced $41.7M, 198/198 farm plans have 6 steps, P10–P90 LOO coverage 73.8%, WF coverage
  70.0%, value model fitted on 92 rule comps).
- No console errors on page load (Playwright check, `~/workspace/makefun/.shot/v7_page_check.mjs`).
- Screenshots (Playwright, `~/workspace/makefun/.shot/shots.mjs`, from the final dashboard, viewed personally):
  1-board.png 383,963 B (cover + Evidence 1 + scatter + 4 board rows, no scroll), 2-detail.png 253,663 B
  (Veda drawer: capital-charge line "$0.46", net $159, net/h $64/h), 3-filtered.png 214,124 B (FARM filter:
  31 rows shown). All ≤512 KiB, long side 1440.
- Method tab + Evidence 2/3 verified rendered (text dumps /tmp/v7_method.txt, /tmp/v7_evidence_rest.txt).

## 8. Corrections log (what V7 fixed in the record)

- Shipped WF ×2.29 was a stale-variable bug in `tests_v5_constants.py` (reused the LOO loop's fit); the
  reproducible WF15 is ×2.40. The "factor helps WF (2.40 → 2.29)" claim is withdrawn.
- Study's odds table invalid (0.5488 fallback bug); corrected numbers in §3.
- Study's trimming code (T1) gives 83 comps; correct exact-trim (T2) gives 84 (§1).
- "11 features" odds variant has a duplicated miss column; shipped TS model has 10 features (§3).
- Breakeven median/p90 convention corrected to numpy median / linear p90 (§5).
