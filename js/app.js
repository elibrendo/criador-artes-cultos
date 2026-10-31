'use strict';
// Lógica do criador de artes: desenho no canvas, passos, biblioteca de fotos, recorte e exportação.
// Para mudar cultos, modelos, pregadores e endereço, edite js/config.js.
/* ===================================================================== */
const $ = id => document.getElementById(id);
const MESES = ['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
const DIAS = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeBack = x => { const c = 1.5; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const E = (t, a, d, f = easeOut) => f(clamp((t - a) / d));
function toast(msg, ms = 2600) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms); }
function confirmBox(msg) { return new Promise(res => { $('modalMsg').textContent = msg; $('modal').classList.add('show'); const done = v => { $('modal').classList.remove('show'); $('modalOk').onclick = $('modalNo').onclick = null; res(v); }; $('modalOk').onclick = () => done(true); $('modalNo').onclick = () => done(false); }); }
function slug(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'sem-nome'; }
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function nextDow(dow, time) {
  const now = new Date(); const d = new Date(now); d.setHours(12, 0, 0, 0);
  let add = (dow - now.getDay() + 7) % 7;
  if (add === 0) { const [h, m] = time.split(':').map(Number); if (now.getHours() * 60 + now.getMinutes() > h * 60 + m) add = 7; }
  d.setDate(d.getDate() + add); return ymd(d);
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------------------------- cronograma ---------------------------- */
// Qual culto cai em cada dia: 1º dom = Família, 2º = Santa Ceia, 3º = Missões, 4º (e 5º) = Adoração;
// toda quarta = Ensino; 1ª sexta = Jovens; última sexta = Irmãs.
function cultoDoDia(d) {
  const dow = d.getDay(), n = d.getDate();
  if (dow === 0) return { key: ['familia', 'santaceia', 'missoes', 'adoracao', 'adoracao'][Math.ceil(n / 7) - 1], hora: '19:00' };
  if (dow === 3) return { key: 'ensino', hora: '19:30' };
  if (dow === 5) {
    const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    if (n <= 7) return { key: 'jovens', hora: '19:00' };
    if (n + 7 > dim) return { key: 'irmas', hora: '19:00' };
  }
  return null;
}
// Primeiro culto do cronograma, de hoje em diante, que atende ao filtro (hoje só conta se ainda não passou do horário)
function achar(pred) {
  const now = new Date();
  for (let i = 0; i < 120; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 12), c = cultoDoDia(d);
    if (!c || !pred(c)) continue;
    const [h, m] = c.hora.split(':').map(Number);
    if (i === 0 && now.getHours() * 60 + now.getMinutes() > h * 60 + m) continue;
    return { key: c.key, hora: c.hora, data: ymd(d) };
  }
  return null;
}
function dataDoCulto(key) {
  const c = CULTOS[key], r = achar(x => x.key === key);
  if (r) return r;
  return { key, hora: c.hora, data: c.dow != null ? nextDow(c.dow, c.hora) : ymd(new Date()) };
}
function fmtHora(h) { const [a, b] = h.split(':'); return +a + 'h' + (b === '00' ? '' : b); }
const REC = achar(() => true) || dataDoCulto('familia');

/* ------------------------------ estado ------------------------------ */
const S = {
  culto: REC.key, modelo: Object.keys(CULTOS[REC.key].modelos)[0], formato: 'story', data: REC.data, hora: REC.hora,
  pregador: 'pr-joaquim', outroNome: '', outroF: false,
  fotoKey: null, foto: null, zoom: 1, offX: 0, offY: 0, rot: 0,
};
try { const saved = JSON.parse(localStorage.getItem('artes-culto-v1') || 'null'); if (saved) for (const k of ['formato', 'outroNome', 'outroF']) if (k in saved) S[k] = saved[k]; } catch (e) {}
if (!FORMATOS[S.formato]) S.formato = 'story';
const curModel = () => CULTOS[S.culto].modelos[S.modelo];
function persist() { try { localStorage.setItem('artes-culto-v1', JSON.stringify({ formato: S.formato, outroNome: S.outroNome, outroF: S.outroF })); } catch (e) {} }

function preacherInfo() {
  if (S.pregador === 'outro') return { key: 'outro-' + slug(S.outroNome || ''), nome: S.outroNome.trim(), f: S.outroF };
  const p = PREGADORES.find(p => p.id === S.pregador) || PREGADORES[0];
  return { key: p.id, nome: p.nome, f: !!p.f };
}
function dateText() {
  if (!S.data) return 'DATA DO CULTO';
  const d = new Date(S.data + 'T12:00:00'); const [h, m] = (S.hora || '19:00').split(':');
  return `${d.getDate()} DE ${MESES[d.getMonth()]} ÀS ${+h}H${m !== '00' ? m : ''}`;
}

/* --------------------------- recursos gráficos --------------------------- */
const R = { logoA: null, logoF: null, tint: new Map(), noise: new Map(), speck: new Map() };
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function tinted(img, color) {
  const k = img.src.length + color; if (R.tint.has(k)) return R.tint.get(k);
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d');
  x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  R.tint.set(k, c); return c;
}
function noiseLayer(W, H, dark) {
  const k = W + 'x' + H + dark; if (R.noise.has(k)) return R.noise.get(k);
  const c = document.createElement('canvas'); c.width = W / 2; c.height = H / 2; const x = c.getContext('2d');
  const im = x.createImageData(c.width, c.height); const r = mulberry(7);
  for (let i = 0; i < im.data.length; i += 4) { const v = r(); const g = v > .5 ? 255 : 0; im.data[i] = im.data[i + 1] = im.data[i + 2] = g; im.data[i + 3] = Math.abs(v - .5) * (dark ? 34 : 46); }
  x.putImageData(im, 0, 0); R.noise.set(k, c); return c;
}
function speckLayer(W, H) {
  const k = W + 'x' + H; if (R.speck.has(k)) return R.speck.get(k);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); const r = mulberry(42);
  x.fillStyle = '#000';
  for (let i = 0; i < 5200; i++) { const rr = r() < .9 ? r() * 2.2 + .4 : r() * 5 + 2; x.globalAlpha = .35 + r() * .65; x.beginPath(); x.arc(r() * W, r() * H, rr, 0, 7); x.fill(); }
  for (let i = 0; i < 260; i++) { x.globalAlpha = .25 + r() * .4; x.save(); x.translate(r() * W, r() * H); x.rotate(r() * 3.14); x.fillRect(0, 0, 6 + r() * 30, .8 + r() * 1.6); x.restore(); }
  R.speck.set(k, c); return c;
}
const layerCache = {};
function layer(name, W, H) { let c = layerCache[name]; if (!c) c = layerCache[name] = document.createElement('canvas'); if (c.width !== W || c.height !== H) { c.width = W; c.height = H; } const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.clearRect(0, 0, W, H); return [c, x]; }

/* ------------------------------ layouts ------------------------------ */
function layoutFor(fmt) {
  if (fmt === 'feed') return {
    W: 1080, H: 1350, logoY: 78, logoW: 170, dateY: 168, dateW: 600, dateH: 54, dateFont: 25,
    giantTop: 210, giantH: 520, giantW: 1250,
    photo: { x: 170, y: 215, w: 740, h: 625 }, photoClip: 200, fadeH: 170,
    glowY: 960, glowR: 560, kickerY: 828, bigTop: 858, bigH: 225, bigW: 820, scriptY: 1000, scriptSize: 175,
    tagRight: 1010, tagY: 672, tagScale: .85,
    addr: [ENDERECO.join(' ')], addrY: 1172, addrFont: 25, footY: 1268, footW: 205,
  };
  return {
    W: 1080, H: 1920, logoY: 150, logoW: 232, dateY: 302, dateW: 650, dateH: 64, dateFont: 29,
    giantTop: 360, giantH: 650, giantW: 1250,
    photo: { x: 130, y: 380, w: 820, h: 820 }, photoClip: 350, fadeH: 230,
    glowY: 1300, glowR: 600, kickerY: 1110, bigTop: 1150, bigH: 300, bigW: 830, scriptY: 1328, scriptSize: 245,
    tagRight: 1010, tagY: 950, tagScale: 1,
    addr: ENDERECO, addrY: 1560, addrFont: 33, footY: 1772, footW: 272,
  };
}

