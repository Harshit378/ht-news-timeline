/**
 * Content Security Policy for the static export and the Capacitor shell (ADR-006), shipped as a <meta> tag
 * because the host isn't chosen yet. 'unsafe-inline' scripts are required: Next's static export inlines its
 * bootstrap and the theme boot script. A meta CSP can't set frame-ancestors; the host must send that header.
 */
export function buildCsp(apiBase: string, socketUrl: string): string {
  const origins = new Set<string>();
  for (const raw of [apiBase, socketUrl]) {
    try {
      origins.add(new URL(raw).origin);
    } catch {
      // relative or malformed: covered by 'self'
    }
  }
  const connect = ["'self'", ...origins].join(' ');
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data: blob:",
    "font-src 'self' data:",
    `connect-src ${connect}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}
