const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');

const tenantA = '22222222-2222-4222-8222-222222222222';
const tenantB = '33333333-3333-4333-8333-333333333333';
const tokenA = 'owner-token-for-tenant-a-long-enough';
const tokenB = 'owner-token-for-tenant-b-long-enough';
const widgetId = '11111111-1111-4111-8111-111111111111';
const origins = ['http://localhost:5500'];

function demoWidget(id = widgetId, tenantId = tenantA, overrides = {}) {
  return {
    id,
    tenant_id: tenantId,
    type: 'lead_capture',
    title: 'Contact us',
    description: 'Send us a message.',
    form_fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, max_length: 120 },
      { name: 'email', label: 'Email', type: 'email', required: true, max_length: 254 }
    ],
    button_text: 'Send',
    display_options: { theme: 'light' },
    allowed_origins: origins,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  };
}

function makeHarness() {
  const widgets = new Map([[widgetId, demoWidget()]]);
  const queryTenants = [];
  const repository = {
    async findWidget(id) {
      const widget = widgets.get(id);
      return widget && widget.enabled !== false && widget.deleted_at == null ? widget : null;
    },
    async createWidget(tenantId, data) {
      const id = `aaaaaaaa-aaaa-4aaa-8aaa-${String(widgets.size + 1).padStart(12, '0')}`;
      const row = demoWidget(id, tenantId, data);
      widgets.set(id, row);
      return row;
    },
    async listWidgets(tenantId) {
      queryTenants.push(tenantId);
      return [...widgets.values()].filter((widget) =>
        widget.tenant_id === tenantId && !widget.deleted_at
      );
    },
    async findWidgetForOwner(tenantId, id) {
      queryTenants.push(tenantId);
      const widget = widgets.get(id);
      return widget && widget.tenant_id === tenantId && !widget.deleted_at ? widget : null;
    },
    async updateWidget(tenantId, id, data) {
      queryTenants.push(tenantId);
      const widget = widgets.get(id);
      if (!widget || widget.tenant_id !== tenantId || widget.deleted_at) return null;
      Object.assign(widget, data, { updated_at: new Date().toISOString() });
      return widget;
    },
    async deleteWidget(tenantId, id) {
      queryTenants.push(tenantId);
      const widget = widgets.get(id);
      if (!widget || widget.tenant_id !== tenantId || widget.deleted_at) return false;
      widget.deleted_at = new Date().toISOString();
      widget.enabled = false;
      return true;
    },
    async listDashboardSubmissions(tenantId, filters) {
      queryTenants.push(tenantId);
      return {
        submissions: [{
          id: 'submission-a',
          widget_id: widgetId,
          form_data: { name: 'Ada' },
          visitor_ip: '192.0.2.1',
          geo: null,
          origin: origins[0],
          created_at: new Date().toISOString()
        }],
        total: 1,
        filters
      };
    },
    async getDashboardStats(tenantId, filters) {
      queryTenants.push(tenantId);
      return { total_submissions: 1, by_widget: [{ widget_id: widgetId, title: 'Contact us', submissions: 1 }], filters };
    },
    async createSubmission(submission) {
      return { id: 'submission-public', created_at: new Date().toISOString(), ...submission };
    }
  };

  const app = createApp({
    repository,
    geoService: { async enrich() { return null; } },
    notificationService: { async notify() {} },
    allowedOrigins: origins,
    apiBaseUrl: 'http://localhost:5000',
    resolveOwnerTenant(token) {
      if (token === tokenA) return tenantA;
      if (token === tokenB) return tenantB;
      return null;
    }
  });
  return { app, widgets, queryTenants };
}

