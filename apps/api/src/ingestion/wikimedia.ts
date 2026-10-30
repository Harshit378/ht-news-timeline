import { createHash } from 'crypto';
import { clipText } from '../rss/rss.service';
import { ArticleRecord } from '../store/types';

/** A dated event pulled from a Wikipedia page (ADR-008 step 6: the story's skeleton). */
export interface Milestone {
  date: Date;
  text: string;
  /** Heading the event sits under, for the section link. */
  section: string | null;
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const MONTH = `(${MONTHS.join('|')})`;
const SKIP_SECTIONS = /^(see also|references|notes|further reading|external links|sources|bibliography|footnotes|citations)$/i;
const MAX_TEXT = 300;

function monthIndex(name: string) {
  return MONTHS.indexOf(name.toLowerCase());
}

/** Removes [[File:…]] / [[Image:…]] / [[Category:…]] links, whose captions can contain nested links. */
function stripFileLinks(s: string): string {
  const start = /\[\[(?:File|Image|Category):/gi;
  let out = '';
  let pos = 0;
  for (let m = start.exec(s); m; m = start.exec(s)) {
    out += s.slice(pos, m.index);
    let depth = 0;
    let i = m.index;
    for (; i < s.length - 1; i++) {
      if (s[i] === '[' && s[i + 1] === '[') {
        depth++;
        i++;
      } else if (s[i] === ']' && s[i + 1] === ']') {
        depth--;
        i++;
        if (depth === 0) break;
      }
    }
    pos = i + 1;
    start.lastIndex = pos;
  }
  return out + s.slice(pos);
}

/** Removes refs, templates, files and markup, leaving readable text. */
export function cleanWikitext(raw: string): string {
  let s = raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
  // Templates nest: strip innermost first until none are left.
  for (let i = 0; i < 10 && /\{\{[^{}]*\}\}/.test(s); i++) s = s.replace(/\{\{[^{}]*\}\}/g, '');
  s = stripFileLinks(s)
    .replace(/\[\[[^|\]]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/\[https?:\/\/[^\s\]]+\s+([^\]]*)\]/g, '$1')
    .replace(/\[https?:\/\/[^\]]+\]/g, '')
    .replace(/'{2,}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&');
  return s.replace(/[ \t]+/g, ' ').trim();
}

function firstSentences(text: string): string {
  const parts = text.split(/(?<=[.!?])\s+(?=[A-Z"“(])/);
  let out = parts[0] ?? '';
  if (out.length < 60 && parts[1]) out = `${out} ${parts[1]}`;
  return clipText(out.trim(), MAX_TEXT);
}

/** "24 February 2022", "February 24, 2022", "24 February" / "February 24" (year from context). */
export function parseDateText(text: string, contextYear: number | null): Date | null {
  const t = text.trim();
  let m = new RegExp(`^(\\d{1,2})\\s+${MONTH}(?:,?\\s+(\\d{4}))?\\b`, 'i').exec(t);
  if (m) return makeDate(Number(m[3] ?? contextYear), monthIndex(m[2]), Number(m[1]));
  m = new RegExp(`^${MONTH}\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?\\b`, 'i').exec(t);
  if (m) return makeDate(Number(m[3] ?? contextYear), monthIndex(m[1]), Number(m[2]));
  return null;
}

function makeDate(year: number, month: number, day: number): Date | null {
  if (!year || year < 1000 || month < 0 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month, day, 12));
  return d.getUTCMonth() === month ? d : null;
}

/**
 * Extracts dated events from a page's wikitext. Handles the common timeline layouts:
 * - date headings ("=== 24 February ===" under "== February 2022 ==") → the first sentence(s) beneath;
 * - bullets that start with a date ("* 24 February 2022 – …");
 * - prose that opens with "On 24 February 2022, …";
 * - hub pages whose sections only point to a dated sub-timeline
 *   ("{{Main|Timeline of the Gaza war (7 October 2023 – 27 October 2023)}}") → the section title on its start date.
 */
export function extractMilestones(wikitext: string): Milestone[] {
  const out: Milestone[] = [];
  let year: number | null = null;
  let section: string | null = null;
  let sectionDate: Date | null = null;
  let sectionUsed = false;
  /** Heading level of a skipped section (References, See also…); its subsections are skipped too. */
  let skipLevel: number | null = null;

  for (const rawLine of wikitext.split('\n')) {
    const heading = /^(={2,6})\s*(.+?)\s*\1\s*$/.exec(rawLine);
    if (heading) {
      const title = cleanWikitext(heading[2]);
      const level = heading[1].length;
      if (skipLevel !== null && level > skipLevel) continue;
      skipLevel = SKIP_SECTIONS.test(title) ? level : null;
      section = title;
      const y = /\b(1[5-9]\d\d|20\d\d)\b/.exec(title);
      if (y) year = Number(y[1]);
      sectionDate = parseDateText(title, year);
      sectionUsed = false;
      continue;
    }
    if (skipLevel !== null) continue;
    const line = rawLine.trim();
    const main = /^\{\{\s*Main\s*\|[^}]*\((\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{1,2},?\s+\d{4})\s*[–—-]/i.exec(line);
    if (main && section && !sectionUsed) {
      const date = parseDateText(main[1], year);
      if (date) {
        out.push({ date, text: section, section });
        sectionUsed = true;
      }
      continue;
    }
    if (!line || /^(\{\||\||!)/.test(line)) continue; // tables

    if (/^[*#]/.test(line)) {
      const text = cleanWikitext(line.replace(/^[*#:]+/, ''));
      const date = parseDateText(text, year);
      if (date) {
        const rest = text.replace(/^[^–—:-]*?\d{4}?\s*[–—:-]\s*/, '').trim();
        if (rest.length >= 20) out.push({ date, text: firstSentences(rest), section });
      }
      continue;
    }

    const text = cleanWikitext(line);
    if (text.length < 40) continue;
    const on = /^On\s+(.+?),\s+(.*)$/.exec(text);
    const onDate = on ? parseDateText(on[1], year) : null;
    if (onDate) {
      const sentence = firstSentences(on![2]);
      out.push({ date: onDate, text: sentence.charAt(0).toUpperCase() + sentence.slice(1), section });
    } else if (sectionDate && !sectionUsed) {
      out.push({ date: sectionDate, text: firstSentences(text), section });
      sectionUsed = true;
    }
  }
  return out;
}

/** Keeps the arc readable: at most `max` events, spread evenly across time, deduped. */
export function spreadMilestones(items: Milestone[], max: number): Milestone[] {
  const seen = new Set<string>();
  const unique = [...items]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .filter((m) => {
      const key = `${m.date.toISOString().slice(0, 10)}|${m.text.slice(0, 60).toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (unique.length <= max) return unique;
  const step = (unique.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => unique[Math.round(i * step)]);
}

/** Query and page title share a word stem (first 4 letters), e.g. "Russia Ukraine" ~ "Russo-Ukrainian war". */
export function titleMatchesQuery(title: string, query: string): boolean {
  const stems = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length >= 4 && !['timeline', 'with', 'from', 'this', 'that'].includes(w))
        .map((w) => w.slice(0, 4)),
    );
  const q = stems(query);
  return [...stems(title)].some((s) => q.has(s));
}

export function pageUrl(title: string) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

export function milestoneToRecord(m: Milestone, title: string, category = 'world'): ArticleRecord {
  const id = createHash('sha1').update(`${title}|${m.date.toISOString()}|${m.text}`).digest('hex').slice(0, 16);
  const anchor = m.section ? `#${encodeURIComponent(m.section.replace(/ /g, '_'))}` : '';
  return {
    id,
    headline: m.text,
    excerpt: `${m.text} (Wikipedia: ${title})`,
    body: null,
    source: 'Wikipedia',
    sourceDomain: 'en.wikipedia.org',
    // Article.url is unique; several events can share one section, so the id keeps each URL distinct.
    url: `${pageUrl(title)}?ht=${id}${anchor}`,
    category,
    publishedAt: m.date,
    imageUrl: null,
    sentiment: null,
    bias: null,
    importance: 'normal',
    storyClusterId: null,
    tone: null,
    kind: 'milestone',
  };
}
