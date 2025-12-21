import { Controller, Get, Param } from '@nestjs/common';
import { RankingService } from './ranking.service';

@Controller('ranking')
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @Get(':domains')
  getRanking(@Param('domains') domains: string) {
    return this.rankingService.getRanking(domains);
  }
}
