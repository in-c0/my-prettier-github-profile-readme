import { renderActivity, RANGES } from '../src/core/activity.js';
import { renderProject, renderHeader } from '../src/core/cards.js';
import { computeStats, featuredRepos } from '../src/core/stats.js';
import { THEMES } from '../src/core/tokens.js';
import { GLYPH } from '../src/core/svg.js';

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

const state = { data: null, config: null, live: false };

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
  const u = state.data?.user || {};
  const c = state.config || {};
  return { ...u, name: c.name || u.name, bio: c.bio ?? u.bio, avatar: u.avatarUrl || `https://github.com/${u.login || c.username}.png?size=128` };
}
const headerSVG = (theme, opts = {}) => renderHeader(user(), computeStats(state.data, state.config?.stats), { theme, id: nextId('h'), ...opts });
const activitySVG = (theme, range = state.config?.activity?.range || '12m', opts = {}) =>
  renderActivity(state.data, { theme, range, featured: featuredRepos(state.config), maxCallouts: state.config?.activity?.maxCallouts ?? 5, id: nextId('a'), ...opts });
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
      const content = draw(ctx.theme, ctx);
      if (typeof content === 'string') stage.innerHTML = content; else stage.append(content);
      if (onStageClick) stage.addEventListener('click', e => { if (!e.target.closest('a')) onStageClick(ctx, redraw); });
      body.append(stage);
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
  '/': () => {
    const username = state.config?.username || 'in-c0';
    const featured = (state.config?.projects || []).slice(0, 3);
    return h('div', { class: 'page' },
      h('section', { class: 'hero' },
        h('span', { class: 'badge' }, h('i'), state.live ? 'Live data · refreshed daily' : 'Sample data'),
        h('h1', {}, 'A prettier profile README.'),
        h('p', { class: 'lead' }, 'Three components, rendered as SVG and refreshed by a GitHub Action. Paste one block of markdown and they work on github.com.'),
        h('div', { class: 'actions' },
          h('a', { class: 'btn primary', href: '#/readme' }, 'Embed in README'),
          h('a', { class: 'btn', href: '#/components/activity' }, 'Browse components'))),
      previewBlock({
        draw: theme => {
          const wrap = h('div', { style: 'display:grid;gap:12px;width:100%;max-width:840px' });
          wrap.innerHTML = headerSVG(theme) + `<div class="wide">${activitySVG(theme)}</div>`;
          wrap.append(projectGrid(theme, featured));
          return wrap;
        },
        readme: () => readmeSnippet(),
        js: () => jsSnippet('all')
      }),
      h('p', { class: 'prose', style: 'font-size:13px;color:var(--muted)' }, `Showing @${username}. `, h('a', { href: '#/config', style: 'text-decoration:underline' }, 'Use your own profile →')));
  },

  '/readme': () => h('div', { class: 'page' },
    h('div', { class: 'crumbs' }, 'Getting started'),
    h('h1', {}, 'Embed in README'),
    h('p', { class: 'lead' }, 'GitHub READMEs can’t run JavaScript, so a daily Action renders each component to SVG and publishes it to an output branch.'),
    h('ol', { class: 'steps' },
      h('li', {}, h('h3', {}, 'Add the workflow'),
        h('p', { class: 'prose' }, 'In any repository you own (this one, a fork, or your ', h('code', {}, 'username/username'), ' repo):'),
        codeBlock('.github/workflows/profile-cards.yml', workflowSnippet())),
      h('li', {}, h('h3', {}, 'Describe your profile'),
        h('p', { class: 'prose' }, 'Projects, header counters and what the activity arrow labels. See ', h('a', { href: '#/config', style: 'text-decoration:underline' }, 'Configuration'), '.'),
        codeBlock('profile.config.json', configSnippet())),
      h('li', {}, h('h3', {}, 'Paste into your profile README'),
        h('p', { class: 'prose' }, 'Each card follows GitHub’s light or dark theme and links where you point it.'),
        codeBlock('README.md', readmeSnippet())))),

  '/config': () => h('div', { class: 'page' },
    h('div', { class: 'crumbs' }, 'Getting started'),
    h('h1', {}, 'Configuration'),
    h('p', { class: 'lead' }, 'One JSON file next to the workflow. Everything is optional except the username.'),
    optionsTable([
      ['username', 'string', 'GitHub login to read public data from.'],
      ['name, bio', 'string', 'Override the name and one-liner in the header.'],
      ['site', 'url', 'Where the header card links to.'],
      ['stats', 'string[]', 'Header counters: repos, followers, commits, stars, forks, new.'],
      ['activity.range', '"30d" | "12m" | "all"', 'Time span of the arrow. Default 12m.'],
      ['activity.extraRanges', 'string[]', 'Also render other spans, e.g. ["30d"] → activity-30d-light.svg.'],
      ['activity.labels', '"featured" | "all" | "none"', 'Which new repos get a name label. Featured = repos in projects. Forks are always labelled unless "none".'],
      ['activity.maxCallouts', 'number', 'Maximum labels on the arrow. Default 5.'],
      ['projects[]', 'object[]', 'id, title, summary, url, tag, repo, image (path or https URL).']
    ])),

  '/components/header': () => componentPage({
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

  '/components/project': () => componentPage({
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

  '/components/activity': () => {
    let range = state.config?.activity?.range || '12m';
    const order = Object.keys(RANGES);
    return componentPage({
      title: 'Activity arrow',
      lead: 'New repos, forks and stars stack above one arrow; commits hang below it. 840 × 252.',
      extra: legend(),
      block: previewBlock({
        draw: theme => `<div class="wide">${activitySVG(theme, range)}</div>`,
        controls: (ctx, redraw) => seg(order.map(k => [k, k === 'all' ? 'All' : k]), range, v => { range = v; redraw(); }, 'Range'),
        // Clicking the chart advances to the next range, like pressing the next segment.
        onStageClick: (ctx, redraw) => { range = order[(order.indexOf(range) + 1) % order.length]; redraw(); },
        readme: () => picture('activity', 'GitHub activity timeline', `https://github.com/${state.config?.username || 'in-c0'}`, '100%'),
        js: () => jsSnippet('activity')
      }),
      options: [
        ['data.events', '{ type, date, repo, count? }[]', 'type is repo, fork, star or commit. count is commits on that day.'],
        ['range', '"30d" | "12m" | "all"', 'Daily, weekly or monthly buckets.'],
        ['featured', 'string[]', 'Repos whose creation gets a name label.'],
        ['label', '(event) => string | null', 'Custom labelling; overrides featured.'],
        ['maxCallouts', 'number', 'Default 5. Labels never overlap; extras are dropped.'],
        ['theme, animate', '', 'As above. Hover a column on the web for its totals.']
      ]
    });
  }
};

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
    '<p>', ...(c.projects || []).map(p => picture(`project-${p.id}`, p.title, p.url, '32%')), '</p>'
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
    activity: `import { renderActivity } from '${base}/activity.js';\n\n// data = { events: [{ type: 'star', date: '2026-10-27', repo: 'owner/name' }, …] }\nel.innerHTML = renderActivity(data, { range: '12m', theme: 'light' });`
  };
  return kind === 'all' ? [lines.header, lines.activity].join('\n\n') : lines[kind];
}

/* ---------- router ---------- */
function render() {
  uid = 0;
  const path = (location.hash.replace(/^#/, '') || '/');
  const page = pages[path] || pages['/'];
  for (const a of document.querySelectorAll('.sidebar a')) {
    if (a.getAttribute('href') === '#' + path) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  $('#page').replaceChildren(state.data ? page() : h('p', { class: 'lead' }, 'Loading…'));
}
addEventListener('hashchange', () => { render(); scrollTo(0, 0); });

const [data, config] = await Promise.all([
  loadJSON('data/activity.json', 'data/sample-activity.json'),
  loadJSON('profile.config.json')
]);
state.data = data.json || { user: {}, events: [] };
state.live = data.url === 'data/activity.json';
state.config = config.json || { username: state.data.user?.login };
render();
