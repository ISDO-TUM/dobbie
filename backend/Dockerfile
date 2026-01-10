FROM node:22-alpine

# 1. Install System Dependencies
# 'docker-cli' is required so this container can spawn sibling containers for verification
# 'git' is often needed for some package installs
RUN apk add --no-cache docker-cli git

WORKDIR /app

# 2. Install Package Manager
RUN npm install -g pnpm

# 3. Install Dependencies (Cached layer)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 4. Copy Source Code
COPY . .

# 5. Build the NestJS Application
RUN pnpm build

# 6. Expose API Port
EXPOSE 3000

# 7. Start Command
CMD ["node", "dist/main"]