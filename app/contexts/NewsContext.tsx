'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import topicsData from '@/app/data/topics.json';

export interface Topic {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  featured: boolean;
  createdAt: string;
}

export type PinnedItemType = 'topic' | 'search';

export interface PinnedItem {
  type: PinnedItemType;
  id: string;
  title: string;
  category: string;
}

interface NewsContextType {
  pinnedItems: PinnedItem[];
  allTopics: Topic[];
  selectedCountry: string;
  togglePinnedItem: (item: PinnedItem) => void;
  isPinnedItem: (type: PinnedItemType, id: string) => boolean;
  setSelectedCountry: (country: string) => void;
}

const NewsContext = createContext<NewsContextType | undefined>(undefined);

export function NewsProvider({ children }: { children: ReactNode }) {
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);
  const [selectedCountry, setSelectedCountry] = useState('us');
  const allTopics = topicsData.topics;

  useEffect(() => {
    const savedCountry = localStorage.getItem('ht_timeline_country');
    if (savedCountry) {
      setSelectedCountry(savedCountry);
    }

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
                  (item as any).type &&
                  (item as any).id &&
                  (item as any).title &&
                  (item as any).category
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
    localStorage.setItem('ht_timeline_country', selectedCountry);
  }, [selectedCountry]);

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
        allTopics,
        selectedCountry,
        togglePinnedItem,
        isPinnedItem,
        setSelectedCountry,
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
