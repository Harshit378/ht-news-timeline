/** Same newspaper palette as the web app (apps/web/app/globals.css, dark theme) — ADR-001. */
export const colors = {
  bg: '#0a0a0b',
  surface: '#111113',
  surfaceAlt: '#18181c',
  border: '#222226',
  accent: '#e83a2e',
  ink: '#f0ede8',
  muted: '#7a7878',
  dim: '#3e3d3d',
  gold: '#c9a84c',
} as const;

export const fonts = {
  // Playfair / IBM Plex aren't bundled yet; platform serif/mono keep the editorial feel.
  serif: 'Georgia',
  mono: 'Menlo',
} as const;
