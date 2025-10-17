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
    const params = req.params as any;
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

  @Post('upload/v1beta/files')
  async uploadFileInit(
    @Query() query: any,
    @Body() body: any,
    @Headers() headers: any,
    @Res({ passthrough: true }) res: Response,
    @Req() req: any,
  ) {
    if (query.upload_id) {
      const queryString = new URLSearchParams(query).toString();
      const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?${queryString}`;
      const bufferBody = req.body;
      return this.service.uploadFileData(uploadUrl, bufferBody, headers);
    }
    const result = await this.service.uploadFileInit(body, headers);
    res.status(result.status);
    Object.keys(result.headers).forEach(key => {
      res.setHeader(key, result.headers[key]);
    });
    return result.data;
  }

  @Post('upload/v1beta/files/:path(*)')
  async uploadFileData(
    @Param('path') path: string,
    @Body() body: Buffer,
    @Headers() headers: any,
    @Query() query: any,
  ) {
    const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files/${path}`;
    const chunkIndex = query.chunk_index ? parseInt(query.chunk_index) : 0;
    const totalChunks = query.total_chunks ? parseInt(query.total_chunks) : 1;
    if (totalChunks > 1) {
      return this.service.uploadFileChunk(uploadUrl, body, headers, chunkIndex, totalChunks);
    } else {
      return this.service.uploadFileData(uploadUrl, body, headers);
    }
  }

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

  @Get('v1beta/:path(*)')
  async getFile(
    @Param('path') path: string,
    @Headers() headers: any,
  ) {
    const url = `https://generativelanguage.googleapis.com/v1beta/${path}`;
    return this.service.getFileInfo(url, headers);
  }
}
