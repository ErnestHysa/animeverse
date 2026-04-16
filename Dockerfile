# ========================================
# Multi-stage Docker Build
# For production deployment of Anime Stream
# ========================================

FROM node:20-alpine AS base

# Install dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    openssl

# Set working directory
WORKDIR /app

# ========================================
# Dependencies Stage (full install including devDeps)
# ========================================
FROM base AS deps

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDeps needed for build)
RUN npm ci && \
    npm cache clean --force

# ========================================
# Builder Stage (uses full deps to build)
# ========================================
FROM base AS builder

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set build environment
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js application
RUN npm run build

# ========================================
# Runner Stage (production-only)
# ========================================
FROM base AS runner

# Set runtime environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Set working directory
WORKDIR /app

# Copy standalone output from builder (includes server.js and minimal node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy public and data directories
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data

# Copy custom server from builder (not included in standalone output)
COPY --from=builder /app/server-custom.js ./server-custom.js

# Install socket.io as a production dependency (required by server-custom.js)
RUN npm install --omit=dev socket.io && \
    npm cache clean --force

# Create directories with proper permissions
RUN mkdir -p /app/.next/cache && \
    chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application using the custom server which handles both
# Next.js requests and Socket.IO WebSocket connections on a single port
CMD ["node", "server-custom.js"]
