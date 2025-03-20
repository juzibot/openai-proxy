import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { urlencoded, json } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.use(json({ limit: '50mb' }));
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port');

  await app.listen(port, () => {
    Logger.log(`Server started listening on port: ${port}`);
  });
}
bootstrap();
