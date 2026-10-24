import { Injectable, Logger } from '@nestjs/common';
import { NewsStore } from '../store/news.store';
import { GdeltBigQueryService } from './gdelt-bigquery.service';

export type BackfillState = 'pending' | 'done' | 'unavailable';

/** A story's history is re-scanned at most this often: older coverage doesn't change, and scans cost bytes. */
const RESCAN_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
/** After a failed run, wait before trying the same story again. */
const FAILURE_COOLDOWN_MS = 15 * 60 * 1000;

/**
 * Schedules the BigQuery history backfill for a story (ADR-008 step 5). Like story briefs it runs in the
 * background on first view, never on the request path; results are saved to the story, and `onDone`
 * lets the timeline drop its cached copy so the next request includes them.
 */
@Injectable()
export class StoryBackfillService {
  private readonly logger = new Logger(StoryBackfillService.name);
  private readonly inFlight = new Map<string, Promise<void>>();
  private readonly done = new Set<string>();
  private readonly failedAt = new Map<string, number>();

  constructor(
    private readonly store: NewsStore,
    private readonly bigQuery: GdeltBigQueryService,
  ) {}

  get enabled() {
    return this.bigQuery.enabled;
  }

  /** Current state, starting a run if one is due. `job` is only for tests. */
  async ensure(
    key: string,
    query: string,
    category: string | undefined,
    earliest: Date | undefined,
    onDone?: () => void,
  ): Promise<{ state: BackfillState; job?: Promise<void> }> {
    if (!this.bigQuery.enabled) return { state: 'unavailable' };
    const running = this.inFlight.get(key);
    if (running) return { state: 'pending', job: running };
    if (this.done.has(key)) return { state: 'done' };
    const failed = this.failedAt.get(key);
    if (failed && Date.now() - failed < FAILURE_COOLDOWN_MS) return { state: 'unavailable' };

    const last = await this.store.getBackfilledAt(key);
    if (last && Date.now() - last.getTime() < RESCAN_AFTER_MS) {
      this.done.add(key);
      return { state: 'done' };
    }

    const job = this.run(key, query, category, earliest ?? new Date())
      .then(() => {
        this.done.add(key);
        onDone?.();
      })
      .catch((err) => {
        this.failedAt.set(key, Date.now());
        this.logger.warn(`backfill "${query}" failed: ${err instanceof Error ? err.message : err}`);
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, job);
    return { state: 'pending', job };
  }

  private async run(key: string, query: string, category: string | undefined, before: Date) {
    const result = await this.bigQuery.backfillStory(query, before, category);
    if (result.status !== 'done') return;
    if (result.articles.length) await this.store.saveStory(key, query, category, result.articles);
    await this.store.markBackfilled(key);
  }
}
