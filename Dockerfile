# ============================================
# Stage 1: Build Admin UI
# ============================================
FROM node:18-alpine AS admin-builder

WORKDIR /admin-ui

# Copy admin UI package files
COPY admin-ui/package*.json ./
RUN npm ci

# Copy admin UI source code and build
COPY admin-ui/ ./
RUN npm run build

# ============================================
# Stage 2: Production Runtime
# ============================================
FROM node:18-alpine

# Install ffmpeg for video playback processing
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy backend source code
COPY src/ ./src/
COPY public/ ./public/

# Copy built admin UI from builder stage
COPY --from=admin-builder /admin-ui/dist ./dist/admin

# Create logs directory
RUN mkdir -p /app/logs && chown -R node:node /app

# Switch to non-root user
USER node

# Default port (can be overridden by .env)
EXPOSE 3303

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:${PORT:-3303}/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "src/server.js"]
