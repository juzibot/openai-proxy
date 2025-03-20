import { IsNotEmpty, IsString } from 'class-validator';

export class BedrockCompletionRequestDto {
  @IsString()
  modelId: string;

  @IsString()
  accessKeyId: string;

  @IsString()
  accessKeySecret: string;

  @IsString()
  region: string;

  @IsNotEmpty()
  requestBody: any;
}
