function createSubmissionRepository(pool) {
  return {
    async findWidget(widgetId) {
      const result = await pool.query(
        `SELECT id, tenant_id, form_fields, allowed_origins
         FROM widgets
         WHERE id = $1 AND enabled = true`,
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
    }
  };
}

module.exports = { createSubmissionRepository };
