#!/bin/bash

echo "🧹 Cleaning up unused Docker resources..."

# 删除所有未被使用的镜像
docker image prune -af

# 删除所有停止的容器
docker container prune -f

# 删除未被使用的网络
docker network prune -f

# 保留最近5个版本的镜像，删除更旧的
docker images --filter "reference=registry.cn-hangzhou.aliyuncs.com/myapp-namespace/*" --format "{{.ID}} {{.Tag}}" | \
grep -v latest | \
sort -r | \
tail -n +6 | \
cut -d' ' -f1 | \
xargs -r docker rmi

echo "✅ Cleanup completed"