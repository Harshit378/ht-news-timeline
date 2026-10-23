'use client';

import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { useTheme } from '@/app/contexts/ThemeContext';
import { isNative } from '@/app/lib/native';

const THEME_BG = { dark: '#0a0a0b', light: '#f6f3ee' } as const;

/** Native-shell wiring (no-op on web): status bar follows the theme, Android back button, splash. */
export function NativeInitializer() {
  const { theme } = useTheme();

  useEffect(() => {
    if (!isNative()) return;
    void SplashScreen.hide();

    // Android hardware back: close the article overlay / go back a page / leave the app.
    const sub = App.addListener('backButton', ({ canGoBack }) => {
      const overlayOpen = new URL(window.location.href).searchParams.has('article');
      if (overlayOpen || canGoBack) window.history.back();
      else void App.exitApp();
    });
    return () => {
      void sub.then((s) => s.remove());
    };
  }, []);

  useEffect(() => {
    if (!isNative()) return;
    // Style.Dark = light text, for dark backgrounds.
    void StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light });
    if (window.navigator.userAgent.includes('Android')) {
      void StatusBar.setBackgroundColor({ color: THEME_BG[theme] });
    }
  }, [theme]);

  return null;
}
