import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import { OpenaiProxyService } from './openai-proxy.service';
import {
  FileInterceptor,
  FileFieldsInterceptor,
} from '@nestjs/platform-express';
import { UseInterceptors } from '@nestjs/common';
import { Get, Param, Query } from '@nestjs/common';

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

  @Post('/v1/videos')
  @HttpCode(200)
  async videosCreate(@Body() body: any, @Headers() headers: any) {
    const result = await this.service.videosCreate(body, headers);
    if (body.stream) {
      return new StreamableFile(result);
    }
    return result;
  }

  @Post('/v1/videos/transcriptions')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(200)
  async videosTranscriptions(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Headers() headers: any,
  ) {
    const result = await this.service.videosTranscriptions(file, body, headers);
    return result;
  }

  @Post('/v1/videos/translations')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(200)
  async videosTranslations(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Headers() headers: any,
  ) {
    const result = await this.service.videosTranslations(file, body, headers);
    return result;
  }

  @Post('/v1/videos/edits')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'video', maxCount: 1 },
      { name: 'file', maxCount: 1 }, // allow alternate field name
      { name: 'mask', maxCount: 1 },
    ]),
  )
  @HttpCode(200)
  async videosEdits(
    @UploadedFiles()
    files: {
      video?: Express.Multer.File[];
      file?: Express.Multer.File[];
      mask?: Express.Multer.File[];
    },
    @Body() body: any,
    @Headers() headers: any,
  ) {
    const result = await this.service.videosEdits(files, body, headers);
    return result;
  }

  @Get('/v1/videos')
  @HttpCode(200)
  async videosList(@Query() query: any, @Headers() headers: any) {
    const result = await this.service.videosList(query, headers);
    return result;
  }

  @Get('/v1/videos/:video_id')
  @HttpCode(200)
  async videosRetrieve(
    @Param('video_id') videoId: string,
    @Headers() headers: any,
  ) {
    const result = await this.service.videosRetrieve(videoId, headers);
    return result;
  }

  @Get('/v1/videos/:video_id/content')
  @HttpCode(200)
  async videosRetrieveContent(
    @Param('video_id') videoId: string,
    @Headers() headers: any,
  ) {
    const stream = await this.service.videosRetrieveContent(videoId, headers);
    return new StreamableFile(stream);
  }
}
