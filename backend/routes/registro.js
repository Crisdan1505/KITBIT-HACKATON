const express = require('express');
const router  = express.Router();

// FIX: imports al top del archivo, no dentro de los handlers
const { vendedores, setVendedorActivo, getVendedorActivo } = require('../store/vendedores');

// ── POST /registro ← guarda datos del vendedor ──────────────────────
router.post('/', (req, res) => {
  const { nombre, telefono, ciudad } = req.body;

  if (!nombre || !telefono) {
    return res.status(400).json({ ok: false, error: 'Nombre y teléfono son requeridos' });
  }

  // FIX: validación de teléfono en formato E.164 (+52XXXXXXXXXX)
  // Acepta tanto +521234567890 como 1234567890 (se normaliza)
  const telLimpio = telefono.replace(/\D/g, ''); // quitar todo lo que no sea número
  if (telLimpio.length < 10 || telLimpio.length > 13) {
    return res.status(400).json({
      ok: false,
      error: 'Teléfono inválido. Usa formato: +521234567890 o 10 dígitos'
    });
  }

  // Normalizar a formato E.164
  const telNormalizado = telLimpio.startsWith('52')
    ? `+${telLimpio}`
    : `+52${telLimpio}`;

  const id = `VEN-${Date.now().toString().slice(-6)}`;
  const vendedor = {
    id,
    nombre:        nombre.trim(),
    telefono:      telNormalizado,
    ciudad:        (ciudad || 'No especificada').trim(),
    registrado_en: new Date().toISOString()
  };

  vendedores.set(id, vendedor);

  // Guardar también por teléfono para lookup rápido en sms-entrada
  vendedores.set(telNormalizado, vendedor);

  setVendedorActivo(id);

  console.log(`✅ Vendedor: ${nombre} — ${telNormalizado.replace(/(\+\d{2})(\d{4})(\d{4})(\d*)/, '$1****$4')}`);

  res.json({ ok: true, id, nombre, telefono: telNormalizado, mensaje: 'Vendedor registrado' });
});

// ── GET /registro/activo ─────────────────────────────────────────────
router.get('/activo', (req, res) => {
  const vendedor = getVendedorActivo();

  if (!vendedor) {
    return res.json({ ok: false, mensaje: 'No hay vendedor registrado' });
  }

  res.json({
    ok:                  true,
    nombre:              vendedor.nombre,
    ciudad:              vendedor.ciudad,
    telefono_enmascarado: vendedor.telefono.replace(/(\+\d{2})(\d{4})(\d{4})(\d*)/, '$1****$4')
  });
});

module.exports = router;
