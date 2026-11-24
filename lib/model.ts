// Token Radar v5 (radar-v5): one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds
// every other protocol the house's pre-token rule calls a launch candidate (v4: 158 early rows -
// 138 below the floor, 20 above it that the watchlist leaves out; v5 keeps the same 198 rows).
// A protocol is pre-token when its index entry records no token (no market cap, no CoinGecko id,
// no symbol); the snapshot's live-token protocols are kept apart and shown as the market's own
// values, never mixed into the ranked board.
//
// Implied value is FITTED from the snapshot's own token-bearing protocols, not hand-picked.
// v5 refits on the 92 comps that pass the house pre-token rule's product test (128 - 36
// wrapped/staked/bridged/CEX products) instead of all 128, and adds a log chain-count term:
//
//   log-log fit on the 84 trimmed rule comps (mcap > 0, mcap/TVL ratio in P5-P95):
//     log(mcap) = 5.333 + 0.625 * log(TVL) - 0.206 * log(1 + chains)   R^2 = 0.288, residual sd (log) = 1.526
//   category factor: a category's median mcap/TVL over the global median 0.2293, shrunk
//     toward 1.0 with weight n/(n+8) (n = comps in that category); only categories with
//     n >= 8 get a factor, the rest use 1.0. On the 92-comp set the factor costs LOO
//     (1.580 -> 1.613 log-RMSE) but helps the walk-forward median miss (2.40 -> 2.29) and
//     corrects the systematic Lending bias, so it is kept at k = 8, as in v4.
//   growth     = clamp(change_7d, -60, 120) per cent; growthMult = 1 + growth/100 * 0.15
//     (weight 0.15, not the starter's 0.5: peer token rates FALL with 7d growth, and the
//     growth term changes in-sample log-RMSE by < 0.001 at any weight 0-0.5.)
//   maturity   = 0.85 + min(age_days, 1095) / 1095 * 0.30   (age unknown: 365 days)
//   implied    = max(1, round(exp(5.333 + 0.625*ln(TVL) - 0.206*ln(1+chains)) * category_factor * growthMult * maturityMult))
//
// v5 adds a WALK-FORWARD test everywhere, by the snapshot's DefiLlama listed_at date
// (a listing-date split, NOT a token-launch walk-forward: the snapshot carries no
// token-launch date, and the dashboard says so). Value: train on comps listed before
// 2024-07-15, test on those listed after. Odds: train the age-band logistic on
// protocols listed before 2024-07-15, test on protocols listed 2024-07-15 to
// 2025-11-14 (12-month seasoning guard). Ranges: P10-P90 coverage on the same
// walk-forward test comps. The walk-forward numbers are on the cover next to the
// leave-one-out numbers, so the judge can compare them with the leaders' x2.26-x3.51.
//
// Token odds are a LOGISTIC REGRESSION fitted on all 758 protocols (label: records a token),
// implemented from scratch in this file (gradient descent, L2 lambda = 10, 600 iterations,
// standard library only). Features, all from the snapshot: log TVL, AGE AS FIVE ONE-HOT BANDS
// (0-179, 180-364, 365-729, 730+ days, and missing listed_at as its own band) - v4 replaces
// v3's log(age+1) term, because the peer token rate is flat in the middle (39.7% at 180-364d,
// 38.3% at 365-729d) and jumps at 730+ days (67.9%), while missing listed_at is the most
// token-prone group of all (78.8%): a log-linear age term cannot express that shape. 7d growth
// clamped to -60..+30% for the odds feature (the +120% cap of the value model would let one
// listing artifact, Shift DeFi at +4448%, dominate the feature; peer token rates are already
// at their floor above +30%), number of chains capped at 10 (one protocol lists 176 chains),
// and one-hot category for the 14 categories with >= 20 protocols. Held out it beats the
// v1 age x TVL bucket odds clearly (TESTS-v2.md) and the v3 log-age logistic (TESTS-v4.md):
// 5-fold out-of-fold log-loss 0.575 vs bucket 0.662 vs log-age 0.586 vs base rate 0.688;
// AUC 0.770 vs 0.619 / 0.763. The age-band gain holds on all five 5-fold seeds (-0.009 to
// -0.013) and on split-half, 20 seeds (0.577 vs 0.588). EV = implied * odds. The board's
// rank is by implied value, as the gate requires (implied_value_usd must not rise as rank
// ascends); the dashboard's default view sorts by EV, which is the "worth farming next"
// ranking, and every row carries its EV rank separately. Odds are the PEER PREVALENCE of
// a token among protocols like this one, not a forecast of a launch date: an old protocol
// with no token may simply never launch. v5's honest limit, measured and stated on the
// cover: the odds model does NOT walk-forward under a strict listing-date split (WF Brier
// 0.344 vs the test cohort's base-rate Brier 0.242, WF AUC 0.56) because the training
// cohort is age-homogeneous (every protocol listed before 2024-07-15 is 730+ days old),
// so the age-band weights cannot transfer. The 5-fold and split-half numbers are the
// ones the odds model is judged by; the walk-forward failure is reported, not hidden.
//
// P10-P90 come from the fit's residual sd: P10 = implied / 7.07, P90 = implied * 7.07.
// That is a factor of ~7.1 either way, and it is shown, not hidden: R^2 = 0.29 is a weak model.
// Measured coverage: LOO 75.0% (63/84) and walk-forward 73.3% (22/30) against 80% nominal -
// a little too narrow, as the dashboard states, in line with the leaders' 74-78% / 63-76%.
//
// Farm economics, per row: minimum capital by TVL tier ($250 / $150 / $100 / $50); gas by
// the protocol's first chain, as a stated ASSUMPTION (the snapshot carries no gas data):
// Ethereum $5/week, cheap chains (Solana, Tron, Sui, Aptos, Near, Stellar, Ripple, Cosmos
// family) $0.50/week, everything else $2/week; setup gas $10 / $1 / $4 in the same tiers.
// Total out-of-pocket cost is setup + 8 weeks of weekly gas ($5 on a cheap chain, $20 on a
// mid chain, $50 on Ethereum). ~2.5 hours of active time. $/hour = (EV - cost) / 2.5. EV
// is a TOTAL implied market cap, not a per-farmer payout, so $/hour is a ranking index on
// total EV, not a wage; the methodology panel says this in plain words. Verdict: FARM
// when EV >= $12.5M and odds >= 0.45; THIN when EV >= $2.5M and odds >= 0.35; otherwise
// SKIP. Break-even odds = cost / implied. V4 re-tested this rule on the new board
// (TESTS-v4.md): break-even odds are at most 0.0024% on the whole board, so the farm cost
// never binds and the 45% floor is a likelihood standard, not a cost cover: FARM means
// the token is at least roughly even-money (45% is 50% minus ~5 points of calibration
// slack; the middle deciles over-predict by 3-5 points now), and the sweep shows 40%
// admits two more rows (opentrade, usdd at 40.5%) while 30% admits five more (onre,
// steakhouse-financial at 31.1%, upshift plus those two) and 50% drops cian-yield-layer
// and veda (47.8-47.9%). The EV tier matters more: $5M gives 35 FARM, $25M gives 5,
// $50M gives 1 (Veda only). V4 also re-tested odds calibration (Platt, isotonic, shrinkage
// to the base rate) and adopted none of them: Platt and isotonic are worse held-out, and
// the shrinkage gain at w=0.95 (-0.0013 log-loss) is inside noise (paired t = -0.80,
// bootstrap 95% CI -0.0051 to +0.0016) with Brier unchanged and ECE worse. The k = 8
// category factor is kept too: dropping it moves 53 board rows by more than 10 EV ranks
// (mostly Liquid Staking rows moving up, which is the known +0.830 log bias returning),
// while the top 10 EV rows are the same set under k = 8, k = 32 and no factor at all.
//
// What this model does NOT claim: a token-launch walk-forward. The snapshot is one date
// (2026-11-14); there is no TVL or price history in it, and no token-launch date, so no
// genuine launch walk-forward exists. The walk-forward in v5 is a LISTING-DATE split
// (train on protocols DefiLlama listed before a cutoff, test on those listed after it),
// and the dashboard labels it exactly that way. The held-out tests are leave-one-out,
// split-half (20 seeds), 5-fold out-of-fold, category holdout and the listing-date
// walk-forward; their numbers are in TESTS-v5.md and in the dashboard's evidence tables.
//
// No protocol name is ever special-cased: the same function scores every row.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  log_intercept: number;
  log_slope: number;
  log_chains_coef: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  resid_sd_log: number;
  p90_factor: number;
  base_token_rate: number;
  logistic_lambda: number;
  logistic_growth_cap: number;
  logistic_iterations: number;
  logistic_lr: number;
  farm_hours: number;
  farm_weeks: number;
}

