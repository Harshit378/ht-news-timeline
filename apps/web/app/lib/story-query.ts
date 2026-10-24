const STOPWORDS = new Set(
  'a an and are as at be but by for from has have he her his how in into is it its new of on or over says said she that the their them they this to up was what when where who why will with after amid as about than more'.split(
    ' '
  )
);

/**
 * Turns a headline into a short keyword query for "trace this story" (keeps proper nouns first).
 * Words under 3 chars are dropped because GDELT rejects them (see sanitizeStoryQuery in apps/api).
 */
export function deriveStoryQuery(headline: string, maxWords = 4): string {
  const words = headline
    .replace(/[“”"'’‘:;,.!?()[\]|—–-]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w.toLowerCase()));
  const proper = words.filter((w) => /^[A-Z]/.test(w));
  const rest = words.filter((w) => !/^[A-Z]/.test(w));
  return [...proper, ...rest].slice(0, maxWords).join(' ');
}

export function storyHref(q: string, category?: string) {
  const params = new URLSearchParams({ q });
  if (category) params.set('category', category);
  return `/story/?${params.toString()}`;
}
