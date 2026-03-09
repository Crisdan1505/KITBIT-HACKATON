// Store de cobros en memoria
// FIX: se agrega obtenerCobro() para recuperar el teléfono del vendedor al confirmar pago
// FIX: limpieza automática de cobros viejos para evitar memory leak

const cobros      = new Map(); // invoice_id → { monto, telefono_vendedor, ... }
const notificados = new Set(); // invoice_ids ya notificados (anti-duplicados)

// Limpiar cobros mayores a 30 minutos
setInterval(() => {
  const limite = Date.now() - 30 * 60 * 1000;
  for (const [id, cobro] of cobros) {
    if (cobro.creado < limite) cobros.delete(id);
  }
}, 15 * 60 * 1000);

function guardarCobro(invoice_id, datos) {
  cobros.set(invoice_id, { ...datos, creado: Date.now(), pagado: false });
}

function obtenerCobro(invoice_id) {
  return cobros.get(invoice_id) || null;
}

function marcarPagado(invoice_id) {
  const cobro = cobros.get(invoice_id);
  if (cobro) cobros.set(invoice_id, { ...cobro, pagado: true });
}

function yaNotificado(invoice_id) {
  return notificados.has(invoice_id);
}

function marcarNotificado(invoice_id) {
  notificados.add(invoice_id);
}

module.exports = { guardarCobro, obtenerCobro, marcarPagado, yaNotificado, marcarNotificado };
