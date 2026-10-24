'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

export type PinnedItemType = 'topic' | 'search';

export interface PinnedItem {
  type: PinnedItemType;
  id: string;
  title: string;
  category: string;
}

interface NewsContextType {
  pinnedItems: PinnedItem[];
  togglePinnedItem: (item: PinnedItem) => void;
  isPinnedItem: (type: PinnedItemType, id: string) => boolean;
}

const NewsContext = createContext<NewsContextType | undefined>(undefined);

export function NewsProvider({ children }: { children: ReactNode }) {
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);

  useEffect(() => {
    const savedPins = localStorage.getItem('ht_timeline_pins');
    if (savedPins) {
      try {
        const parsed = JSON.parse(savedPins) as unknown;
        if (Array.isArray(parsed)) {
          setPinnedItems(
            parsed
              .filter(
                (item): item is PinnedItem =>
                  typeof item === 'object' &&
                  item !== null &&
                  typeof (item as Record<string, unknown>).type === 'string' &&
                  typeof (item as Record<string, unknown>).id === 'string' &&
                  typeof (item as Record<string, unknown>).title === 'string' &&
                  typeof (item as Record<string, unknown>).category === 'string'
              )
              .map((item) => ({
                type: item.type === 'topic' ? 'topic' : 'search',
                id: String(item.id),
                title: String(item.title),
                category: String(item.category),
              }))
          );
        }
      } catch {
        // Ignore malformed saved pins
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ht_timeline_pins', JSON.stringify(pinnedItems));
  }, [pinnedItems]);

  const togglePinnedItem = useCallback((item: PinnedItem) => {
    setPinnedItems((prev) => {
      const isAlreadyPinned = prev.some((t) => t.type === item.type && t.id === item.id);
      if (isAlreadyPinned) {
        return prev.filter((t) => !(t.type === item.type && t.id === item.id));
      }
      return [...prev, item];
    });
  }, []);

  const isPinnedItem = useCallback(
    (type: PinnedItemType, id: string) => pinnedItems.some((t) => t.type === type && t.id === id),
    [pinnedItems]
  );

  return (
    <NewsContext.Provider
      value={{
        pinnedItems,
        togglePinnedItem,
        isPinnedItem,
      }}
    >
      {children}
    </NewsContext.Provider>
  );
}

export function useNews() {
  const context = useContext(NewsContext);
  if (context === undefined) {
    throw new Error('useNews must be used within NewsProvider');
  }
  return context;
}
