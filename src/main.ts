import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { urlencoded, json, raw } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  app.use((req, res, next) => {
    if (req.path === '/google/upload/v1beta/files' && req.query.upload_id) {
      raw({ type: '*/*', limit: '100mb' })(req, res, next);
    } else {
      next();
    }
  });

  app.use(json({ limit: '50mb' }));
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.use(urlencoded({ extended: true, limit: '50mb', parameterLimit: 50000 }));
  const configService = app.get(ConfigService);
  const port = configService.get<number>('port');
  await app.listen(port, () => {
    Logger.log(`Server started listening on port: ${port}`);
  });
}
bootstrap();
