// Activity arrow: one time axis that ends in an arrow at "now".
// New repos, forks and stars stack above the axis; commits hang below it as bars.
import { theme, TYPE_META } from './tokens.js';
import { esc, round, textWidth, truncate, frame, GLYPH } from './svg.js';

export const TYPES = ['repo', 'fork', 'star', 'commit'];
export const RANGES = {
  '30d': { label: 'Past 30 days', grain: 'day' },
  '12m': { label: 'Past 12 months', grain: 'week' },
  all: { label: 'All time', grain: 'month' }
};

const DAY = 864e5;
const utcDay = value => {
  const d = new Date(typeof value === 'string' && value.length === 10 ? value + 'T00:00:00Z' : value);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDay = ms => { const d = new Date(ms); return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate(); };
const fmtMonth = ms => { const d = new Date(ms); return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
const weight = e => e.type === 'commit' ? Math.max(1, Number(e.count) || 1) : 1;

export function bucketize(events, { range = '12m', now } = {}) {
  const today = utcDay(now || Date.now());
  const grain = (RANGES[range] || RANGES['12m']).grain;
  const valid = (events || []).filter(e => TYPES.includes(e.type) && e.date && !Number.isNaN(utcDay(e.date)));
  let starts = [];
  if (grain === 'day') {
    for (let i = 29; i >= 0; i--) starts.push(today - i * DAY);
  } else if (grain === 'week') {
    const dow = (new Date(today).getUTCDay() + 6) % 7; // Monday = 0
    const thisWeek = today - dow * DAY;
    for (let i = 51; i >= 0; i--) starts.push(thisWeek - i * 7 * DAY);
  } else {
    const first = valid.length ? Math.min(...valid.map(e => utcDay(e.date))) : today;
    const f = new Date(first), t = new Date(today);
    let y = f.getUTCFullYear(), m = f.getUTCMonth();
    const span = (t.getUTCFullYear() - y) * 12 + t.getUTCMonth() - m;
    if (span < 11) { m -= 11 - span; while (m < 0) { m += 12; y--; } }
    while (y < t.getUTCFullYear() || (y === t.getUTCFullYear() && m <= t.getUTCMonth())) {
      starts.push(Date.UTC(y, m, 1));
      if (++m === 12) { m = 0; y++; }
    }
  }
  const buckets = starts.map((start, i) => ({
    start,
    end: i + 1 < starts.length ? starts[i + 1] : today + DAY,
    counts: { repo: 0, fork: 0, star: 0, commit: 0 },
    items: []
  }));
  const from = buckets[0].start, to = buckets[buckets.length - 1].end;
  for (const e of valid) {
    const d = utcDay(e.date);
    if (d < from || d >= to) continue;
    // Binary search keeps 'all' ranges with many months fast.
    let lo = 0, hi = buckets.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (buckets[mid].start <= d) lo = mid; else hi = mid - 1; }
    buckets[lo].counts[e.type] += weight(e);
    buckets[lo].items.push(e);
  }
  const totals = { repo: 0, fork: 0, star: 0, commit: 0 };
  for (const b of buckets) for (const k of TYPES) totals[k] += b.counts[k];
  return { range, grain, from, to, today, buckets, totals };
}

function defaultLabel(e, featured) {
  const name = String(e.repo || '').split('/').pop();
  if (e.type === 'repo') return !featured || featured.has(e.repo) || featured.has(name) ? name : null;
  if (e.type === 'fork') return name;
  return null;
}

function tickLabels(model) {
  const out = [];
  model.buckets.forEach((b, i) => {
    const d = new Date(b.start);
    if (model.grain === 'day') {
      if (i % 7 === 2) out.push({ i, text: fmtDay(b.start) });
    } else if (model.grain === 'week') {
      const prev = i ? new Date(model.buckets[i - 1].start) : null;
      if (!prev || prev.getUTCMonth() !== d.getUTCMonth()) {
        if (i === 0 && d.getUTCDate() > 20) return; // avoid a cramped first label
        out.push({ i, text: d.getUTCMonth() === 0 ? String(d.getUTCFullYear()) : MONTHS[d.getUTCMonth()] });
      }
    } else {
      const n = model.buckets.length, step = n > 36 ? 6 : n > 18 ? 3 : 1;
      if (d.getUTCMonth() === 0) out.push({ i, text: String(d.getUTCFullYear()), strong: true });
      else if (d.getUTCMonth() % step === 0) out.push({ i, text: MONTHS[d.getUTCMonth()] });
    }
  });
  return out;
}

export function renderActivity(data, opts = {}) {
  const t = theme(opts.theme);
  const width = opts.width || 840, height = opts.height || 252;
  const range = RANGES[opts.range] ? opts.range : '12m';
  const model = bucketize(data?.events, { range, now: opts.now || data?.generatedAt });
  const featured = opts.featured ? new Set(opts.featured) : null;
  const label = opts.label || (e => defaultLabel(e, featured));
  const animate = opts.animate !== false;
  const P = 24, axisY = height - 88, X0 = P + 4, X1 = width - P - 16;
  const n = model.buckets.length, bw = (X1 - X0) / n;
  const r = Math.max(2.4, Math.min(4, bw * 0.28)), step = r * 2 + 2.4, maxStack = 5;
  const cx = i => X0 + bw * (i + 0.5);
  const delay = x => animate ? Math.round(150 + ((x - X0) / (X1 - X0)) * 900) : 0;
  const maxCommit = Math.max(1, ...model.buckets.map(b => b.counts.commit));
  const parts = [];

  // Header: title, range, legend.
  parts.push(`<text x="${P}" y="38" font-size="14" font-weight="600">${esc(opts.title || 'Activity')}</text>`);
  parts.push(`<text x="${P + textWidth(opts.title || 'Activity', 14) + 10}" y="38" font-size="12" class="muted">${esc(RANGES[range].label)}</text>`);
  let lx = width - P;
  const legend = [];
  for (const k of ['commit', 'star', 'fork', 'repo']) {
    const txt = `${model.totals[k].toLocaleString('en-US')} ${TYPE_META[k].plural}`;
    const w = textWidth(txt, 11, true);
    lx -= w;
    legend.push(`<text x="${round(lx)}" y="38" font-size="11" class="mono muted">${esc(txt)}</text>`);
    lx -= 10;
    legend.push(`<g transform="translate(${round(lx)} 34)" fill="${t[k]}">${k === 'commit' ? `<rect x="-2" y="-4.5" width="4" height="9" rx="1"/>` : GLYPH[k](4)}</g>`);
    lx -= 18;
  }
  parts.push(legend.join(''));

  // Axis + arrowhead.
  const len = round(X1 + 10 - (P - 2));
  parts.push(`<path class="axis" d="M${P - 2} ${axisY}H${X1 + 10}" stroke="${t.axis}" stroke-width="1.25" fill="none" stroke-dasharray="${len}" stroke-dashoffset="${animate ? len : 0}"/>`);
  parts.push(`<path class="head" d="M${X1 + 4} ${axisY - 5}L${X1 + 11} ${axisY}L${X1 + 4} ${axisY + 5}" stroke="${t.axis}" stroke-width="1.25" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
  parts.push(`<text x="${X1 + 12}" y="${height - 22}" font-size="10" class="mono" text-anchor="end">now</text>`);

  // Ticks.
  for (const tick of tickLabels(model)) {
    const x = round(X0 + bw * tick.i);
    parts.push(`<line x1="${x}" y1="${axisY}" x2="${x}" y2="${axisY + 4}" stroke="${t.axis}" stroke-width="1"/>`);
    parts.push(`<text x="${x + 3}" y="${height - 22}" font-size="10" class="mono ${tick.strong ? '' : 'subtle'}">${esc(tick.text)}</text>`);
  }

  // Buckets.
  const stackTops = [];
  model.buckets.forEach((b, i) => {
    const x = round(cx(i)), d = delay(x);
    const glyphs = [];
    for (const k of ['repo', 'fork', 'star']) for (let j = 0; j < b.counts[k]; j++) glyphs.push(k);
    const shown = glyphs.length > maxStack ? glyphs.slice(0, maxStack - 1) : glyphs;
    let y = axisY - 4 - r;
    const g = [];
    shown.forEach((k, j) => {
      g.push(`<g transform="translate(${x} ${round(y)})" fill="${t[k]}"><g class="pop" style="animation-delay:${d + j * 40}ms">${GLYPH[k](r)}</g></g>`);
      y -= step;
    });
    if (glyphs.length > shown.length) {
      g.push(`<text x="${x}" y="${round(y + r + 1)}" font-size="9" text-anchor="middle" class="mono subtle pop" style="animation-delay:${d + shown.length * 40}ms">+${glyphs.length - shown.length}</text>`);
      y -= 8;
    }
    stackTops[i] = y + r;
    if (b.counts.commit) {
      const h = round(3 + Math.sqrt(b.counts.commit / maxCommit) * 34);
      const w = round(Math.max(2, Math.min(6, bw * 0.46)));
      g.push(`<rect class="bar" style="animation-delay:${d}ms" x="${round(x - w / 2)}" y="${axisY + 5}" width="${w}" height="${h}" rx="1" fill="${t.commit}"/>`);
    }
    const parts2 = TYPES.filter(k => b.counts[k]).map(k => `${b.counts[k]} ${b.counts[k] === 1 ? TYPE_META[k].label.toLowerCase() : TYPE_META[k].plural}`);
    const when = model.grain === 'day' ? fmtDay(b.start) : model.grain === 'week' ? 'Week of ' + fmtDay(b.start) : fmtMonth(b.start);
    if (g.length) parts.push(`<g class="bucket" data-i="${i}"><title>${esc(when + (parts2.length ? ' · ' + parts2.join(', ') : ''))}</title><rect x="${round(x - bw / 2)}" y="${P + 40}" width="${round(bw)}" height="${axisY - P}" fill="transparent"/>${g.join('')}</g>`);
  });

  // Callouts: most recent labelled events, placed on two rows without overlap.
  const candidates = [];
  model.buckets.forEach((b, i) => {
    for (const e of b.items) {
      if (e.type === 'commit') continue;
      const text = label(e);
      if (text) candidates.push({ i, e, text, date: utcDay(e.date) });
    }
  });
  candidates.sort((a, b) => b.date - a.date || (a.e.type === 'repo' ? -1 : 1));
  const rows = [[], []], rowY = [P + 46, P + 64], placed = [], seen = new Set();
  for (const c of candidates) {
    if (placed.length >= (opts.maxCallouts ?? 5)) break;
    if (seen.has(c.text)) continue;
    const x = cx(c.i), text = truncate(c.text, 11, 150), w = textWidth(text, 11) + 16;
    let left = x - 4, right = x - 4 + w, anchor = 'start';
    if (right > width - P) { left = x + 4 - w; right = x + 4; anchor = 'end'; }
    if (left < P) continue;
    const row = rows.findIndex(list => list.every(o => right + 8 < o.left || left - 8 > o.right));
    if (row < 0) continue;
    rows[row].push({ left, right });
    seen.add(c.text);
    placed.push({ ...c, x, text, anchor, row });
  }
  placed.forEach((c, k) => {
    const y = rowY[c.row], d = animate ? 1150 + k * 90 : 0;
    const top = Math.max(y + 6, stackTops[c.i] - 3);
    const tx = c.anchor === 'start' ? c.x + 8 : c.x - 8;
    parts.push(`<g class="callout" style="animation-delay:${d}ms">` +
      `<line x1="${round(c.x)}" y1="${y - 3}" x2="${round(c.x)}" y2="${round(top)}" stroke="${t.border}" stroke-width="1"/>` +
      `<g transform="translate(${round(c.x)} ${y - 4})" fill="${t[c.e.type]}">${GLYPH[c.e.type](3)}</g>` +
      `<text x="${round(tx)}" y="${y}" font-size="11" text-anchor="${c.anchor}">${esc(c.text)}</text></g>`);
  });

  if (!model.buckets.some(b => TYPES.some(k => b.counts[k]))) {
    parts.push(`<text x="${width / 2}" y="${axisY - 24}" font-size="12" text-anchor="middle" class="muted">No public activity in this range</text>`);
  }

  const css = s => animate
    ? `${s} .axis{animation:pp-draw .9s cubic-bezier(.3,.7,.2,1) forwards}${s} .head{opacity:0;animation:pp-fade .2s .85s forwards}` +
      `${s} .pop{opacity:0;transform-box:fill-box;transform-origin:center;animation:pp-pop .35s cubic-bezier(.3,1.5,.5,1) forwards}` +
      `${s} .bar{transform-box:fill-box;transform-origin:top;transform:scaleY(0);animation:pp-grow .45s ease-out forwards}` +
      `${s} .callout{opacity:0;animation:pp-fade .4s ease-out forwards}` +
      `@keyframes pp-draw{to{stroke-dashoffset:0}}@keyframes pp-fade{to{opacity:1}}@keyframes pp-pop{from{opacity:0;transform:scale(.2)}to{opacity:1;transform:scale(1)}}@keyframes pp-grow{to{transform:scaleY(1)}}`
    : '';
  const desc = `${RANGES[range].label}: ${model.totals.commit} commits, ${model.totals.star} stars, ${model.totals.fork} forks, ${model.totals.repo} new repositories.`;
  return frame({ id: opts.id, width, height, t, css, animate, title: opts.title || 'GitHub activity', desc, body: parts.join(''), border: opts.border !== false });
}
