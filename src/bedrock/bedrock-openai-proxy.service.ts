import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  describeNetworkError,
  HttpClientService,
} from 'src/common/http-client';
import { MINUTE } from 'src/common/time';

/**
 * Bedrock 上 OpenAI 系模型的转发。
 *
 * 与同目录 v1 / v2 的区别：那两条走 AWS SDK 的 InvokeModel，而 GPT-5.6 三档
 * 在 Bedrock 上不支持 Invoke，只能打 bedrock-runtime 的 OpenAI 兼容端点，
 * 所以这里是纯 HTTP 转发、body 原样透传，形态上更接近 openai 模块。
 *
 * 认证由调用方签好短期 bearer token 经 Authorization 头传入，本服务不持有凭据，
 * 保持无状态——避免在没有测试环境的仓库里引入 token 刷新逻辑。
 */
@Injectable()
export class BedrockOpenAIProxyService {
  private readonly logger = new Logger(BedrockOpenAIProxyService.name);

  @Inject()
  private readonly httpClient: HttpClientService;

  async responses(region: string, body: any, headers: any) {
    const url = `https://bedrock-runtime.${region}.amazonaws.com/openai/v1/responses`;
    return this.makeRequest(url, headers.authorization, body, body?.stream);
  }

  private async makeRequest(
    url: string,
    authorization: string,
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
          Authorization: authorization,
        },
        responseType: stream ? 'stream' : 'json',
        data: body,
        timeout: 10 * MINUTE,
      });
    } catch (e) {
      if (e.response) {
        // 流式下 error body 也是 stream，直接回给调用方，避免在这里 await 消费掉
        if (stream) {
          return e.response.data;
        }
        throw new HttpException(e.response.data, e.response.status);
      } else if (e.request) {
        const detail = describeNetworkError(e);
        this.logger.error(
          `bedrock openai upstream network error url=${url} ${JSON.stringify(
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
      throw new HttpException(response.data, response.status);
    }
    return response.data;
  }
}
