#!/bin/bash
set -e

APP_NAME="lawyer-app"
APP_DIR="/home/apps/$APP_NAME"
DEPLOY_DATE=$(date +%Y%m%d_%H%M%S)

# 端口定义 - 分别定义前后端端口
FRONTEND_PORTS=(3000 3001)
BACKEND_PORTS=(4000 4001)

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

check_frontend_health() {
    local port=$1
    local max_retries=20
    
    for i in $(seq 1 $max_retries); do
        if curl -s -f "http://localhost:${port}/api/health" >/dev/null 2>&1; then
            log "✓ 前端服务健康 (端口: $port)"
            return 0
        fi
        if [ $i -eq 1 ]; then
            log "等待前端服务启动... ($i/$max_retries)"
        elif [ $((i % 5)) -eq 0 ]; then
            log "仍在等待前端服务启动... ($i/$max_retries)"
        fi
        sleep 3
    done
    log "✗ 前端服务健康检查失败 (端口: $port)"
    return 1
}

check_backend_health() {
    local port=$1
    local max_retries=20
    
    for i in $(seq 1 $max_retries); do
        if curl -s -f "http://localhost:${port}/health" >/dev/null 2>&1; then
            log "✓ 后端服务健康 (端口: $port)"
            return 0
        fi
        if [ $i -eq 1 ]; then
            log "等待后端服务启动... ($i/$max_retries)"
        elif [ $((i % 5)) -eq 0 ]; then
            log "仍在等待后端服务启动... ($i/$max_retries)"
        fi
        sleep 3
    done
    log "✗ 后端服务健康检查失败 (端口: $port)"
    return 1
}

# 获取当前运行的前端端口
get_current_frontend_port() {
    if [ -f "/etc/nginx/conf.d/lawyer-app-upstream.conf" ]; then
        grep -A5 "upstream frontend_servers" /etc/nginx/conf.d/lawyer-app-upstream.conf 2>/dev/null | \
        grep "server 127.0.0.1:" | head -1 | awk -F: '{print $2}' | awk '{gsub(/;.*/, "", $1); print $1}' || echo ""
    else
        echo ""
    fi
}

# 获取当前运行的后端端口
get_current_backend_port() {
    if [ -f "/etc/nginx/conf.d/lawyer-app-upstream.conf" ]; then
        grep -A5 "upstream backend_servers" /etc/nginx/conf.d/lawyer-app-upstream.conf 2>/dev/null | \
        grep "server 127.0.0.1:" | head -1 | awk -F: '{print $2}' | awk '{gsub(/;.*/, "", $1); print $1}' || echo ""
    else
        echo ""
    fi
}

# 获取下一个可用端口
get_next_port() {
    local current_port=$1
    local ports=("${!2}")
    
    if [ -z "$current_port" ]; then
        # 第一次部署，使用第一个端口
        echo "${ports[0]}"
        return
    fi
    
    for port in "${ports[@]}"; do
        if [ "$port" != "$current_port" ]; then
            echo "$port"
            return
        fi
    done
    echo "${ports[0]}"
}

# 检查端口是否已被占用
is_port_available() {
    local port=$1
    if ss -tln | grep -q ":$port "; then
        return 1  # 端口被占用
    else
        return 0  # 端口可用
    fi
}

# 检查容器是否在运行
is_container_running() {
    local container_name=$1
    docker ps --format "table {{.Names}}" | grep -q "^${container_name}$"
    return $?
}

# 创建必要的目录和配置
setup_environment() {
    log "设置部署环境..."
    
    # 创建应用目录
    sudo mkdir -p $APP_DIR/shared/{logs,data}
    sudo chown -R $USER:$USER $APP_DIR/shared
}

