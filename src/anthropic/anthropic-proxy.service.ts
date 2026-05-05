import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  describeNetworkError,
  HttpClientService,
} from 'src/common/http-client';
import { MINUTE } from 'src/common/time';
import FormData from 'form-data';

@Injectable()
export class AnthropicProxyService {
  private readonly logger = new Logger(AnthropicProxyService.name);

  @Inject()
  private readonly httpClient: HttpClientService;

  async chatCompletion(body: any, headers: any) {
    const url = 'https://api.anthropic.com/v1/messages';
    return this.makeRequest(url, headers, body, body.stream);
  }

  async countTokens(body: any, headers: any) {
    const url = 'https://api.anthropic.com/v1/messages/count_tokens';
    return this.makeRequest(url, headers, body);
  }

  async embeddings(body: any, headers: any) {
    const url = 'https://api.anthropic.com/v1/embeddings';
    return this.makeRequest(url, headers, body);
  }

  async transcriptions(file: Express.Multer.File, body: any, headers: any) {
    const formData = new FormData();
    formData.append('file', file.buffer, file.originalname);
    for (const [key, value] of Object.entries(body)) {
      formData.append(key, value);
    }

    const finalHeaders = {
      Authorization: headers.authorization,
      'Content-Type': 'multipart/form-data',
      ...formData.getHeaders(),
    };

    const response = await this.makeRequest(
      'https://api.anthropic.com/v1/audio/transcriptions',
      finalHeaders,
      formData,
    );

    return response;
  }

  private async makeRequest(
    url: string,
    headers: any,
    body: any,
    stream?: boolean,
  ) {
    const { httpAgent, httpsAgent } = this.httpClient.getAgents();
    let response: any;
    try {
      response = await axios(url, {
        httpAgent,
        httpsAgent,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': headers['anthropic-version'],
          'x-api-key': headers['x-api-key'],
        },
        responseType: stream ? 'stream' : 'json',
        data: body,
        timeout: 10 * MINUTE,
      });
    } catch (e) {
      if (e.response) {
        if (body.stream) {
          return e.response.data;
        }
        throw new HttpException(e.response.data, e.response.status);
      } else if (e.request) {
        const detail = describeNetworkError(e);
        this.logger.error(
          `anthropic upstream network error url=${url} ${JSON.stringify(
            detail,
          )}`,
        );
        throw new HttpException(
          { message: `Network request failed: ${e.message}`, ...detail },
          500,
        );
      } else {
        throw e;
      }
    }

    if (response.status !== 200) {
      const error = new HttpException(response.data, response.status);
      throw error;
    }
    return response.data;
  }
}
