'use client';

import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { LiveEventTimeline, LiveEvent } from './types';

interface LiveEventsContextType {
  activeTimeline: LiveEventTimeline | null;
  setActiveTimeline: (timeline: LiveEventTimeline) => void;
  timelines: LiveEventTimeline[];
  setTimelines: (timelines: LiveEventTimeline[]) => void;
  updateLiveEvent: (timelineId: string, event: LiveEvent) => void;
  isLive: boolean;
  setIsLive: (live: boolean) => void;
}

const LiveEventsContext = createContext<LiveEventsContextType | undefined>(undefined);

const MOCK_TIMELINES: LiveEventTimeline[] = [
  {
    id: 'election-2024',
    name: 'US Election 2024',
    slug: 'election-2024',
    description: 'Real-time coverage of the 2024 US Presidential Election',
    category: 'election',
    status: 'completed',
    startDate: '2024-11-05T00:00:00Z',
    endDate: '2024-11-06T10:00:00Z',
    events: [],
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'super-bowl-2024',
    name: 'Super Bowl LVIII',
    slug: 'super-bowl-2024',
    description: 'Live coverage of Super Bowl LVIII',
    category: 'sports',
    status: 'completed',
    startDate: '2024-02-11T23:30:00Z',
    endDate: '2024-02-12T03:30:00Z',
    events: [],
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'g7-summit-2024',
    name: 'G7 Summit 2024',
    slug: 'g7-summit-2024',
    description: 'Live updates from the G7 Summit',
    category: 'summit',
    status: 'ongoing',
    startDate: '2024-06-13T08:00:00Z',
    events: [],
    lastUpdated: new Date().toISOString(),
  },
];

export function LiveEventsProvider({ children }: { children: ReactNode }) {
  const [activeTimeline, setActiveTimeline] = useState<LiveEventTimeline | null>(null);
  const [timelines, setTimelines] = useState<LiveEventTimeline[]>(MOCK_TIMELINES);
  const [isLive, setIsLive] = useState(false);

  const updateLiveEvent = useCallback(
    (timelineId: string, event: LiveEvent) => {
      setTimelines((prevTimelines) =>
        prevTimelines.map((timeline) => {
          if (timeline.id === timelineId) {
            const existingEventIndex = timeline.events.findIndex((e) => e.id === event.id);
            const updatedEvents =
              existingEventIndex >= 0
                ? timeline.events.map((e, i) => (i === existingEventIndex ? event : e))
                : [event, ...timeline.events];

            return {
              ...timeline,
              events: updatedEvents,
              lastUpdated: new Date().toISOString(),
            };
          }
          return timeline;
        })
      );
    },
    []
  );

  const value: LiveEventsContextType = {
    activeTimeline,
    setActiveTimeline,
    timelines,
    setTimelines,
    updateLiveEvent,
    isLive,
    setIsLive,
  };

  return <LiveEventsContext.Provider value={value}>{children}</LiveEventsContext.Provider>;
}

export function useLiveEvents() {
  const ctx = useContext(LiveEventsContext);
  if (!ctx) throw new Error('useLiveEvents must be used within LiveEventsProvider');
  return ctx;
}
