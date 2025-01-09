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
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { GoogleProxyService } from './google-proxy.service';

@Controller()
export class GoogleProxyController {
  @Inject()
  private readonly service: GoogleProxyService;

  @Post('/google/v1beta/models/:reqParams')
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
      return result;
    } else {
      throw new HttpException('Method not found', 404);
    }
  }
}
