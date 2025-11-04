FROM node:20-alpine

WORKDIR /app

# 复制整个构建好的工程（包括所有必要文件）
COPY . .

# 创建非root用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# 更改文件所有者
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000 4000

CMD ["sh", "-c", "pnpm --filter server-project start & pnpm --filter web-project start & wait"]