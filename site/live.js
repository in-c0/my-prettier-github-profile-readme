import { habitsFromTimestamps } from '../src/core/coding-type.js';
// Client-side lookup for "try your own @username". Uses GitHub's public REST API
// without a token (60 requests/hour per visitor), so it stays within ~15 requests
// and caches each profile for an hour.
const API = 'https://api.github.com';
const MAX_COMMIT_REPOS = 8;

export class LookupError extends Error {}

async function get(path, accept) {
  const res = await fetch(API + path, { headers: { Accept: accept || 'application/vnd.github+json' } });
  if (res.status === 404) throw new LookupError('No GitHub user with that name.');
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
    const when = reset ? new Date(reset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'in an hour';
    throw new LookupError(`GitHub’s hourly limit for anonymous lookups is used up. Try again at ${when}.`);
  }
  if (!res.ok) throw new LookupError(`GitHub answered ${res.status}. Try again in a moment.`);
  return res.json();
}

async function paged(path, accept, pages) {
  const out = [];
  for (let page = 1; page <= pages; page++) {
    const batch = await get(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`, accept);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

export async function lookupProfile(login, { onProgress = () => {} } = {}) {
  login = login.trim().replace(/^@/, '').replace(/^https?:\/\/github\.com\//, '').split('/')[0];
  if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(login)) throw new LookupError('That isn’t a valid GitHub username.');
  const key = 'pp-live3-' + login.toLowerCase();
  try {
    const cached = JSON.parse(localStorage.getItem(key) || 'null');
    if (cached && Date.now() - cached.at < 36e5) return cached.data;
  } catch {}

  onProgress('Reading profile');
  const user = await get(`/users/${login}`);
  onProgress('Reading repositories and stars');
  const [repos, stars] = await Promise.all([
    paged(`/users/${login}/repos?type=owner&sort=created`, null, 3),
    paged(`/users/${login}/starred`, 'application/vnd.github.star+json', 3)
  ]);
  const since = new Date(Date.now() - 365 * 864e5).toISOString();
  const active = repos.filter(r => !r.fork && r.pushed_at >= since)
    .sort((a, b) => b.pushed_at.localeCompare(a.pushed_at)).slice(0, MAX_COMMIT_REPOS);
  onProgress('Counting commits');
  const perDay = new Map();
  const stamps = [];
  await Promise.all(active.map(async r => {
    try {
      const commits = await get(`/repos/${r.full_name}/commits?author=${login}&since=${since}&per_page=100`);
      for (const c of commits) {
        if (c.commit.author?.date) stamps.push(c.commit.author.date);
        const k = r.full_name + '|' + (c.commit.author?.date || '').slice(0, 10);
        perDay.set(k, (perDay.get(k) || 0) + 1);
      }
    } catch (e) { if (e instanceof LookupError && /limit/.test(e.message)) throw e; }
  }));
  const events = [
    ...repos.map(r => ({ type: r.fork ? 'fork' : 'repo', date: r.created_at.slice(0, 10), repo: r.full_name })),
    ...stars.filter(s => s.starred_at).map(s => ({ type: 'star', date: s.starred_at.slice(0, 10), repo: s.repo.full_name, topics: (s.repo.topics || []).slice(0, 8), lang: s.repo.language || undefined })),
    ...[...perDay].map(([k, count]) => { const [repo, date] = k.split('|'); return { type: 'commit', date, repo, count }; })
  ].sort((a, b) => b.date.localeCompare(a.date));
  // Hour/weekday habits in the visitor's own time zone; languages from the sampled repos.
  const habits = habitsFromTimestamps(stamps, Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const byLang = new Map();
  for (const [k, n] of perDay) { const lang = active.find(r => r.full_name === k.split('|')[0])?.language; if (lang) byLang.set(lang, (byLang.get(lang) || 0) + n); }
  habits.languages = [...byLang].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, commits]) => ({ name, commits }));
  const data = {
    generatedAt: new Date().toISOString(),
    partialCommits: active.length,
    habits,
    user: {
      login: user.login, name: user.name || user.login, bio: user.bio || '', url: user.html_url,
      followers: user.followers, publicRepos: user.public_repos, avatarUrl: user.avatar_url
    },
    events
  };
  try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch {}
  return data;
}
