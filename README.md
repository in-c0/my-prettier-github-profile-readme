# my prettier github profile readme: web UI library

[![Explore the interactive GitHub profile showcase — projects, public activity, and found ideas](assets/showcase-banner.svg)](https://profile-atlas-showcase.wldud5192.chatgpt.site/)

[Explore the interactive version](https://profile-atlas-showcase.wldud5192.chatgpt.site/) · *Static banner linking to the live interactive showcase.*

[Live showcase](https://profile-atlas-showcase.wldud5192.chatgpt.site/) · [Standalone activity timeline](https://profile-atlas-showcase.wldud5192.chatgpt.site/activity-demo)

A buildless, open-source profile showcase and Web Component set for a GitHub profile that is more than six pinned repositories. Display selected projects, starred and forked repositories, public activity, personal notes, and visual inspiration without an account or GitHub access token.

## The live showcase

The deployed Site (and its equivalent repository demo) now uses `demo/index.html`, `src/showcase.css`, and `src/showcase.js`: an editorial, readable layout with an immediately visible project grid rather than overlapping splay cards. The gallery shows all seven curated projects, real captured images when verified, and readable text-first entries when a verified capture is unavailable. Visitors can filter and search projects, expand notes, view all ten inspiration references, and open actual product links.

The activity section supports **This week / This month / This year / Past 5 years / All**, category filtering and per-period record lists. Repeated same-day push events are grouped for readability without changing recorded counts. Monthly counts are separately selectable. Month-only historical snapshots are never assigned fabricated days or names.

The original `<profile-atlas>` custom element is retained as a backwards-compatible component API; its tag and source filenames are intentionally unchanged. The appearance and behavior below describe those optional reusable components, not the current homepage.

## Reusable components (original design)

- **Projects, stars, forks, inspiration — Splay Cards.** Based on [Mellow UI Splay Cards](https://mellowui.com/r/splay-cards.json): overlapping 3D plates fan apart on hover/focus. A bounded card window navigates hundreds of entries without mounting hundreds of plates. Curated projects can show genuine captured public product pages; selecting one opens a larger preview linked to the live demo.
- **Stories — Toss Deck.** Based on [Mellow UI Toss Deck](https://mellowui.com/r/toss-deck.json): swipe the top card out of the stack or use the navigation arrows.
- **Activity — a functional four-lane timeline.** Select **This week / This month / This year / Past 5 years / All**. Star, Fork, New repo, and Push share the same daily/monthly time scale; bars show relative activity, and clicking a bar opens an item-level drilldown. Click a row label to focus a type. Quantities are displayed separately in **Monthly analysis**, with a month selector.
- **Honest historical resolution.** A month-only historical snapshot can contribute to monthly/yearly views, but it will never be assigned a fabricated day. The panel explains when daily data is incomplete. GitHub's public event API exposes only recent Push events, not lifetime commits.
- **Browse all** opens a searchable, progressively rendered, one-sentence index without replacing the gallery.
- **Motion references — native video.** Inspiration cards accept `mediaType: "video"`, `image: "https://…/clip.mp4"`, and a `poster` thumbnail. Only the currently focused/hovered video plays silently; reduced-motion preferences keep the still preview. Clicking opens a video with controls. The six sample videos ship with local first-frame poster images instead of broken image placeholders.
- **No empty cards.** Items without a verified thumbnail receive a typographic cover with the actual title, category, and language or destination domain. The ten sample inspiration references have content-specific titles rather than numbered placeholders.

The named Mellow UI designs are **adapted from their published React + Motion behavior into framework-free Custom Elements**, not installed as React/shadcn components into this buildless package. To use the original React implementations in a React/Tailwind project, run:

```sh
npx shadcn@latest add https://mellowui.com/r/splay-cards.json
npx shadcn@latest add https://mellowui.com/r/toss-deck.json
```

## Quick start

Serve this repository over HTTP and open `demo/index.html`. For an existing website, copy the files in `src/` next to one another and use:

```html
<script type="module" src="/src/profile-atlas.js"></script>
<profile-atlas username="in-c0" manifest-url="/data/in-c0.json" max-pages="10"></profile-atlas>
```

The module imports adjacent `timeline-math.js` and loads three adjacent stylesheets: `profile-atlas.css`, `github-activity-timeline.css`, and `mellow-overrides.css`. Preserve their relative paths.

### Standalone activity timeline

```html
<script type="module" src="/src/profile-atlas.js"></script>
<github-activity-timeline username="your-username" max-pages="10"></github-activity-timeline>
```

Or provide your own dated array, including multiple different activity types on the same month:

```js
document.querySelector('github-activity-timeline').events = [
  { id: 's1', type: 'star', title: 'Interesting project', date: '2025-05-04T00:00:00Z', url: 'https://github.com/' },
  { id: 'f1', type: 'fork', title: 'Fork', date: '2025-05-05T00:00:00Z' },
  { id: 'r1', type: 'project', title: 'New repository', date: '2025-05-11T00:00:00Z' },
  { id: 'p1', type: 'commit', title: 'Push event', date: '2025-05-22T00:00:00Z' }
];
```

Optional `activityCount` and `aggregate: true` support month-only records. An aggregate should have a date within its recorded month; it is bucketed by month only, never by a specific day. Each recorded bar opens a progressively rendered detail list; intercept the cancellable `activity-open` event to provide your own details UI.

### Separate horizontal rows

```html
<profile-atlas compact row="project" username="in-c0" manifest-url="/data/in-c0.json"></profile-atlas>
<profile-atlas compact row="story" username="in-c0" manifest-url="/data/in-c0.json"></profile-atlas>
<profile-atlas compact row="inspiration" username="in-c0" manifest-url="/data/in-c0.json"></profile-atlas>
```

`row` accepts `project`, `star`, `fork`, `story`, or `inspiration`. `username` is the GitHub username; `max-pages` fetches 100 entries per page (default 10, maximum 30); `manifest-url` supplies optional curated `projects`, `stories`, `inspirations`, and `excludeRepos`. Items can include `title`, `summary`, `body`, `url`, `demoUrl`, `preview: "iframe" | "video" | "image" | "link"`, `image`, `poster`, `mediaType: "video"`, and `repo`. See [data/in-c0.json](data/in-c0.json) for a complete example.

Image paths may be absolute HTTPS URLs or relative to the manifest JSON file (for example `../assets/project-previews/paper-ui.webp`). The showcase's four product thumbnails are captured public product/demo pages from 2026-10-25, not live iframes. A screenshot is never silently substituted with a security-verification page; entries without a verified image use a real-text cover. Real screenshots are still subject to the original sites' branding and content rights.

## Data, limits, and privacy

- Public repos from GitHub's user repository endpoint; forks use repo creation timestamps.
- Stars from the starred endpoint with `Accept: application/vnd.github.star+json`, which includes star timestamps.
- **Push** from the recent public `PushEvent` feed: this is **not a complete commit history** and a push event is not a single commit. Public event history is limited to recent events (approximately 30 days / 300 events).
- Public GitHub API requests are unauthenticated; local browser cache lasts six hours. The sample profile reconciles its dated month-only snapshot with newly fetched events, adding only previously unaccounted-for quantities to avoid double counting.
- `projectVisibility: "curated"` in the manifest hides unfeatured owned repo **titles from the gallery** and represents their creation in the public chart as month-only totals. This does **not** make public GitHub repos private.
- Curated screenshot previews link directly to the live product or store listing. Other items may use iframes if allowed; when embedding is blocked, visitors can open the project directly.

## GitHub profile README

GitHub profile READMEs cannot execute JavaScript. Embed `assets/showcase-banner.svg` as a linked image, and point it at the live interactive showcase. An older animated preview can still be rebuilt with `python scripts/make_readme_preview.py` (requires Pillow). The GitHub six-pin limit is independent of what you can display on the hosted page.

MIT licensed. This release is an early public Web Component prototype; automated cross-browser interaction tests, package publishing, and static pre-generated feed support are future work.
