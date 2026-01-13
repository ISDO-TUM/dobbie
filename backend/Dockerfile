# Build Stage
FROM node:22-alpine AS builder

# Install build dependencies
RUN apk add --no-cache docker-cli git
RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

# Production Stage
FROM node:22-alpine AS runner

# Install runtime dependencies (docker cli and git are needed by the agent)
RUN apk add --no-cache docker-cli git
RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/main"]