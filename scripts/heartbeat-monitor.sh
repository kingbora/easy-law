#!/bin/bash
# scripts/heartbeat-monitor.sh

set -e

# 配置
CHECK_INTERVAL=30          # 检查间隔(秒)
MAX_FAILURES=3             # 最大连续失败次数
FRONTEND_URL="http://localhost:3000/api/health"
BACKEND_URL="http://localhost:4000/health"
LOG_FILE="/home/logs/heartbeat-monitor.log"

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# 检查服务健康状态
check_service() {
    local service_name=$1
    local health_url=$2
    
    if curl -s -f --max-time 10 "$health_url" > /dev/null 2>&1; then
        echo "healthy"
    else
        echo "unhealthy"
    fi
}

# 重启服务
restart_service() {
    local service_name=$1
    
    log "尝试重启服务: $service_name"
    
    # 使用PM2重启服务
    if pm2 restart "$service_name" > /dev/null 2>&1; then
        log "✅ 服务重启成功: $service_name"
        return 0
    else
        log "❌ 服务重启失败: $service_name"
        return 1
    fi
}

# 监控单个服务
monitor_service() {
    local service_name=$1
    local health_url=$2
    local failure_count=0
    
    while true; do
        local status=$(check_service "$service_name" "$health_url")
        
        if [ "$status" = "healthy" ]; then
            if [ $failure_count -gt 0 ]; then
                log "✅ 服务恢复健康: $service_name"
                failure_count=0
            fi
        else
            ((failure_count++))
            log "❌ 服务异常: $service_name (失败次数: $failure_count/$MAX_FAILURES)"
            
            if [ $failure_count -ge $MAX_FAILURES ]; then
                log "🚨 达到最大失败次数，自动重启服务: $service_name"
                if restart_service "$service_name"; then
                    failure_count=0
                    sleep 30  # 重启后等待更长时间
                else
                    log "💥 重启失败，等待下次检查"
                    sleep 60
                fi
            fi
        fi
        
        sleep $CHECK_INTERVAL
    done
}

# 主函数
main() {
    log "启动心跳检测监控服务..."
    log "监控服务: frontend($FRONTEND_URL), backend($BACKEND_URL)"
    log "检查间隔: ${CHECK_INTERVAL}秒, 最大失败次数: $MAX_FAILURES"
    
    # 启动前端监控 (后台运行)
    monitor_service "frontend" "$FRONTEND_URL" &
    local frontend_pid=$!
    
    # 启动后端监控 (后台运行)
    monitor_service "backend" "$BACKEND_URL" &
    local backend_pid=$!
    
    # 等待子进程
    wait $frontend_pid $backend_pid
}

# 信号处理
cleanup() {
    log "停止心跳检测监控服务"
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# 启动监控
case "${1:-start}" in
    start)
        main
        ;;
    stop)
        cleanup
        ;;
    status)
        echo "前端服务: $(check_service "frontend" "$FRONTEND_URL")"
        echo "后端服务: $(check_service "backend" "$BACKEND_URL")"
        ;;
    *)
        echo "用法: $0 {start|stop|status}"
        exit 1
        ;;
esac