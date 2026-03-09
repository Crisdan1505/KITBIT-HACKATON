const express                        = require('express');
const router                         = express.Router();
const twilio                         = require('twilio');
const { responderVendedor }          = require('../services/twilio');
const { generarInvoice }             = require('../services/bitso');
const { guardarCobro }               = require('../store/cobros');
const { esTelefonoRegistrado }       = require('../store/vendedores');

// ── VALIDACIÓN DE FIRMA DE TWILIO ────────────────────────────────────
// FIX: sin esta validación cualquiera puede hacerse pasar por Twilio
// y generar invoices o agotar tu cuenta de Bitso
function validarFirmaTwilio(req, res, next) {
  // En modo demo (sin credenciales reales) omitir la validación
  if (process.env.TWILIO_AUTH_TOKEN === 'el_que_copiaste_con_show' ||
      !process.env.TWILIO_AUTH_TOKEN) {
    console.warn('⚠️  [SMS] Validación de firma Twilio omitida (modo demo)');
    return next();
  }

  const firma    = req.headers['x-twilio-signature'];
  const url      = `${process.env.BASE_URL}/sms-entrada`;
  const params   = req.body;
  const valido   = twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN,
    firma,
    url,
    params
  );

  if (!valido) {
    console.warn('🚨 [SMS] Petición rechazada: firma Twilio inválida');
    return res.status(403).send('Forbidden');
  }

  next();
}

// ── POST /sms-entrada ← Twilio llama esto cuando llega un SMS ───────
router.post('/', validarFirmaTwilio, async (req, res) => {
  const { Body, From } = req.body;

  if (!Body || !From) {
    return res.status(400).send('Datos incompletos');
  }

  // FIX: verificar que el número que manda el SMS esté registrado como vendedor
  // Sin esto, cualquiera que consiga el número de Twilio puede generar cobros
  if (!esTelefonoRegistrado(From)) {
    console.warn(`🚨 [SMS] Número no registrado intentó usar el sistema: ${From}`);
    await responderVendedor(From,
      `KinBit ₿ — Número no autorizado. Regístrate en ${process.env.BASE_URL}`
    );
    return res.send('ok');
  }

  const monto = parseFloat(Body.trim());

  // Si no es un número válido, instruir al vendedor
  if (isNaN(monto) || monto <= 0) {
    await responderVendedor(From,
      `KinBit ₿ — Manda el monto en MXN.\nEjemplo: "150"\nPara cobrar $150 pesos.`
    );
    return res.send('ok');
  }

  // Límite anti-lavado (igual que en validarMonto.js)
  if (monto > 50000) {
    await responderVendedor(From,
      `KinBit ₿ — El monto $${monto} supera el límite de $50,000 MXN.`
    );
    return res.send('ok');
  }

  // Generar invoice Lightning en Bitso
  const invoice = await generarInvoice(monto);

  if (!invoice.ok) {
    await responderVendedor(From,
      `KinBit ₿ — Error al generar cobro. Intenta en un momento.`
    );
    return res.send('ok');
  }

  // Guardar cobro en memoria con el teléfono del vendedor para notificarlo al confirmar
  guardarCobro(invoice.invoice_id, {
    monto,
    telefono_vendedor: From
  });

  // Link que el vendedor le mostrará al comprador
  const link = `${process.env.BASE_URL}/cobro/${invoice.invoice_id}`;
  const mensajeModo = invoice.demo ? ' [DEMO]' : '';

  await responderVendedor(From,
    `KinBit ₿${mensajeModo} — Cobra $${monto} MXN\n` +
    `🔗 ${link}\n` +
    `Muéstrale este link al cliente.\n` +
    `Expira en 5 minutos.`
  );

  res.send('ok');
});

module.exports = router;
