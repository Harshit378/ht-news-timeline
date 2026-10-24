'use client';

import { useCallback, useEffect, useState } from 'react';
import PageHeader from '@/app/components/shell/PageHeader';
import RSSFeedsManager from '@/app/features/rss-feeds/RSSFeedsManager';
import {
  addRSSFeed,
  listRSSFeeds,
  removeRSSFeed,
  toggleRSSFeed,
} from '@/app/features/rss-feeds/rssService';
import type { RSSFeed } from '@/app/features/rss-feeds/types';
import { useTheme, type ThemePreference } from '@/app/contexts/ThemeContext';
import { API_BASE_URL } from '@/app/lib/api-client';
import { APP_NAME, APP_VERSION } from '@/app/lib/app-info';
import { clearRecentSearches } from '@/app/lib/recent-searches';
import { useFeed } from '@/app/contexts/FeedContext';
import { REGIONS, regionFromLocale } from '@/app/lib/region';
import { useHydrated } from '@/app/hooks/useHydrated';

const THEMES: { id: ThemePreference; label: string }[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'system', label: 'System' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-gold">{title}</h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const { preference, setPreference } = useTheme();
  const { regionSetting, region, setRegionSetting } = useFeed();
  const hydrated = useHydrated();
  const detected = hydrated ? regionFromLocale(navigator.language) : null;
  const detectedLabel = REGIONS.find((r) => r.code === detected)?.label ?? detected;
  const regionOptions = [
    { id: 'auto', label: detectedLabel ? `Automatic (${detectedLabel})` : 'Automatic' },
    ...REGIONS.map((r) => ({ id: r.code as string, label: r.label })),
    { id: 'off', label: 'No preference' },
  ];
  const [feeds, setFeeds] = useState<RSSFeed[]>([]);
  const [feedsLoading, setFeedsLoading] = useState(true);
  const [feedsError, setFeedsError] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);

  const loadFeeds = useCallback(async () => {
    setFeedsLoading(true);
    try {
      setFeeds(await listRSSFeeds());
      setFeedsError(null);
    } catch {
      setFeedsError('Custom feeds need the News Timeline server — it is unreachable right now.');
    } finally {
      setFeedsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFeeds();
  }, [loadFeeds]);

  return (
    <>
      <PageHeader kicker="Preferences" title="Settings" />
      <main className="px-4 py-5">
        <Section title="Appearance">
          <div className="flex rounded-full border border-border p-0.5" role="radiogroup" aria-label="Theme">
            {THEMES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={preference === id}
                onClick={() => setPreference(id)}
                className={`min-h-[40px] flex-1 rounded-full text-sm font-semibold ${
                  preference === id ? 'bg-accent text-white' : 'text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Region">
          <p className="mb-3 text-sm text-muted">
            News from your region ranks higher in the feed. Nothing is hidden, and your location never leaves this
            device.
          </p>
          <div className="divide-y divide-border rounded-[10px] border border-border" role="radiogroup" aria-label="Region">
            {regionOptions.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={regionSetting === id}
                onClick={() => setRegionSetting(id)}
                className="flex min-h-[48px] w-full items-center justify-between px-4 text-left text-sm text-ink active:bg-surface"
              >
                {label}
                {regionSetting === id && <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />}
              </button>
            ))}
          </div>
          {hydrated && (
            <p className="mt-2 font-mono text-[11px] text-muted">
              {region ? `Boosting ${REGIONS.find((r) => r.code === region)?.label ?? region}` : 'No regional boost'}
            </p>
          )}
        </Section>

        <Section title="Custom RSS feeds">
          {feedsError ? (
            <p className="rounded-[10px] border border-border bg-surface p-4 text-sm text-muted">{feedsError}</p>
          ) : (
            <RSSFeedsManager
              feeds={feeds}
              isLoading={feedsLoading}
              onAddFeed={async (url, category) => {
                await addRSSFeed(url, category);
                await loadFeeds();
              }}
              onRemoveFeed={async (id) => {
                await removeRSSFeed(id);
                await loadFeeds();
              }}
              onToggleFeed={async (id, isActive) => {
                await toggleRSSFeed(id, isActive);
                await loadFeeds();
              }}
            />
          )}
        </Section>

        <Section title="Data & privacy">
          <button
            type="button"
            onClick={() => {
              clearRecentSearches();
              setCleared(true);
            }}
            className="flex min-h-[48px] w-full items-center justify-between rounded-[10px] border border-border bg-surface-alt px-4 text-sm text-ink active:bg-surface"
          >
            Clear search history
            {cleared && <span className="font-mono text-[11px] text-gold">Cleared</span>}
          </button>
        </Section>

        <Section title="About">
          <dl className="divide-y divide-border rounded-[10px] border border-border text-sm">
            <div className="flex justify-between px-4 py-3">
              <dt className="text-muted">App</dt>
              <dd className="text-ink">{APP_NAME}</dd>
            </div>
            <div className="flex justify-between px-4 py-3">
              <dt className="text-muted">Version</dt>
              <dd className="font-mono text-ink">{APP_VERSION}</dd>
            </div>
            <div className="flex justify-between gap-4 px-4 py-3">
              <dt className="shrink-0 text-muted">Server</dt>
              <dd className="truncate font-mono text-xs text-ink">{API_BASE_URL}</dd>
            </div>
          </dl>
        </Section>
      </main>
    </>
  );
}
