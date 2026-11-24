# Token Launch Radar v6 — build report

Build-only: NOT pushed to GitHub, NOT submitted. Local HEAD before this build: 765864c
(v5). Work in ~/workspace/makefun/token-radar-01/ only. Research notes
(TOP10-STUDY-V6.md, top10-study/) stay local-only and are NOT part of this commit.

## Why v6 exists

V5 scored 90.92% (rank #3,803), BELOW v4's 91.79%. The top-10 study
(TOP10-STUDY-V6.md) found three causes, fixed here in priority order:
1. V5 showcased its FAILED odds walk-forward (Brier 0.344 vs base 0.242) while v4 hid
   WF odds entirely; top-10 odds all pass WF (Brier 0.21–0.28).
2. The 92-comp refit weakened headline numbers (R² 0.402→0.288, top EV $54.7M→$32.4M).
3. Farm economics were broken — V5's only visible board row showed net/hour
   $12.9 MILLION/hour; top 10 show $0.23–$39.77.
Plus the artifact: V5 showed 1 board row, V4 showed 0; top 10 show 10–14 rows, with
a self-check strip and a 758-protocol accounting bar we never had.

## Fix 1 — odds model now passes the walk-forward

v5 features (age bands + one-hot categories) → v6 features (10): log TVL; log(age+1)
(age 365d when listed_at is missing); age as five one-hot bands; 7d growth clamped
−60..+30%; chains capped at 10; and the protocol's category token rate,
empirical-Bayes shrunk toward the fitting set's base rate with strength 50 — computed
from the fitting set only, never from held-out labels.

Primary walk-forward (cutoff 2024-07-15, train 239 / test 246, records-token label):
**WF Brier 0.233 vs test base rate 0.241, WF AUC 0.626, WF log-loss 0.662 — PASSES.**
v5 on the same split: 0.346 / 0.558 / 0.993. The pass is not a knife-edge: every
shrink from 5 to 200 passes (Brier 0.240→0.232); shrink 50 is chosen where the OOF
curve flattens. Both changes are needed (ablation: log-age without the category rate
0.264; category rate without log-age 0.334).

Honest limits, reported on the dashboard, not hidden:
- Second cutoffs FAIL on Brier: 2024-01-01: 0.327 vs base 0.247 (AUC 0.605);
  2025-01-01: 0.242 vs base 0.237 (AUC 0.615); 2023-07-01: 0.265 vs base 0.250
  (AUC 0.667). AUC passes at all three; Brier passes only at the primary.
- Random-split cost: 5-fold OOF log-loss 0.583 vs v5 0.575, AUC 0.757 vs 0.770,
  Brier 0.200 vs 0.195; ECE 0.0461 vs 0.0265. The model trades a little random-split
  accuracy for across-time transfer.
- Platt recalibration re-tested on the new model: worse (0.5834 vs 0.5828) — not adopted.

TypeScript vs Python: the shipped TS fit reproduces the Python full fit exactly
(intercept 0.2371; max per-row odds difference 0.0000 over all 198 board rows).

The value model is UNCHANGED (LOO x3.07 / WF x2.29, already better than kiencx
x3.33 / x2.53). No headline chasing: top EV is now $29.3M (Veda), down from v5's
$32.4M, because the new odds are lower across the board (Veda 47.8%→43.3%,
Steakhouse 31.1%→20.9%, Sentora 17.0%→11.8%).

## Fix 2 — farm economics in real dollars

- Expected drop = EV × 7.5% (drop share, stated assumption) × (deposit / TVL);
  standard stake 0.02% of TVL; fee = setup + 8 weeks gas by tier; net = expected
  drop − fee; net/hour = net / 2.5 active hours.
- Verdict: FARM iff net/hour ≥ $25 AND odds ≥ 45%; THIN iff net > 0; SKIP iff net ≤ 0.
- Board: **28 FARM / 106 THIN / 64 SKIP**. Net/hour: min −$19.22, p10 −$12.05,
  p25 −$2.27, p50 $6.81, p75 $18.18, p90 $53.98, max $170.14 (usdd). The FARM set
  keeps 11 of the 12 v5 slugs (veda drops out: odds 43.3% < 45% despite $167.79/h)
  and adds 17 rows.
- Documented deviation: the task's literal formula (implied value, no odds floor)
  gives 117 FARM / 74 THIN / 7 SKIP, including Sentora Curator (11.8% odds) and
  Nonce Capital (7.6% odds) — a size ranking, not a farming decision. An expectation
  without the launch probability is not an expectation. v6 uses EV and states the
  choice in the code, the dashboard and the detail drawer.
- Break-even odds = fee / (implied × 7.5% × 0.02%): median 21.4%, p90 58.2%, max
  142.2% (flying-tulip-ftusd); 41 rows need >45% odds to cover the fee, 7 rows never
  can even at 100% odds. The odds floor is now a real cost cover.
- Standard stakes run $1,001–$551,517 (median $4,518; Veda $312,683, Sentora
  $551,517) — a pro-rata share for pricing the drop, not a cash requirement; the farm
  plan's minimum capital stays $50–$250. No capital charge is added (a 5%/yr charge
  on a $312K stake would dwarf the drop). At the standard stake over 8 weeks the
  dashboard net equals the row's farm_net_usd exactly.
