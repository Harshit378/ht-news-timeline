/** Capacitor serves the app from capacitor://localhost (iOS) and http://localhost (Android). */
const NATIVE_ORIGINS = ['capacitor://localhost', 'http://localhost'];

/** localhost / 127.0.0.1 / [::1] on any port, plus private LAN addresses (phone testing). */
const DEV_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})(:\d+)?$/;

/**
 * Production allows only CORS_ORIGIN (comma-separated) and the native app origins.
 * Everywhere else any local or LAN origin is accepted, so `nx serve web` (:4200), `next dev`
 * (:3000) or a phone on the same Wi-Fi all work without configuration.
 */
export function isAllowedOrigin(origin: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const configured = (env.CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if ([...configured, ...NATIVE_ORIGINS].includes(origin)) return true;
  return env.NODE_ENV !== 'production' && DEV_ORIGIN.test(origin);
}
