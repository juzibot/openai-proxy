FROM node:22.22.1-bookworm-slim@sha256:4f77a690f2f8946ab16fe1e791a3ac0667ae1c3575c3e4d0d4589e9ed5bfaf3d AS dependencies

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps --ignore-scripts --no-audit --no-fund \
  && npm cache clean --force

FROM node:22.22.1-bookworm-slim@sha256:4f77a690f2f8946ab16fe1e791a3ac0667ae1c3575c3e4d0d4589e9ed5bfaf3d AS runtime

ENV NODE_ENV=production
WORKDIR /usr/src/app

COPY --from=dependencies --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --chown=node:node dist .

USER node
EXPOSE 2222

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||2222)+'/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "/usr/src/app/main.js"]
