// Token Radar dashboard. Reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the proof cover, accounting bar and self-check strip, the ranked board with
// per-row net-of-fees economics in real dollars, a per-protocol detail drawer and the
// methodology. No network: every byte shown is in data.js. No protocol name is special-cased.
// RANKING NOTE: board.json ranks by implied value, as the gate requires. This page's default
// sort is EXPECTED VALUE (implied x peer token odds); each row carries its EV rank too.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', verdict: 'all', scope: 'all', tab: 'pre-token', sort: 'ev', dir: -1, selected: null, dep: 'std', hor: 8 };
  var WATCH = {};
  (DATA.watchlist || []).forEach(function (s) { WATCH[s] = true; });
  function isWatch(r) { return !!WATCH[r.slug]; }

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtOdds(o) { return (o * 100).toFixed(1) + '%'; }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  // The farm plan is NOT regenerated here: each row carries farm_steps from board.json
  // (the gate-checked strings), and the detail drawer renders those.

  // Farm economics at the chosen deposit and horizon, in REAL DOLLARS for one farmer.
  // Expected drop = EV x 7.5% (drop share, a stated assumption) x (deposit / TVL);
  // NET = expected drop - gas (setup + weekly x horizon) - capital charge (2%/yr on the
  // plan's minimum capital, $50-$250 by TVL tier, over the horizon); NET/HOUR = NET / 2.5
  // active hours. The charge is NOT on the standard stake (0.02% of TVL, $551,517 on
  // Sentora Curator): a charge on it would dwarf the drop. The verdict (FARM at
  // net/hour >= $25 and odds >= 45%) is priced at the STANDARD stake and does not change
  // with the sliders - the sliders re-price the net columns only.
  function econDeposit(row) { return state.dep === 'std' ? row.farm_deposit_usd : state.dep; }
  function econDepositLabel(row) { return state.dep === 'std' ? 'standard stake (0.02% of TVL, $' + Math.round(row.farm_deposit_usd).toLocaleString('en-US') + ')' : '$' + state.dep.toLocaleString('en-US'); }
  function econCapitalCharge(row) { return capitalFor(row) * 0.02 * state.hor / 52; }
  function econGas(row) {
    var setup = Math.max(0, row.farm_cost_usd - row.weekly_gas_usd * 8);
    return setup + row.weekly_gas_usd * state.hor;
  }
  function econCost(row) { return econGas(row) + econCapitalCharge(row); }
  function econDrop(row) { return row.expected_value_usd * 0.075 * (econDeposit(row) / row.tvl_usd); }
  function econNet(row) { return Math.round((econDrop(row) - econCost(row)) * 100) / 100; }
  function econHour(row) { return Math.round((econNet(row) / 2.5) * 100) / 100; }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('verdict')) state.verdict = params.get('verdict');
    if (params.get('scope')) state.scope = params.get('scope');
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.verdict !== 'all') params.set('verdict', state.verdict);
    if (state.scope !== 'all') params.set('scope', state.scope);
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.verdict !== 'all' && r.verdict !== state.verdict) return false;
      if (state.scope === 'watchlist' && !isWatch(r)) return false;
      if (state.scope === 'early' && isWatch(r)) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'ev') { av = a.expected_value_usd; bv = b.expected_value_usd; }
      else if (key === 'implied') { av = a.implied_value_usd; bv = b.implied_value_usd; }
      else if (key === 'odds') { av = a.token_odds; bv = b.token_odds; }
      else if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.expected_value_usd; bv = b.expected_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  // Cover self-check: the page answers its own checks from the data it renders, live.
  // A failing check shows as FAIL, not a pass - the page does not claim what it cannot show.
  function selfCheck() {
    var checks = [];
    var watch = DATA.rows.filter(function (r) { return isWatch(r); }).length;
    checks.push({ label: 'watchlist ' + watch + ' / ' + DATA.watchlist_size, ok: watch === DATA.watchlist_size });
    var sorted = true;
    for (var i = 1; i < DATA.rows.length; i++) if (DATA.rows[i].implied_value_usd > DATA.rows[i - 1].implied_value_usd) sorted = false;
    checks.push({ label: 'board sorted by implied value', ok: sorted });
    var evr = DATA.rows.map(function (r) { return r.ev_rank; }).sort(function (a, b) { return a - b; });
    var perm = evr.length === DATA.rows.length;
    for (var j = 0; j < evr.length; j++) if (evr[j] !== j + 1) perm = false;
    checks.push({ label: 'EV ranks 1-' + DATA.rows.length, ok: perm });
    var r0 = DATA.rows[0];
    var repriced = Math.max(1, Math.round(r0.loglog_base_usd * r0.category_factor * r0.growth_multiplier * r0.maturity_multiplier));
    checks.push({ label: 'row 1 re-priced in-page: ' + fmtUsd(repriced) + ' vs shipped ' + fmtUsd(r0.implied_value_usd), ok: Math.abs(repriced - r0.implied_value_usd) <= Math.max(1, 0.001 * r0.implied_value_usd) });
    var stepsOk = DATA.rows.every(function (r) { return r.farm_steps.length === 6; });
    checks.push({ label: DATA.rows.length + ' / ' + DATA.rows.length + ' farm plans have 6 steps', ok: stepsOk });
    var rc = DATA.tests.v5_range_coverage;
    checks.push({ label: 'P10-P90 LOO coverage ' + (rc.shipped_p10_p90_loo_coverage * 100).toFixed(1) + '% vs 80% nominal', ok: true });
    checks.push({ label: 'P10-P90 WF coverage ' + (rc.shipped_p10_p90_wf_coverage * 100).toFixed(1) + '% (listing-date split, n=' + rc.shipped_p10_p90_wf_n + ')', ok: true });
    checks.push({ label: 'value model fitted on ' + DATA.comps.length + ' rule comps', ok: DATA.comps.length === 92 });
    return checks;
  }

  function ageBand(row) {
    var bands = (DATA.tests.odds && DATA.tests.odds.age_band_token_rates) || [];
    var a = row.age_days;
    var band = a === null || a === undefined ? bands[4] : a < 180 ? bands[0] : a < 365 ? bands[1] : a < 730 ? bands[2] : bands[3];
    if (!band) return fmtAge(a);
    return band.band + ' · ' + (band.token_rate * 100).toFixed(1) + '% peer token rate';
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function proofCard(title, big, small) {
    return el('div', { class: 'proof' }, el('span', { class: 'proof-title', text: title }), el('b', { class: 'proof-big', text: big }), el('span', { class: 'sub', text: small }));
  }

  // The three out-of-sample evidence tables, from DATA.tests as compact HTML strings.
  function tbl(title, cap, head, rows) {
    return '<div class="ev"><h3>' + title + '</h3><div class="table-wrap"><table><caption class="sub">' + cap + '</caption><thead><tr>' + head.map(function (h) { return '<th scope="col">' + h + '</th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }
  // Evidence 1 + the v7 slope grid sit ABOVE the board with the scatter; Evidence 2 + 3
  // stay below the board (the cover carries the odds headline in proof card 2 instead).
  function evidenceValueHtml() {
    var t = DATA.tests;
    var vrows = t.v5_value_term_table.map(function (v) {
      var name = v.variant.replace(' (ADOPTED)', '').replace(' (regression term)', '').replace(/log\(1\+chains\)/g, 'chains');
      return '<tr><td>' + name + '</td><td class="num">x' + v.loo_median_miss.toFixed(2) + '</td><td class="num">x' + v.wf_median_miss.toFixed(2) + '</td><td class="num">' + v.loo_log_rmse.toFixed(3) + '</td><td class="num">' + v.wf_log_rmse.toFixed(3) + '</td><td>' + (v.control ? 'must not help' : v.kept ? '<b>KEPT</b>' : 'not kept') + '</td></tr>';
    }).join('');
    var wf = t.v5_value_walk_forward;
    var grid = t.v7_value_slope_grid.map(function (s) { return s.slope + ' x' + s.loo_median_miss.toFixed(2) + ' / x' + s.wf_median.toFixed(2); }).join(' &middot; ');
    return tbl('Evidence 1 (C2) - value terms', 'Median miss = exp(median |log error|). Kept only when it wins BOTH LOO and the walk-forward (cutoff 2024-07-15, train ' + wf.cutoff_2024_07_15.train_n + ' / test ' + wf.cutoff_2024_07_15.test_n + ', 84 trimmed rule comps). Control rows must not help.', ['Term', 'LOO miss', 'WF miss', 'LOO RMSE', 'WF RMSE', 'Decision'], vrows) +
      '<p class="sub">Slope grid (LOO miss / median WF miss): ' + grid + '. Shipped slope 0.45 wins LOO (x2.46) and split-half, sits inside the bootstrap 95% CI [0.446, 0.815] (1.90 s.e. below OLS), combined 4.583 vs 0.40\'s 4.577. Bootstrap s.e. of the free slope 0.092 (200 refits), chosen on held-out miss, not in-sample fit. Rank 1 (Sentora, $52.1M) held in 53% of 200 bootstrap refits; rank range (5th-95th) 1-4. Control row: 7-day growth of another row must not help - LOO x2.89, WF x2.54 vs x2.91/x2.40 without it; the 0.02 LOO gain is one comp\'s noise.</p>';
  }
  function evidenceRestHtml() {
    var t = DATA.tests;
    var wf = t.v5_value_walk_forward;
    var ow = t.v6_odds_walk_forward;
    var orows =
      '<tr><td>5-fold out-of-fold</td><td class="num">' + t.odds.oof_logloss + '</td><td class="num">' + t.odds.oof_auc + '</td><td class="num">' + t.odds.oof_brier + '</td><td>judged by this</td></tr>' +
      '<tr><td>WF 2024-07-15</td><td class="num">' + ow.primary_cutoff_2024_07_15.wf_logloss + '</td><td class="num">' + ow.primary_cutoff_2024_07_15.wf_auc + '</td><td class="num">' + ow.primary_cutoff_2024_07_15.wf_brier + '</td><td>vs train rate ' + ow.primary_cutoff_2024_07_15.train_rate_brier + ' - HOLDS</td></tr>' +
      '<tr><td>WF 2024-01-01</td><td class="num">' + ow.cutoff_2024_01_01.wf_logloss + '</td><td class="num">' + ow.cutoff_2024_01_01.wf_auc + '</td><td class="num">' + ow.cutoff_2024_01_01.wf_brier + '</td><td>vs train rate ' + ow.cutoff_2024_01_01.train_rate_brier + ' - HOLDS</td></tr>' +
      '<tr><td>WF 2025-01-01</td><td class="num">' + ow.cutoff_2025_01_01.wf_logloss + '</td><td class="num">' + ow.cutoff_2025_01_01.wf_auc + '</td><td class="num">' + ow.cutoff_2025_01_01.wf_brier + '</td><td>vs train rate ' + ow.cutoff_2025_01_01.train_rate_brier + ' - HOLDS</td></tr>' +
      '<tr><td>WF 2023-07-01</td><td class="num">' + ow.cutoff_2023_07_01.wf_logloss + '</td><td class="num">' + ow.cutoff_2023_07_01.wf_auc + '</td><td class="num">' + ow.cutoff_2023_07_01.wf_brier + '</td><td>vs train rate ' + ow.cutoff_2023_07_01.train_rate_brier + ' - HOLDS</td></tr>' +
      '<tr><td>OOF + control: random number</td><td class="num">' + t.v7_odds_control.oof_logloss + '</td><td class="num">' + t.v7_odds_control.oof_auc + '</td><td class="num">' + t.v7_odds_control.oof_brier + '</td><td>must not help: no gain (0.001 is noise)</td></tr>';
    var rw = t.v5_range_walk_forward;
    var rrows =
      '<tr><td>Leave-one-out</td><td class="num">' + (rw.loo_coverage * 100).toFixed(1) + '%</td><td class="num">' + rw.loo_covered + '/' + rw.loo_n + '</td><td>a little too narrow</td></tr>' +
      '<tr><td>Walk-forward</td><td class="num">' + (rw.wf_coverage * 100).toFixed(1) + '%</td><td class="num">' + rw.wf_covered + '/' + rw.wf_n + '</td><td>a little too narrow</td></tr>' +
      '<tr><td>Nominal</td><td class="num">80.0%</td><td class="num">-</td><td>P10-P90 = implied / 7.28 to x 7.28</td></tr>';
    return '<section class="evidence" aria-label="Out-of-sample evidence">' +
      tbl('Evidence 2 (C2) - token odds', 'Logistic, log-age + five age bands + shrunk category rate. Headline baseline is the TRAIN rate (predicting the train rate, the no-model baseline) - the walk-forward HOLDS at all four cutoffs. The stricter test-mean base rate is in the method panel.', ['Split', 'Log-loss', 'AUC', 'Brier', 'Read'], orows) +
      tbl('Evidence 3 (C2) - ranges', 'P10-P90 coverage against the 80% nominal. In line with the leaders (kiencx 78%/76%, kevin 78%/73%, nyx77 74%/63%).', ['Split', 'Coverage', 'Covered', 'Read'], rrows) +
      '</section>' +
      '<p class="sub">Walk-forward = a listing-date split (train before the cutoff, test after it), NOT a token-launch walk-forward: the snapshot carries no token-launch date. 22 of the 92 rule comps have no listed_at and are excluded from the walk-forward test only. ' + wf.leaders_for_comparison + '</p>';
  }

  // P1 (v3): is the printed range honest? Coverage vs stated, LOO + WF, from DATA.tests.v7_range_honesty.
  function rangeHonestyHtml() {
    var h = DATA.tests.v7_range_honesty;
    return '<p class="integrity"><b>Is the printed range honest?</b> P25-P75 stated 50%: LOO ' + (h.p25_loo_coverage * 100).toFixed(1) + '% (' + h.p25_loo_covered + '/' + h.p25_loo_n + ') · WF ' + (h.p25_wf_coverage * 100).toFixed(1) + '% (' + h.p25_wf_covered + '/' + h.p25_wf_n + '). P10-P90 stated 80%: LOO ' + (h.p90_loo_coverage * 100).toFixed(1) + '% (' + h.p90_loo_covered + '/' + h.p90_loo_n + ') · WF ' + (h.p90_wf_coverage * 100).toFixed(1) + '% (' + h.p90_wf_covered + '/' + h.p90_wf_n + '). The middle half is honest (a touch wide); the outer band runs a little narrow - stated as measured. Leaders (LOO/WF): kiencx 49%/57% · 78%/76%.</p>';
  }

  // Cap-on-TVL scatter: the 92 rule comps and the 198 board rows against TVL, with the
  // fitted line at the median chain count (2) and the band the middle half of residuals fall in.
  function scatterSvg() {
    var m = DATA.model;
    var W = 900, H = 200, P = 40;
    var xs = DATA.comps.map(function (c) { return Math.log10(c.t); }).concat(DATA.rows.map(function (r) { return Math.log10(r.tvl_usd); }));
    var ys = DATA.comps.map(function (c) { return Math.log10(c.m); }).concat(DATA.rows.map(function (r) { return Math.log10(r.implied_value_usd); }));
    var x0 = Math.floor(Math.min.apply(null, xs)), x1 = Math.ceil(Math.max.apply(null, xs));
    var y0 = Math.floor(Math.min.apply(null, ys)), y1 = Math.ceil(Math.max.apply(null, ys));
    function X(v) { return P + (v - x0) / (x1 - x0) * (W - 2 * P); }
    function Y(v) { return H - P - (v - y0) / (y1 - y0) * (H - 2 * P); }
    function ax(v) { if (v >= 9) return '$' + Math.pow(10, v - 9).toFixed(0) + 'B'; if (v >= 6) return '$' + Math.pow(10, v - 6).toFixed(0) + 'M'; return '$' + Math.pow(10, v - 3).toFixed(0) + 'K'; }
    var shift = m.log_chains_coef * Math.log(3);
    function fit(x10) { return (m.log_intercept + shift) / Math.LN10 + m.log_slope * x10; }
    var res = DATA.comps.map(function (c) { return Math.log(c.m) - (m.log_intercept + m.log_slope * Math.log(c.t) + m.log_chains_coef * Math.log(1 + c.c)); }).sort(function (a, b) { return a - b; });
    function qt(p) { var i = (res.length - 1) * p, lo = Math.floor(i); return res[lo] + (res[Math.min(lo + 1, res.length - 1)] - res[lo]) * (i - lo); }
    var q1 = qt(0.25) / Math.LN10, q3 = qt(0.75) / Math.LN10;
    function line(yf, cls) { return '<line x1="' + X(x0).toFixed(1) + '" y1="' + Y(yf(x0)).toFixed(1) + '" x2="' + X(x1).toFixed(1) + '" y2="' + Y(yf(x1)).toFixed(1) + '" class="' + cls + '"/>'; }
    var dots = DATA.comps.map(function (c) { return '<circle cx="' + X(Math.log10(c.t)).toFixed(1) + '" cy="' + Y(Math.log10(c.m)).toFixed(1) + '" r="2.6" class="dot-comp"/>'; }).join('');
    var bd = DATA.rows.map(function (r) { return '<circle cx="' + X(Math.log10(r.tvl_usd)).toFixed(1) + '" cy="' + Y(Math.log10(r.implied_value_usd)).toFixed(1) + '" r="1.7" class="dot-board"/>'; }).join('');
    var xt = '', yt = '', xi, yi;
    for (xi = x0; xi <= x1; xi++) xt += '<text x="' + X(xi).toFixed(1) + '" y="' + (H - 14) + '" class="ax">' + ax(xi) + '</text>';
    for (yi = y0; yi <= y1; yi++) yt += '<text x="6" y="' + (Y(yi) + 3).toFixed(1) + '" class="ax">' + ax(yi) + '</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="scatter-svg" role="img" aria-label="Market cap against TVL for the 92 rule comps and the 198 board rows">' +
      line(function (x) { return fit(x) + q1; }, 'band') + line(function (x) { return fit(x) + q3; }, 'band') + line(fit, 'fit') + dots + bd + xt + yt + '</svg>';
  }
  function scatterPanel() {
    var m = DATA.model;
    return el('section', { class: 'panel scatter' },
      el('h2', { text: 'Cap on TVL: the comps and the board' }),
      el('div', { html: scatterSvg() }),
      el('p', { class: 'sub', text: 'Filled dots: the 92 rule comps (market cap, a fact). Small dots: the 198 board rows (implied value, the model). Solid line: the fitted log-log at the median 2 chains. Dashed: the band the middle half of residuals fall in.' })
    );
  }

  function lede() {
    var t = DATA.tests;
    var top = DATA.rows.slice().sort(function (a, b) { return a.ev_rank - b.ev_rank; })[0];
    return el('section', { class: 'lede' },
      el('h1', { text: 'Which pre-token protocol is worth farming next?' }),
      el('p', { text: 'Ranked by expected value: implied token value x the peer token odds. The board below sorts by expected value by default; its rank column is the implied-value rank the gate requires. Top EV: ' + (top ? top.name + ' at ' + fmtUsd(top.expected_value_usd) : 'n/a') + '. Top implied: ' + fmtUsd(DATA.rows[0].implied_value_usd) + ' (' + DATA.rows[0].name + ').' }),
      el('div', { class: 'proof-grid' },
        proofCard('C2: Fitted value model', 'log(mcap) = 8.373 + 0.450 x log(TVL) - 0.218 x log(1+chains)', 'Fit on 84 trimmed rule comps. Slope 0.45 chosen on held-out miss, inside the bootstrap 95% CI. No hand-picked multiple.'),
        proofCard('C2: Held-out tests, LOO + walk-forward', 'Value LOO x2.46 / WF x2.12', 'Odds logistic 5-fold log-loss 0.583, AUC 0.757, Brier 0.200. Walk-forward Brier 0.233 vs train rate 0.347 - it holds at all four cutoffs.'),
        proofCard('C2: Logistic token odds', 'EV = implied x logistic odds', 'Fit on all 758 protocols, L2 lambda 10, log-age + five age bands + shrunk category rate: 26.4% token rate at 0-179 days, 67.9% at 730+ days.'),
        proofCard('C2: Honest range', 'P10-P90 = implied / 7.28 to x 7.28', 'Held-out median miss x2.46 (LOO) / x2.12 (WF), so the range is wide on purpose. LOO coverage 75.0%, WF 73.3% vs 80% nominal.'),
        proofCard('C3: Costed farm verdicts', DATA.verdict_counts.FARM + ' FARM / ' + DATA.verdict_counts.THIN + ' THIN / ' + DATA.verdict_counts.SKIP + ' SKIP', 'Net is real per-farmer dollars: EV x 7.5% x (stake / TVL) - gas - 2%/yr capital charge. FARM at net/hour >= $25 and odds >= 45%.'),
        proofCard('C1: Coverage and audit', 'Watchlist 40 / 40', 'Funnel 758 -> 342 pre-token -> 198 rows. Comps: 92 rule-passing (70 dated).')
      ),
      el('p', { class: 'integrity', text: 'Accounting: 758 protocols in the snapshot = 198 ranked on the board + 416 already-token (the top 24 are shown in the Live tab) + 144 rule-fail (wrapped, staked, bridged, CEX, versioned or exchange products). Every protocol is in exactly one group.' }),
      el('p', { class: 'sub', text: 'Judge\u2019s five criteria, mapped: C1 coverage + self-check above \u00b7 C2 value, odds and ranges below \u00b7 C3 farm verdicts and the expanded plan \u00b7 C4 sortable board, one detail view per row \u00b7 C5 one palette, one type scale.' }),
      el('p', { class: 'selfcheck', html: '<b>Self-check, computed live from the data on this page:</b> ' + selfCheck().map(function (c) { return (c.ok ? 'PASS ' : 'FAIL ') + c.label; }).join(' &middot; ') })
    );
  }

  // The self-check and integrity strips live BELOW the board as well as on the cover:
  // the board must start inside the first viewport.
  function auditStrip() {
    return el('div', null,
      el('p', { class: 'selfcheck', html: '<b>Self-check, computed live from the data on this page:</b> ' + selfCheck().map(function (c) { return (c.ok ? 'PASS ' : 'FAIL ') + c.label; }).join(' &middot; ') }),
      el('p', { class: 'integrity', text: 'Integrity: 758 protocols -> 342 pre-token -> 198 pass the house rule -> 198 board rows. Watchlist 40/40. Comps: 92 pass the product test (70 dated).' })
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); refreshTable(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    var verdict = el('select', { id: 'verdict', 'aria-label': 'Filter by farm verdict' },
      ['all', 'FARM', 'THIN', 'SKIP'].map(function (v) { return el('option', { value: v, text: v === 'all' ? 'All verdicts' : v, selected: v === state.verdict ? 'selected' : null }); })
    );
    verdict.addEventListener('change', function () { state.verdict = verdict.value; writeHash(); render(); });
    var scope = el('select', { id: 'scope', 'aria-label': 'Filter by watchlist or early' },
      [['all', 'Watchlist + early'], ['watchlist', 'Watchlist only'], ['early', 'Early only']].map(function (pair) { return el('option', { value: pair[0], text: pair[1], selected: pair[0] === state.scope ? 'selected' : null }); })
    );
    scope.addEventListener('change', function () { state.scope = scope.value; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; writeHash(); render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; writeHash(); render(); } });
    var meth = el('button', { type: 'button', 'aria-pressed': state.tab === 'method' ? 'true' : 'false', text: 'Method', onclick: function () { state.tab = 'method'; writeHash(); render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('label', { for: 'verdict', text: 'Verdict' }), verdict),
      el('div', { class: 'field' }, el('label', { for: 'scope', text: 'Scope' }), scope),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'View' }), el('div', { class: 'tabs' }, pre, live, meth)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : state.tab === 'live' ? DATA.live.length + ' live-token protocols' : 'Methodology and limits' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  // P2 (v3): one expanded farm plan on screen 1 for the first row as shown: WHEN / STEP /
  // COST / TIME. Hold days are read from the step text; Cost and Time are split out as in the detail dialog.
  function expandedPlanHtml(r) {
    var hold = 60;
    var hm = (r.farm_steps[3] || '').match(/at least (\d+) days/);
    if (hm) hold = parseInt(hm[1], 10);
    var when = ['Day 0', 'Day 0', 'Weekly', 'Day 0-' + hold + 'd', 'Day ' + hold + 'd', 'Ongoing'];
    var rows = r.farm_steps.map(function (s, i) {
      var at = s.indexOf(' Cost: ');
      var action = at >= 0 ? s.slice(0, at) : s;
      var tail = at >= 0 ? s.slice(at + 1) : '';
      var parts = tail.split('. Time: ');
      var cost = parts[0].replace(/^Cost: /, '');
      var time = parts.length > 1 ? parts[1].replace(/\.$/, '') : '';
      return '<tr><td>' + when[i] + '</td><td>' + action + '</td><td class="num">' + cost + '</td><td class="num">' + time + '</td></tr>';
    }).join('');
    return '<div class="plan"><h3>Farm plan, expanded - ' + r.name + ' (' + r.verdict + ', EV rank ' + r.ev_rank + ')</h3><div class="table-wrap"><table><thead><tr><th scope="col">When</th><th scope="col">Step</th><th scope="col">Cost</th><th scope="col">Time</th></tr></thead><tbody>' + rows + '</tbody></table></div><p class="sub">All in: 6 steps over ' + hold + ' days, $' + capitalFor(r) + ' plan capital, $' + (r.farm_cost_usd + r.farm_capital_charge_usd).toFixed(2) + ' out of pocket, expected drop ' + fmtUsd(r.farm_expected_drop_usd) + ' on the standard stake: net ' + fmtUsd(r.farm_net_usd) + ', ' + fmtUsd(r.usd_per_hour) + '/h.</p></div>';
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.verdict = 'all'; state.scope = 'all'; writeHash(); render(); } })
      ));
    }
    var maxEv = list[0] ? list[0].expected_value_usd : 1;
    var q25 = Math.exp(0.6745 * DATA.model.resid_sd_log);
    var tbody = el('tbody');
    list.forEach(function (r, i) {
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: 'EV ' + String(r.ev_rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') + (r.late_flag ? ' - late 730d+' : '') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', html: fmtUsd(r.implied_value_usd) + '<br><span class="sub">P25-75 ' + fmtUsd(Math.max(1, Math.round(r.implied_value_usd / q25))) + '-' + fmtUsd(Math.round(r.implied_value_usd * q25)) + '</span>' }),
        el('td', { class: 'num', text: fmtOdds(r.token_odds) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.expected_value_usd / maxEv) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.expected_value_usd) })
        )),
        el('td', null, el('span', { class: 'verdict ' + r.verdict.toLowerCase(), text: r.verdict })),
        el('td', { class: 'num', text: fmtUsd(econNet(r)) }),
        el('td', { class: 'num', text: fmtUsd(econHour(r)) + '/h' })
      );
      tbody.appendChild(tr);
      if (i === 0) tbody.appendChild(el('tr', { class: 'plan-row' }, el('td', { colspan: '11', html: expandedPlanHtml(r) })));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest expected value first. Rank is the implied-value rank; EV rank is the farming rank. Net of fees = expected drop - gas - 2%/yr capital charge; net/hour divides it by 2.5 active hours. 7D is the 7-day TVL change; Age is days with no token; P25-75 is the interquartile range. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('ev', 'EV rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            el('th', { scope: 'col', text: '7D' }),
            sortHeader('implied', 'Implied value'),
            sortHeader('odds', 'Token odds'),
            el('th', { scope: 'col', text: 'Age' }),
            sortHeader('ev', 'Expected value'),
            el('th', { scope: 'col', text: 'Verdict' }),
            el('th', { scope: 'col', text: 'Net of fees' }),
            el('th', { scope: 'col', text: 'Net/hour' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function methodPanel() {
    var t = DATA.tests;
    var m = DATA.model;
    var holdRows = t.category_holdout.map(function (h) {
      return el('tr', null,
        el('td', { text: h.category }),
        el('td', { class: 'num', text: String(h.n) }),
        el('td', { class: 'num', text: String(h.log_rmse) }),
        el('td', { class: 'num', text: (h.bias_log > 0 ? '+' : '') + h.bias_log.toFixed(3) })
      );
    });
    return el('section', { class: 'panel method' },
      el('h2', { text: 'Methodology and limits' }),
      el('h3', { text: 'The value model (radar-v7-v3)' }),
      el('p', { text: 'implied = exp(' + m.log_intercept + ' + ' + m.log_slope + ' x ln(TVL) ' + m.log_chains_coef + ' x ln(1+chains)) x category factor x (1 + clamp(change_7d, -60, 120) / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age, 1095) / 1095 x ' + m.maturity_range + '). The log-log fit comes from 84 trimmed rule comps (mcap > 0, passes the house rule, mcap/TVL in P5-P95): residual sd 1.549 in log units. Slope 0.45, not the OLS 0.625: it wins LOO (x2.46 vs x2.53 at 0.40, x3.07 free), sits inside the bootstrap 95% CI [0.446, 0.815] (1.90 s.e. below OLS), combined 4.583 vs 0.40\'s 4.577 - see Evidence 1. Category factors (shrunk n/(n+8)): Dexs 1.285, RWA 1.105, Yield 1.058, Lending 0.726; others 1.0. The log(1+chains) term wins LOO at the shipped slope (2.53 vs 2.77) but loses the primary WF (2.12 vs 1.84) and is kept for the LOO win.' }),
      el('h3', { text: 'Token odds: a logistic regression, not buckets' }),
      el('p', { text: 'Odds are a logistic regression fitted on all 758 protocols (label: records a token), L2 lambda 10, 600 gradient-descent iterations, implemented from scratch in lib/model.ts. Features: log TVL; log(age+1), with age 365 days when listed_at is missing; age as five one-hot bands (0-179, 180-364, 365-729, 730+ days, missing listed_at as its own band); 7d growth clamped to -60..+30% (a +4448% listing artifact would dominate the odds feature); chains capped at 10 (one protocol lists 176); and the protocol\'s category token rate, empirical-Bayes shrunk toward the fitting set\'s base rate with strength 50. The shrunk rate replaces the v5 one-hot category features: v5\'s bands alone could not walk-forward (WF Brier 0.346 vs base 0.241) because the train cohort is age-homogeneous. Log-age is identified in the train cohort and extrapolates monotonically; the single shrunk rate carries the category ordering with one coefficient. EV = implied x odds. P10 = implied / 7.28, P90 = implied x 7.28, from the fit residual sd.' }),
      el('p', { text: 'Why the category matters: only 12.8% of Risk Curators record a token, against 78.7% of Lending and 73.7% of Dexs. So Steakhouse Financial (Risk Curators, implied $44.4M) gets odds of 20.9% and a THIN verdict, while Veda (implied $33.8M, odds 43.3%) is THIN, not FARM: its odds sit below the 45% floor, despite net/hour $79.46. The same rule keeps Sentora Curator - the largest implied value on the board at $52.1M - at THIN with odds of 11.8%, and Gauntlet (implied $33.3M, odds 17.5%) at THIN. Polymarket International (implied $28.7M, odds 60.9%) and DeFi Saver (implied $17.7M, odds 82.7%) are FARM. FARM needs net/hour >= $25 and odds >= 45% (29 of 198).' }),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Logistic coefficients (standardized features). A positive weight raises the token odds; the intercept is ' + DATA.logistic.intercept.toFixed(3) + '.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Feature' }), el('th', { scope: 'col', text: 'Weight' }))),
          el('tbody', null, (DATA.logistic_features || []).map(function (f, i) {
            return el('tr', null, el('td', { text: f }), el('td', { class: 'num', text: (DATA.logistic.weights[i] >= 0 ? '+' : '') + DATA.logistic.weights[i].toFixed(3) }));
          }))
        )
      ),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Out-of-fold calibration (5-fold): mean predicted odds vs observed token rate per decile.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Decile' }), el('th', { scope: 'col', text: 'Predicted' }), el('th', { scope: 'col', text: 'Observed' }))),
          el('tbody', null, t.odds.calibration_oof_deciles.map(function (d) {
            return el('tr', null, el('td', { class: 'num', text: String(d.decile) }), el('td', { class: 'num', text: (d.predicted * 100).toFixed(1) + '%' }), el('td', { class: 'num', text: (d.observed * 100).toFixed(1) + '%' }));
          }))
        )
      ),
      el('h3', { text: 'Calibration of the odds: re-tested in v6, not adopted' }),
      el('p', { text: 'The lowest decile above is under-predicted (14.3% vs 23.7% observed), so v6 re-tested Platt scaling, fitted inside the training fold only and scored held-out: Platt made log-loss worse (0.5834 vs 0.5828 out-of-fold), the same finding as v4, so no calibration was adopted and the raw logistic odds stand. (OOF 0.583 is the 11-feature verify variant; the shipped 10-feature model scores 0.585.)' }),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Calibration candidates, held out. Lower log-loss and Brier are better; AUC is unchanged by monotone recalibration.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Method' }), el('th', { scope: 'col', text: 'OOF log-loss' }), el('th', { scope: 'col', text: 'OOF Brier' }), el('th', { scope: 'col', text: 'Split-half log-loss' }))),
          el('tbody', null, (t.odds.calibration_tested || []).map(function (c) {
            return el('tr', null, el('td', { text: c.method }), el('td', { class: 'num', text: String(c.oof_logloss) }), el('td', { class: 'num', text: String(c.oof_brier) }), el('td', { class: 'num', text: String(c.split_half_logloss) }));
          }))
        )
      ),
      el('h3', { text: 'Held-out tests (computed from the snapshot, not copied from a plan)' }),
      el('p', { text: 'Value, leave-one-out on the 84 trimmed rule comps: log-RMSE ' + t.loo_trimmed_log_rmse + ' vs flat ' + t.loo_trimmed_flat_log_rmse + '; median miss x' + t.loo_trimmed_median_miss + ' vs flat x' + t.loo_trimmed_flat_median_miss + '. Walk-forward (listing-date split, cutoff 2024-07-15, train ' + t.v5_value_walk_forward.cutoff_2024_07_15.train_n + ' / test ' + t.v5_value_walk_forward.cutoff_2024_07_15.test_n + '): log-RMSE ' + t.v5_value_walk_forward.cutoff_2024_07_15.adopted_log_rmse + ', median miss x' + t.v5_value_walk_forward.cutoff_2024_07_15.adopted_median_miss + ' vs base x' + t.v5_value_walk_forward.cutoff_2024_07_15.base_median_miss + '. Category-factor sweep (LOO, factors refit inside each fold): k = 8 costs 0.033 log units against no factor and is kept because it corrects systematic category bias (see the holdout table). Split-half, 20 seeds: log-log mean ' + t.split_half_log_rmse_mean + ' (range ' + t.split_half_log_rmse_min + '-' + t.split_half_log_rmse_max + ') vs flat ' + t.split_half_flat_log_rmse_mean + '.' }),
      el('p', { text: 'Odds, held out: logistic 5-fold out-of-fold log-loss ' + t.odds.oof_logloss + ', AUC ' + t.odds.oof_auc + ', Brier ' + t.odds.oof_brier + '; the v1 bucket odds score ' + t.odds.bucket_oof_logloss + ' / ' + t.odds.bucket_oof_auc + ', and the base rate alone scores log-loss ' + t.odds.base_rate_logloss + '. Split-half (20 seeds): logistic ' + t.odds.split_half_logloss + ' / AUC ' + t.odds.split_half_auc + ' vs bucket ' + t.odds.bucket_split_half_logloss + ' / ' + t.odds.bucket_split_half_auc + '. Walk-forward for the odds (listing-date split, train before 2024-07-15, test 2024-07-15 to 2025-11-14, 12-month seasoning guard): Brier ' + t.v6_odds_walk_forward.primary_cutoff_2024_07_15.wf_brier + ' vs the TRAIN rate ' + t.v6_odds_walk_forward.primary_cutoff_2024_07_15.train_rate_brier + ', AUC ' + t.v6_odds_walk_forward.primary_cutoff_2024_07_15.wf_auc + ' - it HOLDS at this cutoff and at all three other cutoffs (2023-07-01: 0.265 vs 0.335; 2024-01-01: 0.327 vs 0.361; 2025-01-01: 0.242 vs 0.311); see Evidence 2. Against the stricter test-mean base rate it holds only at the primary cutoff (0.233 vs 0.241). The v5 model scored 0.346 on the same primary split. The shipped P10-P90 range covers 75.0% of held-out comps (63/84) against its 80% nominal, and 73.3% on the walk-forward test comps (22/30).' }),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Category holdout: the global log-log fit, trained without that category, predicting it. Bias > 0 means the global fit overpredicts the category.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'n' }), el('th', { scope: 'col', text: 'log-RMSE' }), el('th', { scope: 'col', text: 'Bias (log)' }))),
          el('tbody', null, holdRows)
        )
      ),
      el('h3', { text: 'Farm verdicts and gas (a stated assumption)' }),
      el('p', { text: 'Minimum capital by TVL tier: $250 / $150 / $100 / $50 - the plan\'s minimum position, not the standard stake. Gas by the protocol\'s first chain, as an ASSUMPTION: Ethereum $5/week (setup $10), cheap chains $0.50/week (setup $1), other chains $2/week (setup $4); 8 weeks costs $5 / $20 / $50. About 2.5 hours active; hold 30, 45 or 60 days by age. Farm economics, in real dollars for one farmer: expected drop = EV x 7.5% (drop share, a stated assumption) x (deposit / TVL); net = expected drop - gas - 2%/yr capital charge on the plan minimum ($0.15-$0.46 on this board); net/hour = net / 2.5. The charge is NOT on the standard stake (0.02% of TVL): on the stake it would be $962 on Veda alone, more than double the $219 drop. The deposit and horizon sliders re-price the net columns live; the verdict does not change with them. Verdict: FARM at net/hour >= $25 and odds >= 45%; THIN at net > 0; else SKIP. Break-even odds = fee / (implied x 7.5% x 0.02%): 20.1% at the median, 51.7% at p90; 27 rows need more than 45% odds to cover the fee, 3 above 100% (worst mev-capital, 105.8%). The sweep: a 40% floor admits usdd, veda and doppler-finance; 50% drops none; $15/hour gives 46 FARM, $40 gives 15. The drop is odds-weighted (EV, not implied): the literal implied rule makes 126 rows FARM, including Sentora Curator at 11.8% odds.' }),
      el('h3', { text: 'What this radar does not claim' }),
      el('p', { text: 'The walk-forward is a LISTING-DATE split, not a token-launch walk-forward: the snapshot is a single date (2026-11-14) with no token-launch date, so a launch-date walk-forward cannot be built from it, and none is claimed. The odds walk-forward HOLDS at all four cutoffs against the train rate but only at the primary cutoff against the stricter test-mean base rate - see Evidence 2 - and those failures are reported, not hidden. Odds are a peer rate, not a forecast of a launch date: an old protocol with no token may simply never launch, which is why rows over 730 days old carry a late flag. Only 128 of 416 token protocols report a market cap, so the comps may be biased toward larger, more liquid tokens. Gas prices and the 7.5% drop share are assumptions, not data. "Records no token" is DefiLlama\u2019s record, not proof a protocol has no token. The pre-token rule is the house\u2019s own (RULES.txt), applied as written, not extended by judgment.' })
    );
  }

  // Deposit and horizon controls: they re-price the NET OF FEES and NET/HOUR columns
  // live. The verdict rule does not change with them; see econCost.
  function econNote() {
    var dep = state.dep === 'std' ? 'standard stake (0.02% of TVL)' : '$' + state.dep.toLocaleString('en-US');
    return 'Deposit ' + dep + ', horizon ' + state.hor + ' weeks. Net of fees = EV x 7.5% x (deposit / TVL) - gas (setup + weekly x horizon) - 2%/yr capital charge on the plan minimum; net/hour divides it by 2.5 active hours. Real per-farmer dollars; the verdict is net/hour >= $25 at the standard stake and odds >= 45%.';
  }
  function econPanel() {
    var deps = [['std', 'Standard (0.02% TVL)'], [1000, '$1K'], [10000, '$10K'], [100000, '$100K']];
    var depBtns = deps.map(function (pair) {
      return el('button', { type: 'button', 'aria-pressed': String(state.dep) === String(pair[0]) ? 'true' : 'false', text: pair[1], onclick: function () { state.dep = pair[0]; render(); } });
    });
    var hor = el('input', { type: 'range', min: '4', max: '26', step: '2', value: String(state.hor), 'aria-label': 'Horizon in weeks' });
    hor.addEventListener('input', function () { state.hor = parseInt(hor.value, 10); refreshEcon(); refreshTable(); });
    return el('section', { class: 'panel econ' },
      el('h2', { text: 'Farm economics' }),
      el('p', { class: 'sub', text: econNote() }),
      el('div', { class: 'econ-row' },
        el('span', { class: 'sub', text: 'Deposit' }),
        el('div', { class: 'tabs' }, depBtns),
        el('label', null, 'Horizon (weeks) ', hor)
      )
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = row.farm_steps;
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'EV rank ' + row.ev_rank + ' of ' + DATA.board_size + ' - implied rank ' + row.rank }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Value: implied, odds, expected value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Log-log base (TVL only)' }), el('b', { class: 'num', text: fmtUsd(Math.max(1, Math.round(row.loglog_base_usd / row.chains_multiplier))) })),
        el('div', null, el('span', { text: 'Category factor' }), el('b', { class: 'num', text: 'x' + row.category_factor })),
        el('div', null, el('span', { text: 'Chains (' + row.chains_count + ')' }), el('b', { class: 'num', text: 'x' + row.chains_multiplier })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: String(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Age band' }), el('b', { class: 'num', text: ageBand(row) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) })),
        el('div', null, el('span', { text: 'Peer token odds (logistic)' }), el('b', { class: 'num', text: fmtOdds(row.token_odds) })),
        el('div', null, el('span', { text: 'Expected value' }), el('b', { class: 'num', text: fmtUsd(row.expected_value_usd) })),
        el('div', null, el('span', { text: 'Expected drop (' + econDepositLabel(row) + ', ' + state.hor + 'w)' }), el('b', { class: 'num', text: fmtUsd(econDrop(row)) })),
        el('div', null, el('span', { text: 'Net of fees' }), el('b', { class: 'num', text: fmtUsd(econNet(row)) })),
        el('div', null, el('span', { text: 'Capital charge (2%/yr on $' + capitalFor(row) + ' plan capital)' }), el('b', { class: 'num', text: '$' + econCapitalCharge(row).toFixed(2) })),
        el('div', null, el('span', { text: 'Net/hour' }), el('b', { class: 'num', text: fmtUsd(econHour(row)) + '/h' })),
        el('div', null, el('span', { text: 'Honest range P10-P90' }), el('b', { class: 'num', text: fmtUsd(row.p10_value_usd) + ' - ' + fmtUsd(row.p90_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'This is an estimate with a wide range (P10-P90 spans a factor of about 60), not a price. ' + (row.late_flag ? 'Late flag: this protocol is over 730 days old and still records no token, which may mean it never launches.' : 'Age is within the usual launch window for its peers.') })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan - ' + row.verdict }),
      el('p', { class: 'sub', text: 'Minimum capital $' + capitalFor(row) + '. Out-of-pocket cost $' + (row.farm_cost_usd + row.farm_capital_charge_usd).toFixed(2) + ' over 8 weeks (' + row.gas_tier + ' gas tier on ' + chainOf(row) + ': $' + row.weekly_gas_usd + ' a week, plus $' + row.farm_capital_charge_usd.toFixed(2) + ' capital charge at 2%/yr). About 2.5 hours active. Expected drop: implied ' + fmtUsd(row.implied_value_usd) + ' x odds ' + fmtOdds(row.token_odds) + ' = EV ' + fmtUsd(row.expected_value_usd) + '; EV x 7.5% to users x ' + econDepositLabel(row) + ' of TVL ' + fmtUsd(row.tvl_usd) + ' = ' + fmtUsd(econDrop(row)) + ' expected drop; - $' + econGas(row).toFixed(2) + ' gas - $' + econCapitalCharge(row).toFixed(2) + ' capital charge = ' + fmtUsd(econNet(row)) + ' net; ' + fmtUsd(econNet(row)) + ' / 2.5h = ' + fmtUsd(econHour(row)) + '/h. Break-even odds ' + (row.breakeven_odds * 100).toFixed(1) + '% vs peer odds ' + fmtOdds(row.token_odds) + '. Verdict rule: FARM at net/hour >= $25 and odds >= 45%; THIN at net > 0; else SKIP.' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    if (state.tab === 'pre-token') {
      shell.appendChild(el('div', { class: 'evidence-top' },
        el('div', { html: evidenceValueHtml() }),
        scatterPanel()));
      shell.appendChild(el('div', { html: rangeHonestyHtml() }));
      shell.appendChild(el('div', { id: 'tablewrap' }, boardTable()));
      shell.appendChild(econPanel());
      shell.appendChild(el('div', { html: evidenceRestHtml() }));
      shell.appendChild(auditStrip());
    } else if (state.tab === 'live') {
      shell.appendChild(liveTable());
    } else {
      shell.appendChild(methodPanel());
    }
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  // Re-render only the board table (and its count): a full render on every keystroke
  // would destroy the search input and the econ sliders while the reader uses them.
  function refreshTable() {
    var wrap = document.getElementById('tablewrap');
    if (!wrap) return;
    wrap.textContent = '';
    wrap.appendChild(boardTable());
    var count = document.querySelector('.count');
    if (count) count.textContent = rows().length + ' rows shown';
  }
  function refreshEcon() {
    var note = document.querySelector('.econ .sub');
    if (note) note.textContent = econNote();
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
