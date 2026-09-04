import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  describeNetworkError,
  HttpClientService,
} from 'src/common/http-client';
import { MINUTE } from 'src/common/time';
import { MAX_UPLOAD_BYTES } from '../common/upload';
import { filterGoogleUploadHeaders } from '../common/upstream-headers';
import {
  encodeUpstreamSegment,
  safeUpstreamOrigin,
} from '../common/upstream-url';

@Injectable()
export class GoogleProxyService {
  private readonly logger = new Logger(GoogleProxyService.name);

  @Inject()
  private readonly httpClient: HttpClientService;

  async generateContent(body: any, headers: any, query: any, model: string) {
    const safeModel = encodeUpstreamSegment(model, 'model');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${safeModel}:generateContent`;
    return this.makeRequest(url, headers, body, query, false);
  }

  async streamGenerateContent(
    body: any,
    headers: any,
    query: any,
    model: string,
  ) {
    const safeModel = encodeUpstreamSegment(model, 'model');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${safeModel}:streamGenerateContent`;
    return this.makeRequest(url, headers, body, query, true);
  }

  async countTokens(body: any, headers: any, query: any, model: string) {
    const safeModel = encodeUpstreamSegment(model, 'model');
    const url = `https://generativelanguage.googleapis.com/v1/models/${safeModel}:countTokens`;
    return this.makeRequest(url, headers, body, query, false);
  }

  async embedContent(body: any, headers: any, query: any, model: string) {
    const safeModel = encodeUpstreamSegment(model, 'model');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${safeModel}:embedContent`;
    return this.makeRequest(url, headers, body, query, false);
  }

  async batchEmbedContents(body: any, headers: any, query: any, model: string) {
    const safeModel = encodeUpstreamSegment(model, 'model');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${safeModel}:batchEmbedContents`;
    return this.makeRequest(url, headers, body, query, false);
  }

  async uploadFileInit(
    body: any,
    headers: any,
  ): Promise<{ status: number; headers: any; data: any }> {
    const url = 'https://generativelanguage.googleapis.com/upload/v1beta/files';
    const result = await this.makeRequest(url, headers, body, {}, false, {
      customHeaders: {
        'X-Goog-Upload-Protocol': headers['x-goog-upload-protocol'],
        'X-Goog-Upload-Command': headers['x-goog-upload-command'],
        'X-Goog-Upload-Header-Content-Length':
          headers['x-goog-upload-header-content-length'],
        'X-Goog-Upload-Header-Content-Type':
          headers['x-goog-upload-header-content-type'],
      },
      validateStatus: (status) => status === 200 || status === 308,
      timeout: 2 * MINUTE,
      returnFullResponse: true,
    });
    return result;
  }

  async uploadFileData(
    uploadUrl: string,
    body: Buffer,
    headers: any,
    query: Record<string, unknown> = {},
  ) {
    const contentLength = body.length;
    const uploadOffset = headers['x-goog-upload-offset'] || '0';
    const uploadCommand =
      headers['x-goog-upload-command'] || 'upload, finalize';
    const result = await this.makeRequest(
      uploadUrl,
      headers,
      body,
      query,
      false,
      {
        customHeaders: {
          'Content-Length': contentLength.toString(),
          'X-Goog-Upload-Offset': uploadOffset,
          'X-Goog-Upload-Command': uploadCommand,
        },
        timeout: 5 * MINUTE,
        maxContentLength: MAX_UPLOAD_BYTES,
        maxBodyLength: MAX_UPLOAD_BYTES,
        validateStatus: (status) =>
          status === 200 || status === 201 || status === 308,
        isBinaryData: true,
        returnFullResponse: true,
      },
    );

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
    totalChunks: number,
  ) {
    const contentLength = chunkData.length;
    const uploadOffset = headers['x-goog-upload-offset'] || '0';
    const isLastChunk = chunkIndex === totalChunks - 1;
    const uploadCommand = isLastChunk ? 'upload, finalize' : 'upload';

    const result = await this.makeRequest(
      uploadUrl,
      headers,
      chunkData,
      {},
      false,
      {
        customHeaders: {
          'Content-Length': contentLength.toString(),
          'X-Goog-Upload-Offset': uploadOffset,
          'X-Goog-Upload-Command': uploadCommand,
        },
        timeout: 5 * MINUTE,
        maxContentLength: MAX_UPLOAD_BYTES,
        maxBodyLength: MAX_UPLOAD_BYTES,
        validateStatus: (status) =>
          status === 200 || status === 201 || status === 308,
        isBinaryData: true,
        returnFullResponse: true, // 返回完整响应以获取文件信息
      },
    );
    if (result.status === 201) {
      return result;
    }
    return result.data;
  }

  async getFileInfo(url: string, headers: any, query?: any) {
    const result = await this.makeRequest(
      url,
      headers,
      null,
      query || {},
      false,
      {
        method: 'GET',
        timeout: 30000,
        isBinaryData: true, // 避免为 GET 请求添加 Content-Type header
      },
    );
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
    const { httpAgent, httpsAgent } = this.httpClient.getAgents();
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
        throw new HttpException(
          'Google upstream request rejected',
          e.response.status,
        );
      } else if (e.request) {
        const detail = describeNetworkError(e);
        this.logger.error(
          `google upstream network error upstream=${safeUpstreamOrigin(
            url,
          )} ${JSON.stringify(detail)}`,
        );
        throw new HttpException('Google upstream request failed', 502);
      } else {
        this.logger.error(
          `google request setup error name=${e?.name ?? 'Error'}`,
        );
        throw new HttpException('Google upstream request failed', 502);
      }
    }
    if (!validateStatus(response.status)) {
      throw new HttpException(
        'Google upstream request rejected',
        response.status,
      );
    }
    return returnFullResponse
      ? {
          status: response.status,
          headers: filterGoogleUploadHeaders(response.headers),
          data: response.data,
        }
      : response.data;
  }
}
