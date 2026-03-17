import { Injectable } from '@nestjs/common';
import { DomainRank } from '../db/models/domain-rank.model';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';

type TrancoRank = { date: string; rank: number | string | null };
type TrancoResponse = { ranks?: TrancoRank[] };

type DomainSeries = {
  domain: string;
  labels: string[];
  ranks: number[];
  outOfTop1M: boolean;
};

@Injectable()
export class RankingService {
  constructor(
    private readonly config: ConfigService,
    @InjectModel(DomainRank) private domainRankModel: typeof DomainRank,
  ) {}

  async getRanking(
    domainsParam: string,
  ): Promise<Record<string, DomainSeries>> {
    const domains = domainsParam
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    const result: Record<string, DomainSeries> = {};

    for (const domain of domains) {
      const isFresh = await this.isCacheFresh(domain);
      if (!isFresh) {
        console.log(
          `[CACHE MISS] Cache stale. Fetching API data for ${domain}`,
        );
        await this.refreshFromTronco(domain);
      } else {
        console.log(`[CACHE HIT] Returning cached data for ${domain}`);
      }
      const rows = await this.domainRankModel.findAll({
        where: { domain },
        order: [['date', 'ASC']],
      });

      result[domain] = {
        domain,
        labels: rows.map((r) => r.date),
        ranks: rows.map((r) => r.rank),
        outOfTop1M: rows.length === 0,
      };
    }
    return result;
  }
  private async isCacheFresh(domain: string): Promise<boolean> {
    const ttlHours = Number(this.config.get<string>('CACHE_TTL_HOURS') ?? '24');
    const ttlMs = ttlHours * 60 * 60 * 1000;
    // find the newest entry for the domain
    const latest = await this.domainRankModel.findOne({
      where: { domain },
      order: [['date', 'DESC']],
    });

    if (!latest || !latest.updatedAt) return false;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const ageMs = Date.now() - new Date(latest.updatedAt).getTime();
    return ageMs < ttlMs;
  }

  private async refreshFromTronco(domain: string): Promise<void> {
    const base = this.config.get<string>('TRANCO_API_BASE_URL');
    if (!base) throw new Error('TRANCO_API_BASE_URL is not set');

    const url = `${base}/${encodeURIComponent(domain)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok)
      throw new Error(
        `Failed to fetch data from Tranco API: (${res.status}) for ${domain} ${res.statusText}`,
      );
    const data = (await res.json()) as TrancoResponse;
    const ranks: TrancoRank[] = Array.isArray(data?.ranks) ? data.ranks : [];

    const rows = ranks
      .filter(
        (x): x is TrancoRank & { date: string } =>
          typeof x?.date === 'string' && x?.rank != null,
      )
      .map((x) => ({
        domain,
        date: x.date,
        rank: Number(x.rank),
      }))
      .filter((x): x is { domain: string; date: string; rank: number } =>
        Number.isFinite(x.rank),
      );

    await this.domainRankModel.destroy({ where: { domain } });
    if (rows.length > 0) {
      await this.domainRankModel.bulkCreate(rows);
    }
  }
}
