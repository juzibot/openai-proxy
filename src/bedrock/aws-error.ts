import { HttpException } from '@nestjs/common';

/**
 * AWS SDK v3 错误详情 —— 真实状态码在 $metadata.httpStatusCode，错误对象顶层没有 statusCode
 */
export interface AwsErrorDetail {
  name: string;
  message: string;
  statusCode?: number;
  requestId?: string;
  body?: string;
}

async function streamToBuffer(stream: any): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks) as unknown as Uint8Array;
}

export async function describeAwsError(error: any): Promise<AwsErrorDetail> {
  const detail: AwsErrorDetail = {
    name: error?.name,
    message: error?.message,
    statusCode: error?.$metadata?.httpStatusCode,
    requestId: error?.$metadata?.requestId,
  };

  if (error?.$response?.body) {
    try {
      detail.body = new TextDecoder().decode(
        await streamToBuffer(error.$response.body),
      );
    } catch {
      /* ignore */
    }
  }

  return detail;
}

/**
 * 把上游错误详情包成 HttpException，HTTP 状态码用上游真实状态码；
 * 网络类错误没有 $metadata，兜底 500
 */
export function toUpstreamHttpException(
  errorDetail: AwsErrorDetail,
): HttpException {
  return new HttpException(
    {
      message: errorDetail.message,
      upstream: 'bedrock',
      ...errorDetail,
    },
    errorDetail.statusCode ?? 500,
  );
}
