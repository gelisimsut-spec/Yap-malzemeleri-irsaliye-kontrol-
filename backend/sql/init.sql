CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  role_id INT REFERENCES roles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  whatsapp_recipients TEXT[] DEFAULT ARRAY[]::TEXT[],
  carrier_unmatched_minutes INT DEFAULT 30,
  supplier_unmatched_minutes INT DEFAULT 30,
  quantity_tolerance NUMERIC(10,2) DEFAULT 0.5,
  percentage_tolerance NUMERIC(5,2) DEFAULT 2.0,
  notify_cooldown_hours INT DEFAULT 4,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('depo','musteri')),
  address TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  plate TEXT UNIQUE NOT NULL,
  driver_name TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS carrier_docs (
  id SERIAL PRIMARY KEY,
  doc_datetime TIMESTAMPTZ NOT NULL,
  location_id INT REFERENCES locations(id),
  quantity_value NUMERIC(10,2) NOT NULL,
  quantity_unit TEXT NOT NULL CHECK (quantity_unit IN ('ton','m3')),
  plate TEXT,
  driver_name TEXT,
  serial_no TEXT,
  status TEXT DEFAULT 'unmatched' CHECK (status IN ('matched','needs_review','unmatched')),
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_notified_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS supplier_docs (
  id SERIAL PRIMARY KEY,
  doc_datetime TIMESTAMPTZ NOT NULL,
  location_id INT REFERENCES locations(id),
  quantity_value NUMERIC(10,2) NOT NULL,
  quantity_unit TEXT NOT NULL CHECK (quantity_unit IN ('ton','m3')),
  serial_no TEXT,
  status TEXT DEFAULT 'unmatched' CHECK (status IN ('matched','needs_review','unmatched')),
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_notified_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  carrier_doc_id INT UNIQUE REFERENCES carrier_docs(id),
  supplier_doc_id INT UNIQUE REFERENCES supplier_docs(id),
  status TEXT NOT NULL CHECK (status IN ('matched','needs_review','rejected')),
  confidence_score NUMERIC(5,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attachments (
  id SERIAL PRIMARY KEY,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('carrier','supplier')),
  doc_id INT NOT NULL,
  file_path TEXT NOT NULL,
  mime TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id SERIAL PRIMARY KEY,
  status TEXT NOT NULL,
  qr_text TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_outbox (
  id SERIAL PRIMARY KEY,
  to_number TEXT NOT NULL,
  message TEXT NOT NULL,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  retries INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carrier_serial_no ON carrier_docs(serial_no);
CREATE INDEX IF NOT EXISTS idx_supplier_serial_no ON supplier_docs(serial_no);
CREATE INDEX IF NOT EXISTS idx_carrier_status ON carrier_docs(status);
CREATE INDEX IF NOT EXISTS idx_supplier_status ON supplier_docs(status);
CREATE INDEX IF NOT EXISTS idx_carrier_date ON carrier_docs(doc_datetime);
CREATE INDEX IF NOT EXISTS idx_supplier_date ON supplier_docs(doc_datetime);
CREATE INDEX IF NOT EXISTS idx_carrier_plate ON carrier_docs(plate);
CREATE INDEX IF NOT EXISTS idx_location_type ON locations(type);
