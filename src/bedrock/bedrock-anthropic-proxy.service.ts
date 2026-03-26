import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { Credentials } from 'aws-sdk';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { Response } from 'express';

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
  private readonly configService: ConfigService;

  private createClient(
    accessKeyId: string,
    accessKeySecret: string,
    region: string,
  ) {
    const socksHost = this.configService.get<string | undefined>('socksHost');
    const credentials = new Credentials({
      accessKeyId,
      secretAccessKey: accessKeySecret,
    });

    const clientOptions: any = { region, credentials };
    if (socksHost) {
      const agent = new SocksProxyAgent(socksHost);
      clientOptions.requestHandler = new NodeHttpHandler({
        httpAgent: agent,
        httpsAgent: agent,
        connectionTimeout: 30_000,
        socketTimeout: 10 * 60_000, // 10 minutes for long completions
      });
    }

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
      // Extract full error details from Bedrock response
      const errorDetail: any = {
        name: error.name,
        message: error.message,
        statusCode: error.$metadata?.httpStatusCode,
        requestId: error.$metadata?.requestId,
      };
      // Try to decode error body if available
      if (error.$response?.body) {
        try {
          errorDetail.body = new TextDecoder().decode(
            await streamToBuffer(error.$response.body),
          );
        } catch {
          /* ignore */
        }
      }
      console.error(
        'Bedrock v2 chatCompletion error:',
        JSON.stringify(errorDetail),
      );
      throw error;
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

    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');

    try {
      const bedrockResponse = await client.send(command);
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
      console.error('Bedrock v2 stream error:', {
        name: error.name,
        message: error.message,
        statusCode: error.$metadata?.httpStatusCode,
      });
      response.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      response.end();
    }
  }
}

async function streamToBuffer(stream: any): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks) as unknown as Uint8Array;
}
