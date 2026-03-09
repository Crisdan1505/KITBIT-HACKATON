require('dotenv').config();
const twilio = require('twilio');

const MODO_DEMO = !process.env.TWILIO_AUTH_TOKEN ||
  process.env.TWILIO_AUTH_TOKEN === 'el_que_copiaste_con_show';

let client = null;

function getClient() {
  if (!client && !MODO_DEMO) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return client;
}

// ── Envía SMS al vendedor cuando se confirma un pago ────────────────
// FIX: ahora recibe telefonoVendedor como parámetro (antes solo usaba VENDOR_PHONE)
async function notificarVendedor(monto, referencia, telefonoVendedor) {
  const destino = telefonoVendedor || process.env.VENDOR_PHONE;

  if (!destino || destino === '+52TuCelular') {
    console.warn(`⚠️  [Twilio] Teléfono destino no configurado — referencia: ${referencia}`);
    return { ok: false, demo: true };
  }

  const mensaje =
    `₿ kitBit — Pago recibido!\n` +
    `Monto: $${Number(monto).toFixed(2)} MXN\n` +
    `Ref: ${referencia}`;

  if (MODO_DEMO) {
    console.log(`[DEMO SMS → ${destino}]\n${mensaje}\n`);
    return { ok: true, demo: true, sid: 'DEMO' };
  }

  try {
    const msg = await getClient().messages.create({
      body: mensaje,
      from: process.env.TWILIO_PHONE,
      to:   destino
    });
    console.log(`✅ SMS enviado a ${destino} — ${msg.sid}`);
    return { ok: true, sid: msg.sid };
  } catch (err) {
    console.error(`❌ Error Twilio:`, err.message);
    return { ok: false, error: err.message };
  }
}

// ── Responde a un SMS entrante del vendedor ──────────────────────────
async function responderVendedor(destino, mensaje) {
  if (MODO_DEMO) {
    console.log(`[DEMO RESPUESTA SMS → ${destino}]\n${mensaje}\n`);
    return { ok: true, demo: true };
  }

  try {
    const msg = await getClient().messages.create({
      body: mensaje,
      from: process.env.TWILIO_PHONE,
      to:   destino
    });
    return { ok: true, sid: msg.sid };
  } catch (err) {
    console.error(`❌ Error Twilio respuesta:`, err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { notificarVendedor, responderVendedor };
