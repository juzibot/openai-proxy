import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
  StreamableFile,
} from '@nestjs/common';
import { ProxyService } from './proxy.service';

@Controller()
export class ProxyController {
  @Inject()
  private readonly service: ProxyService;

  @Post('/v1/chat/completions')
  @HttpCode(200)
  async chatCompletion(@Body() body: any, @Headers() headers: any) {
    const result = await this.service.chatCompletion(body, headers);
    if (body.stream) {
      return new StreamableFile(result);
    }
    return result;
  }
}