- Dashboard: deposit presets Standard (0.02% TVL) / $1K / $10K / $100K + horizon
  4–26w re-price NET and NET/HOUR per row; the verdict stays the standard one. The
  detail drawer shows the explicit calculation in silver-ibis format ("implied $X ×
  odds Y% = EV $Z; EV $Z × 7.5% to users × $D stake of TVL $T = $W expected drop;
  − $F fees = $N net; $N / 2.5h = $H/hour").

## Fix 3 — the artifact shows the goods

- Cover now shows: 6 proof cards (incl. the WF pass and 28/106/64 verdicts), the
  758-protocol accounting bar (758 = 198 ranked + 416 already-token + 144 rule-fail;
  every protocol in exactly one group), and the self-check strip with all 8 checks
  PASS, computed live (watchlist 40/40, board sorted, EV ranks 1–198, row 1
  re-priced, 198/198 farm plans have 6 steps, range coverage LOO 75.0% / WF 73.3%,
  value model on 92 rule comps).
- Board: **11 rows fully visible (12 partially) in shot 1 at 1440×1440**, up from
  v5's 1 row. The evidence tables moved below the board so the board starts at
  y=722; they remain on the page and in the dossier.
- Dashboard total: **64,477 / 65,536 bytes** (index.html 453 + app.css 10,127 +
  app.js 53,897). Room was found by compressing the method-panel prose (~40% cut
  in the farm paragraph) and dropping the stale v4-sandbox note; the sandbox was
  already gone in v5.
- Screenshots (regenerated with Playwright, ~/workspace/makefun/.shot/shots.mjs):
  1-board.png 1440×1440, 329,600 B; 2-detail.png (Veda drawer) 1440×800, 259,194 B;
  3-filtered.png (FARM filter, 28 rows) 1440×800, 160,270 B. All within the 512 KiB
  cap. Shot 2 shows the expected-drop calculation; shot 3 shows only FARM rows.
- One bug caught by the visual check and fixed: the new farm fields were added to
  BoardRow but not to RadarRow (the data.js compact form), so the Net columns
  rendered "n/a" in the first v6 screenshots. Fixed by adding farm_deposit_usd,
  farm_expected_drop_usd, farm_net_usd to RadarRow + radarRow(); re-screenshotted
  and verified ($419 net / $168/h for Veda).

## Verification

- Determinism: two main.ts runs byte-identical (diff -r empty, incl. dossier.json).
- Board: 198 rows (40 watchlist + 158 early), ranked by implied value (verified
  non-increasing), EV ranks a permutation 1–198, watchlist 40/40, every row 6 farm
  steps of 20–600 chars.
- Kit check (`check --kit . --repo ../token-radar-01 --worktree`, no --transcripts):
  4 passed (competition_open, snapshot, license_osi, entrypoint), 1 failed
  (transcripts_present — expected, no bundle exists yet), 15 skipped, 5 at
  submission. Same pattern as v5.
- Dossier: 1,064,953 bytes (v5: 1,025,036) — within the 1.5 MiB cap.
- Render check (Playwright 1440×1440): cover text contains proof cards, accounting
  bar, self-check all PASS, zero FAIL lines; board starts y=722, 11 rows visible.

## Files changed

- lib/model.ts — v6 odds (log-age + bands + shrunk category rate, catRates on the
  fit), v6 farm economics (deposit/expected/net/breakeven/verdict), three new row
  fields, TEST_RESULTS (v6_odds_walk_forward, odds, verdict_sweep, shrunk rates).
- main.ts — radar-v6 header comment.
- dashboard/app.js — proof cards, accounting bar + cover self-check, Evidence 2
  (v6 WF table), method panel (odds features, category paragraph, calibration,
  held-out odds, farm economics, limits), econ functions + deposit presets +
  horizon, detail drawer (expected-drop row + calculation), evidence moved below
  the board, header comment.
- dashboard/app.css — table cell padding 12px → 8px (compact board rows).
- screenshots/1-board.png, 2-detail.png, 3-filtered.png — regenerated.
- TESTS-v6.md, V6-BUILD.md (this file) — new.
- README.md — model section updated to radar-v6.

## Not done / next steps (for the parent, NOT this build)

- No push to GitHub, no submission (build-only task). When the parent decides to
  submit: push the commit, bundle transcripts (the v5 bundle method), run
  `makefun check` with --transcripts, submit before 14 Dec 2026 17:00 WIB.
- The odds walk-forward passes only at the primary cutoff; the second cutoffs fail.
  If a v7 is ever attempted, the next lever is the cutoff robustness (train-cohort
  age homogeneity is the binding constraint), not more features.
