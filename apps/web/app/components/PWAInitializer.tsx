'use client';

import { useEffect } from 'react';
import { isNative } from '@/app/lib/native';

export function PWAInitializer() {
  useEffect(() => {
    // The native shell already serves assets from the app bundle; a SW would only add staleness.
    if (isNative()) return;
    // In dev, a cache-first SW serves stale /_next chunks (ChunkLoadError) — only run it in production,
    // and remove any worker left over from an earlier visit.
    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker?.getRegistrations().then((rs) => rs.forEach((r) => void r.unregister()));
      void caches?.keys().then((ks) => ks.forEach((k) => void caches.delete(k)));
      return;
    }
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const register = () => {
        navigator.serviceWorker
          .register('/sw.js', { scope: '/' })
          .then((registration) => {
            console.log('[PWA] Service Worker registered:', registration);

            // Check for updates periodically
            setInterval(() => {
              registration.update();
            }, 60000); // Check every minute
          })
          .catch((error) => {
            console.warn('[PWA] Service Worker registration failed:', error);
          });
      };
      // This effect runs after hydration, often after `load` has already fired.
      if (document.readyState === 'complete') register();
      else window.addEventListener('load', register, { once: true });

      // Handle service worker updates
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] Service Worker updated');
        // Optionally show a notification to user
      });

      // Request permission for push notifications
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            console.log('[PWA] Push notification permission granted');
          }
        });
      }
    }
  }, []);

  return null;
}

// Helper: Check if app is installed
export function useIsInstalled() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', () => {
        // App can be installed
        console.log('[PWA] Install prompt available');
      });

      window.addEventListener('appinstalled', () => {
        console.log('[PWA] App installed');
      });
    }
  }, []);
}

// Helper: Request background sync
export async function requestBackgroundSync(tag: string) {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await (registration as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register(tag);
      console.log(`[PWA] Background sync registered: ${tag}`);
    } catch (error) {
      console.error('[PWA] Background sync registration failed:', error);
    }
  }
}

// Helper: Send push notification
export async function sendPushNotification(title: string, options?: NotificationOptions) {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        ...options,
      });
    } catch (error) {
      console.error('[PWA] Failed to send notification:', error);
    }
  }
}
