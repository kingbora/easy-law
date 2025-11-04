#!/bin/bash
set -e

APP_DIR="/home/apps/lawyer-app"
LOG_DIR="$APP_DIR/shared/logs"
LOG_FILE="$LOG_DIR/health-check.log"

mkdir -p "$LOG_DIR"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_service() {
    local service_name=$1
    local port=$2
    local health_endpoint=$3
    local max_retries=10
    
    for i in $(seq 1 $max_retries); do
        if curl -s -f "http://localhost:${port}${health_endpoint}" >/dev/null 2>&1; then
            log "✓ $service_name 服务正常 (端口: $port)"
            return 0
        fi
        if [ $i -eq 1 ]; then
            log "等待 $service_name 服务启动... ($i/$max_retries)"
        elif [ $((i % 3)) -eq 0 ]; then
            log "仍在等待 $service_name 服务启动... ($i/$max_retries)"
        fi
        sleep 3
    done
    log "✗ $service_name 服务健康检查失败 (端口: $port)"
    return 1
}

check_docker_services() {
    log "检查Docker容器状态..."
    
    # 检查运行中的app相关容器
    local running_containers=$(docker ps --filter "name=app-" --format "{{.Names}}" | wc -l)
    if [ "$running_containers" -eq 0 ]; then
        log "警告: 未找到运行中的应用容器"
        return 1
    fi
    
    log "当前运行的应用容器:"
    docker ps --filter "name=app-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    return 0
}

check_nginx_service() {
    log "检查Nginx服务..."
    if sudo systemctl is-active --quiet nginx; then
        log "✓ Nginx服务运行正常"
        
        # 检查Nginx配置
        if sudo nginx -t; then
            log "✓ Nginx配置验证通过"
        else
            log "✗ Nginx配置验证失败"
            return 1
        fi
    else
        log "✗ Nginx服务未运行，尝试启动..."
        if sudo systemctl start nginx; then
            log "✓ Nginx服务已成功启动"
            # 再次验证配置
            if sudo nginx -t; then
                log "✓ Nginx配置验证通过"
            else
                log "✗ Nginx配置验证失败"
                return 1
            fi
        else
            log "✗ Nginx服务启动失败"
            return 1
        fi
    fi
    return 0
}

log "开始全面健康检查..."

# 检查Docker服务
if ! systemctl is-active --quiet docker; then
    log "错误: Docker 服务未运行"
    exit 1
fi

# 检查Docker容器
check_docker_services

# 检查Nginx服务
check_nginx_service

# 检查所有可能端口的服务健康状态
log "检查服务健康状态..."

# 获取当前运行的端口
CURRENT_FRONTEND_PORT=$(grep -A5 "upstream frontend_servers" /etc/nginx/conf.d/lawyer-app-upstream.conf 2>/dev/null | \
    grep "server 127.0.0.1:" | head -1 | awk -F: '{print $2}' | awk '{gsub(/;.*/, "", $1); print $1}' || echo ""

CURRENT_BACKEND_PORT=$(grep -A5 "upstream backend_servers" /etc/nginx/conf.d/lawyer-app-upstream.conf 2>/dev/null | \
    grep "server 127.0.0.1:" | head -1 | awk -F: '{print $2}' | awk '{gsub(/;.*/, "", $1); print $1}' || echo ""

if [ -n "$CURRENT_FRONTEND_PORT" ] && [ -n "$CURRENT_BACKEND_PORT" ]; then
    log "当前生产环境端口 - 前端: $CURRENT_FRONTEND_PORT, 后端: $CURRENT_BACKEND_PORT"
    
    # 检查当前生产服务
    check_service "前端" "$CURRENT_FRONTEND_PORT" "/api/health"
    check_service "后端" "$CURRENT_BACKEND_PORT" "/health"
else
    log "警告: 无法确定当前生产环境端口"
    
    # 检查所有可能端口
    for port in 3000 3001; do
        if ss -tln | grep -q ":$port "; then
            check_service "前端(端口$port)" "$port" "/api/health"
        fi
    done
    
    for port in 4000 4001; do
        if ss -tln | grep -q ":$port "; then
            check_service "后端(端口$port)" "$port" "/health"
        fi
    done
fi

log "=== 健康检查完成 ==="
log "详细日志查看: $LOG_FILE"