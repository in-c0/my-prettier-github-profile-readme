#!/usr/bin/env node
// Fetches public GitHub activity and writes README-ready SVG cards (light + dark).
//
//   GITHUB_TOKEN=… node scripts/build.mjs [--config profile.config.json] [--out dist] [--offline data.json]
//
// No dependencies: Node 20+ (global fetch). Commits come from the GraphQL contributions API
// (needs any token, e.g. the workflow's GITHUB_TOKEN); without one it falls back to REST.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, extname } from 'node:path';
import { renderActivity } from '../src/core/activity.js';
import { renderProject, renderHeader } from '../src/core/cards.js';
import { computeStats, featuredRepos } from '../src/core/stats.js';
import { renderGallery } from '../src/core/gallery.js';
import { imageSize } from '../src/core/image-size.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));
const configPath = resolve(args.config || process.env.INPUT_CONFIG || 'profile.config.json');
const outDir = resolve(args.out || process.env.INPUT_OUT || 'dist');
const token = process.env.GITHUB_TOKEN || process.env.INPUT_TOKEN || '';
const config = JSON.parse(await readFile(configPath, 'utf8'));
const username = process.env.INPUT_USERNAME || config.username;
// Private activity needs a token that belongs to the user (a PAT); the workflow token only sees public data.
const includePrivate = config.activity?.private === true;
if (!username) throw new Error('Set "username" in the config or the action input.');

const API = 'https://api.github.com';
const headers = accept => ({
  'User-Agent': 'my-prettier-github-profile-readme',
  Accept: accept || 'application/vnd.github+json',
  ...(token ? { Authorization: `Bearer ${token}` } : {})
});
async function rest(path, accept) {
  const res = await fetch(API + path, { headers: headers(accept) });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}
