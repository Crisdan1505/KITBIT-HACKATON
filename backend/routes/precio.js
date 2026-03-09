const express = require('express');
const router  = express.Router();
const { obtenerPrecioBTC } = require('../services/bitso');

// ── GET /precio/btc-mxn ─────────────────────────────────────────────
router.get('/btc-mxn', async (req, res, next) => {
  try {
    const precio = await obtenerPrecioBTC();

    if (!precio.ok) {
      // Fallback si Bitso falla
      return res.json({
        ok:            false,
        precio_actual: 1_800_000,
        fallback:      true,
        mensaje:       'Usando precio de respaldo'
      });
    }

    res.json({ ok: true, ...precio });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
