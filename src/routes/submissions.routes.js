const express = require('express');
const { createSubmissionsController } = require('../controllers/submissions.controller');
const { rejectHoneypot } = require('../middleware/honeypot');
const { createSubmissionRateLimiter } = require('../middleware/rate-limit');
const { validateSubmission } = require('../middleware/submission-validation');

function createSubmissionsRouter({
  repository,
  geoService,
  notificationService,
  rateLimitMax,
  rateLimitWindowMs
}) {
  const router = express.Router();
  const rateLimit = createSubmissionRateLimiter({
    maxRequests: rateLimitMax,
    windowMs: rateLimitWindowMs
  });
  const submit = createSubmissionsController({ repository, geoService, notificationService });

  router.post(
    '/',
    (request, response, next) => {
      request.clientIp = request.app.locals.getClientIp(request);
      request.allowedOrigins = request.app.locals.allowedOrigins;
      next();
    },
    validateSubmission,
    rateLimit,
    rejectHoneypot,
    submit
  );

  return router;
}

module.exports = { createSubmissionsRouter };
