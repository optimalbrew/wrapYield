# Multi-stage build for Node.js Backend Service
# Stage 1: Generate migrations
FROM node:18-alpine AS migration-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for migration generation)
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Generate Drizzle migrations from schema
RUN npm run db:generate

# Verify migrations were generated
RUN ls -la drizzle/ || echo "No drizzle directory found"
RUN ls -la drizzle/meta/ || echo "No drizzle meta directory found"

# Stage 2: Runtime image
FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --only=production

# Copy built application and generated migrations from previous stage
COPY --from=migration-builder /app/dist ./dist
COPY --from=migration-builder /app/drizzle ./drizzle
COPY --from=migration-builder /app/contracts ./contracts

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# Start the application
CMD ["npm", "start"]