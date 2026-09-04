import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

function publicMessage(exception: HttpException, statusCode: number) {
  if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
    return 'Upstream request failed';
  }

  const response = exception.getResponse();
  if (typeof response === 'string') {
    return response;
  }

  if (response && typeof response === 'object' && 'message' in response) {
    const message = (response as { message?: unknown }).message;
    if (typeof message === 'string' || Array.isArray(message)) {
      return message;
    }
  }

  return exception.message || 'Request failed';
}

@Catch()
export class SanitizedExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(statusCode).json({
      statusCode,
      message: isHttpException
        ? publicMessage(exception, statusCode)
        : 'Internal server error',
      requestId: request.headers['x-request-id'],
    });
  }
}
