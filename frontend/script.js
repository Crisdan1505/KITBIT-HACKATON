// ═══════════ ESTADO GLOBAL ═══════════
let btcPriceMXN    = 1_750_000;
let walletBalance  = 0.00082340;
let vendedorActivo = null;
let negocioSeleccionado = null;
let invoiceActual  = null;
let simInterval    = null;
let historial      = [];
let metodoRetiroVendedor = 'oxxo';

// ═══════════ NAVEGACIÓN TABS PRINCIPALES ═══════════
function switchTab(name) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-tabs button').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  const map = { inicio:0, aprende:1, como:2, vendedor:3, comprador:4, simulador:5, diagrama:6, pro:7 };
  document.querySelectorAll('.nav-tabs button')[map[name]]?.classList.add('active');
  if (name === 'como') animateFlow();
  window.scrollTo({ top:0, behavior:'smooth' });
}

// ═══════════ NAVEGACIÓN TABS COMPRADOR ═══════════
function switchCompradorTab(name) {
  document.querySelectorAll('.comprador-subtab').forEach(t => t.style.display = 'none');
  document.querySelectorAll('.comprador-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('ctab-' + name).style.display = 'block';
  const map = { wallet:0, pagar:1, historial:2 };
  document.querySelectorAll('.comprador-tab')[map[name]]?.classList.add('active');
  if (name === 'historial') renderHistorial();
}

// ═══════════ PRECIO BTC ═══════════
async function fetchBTCPrice() {
  try {
    const res  = await fetch('/precio/btc-mxn');
    const data = await res.json();
    btcPriceMXN = data.precio_actual || btcPriceMXN;
  } catch {
    btcPriceMXN = 1_750_000 + (Math.random() - 0.5) * 15_000;
  }
  const fmt = btcPriceMXN.toLocaleString('es-MX', { maximumFractionDigits:0 });
  document.getElementById('btcPrice').textContent    = '$' + fmt + ' MXN';
  document.getElementById('appBtcPrice').textContent = '$' + fmt + ' MXN';
  actualizarWallet();
}
fetchBTCPrice();
setInterval(fetchBTCPrice, 60000);

// ═══════════ WALLET ═══════════
function actualizarWallet() {
  const balMXN = walletBalance * btcPriceMXN;
  const sats   = Math.round(walletBalance * 100_000_000);
  document.getElementById('walletBtc').textContent  = walletBalance.toFixed(8) + ' BTC';
  document.getElementById('walletMxn').textContent  = '≈ $' + balMXN.toLocaleString('es-MX',{maximumFractionDigits:2}) + ' MXN';
  document.getElementById('walletSats').textContent = sats.toLocaleString('es-MX') + ' satoshis';
  document.getElementById('bbBtc').textContent = walletBalance.toFixed(8) + ' BTC';
  document.getElementById('bbMxn').textContent = '≈ $' + balMXN.toLocaleString('es-MX',{maximumFractionDigits:2}) + ' MXN';
  verificarAlcanza();
}

function verificarAlcanza() {
  const monto  = parseFloat(document.getElementById('amountInput')?.value) || 0;
  const balMXN = walletBalance * btcPriceMXN;
  const el     = document.getElementById('alcanzaBadge');
  if (!el) return;
  if (monto <= 0 || balMXN >= monto) { el.className = 'alcanza-badge si'; el.textContent = '✓ Te alcanza'; }
  else { el.className = 'alcanza-badge no'; el.textContent = '✗ Saldo insuficiente'; }
}

function abrirModal(id) {
  document.getElementById(id).classList.add('visible');
  if (id === 'modalRecibir') {
    const addr = 'lnbc1kitbit' + Math.random().toString(36).slice(2,20);
    document.getElementById('walletAddr').textContent = addr.slice(0,22) + '...';
    document.getElementById('modalQRImg').src = `https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodeURIComponent(addr)}&margin=6`;
  }
}
function cerrarModal(id) { document.getElementById(id).classList.remove('visible'); }

function simularEnvio() {
  const monto = parseFloat(document.getElementById('montoEnviar').value) || 0;
  if (monto <= 0) return;
  const btcEnviar = monto / btcPriceMXN;
  if (btcEnviar > walletBalance) { alert('Saldo insuficiente'); return; }
  walletBalance -= btcEnviar;
  historial.unshift({ tipo:'salida', desc:'Enviado · Lightning', monto, btc:btcEnviar, fecha:new Date() });
  cerrarModal('modalEnviar');
  actualizarWallet();
  alert('✅ Enviado $' + monto + ' MXN exitosamente');
}

// ═══════════ REGISTRO VENDEDOR ═══════════
let metodoRetiro = 'oxxo';

function seleccionarRetiro(tipo) {
  metodoRetiro = tipo;
  document.getElementById('opcionOXXO').classList.toggle('selected', tipo === 'oxxo');
  document.getElementById('opcionSPEI').classList.toggle('selected', tipo === 'spei');
  document.getElementById('camposOXXO').classList.toggle('visible', tipo === 'oxxo');
  document.getElementById('camposSPEI').classList.toggle('visible', tipo === 'spei');
}

async function registrarVendedor() {
  const nombre  = document.getElementById('regNombre').value.trim();
  const negocio = document.getElementById('regNegocio').value.trim();
  const ciudad  = document.getElementById('regCiudad').value.trim();
  const tel     = document.getElementById('regTelefono').value.trim();
  const bitso   = document.getElementById('regBitso').value.trim();
  const clabe   = document.getElementById('regCLABE').value.trim();

  if (!nombre) { flash('regNombre'); return; }
  if (!negocio) { flash('regNegocio'); return; }
  if (!tel || tel.length < 10) { flash('regTelefono'); return; }
  if (metodoRetiro === 'oxxo' && !bitso) { flash('regBitso'); return; }
  if (metodoRetiro === 'spei' && clabe.length !== 18) { flash('regCLABE'); return; }

  const datos = { nombre, negocio, ciudad, telefono:tel, metodoRetiro, bitso, clabe };

  try {
    const res  = await fetch('/registro', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(datos) });
    const data = await res.json();
    if (data.ok) console.log('✅ Registrado en backend:', data.nombre);
  } catch { console.log('[Demo] Registro simulado para', nombre); }

  vendedorActivo = datos;
  metodoRetiroVendedor = metodoRetiro;

  document.getElementById('numRegistrado').textContent = tel;
  document.getElementById('perfilVendedor').innerHTML = `
    <div class="perfil-row"><span class="pk">Negocio</span><span class="pv">${negocio}</span></div>
    <div class="perfil-row"><span class="pk">Ciudad</span><span class="pv">${ciudad || '—'}</span></div>
    <div class="perfil-row"><span class="pk">Método retiro</span><span class="pv">${metodoRetiro === 'oxxo' ? '🏪 OXXO' : '🏦 SPEI'}</span></div>
    <div class="perfil-row"><span class="pk">${metodoRetiro === 'oxxo' ? 'Bitso' : 'CLABE'}</span><span class="pv">${metodoRetiro === 'oxxo' ? (bitso || '—') : (clabe || '—')}</span></div>`;

  document.getElementById('form-registro').style.display = 'none';
  document.getElementById('exito-registro').style.display = 'block';

  document.getElementById('simVendedor').value = negocio;
  document.getElementById('simCelular').value  = tel;
  document.getElementById('simRetiro').value   = metodoRetiro;
}

