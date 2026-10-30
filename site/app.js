import { renderActivity, RANGES, bucketize } from '../src/core/activity.js';
import { renderProject, renderHeader } from '../src/core/cards.js';
import { computeStats, featuredRepos } from '../src/core/stats.js';
import { THEMES } from '../src/core/tokens.js';
import { GLYPH } from '../src/core/svg.js';
import { renderGallery } from '../src/core/gallery.js';
import { lookupProfile, LookupError } from './live.js';

const REPO = 'in-c0/my-prettier-github-profile-readme';
const RAW = `https://raw.githubusercontent.com/${REPO}/output`;
const $ = (sel, root = document) => root.querySelector(sel);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
};

// `guest` holds a visitor's own profile from "Try yours"; null shows the site owner.
const state = { data: null, config: null, live: false, guest: null, lookup: { status: 'idle', message: '' } };
const subject = () => state.guest
  ? { data: state.guest, config: { username: state.guest.user.login, activity: { labels: 'all' } } }
  : { data: state.data, config: state.config };

async function loadJSON(...urls) {
  for (const url of urls) {
    try { const res = await fetch(url, { cache: 'no-cache' }); if (res.ok) return { json: await res.json(), url }; } catch {}
  }
  return { json: null };
}

/* ---------- theme ---------- */
const siteTheme = () => document.documentElement.dataset.theme
  || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
$('#theme-toggle').addEventListener('click', () => {
  const next = siteTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('pp-theme', next); } catch {}
  render(); // previews re-render, so their entrance animation plays once as feedback
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => render());

/* ---------- shared pieces ---------- */
let uid = 0;
const nextId = p => p + (++uid).toString(36);

function user() {
  const { data, config: c } = subject();
  const u = data?.user || {};
  return { ...u, name: c.name || u.name, bio: c.bio ?? u.bio, avatar: u.avatarUrl || `https://github.com/${u.login || c.username}.png?size=128` };
}
const headerSVG = (theme, opts = {}) => renderHeader(user(), computeStats(subject().data, subject().config?.stats), { theme, id: nextId('h'), ...opts });
const activitySVG = (theme, range = subject().config?.activity?.range || '12m', opts = {}) =>
  renderActivity(subject().data, { theme, range, featured: featuredRepos(subject().config), maxCallouts: subject().config?.activity?.maxCallouts ?? 5, id: nextId('a'), ...opts });
const hasPrivate = () => (subject().data?.events || []).some(e => e.private);
const projectSVG = (p, theme) => renderProject(p, { theme, id: nextId('p') });

function picture(name, alt, link, width) {
  return `<a href="${link}"><picture><source media="(prefers-color-scheme: dark)" srcset="${RAW}/${name}-dark.svg"><img alt="${alt}" src="${RAW}/${name}-light.svg"${width ? ` width="${width}"` : ''}></picture></a>`;
}

function copyButton(getText) {
  const icon = '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="9" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
  const done = '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const btn = h('button', { class: 'icon-btn copy', type: 'button', 'aria-label': 'Copy', html: icon });
  btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(getText()); } catch {}
    btn.innerHTML = done;
    setTimeout(() => { btn.innerHTML = icon; }, 1400);
  });
  return btn;
}

function codeBlock(label, text) {
  return h('div', { class: 'code-block' },
    label ? h('div', { class: 'label' }, label) : null,
    h('div', { class: 'code' }, h('pre', {}, text), copyButton(() => text)));
}

function seg(options, value, onChange, label) {
  const wrap = h('div', { class: 'seg', role: 'group', 'aria-label': label });
  for (const [key, text] of options) {
    wrap.append(h('button', { type: 'button', 'aria-pressed': String(key === value), onclick: () => onChange(key) }, text));
  }
  return wrap;
}

const replayIcon = '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8a5.5 5.5 0 109.6-3.6M12.5 1.5v3h-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/**
 * Preview block with Preview / README / JS tabs.
 * `draw(theme, ctx)` returns the stage content; `controls(ctx, redraw)` optional extra controls.
 */
