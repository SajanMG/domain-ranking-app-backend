import { Controller, Get } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';

@Controller('health')
export class HealthController {
  constructor(private readonly sequelize: Sequelize) {}

  @Get('db')
  async db() {
    await this.sequelize.authenticate();
    return { ok: true, db: 'connected' };
  }
}
