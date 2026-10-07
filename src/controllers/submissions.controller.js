const { HttpError } = require('../utils/http-error');

function validateAgainstWidget(formData, fields) {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error('Widget form configuration is unavailable');
  }

  const allowedFields = new Map(fields.map((field) => [field.name, field]));
  const keys = Object.keys(formData);

  if (keys.some((key) => !allowedFields.has(key))) return false;

  for (const field of fields) {
    const value = formData[field.name];
    if (field.required && (typeof value !== 'string' || value.trim().length === 0)) {
      return false;
    }
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.length > field.max_length) return false;
    if (field.type === 'email' && value.length > 0
      && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return false;
  }

  return true;
}

function createSubmissionsController({ repository, geoService, notificationService }) {
  return async function submit(request, response, next) {
    try {
      const input = request.submissionInput;
      const widget = await repository.findWidget(input.widget_id);
      if (!widget) throw new HttpError(404, 'Widget not found');

      const origin = request.get('origin') || null;
      if (origin && (!widget.allowed_origins.includes(origin)
        || !request.allowedOrigins.includes(origin))) {
        throw new HttpError(403, 'Origin not allowed');
      }
      if (!validateAgainstWidget(input.form_data, widget.form_fields)) {
        throw new HttpError(400, 'Invalid submission');
      }

      let geo = null;
      try {
        geo = await geoService.enrich(request.clientIp);
      } catch {
        console.warn('[geo] Enrichment service failed; continuing without geo data');
      }
      const saved = await repository.createSubmission({
        widgetId: widget.id,
        tenantId: widget.tenant_id,
        formData: input.form_data,
        visitorIp: request.clientIp,
        geo,
        origin,
        userAgent: request.get('user-agent')?.slice(0, 1000) || null
      });

      try {
        await notificationService.notify(saved);
      } catch {
        console.warn('[notification] Side effect failed after submission storage');
      }

      return response.status(201).json({
        success: true,
        message: 'Submission received',
        submission: {
          id: saved.id,
          created_at: saved.created_at
        }
      });
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = { createSubmissionsController, validateAgainstWidget };
