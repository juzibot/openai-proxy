import { Module } from '@nestjs/common';
import { AnthropicProxyService } from './anthropic-proxy.service';
import { AnthropicProxyController } from './anthropic-proxy.controller';

@Module({
  providers: [AnthropicProxyService],
  controllers: [AnthropicProxyController],
})
export class AnthropicProxyModule {}
