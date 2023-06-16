import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port');

  await app.listen(port, () => {
    Logger.log(`Server started listening on port: ${port}`);
  });
}
bootstrap();
