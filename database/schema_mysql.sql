-- =============================================================================
-- Logiciel de gestion de pharmacie (Mali)
-- Schéma MySQL / MariaDB — V1 (compatible phpMyAdmin)
-- =============================================================================
-- Devise       : XOF / FCFA (montants en ENTIERS)
-- Fuseau       : Africa/Bamako
--
-- INSTALLATION (base vide) :
--   phpMyAdmin → Importer → database/schema_mysql.sql
--
-- MISE À JOUR (base déjà créée) :
--   phpMyAdmin → base pharmacie_mali → Importer → database/update_mysql.sql
--
-- NE PAS importer schema.sql (version SQLite) dans MySQL.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS pharmacie_mali
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE pharmacie_mali;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. AUTHENTIFICATION & RÔLES
-- -----------------------------------------------------------------------------

CREATE TABLE roles (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code            VARCHAR(50) NOT NULL UNIQUE COMMENT 'ADMIN, PHARMACIEN, CAISSIER',
    libelle         VARCHAR(100) NOT NULL,
    description     TEXT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE utilisateurs (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_id             INT UNSIGNED NOT NULL,
    nom_utilisateur     VARCHAR(100) NOT NULL UNIQUE,
    mot_de_passe_hash   VARCHAR(255) NOT NULL COMMENT 'jamais en clair',
    nom_complet         VARCHAR(150) NOT NULL,
    telephone           VARCHAR(30) NULL COMMENT 'format souple (préfixes maliens)',
    actif               TINYINT(1) NOT NULL DEFAULT 1,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_utilisateurs_actif CHECK (actif IN (0, 1)),
    CONSTRAINT fk_utilisateurs_role
        FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE permissions (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code            VARCHAR(80) NOT NULL UNIQUE,
    libelle         VARCHAR(150) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE role_permissions (
    role_id         INT UNSIGNED NOT NULL,
    permission_id   INT UNSIGNED NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_rp_role
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_rp_permission
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. PARAMÈTRES PHARMACIE
-- -----------------------------------------------------------------------------

CREATE TABLE parametres (
    id                          TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,
    nom_pharmacie               VARCHAR(150) NOT NULL DEFAULT 'SAN-DIA Distribution',
    adresse                     TEXT NULL,
    telephone                   VARCHAR(30) NULL,
    devise                      VARCHAR(10) NOT NULL DEFAULT 'XOF',
    libelle_devise              VARCHAR(20) NOT NULL DEFAULT 'FCFA',
    fuseau_horaire              VARCHAR(50) NOT NULL DEFAULT 'Africa/Bamako',
    jours_alerte_peremption     INT UNSIGNED NOT NULL DEFAULT 150,
    jour_cloture_semaine        TINYINT UNSIGNED NOT NULL DEFAULT 6
        COMMENT '0=dimanche ... 6=samedi',
    updated_at                  DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_parametres_id CHECK (id = 1),
    CONSTRAINT chk_parametres_cloture CHECK (jour_cloture_semaine BETWEEN 0 AND 6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. CATÉGORIES
-- -----------------------------------------------------------------------------

CREATE TABLE categories (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nom             VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT NULL,
    actif           TINYINT(1) NOT NULL DEFAULT 1,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_categories_actif CHECK (actif IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. FOURNISSEURS
-- -----------------------------------------------------------------------------

CREATE TABLE fournisseurs (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nom             VARCHAR(150) NOT NULL,
    telephone       VARCHAR(30) NULL,
    email           VARCHAR(150) NULL,
    adresse         TEXT NULL,
    contact_nom     VARCHAR(150) NULL,
    notes           TEXT NULL,
    actif           TINYINT(1) NOT NULL DEFAULT 1,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_fournisseurs_actif CHECK (actif IN (0, 1)),
    INDEX idx_fournisseurs_nom (nom)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. MÉDICAMENTS
-- -----------------------------------------------------------------------------

CREATE TABLE medicaments (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nom                 VARCHAR(200) NOT NULL,
    reference           VARCHAR(100) NULL UNIQUE,
    categorie_id        INT UNSIGNED NULL,
    description         TEXT NULL,
    prix_achat          INT UNSIGNED NOT NULL DEFAULT 0,
    prix_client         INT UNSIGNED NOT NULL DEFAULT 0,
    prix_revendeur      INT UNSIGNED NOT NULL DEFAULT 0,
    seuil_alerte        INT UNSIGNED NOT NULL DEFAULT 0,
    unite_gestion       VARCHAR(50) NOT NULL DEFAULT 'boîte',
    statut              VARCHAR(20) NOT NULL DEFAULT 'actif',
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_medicaments_statut CHECK (statut IN ('actif', 'archive', 'inactif')),
    CONSTRAINT fk_medicaments_categorie
        FOREIGN KEY (categorie_id) REFERENCES categories(id),
    INDEX idx_medicaments_nom (nom),
    INDEX idx_medicaments_statut (statut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. LOTS & PÉREMPTION
-- -----------------------------------------------------------------------------

CREATE TABLE lots_medicaments (
    id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    medicament_id           INT UNSIGNED NOT NULL,
    numero_lot              VARCHAR(100) NOT NULL,
    date_reception          DATE NULL,
    date_peremption         DATE NOT NULL,
    quantite_initiale       INT UNSIGNED NOT NULL,
    quantite_disponible     INT UNSIGNED NOT NULL,
    ligne_reception_id      INT UNSIGNED NULL,
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_lot_medicament UNIQUE (medicament_id, numero_lot),
    CONSTRAINT fk_lots_medicament
        FOREIGN KEY (medicament_id) REFERENCES medicaments(id),
    INDEX idx_lots_peremption (date_peremption)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. APPAREILS MÉDICAUX
-- -----------------------------------------------------------------------------

CREATE TABLE appareils_medicaux (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nom                 VARCHAR(200) NOT NULL,
    type_appareil       VARCHAR(100) NULL,
    reference           VARCHAR(100) NULL,
    marque              VARCHAR(100) NULL,
    modele              VARCHAR(100) NULL,
    numero_serie        VARCHAR(100) NULL,
    quantite            INT UNSIGNED NOT NULL DEFAULT 0,
    prix_achat          INT UNSIGNED NOT NULL DEFAULT 0,
    prix_client         INT UNSIGNED NOT NULL DEFAULT 0,
    prix_revendeur      INT UNSIGNED NOT NULL DEFAULT 0,
    fournisseur_id      INT UNSIGNED NULL,
    etat                VARCHAR(30) NOT NULL DEFAULT 'disponible',
    seuil_alerte        INT UNSIGNED NOT NULL DEFAULT 0,
    notes               TEXT NULL,
    statut              VARCHAR(20) NOT NULL DEFAULT 'actif',
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_appareils_etat CHECK (etat IN (
        'disponible', 'vendu', 'defectueux', 'retourne', 'reserve', 'indisponible'
    )),
    CONSTRAINT chk_appareils_statut CHECK (statut IN ('actif', 'archive', 'inactif')),
    CONSTRAINT fk_appareils_fournisseur
        FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id),
    INDEX idx_appareils_nom (nom),
    INDEX idx_appareils_reference (reference),
    INDEX idx_appareils_serie (numero_serie),
    INDEX idx_appareils_etat (etat)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. CLIENTS
-- -----------------------------------------------------------------------------

CREATE TABLE clients (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nom             VARCHAR(150) NOT NULL,
    telephone       VARCHAR(30) NULL,
    adresse         TEXT NULL,
    type_client     VARCHAR(20) NOT NULL DEFAULT 'ordinaire',
    informations    TEXT NULL,
    actif           TINYINT(1) NOT NULL DEFAULT 1,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_clients_type CHECK (type_client IN ('ordinaire', 'revendeur')),
    CONSTRAINT chk_clients_actif CHECK (actif IN (0, 1)),
    INDEX idx_clients_nom (nom),
    INDEX idx_clients_type (type_client)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 9. ACHATS / COMMANDES
-- -----------------------------------------------------------------------------

CREATE TABLE commandes (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    fournisseur_id  INT UNSIGNED NOT NULL,
    numero          VARCHAR(50) NULL UNIQUE,
    date_commande   DATE NOT NULL,
    statut          VARCHAR(30) NOT NULL DEFAULT 'brouillon',
    montant_total   INT UNSIGNED NOT NULL DEFAULT 0,
    notes           TEXT NULL,
    cree_par        INT UNSIGNED NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_commandes_statut CHECK (statut IN (
        'brouillon', 'commandee', 'partiellement_recue', 'recue', 'annulee'
    )),
    CONSTRAINT fk_commandes_fournisseur
        FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id),
    CONSTRAINT fk_commandes_utilisateur
        FOREIGN KEY (cree_par) REFERENCES utilisateurs(id),
    INDEX idx_commandes_statut (statut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lignes_commande (
    id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    commande_id             INT UNSIGNED NOT NULL,
    type_produit            VARCHAR(20) NOT NULL,
    medicament_id           INT UNSIGNED NULL,
    appareil_id             INT UNSIGNED NULL,
    designation             VARCHAR(255) NOT NULL,
    quantite_commandee      INT UNSIGNED NOT NULL,
    prix_achat_unitaire     INT UNSIGNED NOT NULL,
    montant_ligne           INT UNSIGNED NOT NULL,
    CONSTRAINT chk_lc_type CHECK (type_produit IN ('medicament', 'appareil')),
    CONSTRAINT chk_lc_quantite CHECK (quantite_commandee > 0),
    CONSTRAINT chk_lc_produit CHECK (
        (type_produit = 'medicament' AND medicament_id IS NOT NULL AND appareil_id IS NULL)
        OR
        (type_produit = 'appareil' AND appareil_id IS NOT NULL AND medicament_id IS NULL)
    ),
    CONSTRAINT fk_lc_commande
        FOREIGN KEY (commande_id) REFERENCES commandes(id) ON DELETE CASCADE,
    CONSTRAINT fk_lc_medicament
        FOREIGN KEY (medicament_id) REFERENCES medicaments(id),
    CONSTRAINT fk_lc_appareil
        FOREIGN KEY (appareil_id) REFERENCES appareils_medicaux(id),
    INDEX idx_lignes_commande_cmd (commande_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 10. RÉCEPTION + CONTRÔLE
-- -----------------------------------------------------------------------------

CREATE TABLE receptions (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    commande_id     INT UNSIGNED NOT NULL,
    numero          VARCHAR(50) NULL UNIQUE,
    date_reception  DATE NOT NULL,
    statut          VARCHAR(30) NOT NULL DEFAULT 'en_controle',
    observations    TEXT NULL,
    validee_par     INT UNSIGNED NULL,
    date_validation DATETIME NULL,
    cree_par        INT UNSIGNED NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_receptions_statut CHECK (statut IN (
        'en_controle', 'validee', 'rejetee', 'annulee'
    )),
    CONSTRAINT fk_receptions_commande
        FOREIGN KEY (commande_id) REFERENCES commandes(id),
    CONSTRAINT fk_receptions_validee_par
        FOREIGN KEY (validee_par) REFERENCES utilisateurs(id),
    CONSTRAINT fk_receptions_cree_par
        FOREIGN KEY (cree_par) REFERENCES utilisateurs(id),
    INDEX idx_receptions_statut (statut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lignes_reception (
    id                          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reception_id                INT UNSIGNED NOT NULL,
    ligne_commande_id           INT UNSIGNED NOT NULL,
    type_produit                VARCHAR(20) NOT NULL,
    medicament_id               INT UNSIGNED NULL,
    appareil_id                 INT UNSIGNED NULL,
    -- Infos figées au moment du contrôle (cahier des charges §7)
    designation                 VARCHAR(255) NULL COMMENT 'nom du produit',
    reference_produit           VARCHAR(100) NULL,
    prix_achat_unitaire         INT UNSIGNED NULL COMMENT 'FCFA',
    quantite_commandee          INT UNSIGNED NOT NULL,
    quantite_recue              INT UNSIGNED NOT NULL DEFAULT 0,
    quantite_controlee          INT UNSIGNED NOT NULL DEFAULT 0,
    ecart                       INT NOT NULL DEFAULT 0 COMMENT 'quantite_recue - quantite_commandee',
    numero_lot                  VARCHAR(100) NULL,
    date_peremption             DATE NULL,
    etat_produit                VARCHAR(50) NULL COMMENT 'état constaté à la réception',
    observation                 TEXT NULL,
    statut_controle             VARCHAR(20) NOT NULL DEFAULT 'en_attente',

    -- CONTRÔLE DE LA BOÎTE — À PRÉCISER AVEC LE CLIENT (flexible)
    controle_quantite_ok        TINYINT(1) NULL,
    controle_conditionnement_ok TINYINT(1) NULL,
    controle_lot_ok             TINYINT(1) NULL,
    controle_peremption_ok      TINYINT(1) NULL,
    controle_etat_ok            TINYINT(1) NULL,
    controle_boite_observations TEXT NULL,

    CONSTRAINT chk_lr_type CHECK (type_produit IN ('medicament', 'appareil')),
    CONSTRAINT chk_lr_statut CHECK (statut_controle IN (
        'en_attente', 'conforme', 'ecart', 'refuse'
    )),
    CONSTRAINT fk_lr_reception
        FOREIGN KEY (reception_id) REFERENCES receptions(id) ON DELETE CASCADE,
    CONSTRAINT fk_lr_ligne_commande
        FOREIGN KEY (ligne_commande_id) REFERENCES lignes_commande(id),
    CONSTRAINT fk_lr_medicament
        FOREIGN KEY (medicament_id) REFERENCES medicaments(id),
    CONSTRAINT fk_lr_appareil
        FOREIGN KEY (appareil_id) REFERENCES appareils_medicaux(id),
    INDEX idx_lignes_reception_rec (reception_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE lots_medicaments
    ADD CONSTRAINT fk_lots_ligne_reception
    FOREIGN KEY (ligne_reception_id) REFERENCES lignes_reception(id);

-- -----------------------------------------------------------------------------
-- 11. MOUVEMENTS DE STOCK
-- -----------------------------------------------------------------------------

CREATE TABLE mouvements_stock (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    type_produit        VARCHAR(20) NOT NULL,
    medicament_id       INT UNSIGNED NULL,
    appareil_id         INT UNSIGNED NULL,
    lot_id              INT UNSIGNED NULL,
    type_mouvement      VARCHAR(30) NOT NULL,
    quantite            INT UNSIGNED NOT NULL,
    sens                VARCHAR(10) NOT NULL,
    quantite_avant      INT UNSIGNED NULL,
    quantite_apres      INT UNSIGNED NULL,
    reference_type      VARCHAR(50) NULL,
    reference_id        INT UNSIGNED NULL,
    motif               TEXT NULL,
    utilisateur_id      INT UNSIGNED NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_ms_type_produit CHECK (type_produit IN ('medicament', 'appareil')),
    CONSTRAINT chk_ms_type_mouvement CHECK (type_mouvement IN (
        'entree_reception', 'sortie_vente', 'entree_correction', 'sortie_correction',
        'sortie_perime', 'sortie_autre', 'entree_autre', 'annulation'
    )),
    CONSTRAINT chk_ms_quantite CHECK (quantite > 0),
    CONSTRAINT chk_ms_sens CHECK (sens IN ('entree', 'sortie')),
    CONSTRAINT fk_ms_medicament FOREIGN KEY (medicament_id) REFERENCES medicaments(id),
    CONSTRAINT fk_ms_appareil FOREIGN KEY (appareil_id) REFERENCES appareils_medicaux(id),
    CONSTRAINT fk_ms_lot FOREIGN KEY (lot_id) REFERENCES lots_medicaments(id),
    CONSTRAINT fk_ms_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id),
    INDEX idx_mouvements_date (created_at),
    INDEX idx_mouvements_medicament (medicament_id),
    INDEX idx_mouvements_appareil (appareil_id),
    INDEX idx_mouvements_type (type_mouvement)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 12. VENTES
-- -----------------------------------------------------------------------------

CREATE TABLE ventes (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    numero              VARCHAR(50) NULL UNIQUE,
    client_id           INT UNSIGNED NULL,
    type_client         VARCHAR(20) NOT NULL DEFAULT 'ordinaire',
    date_vente          DATETIME NOT NULL,
    montant_brut        INT UNSIGNED NOT NULL DEFAULT 0,
    remise              INT UNSIGNED NOT NULL DEFAULT 0,
    montant_total       INT UNSIGNED NOT NULL DEFAULT 0,
    statut              VARCHAR(20) NOT NULL DEFAULT 'validee',
    notes               TEXT NULL,
    vendeur_id          INT UNSIGNED NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_ventes_type CHECK (type_client IN ('ordinaire', 'revendeur')),
    CONSTRAINT chk_ventes_statut CHECK (statut IN ('validee', 'annulee')),
    CONSTRAINT fk_ventes_client FOREIGN KEY (client_id) REFERENCES clients(id),
    CONSTRAINT fk_ventes_vendeur FOREIGN KEY (vendeur_id) REFERENCES utilisateurs(id),
    INDEX idx_ventes_date (date_vente),
    INDEX idx_ventes_statut (statut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lignes_vente (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vente_id            INT UNSIGNED NOT NULL,
    type_produit        VARCHAR(20) NOT NULL,
    medicament_id       INT UNSIGNED NULL,
    appareil_id         INT UNSIGNED NULL,
    lot_id              INT UNSIGNED NULL,
    designation         VARCHAR(255) NOT NULL,
    quantite            INT UNSIGNED NOT NULL,
    prix_unitaire       INT UNSIGNED NOT NULL COMMENT 'prix figé au moment de la vente',
    montant_ligne       INT UNSIGNED NOT NULL,
    CONSTRAINT chk_lv_type CHECK (type_produit IN ('medicament', 'appareil')),
    CONSTRAINT chk_lv_quantite CHECK (quantite > 0),
    CONSTRAINT fk_lv_vente FOREIGN KEY (vente_id) REFERENCES ventes(id) ON DELETE CASCADE,
    CONSTRAINT fk_lv_medicament FOREIGN KEY (medicament_id) REFERENCES medicaments(id),
    CONSTRAINT fk_lv_appareil FOREIGN KEY (appareil_id) REFERENCES appareils_medicaux(id),
    CONSTRAINT fk_lv_lot FOREIGN KEY (lot_id) REFERENCES lots_medicaments(id),
    INDEX idx_lignes_vente_vente (vente_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 13. PRO FORMA
-- -----------------------------------------------------------------------------

CREATE TABLE proformas (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    numero              VARCHAR(50) NULL UNIQUE,
    client_id           INT UNSIGNED NULL,
    type_client         VARCHAR(20) NOT NULL DEFAULT 'ordinaire',
    date_proforma       DATE NOT NULL,
    montant_total       INT UNSIGNED NOT NULL DEFAULT 0,
    statut              VARCHAR(30) NOT NULL DEFAULT 'brouillon',
    notes               TEXT NULL,
    cree_par            INT UNSIGNED NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_pf_type CHECK (type_client IN ('ordinaire', 'revendeur')),
    CONSTRAINT chk_pf_statut CHECK (statut IN (
        'brouillon', 'emis', 'converti_vente', 'annule'
    )),
    CONSTRAINT fk_pf_client FOREIGN KEY (client_id) REFERENCES clients(id),
    CONSTRAINT fk_pf_utilisateur FOREIGN KEY (cree_par) REFERENCES utilisateurs(id),
    INDEX idx_proformas_date (date_proforma)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lignes_proforma (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    proforma_id         INT UNSIGNED NOT NULL,
    type_produit        VARCHAR(20) NOT NULL,
    medicament_id       INT UNSIGNED NULL,
    appareil_id         INT UNSIGNED NULL,
    designation         VARCHAR(255) NOT NULL,
    quantite            INT UNSIGNED NOT NULL,
    prix_unitaire       INT UNSIGNED NOT NULL,
    montant_ligne       INT UNSIGNED NOT NULL,
    CONSTRAINT chk_lpf_type CHECK (type_produit IN ('medicament', 'appareil')),
    CONSTRAINT chk_lpf_quantite CHECK (quantite > 0),
    CONSTRAINT fk_lpf_proforma FOREIGN KEY (proforma_id) REFERENCES proformas(id) ON DELETE CASCADE,
    CONSTRAINT fk_lpf_medicament FOREIGN KEY (medicament_id) REFERENCES medicaments(id),
    CONSTRAINT fk_lpf_appareil FOREIGN KEY (appareil_id) REFERENCES appareils_medicaux(id),
    INDEX idx_lignes_proforma_pf (proforma_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 14. HISTORIQUE / JOURNAL
-- -----------------------------------------------------------------------------

CREATE TABLE historique_prix (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    type_produit        VARCHAR(20) NOT NULL,
    medicament_id       INT UNSIGNED NULL,
    appareil_id         INT UNSIGNED NULL,
    champ_modifie       VARCHAR(30) NOT NULL,
    ancien_prix         INT UNSIGNED NOT NULL,
    nouveau_prix        INT UNSIGNED NOT NULL,
    utilisateur_id      INT UNSIGNED NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_hp_type CHECK (type_produit IN ('medicament', 'appareil')),
    CONSTRAINT chk_hp_champ CHECK (champ_modifie IN (
        'prix_achat', 'prix_client', 'prix_revendeur'
    )),
    CONSTRAINT fk_hp_medicament FOREIGN KEY (medicament_id) REFERENCES medicaments(id),
    CONSTRAINT fk_hp_appareil FOREIGN KEY (appareil_id) REFERENCES appareils_medicaux(id),
    CONSTRAINT fk_hp_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE journal_actions (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id      INT UNSIGNED NULL,
    action              VARCHAR(50) NOT NULL,
    entite              VARCHAR(50) NOT NULL,
    entite_id           INT UNSIGNED NULL,
    details             TEXT NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ja_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id),
    INDEX idx_journal_date (created_at),
    INDEX idx_journal_entite (entite, entite_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- 15. DONNÉES INITIALES
-- -----------------------------------------------------------------------------

INSERT INTO roles (code, libelle, description) VALUES
    ('ADMIN', 'Administrateur', 'Accès complet à toutes les fonctionnalités'),
    ('PHARMACIEN', 'Pharmacien', 'Rôle prévu pour une version ultérieure'),
    ('CAISSIER', 'Caissier', 'Rôle prévu pour une version ultérieure');

INSERT INTO parametres (
    id, nom_pharmacie, devise, libelle_devise, fuseau_horaire,
    jours_alerte_peremption, jour_cloture_semaine
) VALUES (
    1, 'SAN-DIA Distribution', 'XOF', 'FCFA', 'Africa/Bamako', 150, 6
);

INSERT INTO permissions (code, libelle) VALUES
    ('TOUT', 'Accès total'),
    ('MEDICAMENTS_LIRE', 'Consulter les médicaments'),
    ('MEDICAMENTS_ECRIRE', 'Gérer les médicaments'),
    ('APPAREILS_LIRE', 'Consulter les appareils'),
    ('APPAREILS_ECRIRE', 'Gérer les appareils'),
    ('STOCK_LIRE', 'Consulter le stock'),
    ('STOCK_ECRIRE', 'Ajuster le stock'),
    ('ACHATS_GERER', 'Gérer achats et réceptions'),
    ('VENTES_GERER', 'Effectuer des ventes'),
    ('CLIENTS_GERER', 'Gérer les clients'),
    ('RAPPORTS_LIRE', 'Consulter rapports et bilans'),
    ('PARAMETRES_GERER', 'Modifier les paramètres');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'ADMIN';

-- -----------------------------------------------------------------------------
-- 16. VUES (dashboard / alertes)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW vue_stock_medicaments AS
SELECT
    m.id AS medicament_id,
    m.nom,
    m.reference,
    m.seuil_alerte,
    m.statut,
    COALESCE(SUM(l.quantite_disponible), 0) AS quantite_disponible,
    CASE
        WHEN COALESCE(SUM(l.quantite_disponible), 0) = 0 THEN 'rupture'
        WHEN COALESCE(SUM(l.quantite_disponible), 0) <= m.seuil_alerte THEN 'stock_faible'
        ELSE 'ok'
    END AS niveau_stock
FROM medicaments m
LEFT JOIN lots_medicaments l ON l.medicament_id = m.id
WHERE m.statut = 'actif'
GROUP BY m.id, m.nom, m.reference, m.seuil_alerte, m.statut;

CREATE OR REPLACE VIEW vue_lots_peremption AS
SELECT
    l.id AS lot_id,
    l.medicament_id,
    m.nom AS medicament_nom,
    l.numero_lot,
    l.date_peremption,
    l.quantite_disponible,
    p.jours_alerte_peremption,
    CASE
        WHEN l.date_peremption < CURDATE() THEN 'perime'
        WHEN l.date_peremption <= DATE_ADD(CURDATE(), INTERVAL p.jours_alerte_peremption DAY)
            THEN 'bientot_perime'
        ELSE 'valide'
    END AS statut_peremption
FROM lots_medicaments l
JOIN medicaments m ON m.id = l.medicament_id
CROSS JOIN parametres p
WHERE l.quantite_disponible > 0
  AND m.statut = 'actif';

-- =============================================================================
-- FIN — Compte admin à créer en Phase 1 (mot de passe hashé, jamais en clair)
-- =============================================================================
