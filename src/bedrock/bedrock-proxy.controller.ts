import { Body, Controller, HttpCode, Inject, Post, Res } from '@nestjs/common';
import { BedrockProxyService } from './bedrock-proxy.service';
import { BedrockCompletionRequestDto } from './bedrock-proxy.dto';
import { Response } from 'express';

@Controller('bedrock')
export class BedrockProxyController {
  @Inject()
  private readonly bedrockProxyService: BedrockProxyService;

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
}
