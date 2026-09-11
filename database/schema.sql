-- =============================================================================
-- Logiciel de gestion de pharmacie (Mali)
-- Schéma de base de données — V1
-- =============================================================================
-- Devise       : XOF / FCFA (montants stockés en ENTIERS, sans décimales)
-- Fuseau       : Africa/Bamako (géré côté application + table parametres)
-- Langue       : français
-- SGBD cible   : SQLite UNIQUEMENT
-- MySQL/phpMyAdmin : importer database/schema_mysql.sql (PAS ce fichier)
-- =============================================================================
-- Parcours achat : Fournisseur → Commande → Réception → Contrôle → Validation → Stock
-- =============================================================================

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- 1. AUTHENTIFICATION & RÔLES (Phase 1 — extensible)
-- -----------------------------------------------------------------------------
-- V1 : un seul compte Administrateur.
-- Plus tard : Pharmacien, Caissier via la table roles + permissions.

CREATE TABLE roles (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    code            TEXT NOT NULL UNIQUE,          -- ADMIN, PHARMACIEN, CAISSIER
    libelle         TEXT NOT NULL,
    description     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE utilisateurs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id         INTEGER NOT NULL,
    nom_utilisateur TEXT NOT NULL UNIQUE,
    mot_de_passe_hash TEXT NOT NULL,              -- jamais en clair
    nom_complet     TEXT NOT NULL,
    telephone       TEXT,                           -- format souple (préfixes maliens)
    actif           INTEGER NOT NULL DEFAULT 1 CHECK (actif IN (0, 1)),
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Permissions simples (extensible sans refonte)
CREATE TABLE permissions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    code            TEXT NOT NULL UNIQUE,          -- ex: MEDICAMENTS_ECRIRE
    libelle         TEXT NOT NULL
);

