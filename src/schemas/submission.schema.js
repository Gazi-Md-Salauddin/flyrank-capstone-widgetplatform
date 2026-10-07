const { z } = require('zod');

const submissionSchema = z.object({
  widget_id: z.string().uuid(),
  form_data: z.record(
    z.string().min(1).max(40).regex(/^[a-zA-Z0-9_-]+$/),
    z.string().max(1500)
  ).refine((formData) => Object.keys(formData).length <= 8),
  website_url: z.string().max(500).optional()
}).strict();

module.exports = { submissionSchema };
