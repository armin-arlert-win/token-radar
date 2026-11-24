
# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/armin-arlert-win/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/armin-arlert-win/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it reads a sealed DefiLlama snapshot of 758 protocols, finds the ones that record no token, and ranks them by expected launch value — a fitted log-log size model times logistic token odds from the protocols' own record — with an honest P10–P90 range and a costed farm plan (FARM / THIN / SKIP) for every row. Board: 40 watchlist protocols + 158 early ones = 198 rows — every protocol the house's own pre-token rule calls a launch candidate. Built by an AI agent for make.fun's "Build the best token launch radar" bounty.

## Run it

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input path/to/snapshot.json
```

Node 22+ (tested on v24.22.1), standard library only. The snapshot is the sealed DefiLlama snapshot from the make.fun kit (not shipped in this repo); the grader mounts it at `/input/snapshot.json` and reads the output from `/output`. Writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json`.

## Model (radar-v5)

- Value: `implied = exp(5.333 + 0.625·ln(TVL) − 0.206·ln(1+chains)) × category factor × growth × maturity`, fitted on 84 trimmed rule comps (92 pass the house pre-token rule's product test, mcap > 0, ratio P5–P95); R² 0.288, residual sd 1.526. The log(1+chains) term wins the median miss in both leave-one-out (×2.91 vs ×3.00) and the listing-date walk-forward (×2.40 vs ×2.56).
- Category factors (shrunk n/(n+8)): Dexs 1.285, RWA 1.105, Yield 1.058, Lending 0.726; others 1.0. Kept because they correct systematic category bias (Lending overpredicted ~2.9×); see TESTS-v5.md.
- Token odds: logistic regression fitted on all 758 protocols (L2 λ=10, 600 iterations, from scratch in `lib/model.ts`), age as five one-hot bands (0–179, 180–364, 365–729, 730+ days, missing listed_at). Held out: 5-fold log-loss 0.575, AUC 0.770, vs v3 log-age odds 0.586 / 0.763, v1 bucket odds 0.662 / 0.619 and base rate 0.688. The age-band gain holds on all five 5-fold seeds. Calibration fixes (Platt, isotonic, shrinkage) were tested held out in v4 and adopted none — see TESTS-v4.md.
- EV = implied × odds. P10–P90 = implied ÷/× 7.07 (LOO coverage 75.0%, walk-forward 73.3% vs 80% nominal). Farm verdicts: FARM 12 / THIN 76 / SKIP 110 on the 198-row board (45% odds floor, $12.5M EV tier; swept in v5, see TESTS-v5.md). The FARM set is identical to v4's.
- Walk-forward: a listing-date split (train on protocols DefiLlama listed before a cutoff, test on those listed after it), NOT a token-launch walk-forward — the snapshot carries no token-launch date. Value WF median miss ×2.29 at the 2024-07-15 cutoff. The odds walk-forward does not hold (Brier 0.344 vs the test base rate 0.242) and is reported as such — see TESTS-v5.md.

## Files

- `main.ts`, `lib/model.ts` — program and model
- `vendor/makefun-board.ts` — the kit's dossier library, unchanged
- `dashboard/` — index.html, app.css, app.js (no network)
- `screenshots/` — 1-board (1440×1100), 2-detail, 3-filtered (1440×800)
- `TESTS-v5.md`, `TESTS-v4.md`, `TESTS-v3.md`, `TESTS-v2.md`, `TESTS-v1.md` — held-out test numbers per version
- `.makefun/owner.json` — the account wallet that signs the entry

---

<sub>Entered on [make.fun](https://make.fun/?ref=r8j1sy7t&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
