-- Simple Block Builder — Cloudflare D1 schema (SQLite)
-- Aplicar con:
--   wrangler d1 execute simple-block-builder --remote --file=./schema/0001_initial.sql

-- Magic-link logins. Cada login crea una fila con el hash del token y una
-- expiración corta (15 min). Al usarse, se marca como usado.
CREATE TABLE IF NOT EXISTS login_codes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expira     TEXT NOT NULL,
  usado      INTEGER NOT NULL DEFAULT 0,
  fecha      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_codes_token ON login_codes(token_hash);

-- Proyectos del usuario: cada uno guarda sus piezas como JSON.
CREATE TABLE IF NOT EXISTS proyectos (
  id              TEXT PRIMARY KEY,
  user_email      TEXT NOT NULL,
  nombre          TEXT NOT NULL,
  piezas_json     TEXT NOT NULL,
  creado_en       TEXT NOT NULL,
  actualizado_en  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_proyectos_user ON proyectos(user_email);
