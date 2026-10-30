// Design tokens shared by the website and the README SVG cards.
// SVGs embedded in a GitHub README cannot load web fonts, so the stacks are system-only
// (the same stacks GitHub itself uses).

export const FONT_SANS = '-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif';
export const FONT_MONO = 'ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace';

// Neutral scale (shadcn-style) for light; GitHub's own dark canvas for dark so cards
// sit flush on github.com in either theme.
export const THEMES = {
  light: {
    bg: '#ffffff', surface: '#f5f5f5', border: '#e5e5e5', hairline: '#ededed',
    fg: '#0a0a0a', muted: '#525252', subtle: '#8a8a8a', axis: '#0a0a0a',
    star: '#c38a00', fork: '#8250df', repo: '#2563eb', commit: '#30a14e'
  },
  dark: {
    bg: '#0d1117', surface: '#151b23', border: '#30363d', hairline: '#21262d',
    fg: '#f0f6fc', muted: '#9198a1', subtle: '#6e7681', axis: '#f0f6fc',
    star: '#e3b341', fork: '#a371f7', repo: '#4493f8', commit: '#39d353'
  }
};

export const RADIUS = 10;

export const TYPE_META = {
  repo: { label: 'New repo', plural: 'new repos' },
  fork: { label: 'Fork', plural: 'forks' },
  star: { label: 'Star', plural: 'stars' },
  commit: { label: 'Commit', plural: 'commits' }
};

export function theme(name) {
  return THEMES[name] || THEMES.light;
}
