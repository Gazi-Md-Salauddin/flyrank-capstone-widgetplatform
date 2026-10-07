const express = require('express');
const { createDashboardController } = require('../controllers/dashboard.controller');

function createDashboardRouter({ repository, requireOwner }) {
  const router = express.Router();
  const controller = createDashboardController({ repository });

  router.use(requireOwner);
  router.get('/submissions', controller.submissions);
  router.get('/stats', controller.stats);
  return router;
}

module.exports = { createDashboardRouter };
