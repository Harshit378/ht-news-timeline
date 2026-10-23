# Phase 4 Implementation Documentation

## Overview
Phase 4 introduces advanced power-user features to the News Timeline application:
- **Live Event Timelines**: Real-time event coverage with WebSocket integration
- **Source Comparison**: Side-by-side comparison of the same story from multiple sources
- **AI-generated Topic Summaries**: Automated summaries of trending topics
- **PWA & Offline Reading**: Progressive Web App with service worker and offline capabilities
- **Custom RSS Feed Ingestion**: Allow users to add and aggregate custom RSS feeds

## Features

### 1. Live Event Timelines

#### Architecture
- **Type**: Real-time event streaming
- **Location**: `/apps/web/app/features/live-events/`
- **Key Files**:
  - `types.ts` - Type definitions for live events
  - `useWebSocket.ts` - WebSocket hook for real-time updates
  - `LiveEventsContext.tsx` - State management for timelines
  - `LiveEventTimeline.tsx` - UI component

#### Usage
```typescript
import { useLiveEvents } from '@/app/features/live-events/LiveEventsContext';

function MyComponent() {
  const { timelines, activeTimeline, setActiveTimeline } = useLiveEvents();
  
  return (
    <LiveEventTimeline timeline={activeTimeline} />
  );
}
```

#### WebSocket Hook
The `useWebSocket` hook provides:
- Automatic connection management
- Reconnection with exponential backoff (up to 5 attempts)
- Message parsing and type safety
- Error handling and state tracking

```typescript
const { isConnected, lastMessage, error, send } = useWebSocket('wss://api.example.com/live');
```

#### Mock Data
For development without a WebSocket server, mock timelines are provided:
- US Election 2024
- Super Bowl LVIII
- G7 Summit 2024

Status can be: `ongoing`, `completed`, `scheduled`

### 2. Source Comparison

#### Architecture
- **Type**: Multi-source content comparison
- **Location**: `/apps/web/app/features/source-comparison/`
- **Key Files**:
  - `types.ts` - Type definitions for comparisons
  - `SourceComparison.tsx` - UI component

#### Data Structure
```typescript
interface ComparisonArticle {
  id: string;
  storyId: string;
  topic: string;
  sources: SourceVersion[];        // Multiple versions of same story
  commonThemes: string[];           // What all sources agree on
  differences: string[];            // Key disagreements
  aggregatedHeadline: string;      // AI-generated unified headline
}

interface SourceVersion {
  sourceId: string;
  sourceName: string;
  headline: string;
  content: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  bias?: 'left' | 'center' | 'right';
  publishedAt: string;
  url: string;
}
```

#### Features
- Expandable source content
- Sentiment analysis per source
- Bias indicators (left/center/right)
- Common themes and differences highlighting
- External links to full articles

### 3. AI-Generated Topic Summaries

#### Architecture
- **Type**: Automated content summarization
- **Location**: `/apps/web/app/features/ai-summaries/`
- **Key Files**:
  - `types.ts` - Type definitions for summaries
  - `summaryService.ts` - API client and mock generator
  - `TopicSummaryCard.tsx` - UI component

#### API Endpoints (Requires backend implementation)
```
POST /api/summaries/generate
GET /api/summaries/:topicName
GET /api/summaries
```

#### Fallback Mock Implementation
When API is unavailable, `generateMockSummary()` provides:
- Pre-defined summaries for major topics
- Key points based on topic category
- Confidence scores (0.85 default)
- Trend indicators (rising/stable/declining)

#### Summary Data
```typescript
interface TopicSummary {
  id: string;
  topicName: string;
  generatedAt: string;
  summary: string;
  keyPoints: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  articleCount: number;
  sourceCount: number;
  relatedTopics: string[];
  trend: 'rising' | 'stable' | 'declining';
  confidence: number; // 0-1
}
```

### 4. PWA & Offline Reading

#### Architecture
- **Service Worker**: `/apps/web/public/sw.js`
- **Manifest**: `/apps/web/public/manifest.json`
- **Initializer**: `/apps/web/app/components/PWAInitializer.tsx`
- **Metadata**: Updated in `/apps/web/app/layout.tsx`

