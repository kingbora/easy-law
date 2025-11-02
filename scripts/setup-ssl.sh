#!/bin/bash

echo "🔐 Setting up SSL certificates..."

# 创建 SSL 目录
mkdir -p nginx/ssl

# 提示用户放置证书文件
echo "请将以下文件放置到 nginx/ssl/ 目录:"
echo "1. mydomain.com.crt (SSL证书文件)"
echo "2. mydomain.com.key (SSL私钥文件)"
echo ""
echo "如果你还没有 SSL 证书，可以选择:"
echo "1. 使用 Let's Encrypt 免费证书"
echo "2. 从阿里云购买 SSL 证书"
echo "3. 使用自签名证书（仅测试环境）"

# 检查证书文件是否存在
if [ -f "nginx/ssl/mydomain.com.crt" ] && [ -f "nginx/ssl/mydomain.com.key" ]; then
    echo "✅ SSL 证书文件已就绪"
else
    echo "⚠️  请确保 SSL 证书文件已放置到正确位置"
    echo "或者使用以下命令生成测试证书:"
    echo "openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\"
    echo "  -keyout nginx/ssl/mydomain.com.key \\"
    echo "  -out nginx/ssl/mydomain.com.crt \\"
    echo "  -subj \"/C=CN/ST=Beijing/L=Beijing/O=Dev/CN=www.mydomain.com\""
fi