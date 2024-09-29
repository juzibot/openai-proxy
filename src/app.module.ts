import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { ProxyModule } from './proxy/proxy.module';
import { NestjsFormDataModule } from 'nestjs-form-data';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    NestjsFormDataModule.config({ isGlobal: true }),
    ProxyModule,
  ],
})
export class AppModule {}
