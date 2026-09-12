// pm2 常驻配置：让后端在 CVM 上崩溃自启、开机自启（配合 pm2 save + pm2 startup）
module.exports = {
  apps: [
    {
      name: 'order-server',
      script: 'dist/main.js',
      cwd: '/opt/order-system/server',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DB_HOST: '127.0.0.1',
        DB_PORT: 3306,
        DB_USER: 'root',
        DB_PASS: 'YOUR_DB_PASSWORD', // 改成真实密码，建议用环境变量注入而非硬编码
        DB_NAME: 'order_system',
        PAY_MOCK: 'true', // 接真实商户号时改 false
        PAY_QR_TTL_SEC: 600,
      },
    },
  ],
};
