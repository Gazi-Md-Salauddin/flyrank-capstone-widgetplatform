CREATE TABLE IF NOT EXISTS widgets (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    form_fields jsonb NOT NULL CHECK (jsonb_typeof(form_fields) = 'array'),
    allowed_origins text[] NOT NULL DEFAULT '{}',
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS widgets_tenant_id_idx ON widgets (tenant_id);

CREATE TABLE IF NOT EXISTS submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    widget_id uuid NOT NULL REFERENCES widgets (id),
    tenant_id uuid NOT NULL,
    form_data jsonb NOT NULL CHECK (jsonb_typeof(form_data) = 'object'),
    visitor_ip inet,
    geo jsonb,
    origin text,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS submissions_tenant_id_idx ON submissions (tenant_id);
CREATE INDEX IF NOT EXISTS submissions_widget_id_idx ON submissions (widget_id);
CREATE INDEX IF NOT EXISTS submissions_created_at_idx ON submissions (created_at DESC);
CREATE INDEX IF NOT EXISTS submissions_tenant_widget_created_idx
    ON submissions (tenant_id, widget_id, created_at DESC);

INSERT INTO widgets (id, tenant_id, form_fields, allowed_origins)
VALUES (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '[
      {"name":"name","type":"text","required":true,"max_length":120},
      {"name":"email","type":"email","required":true,"max_length":254},
      {"name":"message","type":"text","required":false,"max_length":1500}
    ]'::jsonb,
    ARRAY['http://localhost:5500']
)
ON CONFLICT (id) DO NOTHING;
