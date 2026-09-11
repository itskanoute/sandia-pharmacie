-- Alertes SAN-DIA : péremption 5 mois (150 j) + seuil stock/lots à 50
-- À exécuter dans phpMyAdmin sur la base pharmacie_mali

UPDATE parametres
SET jours_alerte_peremption = 150;

UPDATE medicaments
SET seuil_alerte = 50
WHERE seuil_alerte IS NULL OR seuil_alerte < 50;
