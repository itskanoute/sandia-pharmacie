/** Valeurs par défaut SAN-DIA (si la base n’est pas encore mise à jour). */
export const SANDIA_DEFAUT = {
  nom_pharmacie: 'SAN-DIA DISTRIBUTION',
  activite: 'Matériels médicaux, réactifs de laboratoire, Commerce général',
  adresse: 'BAMAKO SEBENICORO CEMA 2',
  telephone: '73 36 11 10 / 69 67 05 69',
  nina: '32409194667357E',
  nina_libelle: 'Mali -Bko 2024-A-10188 (NINA)',
  nif: '084148655C',
  centre_impots: 'Commune 4',
};

export function parametresAffichage(parametres) {
  const p = parametres || {};
  return {
    ...SANDIA_DEFAUT,
    ...p,
    nom_pharmacie: p.nom_pharmacie || SANDIA_DEFAUT.nom_pharmacie,
    activite: p.activite || SANDIA_DEFAUT.activite,
    adresse: p.adresse || SANDIA_DEFAUT.adresse,
    telephone: p.telephone || SANDIA_DEFAUT.telephone,
    nina: p.nina || SANDIA_DEFAUT.nina,
    nina_libelle: p.nina_libelle || SANDIA_DEFAUT.nina_libelle,
    nif: p.nif || SANDIA_DEFAUT.nif,
    centre_impots: p.centre_impots || SANDIA_DEFAUT.centre_impots,
  };
}
