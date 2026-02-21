# Build stage
FROM node:20-alpine AS builder

# Install dependencies required for node-gyp and Oracle Instant Client
RUN apk add --no-cache python3 make g++ libaio libnsl libc6-compat

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Build Next.js application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

# Install Oracle Instant Client dependencies and OpenSSL for HTTPS
RUN apk add --no-cache libaio libnsl libc6-compat wget unzip openssl

# Download and install Oracle Instant Client
RUN mkdir -p /opt/oracle && \
    cd /opt/oracle && \
    wget https://download.oracle.com/otn_software/linux/instantclient/instantclient-basiclite-linuxx64.zip && \
    unzip instantclient-basiclite-linuxx64.zip && \
    rm instantclient-basiclite-linuxx64.zip && \
    cd instantclient* && \
    rm -f *jdbc* *occi* *mysql* *jar uidrvci genezi adrci && \
    echo /opt/oracle/instantclient* > /etc/ld.so.conf.d/oracle-instantclient.conf && \
    ldconfig || true

# Set Oracle environment variables
ENV LD_LIBRARY_PATH=/opt/oracle/instantclient_21_15

WORKDIR /app

# Set to production
ENV NODE_ENV=production

# Copy built application from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/public ./public
COPY server.js ./

# Generate self-signed certificate for HTTPS
RUN mkdir -p /app/certs && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /app/certs/server.key -out /app/certs/server.crt \
    -subj "/C=US/ST=State/L=City/O=TravelAccess/CN=localhost"

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Change ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

# Expose port
EXPOSE 443

# Start the application
CMD ["node", "server.js"]
