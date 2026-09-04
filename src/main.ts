import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { urlencoded, json, raw, Request } from 'express';
import { randomUUID } from 'crypto';
import { MAX_UPLOAD_BYTES } from './common/upload';

const auditLogger = new Logger('Audit');
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const SAFE_REGION_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function inferUpstreamHost(req: Request): string | undefined {
  if (req.path.startsWith('/anthropic/')) return 'api.anthropic.com';
  if (req.path.startsWith('/xai/')) return 'api.x.ai';
  if (req.path.startsWith('/google/')) {
    return 'generativelanguage.googleapis.com';
  }
  if (req.path.startsWith('/bedrock/')) {
    const region = req.body?.region;
    return typeof region === 'string' && SAFE_REGION_PATTERN.test(region)
      ? `bedrock-runtime.${region}.amazonaws.com`
      : 'bedrock-runtime.amazonaws.com';
  }
  if (req.path.startsWith('/vertex/')) {
    const match = req.path.match(/\/locations\/([^/]+)\/publishers\//);
    const location = match?.[1];
    if (!location || !SAFE_REGION_PATTERN.test(location)) {
      return 'aiplatform.googleapis.com';
    }
    if (location === 'global') return 'aiplatform.googleapis.com';
    if (location === 'us' || location === 'eu') {
      return `aiplatform.${location}.rep.googleapis.com`;
    }
    return `${location}-aiplatform.googleapis.com`;
  }
  if (req.path.startsWith('/v1/')) return 'api.openai.com';
  return undefined;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  app.use((req, res, next) => {
    const suppliedRequestId = req.header('x-request-id');
    const requestId =
      suppliedRequestId && REQUEST_ID_PATTERN.test(suppliedRequestId)
        ? suppliedRequestId
        : randomUUID();
    const startedAt = Date.now();
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);
    res.on('finish', () => {
      auditLogger.log(
        JSON.stringify({
          event: 'proxy_request',
          requestId,
          clientAddress: req.ip,
          method: req.method,
          path: req.path,
          upstreamHost: inferUpstreamHost(req),
          statusCode: res.statusCode,
          requestBytes: Number(req.header('content-length') || 0),
          responseBytes: Number(res.getHeader('content-length') || 0),
          durationMs: Date.now() - startedAt,
        }),
      );
    });
    next();
  });

  app.use((req, res, next) => {
    const isGoogleUploadData =
      req.path.startsWith('/google/upload/v1beta/files/') ||
      (req.path === '/google/upload/v1beta/files' && req.query.upload_id);
    if (isGoogleUploadData) {
      raw({ type: '*/*', limit: MAX_UPLOAD_BYTES })(req, res, next);
    } else {
      next();
    }
  });

  app.use(json({ limit: '50mb' }));
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.use(urlencoded({ extended: true, limit: '50mb', parameterLimit: 50000 }));
  const configService = app.get(ConfigService);
  const port = configService.get<number>('port');
  const bindAddress = configService.get<string>('bindAddress');
  await app.listen(port, bindAddress, () => {
    Logger.log(`Server started listening on ${bindAddress}:${port}`);
  });
}
bootstrap().catch((error) => {
  Logger.error('Application startup failed', error?.stack, 'Bootstrap');
  process.exitCode = 1;
});
