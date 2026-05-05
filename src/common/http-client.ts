import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { Logger } from '@nestjs/common';
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

const directAgents: HttpAgents = (() => {
  const httpAgent = new HttpAgent({
    keepAlive: true,
    keepAliveMsecs: 30_000,
    maxSockets: 256,
  });
  const httpsAgent = new HttpsAgent({
    keepAlive: true,
    keepAliveMsecs: 30_000,
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
  const agent = new SocksProxyAgent(socksHost, {
    keepAlive: true,
    keepAliveMsecs: 30_000,
  });
  (agent as any).options.rejectUnauthorized = false;
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
