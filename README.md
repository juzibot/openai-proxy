# openai-proxy

A small authenticated proxy for OpenAI, Anthropic, xAI, Google AI Studio,
Google Vertex AI, and Amazon Bedrock APIs.

## Required configuration

The service fails closed when proxy authentication is not configured.

| Variable         | Description                                                         | Default     |
| ---------------- | ------------------------------------------------------------------- | ----------- |
| `PROXY_API_KEYS` | One or more comma-separated proxy keys, each at least 32 characters | required    |
| `PORT`           | Listening port                                                      | `2222`      |
| `BIND_ADDRESS`   | Listening IP address                                                | `127.0.0.1` |
| `SOCKS_HOST`     | Optional `socks://`, `socks4://`, or `socks5://` egress URL         | unset       |

Generate a key with `openssl rand -hex 32`. Clients must send it in the
`x-proxy-api-key` header. Provider credentials continue to use their native
headers and are never used to authenticate to this proxy.

Example:

```bash
PROXY_API_KEYS="$(openssl rand -hex 32)" npm run start:prod
```

`GET /healthz` is the only unauthenticated endpoint.

## Bedrock credentials

Bedrock routes use the AWS SDK default credential provider chain. Attach an
ECS task role, EC2 instance profile, or another short-lived workload identity
with only the required `bedrock:InvokeModel` permissions. Static AWS access
keys are no longer accepted in request bodies.

## Upload limits

Multipart and Google resumable-upload requests are capped at 100 MiB per file.
JSON requests retain the existing 50 MiB parser limit.

## Deployment migration

The production workflow now requires an `SSH_KNOWN_HOSTS` secret and invokes
`/usr/local/bin/deploy-openai-proxy <image-tag>` on the target. That command
should be owned by root but executable by a dedicated, unprivileged deploy
account with only the permissions needed to update this service. The runtime
container listens on loopback by default; set `BIND_ADDRESS=0.0.0.0` explicitly
when container networking requires it.
