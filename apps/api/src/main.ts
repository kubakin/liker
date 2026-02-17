import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем .env до инициализации Nest (чтобы process.env был готов при загрузке модулей)
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '../.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });
  app.setGlobalPrefix('api');
  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  console.log(`API server is running on port ${port}`);
}
bootstrap();
