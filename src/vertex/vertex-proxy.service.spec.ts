import { HttpException } from '@nestjs/common';
import { VertexProxyService } from './vertex-proxy.service';

describe('VertexProxyService', () => {
  const service = new VertexProxyService();

  describe('resolveHost', () => {
    // 四个分支与 @anthropic-ai/vertex-sdk src/client.ts 逐条对齐。
    // us / eu 是 multi-region，host 形状跟 region 完全不同，最容易写漏。
    const cases: [string, string][] = [
      ['global', 'https://aiplatform.googleapis.com'],
      ['us', 'https://aiplatform.us.rep.googleapis.com'],
      ['eu', 'https://aiplatform.eu.rep.googleapis.com'],
      ['us-central1', 'https://us-central1-aiplatform.googleapis.com'],
      ['us-east5', 'https://us-east5-aiplatform.googleapis.com'],
      ['europe-west1', 'https://europe-west1-aiplatform.googleapis.com'],
    ];

    it.each(cases)('location %s → %s', (location, expected) => {
      expect(service.resolveHost(location)).toBe(expected);
    });

    it('multi-region 不能退化成 region 前缀形式', () => {
      expect(service.resolveHost('us')).not.toBe(
        'https://us-aiplatform.googleapis.com',
      );
    });

    it.each(['evil.example.com', 'us-central1@127.0.0.1', '../metadata'])(
      '拒绝不安全的 location: %s',
      (location) => {
        expect(() => service.resolveHost(location)).toThrow(HttpException);
      },
    );
  });

  describe('parseReqParams', () => {
    it('拆 Gemini 的 model:method', () => {
      expect(
        service.parseReqParams('gemini-2.5-flash:generateContent'),
      ).toEqual({ model: 'gemini-2.5-flash', method: 'generateContent' });
    });

    it('拆 Claude 带 @ 日期后缀的 model id', () => {
      expect(
        service.parseReqParams('claude-sonnet-4-5@20250929:rawPredict'),
      ).toEqual({
        model: 'claude-sonnet-4-5@20250929',
        method: 'rawPredict',
      });
    });

    it('拆无后缀的新 Claude model id', () => {
      expect(service.parseReqParams('claude-opus-5:streamRawPredict')).toEqual({
        model: 'claude-opus-5',
        method: 'streamRawPredict',
      });
    });

    it('缺 method 时报 400 而不是静默放行', () => {
      expect(() => service.parseReqParams('gemini-2.5-flash')).toThrow(
        HttpException,
      );
      expect(() => service.parseReqParams('gemini-2.5-flash:')).toThrow(
        HttpException,
      );
    });
  });

  describe('buildUrl', () => {
    it('Gemini + global', () => {
      expect(
        service.buildUrl(
          '123456789012',
          'global',
          'google',
          'gemini-2.5-flash',
          'generateContent',
        ),
      ).toBe(
        'https://aiplatform.googleapis.com/v1/projects/123456789012/locations/global' +
          '/publishers/google/models/gemini-2.5-flash:generateContent',
      );
    });

    it('Claude + multi-region，对 @ 后缀做路径编码', () => {
      expect(
        service.buildUrl(
          '123456789012',
          'us',
          'anthropic',
          'claude-sonnet-4-5@20250929',
          'rawPredict',
        ),
      ).toBe(
        'https://aiplatform.us.rep.googleapis.com/v1/projects/123456789012/locations/us' +
          '/publishers/anthropic/models/claude-sonnet-4-5%4020250929:rawPredict',
      );
    });

    it('拒绝路径注入和未知 publisher', () => {
      expect(() =>
        service.buildUrl(
          '../other',
          'global',
          'google',
          'gemini-2.5-flash',
          'generateContent',
        ),
      ).toThrow(HttpException);
      expect(() =>
        service.buildUrl(
          'project',
          'global',
          'attacker',
          'gemini-2.5-flash',
          'generateContent',
        ),
      ).toThrow(HttpException);
    });

    it('regional endpoint', () => {
      expect(
        service.buildUrl(
          'p',
          'us-east5',
          'anthropic',
          'claude-sonnet-4-6',
          'rawPredict',
        ),
      ).toBe(
        'https://us-east5-aiplatform.googleapis.com/v1/projects/p/locations/us-east5' +
          '/publishers/anthropic/models/claude-sonnet-4-6:rawPredict',
      );
    });
  });

  describe('method 白名单', () => {
    it.each([
      ['generateContent', false],
      ['countTokens', false],
      ['predict', false],
      ['rawPredict', false],
      ['streamGenerateContent', true],
      ['streamRawPredict', true],
    ])('%s 支持，stream=%s', (method, isStream) => {
      expect(service.isSupportedMethod(method)).toBe(true);
      expect(service.isStreamMethod(method)).toBe(isStream);
    });

    it.each(['embedContent', 'batchEmbedContents', 'uploadFile', 'deleteFile'])(
      '%s 不在白名单内',
      (method) => {
        // embedContent / batchEmbedContents 是 AI Studio 的形状，
        // Vertex 侧 embedding 走 predict，误用要能被挡住。
        expect(service.isSupportedMethod(method)).toBe(false);
      },
    );
  });
});
