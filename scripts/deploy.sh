#!/bin/bash
# deploy.sh - 零停机部署脚本

set -e

PROJECT_DIR="/home/apps/easy-law"
WEB_PROJECT_DIR="$PROJECT_DIR/projects/web-project"
SERVER_PROJECT_DIR="$PROJECT_DIR/projects/server-project"
BACKUP_DIR="$PROJECT_DIR/backups"
LOG_FILE="/home/logs/deploy.log"
BRANCH="master"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> $LOG_FILE
    echo "$1"
}

# 前端健康检查
frontend_health_check() {
    local url="http://localhost:3000/api/health"
    local max_attempts=30
    local attempt=1
    
    log "检查前端健康状态..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s --retry 3 --retry-delay 1 "$url" > /dev/null 2>&1; then
            log "✓ 前端健康检查通过 (尝试 $attempt/$max_attempts)"
            return 0
        fi
        
        log "⏳ 前端健康检查失败，等待重试... (尝试 $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    log "✗ 前端健康检查失败"
    return 1
}

# 后端健康检查
backend_health_check() {
    local url="http://localhost:4000/health"
    local max_attempts=30
    local attempt=1
    
    log "检查后端健康状态..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s --retry 3 --retry-delay 1 "$url" > /dev/null 2>&1; then
            log "✓ 后端健康检查通过 (尝试 $attempt/$max_attempts)"
            return 0
        fi
        
        log "⏳ 后端健康检查失败，等待重试... (尝试 $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    log "✗ 后端健康检查失败"
    return 1
}

deploy() {
    log "开始部署..."
    
    cd $PROJECT_DIR

    # 备份当前版本
    log "备份当前版本..."
    local backup_name="backup_$(date +%Y%m%d_%H%M%S)"
    cp -r $WEB_PROJECT_DIR/.next $BACKUP_DIR/$backup_name/frontend 2>/dev/null || true
    cp -r $SERVER_PROJECT_DIR/dist $BACKUP_DIR/$backup_name/backend 2>/dev/null || true
    
    # 拉取最新代码
    log "拉取最新代码..."
    git fetch origin
    git checkout $BRANCH
    git reset --hard origin/$BRANCH
    
    # 安装依赖
    log "安装依赖..."
    pnpm install --offline --prod --frozen-lockfile --ignore-scripts
    
    # 构建应用
    log "构建应用..."
    pnpm build
    
    # 零停机重启
    log "执行零停机重启..."
    if pm2 list | grep -q "frontend\|backend"; then
        echo "重启应用..."
        pm2 reload ecosystem.config.js --update-env
    else
        echo "首次启动应用..."
        pm2 start ecosystem.config.js
    fi
    
    # 等待应用就绪
    log "等待应用就绪..."
    sleep 10
    
    # 健康检查
    if backend_health_check && frontend_health_check; then
        log "✓ 全栈应用部署成功完成"
        
        # 清理旧备份（保留最近5个）
        ls -dt $BACKUP_DIR/backup_* | tail -n +6 | xargs rm -rf 2>/dev/null || true
        
        # 重新加载Nginx配置
        sudo nginx -t && sudo nginx -s reload
        log "✓ Nginx配置已重新加载"
    else
        log "✗ 部署失败，执行回滚..."
        rollback
        exit 1
    fi
    
    log "部署完成"

    log "Nginx状态:"
    systemctl status nginx --no-pager -l

    # 启动心跳监控
    start_heartbeat_monitor
}

# 回滚函数
rollback() {
    log "开始回滚..."
    
    local latest_backup=$(ls -dt $BACKUP_DIR/backup_* | head -n1)
    
    if [ -n "$latest_backup" ]; then
        log "回滚到备份: $latest_backup"
        
        # 恢复前端
        if [ -d "$latest_backup/frontend" ]; then
            rm -rf $FRONTEND_DIR/.next
            cp -r $latest_backup/frontend $FRONTEND_DIR/.next
        fi
        
        # 恢复后端
        if [ -d "$latest_backup/backend" ]; then
            rm -rf $BACKEND_DIR/dist
            cp -r $latest_backup/backend $BACKEND_DIR/dist
        fi
        
        # 重启服务
        pm2 reload all
        
        # 健康检查
        if backend_health_check && frontend_health_check; then
            log "✓ 回滚成功"
        else
            log "✗ 回滚后健康检查失败"
            exit 1
        fi
    else
        log "✗ 没有找到可用的备份"
        exit 1
    fi
    # 启动心跳监控
    start_heartbeat_monitor
}

# 启动心跳监控
start_heartbeat_monitor() {
    log "启动心跳检测监控..."
    
    # 停止已存在的监控
    pkill -f "heartbeat-monitor.sh" || true
    
    # 启动新的监控
    nohup bash scripts/heartbeat-monitor.sh start > /dev/null 2>&1 &
    
    log "心跳检测监控已启动"
}

# 执行部署
deploy