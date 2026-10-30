# my prettier github profile readme

README-ready GitHub profile components — a profile header, project cards and an **activity arrow** that puts new repos, forks, stars and commits on one timeline. Rendered as SVG by a daily GitHub Action, so they work inside any `README.md`.

**[Docs & live previews →](https://in-c0.github.io/my-prettier-github-profile-readme/)**

<a href="https://ava.kim"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/in-c0/my-prettier-github-profile-readme/output/header-dark.svg"><img alt="Ava Kim" src="https://raw.githubusercontent.com/in-c0/my-prettier-github-profile-readme/output/header-light.svg" width="100%"></picture></a>

<a href="https://github.com/in-c0"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/in-c0/my-prettier-github-profile-readme/output/activity-dark.svg"><img alt="GitHub activity: new repos, forks, stars and commits on one timeline" src="https://raw.githubusercontent.com/in-c0/my-prettier-github-profile-readme/output/activity-light.svg" width="100%"></picture></a>

<p>
<a href="https://vibomaker.com"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/in-c0/my-prettier-github-profile-readme/output/project-vibo-dark.svg"><img alt="ViBo" src="https://raw.githubusercontent.com/in-c0/my-prettier-github-profile-readme/output/project-vibo-light.svg" width="32%"></picture></a>
<a href="https://sumz-up.com"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/in-c0/my-prettier-github-profile-readme/output/project-sumzup-dark.svg"><img alt="Sumzup" src="https://raw.githubusercontent.com/in-c0/my-prettier-github-profile-readme/output/project-sumzup-light.svg" width="32%"></picture></a>
<a href="https://paper-ui-react-lab.vercel.app/"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/in-c0/my-prettier-github-profile-readme/output/project-paper-ui-dark.svg"><img alt="Paper UI" src="https://raw.githubusercontent.com/in-c0/my-prettier-github-profile-readme/output/project-paper-ui-light.svg" width="32%"></picture></a>
</p>

*Live cards above: rebuilt every day from public GitHub data.*

## Components

| | |
|---|---|
| **Profile header** — avatar, name, one line, three counters | <img src="assets/screenshots/header-light.png" width="420" alt="Profile header"> |
| **Activity arrow** — ◼ new repo · ◆ fork · ★ star above the arrow, commit bars below | <img src="assets/screenshots/activity-light.png" width="420" alt="Activity arrow"> |
| **Project card** — screenshot or dotted cover, title, two lines, domain | <img src="assets/screenshots/projects-light.png" width="420" alt="Project cards"> |

The activity arrow comes in three spans: `30d` (daily), `12m` (weekly, default) and `all` (monthly). New repos from your `projects` list and forks get name labels; labels never overlap.

## Use it on your profile

**1. Add a workflow** to any repo you own (your `username/username` repo works):

```yaml
name: Profile cards
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
      - uses: in-c0/my-prettier-github-profile-readme@main
        with:
          config: profile.config.json
          out: dist
      - name: Publish to the output branch
        run: |
          cd dist && git init -q -b output
          git config user.name github-actions[bot]
          git config user.email 41898282+github-actions[bot]@users.noreply.github.com
          git add -A && git commit -qm "Update profile cards"
          git push -f "https://x-access-token:${{ github.token }}@github.com/${{ github.repository }}.git" output
```

**2. Add `profile.config.json`** next to it — see [this repo's config](profile.config.json):

```json
{
  "username": "your-username",
  "site": "https://example.com",
  "stats": ["repos", "commits", "stars"],
  "activity": { "range": "12m", "labels": "featured" },
  "projects": [
    { "id": "my-app", "title": "My App", "summary": "One line about it.", "url": "https://my.app", "image": "assets/my-app.jpg" }
  ]
}
```

**3. Paste into your profile README.** The run writes `dist/README-snippet.md` with every card wired up; each one is a `<picture>` so it follows GitHub's light/dark theme:

```html
<a href="https://github.com/your-username"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/OWNER/REPO/output/activity-dark.svg">
  <img alt="GitHub activity" src="https://raw.githubusercontent.com/OWNER/REPO/output/activity-light.svg" width="100%">
</picture></a>
```

| Config | Values |
|---|---|
| `stats` | `repos`, `followers`, `commits`, `stars`, `forks`, `new` |
| `activity.range` | `30d` · `12m` · `all` |
| `activity.extraRanges` | e.g. `["30d"]` → also writes `activity-30d-light.svg` |
| `activity.labels` | `featured` (repos in `projects`) · `all` · `none` |
| `projects[].image` | repo-relative path or https URL — embedded into the SVG, since GitHub blocks external images inside SVGs |

## On a website

The same renderers run in the browser — no build step:

```js
import { renderActivity } from 'https://cdn.jsdelivr.net/gh/in-c0/my-prettier-github-profile-readme@main/src/core/activity.js';

el.innerHTML = renderActivity(data, { range: '12m', theme: 'dark' });
// data = { events: [{ type: 'star' | 'fork' | 'repo' | 'commit', date: '2026-10-27', repo: 'owner/name', count? }] }
```

## Notes

- Commits come from GitHub's contributions API (public repos only; the workflow token is enough). Without a token the build falls back to per-repo commit lists for the past year.
- Stars use `starred_at` timestamps; repos and forks use their creation date.
- Cards animate once on load and respect `prefers-reduced-motion`. GitHub shows SVGs as images, so per-element links and hover tooltips only work on the website.

```sh
npm test               # renderer tests
npm run build:sample   # render dist/ from data/sample-activity.json, no network
npm run dev            # docs site at http://localhost:8080
```

MIT licensed.
