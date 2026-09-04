import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  describeNetworkError,
  HttpClientService,
} from 'src/common/http-client';
import { MINUTE } from 'src/common/time';
import FormData from 'form-data';
import { safeUpstreamOrigin } from '../common/upstream-url';

@Injectable()
export class XaiProxyService {
  private readonly logger = new Logger(XaiProxyService.name);

  @Inject()
  private readonly httpClient: HttpClientService;

  async chatCompletion(body: any, headers: any) {
    const url = 'https://api.x.ai/v1/chat/completions';
    return this.makeRequest(
      url,
      {
        Authorization: headers.authorization,
      },
      body,
      body.stream,
    );
  }

  async embeddings(body: any, headers: any) {
    const url = 'https://api.x.ai/v1/embeddings';
    return this.makeRequest(
      url,
      {
        Authorization: headers.authorization,
      },
      body,
    );
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
      'https://api.x.ai/v1/audio/transcriptions',
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
        headers,
        responseType: stream ? 'stream' : 'json',
        data: body,
        timeout: 10 * MINUTE,
      });
    } catch (e) {
      if (e.response) {
        throw new HttpException(
          'xAI upstream request rejected',
          e.response.status,
        );
      } else if (e.request) {
        const detail = describeNetworkError(e);
        this.logger.error(
          `xai upstream network error upstream=${safeUpstreamOrigin(
            url,
          )} ${JSON.stringify(detail)}`,
        );
        throw new HttpException('xAI upstream request failed', 502);
      } else {
        this.logger.error(`xai request setup error name=${e?.name ?? 'Error'}`);
        throw new HttpException('xAI upstream request failed', 502);
      }
    }

    if (response.status !== 200) {
      const error = new HttpException(
        'xAI upstream request rejected',
        response.status,
      );
      throw error;
    }
    return response.data;
  }
}
