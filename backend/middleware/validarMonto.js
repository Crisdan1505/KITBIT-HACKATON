// Middleware que valida que el monto sea un número positivo dentro del rango permitido

function validarMonto(req, res, next) {
  const raw   = req.body.monto ?? req.body.monto_mxn;
  const monto = parseFloat(raw);

  if (isNaN(monto) || monto <= 0) {
    return res.status(400).json({
      ok:    false,
      error: 'El monto debe ser un número mayor a cero'
    });
  }

  if (monto < 1) {
    return res.status(400).json({
      ok:    false,
      error: 'El monto mínimo es $1 MXN'
    });
  }

  if (monto > 50000) {
    return res.status(400).json({
      ok:    false,
      error: 'El monto máximo por transacción es $50,000 MXN'
    });
  }

  // Normalizar el valor en el body para que los handlers reciban un número limpio
  req.body.monto     = monto;
  req.body.monto_mxn = monto;

  next();
}

module.exports = validarMonto;
