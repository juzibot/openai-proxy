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

  async countTokens(body: any, headers: any, query: any, model: string) {
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:countTokens`;
    return this.makeRequest(url, headers, body, query, false);
  }

  async uploadFileInit(body: any, headers: any): Promise<{ status: number; headers: any; data: any }> {
    const url = 'https://generativelanguage.googleapis.com/upload/v1beta/files';
    const result = await this.makeRequest(url, headers, body, {}, false, {
      customHeaders: {
        'X-Goog-Upload-Protocol': headers['x-goog-upload-protocol'],
        'X-Goog-Upload-Command': headers['x-goog-upload-command'],
        'X-Goog-Upload-Header-Content-Length': headers['x-goog-upload-header-content-length'],
        'X-Goog-Upload-Header-Content-Type': headers['x-goog-upload-header-content-type'],
      },
      validateStatus: (status) => status === 200 || status === 308,
      timeout: 2 * MINUTE,
      returnFullResponse: true,
    });
    return result;
  }

  async uploadFileData(uploadUrl: string, body: Buffer, headers: any) {
    const contentLength = headers['content-length'] || body.length;
    const uploadOffset = headers['x-goog-upload-offset'] || '0';
    const uploadCommand = headers['x-goog-upload-command'] || 'upload, finalize';
    const result = await this.makeRequest(uploadUrl, headers, body, {}, false, {
      customHeaders: {
        'Content-Length': contentLength.toString(),
        'X-Goog-Upload-Offset': uploadOffset,
        'X-Goog-Upload-Command': uploadCommand,
      },
      timeout: 5 * MINUTE,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      validateStatus: (status) => status === 200 || status === 201 || status === 308,
      isBinaryData: true,
      returnFullResponse: true,
    });

    if (result.status === 201) {
      return result;
    }
    return result.data;
  }

  async uploadFileChunk(
    uploadUrl: string,
    chunkData: Buffer,
    headers: any,
    chunkIndex: number,
    totalChunks: number
  ) {
    const contentLength = chunkData.length;
    const uploadOffset = headers['x-goog-upload-offset'] || '0';
    const isLastChunk = chunkIndex === totalChunks - 1;
    const uploadCommand = isLastChunk ? 'upload, finalize' : 'upload';

    const result = await this.makeRequest(uploadUrl, headers, chunkData, {}, false, {
      customHeaders: {
        'Content-Length': contentLength.toString(),
        'X-Goog-Upload-Offset': uploadOffset,
        'X-Goog-Upload-Command': uploadCommand,
      },
      timeout: 5 * MINUTE,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      validateStatus: (status) => status === 200 || status === 201 || status === 308,
      isBinaryData: true,
      returnFullResponse: true, // 返回完整响应以获取文件信息
    });
    if (result.status === 201) {
      return result;
    }
    return result.data;
  }

  async getFileInfo(url: string, headers: any, query?: any) {
    const result = await this.makeRequest(url, headers, null, query || {}, false, {
      method: 'GET',
      timeout: 30000,
      isBinaryData: true,  // 避免为 GET 请求添加 Content-Type header
    });
    return result;
  }

  private async makeRequest(
    url: string,
    headers: any,
    body: any,
    query: any,
    stream?: boolean,
    options?: {
      method?: string;
      customHeaders?: Record<string, string>;
      validateStatus?: (status: number) => boolean;
      timeout?: number;
      returnFullResponse?: boolean;
      maxContentLength?: number;
      maxBodyLength?: number;
      isBinaryData?: boolean;
    },
  ) {
    const { httpAgent, httpsAgent } = this.getAgents();
    const {
      method = 'POST',
      customHeaders = {},
      validateStatus = (status) => status === 200,
      timeout = 10 * MINUTE,
      returnFullResponse = false,
      maxContentLength,
      maxBodyLength,
      isBinaryData = false,
    } = options || {};

    const requestHeaders: Record<string, string> = {
      ...customHeaders,
    };
    if (!isBinaryData) {
      requestHeaders['Content-Type'] = 'application/json';
    }
    if (headers['anthropic-version']) {
      requestHeaders['anthropic-version'] = headers['anthropic-version'];
    }
    if (headers['x-api-key']) {
      requestHeaders['x-api-key'] = headers['x-api-key'];
    }
    if (headers['x-goog-api-key']) {
      requestHeaders['x-goog-api-key'] = headers['x-goog-api-key'];
    }
    const axiosConfig: any = {
      httpAgent,
      httpsAgent,
      method,
      headers: requestHeaders,
      params: query,
      responseType: stream ? 'stream' : 'json',
      data: body,
      timeout,
      validateStatus,
    };
    if (maxContentLength !== undefined) {
      axiosConfig.maxContentLength = maxContentLength;
    }
    if (maxBodyLength !== undefined) {
      axiosConfig.maxBodyLength = maxBodyLength;
    }
    let response: any;
    try {
      response = await axios(url, axiosConfig);
    } catch (e) {
      if (e.response) {
        if (stream) {
          return e.response.data;
        }
        throw new HttpException({
          message: e.response.data?.message || e.message,
          data: e.response.data,
          status: e.response.status,
          statusText: e.response.statusText,
          headers: e.response.headers,
        }, e.response.status);
      } else if (e.request) {
        throw new HttpException({
          message: `Network request failed: ${e.message}`,
          code: e.code,
          errno: e.errno,
          syscall: e.syscall,
          hostname: e.hostname,
          port: e.port,
          path: e.path,
        }, 500);
      } else {
        throw new HttpException({
          message: e.message,
          stack: e.stack,
          name: e.name,
        }, 500);
      }
    }
    if (!validateStatus(response.status)) {
      throw new HttpException({
        message: response.data?.message || `HTTP ${response.status} Error`,
        data: response.data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      }, response.status);
    }
    return returnFullResponse
      ? {
          status: response.status,
          headers: response.headers,
          data: response.data,
        }
      : response.data;
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
