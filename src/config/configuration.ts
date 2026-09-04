import { isIP } from 'net';

const MIN_PROXY_KEY_LENGTH = 32;

function parsePort(value: string | undefined): number {
  const port = Number(value ?? 2222);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

function parseBindAddress(value: string | undefined): string {
  const bindAddress = value ?? '127.0.0.1';
  if (bindAddress !== 'localhost' && isIP(bindAddress) === 0) {
    throw new Error('BIND_ADDRESS must be localhost or an IP address');
  }
  return bindAddress;
}

function parseSocksHost(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('SOCKS_HOST must be a valid SOCKS URL');
  }
  if (
    !['socks:', 'socks4:', 'socks4a:', 'socks5:', 'socks5h:'].includes(
      url.protocol,
    )
  ) {
    throw new Error('SOCKS_HOST must use a SOCKS protocol');
  }
  return value;
}

function parseProxyApiKeys(value: string | undefined): string[] {
  const keys = (value ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
  if (
    keys.length === 0 ||
    keys.some((key) => key.length < MIN_PROXY_KEY_LENGTH)
  ) {
    throw new Error(
      `PROXY_API_KEYS must contain at least one comma-separated key of ${MIN_PROXY_KEY_LENGTH}+ characters`,
    );
  }
  return keys;
}

export function validateEnvironment(environment: Record<string, unknown>) {
  parsePort(environment.PORT as string | undefined);
  parseBindAddress(environment.BIND_ADDRESS as string | undefined);
  parseSocksHost(environment.SOCKS_HOST as string | undefined);
  parseProxyApiKeys(environment.PROXY_API_KEYS as string | undefined);
  return environment;
}

export default () => ({
  port: parsePort(process.env.PORT),
  bindAddress: parseBindAddress(process.env.BIND_ADDRESS),
  socksHost: parseSocksHost(process.env.SOCKS_HOST),
  security: {
    proxyApiKeys: parseProxyApiKeys(process.env.PROXY_API_KEYS),
  },
});
