import { Module } from '@nestjs/common';
import { BedrockProxyController } from './bedrock-proxy.controller';
import { BedrockProxyService } from './bedrock-proxy.service';
import { BedrockAnthropicProxyService } from './bedrock-anthropic-proxy.service';

@Module({
  controllers: [BedrockProxyController],
  providers: [BedrockProxyService, BedrockAnthropicProxyService],
})
export class BedrockProxyModule {}
