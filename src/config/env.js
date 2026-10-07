const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  HOST: z.string().min(1).default('localhost'),
  DATABASE_URL: z.string().min(1),
  API_BASE_URL: z.string().url().default('http://localhost:5000'),
  OWNER_API_TOKEN: z.string().min(32),
  OWNER_TENANT_ID: z.string().uuid(),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:5500'),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  GEO_PROVIDER_A_MODE: z.enum(['live', 'mock', 'fail']).default('live'),
  GEO_PROVIDER_B_MODE: z.enum(['live', 'mock', 'fail']).default('live'),
  NOTIFICATION_MODE: z.enum(['console', 'fail']).default('console')
});

function loadConfig(source = process.env) {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error('Invalid server configuration. Check the required environment variables.');
  }

  const config = parsed.data;
  const apiBaseUrl = new URL(config.API_BASE_URL);
  if (apiBaseUrl.pathname !== '/' || apiBaseUrl.search || apiBaseUrl.hash
    || apiBaseUrl.username || apiBaseUrl.password) {
    throw new Error('API_BASE_URL must be an origin without credentials, path, query, or fragment.');
  }
  const localModes = [
    config.GEO_PROVIDER_A_MODE !== 'live',
    config.GEO_PROVIDER_B_MODE !== 'live',
    config.NOTIFICATION_MODE !== 'console'
  ];
  if (config.NODE_ENV === 'production' && localModes.some(Boolean)) {
    throw new Error('Development-only provider modes cannot be used in production.');
  }

  const origins = config.CORS_ALLOWED_ORIGINS
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (const origin of origins) {
    let parsedOrigin;
    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new Error('CORS_ALLOWED_ORIGINS must contain valid origins.');
    }
    if (parsedOrigin.origin !== origin || parsedOrigin.username || parsedOrigin.password) {
      throw new Error('CORS_ALLOWED_ORIGINS must contain origins only, without paths or credentials.');
    }
  }

  return {
    nodeEnv: config.NODE_ENV,
    port: config.PORT,
    host: config.HOST,
    databaseUrl: config.DATABASE_URL,
    apiBaseUrl: apiBaseUrl.origin,
    ownerApiToken: config.OWNER_API_TOKEN,
    ownerTenantId: config.OWNER_TENANT_ID,
    allowedOrigins: origins,
    rateLimitMax: config.RATE_LIMIT_MAX,
    rateLimitWindowMs: config.RATE_LIMIT_WINDOW_MS,
    geoProviderAMode: config.GEO_PROVIDER_A_MODE,
    geoProviderBMode: config.GEO_PROVIDER_B_MODE,
    notificationMode: config.NOTIFICATION_MODE
  };
}

module.exports = { loadConfig };
