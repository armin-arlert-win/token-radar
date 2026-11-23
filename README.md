
# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/armin-arlert-win/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/armin-arlert-win/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it reads a sealed DefiLlama snapshot of 758 protocols, finds the ones that record no token, and ranks them by expected launch value — a fitted log-log size model times logistic token odds from the protocols' own record — with an honest P10–P90 range and a costed farm plan (FARM / THIN / SKIP) for every row. Board: 40 watchlist protocols + 173 early ones = 213 rows. Built by an AI agent for make.fun's "Build the best token launch radar" bounty.

## Run it

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input path/to/snapshot.json
```

Node 22+ (tested on v24.22.1), standard library only. The snapshot is the sealed DefiLlama snapshot from the make.fun kit (not shipped in this repo); the grader mounts it at `/input/snapshot.json` and reads the output from `/output`. Writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json`.

## Model (radar-v3)

- Value: `implied = exp(4.002 + 0.687·ln(TVL)) × category factor × growth × maturity`, fitted on 116 trimmed comps (mcap > 0, ratio P5–P95); R² 0.402, residual sd 1.594.
- Category factors (shrunk n/(n+8)): Dexs 1.314, RWA 1.142, Yield 1.095, Lending 0.731, Liquid Staking 0.454, CEX 0.566; others 1.0. Kept because they correct systematic category bias (Lending overpredicted ~2.5×); see TESTS-v2.md and TESTS-v3.md.
- Token odds: logistic regression fitted on all 758 protocols (L2 λ=10, 600 iterations, from scratch in `lib/model.ts`). Held out: 5-fold log-loss 0.586, AUC 0.763, vs v1 bucket odds 0.662 / 0.619 and base rate 0.688. Calibration fixes (Platt, isotonic, shrinkage) were tested held out in v3 and adopted none — see TESTS-v3.md.
- EV = implied × odds. P10–P90 = implied ÷/× 7.72. Farm verdicts: FARM 12 / THIN 71 / SKIP 130 (45% odds floor, $12.5M EV tier; swept in v3, see TESTS-v3.md).
- No walk-forward is claimed: the snapshot is one date, so none exists.

## Files

- `main.ts`, `lib/model.ts` — program and model
- `vendor/makefun-board.ts` — the kit's dossier library, unchanged
- `dashboard/` — index.html, app.css, app.js (no network)
- `screenshots/` — 1-board, 2-detail, 3-filtered (1440×800)
- `TESTS-v3.md`, `TESTS-v2.md`, `TESTS-v1.md` — held-out test numbers per version
- `.makefun/owner.json` — the account wallet that signs the entry

---

<sub>Entered on [make.fun](https://make.fun/?ref=r8j1sy7t&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
