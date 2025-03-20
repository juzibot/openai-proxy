import { Injectable } from '@nestjs/common';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { Credentials } from 'aws-sdk';
import { Response } from 'express';

@Injectable()
export class BedrockProxyService {
  async chatCompletion(body: any) {
    const { modelId, accessKeyId, accessKeySecret, region, requestBody } = body;
    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      body: JSON.stringify(requestBody),
    });

    const credentials = new Credentials({
      accessKeyId: accessKeyId,
      secretAccessKey: accessKeySecret,
    });
    const client = new BedrockRuntimeClient({ region, credentials });

    const response = await client.send(command);
    const decodedResponseBody = new TextDecoder().decode(response.body);
    const responseBody = JSON.parse(decodedResponseBody);
    return responseBody;
  }

  async streamChatCompletion(body: any, response: Response) {
    const { modelId, accessKeyId, accessKeySecret, region, requestBody } = body;
    const command = new InvokeModelWithResponseStreamCommand({
      modelId,
      contentType: 'application/json',
      body: JSON.stringify(requestBody),
    });
    const credentials = new Credentials({
      accessKeyId: accessKeyId,
      secretAccessKey: accessKeySecret,
    });
    const client = new BedrockRuntimeClient({ region, credentials });

    const bedrockResponse = await client.send(command);
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
    } catch (error) {
      console.error('Error processing stream:', error);
      response.write(
        `data: ${JSON.stringify({ error: 'Stream processing error' })}\n\n`,
      );
      response.end();
    }
  }
}
