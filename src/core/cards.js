// Profile header and project card renderers.
import { theme } from './tokens.js';
import { esc, round, textWidth, truncate, wrap, frame } from './svg.js';

const domainOf = url => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
};
const compact = n => n >= 1e4 ? (n / 1e3).toFixed(0) + 'k' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n);

// Project card. `image` may be an https URL (website) or a data: URI (README build).
export function renderProject(p, opts = {}) {
  const t = theme(opts.theme);
  const width = opts.width || 272, height = opts.height || 220, P = 16, mediaH = 120;
  const animate = opts.animate !== false;
  const href = p.url || p.demoUrl || '';
  const domain = domainOf(href) || (p.repo ? 'github.com/' + p.repo : '');
  const pill = truncate(domain, 12, width - 64, true);
  const id = opts.id || 'pj' + String(p.id || p.title).replace(/[^a-z0-9]/gi, '').toLowerCase() + (opts.theme === 'dark' ? 'd' : 'l');
  const parts = [];
  parts.push(`<clipPath id="${id}-c"><path d="M1 ${mediaH}V11a10 10 0 0 1 10-10h${width - 22}a10 10 0 0 1 10 10V${mediaH}Z"/></clipPath>`);
  if (p.image) {
    parts.push(`<g clip-path="url(#${id}-c)"><rect width="${width}" height="${mediaH}" fill="${t.surface}"/>` +
      `<image class="media" href="${esc(p.image)}" x="0" y="0" width="${width}" height="${mediaH}" preserveAspectRatio="xMidYMin slice"/></g>`);
  } else {
    // Typographic cover: dotted field + the domain, so text-only projects never look empty.
    const dots = [];
    for (let y = 12; y < mediaH; y += 12) for (let x = 12; x < width; x += 12) dots.push(`M${x} ${y}h.01`);
    parts.push(`<g clip-path="url(#${id}-c)"><rect width="${width}" height="${mediaH}" fill="${t.surface}"/>` +
      `<path d="${dots.join('')}" stroke="${t.border}" stroke-width="1.6" stroke-linecap="round"/>` +
      `<rect x="${round(width / 2 - textWidth(pill, 12, true) / 2 - 12)}" y="${mediaH / 2 - 13}" width="${round(textWidth(pill, 12, true) + 24)}" height="26" rx="13" fill="${t.bg}" stroke="${t.border}"/>` +
      `<text x="${width / 2}" y="${mediaH / 2 + 4}" font-size="12" text-anchor="middle" class="mono muted">${esc(pill)}</text></g>`);
  }
  parts.push(`<line x1="1" y1="${mediaH + 0.5}" x2="${width - 1}" y2="${mediaH + 0.5}" stroke="${t.hairline}"/>`);
  const tag = p.tag ? truncate(p.tag, 10, 90, true) : '';
  const titleMax = width - P * 2 - (tag ? textWidth(tag, 10, true) + 12 : 0);
  parts.push(`<text x="${P}" y="${mediaH + 26}" font-size="14" font-weight="600">${esc(truncate(p.title, 14, titleMax))}</text>`);
  if (tag) parts.push(`<text x="${width - P}" y="${mediaH + 25}" font-size="10" text-anchor="end" class="mono subtle">${esc(tag.toUpperCase())}</text>`);
  wrap(p.summary, 12, width - P * 2, 2).forEach((line, i) => {
    parts.push(`<text x="${P}" y="${mediaH + 46 + i * 17}" font-size="12" class="muted">${esc(line)}</text>`);
  });
  parts.push(`<text x="${P}" y="${height - 14}" font-size="10.5" class="mono subtle">${esc(truncate(domain, 10.5, width - P * 2 - 14, true))}</text>`);
  parts.push(`<path d="M${width - P - 7} ${height - 21}h7v7M${width - P} ${height - 21}l-7.5 7.5" stroke="${t.subtle}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`);
  const css = s => animate
    ? `${s} .media{opacity:0;animation:pp-in .6s .1s ease-out forwards}@keyframes pp-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`
    : '';
  return frame({ id, width, height, t, css, animate, title: p.title, desc: p.summary || domain, body: parts.join('') });
}

// Profile header: avatar, name, one line, and three counters.
export function renderHeader(user, stats = [], opts = {}) {
  const t = theme(opts.theme);
  const width = opts.width || 840, height = opts.height || 112, P = 24, A = 64;
  const animate = opts.animate !== false;
  const id = opts.id || 'hd' + String(user.login || '').replace(/[^a-z0-9]/gi, '') + (opts.theme === 'dark' ? 'd' : 'l');
  const parts = [];
  const ay = (height - A) / 2;
  parts.push(`<clipPath id="${id}-a"><circle cx="${P + A / 2}" cy="${ay + A / 2}" r="${A / 2}"/></clipPath>`);
  parts.push(`<circle cx="${P + A / 2}" cy="${ay + A / 2}" r="${A / 2}" fill="${t.surface}"/>`);
  if (user.avatar) parts.push(`<image href="${esc(user.avatar)}" x="${P}" y="${ay}" width="${A}" height="${A}" clip-path="url(#${id}-a)"/>`);
  else parts.push(`<text x="${P + A / 2}" y="${ay + A / 2 + 9}" font-size="26" font-weight="600" text-anchor="middle" class="muted">${esc((user.name || user.login || '?')[0].toUpperCase())}</text>`);
  parts.push(`<circle cx="${P + A / 2}" cy="${ay + A / 2}" r="${A / 2 - 0.5}" fill="none" stroke="${t.border}"/>`);

  // Counters are right-aligned; the text block gets whatever room is left.
  let x = width - P;
  const statParts = [];
  for (const s of [...stats].reverse()) {
    const value = compact(s.value), w = Math.max(textWidth(value, 22), textWidth(s.label, 11)) ;
    statParts.push(`<g class="stat"><text x="${round(x)}" y="${height / 2 + 2}" font-size="22" font-weight="600" text-anchor="end">${esc(value)}</text>` +
      `<text x="${round(x)}" y="${height / 2 + 20}" font-size="11" text-anchor="end" class="muted">${esc(s.label)}</text></g>`);
    x -= w + 28;
  }
  const tx = P + A + 18, maxText = x - tx - 12;
  const bioLines = wrap(user.bio || '', 13, maxText, 2);
  const nameY = bioLines.length > 1 ? height / 2 - 14 : height / 2 - 6;
  parts.push(`<text x="${tx}" y="${nameY}" font-size="20" font-weight="600">${esc(truncate(user.name || user.login, 20, maxText - 90))}` +
    (user.name ? `<tspan dx="8" font-size="13" font-weight="400" class="mono subtle">@${esc(user.login)}</tspan>` : '') + `</text>`);
  const line = user.bio || '';
  bioLines.forEach((l, i) => parts.push(`<text x="${tx}" y="${nameY + 22 + i * 18}" font-size="13" class="muted">${esc(l)}</text>`));
  parts.push(statParts.join(''));
  const css = s => animate ? `${s} .stat{opacity:0;animation:pp-fade .5s .2s ease-out forwards}@keyframes pp-fade{to{opacity:1}}` : '';
  return frame({ id, width, height, t, css, animate, title: user.name || user.login, desc: line, body: parts.join('') });
}
