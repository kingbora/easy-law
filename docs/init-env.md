# 阿里云ECS服务器初始化
```bash
#!/bin/bash
# Alibaba Cloud Linux 4 完整初始化脚本

set -e

APP_NAME="lawyer-app"
APP_DIR="/home/apps/$APP_NAME"
NODE_VERSION="20.10.0"
NODE_DIR="/usr/local/nodejs"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
    exit 1
}

# 安装基础工具
install_basic_tools() {
    log "安装基础工具..."
    yum update -y
    yum install -y curl wget git vim tree unzip jq
    log "✓ 基础工具安装完成"
}

# 使用二进制方案安装Node.js
install_nodejs_binary() {
    log "使用二进制方案安装 Node.js ${NODE_VERSION}..."
    
    # 安装依赖
    yum install -y xz
    
    cd /tmp
    
    # 尝试多个镜像源下载
    log "下载 Node.js 二进制包..."
    MIRRORS=(
        "https://registry.npmmirror.com/-/binary/node/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz"
        "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz"
        "https://mirrors.cloud.tencent.com/nodejs-release/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz"
    )
    
    local download_success=false
    for mirror in "${MIRRORS[@]}"; do
        log "尝试镜像: $(echo $mirror | cut -d'/' -f3)"
        if wget --timeout=30 --tries=2 -O node.tar.xz "$mirror"; then
            download_success=true
            log "✓ 下载成功"
            break
        fi
    done
    
    if [ "$download_success" != "true" ]; then
        error "Node.js 二进制包下载失败"
    fi
    
    # 清理旧安装
    log "清理旧版本..."
    rm -rf $NODE_DIR
    rm -f /usr/local/bin/node
    rm -f /usr/local/bin/npm
    rm -f /usr/local/bin/npx
    rm -f /usr/local/bin/corepack
    
    # 解压安装
    log "解压安装..."
    tar -xf node.tar.xz
    mv "node-v${NODE_VERSION}-linux-x64" $NODE_DIR
    
    # 创建符号链接
    log "创建符号链接..."
    ln -sf $NODE_DIR/bin/node /usr/local/bin/node
    ln -sf $NODE_DIR/bin/npm /usr/local/bin/npm
    ln -sf $NODE_DIR/bin/npx /usr/local/bin/npx
    ln -sf $NODE_DIR/bin/corepack /usr/local/bin/corepack
    
    # 配置环境变量
    log "配置环境变量..."
    cat > /etc/profile.d/nodejs.sh << EOF
export PATH=$NODE_DIR/bin:\$PATH
EOF
    source /etc/profile.d/nodejs.sh
    
    # 验证安装
    if ! node --version >/dev/null 2>&1; then
        error "Node.js 安装验证失败"
    fi
    
    log "✓ Node.js 安装完成: $(node --version)"
}

# 修复的npm配置函数
configure_npm() {
    log "配置 npm 镜像..."
    
    # 设置主要镜像源
    npm config set registry https://registry.npmmirror.com/
    
    # 设置其他可选镜像（移除无效的disturl）
    npm config set sass_binary_site https://npmmirror.com/mirrors/node-sass/ 2>/dev/null || log "⚠ 跳过sass_binary_site配置"
    npm config set electron_mirror https://npmmirror.com/mirrors/electron/ 2>/dev/null || log "⚠ 跳过electron_mirror配置"
    npm config set puppeteer_download_host https://npmmirror.com/mirrors/ 2>/dev/null || log "⚠ 跳过puppeteer_download_host配置"
    
    # 验证配置
    log "npm 注册表: $(npm config get registry)"
    log "✓ npm 配置完成"
}

# 安装pnpm
install_pnpm() {
    log "安装 pnpm..."
    corepack enable
    corepack prepare pnpm@9 --activate
    pnpm config set registry https://registry.npmmirror.com/
    
    if ! pnpm --version >/dev/null 2>&1; then
        error "pnpm 安装失败"
    fi
    
    log "✓ pnpm 安装完成: $(pnpm --version)"
}

install_docker() {
    log "安装 Docker..."
    
    # 安装依赖
    yum install -y yum-utils device-mapper-persistent-data lvm2
    
    # 清理旧的Docker仓库配置
    log "清理旧的Docker仓库配置..."
    rm -f /etc/yum.repos.d/docker-ce*.repo
    
    # 使用正确的Docker CE仓库 - CentOS 7版本
    log "配置Docker CE仓库..."
    yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    
    # 如果官方仓库失败，使用阿里云镜像
    if ! yum makecache > /dev/null 2>&1; then
        log "官方仓库访问失败，使用阿里云镜像..."
        rm -f /etc/yum.repos.d/docker-ce.repo
        
        # 手动创建阿里云Docker镜像配置
        cat > /etc/yum.repos.d/docker-ce.repo << 'EOF'
[docker-ce-stable]
name=Docker CE Stable
baseurl=https://mirrors.aliyun.com/docker-ce/linux/centos/7/x86_64/stable
enabled=1
gpgcheck=0

[docker-ce-test]
name=Docker CE Test
baseurl=https://mirrors.aliyun.com/docker-ce/linux/centos/7/x86_64/test
enabled=0
gpgcheck=0

[docker-ce-nightly]
name=Docker CE Nightly
baseurl=https://mirrors.aliyun.com/docker-ce/linux/centos/7/x86_64/nightly
enabled=0
gpgcheck=0
EOF
    fi
    
    # 更新缓存
    yum makecache
    
    # 安装Docker
    log "安装Docker组件..."
    yum install -y docker-ce docker-ce-cli containerd.io
    
    # 配置Docker镜像加速
    mkdir -p /etc/docker
    tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "registry-mirrors": [
    "https://registry.cn-hangzhou.aliyuncs.com",
    "https://docker.mirrors.ustc.edu.cn"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  }
}
EOF

    # 启动Docker
    systemctl start docker
    systemctl enable docker
    
    if ! docker --version >/dev/null 2>&1; then
        error "Docker 启动失败"
    fi
    
    log "✓ Docker 安装完成: $(docker --version)"
}

install_docker_compose() {
    log "安装Docker Compose..."
    
    # 清理旧文件
    rm -f /usr/local/bin/docker-compose
    rm -f /usr/bin/docker-compose
    
    # 直接使用七牛云链接下载
    if curl -L --connect-timeout 30 --retry 2 --progress-bar \
        "http://t53t8kxfu.hd-bkt.clouddn.com/docker-compose-linux-x86_64" \
        -o /usr/local/bin/docker-compose; then
        
        # 检查文件是否有效
        if [ -s /usr/local/bin/docker-compose ]; then
            file_size=$(stat -c%s /usr/local/bin/docker-compose)
            log "✓ 从七牛云下载成功，文件大小: $((file_size/1024/1024))MB"
        else
            log "❌ 下载文件为空"
            rm -f /usr/local/bin/docker-compose
            return 1
        fi
    else
        log "❌ 七牛云下载失败"
        return 1
    fi
    
    # 设置权限和链接
    chmod +x /usr/local/bin/docker-compose
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    
    # 验证安装
    if docker-compose --version >/dev/null 2>&1; then
        log "✓ Docker Compose 安装成功: $(docker-compose --version)"
        return 0
    else
        log "❌ Docker Compose 执行失败"
        return 1
    fi
}

# 创建应用目录结构
create_app_directories() {
    log "创建应用目录结构..."
    
    mkdir -p $APP_DIR/{releases,shared,backups,scripts}
    mkdir -p $APP_DIR/shared/{logs,data,config,tmp}
    mkdir -p $APP_DIR/shared/logs/{nginx,frontend,backend,deploy}
    mkdir -p $APP_DIR/shared/data/{uploads,database,cache}
    mkdir -p $APP_DIR/shared/config/{nginx,ssl,environment}
    mkdir -p $APP_DIR/backups/{database,configs,releases}
    
    # 设置权限
    chmod -R 755 $APP_DIR
    chmod -R 775 $APP_DIR/shared/logs
    chmod -R 775 $APP_DIR/shared/data
    
    log "✓ 目录结构创建完成"
}

# 配置防火墙
setup_firewall() {
    log "配置防火墙..."
    
    # 启动firewalld
    systemctl start firewalld 2>/dev/null || true
    systemctl enable firewalld 2>/dev/null || true
    
    # 开放端口
    firewall-cmd --permanent --add-port=80/tcp 2>/dev/null || true
    firewall-cmd --permanent --add-port=443/tcp 2>/dev/null || true
    firewall-cmd --permanent --add-port=3000/tcp 2>/dev/null || true
    firewall-cmd --permanent --add-port=4000/tcp 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
    
    log "✓ 防火墙配置完成"
}

# 清理临时文件
cleanup_temp_files() {
    log "清理临时文件..."
    rm -rf /tmp/node-v${NODE_VERSION}-linux-x64*
    rm -f /tmp/node.tar.xz
    rm -f /tmp/get-docker.sh 2>/dev/null || true
    log "✓ 临时文件清理完成"
}

# 验证安装结果
verify_installation() {
    log "验证安装结果..."
    
    echo "=== 核心组件 ==="
    node --version && echo "✓ Node.js" || echo "✗ Node.js"
    npm --version && echo "✓ npm" || echo "✗ npm"
    pnpm --version && echo "✓ pnpm" || echo "✗ pnpm"
    docker --version && echo "✓ Docker" || echo "✗ Docker"
    docker-compose --version && echo "✓ Docker Compose" || echo "✗ Docker Compose"
    
    echo -e "\n=== 服务状态 ==="
    systemctl is-active docker && echo "✓ Docker服务运行中" || echo "✗ Docker服务未运行"
    
    echo -e "\n=== 目录结构 ==="
    if [ -d "$APP_DIR" ]; then
        echo "✓ 应用目录已创建"
        tree -L 2 $APP_DIR 2>/dev/null || ls -la $APP_DIR
    else
        echo "✗ 应用目录未创建"
    fi
}

main() {
    log "=== Alibaba Cloud Linux 4 初始化开始 ==="
    
    install_basic_tools
    install_nodejs_binary
    configure_npm
    install_pnpm
    install_docker
    install_docker_compose
    create_app_directories
    setup_firewall
    cleanup_temp_files
    verify_installation
    
    log "=== 初始化完成 ==="
    log "📁 应用目录: $APP_DIR"
    log "🟢 Node.js: $(node --version)"
    log "📦 pnpm: $(pnpm --version)"
    log "🐳 Docker: $(docker --version)"
    log "🔧 前端端口: 3000, 后端端口: 4000"
}

main
```