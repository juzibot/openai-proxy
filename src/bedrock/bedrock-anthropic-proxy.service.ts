import { Inject, Injectable } from '@nestjs/common';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { Credentials } from 'aws-sdk';
import { Response } from 'express';
import { HttpClientService } from 'src/common/http-client';
import { describeAwsError, toUpstreamHttpException } from './aws-error';

/**
 * Bedrock v2 proxy — 使用 AWS SDK v3 + NodeHttpHandler
 * 相比 v1:
 * - 支持 SOCKS5 代理（通过 NodeHttpHandler + SocksProxyAgent）
 * - 完整的错误日志（打印 Bedrock 返回的错误详情）
 * - 直接透传 Anthropic Messages API body（包括 output_config 等新特性）
 */
@Injectable()
export class BedrockAnthropicProxyService {
  @Inject()
  private readonly httpClient: HttpClientService;

  private createClient(
    accessKeyId: string,
    accessKeySecret: string,
    region: string,
  ) {
    const credentials = new Credentials({
      accessKeyId,
      secretAccessKey: accessKeySecret,
    });

    const clientOptions: any = { region, credentials };
    const { httpAgent, httpsAgent } = this.httpClient.getAgents();
    clientOptions.requestHandler = new NodeHttpHandler({
      httpAgent,
      httpsAgent,
      connectionTimeout: 30_000,
      socketTimeout: 10 * 60_000, // 10 minutes for long completions
    });

    return new BedrockRuntimeClient(clientOptions);
  }

  async chatCompletion(body: any) {
    const { modelId, accessKeyId, accessKeySecret, region, requestBody } = body;
    const client = this.createClient(accessKeyId, accessKeySecret, region);

    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      body: JSON.stringify(requestBody),
    });

    try {
      const response = await client.send(command);
      const decodedResponseBody = new TextDecoder().decode(response.body);
      return JSON.parse(decodedResponseBody);
    } catch (error: any) {
      const errorDetail = await describeAwsError(error);
      console.error(
        'Bedrock v2 chatCompletion error:',
        JSON.stringify(errorDetail),
      );
      throw toUpstreamHttpException(errorDetail);
    }
  }

  async streamChatCompletion(body: any, response: Response) {
    const { modelId, accessKeyId, accessKeySecret, region, requestBody } = body;
    const client = this.createClient(accessKeyId, accessKeySecret, region);

    const command = new InvokeModelWithResponseStreamCommand({
      modelId,
      contentType: 'application/json',
      body: JSON.stringify(requestBody),
    });

    // send 先于 setHeader —— 此时响应头尚未发出，失败可走 Nest 正常 JSON 错误
    let bedrockResponse: any;
    try {
      bedrockResponse = await client.send(command);
    } catch (error: any) {
      const errorDetail = await describeAwsError(error);
      console.error('Bedrock v2 stream error:', JSON.stringify(errorDetail));
      throw toUpstreamHttpException(errorDetail);
    }

    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');

    try {
      const stream = bedrockResponse.body;

      for await (const chunk of stream) {
        if (chunk.chunk?.bytes) {
          const decodedChunk = new TextDecoder().decode(chunk.chunk.bytes);
          const jsonData = JSON.parse(decodedChunk);
          response.write(`data: ${JSON.stringify(jsonData)}\n\n`);
        }
      }

      response.write('data: [DONE]\n\n');
      response.end();
    } catch (error: any) {
      // 头已发出，只能把错误详情写进 SSE
      const errorDetail = await describeAwsError(error);
      console.error(
        'Bedrock v2 stream chunk error:',
        JSON.stringify(errorDetail),
      );
      response.write(`data: ${JSON.stringify({ error: errorDetail })}\n\n`);
      response.end();
    }
  }
}
