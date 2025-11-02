#!/bin/bash
set -e

COMMIT_SHA=$1
if [ -z "$COMMIT_SHA" ]; then
    echo "Error: Commit SHA is required"
    exit 1
fi

echo "🚀 Starting zero-downtime deployment for commit: $COMMIT_SHA"

# 环境变量
REGISTRY="registry.cn-hangzhou.aliyuncs.com"
NAMESPACE="myapp-namespace"

# 镜像标签
FRONTEND_IMAGE_V2="$REGISTRY/$NAMESPACE/frontend:$COMMIT_SHA"
BACKEND_IMAGE_V2="$REGISTRY/$NAMESPACE/backend:$COMMIT_SHA"

# 登录阿里云容器镜像服务
docker login --username=$ALIYUN_USERNAME --password=$ALIYUN_PASSWORD $REGISTRY

# 拉取新版本镜像
echo "📥 Pulling new images..."
docker pull $FRONTEND_IMAGE_V2
docker pull $BACKEND_IMAGE_V2

# 启动新版本服务 (v2)
echo "🟢 Starting new version (v2)..."
export FRONTEND_IMAGE_V2=$FRONTEND_IMAGE_V2
export BACKEND_IMAGE_V2=$BACKEND_IMAGE_V2
docker-compose -f docker-compose.v2.yml up -d

# 等待新服务启动
echo "⏳ Waiting for new services to be healthy..."
./scripts/health-check.sh v2

# 切换Nginx流量到新版本
echo "🔄 Switching traffic to new version..."
cat > nginx/conf.d/upstream-v2.conf << EOF
upstream frontend {
    server frontend-v2:3000;
    server frontend-v1:3000 down;
}

upstream backend {
    server backend-v2:4000;
    server backend-v1:4000 down;
}
EOF

# 重载Nginx配置（不重启）
docker-compose exec nginx nginx -s reload

# 等待一段时间确保流量完全切换
sleep 10

# 停止旧版本服务 (v1)
echo "🔴 Stopping old version (v1)..."
docker-compose stop frontend-v1 backend-v1

# 更新生产环境配置指向v2
echo "📝 Updating production configuration..."
export FRONTEND_IMAGE_V1=$FRONTEND_IMAGE_V2
export BACKEND_IMAGE_V1=$BACKEND_IMAGE_V2
docker-compose -f docker-compose.prod.yml up -d

# 清理旧镜像
echo "🧹 Cleaning up old images..."
./scripts/cleanup.sh

echo "✅ Zero-downtime deployment completed successfully!"
echo "🌐 Frontend: https://www.mydomain.com"
echo "🔧 Frontend API: https://www.mydomain.com/api/health"
echo "🚀 Backend API: https://www.mydomain.com/restful/health"