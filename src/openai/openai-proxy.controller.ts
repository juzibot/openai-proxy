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
import { OpenaiProxyService } from './openai-proxy.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { UseInterceptors } from '@nestjs/common';

@Controller()
export class OpenaiProxyController {
  @Inject()
  private readonly service: OpenaiProxyService;

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

  @Post('/v1/images/generations')
  @HttpCode(200)
  async imageGenerations(@Body() body: any, @Headers() headers: any) {
    const result = await this.service.imageGenerations(body, headers);
    return result;
  }

  @Post('/v1/images/edits')
  @HttpCode(200)
  async imageEdits(@Body() body: any, @Headers() headers: any) {
    const result = await this.service.imageEdits(body, headers);
    return result;
  }

  @Post('/v1/files')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(200)
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Headers() headers: any,
  ) {
    const result = await this.service.uploadFile(file, body, headers);
    return result;
  }
}
