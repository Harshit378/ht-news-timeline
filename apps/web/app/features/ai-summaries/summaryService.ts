'use client';

import axios from 'axios';
import { TopicSummary, SummaryRequest } from './types';

const summaryClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  timeout: 10000,
});

export async function generateTopicSummary(request: SummaryRequest): Promise<TopicSummary> {
  const response = await summaryClient.post('/api/summaries/generate', request);
  return response.data;
}

export async function getSummaryCached(topicName: string): Promise<TopicSummary | null> {
  try {
    const response = await summaryClient.get(`/api/summaries/${encodeURIComponent(topicName)}`);
    return response.data;
  } catch {
    return null;
  }
}

export async function listTopicSummaries(): Promise<TopicSummary[]> {
  const response = await summaryClient.get('/api/summaries');
  return response.data;
}

// Local mock implementation for when API is not available
export function generateMockSummary(topicName: string, articleCount: number): TopicSummary {
  const summaries: Record<string, string> = {
    tech: 'Major developments in artificial intelligence, including new model releases and industry consolidation.',
    finance: 'Stock markets show mixed signals with tech stocks leading gains amid interest rate expectations.',
    world: 'International tensions escalate in multiple regions, with diplomatic efforts ongoing.',
    politics: 'Election season intensifies with candidates focusing on key campaign issues.',
    science: 'Breakthrough discoveries in medical research and space exploration make headlines.',
    climate: 'Record temperatures and climate policy discussions dominate environmental news.',
    health: 'New health guidelines issued as public health agencies respond to emerging concerns.',
  };

  const keyPointTemplates: Record<string, string[]> = {
    tech: [
      'Major AI models showing improved reasoning capabilities',
      'Enterprise adoption of new technologies accelerating',
      'Cybersecurity remains top industry concern',
    ],
    finance: [
      'Central banks signal cautious monetary policy',
      'Corporate earnings beat expectations in key sectors',
      'Emerging markets show resilience',
    ],
    world: [
      'International community working on diplomatic solutions',
      'Regional stability remains uncertain',
      'Trade relationships evolving',
    ],
  };

  return {
    id: `summary-${topicName}-${Date.now()}`,
    topicName,
    generatedAt: new Date().toISOString(),
    summary: summaries[topicName] || `Summary of ${topicName} news from the past week.`,
    keyPoints: keyPointTemplates[topicName] || [
      'Breaking news and updates related to the topic',
      'Multiple sources covering the developing story',
      'Broader implications for the industry and market',
    ],
    sentiment: 'neutral',
    articleCount,
    sourceCount: Math.min(articleCount, 10),
    relatedTopics: ['finance', 'tech', 'world'].filter((t) => t !== topicName),
    trend: 'stable',
    confidence: 0.85,
  };
}
