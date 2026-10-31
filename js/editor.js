'use strict';
/* ------------------------- editor de recorte ------------------------- */
// Corrige a remoção de fundo à mão: "Borracha" apaga, "Pintar" devolve pixels da foto original.
// Um dedo desenha; dois dedos (pinça) dão zoom e movem. No PC: roda do mouse = zoom, botão direito arrasta.
// Usa funções do app.js ($, clamp, toCanvas, trimAlpha, savePhoto, ...), por isso é carregado depois dele.
const ED = { ctx: null, base: null, cb: null, mode: 'erase', size: 40, z: 1, tx: 0, ty: 0, fit: 1, undo: [], redo: [], ptrs: new Map(), stroke: null, gest: null, pan: null };
const ED_MAX_UNDO = 8;

function openEditor(cut, base, cb) {
  const cv = $('edCanvas'); cv.width = cut.width; cv.height = cut.height;
  ED.ctx = cv.getContext('2d'); ED.ctx.clearRect(0, 0, cv.width, cv.height); ED.ctx.drawImage(cut, 0, 0);
  const g = $('edGhost'); g.width = cut.width; g.height = cut.height; const gx = g.getContext('2d'); gx.clearRect(0, 0, g.width, g.height);
  ED.base = base && base.width === cut.width && base.height === cut.height ? base : null;
  if (ED.base) gx.drawImage(ED.base, 0, 0);
  ED.cb = cb; ED.undo = []; ED.redo = []; ED.ptrs.clear(); ED.stroke = ED.gest = ED.pan = null;
  $('editor').classList.add('show');
  document.querySelector('#editor [data-mode="paint"]').disabled = !ED.base;
  $('edHint').textContent = ED.base ? 'Um dedo apaga ou pinta · dois dedos dão zoom e movem' : 'Esta foto foi salva sem a original, então só a borracha funciona.';
  edMode('erase'); edHist(); requestAnimationFrame(edFit);
}
function edClose() { $('editor').classList.remove('show'); ED.undo = []; ED.redo = []; }
function edFit() {
  const v = $('edView'), cv = $('edCanvas'), W = v.clientWidth, H = v.clientHeight;
  ED.fit = Math.min(W / cv.width, H / cv.height) * .94;
  const w = cv.width * ED.fit, h = cv.height * ED.fit;
  $('edLayer').style.width = w + 'px'; $('edLayer').style.height = h + 'px';
  ED.z = 1; ED.tx = (W - w) / 2; ED.ty = (H - h) / 2; edApply();
}
function edApply() { $('edLayer').style.transform = `translate(${ED.tx}px,${ED.ty}px) scale(${ED.z})`; }
function edMode(m) {
  ED.mode = m; document.querySelectorAll('#editor [data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  $('edGhost').style.opacity = m === 'paint' ? .35 : 0;
}
function edHist() { $('edUndo').disabled = !ED.undo.length; $('edRedo').disabled = !ED.redo.length; }
function edSnap() { const c = ED.ctx.canvas; return ED.ctx.getImageData(0, 0, c.width, c.height); }
function edViewPt(e) { const r = $('edView').getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function edImgPt(p) { const k = ED.z * ED.fit; return { x: (p.x - ED.tx) / k, y: (p.y - ED.ty) / k }; }
// pinta/apaga círculos ao longo do segmento a→b (raio = tamanho do pincel na tela, convertido para pixels da foto)
function edDab(a, b) {
  const c = ED.ctx, r = ED.size / 2 / (ED.z * ED.fit), d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(d / (r * .35)));
  c.save(); c.beginPath();
  for (let i = 0; i <= n; i++) { const x = a.x + (b.x - a.x) * i / n, y = a.y + (b.y - a.y) * i / n; c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2); }
  if (ED.mode === 'erase') { c.globalCompositeOperation = 'destination-out'; c.fill(); }
  else if (ED.base) { c.clip(); c.drawImage(ED.base, 0, 0); }
  c.restore();
}
function edRing(p, show) {
  const ring = $('edRing'); ring.style.display = show ? 'block' : 'none'; if (!show) return;
  ring.style.width = ring.style.height = ED.size + 'px'; ring.style.transform = `translate(${p.x - ED.size / 2}px,${p.y - ED.size / 2}px)`;
}
{
  const v = $('edView');
  v.addEventListener('contextmenu', e => e.preventDefault());
  v.addEventListener('pointerdown', e => {
    v.setPointerCapture(e.pointerId); const p = edViewPt(e); ED.ptrs.set(e.pointerId, p);
    if (e.pointerType === 'mouse' && e.button === 2) { ED.pan = { x: p.x, y: p.y, tx: ED.tx, ty: ED.ty }; return; }
    if (ED.ptrs.size === 1) {
      ED.undo.push(edSnap()); if (ED.undo.length > ED_MAX_UNDO) ED.undo.shift(); ED.redo = [];
      ED.stroke = edImgPt(p); edDab(ED.stroke, ED.stroke); edRing(p, true);
    } else if (ED.ptrs.size === 2) {
      if (ED.stroke) { ED.ctx.putImageData(ED.undo.pop(), 0, 0); ED.stroke = null; } // era o começo de uma pinça, não um traço
      const [a, b] = [...ED.ptrs.values()];
      ED.gest = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, z0: ED.z, tx0: ED.tx, ty0: ED.ty };
      edRing(p, false);
    }
    edHist();
  });
  v.addEventListener('pointermove', e => {
    const p = edViewPt(e);
    if (e.pointerType === 'mouse' && !ED.ptrs.size) { edRing(p, true); return; }
    if (!ED.ptrs.has(e.pointerId)) return;
    ED.ptrs.set(e.pointerId, p);
    if (ED.pan) { ED.tx = ED.pan.tx + p.x - ED.pan.x; ED.ty = ED.pan.ty + p.y - ED.pan.y; edApply(); return; }
    if (ED.gest && ED.ptrs.size >= 2) {
      const [a, b] = [...ED.ptrs.values()], g = ED.gest, m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      ED.z = clamp(g.z0 * Math.hypot(a.x - b.x, a.y - b.y) / g.d0, 1, 12);
      ED.tx = m.x - (g.m0.x - g.tx0) * ED.z / g.z0; ED.ty = m.y - (g.m0.y - g.ty0) * ED.z / g.z0; edApply();
    } else if (ED.stroke) { const q = edImgPt(p); edDab(ED.stroke, q); ED.stroke = q; edRing(p, true); }
  });
  const up = e => {
    ED.ptrs.delete(e.pointerId);
    if (ED.ptrs.size < 2) ED.gest = null;
    if (!ED.ptrs.size) { ED.stroke = null; ED.pan = null; if (e.pointerType !== 'mouse') edRing(null, false); edHist(); }
  };
  v.addEventListener('pointerup', up); v.addEventListener('pointercancel', up);
  v.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !ED.ptrs.size) edRing(null, false); });
  v.addEventListener('wheel', e => {
    e.preventDefault(); const p = edViewPt(e), z = clamp(ED.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 1, 12);
    ED.tx = p.x - (p.x - ED.tx) * z / ED.z; ED.ty = p.y - (p.y - ED.ty) * z / ED.z; ED.z = z; edApply();
  }, { passive: false });
}
document.querySelectorAll('#editor [data-mode]').forEach(b => b.onclick = () => edMode(b.dataset.mode));
$('edSize').oninput = e => { ED.size = +e.target.value; $('edSizeO').textContent = ED.size; };
$('edUndo').onclick = () => { if (!ED.undo.length) return; ED.redo.push(edSnap()); ED.ctx.putImageData(ED.undo.pop(), 0, 0); edHist(); };
$('edRedo').onclick = () => { if (!ED.redo.length) return; ED.undo.push(edSnap()); ED.ctx.putImageData(ED.redo.pop(), 0, 0); edHist(); };
$('edFitBtn').onclick = edFit;
$('edCancel').onclick = async () => { if (ED.undo.length && !(await confirmBox('Descartar as correções feitas?'))) return; edClose(); };
$('edDone').onclick = () => { const res = toCanvas(ED.ctx.canvas), cb = ED.cb; edClose(); if (cb) cb(res); };
window.addEventListener('resize', () => { if ($('editor').classList.contains('show')) edFit(); });

// Corrigir uma foto que já está na biblioteca: salva a versão corrigida e remove a antiga
async function editLibItem(it) {
  let cut, base = null;
  try { cut = toCanvas(await loadImg(it.url)); } catch (e) { toast('Não foi possível abrir esta foto.'); return; }
  if (it.origUrl) { try { base = await loadImg(it.origUrl); } catch (e) {} }
  const origBlob = it.origUrl ? await fetch(it.origUrl).then(r => r.blob()).catch(() => null) : null;
  openEditor(cut, base, async res => {
    try {
      const r = await savePhoto(await toBlob(res), base && base.width === res.width && base.height === res.height ? origBlob : null);
      try {
        if (it.src === 'cloud') { await Lib.db.doc('fotos/' + it.rid).delete(); if (Lib.assets && it.assetId) Lib.assets.delete(it.assetId).catch(() => {}); }
        else if (it.src === 'local') { await idbDel(it.rid); await loadLocal(); }
      } catch (e) {}
      S.fotoKey = r.id; S.foto = trimAlpha(res); libSig = ''; renderLib(); syncCarousel(); redraw(); toast('Recorte corrigido ✓');
    } catch (e) { console.warn(e); toast('Não foi possível salvar a correção.'); }
  });
}