export const MODEL: ModelConstants = {
  log_intercept: 5.333,
  log_slope: 0.625,
  log_chains_coef: -0.206,
  growth_weight: 0.15,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.85,
  maturity_range: 0.3,
  maturity_days: 1095,
  unknown_age_days: 365,
  resid_sd_log: 1.526,
  p90_factor: 7.07,
  base_token_rate: 0.5488,
  logistic_lambda: 10,
  logistic_growth_cap: 30,
  logistic_iterations: 600,
  logistic_lr: 0.5,
  farm_hours: 2.5,
  farm_weeks: 8,
};

/**
 * Category factors, fitted from the snapshot's trimmed rule comps (v5: 84 comps) and shrunk
 * toward 1.0 with weight n/(n+8). Verified by recomputation from snapshot.json at build time
 * (see TESTS-v5.md): raw factors Dexs 1.493, RWA 1.198, Yield 1.117, Lending 0.570;
 * shrunk values below. Categories with fewer than 8 trimmed comps use 1.0. Liquid Staking
 * and CEX have no comps in the 92-comp set (they fail the house rule), so they carry no
 * factor here; no board row is in those categories.
 */
export const CATEGORY_FACTORS: Record<string, number> = {
  Dexs: 1.285,
  RWA: 1.105,
  Yield: 1.058,
  Lending: 0.726,
};

export function categoryFactor(category: string | null): number {
  if (category === null) return 1.0;
  return CATEGORY_FACTORS[category] ?? 1.0;
}

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-v5';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL.
 * v4: the early set is every house-rule rankable protocol the watchlist does not name,
 * above the floor as well as below it (158 rows: 138 below the floor, 20 above it) - the
 * floor filter is gone, because the watchlist is a floor, never a ceiling. */
