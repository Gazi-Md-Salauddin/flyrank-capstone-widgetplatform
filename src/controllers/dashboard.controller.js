const { z } = require('zod');
const { HttpError } = require('../utils/http-error');

const querySchema = z.object({
  widget_id: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(100000).default(0)
}).strict();

function parseFilters(query) {
  const parsed = querySchema.safeParse(query);
  if (!parsed.success) throw new HttpError(400, 'Invalid dashboard filters');

  const now = new Date();
  const to = parsed.data.to ? new Date(parsed.data.to) : now;
  const from = parsed.data.from
    ? new Date(parsed.data.from)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (from >= to || to.getTime() - from.getTime() > 90 * 24 * 60 * 60 * 1000) {
    throw new HttpError(400, 'Date range must be positive and no longer than 90 days');
  }

  return {
    widgetId: parsed.data.widget_id,
    from,
    to,
    limit: parsed.data.limit,
    offset: parsed.data.offset
  };
}

function createDashboardController({ repository }) {
  return {
    async submissions(request, response, next) {
      try {
        const result = await repository.listDashboardSubmissions(
          request.ownerTenantId,
          parseFilters(request.query)
        );
        return response.json({
          success: true,
          submissions: result.submissions,
          pagination: {
            total: result.total,
            limit: Number(request.query.limit) || 25,
            offset: Number(request.query.offset) || 0
          }
        });
      } catch (error) {
        return next(error);
      }
    },

    async stats(request, response, next) {
      try {
        const filters = parseFilters(request.query);
        const stats = await repository.getDashboardStats(request.ownerTenantId, filters);
        return response.json({
          success: true,
          from: filters.from.toISOString(),
          to: filters.to.toISOString(),
          ...stats
        });
      } catch (error) {
        return next(error);
      }
    }
  };
}

module.exports = { createDashboardController };
