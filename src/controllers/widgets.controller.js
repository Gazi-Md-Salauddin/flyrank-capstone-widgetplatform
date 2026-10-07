const { createWidgetSchema, updateWidgetSchema, widgetIdSchema } = require('../schemas/widget.schema');
const { HttpError } = require('../utils/http-error');

function asWidget(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    form_fields: row.form_fields,
    button_text: row.button_text,
    display_options: row.display_options,
    allowed_origins: row.allowed_origins,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function parseWidgetId(value) {
  const result = widgetIdSchema.safeParse(value);
  if (!result.success) throw new HttpError(404, 'Widget not found');
  return result.data;
}

function createWidgetsController({ repository, apiBaseUrl }) {
  return {
    async create(request, response, next) {
      try {
        const parsed = createWidgetSchema.safeParse(request.body);
        if (!parsed.success) throw new HttpError(400, 'Invalid widget');
        const widget = await repository.createWidget(request.ownerTenantId, parsed.data);
        const embedSnippet = `<script src="${apiBaseUrl}/widget.js?id=${encodeURIComponent(widget.id)}" defer></script>`;
        return response.status(201).json({
          success: true,
          widget: asWidget(widget),
          embed_snippet: embedSnippet
        });
      } catch (error) {
        return next(error);
      }
    },

    async list(request, response, next) {
      try {
        const widgets = await repository.listWidgets(request.ownerTenantId);
        return response.json({ success: true, widgets: widgets.map(asWidget) });
      } catch (error) {
        return next(error);
      }
    },

    async get(request, response, next) {
      try {
        const widget = await repository.findWidgetForOwner(
          request.ownerTenantId,
          parseWidgetId(request.params.id)
        );
        if (!widget) throw new HttpError(404, 'Widget not found');
        return response.json({ success: true, widget: asWidget(widget) });
      } catch (error) {
        return next(error);
      }
    },

    async update(request, response, next) {
      try {
        const parsed = updateWidgetSchema.safeParse(request.body);
        if (!parsed.success) throw new HttpError(400, 'Invalid widget');
        const widget = await repository.updateWidget(
          request.ownerTenantId,
          parseWidgetId(request.params.id),
          parsed.data
        );
        if (!widget) throw new HttpError(404, 'Widget not found');
        return response.json({ success: true, widget: asWidget(widget) });
      } catch (error) {
        return next(error);
      }
    },

    async remove(request, response, next) {
      try {
        const removed = await repository.deleteWidget(
          request.ownerTenantId,
          parseWidgetId(request.params.id)
        );
        if (!removed) throw new HttpError(404, 'Widget not found');
        return response.status(204).end();
      } catch (error) {
        return next(error);
      }
    },

    async embed(request, response, next) {
      try {
        const widget = await repository.findWidgetForOwner(
          request.ownerTenantId,
          parseWidgetId(request.params.id)
        );
        if (!widget) throw new HttpError(404, 'Widget not found');
        return response.json({
          widget_id: widget.id,
          embed_snippet: `<script src="${apiBaseUrl}/widget.js?id=${encodeURIComponent(widget.id)}" defer></script>`
        });
      } catch (error) {
        return next(error);
      }
    }
  };
}

module.exports = { createWidgetsController };
