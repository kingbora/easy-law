FROM node:20-alpine AS builder

WORKDIR /app
COPY . .

RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter web-project run build

FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

COPY --from=builder /app/projects/web-project/next.config.js ./
COPY --from=builder /app/projects/web-project/package.json ./
COPY --from=builder --chown=nextjs:nodejs /app/projects/web-project/.next ./.next
COPY --from=builder /app/projects/web-project/public ./public
COPY --from=builder /app/node_modules ./node_modules

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["npm", "start"]