function flash(id) {
  const el = document.getElementById(id);
  el.style.borderColor = 'var(--red)';
  setTimeout(() => el.style.borderColor = '', 1500);
}

function nuevoRegistro() {
  ['regNombre','regNegocio','regCiudad','regTelefono','regBitso','regCLABE'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('exito-registro').style.display = 'none';
  document.getElementById('form-registro').style.display = 'block';
}

// ═══════════ BUSCAR NEGOCIO ═══════════
function buscarNegocio(valor) {
  const box = document.getElementById('negocioEncontrado');
  const btn = document.getElementById('btnIrMonto');
  if (valor.length < 2) { box.classList.remove('visible'); btn.disabled = true; return; }

  if (vendedorActivo && (
    vendedorActivo.negocio.toLowerCase().includes(valor.toLowerCase()) ||
    vendedorActivo.nombre.toLowerCase().includes(valor.toLowerCase())
  )) {
    negocioSeleccionado = vendedorActivo;
    document.getElementById('negocioNombre').textContent = vendedorActivo.negocio;
    document.getElementById('negocioInfo').textContent   = vendedorActivo.ciudad + ' · ' + vendedorActivo.nombre;
    box.classList.add('visible');
    btn.disabled = false;
    return;
  }

  if (valor.length >= 3) {
    negocioSeleccionado = { negocio:valor, nombre:'Vendedor Demo', ciudad:'México', telefono:'+521234567890', metodoRetiro:'oxxo', bitso:'demo@example.com' };
    document.getElementById('negocioNombre').textContent = valor;
    document.getElementById('negocioInfo').textContent   = 'México · Vendedor demo';
    box.classList.add('visible');
    btn.disabled = false;
  }
}

// ═══════════ PANTALLA MONTO ═══════════
const amountInput = document.getElementById('amountInput');

function setMonto(v) { amountInput.value = v; updateSats(); verificarAlcanza(); }

function updateSats() {
  const mxn = parseFloat(amountInput.value);
  if (!mxn || mxn <= 0) { document.getElementById('satsDisplay').textContent = '— sats'; return; }
  const sats = Math.round((mxn / btcPriceMXN) * 100_000_000);
  document.getElementById('satsDisplay').textContent = sats.toLocaleString('es-MX') + ' sats';
}

amountInput?.addEventListener('input', () => { updateSats(); verificarAlcanza(); });

function mostrarCalculo() {
  const mxn = parseFloat(amountInput.value);
  if (!mxn || mxn < 1) { amountInput.style.borderColor='var(--red)'; setTimeout(()=>amountInput.style.borderColor='',1500); return; }
  const precioBtc = btcPriceMXN + 5000;
  const btc = mxn / precioBtc;
  const sats = Math.round(btc * 100_000_000);
  const com = mxn * 0.015;
  const bono = com * 0.15;
  const comReal = com - bono;
  const total = mxn + comReal;
  const balMXN = walletBalance * btcPriceMXN;
  document.getElementById('calcMonto').textContent = '$' + mxn.toFixed(2) + ' MXN';
  document.getElementById('calcNegocioLabel').textContent = negocioSeleccionado ? ('Pago a: ' + negocioSeleccionado.negocio) : 'Desglose del cobro';
  document.getElementById('calcPrecioBtc').textContent = '$' + precioBtc.toLocaleString('es-MX',{maximumFractionDigits:0}) + ' MXN';
  document.getElementById('calcBtc').textContent = btc.toFixed(8) + ' BTC';
  document.getElementById('calcSats').textContent = sats.toLocaleString('es-MX') + ' sats';
  document.getElementById('calcCom').textContent = '$' + com.toFixed(2) + ' MXN';
  document.getElementById('calcBono').textContent = '-$' + bono.toFixed(2) + ' MXN';
  document.getElementById('calcComReal').textContent = '$' + comReal.toFixed(2) + ' MXN';
  document.getElementById('calcBalance').textContent = '$' + balMXN.toLocaleString('es-MX',{maximumFractionDigits:2}) + ' MXN';
  document.getElementById('calcTotal').textContent = '$' + total.toFixed(2) + ' MXN';
  showScreen('calculo');
}

// ═══════════ QR ═══════════
function generarInvoiceLocal(mxn) {
  const id = 'demo_' + Math.random().toString(36).slice(2,18);
  const inv = 'lnbc'+Math.round(mxn*100)+'n1p'+Math.random().toString(36).slice(2,12)+'pp5'+Math.random().toString(36).slice(2,40);
  return { id, invoice:inv, mxn, creado:Date.now() };
}

async function generarQR() {
  const mxn = parseFloat(amountInput.value);
  try {
    const res = await fetch('/pago/generar-invoice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({monto:mxn})});
    const data = await res.json();
    invoiceActual = data.ok ? {id:data.invoice_id,invoice:data.invoice,mxn,creado:Date.now()} : generarInvoiceLocal(mxn);
  } catch { invoiceActual = generarInvoiceLocal(mxn); }

  document.getElementById('qrMonto').textContent = '$' + mxn.toFixed(2) + ' MXN · Lightning';
  document.getElementById('qrProgressWrap').classList.remove('show');
  document.getElementById('btnSimular').disabled = false;
  document.getElementById('btnSimular').textContent = '⚡ Simular pago (demo)';
  const qrImg = document.getElementById('qrImg');
  const qrLoading = document.getElementById('qrLoading');
  qrImg.style.display='none'; qrLoading.style.display='flex'; qrLoading.innerHTML='⚡';
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=${encodeURIComponent(invoiceActual.invoice)}&margin=8`;
  showScreen('qr');
}

function copiarInvoice() {
  if (!invoiceActual) return;
  navigator.clipboard.writeText(invoiceActual.invoice).catch(()=>{});
  alert('Invoice copiado al portapapeles');
}

function iniciarSimulacion() {
  if (!invoiceActual) return;
  document.getElementById('btnSimular').disabled = true;
  document.getElementById('btnSimular').textContent = 'Esperando confirmación...';
  document.getElementById('qrProgressWrap').classList.add('show');
  const total = 20_000; const inicio = Date.now();
  simInterval = setInterval(() => {
    const elapsed = Date.now() - inicio;
    const pct = Math.min((elapsed/total)*100,100);
    const seg = Math.max(0,Math.ceil((total-elapsed)/1000));
    document.getElementById('qrProgressFill').style.width = pct + '%';
    document.getElementById('qrSecs').textContent = seg + 's';
    if (elapsed >= total) { clearInterval(simInterval); confirmarPago(); }
  }, 100);
}

function cancelarQR() { clearInterval(simInterval); invoiceActual=null; showScreen('calculo'); }

// ═══════════ CONFIRMAR PAGO ═══════════
function confirmarPago() {
  const mxn = invoiceActual ? invoiceActual.mxn : parseFloat(amountInput.value);
  showScreen('processing');
  document.getElementById('pstep1').className = 'proc-step done';
  document.getElementById('pstep2').className = 'proc-step active';
  document.getElementById('pstep3').className = 'proc-step';
  document.getElementById('pstep4').className = 'proc-step';
  setTimeout(()=>{document.getElementById('pstep2').className='proc-step done';document.getElementById('pstep3').className='proc-step active';},1000);
  setTimeout(()=>{document.getElementById('pstep3').className='proc-step done';document.getElementById('pstep4').className='proc-step active';},2000);
  setTimeout(async ()=>{
    document.getElementById('pstep4').className='proc-step done';
    try { await fetch('/pago',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({monto:mxn})}); }
    catch { console.log('[Demo] SMS simulado $'+mxn+' MXN'); }

    const btcPagado = mxn / btcPriceMXN;
    walletBalance = Math.max(0, walletBalance - btcPagado);
    const sats = Math.round((mxn/btcPriceMXN)*100_000_000);
    const ref  = 'KIN-' + Math.random().toString(36).slice(2,8).toUpperCase();
    const neg  = negocioSeleccionado ? negocioSeleccionado.negocio : 'el vendedor';

    historial.unshift({ tipo:'salida', desc:'Pago · '+neg, monto:mxn, btc:btcPagado, fecha:new Date() });

    document.getElementById('successAmount').textContent = '$'+mxn.toFixed(2)+' MXN';
    document.getElementById('successSats').textContent   = '≈ '+sats.toLocaleString('es-MX')+' sats · Lightning';
    document.getElementById('smsPreview').innerHTML =
      '✅ kitBit — ¡Cobro exitoso!<br/>💰 Monto: <span class="highlight">$'+mxn.toFixed(2)+' MXN</span><br/>🔖 Ref: '+ref+'<br/>🕐 '+new Date().toLocaleTimeString('es-MX');

    generarCodigoRetiro(mxn, ref);
    actualizarWallet();
    showScreen('success');
  }, 3000);
}

function generarCodigoRetiro(mxn, ref) {
  const retiro = negocioSeleccionado?.metodoRetiro || metodoRetiroVendedor || 'oxxo';
  const codigoNum = '7501234' + Math.floor(Math.random()*100000000).toString().padStart(8,'0');

  if (retiro === 'oxxo') {
    const barcodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x80&data=${codigoNum}&margin=6&format=png`;
    document.getElementById('codigoBarrasImg').src = barcodeUrl;
    document.getElementById('codigoBarrasNum').textContent = codigoNum;
  } else {
    const clabe = negocioSeleccionado?.clabe || '012345678901234567';
    document.getElementById('datosSPEI').innerHTML = `
      <div class="spei-row"><span class="sk">Banco destino</span><span class="sv">BANAMEX</span></div>
      <div class="spei-row"><span class="sk">CLABE</span><span class="sv">${clabe}</span></div>
      <div class="spei-row"><span class="sk">Monto</span><span class="sv">$${mxn.toFixed(2)} MXN</span></div>
      <div class="spei-row"><span class="sk">Concepto</span><span class="sv">kitBit ${ref}</span></div>
      <div class="spei-row"><span class="sk">Referencia</span><span class="sv">${ref}</span></div>`;
  }

  mostrarRetiro(retiro);
}

function mostrarRetiro(tipo) {
  document.getElementById('retiroOXXO').classList.toggle('visible', tipo==='oxxo');
  document.getElementById('retiroSPEI').classList.toggle('visible', tipo==='spei');
  document.getElementById('btnRetiroOXXO').classList.toggle('active', tipo==='oxxo');
  document.getElementById('btnRetiroSPEI').classList.toggle('active', tipo==='spei');
}

function resetApp() {
  clearInterval(simInterval); invoiceActual=null;
  amountInput.value='';
  document.getElementById('satsDisplay').textContent='— sats';
  document.getElementById('qrProgressWrap').classList.remove('show');
  document.getElementById('buscarInput').value='';
  document.getElementById('negocioEncontrado').classList.remove('visible');
  document.getElementById('btnIrMonto').disabled=true;
  negocioSeleccionado=null;
  showScreen('buscar');
}

function showScreen(name) {
  document.querySelectorAll('.pos-screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+name).classList.add('active');
}

// ═══════════ HISTORIAL ═══════════
function renderHistorial() {
  const el = document.getElementById('historialTxs');
  if (!historial.length) { el.innerHTML = '<p style="font-size:0.78rem;color:var(--gray);text-align:center;padding:1rem">Sin transacciones aún</p>'; return; }
  el.innerHTML = historial.map(tx => `
    <div class="wallet-tx">
      <div class="wallet-tx-info">
        <div class="wallet-tx-icon ${tx.tipo}">${tx.tipo === 'salida' ? '↗' : '↙'}</div>
        <div>
          <div class="wallet-tx-desc">${tx.desc}</div>
          <div class="wallet-tx-fecha">${tx.fecha.toLocaleDateString('es-MX')}</div>
        </div>
      </div>
      <div class="wallet-tx-monto">
        <div class="wallet-tx-btc ${tx.tipo}">${tx.tipo==='salida'?'-':'+'} ${tx.btc.toFixed(8)}</div>
        <div class="wallet-tx-mxn">${tx.tipo==='salida'?'-':'+'} $${tx.monto.toFixed(2)} MXN</div>
      </div>
    </div>`).join('');
}

// ═══════════ SIMULADOR ═══════════
let simPasoActual = 0;
let simTimer;

function iniciarSim() {
  const monto    = parseFloat(document.getElementById('simMonto').value) || 150;
  const vendedor = document.getElementById('simVendedor').value || 'Tacos Doña María';
  const celular  = document.getElementById('simCelular').value || '+529991234567';
  const retiro   = document.getElementById('simRetiro').value || 'oxxo';
  const btc      = (monto / btcPriceMXN).toFixed(8);
  const sats     = Math.round((monto/btcPriceMXN)*100_000_000);
  const com      = (monto*0.015).toFixed(2);
  const bono     = (monto*0.015*0.15).toFixed(2);
  const comReal  = (monto*0.015*0.85).toFixed(2);
  const ref      = 'KIN-' + Math.random().toString(36).slice(2,8).toUpperCase();
  const invoice  = 'lnbc'+Math.round(monto*100)+'n1p'+Math.random().toString(36).slice(2,10);
  const codigoRetiro = '7501234' + Math.floor(Math.random()*100000000).toString().padStart(8,'0');

  const datos = [
    `Comprador busca "${vendedor}" en la app → Negocio encontrado y verificado ✓`,
    `Monto: $${monto} MXN → ${btc} BTC (${sats.toLocaleString('es-MX')} sats) · Comisión real: $${comReal} MXN (bonificación kitBit: -$${bono})`,
    `Invoice generado: ${invoice}... · Expira en 5 minutos`,
    `Pago Lightning confirmado en 2.3 segundos · TX: ${ref}`,
    `Conversión: ${btc} BTC → $${monto} MXN · Comisión Bitso: $${com} · Ahorro kitBit: $${bono}`,
    `SMS enviado a ${celular}: "✅ kitBit ¡Cobro exitoso! $${monto} MXN · Ref: ${ref}"`,
    retiro === 'oxxo'
      ? `Código OXXO generado: ${codigoRetiro} · Válido 24h en cualquier OXXO del país`
      : `SPEI iniciado → CLABE destino del vendedor · $${monto} MXN · Concepto: kitBit ${ref}`
  ];

  simPasoActual = 0;
  document.querySelectorAll('.sim-paso').forEach(p => p.classList.remove('activo','completado'));
  document.querySelectorAll('[id^="sd"]').forEach(el => el.textContent='');
  document.getElementById('simResultado').classList.remove('visible');
  document.getElementById('simPasos').classList.add('visible');
  clearInterval(simTimer);

  simTimer = setInterval(() => {
    if (simPasoActual >= 7) {
      clearInterval(simTimer);
      document.getElementById('simResultado').classList.add('visible');
      document.getElementById('simResumenTexto').textContent =
        `${vendedor} recibió $${monto} MXN por Lightning. ` +
        `El comprador pagó ${btc} BTC (${sats.toLocaleString('es-MX')} sats). ` +
        (retiro==='oxxo' ? `El vendedor puede retirar su dinero en cualquier OXXO con el código ${codigoRetiro}.` : `El dinero llegará por SPEI a la cuenta del vendedor.`) +
        ` Referencia: ${ref}.`;
      return;
    }
    if (simPasoActual > 0) document.getElementById('spaso'+simPasoActual).classList.replace('activo','completado');
    const paso = document.getElementById('spaso'+(simPasoActual+1));
    paso.classList.add('activo');
    document.getElementById('sd'+(simPasoActual+1)).textContent = datos[simPasoActual];
    simPasoActual++;
  }, 1600);
}

function resetSim() {
  clearInterval(simTimer); simPasoActual=0;
  document.querySelectorAll('.sim-paso').forEach(p=>p.classList.remove('activo','completado'));
  document.querySelectorAll('[id^="sd"]').forEach(el=>el.textContent='');
  document.getElementById('simResultado').classList.remove('visible');
  document.getElementById('simPasos').classList.remove('visible');
}

// ═══════════ ACORDEÓN ═══════════
function toggleConcept(card) {
  const isOpen = card.classList.contains('open');
  document.querySelectorAll('.concept-card').forEach(c=>c.classList.remove('open'));
  if (!isOpen) card.classList.add('open');
}

// ═══════════ PRO FAQ ═══════════
function toggleProFaq(item) {
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.pro-faq-item').forEach(i=>i.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

// ═══════════ QUIZ ═══════════
const questions = [
  {q:'¿Cuántos satoshis tiene un Bitcoin?',opts:['1,000','1,000,000','100,000,000','21,000,000'],correct:2,feedback:'✓ Un Bitcoin = 100 millones de satoshis.'},
  {q:'¿Cuánto tiempo tarda un pago Lightning?',opts:['1-3 días','10-60 min','Menos de 3 seg','1 hora'],correct:2,feedback:'✓ Lightning liquida en menos de 3 segundos.'},
  {q:'¿Quién tiene la app kitBit?',opts:['El vendedor','El dueño del OXXO','El comprador','El banco'],correct:2,feedback:'✓ El comprador usa la app para pagar. El vendedor solo se registra.'},
  {q:'¿Cómo retira su dinero el vendedor sin banco?',opts:['Cajero automático','OXXO con código de barras','Western Union','Transferencia bancaria'],correct:1,feedback:'✓ El vendedor puede cobrar efectivo en cualquier OXXO con su código.'},
  {q:'¿Cuánto cobra Western Union vs kitBit?',opts:['Igual, 0.5%','WU 7-10% vs kitBit 0.5%','Ambos cobran 3%','kitBit cobra más'],correct:1,feedback:'✓ Western Union 7–10% vs kitBit ~0.5%. Un ahorro enorme.'}
];
let currentQ=0,score=0,answered=false;

function loadQuestion() {
  const q=questions[currentQ];
  document.getElementById('qNum').textContent=(currentQ+1)+' / '+questions.length;
  document.getElementById('qScore').textContent='✓ '+score;
  document.getElementById('progressFill').style.width=((currentQ+1)/questions.length*100)+'%';
  document.getElementById('quizQuestion').textContent=q.q;
  document.getElementById('quizFeedback').className='quiz-feedback';
  document.getElementById('quizNext').className='quiz-next';
  answered=false;
  const optsEl=document.getElementById('quizOptions');
  optsEl.innerHTML='';
  q.opts.forEach((opt,i)=>{
    const btn=document.createElement('button');
    btn.className='quiz-option'; btn.textContent=opt;
    btn.onclick=()=>answerQuestion(i,btn);
    optsEl.appendChild(btn);
  });
}

function answerQuestion(idx,btn) {
  if(answered)return; answered=true;
  const q=questions[currentQ]; const fb=document.getElementById('quizFeedback');
  document.querySelectorAll('.quiz-option').forEach(b=>b.style.pointerEvents='none');
  if(idx===q.correct){btn.classList.add('correct');fb.textContent=q.feedback;fb.className='quiz-feedback correct show';score++;document.getElementById('qScore').textContent='✓ '+score;}
  else{btn.classList.add('wrong');document.querySelectorAll('.quiz-option')[q.correct].classList.add('correct');fb.textContent='✗ Incorrecto. '+q.feedback;fb.className='quiz-feedback wrong show';}
  if(currentQ<questions.length-1) document.getElementById('quizNext').className='quiz-next show';
  else setTimeout(showScore,1000);
}

function nextQuestion(){currentQ++;loadQuestion();}

function showScore(){
  document.getElementById('quizCard').innerHTML=`<div class="score-display"><div class="big-score">${score}/${questions.length}</div><p>${score>=4?'¡Excelente! Ya entiendes kitBit mejor que el 90% de México':score>=3?'¡Bien hecho! ₿':'Repasa los conceptos e inténtalo de nuevo'}</p><button class="btn-primary" style="margin-top:1.1rem;font-size:0.88rem;padding:0.72rem 2rem" onclick="restartQuiz()">Intentar de nuevo</button></div>`;
}

function restartQuiz(){
  currentQ=0;score=0;
  document.getElementById('quizCard').innerHTML=`<div class="quiz-progress"><span id="qNum">1 / 5</span><div class="progress-bar"><div class="progress-fill" id="progressFill" style="width:20%"></div></div><span id="qScore">✓ 0</span></div><div class="quiz-question" id="quizQuestion"></div><div class="quiz-options" id="quizOptions"></div><div class="quiz-feedback" id="quizFeedback"></div><div class="quiz-next" id="quizNext"><button class="btn-primary" style="width:100%;font-size:0.88rem;padding:0.72rem" onclick="nextQuestion()">Siguiente →</button></div>`;
  loadQuestion();
}

// ═══════════ FLUJO ANIMADO ═══════════
function animateFlow(){document.querySelectorAll('.flow-step').forEach((s,i)=>setTimeout(()=>s.classList.add('visible'),i*120));}

// ═══════════ INIT ═══════════
loadQuestion();