-- =============================================================================
-- Email admin + codes de connexion — à importer manuellement (phpMyAdmin)
-- =============================================================================

USE pharmacie_mali;

ALTER TABLE utilisateurs
    ADD COLUMN email VARCHAR(150) NULL AFTER nom_complet;

ALTER TABLE utilisateurs
    ADD UNIQUE INDEX uq_utilisateurs_email (email);

CREATE TABLE IF NOT EXISTS codes_connexion (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id      INT UNSIGNED NOT NULL,
    code_hash           VARCHAR(255) NOT NULL,
    expire_at           DATETIME NOT NULL,
    utilise             TINYINT(1) NOT NULL DEFAULT 0,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_codes_utilise CHECK (utilise IN (0, 1)),
    CONSTRAINT fk_codes_utilisateur
        FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    INDEX idx_codes_utilisateur (utilisateur_id),
    INDEX idx_codes_expire (expire_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
