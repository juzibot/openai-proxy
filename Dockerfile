FROM node:18.16.0-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY tsconfig.json .
COPY tsconfig.build.json .

COPY package.json .
COPY package-lock.json .

# 用 npm ci 按 lockfile 装：之前是 npm i 且没带 lockfile，package.json 里又全是 ^ 版本，
# 每次构建都会把依赖悄悄升到当时的最新版（axios ^1.4.0 现在会装成 1.19.x），
# 代码没动镜像行为却会变。这里不加 --omit=dev，bedrock 运行时用到的
# @aws-sdk/client-bedrock-runtime 和 aws-sdk 目前还挂在 devDependencies 下。
RUN npm ci --legacy-peer-deps
COPY dist .

CMD ["node", "/usr/src/app/main.js"]