/* ------------------------------ desenho ------------------------------ */
function tracked(ctx, text, x, y, spacing, align = 'center') {
  const ch = [...text]; const ws = ch.map(c => ctx.measureText(c).width);
  const total = ws.reduce((a, b) => a + b, 0) + spacing * (ch.length - 1);
  let xx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const sa = ctx.textAlign; ctx.textAlign = 'left';
  ch.forEach((c, i) => { ctx.fillText(c, xx, y); xx += ws[i] + spacing; });
  ctx.textAlign = sa; return total;
}
function trackedWidth(ctx, text, spacing) { const ch = [...text]; return ch.reduce((a, c) => a + ctx.measureText(c).width, 0) + spacing * (ch.length - 1); }
function fitFont(ctx, text, maxW, size, weight, family, spacing = 0) {
  ctx.font = `${weight} ${size}px ${family}`;
  while (trackedWidth(ctx, text, spacing * size / 100) > maxW && size > 10) { size -= 1; ctx.font = `${weight} ${size}px ${family}`; }
  return size;
}
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

// Palavra grande em Anton, letra por letra, ajustada à caixa (largura W, altura H de caixa-alta)
function bigWordGeom(ctx, word, boxW, capH, maxStretch, spacingEm, fitAscent) {
  ctx.font = '100px Anton'; const cap = ctx.measureText('H').actualBoundingBoxAscent || 74;
  const w100 = trackedWidth(ctx, word, spacingEm * 100);
  let size = 100 * boxW / w100; let stretch = capH / (cap * size / 100);
  if (stretch > maxStretch) { stretch = maxStretch; }
  if (stretch < 1) { size = size * stretch; stretch = 1; }
  ctx.font = `${size}px Anton`;
  const ch = [...word]; const ws = ch.map(c => ctx.measureText(c).width); const sp = spacingEm * size;
  const total = ws.reduce((a, b) => a + b, 0) + sp * (ch.length - 1);
  let asc = Math.max(ctx.measureText(word).actualBoundingBoxAscent || 0, cap * size / 100);
  if (fitAscent && asc * stretch > capH) { const k = capH / (asc * stretch); if (stretch * k >= 1) stretch *= k; else { size *= k * stretch; stretch = 1; ctx.font = `${size}px Anton`; asc = Math.max(ctx.measureText(word).actualBoundingBoxAscent || 0, cap * size / 100); } }
  const ws2 = ch.map(c => ctx.measureText(c).width); const sp2 = spacingEm * size; const total2 = ws2.reduce((a, b) => a + b, 0) + sp2 * (ch.length - 1);
  return { size, stretch, ch, ws: ws2, sp: sp2, total: total2, capPx: cap * size / 100 * stretch, ascPx: asc * stretch };
}

