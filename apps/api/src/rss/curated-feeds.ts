/**
 * Publisher feeds seeded on boot (ADR-008 layer 2). Only headline, excerpt, link and image are
 * stored — never full article bodies. AP and Reuters no longer publish public RSS.
 * All URLs verified reachable on 2026-10-24. Times of India feeds carry Indian news (ADR-009 will make
 * region-aware selection).
 */
export interface CuratedFeed {
  url: string;
  title: string;
  source: string;
  category: string;
  /** Outlet's country (ISO 3166-1 alpha-2) or GLOBAL, for region-aware ranking (ADR-009). */
  region: string;
}

export const CURATED_FEEDS: CuratedFeed[] = [
  { category: 'world', source: 'BBC News', region: 'GB', title: 'BBC News — World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { category: 'world', source: 'The Guardian', region: 'GB', title: 'The Guardian — World', url: 'https://www.theguardian.com/world/rss' },
  { category: 'world', source: 'NPR', region: 'US', title: 'NPR — World', url: 'https://feeds.npr.org/1004/rss.xml' },
  { category: 'world', source: 'Times of India', region: 'IN', title: 'Times of India — Top Stories', url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms' },
  { category: 'world', source: 'Times of India', region: 'IN', title: 'Times of India — India', url: 'https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms' },
  { category: 'world', source: 'Times of India', region: 'IN', title: 'Times of India — World', url: 'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms' },
  { category: 'world', source: 'Al Jazeera', region: 'GLOBAL', title: 'Al Jazeera — All news', url: 'https://www.aljazeera.com/xml/rss/all.xml' },

  { category: 'tech', source: 'BBC News', region: 'GB', title: 'BBC News — Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { category: 'tech', source: 'Ars Technica', region: 'US', title: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { category: 'tech', source: 'The Verge', region: 'US', title: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { category: 'tech', source: 'Times of India', region: 'IN', title: 'Times of India — Technology', url: 'https://timesofindia.indiatimes.com/rssfeeds/5880659.cms' },

  { category: 'finance', source: 'BBC News', region: 'GB', title: 'BBC News — Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { category: 'finance', source: 'The Guardian', region: 'GB', title: 'The Guardian — Business', url: 'https://www.theguardian.com/business/rss' },
  { category: 'finance', source: 'Times of India', region: 'IN', title: 'Times of India — Business', url: 'https://timesofindia.indiatimes.com/rssfeeds/1898055.cms' },

  { category: 'science', source: 'BBC News', region: 'GB', title: 'BBC News — Science & Environment', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml' },
  { category: 'science', source: 'NASA', region: 'US', title: 'NASA — News Releases', url: 'https://www.nasa.gov/news-release/feed/' },
  { category: 'science', source: 'The Guardian', region: 'GB', title: 'The Guardian — Science', url: 'https://www.theguardian.com/science/rss' },
  { category: 'science', source: 'Times of India', region: 'IN', title: 'Times of India — Science', url: 'https://timesofindia.indiatimes.com/rssfeeds/-2128672765.cms' },

  { category: 'politics', source: 'NPR', region: 'US', title: 'NPR — Politics', url: 'https://feeds.npr.org/1014/rss.xml' },
  { category: 'politics', source: 'The Guardian', region: 'GB', title: 'The Guardian — Politics', url: 'https://www.theguardian.com/politics/rss' },

  { category: 'climate', source: 'The Guardian', region: 'GB', title: 'The Guardian — Environment', url: 'https://www.theguardian.com/environment/rss' },

  { category: 'health', source: 'BBC News', region: 'GB', title: 'BBC News — Health', url: 'https://feeds.bbci.co.uk/news/health/rss.xml' },
  { category: 'health', source: 'NPR', region: 'US', title: 'NPR — Health', url: 'https://feeds.npr.org/1128/rss.xml' },
  { category: 'health', source: 'Times of India', region: 'IN', title: 'Times of India — Health & Fitness', url: 'https://timesofindia.indiatimes.com/rssfeeds/3908999.cms' },

  { category: 'culture', source: 'The Guardian', region: 'GB', title: 'The Guardian — Culture', url: 'https://www.theguardian.com/culture/rss' },
  { category: 'culture', source: 'BBC News', region: 'GB', title: 'BBC News — Entertainment & Arts', url: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml' },
  { category: 'culture', source: 'Times of India', region: 'IN', title: 'Times of India — Entertainment', url: 'https://timesofindia.indiatimes.com/rssfeeds/1081479906.cms' },

  { category: 'sports', source: 'ESPN', region: 'US', title: 'ESPN — Top Headlines', url: 'https://www.espn.com/espn/rss/news' },
  { category: 'sports', source: 'ESPN', region: 'US', title: 'ESPN — MLB', url: 'https://www.espn.com/espn/rss/mlb/news' },
  { category: 'sports', source: 'BBC Sport', region: 'GB', title: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml' },
  { category: 'sports', source: 'Times of India', region: 'IN', title: 'Times of India — Sports', url: 'https://timesofindia.indiatimes.com/rssfeeds/4719148.cms' },
  { category: 'sports', source: 'Times of India', region: 'IN', title: 'Times of India — Cricket', url: 'https://timesofindia.indiatimes.com/rssfeeds/4719161.cms' },

  { category: 'opinion', source: 'The Guardian', region: 'GB', title: 'The Guardian — Comment is Free', url: 'https://www.theguardian.com/commentisfree/rss' },
];
