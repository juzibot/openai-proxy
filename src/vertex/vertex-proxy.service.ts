import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  describeNetworkError,
  HttpClientService,
} from 'src/common/http-client';
import { MINUTE } from 'src/common/time';

/**
 * Vertex AI（现名 Gemini Enterprise Agent Platform）转发。
 *
 * 与 /google 通道（generativelanguage.googleapis.com，即 AI Studio）的区别：
 * - host 按 location 分四种，见 resolveHost
 * - 认证走 x-goog-api-key header（绑定服务账号的 API Key），不是 ?key= query
 * - 模型路径是 projects/{p}/locations/{l}/publishers/{pub}/models/{m}
 * - 没有 File API，文件只能 inline base64 或 gs:// URI
 *
 * 这里没有复用 google-proxy.service 的 makeRequest：openai-proxy 没有测试环境，
 * 改动直接进生产，所以先让 vertex 自包含、不碰现有通道。等稳定后再考虑抽公共部分。
 */
@Injectable()
export class VertexProxyService {
  private readonly logger = new Logger(VertexProxyService.name);

  @Inject()
  private readonly httpClient: HttpClientService;

  /** 非流式 method 白名单。predict 是 embedding，rawPredict 是 Claude。 */
  static readonly UNARY_METHODS = [
    'generateContent',
    'countTokens',
    'predict',
    'rawPredict',
  ];

  /** 流式 method 白名单。 */
  static readonly STREAM_METHODS = [
    'streamGenerateContent',
    'streamRawPredict',
  ];

  /**
   * location → host，四个分支照抄 @anthropic-ai/vertex-sdk 的 src/client.ts。
   * global 用无前缀 host；us / eu 是 multi-region，走 .rep. host；其余按 region 前缀。
   * 漏掉 us / eu 会把 multi-region 请求打到并不存在的 us-aiplatform.googleapis.com。
   */
  resolveHost(location: string): string {
    switch (location) {
      case 'global':
        return 'https://aiplatform.googleapis.com';
      case 'us':
        return 'https://aiplatform.us.rep.googleapis.com';
      case 'eu':
        return 'https://aiplatform.eu.rep.googleapis.com';
      default:
        return `https://${location}-aiplatform.googleapis.com`;
    }
  }

  /**
   * 拼完整的上游 URL。model 原样透传——Claude 的 model id 带 @ 日期后缀
   * （claude-sonnet-4-5@20250929），@ 在 path segment 里是合法字符，不要编码。
   */
  buildUrl(
    projectId: string,
    location: string,
    publisher: string,
    model: string,
    method: string,
  ): string {
    const host = this.resolveHost(location);
    return `${host}/v1/projects/${projectId}/locations/${location}/publishers/${publisher}/models/${model}:${method}`;
  }

  /**
   * reqParams 形如 `gemini-2.5-flash:generateContent` 或
   * `claude-sonnet-4-5@20250929:rawPredict`。用最后一个冒号切，
   * 避免 model id 里出现冒号时切错。
   */
  parseReqParams(reqParams: string): { model: string; method: string } {
    const idx = reqParams.lastIndexOf(':');
    if (idx <= 0 || idx === reqParams.length - 1) {
      throw new HttpException(
        `Invalid model:method segment: ${reqParams}`,
        400,
      );
    }
    return {
      model: reqParams.slice(0, idx),
      method: reqParams.slice(idx + 1),
    };
  }

  isStreamMethod(method: string): boolean {
    return VertexProxyService.STREAM_METHODS.includes(method);
  }

  isSupportedMethod(method: string): boolean {
    return (
      VertexProxyService.UNARY_METHODS.includes(method) ||
      VertexProxyService.STREAM_METHODS.includes(method)
    );
  }

  async forward(
    projectId: string,
    location: string,
    publisher: string,
    reqParams: string,
    body: any,
    headers: any,
    query: any,
  ) {
    const { model, method } = this.parseReqParams(reqParams);

    if (!this.isSupportedMethod(method)) {
      throw new HttpException(`Method not supported: ${method}`, 404);
    }

    const url = this.buildUrl(projectId, location, publisher, model, method);
    return this.makeRequest(url, headers, body, query, this.isStreamMethod(method));
  }

  private async makeRequest(
    url: string,
    headers: any,
    body: any,
    query: any,
    stream: boolean,
  ) {
    const { httpAgent, httpsAgent } = this.httpClient.getAgents();

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    // Vertex 的 API Key 认证走这个 header；Bearer token 方式走 authorization。
    // 两种都透传，由调用方决定用哪种。
    if (headers['x-goog-api-key']) {
      requestHeaders['x-goog-api-key'] = headers['x-goog-api-key'];
    }
    if (headers['authorization']) {
      requestHeaders['authorization'] = headers['authorization'];
    }

    const axiosConfig: any = {
      httpAgent,
      httpsAgent,
      method: 'POST',
      headers: requestHeaders,
      params: query,
      responseType: stream ? 'stream' : 'json',
      data: body,
      timeout: 10 * MINUTE,
      validateStatus: (status: number) => status === 200,
    };

    let response: any;
    try {
      response = await axios(url, axiosConfig);
    } catch (e) {
      if (e.response) {
        if (stream) {
          return e.response.data;
        }
        throw new HttpException(
          {
            message: e.response.data?.error?.message || e.message,
            data: e.response.data,
            status: e.response.status,
            statusText: e.response.statusText,
          },
          e.response.status,
        );
      } else if (e.request) {
        const detail = describeNetworkError(e);
        this.logger.error(
          `vertex upstream network error url=${url} ${JSON.stringify(detail)}`,
        );
        throw new HttpException(
          {
            message: `Network request failed: ${e.message}`,
            ...detail,
            path: e.path,
          },
          500,
        );
      } else {
        throw new HttpException(
          {
            message: e.message,
            stack: e.stack,
            name: e.name,
          },
          500,
        );
      }
    }

    return response.data;
  }
}
