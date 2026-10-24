import { describe, expect, it } from 'vitest';
import { validateSummary } from './summary-validate';

const good = {
  summary: 'The Brewers beat the Rays in Game 1 of the World Series in Milwaukee on Friday, escaping a ninth-inning jam.',
  keyPoints: ['- Brewers won Game 1', '2. A replay review decided the ninth', '  '],
  sentiment: 'Positive',
  relatedTopics: ['MLB', 'Milwaukee Brewers', 'a topic name that is far too long to be a sensible related topic'],
};

describe('validateSummary', () => {
  it('normalises good output', () => {
    expect(validateSummary(good)).toEqual({
      summary: good.summary,
      keyPoints: ['Brewers won Game 1', 'A replay review decided the ninth'],
      sentiment: 'positive',
      relatedTopics: ['mlb', 'milwaukee brewers'],
    });
  });

  it('caps long text and defaults unknown sentiment', () => {
    const out = validateSummary({ ...good, summary: 'Word. '.repeat(300), sentiment: 'mixed' })!;
    expect(out.summary.length).toBeLessThanOrEqual(700);
    expect(out.sentiment).toBe('neutral');
  });

  it('rejects unusable output', () => {
    expect(validateSummary(null)).toBeNull();
    expect(validateSummary('text')).toBeNull();
    expect(validateSummary({ ...good, summary: 'Too short.' })).toBeNull();
    expect(validateSummary({ ...good, keyPoints: ['only one'] })).toBeNull();
    expect(validateSummary({ ...good, keyPoints: 'not a list' })).toBeNull();
  });
});
