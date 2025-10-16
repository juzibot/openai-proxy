import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
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

  private readonly logger = new Logger(GoogleProxyService.name);

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

  /**
   * File API - 初始化 Resumable Upload
   */
  async uploadFileInit(body: any, headers: any): Promise<{ status: number; headers: any; data: any }> {
    const url = 'https://generativelanguage.googleapis.com/upload/v1beta/files';
    const { httpAgent, httpsAgent } = this.getAgents();

    this.logger.log('[GOOGLE_PROXY] Initializing file upload...');

    try {
      const response = await axios.post(url, body, {
        httpAgent,
        httpsAgent,
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': headers['x-goog-api-key'],
          'X-Goog-Upload-Protocol': headers['x-goog-upload-protocol'],
          'X-Goog-Upload-Command': headers['x-goog-upload-command'],
          'X-Goog-Upload-Header-Content-Length': headers['x-goog-upload-header-content-length'],
          'X-Goog-Upload-Header-Content-Type': headers['x-goog-upload-header-content-type'],
        },
        timeout: 2 * MINUTE,
        validateStatus: () => true, // 接受所有状态码
      });

      this.logger.log(`[GOOGLE_PROXY] File upload initialized, status: ${response.status}`);

      return {
        status: response.status,
        headers: response.headers,
        data: response.data,
      };
    } catch (error) {
      this.logger.error('[GOOGLE_PROXY] Failed to initialize file upload:', error.message);
      throw error;
    }
  }

  /**
   * File API - 上传文件数据（支持分块上传）
   */
  async uploadFileData(uploadUrl: string, body: Buffer, headers: any) {
    const { httpAgent, httpsAgent } = this.getAgents();
    const contentLength = headers['content-length'] || body.length;
    const uploadOffset = headers['x-goog-upload-offset'] || '0';
    const uploadCommand = headers['x-goog-upload-command'] || 'upload, finalize';

    this.logger.log(`[GOOGLE_PROXY] Uploading chunk to: ${uploadUrl}`);
    this.logger.log(`[GOOGLE_PROXY] Chunk info: Size=${contentLength}, Offset=${uploadOffset}, Command=${uploadCommand}`);

    try {
      const response = await axios.post(uploadUrl, body, {
        httpAgent,
        httpsAgent,
        headers: {
          'Content-Length': contentLength.toString(),
          'X-Goog-Upload-Offset': uploadOffset,
          'X-Goog-Upload-Command': uploadCommand,
        },
        timeout: 5 * MINUTE,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        validateStatus: () => true, // 不自动抛出错误
      });

      this.logger.log(`[GOOGLE_PROXY] Chunk upload response status: ${response.status}`);

      // 如果是最后一块，记录完成信息
      if (uploadCommand.includes('finalize')) {
        this.logger.log(`[GOOGLE_PROXY] File upload completed successfully`);
      }

      return response.data;
    } catch (error) {
      this.logger.error(`[GOOGLE_PROXY] Failed to upload chunk (offset: ${uploadOffset}):`, error.message);
      if (error.response) {
        this.logger.error(`[GOOGLE_PROXY] Response data: ${JSON.stringify(error.response.data)}`);
        throw new HttpException(error.response.data, error.response.status);
      }
      throw error;
    }
  }

  /**
   * File API - 分块上传文件数据
   * @param uploadUrl 上传URL
   * @param chunkData 块数据
   * @param headers 请求头
   * @param chunkIndex 块索引
   * @param totalChunks 总块数
   */
  async uploadFileChunk(
    uploadUrl: string,
    chunkData: Buffer,
    headers: any,
    chunkIndex: number,
    totalChunks: number
  ) {
    const { httpAgent, httpsAgent } = this.getAgents();

    const contentLength = chunkData.length;
    const uploadOffset = headers['x-goog-upload-offset'] || '0';
    const isLastChunk = chunkIndex === totalChunks - 1;
    const uploadCommand = isLastChunk ? 'upload, finalize' : 'upload';

    this.logger.log(`[GOOGLE_PROXY] Uploading chunk ${chunkIndex + 1}/${totalChunks} to: ${uploadUrl}`);
    this.logger.log(`[GOOGLE_PROXY] Chunk info: Size=${contentLength}, Offset=${uploadOffset}, Command=${uploadCommand}`);

    try {
      const response = await axios.post(uploadUrl, chunkData, {
        httpAgent,
        httpsAgent,
        headers: {
          'Content-Length': contentLength.toString(),
          'X-Goog-Upload-Offset': uploadOffset,
          'X-Goog-Upload-Command': uploadCommand,
        },
        timeout: 5 * MINUTE,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        validateStatus: () => true,
      });

      this.logger.log(`[GOOGLE_PROXY] Chunk ${chunkIndex + 1}/${totalChunks} upload response status: ${response.status}`);

      if (isLastChunk) {
        this.logger.log(`[GOOGLE_PROXY] All chunks uploaded successfully`);
      }

      return response.data;
    } catch (error) {
      this.logger.error(`[GOOGLE_PROXY] Failed to upload chunk ${chunkIndex + 1}/${totalChunks} (offset: ${uploadOffset}):`, error.message);
      if (error.response) {
        this.logger.error(`[GOOGLE_PROXY] Response data: ${JSON.stringify(error.response.data)}`);
        throw new HttpException(error.response.data, error.response.status);
      }
      throw error;
    }
  }

  /**
   * File API - 获取文件信息
   */
  async getFileInfo(url: string, headers: any) {
    const { httpAgent, httpsAgent } = this.getAgents();

    this.logger.log(`[GOOGLE_PROXY] Getting file info from: ${url}`);

    try {
      const response = await axios.get(url, {
        httpAgent,
        httpsAgent,
        headers: {
          'x-goog-api-key': headers['x-goog-api-key'],
        },
        timeout: 30000,
      });

      return response.data;
    } catch (error) {
      this.logger.error('[GOOGLE_PROXY] Failed to get file info:', error.message);
      if (error.response) {
        throw new HttpException(error.response.data, error.response.status);
      }
      throw error;
    }
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
