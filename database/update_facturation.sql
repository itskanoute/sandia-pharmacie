-- =============================================================================
-- Facturation / paiements / numérotation — pharmacie_mali
-- À IMPORTER MANUELLEMENT dans phpMyAdmin (base pharmacie_mali → SQL)
-- Ne pas exécuter automatiquement : tu construis la base toi-même.
-- Si une table/colonne existe déjà, ignorer l’erreur correspondante.
-- =============================================================================

USE pharmacie_mali;

-- -----------------------------------------------------------------------------
-- Numérotation (PF-000001, FAC-000001, VTE-000001, …)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sequences_numerotation (
    code            VARCHAR(30) NOT NULL PRIMARY KEY,
    prefixe         VARCHAR(20) NOT NULL,
    prochain_numero INT UNSIGNED NOT NULL DEFAULT 1,
    updated_at      DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO sequences_numerotation (code, prefixe, prochain_numero) VALUES
    ('proforma', 'PF', 1),
    ('facture', 'FAC', 1),
    ('vente', 'VTE', 1),
    ('paiement', 'PAY', 1);

-- -----------------------------------------------------------------------------
-- Enrichissement proformas (dates document)
-- -----------------------------------------------------------------------------

ALTER TABLE proformas
    ADD COLUMN date_commande DATE NULL AFTER date_proforma;

ALTER TABLE proformas
    ADD COLUMN date_edition DATE NULL AFTER date_commande;

ALTER TABLE proformas
    ADD COLUMN montant_paye INT UNSIGNED NOT NULL DEFAULT 0 AFTER montant_total;

-- -----------------------------------------------------------------------------
-- Paramètres document (NINA / NIF / centre impôts)
-- -----------------------------------------------------------------------------

ALTER TABLE parametres
    ADD COLUMN nina VARCHAR(100) NULL AFTER telephone;

ALTER TABLE parametres
    ADD COLUMN nif VARCHAR(100) NULL AFTER nina;

ALTER TABLE parametres
    ADD COLUMN centre_impots VARCHAR(150) NULL AFTER nif;

-- -----------------------------------------------------------------------------
-- Forme / dosage médicaments (affichage documents)
-- -----------------------------------------------------------------------------

ALTER TABLE medicaments
    ADD COLUMN forme VARCHAR(100) NULL AFTER reference;

ALTER TABLE medicaments
    ADD COLUMN dosage VARCHAR(100) NULL AFTER forme;

-- -----------------------------------------------------------------------------
-- FACTURES (issues d’une vente validée)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS factures (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    numero              VARCHAR(50) NOT NULL UNIQUE,
    vente_id            INT UNSIGNED NULL,
    client_id           INT UNSIGNED NULL,
    type_client         VARCHAR(20) NOT NULL DEFAULT 'ordinaire',
    date_facture        DATE NOT NULL,
    date_commande       DATE NULL,
    date_edition        DATE NULL,
    montant_total       INT UNSIGNED NOT NULL DEFAULT 0,
    montant_paye        INT UNSIGNED NOT NULL DEFAULT 0,
    montant_reste       INT UNSIGNED NOT NULL DEFAULT 0,
    statut_paiement     VARCHAR(30) NOT NULL DEFAULT 'non_paye',
    moyen_paiement      VARCHAR(50) NULL,
    notes               TEXT NULL,
    cree_par            INT UNSIGNED NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_factures_type CHECK (type_client IN ('ordinaire', 'revendeur')),
    CONSTRAINT chk_factures_statut CHECK (statut_paiement IN (
        'non_paye', 'partiellement_paye', 'paye'
    )),
    CONSTRAINT fk_factures_vente FOREIGN KEY (vente_id) REFERENCES ventes(id),
    CONSTRAINT fk_factures_client FOREIGN KEY (client_id) REFERENCES clients(id),
    CONSTRAINT fk_factures_utilisateur FOREIGN KEY (cree_par) REFERENCES utilisateurs(id),
    INDEX idx_factures_date (date_facture),
    INDEX idx_factures_statut (statut_paiement),
    INDEX idx_factures_client (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lignes_facture (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    facture_id          INT UNSIGNED NOT NULL,
    type_produit        VARCHAR(20) NOT NULL,
    medicament_id       INT UNSIGNED NULL,
    appareil_id         INT UNSIGNED NULL,
    designation         VARCHAR(255) NOT NULL,
    forme               VARCHAR(100) NULL,
    dosage              VARCHAR(100) NULL,
    quantite            INT UNSIGNED NOT NULL,
    prix_unitaire       INT UNSIGNED NOT NULL,
    montant_ligne       INT UNSIGNED NOT NULL,
    CONSTRAINT chk_lf_type CHECK (type_produit IN ('medicament', 'appareil')),
    CONSTRAINT chk_lf_quantite CHECK (quantite > 0),
    CONSTRAINT fk_lf_facture FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE CASCADE,
    CONSTRAINT fk_lf_medicament FOREIGN KEY (medicament_id) REFERENCES medicaments(id),
    CONSTRAINT fk_lf_appareil FOREIGN KEY (appareil_id) REFERENCES appareils_medicaux(id),
    INDEX idx_lignes_facture_fac (facture_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- PAIEMENTS (avances / règlements sur facture)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS paiements (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    numero              VARCHAR(50) NULL UNIQUE,
    facture_id          INT UNSIGNED NOT NULL,
    client_id           INT UNSIGNED NULL,
    montant             INT UNSIGNED NOT NULL,
    date_paiement       DATETIME NOT NULL,
    moyen_paiement      VARCHAR(50) NULL,
    notes               TEXT NULL,
    enregistre_par      INT UNSIGNED NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_paiements_montant CHECK (montant > 0),
    CONSTRAINT fk_paiements_facture FOREIGN KEY (facture_id) REFERENCES factures(id),
    CONSTRAINT fk_paiements_client FOREIGN KEY (client_id) REFERENCES clients(id),
    CONSTRAINT fk_paiements_utilisateur FOREIGN KEY (enregistre_par) REFERENCES utilisateurs(id),
    INDEX idx_paiements_facture (facture_id),
    INDEX idx_paiements_date (date_paiement)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- Vérification (optionnel)
-- =============================================================================
-- SHOW TABLES LIKE 'factures';
-- SHOW TABLES LIKE 'paiements';
-- DESCRIBE factures;
-- SELECT * FROM sequences_numerotation;
