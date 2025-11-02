FROM node:20-alpine

WORKDIR /app
COPY . .

RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter server-project run build

EXPOSE 4000

ENV NODE_ENV production
ENV PORT 4000

CMD ["node", "dist/index.js"]