# 停止并清理旧容器
cleanup_old_containers() {
    local next_frontend_port=$1
    local next_backend_port=$2
    
    log "清理旧容器..."
    
    # 清理所有与app相关的容器，不管状态如何
    for container in $(docker ps -a --filter "name=app-" --format "{{.Names}}"); do
        log "停止并移除容器: $container"
        docker stop "$container" 2>/dev/null || true
        docker rm "$container" 2>/dev/null || true
    done
    
    # 特别清理将要使用的端口上的任何容器
    log "检查端口占用情况..."
    for port in "${FRONTEND_PORTS[@]}" "${BACKEND_PORTS[@]}"; do
        local port_container=$(docker ps -a --format "table {{.Names}}\t{{.Ports}}" | grep ":${port}->" | awk '{print $1}')
        if [ -n "$port_container" ]; then
            log "发现占用端口 $port 的容器: $port_container，正在清理..."
            docker stop "$port_container" 2>/dev/null || true
            docker rm "$port_container" 2>/dev/null || true
        fi
    done
    
    # 再次检查并强制清理任何遗留的app容器
    local remaining_containers=$(docker ps -a --filter "name=app-" --format "{{.Names}}" | wc -l)
    if [ "$remaining_containers" -gt 0 ]; then
        log "强制清理遗留的app容器..."
        docker ps -a --filter "name=app-" --format "{{.Names}}" | xargs -r docker stop
        docker ps -a --filter "name=app-" --format "{{.Names}}" | xargs -r docker rm
    fi
}

# 验证Nginx配置
verify_nginx_config() {
    if ! sudo nginx -t; then
        log "✗ Nginx配置验证失败"
        return 1
    fi
    return 0
}

# 主部署流程
log "开始智能部署流程..."

# 检查镜像文件
if [ ! -f "$APP_DIR/app-image.tar.gz" ]; then
    log "错误: 未找到Docker镜像文件 app-image.tar.gz"
    exit 1
fi

# 设置环境
setup_environment

# 加载新镜像
log "加载Docker镜像..."
gunzip -c "$APP_DIR/app-image.tar.gz"
docker load -i "$APP_DIR/app-image.tar"

# 获取当前和下一个端口
CURRENT_FRONTEND_PORT=$(get_current_frontend_port)
CURRENT_BACKEND_PORT=$(get_current_backend_port)

NEXT_FRONTEND_PORT=$(get_next_port "$CURRENT_FRONTEND_PORT" FRONTEND_PORTS[@])
NEXT_BACKEND_PORT=$(get_next_port "$CURRENT_BACKEND_PORT" BACKEND_PORTS[@])

log "部署信息:"
log "  - 当前前端端口: ${CURRENT_FRONTEND_PORT:-未设置}"
log "  - 当前后端端口: ${CURRENT_BACKEND_PORT:-未设置}"
log "  - 下一前端端口: $NEXT_FRONTEND_PORT"
log "  - 下一后端端口: $NEXT_BACKEND_PORT"

# 清理旧容器
cleanup_old_containers "$NEXT_FRONTEND_PORT" "$NEXT_BACKEND_PORT"

# 检查端口是否可用
if ! is_port_available "$NEXT_FRONTEND_PORT"; then
    log "错误: 前端端口 $NEXT_FRONTEND_PORT 已被占用"
    exit 1
fi

if ! is_port_available "$NEXT_BACKEND_PORT"; then
    log "错误: 后端端口 $NEXT_BACKEND_PORT 已被占用"
    exit 1
fi

# 启动新版本服务
log "启动统一应用服务..."
log "前端端口: $NEXT_FRONTEND_PORT, 后端端口: $NEXT_BACKEND_PORT"

CONTAINER_NAME="app-$NEXT_FRONTEND_PORT-$NEXT_BACKEND_PORT"

if ! docker run -d --name "$CONTAINER_NAME" \
    -p $NEXT_FRONTEND_PORT:3000 \
    -p $NEXT_BACKEND_PORT:4000 \
    -v $APP_DIR/shared/logs:/app/logs \
    -v $APP_DIR/shared/data:/app/data \
    -e NODE_ENV=production \
    -e DATABASE_URL="$DATABASE_URL" \
    -e SENTRY_AUTH_TOKEN="$SENTRY_AUTH_TOKEN" \
    -e QINIU_ACCESS_KEY="$QINIU_ACCESS_KEY" \
    -e QINIU_SECRET_KEY="$QINIU_SECRET_KEY" \
    lawyer-app:latest; then
    log "✗ 应用服务启动失败"
    docker logs "$CONTAINER_NAME" 2>/dev/null || true
    exit 1