function previewBlock({ draw, readme, js, controls, onStageClick }) {
  const ctx = { tab: 'preview', theme: siteTheme() };
  const block = h('div', { class: 'block' });
  const bar = h('div', { class: 'block-bar' });
  const body = h('div');
  block.append(bar, body);
  const redraw = () => {
    bar.replaceChildren();
    const tabs = h('div', { class: 'tabs', role: 'tablist' });
    for (const [key, text] of [['preview', 'Preview'], ['readme', 'README'], ['js', 'JavaScript']]) {
      tabs.append(h('button', { class: 'tab', role: 'tab', 'aria-selected': String(ctx.tab === key), onclick: () => { ctx.tab = key; redraw(); } }, text));
    }
    const right = h('div', { class: 'controls' });
    if (ctx.tab === 'preview') {
      if (controls) right.append(...[].concat(controls(ctx, redraw)));
      right.append(seg([['light', 'Light'], ['dark', 'Dark']], ctx.theme, v => { ctx.theme = v; redraw(); }, 'Card theme'));
      right.append(h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Replay animation', title: 'Replay', html: replayIcon, onclick: redraw }));
    }
    bar.append(tabs, right);
    body.replaceChildren();
    if (ctx.tab === 'preview') {
      const stage = h('div', { class: `stage ${ctx.theme}-stage` + (onStageClick ? ' clickable' : '') });
      const content = draw(ctx.theme, ctx, redraw);
      if (typeof content === 'string') stage.innerHTML = content; else stage.append(content);
      if (onStageClick) stage.addEventListener('click', e => { ctx.lastTarget = e.target; if (!e.target.closest('a, input')) onStageClick(ctx, redraw); });
      body.append(stage);
      // On narrow screens the arrow scrolls; start at 'now', where the recent activity is.
      requestAnimationFrame(() => { stage.scrollLeft = stage.scrollWidth; });
    } else {
      const text = ctx.tab === 'readme' ? readme() : js();
      body.append(h('div', { class: 'code' }, h('pre', {}, text), copyButton(() => text)));
    }
  };
  redraw();
  return block;
}

function projectGrid(theme, list = state.config?.projects || []) {
  const grid = h('div', { class: 'grid' });
  for (const p of list) {
    grid.append(h('a', { href: p.url || p.demoUrl || '#', target: '_blank', rel: 'noopener', 'aria-label': p.title, html: projectSVG(p, theme) }));
  }
  return grid;
}

function legend() {
  const t = THEMES[siteTheme()];
  const item = (k, text) => h('span', { html: `<svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true"><g fill="${t[k]}">${k === 'commit' ? '<rect x="-2" y="-5" width="4" height="10" rx="1"/>' : GLYPH[k](4.5)}</g></svg>` }, text);
  return h('div', { class: 'legend' }, item('repo', 'New repo'), item('fork', 'Fork'), item('star', 'Star'), item('commit', 'Commits (bar height)'));
}

/* ---------- pages ---------- */
const pages = {
  intro: () => {
    const username = state.config?.username || 'in-c0';
    const featured = (state.config?.projects || []).slice(0, 3);
    return h('div', { class: 'page' },
      h('section', { class: 'hero' },
        h('span', { class: 'badge' }, h('i'), window.__PP_INLINE?.badge || (state.live ? 'Live data · refreshed daily' : 'Sample data')),
        h('h1', {}, 'A prettier profile README.'),
        h('p', { class: 'lead' }, 'Four components, rendered as SVG and refreshed by a GitHub Action. Paste one block of markdown and they work on github.com.'),
        h('div', { class: 'actions' },
          h('a', { class: 'btn primary', href: '#readme' }, 'Embed in README'),
          h('a', { class: 'btn', href: '#activity' }, 'Browse components'))),
      tryForm(),
      previewBlock({
        draw: theme => {
          const wrap = h('div', { style: 'display:grid;gap:12px;width:100%;max-width:840px' });
          wrap.innerHTML = headerSVG(theme) + `<div class="wide">${activitySVG(theme)}</div>`;
          if (!state.guest) wrap.append(projectGrid(theme, featured));
          return wrap;
        },
        readme: () => readmeSnippet(),
        js: () => jsSnippet('all')
      }));
  },

  'readme': () => h('div', { class: 'page' },
    h('div', { class: 'crumbs' }, 'Getting started'),
    h('h1', {}, 'Embed in README'),
    h('p', { class: 'lead' }, 'GitHub READMEs can’t run JavaScript, so a daily Action renders each component to SVG and publishes it to an output branch.'),
    h('ol', { class: 'steps' },
      h('li', {}, h('h3', {}, 'Add the workflow'),
        h('p', { class: 'prose' }, 'In any repository you own (this one, a fork, or your ', h('code', {}, 'username/username'), ' repo):'),
        codeBlock('.github/workflows/profile-cards.yml', workflowSnippet())),
      h('li', {}, h('h3', {}, 'Describe your profile'),
        h('p', { class: 'prose' }, 'Projects, header counters and what the activity arrow labels. See ', h('a', { href: '#config', style: 'text-decoration:underline' }, 'Configuration'), '.'),
        codeBlock('profile.config.json', configSnippet())),
      h('li', {}, h('h3', {}, 'Paste into your profile README'),
        h('p', { class: 'prose' }, 'Each card follows GitHub’s light or dark theme and links where you point it.'),
        codeBlock('README.md', readmeSnippet())))),

  'config': () => h('div', { class: 'page' },
    h('div', { class: 'crumbs' }, 'Getting started'),
    h('h1', {}, 'Configuration'),
    h('p', { class: 'lead' }, 'One JSON file next to the workflow. Everything is optional except the username.'),
    optionsTable([
      ['username', 'string', 'GitHub login to read public data from.'],
      ['name, bio', 'string', 'Override the name and one-liner in the header.'],
      ['site', 'url', 'Where the header card links to.'],
      ['stats', 'string[]', 'Header counters: repos, followers, commits, stars, forks, new.'],
      ['activity.range', '"30d" | "3m" | "12m" | "all"', 'Time span of the README arrow. Default 12m.'],
      ['activity.extraRanges', 'string[]', 'Also render other spans, e.g. ["3m", "all"] → activity-3m-light.svg.'],
      ['activity.private', 'boolean', 'Include private commits and repos as counts, never names. Needs a personal access token in the PROFILE_TOKEN secret.'],
      ['activity.labels', '"featured" | "all" | "none"', 'Which new repos get a name label. Featured = repos in projects. Forks are always labelled unless "none".'],
      ['activity.maxCallouts', 'number', 'Maximum labels on the arrow. Default 5.'],
      ['projects[]', 'object[]', 'id, title, summary, url, tag, repo, image (path or https URL).'],
      ['collected[]', 'object[]', 'id, title, summary, image (still), url (original), video.']
    ])),

  'header': () => componentPage({
    title: 'Profile header',
    lead: 'Avatar, name, one line and three counters. 840 × 112.',
    block: previewBlock({ draw: theme => headerSVG(theme), readme: () => picture('header', state.config?.name || 'Profile', state.config?.site || '#', '100%'), js: () => jsSnippet('header') }),
    options: [
      ['user', '{ login, name, bio, avatar }', 'avatar may be a URL (web) or data URI (README build).'],
      ['stats', '{ label, value }[]', 'Rendered right-aligned. Use computeStats(data, keys).'],
      ['theme', '"light" | "dark"', 'Default light.'],
      ['animate', 'boolean', 'Counters fade in once. Default true.']
    ]
  }),

  'project': () => componentPage({
    title: 'Project card',
    lead: 'Screenshot or typographic cover, title, two lines, domain. 272 × 220, three per row.',
    block: previewBlock({
      draw: theme => projectGrid(theme),
      readme: () => '<p>\n' + (state.config?.projects || []).map(p => picture(`project-${p.id}`, p.title, p.url, '32%')).join('\n') + '\n</p>',
      js: () => jsSnippet('project')
    }),
    options: [
      ['title, summary', 'string', 'Summary wraps to two lines.'],
      ['url', 'url', 'Shown as the domain; the README link target.'],
      ['image', 'path | url', 'Optional. Without it the card gets a dotted cover with the domain.'],
      ['tag', 'string', 'Small label beside the title.'],
      ['repo', 'owner/name', 'Also marks the repo as featured on the activity arrow.']
    ]
  }),

  'activity': () => {
    const st = { range: subject().config?.activity?.range || '12m', end: null, includePrivate: true };
    return componentPage({
      title: 'Activity arrow',
      lead: 'New repos, forks and stars stack above one arrow; commits hang below it. Drag the chart to look further back.',
      extra: legend(),
      block: activityBlock(st),
      options: [
        ['data.events', '{ type, date, repo, count?, private? }[]', 'type is repo, fork, star or commit. count is commits on that day.'],
        ['range', '"30d" | "3m" | "12m" | "all"', 'Daily, daily, weekly or monthly buckets.'],
        ['end', 'date', 'Slides the window back in time; the arrow tip shows that date instead of "now".'],
        ['includePrivate', 'boolean', 'Private events (counts only, no names) are drawn as lighter bars. Default true.'],
        ['featured', 'string[]', 'Repos whose creation gets a name label.'],
        ['label', '(event) => string | null', 'Custom labelling; overrides featured.'],
        ['maxCallouts', 'number', 'Default 5. Labels never overlap; extras are dropped.']
      ]
    });
  },

  collected: () => componentPage({
    title: 'Collected',
    lead: 'A gallery of references. Masonry columns that end on one edge, captions underneath, a play mark on video stills.',
    block: previewBlock({
      draw: theme => galleryStage(theme),
      readme: () => picture('collected', 'Collected references', state.config?.site || '#', '100%'),
      js: () => jsSnippet('gallery')
    }),
    options: [
      ['items[]', '{ title, src, width, height, video? }', 'width/height set the tile shape; the build reads them from the image.'],
      ['columns', 'number', 'Default 4 (2 below 600px wide).'],
      ['limit', 'number', 'Default 24.'],
      ['collected[] (config)', '{ id, title, summary, image, url, video? }', 'image is the still; url opens the original video or image on the website.']
    ]
  })
};

/* ---------- activity: ranges, sliding window, private toggle ---------- */
const STEP_DAYS = { day: 1, week: 7 };
function activityBlock(st) {
  const order = Object.keys(RANGES);
  let drawn = null; // { stage, theme }
  const span = () => {
    const m = bucketize(subject().data?.events, { range: st.range, now: subject().data?.generatedAt, end: st.end, includePrivate: st.includePrivate });
    const step = STEP_DAYS[m.grain] || 0;
    const back = step ? Math.max(0, Math.floor((utcToday() - m.first) / 864e5 / step) - m.buckets.length + 1) : 0;
    const offset = step && st.end ? Math.round((utcToday() - m.today) / 864e5 / step) : 0;
    return { m, step, back, offset };
  };
  const svgFor = (theme, animate = true) => activitySVG(theme, st.range, { end: st.end, includePrivate: st.includePrivate, animate });
  const setOffset = steps => {
    const { step, back } = span();
    const k = Math.max(0, Math.min(back, Math.round(steps)));
    st.end = k ? new Date(utcToday() - k * step * 864e5).toISOString().slice(0, 10) : null;
    return k;
  };
  return previewBlock({
    draw: (theme, ctx, redraw) => {
      const wrap = h('div', { style: 'width:100%;display:grid;gap:14px;justify-items:center' });
      const chart = h('div', { class: 'wide', style: 'width:100%;max-width:840px;touch-action:pan-y', html: svgFor(theme) });
      wrap.append(chart);
      const { back, offset } = span();
      if (back > 0) {
        const slider = h('input', { type: 'range', id: 'activity-window', class: 'window-slider', min: '0', max: String(back), step: '1', value: String(back - offset), 'aria-label': 'Move the time window' });
        slider.addEventListener('input', () => { setOffset(back - Number(slider.value)); chart.innerHTML = svgFor(theme, false); });
        wrap.append(slider);
        // Drag on the chart slides the window; a click without movement advances the range.
        let start = null;
        chart.addEventListener('pointerdown', e => { start = { x: e.clientX, offset: span().offset, moved: false, id: e.pointerId }; });
        chart.addEventListener('pointermove', e => {
          if (!start || e.pointerId !== start.id) return;
          const dx = e.clientX - start.x;
          if (Math.abs(dx) > 4 && !start.moved) { start.moved = true; chart.setPointerCapture(e.pointerId); chart.style.cursor = 'grabbing'; }
          if (!start.moved) return;
          const svg = chart.querySelector('svg');
          const bucketPx = svg.getBoundingClientRect().width * ((840 - 64) / 840) / span().m.buckets.length;
          const k = setOffset(start.offset + dx / bucketPx);
          slider.value = String(back - k);
          chart.innerHTML = svgFor(theme, false);
        });
        const end = () => { if (start?.moved) ctx.dragged = true; start = null; chart.style.cursor = ''; };
        chart.addEventListener('pointerup', end);
        chart.addEventListener('pointercancel', end);
      }
      return wrap;
    },
    controls: (ctx, redraw) => {
      const priv = hasPrivate();
      const p = seg([['on', 'Private on'], ['off', 'Off']], st.includePrivate ? 'on' : 'off', v => { st.includePrivate = v === 'on'; redraw(); }, 'Private activity');
      if (!priv) { p.setAttribute('title', 'This profile’s data has no private activity'); p.querySelectorAll('button').forEach(b => { b.disabled = true; }); }
      return [
        seg(order.map(k => [k, k === 'all' ? 'All' : k]), st.range, v => { st.range = v; st.end = null; redraw(); }, 'Range'),
        p
      ];
    },
    onStageClick: (ctx, redraw) => {
      if (ctx.dragged) { ctx.dragged = false; return; }
      if (ctx.lastTarget?.closest?.('input')) return;
      st.range = order[(order.indexOf(st.range) + 1) % order.length]; st.end = null; redraw();
    },
    readme: () => picture('activity', 'GitHub activity timeline', `https://github.com/${subject().config?.username || 'in-c0'}`, '100%'),
    js: () => jsSnippet('activity')
  });
}
const utcToday = () => { const d = new Date(subject().data?.generatedAt || Date.now()); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };

/* ---------- try your own username ---------- */
function tryForm() {
  const input = h('input', { id: 'try-username', type: 'text', placeholder: 'username', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', value: state.guest?.user.login || '', 'aria-label': 'GitHub username' });
  const button = h('button', { class: 'btn', type: 'submit', disabled: state.lookup.status === 'loading' }, state.lookup.status === 'loading' ? 'Loading…' : 'Preview');
  const status = h('p', { class: 'try-status' + (state.lookup.status === 'error' ? ' error' : ''), 'aria-live': 'polite' }, state.lookup.message);
  if (state.guest && state.lookup.status !== 'loading') {
    status.replaceChildren(`Showing @${state.guest.user.login}. Commits come from the ${state.guest.partialCommits} most recently pushed repos. `,
      h('a', { href: '#intro', onclick: e => { e.preventDefault(); state.guest = null; state.lookup = { status: 'idle', message: '' }; render(); } }, `Back to @${state.config?.username || 'in-c0'}`));
  }
  const form = h('form', { class: 'try', onsubmit: async e => {
    e.preventDefault();
    if (!input.value.trim()) { input.focus(); return; }
    state.lookup = { status: 'loading', message: 'Reading public activity from GitHub…' };
    render();
    try {
      state.guest = await lookupProfile(input.value, { onProgress: m => { state.lookup.message = m + '…'; const el = $('.try-status'); if (el) el.textContent = state.lookup.message; } });
      state.lookup = { status: 'done', message: '' };
    } catch (err) {
      state.lookup = { status: 'error', message: err instanceof LookupError ? err.message : 'GitHub couldn’t be reached from this page. On the published site this works without signing in.' };
    }
    render();
  } },
    h('label', { class: 'try-field', for: 'try-username' }, h('span', {}, 'github.com/'), input),
    button);
  return h('div', { class: 'try-wrap' }, h('p', { class: 'try-title' }, 'Put your GitHub @ to see your activity'), form, status);
}

/* ---------- gallery ---------- */
const sizes = new Map();
function measure(src) {
  if (sizes.has(src)) return Promise.resolve(sizes.get(src));
  return new Promise(res => {
    const img = new Image();
    img.onload = () => { const s = { width: img.naturalWidth, height: img.naturalHeight }; sizes.set(src, s); res(s); };
    img.onerror = () => { sizes.set(src, null); res(null); };
    img.src = src;
  });
}
function galleryItems() {
  return (state.config?.collected || []).map(c => ({ ...c, src: c.image, ...(sizes.get(c.image) || {}) }));
}
function galleryStage(theme) {
  const wrap = h('div', { class: 'wide gallery-wrap', style: 'width:100%;max-width:840px' });
  const paint = () => {
    wrap.innerHTML = renderGallery(galleryItems(), { theme, id: nextId('g') });
    wrap.querySelectorAll('.tile').forEach(tile => {
      tile.setAttribute('tabindex', '0'); tile.setAttribute('role', 'button');
      const open = () => openLightbox(galleryItems()[Number(tile.dataset.i)]);
      tile.addEventListener('click', e => { e.stopPropagation(); open(); });
      tile.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  };
  const missing = (state.config?.collected || []).filter(c => c.image && !sizes.has(c.image));
  if (missing.length) Promise.all(missing.map(c => measure(c.image))).then(paint);
  paint();
  return wrap;
}
function openLightbox(item) {
  if (!item) return;
  const dialog = h('dialog', { class: 'lightbox', 'aria-label': item.title });
  const close = () => { dialog.close(); dialog.remove(); };
  const media = item.video
    ? h('video', { src: item.url, poster: item.image, controls: true, autoplay: true, muted: true, playsinline: true, loop: true })
    : h('img', { src: item.url || item.image, alt: item.title });
  media.addEventListener('error', () => media.replaceWith(h('img', { src: item.image, alt: item.title })), { once: true });
  dialog.append(
    h('button', { class: 'icon-btn lightbox-close', type: 'button', 'aria-label': 'Close', onclick: close, html: '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' }),
    h('div', { class: 'lightbox-media' }, media),
    h('div', { class: 'lightbox-text' }, h('strong', {}, item.title), h('span', {}, item.summary || ''),
      item.url ? h('a', { href: item.url, target: '_blank', rel: 'noopener' }, 'Open original ↗') : null));
  dialog.addEventListener('click', e => { if (e.target === dialog) close(); });
  dialog.addEventListener('cancel', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}

function componentPage({ title, lead, block, options, extra }) {
  return h('div', { class: 'page' },
    h('div', { class: 'crumbs' }, 'Components'),
    h('h1', {}, title),
    h('p', { class: 'lead' }, lead),
    extra || null,
    block,
    h('h2', {}, 'Options'),
    optionsTable(options));
}

function optionsTable(rows) {
  return h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Type'), h('th', {}, 'Description'))),
    h('tbody', {}, rows.map(([a, b, c]) => h('tr', {}, h('td', {}, h('code', {}, a)), h('td', {}, b ? h('code', {}, b) : ''), h('td', {}, c)))));
}

/* ---------- snippets ---------- */
function readmeSnippet() {
  const c = state.config || {};
  return [
    picture('header', c.name || 'Profile', c.site || '#', '100%'), '',
    picture('activity', 'GitHub activity timeline', `https://github.com/${c.username || 'in-c0'}`, '100%'), '',
    '<p>', ...(c.projects || []).map(p => picture(`project-${p.id}`, p.title, p.url, '32%')), '</p>',
    ...(c.collected?.length ? ['', picture('collected', 'Collected references', c.site || '#', '100%')] : [])
  ].join('\n');
}
function workflowSnippet() {
  return `name: Profile cards
on:
  schedule: [{ cron: '23 19 * * *' }]
  workflow_dispatch:
permissions:
  contents: write
jobs:
  cards:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ${REPO}@main
        with:
          config: profile.config.json
          out: dist
      - name: Publish to the output branch
        run: |
          cd dist && git init -q -b output
          git config user.name github-actions[bot]
          git config user.email 41898282+github-actions[bot]@users.noreply.github.com
          git add -A && git commit -qm "Update profile cards"
          git push -f "https://x-access-token:\${{ github.token }}@github.com/\${{ github.repository }}.git" output`;
}
function configSnippet() {
  const c = state.config || {};
  return JSON.stringify({
    username: c.username || 'your-username',
    site: c.site || 'https://example.com',
    stats: ['repos', 'commits', 'stars'],
    activity: { range: '12m', labels: 'featured' },
    projects: (c.projects || []).slice(0, 1)
  }, null, 2);
}
function jsSnippet(kind) {
  const base = 'https://cdn.jsdelivr.net/gh/' + REPO + '@main/src/core';
  const lines = {
    header: `import { renderHeader } from '${base}/cards.js';\nimport { computeStats } from '${base}/stats.js';\n\nel.innerHTML = renderHeader(data.user, computeStats(data), { theme: 'dark' });`,
    project: `import { renderProject } from '${base}/cards.js';\n\nel.innerHTML = renderProject({\n  title: 'Paper UI',\n  summary: 'Expressive, reusable interface components.',\n  url: 'https://github.com/in-c0/paper-ui',\n  image: '/paper-ui.jpg'\n});`,
    gallery: `import { renderGallery } from '${base}/gallery.js';\n\nel.innerHTML = renderGallery([\n  { title: 'Electric traces', src: '/traces.jpg', width: 392, height: 203, video: true },\n  …\n], { columns: 4 });`,
    activity: `import { renderActivity } from '${base}/activity.js';\n\n// data = { events: [{ type: 'star', date: '2026-10-27', repo: 'owner/name' }, …] }\nel.innerHTML = renderActivity(data, { range: '12m', end: '2025-06-30', includePrivate: false });`
  };
  return kind === 'all' ? [lines.header, lines.activity].join('\n\n') : lines[kind];
}

/* ---------- router ---------- */
function render() {
  uid = 0;
  const path = location.hash.replace(/^#\/?/, '').split('/').pop() || 'intro';
  const page = pages[path] || pages.intro;
  for (const a of document.querySelectorAll('.sidebar a')) {
    if (a.getAttribute('href') === '#' + (pages[path] ? path : 'intro')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  $('#page').replaceChildren(state.data ? page() : h('p', { class: 'lead' }, 'Loading…'));
}
addEventListener('hashchange', () => { document.querySelectorAll('dialog.lightbox').forEach(d => d.remove()); render(); scrollTo(0, 0); });

// A bundled single-file build can inline its data instead of fetching it.
const inline = window.__PP_INLINE;
const [data, config] = inline
  ? [{ json: inline.data, url: inline.live ? 'data/activity.json' : '' }, { json: inline.config }]
  : await Promise.all([loadJSON('data/activity.json', 'data/sample-activity.json'), loadJSON('profile.config.json')]);
state.data = data.json || { user: {}, events: [] };
state.live = data.url === 'data/activity.json';
state.config = config.json || { username: state.data.user?.login };
render();
