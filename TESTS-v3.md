# Held-out tests v3 — Token Launch Radar (radar-v3)

Computed from `snapshot.json` (DefiLlama, as_of 2026-11-14, 758 protocols) with the
analysis scripts `/home/hatch/workspace/makefun/tests_v3_calibration.py` and
`tests_v3_sweep.py` (NumPy, no sklearn). Numbers below are the actual outputs.
The value model, odds logistic and verdict rule are UNCHANGED from v2 — v3 is a
"tested and kept" release: three calibration candidates, a verdict-threshold sweep
and a category-factor ranking test were all run, and all three decisions came out
"keep what v2 had", for reasons shown below rather than assumed.

## 1. Odds calibration: three candidates tested, none adopted

Protocol (this matters for reproducibility): 5-fold out-of-fold, seed 7, the same
folds as v2; split-half, 20 seeds, same seed sequence as v2. Each calibrator is
fitted INSIDE each training fold, on that fold's inner 5-fold out-of-fold logits
— the test fold is never touched by the calibrator. Features match the shipped
model exactly (7d growth clamped −60..+30%, 600 gradient-descent iterations),
which is why the raw baseline here reads 0.5863 / 0.5876 rather than v2's
0.586 / 0.590 (v2's Python script used the +120% growth cap and 400 iterations
for its split-half; the shipped TypeScript model always used +30% / 600).

| Candidate | 5-fold OOF log-loss | 5-fold OOF Brier | 5-fold OOF AUC | 5-fold OOF ECE | Split-half log-loss | Split-half Brier |
|---|---|---|---|---|---|---|
| **Raw logistic (adopted)** | **0.5863** | **0.1991** | **0.763** | 0.0387 | **0.5876** | **0.2001** |
| Platt scaling (a·logit + b) | 0.5880 | 0.2001 | 0.762 | 0.0492 | 0.5894 | 0.2010 |
| Isotonic regression (PAVA) | 0.6190 | 0.2013 | 0.757 | 0.0311 | 0.6291 | 0.2027 |
| Shrinkage to base rate, w = 0.9 | 0.5843 | 0.1993 | 0.763 | 0.0440 | 0.5862 | 0.2003 |

- **Platt: rejected.** Worse than raw on log-loss AND Brier in BOTH protocols
  (OOF 0.5880 vs 0.5863; split-half 0.5894 vs 0.5876), and worse on ECE too.
  Its fitted slopes (0.82–0.95 per outer fold; full-fit a = 0.945, b = 0.008) are
  close to the identity — there is almost nothing for Platt to fix, and the
  little it does is in the wrong direction out of sample. It does lift the
  bottom decile (0.122 → 0.149 predicted vs 0.227 observed) but overshoots the
  second decile (0.312 vs 0.237 observed) to pay for it.
- **Isotonic: rejected, clearly.** Log-loss 0.6190 OOF / 0.6291 split-half — far
  worse than raw. Its full-fit breakpoints are degenerate (a run of 1.0s from
  x = 0.893 upward: every high-odds protocol mapped to certainty), which is
  textbook overfitting on n = 758. Its ECE is the best of the four (0.0311),
  which shows why ECE alone must not decide: isotonic buys decile-averaged
  calibration by destroying per-observation likelihood.
- **Shrinkage w = 0.9: rejected as noise.** It is the only candidate that improves
  OOF log-loss at all (−0.0020) and it does so in both protocols (−0.0014
  split-half), but its Brier does NOT improve (0.1993 vs 0.1991 OOF; 0.2003 vs
  0.2001 split-half), its ECE is worse (0.0440 vs 0.0387), and the paired
  per-observation log-loss difference is indistinguishable from zero:
  mean −0.00206, SE 0.00318, paired t = −0.65, bootstrap 95% CI (−0.0086,
  +0.0037); only 30% of observations improve. Adopting it would be fitting
  noise. (w = 0.95 gives the same OOF log-loss, 0.5843, with the same problems.)
- **Decision: keep the raw v2 logistic odds, uncalibrated.** The under-predicted
  bottom decile (predicted 0.122 vs observed 0.227) stays visible in the
  dashboard's calibration table instead of being papered over by a recalibration
  that does not earn its keep.

OOF calibration deciles (raw logistic, unchanged from v2):

| Decile | Predicted | Observed |
|---|---|---|
| 1 | 0.122 | 0.227 |
| 2 | 0.284 | 0.263 |
| 3 | 0.394 | 0.355 |
| 4 | 0.475 | 0.408 |
| 5 | 0.539 | 0.513 |
| 6 | 0.602 | 0.613 |
| 7 | 0.662 | 0.618 |
| 8 | 0.729 | 0.737 |
| 9 | 0.793 | 0.829 |
| 10 | 0.890 | 0.921 |

## 2. Verdict-threshold sweep: 45% kept, and why

The v2 rule: FARM when EV ≥ $12.5M and odds ≥ 45%; THIN when EV ≥ $2.5M and
odds ≥ 35%; else SKIP. Swept on the 213 board rows (raw logistic odds).

### Sweeping the FARM odds floor (EV tier $12.5M, THIN fixed)

| Odds floor | FARM | THIN | SKIP | Change vs 45% |
|---|---|---|---|---|
| 30% | 14 | 70 | 129 | + Gauntlet, + Steakhouse Financial |
| 35% | 13 | 70 | 130 | + Steakhouse Financial |
| 40% | 12 | 71 | 130 | none |
| **45%** | **12** | **71** | **130** | — |
| 50% | 10 | 73 | 130 | − onre (48.6%), − upshift (45.8%) |

### Sweeping the FARM EV tier (odds floor 45% fixed)

