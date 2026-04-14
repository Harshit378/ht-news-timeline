'use client';

import { useEffect, useState } from 'react';
import { TimelineEvent } from '@/app/types/timeline';
import { fetchTopHeadlines } from '../services/topHeadlinesService';
import { searchEverything } from '../services/everythingService';

interface UseNewsResult {
  articles: TimelineEvent[];
  loading: boolean;
  error: string | null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unable to load news content.';
}

export function useTopHeadlines(country: string): UseNewsResult {
  const [articles, setArticles] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!country) {
      setArticles([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchTopHeadlines(country)
      .then((data: TimelineEvent[]) => {
        if (!cancelled) {
          setArticles(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(getErrorMessage(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [country]);

  return { articles, loading, error };
}

export function useEverythingSearch(query: string): UseNewsResult {
  const [articles, setArticles] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query) {
      setArticles([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    searchEverything(query)
      .then((data: TimelineEvent[]) => {
        if (!cancelled) {
          setArticles(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(getErrorMessage(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  return { articles, loading, error };
}
