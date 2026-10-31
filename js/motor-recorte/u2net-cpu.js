// Motor de recorte (CPU) — roda dentro de um Web Worker. Não depende de nada externo.
function U2CPU_factory() {
// Pure-JS U2-Net-P inference engine (CPU). Works in a Web Worker or Node.
// model = {layers, input, output}, W = Float32Array of weights.
function u2netRun(model, W, input, S, onProgress) {
  const T = new Map();
  T.set(model.input, { c: 3, h: S, w: S, d: input });
  const L = model.layers;
  for (let li = 0; li < L.length; li++) {
    const l = L[li];
    let out;
    if (l.op === 'conv') out = conv(T.get(l.i), l, W);
    else if (l.op === 'pool') out = pool(T.get(l.i));
    else if (l.op === 'resize') out = resize(T.get(l.i), l.h, l.w);
    else if (l.op === 'cat') out = cat(l.in.map(i => T.get(i)));
    else if (l.op === 'add') { const a = T.get(l.in[0]), b = T.get(l.in[1]); const d = new Float32Array(a.d.length); for (let i = 0; i < d.length; i++) d[i] = a.d[i] + b.d[i]; out = { c: a.c, h: a.h, w: a.w, d }; }
    else if (l.op === 'sig') { const a = T.get(l.i); const d = new Float32Array(a.d.length); for (let i = 0; i < d.length; i++) d[i] = 1 / (1 + Math.exp(-a.d[i])); out = { c: a.c, h: a.h, w: a.w, d }; }
    else if (l.op === 'relu') { const a = T.get(l.i); const d = new Float32Array(a.d.length); for (let i = 0; i < d.length; i++) d[i] = a.d[i] > 0 ? a.d[i] : 0; out = { c: a.c, h: a.h, w: a.w, d }; }
    for (const f of l.free) T.delete(f);
    T.set(l.o, out);
    if (onProgress && (li % 4 === 0)) onProgress(li / L.length);
  }
  return T.get(model.output);
}

function conv(x, l, W) {
  const H = x.h, Wd = x.w, CI = l.ci, CO = l.co, k = l.k, p = l.p, dl = l.d;
  const HW = H * Wd;
  const out = new Float32Array(CO * HW);
  const src = x.d;
  const wo = l.w, bo = l.b;
  for (let co = 0; co < CO; co++) {
    const ob = co * HW;
    const bias = W[bo + co];
    for (let i = 0; i < HW; i++) out[ob + i] = bias;
    for (let ci = 0; ci < CI; ci++) {
      const ib = ci * HW;
      const wb = wo + (co * CI + ci) * k * k;
      for (let ky = 0; ky < k; ky++) {
        const dy = ky * dl - p;
        const y0 = Math.max(0, -dy), y1 = Math.min(H, H - dy);
        for (let kx = 0; kx < k; kx++) {
          const wv = W[wb + ky * k + kx];
          if (wv === 0) continue;
          const dx = kx * dl - p;
          const x0 = Math.max(0, -dx), x1 = Math.min(Wd, Wd - dx);
          for (let y = y0; y < y1; y++) {
            const orow = ob + y * Wd;
            const irow = ib + (y + dy) * Wd + dx;
            for (let xx = x0; xx < x1; xx++) out[orow + xx] += wv * src[irow + xx];
          }
        }
      }
    }
    if (l.relu) for (let i = 0; i < HW; i++) if (out[ob + i] < 0) out[ob + i] = 0;
  }
  return { c: CO, h: H, w: Wd, d: out };
}

function pool(x) {
  const H = x.h, Wd = x.w, oh = Math.ceil(H / 2), ow = Math.ceil(Wd / 2);
  const d = new Float32Array(x.c * oh * ow);
  for (let c = 0; c < x.c; c++) {
    const ib = c * H * Wd, ob = c * oh * ow;
    for (let y = 0; y < oh; y++) for (let xx = 0; xx < ow; xx++) {
      let m = -Infinity;
      for (let a = 0; a < 2; a++) { const yy = y * 2 + a; if (yy >= H) continue; for (let b = 0; b < 2; b++) { const x2 = xx * 2 + b; if (x2 >= Wd) continue; const v = x.d[ib + yy * Wd + x2]; if (v > m) m = v; } }
      d[ob + y * ow + xx] = m;
    }
  }
  return { c: x.c, h: oh, w: ow, d };
}

function coords(o, i) {
  const f = new Float32Array(o), lo = new Int32Array(o), hi = new Int32Array(o);
  if (o === 1) return { f, lo, hi };
  for (let j = 0; j < o; j++) {
    let s = (j + 0.5) * i / o - 0.5; s = Math.min(Math.max(s, 0), i - 1);
    const l = Math.floor(s); lo[j] = l; hi[j] = Math.min(l + 1, i - 1); f[j] = s - l;
  }
  return { f, lo, hi };
}

function resize(x, oh, ow) {
  const H = x.h, Wd = x.w; const cy = coords(oh, H), cx = coords(ow, Wd);
  const d = new Float32Array(x.c * oh * ow);
  for (let c = 0; c < x.c; c++) {
    const ib = c * H * Wd, ob = c * oh * ow;
    for (let y = 0; y < oh; y++) {
      const fy = cy.f[y], r0 = ib + cy.lo[y] * Wd, r1 = ib + cy.hi[y] * Wd;
      for (let xx = 0; xx < ow; xx++) {
        const fx = cx.f[xx], a = cx.lo[xx], b = cx.hi[xx];
        const top = x.d[r0 + a] * (1 - fx) + x.d[r0 + b] * fx;
        const bot = x.d[r1 + a] * (1 - fx) + x.d[r1 + b] * fx;
        d[ob + y * ow + xx] = top * (1 - fy) + bot * fy;
      }
    }
  }
  return { c: x.c, h: oh, w: ow, d };
}

function cat(xs) {
  const c = xs.reduce((s, x) => s + x.c, 0); const d = new Float32Array(c * xs[0].h * xs[0].w);
  let o = 0; for (const x of xs) { d.set(x.d, o); o += x.d.length; }
  return { c, h: xs[0].h, w: xs[0].w, d };
}

function f16toF32(u16) {
  const out = new Float32Array(u16.length);
  for (let i = 0; i < u16.length; i++) {
    const h = u16[i], s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff;
    out[i] = e === 0 ? s * m * 5.960464477539063e-8 : e === 31 ? (m ? NaN : s * Infinity) : s * (1 + m / 1024) * Math.pow(2, e - 15);
  }
  return out;
}



return { u2netRun };
}