function render(ctx, t, opt = {}) {
  const M = curModel(), th = M.th, L = layoutFor(opt.fmt || S.formato), W = L.W, H = L.H;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.textBaseline = 'alphabetic';

  // fundo + textura de papel
  ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(noiseLayer(W, H, th.dark), 0, 0, W, H);

  // palavra gigante ao fundo
  {
    const g = bigWordGeom(ctx, M.giant, L.giantW, L.giantH, 3.2, .02);
    ctx.font = `${g.size}px Anton`; ctx.fillStyle = th.giant;
    let x = W / 2 - g.total / 2; const base = L.giantTop + g.capPx;
    g.ch.forEach((c, i) => {
      const a = E(t, .05 + i * .07, 1.1);
      if (a > 0) { ctx.save(); ctx.globalAlpha = a; ctx.translate(x, base + (1 - a) * 90); ctx.scale(1, g.stretch); ctx.fillText(c, 0, 0); ctx.restore(); }
      x += g.ws[i] + g.sp;
    });
  }

  // logo ADMMP
  if (R.logoA) {
    const a = E(t, .25, .7); const img = th.dark ? tinted(R.logoA, th.ink) : R.logoA;
    const w = L.logoW, h = w * R.logoA.height / R.logoA.width;
    ctx.globalAlpha = a; ctx.drawImage(img, W / 2 - w / 2, L.logoY - h / 2 - (1 - a) * 24, w, h); ctx.globalAlpha = 1;
  }

  // caixa da data
  {
    const p = E(t, .5, .8, x => x), bw = L.dateW, bh = L.dateH, bx = W / 2 - bw / 2, by = L.dateY - bh / 2;
    const per = 2 * (bw + bh);
    ctx.save(); ctx.strokeStyle = th.ink; ctx.lineWidth = 2.6; ctx.setLineDash([per * p, per]); rrect(ctx, bx, by, bw, bh, 14); if (p > 0) ctx.stroke(); ctx.restore();
    const a = E(t, .95, .6); const txt = dateText();
    const sp0 = 7 * L.dateFont / 29;
    const size = fitFont(ctx, txt, bw - 60, L.dateFont, 600, 'Montserrat', sp0 / L.dateFont * 100);
    ctx.font = `600 ${size}px Montserrat`; ctx.fillStyle = th.ink; ctx.globalAlpha = a; ctx.textBaseline = 'middle';
    tracked(ctx, txt, W / 2, L.dateY + 1, sp0 + (1 - a) * 10); ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
  }

  // foto do pregador
  const ph = L.photo;
  if (S.foto) {
    const a = E(t, 1.0, 1.0); const img = S.foto;
    if (a > 0) {
      const [lc, lx] = layer('photo', W, H);
      const breathe = 1 + .025 * clamp(t / VIDEO_SEG);
      const sc = Math.min(ph.w / img.width, ph.h / img.height) * S.zoom * breathe;
      const dw = img.width * sc, dh = img.height * sc;
      const dx = ph.x + (ph.w - dw) / 2 + S.offX, dy = ph.y + ph.h - dh + S.offY + (1 - a) * 140;
      lx.save(); lx.beginPath(); lx.rect(0, L.photoClip, W, ph.y + ph.h - L.photoClip); lx.clip();
      if (S.rot) { lx.translate(dx + dw / 2, dy + dh / 2); lx.rotate(S.rot * Math.PI / 180); lx.drawImage(img, -dw / 2, -dh / 2, dw, dh); } else lx.drawImage(img, dx, dy, dw, dh);
      lx.restore();
      const fy = ph.y + ph.h - L.fadeH; const gr = lx.createLinearGradient(0, fy, 0, ph.y + ph.h);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
      lx.globalCompositeOperation = 'destination-out'; lx.fillStyle = gr; lx.fillRect(0, fy, W, L.fadeH + 2);
      lx.fillStyle = '#000'; lx.fillRect(0, ph.y + ph.h, W, H);
      ctx.globalAlpha = a; ctx.drawImage(lc, 0, 0); ctx.globalAlpha = 1;
    }
  } else if (opt.preview) {
    ctx.save(); ctx.strokeStyle = th.ink; ctx.globalAlpha = .35; ctx.setLineDash([14, 12]); ctx.lineWidth = 3;
    const cx = W / 2, cy = ph.y + ph.h * .42, r = ph.w * .17;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, ph.y + ph.h, ph.w * .36, ph.h * .36, 0, Math.PI, 0); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = .55; ctx.fillStyle = th.ink; ctx.font = '600 26px Montserrat'; ctx.textAlign = 'center';
    ctx.fillText('FOTO DO PREGADOR', cx, cy + r + 60); ctx.restore();
  }

  // brilho atrás do título
  {
    const a = E(t, 1.4, .9);
    if (a > 0) {
      ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, L.glowY); ctx.scale(1, .55);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, L.glowR);
      g.addColorStop(0, th.glow); g.addColorStop(.55, th.glow.replace(/[\d.]+\)$/, m => (parseFloat(m) * .55) + ')')); g.addColorStop(1, th.glow.replace(/[\d.]+\)$/, '0)'));
      ctx.fillStyle = g; ctx.fillRect(-L.glowR, -L.glowR, L.glowR * 2, L.glowR * 2); ctx.restore();
    }
  }

  // título: palavra grande com textura
  const bg = bigWordGeom(ctx, M.big, L.bigW, L.bigH, 1.45, .015, true);
  const bigX0 = W / 2 - bg.total / 2;
  const bigBase = L.bigTop + L.bigH - (L.bigH - bg.ascPx) / 2;
  {
    const [lc, lx] = layer('big', W, H);
    lx.font = `${bg.size}px Anton`; lx.fillStyle = th.big; let x = bigX0;
    bg.ch.forEach((c, i) => {
      const a = E(t, 1.8 + i * .09, .7, easeBack);
      const al = clamp((t - 1.8 - i * .09) / .35);
      if (al > 0) { lx.save(); lx.globalAlpha = al; lx.translate(x + bg.ws[i] / 2, bigBase); lx.scale(.8 + .2 * a, bg.stretch * (.8 + .2 * a)); lx.fillText(c, -bg.ws[i] / 2, 0); lx.restore(); }
      x += bg.ws[i] + bg.sp;
    });
    lx.globalCompositeOperation = 'destination-out'; lx.drawImage(speckLayer(W, H), 0, 0);
    ctx.drawImage(lc, 0, 0);
  }

  // kicker (ex.: CULTO DA)
  {
    const a = E(t, 1.55, .7);
    const kw = Math.min(bg.total, L.bigW);
    const size = fitFont(ctx, M.kicker, Math.max(kw * .78, 420), L.bigH * .23, 800, 'Montserrat', 18);
    ctx.font = `800 ${size}px Montserrat`; ctx.fillStyle = th.ink; ctx.globalAlpha = a;
    const kx = bigX0 + (1 - a) * -70;
    ctx.textBaseline = 'alphabetic';
    tracked(ctx, M.kicker, Math.max(kx, 60), bigBase - bg.ascPx - size * .3, size * .18, 'left'); ctx.globalAlpha = 1;
  }

  // escrita cursiva
  {
    const p = E(t, 2.45, 1.1, x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
    if (p > 0) {
      let size = L.scriptSize; ctx.font = `${size}px "Mrs Saint Delafield"`;
      let w = ctx.measureText(M.script).width; const maxW = Math.max(bg.total * .9, 560);
      if (w > maxW) { size *= maxW / w; ctx.font = `${size}px "Mrs Saint Delafield"`; w = ctx.measureText(M.script).width; }
      ctx.save(); ctx.translate(W / 2 + 10, L.scriptY); ctx.rotate(-.06);
      ctx.beginPath(); ctx.rect(-w / 2 - 80, -size * 1.2, (w + 160) * p, size * 2); ctx.clip();
      ctx.shadowColor = th.dark ? 'rgba(0,0,0,.5)' : 'rgba(60,40,20,.22)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 6;
      ctx.fillStyle = th.ink; ctx.textAlign = 'center'; ctx.fillText(M.script, 0, size * .2); ctx.restore();
    }
  }

  // etiqueta do preletor
  const pi = preacherInfo();
  if (pi.nome) {
    const a = E(t, 3.0, .7); const s = L.tagScale;
    const label = pi.f ? 'PRELETORA' : 'PRELETOR';
    const name = pi.nome.toUpperCase();
    let nsize = 40 * s; ctx.font = `800 ${nsize}px Montserrat`;
    nsize = fitFont(ctx, name, 520 * s, nsize, 800, 'Montserrat', 4);
    const nw = trackedWidth(ctx, name, nsize * .04);
    ctx.font = `600 ${20 * s}px Montserrat`; const lw = trackedWidth(ctx, label, 6 * s);
    const pw = Math.max(nw, lw) + 64 * s, phh = 104 * s;
    const px = L.tagRight - pw + (1 - a) * 160, py = L.tagY - phh / 2;
    ctx.save(); ctx.globalAlpha = a;
    ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.fillStyle = th.ink; rrect(ctx, px, py, pw, phh, 16 * s); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.fillStyle = th.bg; ctx.font = `600 ${20 * s}px Montserrat`; ctx.textBaseline = 'middle';
    tracked(ctx, label, px + 32 * s, py + 33 * s, 6 * s, 'left');
    ctx.font = `800 ${nsize}px Montserrat`; tracked(ctx, name, px + 32 * s, py + 70 * s, nsize * .04, 'left');
    ctx.restore();
  }

  // endereço
  {
    const a = E(t, 3.3, .7);
    ctx.fillStyle = th.ink; ctx.globalAlpha = a; ctx.textBaseline = 'alphabetic';
    L.addr.forEach((ln, i) => {
      const size = fitFont(ctx, ln, 940, L.addrFont, 600, 'Montserrat', 12);
      ctx.font = `600 ${size}px Montserrat`;
      tracked(ctx, ln, W / 2, L.addrY + i * L.addrFont * 1.45 + (1 - a) * 30, size * .12);
    });
    ctx.globalAlpha = 1;
  }

  // logo Filadélfia
  if (R.logoF) {
    const a = E(t, 3.6, .7); const img = tinted(R.logoF, th.ink);
    const w = L.footW, h = w * R.logoF.height / R.logoF.width;
    ctx.globalAlpha = a; ctx.drawImage(img, W / 2 - w / 2, L.footY - h / 2 + (1 - a) * 26, w, h); ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/* ------------------------------ prévia ------------------------------ */
const poster = $('poster'), pctx = poster.getContext('2d');
let playing = null;
function draw() {
  const f = FORMATOS[S.formato];
  if (poster.width !== f.w || poster.height !== f.h) { poster.width = f.w; poster.height = f.h; }
  $('sizeLabel').textContent = `${f.desc} · ${f.nome}`;
  if (!playing) render(pctx, Infinity, { preview: true });
  $('adjust').classList.toggle('hidden', !S.foto);
  buildSummary();
}
let drawQueued = false;
function redraw() { if (drawQueued) return; drawQueued = true; requestAnimationFrame(() => { drawQueued = false; draw(); }); }
$('playBtn').onclick = () => {
  if (playing) { cancelAnimationFrame(playing.raf); playing = null; $('playBtn').textContent = '▶ Ver animação'; draw(); return; }
  const t0 = performance.now(); playing = {}; $('playBtn').textContent = '■ Parar';
  const step = () => { const t = (performance.now() - t0) / 1000; render(pctx, t, { preview: true }); if (t < VIDEO_SEG) playing.raf = requestAnimationFrame(step); else { playing = null; $('playBtn').textContent = '▶ Ver animação'; draw(); } };
  playing.raf = requestAnimationFrame(step);
};

/* ------------------------------ formulário ------------------------------ */
function escolherCulto(k, r) {
  if (S.culto !== k) S.modelo = Object.keys(CULTOS[k].modelos)[0];
  S.culto = k; S.data = r.data; S.hora = r.hora;
  syncForm(); updateCultos(); buildModels(); redraw();
}
// carrossel genérico: deslizar (ou setas) troca o item; onIdx recebe o índice ao parar
function attachCarousel(car, prev, next, onIdx) {
  let t;
  car.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(() => { const w = car.clientWidth; if (w) onIdx(Math.round(car.scrollLeft / w)); }, 140); });
  prev.onclick = () => car.scrollBy({ left: -car.clientWidth, behavior: 'smooth' });
  next.onclick = () => car.scrollBy({ left: car.clientWidth, behavior: 'smooth' });
}
function scrollCar(car, i) { const w = car.clientWidth; if (w && Math.abs(car.scrollLeft - i * w) > 2) car.scrollTo({ left: i * w, behavior: 'auto' }); }
function buildSuggest() {
  const c = CULTOS[REC.key], d = new Date(REC.data + 'T12:00:00');
  const quando = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  $('suggest').innerHTML = `<p>Pelo calendário, ${REC.data === ymd(new Date()) ? 'hoje' : 'o próximo'} é o <strong>${c.nome}</strong> — ${quando}, às ${fmtHora(REC.hora)}. É esse que você vai divulgar?</p><button class="btn full" id="sugOk">Sim, é esse →</button>`;
  $('sugOk').onclick = () => { escolherCulto(REC.key, REC); showStep(2); };
}
// Passo 1: lista suspensa + carrossel de cartões (mesmo padrão do passo do pregador)
const CULTO_KEYS = Object.keys(CULTOS);
function buildCultos() {
  const car = $('cultoCar'); car.innerHTML = '';
  for (const k of CULTO_KEYS) {
    const c = CULTOS[k], th = Object.values(c.modelos)[0].th;
    const s = document.createElement('div'); s.className = 'slide cslide'; s.style.cssText = `background:${th.bg};color:${th.ink}`;
    s.innerHTML = `<small>${c.modelos[Object.keys(c.modelos)[0]].kicker}</small><b>${c.modelos[Object.keys(c.modelos)[0]].big}</b><span>${c.quando}</span>`;
    car.appendChild(s);
  }
  const pop = $('cultoPop'); pop.innerHTML = '<div class="pop-list"></div>';
  for (const k of CULTO_KEYS) {
    const th = Object.values(CULTOS[k].modelos)[0].th;
    const b = document.createElement('button'); b.setAttribute('role', 'option'); b.dataset.k = k;
    b.innerHTML = `<span class="pick-ava" style="background:${th.bg};color:${th.ink}">●</span>${CULTOS[k].nome}<span class="ck"></span>`;
    b.onclick = () => { closePop(); escolherCulto(k, dataDoCulto(k)); };
    pop.firstChild.appendChild(b);
  }
  updateCultos();
}
function updateCultos() {
  const c = CULTOS[S.culto], th = Object.values(c.modelos)[0].th, i = CULTO_KEYS.indexOf(S.culto);
  $('cultoName').textContent = c.nome;
  $('cultoSw').style.cssText = `background:${th.bg};color:${th.ink}`; $('cultoSw').textContent = '●';
  document.querySelectorAll('#cultoPop button').forEach(b => { const on = b.dataset.k === S.culto; b.classList.toggle('sel', on); b.lastChild.textContent = on ? '✓' : ''; });
  $('cultoDots').innerHTML = CULTO_KEYS.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('');
  scrollCar($('cultoCar'), i);
}
attachCarousel($('cultoCar'), $('cultoPrev'), $('cultoNext'), i => { const k = CULTO_KEYS[i]; if (k && k !== S.culto) escolherCulto(k, dataDoCulto(k)); });
$('cultoBtn').onclick = e => { e.stopPropagation(); const open = !$('cultoPop').classList.contains('show'); closePop(); $('cultoPop').classList.toggle('show', open); $('cultoBtn').classList.toggle('open', open); };
// Miniaturas reais de cada modelo do culto escolhido
function buildModels() {
  const c = CULTOS[S.culto]; const box = $('models'); box.innerHTML = '';
  const keys = Object.keys(c.modelos);
  $('modelCount').textContent = `${keys.length} para ${c.nome}`;
  const keep = S.modelo, f = FORMATOS[S.formato];
  for (const k of keys) {
    const b = document.createElement('button'); b.className = 'mcard' + (S.modelo === k ? ' sel' : '');
    const big = document.createElement('canvas'); big.width = f.w; big.height = f.h;
    S.modelo = k; render(big.getContext('2d'), Infinity, { preview: true });
    const th = document.createElement('canvas'); th.width = 270; th.height = Math.round(270 * f.h / f.w);
    th.getContext('2d').drawImage(big, 0, 0, th.width, th.height);
    b.appendChild(th); const t = document.createElement('strong'); t.textContent = c.modelos[k].nome; b.appendChild(t);
    b.onclick = () => { S.modelo = k; buildModels(); persist(); redraw(); };
    box.appendChild(b);
  }
  S.modelo = keep;
}
let modelsT; function refreshModelThumbs() { clearTimeout(modelsT); modelsT = setTimeout(buildModels, 250); }
function buildFormats() {
  $('formats').innerHTML = '';
  for (const [k, f] of Object.entries(FORMATOS)) {
    const b = document.createElement('button'); b.className = 'opt' + (S.formato === k ? ' sel' : '');
    b.innerHTML = `<span class="fmt" style="height:${22 * f.h / f.w}px"></span><span><strong>${f.nome}</strong><small>${f.onde}</small></span>`;
    b.onclick = () => { S.formato = k; buildFormats(); refreshModelThumbs(); persist(); redraw(); };
    $('formats').appendChild(b);
  }
}
const cal = { y: 0, m: 0 };
function calGoto(iso) { const d = new Date(iso + 'T12:00:00'); cal.y = d.getFullYear(); cal.m = d.getMonth(); }
function buildCalendar() {
  const first = new Date(cal.y, cal.m, 1), dim = new Date(cal.y, cal.m + 1, 0).getDate(), hoje = ymd(new Date());
  let h = `<div class="cal-head"><button type="button" class="cal-nav" data-d="-1" aria-label="Mês anterior">‹</button><strong>${MESES[cal.m].toLowerCase()} ${cal.y}</strong><button type="button" class="cal-nav" data-d="1" aria-label="Próximo mês">›</button></div><div class="cal-grid">`;
  h += ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(x => `<span class="cal-dow">${x}</span>`).join('');
  for (let i = 0; i < first.getDay(); i++) h += '<span></span>';
  for (let n = 1; n <= dim; n++) {
    const dt = new Date(cal.y, cal.m, n, 12), k = ymd(dt), c = cultoDoDia(dt);
    h += `<button type="button" class="day${k === S.data ? ' sel' : ''}${k === hoje ? ' today' : ''}${c && c.key === S.culto ? ' has' : ''}" data-k="${k}">${n}</button>`;
  }
  $('cal').innerHTML = h + '</div>';
  const d = S.data ? new Date(S.data + 'T12:00:00') : null, c = d && cultoDoDia(d);
  $('dateHint').textContent = !d ? 'Toque num dia do calendário.' :
    d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) + (c && c.key !== S.culto ? ` · o calendário prevê ${CULTOS[c.key].nome} nesse dia.` : '.');
}
$('cal').onclick = e => {
  const n = e.target.closest('[data-d]'), k = e.target.closest('[data-k]');
  if (n) { const d = new Date(cal.y, cal.m + +n.dataset.d, 1); cal.y = d.getFullYear(); cal.m = d.getMonth(); buildCalendar(); }
  else if (k) { S.data = k.dataset.k; buildCalendar(); redraw(); }
};
function initials(n) { return (n || '?').replace(/^(Pr|Dc|Pb|Ev|Mis)\.?\s+/i, '').split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase(); }
function avaFor(key) { const it = [...Lib.cloud, ...Lib.local].filter(i => i.pregador === key).sort((a, b) => b.criadoEm - a.criadoEm)[0]; return it ? it.url : null; }
function avaHTML(key, nome) { const u = avaFor(key); return `<span class="pick-ava">${u ? `<img alt="" src="${u}">` : initials(nome)}</span>`; }
function buildPreachers() {
  const pi = preacherInfo();
  $('pickName').textContent = pi.nome || 'Digite o nome…';
  const u = avaFor(pi.key); $('pickAva').innerHTML = u ? `<img alt="" src="${u}">` : initials(pi.nome);
  const pop = $('pop'); pop.innerHTML = '';
  const list = document.createElement('div'); list.className = 'pop-list';
  // "Outro pregador" fica fixo no topo; só os nomes rolam
  for (const p of [PREGADORES[PREGADORES.length - 1], ...PREGADORES.slice(0, -1)]) {
    const b = document.createElement('button'); b.setAttribute('role', 'option'); if (S.pregador === p.id) b.className = 'sel';
    b.innerHTML = (p.id === 'outro' ? '<span class="pick-ava">+</span>Outro pregador…' : `${avaHTML(p.id, p.nome)}${p.nome}`) + (S.pregador === p.id ? '<span class="ck">✓</span>' : '');
    b.onclick = () => {
      if (S.pregador !== p.id) { S.pregador = p.id; S.foto = null; S.fotoKey = null; }
      closePop(); buildPreachers(); renderLib(); autoPickPhoto(); redraw();
      if (p.id === 'outro') setTimeout(() => $('outroNome').focus(), 60);
    };
    if (p.id === 'outro') { pop.appendChild(b); pop.appendChild(document.createElement('hr')); } else list.appendChild(b);
  }
  pop.appendChild(list);
  $('outroBox').classList.toggle('hidden', S.pregador !== 'outro');
}
function closePop() { document.querySelectorAll('.pop').forEach(p => p.classList.remove('show')); document.querySelectorAll('.pick-btn').forEach(b => b.classList.remove('open')); }
$('pickBtn').onclick = e => { e.stopPropagation(); const open = !$('pop').classList.contains('show'); closePop(); $('pop').classList.toggle('show', open); $('pickBtn').classList.toggle('open', open); };
document.addEventListener('click', e => { if (!e.target.closest('.picker')) closePop(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
function syncForm() {
  $('time').value = S.hora; calGoto(S.data); buildCalendar();
  $('outroNome').value = S.outroNome; $('outroF').checked = S.outroF;
}
$('time').oninput = e => { S.hora = e.target.value; redraw(); };
let outroT;
$('outroNome').oninput = e => { S.outroNome = e.target.value; $('pickName').textContent = S.outroNome || 'Digite o nome…'; redraw(); clearTimeout(outroT); outroT = setTimeout(() => { persist(); renderLib(); buildPreachers(); }, 500); };
$('outroF').onchange = e => { S.outroF = e.target.checked; persist(); redraw(); };
for (const [id, k, fmt] of [['zoom', 'zoom', v => v + '%'], ['offX', 'offX', v => v], ['offY', 'offY', v => v], ['rot', 'rot', v => v + '°']]) {
  $(id).oninput = e => { const v = +e.target.value; S[k] = k === 'zoom' ? v / 100 : v; $(id + 'O').textContent = fmt(v); redraw(); };
}
function resetAdjust() { S.zoom = 1; S.offX = 0; S.offY = 0; S.rot = 0; $('rot').value = 0; $('rotO').textContent = '0°'; $('zoom').value = 100; $('offX').value = 0; $('offY').value = 0; $('zoomO').textContent = '100%'; $('offXO').textContent = '0'; $('offYO').textContent = '0'; }

/* ------------------------- biblioteca de fotos ------------------------- */
// Nuvem (db + assets do artefato) quando disponível; senão IndexedDB neste navegador.
const Lib = { cloud: [], local: [], db: null, assets: null, canUpload: false };
function idb() {
  return new Promise((res, rej) => { try { const r = indexedDB.open('artes-culto', 1); r.onupgradeneeded = () => r.result.createObjectStore('fotos', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } });
}
async function idbAll() { try { const d = await idb(); return await new Promise(res => { const q = d.transaction('fotos').objectStore('fotos').getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => res([]); }); } catch (e) { return []; } }
async function idbPut(rec) { const d = await idb(); return new Promise((res, rej) => { const tx = d.transaction('fotos', 'readwrite'); tx.objectStore('fotos').put(rec); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
async function idbDel(id) { const d = await idb(); return new Promise(res => { const tx = d.transaction('fotos', 'readwrite'); tx.objectStore('fotos').delete(id); tx.oncomplete = res; tx.onerror = res; }); }
async function loadLocal() {
  for (const it of Lib.local) if (it.url) URL.revokeObjectURL(it.url);
  Lib.local = (await idbAll()).map(r => ({ id: 'l:' + r.id, rid: r.id, pregador: r.pregador, url: URL.createObjectURL(r.blob), criadoEm: r.criadoEm, src: 'local' }));
  renderLib();
}
function libItems() { const k = preacherInfo().key; return [...Lib.cloud, ...Lib.local].filter(i => i.pregador === k).sort((a, b) => b.criadoEm - a.criadoEm); }
// Carrossel de fotos do pregador (deslize para trocar, como no Instagram)
let libSig = '';
function renderLib() {
  const items = libItems(), pi = preacherInfo(), car = $('car'), outro = S.pregador === 'outro';
  if (!$('pop').classList.contains('show')) buildPreachers();
  const sig = pi.key + '|' + items.map(i => i.id).join(',') + '|' + (outro && !pi.nome);
  if (sig !== libSig) {
    libSig = sig; car.innerHTML = '';
    if (!items.length) {
      const e = document.createElement(outro && !pi.nome ? 'div' : 'label'); e.className = 'slide empty';
      if (e.tagName === 'LABEL') e.htmlFor = 'file';
      e.innerHTML = outro && !pi.nome ? 'Digite o nome do pregador<br>para enviar a foto' : '<span class="d-only"><b>+</b>Enviar foto</span><span class="m-only">Nenhuma foto ainda</span>';
      car.appendChild(e);
    }
    for (const it of items) {
      const s = document.createElement('div'); s.className = 'slide';
      s.innerHTML = `<img alt="" src="${it.url}" draggable="false">${it.src === 'local' && Lib.db ? '<span class="tag">só aqui</span>' : ''}<button type="button" class="del" title="Excluir foto">×</button>`;
      s.querySelector('.del').onclick = async () => { if (await confirmBox('Excluir esta foto da biblioteca?')) delPhoto(it); };
      car.appendChild(s);
    }
    syncCarousel();
  }
  const idx = items.findIndex(i => i.id === S.fotoKey);
  $('dots').innerHTML = items.length > 1 ? items.map((_, i) => `<i class="${i === idx ? 'on' : ''}"></i>`).join('') : '';
  $('carPrev').classList.toggle('hidden', items.length < 2);
  $('carNext').classList.toggle('hidden', items.length < 2);
  $('photoRow').classList.toggle('canup', !(outro && !pi.nome) && (outro || !items.length));
  $('addRow').classList.toggle('hidden', !(outro && pi.nome && items.length));
  const who = pi.nome || 'este pregador';
  $('libHint').textContent = outro && !pi.nome ? 'Digite o nome do pregador para enviar a foto.' :
    items.length > 1 ? `Deslize para escolher a foto de ${who}.` : items.length ? '' : `Nenhuma foto de ${who} ainda. Envie uma — o fundo é removido automaticamente.`;
}
function syncCarousel() { scrollCar($('car'), Math.max(0, libItems().findIndex(x => x.id === S.fotoKey))); }
attachCarousel($('car'), $('carPrev'), $('carNext'), i => { const it = libItems()[i]; if (it && it.id !== S.fotoKey) selectPhoto(it); });
async function selectPhoto(it) {
  try { const img = await loadImg(it.url); S.foto = img; S.fotoKey = it.id; resetAdjust(); renderLib(); syncCarousel(); redraw(); }
  catch (e) { toast('Não foi possível abrir esta foto.'); }
}
function autoPickPhoto() { if (S.foto) return; const items = libItems(); if (items.length) selectPhoto(items[0]); }
async function delPhoto(it) {
  try {
    if (it.src === 'cloud') { await Lib.db.doc('fotos/' + it.rid).delete(); if (Lib.assets && it.assetId) Lib.assets.delete(it.assetId).catch(() => {}); }
    else { await idbDel(it.rid); await loadLocal(); }
    if (S.fotoKey === it.id) { S.foto = null; S.fotoKey = null; redraw(); }
    toast('Foto excluída'); renderLib();
  } catch (e) { toast('Não foi possível excluir (sem permissão?)'); }
}
async function savePhoto(blob) {
  const pi = preacherInfo(); const now = Date.now();
  if (Lib.db && Lib.assets) {
    try {
      const up = await Lib.assets.upload(blob, { type: 'image/png' });
      const ref = Lib.db.collection('fotos').doc();
      await ref.set({ pregador: pi.key, nome: pi.nome, assetId: up.id, criadoEm: now });
      return { id: 'c:' + ref.id, url: up.url };
    } catch (e) { console.warn('upload', e); toast('Sem acesso à biblioteca compartilhada — salvando só neste aparelho.', 3500); }
  }
  const id = now.toString(36) + Math.random().toString(36).slice(2, 6);
  try { await idbPut({ id, pregador: pi.key, blob, criadoEm: now }); await loadLocal(); return { id: 'l:' + id }; }
  catch (e) { const url = URL.createObjectURL(blob); Lib.local.push({ id: 'm:' + id, rid: id, pregador: pi.key, url, criadoEm: now, src: 'mem' }); renderLib(); return { id: 'm:' + id, url }; }
}
async function initCloud() {
  for (let i = 0; i < 30 && !(window.claude && typeof window.claude.use === 'function'); i++) await new Promise(r => setTimeout(r, 100));
  if (!(window.claude && typeof window.claude.use === 'function')) return;
  try {
    const [db, assets] = await Promise.all([claude.use('db').catch(() => null), claude.use('assets').catch(() => null)]);
    Lib.db = db; Lib.assets = assets;
    if (!db) return;
    const timer = setTimeout(() => { }, 10000);
    db.collection('fotos').onSnapshot(snap => {
      clearTimeout(timer);
      Lib.cloud = snap.docs.map(d => { const v = d.data() || {}; return { id: 'c:' + d.id, rid: d.id, pregador: v.pregador, assetId: v.assetId, url: '/_blob/' + v.assetId, criadoEm: v.criadoEm || 0, src: 'cloud' }; }).filter(i => i.assetId);
      $('cloud').classList.add('on');
      renderLib(); autoPickPhoto();
    }, err => { clearTimeout(timer); console.warn('db', err); });
  } catch (e) { console.warn(e); }
}

/* ------------------------- remoção de fundo ------------------------- */
const BG = { model: null, W: null, gl: null, worker: null, ready: null };
async function bgLoad() {
  if (BG.ready) return BG.ready;
  BG.ready = (async () => {
    if (!window.U2NETP_MODEL) throw new Error('arquivo js/motor-recorte/modelo-u2netp.js não carregou');
    const m = { ...window.U2NETP_MODEL };
    const raw = atob(m.w16); const bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    delete m.w16; BG.model = m; BG.W = f16toF32(new Uint16Array(bytes.buffer));
    try { const g = U2GL.create(); if (g) { g.load(m, BG.W, 320); BG.gl = g; } } catch (e) { console.warn('GPU indisponível', e); BG.gl = null; }
  })();
  BG.ready.catch(() => { BG.ready = null; });
  return BG.ready;
}
function f16toF32(u16) { const out = new Float32Array(u16.length); for (let i = 0; i < u16.length; i++) { const h = u16[i], s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff; out[i] = e === 0 ? s * m * 5.960464477539063e-8 : e === 31 ? (m ? NaN : s * Infinity) : s * (1 + m / 1024) * Math.pow(2, e - 15); } return out; }
function cpuRun(input, onP) {
  return new Promise((res, rej) => {
    if (!BG.worker) {
      const src = `const { u2netRun } = (${U2CPU_factory.toString()})();` + `
self.onmessage = e => { const d = e.data; if (d.init) { self.M = d.model; self.W = d.W; return; }
  try { const o = u2netRun(self.M, self.W, d.input, 320, p => self.postMessage({ p })); self.postMessage({ out: o.d }, [o.d.buffer]); } catch (err) { self.postMessage({ err: String(err) }); } };`;
      try { BG.worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))); }
      catch (e) { rej(new Error('este navegador bloqueou o processamento em segundo plano (' + e.message + ')')); return; }
      BG.worker.onerror = e => rej(new Error('falha no processamento: ' + (e.message || 'worker')));
      BG.worker.postMessage({ init: true, model: BG.model, W: BG.W });
    }
    BG.worker.onmessage = e => { if (e.data.p !== undefined) onP(e.data.p); else if (e.data.err) rej(new Error(e.data.err)); else res({ d: e.data.out, w: 320, h: 320 }); };
    BG.worker.postMessage({ input }, [input.buffer]);
  });
}
async function removeBackground(img, onP) {
  await bgLoad(); onP(.03);
  const S0 = 320; const c = document.createElement('canvas'); c.width = c.height = S0; const x = c.getContext('2d');
  x.drawImage(img, 0, 0, S0, S0); const px = x.getImageData(0, 0, S0, S0).data;
  let mx = 0; for (let i = 0; i < px.length; i += 4) mx = Math.max(mx, px[i], px[i + 1], px[i + 2]); mx = mx || 255;
  const mean = [.485, .456, .406], std = [.229, .224, .225], inp = new Float32Array(3 * S0 * S0);
  for (let i = 0, p = 0; i < S0 * S0; i++, p += 4) for (let ch = 0; ch < 3; ch++) inp[ch * S0 * S0 + i] = (px[p + ch] / mx - mean[ch]) / std[ch];
  let out = null;
  if (BG.gl) {
    try {
      out = await BG.gl.run(inp.slice(), S0, p => onP(.05 + p * .9));
      let bad = 0, lo = Infinity, hi = -Infinity; for (const v of out.d) { if (!Number.isFinite(v)) bad++; else { if (v < lo) lo = v; if (v > hi) hi = v; } }
      if (bad || hi - lo < .05) throw new Error('resultado da GPU inválido');
    } catch (e) { console.warn('GPU falhou, usando CPU', e); BG.gl = null; out = null; $('procMsg').textContent = 'Usando o processador (mais lento)… pode levar até 1 minuto.'; }
  }
  if (!out) out = await cpuRun(inp, p => onP(.05 + p * .9));
  // normaliza e aplica máscara
  let mn = Infinity, mxv = -Infinity; for (const v of out.d) { if (v < mn) mn = v; if (v > mxv) mxv = v; }
  const mc = document.createElement('canvas'); mc.width = mc.height = S0; const mx2 = mc.getContext('2d'); const md = mx2.createImageData(S0, S0);
  for (let i = 0; i < S0 * S0; i++) { const v = clamp(((out.d[i] - mn) / (mxv - mn || 1) - .06) / .88); md.data[i * 4 + 3] = v * 255; }
  mx2.putImageData(md, 0, 0);
  const maxD = 1400, sc = Math.min(1, maxD / Math.max(img.width, img.height));
  const W = Math.round(img.width * sc), H = Math.round(img.height * sc);
  const oc = document.createElement('canvas'); oc.width = W; oc.height = H; const ox = oc.getContext('2d');
  ox.imageSmoothingQuality = 'high'; ox.drawImage(mc, 0, 0, W, H); ox.globalCompositeOperation = 'source-in'; ox.drawImage(img, 0, 0, W, H);
  return trimAlpha(oc);
}
function trimAlpha(c) {
  const x = c.getContext('2d'); const d = x.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) if (d[(y * c.width + xx) * 4 + 3] > 12) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return c;
  const m = 4; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(c.width - 1, x1 + m); y1 = Math.min(c.height - 1, y1 + m);
  const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1; o.getContext('2d').drawImage(c, -x0, -y0); return o;
}
function hasTransparency(img) {
  const c = document.createElement('canvas'); const s = Math.min(1, 200 / Math.max(img.width, img.height)); c.width = Math.max(1, img.width * s | 0); c.height = Math.max(1, img.height * s | 0);
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height); const d = x.getImageData(0, 0, c.width, c.height).data;
  let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] < 200) n++; return n > d.length / 4 * .03;
}
function downscale(img, maxD) {
  const sc = Math.min(1, maxD / Math.max(img.width, img.height)); const c = document.createElement('canvas');
  c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c;
}
const toBlob = (c, type = 'image/png', q) => new Promise(r => c.toBlob(r, type, q));

