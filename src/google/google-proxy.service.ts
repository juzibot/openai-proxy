import { HttpException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { MINUTE } from 'src/common/time';

@Injectable()
export class GoogleProxyService {
  @Inject()
  private readonly configService: ConfigService;

  async generateContent(body: any, headers: any, query: any, model: string) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    return this.makeRequest(url, headers, body, query, false);
  }

  async streamGenerateContent(
    body: any,
    headers: any,
    query: any,
    model: string,
  ) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`;

    return this.makeRequest(url, headers, body, query, true);
  }

  private async makeRequest(
    url: string,
    headers: any,
    body: any,
    query: any,
    stream?: boolean,
  ) {
    const { httpAgent, httpsAgent } = this.getAgents();
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
        params: query,
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
        console.log(e.message);
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
