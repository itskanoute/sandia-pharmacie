-- =============================================================================
-- Mise à jour MySQL — pharmacie_mali
-- À exécuter SI la base existe déjà (créée avec une ancienne version du schéma)
-- =============================================================================
-- phpMyAdmin : sélectionner la base pharmacie_mali → onglet SQL → coller / importer
-- Si une colonne existe déjà, MySQL affichera une erreur : ignorer cette ligne.
-- =============================================================================

USE pharmacie_mali;

-- Identité de l'établissement
UPDATE parametres
SET nom_pharmacie = 'SAN-DIA Distribution'
WHERE id = 1;

-- Contrôle à la réception : nom, référence, prix, état (cahier des charges)
ALTER TABLE lignes_reception
    ADD COLUMN designation VARCHAR(255) NULL COMMENT 'nom du produit' AFTER appareil_id;

ALTER TABLE lignes_reception
    ADD COLUMN reference_produit VARCHAR(100) NULL AFTER designation;

ALTER TABLE lignes_reception
    ADD COLUMN prix_achat_unitaire INT UNSIGNED NULL COMMENT 'FCFA' AFTER reference_produit;

ALTER TABLE lignes_reception
    ADD COLUMN etat_produit VARCHAR(50) NULL COMMENT 'état constaté à la réception' AFTER date_peremption;

-- =============================================================================
-- Vérification rapide (optionnel)
-- =============================================================================
-- SHOW TABLES;
-- DESCRIBE lignes_reception;
-- SELECT * FROM roles;
-- SELECT * FROM parametres;
