import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';

const PROXY_API_KEY_HEADER = 'x-proxy-api-key';

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

@Injectable()
export class ProxyAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // The health endpoint exposes no proxy capability and must remain usable by
    // container/orchestrator health checks.
    if (request.path === '/healthz') {
      return true;
    }

    const configuredKeys =
      this.configService.get<string[]>('security.proxyApiKeys') ?? [];
    const presentedKey = request.headers[PROXY_API_KEY_HEADER];

    if (
      typeof presentedKey !== 'string' ||
      !configuredKeys.some((key) =>
        timingSafeEqual(digest(key), digest(presentedKey)),
      )
    ) {
      throw new UnauthorizedException('Invalid proxy credentials');
    }

    return true;
  }
}
