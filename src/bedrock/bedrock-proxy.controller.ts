import { Body, Controller, HttpCode, Inject, Post, Res } from '@nestjs/common';
import { BedrockProxyService } from './bedrock-proxy.service';
import { BedrockAnthropicProxyService } from './bedrock-anthropic-proxy.service';
import { BedrockCompletionRequestDto } from './bedrock-proxy.dto';
import { Response } from 'express';

@Controller('bedrock')
export class BedrockProxyController {
  @Inject()
  private readonly bedrockProxyService: BedrockProxyService;

  @Inject()
  private readonly bedrockAnthropicProxyService: BedrockAnthropicProxyService;

  // === v1: Raw InvokeModelCommand (legacy) ===

  @Post('/v1/chat/completions')
  @HttpCode(200)
  async chatCompletion(@Body() body: BedrockCompletionRequestDto) {
    const result = await this.bedrockProxyService.chatCompletion(body);
    return result;
  }

  @Post('/v1/chat/stream-completions')
  @HttpCode(200)
  async streamChatCompletion(
    @Body() body: BedrockCompletionRequestDto,
    @Res() response: Response,
  ) {
    const result = await this.bedrockProxyService.streamChatCompletion(
      body,
      response,
    );
    return result;
  }

  // === v2: Anthropic Bedrock SDK (supports output_config, tools, etc.) ===

  @Post('/v2/chat/completions')
  @HttpCode(200)
  async chatCompletionV2(@Body() body: BedrockCompletionRequestDto) {
    const result = await this.bedrockAnthropicProxyService.chatCompletion(body);
    return result;
  }

  @Post('/v2/chat/stream-completions')
  @HttpCode(200)
  async streamChatCompletionV2(
    @Body() body: BedrockCompletionRequestDto,
    @Res() response: Response,
  ) {
    const result = await this.bedrockAnthropicProxyService.streamChatCompletion(
      body,
      response,
    );
    return result;
  }
}
