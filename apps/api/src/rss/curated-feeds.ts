/**
 * Publisher feeds seeded on boot (ADR-008 layer 2). Only headline, excerpt, link and image are
 * stored — never full article bodies. AP and Reuters no longer publish public RSS.
 * All URLs verified reachable on 2026-10-24.
 */
export interface CuratedFeed {
  url: string;
  title: string;
  source: string;
  category: string;
}

export const CURATED_FEEDS: CuratedFeed[] = [
  { category: 'world', source: 'BBC News', title: 'BBC News — World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { category: 'world', source: 'The Guardian', title: 'The Guardian — World', url: 'https://www.theguardian.com/world/rss' },
  { category: 'world', source: 'NPR', title: 'NPR — World', url: 'https://feeds.npr.org/1004/rss.xml' },
  { category: 'world', source: 'Al Jazeera', title: 'Al Jazeera — All news', url: 'https://www.aljazeera.com/xml/rss/all.xml' },

  { category: 'tech', source: 'BBC News', title: 'BBC News — Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { category: 'tech', source: 'Ars Technica', title: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { category: 'tech', source: 'The Verge', title: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },

  { category: 'finance', source: 'BBC News', title: 'BBC News — Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { category: 'finance', source: 'The Guardian', title: 'The Guardian — Business', url: 'https://www.theguardian.com/business/rss' },

  { category: 'science', source: 'BBC News', title: 'BBC News — Science & Environment', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml' },
  { category: 'science', source: 'NASA', title: 'NASA — News Releases', url: 'https://www.nasa.gov/news-release/feed/' },
  { category: 'science', source: 'The Guardian', title: 'The Guardian — Science', url: 'https://www.theguardian.com/science/rss' },

  { category: 'politics', source: 'NPR', title: 'NPR — Politics', url: 'https://feeds.npr.org/1014/rss.xml' },
  { category: 'politics', source: 'The Guardian', title: 'The Guardian — Politics', url: 'https://www.theguardian.com/politics/rss' },

  { category: 'climate', source: 'The Guardian', title: 'The Guardian — Environment', url: 'https://www.theguardian.com/environment/rss' },

  { category: 'health', source: 'BBC News', title: 'BBC News — Health', url: 'https://feeds.bbci.co.uk/news/health/rss.xml' },
  { category: 'health', source: 'NPR', title: 'NPR — Health', url: 'https://feeds.npr.org/1128/rss.xml' },

  { category: 'culture', source: 'The Guardian', title: 'The Guardian — Culture', url: 'https://www.theguardian.com/culture/rss' },
  { category: 'culture', source: 'BBC News', title: 'BBC News — Entertainment & Arts', url: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml' },

  { category: 'sports', source: 'ESPN', title: 'ESPN — Top Headlines', url: 'https://www.espn.com/espn/rss/news' },
  { category: 'sports', source: 'ESPN', title: 'ESPN — MLB', url: 'https://www.espn.com/espn/rss/mlb/news' },
  { category: 'sports', source: 'BBC Sport', title: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml' },

  { category: 'opinion', source: 'The Guardian', title: 'The Guardian — Comment is Free', url: 'https://www.theguardian.com/commentisfree/rss' },
];
