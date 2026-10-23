'use client';

import { Suspense } from 'react';
import BottomTabBar from '@/app/components/shell/BottomTabBar';
import ArticleUrlSync from '@/app/components/shell/ArticleUrlSync';
import ArticleDetailPanel from '@/app/components/timeline/ArticleDetailPanel';
import { useFeed } from '@/app/contexts/FeedContext';

/** Single-column mobile shell (ADR-001): page content, bottom tab bar, article overlay. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { activeArticle } = useFeed();

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <Suspense fallback={null}>
        <ArticleUrlSync />
      </Suspense>
      <div className="mx-auto max-w-lg pb-[calc(56px+env(safe-area-inset-bottom))]">{children}</div>
      <BottomTabBar />
      {activeArticle && <ArticleDetailPanel />}
    </div>
  );
}
