-- Mettre à jour l'e-mail admin (codes de connexion)
-- phpMyAdmin → pharmacie_mali → SQL → Exécuter

USE pharmacie_mali;

UPDATE utilisateurs
SET email = 'kanoutecoumba00@gmail.com'
WHERE nom_utilisateur = 'admin';

SELECT id, nom_utilisateur, email, nom_complet FROM utilisateurs WHERE nom_utilisateur = 'admin';
