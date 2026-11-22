# Production Dockerfile for White Garden Waiting List (Render + Neon PostgreSQL)
FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL & CA certificates required by Prisma PostgreSQL engine
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

# Generate Prisma Client using exact local Prisma 5 CLI
RUN npx prisma generate

# Build frontend and server bundle
RUN npm run build

# Production runtime stage
FROM node:20-slim AS runner

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install --omit=dev

# Copy pre-generated Prisma Client & query engine binaries directly from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy compiled frontend & backend assets
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
