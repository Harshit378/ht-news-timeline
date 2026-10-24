/** Mirrors the API's LiveEvent / EventUpdate rows (GET /api/events), dates as ISO strings. */
export type LiveEventCategory = 'election' | 'sports' | 'summit' | 'breaking';
export type LiveEventStatus = 'ongoing' | 'completed' | 'scheduled';
export type UpdateImportance = 'critical' | 'high' | 'normal' | 'low';

export interface EventUpdate {
  id: string;
  eventId: string;
  timestamp: string;
  message: string;
  importance: UpdateImportance;
  sources: string[];
}

export interface LiveEventTimeline {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: LiveEventCategory;
  status: LiveEventStatus;
  startDate: string;
  endDate?: string | null;
  lastUpdated: string;
  /** Newest first. */
  updates: EventUpdate[];
}

/** `data` of a WebSocket `update` message, as sent by EventsController. */
export interface LiveUpdatePayload {
  eventId: string;
  update: EventUpdate;
  status?: LiveEventStatus;
}
