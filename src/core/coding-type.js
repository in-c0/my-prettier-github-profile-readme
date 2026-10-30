// Coding type: an honest, data-backed archetype from commit timing, rhythm and breadth.
// Every label comes with the number behind it so the card never claims more than the data shows.

const DAY = 864e5;

// habits: { hours: number[24], weekdays: number[7] (Mon..Sun), sample, timezone, languages: [{ name, commits }] }
export function analyzeCodingType(data, { now = data?.generatedAt || Date.now() } = {}) {
  const yearAgo = new Date(new Date(now) - 365 * DAY).toISOString().slice(0, 10);
  const commits = (data?.events || []).filter(e => e.type === 'commit' && e.date >= yearAgo);
  const stars = (data?.events || []).filter(e => e.type === 'star' && e.date >= yearAgo).length;
  const total = commits.reduce((n, e) => n + (Number(e.count) || 1), 0);
  const habits = data?.habits || {};

  // Weekday split: prefer timestamp-based habits, else fall back to commit dates.
  let weekdays = habits.weekdays;
  if (!weekdays || !weekdays.some(Boolean)) {
    weekdays = Array(7).fill(0);
    for (const e of commits) weekdays[(new Date(e.date + 'T12:00:00Z').getUTCDay() + 6) % 7] += Number(e.count) || 1;
  }
  const hours = habits.hours && habits.hours.some(Boolean) ? habits.hours : null;

  // Time of day.
  const WINDOWS = [
    { key: 'early', label: 'Early-bird', range: [5, 10], phrase: 'mornings (5–10am)' },
    { key: 'day', label: 'Daytime', range: [10, 17], phrase: 'working hours (10am–5pm)' },
    { key: 'evening', label: 'Evening', range: [17, 22], phrase: 'evenings (5–10pm)' },
    { key: 'night', label: 'Night-owl', range: [22, 29], phrase: 'late nights (10pm–5am)' }
  ];
  let time = null;
  if (hours) {
    const sum = hours.reduce((a, b) => a + b, 0) || 1;
    const shares = WINDOWS.map(w => {
      let n = 0;
      for (let h = w.range[0]; h < w.range[1]; h++) n += hours[h % 24];
      return { ...w, share: n / sum };
    });
    const top = shares.reduce((a, b) => (b.share > a.share ? b : a));
    time = top.share < 0.38
      ? { key: 'any', label: 'Around-the-clock', share: top.share, phrase: 'no single part of the day' }
      : top;
  }

  // Rhythm: how concentrated commits are, and weekend share.
  const perDay = new Map();
  for (const e of commits) perDay.set(e.date, (perDay.get(e.date) || 0) + (Number(e.count) || 1));
  const daily = [...perDay.values()].sort((a, b) => b - a);
  const activeDays = daily.length;
  const topN = Math.max(1, Math.ceil(activeDays * 0.1));
  const burst = total ? daily.slice(0, topN).reduce((a, b) => a + b, 0) / total : 0;
  const wsum = weekdays.reduce((a, b) => a + b, 0) || 1;
  const weekend = (weekdays[5] + weekdays[6]) / wsum;
  let rhythm;
  if (weekend >= 0.45) rhythm = { key: 'weekender', label: 'Weekender', detail: `${pct(weekend)} of commits on weekends` };
  else if (burst >= 0.45) rhythm = { key: 'sprinter', label: 'Sprinter', detail: `${pct(burst)} of commits on the busiest 10% of days` };
  else if (activeDays >= 120) rhythm = { key: 'steady', label: 'Marathoner', detail: `active on ${activeDays} days this year` };
  else rhythm = { key: 'regular', label: 'Builder', detail: `active on ${activeDays} days this year` };

  // Breadth and curiosity.
  const repoCommits = new Map();
  for (const e of commits) if (e.repo) repoCommits.set(e.repo, (repoCommits.get(e.repo) || 0) + (Number(e.count) || 1));
  const repoCount = repoCommits.size;
  const topRepoShare = total ? Math.max(0, ...repoCommits.values()) / total : 0;
  const breadth = repoCount >= 15
    ? { key: 'explorer', label: 'Explorer', detail: `commits across ${repoCount} repos` }
    : topRepoShare >= 0.5
      ? { key: 'deep', label: 'Deep diver', detail: `${pct(topRepoShare)} of commits in one repo` }
      : { key: 'focused', label: 'Focused', detail: `commits across ${repoCount} repos` };
  const curiosity = stars >= 96 ? { key: 'collector', label: 'Collector', detail: `${stars} repos starred this year` } : null;

  const languages = (habits.languages || []).filter(l => l.name).slice(0, 5);
  const name = [time && time.key !== 'any' ? time.label : time ? 'Around-the-clock' : null, rhythm.label].filter(Boolean).join(' ');
  const lines = [];
  if (time) lines.push(time.key === 'any' ? 'Commits spread across the whole day' : `${pct(time.share)} of commits land in ${time.phrase}`);
  lines.push(cap(rhythm.detail));
  return {
    name, time, rhythm, breadth, curiosity, languages, hours, weekdays,
    total, activeDays, sample: habits.sample || 0, timezone: habits.timezone || 'UTC',
    summary: lines.join(' · '),
    traits: [breadth, curiosity, languages[0] && { key: 'lang', label: languages[0].name, detail: 'most-committed language' }].filter(Boolean)
  };
}

const pct = x => Math.round(x * 100) + '%';
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// Build-side helper: turn commit timestamps into hour/weekday histograms in a time zone.
export function habitsFromTimestamps(timestamps, timeZone = 'UTC') {
  const hours = Array(24).fill(0), weekdays = Array(7).fill(0);
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23', weekday: 'short' });
  const W = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  for (const ts of timestamps) {
    const d = new Date(ts);
    if (Number.isNaN(+d)) continue;
    const parts = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));
    hours[Number(parts.hour) % 24]++;
    weekdays[W[parts.weekday]]++;
  }
  return { hours, weekdays, sample: timestamps.length, timezone: timeZone };
}
