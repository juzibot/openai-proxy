import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { VertexProxyService } from './vertex-proxy.service';

/**
 * 路由形状与 Vertex 官方 REST 一致，调用方把完整的 publishers 路径原样打过来：
 *
 *   POST /vertex/v1/projects/{projectId}/locations/{location}
 *        /publishers/{publisher}/models/{model}:{method}
 *
 * publisher 是路由参数，所以 google（Gemini）和 anthropic（Claude）共用这一个入口。
 */
@Controller('vertex')
export class VertexProxyController {
  @Inject()
  private readonly service: VertexProxyService;

  @Post(
    '/v1/projects/:projectId/locations/:location/publishers/:publisher/models/:reqParams',
  )
  @HttpCode(200)
  async predict(
    @Param('projectId') projectId: string,
    @Param('location') location: string,
    @Param('publisher') publisher: string,
    @Param('reqParams') reqParams: string,
    @Body() body: any,
    @Headers() headers: any,
    @Query() query: any,
  ) {
    const result = await this.service.forward(
      projectId,
      location,
      publisher,
      reqParams,
      body,
      headers,
      query,
    );

    const { method } = this.service.parseReqParams(reqParams);
    if (this.service.isStreamMethod(method)) {
      return new StreamableFile(result);
    }
    return result;
  }
}