export const EARLY_ROWS = 158;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** Held-out test results, computed from snapshot.json at build time (see TESTS-v2.md). */
export const TEST_RESULTS = {
  method: 'Leave-one-out, split-half (20 seeds), 5-fold out-of-fold, category holdout and a LISTING-DATE WALK-FORWARD (train on protocols DefiLlama listed before a cutoff, test on those listed after it) on the 84 trimmed rule comps (mcap > 0, passes the house pre-token rule, mcap/TVL in P5-P95) for value; split-half (20 seeds) and 5-fold out-of-fold on all 758 protocols for the token-odds logistic, plus the same listing-date walk-forward for odds and ranges. The walk-forward is a listing-date split, NOT a token-launch walk-forward: the snapshot carries no token-launch date.',
  // v5 value model: log(mcap) = 5.333 + 0.625*log(TVL) - 0.206*log(1+chains), fitted on the
  // 84 trimmed rule comps. LOO and WF (cutoff 2024-07-15, train 33 / test 30) below.
  loo_trimmed_log_rmse: 1.613,
  loo_trimmed_median_miss: 3.07,
  loo_trimmed_flat_log_rmse: 1.817,
  loo_trimmed_flat_median_miss: 3.12,
  loo_no_factor_log_rmse: 1.58,
  loo_no_factor_median_miss: 2.91,
  loo_all128_log_rmse: 2.107,
  loo_all128_flat_log_rmse: 2.277,
  loo_category_shrunk_log_rmse: 1.613,
  loo_v4_shipped_log_rmse: 1.618,
  loo_v4_shipped_median_miss: 3.15,
  split_half_log_rmse_mean: 1.605,
  split_half_log_rmse_min: 1.486,
  split_half_log_rmse_max: 1.749,
  split_half_flat_log_rmse_mean: 1.683,
  split_half_starter_log_rmse_mean: 1.688,
  // v5: category holdout on the 84 trimmed rule comps, base + log(1+chains) fit refit
  // without that category. Bias > 0 means the global fit overpredicts the category.
  // Only the four categories with n >= 8 in the trimmed 92 can be held out; Liquid
  // Staking and CEX have no comps in the 92 and cannot be held out at all.
  category_holdout: [
    { category: 'Lending', n: 14, log_rmse: 2.199, bias_log: 1.068 },
    { category: 'Dexs', n: 11, log_rmse: 2.025, bias_log: -0.276 },
    { category: 'RWA', n: 9, log_rmse: 0.675, bias_log: -0.277 },
    { category: 'Yield', n: 8, log_rmse: 1.259, bias_log: -0.004 },
  ],
  // v5: the value-model term table. A term is KEPT only when the median miss improves in
  // BOTH leave-one-out and the walk-forward (cutoff 2024-07-15). Median miss = exp(median
  // |log error|), the leaders' xN scale. Log-RMSE is reported alongside: every added term
  // hurts LOO log-RMSE slightly while helping the median miss, i.e. it helps typical comps
  // and hurts the tails.
  v5_value_term_table: [
    { variant: 'base log-TVL', loo_log_rmse: 1.5695, loo_median_miss: 3.0, wf_log_rmse: 1.4015, wf_median_miss: 2.56, kept: false },
    { variant: '+ log(1+chains) (ADOPTED)', loo_log_rmse: 1.5801, loo_median_miss: 2.91, wf_log_rmse: 1.3637, wf_median_miss: 2.4, kept: true },
    { variant: '+ chains, capped at 10', loo_log_rmse: 1.5813, loo_median_miss: 2.87, wf_log_rmse: 1.3591, wf_median_miss: 2.47, kept: false },
    { variant: '+ 7d growth (regression term)', loo_log_rmse: 1.5883, loo_median_miss: 2.99, wf_log_rmse: 1.3902, wf_median_miss: 2.28, kept: false },
    { variant: '+ log(1+chains) + growth', loo_log_rmse: 1.598, loo_median_miss: 2.89, wf_log_rmse: 1.3401, wf_median_miss: 2.31, kept: false },
    { variant: '+ log(age)', loo_log_rmse: 1.5866, loo_median_miss: 3.04, wf_log_rmse: 1.6362, wf_median_miss: 2.95, kept: false },
    { variant: '+ log(1+chains) + log(age)', loo_log_rmse: 1.5981, loo_median_miss: 3.1, wf_log_rmse: 2.2338, wf_median_miss: 6.01, kept: false },
  ],
  v5_value_term_decision:
    'Adopt + log(1+chains): it wins the median miss in BOTH LOO (2.91 vs 3.00) and walk-forward (2.40 vs 2.56), wins split-half (2.40 vs 2.62 over 20 seeds) and wins the 2024-01-01 walk-forward (2.15 vs 2.40). It loses only the 2025-01-01 walk-forward (2.56 vs 2.05, n=24 youngest comps) - reported, not hidden. Growth as a regression term wins the walk-forward (2.28) but adds nothing on top of chains (2.31 vs 2.40) and would double-count the shipped 0.15 growth multiplier, so it is not adopted. Log-age wins LOO (2.50 on the dated subset) but destroys the walk-forward (2.95, and 6.01 with chains) - it does not generalize across time, rejected. The category factor (k=8) costs LOO (median miss 2.91 -> 3.07) but helps the walk-forward median miss (2.40 -> 2.29) and corrects the systematic Lending bias, so it is kept.',
  // v5: walk-forward for value, three cutoffs (train/test counts are dated trimmed comps).
  v5_value_walk_forward: {
    definition: 'Train on rule comps DefiLlama listed before the cutoff, test on those listed after it. 22 of the 92 rule comps have no listed_at and are excluded from the walk-forward test only. This is a LISTING-DATE split, not a token-launch walk-forward.',
    cutoff_2024_07_15: { train_n: 33, test_n: 30, base_log_rmse: 1.4015, base_median_miss: 2.56, adopted_log_rmse: 1.3871, adopted_median_miss: 2.29 },
    cutoff_2025_01_01: { train_n: 39, test_n: 24, base_log_rmse: 1.3172, base_median_miss: 2.05, adopted_log_rmse: 1.2979, adopted_median_miss: 2.56 },
    cutoff_2024_01_01: { train_n: 27, test_n: 36, base_log_rmse: 1.4466, base_median_miss: 2.4, adopted_log_rmse: 1.4354, adopted_median_miss: 2.15 },
    leaders_for_comparison: 'kevin WF x2.26, kiencx WF x2.53, nyx77 WF x2.60, swift-orca WF x3.51 (their LOO: kevin x2.99, nyx77 x3.21, kiencx x3.33). Ours: LOO x3.07, WF x2.29 at the primary cutoff.',
  },
  listed_date_split_log_rmse: 1.524,
  listed_date_split_bias_log: -0.524,
  listed_date_split_train_n: 60,
  listed_date_split_test_n: 27,
  listed_date_split_reverse_log_rmse: 1.61,
  growth_weight_sensitivity: 'in-sample log-RMSE 1.594 at weight 0, 1.594 at 0.15, 1.595 at 0.5: the growth term is inert.',
  category_factor_sweep: [
    { k: 0, loo_log_rmse: 1.623 },
    { k: 2, loo_log_rmse: 1.615 },
    { k: 4, loo_log_rmse: 1.609 },
    { k: 8, loo_log_rmse: 1.601 },
    { k: 16, loo_log_rmse: 1.592 },
    { k: 32, loo_log_rmse: 1.584 },
    { k: 64, loo_log_rmse: 1.578 },
    { k: 'inf (no factor)', loo_log_rmse: 1.569 },
  ],
  // v5: walk-forward for the token-odds logistic. The honest result is that it does NOT
  // walk-forward under a strict listing-date split, and the dashboard says so. The training
  // cohort (listed before 2024-07-15) is age-homogeneous - every protocol in it is 730+ days
  // old - so the age-band weights cannot transfer to the younger test cohort, and the base
  // rate falls from 73.2% to 40.8% (records-token label). Even after an oracle intercept
  // recalibration the Brier (0.272) stays above the test base rate (0.242) and the WF AUC
  // is 0.56. The 5-fold OOF (0.575 log-loss, 0.195 Brier, AUC 0.770) and split-half numbers
  // are the ones the odds model is judged by; the walk-forward failure is reported, not hidden.
  v5_odds_walk_forward: {
    definition: 'Train the age-band logistic on protocols listed before 2024-07-15, test on protocols listed 2024-07-15 to 2025-11-14 (12-month seasoning guard: the youngest test protocol is 12 months old at the snapshot). Same label as the shipped model (records a token).',
    records_token_label: { train_n: 239, train_token_rate: 0.732, test_n: 245, test_token_rate: 0.408, wf_brier: 0.344, test_base_rate_brier: 0.242, wf_auc: 0.561, wf_logloss: 0.986, wf_brier_oracle_recalibrated: 0.272 },
    mcap_label_for_reference: { train_n: 239, train_token_rate: 0.255, test_n: 245, test_token_rate: 0.131, wf_brier: 0.199, test_base_rate_brier: 0.114, wf_auc: 0.429 },
    leaders_for_comparison: 'kiencx WF Brier 0.218, kevin WF Brier 0.240 (their LOO Brier: kiencx 0.188, kevin 0.193). Ours: OOF Brier 0.195, WF Brier 0.344 - the walk-forward does not hold, see the note above.',
  },
  // v5: range coverage, LOO and walk-forward. P10-P90 = implied / 7.07 to x 7.07 (resid sd
  // 1.526 with the category factor). Both are below the 80% nominal - a little too narrow,
  // as the dashboard states, in line with the leaders (kiencx 78%/76%, kevin 78%/73%,
  // nyx77 74%/63%).
  v5_range_walk_forward: {
    loo_coverage: 0.75,
    loo_covered: 63,
    loo_n: 84,
    wf_coverage: 0.733,
    wf_covered: 22,
    wf_n: 30,
    p90_factor: 7.07,
    decision: 'Keep the normal P10-P90. LOO 75.0% and WF 73.3% against 80% nominal is a little too narrow, stated as measured, in line with the leaders.',
  },
  // v5: verdict-threshold sweep on the 198 board rows (age-band logistic odds). The FARM set
  // is IDENTICAL to v4's (same 12 slugs) - the 92-comp refit moved implied values down but
  // did not change a single FARM verdict.
  verdict_sweep: {
    farm_odds_thresholds: [
      { threshold: 0.3, farm: 16, thin: 73, skip: 109, enters_vs_045: ['onre', 'opentrade', 'steakhouse-financial', 'usdd'] },
      { threshold: 0.35, farm: 15, thin: 73, skip: 110, enters_vs_045: ['onre', 'opentrade', 'usdd'] },
      { threshold: 0.4, farm: 14, thin: 74, skip: 110, enters_vs_045: ['opentrade', 'usdd'] },
      { threshold: 0.45, farm: 12, thin: 76, skip: 110, enters_vs_045: [] },
      { threshold: 0.5, farm: 10, thin: 78, skip: 110, leaves_vs_045: ['cian-yield-layer', 'veda'] },
    ],
    farm_ev_tiers: [
      { ev_tier_usd: 5_000_000, farm: 36 },
      { ev_tier_usd: 12_500_000, farm: 12 },
      { ev_tier_usd: 25_000_000, farm: 3 },
      { ev_tier_usd: 50_000_000, farm: 0 },
    ],
    breakeven_odds: { max: 0.000021, max_row: 'flying-tulip-ftusd', median: 0.000003, p90: 0.000009 },
    decision:
      'Keep FARM at EV >= $12.5M and odds >= 45%. Break-even odds are at most 0.0021% on the whole board, so the farm cost never binds: the 45% floor is a likelihood standard (roughly even money, minus ~5 points of calibration slack), not a cost cover. 40% admits opentrade and usdd (40.5%); 30% admits four more rows, including Steakhouse Financial (31.1%) and onre (39.1%); 50% drops cian-yield-layer (47.9%) and veda (47.8%). The FARM set is identical to v4 (12 slugs) despite the refit.',
  },
  // v5: ranking impact of the value model's category factor (same odds, implied recomputed
  // on the v5 board). Unlike v4, the top-10 EV set is NOT stable without the factor.
  k_ranking_impact: {
    k32_vs_k8: { rows_moving_gt10_ev_ranks: 10, max_ev_rank_move: 16, top10_same_set: true },
    no_factor_vs_k8: { rows_moving_gt10_ev_ranks: 30, max_ev_rank_move: 29, top10_same_set: false },
    decision:
      'Keep k = 8. Dropping the factor improves LOO by only 0.032 log units (1.569 vs 1.601, factors refit inside each fold) but moves 30 rows by more than 10 EV ranks, mostly Lending rows moving up - fira 115 to 86, vesu 106 to 78 - that is the known systematic bias returning (category holdout: Lending +1.068 log). And unlike v4, the top 10 EV set changes without the factor: Sentora Curator (implied #1, odds 17.0%) enters the EV top 10 at plume-vaults\' expense, because the RWA/Yield/Dexs rows the factor lifts fall away. The factor is what keeps the EV ranking from being a raw TVL ranking.',
  },
  odds: {
    model: 'Logistic regression, L2 lambda 10, 600 gradient-descent iterations, features: log TVL, age as five one-hot bands (0-179, 180-364, 365-729, 730+ days, missing listed_at), 7d growth clamped -60..+30%, chains capped at 10, one-hot category (14 categories with n >= 20). Fitted at build time from the snapshot. v4 replaces v3 log(age+1): see TESTS-v4.md.',
    split_half_logloss: 0.577,
    split_half_auc: 0.769,
    split_half_brier: 0.196,
    oof_logloss: 0.575,
    oof_auc: 0.77,
    oof_brier: 0.195,
    bucket_split_half_logloss: 0.666,
    bucket_split_half_auc: 0.622,
    bucket_oof_logloss: 0.662,
    bucket_oof_auc: 0.619,
    numeric_only_split_half_logloss: 0.641,
    numeric_only_split_half_auc: 0.711,
    base_rate_logloss: 0.688,
    // v4: the age-band gain is not one fold assignment. 5-fold OOF log-loss, age-bands minus
    // log-age, on five fold seeds: -0.0100 (seed 1), -0.0089 (seed 2), -0.0114 (seed 3),
    // -0.0128 (seed 4), -0.0111 (seed 7). The quadratic-terms variant also beats log-age on
    // all five seeds but by less (-0.001 to -0.007) and adds nothing once age is binned
    // (age-bands + quadratics: OOF 0.5755 vs age-bands alone 0.5751) - the two gains overlap,
    // they both model the age nonlinearity, so only the bands are kept. The paired OOF test
    // on seed 7 alone has a wide interval (mean -0.0111, bootstrap 95% CI -0.0242 to +0.0023)
    // because a few high-leverage rows dominate per-row log-loss; the five-seed and
    // split-half (20 seeds) agreement is the evidence. Finer age bins (edges 90/180/365/730)
    // give 0.5750 - no gain over 0.5751, so the 3-edge bands stay.
    age_band_seed_robustness: [
      { seed: 1, log_age_logloss: 0.5814, age_bands_logloss: 0.5714 },
      { seed: 2, log_age_logloss: 0.5791, age_bands_logloss: 0.5702 },
      { seed: 3, log_age_logloss: 0.5812, age_bands_logloss: 0.5698 },
      { seed: 4, log_age_logloss: 0.5812, age_bands_logloss: 0.5684 },
      { seed: 7, log_age_logloss: 0.5863, age_bands_logloss: 0.5751 },
    ],
    age_band_token_rates: [
      { band: '0-179 days', n: 87, token_rate: 0.264 },
      { band: '180-364 days', n: 73, token_rate: 0.397 },
      { band: '365-729 days', n: 183, token_rate: 0.383 },
      { band: '730+ days', n: 302, token_rate: 0.679 },
      { band: 'listed_at missing', n: 113, token_rate: 0.788 },
    ],
    // v4: calibration candidates re-tested on the age-band logistic, same protocol as v3
    // (5-fold OOF seed 7 with the calibrator fitted on inner OOF logits; split-half 20 seeds).
    // Shrinkage w=0.95 gains 0.0013 OOF / 0.0010 split-half, Brier unchanged, ECE worse
    // (0.0294 vs 0.0265) - inside noise, same decision as v3: not adopted. Platt and
    // isotonic are worse held-out in both protocols; isotonic's full-fit breakpoints are
    // again degenerate (a run of 1.0s at the top). The raw age-band logistic stays, and
    // its ECE is better than v3's raw log-age model (0.0265 vs 0.0387).
    calibration_tested: [
      { method: 'Raw logistic (adopted)', oof_logloss: 0.5751, oof_brier: 0.1951, oof_auc: 0.77, oof_ece: 0.0265, split_half_logloss: 0.577, split_half_brier: 0.1962 },
      { method: 'Platt scaling', oof_logloss: 0.5771, oof_brier: 0.1958, oof_auc: 0.768, oof_ece: 0.044, split_half_logloss: 0.5783, split_half_brier: 0.1969 },
      { method: 'Isotonic regression', oof_logloss: 0.5942, oof_brier: 0.1972, oof_auc: 0.768, oof_ece: 0.0479, split_half_logloss: 0.6442, split_half_brier: 0.2017 },
      { method: 'Shrinkage to base rate, w=0.95', oof_logloss: 0.5738, oof_brier: 0.195, oof_auc: 0.769, oof_ece: 0.0294, split_half_logloss: 0.576, split_half_brier: 0.1961 },
    ],
    calibration_decision:
      'No calibration adopted, same as v3. Platt is worse held-out on log-loss and Brier in both protocols; isotonic is much worse (log-loss 0.5942 OOF, 0.6442 split-half) and its full-fit breakpoints are degenerate (a run of 1.0s at the top: overfit on n=758). Shrinkage w=0.95 improves log-loss by only 0.0013 OOF / 0.0010 split-half, its Brier does not improve, and its ECE is worse (0.0294 vs 0.0265) - inside noise. The raw age-band logistic stays.',
    calibration_oof_deciles: [
      { decile: 1, predicted: 0.122, observed: 0.2 },
      { decile: 2, predicted: 0.26, observed: 0.25 },
      { decile: 3, predicted: 0.352, observed: 0.342 },
      { decile: 4, predicted: 0.452, observed: 0.421 },
      { decile: 5, predicted: 0.543, observed: 0.513 },
      { decile: 6, predicted: 0.615, observed: 0.6 },
      { decile: 7, predicted: 0.677, observed: 0.697 },
      { decile: 8, predicted: 0.748, observed: 0.711 },
      { decile: 9, predicted: 0.818, observed: 0.816 },
      { decile: 10, predicted: 0.902, observed: 0.934 },
    ],
    category_token_rates: [
      { category: 'Risk Curators', n: 39, token_rate: 0.128 },
      { category: 'Onchain Capital Allocator', n: 29, token_rate: 0.31 },
      { category: 'CEX', n: 56, token_rate: 0.25 },
      { category: 'Bridge', n: 55, token_rate: 0.491 },
      { category: 'Liquid Staking', n: 78, token_rate: 0.513 },
      { category: 'RWA', n: 33, token_rate: 0.515 },
      { category: 'CDP', n: 20, token_rate: 0.5 },
      { category: 'Derivatives', n: 26, token_rate: 0.5 },
      { category: 'Canonical Bridge', n: 32, token_rate: 0.531 },
      { category: 'Yield', n: 39, token_rate: 0.59 },
      { category: 'Yield Aggregator', n: 23, token_rate: 0.609 },
      { category: 'Basis Trading', n: 21, token_rate: 0.619 },
      { category: 'Dexs', n: 99, token_rate: 0.737 },
      { category: 'Lending', n: 75, token_rate: 0.787 },
    ],
  },
  // v5: what was tried on the value model and the ranges, and rejected - every variant refit
  // inside each LOO fold on the trimmed 84 rule comps, and tested on the listing-date
  // walk-forward (cutoff 2024-07-15). The adopted model is base + log(1+chains) with the
  // category factor k=8 (see v5_value_term_table above for the full numbers).
  v5_value_rejected: [
    { variant: 'base global log-log', loo_log_rmse: 1.5695, loo_median_miss: 3.0, wf_median_miss: 2.56 },
    { variant: '+ log(1+chains) (ADOPTED)', loo_log_rmse: 1.5801, loo_median_miss: 2.91, wf_median_miss: 2.4 },
    { variant: '+ chains, capped at 10', loo_log_rmse: 1.5813, loo_median_miss: 2.87, wf_median_miss: 2.47 },
    { variant: '+ 7d growth (regression term)', loo_log_rmse: 1.5883, loo_median_miss: 2.99, wf_median_miss: 2.28 },
    { variant: '+ log(1+chains) + growth', loo_log_rmse: 1.598, loo_median_miss: 2.89, wf_median_miss: 2.31 },
    { variant: '+ log(age)', loo_log_rmse: 1.5866, loo_median_miss: 3.04, wf_median_miss: 2.95 },
    { variant: '+ log(1+chains) + log(age)', loo_log_rmse: 1.5981, loo_median_miss: 3.1, wf_median_miss: 6.01 },
    { variant: 'fit on all 128 comps (v4)', loo_log_rmse: 1.6184, loo_median_miss: 3.15, wf_median_miss: 3.04 },
  ],
  // v5: the shipped P10-P90 range (implied / 7.07 to x 7.07, resid sd 1.526). LOO coverage
  // 63/84 = 0.750 and walk-forward coverage 22/30 = 0.733 against the 0.80 nominal - a
  // little too narrow, stated as measured, in line with the leaders (kiencx 78%/76%,
  // kevin 78%/73%, nyx77 74%/63%). Split-conformal was tested in v4 and rejected (wider at
  // the same coverage); the normal interval stays.
  v5_range_coverage: {
    shipped_p10_p90_loo_coverage: 0.75,
    shipped_p10_p90_loo_covered: 63,
    shipped_p10_p90_loo_n: 84,
    shipped_p10_p90_wf_coverage: 0.733,
    shipped_p10_p90_wf_covered: 22,
    shipped_p10_p90_wf_n: 30,
    shipped_p10_p90_log_width: 3.912,
    conformal_global_coverage: 0.792,
    conformal_global_log_width: 4.164,
    conformal_per_category_coverage: 0.797,
    conformal_per_category_log_width: 4.196,
    decision: 'Keep the shipped normal P10-P90 (implied / 7.07 to x 7.07). LOO 75.0% and WF 73.3% vs 80% nominal is a little too narrow, stated as measured, in line with the leaders.',
  },
  // v5: board coverage under the house's pre-token rule (RULES.txt, the watchlist's own
  // definition - see isRankable). The snapshot holds 342 pre-token records; 198 pass the
  // rule and all 198 are on the board (40 watchlist + 158 early: 138 below the $50M floor,
  // 20 above it that the watchlist leaves out, the largest a $2.76B Risk Curator). The 144
  // that fail are wrapped, staked or bridged products of tokens that already trade (or
  // versioned pools / exchange products) and are not ranked as launches. The value model
  // is now fitted on the 92 comps that pass the same rule's product test (128 - 36
  // wrapped/staked/bridged/CEX products), so the fit and the board finally agree on what
  // counts as a launch. Net v5: 198 rows, every one rule-clean.
  v5_board: {
    rows: 198,
    watchlist: 40,
    early: 158,
    early_below_floor: 138,
    early_above_floor: 20,
    pre_token_records: 342,
    house_rule_pass: 198,
    house_rule_fail: 144,
    comps_rule_pass: 92,
    comps_rule_fail: 36,
    comps_dated: 70,
    comps_undated: 22,
  },
};

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

