// Token Radar v3 (radar-v3): one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds
// pre-token protocols below the watchlist floor: the early rows the radar exists to find. A protocol
// is pre-token when its index entry records no token (no market cap, no CoinGecko id, no symbol);
// the snapshot's live-token protocols are kept apart and shown as the market's own values, never
// mixed into the ranked board.
//
// Implied value is FITTED from the snapshot's own token-bearing protocols, not hand-picked:
//
//   log-log fit on the 116 trimmed comps (mcap > 0, mcap/TVL ratio in P5-P95):
//     log(mcap) = 4.002 + 0.687 * log(TVL)      R^2 = 0.402, residual sd (log) = 1.594
//   category factor: a category's median mcap/TVL over the global median 0.2138, shrunk
//     toward 1.0 with weight n/(n+8) (n = comps in that category); only categories with
//     n >= 8 get a factor, the rest use 1.0. Held-out sweep (TESTS-v2.md): the factor does
//     NOT improve leave-one-out error at any shrinkage k (best is k = infinity, i.e. no
//     factor, 1.618 vs 1.642 at k = 8). It is kept at k = 8 anyway, and the dashboard says
//     why: it corrects large systematic category biases (the global fit overpredicts
//     Lending by ~2.5x, Liquid Staking by ~2.3x), and the LOO cost of keeping it is small
//     (0.024 log units). A bias correction, not a variance win.
//   growth     = clamp(change_7d, -60, 120) per cent; growthMult = 1 + growth/100 * 0.15
//     (weight 0.15, not the starter's 0.5: peer token rates FALL with 7d growth, and the
//     growth term changes in-sample log-RMSE by < 0.001 at any weight 0-0.5.)
//   maturity   = 0.85 + min(age_days, 1095) / 1095 * 0.30   (age unknown: 365 days)
//   implied    = max(1, round(exp(4.002 + 0.687*ln(TVL)) * category_factor * growthMult * maturityMult))
//
// Token odds are a LOGISTIC REGRESSION fitted on all 758 protocols (label: records a token),
// implemented from scratch in this file (gradient descent, L2 lambda = 10, 600 iterations,
// standard library only). Features, all from the snapshot: log TVL, log(age + 1) with
// missing listed_at scored as 365 days plus a missing-age flag, 7d growth clamped to
// -60..+30% for the odds feature (the +120% cap of the value model would let one listing
// artifact, Shift DeFi at +4448%, dominate the feature; peer token rates are already at
// their floor above +30%), number of chains capped at 10 (one protocol lists 176 chains),
// and one-hot category for the 14 categories with >= 20 protocols. Held out it beats the
// v1 age x TVL bucket odds clearly (TESTS-v2.md): 5-fold out-of-fold log-loss 0.586 vs
// bucket 0.662 vs base rate 0.688; AUC 0.763 vs 0.619. EV = implied * odds. The board's
// rank is by implied value, as the gate requires (implied_value_usd must not rise as rank
// ascends); the dashboard's default view sorts by EV, which is the "worth farming next"
// ranking, and every row carries its EV rank separately. Odds are the PEER PREVALENCE of
// a token among protocols like this one, not a forecast of a launch date: an old protocol
// with no token may simply never launch.
//
// P10-P90 come from the fit's residual sd: P10 = implied / 7.72, P90 = implied * 7.72.
// That is a factor of ~7.7 either way, and it is shown, not hidden: R^2 = 0.40 is a weak model.
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
// SKIP. Break-even odds = cost / implied. V3 tested this rule instead of assuming it
// (TESTS-v3.md): break-even odds are at most 0.0023% on the whole board, so the farm cost
// never binds and the 45% floor is a likelihood standard, not a cost cover: FARM means
// the token is at least roughly even-money (45% is 50% minus ~5 points of calibration
// slack, the mid deciles over-predict by 4-7 points), and the sweep shows 40% and 45%
// give the identical FARM set while 30% admits exactly the two Risk Curators the odds
// model flags (Steakhouse 36.6%, Gauntlet 30.5%; peer token rate 12.8%) and 50% drops
// onre (48.6%) and upshift (45.8%). The EV tier matters more: $5M gives 39 FARM,
// $25M gives 3, $50M gives 1 (Veda only). V3 also tested odds calibration (Platt,
// isotonic, shrinkage to the base rate) and adopted none of them: all three failed to
// improve held-out log-loss/Brier, and the shrinkage gain (-0.002 log-loss) is inside
// noise (paired t = -0.65, bootstrap 95% CI includes zero). The k = 8 category factor
// is kept too: dropping it moves 53 board rows by more than 10 EV ranks (mostly Liquid
// Staking rows moving up, which is the known +0.830 log bias returning), while the top
// 10 EV rows are the same set under k = 8, k = 32 and no factor at all.
//
// What this model does NOT claim: a walk-forward test. The snapshot is one date (2026-11-14);
// there is no TVL or price history in it, so no genuine walk-forward exists. The held-out tests
// are leave-one-out, split-half (20 seeds), 5-fold out-of-fold, category holdout and a
// listed-date split; their numbers are in TESTS-v2.md and in the dashboard's test panel.
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
  log_intercept: 4.002,
  log_slope: 0.687,
  growth_weight: 0.15,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.85,
  maturity_range: 0.3,
  maturity_days: 1095,
  unknown_age_days: 365,
  resid_sd_log: 1.594,
  p90_factor: 7.72,
  base_token_rate: 0.5488,
  logistic_lambda: 10,
  logistic_growth_cap: 30,
  logistic_iterations: 600,
  logistic_lr: 0.5,
  farm_hours: 2.5,
  farm_weeks: 8,
};

