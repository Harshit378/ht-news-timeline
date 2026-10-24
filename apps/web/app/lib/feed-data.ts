import storiesData from '@/app/data/stories.json';
import {
  CATEGORY_EMOJI,
  type ArticleCategory,
  type BreakingNewsPayload,
  type FeedArticle,
} from '@/app/types/article';

function estimateReadMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function topicToCategory(topicId: string): ArticleCategory {
  const map: Record<string, ArticleCategory> = {
    'ai-revolution': 'tech',
    'tech-startups': 'tech',
    'quantum-computing': 'science',
    'climate-change': 'climate',
    'renewable-energy': 'climate',
    'space-exploration': 'science',
  };
  return map[topicId] ?? 'world';
}

/** Refine category using tags / headline heuristics */
function refineCategory(
  topicId: string,
  tags: string[],
  title: string,
  description: string
): ArticleCategory {
  let c = topicToCategory(topicId);
  const blob = `${title} ${description} ${tags.join(' ')}`.toLowerCase();
  if (/finance|funding|valuation|market|invest|billion|economy|carbon pricing/i.test(blob)) {
    c = 'finance';
  }
  if (/election|parliament|government|policy|regulation|summit|minister|vote/i.test(blob)) {
    c = 'politics';
  }
  if (/climate|cop|emission|renewable|solar|wind|green|warming/i.test(blob)) {
    c = 'climate';
  }
  if (/ai|software|startup|quantum|tech|gpt|google|microsoft/i.test(blob) && c === 'world') {
    c = 'tech';
  }
  return c;
}

const BREAKING_IDS = new Set(['se-6', 'ai-1', 'cc-4']);

export function buildFeedArticles(): FeedArticle[] {
  const out: FeedArticle[] = [];
  const stories = storiesData.stories as Record<
    string,
    { topicId: string; events: Array<Record<string, string | string[]>> }
  >;

  let i = 0;
  for (const topic of Object.values(stories)) {
    for (const ev of topic.events) {
      const id = String(ev.id);
      const dateStr = String(ev.date);
      const [y, mo, d] = dateStr.split('-').map(Number);
      const base = new Date(y, (mo ?? 1) - 1, d ?? 1);
      base.setHours(8 + (i % 10), 10 + (i % 40), 0, 0);
      i += 1;

      const tags = Array.isArray(ev.tags) ? ev.tags.map(String) : [];
      const title = String(ev.title);
      const description = String(ev.description);
      const category = refineCategory(topic.topicId, tags, title, description);

      out.push({
        id,
        title,
        excerpt: description,
        publishedAt: base.toISOString(),
        source: String(ev.source),
        category,
        isBreaking: BREAKING_IDS.has(id),
        body: String(ev.content),
        imageUrl: String(ev.imageUrl),
        thumbnailEmoji: CATEGORY_EMOJI[category],
        tags,
        readTimeMinutes: estimateReadMinutes(String(ev.content)),
      });
    }
  }

  return out.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

export function getBreakingFromArticles(articles: FeedArticle[]): BreakingNewsPayload | null {
  const b = articles.find((a) => a.isBreaking);
  if (!b) return null;
  return {
    articleId: b.id,
    headline: b.title,
    publishedAt: b.publishedAt,
  };
}