CREATE TABLE role_permissions (
    role_id         INTEGER NOT NULL,
    permission_id   INTEGER NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 2. PARAMÈTRES PHARMACIE (alertes, clôture semaine, localisation)
-- -----------------------------------------------------------------------------
-- Les valeurs métier configurables ne doivent PAS être codées en dur.

CREATE TABLE parametres (
    id                      INTEGER PRIMARY KEY CHECK (id = 1), -- une seule ligne
    nom_pharmacie           TEXT NOT NULL DEFAULT 'Pharmacie',
    adresse                 TEXT,
    telephone               TEXT,
    devise                  TEXT NOT NULL DEFAULT 'XOF',
    libelle_devise          TEXT NOT NULL DEFAULT 'FCFA',
    fuseau_horaire          TEXT NOT NULL DEFAULT 'Africa/Bamako',
    -- Alerte péremption paramétrable (ex. 90 jours)
    jours_alerte_peremption INTEGER NOT NULL DEFAULT 90
        CHECK (jours_alerte_peremption >= 0),
    -- Jour de clôture hebdomadaire : 6 = samedi, 0 = dimanche (convention JS/SQLite)
    jour_cloture_semaine    INTEGER NOT NULL DEFAULT 6
        CHECK (jour_cloture_semaine BETWEEN 0 AND 6),
    updated_at              TEXT
);

-- -----------------------------------------------------------------------------
-- 3. CATÉGORIES (médicaments)
-- -----------------------------------------------------------------------------

CREATE TABLE categories (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nom             TEXT NOT NULL UNIQUE,
    description     TEXT,
    actif           INTEGER NOT NULL DEFAULT 1 CHECK (actif IN (0, 1)),
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- -----------------------------------------------------------------------------
-- 4. FOURNISSEURS (Phase 6)
-- -----------------------------------------------------------------------------

CREATE TABLE fournisseurs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nom             TEXT NOT NULL,
    telephone       TEXT,                           -- saisie locale malienne acceptée
    email           TEXT,
    adresse         TEXT,
    contact_nom     TEXT,
    notes           TEXT,
    actif           INTEGER NOT NULL DEFAULT 1 CHECK (actif IN (0, 1)),
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT
);

CREATE INDEX idx_fournisseurs_nom ON fournisseurs(nom);

-- -----------------------------------------------------------------------------
-- 5. MÉDICAMENTS (Phase 2)
-- -----------------------------------------------------------------------------
-- Le stock disponible d'un médicament = somme des quantités des lots actifs.
-- Les prix sont en FCFA (entiers). L'historique de vente conserve le prix appliqué.

CREATE TABLE medicaments (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    nom                 TEXT NOT NULL,
    reference           TEXT UNIQUE,
    categorie_id        INTEGER,
    description         TEXT,
    prix_achat          INTEGER NOT NULL DEFAULT 0 CHECK (prix_achat >= 0),
    prix_client         INTEGER NOT NULL DEFAULT 0 CHECK (prix_client >= 0),
    prix_revendeur      INTEGER NOT NULL DEFAULT 0 CHECK (prix_revendeur >= 0),
    seuil_alerte        INTEGER NOT NULL DEFAULT 0 CHECK (seuil_alerte >= 0),
    unite_gestion       TEXT NOT NULL DEFAULT 'boîte', -- boîte, flacon, unité...
    statut              TEXT NOT NULL DEFAULT 'actif'
        CHECK (statut IN ('actif', 'archive', 'inactif')),
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT,
    FOREIGN KEY (categorie_id) REFERENCES categories(id)
);

CREATE INDEX idx_medicaments_nom ON medicaments(nom);
CREATE INDEX idx_medicaments_reference ON medicaments(reference);
CREATE INDEX idx_medicaments_statut ON medicaments(statut);

-- -----------------------------------------------------------------------------
-- 6. LOTS & PÉREMPTION — médicaments (Phase 5)
-- -----------------------------------------------------------------------------

CREATE TABLE lots_medicaments (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    medicament_id       INTEGER NOT NULL,
    numero_lot          TEXT NOT NULL,
    date_reception      TEXT,                       -- YYYY-MM-DD
    date_peremption     TEXT NOT NULL,              -- YYYY-MM-DD
    quantite_initiale   INTEGER NOT NULL CHECK (quantite_initiale >= 0),
    quantite_disponible INTEGER NOT NULL CHECK (quantite_disponible >= 0),
    -- Lien optionnel vers la ligne de réception qui a créé le lot
    ligne_reception_id  INTEGER,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT,
    FOREIGN KEY (medicament_id) REFERENCES medicaments(id),
    UNIQUE (medicament_id, numero_lot)
);

CREATE INDEX idx_lots_medicament ON lots_medicaments(medicament_id);
CREATE INDEX idx_lots_peremption ON lots_medicaments(date_peremption);

-- -----------------------------------------------------------------------------
-- 7. APPAREILS MÉDICAUX (Phase 3) — distinct des médicaments
-- -----------------------------------------------------------------------------

CREATE TABLE appareils_medicaux (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    nom                 TEXT NOT NULL,
    type_appareil       TEXT,                       -- ex: tensiomètre, glucomètre
    reference           TEXT,
    marque              TEXT,
    modele              TEXT,
    numero_serie        TEXT,                       -- si applicable
    quantite            INTEGER NOT NULL DEFAULT 0 CHECK (quantite >= 0),
    prix_achat          INTEGER NOT NULL DEFAULT 0 CHECK (prix_achat >= 0),
    prix_client         INTEGER NOT NULL DEFAULT 0 CHECK (prix_client >= 0),
    prix_revendeur      INTEGER NOT NULL DEFAULT 0 CHECK (prix_revendeur >= 0),
    fournisseur_id      INTEGER,
    etat                TEXT NOT NULL DEFAULT 'disponible'
        CHECK (etat IN (
            'disponible',
            'vendu',
            'defectueux',
            'retourne',
            'reserve',
            'indisponible'
        )),
    seuil_alerte        INTEGER NOT NULL DEFAULT 0 CHECK (seuil_alerte >= 0),
    notes               TEXT,
    statut              TEXT NOT NULL DEFAULT 'actif'
        CHECK (statut IN ('actif', 'archive', 'inactif')),
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT,
    FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id)
);

CREATE INDEX idx_appareils_nom ON appareils_medicaux(nom);
CREATE INDEX idx_appareils_reference ON appareils_medicaux(reference);
CREATE INDEX idx_appareils_serie ON appareils_medicaux(numero_serie);
CREATE INDEX idx_appareils_etat ON appareils_medicaux(etat);

