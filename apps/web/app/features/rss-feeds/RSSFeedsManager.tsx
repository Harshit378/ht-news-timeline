'use client';

import React, { useState } from 'react';
import { RSSFeed } from './types';
import { Plus, Trash2, Power, Loader } from 'lucide-react';

interface RSSFeedsManagerProps {
  feeds: RSSFeed[];
  onAddFeed: (url: string, category: string) => Promise<void>;
  onRemoveFeed: (feedId: string) => Promise<void>;
  onToggleFeed: (feedId: string, isActive: boolean) => Promise<void>;
  isLoading?: boolean;
}

export default function RSSFeedsManager({
  feeds,
  onAddFeed,
  onRemoveFeed,
  onToggleFeed,
  isLoading = false,
}: RSSFeedsManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newFeedCategory, setNewFeedCategory] = useState('tech');
  const [isAddingFeed, setIsAddingFeed] = useState(false);

  const handleAddFeed = async () => {
    if (!newFeedUrl.trim()) return;

    setIsAddingFeed(true);
    try {
      await onAddFeed(newFeedUrl, newFeedCategory);
      setNewFeedUrl('');
      setShowAddForm(false);
    } finally {
      setIsAddingFeed(false);
    }
  };

  const activeFeedsCount = feeds.filter((f) => f.isActive).length;
  const totalItems = feeds.reduce((sum, f) => sum + f.itemCount, 0);

  const categories = ['tech', 'finance', 'world', 'science', 'politics', 'health'];

  return (
    <div className="w-full p-4 bg-surface rounded-lg border border-border">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-ink">RSS Feeds Manager</h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-3 py-2 bg-accent active:opacity-90 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Feed
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-surface-alt border border-border rounded-lg p-3 text-center">
            <p className="text-sm text-muted">Total Feeds</p>
            <p className="text-2xl font-bold text-ink">{feeds.length}</p>
          </div>
          <div className="bg-surface-alt border border-border rounded-lg p-3 text-center">
            <p className="text-sm text-muted">Active</p>
            <p className="text-2xl font-bold text-green-400">{activeFeedsCount}</p>
          </div>
          <div className="bg-surface-alt border border-border rounded-lg p-3 text-center">
            <p className="text-sm text-muted">Total Items</p>
            <p className="text-2xl font-bold text-ink">{totalItems}</p>
          </div>
        </div>

        {showAddForm && (
          <div className="bg-surface-alt border border-border rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-ink mb-3">Add New RSS Feed</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-muted mb-1">Feed URL</label>
                <input
                  type="url"
                  placeholder="https://example.com/feed.xml"
                  value={newFeedUrl}
                  onChange={(e) => setNewFeedUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded text-ink placeholder:text-muted focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Category</label>
                <select
                  value={newFeedCategory}
                  onChange={(e) => setNewFeedCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded text-ink focus:border-accent focus:outline-none"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddFeed}
                  disabled={isAddingFeed || !newFeedUrl.trim()}
                  className="flex-1 px-3 py-2 bg-accent active:opacity-90 disabled:bg-dim text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isAddingFeed && <Loader className="w-4 h-4 animate-spin" />}
                  {isAddingFeed ? 'Adding...' : 'Add Feed'}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewFeedUrl('');
                  }}
                  className="flex-1 px-3 py-2 bg-dim hover:bg-dim text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-muted">
            <Loader className="w-8 h-8 animate-spin mx-auto mb-2" />
            <p>Loading feeds...</p>
          </div>
        ) : feeds.length === 0 ? (
          <div className="text-center py-8 text-ink0">
            <p>No RSS feeds configured yet</p>
            <p className="text-sm mt-2">Add your first feed to get started</p>
          </div>
        ) : (
          feeds.map((feed) => (
            <div
              key={feed.id}
              className="bg-surface-alt border border-border rounded-lg p-4 hover:border-border transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-ink">{feed.title}</h3>
                  {feed.description && (
                    <p className="text-sm text-muted mt-1">{feed.description}</p>
                  )}
                  <p className="text-xs text-ink0 mt-1">{feed.url}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      feed.isActive
                        ? 'bg-green-900 text-green-100'
                        : 'bg-dim text-muted'
                    }`}
                  >
                    {feed.category}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="text-xs text-muted">
                  {feed.itemCount} items • Updated{' '}
                  {feed.lastChecked ? new Date(feed.lastChecked).toLocaleString() : 'never'}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onToggleFeed(feed.id, !feed.isActive)}
                    className={`p-2 rounded transition-colors ${
                      feed.isActive
                        ? 'bg-green-900 hover:bg-green-800 text-green-100'
                        : 'bg-dim hover:bg-dim text-muted'
                    }`}
                    title={feed.isActive ? 'Disable feed' : 'Enable feed'}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onRemoveFeed(feed.id)}
                    className="p-2 rounded bg-red-900 hover:bg-red-800 text-red-100 transition-colors"
                    title="Remove feed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
