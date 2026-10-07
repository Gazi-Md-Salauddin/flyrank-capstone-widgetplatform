const express = require('express');
const { createWidgetsController } = require('../controllers/widgets.controller');

function createWidgetsRouter({ repository, apiBaseUrl, requireOwner }) {
  const router = express.Router();
  const controller = createWidgetsController({ repository, apiBaseUrl });

  router.use(requireOwner);
  router.post('/', controller.create);
  router.get('/', controller.list);
  router.get('/:id/embed', controller.embed);
  router.get('/:id', controller.get);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);
  return router;
}

module.exports = { createWidgetsRouter };