/**
 * Category factors, fitted from the snapshot's trimmed comps and shrunk toward 1.0 with
 * weight n/(n+8). Verified by recomputation from snapshot.json at build time (see TESTS-v1.md):
 * raw factors Dexs 1.602, RWA 1.285, Yield 1.198, Lending 0.611, Liquid Staking 0.206,
 * CEX 0.320; shrunk values below. Categories with fewer than 8 trimmed comps use 1.0.
 */
export const CATEGORY_FACTORS: Record<string, number> = {
  Dexs: 1.314,
  RWA: 1.142,
  Yield: 1.095,
  Lending: 0.731,
  'Liquid Staking': 0.454,
  CEX: 0.566,
};

export function categoryFactor(category: string | null): number {
  if (category === null) return 1.0;
  return CATEGORY_FACTORS[category] ?? 1.0;
}

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-v3';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 173;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** Held-out test results, computed from snapshot.json at build time (see TESTS-v2.md). */
export const TEST_RESULTS = {
  method: 'Leave-one-out, split-half (20 seeds), 5-fold out-of-fold and category holdout on the 116 trimmed comps (mcap > 0, mcap/TVL in P5-P95) for value; split-half (20 seeds) and 5-fold out-of-fold on all 758 protocols for the token-odds logistic. No walk-forward: the snapshot is one date, so no genuine walk-forward exists.',
  loo_trimmed_log_rmse: 1.618,
  loo_trimmed_flat_log_rmse: 1.702,
  loo_all128_log_rmse: 2.107,
  loo_all128_flat_log_rmse: 2.277,
  loo_category_shrunk_log_rmse: 1.642,
  split_half_log_rmse_mean: 1.605,
  split_half_log_rmse_min: 1.486,
  split_half_log_rmse_max: 1.749,
  split_half_flat_log_rmse_mean: 1.683,
  split_half_starter_log_rmse_mean: 1.688,
  category_holdout: [
    { category: 'Dexs', n: 11, log_rmse: 1.805, bias_log: -0.348 },
    { category: 'RWA', n: 9, log_rmse: 0.732, bias_log: -0.212 },
    { category: 'Yield', n: 8, log_rmse: 1.221, bias_log: -0.005 },
    { category: 'Lending', n: 14, log_rmse: 2.1, bias_log: 0.913 },
    { category: 'Liquid Staking', n: 8, log_rmse: 1.434, bias_log: 0.83 },
    { category: 'CEX', n: 8, log_rmse: 1.566, bias_log: 0.163 },
  ],
  listed_date_split_log_rmse: 1.524,
  listed_date_split_bias_log: -0.524,
  listed_date_split_train_n: 60,
  listed_date_split_test_n: 27,
  listed_date_split_reverse_log_rmse: 1.61,
  growth_weight_sensitivity: 'in-sample log-RMSE 1.594 at weight 0, 1.594 at 0.15, 1.595 at 0.5: the growth term is inert.',
  category_factor_sweep: [
    { k: 0, loo_log_rmse: 1.658 },
    { k: 2, loo_log_rmse: 1.652 },
    { k: 4, loo_log_rmse: 1.648 },
    { k: 8, loo_log_rmse: 1.642 },
    { k: 16, loo_log_rmse: 1.635 },
    { k: 32, loo_log_rmse: 1.629 },
    { k: 64, loo_log_rmse: 1.625 },
    { k: 'inf (no factor)', loo_log_rmse: 1.618 },
  ],
  // v3: verdict-threshold sweep on the 213 board rows (raw logistic odds).
  verdict_sweep: {
    farm_odds_thresholds: [
      { threshold: 0.3, farm: 14, thin: 70, skip: 129, enters_vs_045: ['gauntlet', 'steakhouse-financial'] },
      { threshold: 0.35, farm: 13, thin: 70, skip: 130, enters_vs_045: ['steakhouse-financial'] },
      { threshold: 0.4, farm: 12, thin: 71, skip: 130, enters_vs_045: [] },
      { threshold: 0.45, farm: 12, thin: 71, skip: 130, enters_vs_045: [] },
      { threshold: 0.5, farm: 10, thin: 73, skip: 130, leaves_vs_045: ['onre', 'upshift'] },
    ],
    farm_ev_tiers: [
      { ev_tier_usd: 5_000_000, farm: 39 },
      { ev_tier_usd: 12_500_000, farm: 12 },
      { ev_tier_usd: 25_000_000, farm: 3 },
      { ev_tier_usd: 50_000_000, farm: 1 },
    ],
    breakeven_odds: { max: 0.000023, max_row: 'swan-dao', median: 0.000004, p90: 0.000011 },
    decision:
      'Keep FARM at EV >= $12.5M and odds >= 45%. Break-even odds are at most 0.0023% on the whole board, so the farm cost never binds: the 45% floor is a likelihood standard (roughly even money, minus ~5 points of calibration slack), not a cost cover. 40% and 45% give the identical FARM set; 30% admits exactly the two Risk Curators (Steakhouse 36.6%, Gauntlet 30.5%); 50% drops onre (48.6%) and upshift (45.8%).',
  },
  // v3: ranking impact of the value model's category factor (same odds, implied recomputed).
  k_ranking_impact: {
    k32_vs_k8: { rows_moving_gt10_ev_ranks: 28, max_ev_rank_move: 33, top10_same_set: true },
    no_factor_vs_k8: { rows_moving_gt10_ev_ranks: 53, max_ev_rank_move: 44, top10_same_set: true },
    decision:
      'Keep k = 8. Dropping the factor improves LOO by only 0.024 log units (1.618 vs 1.642) but moves 53 rows by more than 10 EV ranks, mostly Liquid Staking rows moving up - that is the known systematic bias returning (category holdout: Liquid Staking +0.830 log, Lending +0.913 log). The top 10 EV rows are the same set under k = 8, k = 32 and no factor.',
  },
  odds: {
    model: 'Logistic regression, L2 lambda 10, 600 gradient-descent iterations, features: log TVL, log(age+1), 7d growth clamped -60..+30%, chains capped at 10, missing-age flag, one-hot category (14 categories with n >= 20). Fitted at build time from the snapshot.',
    split_half_logloss: 0.59,
    split_half_auc: 0.758,
    split_half_brier: 0.201,
    oof_logloss: 0.586,
    oof_auc: 0.763,
    oof_brier: 0.199,
    bucket_split_half_logloss: 0.666,
    bucket_split_half_auc: 0.622,
    bucket_oof_logloss: 0.662,
    bucket_oof_auc: 0.619,
    numeric_only_split_half_logloss: 0.641,
    numeric_only_split_half_auc: 0.711,
    base_rate_logloss: 0.688,
    // v3: calibration candidates, all evaluated HELD-OUT (5-fold OOF, seed 7; split-half
    // 20 seeds) with the calibrator fitted inside each fold on inner out-of-fold logits.
    // Protocol matches the shipped model exactly (growth cap +30%, 600 iterations), which
    // is why the raw baseline here is 0.5863 / 0.5876 rather than v2's 0.586 / 0.590.
    calibration_tested: [
      { method: 'Raw logistic (adopted)', oof_logloss: 0.5863, oof_brier: 0.1991, oof_auc: 0.763, oof_ece: 0.0387, split_half_logloss: 0.5876, split_half_brier: 0.2001 },
      { method: 'Platt scaling', oof_logloss: 0.588, oof_brier: 0.2001, oof_auc: 0.762, oof_ece: 0.0492, split_half_logloss: 0.5894, split_half_brier: 0.201 },
      { method: 'Isotonic regression', oof_logloss: 0.619, oof_brier: 0.2013, oof_auc: 0.757, oof_ece: 0.0311, split_half_logloss: 0.6291, split_half_brier: 0.2027 },
      { method: 'Shrinkage to base rate, w=0.9', oof_logloss: 0.5843, oof_brier: 0.1993, oof_auc: 0.763, oof_ece: 0.044, split_half_logloss: 0.5862, split_half_brier: 0.2003 },
    ],
    calibration_decision:
      'No calibration adopted. Platt is worse held-out on log-loss and Brier in both protocols; isotonic is much worse (log-loss 0.619 OOF) and its full-fit breakpoints are degenerate (a run of 1.0s at the top: overfit on n=758). Shrinkage w=0.9 improves log-loss by only 0.002 in both protocols, its Brier does not improve, its ECE is worse, and the paired gain is inside noise (t=-0.65, bootstrap 95% CI -0.0086 to +0.0037). The raw logistic stays.',
    calibration_oof_deciles: [
      { decile: 1, predicted: 0.118, observed: 0.227 },
      { decile: 2, predicted: 0.285, observed: 0.263 },
      { decile: 3, predicted: 0.397, observed: 0.355 },
      { decile: 4, predicted: 0.478, observed: 0.395 },
      { decile: 5, predicted: 0.54, observed: 0.539 },
      { decile: 6, predicted: 0.603, observed: 0.573 },
      { decile: 7, predicted: 0.663, observed: 0.645 },
      { decile: 8, predicted: 0.728, observed: 0.724 },
      { decile: 9, predicted: 0.793, observed: 0.842 },
      { decile: 10, predicted: 0.889, observed: 0.921 },
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

/** The fitted log-log base value and the multipliers and the implied value one protocol gets. */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants): { implied: number; baseLogLog: number; categoryFactor: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const baseLogLog = Math.exp(model.log_intercept + model.log_slope * Math.log(protocol.tvl_usd));
  const catFactor = categoryFactor(protocol.category);
  const implied = Math.max(1, Math.round(baseLogLog * catFactor * growthMult * maturityMult));
  return { implied, baseLogLog: Math.round(baseLogLog), categoryFactor: catFactor, growthPct, growthMult, maturityMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
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

/** Feature names of the odds logistic, in order. */
export const LOGISTIC_FEATURES: string[] = [
  'log TVL',
  'log(age in days + 1)',
  '7d growth, clamped -60..+30%',
  'chains, capped at 10',
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

/** The logistic's features for one protocol, unstandardized. */
export function logisticFeatures(protocol: SnapshotProtocol, asOf: string, model: ModelConstants = MODEL): number[] {
  const age = ageDays(asOf, protocol.listed_at);
  const ageEff = age ?? model.unknown_age_days;
  const rawGrowth = finite(protocol.change_7d, 0);
  const growth = Math.min(model.logistic_growth_cap, Math.max(model.growth_floor, rawGrowth)) / 100;
  const feats: number[] = [
    Math.log(protocol.tvl_usd),
    Math.log(ageEff + 1),
    growth,
    Math.min(10, protocol.chains.length),
    age === null ? 1 : 0,
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
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
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