// Fotos de celular vêm com a rotação gravada no EXIF; aqui ela é aplicada de verdade nos pixels
function jpegInfo(v) {
  const r = { o: 1, rw: 0, rh: 0 };
  try {
    if (v.getUint16(0) !== 0xFFD8) return r;
    for (let p = 2; p + 4 < v.byteLength;) {
      const m = v.getUint16(p), len = v.getUint16(p + 2);
      if (m === 0xFFE1 && v.getUint32(p + 4) === 0x45786966) {
        const t = p + 10, le = v.getUint16(t) === 0x4949, off = t + v.getUint32(t + 4, le), n = v.getUint16(off, le);
        for (let i = 0; i < n; i++) { const e = off + 2 + i * 12; if (v.getUint16(e, le) === 0x0112) r.o = v.getUint16(e + 8, le); }
      } else if (m >= 0xFFC0 && m <= 0xFFCF && m !== 0xFFC4 && m !== 0xFFC8 && m !== 0xFFCC) { r.rh = v.getUint16(p + 5); r.rw = v.getUint16(p + 7); break; }
      if ((m & 0xFF00) !== 0xFF00) break;
      p += 2 + len;
    }
  } catch (e) {}
  return r;
}
async function readOriented(file) {
  const plain = () => loadImg(URL.createObjectURL(file));
  let info = { o: 1, rw: 0, rh: 0 };
  try { info = jpegInfo(new DataView(await file.slice(0, 262144).arrayBuffer())); } catch (e) {}
  if (info.o < 2 || info.o > 8 || !window.createImageBitmap) return plain();
  let bmp; try { bmp = await createImageBitmap(file, { imageOrientation: 'none' }); } catch (e) { return plain(); }
  const w = bmp.width, h = bmp.height, o = info.o, swap = o >= 5;
  const done = info.rw && swap && (w !== info.rw || h !== info.rh); // o navegador ignorou a opção e já girou sozinho
  const c = document.createElement('canvas'); c.width = swap && !done ? h : w; c.height = swap && !done ? w : h;
  const x = c.getContext('2d');
  if (!done) x.setTransform(...[null, [1, 0, 0, 1, 0, 0], [-1, 0, 0, 1, w, 0], [-1, 0, 0, -1, w, h], [1, 0, 0, -1, 0, h], [0, 1, 1, 0, 0, 0], [0, 1, -1, 0, h, 0], [0, -1, -1, 0, h, w], [0, -1, 1, 0, 0, w]][o]);
  x.drawImage(bmp, 0, 0); bmp.close && bmp.close();
  return c;
}

