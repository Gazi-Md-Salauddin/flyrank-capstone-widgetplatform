const { Pool } = require('pg');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
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
    const schema = await readFile(path.join(__dirname, 'db', 'init.sql'), 'utf8');
    await pool.query(schema);
  } catch {
    console.error('[startup] Database connection or schema setup failed; verify DATABASE_URL and PostgreSQL.');
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
    rateLimitWindowMs: config.rateLimitWindowMs,
    apiBaseUrl: config.apiBaseUrl,
    ownerApiToken: config.ownerApiToken,
    ownerTenantId: config.ownerTenantId
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
