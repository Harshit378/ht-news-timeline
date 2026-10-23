'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFeed } from '@/app/contexts/FeedContext';

/** Keeps the article overlay in sync with `?article=` (deep links, back gesture, Android back). */
export default function ArticleUrlSync() {
  const searchParams = useSearchParams();
  const { syncActiveArticleFromUrl } = useFeed();
  const articleId = searchParams.get('article');

  useEffect(() => {
    syncActiveArticleFromUrl(articleId);
  }, [articleId, syncActiveArticleFromUrl]);

  return null;
}