let pending = null;
$('file').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const pi = preacherInfo(); if (!pi.nome) { toast('Escolha ou digite o nome do pregador antes.'); return; }
  let img; try { img = await readOriented(f); } catch (err) { toast('Não consegui abrir essa imagem.'); return; }
  const proc = $('proc'); proc.classList.add('show'); $('procBtns').classList.add('hidden');
  $('procPv').innerHTML = ''; const th = downscale(img, 240); $('procPv').appendChild(th);
  $('procBar').style.width = '2%'; $('procTitle').textContent = 'Removendo o fundo…';
  $('procMsg').textContent = 'Processando no seu aparelho — a foto não sai daqui. Pode levar alguns segundos.';
  pending = { orig: img, cut: null };
  try {
    if (hasTransparency(img)) { pending.cut = trimAlpha(downscale(img, 1400)); $('procMsg').textContent = 'Essa imagem já está sem fundo.'; }
    else pending.cut = await removeBackground(img, p => { $('procBar').style.width = Math.round(p * 100) + '%'; });
    $('procBar').style.width = '100%'; $('procTitle').textContent = 'Fundo removido ✓';
    if (!$('procMsg').textContent.startsWith('Essa')) $('procMsg').textContent = 'Confira o recorte. Se não ficou bom, use a foto original.';
    $('procPv').innerHTML = ''; $('procPv').appendChild(downscale(pending.cut, 240));
    S.foto = pending.cut; S.fotoKey = null; resetAdjust(); redraw();
  } catch (err) {
    console.warn(err); $('procTitle').textContent = 'Não foi possível remover o fundo aqui';
    $('procMsg').textContent = 'Você pode usar a foto original (com fundo) ou enviar um PNG já recortado. Detalhe técnico: ' + ((err && err.message) || err); pending.cut = null;
  }
  $('procBtns').classList.remove('hidden'); $('procSave').classList.toggle('hidden', !pending.cut);
};
$('procSave').onclick = async () => {
  if (!pending || !pending.cut) return; $('procSave').disabled = true; $('procTitle').textContent = 'Salvando…';
  try { const blob = await toBlob(pending.cut); const r = await savePhoto(blob); S.fotoKey = r.id; S.foto = pending.cut; toast('Foto salva na biblioteca ✓'); }
  finally { $('procSave').disabled = false; $('proc').classList.remove('show'); pending = null; renderLib(); redraw(); }
};
$('procOrig').onclick = async () => {
  if (!pending) return; const c = downscale(pending.orig, 1400); S.foto = c; S.fotoKey = null; resetAdjust();
  const blob = await toBlob(c, 'image/jpeg', .9); const r = await savePhoto(blob); S.fotoKey = r.id;
  $('proc').classList.remove('show'); pending = null; renderLib(); redraw(); toast('Usando a foto original');
};
$('procCancel').onclick = () => { $('proc').classList.remove('show'); pending = null; S.foto = null; S.fotoKey = null; autoPickPhoto(); redraw(); };

