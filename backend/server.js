// ── VERIFICAR NODE VERSION ──────────────────────────────────────────
const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.error(`\n❌  kitBit requiere Node.js 18+. Tienes Node ${process.version}\n`);
  process.exit(1);
}

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors    = require('cors');
const path    = require('path');

// ── ADVERTIR si BASE_URL sigue siendo localhost ─────────────────────
if (!process.env.BASE_URL || process.env.BASE_URL.includes('localhost')) {
  console.warn('\n⚠️  ADVERTENCIA: BASE_URL apunta a localhost.');
  console.warn('   Los links de cobro no funcionarán en celulares.');
  console.warn('   Usa ngrok, Railway, Fly.io o tu dominio real.\n');
}

const app = express();

// ── CORS RESTRINGIDO ────────────────────────────────────────────────
// Solo permite el mismo dominio y localhost en desarrollo
const origenesPermitidos = [
  process.env.BASE_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000'
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Permitir sin origin (apps móviles, curl, Postman)
    if (!origin) return cb(null, true);
    if (origenesPermitidos.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error(`CORS bloqueado: ${origin}`));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-API-Key']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── FRONTEND ESTÁTICO ───────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(require('path').join(__dirname, '../frontend/kitBit.html')));
app.use(express.static(path.join(__dirname, '../frontend')));

// ── RUTAS DE API ────────────────────────────────────────────────────
app.use('/pago',        require('./routes/pago'));
app.use('/precio',      require('./routes/precio'));
app.use('/registro',    require('./routes/registro'));
app.use('/sms-entrada', require('./routes/sms-entrada'));
app.use('/suscripcion', require('./routes/suscripciones'));

// ── RUTA DE LA PÁGINA DE COBRO (la que ve el comprador) ────────────
// Esta es la ruta que faltaba: el link del SMS apunta aquí
app.get('/cobro/:invoice_id', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/cobro.html'));
});

// ── RUTA DE SALUD ───────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({
    sistema: '₿ kitBit Backend',
    estado:  'activo',
    version: '2.1.0',
    modo:    process.env.BITSO_API_KEY === 'demo' ? 'DEMO' : 'PRODUCCIÓN',
    node:    process.version,
    hora:    new Date().toLocaleString('es-MX')
  });
});

// ── COMPATIBILIDAD: ruta vieja /api/ticker ──────────────────────────
app.get('/api/ticker', async (req, res) => {
  try {
    const r    = await fetch('https://api.bitso.com/v3/ticker/?book=btc_mxn');
    const data = await r.json();
    res.json(data.payload);
  } catch {
    res.status(500).json({ error: 'Error al consultar precio' });
  }
});

// ── MANEJADOR GLOBAL DE ERRORES ─────────────────────────────────────
// Captura cualquier excepción no manejada en los handlers
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err.message);
  res.status(500).json({ ok: false, error: 'Error interno del servidor' });
});

// ── ARRANCAR ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('');
  console.log('₿  kitBit Backend v2.1 corriendo');
  console.log(`   Local:    http://localhost:${PORT}`);
  console.log(`   Público:  ${process.env.BASE_URL || '⚠️  No configurado'}`);
  console.log(`   Modo:     ${process.env.BITSO_API_KEY === 'demo' ? '⚡ DEMO' : '🟢 PRODUCCIÓN'}`);
  console.log('');
});
