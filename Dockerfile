# Game server (Colyseus: Astroworld + mining rooms) for Fly.io.
# The Next.js site deploys separately on Vercel; this image is only server/ + shared/.
FROM node:24-slim

WORKDIR /app

# Install just the server workspace's dependencies (+ the shared workspace link).
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
RUN npm ci --workspace=server --include-workspace-root=false --ignore-scripts --no-audit --no-fund

COPY shared/tsconfig.json shared/
COPY shared/src shared/src
COPY server/tsconfig.json server/
COPY server/src server/src

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

WORKDIR /app/server
USER node
CMD ["node", "--import", "tsx", "src/index.ts"]
