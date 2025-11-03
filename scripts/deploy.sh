#!/bin/bash
set -e

APP_NAME="lawyer-app"
APP_DIR="/home/apps/$APP_NAME"
DEPLOY_DATE=$(date +%Y%m%d_%H%M%S)

# 端口定义
FRONTEND_PORTS=(3000 3001)
BACKEND_PORTS=(4000 4001)

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

check_service_health() {
    local port=$1
    local endpoint=$2
    local service_name=$3
    local max_retries=20
    
    for i in $(seq 1 $max_retries); do
        if curl -s -f "http://localhost:${port}${endpoint}" >/dev/null 2>&1; then
            log "✓ $service_name 健康 (端口: $port)"
            return 0
        fi
        if [ $i -eq 1 ]; then
            log "等待 $service_name 启动... ($i/$max_retries)"
        elif [ $((i % 5)) -eq 0 ]; then
            log "仍在等待 $service_name 启动... ($i/$max_retries)"
        fi
        sleep 3
    done
    log "✗ $service_name 健康检查失败 (端口: $port)"
    return 1
}

# 获取当前运行的端口
get_current_upstream_port() {
    local upstream_name=$1
    if [ -f "/etc/nginx/lawyer-app-upstream.conf" ]; then
        grep -A5 "upstream $upstream_name" /etc/nginx/lawyer-app-upstream.conf 2>/dev/null | \
        grep "server 127.0.0.1:" | head -1 | awk -F: '{print $2}' | awk '{print $1}' || echo ""
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
            echo $port
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
    mkdir -p $APP_DIR/shared/{logs,data}
}

# 停止并清理旧容器
cleanup_old_containers() {
    local next_frontend_port=$1
    local next_backend_port=$2
    
    log "清理旧容器..."
    
    # 停止并移除将要使用端口上的旧容器
    for port in "${FRONTEND_PORTS[@]}"; do
        if [ "$port" = "$next_frontend_port" ]; then
            # 这是我们要使用的端口，确保没有冲突
            docker stop "frontend-$port" 2>/dev/null || true
            docker rm "frontend-$port" 2>/dev/null || true
        fi
    done
    
    for port in "${BACKEND_PORTS[@]}"; do
        if [ "$port" = "$next_backend_port" ]; then
            docker stop "backend-$port" 2>/dev/null || true
            docker rm "backend-$port" 2>/dev/null || true
        fi
    done
}

# 验证Nginx配置
verify_nginx_config() {
    if ! nginx -t; then
        log "✗ Nginx配置验证失败"
        return 1
    fi
    return 0
}

# 主部署流程
log "开始智能部署流程..."

# 检查镜像文件
if [ ! -f "$APP_DIR/frontend-image.tar" ] || [ ! -f "$APP_DIR/backend-image.tar" ]; then
    log "错误: 未找到Docker镜像文件"
    exit 1
fi

# 设置环境
setup_environment

# 加载新镜像
log "加载Docker镜像..."
docker load -i $APP_DIR/frontend-image.tar
docker load -i $APP_DIR/backend-image.tar

# 获取当前和下一个端口
CURRENT_FRONTEND_PORT=$(get_current_upstream_port "frontend_servers")
CURRENT_BACKEND_PORT=$(get_current_upstream_port "backend_servers")

NEXT_FRONTEND_PORT=$(get_next_port "$CURRENT_FRONTEND_PORT" FRONTEND_PORTS[@])
NEXT_BACKEND_PORT=$(get_next_port "$CURRENT_BACKEND_PORT" BACKEND_PORTS[@])

log "部署信息:"
log "  - 当前前端端口: ${CURRENT_FRONTEND_PORT:-未设置}"
log "  - 当前后端端口: ${CURRENT_BACKEND_PORT:-未设置}"
log "  - 下一前端端口: $NEXT_FRONTEND_PORT"
log "  - 下一后端端口: $NEXT_BACKEND_PORT"

# 清理旧容器
cleanup_old_containers "$NEXT_FRONTEND_PORT" "$NEXT_BACKEND_PORT"

# 启动新版本服务
log "启动新版本服务..."
log "启动前端服务 (端口: $NEXT_FRONTEND_PORT)..."
if ! docker run -d --name "frontend-$NEXT_FRONTEND_PORT" \
    -p $NEXT_FRONTEND_PORT:3000 \
    -v $APP_DIR/shared/logs:/app/logs \
    lawyer-frontend:latest; then
    log "✗ 前端服务启动失败"
    docker logs "frontend-$NEXT_FRONTEND_PORT" 2>/dev/null || true
    exit 1
