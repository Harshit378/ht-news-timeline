import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Hosting & Security Headers (ADR-006)', () => {
  it('provides _headers file for Cloudflare Pages and Netlify', () => {
    const headersPath = path.resolve(__dirname, '../public/_headers');
    expect(fs.existsSync(headersPath)).toBe(true);
    const content = fs.readFileSync(headersPath, 'utf-8');
    expect(content).toContain('/sw.js');
    expect(content).toContain('Cache-Control: no-cache, no-store, must-revalidate');
    expect(content).toContain('Strict-Transport-Security');
    expect(content).toContain('X-Frame-Options: DENY');
    expect(content).toContain('X-Content-Type-Options: nosniff');
    expect(content).toContain('/_next/static/*');
    expect(content).toContain('max-age=31536000, immutable');
  });

  it('provides vercel.json with security and caching rules for Vercel', () => {
    const vercelPath = path.resolve(__dirname, '../vercel.json');
    expect(fs.existsSync(vercelPath)).toBe(true);
    const json = JSON.parse(fs.readFileSync(vercelPath, 'utf-8'));
    expect(Array.isArray(json.headers)).toBe(true);
    const sw = json.headers.find((h: { source: string }) => h.source === '/sw.js');
    expect(sw).toBeDefined();
    const staticChunks = json.headers.find((h: { source: string }) => h.source.includes('_next/static'));
    expect(staticChunks).toBeDefined();
  });
});
