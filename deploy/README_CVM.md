# 商品点餐系统 · 腾讯云 CVM 部署指南（#6）

> 目标：前后端联调 + 部署到腾讯云 CVM，配置安全组/Nginx/MySQL/后端常驻，跑通
> 「扫码点餐 → 下单 → 支付 → 收银看单 → 小票」完整商用闭环。
> 前置：#3 后端已验证、#4 支付对接完成（mock 模式可直接演示）。

## 一、CVM 环境准备清单
- 系统：TencentOS Server 3.1 / CentOS 7+（本项目已购：标准 SA5 2C2G，上海 2 区）
- 公网 IP：101.35.142.60（部署时换成你的）
- 依赖：
  - Node.js 22（后端运行）
  - MySQL 8（数据，3306 仅内网）
  - Nginx（反代 /api → 3000）
  - pm2（`npm i -g pm2`，后端常驻）
- 连接方式：SSH ed25519 密钥（`C:\Users\admin\.ssh\id_ed25519`，已可通过 Xshell 8 连接）

## 二、安全组（腾讯云控制台）
| 规则 | 端口 | 来源 | 说明 |
|---|---|---|---|
| 入站 | 22 | 你的 IP | SSH |
| 入站 | 80 | 0.0.0.0/0 | HTTP（Nginx） |
| 入站 | 443 | 0.0.0.0/0 | HTTPS（可选，配证书后开） |
| 入站 | 3000 | 127.0.0.1（或同 VPC） | 后端仅内网/Nginx 访问，**不要对公网开放** |
| 入站 | 3306 | 127.0.0.1 | MySQL 仅内网 |

> 关键点：微信/支付宝异步回调需公网可达 → 回调地址用 `https://域名/api/pay/wechat/notify`，
> 经 Nginx 反代到本机 3000，因此 3000 端口无需对公网开放。

## 三、后端部署步骤
1. 上传/克隆代码：`git clone git@github.com:zhaoyang4/vue3-server.git /opt/order-system/server`
   （本项目后端目录即 server/，按实际仓库调整）
2. 安装依赖：`cd /opt/order-system/server && npm install`
3. 建库：参考本地 seed 流程（`node node_modules/typescript/lib/tsc.js seed.ts ... && node ./seedbuild/seed.js`）
4. 配置环境变量：参考 `.env.example`，用 `pm2 env` 或 `export` 注入
5. 编译：`node node_modules/typescript/lib/tsc.js -p tsconfig.json`
6. 常驻：`pm2 start ecosystem.config.js && pm2 save && pm2 startup`
7. Nginx：放置 `nginx-host.conf` 到 `/etc/nginx/conf.d/order.conf`，`nginx -t && systemctl reload nginx`

## 四、前端（顾客端 / 收银端）切真实后端
- 顾客端 `customer_app/lib/core/constants.dart`：
  - `apiBaseUrl` 改为 `https://你的域名`（走 Nginx 反代）
  - `useMock` 改为 `false`
- 收银端（#5）：同理指向同一域名
- 重新 `flutter build`（app/apk / windows exe / web）分发

## 五、端到端验证
1. `curl https://你的域名/api/menu` 返回菜单 JSON
2. 顾客端扫码点餐 → 提交订单 → 看到支付二维码（mock 模式为 `mockpay://...` 串）
3. 调 `/api/pay/{orderNo}/mock-paid?method=wechat` 模拟支付成功 → 订单变 `paid`
4. 收银端查看订单 → 标记完成 → 状态 `completed` → 打印小票
5. 接真实支付后：用微信/支付宝扫真实二维码 → 异步回调 → 订单自动 `paid`

## 六、坑速查
- 回调公网不可达：检查 Nginx 反代 + 安全组 80/443 开放 + notifyUrl 域名正确
- 后端崩了不重启：确认 `pm2 save` + `pm2 startup` 已执行
- 数据库连不上：确认 MySQL 在跑、DB_PASS 与 CVM 实际密码一致、3306 仅监听内网
- 沙箱无法验证部署：本步骤需在本机/SSH 到 CVM 执行，WorkBuddy 沙箱无外网
