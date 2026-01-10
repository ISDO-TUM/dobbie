import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:5174'], // Your frontend URLs
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const PORT = process.env.PORT || 3001;
  await app.listen(PORT, '0.0.0.0');

  Logger.log(
    `🤖 Sovereign Agent & Indexer running on http://localhost:${PORT}`,
  );
}

void bootstrap();
