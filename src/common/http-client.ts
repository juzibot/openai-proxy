import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import CacheableLookup from 'cacheable-lookup';
import { SocksProxyAgent } from 'socks-proxy-agent';

const logger = new Logger('HttpClient');

const cacheable = new CacheableLookup({
  maxTtl: 60,
  errorTtl: 5,
});

const originalLookup = cacheable.lookup.bind(cacheable);
(cacheable as any).lookup = (
  hostname: string,
  optionsOrCb: any,
  maybeCb?: any,
) => {
  const start = Date.now();
  const isCbFirst = typeof optionsOrCb === 'function';
  const cb = isCbFirst ? optionsOrCb : maybeCb;
  const options = isCbFirst ? {} : optionsOrCb;
  const wrapped = (err: any, address: any, family: any) => {
    const ms = Date.now() - start;
    if (err) {
      logger.error(
        `dns.lookup failed hostname=${hostname} code=${err.code} syscall=${err.syscall} errno=${err.errno} ms=${ms}`,
      );
    } else if (ms > 200) {
      logger.warn(
        `dns.lookup slow hostname=${hostname} address=${address} family=${family} ms=${ms}`,
      );
    }
    cb(err, address, family);
  };
  return originalLookup(hostname, options, wrapped);
};

export interface HttpAgents {
  httpAgent: HttpAgent;
  httpsAgent: HttpsAgent;
}

// 空闲连接在池里的存活上限。中间链路（SOCKS 代理、NAT、防火墙）会静默回收长时间
// 空闲的连接，本端的连接池感知不到——keepAliveMsecs 的 TCP 探测只能覆盖到代理那一段，
// 代理到上游那一段断了探不出来。一旦复用到这种连接，请求发出去不会有任何响应，
// 要一直挂到 axios 的 timeout（10 分钟）才失败。让空闲连接早点退休即可避开。
// 只作用于 idle socket，不会打断正在等待模型响应的请求。
const IDLE_SOCKET_TIMEOUT = 30_000;

const directAgents: HttpAgents = (() => {
  const httpAgent = new HttpAgent({
    keepAlive: true,
    keepAliveMsecs: 30_000,
    timeout: IDLE_SOCKET_TIMEOUT,
    maxSockets: 256,
  });
  const httpsAgent = new HttpsAgent({
    keepAlive: true,
    keepAliveMsecs: 30_000,
    timeout: IDLE_SOCKET_TIMEOUT,
    maxSockets: 256,
  });
  cacheable.install(httpAgent);
  cacheable.install(httpsAgent);
  return { httpAgent, httpsAgent };
})();

const socksAgentCache = new Map<string, HttpAgents>();

export function getHttpAgents(socksHost?: string): HttpAgents {
  if (!socksHost) return directAgents;
  const cached = socksAgentCache.get(socksHost);
  if (cached) return cached;
  // timeout 不能传进构造函数：SocksProxyAgent 会把它当成整条 socket 的 inactivity
  // timeout，并挂上 socket.on('timeout') -> destroy，非流式请求等模型出首字节的那几十秒
  // 正好是没有数据的，会被误杀。只设 options.timeout，走 http.Agent 的空闲连接回收。
  const agent = new SocksProxyAgent(socksHost, {
    keepAlive: true,
    keepAliveMsecs: 30_000,
  });
  (agent as any).options.rejectUnauthorized = false;
  (agent as any).options.timeout = IDLE_SOCKET_TIMEOUT;
  const next: HttpAgents = {
    httpAgent: agent as unknown as HttpAgent,
    httpsAgent: agent as unknown as HttpsAgent,
  };
  socksAgentCache.set(socksHost, next);
  return next;
}

export function describeNetworkError(e: any): Record<string, any> {
  return {
    message: e.message,
    code: e.code,
    errno: e.errno,
    syscall: e.syscall,
    hostname: e.hostname,
    port: e.port,
    address: e.address,
  };
}

@Injectable()
export class HttpClientService {
  constructor(private readonly configService: ConfigService) {}

  getAgents(): HttpAgents {
    const socksHost = this.configService.get<string | undefined>('socksHost');
    return getHttpAgents(socksHost);
  }
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [HttpClientService],
  exports: [HttpClientService],
})
export class HttpClientModule {}
