const { HttpError } = require('../utils/http-error');

function rejectHoneypot(request, response, next) {
  if (request.submissionInput.website_url && request.submissionInput.website_url.trim()) {
    return next(new HttpError(400, 'Invalid submission'));
  }
  return next();
}

module.exports = { rejectHoneypot };
