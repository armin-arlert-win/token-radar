# TESTS-v7-v2 — Token Launch Radar v7 variant 2: slope 0.45

Variant 2 changes ONE axis from variant 1 (slope 0.40 → 0.45, odds B0 unchanged).
Everything else is identical: same 84 exact-trim comps, same odds model, same
evidence layout, same FARM thresholds, same sealed snapshot (as_of 2026-11-14).

Measurement scripts: `~/workspace/makefun/tests_v7_v2_numbers.py` (writes
`tests_v7_v2_numbers.json`, authoritative) and `/tmp/v2_chains_check.py`.
Protocols validated by reproducing the known variant-1 numbers first.

## 1. The 84 exact-trim comps (T2)

Drop the 4 lowest + 4 highest mcap/TVL ratios by rank from the 92 rule comps.
Reproduces the shipped beta exactly (5.3332, 0.6250, -0.2062). The study's T1
code gives 83 comps and the wrong beta — do not use it.

## 2. Slope 0.45 full fit (84 comps, category factor k=8)

| | slope 0.45 | slope 0.40 (v1) | free OLS 0.625 |
|---|---|---|---|
| beta (intercept, slope, chains) | 8.3732, 0.4500, -0.2179 | 9.242, 0.400, -0.2212 | 5.3332, 0.6250, -0.2062 |
| R² no-factor / with factor | 0.266 / 0.294 | 0.252 / 0.280 | 0.288 / — |
| residual sd (log, with factor) | 1.5486 | 1.5636 | 1.5261 |
| P90 factor | 7.28 | 7.42 | 7.08 |
| LOO median miss (with factor) | **×2.46** | ×2.53 | ×3.07 |
| LOO median miss (no factor) | ×2.53 | ×2.54 | ×2.91 |
| LOO log-RMSE (with factor) | 1.623 | 1.637 | — |
| LOO log-RMSE (no factor) | 1.589 | 1.604 | — |
| LOO coverage (P10-P90) | 75.0% (63/84) | 73.8% (62/84) | — |
| split-half log-RMSE (20 seeds) | **1.585** (1.402–1.814) | 1.596 (1.404–1.831) | 1.621 |
| WF median miss (3 main cutoffs) | ×2.12 | ×2.05 | ×2.40 |
| combined LOO + WF median | 4.5826 | **4.5768** | 5.471 |

0.45 wins LOO and split-half, loses all four walk-forwards to 0.40 by 0.02–0.15,
and its combined score is within 0.006 of 0.40's best. Bootstrap (200 refits,
seed 11, from v7): free slope 0.627 ± 0.092, 95% CI [0.446, 0.815] — 0.45 sits
1.90 s.e. below OLS and just inside the CI; 0.40 sits 2.45 s.e. below it and
just outside. That is the variant-2 story: the LOO winner and the defensible
slope inside the CI, as the second lottery ticket.

## 3. Walk-forward, all four cutoffs (slope 0.45)

| cutoff | train/test | WF miss | base miss | WF cov. |
|---|---|---|---|---|
| 2023-07-01 | 21 / 42 | ×2.15 (RMSE 1.4061) | ×2.55 (1.4132) | 31/42 |
| 2024-01-01 | 27 / 36 | ×2.10 (1.4413) | ×2.40 (1.4466) | 26/36 |
| 2024-07-15 (primary) | 33 / 30 | ×2.12 (1.3591) | ×2.56 (1.4015) | 22/30 |
| 2025-01-01 | 39 / 24 | ×2.47 (1.3211) | ×2.05 (1.3172) | 17/24 |

Still loses the 2025-01-01 cutoff to the base (2.47 vs 2.05), as at 0.40 (2.32)
and the free slope (2.56) — reported, not hidden. Still beats the free slope
on LOO and every walk-forward.

## 4. Category holdout (slope 0.45, base + log(1+chains), refit without the category)

Protocol validated: at 0.40 reproduces Lending 2.283/+1.141, Dexs 2.094/-0.173,
RWA 0.678/-0.440, Yield 1.413/+0.101 exactly.

| category | n | log-RMSE | bias |
|---|---|---|---|
| Lending | 14 | 2.253 | +1.116 |
| Dexs | 11 | 2.075 | -0.200 |
| RWA | 9 | 0.659 | -0.406 |
| Yield | 8 | 1.368 | +0.073 |

Lending is still the outlier (+1.116 log, vs +1.141 at 0.40): the k=8 factor
is kept to correct it.

## 5. Category-factor sweep (slope 0.45, LOO log-RMSE)

k=0: 1.785, k=2: 1.680, k=4: 1.636, k=8: 1.623, k=16: 1.589, k=32: 1.589,
k=64: 1.589, no factor: 1.589. k=8 costs 0.034 log units against no factor
and WINS on median miss (2.46 vs 2.53) — kept for the Lending bias and the
held-out median-miss win, not just for the bias.

## 6. The log(1+chains) term at slope 0.45 (no-factor comparison)

| | LOO | WF primary |
|---|---|---|
| with chains | 2.53 | 2.12 |
| without chains | 2.77 | **1.84** |