-- -----------------------------------------------------------------------------
-- 8. CLIENTS & TARIFICATION (Phase 8)
-- -----------------------------------------------------------------------------

CREATE TABLE clients (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nom             TEXT NOT NULL,
    telephone       TEXT,
    adresse         TEXT,
    type_client     TEXT NOT NULL DEFAULT 'ordinaire'
        CHECK (type_client IN ('ordinaire', 'revendeur')),
    informations    TEXT,
    actif           INTEGER NOT NULL DEFAULT 1 CHECK (actif IN (0, 1)),
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT
);

CREATE INDEX idx_clients_nom ON clients(nom);
CREATE INDEX idx_clients_type ON clients(type_client);

-- -----------------------------------------------------------------------------
-- 9. ACHATS / COMMANDES (Phase 6)
-- -----------------------------------------------------------------------------

CREATE TABLE commandes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    fournisseur_id  INTEGER NOT NULL,
    numero          TEXT UNIQUE,                    -- ex: CMD-2026-0001
    date_commande   TEXT NOT NULL,                  -- YYYY-MM-DD
    statut          TEXT NOT NULL DEFAULT 'brouillon'
        CHECK (statut IN (
            'brouillon',
            'commandee',
            'partiellement_recue',
            'recue',
            'annulee'
        )),
    montant_total   INTEGER NOT NULL DEFAULT 0 CHECK (montant_total >= 0),
    notes           TEXT,
    cree_par        INTEGER,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT,
    FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id),
    FOREIGN KEY (cree_par) REFERENCES utilisateurs(id)
);

CREATE TABLE lignes_commande (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    commande_id         INTEGER NOT NULL,
    -- Produit : médicament OU appareil (un seul renseigné)
    type_produit        TEXT NOT NULL CHECK (type_produit IN ('medicament', 'appareil')),
    medicament_id       INTEGER,
    appareil_id         INTEGER,
    designation         TEXT NOT NULL,              -- copie du nom au moment de la commande
    quantite_commandee  INTEGER NOT NULL CHECK (quantite_commandee > 0),
    prix_achat_unitaire INTEGER NOT NULL CHECK (prix_achat_unitaire >= 0),
    montant_ligne       INTEGER NOT NULL CHECK (montant_ligne >= 0),
    FOREIGN KEY (commande_id) REFERENCES commandes(id) ON DELETE CASCADE,
    FOREIGN KEY (medicament_id) REFERENCES medicaments(id),
    FOREIGN KEY (appareil_id) REFERENCES appareils_medicaux(id),
    CHECK (
        (type_produit = 'medicament' AND medicament_id IS NOT NULL AND appareil_id IS NULL)
        OR
        (type_produit = 'appareil' AND appareil_id IS NOT NULL AND medicament_id IS NULL)
    )
);

CREATE INDEX idx_commandes_fournisseur ON commandes(fournisseur_id);
CREATE INDEX idx_commandes_statut ON commandes(statut);
CREATE INDEX idx_lignes_commande_cmd ON lignes_commande(commande_id);

-- -----------------------------------------------------------------------------
-- 10. RÉCEPTION + CONTRÔLE (Phase 7)
-- -----------------------------------------------------------------------------
-- Le stock n'augmente QU'APRÈS validation de la réception.

CREATE TABLE receptions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    commande_id     INTEGER NOT NULL,
    numero          TEXT UNIQUE,                    -- ex: REC-2026-0001
    date_reception  TEXT NOT NULL,                  -- YYYY-MM-DD
    statut          TEXT NOT NULL DEFAULT 'en_controle'
        CHECK (statut IN (
            'en_controle',
            'validee',
            'rejetee',
            'annulee'
        )),
    observations    TEXT,
    validee_par     INTEGER,
    date_validation TEXT,
    cree_par        INTEGER,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT,
    FOREIGN KEY (commande_id) REFERENCES commandes(id),
    FOREIGN KEY (validee_par) REFERENCES utilisateurs(id),
    FOREIGN KEY (cree_par) REFERENCES utilisateurs(id)
);

