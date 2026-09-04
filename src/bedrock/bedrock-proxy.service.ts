import { Injectable, Logger } from '@nestjs/common';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { Response } from 'express';
import { describeAwsError, toUpstreamHttpException } from './aws-error';

@Injectable()
export class BedrockProxyService {
  private readonly logger = new Logger(BedrockProxyService.name);

  async chatCompletion(body: any) {
    const { modelId, region, requestBody } = body;
    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      body: JSON.stringify(requestBody),
    });

    const client = new BedrockRuntimeClient({ region });

    try {
      const response = await client.send(command);
      const decodedResponseBody = new TextDecoder().decode(response.body);
      const responseBody = JSON.parse(decodedResponseBody);
      return responseBody;
    } catch (error: any) {
      const errorDetail = await describeAwsError(error);
      this.logger.error(
        'Bedrock v1 chatCompletion error:',
        JSON.stringify(errorDetail),
      );
      throw toUpstreamHttpException(errorDetail);
    }
  }

  async streamChatCompletion(body: any, response: Response) {
    const { modelId, region, requestBody } = body;
    const command = new InvokeModelWithResponseStreamCommand({
      modelId,
      contentType: 'application/json',
      body: JSON.stringify(requestBody),
    });
    const client = new BedrockRuntimeClient({ region });

    // send 先于 setHeader —— 此时响应头尚未发出，失败可走 Nest 正常 JSON 错误
    let bedrockResponse: any;
    try {
      bedrockResponse = await client.send(command);
    } catch (error: any) {
      const errorDetail = await describeAwsError(error);
      this.logger.error(
        'Bedrock v1 stream error:',
        JSON.stringify(errorDetail),
      );
      throw toUpstreamHttpException(errorDetail);
    }
    const stream = bedrockResponse.body;

    // Set SSE headers
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');

    try {
      // Process the stream
      for await (const chunk of stream) {
        if (chunk.chunk?.bytes) {
          // Decode the chunk
          const decodedChunk = new TextDecoder().decode(chunk.chunk.bytes);
          const jsonData = JSON.parse(decodedChunk);

          // Format as SSE event
          response.write(`data: ${JSON.stringify(jsonData)}\n\n`);
        }
      }

      // End the response when stream is complete
      response.write('data: [DONE]\n\n');
      response.end();
    } catch (error: any) {
      // 头已发出，只能把错误详情写进 SSE
      const errorDetail = await describeAwsError(error);
      this.logger.error(
        'Bedrock v1 stream chunk error:',
        JSON.stringify(errorDetail),
      );
      response.write(
        `data: ${JSON.stringify({
          error: { message: 'Bedrock stream failed' },
        })}\n\n`,
      );
      response.end();
    }
  }
}
