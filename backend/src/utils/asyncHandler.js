/**
 * asyncHandler.js — Enveloppe les gestionnaires de routes async Express.
 * Transmet les rejets de Promise au middleware d’erreurs global (évite try/catch répétitifs).
 */

/** @param {Function} fn — Handler async (req, res, next) */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** Wrapper routes async Express. */
module.exports = { asyncHandler };
