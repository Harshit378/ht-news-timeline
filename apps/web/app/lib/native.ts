'use client';

import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

/**
 * Platform helpers shared by web/PWA and the Capacitor native shell (ADR-001 Path A).
 * Every helper degrades to the web API when not running natively.
 */

export const isNative = () => Capacitor.isNativePlatform();

export interface ShareInput {
  title: string;
  text?: string;
  url?: string;
}

/** Returns 'shared' | 'copied' | 'unavailable'. */
export async function shareContent({ title, text, url }: ShareInput) {
  if (isNative()) {
    try {
      await Share.share({ title, text, url, dialogTitle: 'Share story' });
      return 'shared' as const;
    } catch {
      return 'unavailable' as const; // user cancelled
    }
  }
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return 'shared' as const;
    } catch {
      return 'unavailable' as const; // user cancelled
    }
  }
  const payload = url ?? `${title}${text ? `\n\n${text}` : ''}`;
  try {
    await navigator.clipboard.writeText(payload);
    return 'copied' as const;
  } catch {
    return 'unavailable' as const;
  }
}
