'use client';

import React from 'react';
import { TopicSummary } from './types';
import { TrendingUp, TrendingDown, Zap, Loader } from 'lucide-react';

interface TopicSummaryCardProps {
  summary: TopicSummary;
  isLoading?: boolean;
}

export default function TopicSummaryCard({ summary, isLoading = false }: TopicSummaryCardProps) {
  const getTrendIcon = () => {
    switch (summary.trend) {
      case 'rising':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'declining':
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      default:
        return <Zap className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getSentimentColor = () => {
    switch (summary.sentiment) {
      case 'positive':
        return 'bg-green-900 text-green-100';
      case 'negative':
        return 'bg-red-900 text-red-100';
      default:
        return 'bg-slate-800 text-slate-100';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <Loader className="w-4 h-4 text-slate-400 animate-spin" />
          <div className="h-6 bg-slate-700 rounded w-1/3"></div>
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-slate-700 rounded w-full"></div>
          <div className="h-4 bg-slate-700 rounded w-4/5"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden hover:border-slate-600 transition-colors">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-100 capitalize">{summary.topicName}</h3>
            <p className="text-xs text-slate-400">
              {new Date(summary.generatedAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {getTrendIcon()}
            <span
              className={`text-xs px-2 py-1 rounded capitalize ${getSentimentColor()}`}
            >
              {summary.sentiment}
            </span>
          </div>
        </div>

        <p className="text-sm text-slate-300 mb-4 line-clamp-3">{summary.summary}</p>

        <div className="bg-slate-900 rounded p-3 mb-4 border border-slate-700">
          <p className="text-xs font-semibold text-slate-200 mb-2">Key Points:</p>
          <ul className="space-y-1">
            {summary.keyPoints.map((point, i) => (
              <li key={i} className="text-xs text-slate-300 flex gap-2">
                <span className="text-slate-400">•</span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-slate-900 rounded p-2 text-center border border-slate-700">
            <p className="text-xs text-slate-400">Articles</p>
            <p className="text-sm font-semibold text-slate-100">{summary.articleCount}</p>
          </div>
          <div className="bg-slate-900 rounded p-2 text-center border border-slate-700">
            <p className="text-xs text-slate-400">Sources</p>
            <p className="text-sm font-semibold text-slate-100">{summary.sourceCount}</p>
          </div>
          <div className="bg-slate-900 rounded p-2 text-center border border-slate-700">
            <p className="text-xs text-slate-400">Confidence</p>
            <p className="text-sm font-semibold text-slate-100">{(summary.confidence * 100).toFixed(0)}%</p>
          </div>
        </div>

        {summary.relatedTopics.length > 0 && (
          <div className="pt-3 border-t border-slate-700">
            <p className="text-xs font-semibold text-slate-300 mb-2">Related Topics:</p>
            <div className="flex flex-wrap gap-1">
              {summary.relatedTopics.map((topic) => (
                <span key={topic} className="text-xs bg-slate-700 text-slate-200 px-2 py-1 rounded capitalize">
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
