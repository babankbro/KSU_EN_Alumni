# syntax=docker/dockerfile:1
#
# KSU Engineering Alumni — production image
#
# Multi-stage build against Next.js `output: "standalone"`, so the runtime
# image carries only the server bundle and its traced dependencies rather than
# the whole node_modules tree.
#
#   docker build -t ksu-en-alumni .
#   docker run --rm -p 3000:3000 ksu-en-alumni

# ---------- 1. dependencies ----------
FROM node:22-alpine AS deps
WORKDIR /app

# Only the manifests, so this layer is cached until dependencies actually change.
COPY package.json package-lock.json ./
RUN npm ci

# ---------- 2. build ----------
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Telemetry off: the build runs in CI/university infrastructure, not a dev laptop.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# NOTE: `next/font/google` fetches the Sarabun font files during this step,
# so the build host needs outbound network access to fonts.googleapis.com.
RUN npm run build

# ---------- 3. runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as a non-root user (NFR-SEC).
# busybox `adduser` needs -G explicitly, otherwise the user lands in `nogroup`
# and the --chown=nextjs:nodejs copies below would not match its primary group.
RUN addgroup -S -g 1001 nodejs \
 && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder /app/public ./public
# The standalone output already contains a minimal node_modules + server.js.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Plain HTTP check against the app itself — no extra tooling in the image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
