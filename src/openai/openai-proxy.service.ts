import { HttpException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { MINUTE } from 'src/common/time';
import FormData from 'form-data';

@Injectable()
export class OpenaiProxyService {
  @Inject()
  private readonly configService: ConfigService;

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
    const url = `https://api.openai.com/v1/videos/${videoId}`;
    return this.makeGetRequest(url, {
      Authorization: headers.authorization,
    });
  }

  async videosRetrieveContent(videoId: string, headers: any) {
    const url = `https://api.openai.com/v1/videos/${videoId}/content`;
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
    const { httpAgent, httpsAgent } = this.getAgents();
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

  private async makeGetRequest(
    url: string,
    headers: any,
    params?: any,
    stream?: boolean,
  ) {
    const { httpAgent, httpsAgent } = this.getAgents();
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
        if (stream) {
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