| EV tier | FARM | THIN | SKIP |
|---|---|---|---|
| $5M | 39 | 44 | 130 |
| **$12.5M** | **12** | **71** | **130** |
| $25M | 3 | 80 | 130 |
| $50M | 1 | 82 | 130 |

### The break-even calculation — and what it actually shows

Break-even odds = farm cost / implied value. On the whole board:

| | Break-even odds |
|---|---|
| Maximum (swan-dao: $50 cost, $2.14M implied) | **0.0023%** |
| Median | 0.00037% |
| 90th percentile | 0.0011% |
| Veda (top EV) | 0.00002% |
| Steakhouse Financial | 0.00001% |

The farm cost NEVER binds: the largest break-even odds on the board is
0.0023%, about 19,300× below the 45% floor. So the original idea — "FARM
should mean odds above break-even with a margin" — does not justify any
threshold in the 30–50% range, because break-even is vacuous at these implied
values. Stating that plainly matters: any threshold defended as "covering the
$20–50 gas" would be false. The 45% floor is instead a **likelihood standard**:
FARM means the token is at least roughly even-money — 50% minus ~5 points of
calibration slack, since the middle deciles over-predict by 4–7 points
(D3: 0.394 predicted vs 0.355 observed; D4: 0.475 vs 0.408), so a nominal
45% is roughly 40% in truth. And the sweep shows the choice is robust rather
than knife-edge: 40% and 45% give the identical FARM set; only dropping to
30% changes anything, and what it admits is exactly the two Risk Curators
(Steakhouse 36.6%, Gauntlet 30.5%) whose category peers record a token only
12.8% of the time — the rows the odds model exists to flag. Raising to 50%
drops two legitimate rows (onre 48.6%, upshift 45.8%). The EV tier is the
sensitive knob instead: $5M makes 39 rows FARM (indiscriminate), $25M leaves
3, $50M leaves only Veda.

**Decision: keep 45% / $12.5M / THIN 35% / $2.5M.** Gauntlet being SKIP at EV
rank 4 is the rule working as designed, not an oversight.

## 3. Category-factor k: ranking impact, not just LOO

v2's LOO sweep said no factor is best by LOO (1.618 vs 1.629 at k = 32 vs
1.642 at k = 8). v3 asks what dropping it does to the BOARD. Same odds,
implied recomputed under each k:

| Comparison | Rows moving > 10 EV ranks | Largest EV-rank move | Top 10 EV set |
|---|---|---|---|
| k = 32 vs k = 8 | 28 | 33 (bitget-sol 111 → 78) | identical |
| No factor vs k = 8 | 53 | 44 (stkesol-by-sol-strategies 119 → 75) | identical |

The big movers are Liquid Staking rows moving UP when the factor weakens
(bitget-sol, stkesol-by-sol-strategies, stakee, crypto.com-liquid-staking,
hubra-staked-sol, sceptre-liquid, hylo-lsts, marginfi-lst, exinpool — all
+25 to +44 EV ranks with no factor), because their k = 8 factor is 0.454 and
removing it roughly doubles their implied value. That is the known systematic
bias returning: the category holdout shows the global fit overpredicts Liquid
Staking by +0.830 log (~2.3×) and Lending by +0.913 log (~2.5×). Implied-rank
moves are larger still (47 rows > 10 at k = 32, 59 with no factor, max 70).
The top 10 EV rows are the same set under all three — the k decision changes
the middle of the board, not the headline.

**Decision: keep k = 8.** The LOO price is 0.024 log units (~1.5% of RMSE)
against a correction of a known, directional 2.3–2.5× overprediction of two
whole categories. Moving to k = 32 would buy only 0.013 LOO while giving
back most of the correction (Lending factor 0.882 vs raw 0.611).

## 4. Board v3 vs v2

Nothing in the scoring code changed, so the board is identical to v2 except
the version label and the test data carried in `data.js`:

| | v2 | v3 |
|---|---|---|
| Board rows | 213 (40 + 173) | 213 (40 + 173) |
| Top EV | Veda $67.1M | Veda $67.1M |
| Verdicts | FARM 12 / THIN 71 / SKIP 130 | FARM 12 / THIN 71 / SKIP 130 |
| Odds | raw logistic | raw logistic (calibration rejected) |
| Category factor | k = 8 | k = 8 (ranking impact measured) |

Top 10 by EV (unchanged):

| EV# | Slug | Implied | Odds | EV | Verdict |
|---|---|---|---|---|---|
| 1 | veda | $114.5M | 0.586 | $67.1M | FARM |
| 2 | steakhouse-financial | $166.5M | 0.366 | $60.9M | THIN |
| 3 | usdd | $87.7M | 0.543 | $47.6M | FARM |
| 4 | gauntlet | $114.9M | 0.305 | $35.0M | SKIP |
| 5 | upshift | $54.7M | 0.458 | $25.0M | FARM |
| 6 | bittensor-dtao | $47.9M | 0.509 | $24.4M | FARM |
| 7 | plume-vaults | $34.4M | 0.658 | $22.6M | FARM |
| 8 | opentrade | $37.4M | 0.593 | $22.1M | FARM |
| 9 | lightning-network | $27.4M | 0.792 | $21.7M | FARM |
| 10 | symbiotic | $34.9M | 0.619 | $21.6M | FARM |

## 5. What is NOT claimed

**No walk-forward test.** The snapshot is a single date (2026-11-14) with no
TVL or price history, so a genuine walk-forward test cannot be built from it,
and none is claimed — anywhere in the code, the dashboard, or this file. The
listed-date split (v1/v2) is the closest honest substitute and is labelled as
such. Odds are a peer prevalence, not a launch-date forecast. Gas prices are
an assumption, stated as one. No calibration is claimed either: v3 tested
three and adopted none, and the dashboard says so.