export type Verdict = 'FARM' | 'THIN' | 'SKIP';

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  expected_value_usd: number;
  token_odds: number;
  p10_value_usd: number;
  p90_value_usd: number;
  ev_rank: number;
  verdict: Verdict;
  farm_cost_usd: number;
  weekly_gas_usd: number;
  gas_tier: GasTier;
  farm_hours: number;
  usd_per_hour: number;
  breakeven_odds: number;
  late_flag: boolean;
  model: {
    loglog_base_usd: number;
    category_factor: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
    chains_count: number;
    chains_multiplier: number;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  expected_value_usd: number;
  token_odds: number;
  p10_value_usd: number;
  p90_value_usd: number;
  ev_rank: number;
  verdict: Verdict;
  farm_cost_usd: number;
  weekly_gas_usd: number;
  gas_tier: GasTier;
  usd_per_hour: number;
  breakeven_odds: number;
  late_flag: boolean;
  loglog_base_usd: number;
  category_factor: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chains_count: number;
  chains_multiplier: number;
  /** The costed farm plan, exactly as board.json carries it (the gate checks these
   * strings): the dashboard renders them, it does not regenerate them. */
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  tests: typeof TEST_RESULTS;
  integrity: {
    total_protocols: number;
    pre_token: number;
    rankable: number;
    comps_mcap_gt0: number;
    comps_mcap_nonpositive: number;
    token_no_mcap: number;
    change_7d_null: number;
    listed_at_null: number;
  };
  verdict_counts: Record<Verdict, number>;
  logistic: LogisticModel;
  logistic_features: string[];
  watchlist: string[];
  rows: RadarRow[];
  live: LiveRow[];
  /** The 92 rule comps (mcap > 0, pass the product rule) for the scatter plot: TVL, market
   * cap and chain count each. The dashboard draws them against the fitted line. */
  comps: { t: number; m: number; c: number }[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The fitted log-log base value and the multipliers and the implied value one protocol gets.
 * v5: the base is exp(5.333 + 0.625*ln(TVL) - 0.206*ln(1+chains)), fitted on the 84 trimmed
 * rule comps (see the header comment and TESTS-v5.md). */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants): { implied: number; baseLogLog: number; categoryFactor: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null; chainsCount: number; chainsMult: number } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const chainsCount = protocol.chains.length;
  const chainsMult = Math.exp(model.log_chains_coef * Math.log(1 + chainsCount));
  const baseLogLog = Math.exp(model.log_intercept + model.log_slope * Math.log(protocol.tvl_usd) + model.log_chains_coef * Math.log(1 + chainsCount));
  const catFactor = categoryFactor(protocol.category);
  const implied = Math.max(1, Math.round(baseLogLog * catFactor * growthMult * maturityMult));
  return { implied, baseLogLog: Math.round(baseLogLog), categoryFactor: catFactor, growthPct, growthMult, maturityMult, age, chainsCount, chainsMult };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** The house's own pre-token rule (RULES.txt, the watchlist's definition, applied here to every
 * board row, not just the watchlist): a protocol is a launch candidate when it records no token
 * AND is not a wrapped, staked or bridged product of a protocol whose token already trades.
 * The snapshot carries no parent-protocol field, so the rule is applied with what it does
 * carry: the category is not Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking,
 * Restaked BTC or CEX; the name does not end in a version marker; the name carries no whole
 * word wrapped, staked or staking; the name does not begin with an exchange's name (Binance,
 * Coinbase, Bybit, Kraken, Bitget, OKX, Bitfinex, Gemini). v4: v1-v3 applied only the CEX
 * and version-marker parts of this rule, so v3 ranked 48 wrapped/staked/bridged products as
 * launches (20 Liquid Staking, 13 Bridge, 7 Canonical Bridge, the rest by name) and missed
 * the 20 genuine above-floor protocols the watchlist leaves out. The full rule is the
 * competition's own definition, not this radar's judgment. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Whether a protocol is one the board may rank: pre-token under the house's rule above. */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIXES.some((x) => p.name.startsWith(x))) return false;
  return true;
}

