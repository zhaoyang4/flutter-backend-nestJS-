#!/usr/bin/env bash
# 商品点餐系统 · CVM 一键部署脚本（后端）
# 使用：把本文件放到 server/deploy/ 后，`bash deploy/start.sh`
# 前置：已 git clone 项目到 /opt/order-system，已装 Node22 / MySQL8 / Nginx / pm2
set -e

DEPLOY_DIR="/opt/order-system/server"
cd "$DEPLOY_DIR"

echo ">>> [1/4] 拉取最新代码"
git pull origin main

echo ">>> [2/4] 安装依赖"
npm install --omit=dev || npm install

echo ">>> [3/4] TypeScript 编译"
node node_modules/typescript/lib/tsc.js -p tsconfig.json

echo ">>> [4/4] pm2 重启常驻"
pm2 reload ecosystem.config.js || pm2 start ecosystem.config.js
pm2 save

echo ">>> 部署完成。查看状态：pm2 status；查看日志：pm2 logs order-server"
