import { validateEnvironment } from './configuration';

describe('configuration validation', () => {
  const validEnvironment = {
    PROXY_API_KEYS: 'a'.repeat(32),
    PORT: '2222',
    BIND_ADDRESS: '127.0.0.1',
    SOCKS_HOST: 'socks5://127.0.0.1:1080',
  };

  it('accepts a secure configuration', () => {
    expect(validateEnvironment(validEnvironment)).toBe(validEnvironment);
  });

  it.each([
    [{ ...validEnvironment, PROXY_API_KEYS: '' }],
    [{ ...validEnvironment, PROXY_API_KEYS: 'short' }],
    [{ ...validEnvironment, PORT: '70000' }],
    [{ ...validEnvironment, BIND_ADDRESS: 'all-interfaces' }],
    [{ ...validEnvironment, SOCKS_HOST: 'https://proxy.example' }],
  ])('fails closed for invalid environment values', (environment) => {
    expect(() => validateEnvironment(environment)).toThrow();
  });
});
