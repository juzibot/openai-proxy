import { Module } from '@nestjs/common';
import { OpenaiProxyService } from './openai-proxy.service';
import { OpenaiProxyController } from './openai-proxy.controller';

@Module({
  providers: [OpenaiProxyService],
  controllers: [OpenaiProxyController],
})
export class OpenaiProxyModule {}