At the shipped slope the term wins LOO but LOSES the primary walk-forward
(2.12 vs 1.84). At the free slope it won both (2.91 vs 3.00, 2.40 vs 2.56).
The dashboard states this as measured — the term is kept for the LOO win,
not cherry-picked per split. (Script: `/tmp/v2_chains_check.py`.)

## 7. Odds B0 re-confirmed (unchanged from variant 1)

Python 10-feature corrected protocol, WF Brier vs train-rate baseline:

| cutoff | WF Brier | train-rate base | margin | train rate |
|---|---|---|---|---|
| 2023-07-01 | 0.267 | 0.335 | 0.068 | 0.781 |
| 2024-01-01 | 0.328 | 0.361 | 0.033 | 0.785 |
| 2024-07-15 | 0.233 | 0.347 | 0.114 | 0.732 |
| 2025-01-01 | 0.241 | 0.311 | 0.070 | 0.658 |

HOLDS 4/4. Shipped TS values 0.265/0.327/0.233/0.242 — within 0.002 of the
Python recomputation. OOF (10-feat): log-loss 0.585, AUC 0.754, Brier 0.201.
The dashboard card 2 shows the TS implementation's own OOF (0.583 / 0.757 /
0.200), which is what TEST_RESULTS.odds carries — the 0.002 gap is a GD
implementation difference, documented in the v7 corrections note.

## 8. Range coverage (slope 0.45, P10-P90 = implied / 7.28 to × 7.28)

LOO 63/84 = 75.0%, WF 22/30 = 73.3% against 80% nominal — a little too
narrow, stated as measured, in line with the leaders (kiencx 78%/76%, kevin
78%/73%, nyx77 74%/63%). Log width 3.969 (was 4.008 at 0.40).

## 9. Board churn vs variant 1 (regenerated v1 board from commit 07f3c5e)

Variant 1's board was regenerated from git history (out/ is not committed)
and matches V7-BUILD.md exactly (31/109/58, Sentora $41.7M, Bittensor EV
$15.7M), so the churn below is a clean comparison.

- Verdicts: **29 FARM / 109 THIN / 60 SKIP** (v1: 31 / 109 / 58).
  Net/hour −$19.00 to $98.33 (v1: −$18.90 to $86.22).
- FARM keeps 29 of v1's 31; **manta-cedefi and metalx-swap drop out**
  (both were v1 additions vs v6); **no new FARM enters**.
- Implied v2/v1: median 0.981, mean 0.999, min 0.910, max 1.254. The steeper
  slope redistributes value toward big-TVL protocols: the top rows rise a
  lot, the median row falls ~2%. "Implied ~5–10% higher" was wrong for the
  median — only the top is higher.
- Top implied: Sentora Curator $52.1M (was $41.7M, +25%). Top EV: Bittensor
  dTAO $17.7M (was $15.7M).
- Spot checks (implied / odds / EV / verdict / net-h): Sentora $52.1M /
  11.8% / $6.2M / THIN / $16.85 (was $9.44). Steakhouse $44.4M / 20.9% /
  $9.3M / THIN / $47.48 (was $36.22). Veda $33.8M / 43.3% / $14.6M / THIN /
  $79.46 (was $63.69), drop $219 (was $180). Gauntlet $33.3M / 17.5% /
  $5.8M / THIN / $26.70 (was $20.40). Polymarket $28.7M / 60.9% / $17.5M /
  FARM / $96.76 (was $85.58). DeFi Saver $17.7M / 82.7% / $14.6M / FARM /
  $67.66 (was $58.64). USDD $37.3M / 41.7% / $15.6M / THIN / $91.12 (was
  $76.17). Bittensor $29.6M / 59.9% / $17.7M / FARM / $98.33 — still the top
  net/hour. Odds are unchanged on every row (odds do not depend on slope).
- Verdict sweep: $15/h → 46 FARM, $25/h → 29, $40/h → 15, $60/h → 6.
  Odds floors at net/h ≥ $25: 0.40 → 32 (enters usdd, veda, doppler-finance),
  0.45 → 29, 0.50 → 29 (none leave).
- Literal implied rule (no odds floor): 126 FARM / 69 THIN / 3 SKIP (v1:
  136 / 62 / 0). Protocol validated by reproducing v1's 136/62/0 exactly.
- Break-even odds: median 20.1%, p90 51.7% (linear percentile), 27 rows
  need > 45%, **3 rows need > 100%** — mev-capital 105.8%,
  flying-tulip-ftusd 105.5%, damm-capital 103.8%. Variant 1 had none above
  100% (worst 99.3%). Even a certain launch does not cover the fee on those
  three rows; the dashboard states this.
- Capital charge still $0.15–$0.46 and flips no verdicts. The $962 charge on
  Veda's standard stake is still more than 4× its $219 drop.
- Gate checks on the built board: 198 rows, sorted by implied desc; EV ranks
  a 1..198 permutation; watchlist 40/40 (checked against the snapshot's
  watchlist array); farm steps 6/row, 136–251 chars; dashboard 65,392 /
  65,536 bytes (144 free); determinism 3× byte-identical incl. dossier.json.

## 10. What variant 2 does NOT change

Odds B0, evidence layout, FARM thresholds, snapshot, board size, watchlist,
farm-step format, self-check strip (8/8 PASS — row 1 re-priced against the
new implied values). The only model change is the slope and its refit
constants.