#### Features
- **Service Worker Registration**: Automatic on page load
- **Cache Strategies**:
  - Assets: Cache-first (fast offline access)
  - API: Network-first (always try fresh data)
  - Fallback: Return cached or offline page
- **Background Sync**: Sync bookmarks when back online
- **Push Notifications**: Ready for push notification support
- **Install Prompt**: Native install to home screen

#### Caching
```javascript
// Essential assets cached on install
ASSETS_TO_CACHE = ['/', '/bookmarks', '/news'];

// Cache names for version management
CACHE_NAME = 'news-timeline-v1';
API_CACHE = 'news-timeline-api-v1';
```

#### PWA Capabilities
```typescript
// Initialize PWA
import { PWAInitializer, useIsInstalled, requestBackgroundSync } from '@/app/components/PWAInitializer';

// Use in your component
<PWAInitializer />

// Request background sync
await requestBackgroundSync('sync-bookmarks');

// Send notifications
await sendPushNotification('New Breaking News', { 
  body: 'Check out the latest updates' 
});
```

#### Manifest Configuration
- **Name**: News Timeline
- **Display**: Standalone (full-screen app look)
- **Theme Color**: #0a0a0b (dark)
- **Shortcuts**: Timeline, Bookmarks quick access
- **Screenshots**: Responsive design showcase

### 5. Custom RSS Feed Ingestion

#### Architecture
- **Type**: Feed aggregation
- **Location**: `/apps/web/app/features/rss-feeds/`
- **Key Files**:
  - `types.ts` - Type definitions
  - `rssService.ts` - API client and mock data
  - `RSSFeedsManager.tsx` - UI component

#### API Endpoints (Requires backend implementation)
```
POST   /api/rss/feeds                  - Add new feed
GET    /api/rss/feeds                  - List all feeds
DELETE /api/rss/feeds/:feedId          - Remove feed
PATCH  /api/rss/feeds/:feedId          - Update feed
GET    /api/rss/feeds/:feedId/items    - Get feed items
POST   /api/rss/parse                  - Parse RSS URL
```

#### Data Structure
```typescript
interface RSSFeed {
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

interface RSSItem {
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
```

#### Mock Data
Pre-configured mock feeds for development:
- Hacker News (tech, active)
- BBC News (world, active)
- TechCrunch (tech, inactive)

#### Features
- Add feeds via URL
- Category assignment
- Enable/disable feeds
- View feed item count
- Parse and validate feeds
- Track last checked time

## Integration Guide

### Adding to Layout
```typescript
// LayoutWrapper.tsx
import { LiveEventsProvider } from '@/app/features/live-events/LiveEventsContext';
import { PWAInitializer } from '@/app/components/PWAInitializer';

export default function LayoutWrapper({ children }) {
  return (
    <ThemeProvider>
      <NewsProvider>
        <FeedProvider>
          <LiveEventsProvider>
            <PWAInitializer />
            {children}
          </LiveEventsProvider>
        </FeedProvider>
      </NewsProvider>
    </ThemeProvider>
  );
}
```

### Creating a Live Events Page
```typescript
'use client';

import { useLiveEvents } from '@/app/features/live-events/LiveEventsContext';
import LiveEventTimeline from '@/app/features/live-events/LiveEventTimeline';

export default function LiveEventsPage() {
  const { timelines } = useLiveEvents();
  
  return (
    <div className="p-4">
      {timelines.map(timeline => (
        <LiveEventTimeline key={timeline.id} timeline={timeline} />
      ))}
    </div>
  );
}
```

### Integrating Source Comparison
```typescript
import SourceComparison from '@/app/features/source-comparison/SourceComparison';

export default function ComparisonPage({ article }) {
  return <SourceComparison article={article} />;
}
```

### Using Topic Summaries
```typescript
import TopicSummaryCard from '@/app/features/ai-summaries/TopicSummaryCard';
import { generateMockSummary } from '@/app/features/ai-summaries/summaryService';

export default function SummariesPage() {
  const summary = generateMockSummary('tech', 15);
  
  return <TopicSummaryCard summary={summary} />;
}
```

