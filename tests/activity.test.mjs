import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bucketize, renderActivity } from '../src/core/activity.js';
import { renderProject, renderHeader } from '../src/core/cards.js';

const now = '2026-10-30T00:00:00Z';
const events = [
  { type: 'star', date: '2026-10-29', repo: 'a/b' },
  { type: 'fork', date: '2026-10-01', repo: 'me/fork' },
  { type: 'repo', date: '2026-06-01', repo: 'me/new' },
  { type: 'commit', date: '2026-10-28', repo: 'me/new', count: 7 },
  { type: 'commit', date: '2024-01-01', repo: 'me/old', count: 3 }
];

test('12m uses 52 weekly buckets and counts commit weight', () => {
  const m = bucketize(events, { range: '12m', now });
  assert.equal(m.buckets.length, 52);
  assert.deepEqual(m.totals, { repo: 1, fork: 1, star: 1, commit: 7, privateCommit: 0 });
});

test('30d uses daily buckets ending today', () => {
  const m = bucketize(events, { range: '30d', now });
  assert.equal(m.buckets.length, 30);
  assert.equal(m.totals.repo, 0);
  assert.equal(m.buckets.at(-1).counts.star, 0);
  assert.equal(m.buckets.at(-2).counts.star, 1);
});

test('all spans from the first event month to now', () => {
  const m = bucketize(events, { range: 'all', now });
  assert.equal(new Date(m.buckets[0].start).toISOString().slice(0, 7), '2024-01');
  assert.equal(m.totals.commit, 10);
});

test('renderers return self-contained SVG with scoped styles', () => {
  for (const svg of [
    renderActivity({ events }, { now, theme: 'dark' }),
    renderProject({ id: 'x', title: 'X <script>', summary: 'y', url: 'https://x.dev' }),
    renderHeader({ login: 'me', name: 'Me' }, [{ label: 'repos', value: 3 }])
  ]) {
    assert.match(svg, /^<svg[^>]+id="([a-z0-9]+)"/);
    assert.ok(!svg.includes('<script>'));
    const id = svg.match(/id="([a-z0-9]+)"/)[1];
    assert.ok(svg.includes(`#${id} text{`));
  }
});

test('end slides the window back and private events can be dropped', () => {
  const withPrivate = [...events, { type: 'commit', date: '2026-10-27', count: 5, private: true }];
  const past = bucketize(withPrivate, { range: '3m', now, end: '2024-02-15' });
  assert.equal(past.buckets.length, 91);
  assert.equal(past.isNow, false);
  assert.equal(past.totals.commit, 3);
  const on = bucketize(withPrivate, { range: '12m', now });
  assert.equal(on.totals.privateCommit, 5);
  assert.equal(bucketize(withPrivate, { range: '12m', now, includePrivate: false }).totals.commit, 7);
});

test('gallery layout ends every column on the same edge', async () => {
  const { layoutGallery } = await import('../src/core/gallery.js');
  const items = [[400, 700], [400, 200], [400, 400], [400, 600], [400, 300], [400, 500]].map(([width, height], i) => ({ title: 't' + i, width, height }));
  const { tiles } = layoutGallery(items, { columns: 3 });
  const bottoms = new Map();
  for (const t of tiles) bottoms.set(t.x, Math.max(bottoms.get(t.x) || 0, t.y + t.h));
  const values = [...bottoms.values()];
  assert.ok(Math.max(...values) - Math.min(...values) < 0.01);
});
