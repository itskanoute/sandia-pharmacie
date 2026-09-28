/**
 * routes/parametres.js — Paramètres établissement (SAN-DIA) et seuils alertes.
 * Préfixe API : /api/parametres — ligne unique id=1.
 */
const express = require('express');
const { pool } = require('../config/db');
const { authentifier } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();
router.use(authentifier);

/** Valeurs par défaut affichées si champs vides en base. */
const SANDIA = {
  nom_pharmacie: 'SAN-DIA DISTRIBUTION',
  activite: 'Matériels médicaux, réactifs de laboratoire, Commerce général',
  adresse: 'BAMAKO SEBENICORO CEMA 2',
  telephone: '72 17 75 97 / 93 90 15 01',
  nina: '32409194667357E',
  nina_libelle: 'Mali -Bko 2024-A-10188 (NINA)',
  nif: '084148655C',
  centre_impots: 'Commune 4',
};

/** GET / — Lecture parametres + repli sur constantes SANDIA. */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.execute(`SELECT * FROM parametres WHERE id = 1 LIMIT 1`);
    if (!rows[0]) {
      return res.status(404).json({ message: 'Paramètres introuvables.' });
    }
    const p = rows[0];
    res.json({
      ...p,
      nom_pharmacie: p.nom_pharmacie || SANDIA.nom_pharmacie,
      activite: p.activite || SANDIA.activite,
      adresse: p.adresse || SANDIA.adresse,
      telephone: p.telephone || SANDIA.telephone,
      nina: p.nina || SANDIA.nina,
      nina_libelle: p.nina_libelle || SANDIA.nina_libelle,
      nif: p.nif || SANDIA.nif,
      centre_impots: p.centre_impots || SANDIA.centre_impots,
    });
  })
);

/** PUT / — Mise à jour ; blocs NIF/NINA/activité tolèrent schéma partiel (try/catch). */
router.put(
  '/',
  asyncHandler(async (req, res) => {
    await pool.execute(
      `UPDATE parametres SET
         nom_pharmacie = ?,
         adresse = ?,
         telephone = ?,
         devise = ?,
         libelle_devise = ?,
         fuseau_horaire = ?,
         jours_alerte_peremption = ?,
         jour_cloture_semaine = ?
       WHERE id = 1`,
      [
        String(req.body.nom_pharmacie || SANDIA.nom_pharmacie).trim(),
        String(req.body.adresse || SANDIA.adresse).trim() || null,
        String(req.body.telephone || SANDIA.telephone).trim() || null,
        String(req.body.devise || 'XOF').trim() || 'XOF',
        String(req.body.libelle_devise || 'FCFA').trim() || 'FCFA',
        String(req.body.fuseau_horaire || 'Africa/Bamako').trim() || 'Africa/Bamako',
        Number(req.body.jours_alerte_peremption) || 150,
        Number.isFinite(Number(req.body.jour_cloture_semaine))
          ? Number(req.body.jour_cloture_semaine)
          : 6,
      ]
    );

    try {
      await pool.execute(
        `UPDATE parametres SET nina = ?, nif = ?, centre_impots = ? WHERE id = 1`,
        [
          String(req.body.nina || SANDIA.nina).trim() || null,
          String(req.body.nif || SANDIA.nif).trim() || null,
          String(req.body.centre_impots || SANDIA.centre_impots).trim() || null,
        ]
      );
    } catch {
      /* colonnes absentes */
    }

    try {
      await pool.execute(
        `UPDATE parametres SET activite = ?, nina_libelle = ? WHERE id = 1`,
        [
          String(req.body.activite || SANDIA.activite).trim() || null,
          String(req.body.nina_libelle || SANDIA.nina_libelle).trim() || null,
        ]
      );
    } catch {
      /* colonnes absentes — importer update_infos_sandia.sql */
    }

    const [rows] = await pool.execute(`SELECT * FROM parametres WHERE id = 1`);
    res.json({ ...SANDIA, ...rows[0] });
  })
);

/** Router paramètres → /api/parametres */
module.exports = router;
