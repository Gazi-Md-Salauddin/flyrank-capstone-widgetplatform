const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');
const { createGeoEnrichmentService } = require('../src/services/geo-enrichment.service');

const widget = {
  id: '11111111-1111-4111-8111-111111111111',
  tenant_id: '22222222-2222-4222-8222-222222222222',
  form_fields: [
    { name: 'name', type: 'text', required: true, max_length: 120 },
    { name: 'email', type: 'email', required: true, max_length: 254 },
    { name: 'message', type: 'text', required: false, max_length: 1500 }
  ],
  allowed_origins: ['http://localhost:5500']
};

function makeHarness(options = {}) {
  const saved = [];
  const repository = {
    async findWidget(id) {
      return id === widget.id ? widget : null;
    },
    async createSubmission(submission) {
      const row = {
        id: `submission-${saved.length + 1}`,
        widget_id: submission.widgetId,
        created_at: new Date().toISOString(),
        ...submission
      };
      saved.push(row);
      return row;
    }
  };
  const app = createApp({
    repository,
    geoService: options.geoService || { async enrich() { return null; } },
    notificationService: options.notificationService || { async notify() {} },
    allowedOrigins: ['http://localhost:5500'],
    rateLimitMax: options.rateLimitMax || 10,
    rateLimitWindowMs: options.rateLimitWindowMs || 60000
  });
  return { app, saved };
}

function validPayload(overrides = {}) {
  return {
    widget_id: widget.id,
    form_data: { name: 'A Visitor', email: 'visitor@example.test', message: 'Hello' },
    ...overrides
  };
}

test('valid cross-origin submission is stored and returns a receipt', async () => {
  const { app, saved } = makeHarness({
    geoService: { async enrich() { return { country: 'Exampleland', country_code: 'EX' }; } }
  });
  const response = await request(app)
    .post('/api/submissions')
    .set('Origin', 'http://localhost:5500')
    .set('X-Forwarded-For', '203.0.113.77')
    .send(validPayload());

  assert.equal(response.status, 201);
  assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:5500');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].tenantId, widget.tenant_id);
  assert.equal(saved[0].formData.name, 'A Visitor');
  assert.deepEqual(saved[0].geo, { country: 'Exampleland', country_code: 'EX' });
  assert.ok(saved[0].visitorIp);
  assert.notEqual(saved[0].visitorIp, '203.0.113.77');
});

test('OPTIONS preflight returns the configured cross-origin policy', async () => {
  const { app } = makeHarness();
  const response = await request(app)
    .options('/api/submissions')
    .set('Origin', 'http://localhost:5500')
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'content-type');

  assert.equal(response.status, 204);
  assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:5500');
  assert.match(response.headers['access-control-allow-methods'], /POST/);
  assert.equal(response.headers['access-control-allow-credentials'], undefined);
});

test('invalid payload and configured-field violations return 4xx without storage', async () => {
  const { app, saved } = makeHarness();
  const malformed = await request(app).post('/api/submissions').send({ widget_id: 'bad' });
  const missingRequired = await request(app)
    .post('/api/submissions')
    .send(validPayload({ form_data: { name: '', email: 'invalid' } }));

  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.success, false);
  assert.equal(missingRequired.status, 400);
  assert.equal(saved.length, 0);
});

test('oversized JSON payload returns 413 without storage', async () => {
  const { app, saved } = makeHarness();
  const response = await request(app)
    .post('/api/submissions')
    .set('Content-Type', 'application/json')
    .send(JSON.stringify(validPayload({ form_data: { name: 'x'.repeat(17000) } })));

  assert.equal(response.status, 413);
  assert.equal(response.body.success, false);
  assert.equal(saved.length, 0);
});

test('submission rate limit returns 429 and resets for normal requests', async () => {
  const { app, saved } = makeHarness({ rateLimitMax: 2, rateLimitWindowMs: 1000 });
  const send = () => request(app).post('/api/submissions').send(validPayload());
  assert.equal((await send()).status, 201);
  assert.equal((await send()).status, 201);
  const blocked = await send();
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers['retry-after']) >= 1);

  await new Promise((resolve) => setTimeout(resolve, 1050));
  assert.equal((await send()).status, 201);
  assert.equal(saved.length, 3);
});

test('honeypot submission is rejected and not stored', async () => {
  const { app, saved } = makeHarness();
  const response = await request(app)
    .post('/api/submissions')
    .send(validPayload({ website_url: 'https://bot-filled-this.test' }));

  assert.equal(response.status, 400);
  assert.equal(saved.length, 0);
});

test('disallowed origins are rejected', async () => {
  const { app, saved } = makeHarness();
  const response = await request(app)
    .post('/api/submissions')
    .set('Origin', 'https://unapproved.example')
    .send(validPayload());

  assert.equal(response.status, 403);
  assert.equal(saved.length, 0);
});

test('unknown widget returns 404 without storing', async () => {
  const { app, saved } = makeHarness();
  const response = await request(app)
    .post('/api/submissions')
    .send(validPayload({ widget_id: '33333333-3333-4333-8333-333333333333' }));

  assert.equal(response.status, 404);
  assert.equal(saved.length, 0);
});

test('database failure returns a sanitized 500 response', async () => {
  const originalRepository = {
    async findWidget() { return widget; },
    async createSubmission() { throw new Error('database password should not be exposed'); }
  };
  const failingApp = createApp({
    repository: originalRepository,
    geoService: { async enrich() { return null; } },
    notificationService: { async notify() {} },
    allowedOrigins: ['http://localhost:5500']
  });
  const response = await request(failingApp).post('/api/submissions').send(validPayload());

  assert.equal(response.status, 500);
  assert.equal(response.body.message, 'Unable to process request');
  assert.doesNotMatch(JSON.stringify(response.body), /password|database/i);
});

test('malformed JSON returns a clean 400 response', async () => {
  const { app } = makeHarness();
  const response = await request(app)
    .post('/api/submissions')
    .set('Content-Type', 'application/json')
    .send('{"widget_id":');

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { success: false, message: 'Invalid JSON' });
});

test('Provider A result is used when available', async () => {
  const service = createGeoEnrichmentService({ providerAMode: 'mock', providerBMode: 'fail' });
  const result = await service.enrich('8.8.8.8');
  assert.equal(result.provider, 'ip-api.com');
});

test('Provider A failure falls back to Provider B', async () => {
  const service = createGeoEnrichmentService({ providerAMode: 'fail', providerBMode: 'mock' });
  const result = await service.enrich('8.8.8.8');
  assert.equal(result.provider, 'ipapi.co');
});

test('both geo providers failing does not block storage', async () => {
  const geoService = createGeoEnrichmentService({ providerAMode: 'fail', providerBMode: 'fail' });
  const { app, saved } = makeHarness({ geoService });
  const response = await request(app).post('/api/submissions').send(validPayload());

  assert.equal(response.status, 201);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].geo, null);
});

test('notification failure after storage still returns success', async () => {
  const { app, saved } = makeHarness({
    notificationService: { async notify() { throw new Error('simulated'); } }
  });
  const response = await request(app).post('/api/submissions').send(validPayload());

  assert.equal(response.status, 201);
  assert.equal(saved.length, 1);
});

test('unexpected geolocation service failure is non-critical', async () => {
  const { app, saved } = makeHarness({
    geoService: { async enrich() { throw new Error('simulated'); } }
  });
  const response = await request(app).post('/api/submissions').send(validPayload());

  assert.equal(response.status, 201);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].geo, null);
});
