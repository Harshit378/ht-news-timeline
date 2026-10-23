'use client';

import { useEffect, useRef } from 'react';

export default function PageHeader({
  kicker,
  title,
  subtitle,
  action,
  children,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  /** Right-aligned control next to the title (e.g. pin button). */
  action?: React.ReactNode;
  /** Extra sticky content under the title (filter chips, search input). */
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  // Publish the header height so sticky date labels can pin directly below it.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty('--page-header-h', `${el.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--page-header-h');
    };
  }, []);

  return (
    <header
      ref={ref}
      className="sticky top-0 z-20 border-b border-border bg-bg/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md">
      {kicker && (
        <p className="mb-1 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-gold">
          {kicker}
        </p>
      )}
      <div className="flex items-start gap-3">
        <h1 className="min-w-0 flex-1 font-serif text-[28px] font-black leading-[1.05] tracking-tight text-ink">
          {title}
        </h1>
        {action}
      </div>
      {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      {children && <div className="mt-3">{children}</div>}
    </header>
  );
}