/* ------------------------------ exportar ------------------------------ */
let downloadsP = null;
function getDownloads() { if (!downloadsP) downloadsP = (window.claude && typeof claude.use === 'function') ? claude.use('downloads').catch(() => null) : Promise.resolve(null); return downloadsP; }
async function saveFile(blob, filename) {
  const dl = await getDownloads();
  if (dl) {
    try { await dl.save({ filename, data: blob }); toast('Arquivo pronto ✓'); return; }
    catch (e) { if (e && e.code === 'declined') { toast('Download cancelado'); return; } if (e && e.code === 'rate_limited') { toast('Aguarde um instante e tente de novo.'); return; } console.warn('downloads', e); }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
function fileBase(fmt = S.formato) { const c = CULTOS[S.culto]; return `${slug(c.nome)}-${S.data || 'data'}-${fmt}`; }
function exportCanvas(fmt = S.formato) { const f = FORMATOS[fmt]; const c = document.createElement('canvas'); c.width = f.w; c.height = f.h; return c; }
$('pngBtn').onclick = async () => {
  await fontsReady; const c = exportCanvas(); render(c.getContext('2d'), Infinity);
  saveFile(await toBlob(c), fileBase() + '.png');
};

/* MP4: WebCodecs (H.264) + multiplexador MP4 próprio; plano B: MediaRecorder */
function mp4Mux(samples, avcC, width, height, fps) {
  const TS = 90000, delta = Math.round(TS / fps), n = samples.length;
  const enc = new TextEncoder();
  const u32 = v => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255], u16 = v => [(v >> 8) & 255, v & 255];
  const cat = parts => { let len = 0; for (const p of parts) len += p.length; const o = new Uint8Array(len); let i = 0; for (const p of parts) { o.set(p, i); i += p.length; } return o; };
  const box = (type, ...parts) => { const body = cat(parts.map(p => p instanceof Uint8Array ? p : new Uint8Array(p))); return cat([new Uint8Array(u32(body.length + 8)), enc.encode(type), body]); };
  const full = (type, v, flags, ...parts) => box(type, [v, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255], ...parts);
  const matrix = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].flatMap(u32);
  const durMs = Math.round(n * 1000 / fps), durTs = n * delta;
  const sizes = samples.map(s => s.data.length), mdatLen = sizes.reduce((a, b) => a + b, 0);
  const build = off => {
    const avc1 = box('avc1', [0, 0, 0, 0, 0, 0, ...u16(1), ...u16(0), ...u16(0), ...u32(0), ...u32(0), ...u32(0), ...u16(width), ...u16(height), ...u32(0x00480000), ...u32(0x00480000), ...u32(0), ...u16(1), ...new Array(32).fill(0), ...u16(0x18), ...u16(0xffff)], box('avcC', avcC));
    const keys = samples.map((s, i) => s.key ? i + 1 : 0).filter(Boolean);
    const stbl = box('stbl',
      full('stsd', 0, 0, u32(1), avc1),
      full('stts', 0, 0, [...u32(1), ...u32(n), ...u32(delta)]),
      full('stss', 0, 0, [...u32(keys.length), ...keys.flatMap(u32)]),
      full('stsc', 0, 0, [...u32(1), ...u32(1), ...u32(n), ...u32(1)]),
      full('stsz', 0, 0, [...u32(0), ...u32(n), ...sizes.flatMap(u32)]),
      full('stco', 0, 0, [...u32(1), ...u32(off)]));
    const minf = box('minf', full('vmhd', 0, 1, [0, 0, 0, 0, 0, 0, 0, 0]), box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))), stbl);
    const mdia = box('mdia', full('mdhd', 0, 0, [...u32(0), ...u32(0), ...u32(TS), ...u32(durTs), ...u16(0x55c4), ...u16(0)]),
      full('hdlr', 0, 0, [...u32(0), ...enc.encode('vide'), ...u32(0), ...u32(0), ...u32(0), ...enc.encode('VideoHandler'), 0]), minf);
    const tkhd = full('tkhd', 0, 3, [...u32(0), ...u32(0), ...u32(1), ...u32(0), ...u32(durMs), ...u32(0), ...u32(0), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...matrix, ...u32(width << 16), ...u32(height << 16)]);
    const mvhd = full('mvhd', 0, 0, [...u32(0), ...u32(0), ...u32(1000), ...u32(durMs), ...u32(0x00010000), ...u16(0x0100), ...u16(0), ...u32(0), ...u32(0), ...matrix, ...new Array(24).fill(0), ...u32(2)]);
    return box('moov', mvhd, box('trak', tkhd, mdia));
  };
  const ftyp = box('ftyp', enc.encode('isom'), u32(0x200), enc.encode('isomiso2avc1mp41'));
  const moov0 = build(0); const off = ftyp.length + moov0.length + 8; const moov = build(off);
  const mdatHead = new Uint8Array([...u32(mdatLen + 8), ...enc.encode('mdat')]);
  return new Blob([ftyp, moov, mdatHead, ...samples.map(s => s.data)], { type: 'video/mp4' });
}
async function pickCodec(w, h) {
  if (typeof VideoEncoder === 'undefined') return null;
  for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42002a', 'avc1.640032']) {
    const cfg = { codec, width: w, height: h, bitrate: 8_000_000, framerate: FPS, avc: { format: 'avc' } };
    try { const r = await VideoEncoder.isConfigSupported(cfg); if (r.supported) return cfg; } catch (e) {}
  }
  return null;
}
async function encodeWebCodecs(cfg, c, ctx, onP) {
  const samples = []; let avcC = null, err = null;
  const enc = new VideoEncoder({
    output: (chunk, meta) => { if (meta && meta.decoderConfig && meta.decoderConfig.description && !avcC) avcC = new Uint8Array(meta.decoderConfig.description); const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d); samples.push({ data: d, key: chunk.type === 'key' }); },
    error: e => { err = e; },
  });
  enc.configure(cfg);
  const n = VIDEO_SEG * FPS;
  for (let i = 0; i < n; i++) {
    if (err) throw err;
    render(ctx, i / FPS, { fmt: 'story' });
    const fr = new VideoFrame(c, { timestamp: Math.round(i * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
    enc.encode(fr, { keyFrame: i % (FPS * 2) === 0 }); fr.close();
    if (enc.encodeQueueSize > 6) await new Promise(r => { const chk = () => enc.encodeQueueSize > 2 ? setTimeout(chk, 5) : r(); chk(); });
    if (i % 5 === 0) { onP(i / n); await new Promise(r => setTimeout(r, 0)); }
  }
  await enc.flush(); enc.close(); if (err) throw err;
  if (!avcC) throw new Error('sem avcC');
  return mp4Mux(samples, avcC, c.width, c.height, FPS);
}
async function encodeRecorder(c, ctx, onP) {
  const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  const type = types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)); if (!type) throw new Error('Gravação de vídeo não suportada neste navegador');
  const stream = c.captureStream(FPS); const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8_000_000 }); const parts = [];
  rec.ondataavailable = e => e.data.size && parts.push(e.data);
  const done = new Promise(r => rec.onstop = r); rec.start(250); const t0 = performance.now();
  await new Promise(res => { const step = () => { const t = (performance.now() - t0) / 1000; render(ctx, t, { fmt: 'story' }); onP(t / VIDEO_SEG); if (t < VIDEO_SEG) requestAnimationFrame(step); else res(); }; step(); });
  rec.stop(); await done;
  return { blob: new Blob(parts, { type: type.split(';')[0] }), ext: type.includes('mp4') ? 'mp4' : 'webm' };
}
$('mp4Btn').onclick = async () => {
  const btn = $('mp4Btn'); if (btn.disabled) return; btn.disabled = true; $('vidBarWrap').classList.remove('hidden');
  const setP = p => { $('vidBar').style.width = Math.round(p * 100) + '%'; };
  $('exportOut').textContent = 'Gerando vídeo…'; setP(0);
  try {
    await fontsReady; const c = exportCanvas('story'); const ctx = c.getContext('2d'); // vídeo sempre 1080×1920
    const cfg = await pickCodec(c.width, c.height); let blob, ext = 'mp4';
    if (cfg) { try { blob = await encodeWebCodecs(cfg, c, ctx, setP); } catch (e) { console.warn('WebCodecs falhou', e); } }
    if (!blob) { $('exportOut').textContent = 'Gravando em tempo real (8 s)…'; const r = await encodeRecorder(c, ctx, setP); blob = r.blob; ext = r.ext; }
    setP(1); $('exportOut').textContent = `Vídeo pronto · ${(blob.size / 1048576).toFixed(1)} MB · ${VIDEO_SEG}s${ext === 'webm' ? ' (WEBM: este navegador não grava MP4)' : ''}`;
    await saveFile(blob, `${fileBase('story')}.${ext}`);
  } catch (e) { console.warn(e); $('exportOut').textContent = 'Não foi possível gerar o vídeo neste navegador. ' + (e.message || ''); }
  finally { btn.disabled = false; setTimeout(() => $('vidBarWrap').classList.add('hidden'), 1500); }
};

