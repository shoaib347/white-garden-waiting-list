# Production Dockerfile for Google Cloud Run
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

# Copy source files
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build frontend and server bundle
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy package files and install only production dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install --omit=dev && npx prisma generate

# Copy compiled assets from builder stage
COPY --from=builder /app/dist ./dist

EXPOSE 8080

# Start server
CMD ["node", "dist/server.cjs"]
