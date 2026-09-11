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

/**
 * OpenAI 兼容端点的转发入参。
 *
 * 不收 accessKeyId / accessKeySecret：认证走 Authorization 头里的短期 token。
 * 也不收 modelId：Responses API 的 model 字段本来就在 requestBody 里。
 */
export class BedrockOpenAIResponsesDto {
  @IsString()
  region: string;

  @IsNotEmpty()
  requestBody: any;
}