/* ------------------------- assistente (celular) ------------------------- */
let step = 1; const TOTAL = 6;
function isMobile() { return matchMedia('(max-width:820px)').matches; }
function showStep(n) {
  step = clamp(n, 1, TOTAL);
  document.querySelectorAll('.step').forEach(s => s.classList.toggle('active', +s.dataset.step === step));
  $('stepinfo').innerHTML = Array.from({ length: TOTAL }, (_, i) => `<i class="${i < step ? 'done' : ''}"></i>`).join('') + `<small style="color:var(--muted);margin-left:6px;white-space:nowrap">${step}/${TOTAL}</small>`;
  $('prevBtn').style.visibility = step === 1 ? 'hidden' : 'visible';
  $('nextBtn').textContent = step === TOTAL ? 'Recomeçar' : step === TOTAL - 1 ? 'Ver e exportar' : 'Avançar';
  document.body.classList.toggle('final', step === TOTAL);
  if (step === TOTAL) buildSummary();
  closePop();
  if (step === 1) updateCultos();
  if (step === 5) { renderLib(); syncCarousel(); }
  if (isMobile()) window.scrollTo({ top: 0, behavior: 'smooth' });
}
$('prevBtn').onclick = () => showStep(step - 1);
$('nextBtn').onclick = () => {
  if (step === 5 && S.pregador === 'outro' && !S.outroNome.trim()) { toast('Digite o nome do pregador'); $('outroNome').focus(); return; }
  showStep(step === TOTAL ? 1 : step + 1);
};
function buildSummary() {
  const c = CULTOS[S.culto], m = curModel(), pi = preacherInfo(), d = S.data ? new Date(S.data + 'T12:00:00') : null;
  $('summary').innerHTML = `<dt>Culto</dt><dd>${c.nome}</dd><dt>Modelo</dt><dd>${m.nome}</dd><dt>Formato</dt><dd>${FORMATOS[S.formato].nome}</dd><dt>Data</dt><dd>${d ? d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : '—'} · ${S.hora}</dd><dt>Pregador</dt><dd>${pi.nome ? pi.nome.replace(/</g, '&lt;') : '—'}</dd><dt>Foto</dt><dd>${S.foto ? 'ok' : 'sem foto'}</dd>`;
}
document.querySelectorAll('.step').forEach(s => s.addEventListener('click', () => { if (!isMobile() && +s.dataset.step === TOTAL) buildSummary(); }));

