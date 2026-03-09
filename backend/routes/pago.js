const express              = require('express');
const router               = express.Router();
const validarMonto         = require('../middleware/validarMonto');
const { notificarVendedor }                                           = require('../services/twilio');
const { generarInvoice, verificarInvoice, calcularConversion }       = require('../services/bitso');
const { guardarCobro, marcarPagado, yaNotificado, marcarNotificado } = require('../store/cobros');
const { registrarTransaccion }                                        = require('../services/logger');
const { getTelefonoVendedorActivo }                                   = require('../store/vendedores');

// ── POST /pago ← notificación rápida por SMS (sin Lightning) ────────
// El frontend manda el monto → el vendedor recibe un SMS de aviso
router.post('/', validarMonto, async (req, res, next) => {
  try {
    const monto     = parseFloat(req.body.monto);
    const referencia = `KIN-${Date.now().toString().slice(-6)}`;

    const telefonoVendedor = getTelefonoVendedorActivo();
    const sms = await notificarVendedor(monto, referencia, telefonoVendedor);

    // FIX: solo registrar la transacción si el SMS fue exitoso
    // (antes se registraba antes de saber si el pago ocurrió)
    if (sms.ok) {
      registrarTransaccion(monto, referencia);
      return res.json({ ok: true, referencia, sms_sid: sms.sid });
    }

    // SMS falló → modo demo, NO registrar en log fiscal
    console.log(`⚠️  SMS falló — referencia ${referencia} no registrada`);
    return res.json({ ok: true, demo: true, referencia, advertencia: 'SMS no enviado' });

  } catch (err) {
    next(err);
  }
});

// ── POST /pago/generar-invoice ← genera QR Lightning ───────────────
router.post('/generar-invoice', validarMonto, async (req, res, next) => {
  try {
    const monto   = parseFloat(req.body.monto || req.body.monto_mxn);
    const invoice = await generarInvoice(monto);

    if (!invoice.ok) {
      return res.status(500).json({ ok: false, error: invoice.error });
    }

    guardarCobro(invoice.invoice_id, {
      monto,
      invoice_str:       invoice.invoice,
      expira_en:         invoice.expira_en,
      // Guardar el teléfono del vendedor activo para notificarlo al confirmar el pago
      telefono_vendedor: getTelefonoVendedorActivo()
    });

    res.json({
      ok:         true,
      invoice:    invoice.invoice,
      invoice_id: invoice.invoice_id,
      expira_en:  invoice.expira_en,
      demo:       invoice.demo || false
    });

  } catch (err) {
    next(err);
  }
});

// ── POST /pago/verificar ← polling cada 3s desde el frontend ────────
router.post('/verificar', async (req, res, next) => {
  try {
    const { invoice_id, monto_mxn } = req.body;

    if (!invoice_id) {
      return res.status(400).json({ ok: false, error: 'invoice_id requerido' });
    }

    // Anti-duplicados: si ya fue notificado, no mandar SMS doble
    if (yaNotificado(invoice_id)) {
      return res.json({ ok: true, pagado: true, ya_notificado: true });
    }

    const resultado = await verificarInvoice(invoice_id);
    if (!resultado.ok) {
      return res.status(500).json({ ok: false, error: resultado.error });
    }

    if (resultado.pagado) {
      marcarNotificado(invoice_id);
      marcarPagado(invoice_id);

      const referencia = `KIN-${invoice_id.slice(-6).toUpperCase()}`;
      const montoFinal = monto_mxn || resultado.monto;

      // FIX: recuperar el teléfono del vendedor desde el cobro guardado
      // (antes se llamaba sin teléfono y llegaba al fallback del .env)
      const cobro = require('../store/cobros').obtenerCobro(invoice_id);
      const telefonoVendedor = cobro?.telefono_vendedor || getTelefonoVendedorActivo();

      await notificarVendedor(montoFinal, referencia, telefonoVendedor);
      registrarTransaccion(montoFinal, referencia, { via: 'lightning' });
    }

    res.json({ ok: true, pagado: resultado.pagado, status: resultado.status });

  } catch (err) {
    next(err);
  }
});

// ── GET /pago/invoice/:invoice_id ← cobro.html pide los datos del QR ──
router.get('/invoice/:invoice_id', async (req, res, next) => {
  try {
    const { invoice_id } = req.params;
    const cobro = require('../store/cobros').obtenerCobro(invoice_id);

    if (!cobro) {
      return res.status(404).json({ ok: false, error: 'Cobro no encontrado o expirado' });
    }

    const { calcularConversion } = require('../services/bitso');
    const calculo = await calcularConversion(cobro.monto);
    const sats    = calculo.ok ? calculo.sats : null;

    res.json({
      ok:        true,
      monto:     cobro.monto,
      invoice:   cobro.invoice_str || '',
      invoice_id,
      expira_en: cobro.expira_en || 300,
      sats,
      demo:      invoice_id.startsWith('demo_')
    });

  } catch (err) {
    next(err);
  }
});

// ── POST /pago/demo-pagar ← botón de simulación (solo en modo demo) ──
router.post('/demo-pagar', async (req, res, next) => {
  try {
    const { invoice_id } = req.body;
    if (!invoice_id || !invoice_id.startsWith('demo_')) {
      return res.status(400).json({ ok: false, error: 'Solo funciona en modo demo' });
    }

    const { pagarInvoiceDemo } = require('../services/bitso');
    const resultado = pagarInvoiceDemo(invoice_id);
    res.json(resultado);

  } catch (err) {
    next(err);
  }
});

// ── POST /pago/calcular ← calculadora de conversión MXN → BTC ──────
router.post('/calcular', validarMonto, async (req, res, next) => {
  try {
    const monto   = parseFloat(req.body.monto || req.body.monto_mxn);
    const calculo = await calcularConversion(monto);

    if (!calculo.ok) {
      return res.status(500).json({ ok: false, error: calculo.error });
    }

    res.json({ ok: true, ...calculo });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
