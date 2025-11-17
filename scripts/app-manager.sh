#!/bin/bash
# app-manager.sh

set -e

echo "🎯 应用管理脚本"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

APP_NAME="next-app"
CONFIG_FILE="ecosystem.config.js"

log_info() { echo -e "${GREEN}✅ $1${NC}"; }
log_warn() { echo -e "${YELLOW}⚠️ $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# 启动应用
start_app() {
    log_info "启动应用..."
    pm2 start $CONFIG_FILE
    pm2 save
    log_info "应用已启动"
}

# 停止应用
stop_app() {
    log_info "停止应用..."
    pm2 stop $APP_NAME
    log_info "应用已停止"
}

# 重启应用
restart_app() {
    log_info "重启应用..."
    pm2 restart $APP_NAME
    log_info "应用已重启"
}

# 查看状态
status_app() {
    echo "📊 应用状态:"
    pm2 status
    echo ""
    echo "📝 最近日志:"
    pm2 logs $APP_NAME --lines 20
}

# 查看实时日志
logs_app() {
    echo "📋 实时日志 (Ctrl+C 退出):"
    pm2 logs $APP_NAME
}

# 监控资源使用
monitor_app() {
    echo "📈 资源监控:"
    pm2 monit
}

# 设置开机自启
setup_startup() {
    log_info "设置开机自启..."
    pm2 startup
    pm2 save
    log_info "开机自启已设置"
}

# 更新应用
update_app() {
    log_info "更新应用..."
    
    # 拉取最新代码
    git pull origin main
    
    # 安装依赖
    pnpm install
    
    # 构建应用
    pnpm build
    
    # 重启应用
    pm2 restart $APP_NAME
    
    log_info "应用已更新"
}

main() {
    echo "请选择操作:"
    echo "1. 启动应用"
    echo "2. 停止应用"
    echo "3. 重启应用"
    echo "4. 查看状态"
    echo "5. 查看日志"
    echo "6. 资源监控"
    echo "7. 设置开机自启"
    echo "8. 更新应用"
    
    read -p "请输入选择 (1-8): " choice
    
    case $choice in
        1) start_app ;;
        2) stop_app ;;
        3) restart_app ;;
        4) status_app ;;
        5) logs_app ;;
        6) monitor_app ;;
        7) setup_startup ;;
        8) update_app ;;
        *) log_error "无效选择" ;;
    esac
}

main