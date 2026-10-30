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

describe('validateComparison (via validateSummary)', () => {
  const base = { summary: 'x'.repeat(60), keyPoints: ['one point', 'two point'], sentiment: 'neutral', relatedTopics: [] };

  it('keeps themes and differences that name real sources, matching case-insensitively', () => {
    const out = validateSummary(
      {
        ...base,
        commonThemes: ['  Final score ', 'Injury report'],
        differences: [
          { source: 'bbc', point: 'Only BBC mentions the attendance record.' },
          { source: 'Made Up Times', point: 'This outlet does not exist in the input.' },
          { source: 'ESPN', point: 'short' },
        ],
      },
      ['BBC', 'ESPN'],
    );
    expect(out?.comparison).toEqual({
      commonThemes: ['Final score', 'Injury report'],
      differences: [{ source: 'BBC', point: 'Only BBC mentions the attendance record.' }],
    });
  });

  it('omits the comparison when nothing usable is left, and ignores it when not asked', () => {
    expect(validateSummary({ ...base, commonThemes: [], differences: [] }, ['BBC'])?.comparison).toBeUndefined();
    expect(validateSummary({ ...base, commonThemes: ['Final score'] })?.comparison).toBeUndefined();
  });
});
