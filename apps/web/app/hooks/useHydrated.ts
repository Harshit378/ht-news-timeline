'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False during static prerender + hydration, true afterwards. Use it to render
 * locale/time-dependent text (dates) that would otherwise bake in the build machine's
 * clock and locale and cause a hydration mismatch (React #418).
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