CREATE TABLE lignes_reception (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    reception_id            INTEGER NOT NULL,
    ligne_commande_id       INTEGER NOT NULL,
    type_produit            TEXT NOT NULL CHECK (type_produit IN ('medicament', 'appareil')),
    medicament_id           INTEGER,
    appareil_id             INTEGER,
    quantite_commandee      INTEGER NOT NULL CHECK (quantite_commandee >= 0),
    quantite_recue          INTEGER NOT NULL DEFAULT 0 CHECK (quantite_recue >= 0),
    quantite_controlee      INTEGER NOT NULL DEFAULT 0 CHECK (quantite_controlee >= 0),
    -- Ecart calculé : recue - commandee (négatif = manquant)
    ecart                   INTEGER NOT NULL DEFAULT 0,
    numero_lot              TEXT,                   -- médicaments
    date_peremption         TEXT,                   -- YYYY-MM-DD
    observation             TEXT,
    statut_controle         TEXT NOT NULL DEFAULT 'en_attente'
        CHECK (statut_controle IN (
            'en_attente',
            'conforme',
            'ecart',
            'refuse'
        )),

    -- -------------------------------------------------------------------------
    -- CONTRÔLE DE LA BOÎTE — À PRÉCISER AVEC LE CLIENT
    -- Structure préparée, règles métier non inventées.
    -- -------------------------------------------------------------------------
    controle_quantite_ok        INTEGER CHECK (controle_quantite_ok IN (0, 1)),
    controle_conditionnement_ok INTEGER CHECK (controle_conditionnement_ok IN (0, 1)),
    controle_lot_ok             INTEGER CHECK (controle_lot_ok IN (0, 1)),
    controle_peremption_ok      INTEGER CHECK (controle_peremption_ok IN (0, 1)),
    controle_etat_ok            INTEGER CHECK (controle_etat_ok IN (0, 1)),
    controle_boite_observations TEXT,
    -- fin zone « à préciser »

    FOREIGN KEY (reception_id) REFERENCES receptions(id) ON DELETE CASCADE,
    FOREIGN KEY (ligne_commande_id) REFERENCES lignes_commande(id),
    FOREIGN KEY (medicament_id) REFERENCES medicaments(id),
    FOREIGN KEY (appareil_id) REFERENCES appareils_medicaux(id)
);

CREATE INDEX idx_receptions_commande ON receptions(commande_id);
CREATE INDEX idx_receptions_statut ON receptions(statut);
CREATE INDEX idx_lignes_reception_rec ON lignes_reception(reception_id);

-- Lien lot → ligne réception (ajouté après création des deux tables)
-- SQLite : on documente la relation ; FK optionnelle via UPDATE si besoin.
-- En pratique, lots_medicaments.ligne_reception_id référence lignes_reception(id).

-- -----------------------------------------------------------------------------
-- 11. MOUVEMENTS DE STOCK (Phase 4) — traçabilité
-- -----------------------------------------------------------------------------
-- Objectif : ce qui est entré → sorti → reste → pourquoi ça a changé.

CREATE TABLE mouvements_stock (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    type_produit        TEXT NOT NULL CHECK (type_produit IN ('medicament', 'appareil')),
    medicament_id       INTEGER,
    appareil_id         INTEGER,
    lot_id              INTEGER,                    -- si médicament avec lot
    type_mouvement      TEXT NOT NULL
        CHECK (type_mouvement IN (
            'entree_reception',
            'sortie_vente',
            'entree_correction',
            'sortie_correction',
            'sortie_perime',
            'sortie_autre',
            'entree_autre',
            'annulation'
        )),
    quantite            INTEGER NOT NULL CHECK (quantite > 0),
    sens                TEXT NOT NULL CHECK (sens IN ('entree', 'sortie')),
    quantite_avant      INTEGER,
    quantite_apres      INTEGER,
    -- Référence métier (id vente, réception, etc.)
    reference_type      TEXT,                       -- vente, reception, correction...
    reference_id        INTEGER,
    motif               TEXT,
    utilisateur_id      INTEGER,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (medicament_id) REFERENCES medicaments(id),
    FOREIGN KEY (appareil_id) REFERENCES appareils_medicaux(id),
    FOREIGN KEY (lot_id) REFERENCES lots_medicaments(id),
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
);

