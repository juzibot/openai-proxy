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
import { encodeUpstreamPath } from '../common/upstream-url';
import { filterGoogleUploadHeaders } from '../common/upstream-headers';

function parseModelRequest(reqParams: string) {
  const separator = reqParams.lastIndexOf(':');
  if (separator <= 0 || separator === reqParams.length - 1) {
    throw new HttpException('Invalid model request', 400);
  }
  return {
    model: reqParams.slice(0, separator),
    method: reqParams.slice(separator + 1),
  };
}

function applyUploadHeaders(res: Response, headers: Record<string, unknown>) {
  Object.entries(filterGoogleUploadHeaders(headers)).forEach(
    ([name, value]) => {
      res.setHeader(name, value);
    },
  );
}

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
    const { model, method } = parseModelRequest(reqParams);

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
    } else if (method === 'embedContent') {
      return this.service.embedContent(body, headers, query, model);
    } else if (method === 'batchEmbedContents') {
      return this.service.batchEmbedContents(body, headers, query, model);
    } else {
      throw new HttpException('Method not found', 404);
    }
  }

  @Post('/v1/models/:reqParams')
  @HttpCode(200)
  async countTokens(
    @Body() body: any,
    @Headers() headers: any,
    @Query() query: any,
    @Req() req: Request,
  ) {
    const params = req.params as any;
    const reqParams = params.reqParams;
    const { model, method } = parseModelRequest(reqParams);

    if (method !== 'countTokens') {
      throw new HttpException('Method not found', 404);
    }

    const result = await this.service.countTokens(body, headers, query, model);
    return result;
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
      const uploadUrl =
        'https://generativelanguage.googleapis.com/upload/v1beta/files';
      const bufferBody = req.body;
      const result = await this.service.uploadFileData(
        uploadUrl,
        bufferBody,
        headers,
        query,
      );
      if (result && typeof result === 'object' && 'status' in result) {
        res.status(result.status);
        if (result.headers) {
          applyUploadHeaders(res, result.headers);
        }
        return result.data;
      }
      return result;
    }

    const result = await this.service.uploadFileInit(body, headers);
    res.status(result.status);
    applyUploadHeaders(res, result.headers);
    return result.data;
  }

  @Post('upload/v1beta/files/:path(*)')
  async uploadFileData(
    @Param('path') path: string,
    @Body() body: Buffer,
    @Headers() headers: any,
    @Query() query: any,
  ) {
    const safePath = encodeUpstreamPath(path, 'Google upload path');
    const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files/${safePath}`;
    const chunkIndex = query.chunk_index ? parseInt(query.chunk_index) : 0;
    const totalChunks = query.total_chunks ? parseInt(query.total_chunks) : 1;
    if (totalChunks > 1) {
      return this.service.uploadFileChunk(
        uploadUrl,
        body,
        headers,
        chunkIndex,
        totalChunks,
      );
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
    const safePath = encodeUpstreamPath(path, 'Google upload path');
    const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files/${safePath}`;
    const chunkIndex = parseInt(query.chunk_index || '0');
    const totalChunks = parseInt(query.total_chunks || '1');
    return this.service.uploadFileChunk(
      uploadUrl,
      body,
      headers,
      chunkIndex,
      totalChunks,
    );
  }

  @Get('v1beta/:path(*)')
  async getFile(
    @Param('path') path: string,
    @Headers() headers: any,
    @Query() query: any,
  ) {
    const safePath = encodeUpstreamPath(path, 'Google file path');
    if (!/^files\/[^/]+$/.test(safePath)) {
      throw new HttpException('Unsupported Google resource path', 404);
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/${safePath}`;
    return this.service.getFileInfo(url, headers, query);
  }
}
