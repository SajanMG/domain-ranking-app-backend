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

    const ttlHours = Number(this.config.get<string>('CACHE_TTL_HOURS') ?? '24');
    const ttlMs = ttlHours * 60 * 60 * 1000;

    const allRows = await this.domainRankModel.findAll({
      where: { domain: domains },
      attributes: ['domain', 'date', 'rank', 'updatedAt'],
      order: [
        ['domain', 'ASC'],
        ['date', 'ASC'],
      ],
    });
    const latestByDomain = new Map<string, (typeof allRows)[0]>();

    for (const row of allRows) {
      if (!latestByDomain.has(row.domain)) {
        latestByDomain.set(row.domain, row);
      }
    }

    const domainsToRefresh: string[] = [];
    for (const domain of domains) {
      const latest = latestByDomain.get(domain);
      const isFresh =
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        latest && Date.now() - new Date(latest.updatedAt).getTime() < ttlMs;

      if (isFresh) {
        console.log(`[CACHE HIT] ${domain}`);
      } else {
        console.log(`[CACHE MISS] ${domain} - refreshing from API`);
        domainsToRefresh.push(domain);
      }
    }

    await Promise.all(domainsToRefresh.map((d) => this.refreshFromTronco(d)));

    const rowsByDomain = new Map<string, typeof allRows>();

    for (const row of allRows) {
      if (!rowsByDomain.has(row.domain)) {
        rowsByDomain.set(row.domain, []);
      }
      rowsByDomain.get(row.domain)!.push(row);
    }

    const result: Record<string, DomainSeries> = {};
    for (const domain of domains) {
      const rows = rowsByDomain.get(domain) ?? [];

      result[domain] = {
        domain,
        labels: rows.map((r) => r.date),
        ranks: rows.map((r) => r.rank),
        outOfTop1M: rows.length === 0,
      };
    }

    return result;
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

    // await this.domainRankModel.destroy({ where: { domain } });
    if (rows.length > 0) {
      await this.domainRankModel.bulkCreate(rows, {
        updateOnDuplicate: ['rank', 'date', 'updatedAt'],
      });
      console.log(`[CACHE REFRESHED] ${domain}`);
    }
  }
}
