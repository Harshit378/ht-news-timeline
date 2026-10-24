export interface RSSFeed {
  id: string;
  title: string;
  url: string;
  description?: string;
  category: string;
  lastChecked?: string;
  itemCount: number;
  isActive: boolean;
  addedAt: string;
}

export interface RSSItem {
  id: string;
  feedId: string;
  title: string;
  description: string;
  content?: string;
  link: string;
  pubDate: string;
  author?: string;
  imageUrl?: string;
  categories?: string[];
}

export interface RSSParseResult {
  feed: RSSFeed;
  items: RSSItem[];
  parseTime: number; // ms
}
