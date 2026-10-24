'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import EmptyState from '@/app/components/shell/EmptyState';
import { storyHref } from '@/app/lib/story-query';
import { useHydrated } from '@/app/hooks/useHydrated';

// Static export can't do server redirects, so legacy `/news/<query>` links are forwarded here.
export default function NotFound() {
  const pathname = usePathname();
  const router = useRouter();
  // 404.html is prerendered without the real path; decide only after hydration to avoid React #418.
  const hydrated = useHydrated();
  const legacy = hydrated ? (pathname?.match(/^\/news\/([^/]+)\/?$/)?.[1] ?? null) : null;

  useEffect(() => {
    if (legacy) router.replace(storyHref(decodeURIComponent(legacy).replace(/-/g, ' ')));
  }, [legacy, router]);

  if (legacy) return <EmptyState title="Opening story…" />;

  return (
    <EmptyState title="Page not found" body="This page doesn't exist — but every story has a timeline.">
      <Link
        href="/search/"
        className="inline-flex min-h-[44px] items-center rounded-full bg-accent px-5 text-sm font-semibold text-white"
      >
        Search stories
      </Link>
    </EmptyState>
  );
}
