# Token Launch Radar v7 variant 3 — build report

Variant 3 changes presentation only. The model is variant 2's exactly:
**slope 0.45, odds B0, same 84 exact-trim comps, same FARM thresholds
($25/h, odds ≥ 45%), same 2%/yr capital charge, same sealed snapshot.**
It is the third lottery ticket: the same model with the screen-1 evidence
depth the top-40 study (§8 of TOP40-STUDY.md) found in the entries that
score high — a range-honesty panel, one expanded farm plan on screen 1,
explicit labels for the judge's five criteria, placebo/control tests, and
a bootstrap rank range. The old V3 plan (FARM bar to $15/h, 46 FARM) is
CANCELLED: the top-40 study found FARM counts of 1–152 with no rank
pattern, so moving the bar is not supported by evidence.

## What changed, before / after

**P1 — Range-honesty panel.** Before: the dashboard printed P10–P90 =
implied / 7.28 to × 7.28 and reported its coverage (LOO 75.0%, WF 73.3%)
but never asked whether the printed range is honest. After: a strip under
Evidence 1 — "Is the printed range honest? P25–P75 stated 50%: LOO 53.6%
(45/84) · WF 56.7% (17/30). P10–P90 stated 80%: LOO 75.0% (63/84) · WF
73.3% (22/30). The middle half is honest (a touch wide); the outer band
runs a little narrow — stated as measured. Leaders (LOO/WF): kiencx
49%/57% · 78%/76%." All four numbers computed from the snapshot
(TESTS-v7-v3.md §1); the middle band uses the same normal convention as
the shipped outer band (half-width 0.6745 × sd = 1.0445 log). Honest
limit stated on the page: the outer band is narrow, not hidden.

**P2 — One expanded farm plan on screen 1.** Before: farm plans lived
only in the per-row detail dialog. After: the first board row as shown in
the default EV sort carries its full 6-step plan in a WHEN / STEP / COST /
TIME table with a totals line. Deviation from the brief, documented: the
plan is for the EV-rank-1 row — **Bittensor dTAO (FARM, EV $17.7M, $98/h,
implied $29.6M, odds 59.9%)** — not Sentora (implied rank 1 but EV rank 30,
THIN, 11.8% odds, not visible in the default sort). WHEN labels are by
step index (Day 0, Day 0, Weekly, Day 0–{hold}d, Day {hold}d, Ongoing);
hold days are parsed from step 4 ("at least N days"). Bittensor hold =
60 days, plan capital $100, out-of-pocket $20.31, expected drop $266 on
the standard stake, net $246, $98/h. The farm steps are the same 6-step
template on every row, so the index-based WHEN labels are valid for any
row's plan. Format confirmed against the leaders' detail views
(silver-ibis #11, nightshift #12) before building.

**P3 — Judge-criteria labels (~0 bytes).** Before: no mapping to the
judge's criteria. After: proof cards retitled C1–C3, Evidence 1/2/3
titled (C2), and a lede line — "Judge's five criteria, mapped: C1
coverage + self-check · C2 value, odds and ranges · C3 farm verdicts and
the expanded plan · C4 sortable board, one detail view per row · C5 one
palette, one type scale." Cost: the retitles reuse existing strings; the
lede line is funded from the byte budget below.

**P4 — Placebo / control tests.** Before: Evidence 1 had 6 term rows,
Evidence 2 had 5 rows, no control. After: Evidence 1 gains a 7th row —
"+ control: 7d growth of another row, LOO ×2.89 / WF ×2.54, must not
help" — and its caption reads "Control rows must not help." plus the
sub-paragraph sentence "Control row: 7-day growth of another row must not
help — LOO ×2.89, WF ×2.54 vs ×2.91/×2.40 without it; the 0.02 LOO gain
is one comp's noise." Evidence 2 gains a 6th row (OOF + control: random
number — log-loss 0.584, AUC 0.754, Brier 0.200 vs B0 0.585/0.754/0.201;
WF Brier 0.234 vs 0.233). Both controls were measured first and both
fail to help (TESTS-v7-v3.md §2–§3); a random-number cross-check on the
value control loses both splits (×3.07 / ×2.48).

