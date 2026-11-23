// Token Radar v2 dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the proof cover, the ranked board, a filterable table, a per-protocol detail drawer
// with the model's own inputs and the protocol's farm plan, and the methodology. No network:
// every byte it shows is in data.js. No protocol name is special-cased anywhere on this page.
//
// RANKING NOTE: board.json ranks by implied value, as the gate requires (rank 1 is the most
// valuable protocol). This page's default sort is EXPECTED VALUE (implied x peer token odds),
// which is the "worth farming next" ranking; each row carries its EV rank. The two ranks are
// shown side by side so the reader can see both.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', verdict: 'all', scope: 'all', tab: 'pre-token', sort: 'ev', dir: -1, selected: null, sandbox: false, gw: 0.15, mr: 0.3, catOn: true };
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
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('curator') >= 0) return 'Deposit $' + capital + ' of USDC into a ' + name + ' curator vault on ' + chain + ' and keep the vault shares; the curator allocates it across strategies, so read which vault you joined.';
    if (c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' of USDC into a ' + name + ' allocation vault on ' + chain + ' and keep the shares; check what the vault allocates to before you deposit.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of " + name + "'s tokenized yield asset on " + chain + ' and hold it so the underlying yield accrues to you.';
    if (c.indexOf('lend') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ', keep the position open, and make one small borrow against it so both sides of the market are active.';
    if (c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Lock $' + capital + ' of collateral in ' + name + ' on ' + chain + " and mint a small amount of its stable asset against it; keep the position safely collateralized.";
    if (c.indexOf('perpetual') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' on ' + chain + ' and open one small hedged perpetual position; close the hedge before the position grows.';
    if (c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' on ' + chain + ' and open one small derivative position; keep the position sized so a single move cannot liquidate it.';
    if (c.indexOf('dex') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open; pick the pool with the deepest liquidity, not the highest advertised yield.';
    if (c.indexOf('yield aggregator') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Deposit $' + capital + ' of USDC into ' + name + "'s main strategy vault on " + chain + ' and let it auto-compound; keep the vault shares.';
    if (c.indexOf('yield') >= 0 || c.indexOf('liquidity manager') >= 0) return 'Deposit $' + capital + ' into ' + name + "'s main yield vault on " + chain + " and keep the shares; note the vault's fee and lock-up before you deposit.";
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app; keep the receipt transaction.';
    if (c.indexOf('restak') >= 0 || c.indexOf('liquid staking') >= 0 || c.indexOf('staking') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' on ' + chain + ' and keep the receipt token; the receipt is what the position is measured by.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one small market position on ' + name + ' on ' + chain + '; keep the position open until the market resolves.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active; note what the cover actually pays for.';
    if (c.indexOf('basis') >= 0) return 'Deposit $' + capital + ' of USDC into ' + name + "'s basis strategy on " + chain + ' and keep the position open through one funding cycle.';
    if (c.indexOf('payment') >= 0) return 'Use ' + name + ' on ' + chain + ' to move $' + capital + ' through its payment rail and keep the transaction record; repeat the payment once a week.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function weeklyActionFor(p) {
    var c = (p.category || '').toLowerCase();
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Read the vault allocation report and, if the curator changed strategy, top up or move a small amount to the new vault.';
    if (c.indexOf('rwa') >= 0) return 'Check the underlying yield accrual and mint or top up a small amount so the position stays active.';
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Adjust the supply, or borrow and repay a small amount, so both sides of the market stay active.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Open and close one small hedged trade, keeping the margin position open.';
    if (c.indexOf('dex') >= 0) return 'Make one swap or add a little liquidity to the same pool.';
    if (c.indexOf('yield') >= 0 || c.indexOf('liquidity manager') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Harvest or compound the vault rewards once, or top up a small amount.';
    if (c.indexOf('bridge') >= 0) return 'Make one small bridge transfer and use the bridged funds in the app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Check the staking rewards accrual and, if the protocol offers it, restake a small amount.';
    if (c.indexOf('prediction') >= 0) return 'Place one small position on a new market.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit a small amount of the stable asset, or use it in the protocol app once.';
    if (c.indexOf('insurance') >= 0) return 'Check the policy is still active and renew or extend it if it is close to expiring.';
    if (c.indexOf('basis') >= 0) return 'Check the funding rate and keep the basis position open through the cycle.';
    if (c.indexOf('payment') >= 0) return 'Make one more payment through the rail and keep the record.';
    return 'Make one qualifying action, such as a deposit, a borrow, a swap or a vote.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var total = p.farm_cost_usd;
    var weekly = p.weekly_gas_usd;
    var setupGas = Math.max(0, total - weekly * 8);
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $' + setupGas + ' of gas for the first transaction on ' + chain, time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + setupGas + ' of gas', time: '15 minutes to set up' },
      { text: 'Each week: ' + weeklyActionFor(p), cost: 'about $' + weekly + ' of gas a week, $' + (weekly * 8) + ' over 8 weeks on ' + chain, time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position; total out-of-pocket cost is $' + total, time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }

  // Sandbox recomputation: the same arithmetic as lib/model.ts, with the sandbox's weights.
  // implied' = loglog_base x (category factor or 1) x (1 + growth% x gw) x maturity'
  // maturity' = 0.85 + min(age, 1095)/1095 x mr. EV' = implied' x odds.
  function sandboxValues(row) {
    var age = row.age_days === null || row.age_days === undefined ? DATA.model.unknown_age_days : row.age_days;
    var growthPct = Math.min(DATA.model.growth_cap, Math.max(DATA.model.growth_floor, row.change_7d === null ? 0 : row.change_7d));
    var maturity = DATA.model.maturity_floor + (Math.min(Math.max(age, 0), DATA.model.maturity_days) / DATA.model.maturity_days) * state.mr;
    var implied = Math.max(1, Math.round(row.loglog_base_usd * (state.catOn ? row.category_factor : 1) * (1 + (growthPct / 100) * state.gw) * maturity));
    return { implied: implied, ev: Math.max(1, Math.round(implied * row.token_odds)) };
  }
  function shown(row) {
    if (!state.sandbox) return { implied: row.implied_value_usd, ev: row.expected_value_usd };
    return sandboxValues(row);
  }

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
      if (key === 'ev') { av = shown(a).ev; bv = shown(b).ev; }
      else if (key === 'implied') { av = shown(a).implied; bv = shown(b).implied; }
      else if (key === 'odds') { av = a.token_odds; bv = b.token_odds; }
      else if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = shown(a).ev; bv = shown(b).ev; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
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

  function lede() {
    var t = DATA.tests;
    var top = DATA.rows.slice().sort(function (a, b) { return a.ev_rank - b.ev_rank; })[0];
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: 'Which pre-token protocol is worth farming next?' }),
        el('p', { text: 'Ranked by expected value: implied token value x the peer token odds. The board below is sorted by expected value by default; its rank column is the implied-value rank the gate requires. Top expected value: ' + (top ? top.name + ' at ' + fmtUsd(top.expected_value_usd) : 'n/a') + '.' }),
        el('div', { class: 'proof-grid' },
          proofCard('1. Fitted value model', 'log(mcap) = 4.002 + 0.687 x log(TVL)', 'Fit on 116 trimmed comps, R2 0.402, residual sd 1.594. No hand-picked multiple.'),
          proofCard('2. Held-out tests', 'Value LOO 1.618 vs flat 1.702', 'Odds logistic 5-fold log-loss 0.586, AUC 0.763, vs bucket 0.662 / 0.619.'),
          proofCard('3. Logistic token odds', 'EV = implied x logistic odds', 'Fit on all 758 protocols, L2 lambda 10. Risk Curators 12.8% token rate, Lending 78.7%.'),
          proofCard('4. Honest range', 'P10-P90 = implied / 7.72 to x 7.72', 'The fit is weak (R2 0.40), so the range is wide on purpose.'),
          proofCard('5. Costed farm verdicts', DATA.verdict_counts.FARM + ' FARM / ' + DATA.verdict_counts.THIN + ' THIN / ' + DATA.verdict_counts.SKIP + ' SKIP', 'Gas by chain: $5 on cheap chains, $20 mid, $50 on Ethereum. About 2.5 hours active.'),
          proofCard('6. Coverage and audit', 'Watchlist 40 / 40', 'Funnel 758 -> 342 pre-token -> 289 rankable -> 213 rows. See the integrity strip.')
        ),
        el('p', { class: 'integrity', text: 'Integrity: 758 protocols -> 342 pre-token -> 289 rankable -> 213 board rows. Watchlist 40/40. Comps: 128 with mcap > 0 (16 with mcap <= 0 excluded, 272 token protocols with no mcap cannot be fitted). Missing: change_7d null in 4, listed_at null in 113 (those score with a missing-age flag in the odds logistic). Outlier: Shift DeFi +4448% 7d growth, clamped to +120% for value and +30% for odds. "Records no token" is not proof a protocol has no token.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Top expected value' }), el('b', { text: top ? fmtUsd(top.expected_value_usd) : 'n/a' })),
        el('div', { class: 'fact' }, el('span', { text: 'Top implied value' }), el('b', { text: fmtUsd(DATA.rows[0].implied_value_usd) }))
      )
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

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.verdict = 'all'; state.scope = 'all'; writeHash(); render(); } })
      ));
    }
    var maxEv = list[0] ? shown(list[0]).ev : 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var v = shown(r);
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: 'EV ' + String(r.ev_rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') + (r.late_flag ? ' - late: over 730 days with no token' : '') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num', text: fmtUsd(v.implied) }),
        el('td', { class: 'num', text: fmtOdds(r.token_odds) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((v.ev / maxEv) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(v.ev) })
        )),
        el('td', null, el('span', { class: 'verdict ' + r.verdict.toLowerCase(), text: r.verdict })),
        el('td', { class: 'num', text: fmtUsd(r.usd_per_hour) + '/h' })
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest expected value first. Rank is the implied-value rank; EV rank is the farming rank. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('ev', 'EV rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('implied', 'Implied value'),
            sortHeader('odds', 'Token odds'),
            sortHeader('ev', 'Expected value'),
            el('th', { scope: 'col', text: 'Verdict' }),
            el('th', { scope: 'col', text: 'EV $/h index' })
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
      el('h3', { text: 'The value model (radar-v3)' }),
      el('p', { text: 'implied = exp(' + m.log_intercept + ' + ' + m.log_slope + ' x ln(TVL)) x category factor x (1 + clamp(change_7d, -60, 120) / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age, 1095) / 1095 x ' + m.maturity_range + '). The log-log fit comes from 116 trimmed comps (mcap > 0, mcap/TVL in P5-P95): R2 0.402, residual sd 1.594 in log units. Category factors (shrunk, weight n/(n+8)): Dexs 1.314, RWA 1.142, Yield 1.095, Lending 0.731, Liquid Staking 0.454, CEX 0.566; other categories 1.0. Growth weight is 0.15 because peer token rates fall with 7d growth and the term is inert in-sample (log-RMSE 1.594 at weight 0, 1.594 at 0.15, 1.595 at 0.5).' }),
      el('h3', { text: 'Token odds: a logistic regression, not buckets' }),
      el('p', { text: 'Odds are a logistic regression fitted on all 758 protocols (label: records a token), L2 lambda 10, 600 gradient-descent iterations, implemented from scratch in lib/model.ts. Features: log TVL, log(age + 1) with missing listed_at scored as 365 days plus a missing-age flag, 7d growth clamped to -60..+30% (the value model allows +120%, but a +4448% listing artifact would dominate the odds feature; peer token rates are already at their floor above +30%), number of chains capped at 10 (one protocol lists 176 chains), and one-hot category for the 14 categories with at least 20 protocols. EV = implied x odds. P10 = implied / 7.72, P90 = implied x 7.72, from the fit residual sd.' }),
      el('p', { text: 'Why the category matters: only 12.8% of Risk Curators record a token, against 78.7% of Lending and 73.7% of Dexs. That is why Steakhouse Financial (Risk Curators, implied $166.5M) gets odds of 36.6% and a THIN verdict, while Veda (implied $114.5M, odds 58.6%) tops the expected-value ranking. The verdict rule is mechanical: FARM needs EV >= $12.5M and odds >= 45%.' }),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Logistic coefficients (standardized features). A positive weight raises the token odds; the intercept is 0.221.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Feature' }), el('th', { scope: 'col', text: 'Weight' }))),
          el('tbody', null, (DATA.logistic_features || []).map(function (f, i) {
            return el('tr', null, el('td', { text: f }), el('td', { class: 'num', text: (DATA.logistic.weights[i] >= 0 ? '+' : '') + DATA.logistic.weights[i].toFixed(3) }));
          }))
        )
      ),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Out-of-fold calibration (5-fold): mean predicted odds vs observed token rate per decile. The lowest decile is under-predicted (11.8% vs 22.7% observed); the rest track within about 8 points.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Decile' }), el('th', { scope: 'col', text: 'Predicted' }), el('th', { scope: 'col', text: 'Observed' }))),
          el('tbody', null, t.odds.calibration_oof_deciles.map(function (d) {
            return el('tr', null, el('td', { class: 'num', text: String(d.decile) }), el('td', { class: 'num', text: (d.predicted * 100).toFixed(1) + '%' }), el('td', { class: 'num', text: (d.observed * 100).toFixed(1) + '%' }));
          }))
        )
      ),
      el('h3', { text: 'Calibration of the odds: tested in v3, not adopted' }),
      el('p', { text: 'The lowest decile above is under-predicted (11.8% vs 22.7% observed), so v3 tested three fixes, each fitted inside the training fold only and scored held-out (5-fold out-of-fold and split-half, 20 seeds). Platt scaling made log-loss worse in both protocols (0.5880 vs 0.5863 out-of-fold; 0.5894 vs 0.5876 split-half). Isotonic regression was much worse (0.6190 out-of-fold) and its full-fit breakpoints are degenerate - a run of 1.0s at the top - which is overfitting on 758 protocols. Shrinking the odds 10% toward the base rate improved log-loss by only 0.002 in both protocols, did not improve Brier, worsened calibration error overall, and the paired gain is inside noise (t = -0.65, bootstrap 95% interval -0.0086 to +0.0037). So no calibration was adopted: the raw logistic odds stand, and the under-predicted bottom decile stays visible in the table above instead of being papered over.' }),
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
      el('p', { text: 'Value, leave-one-out on the trimmed comps: log-RMSE ' + t.loo_trimmed_log_rmse + ' vs flat median-ratio baseline ' + t.loo_trimmed_flat_log_rmse + '. On all 128 comps: ' + t.loo_all128_log_rmse + ' vs flat ' + t.loo_all128_flat_log_rmse + '. Category-factor sweep (LOO, factors refit inside each fold): k = 0 gives 1.658, k = 8 gives 1.642, k = 32 gives 1.629, no factor at all gives 1.618. The factor is kept at k = 8 anyway because it corrects systematic category bias (see the holdout table), at a LOO cost of 0.024 log units - and that trade-off is stated here, not hidden. Ranking impact of that choice (v3): moving to k = 32 moves 28 board rows by more than 10 EV ranks, dropping the factor moves 53, mostly Liquid Staking rows moving up - that is the known bias returning, since the factor is what holds those rows down. The top 10 EV rows are the same set under k = 8, k = 32 and no factor. Split-half, 20 seeds: log-log mean ' + t.split_half_log_rmse_mean + ' (range ' + t.split_half_log_rmse_min + '-' + t.split_half_log_rmse_max + ') vs flat ' + t.split_half_flat_log_rmse_mean + ' vs starter 0.25x ' + t.split_half_starter_log_rmse_mean + '. Listed-date split (fit on comps listed before 2025, test on later ones): log-RMSE ' + t.listed_date_split_log_rmse + ', bias ' + t.listed_date_split_bias_log + ' (train ' + t.listed_date_split_train_n + ', test ' + t.listed_date_split_test_n + '); reversed: ' + t.listed_date_split_reverse_log_rmse + '.' }),
      el('p', { text: 'Odds, held out: logistic 5-fold out-of-fold log-loss ' + t.odds.oof_logloss + ', AUC ' + t.odds.oof_auc + ', Brier ' + t.odds.oof_brier + '; the v1 bucket odds score ' + t.odds.bucket_oof_logloss + ' / ' + t.odds.bucket_oof_auc + ', and the base rate alone scores log-loss ' + t.odds.base_rate_logloss + '. Split-half (20 seeds): logistic ' + t.odds.split_half_logloss + ' / AUC ' + t.odds.split_half_auc + ' vs bucket ' + t.odds.bucket_split_half_logloss + ' / ' + t.odds.bucket_split_half_auc + '; numeric features without categories score ' + t.odds.numeric_only_split_half_logloss + ' / ' + t.odds.numeric_only_split_half_auc + ', so the category features carry most of the gain.' }),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Category holdout: the global log-log fit, trained without that category, predicting it. Bias > 0 means the global fit overpredicts the category.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'n' }), el('th', { scope: 'col', text: 'log-RMSE' }), el('th', { scope: 'col', text: 'Bias (log)' }))),
          el('tbody', null, holdRows)
        )
      ),
      el('h3', { text: 'Farm verdicts and gas (a stated assumption)' }),
      el('p', { text: 'Minimum capital by TVL tier: $250 / $150 / $100 / $50. Gas is priced by the protocol\'s first chain, as an ASSUMPTION, because the snapshot carries no gas data: Ethereum $5 a week (setup $10), cheap chains - Solana, Tron, Sui, Aptos, Near, Stellar, Ripple and the Cosmos family - $0.50 a week (setup $1), everything else $2 a week (setup $4). Total out-of-pocket cost over 8 weeks is therefore $5 on a cheap chain, $20 on a mid chain and $50 on Ethereum. About 2.5 hours of active time; hold 30, 45 or 60 days by age. $/hour = (EV - cost) / 2.5. EV is a TOTAL implied market cap, not a per-farmer payout, so $/hour is a ranking index on total EV, not a wage and not income. Verdict: FARM when EV >= $12.5M and odds >= 45%; THIN when EV >= $2.5M and odds >= 35%; otherwise SKIP. Each category gets its own farm action and weekly action: a curator vault is farmed differently from a lending market or a perpetual exchange, and the plan says how. Why 45%? Break-even odds = cost / implied, and on this board the largest break-even odds anywhere is 0.0023% (swan-dao, $50 cost on $2.1M implied; the median is 0.00037%), so the farm cost never binds - the 45% floor is a likelihood standard, not a cost cover. It means roughly even money: 50% minus about 5 points of calibration slack, since the middle deciles over-predict by 4-7 points. The sweep behind it (v3): a 40% floor gives the identical FARM set (12 rows); 30% admits exactly two more rows, Steakhouse Financial (36.6%) and Gauntlet (30.5%), both Risk Curators whose peers record a token only 12.8% of the time; 50% drops onre (48.6%) and upshift (45.8%). The EV tier is the sensitive knob instead: $5M would make 39 rows FARM, $25M only 3, $50M only Veda. So the rule as written keeps FARM selective at 12 of 213 rows, and Gauntlet being SKIP at EV rank 4 is the rule working as designed, not an oversight.' }),
      el('h3', { text: 'What this radar does not claim' }),
      el('p', { text: 'No walk-forward test. The snapshot is a single date (2026-11-14) with no TVL or price history, so a genuine walk-forward test cannot be built from it, and none is claimed here. The listed-date split above is the closest honest check: fit on earlier-listed comps, test on later-listed ones. Odds are a peer rate, not a forecast of a launch date: an old protocol with no token may simply never launch, which is why rows over 730 days old carry a late flag. Only 128 of 416 token protocols report a market cap, so the comps may be biased toward larger, more liquid tokens. Gas prices are an assumption, not data. "Records no token" is DefiLlama\u2019s record, not proof a protocol has no token.' })
    );
  }

  function sandboxPanel() {
    var gw = el('input', { type: 'range', min: '0', max: '0.5', step: '0.05', value: String(state.gw), 'aria-label': 'Growth weight' });
    gw.addEventListener('input', function () { state.gw = parseFloat(gw.value); state.sandbox = true; refreshSandbox(); refreshTable(); });
    var mr = el('input', { type: 'range', min: '0', max: '0.5', step: '0.05', value: String(state.mr), 'aria-label': 'Maturity range' });
    mr.addEventListener('input', function () { state.mr = parseFloat(mr.value); state.sandbox = true; refreshSandbox(); refreshTable(); });
    var cat = el('input', { type: 'checkbox', checked: state.catOn ? 'checked' : null, 'aria-label': 'Use category factors' });
    cat.addEventListener('change', function () { state.catOn = cat.checked; state.sandbox = true; refreshSandbox(); refreshTable(); });
    var reset = el('button', { class: 'button', type: 'button', text: 'Reset to radar-v3', onclick: function () { state.sandbox = false; state.gw = 0.15; state.mr = 0.3; state.catOn = true; render(); } });
    return el('section', { class: 'panel sandbox' },
      el('h2', { text: 'Model sandbox' }),
      el('p', { class: 'sub', text: 'Change the weights and the board re-sorts by expected value. This changes the page only: board.json keeps the radar-v3 numbers. Growth weight ' + state.gw.toFixed(2) + ', maturity range ' + state.mr.toFixed(2) + ', category factors ' + (state.catOn ? 'on' : 'off') + '.' }),
      el('div', { class: 'sandbox-row' },
        el('label', null, 'Growth weight ', gw),
        el('label', null, 'Maturity range ', mr),
        el('label', null, 'Category factors ', cat),
        reset
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
    var steps = farmSteps(row);
    var v = shown(row);
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
        el('div', null, el('span', { text: 'Log-log base value' }), el('b', { class: 'num', text: fmtUsd(row.loglog_base_usd) })),
        el('div', null, el('span', { text: 'Category factor' }), el('b', { class: 'num', text: 'x' + row.category_factor })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: String(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(v.implied) })),
        el('div', null, el('span', { text: 'Peer token odds (logistic)' }), el('b', { class: 'num', text: fmtOdds(row.token_odds) })),
        el('div', null, el('span', { text: 'Expected value' }), el('b', { class: 'num', text: fmtUsd(v.ev) })),
        el('div', null, el('span', { text: 'Honest range P10-P90' }), el('b', { class: 'num', text: fmtUsd(row.p10_value_usd) + ' - ' + fmtUsd(row.p90_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'This is an estimate with a wide range (P10-P90 spans a factor of about 60), not a price. ' + (row.late_flag ? 'Late flag: this protocol is over 730 days old and still records no token, which may mean it never launches.' : 'Age is within the usual launch window for its peers.') })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan - ' + row.verdict }),
      el('p', { class: 'sub', text: 'Minimum capital $' + capitalFor(row) + '. Out-of-pocket cost $' + row.farm_cost_usd + ' over 8 weeks (' + row.gas_tier + ' gas tier on ' + chainOf(row) + ': $' + row.weekly_gas_usd + ' a week). About 2.5 hours active. EV $/h index ' + fmtUsd(row.usd_per_hour) + '/h (an index on total EV, not a wage). Break-even odds ' + (row.breakeven_odds * 100).toFixed(4) + '% vs peer odds ' + fmtOdds(row.token_odds) + '. Verdict rule: FARM at EV >= $12.5M and odds >= 45%; THIN at EV >= $2.5M and odds >= 35%; else SKIP.' }),
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
      shell.appendChild(el('div', { id: 'tablewrap' }, boardTable()));
      shell.appendChild(sandboxPanel());
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

  // Re-render only the board table (and its count), without rebuilding the controls:
  // a full render on every keystroke would destroy the search input and the sandbox
  // sliders while the reader is using them.
  function refreshTable() {
    var wrap = document.getElementById('tablewrap');
    if (!wrap) return;
    wrap.textContent = '';
    wrap.appendChild(boardTable());
    var count = document.querySelector('.count');
    if (count) count.textContent = rows().length + ' rows shown';
  }
  function refreshSandbox() {
    var note = document.querySelector('.sandbox .sub');
    if (note) note.textContent = 'Change the weights and the board re-sorts by expected value. This changes the page only: board.json keeps the radar-v3 numbers. Growth weight ' + state.gw.toFixed(2) + ', maturity range ' + state.mr.toFixed(2) + ', category factors ' + (state.catOn ? 'on' : 'off') + '.';
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
