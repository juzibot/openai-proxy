import { ExecutionContext, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getHttpAgents } from './http-client';
import { ProxyAuthGuard } from './proxy-auth.guard';
import { filterGoogleUploadHeaders } from './upstream-headers';
import { encodeUpstreamPath, encodeUpstreamSegment } from './upstream-url';

function contextFor(path: string, key?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        path,
        headers: key ? { 'x-proxy-api-key': key } : {},
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('security boundaries', () => {
  describe('ProxyAuthGuard', () => {
    const validKey = 'a'.repeat(32);
    const config = {
      get: () => [validKey],
    } as unknown as ConfigService;
    const guard = new ProxyAuthGuard(config);

    it('accepts configured proxy credentials', () => {
      expect(guard.canActivate(contextFor('/v1/responses', validKey))).toBe(
        true,
      );
    });

    it('rejects missing and invalid credentials', () => {
      expect(() => guard.canActivate(contextFor('/v1/responses'))).toThrow(
        HttpException,
      );
      expect(() =>
        guard.canActivate(contextFor('/v1/responses', 'wrong')),
      ).toThrow(HttpException);
    });

    it('keeps only the health endpoint public', () => {
      expect(guard.canActivate(contextFor('/healthz'))).toBe(true);
    });
  });

  describe('upstream URL validation', () => {
    it('encodes safe path-segment characters', () => {
      expect(encodeUpstreamSegment('model@2026', 'model')).toBe('model%402026');
      expect(encodeUpstreamPath('files/a b', 'path')).toBe('files/a%20b');
    });

    it.each(['../admin', '..', 'a/b', 'a\\b', 'a?key=secret', 'a#fragment'])(
      'rejects unsafe segment %s',
      (value) => {
        expect(() => encodeUpstreamSegment(value, 'id')).toThrow(HttpException);
      },
    );

    it.each(['files/../models', 'files//id', '../files/id'])(
      'rejects traversal path %s',
      (value) => {
        expect(() => encodeUpstreamPath(value, 'path')).toThrow(HttpException);
      },
    );
  });

  it('does not disable TLS verification for SOCKS egress', () => {
    const agents = getHttpAgents('socks5://127.0.0.1:1080');
    expect((agents.httpsAgent as any).options.rejectUnauthorized).not.toBe(
      false,
    );
  });

  it('only exposes resumable-upload response headers', () => {
    expect(
      filterGoogleUploadHeaders({
        location: 'https://upload.example',
        'x-goog-upload-status': 'active',
        'content-type': 'application/json',
        'set-cookie': 'session=secret',
        'content-encoding': 'gzip',
        'content-length': '100',
        connection: 'keep-alive',
      }),
    ).toEqual({
      location: 'https://upload.example',
      'x-goog-upload-status': 'active',
      'content-type': 'application/json',
    });
  });
});
