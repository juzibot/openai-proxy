import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  Inject,
  Post,
  Query,
  Request,
  StreamableFile,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
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
    @Request() req: ExpressRequest,
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
}
