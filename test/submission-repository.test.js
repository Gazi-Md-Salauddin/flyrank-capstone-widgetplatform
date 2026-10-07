const test = require('node:test');
const assert = require('node:assert/strict');
const { createSubmissionRepository } = require('../src/db/submission-repository');

function createQueryPool(handler) {
  const calls = [];
  return {
    calls,
    async query(sql, values) {
      calls.push({ sql, values });
      return handler(sql, values);
    }
  };
}

test('submission persistence awaits a parameterized PostgreSQL insert with design fields', async () => {
  const inserted = {
    id: 'submission-id',
    widget_id: 'widget-id',
    created_at: '2026-10-07T00:00:00.000Z'
  };
  const pool = createQueryPool(async () => ({ rows: [inserted] }));
  const repository = createSubmissionRepository(pool);
  const result = await repository.createSubmission({
    widgetId: 'widget-id',
    tenantId: 'tenant-id',
    formData: { name: 'Visitor' },
    visitorIp: '192.0.2.1',
    geo: { country_code: 'EX' },
    origin: 'http://localhost:5500',
    userAgent: 'test browser'
  });

  assert.deepEqual(result, inserted);
  assert.match(pool.calls[0].sql, /INSERT INTO submissions/);
  assert.match(pool.calls[0].sql, /RETURNING id, widget_id, created_at/);
  assert.deepEqual(pool.calls[0].values, [
    'widget-id',
    'tenant-id',
    '{"name":"Visitor"}',
    '192.0.2.1',
    '{"country_code":"EX"}',
    'http://localhost:5500',
    'test browser'
  ]);
});

test('dashboard repository scopes submissions and totals to tenant and date range', async () => {
  const pool = createQueryPool(async (sql) => {
    if (/SELECT count\(\*\)/.test(sql)) return { rows: [{ total: 3 }] };
    return { rows: [{ id: 'tenant-row' }] };
  });
  const repository = createSubmissionRepository(pool);
  const from = new Date('2026-10-01T00:00:00.000Z');
  const to = new Date('2026-10-08T00:00:00.000Z');
  const result = await repository.listDashboardSubmissions('tenant-a', {
    from, to, widgetId: 'widget-a', limit: 10, offset: 20
  });

  assert.equal(result.total, 3);
  assert.equal(pool.calls.length, 2);
  for (const call of pool.calls) {
    assert.match(call.sql, /tenant_id = \$1/);
    assert.match(call.sql, /created_at >= \$2 AND created_at < \$3/);
    assert.match(call.sql, /widget_id = \$4/);
    assert.deepEqual(call.values.slice(0, 4), ['tenant-a', from, to, 'widget-a']);
  }
});

test('dashboard stats query includes tenant-scoped widget and geo aggregates', async () => {
  const pool = createQueryPool(async (sql) => {
    if (/geo IS NOT NULL/.test(sql)) {
      return { rows: [{ country_code: 'EX', country: 'Exampleland', submissions: 2 }] };
    }
    return { rows: [{ widget_id: 'widget-a', title: 'Contact', submissions: 2 }] };
  });
  const repository = createSubmissionRepository(pool);
  const result = await repository.getDashboardStats('tenant-a', {
    from: new Date('2026-10-01T00:00:00.000Z'),
    to: new Date('2026-10-08T00:00:00.000Z'),
    widgetId: 'widget-a'
  });

  assert.equal(result.total_submissions, 2);
  assert.deepEqual(result.by_widget, [
    { widget_id: 'widget-a', title: 'Contact', submissions: 2 }
  ]);
  assert.deepEqual(result.geo_breakdown, [
    { country_code: 'EX', country: 'Exampleland', submissions: 2 }
  ]);
  for (const call of pool.calls) {
    assert.match(call.sql, /tenant_id = \$1/);
    assert.match(call.sql, /widget_id = \$4/);
    assert.deepEqual(call.values, [
      'tenant-a',
      new Date('2026-10-01T00:00:00.000Z'),
      new Date('2026-10-08T00:00:00.000Z'),
      'widget-a'
    ]);
  }
});
