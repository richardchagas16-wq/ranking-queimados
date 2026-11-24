CREATE TABLE IF NOT EXISTS candidatos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  modalidade TEXT NOT NULL CHECK (modalidade IN ('Ampla concorrência', 'Cotas')),
  acertos_portugues INTEGER NOT NULL CHECK (acertos_portugues BETWEEN 0 AND 10),
  acertos_legislacao INTEGER NOT NULL CHECK (acertos_legislacao BETWEEN 0 AND 10),
  acertos_sus INTEGER NOT NULL CHECK (acertos_sus BETWEEN 0 AND 5),
  acertos_especificos INTEGER NOT NULL CHECK (acertos_especificos BETWEEN 0 AND 15),
  nota_total REAL NOT NULL,
  delete_token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS candidatos_nota_total_idx ON candidatos(nota_total DESC);
