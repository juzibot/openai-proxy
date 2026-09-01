import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { BedrockProxyService } from './bedrock-proxy.service';
import { BedrockAnthropicProxyService } from './bedrock-anthropic-proxy.service';
import { BedrockOpenAIProxyService } from './bedrock-openai-proxy.service';
import {
  BedrockCompletionRequestDto,
  BedrockOpenAIResponsesDto,
} from './bedrock-proxy.dto';
import { Response } from 'express';

@Controller('bedrock')
export class BedrockProxyController {
  @Inject()
  private readonly bedrockProxyService: BedrockProxyService;

  @Inject()
  private readonly bedrockAnthropicProxyService: BedrockAnthropicProxyService;

  @Inject()
  private readonly bedrockOpenAIProxyService: BedrockOpenAIProxyService;

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

  // === OpenAI 兼容端点 ===
  // 不挂成 v3：v1/v2 是同一个 InvokeModel 的版本演进，而 GPT-5.6 三档不支持
  // Invoke，走的是另一套 API，body 结构与认证方式都不同，混进版本序列会误导。
  // 流式与否由 requestBody.stream 决定，与 OpenAI 官方端点保持一致。

  @Post('/openai/v1/responses')
  @HttpCode(200)
  async openaiResponses(
    @Body() body: BedrockOpenAIResponsesDto,
    @Headers() headers: any,
  ) {
    const result = await this.bedrockOpenAIProxyService.responses(
      body.region,
      body.requestBody,
      headers,
    );
    if (body.requestBody?.stream) {
      return new StreamableFile(result);
    }
    return result;
  }
}
