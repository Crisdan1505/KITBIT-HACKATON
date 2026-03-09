const express = require('express');
const router  = express.Router();
const { activarSuscripcion, tieneSuscripcionActiva, obtenerSuscripcion } = require('../store/suscripciones');
const { generarInvoice, verificarInvoice }                               = require('../services/bitso');
const { guardarCobro, yaNotificado, marcarNotificado, marcarPagado }     = require('../store/cobros');
const { registrarTransaccion }                                            = require('../services/logger');
const { getTelefonoVendedorActivo }                                       = require('../store/vendedores');

// ── POST /suscripcion/iniciar ← genera un invoice para pagar la suscripción
router.post('/iniciar', async (req, res, next) => {
  try {
    const { telefono } = req.body;
    if (!telefono) {
      return res.status(400).json({ ok: false, error: 'Teléfono requerido' });
    }

    // Verificar si ya tiene suscripción activa
    if (tieneSuscripcionActiva(telefono)) {
      const sub = obtenerSuscripcion(telefono);
      return res.json({
        ok:       true,
        activa:   true,
        mensaje:  'Ya tienes una suscripción activa',
        vence_en: sub.vence_en
      });
    }

    const monto   = parseFloat(process.env.PRECIO_SUSCRIPCION_MXN || 350);
    const invoice = await generarInvoice(monto);

    if (!invoice.ok) {
      return res.status(500).json({ ok: false, error: invoice.error });
    }

    // Guardar con metadata de suscripción
    guardarCobro(invoice.invoice_id, {
      monto,
      tipo:              'suscripcion',
      telefono_vendedor: getTelefonoVendedorActivo(),
      telefono_suscriptor: telefono
    });

    res.json({
      ok:         true,
      invoice:    invoice.invoice,
      invoice_id: invoice.invoice_id,
      monto,
      expira_en:  invoice.expira_en,
      demo:       invoice.demo || false
    });

  } catch (err) {
    next(err);
  }
});

// ── POST /suscripcion/verificar ← el frontend hace polling aquí ──────
router.post('/verificar', async (req, res, next) => {
  try {
    const { invoice_id, telefono } = req.body;

    if (!invoice_id || !telefono) {
      return res.status(400).json({ ok: false, error: 'invoice_id y telefono requeridos' });
    }

    if (yaNotificado(invoice_id)) {
      return res.json({ ok: true, pagado: true, activa: true });
    }

    const resultado = await verificarInvoice(invoice_id);
    if (!resultado.ok) {
      return res.status(500).json({ ok: false, error: resultado.error });
    }

    if (resultado.pagado) {
      marcarNotificado(invoice_id);
      marcarPagado(invoice_id);

      // Activar la suscripción del usuario
      const sub = activarSuscripcion(telefono);

      const ref = `SUB-${invoice_id.slice(-6).toUpperCase()}`;
      registrarTransaccion(resultado.monto || process.env.PRECIO_SUSCRIPCION_MXN, ref, {
        tipo: 'suscripcion', telefono
      });

      return res.json({ ok: true, pagado: true, activa: true, vence_en: sub.vence_en });
    }

    res.json({ ok: true, pagado: false, activa: false });

  } catch (err) {
    next(err);
  }
});

// ── GET /suscripcion/estado?telefono=+521234... ───────────────────────
router.get('/estado', (req, res) => {
  const { telefono } = req.query;
  if (!telefono) {
    return res.status(400).json({ ok: false, error: 'Parámetro telefono requerido' });
  }

  const activa = tieneSuscripcionActiva(telefono);
  const sub    = obtenerSuscripcion(telefono);

  res.json({
    ok:     true,
    activa,
    datos:  sub || null
  });
});

module.exports = router;
