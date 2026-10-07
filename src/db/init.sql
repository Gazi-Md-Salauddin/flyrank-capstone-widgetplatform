CREATE TABLE IF NOT EXISTS widgets (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    type text NOT NULL DEFAULT 'lead_capture',
    title text NOT NULL DEFAULT '',
    description text NOT NULL DEFAULT '',
    form_fields jsonb NOT NULL CHECK (jsonb_typeof(form_fields) = 'array'),
    button_text text NOT NULL DEFAULT 'Submit',
    display_options jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(display_options) = 'object'),
    allowed_origins text[] NOT NULL DEFAULT '{}',
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

ALTER TABLE widgets ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'lead_capture';
ALTER TABLE widgets ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';
ALTER TABLE widgets ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE widgets ADD COLUMN IF NOT EXISTS button_text text NOT NULL DEFAULT 'Submit';
ALTER TABLE widgets ADD COLUMN IF NOT EXISTS display_options jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE widgets ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE widgets ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

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

INSERT INTO widgets (
    id, tenant_id, type, title, description, form_fields, button_text, display_options, allowed_origins
)
VALUES (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    'lead_capture',
    'Contact us',
    'Send us a message and we will get back to you.',
    '[
      {"name":"name","label":"Name","type":"text","required":true,"max_length":120},
      {"name":"email","label":"Email","type":"email","required":true,"max_length":254},
      {"name":"message","label":"Message","type":"textarea","required":false,"max_length":1500}
    ]'::jsonb,
    'Send',
    '{"theme":"light"}'::jsonb,
    ARRAY['http://localhost:5500']
)
ON CONFLICT (id) DO NOTHING;

UPDATE widgets
SET type = 'lead_capture',
    title = 'Contact us',
    description = 'Send us a message and we will get back to you.',
    form_fields = '[
      {"name":"name","label":"Name","type":"text","required":true,"max_length":120},
      {"name":"email","label":"Email","type":"email","required":true,"max_length":254},
      {"name":"message","label":"Message","type":"textarea","required":false,"max_length":1500}
    ]'::jsonb,
    button_text = 'Send',
    display_options = '{"theme":"light"}'::jsonb,
    allowed_origins = ARRAY['http://localhost:5500']
WHERE id = '11111111-1111-4111-8111-111111111111'
  AND title = '';
