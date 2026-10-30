// Curiosity card: one row per interest, one column per month, dot size = stars.
// The last three months sit on a tinted band so the drift reads at a glance.
import { theme } from './tokens.js';
import { esc, round, truncate, frame } from './svg.js';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export function renderCuriosity(c, opts = {}) {
  const t = theme(opts.theme);
  const width = opts.width || 840, P = 24;
  const animate = opts.animate !== false;
  const id = opts.id || 'cu' + (opts.theme === 'dark' ? 'd' : 'l');
  const rows = c.rows || [];
  const rowH = 22, gridTop = 128, labelW = 150;
  const height = opts.height || Math.max(200, gridTop + Math.max(rows.length, 1) * rowH + 44);
  const x0 = P + labelW, x1 = width - P - 44, colW = (x1 - x0) / 12;
  const parts = [];

  parts.push(`<text x="${P}" y="40" font-size="11" font-weight="600" letter-spacing="1.2" class="subtle">CURIOSITY</text>`);
  parts.push(`<text x="${width - P}" y="40" font-size="10.5" text-anchor="end" class="mono subtle">what I star · 12 months</text>`);
  parts.push(`<text class="name" x="${P}" y="74" font-size="24" font-weight="650" letter-spacing="-0.4">${esc(truncate(c.headline, 24, width - P * 2))}</text>`);
  parts.push(`<text x="${P}" y="98" font-size="12.5" class="muted">${esc(c.summary)}</text>`);

  // "Lately" band over the last three months.
  const bandX = x0 + colW * 9;
  parts.push(`<rect x="${round(bandX)}" y="${gridTop - 14}" width="${round(colW * 3)}" height="${rows.length * rowH + 12}" rx="6" fill="${t.surface}"/>`);
  parts.push(`<text x="${round(bandX + colW * 1.5)}" y="${gridTop - 18}" font-size="9.5" text-anchor="middle" class="mono subtle">90 days</text>`);

  const max = Math.max(1, ...rows.flatMap(r => r.months));
  rows.forEach((r, i) => {
    const y = gridTop + i * rowH;
    parts.push(`<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${t.hairline}"/>`);
    parts.push(`<text x="${P}" y="${y + 4}" font-size="12"${r.late ? ' font-weight="600"' : ''}>${esc(truncate(r.label, 12, labelW - 12))}</text>`);
    parts.push(`<text x="${width - P}" y="${y + 4}" font-size="11" text-anchor="end" class="mono muted">${r.total}</text>`);
    r.months.forEach((n, m) => {
      if (!n) return;
      const cx = x0 + colW * (m + 0.5);
      const rad = 2.2 + Math.sqrt(n / max) * 7.5;
      const recent = m >= 9;
      parts.push(`<g transform="translate(${round(cx)} ${y})"><circle class="dot" style="animation-delay:${animate ? 150 + m * 45 + i * 20 : 0}ms" r="${round(rad)}" fill="${t.star}" fill-opacity="${recent ? 0.95 : 0.45}"><title>${esc(`${r.label} · ${c.months[m]}: ${n} ${n === 1 ? 'star' : 'stars'}`)}</title></circle></g>`);
    });
  });
  if (!rows.length) parts.push(`<text x="${width / 2}" y="${gridTop + 10}" font-size="12" text-anchor="middle" class="muted">No starred repos in the last 12 months</text>`);

  const axisY = gridTop + rows.length * rowH + 14;
  (c.months || []).forEach((ym, m) => {
    const mi = Number(ym.slice(5, 7)) - 1;
    const label = mi === 0 ? ym.slice(2, 4) : MONTHS[mi];
    parts.push(`<text x="${round(x0 + colW * (m + 0.5))}" y="${axisY}" font-size="9.5" text-anchor="middle" class="mono ${mi === 0 ? '' : 'subtle'}">${label}</text>`);
  });

  const css = s => animate
    ? `${s} .name{opacity:0;animation:pp-up .5s .05s cubic-bezier(.2,.7,.2,1) forwards}${s} .dot{opacity:0;transform-box:fill-box;transform-origin:center;animation:pp-pop .35s cubic-bezier(.3,1.5,.5,1) forwards}` +
      `@keyframes pp-up{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}@keyframes pp-pop{from{opacity:0;transform:scale(.2)}to{opacity:1;transform:scale(1)}}`
    : '';
  return frame({ id, width, height, t, css, animate, title: 'Curiosity', desc: `${c.headline}. ${c.summary}`, body: parts.join('') });
}
