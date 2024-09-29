import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
  StreamableFile,
  UploadedFile,
} from '@nestjs/common';
import { ProxyService } from './proxy.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { UseInterceptors } from '@nestjs/common';

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

  @Post('/v1/embeddings')
  @HttpCode(200)
  async embeddings(@Body() body: any, @Headers() headers: any) {
    const result = await this.service.embeddings(body, headers);
    return result;
  }

  @Post('/v1/audio/transcriptions')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(200)
  async transcriptions(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Headers() headers: any,
  ) {
    const result = await this.service.transcriptions(file, body, headers);
    return result;
  }
}
