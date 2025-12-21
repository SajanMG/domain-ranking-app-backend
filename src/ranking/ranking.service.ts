import { Injectable } from '@nestjs/common';
import { DomainRank } from 'src/db/models/domain-rank.model';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';

type DomainSeries = {
  domain: string;
  labels: string[];
  ranks: number[];
};

@Injectable()
export class RankingService {
  constructor(
    private readonly config: ConfigService,
    @InjectModel(DomainRank) private domainRankModel: typeof DomainRank,
  ) {}

  async getRanking(domainsParam: string) {
    const domains = domainsParam
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    const result: Record<string, any> = {};

    for (const domain of domains) {
      const isFresh = await this.isCacheFresh(domain);
      if (!isFresh) {
        await this.refreshFromTronco(domain);
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
    const res = await fetch(url, {headers: {Accept: 'application/json'}});
    if (!res.ok)
      throw new Error(
        `Failed to fetch data from Tranco API: (${res.status}) for ${domain} ${res.statusText}`,
      );
      const data = await res.json();
      const ranks = Array.isArray(data?.ranks) ? data.ranks : [];

      const rows = ranks.filter((x:any) => typeof x?.date === 'string' && typeof x?.rank != null).map((x:any) => ({
        domain,
        date: x.date,
        rank: Number(x.rank),
      }))
      .filter((x: any) => Number.isFinite(x.rank));  

      await this.domainRankModel.destroy({ where: { domain } });
      if (rows.length > 0) {
        await this.domainRankModel.bulkCreate(rows);
    }
  }
}
