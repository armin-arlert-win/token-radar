# Held-out tests v2 — Token Launch Radar (radar-v2)

Computed from `snapshot.json` (DefiLlama, as_of 2026-11-14, 758 protocols) with the
analysis scripts `/home/hatch/workspace/makefun/tests_v2_logistic.py`,
`tests_v2_oof.py` and `tests_v2_board.py` (NumPy, no sklearn). Numbers below are the
actual outputs. The value-model numbers from v1 are carried over unchanged (the value
model did not change in v2) except the category-factor sweep, which was recomputed
properly in v2 (see below). The odds numbers are new in v2.

## What changed in v2

1. **Odds: bucket cells → logistic regression.** v1 scored odds from age × TVL peer
   cells shrunk to the base rate. v2 fits a logistic regression on all 758 protocols
   (label: records a token), implemented from scratch in `lib/model.ts`
   (`fitLogistic`: gradient descent, L2 lambda 10, 600 iterations, lr 0.5, standard
   library only). The TypeScript fit and the Python fit agree to max abs diff **0.0000**
   on every board row's odds.
2. **Category-factor sweep for the value model** (see §4).
3. **Board 200 → 213 rows** (40 watchlist + 173 early).
4. **Farm plans:** category-specific actions + weekly actions, and gas priced by the
   first chain (Ethereum $5/week, cheap chains $0.50/week, else $2/week) instead of a
   flat $2/week.
5. **Cover compacted:** proof grid now spans page y 182–420 in a 1440×800 viewport
   (v1: ~700px); the board table starts at y 716.

## 1. The odds logistic

Features (all from the snapshot, no outside data):

| # | Feature | Transform |
|---|---|---|
| 1 | TVL | log |
| 2 | Age (listed_at → as_of) | log(age + 1); missing → 365 days |
| 3 | 7d growth | clamped −60..+30%, /100 |
| 4 | Chains | count, capped at 10 (one protocol lists 176 chains) |
| 5 | listed_at missing | 0/1 flag |
| 6–19 | Category | one-hot, 14 categories with n ≥ 20 |

Why growth is clamped at +30% for the odds feature (the value model still allows
+120%): the raw growth feature's standard deviation is only 0.088, so a +120% value
sits ~10 sd above the mean and a single listing artifact (Shift DeFi, +4448%) would
contribute about −3.0 to the logit — more than any real signal. Peer token rates are
already at their floor above +30% (0.14 in the +30..+200% bucket, n = 7). Capping at
+30% costs almost nothing held out (5-fold OOF log-loss 0.586 vs 0.583 uncapped) and
removes the artifact. This is a winsorization choice, stated here.

Why the missing-age flag matters: protocols with no `listed_at` (n = 113) record a
token at rate **0.788**, far above the base rate 0.549. The flag's fitted weight is
+0.480. Missing data is not treated as "young" — it gets its own signal.

### Fitted coefficients (full fit, lambda 10, standardized features)

| Feature | Weight | Feature | Weight |
|---|---|---|---|
| intercept | +0.221 | cat: CEX | −0.584 |
| log TVL | +0.187 | cat: Risk Curators | −0.396 |
| log(age + 1) | +0.461 | cat: Onchain Capital Allocator | −0.207 |
| 7d growth | −0.242 | cat: Bridge | −0.156 |
| chains (capped 10) | +0.367 | cat: Canonical Bridge | −0.128 |
| listed_at missing | +0.480 | cat: Liquid Staking | −0.078 |
| cat: Dexs | +0.334 | cat: CDP | −0.041 |
| cat: Lending | +0.304 | cat: Yield Aggregator | −0.025 |
| cat: Basis Trading | +0.119 | cat: RWA | +0.012 |
| cat: Yield | +0.072 | cat: Derivatives | +0.017 |

