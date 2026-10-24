import { describe, expect, it } from 'vitest';
import { isAllowedOrigin } from './cors';

describe('isAllowedOrigin', () => {
  it('accepts local and LAN origins on any port outside production', () => {
    for (const o of [
      'http://localhost:4200',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://192.168.1.20:3000',
      'http://10.0.0.7:4200',
      'http://172.20.1.1:3000',
    ]) {
      expect(isAllowedOrigin(o, {}), o).toBe(true);
    }
  });

  it('rejects other hosts, lookalikes and public IPs', () => {
    for (const o of [
      'https://evil.example',
      'http://localhost.evil.example:3000',
      'http://192.168.1.20.evil.example',
      'http://172.32.0.1:3000',
      'http://8.8.8.8:3000',
    ]) {
      expect(isAllowedOrigin(o, {}), o).toBe(false);
    }
  });

  it('in production allows only CORS_ORIGIN and the native app origins', () => {
    const env = { NODE_ENV: 'production', CORS_ORIGIN: 'https://news.example.com, https://www.example.com' };
    expect(isAllowedOrigin('https://news.example.com', env)).toBe(true);
    expect(isAllowedOrigin('https://www.example.com', env)).toBe(true);
    expect(isAllowedOrigin('capacitor://localhost', env)).toBe(true);
    expect(isAllowedOrigin('http://localhost:4200', env)).toBe(false);
  });
});
