import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // apps/web/__tests__/phase4.test.ts was written Jest-style (global describe/it).
    globals: true,
    include: ['apps/**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', 'dist/**', 'apps/web/out/**', 'apps/web/.next/**', 'apps/web/ios/**', 'apps/web/android/**'],
  },
});
