import { Module } from '@nestjs/common';
import { GoogleProxyService } from './google-proxy.service';
import { GoogleProxyController } from './google-proxy.controller';

@Module({
  providers: [GoogleProxyService],
  controllers: [GoogleProxyController],
})
export class GoogleProxyModule {}