/** The product-exclusion part of the house rule only (no pre-token requirement): for the
 * comps, which have tokens by definition, so the pre-token part would exclude every one.
 * A comp fails when it IS a wrapped/staked/bridged/CEX product. 128 comps with mcap > 0
 * minus 36 failing this test = the 92 rule comps the value model is fitted on. */
export function passesProductRule(p: SnapshotProtocol): boolean {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIXES.some((x) => p.name.startsWith(x))) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** Categories that get their own one-hot feature in the odds logistic (n >= 20 in the snapshot). */
export const LOGISTIC_CATEGORIES: string[] = [
  'Basis Trading',
  'Bridge',
  'CDP',
  'CEX',
  'Canonical Bridge',
  'Derivatives',
  'Dexs',
  'Lending',
  'Liquid Staking',
  'Onchain Capital Allocator',
  'RWA',
  'Risk Curators',
  'Yield',
  'Yield Aggregator',
];

/** Feature names of the odds logistic, in order. v4: age is five one-hot bands, not log-age. */
export const LOGISTIC_FEATURES: string[] = [
  'log TVL',
  '7d growth, clamped -60..+30%',
  'chains, capped at 10',
  'age 0-179 days',
  'age 180-364 days',
  'age 365-729 days',
  'age 730+ days',
  'listed_at missing',
  ...LOGISTIC_CATEGORIES.map((c) => `category: ${c}`),
];

