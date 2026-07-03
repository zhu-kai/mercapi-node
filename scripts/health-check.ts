/**
 * Live health check against the Mercari API. Verifies the endpoints and
 * response shapes this library depends on, and generates a static status page.
 *
 * Usage: tsx scripts/health-check.ts [--history history.json] [--out public]
 * Exits non-zero if any required check fails.
 */
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { Mercapi } from '../src/mercapi';

interface Check {
  name: string;
  ok: boolean;
  required: boolean;
  detail: string;
}

interface Run {
  timestamp: string;
  ok: boolean;
  checks: Check[];
  probe?: {
    query: string;
    numFound: number;
    topItem: { name: string; price: number };
  };
}

// Rotates daily; popular enough that a healthy API always returns results
const PROBE_QUERIES = [
  'ダイワ ソルティガ', // Daiwa Saltiga
  'シマノ ステラ', // Shimano Stella
  'ポケモンカード 旧裏',
  'ゲームボーイカラー',
  'Leica M6',
  'ジャンク カメラ',
  'エヴァンゲリオン フィギュア',
  'カセットテープ 昭和',
];

const checks: Check[] = [];

function check(name: string, cond: boolean, detail: unknown, required = true) {
  checks.push({ name, ok: cond, required, detail: String(detail).slice(0, 80) });
}

async function runChecks(): Promise<Run> {
  const m = new Mercapi();
  const now = Date.now() / 1000;

  let query = PROBE_QUERIES[new Date().getUTCDate() % PROBE_QUERIES.length];
  let res = await m.search(query);
  if (res.items.length === 0) {
    // Don't let a quiet niche query masquerade as an API outage
    query = 'ゲーム';
    res = await m.search(query);
  }
  check('search: returns items', res.items.length > 0, `"${query}" → ${res.items.length} items`);
  check('search: numFound', res.meta.numFound > 0, res.meta.numFound);
  const first = res.items[0];
  check(
    'search: item fields',
    first.id.length > 0 && first.name.length > 0 && first.price > 0 && first.created > 0,
    `${first.id} ¥${first.price}`
  );

  const auction = res.items.find((i) => i.auction)?.auction;
  check(
    'search: auction parsing',
    auction ? auction.endTime > now - 86400 && auction.highestBid > 0 : false,
    auction ? `bid ¥${auction.highestBid}, ends ${new Date(auction.endTime * 1000).toISOString()}` : 'no auction items in sample',
    false
  );

  const regular = res.items.find((i) => !i.isShopItem && !i.auction);
  const item = regular ? await m.getItem(regular.id) : null;
  check(
    'item: detail fields',
    item != null &&
      item.description.length > 0 &&
      item.seller.id.length > 0 &&
      item.itemCategory.id > 0 &&
      item.itemCondition.id > 0,
    item ? `${item.id} ${item.itemCategory.name}` : 'no regular item found'
  );

  const profile = regular ? await m.getProfile(regular.sellerId) : null;
  check(
    'profile: fields',
    profile != null && profile.name.length > 0 && profile.created > 0,
    profile ? `${profile.name}, since ${new Date(profile.created * 1000).getFullYear()}` : 'skipped'
  );

  const sellerItems = regular ? await m.getSellerItems(regular.sellerId) : null;
  check(
    'sellerItems: returns items',
    sellerItems != null && sellerItems.items.length > 0,
    sellerItems ? `${sellerItems.items.length} items` : 'skipped'
  );

  const priciest = [...res.items].sort((a, b) => b.price - a.price)[0];
  return {
    timestamp: new Date().toISOString(),
    ok: checks.filter((c) => c.required).every((c) => c.ok),
    checks,
    probe: {
      query,
      numFound: res.meta.numFound,
      topItem: { name: priciest.name, price: priciest.price },
    },
  };
}

function esc(s: string): string {
  return s.replace(/</g, '&lt;');
}

function renderPage(history: Run[]): string {
  const latest = history[history.length - 1];
  const rows = latest.checks
    .map(
      (c) => `<tr>
        <td>${c.ok ? '✅' : c.required ? '❌' : '⚠️'}</td>
        <td>${c.name}${c.required ? '' : ' <small>(optional)</small>'}</td>
        <td><code>${esc(c.detail)}</code></td>
      </tr>`
    )
    .join('\n');
  const dots = history
    .slice(-90)
    .map((r) => `<span class="dot ${r.ok ? 'up' : 'down'}" title="${r.timestamp}: ${r.ok ? 'OK' : 'FAIL'}"></span>`)
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>mercapi API status</title>
<style>
  :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
  body { max-width: 720px; margin: 3rem auto; padding: 0 1rem; line-height: 1.6; }
  .banner { padding: 1rem 1.25rem; border-radius: 8px; font-weight: 600; font-size: 1.1rem;
    background: ${latest.ok ? '#dcfce7' : '#fee2e2'}; color: ${latest.ok ? '#166534' : '#991b1b'}; }
  @media (prefers-color-scheme: dark) {
    .banner { background: ${latest.ok ? '#14532d' : '#7f1d1d'}; color: ${latest.ok ? '#bbf7d0' : '#fecaca'}; }
  }
  table { width: 100%; border-collapse: collapse; margin-top: 1.5rem; }
  td { padding: 0.4rem 0.6rem; border-bottom: 1px solid #8884; vertical-align: top; }
  .dot { display: inline-block; width: 8px; height: 20px; margin-right: 2px; border-radius: 2px; }
  .dot.up { background: #22c55e; } .dot.down { background: #ef4444; }
  small, .muted { opacity: 0.65; }
</style>
</head>
<body>
<h1>mercapi <small class="muted">Mercari API status</small></h1>
<div class="banner">${latest.ok ? 'Operational — the Mercari API works as this library expects' : 'Broken — the Mercari API changed or is unreachable'}</div>
<p class="muted">Last checked: ${latest.timestamp} · runs every 6 hours ·
  <a href="https://github.com/zhu-kai/mercapi-node">GitHub</a></p>
${
  latest.probe
    ? `<p>Today's probe: <strong>${esc(latest.probe.query)}</strong> — ${latest.probe.numFound.toLocaleString()} listings on Mercari right now.
       Priciest find: <strong>¥${latest.probe.topItem.price.toLocaleString()}</strong> <span class="muted">${esc(latest.probe.topItem.name)}</span></p>`
    : ''
}
<div>${dots}</div>
<table>${rows}</table>
</body>
</html>
`;
}

async function main() {
  const args = process.argv.slice(2);
  const historyPath = args.includes('--history') ? args[args.indexOf('--history') + 1] : null;
  const outDir = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;

  let run: Run;
  try {
    run = await runChecks();
  } catch (error) {
    check('endpoint reachable', false, error instanceof Error ? error.message : error);
    run = { timestamp: new Date().toISOString(), ok: false, checks };
  }

  for (const c of run.checks) {
    console.log(`${c.ok ? 'PASS' : c.required ? 'FAIL' : 'WARN'}  ${c.name} — ${c.detail}`);
  }
  console.log(run.ok ? '\nAPI healthy' : '\nAPI CHECK FAILED');

  if (outDir) {
    let history: Run[] = [];
    if (historyPath) {
      history = JSON.parse(await readFile(historyPath, 'utf8').catch(() => '[]')) as Run[];
    }
    history = [...history, run].slice(-120);
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, 'history.json'), JSON.stringify(history));
    await writeFile(join(outDir, 'status.json'), JSON.stringify(run, null, 2));
    await writeFile(join(outDir, 'index.html'), renderPage(history));
  }

  process.exitCode = run.ok ? 0 : 1;
}

main();
