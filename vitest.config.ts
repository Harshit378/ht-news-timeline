import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Same alias as apps/web/tsconfig.json, so web modules can be tested directly.
  resolve: { alias: { '@/': fileURLToPath(new URL('./apps/web/', import.meta.url)) } },
  test: {
    include: ['apps/**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', 'dist/**', 'apps/web/out/**', 'apps/web/.next/**', 'apps/web/ios/**', 'apps/web/android/**'],
  },
});
