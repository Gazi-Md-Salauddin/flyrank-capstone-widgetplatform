const cors = require('cors');
const express = require('express');
const { createSubmissionsRouter } = require('./routes/submissions.routes');
const { createWidgetsRouter } = require('./routes/widgets.routes');
const { createDashboardRouter } = require('./routes/dashboard.routes');
const { createPublicWidgetController } = require('./controllers/public-widget.controller');
const { createOwnerAuthenticator } = require('./middleware/owner-auth');
const { errorHandler, notFound } = require('./middleware/error-handler');
const { getClientIp } = require('./utils/client-ip');
const { HttpError } = require('./utils/http-error');
const path = require('node:path');

function createApp({
  repository,
  geoService,
  notificationService,
  allowedOrigins = ['http://localhost:5500'],
  rateLimitMax = 10,
  rateLimitWindowMs = 60000,
  apiBaseUrl = 'http://localhost:5000',
  ownerApiToken,
  ownerTenantId,
  resolveOwnerTenant
}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.locals.allowedOrigins = allowedOrigins;
  app.locals.getClientIp = getClientIp;

  const corsOptions = {
    origin(origin, callback) {
      if (!origin) return callback(null, false);
      return callback(null, allowedOrigins.includes(origin));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
    maxAge: 600
  };

  app.use(cors(corsOptions));
  app.use(express.json({ limit: '16kb', strict: true }));
  app.get('/health', (request, response) => response.json({ success: true }));
  app.get('/widget.js', (request, response, next) => {
    response.set('Cache-Control', 'no-store');
    response.type('application/javascript').sendFile(
      path.join(__dirname, 'public', 'widget.js'),
      (error) => {
        if (error) next(error);
      }
    );
  });
  app.get('/api/widgets/:id/config', (request, response, next) => {
    const origin = request.get('origin');
    if (origin && !allowedOrigins.includes(origin)) {
      return next(new HttpError(403, 'Origin not allowed'));
    }
    return next();
  }, createPublicWidgetController({ repository, allowedOrigins }));
  app.use('/api/submissions', (request, response, next) => {
    const origin = request.get('origin');
    if (origin && !allowedOrigins.includes(origin)) {
      return next(new HttpError(403, 'Origin not allowed'));
    }
    return next();
  }, createSubmissionsRouter({
    repository,
    geoService,
    notificationService,
    rateLimitMax,
    rateLimitWindowMs
  }));
  const requireOwner = createOwnerAuthenticator({
    expectedToken: ownerApiToken,
    tenantId: ownerTenantId,
    resolveTenant: resolveOwnerTenant
  });
  app.use('/api/widgets', createWidgetsRouter({
    repository,
    apiBaseUrl,
    requireOwner
  }));
  app.use('/api/dashboard', createDashboardRouter({
    repository,
    requireOwner
  }));
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
