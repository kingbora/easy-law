#!/bin/bash
set -e

APP_DIR="/home/apps/lawyer-app"
LOG_FILE="$APP_DIR/shared/logs/deploy/health-check.log"

mkdir -p $(dirname $LOG_FILE)

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

check_service() {
    local service_name=$1
    local port=$2
    local endpoint=$3
    local max_retries=30
    
    for i in $(seq 1 $max_retries); do
        if curl -s -f "http://localhost:$port$endpoint" >/dev/null 2>&1; then
            log "✓ $service_name 服务正常 (端口: $port)"
            return 0
        fi
        log "等待 $service_name 服务启动... ($i/$max_retries)"
        sleep 2
    done
    log "✗ $service_name 服务健康检查失败"
    return 1
}

log "开始健康检查..."

# 检查Docker服务
if ! systemctl is-active --quiet docker; then
    log "错误: Docker 服务未运行"
    exit 1
fi

# 检查服务健康状态
check_service "前端" 3000 "/api/health"
check_service "后端" 4000 "/health"
check_service "Nginx" 80 "/health"

log "所有服务健康检查通过!"