import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { GoogleProxyService } from './google-proxy.service';

@Controller('google')
export class GoogleProxyController {
  @Inject()
  private readonly service: GoogleProxyService;

  @Post('/v1beta/models/:reqParams')
  @HttpCode(200)
  async generateContent(
    @Body() body: any,
    @Headers() headers: any,
    @Query() query: any,
    @Req() req: Request,
  ) {
    const params = req.params;
    const reqParams = params.reqParams;
    const [model, method] = reqParams.split(':');

    if (method === 'generateContent') {
      const result = await this.service.generateContent(
        body,
        headers,
        query,
        model,
      );
      return result;
    } else if (method === 'streamGenerateContent') {
      const result = await this.service.streamGenerateContent(
        body,
        headers,
        query,
        model,
      );
      return new StreamableFile(result);
    } else {
      throw new HttpException('Method not found', 404);
    }
  }

  /**
   * File API - 初始化 Resumable Upload 或上传文件数据
   * POST /google/upload/v1beta/files
   *
   * 通过查询参数 upload_id 区分两种情况：
   * - 没有 upload_id：初始化上传（JSON body）
   * - 有 upload_id：上传文件数据（Buffer body）
   */
  @Post('upload/v1beta/files')
  async uploadFileInit(
    @Query() query: any,
    @Body() body: any,
    @Headers() headers: any,
    @Res({ passthrough: true }) res: Response,
    @Req() req: any,
  ) {
    // 如果有 upload_id，说明是上传文件数据（第二步）
    if (query.upload_id) {
      // 重构完整的 upload URL（包含查询参数）
      const queryString = new URLSearchParams(query).toString();
      const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?${queryString}`;

      // 获取原始 Buffer body
      const bufferBody = req.body;

      return this.service.uploadFileData(uploadUrl, bufferBody, headers);
    }

    // 否则是初始化上传（第一步）
    const result = await this.service.uploadFileInit(body, headers);

    // 设置响应状态码
    res.status(result.status);

    // 设置响应头（包含 upload URL）
    Object.keys(result.headers).forEach(key => {
      res.setHeader(key, result.headers[key]);
    });

    // 使用 passthrough 模式，可以直接返回数据
    return result.data;
  }

  /**
   * File API - 上传文件数据（支持分块上传）
   * POST /google/upload/v1beta/files/*
   */
  @Post('upload/v1beta/files/:path(*)')
  async uploadFileData(
    @Param('path') path: string,
    @Body() body: Buffer,
    @Headers() headers: any,
    @Query() query: any,
  ) {
    // 重构完整的 upload URL
    const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files/${path}`;

    // 检查是否是分块上传（通过查询参数判断）
    const chunkIndex = query.chunk_index ? parseInt(query.chunk_index) : 0;
    const totalChunks = query.total_chunks ? parseInt(query.total_chunks) : 1;

    if (totalChunks > 1) {
      // 分块上传
      return this.service.uploadFileChunk(uploadUrl, body, headers, chunkIndex, totalChunks);
    } else {
      // 单块上传（兼容原有逻辑）
      return this.service.uploadFileData(uploadUrl, body, headers);
    }
  }

  /**
   * File API - 分块上传文件数据
   * POST /google/upload/v1beta/files/chunk/:path(*)
   */
  @Post('upload/v1beta/files/chunk/:path(*)')
  async uploadFileChunk(
    @Param('path') path: string,
    @Body() body: Buffer,
    @Headers() headers: any,
    @Query() query: any,
  ) {
    const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files/${path}`;
    const chunkIndex = parseInt(query.chunk_index || '0');
    const totalChunks = parseInt(query.total_chunks || '1');

    return this.service.uploadFileChunk(uploadUrl, body, headers, chunkIndex, totalChunks);
  }

  /**
   * File API - 获取文件信息
   * GET /google/v1beta/*
   */
  @Get('v1beta/:path(*)')
  async getFile(
    @Param('path') path: string,
    @Headers() headers: any,
  ) {
    const url = `https://generativelanguage.googleapis.com/v1beta/${path}`;
    return this.service.getFileInfo(url, headers);
  }
}
