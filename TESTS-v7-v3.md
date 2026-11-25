# TESTS-v7-v3 — Token Launch Radar v7 variant 3: range honesty, controls, rank range

Variant 3 changes presentation only: the model is variant 2's exactly
(slope 0.45, odds B0, same 84 exact-trim comps, same FARM thresholds, same
sealed snapshot as_of 2026-11-14). Every number below is computed from the
snapshot by the measurement script
`~/workspace/makefun/tests_v7_v3_numbers.py` (writes
`tests_v7_v3_numbers.json`, authoritative). Protocols validated by
reproducing the shipped term-table rows exactly before the control rows
were added.

## 1. P1 — Is the printed range honest? (P25–P75 and P10–P90 coverage)

The shipped P10–P90 band is implied / 7.28 to × 7.28, i.e. ±1.2816 × resid
sd in log units (resid sd 1.5486). The P25–P75 band uses the same normal
convention: half-width 0.6745 × sd = 1.0445 log units, so P25–P75 =
implied / 2.84 to × 2.84. Coverage is the share of held-out comps whose
true market cap falls inside the printed band. P10–P90 was re-validated
first (LOO 63/84, WF 22/30) before the middle band was measured.

| split | n | P25–P75 (stated 50%) | P10–P90 (stated 80%) |
|---|---|---|---|
| LOO (84 trimmed comps) | 84 | **53.6% (45/84)** | 75.0% (63/84) |
| WF 2023-07-01 | 42 | 54.8% (23/42) | 73.8% (31/42) |
| WF 2024-01-01 | 36 | 50.0% (18/36) | 72.2% (26/36) |
| WF 2024-07-15 (primary) | 30 | **56.7% (17/30)** | 73.3% (22/30) |
| WF 2025-01-01 | 24 | 54.2% (13/24) | 70.8% (17/24) |

The middle half is honest (slightly wide vs the 50% stated, at every
cutoff); the outer band runs a little narrow (75.0%/73.3% vs 80% stated).
The dashboard says exactly that — "stated as measured" — and names the
leader for comparison: kiencx 49%/57% (P25–P75 LOO/WF) · 78%/76%
(P10–P90 LOO/WF), from the top-40 study notes.

## 2. P4 — Value control: 7-day growth of another row

A control term must NOT help. The control is the 7-day growth of a
different protocol (same column, wrong row — kiencx's format), added as a
free-slope OLS term with no factor, on the 84 trimmed comps. The protocol
was validated first: the script reproduces all six shipped term-table
rows exactly (LOO/WF miss 3.00/2.56, 2.91/2.40, 2.99/2.28, 2.89/2.31,
3.04/2.95, 3.10/6.01).

| term | LOO miss | LOO log-RMSE | WF miss | WF log-RMSE |
|---|---|---|---|---|
| base log-TVL | ×3.00 | 1.569 | ×2.56 | 1.402 |
| + log(1+chains) — KEPT | ×2.91 | 1.580 | ×2.40 | 1.364 |
| + control: 7d growth of another row | ×2.89 | 1.556 | ×2.54 | 1.548 |
| + control: random number (cross-check) | ×3.07 | 1.597 | ×2.48 | 1.374 |

The control does NOT win both splits: its 0.02 LOO gain over +chains is
one comp's noise, and it loses the primary walk-forward by 0.14
(2.54 vs 2.40). The random-number cross-check loses both splits. The
control row is shown in Evidence 1 with decision "must not help".

## 3. P4 — Odds control: one random-number feature (silver-ibis format)

One random-number feature (seed 11) added to the shipped 10-feature
logistic odds model, same 5-fold out-of-fold protocol and the same
primary walk-forward cutoff:

| | OOF log-loss | OOF AUC | OOF Brier | WF Brier (2024-07-15) |
|---|---|---|---|---|
| shipped B0 | 0.585 | 0.754 | 0.201 | 0.233 vs train rate 0.347 |
| + random number | 0.584 | 0.754 | 0.200 | 0.234 vs train rate 0.347 |

No gain: 0.001 on log-loss and Brier is noise, and the walk-forward Brier
is unchanged to three decimals. Shown as the 6th row of Evidence 2.

## 4. P5 — Bootstrap rank range (200 refits, seed 11)

The slope-fixed 0.45 model refit on 200 bootstrap resamples of the 84
comps; all 198 board rows re-priced from the out/data.js multipliers in
each refit. Validated by re-pricing with the shipped beta first: 0/198
rows off by more than 0.1%.

| protocol | median rank | p5–p95 | min–max | rank 1 held |
|---|---|---|---|---|
| Sentora Curator | 1 | 1–4 | 1–7 | 106/200 (53%) |
| Steakhouse Financial | 2 | 1–9 | 1–27 | 21/200 |
| USDD | 5 | 2–9 | 2–20 | 0 |
| Veda | 5 | 3–22 | 3–53 | 0 |
| Gauntlet | 6 | 3–24 | 2–60 | 0 |

Rank 1 is not a rounding artifact — Sentora holds it in 53% of refits —
but it is not certain either: the 95% range runs to rank 4, and Steakhouse
takes rank 1 in 21 refits. The dashboard states the 53% and the 1–4
range under Evidence 1.

## 5. P6 — Odds shrink sweep (SECONDARY, CLOSED — not adopted)

Category-rate shrink strength 25 / 50 / 100, same OOF + walk-forward
protocol as the shipped odds model. The gate was a primary-cutoff margin
≥ 0.14 against the train rate (best leader margins: exmachina 0.191,
europa 0.156, behzad 0.141).

| shrink | OOF log-loss | OOF AUC | OOF Brier | primary margin | holds 4/4 |
|---|---|---|---|---|---|
| 25 | 0.587 | 0.752 | 0.201 | 0.113 | yes |
| 50 (shipped B0) | 0.585 | 0.754 | 0.201 | 0.114 | yes |
| 100 | 0.584 | 0.754 | 0.200 | 0.115 | yes |

All three hold 4/4, but the best margin (0.115) is still 0.025 short of
the gate, and the OOF gain from 50 → 100 is 0.001 — noise. B0 (shrink 50)
stands; changing the odds model for 0.001 is not a variant. The sweep is
recorded in TEST_RESULTS (`v7_odds_shrink_sweep`) and the dashboard does
not mention it.
