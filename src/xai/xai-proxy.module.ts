import { Module } from '@nestjs/common';
import { XaiProxyService } from './xai-proxy.service';
import { XaiProxyController } from './xai-proxy.controller';

@Module({
  providers: [XaiProxyService],
  controllers: [XaiProxyController],
})
export class XaiProxyModule {}
