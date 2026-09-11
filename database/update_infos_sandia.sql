-- Infos officielles SAN-DIA (à exécuter dans phpMyAdmin)
USE pharmacie_mali;

ALTER TABLE parametres
    ADD COLUMN activite VARCHAR(255) NULL AFTER nom_pharmacie;

ALTER TABLE parametres
    ADD COLUMN nina_libelle VARCHAR(150) NULL AFTER nina;

UPDATE parametres
SET
  nom_pharmacie = 'SAN-DIA DISTRIBUTION',
  activite = 'Matériels médicaux, réactifs de laboratoire, Commerce général',
  adresse = 'BAMAKO SEBENICORO CEMA 2',
  telephone = '73 36 11 10 / 69 67 05 69',
  nina = '32409194667357E',
  nina_libelle = 'Mali -Bko 2024-A-10188 (NINA)',
  nif = '084148655C',
  centre_impots = 'Commune 4',
  devise = 'XOF',
  libelle_devise = 'FCFA',
  fuseau_horaire = 'Africa/Bamako'
WHERE id = 1;

SELECT * FROM parametres WHERE id = 1;