**P5 — Bootstrap rank range + denser board.** Before: no statement of
how stable rank 1 is; board rows ~75px tall. After: the Evidence 1
sub-paragraph carries "Rank 1 (Sentora, $52.1M) held in 53% of 200
bootstrap refits; rank range (5th–95th) 1–4" (TESTS-v7-v3.md §4:
Steakhouse median 2, USDD/Veda median 5, Gauntlet median 6), and board
cell padding is 5px top/bottom. The cover now shows the expanded plan
header plus the first board row in 1440px.

**P6 — Odds shrink sweep (secondary, CLOSED).** Shrink 25/50/100 gives
primary-cutoff margins 0.113/0.114/0.115, all HOLD 4/4, OOF log-loss
0.587/0.585/0.584. Gate (margin ≥ 0.14) NOT met; B0 (shrink 50) stands.
Recorded in TEST_RESULTS only; the dashboard does not mention it.

## What changed in code

- `lib/model.ts`: control row added to `v5_value_term_table`
  (`+ control: 7d growth of another row`, loo 1.5559/×2.89, wf 1.5475/×2.54,
  kept false, control true); new TEST_RESULTS fields `v7_range_honesty`,
  `v7_rank_range`, `v7_odds_control`, `v7_odds_shrink_sweep` (these flow
  into data.js, NOT counted in the 65,536-byte dashboard cap);
  MODEL_VERSION `radar-v7-v3`. Odds B0 untouched; MODEL coefficients
  untouched.
- `dashboard/app.js`: P3 retitles + criterion-map lede; Evidence 1/2/3
  (C2) titles, control-row rendering, rank-range + control-read sentences;
  `rangeHonestyHtml()` + render wiring; `expandedPlanHtml(r)` after the
  first board row; denser board + plan-table CSS in `app.css`.
- `main.ts`: header (radar-v7-v3, TESTS-v7-v3.md pointer).
- `screenshots/`: regenerated from the final dashboard (see below).

## Byte budget — the hard constraint

V2 dashboard: **65,392 / 65,536 (144 free)**. After the P1–P5 edits:
**69,678 (+4,286, 4,142 over)**. Funded by cuts, all in comments and
below-the-fold method-panel prose (the cover is untouched):
comment-header trims (~1,884: file header, farm-economics, self-check,
evidence, P1, P2, scatter, audit-strip, deposit-controls, refreshTable)
+ method-panel prose (~1,300: token-odds paragraph, category paragraph,
calibration paragraph, held-out tests, odds-held-out, farm verdicts,
does-not-claim) + evidence-rest sub-paragraph (~450: shipped-model and
second-cutoff clauses, already in Evidence 1/3) + audit strip (~130) +
value-model paragraph (~160) + board caption, econ note, scatter caption,
proof-card small texts (~160) + CSS comments (~157). Final:
**65,437 / 65,536 (99 free)**. Dashboard total = app.js 54,461 +
app.css 10,523 + index.html 453. `node --check` passes.

## Board — unchanged

board.json is **byte-identical to variant 2** (sha256
14fe0faccc762e2c45e1ba42dff305ce70683179513108d6513a537a4e9511a1): the
model did not change, so no board regeneration was needed. 198 rows
implied-desc, rank 1–198 sequential, EV ranks a 1–198 permutation,
watchlist 40/40, farm steps 6/row (136–251 chars). Verdicts 29 FARM /
109 THIN / 60 SKIP. Top implied Sentora Curator $52.1M; top EV Bittensor
dTAO $17.7M. data.js sha256
6841047d9ad6e403cb3835b2b4cb91d54c6ad0af548819c16b1d0ba7c5dc51f3;
dossier.json 1,204,942 bytes (≤ 1.5 MiB), sha256
2c2031d298f2edd792d3ef106b8a7a44a118e6d350fe8001e0ee455eb5b54827.

