export interface LiveEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  category: 'election' | 'sports' | 'summit' | 'breaking';
  sourceCount: number;
  sources: {
    name: string;
    headline: string;
    excerpt: string;
    url: string;
    timestamp: string;
  }[];
  status: 'ongoing' | 'completed' | 'scheduled';
  updates: EventUpdate[];
}

export interface EventUpdate {
  id: string;
  timestamp: string;
  message: string;
  importance: 'critical' | 'high' | 'normal' | 'low';
  sources: string[];
}

export interface LiveEventTimeline {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: LiveEvent['category'];
  status: LiveEvent['status'];
  startDate: string;
  endDate?: string;
  events: LiveEvent[];
  lastUpdated: string;
}
