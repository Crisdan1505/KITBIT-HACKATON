// Store de vendedores en memoria
// FIX: ahora soporta múltiples vendedores
// FIX: lookup por teléfono para validar SMS entrantes

const vendedores      = new Map(); // id → datos del vendedor
const telIndex        = new Map(); // telefono → id del vendedor
let   vendedorActivoId = null;

function setVendedorActivo(id) {
  vendedorActivoId = id;
}

function getVendedorActivo() {
  if (!vendedorActivoId) return null;
  return vendedores.get(vendedorActivoId) || null;
}

function getTelefonoVendedorActivo() {
  const v = getVendedorActivo();
  return v?.telefono || process.env.VENDOR_PHONE || null;
}

// Guardar vendedor e indexar por teléfono
function guardarVendedor(id, datos) {
  vendedores.set(id, datos);
  telIndex.set(datos.telefono, id);
}

// Verificar si un teléfono pertenece a un vendedor registrado
function esTelefonoRegistrado(telefono) {
  return telIndex.has(telefono);
}

// Obtener vendedor por teléfono
function getVendedorPorTelefono(telefono) {
  const id = telIndex.get(telefono);
  return id ? vendedores.get(id) : null;
}

module.exports = {
  vendedores,
  setVendedorActivo,
  getVendedorActivo,
  getTelefonoVendedorActivo,
  guardarVendedor,
  esTelefonoRegistrado,
  getVendedorPorTelefono
};