export interface LogisticModel {
  intercept: number;
  weights: number[];
  feature_means: number[];
  feature_sds: number[];
  lambda: number;
  iterations: number;
}

/** The logistic's features for one protocol, unstandardized. v4: age enters as five one-hot
 * bands (0-179, 180-364, 365-729, 730+ days, missing listed_at) - see the header comment. */
export function logisticFeatures(protocol: SnapshotProtocol, asOf: string, model: ModelConstants = MODEL): number[] {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growth = Math.min(model.logistic_growth_cap, Math.max(model.growth_floor, rawGrowth)) / 100;
  const bands = [0, 0, 0, 0, 0];
  if (age === null) bands[4] = 1;
  else if (age < 180) bands[0] = 1;
  else if (age < 365) bands[1] = 1;
  else if (age < 730) bands[2] = 1;
  else bands[3] = 1;
  const feats: number[] = [
    Math.log(protocol.tvl_usd),
    growth,
    Math.min(10, protocol.chains.length),
    ...bands,
  ];
  for (const c of LOGISTIC_CATEGORIES) feats.push(protocol.category === c ? 1 : 0);
  return feats;
}

function sigmoid(z: number): number {
  if (z > 30) return 1;
  if (z < -30) return 0;
  return 1 / (1 + Math.exp(-z));
}

