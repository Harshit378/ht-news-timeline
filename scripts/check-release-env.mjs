#!/usr/bin/env node
// Refuses a native release build that points at a dev API (ADR-001 Path A). The app bundle is static, so
// NEXT_PUBLIC_API_URL is baked in at build time: a localhost or LAN URL would ship a broken app.
import { fileURLToPath } from 'node:url';

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|.*\.local$)/i;

/** NEXT_PUBLIC_* variables are inlined into the shipped app when referenced: secrets must never use that prefix. */
export function secretLookingPublicVars(env) {
  return Object.keys(env).filter((k) => k.startsWith('NEXT_PUBLIC_') && /(KEY|SECRET|TOKEN|PASSWORD)/.test(k));
}

/** Problems with the release environment; empty when it is fine. */
export function releaseProblems(env) {
  const problems = [];
  const check = (name, value, scheme) => {
    if (!value) return problems.push(`${name} is not set`);
    let url;
    try {
      url = new URL(value);
    } catch {
      return problems.push(`${name} is not an absolute URL: ${value}`);
    }
    if (url.protocol !== `${scheme}:`) problems.push(`${name} must use ${scheme}:// in a release build (got ${url.protocol}//)`);
    if (PRIVATE_HOST.test(url.hostname)) problems.push(`${name} points at a local/LAN host (${url.hostname})`);
  };
  check('NEXT_PUBLIC_API_URL', env.NEXT_PUBLIC_API_URL, 'https');
  if (env.NEXT_PUBLIC_API_URL && !/\/api\/?$/.test(env.NEXT_PUBLIC_API_URL)) {
    problems.push('NEXT_PUBLIC_API_URL must end in /api');
  }
  if (env.NEXT_PUBLIC_WS_URL) check('NEXT_PUBLIC_WS_URL', env.NEXT_PUBLIC_WS_URL, 'wss');
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const risky = secretLookingPublicVars(process.env);
  if (risky.length) {
    console.warn(`Warning: ${risky.join(', ')} would be embedded in the app bundle if referenced; keep keys server-side.`);
  }
  const problems = releaseProblems(process.env);
  if (problems.length) {
    console.error(`Release build blocked:\n  - ${problems.join('\n  - ')}`);
    process.exit(1);
  }
  console.log(`release env ok: ${process.env.NEXT_PUBLIC_API_URL}`);
}
