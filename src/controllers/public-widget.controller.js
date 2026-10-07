const { widgetIdSchema } = require('../schemas/widget.schema');
const { HttpError } = require('../utils/http-error');

function createPublicWidgetController({ repository, allowedOrigins }) {
  return async function getConfig(request, response, next) {
    try {
      const parsedId = widgetIdSchema.safeParse(request.params.id);
      if (!parsedId.success) throw new HttpError(404, 'Widget not found');

      const widget = await repository.findWidget(parsedId.data);
      if (!widget) throw new HttpError(404, 'Widget not found');

      const origin = request.get('origin');
      if (origin && (!allowedOrigins.includes(origin) || !widget.allowed_origins.includes(origin))) {
        throw new HttpError(403, 'Origin not allowed');
      }

      return response.json({
        id: widget.id,
        type: widget.type,
        title: widget.title,
        description: widget.description,
        fields: widget.form_fields.map((field) => ({
          name: field.name,
          label: field.label,
          type: field.type,
          required: field.required,
          maxLength: field.max_length
        })),
        buttonText: widget.button_text,
        displayOptions: widget.display_options
      });
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = { createPublicWidgetController };
