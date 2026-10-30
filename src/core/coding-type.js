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

  // Time of day: circular mean of commit hours, so 23:00 and 01:00 count as the same night.
  const WINDOWS = [
    { key: 'early', label: 'Early-bird', from: 5, to: 10 },
    { key: 'day', label: 'Daylight', from: 10, to: 17 },
    { key: 'evening', label: 'Twilight', from: 17, to: 22 },
    { key: 'night', label: 'Night-owl', from: 22, to: 29 }
  ];
  let time = null;
  if (hours) {
    let sx = 0, sy = 0, n = 0;
    hours.forEach((v, h) => { const a = (h + 0.5) / 24 * Math.PI * 2; sx += Math.cos(a) * v; sy += Math.sin(a) * v; n += v; });
    const R = n ? Math.hypot(sx, sy) / n : 0;                       // 0 = spread evenly, 1 = one hour
    const mean = ((Math.atan2(sy, sx) / (Math.PI * 2)) * 24 + 24) % 24;
    const meanHour = Math.floor(mean);
    const w = WINDOWS.find(x => (meanHour >= x.from && meanHour < x.to) || (meanHour + 24 >= x.from && meanHour + 24 < x.to));
    // Share of commits within three hours either side of the centre, for the evidence line.
    let near = 0;
    for (let d = -3; d <= 3; d++) near += hours[(meanHour + d + 24) % 24];
    const share = n ? near / n : 0;
    const clock = String(meanHour).padStart(2, '0') + ':00';
    time = R < 0.18
      ? { key: 'any', label: 'Round-the-clock', mean, R, share, center: clock, range: null }
      : { ...w, mean, R, share, center: clock, range: [meanHour - 3, meanHour + 4] };
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
  // Weekly regularity: share of the year's weeks with at least one commit.
  const weeks = new Set(commits.map(e => Math.floor(new Date(e.date + 'T00:00:00Z') / (7 * DAY))));
  const weekShare = weeks.size / 52;
  let rhythm;
  if (weekend >= 0.4) rhythm = { key: 'weekender', label: 'Weekender', detail: `${pct(weekend)} of commits on weekends` };
  else if (burst >= 0.45) rhythm = { key: 'sprinter', label: 'Sprinter', detail: `${pct(burst)} of commits land on the busiest 10% of days` };
  else if (activeDays >= 150) rhythm = { key: 'marathoner', label: 'Marathoner', detail: `commits on ${activeDays} days this year` };
  else rhythm = { key: 'pulse', label: 'Pulse', detail: `commits in ${weeks.size} of the last 52 weeks` };

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

  const languages = (habits.languages || []).filter(l => l.name).slice(0, 6);
  const polyglot = languages.length >= 4 ? { key: 'polyglot', label: 'Polyglot', detail: `${languages.length} languages` } : null;
  const enough = total >= 30;
  const name = !enough ? 'Not enough data yet' : [time ? time.label : null, rhythm.label].filter(Boolean).join(' ');
  const lines = [];
  if (enough && time) lines.push(time.key === 'any' ? 'Commits spread across the whole day' : `Commits centre on ${time.center}`);
  if (enough) lines.push(cap(rhythm.detail));
  else lines.push(`Only ${total} commits in the last 12 months — the type appears from 30.`);
  const first = commits.reduce((m, e) => (e.date < m ? e.date : m), commits[0]?.date || yearAgo);
  return {
    name, enough, time, rhythm, breadth, curiosity, languages, hours, weekdays, weekShare,
    total, activeDays, sample: habits.sample || 0, timezone: habits.timezone || 'UTC', offset: habits.offset || '',
    from: first, to: new Date(now).toISOString().slice(0, 10),
    summary: lines.join(' · '),
    traits: enough ? [breadth, polyglot || (languages[0] && { key: 'lang', label: languages[0].name, detail: 'most-committed language' }), curiosity].filter(Boolean) : []
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
  let offset = '';
  try { offset = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value.replace('GMT', 'UTC') || ''; } catch {}
  return { hours, weekdays, sample: timestamps.length, timezone: timeZone, offset };
}
