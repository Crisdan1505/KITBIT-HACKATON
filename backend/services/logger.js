const fs   = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, '../logs/transacciones.json');

// FIX: lock en memoria para evitar race conditions al escribir
// Si dos pagos llegan al mismo tiempo, el segundo espera en cola
let escribiendo = false;
const cola      = [];

// Asegurar que el directorio de logs exista
function asegurarDirectorio() {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Leer transacciones existentes de forma segura
function leerTransacciones() {
  try {
    if (!fs.existsSync(LOG_PATH)) return [];
    const raw = fs.readFileSync(LOG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Escribir de forma atómica: escribir a .tmp y luego rename
// Si el proceso muere en medio, el archivo original queda intacto
function escribirAtomico(datos) {
  asegurarDirectorio();
  const tmp = LOG_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(datos, null, 2), 'utf8');
  fs.renameSync(tmp, LOG_PATH);
}

// Procesar la cola de escrituras en serie
async function procesarCola() {
  if (escribiendo || cola.length === 0) return;
  escribiendo = true;

  while (cola.length > 0) {
    const { transaccion, resolve } = cola.shift();
    try {
      const existentes = leerTransacciones();
      existentes.push(transaccion);
      escribirAtomico(existentes);
      resolve({ ok: true });
    } catch (err) {
      console.error('❌ Error escribiendo log:', err.message);
      resolve({ ok: false });
    }
  }

  escribiendo = false;
}

// ── API pública ──────────────────────────────────────────────────────
function registrarTransaccion(monto, referencia, extras = {}) {
  const transaccion = {
    referencia,
    monto:      parseFloat(monto),
    fecha:      new Date().toISOString(),
    fecha_mx:   new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
    ...extras
  };

  return new Promise(resolve => {
    cola.push({ transaccion, resolve });
    procesarCola();
  });
}

function obtenerTransacciones() {
  return leerTransacciones();
}

module.exports = { registrarTransaccion, obtenerTransacciones };
