const { z } = require('zod');

const fieldSchema = z.object({
  name: z.string().min(1).max(40).regex(/^[a-zA-Z0-9_-]+$/),
  label: z.string().min(1).max(80),
  type: z.enum(['text', 'email', 'textarea']),
  required: z.boolean(),
  max_length: z.number().int().min(1).max(1500)
}).strict();

const displayOptionsSchema = z.object({
  theme: z.enum(['light', 'dark']).default('light')
}).strict();

const originsSchema = z.array(z.string().url()).max(10).refine((origins) =>
  origins.every((origin) => {
    try {
      const parsed = new URL(origin);
      return parsed.origin === origin && !parsed.username && !parsed.password;
    } catch {
      return false;
    }
  })
).refine((origins) => new Set(origins).size === origins.length);

const widgetFields = {
  type: z.literal('lead_capture').default('lead_capture'),
  title: z.string().trim().min(1).max(120),
  description: z.string().max(500).default(''),
  form_fields: z.array(fieldSchema).min(1).max(8)
    .refine((fields) => new Set(fields.map((field) => field.name)).size === fields.length),
  button_text: z.string().trim().min(1).max(50).default('Submit'),
  display_options: displayOptionsSchema.default({ theme: 'light' }),
  allowed_origins: originsSchema
};

const createWidgetSchema = z.object(widgetFields).strict();
const updateWidgetSchema = z.object(widgetFields).partial().strict()
  .refine((body) => Object.keys(body).length > 0);
const widgetIdSchema = z.string().uuid();

module.exports = { createWidgetSchema, updateWidgetSchema, widgetIdSchema };
