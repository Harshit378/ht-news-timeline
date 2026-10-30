import { clipText } from '../rss/rss.service';

export interface LlmSummary {
  summary: string;
  keyPoints: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  relatedTopics: string[];
  /** Only for story briefs written with comparison (ADR-004). */
  comparison?: SourceComparison;
}

export interface SourceComparison {
  commonThemes: string[];
  differences: { source: string; point: string }[];
}

const SENTIMENTS = new Set(['positive', 'neutral', 'negative']);

const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

/**
 * Comparison fields, kept only when they name real sources from the input (the model must not invent outlets).
 * Undefined when there is nothing usable.
 */
export function validateComparison(raw: Record<string, unknown>, sources: string[]): SourceComparison | undefined {
  const bySourceKey = new Map(sources.map((s) => [s.toLowerCase(), s]));
  const commonThemes = (Array.isArray(raw.commonThemes) ? raw.commonThemes : [])
    .map(clean)
    .filter((t) => t.length >= 3 && t.length <= 60)
    .slice(0, 4);
  const differences = (Array.isArray(raw.differences) ? raw.differences : [])
    .map((d) => (d && typeof d === 'object' ? (d as Record<string, unknown>) : {}))
    .map((d) => ({ source: bySourceKey.get(clean(d.source).toLowerCase()), point: clipText(clean(d.point), 200) }))
    .filter((d): d is { source: string; point: string } => !!d.source && d.point.length >= 10)
    .slice(0, 4);
  if (commonThemes.length === 0 && differences.length === 0) return undefined;
  return { commonThemes, differences };
}

/** Normalises the model's JSON; null when it is unusable (caller retries once, then falls back). */
export function validateSummary(raw: unknown, compareSources?: string[]): LlmSummary | null {
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
  const comparison = compareSources ? validateComparison(r, compareSources) : undefined;
  return {
    summary,
    keyPoints,
    sentiment: (SENTIMENTS.has(sentiment) ? sentiment : 'neutral') as LlmSummary['sentiment'],
    relatedTopics,
    ...(comparison ? { comparison } : {}),
  };
}
