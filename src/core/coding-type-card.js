// Coding type card: the archetype on the left, the evidence on the right
// (a 24-hour clock of commit times, a weekday strip and the language mix).
import { theme } from './tokens.js';
import { esc, round, textWidth, wrap, frame } from './svg.js';

const LANG_COLORS = {
  TypeScript: '#3178c6', JavaScript: '#e3c03a', Python: '#8fb8e8', 'C#': '#178600', 'C++': '#f34b7d', C: '#555555',
  Rust: '#dea584', Go: '#00add8', Swift: '#f05138', Kotlin: '#a97bff', Java: '#b07219', HTML: '#e34c26', CSS: '#663399',
  Shell: '#89e051', 'Jupyter Notebook': '#da5b0b', Svelte: '#ff3e00', Vue: '#41b883', Ruby: '#701516', Dart: '#00b4ab'
};
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function renderCodingType(p, opts = {}) {
  const t = theme(opts.theme);
  const width = opts.width || 840, height = opts.height || 232, P = 24;
  const animate = opts.animate !== false;
  const id = opts.id || 'ct' + (opts.theme === 'dark' ? 'd' : 'l');
  const accent = t.commit;
  const parts = [];

  // Left: name, evidence line, trait chips.
  const leftW = 410;
  parts.push(`<text x="${P}" y="40" font-size="12" class="muted">Coding type</text>`);
  parts.push(`<text class="name" x="${P}" y="76" font-size="28" font-weight="650" letter-spacing="-0.5">${esc(p.name || 'Builder')}</text>`);
  wrap(p.summary, 12.5, leftW - P, 2).forEach((line, i) => {
    parts.push(`<text x="${P}" y="${104 + i * 18}" font-size="12.5" class="muted">${esc(line)}</text>`);
  });
  let cx = P;
  const chipY = 152;
  for (const trait of p.traits || []) {
    const label = trait.key === 'lang' ? trait.label : `${trait.label} · ${trait.detail}`;
    const w = textWidth(label, 11, true) + 20;
    if (cx + w > leftW + P) break;
    parts.push(`<g class="chip"><rect x="${cx}" y="${chipY}" width="${round(w)}" height="24" rx="12" fill="${t.surface}" stroke="${t.border}"/>` +
      `<text x="${cx + 10}" y="${chipY + 16}" font-size="11" class="mono">${esc(label)}</text></g>`);
    cx += w + 6;
  }
  const basis = [`${p.total.toLocaleString('en-US')} commits in 12 months`];
  if (p.sample) basis.push(`hours from ${p.sample.toLocaleString('en-US')} commits`);
  basis.push(p.timezone);
  parts.push(`<text x="${P}" y="${height - 22}" font-size="10" class="mono subtle">${esc(basis.join(' · '))}</text>`);

  // Right: 24h clock.
  const ox = 520, oy = 118, r0 = 30, r1 = 82;
  parts.push(`<circle cx="${ox}" cy="${oy}" r="${r1 + 6}" fill="none" stroke="${t.hairline}"/>`);
  parts.push(`<circle cx="${ox}" cy="${oy}" r="${r0 - 4}" fill="none" stroke="${t.hairline}"/>`);
  for (const h of [0, 6, 12, 18]) {
    const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
    parts.push(`<text x="${round(ox + Math.cos(a) * (r1 + 16))}" y="${round(oy + Math.sin(a) * (r1 + 16) + 3.5)}" font-size="9.5" text-anchor="middle" class="mono subtle">${String(h).padStart(2, '0')}</text>`);
  }
  if (p.hours) {
    const max = Math.max(1, ...p.hours);
    const inWindow = h => p.time && p.time.range && ((h >= p.time.range[0] && h < p.time.range[1]) || (h + 24 >= p.time.range[0] && h + 24 < p.time.range[1]));
    p.hours.forEach((v, h) => {
      const a = ((h + 0.5) / 24) * Math.PI * 2 - Math.PI / 2;
      const len = v ? 4 + Math.sqrt(v / max) * (r1 - r0 - 4) : 0;
      if (!len) return;
      const x0 = ox + Math.cos(a) * r0, y0 = oy + Math.sin(a) * r0;
      const x1 = ox + Math.cos(a) * (r0 + len), y1 = oy + Math.sin(a) * (r0 + len);
      parts.push(`<line class="ray" style="animation-delay:${animate ? 200 + h * 30 : 0}ms" x1="${round(x0)}" y1="${round(y0)}" x2="${round(x1)}" y2="${round(y1)}" stroke="${accent}" stroke-opacity="${inWindow(h) ? 1 : 0.38}" stroke-width="7" stroke-linecap="round"/>`);
    });
    const peak = p.hours.indexOf(max);
    parts.push(`<text x="${ox}" y="${oy + 2}" font-size="14" font-weight="600" text-anchor="middle">${String(peak).padStart(2, '0')}h</text>`);
    parts.push(`<text x="${ox}" y="${oy + 15}" font-size="9" text-anchor="middle" class="mono subtle">peak</text>`);
  } else {
    parts.push(`<text x="${ox}" y="${oy + 4}" font-size="10" text-anchor="middle" class="mono subtle">no hour data</text>`);
  }

  // Right: weekday strip and language mix.
  const bx = 640, bw = 176;
  parts.push(`<text x="${bx}" y="40" font-size="11" class="muted">Week</text>`);
  const wmax = Math.max(1, ...p.weekdays);
  const colW = bw / 7;
  p.weekdays.forEach((v, i) => {
    const hgt = v ? 4 + (v / wmax) * 52 : 2;
    const x = bx + i * colW + colW * 0.2;
    parts.push(`<rect class="bar" style="animation-delay:${animate ? 300 + i * 50 : 0}ms" x="${round(x)}" y="${round(108 - hgt)}" width="${round(colW * 0.6)}" height="${round(hgt)}" rx="2" fill="${i >= 5 ? t.fork : accent}" fill-opacity="${v ? 0.9 : 0.25}"/>`);
    parts.push(`<text x="${round(bx + i * colW + colW / 2)}" y="122" font-size="9.5" text-anchor="middle" class="mono subtle">${DAYS[i]}</text>`);
  });
  const langs = p.languages || [];
  if (langs.length) {
    parts.push(`<text x="${bx}" y="150" font-size="11" class="muted">Languages</text>`);
    const sum = langs.reduce((n, l) => n + l.commits, 0) || 1;
    let x = bx;
    parts.push(`<clipPath id="${id}-lb"><rect x="${bx}" y="158" width="${bw}" height="8" rx="4"/></clipPath><g clip-path="url(#${id}-lb)">`);
    for (const l of langs) {
      const w = (l.commits / sum) * bw;
      parts.push(`<rect x="${round(x)}" y="158" width="${round(w + 0.5)}" height="8" fill="${LANG_COLORS[l.name] || t.subtle}"/>`);
      x += w;
    }
    parts.push(`</g>`);
    let ly = 184, lx = bx;
    for (const l of langs.slice(0, 4)) {
      const label = `${l.name} ${Math.round((l.commits / sum) * 100)}%`;
      const w = textWidth(label, 10, true) + 16;
      if (lx + w > bx + bw + 8) { lx = bx; ly += 15; if (ly > height - 14) break; }
      parts.push(`<circle cx="${lx + 4}" cy="${ly - 3.5}" r="3.5" fill="${LANG_COLORS[l.name] || t.subtle}"/><text x="${lx + 11}" y="${ly}" font-size="10" class="mono muted">${esc(label)}</text>`);
      lx += w;
    }
  }

  const css = s => animate
    ? `${s} .name{opacity:0;animation:pp-up .5s .05s cubic-bezier(.2,.7,.2,1) forwards}${s} .chip{opacity:0;animation:pp-up .4s .35s ease-out forwards}` +
      `${s} .ray{opacity:0;animation:pp-fade .4s ease-out forwards}${s} .bar{transform-box:fill-box;transform-origin:bottom;transform:scaleY(0);animation:pp-grow .45s ease-out forwards}` +
      `@keyframes pp-up{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}@keyframes pp-fade{to{opacity:1}}@keyframes pp-grow{to{transform:scaleY(1)}}`
    : '';
  return frame({ id, width, height, t, css, animate, title: `Coding type: ${p.name}`, desc: p.summary, body: parts.join('') });
}
