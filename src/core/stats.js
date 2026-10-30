// Counters for the profile header, shared by the build script and the website.
export function computeStats(data, keys = ['repos', 'commits', 'stars'], now = data?.generatedAt || Date.now()) {
  const yearAgo = new Date(new Date(now) - 365 * 864e5).toISOString().slice(0, 10);
  const inYear = (data?.events || []).filter(e => e.date >= yearAgo);
  const sum = type => inYear.filter(e => e.type === type).reduce((n, e) => n + (Number(e.count) || 1), 0);
  const user = data?.user || {};
  const STAT = {
    repos: { label: 'repositories', value: user.publicRepos ?? 0 },
    followers: { label: 'followers', value: user.followers ?? 0 },
    commits: { label: 'commits · 12 mo', value: sum('commit') },
    stars: { label: 'stars given · 12 mo', value: sum('star') },
    forks: { label: 'forks · 12 mo', value: sum('fork') },
    new: { label: 'new repos · 12 mo', value: sum('repo') }
  };
  return keys.map(k => STAT[k]).filter(Boolean);
}

export function featuredRepos(config) {
  const activity = config?.activity || {};
  if (activity.labels === 'all') return null;
  return (config?.projects || []).flatMap(p => [p.repo, p.id].filter(Boolean)).concat(activity.featured || []);
}
