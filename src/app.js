const cors = require('cors');
const express = require('express');
const { createSubmissionsRouter } = require('./routes/submissions.routes');
const { errorHandler, notFound } = require('./middleware/error-handler');
const { getClientIp } = require('./utils/client-ip');
const { HttpError } = require('./utils/http-error');

function createApp({
  repository,
  geoService,
  notificationService,
  allowedOrigins = ['http://localhost:5500'],
  rateLimitMax = 10,
  rateLimitWindowMs = 60000
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
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: false,
    maxAge: 600
  };

  app.use(cors(corsOptions));
  app.use(express.json({ limit: '16kb', strict: true }));
  app.get('/health', (request, response) => response.json({ success: true }));
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
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
