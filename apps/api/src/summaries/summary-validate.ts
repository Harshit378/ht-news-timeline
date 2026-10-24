import { clipText } from '../rss/rss.service';

export interface LlmSummary {
  summary: string;
  keyPoints: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  relatedTopics: string[];
}

const SENTIMENTS = new Set(['positive', 'neutral', 'negative']);

const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

/** Normalises the model's JSON; null when it is unusable (caller retries once, then falls back). */
export function validateSummary(raw: unknown): LlmSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const summary = clipText(clean(r.summary), 700);
  if (summary.length < 40) return null;
  const keyPoints = (Array.isArray(r.keyPoints) ? r.keyPoints : [])
    .map(clean)
    .map((p) => p.replace(/^[-•*\d.)\s]+/, ''))
    .filter((p) => p.length >= 3)
    .map((p) => clipText(p, 160))
    .slice(0, 5);
  if (keyPoints.length < 2) return null;
  const sentiment = clean(r.sentiment).toLowerCase();
  const relatedTopics = (Array.isArray(r.relatedTopics) ? r.relatedTopics : [])
    .map(clean)
    .filter((t) => t.length > 0 && t.length <= 40)
    .map((t) => t.toLowerCase())
    .slice(0, 3);
  return {
    summary,
    keyPoints,
    sentiment: (SENTIMENTS.has(sentiment) ? sentiment : 'neutral') as LlmSummary['sentiment'],
    relatedTopics,
  };
}