fi

# 等待新服务就绪
log "等待新服务启动..."
if ! check_frontend_health "$NEXT_FRONTEND_PORT"; then
    log "前端服务健康检查失败，查看日志:"
    docker logs "$CONTAINER_NAME"
    exit 1
fi

if ! check_backend_health "$NEXT_BACKEND_PORT"; then
    log "后端服务健康检查失败，查看日志:"
    docker logs "$CONTAINER_NAME"
    exit 1
fi

# 更新Nginx配置
log "更新Nginx upstream指向新端口..."
sudo mkdir -p /etc/nginx/conf.d
cat > /tmp/lawyer-app-upstream.conf << EOF
upstream frontend_servers {
    server 127.0.0.1:$NEXT_FRONTEND_PORT;
}

upstream backend_servers {
    server 127.0.0.1:$NEXT_BACKEND_PORT;
}
EOF

# 复制 upstream 配置文件到 nginx 目录，若已存在则直接覆盖
sudo cp -f /tmp/lawyer-app-upstream.conf /etc/nginx/conf.d/lawyer-app-upstream.conf
rm -f /tmp/lawyer-app-upstream.conf

# 验证并重载Nginx
if verify_nginx_config; then
    log "重载Nginx配置..."
    if sudo systemctl reload nginx; then
        log "✓ Nginx重载成功，流量已切换到新实例"
    else
        log "✗ Nginx重载失败"
        exit 1
    fi
else
    log "✗ Nginx配置验证失败，回滚upstream配置"
    # 恢复原有配置
    if [ -n "$CURRENT_FRONTEND_PORT" ] && [ -n "$CURRENT_BACKEND_PORT" ]; then
        cat > /tmp/lawyer-app-upstream.conf << EOF
upstream frontend_servers {
    server 127.0.0.1:$CURRENT_FRONTEND_PORT;
}

upstream backend_servers {
    server 127.0.0.1:$CURRENT_BACKEND_PORT;
}
EOF
        sudo cp -f /tmp/lawyer-app-upstream.conf /etc/nginx/conf.d/lawyer-app-upstream.conf
        rm -f /tmp/lawyer-app-upstream.conf
        sudo nginx -t && sudo systemctl reload nginx
    fi
    exit 1
fi

# 等待新服务稳定运行
log "等待新服务稳定..."
sleep 10

# 停止旧版本服务（如果存在）
if [ -n "$CURRENT_FRONTEND_PORT" ] && [ -n "$CURRENT_BACKEND_PORT" ] && \
   { [ "$CURRENT_FRONTEND_PORT" != "$NEXT_FRONTEND_PORT" ] || \
     [ "$CURRENT_BACKEND_PORT" != "$NEXT_BACKEND_PORT" ]; }; then
    
    OLD_CONTAINER_NAME="app-$CURRENT_FRONTEND_PORT-$CURRENT_BACKEND_PORT"
    log "停止旧应用服务: $OLD_CONTAINER_NAME"
    docker stop "$OLD_CONTAINER_NAME" 2>/dev/null || true
    docker rm "$OLD_CONTAINER_NAME" 2>/dev/null || true
fi

# 清理资源
log "清理Docker资源..."
docker image prune -f

# 最终健康检查
log "执行最终健康检查..."
if check_frontend_health "$NEXT_FRONTEND_PORT" && check_backend_health "$NEXT_BACKEND_PORT"; then
    log "✓ 所有服务健康检查通过"
else
    log "✗ 健康检查未通过"
    exit 1
fi

log "=== 部署完成 ==="
log "部署时间: $DEPLOY_DATE"
log "当前运行端口 - 前端: $NEXT_FRONTEND_PORT, 后端: $NEXT_BACKEND_PORT"
log "服务状态:"
docker ps --filter "name=app-*" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

log "部署完成!"