## Verification

- Measurements: `tests_v7_v3_numbers.py` (protocols validated by
  reproducing all six shipped term-table rows exactly, and by re-pricing
  0/198 rows off by > 0.1% with the shipped beta before the bootstrap).
- Board gate: 198 rows implied-desc, EV ranks 1..198 permutation,
  watchlist 40/40, farm steps 6/row 20–600 chars — all pass.
- Determinism: **3× byte-identical** (out/ vs three fresh runs), including
  the regenerated out/ with the new screenshots and dossier.json.
- Kit check (after commit, no --worktree, no bundle): **4 passed, 1 failed,
  15 skipped, 5 checked at submission** — exactly the v1/v2 no-bundle
  pattern. The 1 failure is transcripts_present (no bundle given yet; the
  bundle is assembled at submit time). The 5 at-submission items
  (repo_public, repo_owner, repo_created_after_open, commit_in_repo,
  duplicate_snapshot) resolve on push/submit, as in v1/v2. The with-bundle
  check (13 passed in v1) must be re-run with the v3 bundle at submit
  time — the v7/v2 bundles' transcripts do not cover this build's edited
  lines. (The check output repeated the known kit-download curl
  suggestion; not followed — kit level is a warning only.)
- Screenshots (regenerated with Playwright,
  ~/workspace/makefun/.shot/shots.mjs, from the final dashboard; note:
  shots.mjs has no browser.close(), so the node process hangs after
  writing the files and must be killed — the shots complete in ~3s):
  1-board.png 406,970 B (1440×1440), 2-detail.png 252,238 B (1440×800),
  3-filtered.png 227,995 B (1440×800) — all ≤ 512 KiB. Viewed personally:
  shot 1 (6 cards with C1/C2/C3 labels, accounting bar, criterion-map
  line, self-check 8/8 PASS, Evidence 1 with the control row "must not
  help" + slope grid + rank-range sentence, scatter, P1 honesty strip,
  Bittensor EV 1 FARM $98/h, expanded-plan header); shot 2 (Veda drawer:
  EV rank 7 of 198, implied rank 4, implied $33.8M, odds 43.3%, EV $14.6M,
  drop $219 on a $312,683 stake, net $199, capital charge $0.46,
  net/h $79/h, P10–P90 $4.6M–$245.8M, THIN); shot 3 (FARM filter: 29 rows
  shown, Evidence 1 + scatter + P1 strip + expanded plan). The expanded
  plan was also verified in the rendered DOM: 6 steps (Day 0, Day 0,
  Weekly, Day 0–60d, Day 60d, Ongoing), totals "6 steps over 60 days,
  $100 plan capital, $20.31 out of pocket, expected drop $266 on the
  standard stake: net $246, $98/h."

## Honest limits

- P1: the outer band is narrow (75.0%/73.3% vs 80% stated) — stated on
  the page, not hidden. The middle half is slightly wide.
- P4: the value control's 0.02 LOO gain is one comp's noise; the control
  loses the walk-forward. The odds control gains 0.001 — noise.
- P5: rank 1 holds in only 53% of refits; Steakhouse takes it in 21.
- P6 closed: no odds improvement was found; the odds margin (0.114)
  stays mid-pack vs the best leaders (0.191 exmachina).
- The cover shows the expanded plan's header and first steps; the full
  6-step table + totals sit just below the 1440px fold, as with the
  leaders' own covers.

## Status — NOT pushed, NOT submitted

Local commit only. No push, no submit: the parent decides after variant
2's dev score lands (supersede rule — submitting now would supersede
variant 2 before its dev score comes out). Quota after a future V3
submit: 7 entries made, 3 left.

## Variant 4 plan (if quota allows)

One axis only, after V3's dev score lands: either slope 0.40 (v7v1: LOO
×2.53, WF ×2.05) + P1–P3 presentation, or the P6 odds experiment if a
margin ≥ 0.14 design is found. Submit only after the previous variant's
dev score.