CREATE INDEX idx_mouvements_date ON mouvements_stock(created_at);
CREATE INDEX idx_mouvements_medicament ON mouvements_stock(medicament_id);
CREATE INDEX idx_mouvements_appareil ON mouvements_stock(appareil_id);
CREATE INDEX idx_mouvements_type ON mouvements_stock(type_mouvement);

-- -----------------------------------------------------------------------------
-- 12. VENTES (Phase 9)
-- -----------------------------------------------------------------------------

CREATE TABLE ventes (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    numero              TEXT UNIQUE,                -- ex: VTE-2026-0001
    client_id           INTEGER,                    -- nullable = client passage
    type_client         TEXT NOT NULL DEFAULT 'ordinaire'
        CHECK (type_client IN ('ordinaire', 'revendeur')),
    date_vente          TEXT NOT NULL,              -- YYYY-MM-DD HH:MM:SS (Africa/Bamako)
    montant_brut        INTEGER NOT NULL DEFAULT 0 CHECK (montant_brut >= 0),
    remise              INTEGER NOT NULL DEFAULT 0 CHECK (remise >= 0),
    montant_total       INTEGER NOT NULL DEFAULT 0 CHECK (montant_total >= 0),
    statut              TEXT NOT NULL DEFAULT 'validee'
        CHECK (statut IN ('validee', 'annulee')),
    notes               TEXT,
    vendeur_id          INTEGER,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT,
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (vendeur_id) REFERENCES utilisateurs(id)
);

CREATE TABLE lignes_vente (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    vente_id            INTEGER NOT NULL,
    type_produit        TEXT NOT NULL CHECK (type_produit IN ('medicament', 'appareil')),
    medicament_id       INTEGER,
    appareil_id         INTEGER,
    lot_id              INTEGER,
    designation         TEXT NOT NULL,              -- nom figé au moment de la vente
    quantite            INTEGER NOT NULL CHECK (quantite > 0),
    -- Prix réellement appliqué (figé — ne change pas si le tarif produit évolue)
    prix_unitaire       INTEGER NOT NULL CHECK (prix_unitaire >= 0),
    montant_ligne       INTEGER NOT NULL CHECK (montant_ligne >= 0),
    FOREIGN KEY (vente_id) REFERENCES ventes(id) ON DELETE CASCADE,
    FOREIGN KEY (medicament_id) REFERENCES medicaments(id),
    FOREIGN KEY (appareil_id) REFERENCES appareils_medicaux(id),
    FOREIGN KEY (lot_id) REFERENCES lots_medicaments(id)
);

CREATE INDEX idx_ventes_date ON ventes(date_vente);
CREATE INDEX idx_ventes_client ON ventes(client_id);
CREATE INDEX idx_ventes_statut ON ventes(statut);
CREATE INDEX idx_lignes_vente_vente ON lignes_vente(vente_id);

-- -----------------------------------------------------------------------------
-- 13. PRO FORMA (Phase 10)
-- -----------------------------------------------------------------------------
-- Pas de mentions légales/fiscales maliènes non vérifiées.

CREATE TABLE proformas (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    numero              TEXT UNIQUE,                -- ex: PF-2026-0001
    client_id           INTEGER,
    type_client         TEXT NOT NULL DEFAULT 'ordinaire'
        CHECK (type_client IN ('ordinaire', 'revendeur')),
    date_proforma       TEXT NOT NULL,
    montant_total       INTEGER NOT NULL DEFAULT 0 CHECK (montant_total >= 0),
    statut              TEXT NOT NULL DEFAULT 'brouillon'
        CHECK (statut IN ('brouillon', 'emis', 'converti_vente', 'annule')),
    notes               TEXT,
    cree_par            INTEGER,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT,
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (cree_par) REFERENCES utilisateurs(id)
);

CREATE TABLE lignes_proforma (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    proforma_id         INTEGER NOT NULL,
    type_produit        TEXT NOT NULL CHECK (type_produit IN ('medicament', 'appareil')),
    medicament_id       INTEGER,
    appareil_id         INTEGER,
    designation         TEXT NOT NULL,
    quantite            INTEGER NOT NULL CHECK (quantite > 0),
    prix_unitaire       INTEGER NOT NULL CHECK (prix_unitaire >= 0),
    montant_ligne       INTEGER NOT NULL CHECK (montant_ligne >= 0),
    FOREIGN KEY (proforma_id) REFERENCES proformas(id) ON DELETE CASCADE,
    FOREIGN KEY (medicament_id) REFERENCES medicaments(id),
    FOREIGN KEY (appareil_id) REFERENCES appareils_medicaux(id)
);

