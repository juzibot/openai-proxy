import { HttpException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { MINUTE } from 'src/common/time';
import FormData from 'form-data';

@Injectable()
export class AnthropicProxyService {
  @Inject()
  private readonly configService: ConfigService;

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
    const { httpAgent, httpsAgent } = this.getAgents();
    const apiKey = headers['x-api-key'];
    if (!apiKey) {
      throw new HttpException('Missing x-api-key header', 401);
    }

    const requestHeaders = {
      'Content-Type': 'application/json',
      'anthropic-version': headers['anthropic-version'] || '2023-06-01',
      'x-api-key': apiKey,
    };

    let response: any;
    try {
      response = await axios(url, {
        httpAgent,
        httpsAgent,
        method: 'POST',
        headers: requestHeaders,
        responseType: stream ? 'stream' : 'json',
        data: body,
        timeout: 10 * MINUTE,
      });
    } catch (e: any) {
      if (e.response) {
        if (body?.stream) {
          return e.response.data;
        }
        throw new HttpException(e.response.data, e.response.status);
      } else if (e.request) {
        throw new Error(
          `Failed to send message. error message: ${e.message}, request: ${e.request}`,
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

  private getAgents() {
    const socksHost = this.configService.get<string | undefined>('socksHost');
    let httpAgent: HttpAgent | undefined;
    let httpsAgent: HttpsAgent | undefined;
    if (socksHost) {
      httpAgent = new SocksProxyAgent(socksHost);
      httpsAgent = new SocksProxyAgent(socksHost);
      httpsAgent.options.rejectUnauthorized = false;
    }
    return {
      httpAgent,
      httpsAgent,
    };
  }
}
