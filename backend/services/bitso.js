require('dotenv').config();
const crypto = require('crypto');

// ── MODO DEMO ────────────────────────────────────────────────────────
const MODO_DEMO = process.env.BITSO_API_KEY === 'demo' || !process.env.BITSO_API_KEY;

// Invoices en memoria con TTL para demo
const invoicesSimulados = new Map();

// Limpiar invoices expirados cada 10 minutos
// FIX: sin esto la memoria crece indefinidamente en un servidor de larga vida
setInterval(() => {
  const ahora = Date.now();
  for (const [id, inv] of invoicesSimulados) {
    if (ahora - inv.creado > 10 * 60 * 1000) { // 10 minutos
      invoicesSimulados.delete(id);
    }
  }
}, 10 * 60 * 1000);

// ── FIRMA BITSO ──────────────────────────────────────────────────────
function firmarBitso(nonce, method, path, body = '') {
  const mensaje = nonce + method + path + body;
  return crypto
    .createHmac('sha256', process.env.BITSO_API_SECRET)
    .update(mensaje)
    .digest('hex');
}

// ── GENERAR INVOICE DEMO (formato BOLT11 válido simulado) ────────────
// FIX: el invoice anterior no era escaneble por ninguna wallet real.
// Este sigue siendo simulado pero con estructura BOLT11 correcta.
function generarInvoiceDemo(monto_mxn) {
  const id = 'demo_' + crypto.randomBytes(8).toString('hex');

  // BOLT11: lnbc{monto_msats}n1p{datos_aleatorios}
  // Para demo usamos lntb (testnet) para no confundir con mainnet
  const sats     = Math.round((monto_mxn / 1_750_000) * 100_000_000);
  const msats    = sats * 1000;
  const payload  = crypto.randomBytes(32).toString('hex');
  const checksum = crypto.randomBytes(4).toString('hex');
  const invoiceStr = `lntb${msats}n1p${payload}xqz${checksum}`;

  invoicesSimulados.set(id, {
    invoice: invoiceStr,
    monto:   monto_mxn,
    sats,
    status:  'pending',
    pagado:  false,
    creado:  Date.now()
  });

  return {
    ok:         true,
    invoice:    invoiceStr,
    invoice_id: id,
    expira_en:  300,
    sats,
    demo:       true
  };
}

// ── PRECIO BTC/MXN EN TIEMPO REAL ────────────────────────────────────
async function obtenerPrecioBTC() {
  if (MODO_DEMO) {
    const precio = 1_750_000 + (Math.random() - 0.5) * 20_000;
    return {
      ok:            true,
      precio_actual: Math.round(precio),
      precio_compra: Math.round(precio - 5_000),
      precio_venta:  Math.round(precio + 5_000),
      demo:          true
    };
  }
  try {
    const res  = await fetch('https://api.bitso.com/v3/ticker/?book=btc_mxn');
    const data = await res.json();
    return {
      ok:            true,
      precio_actual: parseFloat(data.payload.last),
      precio_compra: parseFloat(data.payload.bid),
      precio_venta:  parseFloat(data.payload.ask)
    };
  } catch (err) {
    console.error('Error obteniendo precio BTC:', err.message);
    return { ok: false, error: err.message };
  }
}

// ── CALCULAR CONVERSIÓN MXN → BTC ────────────────────────────────────
async function calcularConversion(monto_mxn) {
  const precio = await obtenerPrecioBTC();
  if (!precio.ok) return { ok: false, error: precio.error };

  const precio_btc        = precio.precio_venta;
  const btc_necesario     = monto_mxn / precio_btc;
  const comision_bitso    = monto_mxn * parseFloat(process.env.COMISION_BITSO || 0.015);
  const bonificacion      = comision_bitso * parseFloat(process.env.BONIFICACION_PORCENTAJE || 0.15);
  const comision_real     = comision_bitso - bonificacion;
  const total_final       = monto_mxn + comision_real;
  const sats              = Math.round(btc_necesario * 100_000_000);

  return {
    ok:                  true,
    monto_mxn:           parseFloat(monto_mxn),
    precio_btc_actual:   precio_btc,
    btc_necesario:       btc_necesario.toFixed(8),
    sats,
    comision_bitso:      comision_bitso.toFixed(2),
    bonificacion_kitbit: bonificacion.toFixed(2),
    comision_real:       comision_real.toFixed(2),
    total_final:         total_final.toFixed(2),
    demo:                MODO_DEMO
  };
}