fi

log "启动后端服务 (端口: $NEXT_BACKEND_PORT)..."
if ! docker run -d --name "backend-$NEXT_BACKEND_PORT" \
    -p $NEXT_BACKEND_PORT:4000 \
    -v $APP_DIR/shared/logs:/app/logs \
    -v $APP_DIR/shared/data:/app/data \
    lawyer-backend:latest; then
    log "✗ 后端服务启动失败"
    docker logs "backend-$NEXT_BACKEND_PORT" 2>/dev/null || true
    # 清理已启动的前端服务
    docker stop "frontend-$NEXT_FRONTEND_PORT" 2>/dev/null || true
    exit 1
fi

# 等待新服务就绪
log "等待新服务启动..."
if ! check_service_health "$NEXT_FRONTEND_PORT" "/api/health" "前端新实例"; then
    log "前端新实例健康检查失败，查看日志:"
    docker logs "frontend-$NEXT_FRONTEND_PORT"
    exit 1
fi

if ! check_service_health "$NEXT_BACKEND_PORT" "/health" "后端新实例"; then
    log "后端新实例健康检查失败，查看日志:"
    docker logs "backend-$NEXT_BACKEND_PORT"
    exit 1
fi

# 更新Nginx配置
log "更新Nginx upstream指向新端口..."
cat > /etc/nginx/lawyer-app-upstream.conf << EOF
upstream frontend_servers {
    server 127.0.0.1:$NEXT_FRONTEND_PORT;
}

upstream backend_servers {
    server 127.0.0.1:$NEXT_BACKEND_PORT;
}
EOF

# 验证并重载Nginx
if verify_nginx_config; then
    log "重载Nginx配置..."
    if systemctl reload nginx; then
        log "✓ Nginx重载成功，流量已切换到新实例"
    else
        log "✗ Nginx重载失败"
        exit 1
    fi
else
    log "✗ Nginx配置验证失败，回滚upstream配置"
    # 恢复原有配置
    if [ -n "$CURRENT_FRONTEND_PORT" ] && [ -n "$CURRENT_BACKEND_PORT" ]; then
        cat > /etc/nginx/lawyer-app-upstream.conf << EOF
upstream frontend_servers {
    server 127.0.0.1:$CURRENT_FRONTEND_PORT;
}

upstream backend_servers {
    server 127.0.0.1:$CURRENT_BACKEND_PORT;
}
EOF
    fi
    exit 1
fi

# 等待新服务稳定运行
log "等待新服务稳定..."
sleep 10

# 停止旧版本服务（如果存在）
if [ -n "$CURRENT_FRONTEND_PORT" ] && [ "$CURRENT_FRONTEND_PORT" != "$NEXT_FRONTEND_PORT" ]; then
    log "停止旧前端服务 (端口: $CURRENT_FRONTEND_PORT)..."
    docker stop "frontend-$CURRENT_FRONTEND_PORT" 2>/dev/null || true
    docker rm "frontend-$CURRENT_FRONTEND_PORT" 2>/dev/null || true
fi

if [ -n "$CURRENT_BACKEND_PORT" ] && [ "$CURRENT_BACKEND_PORT" != "$NEXT_BACKEND_PORT" ]; then
    log "停止旧后端服务 (端口: $CURRENT_BACKEND_PORT)..."
    docker stop "backend-$CURRENT_BACKEND_PORT" 2>/dev/null || true
    docker rm "backend-$CURRENT_BACKEND_PORT" 2>/dev/null || true
fi

# 清理资源
log "清理Docker资源..."
docker image prune -f

# 最终健康检查
log "执行最终健康检查..."
check_service_health "$NEXT_FRONTEND_PORT" "/api/health" "前端服务"
check_service_health "$NEXT_BACKEND_PORT" "/health" "后端服务"

log "=== 部署完成 ==="
log "部署时间: $DEPLOY_DATE"
log "当前运行端口 - 前端: $NEXT_FRONTEND_PORT, 后端: $NEXT_BACKEND_PORT"
log "服务状态:"
docker ps --filter "name=frontend-*" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
docker ps --filter "name=backend-*" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 清理临时文件
log "清理临时文件..."
rm -rf $APP_DIR

log "部署完成!"