FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY testbed/package.json ./testbed/

# Install all workspace dependencies (root + testbed)
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source
COPY tsconfig.json tsup.config.ts ./
COPY src ./src
COPY testbed ./testbed

ENV DOCKER=1

EXPOSE 5175

# pnpm dev = pnpm build (tsup) then pnpm -C testbed dev (vite)
CMD ["pnpm", "dev"]