### Managing RSS Feeds
```typescript
import RSSFeedsManager from '@/app/features/rss-feeds/RSSFeedsManager';
import { mockRSSFeeds, addRSSFeed } from '@/app/features/rss-feeds/rssService';

export default function RSSPage() {
  const [feeds, setFeeds] = useState(mockRSSFeeds);

  const handleAddFeed = async (url, category) => {
    const newFeed = await addRSSFeed(url, category);
    setFeeds([...feeds, newFeed]);
  };

  return (
    <RSSFeedsManager 
      feeds={feeds}
      onAddFeed={handleAddFeed}
      onRemoveFeed={async (id) => {/* ... */}}
      onToggleFeed={async (id, active) => {/* ... */}}
    />
  );
}
```

## Backend Requirements

Phase 4 requires backend API implementation (NestJS):

### Controllers to Implement
1. **Live Events** (`/api/events`)
2. **Summaries** (`/api/summaries`)
3. **RSS** (`/api/rss`)
4. **Bookmarks Sync** (`/api/bookmarks`)

### Database Tables
```sql
-- Live Events
CREATE TABLE live_timelines (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  category ENUM,
  status ENUM,
  ...
);

-- Topic Summaries
CREATE TABLE topic_summaries (
  id VARCHAR PRIMARY KEY,
  topic_name VARCHAR NOT NULL,
  summary TEXT,
  generated_at TIMESTAMP,
  ...
);

-- RSS Feeds
CREATE TABLE rss_feeds (
  id VARCHAR PRIMARY KEY,
  url VARCHAR NOT NULL UNIQUE,
  category VARCHAR,
  is_active BOOLEAN,
  ...
);
```

## Environment Variables

Add to `.env.local`:
```env
# PWA Configuration
NEXT_PUBLIC_APP_NAME=News Timeline
NEXT_PUBLIC_APP_DESCRIPTION=...

# API URLs for Phase 4
NEXT_PUBLIC_WEBSOCKET_URL=wss://api.example.com/live
NEXT_PUBLIC_SUMMARY_API_URL=http://localhost:4000

# Service Worker Configuration
NEXT_PUBLIC_SW_ENABLED=true
NEXT_PUBLIC_CACHE_VERSION=v1
```

## Testing

Comprehensive test suite at `/apps/web/__tests__/phase4.test.ts`:
- 50+ test cases covering all features
- Error handling and edge cases
- Performance and optimization tests
- Integration scenarios

Run tests:
```bash
pnpm test -- phase4.test.ts
```

## Performance Considerations

1. **WebSocket Management**: Reconnect backoff prevents server overload
2. **Cache Strategy**: Separate caches for assets vs. API responses
3. **Summary Caching**: Reduce API calls with localStorage
4. **Lazy Loading**: RSS items loaded on demand
5. **Service Worker Updates**: Check every 60 seconds

## Security

- RSS URL validation before adding
- Content Security Policy headers for service worker
- No sensitive data in cache (bookmarks excluded from offline)
- CORS-enabled for legitimate API calls
- Input sanitization for article content

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS 14+, Android 9+)

Service Worker support required for offline mode.

## Troubleshooting

### Service Worker Not Registering
- Check browser console for errors
- Ensure `/sw.js` is accessible
- Verify HTTPS in production (localhost ok for dev)

### WebSocket Connection Failing
- Check WebSocket URL in environment
- Verify CORS on WebSocket server
- Check browser console for connection errors

### Offline Mode Not Working
- Clear browser cache and service workers
- Re-register service worker (refresh page)
- Check if app was installed (some browsers require this)

### RSS Feed Not Parsing
- Validate feed URL format
- Check if feed is valid XML
- Verify CORS headers on feed server

## Future Enhancements

1. **Predictive Caching**: Pre-cache likely next articles
2. **AI Context**: Pass user reading history to summaries
3. **Social Sharing**: Share comparisons on social media
4. **Feed Discovery**: Suggest RSS feeds based on interests
5. **Offline Browsing**: Enhance offline UI with more features
6. **Real-time Collaboration**: Share live events in teams
