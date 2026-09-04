import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  describeNetworkError,
  HttpClientService,
} from 'src/common/http-client';
import { MINUTE } from 'src/common/time';
import FormData from 'form-data';
import {
  encodeUpstreamSegment,
  safeUpstreamOrigin,
} from '../common/upstream-url';

@Injectable()
export class OpenaiProxyService {
  private readonly logger = new Logger(OpenaiProxyService.name);

  @Inject()
  private readonly httpClient: HttpClientService;

  async chatCompletion(body: any, headers: any) {
    const url = 'https://api.openai.com/v1/chat/completions';
    return this.makeRequest(
      url,
      {
        Authorization: headers.authorization,
      },
      body,
      body.stream,
    );
  }

  // Responses API。GPT-5.6 起，带 function tools 的推理请求在 /v1/chat/completions
  // 上会被拒（报文要求改走这里），pro / codex 系列更是只提供本端点。
  // 与 chatCompletion 一样按 body.stream 走 SSE 透传。
  async responses(body: any, headers: any) {
    const url = 'https://api.openai.com/v1/responses';
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
    const url = 'https://api.openai.com/v1/embeddings';
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
      'https://api.openai.com/v1/audio/transcriptions',
      finalHeaders,
      formData,
    );

    return response;
  }

  async imageGenerations(body: any, headers: any) {
    const url = 'https://api.openai.com/v1/images/generations';
    return this.makeRequest(
      url,
      {
        Authorization: headers.authorization,
        'Content-Type': 'application/json',
      },
      body,
    );
  }

  async imageEdits(body: any, headers: any) {
    const url = 'https://api.openai.com/v1/images/edits';
    return this.makeRequest(
      url,
      {
        Authorization: headers.authorization,
        'Content-Type': 'application/json',
      },
      body,
    );
  }

  async uploadFile(file: Express.Multer.File, body: any, headers: any) {
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
      'https://api.openai.com/v1/files',
      finalHeaders,
      formData,
    );

    return response;
  }

  async videosCreate(body: any, headers: any) {
    const url = 'https://api.openai.com/v1/videos';
    return this.makeRequest(
      url,
      {
        Authorization: headers.authorization,
      },
      body,
      body.stream,
    );
  }

  async videosTranscriptions(
    file: Express.Multer.File,
    body: any,
    headers: any,
  ) {
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
      'https://api.openai.com/v1/videos/transcriptions',
      finalHeaders,
      formData,
    );

    return response;
  }

  async videosTranslations(file: Express.Multer.File, body: any, headers: any) {
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
      'https://api.openai.com/v1/videos/translations',
      finalHeaders,
      formData,
    );

    return response;
  }

  async videosEdits(
    files: {
      video?: Express.Multer.File[];
      file?: Express.Multer.File[];
      mask?: Express.Multer.File[];
    },
    body: any,
    headers: any,
  ) {
    const formData = new FormData();
    const primary = files?.video?.[0] ?? files?.file?.[0];
    if (primary) {
      formData.append('video', primary.buffer, primary.originalname);
    }
    const mask = files?.mask?.[0];
    if (mask) {
      formData.append('mask', mask.buffer, mask.originalname);
    }
    for (const [key, value] of Object.entries(body)) {
      formData.append(key, value);
    }

    const finalHeaders = {
      Authorization: headers.authorization,
      'Content-Type': 'multipart/form-data',
      ...formData.getHeaders(),
    };

    const response = await this.makeRequest(
      'https://api.openai.com/v1/videos/edits',
      finalHeaders,
      formData,
    );

    return response;
  }

  async videosList(query: any, headers: any) {
    const url = 'https://api.openai.com/v1/videos';
    return this.makeGetRequest(
      url,
      {
        Authorization: headers.authorization,
      },
      query,
    );
  }

  async videosRetrieve(videoId: string, headers: any) {
    const safeVideoId = encodeUpstreamSegment(videoId, 'video id');
    const url = `https://api.openai.com/v1/videos/${safeVideoId}`;
    return this.makeGetRequest(url, {
      Authorization: headers.authorization,
    });
  }

  async videosRetrieveContent(videoId: string, headers: any) {
    const safeVideoId = encodeUpstreamSegment(videoId, 'video id');
    const url = `https://api.openai.com/v1/videos/${safeVideoId}/content`;
    const stream = await this.makeGetRequest(
      url,
      {
        Authorization: headers.authorization,
      },
      undefined,
      true,
    );
    return stream;
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
          'OpenAI upstream request rejected',
          e.response.status,
        );
      } else if (e.request) {
        const detail = describeNetworkError(e);
        this.logger.error(
          `openai upstream network error upstream=${safeUpstreamOrigin(
            url,
          )} ${JSON.stringify(detail)}`,
        );
        throw new HttpException('OpenAI upstream request failed', 502);
      } else {
        this.logger.error(
          `openai request setup error name=${e?.name ?? 'Error'}`,
        );
        throw new HttpException('OpenAI upstream request failed', 502);
      }
    }

    if (response.status !== 200) {
      const error = new HttpException(
        'OpenAI upstream request rejected',
        response.status,
      );
      throw error;
    }
    return response.data;
  }

  private async makeGetRequest(
    url: string,
    headers: any,
    params?: any,
    stream?: boolean,
  ) {
    const { httpAgent, httpsAgent } = this.httpClient.getAgents();
    let response: any;
    try {
      response = await axios(url, {
        httpAgent,
        httpsAgent,
        method: 'GET',
        headers,
        responseType: stream ? 'stream' : 'json',
        params,
        timeout: 10 * MINUTE,
      });
    } catch (e) {
      if (e.response) {
        throw new HttpException(
          'OpenAI upstream request rejected',
          e.response.status,
        );
      } else if (e.request) {
        const detail = describeNetworkError(e);
        this.logger.error(
          `openai upstream network error upstream=${safeUpstreamOrigin(
            url,
          )} ${JSON.stringify(detail)}`,
        );
        throw new HttpException('OpenAI upstream request failed', 502);
      } else {
        this.logger.error(
          `openai request setup error name=${e?.name ?? 'Error'}`,
        );
        throw new HttpException('OpenAI upstream request failed', 502);
      }
    }

    if (response.status !== 200) {
      const error = new HttpException(
        'OpenAI upstream request rejected',
        response.status,
      );
      throw error;
    }
    return response.data;
  }
}
