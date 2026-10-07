const { submissionSchema } = require('../schemas/submission.schema');
const { HttpError } = require('../utils/http-error');

function validateSubmission(request, response, next) {
  const result = submissionSchema.safeParse(request.body);
  if (!result.success) {
    return next(new HttpError(400, 'Invalid submission'));
  }

  request.submissionInput = result.data;
  return next();
}

module.exports = { validateSubmission };
