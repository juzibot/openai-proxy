import {
  IsNotEmpty,
  IsObject,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class BedrockCompletionRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  modelId: string;

  @IsString()
  @Matches(/^[a-z]{2}(?:-[a-z0-9]+){1,3}-\d$/)
  region: string;

  @IsObject()
  requestBody: any;
}
