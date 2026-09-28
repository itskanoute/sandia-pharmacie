/**
 * config/alertes.js — Seuils par défaut pour les alertes stock / péremption (e-mail et API).
 * Les jours de péremption peuvent être surchargés via la table `parametres`.
 */

/** Seuils d’alertes métier SAN-DIA */
module.exports = {
  /** Péremption : alerte 5 mois à l’avance (≈ 150 jours) */
  JOURS_ALERTE_PEREMPTION_DEFAUT: 150,
  /** Lot / stock agrégé : alerte quand il reste 50 unités ou moins */
  SEUIL_STOCK_LOT: 50,
};