async function paged(path, accept, maxPages = 10) {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = await rest(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`, accept);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}
async function graphql(query, variables) {
  const res = await fetch(API + '/graphql', { method: 'POST', headers: headers(), body: JSON.stringify({ query, variables }) });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error('GraphQL: ' + JSON.stringify(json.errors || res.status));
  return json.data;
}

const COMMITS = `query($login:String!,$from:DateTime!,$to:DateTime!){user(login:$login){contributionsCollection(from:$from,to:$to){
  commitContributionsByRepository(maxRepositories:100){repository{nameWithOwner isPrivate}
  contributions(first:100){nodes{occurredAt commitCount}}}}}}`;

async function commitsViaGraphQL(createdAt) {
  const events = [];
  let to = new Date();
  const start = new Date(createdAt);
  // contributionsCollection spans at most one year per query.
  while (to > start) {
    const from = new Date(Math.max(start, to - 365 * 864e5));
    const data = await graphql(COMMITS, { login: username, from: from.toISOString(), to: to.toISOString() });
    for (const repo of data.user.contributionsCollection.commitContributionsByRepository) {
      const priv = repo.repository.isPrivate;
      if (priv && !includePrivate) continue;
      for (const n of repo.contributions.nodes) {
        // Private repos keep their dates and counts but never their names.
        events.push(priv
          ? { type: 'commit', date: n.occurredAt.slice(0, 10), repo: null, count: n.commitCount, private: true }
          : { type: 'commit', date: n.occurredAt.slice(0, 10), repo: repo.repository.nameWithOwner, count: n.commitCount });
      }
    }
    to = new Date(from - 1);
  }
  return events;
}

async function commitsViaRest(repos) {
  const since = new Date(Date.now() - 365 * 864e5).toISOString();
  const recent = repos.filter(r => !r.fork && r.pushed_at >= since).slice(0, 40);
  const byDay = new Map();
  for (const r of recent) {
    try {
      const commits = await paged(`/repos/${r.full_name}/commits?author=${username}&since=${since}`, null, 3);
      for (const c of commits) {
        const key = r.full_name + '|' + (c.commit.author?.date || '').slice(0, 10);
        byDay.set(key, (byDay.get(key) || 0) + 1);
      }
    } catch { /* empty repos answer 409 */ }
  }
  return [...byDay].map(([key, count]) => { const [repo, date] = key.split('|'); return { type: 'commit', date, repo, count }; });
}

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' };
let sharp = null;
try { sharp = (await import('sharp')).default; } catch { /* optional: only used to shrink large remote images */ }

// Loads a local path or URL. Large images are shrunk with sharp when it is installed,
// because everything is inlined into the SVG.
async function loadImage(src, maxWidth = 0) {
  if (!src) return null;
  try {
    let bytes, type;
    if (/^https?:/.test(src)) {
      const res = await fetch(src, { headers: { 'User-Agent': 'my-prettier-github-profile-readme' } });
      if (!res.ok) return null;
      type = (res.headers.get('content-type') || 'image/png').split(';')[0];
      if (!type.startsWith('image/')) return null;
      bytes = Buffer.from(await res.arrayBuffer());
    } else {
      const file = resolve(dirname(configPath), src);
      type = MIME[extname(file).toLowerCase()] || 'image/png';
      bytes = await readFile(file);
    }
    let size = imageSize(bytes);
    if (sharp && maxWidth && size && size.width > maxWidth && type !== 'image/svg+xml') {
      bytes = await sharp(bytes).resize({ width: maxWidth }).jpeg({ quality: 74, progressive: true }).toBuffer();
      type = 'image/jpeg';
      size = imageSize(bytes);
    }
    return { bytes, type, ...size, uri: `data:${type};base64,${bytes.toString('base64')}` };
  } catch { return null; }
}
const dataUri = async src => (await loadImage(src))?.uri || '';

async function collect() {
  if (args.offline) return JSON.parse(await readFile(resolve(args.offline), 'utf8'));
  const user = await rest(`/users/${username}`);
  const [repos, stars] = await Promise.all([
    paged(`/users/${username}/repos?type=owner&sort=created`),
    paged(`/users/${username}/starred`, 'application/vnd.github.star+json', config.maxStarPages || 10)
  ]);
  let commits = [];
  try { commits = token ? await commitsViaGraphQL(user.created_at) : await commitsViaRest(repos); }
  catch (err) { console.warn('GraphQL commits failed, using REST fallback:', err.message); commits = await commitsViaRest(repos); }
  let privateRepos = [];
  if (includePrivate && token) {
    try {
      privateRepos = (await paged('/user/repos?visibility=private&affiliation=owner'))
        .filter(r => r.owner?.login?.toLowerCase() === username.toLowerCase());
    } catch { console.warn('private: the token cannot list private repos (use a personal access token)'); }
    if (!commits.some(c => c.private)) console.warn('private: no private commits visible to this token');
  }
  const events = [
    ...repos.map(r => ({ type: r.fork ? 'fork' : 'repo', date: r.created_at.slice(0, 10), repo: r.full_name })),
    ...privateRepos.map(r => ({ type: 'repo', date: r.created_at.slice(0, 10), repo: null, private: true })),
    ...stars.filter(s => s.starred_at).map(s => ({ type: 'star', date: s.starred_at.slice(0, 10), repo: s.repo.full_name })),
    ...commits
  ].sort((a, b) => b.date.localeCompare(a.date));
  return {
    generatedAt: new Date().toISOString(),
    user: {
      login: user.login, name: user.name || user.login, bio: user.bio || '', url: user.html_url,
      blog: user.blog, followers: user.followers, publicRepos: user.public_repos, avatarUrl: user.avatar_url
    },
    events
  };
}

const data = await collect();
await mkdir(outDir, { recursive: true });
await writeFile(resolve(outDir, 'activity.json'), JSON.stringify(data));

const stats = computeStats(data, config.stats);
const avatar = await dataUri(data.user.avatarUrl ? data.user.avatarUrl + (data.user.avatarUrl.includes('?') ? '&' : '?') + 's=128' : '');
const user = { ...data.user, name: config.name || data.user.name, bio: config.bio ?? data.user.bio, avatar };
const activity = config.activity || {};
const featured = featuredRepos(config);
const files = [];
const write = async (name, svg) => { await writeFile(resolve(outDir, name), svg); files.push(name); };

for (const theme of ['light', 'dark']) {
  await write(`header-${theme}.svg`, renderHeader(user, stats, { theme }));
  for (const range of new Set([activity.range || '12m', ...(activity.extraRanges || [])])) {
    const suffix = range === (activity.range || '12m') ? '' : '-' + range;
    await write(`activity${suffix}-${theme}.svg`, renderActivity(data, {
      theme, range, featured, maxCallouts: activity.maxCallouts ?? 5,
      label: activity.labels === 'none' ? () => null : undefined
    }));
  }
}
for (const p of config.projects || []) {
  const image = await dataUri(p.image);
  for (const theme of ['light', 'dark']) await write(`project-${p.id}-${theme}.svg`, renderProject({ ...p, image }, { theme }));
}
if (config.collected?.length) {
  await mkdir(resolve(outDir, 'thumbs'), { recursive: true });
  const items = [];
  for (const c of config.collected) {
    const img = await loadImage(c.image, 392);
    if (img) await writeFile(resolve(outDir, 'thumbs', `${c.id}.${img.type === 'image/png' ? 'png' : 'jpg'}`), img.bytes);
    items.push({ ...c, src: img?.uri || '', width: img?.width, height: img?.height });
  }
  for (const theme of ['light', 'dark']) await write(`collected-${theme}.svg`, renderGallery(items, { theme }));
}

// A ready-to-paste README block that points at the published branch.
const repo = process.env.GITHUB_REPOSITORY || config.repository || `${username}/my-prettier-github-profile-readme`;
const branch = config.outputBranch || 'output';
const raw = name => `https://raw.githubusercontent.com/${repo}/${branch}/${name}`;
const pic = (name, alt, link, width) =>
  `<a href="${link}"><picture><source media="(prefers-color-scheme: dark)" srcset="${raw(name + '-dark.svg')}"><img alt="${alt}" src="${raw(name + '-light.svg')}"${width ? ` width="${width}"` : ''}></picture></a>`;
const site = config.site || data.user.url;
const snippet = [
  pic('header', user.name, site, '100%'),
  '',
  pic('activity', 'GitHub activity: new repos, forks, stars and commits on one timeline', `https://github.com/${username}`, '100%'),
  '',
  '<p>',
  ...(config.projects || []).map(p => pic(`project-${p.id}`, p.title, p.url || p.demoUrl, '32%')),
  '</p>',
  ...(config.collected?.length ? ['', pic('collected', 'Collected references', site, '100%')] : [])
].join('\n');
await writeFile(resolve(outDir, 'README-snippet.md'), snippet + '\n');
console.log(`Wrote ${files.length} SVGs to ${outDir} (${data.events.length} events).`);
