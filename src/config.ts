/**
 * 全局配置（从环境变量读取，带默认值，适配本地 MySQL）。
 * 本地 MySQL：root / root123456，端口 3306。
 */
export const config = {
  port: Number(process.env.PORT ?? 3000),
  db: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASS ?? 'root123456',
    database: process.env.DB_NAME ?? 'order_system',
  },
  // 支付配置（#4）
  pay: {
    // 默认开启 mock：不接真实商户号也能跑通完整状态机（生成可渲染的占位二维码串）
    // 接真实商户号时设 PAY_MOCK=false，并填下列对应密钥
    mock: process.env.PAY_MOCK !== 'false',
    // 支付二维码有效秒数（超时未支付订单会被扫描器置为 cancelled）
    qrTtlSec: Number(process.env.PAY_QR_TTL_SEC ?? 600),
    wechat: {
      enabled: process.env.WECHAT_PAY_ENABLED === 'true',
      appId: process.env.WECHAT_APP_ID ?? '',
      mchId: process.env.WECHAT_MCH_ID ?? '',
      apiV3Key: process.env.WECHAT_API_V3_KEY ?? '',
      serialNo: process.env.WECHAT_SERIAL_NO ?? '',
      privateKey: process.env.WECHAT_PRIVATE_KEY ?? '',
      notifyUrl: process.env.WECHAT_NOTIFY_URL ?? '',
    },
    alipay: {
      enabled: process.env.ALIPAY_ENABLED === 'true',
      appId: process.env.ALIPAY_APP_ID ?? '',
      privateKey: process.env.ALIPAY_PRIVATE_KEY ?? '',
      publicKey: process.env.ALIPAY_PUBLIC_KEY ?? '',
      notifyUrl: process.env.ALIPAY_NOTIFY_URL ?? '',
    },
  },
};
