// Store de suscripciones en memoria
// FIX: antes era código muerto. Ahora está conectado a routes/suscripciones.js

const suscripciones = new Map(); // telefono → datos suscripcion

const DURACION_DIAS = 30;

function activarSuscripcion(telefono) {
  const ahora    = new Date();
  const vence    = new Date(ahora.getTime() + DURACION_DIAS * 24 * 60 * 60 * 1000);

  const sub = {
    telefono,
    activa:       true,
    activada_en:  ahora.toISOString(),
    vence_en:     vence.toISOString(),
    bonificacion: parseFloat(process.env.BONIFICACION_PORCENTAJE || 0.15)
  };

  suscripciones.set(telefono, sub);
  console.log(`✅ Suscripción activada: ${telefono} — vence ${vence.toLocaleDateString('es-MX')}`);
  return sub;
}

function tieneSuscripcionActiva(telefono) {
  const sub = suscripciones.get(telefono);
  if (!sub) return false;
  return sub.activa && new Date(sub.vence_en) > new Date();
}

function obtenerSuscripcion(telefono) {
  return suscripciones.get(telefono) || null;
}

module.exports = { activarSuscripcion, tieneSuscripcionActiva, obtenerSuscripcion };