CREATE INDEX idx_proformas_date ON proformas(date_proforma);
CREATE INDEX idx_lignes_proforma_pf ON lignes_proforma(proforma_id);

-- -----------------------------------------------------------------------------
-- 14. HISTORIQUE MODIFICATIONS PRIX / PRODUITS (Phase 19 — traçabilité)
-- -----------------------------------------------------------------------------

CREATE TABLE historique_prix (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    type_produit        TEXT NOT NULL CHECK (type_produit IN ('medicament', 'appareil')),
    medicament_id       INTEGER,
    appareil_id         INTEGER,
    champ_modifie       TEXT NOT NULL
        CHECK (champ_modifie IN ('prix_achat', 'prix_client', 'prix_revendeur')),
    ancien_prix         INTEGER NOT NULL,
    nouveau_prix        INTEGER NOT NULL,
    utilisateur_id      INTEGER,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (medicament_id) REFERENCES medicaments(id),
    FOREIGN KEY (appareil_id) REFERENCES appareils_medicaux(id),
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
);

CREATE TABLE journal_actions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    utilisateur_id      INTEGER,
    action              TEXT NOT NULL,              -- creation, modification, archivage...
    entite              TEXT NOT NULL,              -- medicament, vente, reception...
    entite_id           INTEGER,
    details             TEXT,                       -- JSON texte libre si besoin
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
);

CREATE INDEX idx_journal_date ON journal_actions(created_at);
CREATE INDEX idx_journal_entite ON journal_actions(entite, entite_id);

-- -----------------------------------------------------------------------------
-- 15. DONNÉES INITIALES MINIMALES
-- -----------------------------------------------------------------------------

INSERT INTO roles (code, libelle, description) VALUES
    ('ADMIN', 'Administrateur', 'Accès complet à toutes les fonctionnalités'),
    ('PHARMACIEN', 'Pharmacien', 'Rôle prévu pour une version ultérieure'),
    ('CAISSIER', 'Caissier', 'Rôle prévu pour une version ultérieure');

INSERT INTO parametres (
    id,
    nom_pharmacie,
    devise,
    libelle_devise,
    fuseau_horaire,
    jours_alerte_peremption,
    jour_cloture_semaine
) VALUES (
    1,
    'Pharmacie',
    'XOF',
    'FCFA',
    'Africa/Bamako',
    90,
    6
);

-- Permissions de base (extensibles)
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

-- Admin : toutes les permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'ADMIN';

-- =============================================================================
-- VUES UTILES (lecture seule — facilite dashboard / alertes)
-- =============================================================================

-- Stock médicament = somme des lots
CREATE VIEW vue_stock_medicaments AS
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
GROUP BY m.id;

-- Lots bientôt périmés / périmés (selon parametres.jours_alerte_peremption)
CREATE VIEW vue_lots_peremption AS
SELECT
    l.id AS lot_id,
    l.medicament_id,
    m.nom AS medicament_nom,
    l.numero_lot,
    l.date_peremption,
    l.quantite_disponible,
    p.jours_alerte_peremption,
    CASE
        WHEN date(l.date_peremption) < date('now') THEN 'perime'
        WHEN date(l.date_peremption) <= date('now', '+' || p.jours_alerte_peremption || ' days')
            THEN 'bientot_perime'
        ELSE 'valide'
    END AS statut_peremption
FROM lots_medicaments l
JOIN medicaments m ON m.id = l.medicament_id
CROSS JOIN parametres p
WHERE l.quantite_disponible > 0
  AND m.statut = 'actif';

-- =============================================================================
-- FIN DU SCHÉMA
-- =============================================================================
-- Compte administrateur : à créer en Phase 1 via l'application
-- (hash du mot de passe, jamais stocké en clair dans ce fichier).
-- =============================================================================
