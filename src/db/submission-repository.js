function createSubmissionRepository(pool) {
  return {
    async findWidget(widgetId) {
      const result = await pool.query(
        `SELECT id, tenant_id, type, title, description, form_fields, button_text,
                display_options, allowed_origins
         FROM widgets
         WHERE id = $1 AND enabled = true AND deleted_at IS NULL`,
        [widgetId]
      );
      return result.rows[0] || null;
    },

    async createSubmission(submission) {
      const result = await pool.query(
        `INSERT INTO submissions
           (widget_id, tenant_id, form_data, visitor_ip, geo, origin, user_agent)
         VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6, $7)
         RETURNING id, widget_id, created_at`,
        [
          submission.widgetId,
          submission.tenantId,
          JSON.stringify(submission.formData),
          submission.visitorIp,
          submission.geo === null ? null : JSON.stringify(submission.geo),
          submission.origin,
          submission.userAgent
        ]
      );
      return result.rows[0];
    },

    async createWidget(tenantId, widget) {
      const result = await pool.query(
        `INSERT INTO widgets
           (id, tenant_id, type, title, description, form_fields, button_text,
            display_options, allowed_origins)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8)
         RETURNING *`,
        [
          tenantId,
          widget.type,
          widget.title,
          widget.description,
          JSON.stringify(widget.form_fields),
          widget.button_text,
          JSON.stringify(widget.display_options),
          widget.allowed_origins
        ]
      );
      return result.rows[0];
    },

    async listWidgets(tenantId) {
      const result = await pool.query(
        `SELECT * FROM widgets
         WHERE tenant_id = $1 AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        [tenantId]
      );
      return result.rows;
    },

    async findWidgetForOwner(tenantId, widgetId) {
      const result = await pool.query(
        `SELECT * FROM widgets
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [tenantId, widgetId]
      );
      return result.rows[0] || null;
    },

    async updateWidget(tenantId, widgetId, widget) {
      const columns = {
        type: 'type',
        title: 'title',
        description: 'description',
        form_fields: 'form_fields',
        button_text: 'button_text',
        display_options: 'display_options',
        allowed_origins: 'allowed_origins'
      };
      const assignments = [];
      const values = [tenantId, widgetId];

      for (const [key, column] of Object.entries(columns)) {
        if (widget[key] === undefined) continue;
        values.push(['form_fields', 'display_options'].includes(key)
          ? JSON.stringify(widget[key])
          : widget[key]);
        assignments.push(`${column} = $${values.length}${['form_fields', 'display_options'].includes(key) ? '::jsonb' : ''}`);
      }
      assignments.push('updated_at = now()');

      const result = await pool.query(
        `UPDATE widgets SET ${assignments.join(', ')}
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
         RETURNING *`,
        values
      );
      return result.rows[0] || null;
    },

    async deleteWidget(tenantId, widgetId) {
      const result = await pool.query(
        `UPDATE widgets
         SET deleted_at = now(), enabled = false, updated_at = now()
         WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
         RETURNING id`,
        [tenantId, widgetId]
      );
      return result.rowCount > 0;
    },

    async listDashboardSubmissions(tenantId, filters) {
      const values = [tenantId, filters.from, filters.to];
      let widgetFilter = '';
      if (filters.widgetId) {
        values.push(filters.widgetId);
        widgetFilter = ` AND widget_id = $${values.length}`;
      }
      values.push(filters.limit, filters.offset);

      const submissions = await pool.query(
        `SELECT id, widget_id, form_data, visitor_ip, geo, origin, created_at
         FROM submissions
         WHERE tenant_id = $1 AND created_at >= $2 AND created_at < $3${widgetFilter}
         ORDER BY created_at DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values
      );
      const countValues = values.slice(0, filters.widgetId ? 4 : 3);
      const count = await pool.query(
        `SELECT count(*)::int AS total
         FROM submissions
         WHERE tenant_id = $1 AND created_at >= $2 AND created_at < $3${widgetFilter}`,
        countValues
      );

      return { submissions: submissions.rows, total: count.rows[0].total };
    },

    async getDashboardStats(tenantId, filters) {
      const values = [tenantId, filters.from, filters.to];
      let widgetFilter = '';
      if (filters.widgetId) {
        values.push(filters.widgetId);
        widgetFilter = ` AND s.widget_id = $${values.length}`;
      }

      const result = await pool.query(
        `SELECT s.widget_id, w.title, count(*)::int AS submissions
         FROM submissions s
         JOIN widgets w ON w.id = s.widget_id AND w.tenant_id = s.tenant_id
         WHERE s.tenant_id = $1 AND s.created_at >= $2 AND s.created_at < $3${widgetFilter}
         GROUP BY s.widget_id, w.title
         ORDER BY submissions DESC`,
        values
      );
      return {
        total_submissions: result.rows.reduce((total, row) => total + row.submissions, 0),
        by_widget: result.rows
      };
    }
  };
}

module.exports = { createSubmissionRepository };