function ownerRequest(app, method, path, token = tokenA) {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`);
}

const createBody = {
  type: 'lead_capture',
  title: 'Newsletter',
  description: 'Stay in touch.',
  form_fields: [
    { name: 'email', label: 'Email', type: 'email', required: true, max_length: 254 }
  ],
  button_text: 'Subscribe',
  display_options: { theme: 'light' },
  allowed_origins: origins
};

test('owner widget CRUD requires authentication and returns proper statuses', async () => {
  const { app } = makeHarness();
  assert.equal((await request(app).get('/api/widgets')).status, 401);
  assert.equal((await ownerRequest(app, 'post', '/api/widgets').send(createBody)).status, 201);

  const list = await ownerRequest(app, 'get', '/api/widgets');
  assert.equal(list.status, 200);
  assert.equal(list.body.widgets.length, 2);

  const createdId = list.body.widgets.find((widget) => widget.title === 'Newsletter').id;
  const get = await ownerRequest(app, 'get', `/api/widgets/${createdId}`);
  assert.equal(get.status, 200);

  const patch = await ownerRequest(app, 'patch', `/api/widgets/${createdId}`)
    .send({ title: 'Updated newsletter' });
  assert.equal(patch.status, 200);
  assert.equal(patch.body.widget.title, 'Updated newsletter');

  const removed = await ownerRequest(app, 'delete', `/api/widgets/${createdId}`);
  assert.equal(removed.status, 204);
  assert.equal((await ownerRequest(app, 'get', `/api/widgets/${createdId}`)).status, 404);
});

test('configured bearer credential resolves only its configured tenant', async () => {
  const { app } = makeHarness();
  const authenticatedApp = createApp({
    repository: {
      async findWidget() { return null; },
      async listWidgets(tenantId) { return [{ ...demoWidget(), tenant_id: tenantId }]; },
      async findWidgetForOwner(tenantId, id) {
        return tenantId === tenantA && id === widgetId ? demoWidget() : null;
      }
    },
    geoService: { async enrich() { return null; } },
    notificationService: { async notify() {} },
    allowedOrigins: origins,
    ownerApiToken: tokenA,
    ownerTenantId: tenantA
  });

  const valid = await request(authenticatedApp)
    .get('/api/widgets')
    .set('Authorization', `Bearer ${tokenA}`);
  assert.equal(valid.status, 200);
  assert.equal((await request(authenticatedApp).get('/api/widgets')
    .set('Authorization', `Bearer ${tokenB}`)).status, 401);
  assert.equal((await request(app).get('/api/widgets')
    .set('Authorization', 'Basic invalid')).status, 401);
});

test('widget CRUD isolates every operation to authenticated tenant', async () => {
  const { app, queryTenants } = makeHarness();
  assert.equal((await ownerRequest(app, 'get', `/api/widgets/${widgetId}`, tokenB)).status, 404);
  assert.equal((await ownerRequest(app, 'patch', `/api/widgets/${widgetId}`, tokenB)
    .send({ title: 'Hijacked' })).status, 404);
  assert.equal((await ownerRequest(app, 'delete', `/api/widgets/${widgetId}`, tokenB)).status, 404);
  assert.ok(queryTenants.every((tenantId) => tenantId === tenantA || tenantId === tenantB));
  assert.equal((await ownerRequest(app, 'get', `/api/widgets/${widgetId}`)).body.widget.title, 'Contact us');
});

test('widget create validation rejects unsafe fields and origins', async () => {
  const { app } = makeHarness();
  const invalid = await ownerRequest(app, 'post', '/api/widgets')
    .send({ ...createBody, allowed_origins: ['*'] });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.success, false);
});

test('creation response and embed endpoint provide the configured snippet and real widget ID', async () => {
  const { app } = makeHarness();
  const created = await ownerRequest(app, 'post', '/api/widgets').send(createBody);
  assert.equal(created.status, 201);
  assert.match(created.body.embed_snippet, new RegExp(created.body.widget.id));
  assert.match(created.body.embed_snippet, /^<script src="http:\/\/localhost:5000\/widget\.js\?id=/);

  const embed = await ownerRequest(app, 'get', `/api/widgets/${created.body.widget.id}/embed`);
  assert.equal(embed.body.widget_id, created.body.widget.id);
  assert.equal(embed.body.embed_snippet, created.body.embed_snippet);
});

test('public config is origin-checked and includes no tenant or private data', async () => {
  const { app } = makeHarness();
  const response = await request(app)
    .get(`/api/widgets/${widgetId}/config`)
    .set('Origin', origins[0]);
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.body).sort(), [
    'buttonText', 'description', 'displayOptions', 'fields', 'id', 'title', 'type'
  ]);
  assert.equal(response.body.fields[0].maxLength, 120);

  const blocked = await request(app)
    .get(`/api/widgets/${widgetId}/config`)
    .set('Origin', 'https://unapproved.example');
  assert.equal(blocked.status, 403);
});

test('embed script is served as JavaScript', async () => {
  const { app } = makeHarness();
  const response = await request(app).get('/widget.js');
  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /javascript/);
  assert.match(response.text, /api\/widgets/);
  assert.match(response.text, /api\/submissions/);
});

test('dashboard endpoints require auth and scope queries to authenticated tenant', async () => {
  const { app, queryTenants } = makeHarness();
  assert.equal((await request(app).get('/api/dashboard/stats')).status, 401);

  const submissions = await ownerRequest(app, 'get', '/api/dashboard/submissions');
  assert.equal(submissions.status, 200);
  assert.equal(submissions.body.submissions.length, 1);
  const stats = await ownerRequest(app, 'get', '/api/dashboard/stats');
  assert.equal(stats.status, 200);
  assert.equal(stats.body.total_submissions, 1);
  assert.deepEqual(queryTenants, [tenantA, tenantA]);

  const invalidRange = await ownerRequest(app, 'get', '/api/dashboard/stats')
    .query({ from: '2020-01-01T00:00:00.000Z', to: '2021-01-01T00:00:00.000Z' });
  assert.equal(invalidRange.status, 400);
});
