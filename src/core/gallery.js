// Collected: a masonry gallery of references (images and video stills).
import { theme } from './tokens.js';
import { esc, round, truncate, frame } from './svg.js';

// Shortest-column masonry with a caption row under each image. Columns are then
// evened out by stretching their images, so the gallery ends on one straight edge.
export function layoutGallery(items, { width = 840, columns = 4, gap = 10, pad = 20, top = 58, caption = 24, minRatio = 0.62, maxRatio = 1.5 } = {}) {
  const colW = (width - pad * 2 - gap * (columns - 1)) / columns;
  const cols = Array.from({ length: columns }, () => []);
  const sum = c => c.reduce((n, t) => n + t.h + caption + gap, 0);
  items.forEach((item, i) => {
    const ratio = item.width && item.height ? item.height / item.width : 1;
    const h = colW * Math.min(maxRatio, Math.max(minRatio, ratio));
    const c = cols.reduce((best, col, k) => (sum(col) < sum(cols[best]) ? k : best), 0);
    cols[c].push({ item, i, w: colW, h });
  });
  const tallest = Math.max(0, ...cols.map(sum));
  const tiles = [];
  cols.forEach((col, c) => {
    if (!col.length) return;
    const imageTotal = col.reduce((n, t) => n + t.h, 0);
    const scale = (imageTotal + tallest - sum(col)) / imageTotal;
    let y = top;
    for (const t of col) {
      t.h *= scale; t.x = pad + c * (colW + gap); t.y = y;
      y += t.h + caption + gap;
      tiles.push(t);
    }
  });
  tiles.sort((a, b) => a.i - b.i);
  return { tiles, height: Math.round(top + tallest - gap + pad - 4), colW, caption };
}

export function renderGallery(items, opts = {}) {
  const t = theme(opts.theme);
  const width = opts.width || 840;
  const animate = opts.animate !== false;
  const list = (items || []).slice(0, opts.limit || 24);
  const { tiles, height, caption } = layoutGallery(list, { width, columns: opts.columns || (width < 600 ? 2 : 4) });
  const id = opts.id || 'gl' + list.length + (opts.theme === 'dark' ? 'd' : 'l');
  const parts = [];
  const title = opts.title || 'Collected';
  parts.push(`<text x="20" y="36" font-size="14" font-weight="600">${esc(title)}</text>`);
  parts.push(`<text x="${width - 20}" y="36" font-size="11" text-anchor="end" class="mono muted">${list.length} ${list.length === 1 ? 'reference' : 'references'}</text>`);
  for (const tile of tiles) {
    const { item, i, x, y, w, h } = tile;
    const X = round(x), Y = round(y), W = round(w), H = round(h);
    const clip = `${id}-c${i}`;
    const g = [`<clipPath id="${clip}"><rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="6"/></clipPath>`, `<g clip-path="url(#${clip})">`];
    g.push(`<rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="${t.surface}"/>`);
    if (item.src) {
      g.push(`<image href="${esc(item.src)}" x="${X}" y="${Y}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`);
    }
    if (item.video) {
      const cx = round(x + w - 17), cy = Y + 17;
      g.push(`<circle cx="${cx}" cy="${cy}" r="11" fill="#000" fill-opacity=".45"/><path d="M${cx - 3} ${cy - 5}L${cx + 5} ${cy}L${cx - 3} ${cy + 5}Z" fill="#fff"/>`);
    }
    g.push(`</g><rect x="${X + 0.5}" y="${Y + 0.5}" width="${W - 1}" height="${H - 1}" rx="6" fill="none" stroke="${t.hairline}"/>`);
    g.push(`<text x="${X + 1}" y="${round(y + h + caption - 7)}" font-size="12" font-weight="500">${esc(truncate(item.title, 12, w - 4))}</text>`);
    parts.push(`<g class="tile" data-i="${i}" style="animation-delay:${animate ? 80 + i * 55 : 0}ms"><title>${esc(item.title + (item.summary ? ' — ' + item.summary : ''))}</title>${g.join('')}</g>`);
  }
  if (!tiles.length) parts.push(`<text x="${width / 2}" y="${height / 2 + 20}" font-size="12" text-anchor="middle" class="muted">Nothing collected yet</text>`);
  const css = s => animate
    ? `${s} .tile{opacity:0;animation:pp-rise .5s cubic-bezier(.2,.7,.2,1) forwards}@keyframes pp-rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`
    : '';
  return frame({ id, width, height: Math.max(height, 140), t, css, animate, title, desc: list.map(it => it.title).join(', '), body: parts.join('') });
}
