import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { OpenaiProxyModule } from './openai/openai-proxy.module';
import { NestjsFormDataModule } from 'nestjs-form-data';
import { AnthropicProxyModule } from './anthropic/anthropic-proxy.module';
import { GoogleProxyModule } from './google/google-proxy.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    NestjsFormDataModule.config({ isGlobal: true }),
    OpenaiProxyModule,
    AnthropicProxyModule,
    GoogleProxyModule,
  ],
})
export class AppModule {}
