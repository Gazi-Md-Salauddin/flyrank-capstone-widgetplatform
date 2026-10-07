const { Pool } = require('pg');
const { createApp } = require('./app');
const { loadConfig } = require('./config/env');
const { createSubmissionRepository } = require('./db/submission-repository');
const { createGeoEnrichmentService } = require('./services/geo-enrichment.service');
const { createNotificationService } = require('./services/notification.service');

async function start() {
  const config = loadConfig();
  const pool = new Pool({ connectionString: config.databaseUrl });

  try {
    await pool.query('SELECT 1');
  } catch {
    console.error('[startup] Database connection failed; verify DATABASE_URL and start PostgreSQL.');
    await pool.end();
    process.exitCode = 1;
    return;
  }

  const app = createApp({
    repository: createSubmissionRepository(pool),
    geoService: createGeoEnrichmentService({
      providerAMode: config.geoProviderAMode,
      providerBMode: config.geoProviderBMode
    }),
    notificationService: createNotificationService({ mode: config.notificationMode }),
    allowedOrigins: config.allowedOrigins,
    rateLimitMax: config.rateLimitMax,
    rateLimitWindowMs: config.rateLimitWindowMs
  });

  const server = app.listen(config.port, config.host, () => {
    console.info(`[startup] API listening on http://${config.host}:${config.port}`);
  });

  const shutdown = () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch(() => {
  console.error('[startup] Server configuration or initialization failed.');
  process.exitCode = 1;
});