Reading: age is the strongest numeric signal (older → more likely to record a token),
growth is negative (fast growers are *less* likely to record one — consistent with v1),
and the category swings are large because the underlying token rates are: Risk
Curators 0.128, Onchain Capital Allocator 0.310, CEX 0.250, Bridge 0.491, Liquid
Staking 0.513, RWA 0.515, CDP 0.500, Derivatives 0.500, Canonical Bridge 0.531,
Yield 0.590, Yield Aggregator 0.609, Basis Trading 0.619, Dexs 0.737, Lending 0.787.
Predicted odds on the 213 board rows range 0.022–0.857 (median 0.441); the bucket odds
ranged only 0.297–0.688 (median 0.514). The logistic discriminates; the bucket mostly
did not.

### Held-out results (log-loss / AUC / Brier; lower log-loss is better)

| Model | Split-half, 20 seeds | 5-fold out-of-fold |
|---|---|---|
| **Logistic, numeric + category, λ=10** | **0.590 / 0.758 / 0.201** | **0.586 / 0.763 / 0.199** |
| Logistic, numeric only, λ=10 | 0.641 / 0.711 / 0.222 | 0.639 / 0.703 / 0.222 |
| Logistic, numeric + category, λ=1 | 0.597 / 0.759 / 0.201 | 0.599 / 0.761 / — |
| Logistic, numeric + category, λ=50 | 0.599 / 0.755 / 0.205 | 0.593 / 0.759 / — |
| Bucket odds v1 (cells refit on train) | 0.666 / 0.622 / 0.237 | 0.662 / 0.619 / 0.235 |
| Base rate alone (0.5488) | 0.688 / 0.500 / 0.248 | — |

Lambda 10 is the best of the swept values (0.1 / 1 / 10 / 50) on both protocols. The
category features carry most of the gain over numeric-only (0.590 vs 0.641 split-half).
**Decision: adopt the logistic.** It beats the bucket on every held-out metric, by
0.076 log-loss and +0.14 AUC out-of-fold. This was not assumed — it was the result
that decided it.

### Out-of-fold calibration (5-fold, deciles of predicted odds)

| Decile | Predicted | Observed |
|---|---|---|
| 1 | 0.118 | 0.227 |
| 2 | 0.285 | 0.263 |
| 3 | 0.397 | 0.355 |
| 4 | 0.478 | 0.395 |
| 5 | 0.540 | 0.539 |
| 6 | 0.603 | 0.573 |
| 7 | 0.663 | 0.645 |
| 8 | 0.728 | 0.724 |
| 9 | 0.793 | 0.842 |
| 10 | 0.889 | 0.921 |

Calibration is good except the lowest decile, which the model under-predicts
(11.8% vs 22.7% observed). That decile is mostly very young Risk Curators /
allocators; the model is over-confident at the bottom. It is shown in the dashboard
rather than hidden. The bucket odds' OOF calibration was worse throughout (their
predictions barely span 0.34–0.69 while observed deciles span 0.28–0.70 with no
monotone pattern in the top decile: predicted 0.685, observed 0.579).

## 2. The fitted value model (unchanged from v1)

```
log(mcap) = 4.002 + 0.687 * log(TVL)     R^2 = 0.402, residual sd (log) = 1.594
```

- Comps: 128 with `mcap_usd > 0`; 16 with mcap ≤ 0 excluded (15 at 0, 1 at −1:
  autofinance); trimmed to 116 by mcap/TVL ratio P5–P95 (0.00648–12.1602).
- Global median mcap/TVL on trimmed comps: 0.2138.
- P10–P90 factor: exp(1.2816 × 1.594) = 7.72.

### Leave-one-out (log-RMSE on log market cap)

| Set | Log-log fit | Flat median-ratio baseline |
|---|---|---|
| Trimmed comps (n=116) | **1.618** | 1.702 |
| All comps (n=128) | **2.107** | 2.277 |

### Split-half, 20 seeds (trimmed comps)

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

### Listed-date split

Fit on comps listed before 2025-01-01 (n=60), test on comps listed on/after it (n=27):
log-RMSE **1.524**, bias **−0.524**. Reversed: 1.610, bias +0.515.

## 3. Category-factor sweep (new in v2 — proper LOO)

v1 reported LOO 1.628 for k=8, but that number reused full-sample category factors
inside the LOO loop (a leak). v2 recomputes the category factor from the training
folds only, for each held-out comp:

