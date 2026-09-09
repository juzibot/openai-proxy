import { Test } from '@nestjs/testing';
import { json, urlencoded } from 'express';
import request from 'supertest';
import { OpenaiProxyController } from './openai-proxy.controller';
import { OpenaiProxyService } from './openai-proxy.service';

/**
 * /v1/images/edits 的 multipart 回归。
 *
 * 这个接口的参考图是以文件形式上传的，但 main.ts 全局只挂了 json / urlencoded，
 * multipart 全靠 controller 上的 multer interceptor。历史上这里漏了 interceptor：
 * 请求进来后 @Body() 拿到的是空对象，不只是图片丢了，连 model / prompt / quality
 * 都一起没了，proxy 再以 application/json 把空 body 转给上游，上游回
 * "Missing required parameter: 'image'"。表现就是「文生图正常、图生图全挂」。
 */
describe('OpenaiProxyController /v1/images/edits — multipart 透传', () => {
  let app: any;
  let service: { imageEdits: jest.Mock };

  beforeEach(async () => {
    service = { imageEdits: jest.fn().mockResolvedValue({ ok: true }) };
    const mod = await Test.createTestingModule({
      controllers: [OpenaiProxyController],
      providers: [{ provide: OpenaiProxyService, useValue: service }],
    }).compile();

    app = mod.createNestApplication();
    // 与 src/main.ts 一致：只有 json + urlencoded，没有任何全局 multipart 解析
    app.use(json({ limit: '50mb' }));
    app.use(urlencoded({ extended: true, limit: '50mb', parameterLimit: 50000 }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('单张参考图：文件和普通字段都要到达 service', async () => {
    await request(app.getHttpServer())
      .post('/v1/images/edits')
      .field('model', 'gpt-image-2.5-sunburst')
      .field('prompt', '换成暖橙色调')
      .field('quality', 'high')
      .attach('image[]', Buffer.from('fake-png-bytes'), 'image.png')
      .expect(200);

    const [files, body] = service.imageEdits.mock.calls[0];
    expect(files.map((f: any) => f.fieldname)).toEqual(['image[]']);
    expect(files[0].originalname).toBe('image.png');
    expect(files[0].buffer.toString()).toBe('fake-png-bytes');
    // 这三个字段一旦丢了，上游收到的就是一个没有 model 的空请求
    expect(body).toMatchObject({
      model: 'gpt-image-2.5-sunburst',
      prompt: '换成暖橙色调',
      quality: 'high',
    });
  });

  it('多张参考图：一张都不能少，字段名原样保留', async () => {
    await request(app.getHttpServer())
      .post('/v1/images/edits')
      .field('model', 'gpt-image-2.5-flare')
      .attach('image[]', Buffer.from('img-1'), 'a.png')
      .attach('image[]', Buffer.from('img-2'), 'b.png')
      .attach('image[]', Buffer.from('img-3'), 'c.png')
      .expect(200);

    const [files] = service.imageEdits.mock.calls[0];
    expect(files).toHaveLength(3);
    expect(files.map((f: any) => f.fieldname)).toEqual(['image[]', 'image[]', 'image[]']);
    expect(files.map((f: any) => f.originalname)).toEqual(['a.png', 'b.png', 'c.png']);
  });

  it('单图字段名 image 与 mask 一并透传（不同调用方写法不同）', async () => {
    await request(app.getHttpServer())
      .post('/v1/images/edits')
      .field('model', 'gpt-image-1')
      .attach('image', Buffer.from('img'), 'a.png')
      .attach('mask', Buffer.from('mask'), 'm.png')
      .expect(200);

    const [files] = service.imageEdits.mock.calls[0];
    expect(files.map((f: any) => f.fieldname).sort()).toEqual(['image', 'mask']);
  });
});

/**
 * service 侧：拿到文件后要重组成 multipart 再发给上游，
 * 而不是继续按 application/json 发。
 */
describe('OpenaiProxyService.imageEdits — 转发报文', () => {
  const makeService = () => {
    const service = new OpenaiProxyService();
    const spy = jest
      .spyOn(service as any, 'makeRequest')
      .mockResolvedValue({ ok: true });
    return { service, spy };
  };

  const file = (fieldname: string, name: string, mime = 'image/png') =>
    ({
      fieldname,
      originalname: name,
      mimetype: mime,
      buffer: Buffer.from(`bytes-of-${name}`),
    }) as any;

  it('带文件时用 multipart 转发，boundary 与字段名都在报文里', async () => {
    const { service, spy } = makeService();

    await service.imageEdits(
      [file('image[]', 'a.png'), file('image[]', 'b.png')],
      { model: 'gpt-image-2.5-sunburst', prompt: '暖橙色调' },
      { authorization: 'Bearer sk-test' },
    );

    const [url, headers, data] = spy.mock.calls[0] as [string, any, any];
    expect(url).toBe('https://api.openai.com/v1/images/edits');
    // 关键：不能再是 application/json
    const contentType = headers['content-type'] ?? headers['Content-Type'];
    expect(contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(headers.Authorization).toBe('Bearer sk-test');

    const payload = (data as any).getBuffer().toString();
    expect(payload).toContain('name="image[]"; filename="a.png"');
    expect(payload).toContain('name="image[]"; filename="b.png"');
    expect(payload).toContain('Content-Type: image/png');
    expect(payload).toContain('name="model"');
    expect(payload).toContain('gpt-image-2.5-sunburst');
    expect(payload).toContain('暖橙色调');
  });

  it('没有文件时按原样走 JSON，交给上游报错', async () => {
    const { service, spy } = makeService();

    await service.imageEdits([], { model: 'gpt-image-2' }, { authorization: 'Bearer sk-test' });

    const [, headers, data] = spy.mock.calls[0] as [string, any, any];
    expect(headers['Content-Type']).toBe('application/json');
    expect(data).toEqual({ model: 'gpt-image-2' });
  });
});
