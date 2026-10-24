'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bookmark, Home, Radio, Search, Settings, LayoutGrid } from 'lucide-react';

const TABS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/search/', label: 'Search', icon: Search },
  { href: '/topics/', label: 'Topics', icon: LayoutGrid },
  { href: '/bookmarks/', label: 'Saved', icon: Bookmark },
  { href: '/live/', label: 'Live', icon: Radio },
  { href: '/settings/', label: 'Settings', icon: Settings },
] as const;

export default function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-6">
        {TABS.map(({ href, label, icon: Icon }) => {
          const base = href.replace(/\/$/, '');
          const active =
            href === '/'
              ? pathname === '/'
              : pathname.startsWith(base) || (base === '/search' && pathname.startsWith('/story'));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold uppercase tracking-wide ${
                  active ? 'text-accent' : 'text-muted'
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-md ${
                    active ? 'bg-accent-soft' : ''
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
