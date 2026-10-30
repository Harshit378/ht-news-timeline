import { afterEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import {
  cleanWikitext,
  extractMilestones,
  milestoneToRecord,
  parseDateText,
  spreadMilestones,
  titleMatchesQuery,
} from './wikimedia';
import { WikimediaProvider } from './providers/wikimedia.provider';

const day = (d: Date) => d.toISOString().slice(0, 10);

describe('parseDateText', () => {
  it('reads day-first, month-first and year-less dates', () => {
    expect(day(parseDateText('24 February 2022', null)!)).toBe('2022-02-24');
    expect(day(parseDateText('February 24, 2022 – invasion', null)!)).toBe('2022-02-24');
    expect(day(parseDateText('3 March', 2022)!)).toBe('2022-03-03');
    expect(parseDateText('3 March', null)).toBeNull(); // no year anywhere
    expect(parseDateText('31 February 2022', null)).toBeNull();
    expect(parseDateText('Initial attacks', 2023)).toBeNull();
  });
});

describe('cleanWikitext', () => {
  it('drops refs, nested templates and files, keeps link text', () => {
    const raw =
      "'''Kyiv''' was [[shelling|shelled]] in [[Ukraine]].<ref name=a>{{cite news|title={{lang|uk|x}}}}</ref>{{citation needed}} [[File:Map.png|thumb|A [[map]]]]";
    expect(cleanWikitext(raw)).toBe('Kyiv was shelled in Ukraine.');
  });
});

describe('extractMilestones', () => {
  it('takes the first sentence under date headings, with the year from the parent heading', () => {
    const w = [
      '== February 2022 ==',
      '=== 24 February ===',
      "[[File:x.jpg|thumb]]",
      "Russian president [[Vladimir Putin]] announced a \"special military operation\". Explosions were heard in Kyiv.",
      'A second paragraph is ignored for this date.',
      '=== 25 February ===',
      'At 04:00 local time, Kyiv was rocked by two explosions from cruise and ballistic missiles.',
      '== References ==',
      '=== 26 February ===',
      'This sits under References and must be skipped entirely.',
    ].join('\n');
    const out = extractMilestones(w);
    expect(out.map((m) => [day(m.date), m.section])).toEqual([
      ['2022-02-24', '24 February'],
      ['2022-02-25', '25 February'],
    ]);
    expect(out[0].text).toContain('special military operation');
  });

  it('reads dated bullets and "On <date>, …" prose', () => {
    const w = [
      '== 2026 campaigns ==',
      '* 13 August 2026 – Ukraine reported it had sent Russia an offer to halt attacks on ports.',
      "On 20 September 2026, during the legislative election, Ukraine carried out its largest drone attack on Moscow.",
    ].join('\n');
    const out = extractMilestones(w);
    expect(out.map((m) => day(m.date))).toEqual(['2026-08-13', '2026-09-20']);
    expect(out[0].text).toBe('Ukraine reported it had sent Russia an offer to halt attacks on ports.');
    expect(out[1].text).toMatch(/^During the legislative election/);
  });

  it('turns hub-page sections into dated milestones', () => {
    const w = [
      '==Initial attacks==',
      '{{Main|Timeline of the Gaza war (7 October 2023 – 27 October 2023)}}',
      '==Invasion of the Gaza Strip==',
      '{{Main|Timeline of the Gaza war (28 October 2023 – 23 November 2023)}}',
      '==See also==',
      '* [[Outline of the Gaza war]]',
    ].join('\n');
    expect(extractMilestones(w).map((m) => [day(m.date), m.text])).toEqual([
      ['2023-10-07', 'Initial attacks'],
      ['2023-10-28', 'Invasion of the Gaza Strip'],
    ]);
  });
});

describe('spreadMilestones', () => {
  it('dedupes and samples evenly across time, keeping first and last', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      date: new Date(Date.UTC(2022, 0, 1 + i)),
      text: `Event ${i}`,
      section: null,
    }));
    const out = spreadMilestones([...items, items[5]], 10);
    expect(out).toHaveLength(10);
    expect(out[0].text).toBe('Event 0');
    expect(out[9].text).toBe('Event 99');
  });
});

describe('titleMatchesQuery', () => {
  it('matches on word stems, not exact words', () => {
    expect(titleMatchesQuery('Timeline of the Russo-Ukrainian war (2022–present)', 'Russia Ukraine')).toBe(true);
    expect(titleMatchesQuery('Timeline of the COVID-19 pandemic', 'MLB World Series')).toBe(false);
  });
});

describe('milestoneToRecord', () => {
  it('is a non-feed milestone with a unique, attributable URL', () => {
    const r = milestoneToRecord({ date: new Date('2022-02-24T12:00:00Z'), text: 'Invasion begins.', section: '24 February' }, 'Timeline of X');
    expect(r).toMatchObject({ kind: 'milestone', source: 'Wikipedia', headline: 'Invasion begins.' });
    expect(r.url).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\/Timeline_of_X\?ht=[0-9a-f]{16}#24_February$/);
  });
});

describe('WikimediaProvider', () => {
  afterEach(() => vi.restoreAllMocks());

  const search = { query: { search: [{ title: 'Gaza war' }, { title: 'Timeline of the Gaza war' }] } };
  const parse = {
    parse: {
      title: 'Timeline of the Gaza war',
      wikitext: '==Initial attacks==\n{{Main|Timeline of the Gaza war (7 October 2023 – 27 October 2023)}}',
    },
  };

  it('finds the matching timeline page, returns milestones, and caches per query', async () => {
    const get = vi.spyOn(axios, 'get').mockImplementation(async (_url, config) =>
      ({ data: (config?.params as { action: string }).action === 'query' ? search : parse }) as never,
    );
    const p = new WikimediaProvider({ WIKIMEDIA_CONTACT: 'ops@example.com' });
    const items = await p.search('Gaza war', { category: 'world' });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'milestone', headline: 'Initial attacks', category: 'world' });
    expect((get.mock.calls[0][1]?.headers as Record<string, string>)['User-Agent']).toContain('ops@example.com');
    await p.search('gaza  war!', {});
    expect(get).toHaveBeenCalledTimes(2); // search + parse once; second call cached
  });

  it('returns nothing when no timeline page matches the story', async () => {
    const get = vi.spyOn(axios, 'get').mockResolvedValue({ data: { query: { search: [{ title: 'Timeline of the COVID-19 pandemic' }] } } });
    await expect(new WikimediaProvider({}).search('MLB World Series', {})).resolves.toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('can be switched off', async () => {
    const get = vi.spyOn(axios, 'get');
    const p = new WikimediaProvider({ WIKIMEDIA_MILESTONES: 'off' });
    expect(p.enabled).toBe(false);
    await expect(p.search('Gaza war', {})).resolves.toEqual([]);
    expect(get).not.toHaveBeenCalled();
    expect(p.status().state).toBe('disabled');
  });
});
