import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ArticleRecord } from '../../store/types';
import { sanitizeStoryQuery } from '../gdelt-doc.service';
import { extractMilestones, milestoneToRecord, spreadMilestones, titleMatchesQuery } from '../wikimedia';
import { NewsProvider, ProviderStatus } from './news-provider';

const API = 'https://en.wikipedia.org/w/api.php';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 300;
const MAX_MILESTONES = 40;

/**
 * Story skeleton from Wikipedia (ADR-008 step 6): finds the "Timeline of …" page that matches a story
 * and returns its dated events as `milestone` records. Free; results are cached for 24 h per query.
 * Wikimedia's API policy asks for a User-Agent with contact details: set `WIKIMEDIA_CONTACT`.
 * `WIKIMEDIA_MILESTONES=off` disables it.
 */
@Injectable()
export class WikimediaProvider implements NewsProvider {
  readonly id = 'wikipedia';
  private readonly logger = new Logger(WikimediaProvider.name);
  private readonly userAgent: string;
  readonly enabled: boolean;
  private readonly cache = new Map<string, { at: number; items: ArticleRecord[] }>();
  private lastSuccessAt: Date | null = null;
  private lastError: string | null = null;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.enabled = (env.WIKIMEDIA_MILESTONES ?? 'on').toLowerCase() !== 'off';
    const contact = env.WIKIMEDIA_CONTACT ? `; ${env.WIKIMEDIA_CONTACT}` : '';
    this.userAgent = `NewsTimeline/0.1 (story milestones${contact})`;
  }

  async search(query: string, opts: { category?: string }): Promise<ArticleRecord[]> {
    const q = sanitizeStoryQuery(query);
    if (!this.enabled || !q) return [];
    const key = q.toLowerCase();
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.items;

    try {
      const title = await this.findTimelinePage(q);
      const items = title ? await this.milestones(title, opts.category) : [];
      this.remember(key, items);
      this.lastSuccessAt = new Date();
      this.lastError = null;
      if (title) this.logger.log(`"${q}" → ${title}: ${items.length} milestones`);
      return items;
    } catch (err) {
      this.lastError = axios.isAxiosError(err) ? (err.response ? `HTTP ${err.response.status}` : (err.code ?? 'network error')) : String(err);
      throw new Error(`wikipedia: ${this.lastError}`);
    }
  }

  status(): ProviderStatus {
    return {
      id: this.id,
      state: !this.enabled ? 'disabled' : this.lastError && !this.lastSuccessAt ? 'error' : 'ok',
      lastSuccessAt: this.lastSuccessAt?.toISOString() ?? null,
      lastError: this.enabled ? this.lastError : 'WIKIMEDIA_MILESTONES=off',
    };
  }

  /** The first "Timeline of …" search hit whose title shares a word stem with the query. */
  private async findTimelinePage(q: string): Promise<string | null> {
    const { data } = await axios.get<{ query?: { search?: { title: string }[] } }>(API, {
      params: { action: 'query', list: 'search', srsearch: `timeline of ${q}`, srlimit: 8, format: 'json' },
      headers: { 'User-Agent': this.userAgent },
      timeout: 8000,
    });
    const titles = (data.query?.search ?? []).map((r) => r.title);
    return titles.find((t) => /^Timeline of /i.test(t) && titleMatchesQuery(t, q)) ?? null;
  }

  private async milestones(title: string, category?: string): Promise<ArticleRecord[]> {
    const { data } = await axios.get<{ parse?: { title: string; wikitext: string } }>(API, {
      params: { action: 'parse', page: title, prop: 'wikitext', format: 'json', formatversion: 2, redirects: 1 },
      headers: { 'User-Agent': this.userAgent },
      timeout: 10_000,
    });
    const wikitext = data.parse?.wikitext ?? '';
    const pageTitle = data.parse?.title ?? title;
    return spreadMilestones(extractMilestones(wikitext), MAX_MILESTONES).map((m) =>
      milestoneToRecord(m, pageTitle, category ?? 'world'),
    );
  }

  private remember(key: string, items: ArticleRecord[]) {
    if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value as string);
    this.cache.set(key, { at: Date.now(), items });
  }
}
