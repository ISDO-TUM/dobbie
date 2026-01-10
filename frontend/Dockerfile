FROM node:22-alpine

WORKDIR /app

# 1. Install Package Manager
RUN npm install -g pnpm

# 2. Install Dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 3. Copy Source Code
COPY . .

# 4. Build the React App
RUN pnpm build

# 5. Expose the port
EXPOSE 8080

# 6. Serve the app
# --host 0.0.0.0 allows access from outside the container
# --port 8080 maps to our docker-compose port
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "8080"]