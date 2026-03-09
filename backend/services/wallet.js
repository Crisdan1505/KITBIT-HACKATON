// Servicio de wallets (para uso futuro)
// En v2.1 la lógica de wallet vive en el frontend (simulada)
// Este archivo queda como placeholder para cuando se integre wallet real

const wallets = new Map();

function registrarWallet(vendedorId, datos) {
  wallets.set(vendedorId, { ...datos, creado: new Date().toISOString() });
}

function obtenerWallet(vendedorId) {
  return wallets.get(vendedorId) || null;
}

module.exports = { registrarWallet, obtenerWallet };