| Shrinkage k (factor weight n/(n+k)) | LOO log-RMSE |
|---|---|
| 0 (raw factor) | 1.658 |
| 2 | 1.652 |
| 4 | 1.648 |
| 8 (v1/v2) | 1.642 |
| 16 | 1.635 |
| 32 | 1.629 |
| 64 | 1.625 |
| ∞ (no factor — global fit) | **1.618** |

The sweep is monotone: **no category factor is best by LOO**. The factor is kept at
k=8 anyway, and the dashboard states the trade-off plainly: it corrects systematic
category bias (Lending +0.913 log, Liquid Staking +0.830 log in holdout — a 2–2.5×
mispricing in a consistent direction) at a LOO cost of 0.024 log units (~1.5%).
A bias correction, not a variance win. If v3 drops the factor, the LOO number
improves and every Lending / Liquid Staking row is systematically overvalued instead.

## 4. Board v2 vs v1 (same 213 rows, bucket odds vs logistic odds)

| | v1 bucket (on 213 rows) | v2 logistic |
|---|---|---|
| Top EV | Steakhouse $97.6M | **Veda $67.1M** |
| FARM / THIN / SKIP | 21 / 96 / 96 | **12 / 71 / 130** |
| Odds range on board | 0.297–0.688 | 0.022–0.857 |

Top 10 by EV, v2:

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

Biggest EV-rank moves v1 → v2 (all downward, all young Risk Curators / curators):
keyrock 38 → 181 (odds 0.441 → 0.056), armitage-by-wintermute 32 → 166 (0.441 →
0.065), galaxy-curation 25 → 152 (0.441 → 0.071), nonce-capital 10 → 81 (0.481 →
0.068), gami-labs 51 → 157, hakutora 117 → 193, felix-vaults 69 → 144. These rows
are young (age < 180 days) and in categories whose peers almost never record a token
(Risk Curators 12.8%). The bucket odds gave every young row ~0.44–0.51 because the
age bucket was the only thing that varied; the logistic sees the category too.
New rows 201–213 (the 13 extra early rows): hertzflow, prime-staking, boros, kton,
turboflow-perps, aftermath-aflp, loopscale-curation, stablehodl, temple,
valdora-finance, granite, swan-dao, btcfi-cdp.

Note the verdict rule doing visible work: Steakhouse (EV rank 2, $60.9M) is THIN and
Gauntlet (EV rank 4, $35.0M) is SKIP, because FARM also requires odds ≥ 45% and
their odds are 36.6% and 30.5%. The board's biggest implied values are not
automatically farmable — that is the point of the odds term, and the dashboard says
so next to both rows.

## 5. Farm costs v2 (gas by chain — an assumption, not snapshot data)

| Gas tier | Chains | Weekly gas | Setup gas | 8-week total |
|---|---|---|---|---|
| high | Ethereum | $5 | $10 | **$50** |
| mid | everything else | $2 | $4 | **$20** |
| low | Solana, Tron, Sui, Aptos, Near, Stellar, Ripple, Cosmos family | $0.50 | $1 | **$5** |

Board mix: 59 high / 111 mid / 43 low. Farm steps are 6 per row, 136–251 characters.
Category actions are now distinct: curators get vault actions, allocators get
allocation-vault actions, RWA mints a tokenized yield asset, lending supplies + one
small borrow, perps open a small hedged position, and each category has its own
weekly qualifying action (e.g. curators read the allocation report; perps open and
close one small hedge).

## 6. What is NOT claimed

**No walk-forward test.** The snapshot is a single date (2026-11-14) with no TVL or
price history, so a genuine walk-forward test cannot be built from it, and none is
claimed — anywhere in the code, the dashboard, or this file. The listed-date split
above is the closest honest substitute and is labelled as such. Odds are a peer
prevalence, not a launch-date forecast. Gas prices are an assumption, stated as one.

## 7. Funnel / integrity (recomputed at build)

758 total → 342 pre-token → 289 rankable (not CEX, not versioned) → **213 board rows**
(40 watchlist + 173 early). `change_7d` null: 4. `listed_at` null: 113. Outlier:
Shift DeFi `change_7d` +4448.4747%, clamped to +120% (value) and +30% (odds feature).
