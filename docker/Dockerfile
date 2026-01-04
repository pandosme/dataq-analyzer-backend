# ============================================
# Stage 1: Build Admin UI
# ============================================
FROM node:18-alpine AS admin-builder

WORKDIR /admin-ui

# Copy admin UI package files
COPY admin-ui/package*.json ./
RUN npm ci

# Copy admin UI source code
COPY admin-ui/ ./

# Build admin UI for production
RUN npm run build

# ============================================
# Stage 2: Backend Runtime
# ============================================
FROM node:18-alpine

WORKDIR /app

# Install production dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy backend source code
COPY src/ ./src/
COPY public/ ./public/

# Copy built admin UI from previous stage
COPY --from=admin-builder /admin-ui/dist ./dist/admin

# Create directory for logs
RUN mkdir -p /app/logs && chown -R node:node /app

# Switch to non-root user for security
USER node

# Expose API port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start server
CMD ["node", "src/server.js"]