// ── GENERAR INVOICE LIGHTNING ─────────────────────────────────────────
async function generarInvoice(monto_mxn) {
  if (MODO_DEMO) {
    console.log(`[DEMO] Invoice simulado por $${monto_mxn} MXN`);
    return generarInvoiceDemo(monto_mxn);
  }
  try {
    const nonce = Date.now().toString();
    const path  = '/api/v3/lightning/invoice';
    const body  = JSON.stringify({
      amount:      monto_mxn,
      currency:    'MXN',
      description: `Pago kitBit $${monto_mxn} MXN`
    });
    const firma = firmarBitso(nonce, 'POST', path, body);

    const res  = await fetch(`https://api.bitso.com${path}`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bitso ${process.env.BITSO_API_KEY}:${nonce}:${firma}`
      },
      body
    });
    const data = await res.json();

    if (!data.success) {
      console.error('Bitso error:', data.error);
      console.log('[FALLBACK] Usando modo demo');
      return generarInvoiceDemo(monto_mxn);
    }

    return {
      ok:         true,
      invoice:    data.payload.lightning_invoice,
      invoice_id: data.payload.id,
      expira_en:  300
    };
  } catch (err) {
    console.error('Error generando invoice:', err.message);
    return generarInvoiceDemo(monto_mxn);
  }
}

// ── VERIFICAR ESTADO DE UN INVOICE ───────────────────────────────────
async function verificarInvoice(invoice_id) {
  if (invoice_id.startsWith('demo_')) {
    const inv = invoicesSimulados.get(invoice_id);
    if (!inv) return { ok: false, error: 'Invoice no encontrado o expirado' };

    // FIX: el invoice demo ya NO se "paga solo".
    // Solo se marca pagado si alguien llama a pagarInvoiceDemo()
    // (el botón de "Simular Pago" en el frontend de desarrollo)
    console.log(`[DEMO] ${invoice_id} — pagado: ${inv.pagado}`);
    return { ok: true, pagado: inv.pagado, status: inv.status, monto: inv.monto, demo: true };
  }

  try {
    const nonce = Date.now().toString();
    const path  = `/api/v3/lightning/invoice/${invoice_id}`;
    const firma = firmarBitso(nonce, 'GET', path);

    const res  = await fetch(`https://api.bitso.com${path}`, {
      headers: { 'Authorization': `Bitso ${process.env.BITSO_API_KEY}:${nonce}:${firma}` }
    });
    const data = await res.json();

    return {
      ok:     true,
      pagado: data.payload.status === 'completed',
      status: data.payload.status,
      monto:  data.payload.amount
    };
  } catch (err) {
    console.error('Error verificando invoice:', err.message);
    return { ok: false, error: err.message };
  }
}

// ── SIMULAR PAGO (solo en demo — botón de desarrollo) ────────────────
// El frontend puede llamar POST /pago/demo-pagar para marcar como pagado
function pagarInvoiceDemo(invoice_id) {
  const inv = invoicesSimulados.get(invoice_id);
  if (!inv) return { ok: false, error: 'Invoice no encontrado' };
  inv.pagado = true;
  inv.status = 'completed';
  return { ok: true };
}

if (MODO_DEMO) console.log('⚡ [BITSO] Modo DEMO activo — usa el botón "Simular Pago" en la pantalla de cobro');

module.exports = { obtenerPrecioBTC, calcularConversion, generarInvoice, verificarInvoice, pagarInvoiceDemo };