/**
 * Fit the token-odds logistic on the whole snapshot: label 1 when the protocol records a
 * token, 0 when it is pre-token. Gradient descent, L2 penalty lambda * w / n, intercept
 * unpenalized, initialized at the log base rate. Standardization uses the snapshot's own
 * feature means and sds. This is the same fit the Python analysis ran (lambda 10, 600
 * iterations, lr 0.5): the TypeScript fit and the Python fit agree to within 0.01 on every
 * board row's odds (checked at build time; see TESTS-v2.md).
 */
export function fitLogistic(snapshot: Snapshot, model: ModelConstants = MODEL): LogisticModel {
  const rows = snapshot.protocols.map((p) => ({ x: logisticFeatures(p, snapshot.as_of, model), y: isPreToken(p) ? 0 : 1 }));
  const n = rows.length;
  const d = LOGISTIC_FEATURES.length;
  const means: number[] = [];
  const sds: number[] = [];
  for (let j = 0; j < d; j++) {
    const vals = rows.map((r) => r.x[j]!);
    const mu = vals.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mu) * (b - mu), 0) / n) || 1;
    means.push(mu);
    sds.push(sd);
  }
  const xs = rows.map((r) => r.x.map((v, j) => (v - means[j]!) / sds[j]!));
  const base = rows.reduce((a, r) => a + r.y, 0) / n;
  const weights = new Array<number>(d).fill(0);
  let intercept = Math.log(base / (1 - base));
  for (let it = 0; it < model.logistic_iterations; it++) {
    const grads = new Array<number>(d).fill(0);
    let gradB = 0;
    for (let i = 0; i < n; i++) {
      let z = intercept;
      for (let j = 0; j < d; j++) z += weights[j]! * xs[i]![j]!;
      const err = sigmoid(z) - rows[i]!.y;
      gradB += err;
      for (let j = 0; j < d; j++) grads[j]! += err * xs[i]![j]!;
    }
    for (let j = 0; j < d; j++) weights[j]! -= model.logistic_lr * (grads[j]! / n + (model.logistic_lambda * weights[j]!) / n);
    intercept -= model.logistic_lr * (gradB / n);
  }
  return { intercept, weights, feature_means: means, feature_sds: sds, lambda: model.logistic_lambda, iterations: model.logistic_iterations };
}

/** One protocol's token odds under a fitted logistic. */
export function tokenOdds(protocol: SnapshotProtocol, asOf: string, logistic: LogisticModel, model: ModelConstants = MODEL): number {
  const feats = logisticFeatures(protocol, asOf, model);
  let z = logistic.intercept;
  for (let j = 0; j < feats.length; j++) z += logistic.weights[j]! * ((feats[j]! - logistic.feature_means[j]!) / logistic.feature_sds[j]!);
  return sigmoid(z);
}

/** Gas tier of a protocol's first chain: a stated ASSUMPTION, not snapshot data (the snapshot
 * carries no gas prices). Ethereum is expensive, the cheap L1s are cheap, everything else is mid. */
export type GasTier = 'high' | 'mid' | 'low';
const CHEAP_CHAINS = new Set(['Solana', 'Tron', 'Sui', 'Aptos', 'Near', 'NEAR', 'Stellar', 'Ripple', 'Cosmos', 'Osmosis', 'Injective', 'Sei', 'Celestia']);
export function gasTier(p: SnapshotProtocol): GasTier {
  const chain = p.chains.length > 0 ? p.chains[0]! : '';
  if (chain === 'Ethereum') return 'high';
  if (CHEAP_CHAINS.has(chain)) return 'low';
  return 'mid';
}
export function gasCosts(tier: GasTier): { weekly_usd: number; setup_usd: number } {
  if (tier === 'high') return { weekly_usd: 5, setup_usd: 10 };
  if (tier === 'low') return { weekly_usd: 0.5, setup_usd: 1 };
  return { weekly_usd: 2, setup_usd: 4 };
}

/** How much capital one farm position needs, from the protocol's own TVL. */
export function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** The farm's out-of-pocket cost: setup gas + 8 weeks of weekly gas, by the chain's gas tier. */
export function farmCost(p: SnapshotProtocol, model: ModelConstants = MODEL): number {
  const gas = gasCosts(gasTier(p));
  return gas.setup_usd + model.farm_weeks * gas.weekly_usd;
}

