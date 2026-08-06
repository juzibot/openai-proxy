FROM node:18.16.0-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY tsconfig.json .
COPY tsconfig.build.json .

COPY package.json .

RUN npm i --legacy-peer-deps
COPY dist .

CMD ["node", "/usr/src/app/main.js"]
