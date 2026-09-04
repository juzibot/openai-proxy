import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { HttpClientModule } from './common/http-client';
import { OpenaiProxyModule } from './openai/openai-proxy.module';
import { NestjsFormDataModule } from 'nestjs-form-data';
import { AnthropicProxyModule } from './anthropic/anthropic-proxy.module';
import { GoogleProxyModule } from './google/google-proxy.module';
import { XaiProxyModule } from './xai/xai-proxy.module';
import { BedrockProxyModule } from './bedrock/bedrock-proxy.module';
import { VertexProxyModule } from './vertex/vertex-proxy.module';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ProxyAuthGuard } from './common/proxy-auth.guard';
import { SanitizedExceptionFilter } from './common/sanitized-exception.filter';
import { HealthController } from './health.controller';
import { validateEnvironment } from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      validate: validateEnvironment,
      isGlobal: true,
    }),
    NestjsFormDataModule.config({ isGlobal: true }),
    HttpClientModule,
    OpenaiProxyModule,
    AnthropicProxyModule,
    GoogleProxyModule,
    XaiProxyModule,
    BedrockProxyModule,
    VertexProxyModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ProxyAuthGuard },
    { provide: APP_FILTER, useClass: SanitizedExceptionFilter },
  ],
})
export class AppModule {}
