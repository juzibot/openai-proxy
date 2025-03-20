import { Module } from '@nestjs/common';
import { BedrockProxyController } from './bedrock-proxy.controller';
import { BedrockProxyService } from './bedrock-proxy.service';

@Module({
  controllers: [BedrockProxyController],
  providers: [BedrockProxyService],
})
export class BedrockProxyModule {}
