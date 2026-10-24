import type { FeedArticle } from '@ht/shared/article';

/**
 * Articles seen in this session (feed, story timelines), so the detail screen opens instantly by id;
 * unknown ids are fetched from the API.
 */
const seen = new Map<string, FeedArticle>();
const MAX = 1000;

export function rememberArticles(items: FeedArticle[]) {
  for (const a of items) {
    seen.delete(a.id);
    seen.set(a.id, a);
  }
  while (seen.size > MAX) seen.delete(seen.keys().next().value as string);
}

export function knownArticle(id: string): FeedArticle | undefined {
  return seen.get(id);
}
