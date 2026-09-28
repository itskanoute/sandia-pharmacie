/**
 * Script utilitaire (one-shot) : enrichit les fichiers backend/src/*.js
 * avec des commentaires // en français avant routes, SQL, if/else, try/catch, exports.
 * Ne modifie pas la logique — n'ajoute que des lignes de commentaire.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function listJsFiles(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === '_denseCommentHelper.js') continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) listJsFiles(full, acc);
    else if (name.endsWith('.js')) acc.push(full);
  }
  return acc;
}

function prevIsComment(lines, i) {
  if (i <= 0) return false;
  const p = lines[i - 1].trim();
  return p.startsWith('//') || p.startsWith('*') || p.startsWith('/**') || p.endsWith('*/');
}

function commentForLine(line) {
  const t = line.trim();
  if (/^router\.(get|post|put|delete|patch|use)\s*\(/.test(t)) {
    const m = t.match(/^router\.(\w+)/);
    return `// Route Express (${m ? m[1].toUpperCase() : 'HTTP'}) — point d'entrée API décrit ci-dessous.`;
  }
  if (/^app\.(get|post|use|listen)\s*\(/.test(t)) {
    return '// Configuration Express : middleware, route ou démarrage du serveur HTTP.';
  }
  if (/\.execute\s*\(/.test(t) && /SELECT|INSERT|UPDATE|DELETE|CREATE|FROM/i.test(t + line)) {
    if (/SELECT/i.test(t)) return '// Requête SQL SELECT : lecture en base MySQL via le pool partagé.';
    if (/INSERT/i.test(t)) return '// Requête SQL INSERT : création d\'enregistrement(s) en base.';
    if (/UPDATE/i.test(t)) return '// Requête SQL UPDATE : mise à jour de colonnes existantes.';
    if (/DELETE/i.test(t)) return '// Requête SQL DELETE : suppression d\'enregistrement(s).';
    if (/CREATE/i.test(t)) return '// Requête SQL DDL : création de structure si migration absente.';
    return '// Exécution SQL paramétrée (mysql2) — requête préparée avec placeholders ?.';
  }
  if (/^await connection\.beginTransaction/.test(t))
    return '// Début de transaction MySQL : toutes les écritures suivantes seront atomiques.';
  if (/^await connection\.commit/.test(t))
    return '// Validation transaction : persistance définitive des modifications en base.';
  if (/^await connection\.rollback/.test(t))
    return '// Annulation transaction : aucune modification partielle ne reste en base.';
  if (/^try\s*\{/.test(t)) return '// Bloc try : tente l\'opération ; les erreurs iront au catch ou au middleware.';
  if (/^}\s*catch\s*\(/.test(t)) return '// Bloc catch : intercepte l\'erreur pour réponse HTTP ou rethrow.';
  if (/^}\s*catch\s*\{/.test(t)) return '// Bloc catch sans paramètre : erreur ignorée ou schéma partiel.';
  if (/^}\s*finally\s*\{/.test(t)) return '// Bloc finally : libération ressource (connexion) quel que soit le succès.';
  if (/^if\s*\(/.test(t)) return '// Condition if : branche exécutée uniquement si l\'expression est vraie.';
  if (/^}\s*else if\s*\(/.test(t)) return '// Branche else if : alternative testée si les conditions précédentes ont échoué.';
  if (/^}\s*else\s*\{/.test(t)) return '// Branche else : cas par défaut lorsque le if (et else if) sont faux.';
  if (/^else\s*\{/.test(t)) return '// Branche else : cas par défaut lorsque la condition if est fausse.';
  if (/^for\s*\(/.test(t)) return '// Boucle for : itération sur une collection ou un compteur.';
  if (/^module\.exports\s*=/.test(t))
    return '// Export CommonJS : expose le module aux require() des autres fichiers.';
  if (/^return res\.status\(400\)/.test(t))
    return '// Réponse HTTP 400 : données client invalides (validation métier).';
  if (/^return res\.status\(401\)/.test(t))
    return '// Réponse HTTP 401 : authentification refusée ou session invalide.';
  if (/^return res\.status\(403\)/.test(t))
    return '// Réponse HTTP 403 : droits insuffisants pour cette action.';
  if (/^return res\.status\(404\)/.test(t))
    return '// Réponse HTTP 404 : ressource demandée introuvable en base.';
  if (/^return res\.status\(409\)/.test(t))
    return '// Réponse HTTP 409 : conflit (doublon, contrainte unique).';
  if (/^return res\.status\(503\)/.test(t))
    return '// Réponse HTTP 503 : service indisponible (migration SQL manquante, mail).';
  if (/^return res\.status\(500\)/.test(t))
    return '// Réponse HTTP 500 : erreur serveur non gérée côté client.';
  if (/^return res\.status\(201\)/.test(t))
    return '// Réponse HTTP 201 : ressource créée avec succès.';
  if (/^res\.json\(/.test(t) && !/^return/.test(t))
    return '// Corps JSON de réponse HTTP (succès ou liste).';
  if (/^throw /.test(t)) return '// Propagation erreur : remonte au catch ou middleware global.';
  return null;
}

function enrich(content) {
  const lines = content.split('\n');
  const out = [];
  let inBlockComment = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trim = line.trim();
    if (trim.startsWith('/*')) inBlockComment = !trim.includes('*/') || trim.indexOf('*/') > trim.indexOf('/*') + 1 ? true : inBlockComment;
    if (inBlockComment && trim.includes('*/')) inBlockComment = false;
    if (!inBlockComment) {
      const c = commentForLine(line);
      if (c && !prevIsComment(lines, i) && !trim.startsWith('//')) {
        const indent = line.match(/^(\s*)/)[1];
        out.push(`${indent}${c}`);
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

function main() {
  const files = listJsFiles(ROOT).filter((f) => !f.includes(`${path.sep}scripts${path.sep}_dense`));
  for (const file of files) {
    const before = fs.readFileSync(file, 'utf8');
    const after = enrich(before);
    if (after !== before) fs.writeFileSync(file, after, 'utf8');
  }
  console.log('Commentaires enrichis pour', files.length, 'fichiers.');
}

main();
