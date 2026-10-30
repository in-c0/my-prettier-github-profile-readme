// Small, dependency-free helpers for writing SVG strings that render the same in a
// browser and inside GitHub's image proxy.
import { FONT_SANS, FONT_MONO } from './tokens.js';

export const esc = value => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const round = n => Math.round(n * 10) / 10;

// Approximate advance widths. System fonts differ slightly per OS, so layout keeps slack.
const NARROW = /[ilj.,:;'|!()\[\]1 ]/;
const WIDE = /[mwMW@%]/;
export function textWidth(text, size, mono = false) {
  if (mono) return String(text).length * size * 0.6;
  let w = 0;
  for (const ch of String(text)) {
    if (NARROW.test(ch)) w += 0.32;
    else if (WIDE.test(ch)) w += 0.86;
    else if (ch >= 'A' && ch <= 'Z') w += 0.66;
    else if (ch.charCodeAt(0) > 0x2e80) w += 1;
    else w += 0.55;
  }
  return w * size;
}

export function truncate(text, size, max, mono = false) {
  text = String(text ?? '');
  if (textWidth(text, size, mono) <= max) return text;
  let out = text;
  while (out.length > 1 && textWidth(out + '…', size, mono) > max) out = out.slice(0, -1);
  return out.trimEnd() + '…';
}

export function wrap(text, size, max, lines = 2) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const out = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const next = line ? line + ' ' + words[i] : words[i];
    if (textWidth(next, size) <= max) { line = next; continue; }
    if (out.length === lines - 1) { out.push(truncate(next + ' ' + words.slice(i + 1).join(' '), size, max)); return out; }
    if (line) out.push(line);
    line = words[i];
  }
  if (line) out.push(line);
  return out.slice(0, lines);
}

// Inline SVGs share the page's stylesheet, so every rule is scoped to the SVG's own id.
export function baseStyle(t, id) {
  return `#${id} text{font-family:${FONT_SANS};fill:${t.fg};font-variant-numeric:tabular-nums}#${id} .mono{font-family:${FONT_MONO}}#${id} .muted{fill:${t.muted}}#${id} .subtle{fill:${t.subtle}}`;
}

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

// Motion runs once on load. Reduced-motion users get the final frame immediately.
const reduced = id => `@media (prefers-reduced-motion:reduce){#${id} *{animation:none!important;opacity:1!important;stroke-dashoffset:0!important;transform:none!important}}`;

// `css` is a function of the scope selector so component rules never leak between cards.
export function frame({ width, height, title, desc, t, css = () => '', body, animate = true, border = true, id }) {
  id = id || 'pp' + hash(title + desc + body.length + t.bg);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" id="${id}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-t ${id}-d">` +
    `<title id="${id}-t">${esc(title)}</title><desc id="${id}-d">${esc(desc)}</desc>` +
    `<style>${baseStyle(t, id)}${css('#' + id)}${animate ? reduced(id) : ''}</style>` +
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="${t.bg}"${border ? ` stroke="${t.border}"` : ''}/>` +
    body + '</svg>';
}

// Glyphs are drawn centred on (0,0) and positioned with a translate.
export const GLYPH = {
  star: r => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      pts.push(round(Math.cos(a) * rr) + ',' + round(Math.sin(a) * rr));
    }
    return `<polygon points="${pts.join(' ')}"/>`;
  },
  fork: r => `<path d="M0 ${-r}L${r} 0L0 ${r}L${-r} 0Z"/>`,
  repo: r => `<rect x="${-r * 0.82}" y="${-r * 0.82}" width="${r * 1.64}" height="${r * 1.64}" rx="1.5"/>`,
  commit: r => `<circle r="${r * 0.8}"/>`
};