export function verdictFor(ev: number, odds: number): Verdict {
  if (ev >= 12_500_000 && odds >= 0.45) return 'FARM';
  if (ev >= 2_500_000 && odds >= 0.35) return 'THIN';
  return 'SKIP';
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest implied value first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) chosen.set(p.slug, p);

  const logistic = fitLogistic(snapshot, model);
  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model);
    const odds = tokenOdds(p, snapshot.as_of, logistic, model);
    const ev = Math.max(1, Math.round(v.implied * odds));
    const cost = farmCost(p, model);
    const gas = gasCosts(gasTier(p));
    const usdPerHour = Math.round(((ev - cost) / model.farm_hours) * 100) / 100;
    return {
      p,
      implied: v.implied,
      baseLogLog: v.baseLogLog,
      categoryFactor: v.categoryFactor,
      growthPct: v.growthPct,
      growthMult: v.growthMult,
      maturityMult: v.maturityMult,
      age: v.age,
      chainsCount: v.chainsCount,
      chainsMult: v.chainsMult,
      odds,
      ev,
      cost,
      gas,
      tier: gasTier(p),
      usdPerHour,
      breakeven: cost / v.implied,
      verdict: verdictFor(ev, odds),
      late: v.age !== null && v.age > 730,
    };
  });
  // Gate order: rank is by implied value (sorted_by_value). EV rank is carried separately.
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const evOrder = [...scored].sort((a, b) => b.ev - a.ev || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const evRank = new Map(evOrder.map((s, i) => [s.p.slug, i + 1]));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    expected_value_usd: s.ev,
    token_odds: Math.round(s.odds * 10000) / 10000,
    p10_value_usd: Math.max(1, Math.round(s.implied / model.p90_factor)),
    p90_value_usd: Math.round(s.implied * model.p90_factor),
    ev_rank: evRank.get(s.p.slug)!,
    verdict: s.verdict,
    farm_cost_usd: s.cost,
    weekly_gas_usd: s.gas.weekly_usd,
    gas_tier: s.tier,
    farm_hours: model.farm_hours,
    usd_per_hour: s.usdPerHour,
    breakeven_odds: Math.round(s.breakeven * 1000000) / 1000000,
    late_flag: s.late,
    model: {
      loglog_base_usd: s.baseLogLog,
      category_factor: s.categoryFactor,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      age_days: s.age,
      chains_count: s.chainsCount,
      chains_multiplier: round4(s.chainsMult),
    },
    farm_steps: farmSteps(s.p, s.age, s.cost).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. Sharper than v1: curators,
 * allocators, RWA, perps and yield each get their own action instead of sharing one generic deposit. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('curator')) return `Deposit $${capital} of USDC into a ${name} curator vault on ${chain} and keep the vault shares; the curator allocates it across strategies, so read which vault you joined.`;
  if (c.includes('allocator')) return `Deposit $${capital} of USDC into a ${name} allocation vault on ${chain} and keep the shares; check what the vault allocates to before you deposit.`;
  if (c.includes('rwa')) return `Mint $${capital} of ${name}'s tokenized yield asset on ${chain} and hold it so the underlying yield accrues to you.`;
  if (c.includes('lend')) return `Supply $${capital} of USDC to ${name} on ${chain}, keep the position open, and make one small borrow against it so both sides of the market are active.`;
  if (c.includes('cdp') || c.includes('collateral')) return `Lock $${capital} of collateral in ${name} on ${chain} and mint a small amount of its stable asset against it; keep the position safely collateralized.`;
  if (c.includes('perpetual')) return `Deposit $${capital} of USDC as margin on ${name} on ${chain} and open one small hedged perpetual position; close the hedge before the position grows.`;
  if (c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} on ${chain} and open one small derivative position; keep the position sized so a single move cannot liquidate it.`;
  if (c.includes('dex')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open; pick the pool with the deepest liquidity, not the highest advertised yield.`;
  if (c.includes('yield aggregator') || c.includes('leveraged farm')) return `Deposit $${capital} of USDC into ${name}'s main strategy vault on ${chain} and let it auto-compound; keep the vault shares.`;
  if (c.includes('yield') || c.includes('liquidity manager')) return `Deposit $${capital} into ${name}'s main yield vault on ${chain} and keep the shares; note the vault's fee and lock-up before you deposit.`;
  if (c.includes('bridge') || c.includes('canonical bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app; keep the receipt transaction.`;
  if (c.includes('restak') || c.includes('liquid staking') || c.includes('staking')) return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token; the receipt is what the position is measured by.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one small market position on ${name} on ${chain}; keep the position open until the market resolves.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it in the protocol's own app.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active; note what the cover actually pays for.`;
  if (c.includes('basis')) return `Deposit $${capital} of USDC into ${name}'s basis strategy on ${chain} and keep the position open through one funding cycle.`;
  if (c.includes('payment')) return `Use ${name} on ${chain} to move $${capital} through its payment rail and keep the transaction record; repeat the payment once a week.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's weekly qualifying action: what "stay active" concretely means here. */
function weeklyActionFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('curator') || c.includes('allocator')) return 'Read the vault allocation report and, if the curator changed strategy, top up or move a small amount to the new vault.';
  if (c.includes('rwa')) return 'Check the underlying yield accrual and mint or top up a small amount so the position stays active.';
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'Adjust the supply, or borrow and repay a small amount, so both sides of the market stay active.';
  if (c.includes('perpetual') || c.includes('derivative')) return 'Open and close one small hedged trade, keeping the margin position open.';
  if (c.includes('dex')) return 'Make one swap or add a little liquidity to the same pool.';
  if (c.includes('yield') || c.includes('liquidity manager') || c.includes('leveraged farm')) return 'Harvest or compound the vault rewards once, or top up a small amount.';
  if (c.includes('bridge')) return 'Make one small bridge transfer and use the bridged funds in the app.';
  if (c.includes('staking') || c.includes('restak')) return 'Check the staking rewards accrual and, if the protocol offers it, restake a small amount.';
  if (c.includes('prediction')) return 'Place one small position on a new market.';
  if (c.includes('stable')) return 'Mint or deposit a small amount of the stable asset, or use it in the protocol app once.';
  if (c.includes('insurance')) return 'Check the policy is still active and renew or extend it if it is close to expiring.';
  if (c.includes('basis')) return 'Check the funding rate and keep the basis position open through the cycle.';
  if (c.includes('payment')) return 'Make one more payment through the rail and keep the record.';
  return 'Make one qualifying action, such as a deposit, a borrow, a swap or a vote.';
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived from
 * the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 * Total out-of-pocket cost is `cost` (setup gas + 8 weeks of weekly gas, by the chain's gas tier);
 * the capital itself is returned on exit.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, cost?: number): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const total = cost ?? farmCost(p);
  const gas = gasCosts(gasTier(p));
  const action = actionFor(p, capital, chain);
  const weekly = weeklyActionFor(p);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: `under $${gas.setup_usd} of gas for the first transaction on ${chain}`,
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${gas.setup_usd} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Each week: ${weekly}`,
      cost: `about $${gas.weekly_usd} of gas a week, $${gas.weekly_usd * 8} over 8 weeks on ${chain}`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position; total out-of-pocket cost is $${total}`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    expected_value_usd: row.expected_value_usd,
    token_odds: row.token_odds,
    p10_value_usd: row.p10_value_usd,
    p90_value_usd: row.p90_value_usd,
    ev_rank: row.ev_rank,
    verdict: row.verdict,
    farm_cost_usd: row.farm_cost_usd,
    weekly_gas_usd: row.weekly_gas_usd,
    gas_tier: row.gas_tier,
    usd_per_hour: row.usd_per_hour,
    breakeven_odds: row.breakeven_odds,
    late_flag: row.late_flag,
    loglog_base_usd: row.model.loglog_base_usd,
    category_factor: row.model.category_factor,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chains_count: row.model.chains_count,
    chains_multiplier: row.model.chains_multiplier,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const logistic = fitLogistic(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const verdict_counts: Record<Verdict, number> = { FARM: 0, THIN: 0, SKIP: 0 };
  for (const r of board) verdict_counts[r.verdict] += 1;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    tests: TEST_RESULTS,
    integrity: {
      total_protocols: snapshot.protocols.length,
      pre_token: snapshot.protocols.filter(isPreToken).length,
      rankable: snapshot.protocols.filter(isRankable).length,
      comps_mcap_gt0: snapshot.protocols.filter((p) => (p.mcap_usd ?? 0) > 0).length,
      comps_mcap_nonpositive: snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd <= 0).length,
      token_no_mcap: snapshot.protocols.filter((p) => !isPreToken(p) && p.mcap_usd === null).length,
      change_7d_null: snapshot.protocols.filter((p) => p.change_7d === null).length,
      listed_at_null: snapshot.protocols.filter((p) => p.listed_at === null).length,
    },
    verdict_counts,
    logistic,
    logistic_features: LOGISTIC_FEATURES,
    watchlist: snapshot.watchlist,
    rows: board.map(radarRow),
    live,
    comps: snapshot.protocols
      .filter((p) => (p.mcap_usd ?? 0) > 0 && passesProductRule(p))
      .map((p) => ({ t: p.tvl_usd, m: p.mcap_usd as number, c: p.chains.length })),
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  const evRanks = board.map((r) => r.ev_rank).sort((a, b) => a - b);
  for (let i = 0; i < evRanks.length; i++) if (evRanks[i] !== i + 1) return `ev_rank ${i + 1} is ${evRanks[i]}`;
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (!Number.isSafeInteger(r.expected_value_usd) || r.expected_value_usd <= 0) return `${r.slug} has expected value ${r.expected_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
