import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { HealthController } from './health.controller';
import { DomainRank } from './db/models/domain-rank.model';
import { RankingModule } from './ranking/ranking.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        dialect: 'postgres',
        host: config.get<string>('DB_HOST'),
        models: [DomainRank],
        port: Number(config.get<number>('DB_PORT')),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        autoLoadModels: true,
        synchronize: true,
        logging: false,

        dialectOptions:
          config.get<string>('DB_HOST')?.includes('neon') ||
          config.get<string>('DB_HOST')?.includes('aws') ||
          config.get<string>('DB_HOST')?.includes('ssl')
            ? { ssl: { require: true, rejectUnauthorized: false } }
            : undefined,
      }),
    }),
    RankingModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
