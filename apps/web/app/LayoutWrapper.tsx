'use client';

import { NewsProvider } from '@/app/contexts/NewsContext';
import { FeedProvider } from '@/app/contexts/FeedContext';
import { ThemeProvider } from '@/app/contexts/ThemeContext';
import { LiveEventsProvider } from '@/app/features/live-events/LiveEventsContext';
import AppShell from '@/app/components/shell/AppShell';
import { PWAInitializer } from './components/PWAInitializer';
import { NativeInitializer } from './components/NativeInitializer';
import { ReactNode } from 'react';

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <NewsProvider>
        <FeedProvider>
          <LiveEventsProvider>
            <PWAInitializer />
            <NativeInitializer />
            <AppShell>{children}</AppShell>
          </LiveEventsProvider>
        </FeedProvider>
      </NewsProvider>
    </ThemeProvider>
  );
}
