import { RankingController } from './ranking.controller';
import { RankingService } from './ranking.service';
import { Module } from '@nestjs/common';
import { DomainRank } from 'src/db/models/domain-rank.model';
import { SequelizeModule } from '@nestjs/sequelize';

@Module({
  imports: [SequelizeModule.forFeature([DomainRank])],
  controllers: [RankingController],
  providers: [RankingService],
})
export class RankingModule {}
