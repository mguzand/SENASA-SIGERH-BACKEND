import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.setGlobalPrefix('api');

  app.use(json({ limit: '512mb' }));

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
