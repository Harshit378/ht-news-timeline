import { Injectable, Logger } from '@nestjs/common';

/**
 * Maps GDELT GoldsteinScale / NumMentions onto importance bands.
 * The BigQuery pipeline (`gdelt-bq.gdeltv2`) is optional and skipped until
 * GCP credentials are present; the mapping is used by DOC ingest as well.
 */
@Injectable()
export class GdeltBigQueryService {
  private readonly logger = new Logger(GdeltBigQueryService.name);

  mapImportance(goldsteinScale: number, numMentions: number): 'critical' | 'high' | 'normal' | 'low' {
    if (Math.abs(goldsteinScale) >= 7 || numMentions >= 200) return 'critical';
    if (Math.abs(goldsteinScale) >= 4 || numMentions >= 80) return 'high';
    if (Math.abs(goldsteinScale) >= 1 || numMentions >= 20) return 'normal';
    return 'low';
  }

  async queryRecentEvents(): Promise<void> {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      this.logger.debug('Skipping BigQuery GDELT ingest (no GCP credentials)');
    }
  }
}
