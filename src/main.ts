import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService>(ConfigService);
  const port = config.get<number>('PORT') ?? 3000;
  const frontendUrl =
    config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';

  app.enableCors({
    origin: frontendUrl,
    methods: ['GET,HEAD'],
  });

  await app.listen(port, '0.0.0.0');
  console.log(`Backend is running on: http://localhost:${port}`);
}
void bootstrap();
