const express = require('express');
const { pool } = require('../config/db');
const { authentifier } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();
router.use(authentifier);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const actif = req.query.actif;
    const type = String(req.query.type || '').trim();

    let sql = `SELECT id, nom, telephone, adresse, type_client, informations, actif,
                      created_at, updated_at
               FROM clients WHERE 1=1`;
    const params = [];

    if (q) {
      sql += ` AND (nom LIKE ? OR telephone LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }
    if (type === 'ordinaire' || type === 'revendeur') {
      sql += ` AND type_client = ?`;
      params.push(type);
    }
    if (actif === '0' || actif === '1') {
      sql += ` AND actif = ?`;
      params.push(Number(actif));
    }

    sql += ` ORDER BY nom ASC`;
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      `SELECT id, nom, telephone, adresse, type_client, informations, actif,
              created_at, updated_at
       FROM clients WHERE id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Client introuvable.' });
    res.json(rows[0]);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const nom = String(req.body.nom || '').trim();
    const telephone = String(req.body.telephone || '').trim() || null;
    const adresse = String(req.body.adresse || '').trim() || null;
    const typeClient = req.body.type_client === 'revendeur' ? 'revendeur' : 'ordinaire';
    const informations = String(req.body.informations || '').trim() || null;

    if (!nom) return res.status(400).json({ message: 'Le nom du client est obligatoire.' });

    const [result] = await pool.execute(
      `INSERT INTO clients (nom, telephone, adresse, type_client, informations)
       VALUES (?, ?, ?, ?, ?)`,
      [nom, telephone, adresse, typeClient, informations]
    );

    const [rows] = await pool.execute(`SELECT * FROM clients WHERE id = ?`, [result.insertId]);
    res.status(201).json(rows[0]);
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const nom = String(req.body.nom || '').trim();
    const telephone = String(req.body.telephone || '').trim() || null;
    const adresse = String(req.body.adresse || '').trim() || null;
    const typeClient = req.body.type_client === 'revendeur' ? 'revendeur' : 'ordinaire';
    const informations = String(req.body.informations || '').trim() || null;
    const actif = req.body.actif === 0 || req.body.actif === false ? 0 : 1;

    if (!nom) return res.status(400).json({ message: 'Le nom du client est obligatoire.' });

    const [result] = await pool.execute(
      `UPDATE clients
       SET nom = ?, telephone = ?, adresse = ?, type_client = ?, informations = ?, actif = ?
       WHERE id = ?`,
      [nom, telephone, adresse, typeClient, informations, actif, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Client introuvable.' });
    }

    const [rows] = await pool.execute(`SELECT * FROM clients WHERE id = ?`, [req.params.id]);
    res.json(rows[0]);
  })
);

module.exports = router;
