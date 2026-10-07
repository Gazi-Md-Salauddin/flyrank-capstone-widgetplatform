const { HttpError } = require('../utils/http-error');

function notFound(request, response, next) {
  next(new HttpError(404, 'Not found'));
}

function errorHandler(error, request, response, next) {
  if (response.headersSent) return next(error);

  if (error && error.type === 'entity.too.large') {
    return response.status(413).json({ success: false, message: 'Request payload is too large' });
  }
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return response.status(400).json({ success: false, message: 'Invalid JSON' });
  }
  if (error instanceof HttpError) {
    return response.status(error.status).json({ success: false, message: error.message });
  }

  console.error('[api] Internal request error');
  return response.status(500).json({ success: false, message: 'Unable to process request' });
}

module.exports = { errorHandler, notFound };