/* ------------------------------ início ------------------------------ */
const fontsReady = (async () => {
  try { await Promise.race([Promise.all(['100px Anton', '100px "Mrs Saint Delafield"', '800 40px Montserrat', '600 30px Montserrat'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 4000))]); } catch (e) {}
})();
(async () => {
  buildSuggest(); buildCultos(); buildFormats(); buildPreachers(); syncForm(); resetAdjust(); showStep(1); buildSummary();
  try { [R.logoA, R.logoF] = await Promise.all([loadImg(LOGO_ADMMP), loadImg(LOGO_FILA)]); } catch (e) {}
  draw(); await fontsReady; draw(); buildModels();
  await loadLocal(); autoPickPhoto(); initCloud();
  setTimeout(() => bgLoad().catch(() => {}), 1500); // pré-carrega o modelo de recorte
})();
matchMedia('(max-width:820px)').addEventListener('change', () => showStep(step));

/* ------------------------- arte ampliada ------------------------- */
// Toque na prévia: abre a arte grande com fundo desfocado; toque fora da arte (ou em Voltar) fecha.
function closeLightbox() { $('lightbox').classList.remove('show'); }
poster.addEventListener('click', () => {
  try { $('lbImg').src = poster.toDataURL('image/png'); } catch (e) { return; }
  $('lightbox').classList.add('show');
});
$('lightbox').onclick = e => { if (e.target !== $('lbImg')) closeLightbox(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
