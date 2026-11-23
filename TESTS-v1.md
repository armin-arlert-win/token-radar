# Held-out tests v1 — Token Launch Radar (radar-v1)

Computed from `snapshot.json` (DefiLlama, as_of 2026-11-14, 758 protocols) at build time
with the script in `/tmp/tests_v1.py` (analysis) — numbers below are the actual outputs,
not copied from PLAN-v1.md. The same numbers are in `lib/model.ts` (`TEST_RESULTS`) and
in the dashboard's Method tab.

## The comps

- Token-bearing protocols: 416. With `mcap_usd > 0`: **128**.
- `mcap_usd <= 0` (placeholder, excluded from every fit): **16** (15 at 0, 1 at −1: autofinance).
- Token protocols with no mcap at all (cannot be fitted): **272** — selection-bias warning.
- Trimmed comps (mcap/TVL ratio in P5–P95, 0.00648–12.1602): **116**.
- Global median mcap/TVL on trimmed comps: **0.2138**.

## The fitted model

```
log(mcap) = 4.002 + 0.687 * log(TVL)     R^2 = 0.402, residual sd (log) = 1.594
```

P10–P90 factor from the residual sd: exp(1.2816 × 1.594) = **7.72**
(PLAN-v1.md said 7.6 from a rounded sd; the exact recomputation is 7.72 and the code uses 7.72.)

### Category factors (verified against PLAN-v1.md — they match to 2 decimals)

| Category | n (trimmed) | Median ratio | Raw factor | Shrunk factor (n/(n+8)) |
|---|---|---|---|---|
| Dexs | 11 | 0.3424 | 1.602 | **1.314** |
| RWA | 9 | 0.2748 | 1.285 | **1.142** |
| Yield | 8 | 0.2561 | 1.198 | **1.095** |
| Lending | 14 | 0.1306 | 0.611 | **0.731** |
| Liquid Staking | 8 | 0.0441 | 0.206 | **0.454** |
| CEX | 8 | 0.0684 | 0.320 | **0.566** |

Categories with < 8 trimmed comps use factor 1.0. Note the small-n categories that were
*not* used: Canonical Bridge 3.491, Bridge 2.604, Derivatives 10.111, Risk Curators 13.913 —
medians from n = 1–6 are noise, and using them would be fabrication, not fitting.

## Held-out results (log-RMSE on log market cap; lower is better)

### Leave-one-out

| Set | Log-log fit | Flat median-ratio baseline |
|---|---|---|
| Trimmed comps (n=116) | **1.618** | 1.702 |
| All comps (n=128) | **2.107** | 2.277 |
| Trimmed, with shrunk category factors (k=8) | 1.628 | 1.702 |

Reading: the log-log fit beats the flat baseline, but only by ~0.08 log units. The category
factor does **not** improve LOO (1.628 vs 1.618 global; unshrunk 1.658). It is kept anyway
because it corrects large systematic biases (see category holdout), and the dashboard says
this plainly instead of hiding it.

### Split-half, 20 seeds (fit on half, test on the other half, trimmed comps)

| Model | Mean log-RMSE | Min | Max |
|---|---|---|---|
| Log-log fit | **1.605** | 1.486 | 1.749 |
| Flat median ratio | 1.683 | 1.571 | 1.786 |
| Starter 0.25 × TVL | 1.688 | 1.569 | 1.802 |

### Category holdout (global log-log fit trained WITHOUT that category, predicting it)

| Category | n | log-RMSE | Bias (log) | Meaning |
|---|---|---|---|---|
| Dexs | 11 | 1.805 | −0.348 | global fit underpredicts Dexs |
| RWA | 9 | 0.732 | −0.212 | underpredicts |
| Yield | 8 | 1.221 | −0.005 | unbiased |
| Lending | 14 | 2.100 | **+0.913** | global fit overpredicts Lending ~2.5× |
| Liquid Staking | 8 | 1.434 | **+0.830** | overpredicts ~2.3× |
| CEX | 8 | 1.566 | +0.163 | slight overprediction |

This is the evidence for the category factor: without it, whole categories are mispriced
by a factor of 2–2.5 in a consistent direction.

### Listed-date split (the closest honest check to a time test)

Fit on comps listed before 2025-01-01 (n=60), test on comps listed on/after it (n=27):

- log-RMSE **1.524**, bias **−0.524** (the fit underpredicts newer comps).
- Reversed (fit on newer, test on older): log-RMSE **1.610**, bias **+0.515**.

### Growth-weight sensitivity (in-sample, trimmed comps)

| Growth weight | log-RMSE |
|---|---|
| 0 | 1.594 |
| 0.15 (v1) | 1.594 |
| 0.5 (starter) | 1.595 |

The growth term is inert: it changes nothing measurable. v1 keeps it small (0.15) rather
than pretending it drives value. Peer token rates by 7d-growth bucket also fall with growth
(−100..−10%: 0.60; 0..+10%: 0.38; +30..+200%: 0.14), which is why the starter's 0.5 was cut.

## What is NOT claimed

**No walk-forward test.** The snapshot is a single date (2026-11-14) with no TVL or price
history, so a genuine walk-forward test cannot be built from it, and none is claimed —
anywhere in the code, the dashboard, or this file. The listed-date split above is the
closest honest substitute and is labelled as such.

## Token odds (how the dashboard's odds are built)

- Base token rate: 416/758 = **0.5488**.
- Odds per row = the token rate of its age-bucket × TVL-bucket cell among the 758 protocols,
  shrunk toward the base rate with 20 pseudo-counts:
  `odds = (n_cell × raw_rate + 20 × 0.5488) / (n_cell + 20)`.
- A row with missing `listed_at` is scored in the 365–729 day bucket (never rewarded for
  missing data). In the code, the odds table and the row lookup use the same mapping, so the
  table is self-consistent; the joint-cell rates in PLAN-v1.md were computed with "unknown"
  as its own bucket and therefore differ slightly for the 365–729 cells.
- Age-bucket token rates (marginal): 0–179d 0.264; 180–364d 0.397; 365–729d 0.383;
  730+d 0.679. TVL-bucket rates (marginal): $5–50M 0.522; $50–200M 0.571; $200M–$1B 0.581;
  $1–10B 0.623; >$10B 0.700.

## Funnel / integrity (recomputed at build)

758 total → 342 pre-token → 289 rankable (not CEX, not versioned) → 200 board rows
(40 watchlist + 160 early). `change_7d` null: 4. `listed_at` null: 113.
Outlier: Shift DeFi `change_7d` +4448.4747%, clamped to +120%.
