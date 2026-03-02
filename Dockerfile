FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy root manifests first for better layer caching
COPY package.json pnpm-lock.yaml* ./

# Install root dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source
COPY tsconfig.json tsup.config.ts ./
COPY src ./src
COPY scripts ./scripts

# Install testbed-sim dependencies separately
COPY testbed-sim/package.json ./testbed-sim/
WORKDIR /app/testbed-sim
RUN pnpm install --frozen-lockfile || pnpm install

WORKDIR /app

COPY testbed-sim ./testbed-sim

ENV DOCKER=1

EXPOSE 5176

# pnpm dev = pnpm build (tsup) then pnpm -C testbed-sim dev (vite)
CMD ["pnpm", "dev"]
