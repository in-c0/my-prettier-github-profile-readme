// Curiosity: what you star, grouped into interests, month by month.
// Shows where attention is drifting (the last 90 days against the rest of the year).

const DAY = 864e5;

// Ordered: on a tie the earlier interest wins. Matched against repo-name words, topics and language.
export const INTERESTS = [
  ['AI agents', ['agent', 'agents', 'agentic', 'llm', 'llms', 'claude', 'gpt', 'openai', 'mcp', 'skill', 'skills', 'rag', 'chatbot', 'prompt', 'copilot', 'langchain', 'autogen', 'harness']],
  ['Models & ML', ['machine-learning', 'deep-learning', 'pytorch', 'transformer', 'transformers', 'diffusion', 'training', 'ml', 'neural', 'dataset', 'fine-tuning', 'lora', 'llama', 'ocr', 'inference', 'kimi', 'glm', 'evo2']],
  ['Vision', ['computer-vision', 'vision', 'segment', 'segmentation', 'detection', 'yolo', 'pose', 'depth', 'dino', 'dinov2', 'sam', 'mediapipe', 'tracking', 'gaussian-splatting', '3dgs', 'nerf', 'gaussians', 'gs', 'deeplabcut']],
  ['3D & CAD', ['cad', '3d', 'mesh', 'build123d', 'kicad', 'pcb', 'solid', 'solidcraft', 'cadcraft', 'threejs', 'openscad', 'cadquery', 'gencad', 'ai4cad', 'img2threejs']],
  ['Physics & robotics', ['physics', 'simulation', 'simulator', 'mujoco', 'robotics', 'robot', 'ros', 'fluid', 'navierstokes', 'solver', 'dynamics', 'chrono', 'newton', 'isaac', 'humanoid', 'arm', 'lenia', 'exudyn', 'flybody', 'gr00t']],
  ['Graphics & motion', ['graphics', 'shader', 'shaders', 'webgl', 'webgpu', 'rendering', 'animation', 'motion', 'video', 'videos', 'canvas', 'glsl', 'manim', 'remotion', 'montage', 'openmontage', 'wan', 'wangp']],
  ['UI & design', ['ui', 'ux', 'design', 'components', 'react', 'tailwind', 'css', 'frontend', 'font', 'handwriting', 'hairline', 'freehand', 'ellipsis', 'tegaki']],
  ['Dev tools', ['cli', 'devtools', 'github', 'vscode', 'terminal', 'workflow', 'automation', 'actions', 'git', 'sdk']],
  ['Learning', ['awesome', 'book', 'books', 'course', 'tutorial', 'learning', 'education', 'math', 'mathematics', 'notes', 'roadmap', 'thinkstats']],
  ['Sound & speech', ['audio', 'music', 'speech', 'tts', 'voice', 'sound', 'silent', 'alterego', 'ace-step']]
];

export function interestOf(event, interests = INTERESTS) {
  const name = String(event.repo || '').toLowerCase();
  const words = new Set([
    ...name.split(/[\/\-_.]+/).filter(Boolean),
    name.split('/').pop(),
    ...(event.topics || []).map(t => String(t).toLowerCase()),
    ...(event.lang ? [String(event.lang).toLowerCase()] : [])
  ]);
  let best = null, bestScore = 0;
  for (const [label, keys] of interests) {
    let score = 0;
    for (const k of keys) if (words.has(k)) score++;
    if (score > bestScore) { best = label; bestScore = score; }
  }
  return best || 'Other';
}

export function analyzeCuriosity(data, { now = data?.generatedAt || Date.now(), rows = 6, interests = INTERESTS } = {}) {
  const end = new Date(now);
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const lateFrom = new Date(end - 90 * DAY).toISOString().slice(0, 10);
  const stars = (data?.events || []).filter(e => e.type === 'star' && e.date.slice(0, 7) >= months[0]);
  const byInterest = new Map();
  for (const e of stars) {
    const k = interestOf(e, interests);
    if (!byInterest.has(k)) byInterest.set(k, { label: k, total: 0, late: 0, months: Array(12).fill(0), examples: [] });
    const row = byInterest.get(k);
    row.total++;
    if (e.date >= lateFrom) row.late++;
    const m = months.indexOf(e.date.slice(0, 7));
    if (m >= 0) row.months[m]++;
    if (row.examples.length < 3) row.examples.push(String(e.repo || '').split('/').pop());
  }
  const all = [...byInterest.values()].filter(r => r.label !== 'Other').sort((a, b) => b.total - a.total || b.late - a.late);
  const lateTotal = stars.filter(e => e.date >= lateFrom).length;
  const earlyTotal = stars.length - lateTotal;
  const top = all.slice(0, rows);
  // Rising: biggest gain in share between the earlier nine months and the last 90 days.
  let rising = null;
  for (const r of all) {
    if (r.late < 3 || !lateTotal) continue;
    const gain = r.late / lateTotal - (earlyTotal ? (r.total - r.late) / earlyTotal : 0);
    if (gain > 0.08 && (!rising || gain > rising.gain)) rising = { label: r.label, gain, late: r.late, early: r.total - r.late };
  }
  const lately = [...all].sort((a, b) => b.late - a.late).filter(r => r.late > 0).slice(0, 2);
  const enough = stars.length >= 10;
  const headline = !enough ? 'Not enough stars yet'
    : lately.length ? `Lately: ${lately.map(r => r.label).join(', ')}` : `Mostly ${top[0]?.label || 'curious'}`;
  const parts = [];
  if (enough) {
    parts.push(`${lateTotal} of ${stars.length} stars in the last 90 days`);
    if (rising) parts.push(`${rising.label} rising (${rising.early} → ${rising.late})`);
    else if (top[0]) parts.push(`${top[0].label} leads the year with ${top[0].total}`);
  } else {
    parts.push(`Only ${stars.length} stars in the last 12 months — this shows from 10.`);
  }
  return { headline, summary: parts.join(' · '), rows: top, months, lateFrom, total: stars.length, lateTotal, rising, enough };
}
