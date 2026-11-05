-- Camos MW4 : comptes joueurs et progression (SQLite)
CREATE TABLE IF NOT EXISTS utilisateurs (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  pseudo    TEXT NOT NULL UNIQUE COLLATE NOCASE,
  mdp_hash  TEXT NOT NULL,              -- password_hash() PHP, jamais le mot de passe en clair
  code_hash TEXT,                       -- code de secours (haché) pour le mot de passe oublié
  version   INTEGER NOT NULL DEFAULT 0, -- augmente à chaque changement de mdp : déconnecte les autres sessions
  cree_le   TEXT NOT NULL
);

-- Une ligne = un camo débloqué par un joueur. Décocher supprime la ligne.
CREATE TABLE IF NOT EXISTS progression (
  utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  cle            TEXT NOT NULL,         -- "Arme|Camo", ex. "M4|Gold"
  arme           TEXT NOT NULL,
  camo           TEXT NOT NULL,
  debloque_le    TEXT NOT NULL,
  PRIMARY KEY (utilisateur_id, cle)
);

-- Événements limités : échecs de connexion, inscriptions (anti-force brute / anti-spam)
CREATE TABLE IF NOT EXISTS evenements (
  type   TEXT NOT NULL,                 -- 'echec', 'inscription' ou 'secours'
  ip     TEXT NOT NULL,
  pseudo TEXT NOT NULL DEFAULT '',
  quand  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evt_ip ON evenements(type, ip, quand);
CREATE INDEX IF NOT EXISTS idx_evt_pseudo ON evenements(type, pseudo, quand);
