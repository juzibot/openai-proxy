import { Module } from '@nestjs/common';
import { BedrockProxyController } from './bedrock-proxy.controller';
import { BedrockProxyService } from './bedrock-proxy.service';
import { BedrockAnthropicProxyService } from './bedrock-anthropic-proxy.service';
import { BedrockOpenAIProxyService } from './bedrock-openai-proxy.service';

@Module({
  controllers: [BedrockProxyController],
  providers: [
    BedrockProxyService,
    BedrockAnthropicProxyService,
    BedrockOpenAIProxyService,
  ],
})
export class BedrockProxyModule {}
