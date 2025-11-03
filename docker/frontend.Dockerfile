FROM node:20-alpine

WORKDIR /app

# 复制整个构建好的工程（包括所有必要文件）
COPY . .

# 创建非root用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# 更改文件所有者
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

CMD ["sh", "-c", "cd projects/web-project && pnpm start"]