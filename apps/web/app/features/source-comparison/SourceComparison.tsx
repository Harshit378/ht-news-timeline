'use client';

import React, { useState } from 'react';
import { ComparisonArticle } from './types';
import { ChevronDown, ExternalLink } from 'lucide-react';

interface SourceComparisonProps {
  article: ComparisonArticle;
}

export default function SourceComparison({ article }: SourceComparisonProps) {
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

  const toggleSourceExpanded = (sourceId: string) => {
    const next = new Set(expandedSources);
    if (next.has(sourceId)) next.delete(sourceId);
    else next.add(sourceId);
    setExpandedSources(next);
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-900 text-green-100';
      case 'negative':
        return 'bg-red-900 text-red-100';
      default:
        return 'bg-slate-800 text-slate-100';
    }
  };

  const getBiasIndicator = (bias?: string) => {
    switch (bias) {
      case 'left':
        return <span className="px-2 py-1 text-xs rounded bg-blue-900 text-blue-100">Left</span>;
      case 'right':
        return <span className="px-2 py-1 text-xs rounded bg-red-900 text-red-100">Right</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded bg-slate-700 text-slate-100">Center</span>;
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 bg-slate-900 rounded-lg border border-slate-700">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-100 mb-2">{article.aggregatedHeadline}</h1>
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="px-3 py-1 text-xs rounded-full bg-blue-900 text-blue-100">
            {article.topic}
          </span>
          <span className="text-sm text-slate-400">
            First reported: {new Date(article.firstReported).toLocaleDateString()}
          </span>
        </div>

        {article.commonThemes.length > 0 && (
          <div className="bg-slate-800 rounded p-3 mb-4 border border-slate-700">
            <p className="text-sm font-semibold text-slate-100 mb-2">Common Themes:</p>
            <div className="flex flex-wrap gap-2">
              {article.commonThemes.map((theme, i) => (
                <span key={i} className="text-xs bg-slate-700 text-slate-200 px-2 py-1 rounded">
                  {theme}
                </span>
              ))}
            </div>
          </div>
        )}

        {article.differences.length > 0 && (
          <div className="bg-amber-900 bg-opacity-20 rounded p-3 border border-amber-700">
            <p className="text-sm font-semibold text-amber-100 mb-2">Key Differences:</p>
            <ul className="space-y-1">
              {article.differences.map((diff, i) => (
                <li key={i} className="text-sm text-amber-100 flex gap-2">
                  <span className="text-amber-400">•</span>
                  {diff}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {article.sources.map((source) => (
          <div
            key={source.sourceId}
            className="border border-slate-700 rounded-lg overflow-hidden bg-slate-800 hover:border-slate-600 transition-colors"
          >
            <div
              className="p-4 cursor-pointer hover:bg-slate-700 transition-colors"
              onClick={() => toggleSourceExpanded(source.sourceId)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-100 text-sm">{source.sourceName}</h3>
                  <p className="text-xs text-slate-400">
                    {new Date(source.publishedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getBiasIndicator(source.bias)}
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      expandedSources.has(source.sourceId) ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </div>

              <h4 className="font-medium text-slate-100 mb-2 line-clamp-2">{source.headline}</h4>

              {source.imageUrl && (
                <div className="mb-3 rounded overflow-hidden h-32 bg-slate-700">
                  <img
                    src={source.imageUrl}
                    alt=""
                    className="w-full h-full object-cover opacity-70"
                  />
                </div>
              )}

              <p className="text-sm text-slate-300 line-clamp-3">{source.excerpt}</p>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700">
                <span
                  className={`text-xs px-2 py-1 rounded ${getSentimentColor(source.sentiment)}`}
                >
                  {source.sentiment || 'neutral'}
                </span>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  Read full <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {expandedSources.has(source.sourceId) && (
              <div className="px-4 py-3 border-t border-slate-700 bg-slate-900 max-h-64 overflow-y-auto">
                <div className="prose prose-invert text-sm text-slate-300 space-y-2">
                  {source.content.split('\n').map((para, i) => (
                    para.trim() && <p key={i}>{para}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-700">
        <p className="text-xs text-slate-500">
          Last updated: {new Date(article.lastUpdated).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
