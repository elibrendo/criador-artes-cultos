// Motor de recorte (placa de vídeo / WebGL2) — mais rápido.
// WebGL2 U2-Net-P engine. Tensors are stored as RGBA32F textures: 4 channels per texel,
// channel groups tiled in a grid. Returns null from create() when the GPU path is unavailable.
const U2GL = (() => {
  const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
  const HEAD = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
out vec4 o;
`;
  const FS_CONV = HEAD + `
uniform sampler2D X; uniform sampler2D Wt;
uniform int H, Wd, GI, GO, gcIn, gcOut, K, P, D, wOff, relu, wTexW;
vec4 fw(int i){ return texelFetch(Wt, ivec2(i % wTexW, i / wTexW), 0); }
void main(){
  ivec2 fc = ivec2(gl_FragCoord.xy);
  int gx = fc.x / Wd, gy = fc.y / H; int g = gy*gcOut + gx;
  if (g >= GO) { o = vec4(0.); return; }
  int x = fc.x - gx*Wd, y = fc.y - gy*H;
  int KK = K*K;
  int base = wOff + g*(GI*KK*4 + 1);
  vec4 s = fw(base); base += 1;
  for (int gi = 0; gi < GI; gi++) {
    ivec2 org = ivec2((gi % gcIn)*Wd, (gi / gcIn)*H);
    for (int ky = 0; ky < K; ky++) {
      int yy = y + ky*D - P;
      if (yy < 0 || yy >= H) continue;
      for (int kx = 0; kx < K; kx++) {
        int xx = x + kx*D - P;
        if (xx < 0 || xx >= Wd) continue;
        vec4 v = texelFetch(X, org + ivec2(xx, yy), 0);
        int wi = base + (gi*KK + ky*K + kx)*4;
        s += mat4(fw(wi), fw(wi+1), fw(wi+2), fw(wi+3)) * v;
      }
    }
  }
  if (relu == 1) s = max(s, 0.);
  o = s;
}`;
  const FS_POOL = HEAD + `
uniform sampler2D X; uniform int H, Wd, oH, oW, G, gcIn, gcOut;
void main(){
  ivec2 fc = ivec2(gl_FragCoord.xy);
  int gx = fc.x / oW, gy = fc.y / oH; int g = gy*gcOut + gx;
  if (g >= G) { o = vec4(0.); return; }
  int x = fc.x - gx*oW, y = fc.y - gy*oH;
  ivec2 org = ivec2((g % gcIn)*Wd, (g / gcIn)*H);
  vec4 m = vec4(-1e30);
  for (int a = 0; a < 2; a++) for (int b = 0; b < 2; b++) {
    int yy = y*2 + a, xx = x*2 + b;
    if (yy < H && xx < Wd) m = max(m, texelFetch(X, org + ivec2(xx, yy), 0));
  }
  o = m;
}`;
  const FS_RESIZE = HEAD + `
uniform sampler2D X; uniform int H, Wd, oH, oW, G, gcIn, gcOut;
void main(){
  ivec2 fc = ivec2(gl_FragCoord.xy);
  int gx = fc.x / oW, gy = fc.y / oH; int g = gy*gcOut + gx;
  if (g >= G) { o = vec4(0.); return; }
  int x = fc.x - gx*oW, y = fc.y - gy*oH;
  ivec2 org = ivec2((g % gcIn)*Wd, (g / gcIn)*H);
  float sy = oH == 1 ? 0. : clamp((float(y) + .5) * float(H) / float(oH) - .5, 0., float(H-1));
  float sx = oW == 1 ? 0. : clamp((float(x) + .5) * float(Wd) / float(oW) - .5, 0., float(Wd-1));
  int y0 = int(floor(sy)), x0 = int(floor(sx));
  int y1 = min(y0+1, H-1), x1 = min(x0+1, Wd-1);
  float fy = sy - float(y0), fx = sx - float(x0);
  vec4 a = texelFetch(X, org+ivec2(x0,y0),0), b = texelFetch(X, org+ivec2(x1,y0),0);
  vec4 c = texelFetch(X, org+ivec2(x0,y1),0), d = texelFetch(X, org+ivec2(x1,y1),0);
  o = mix(mix(a,b,fx), mix(c,d,fx), fy);
}`;
  const FS_ADD = HEAD + `
uniform sampler2D A; uniform sampler2D B;
void main(){ ivec2 fc = ivec2(gl_FragCoord.xy); o = texelFetch(A, fc, 0) + texelFetch(B, fc, 0); }`;
  // copy group gs of src into group gd of dst (via viewport)
  const FS_COPY = HEAD + `
uniform sampler2D X; uniform ivec2 srcOrg, dstOrg;
void main(){ ivec2 fc = ivec2(gl_FragCoord.xy); o = texelFetch(X, fc - dstOrg + srcOrg, 0); }`;

  function create() {
    const attrs = { antialias: false, depth: false, preserveDrawingBuffer: false };
    let gl = null;
    try { if (typeof OffscreenCanvas !== 'undefined') gl = new OffscreenCanvas(1, 1).getContext('webgl2', attrs); } catch (e) { gl = null; }
    if (!gl) { try { gl = document.createElement('canvas').getContext('webgl2', attrs); } catch (e) { gl = null; } }
    if (!gl) return null;
    if (!gl.getExtension('EXT_color_buffer_float')) return null;
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);

    function prog(fs) {
      const p = gl.createProgram();
      for (const [t, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]]) {
        const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        gl.attachShader(p, s);
      }
      gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
      return { p, u };
    }
    let P;
    try { P = { conv: prog(FS_CONV), pool: prog(FS_POOL), resize: prog(FS_RESIZE), add: prog(FS_ADD), copy: prog(FS_COPY) }; }
    catch (e) { console.warn('U2GL shader', e); return null; }

    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const fb = gl.createFramebuffer();

    function tex(w, h, data) {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data || null);
      return t;
    }
    function tensor(c, h, w, map) {
      const G = Math.ceil(map.padded / 4); const gc = Math.ceil(Math.sqrt(G)); const gr = Math.ceil(G / gc);
      const tw = w * gc, th = h * gr;
      if (tw > maxTex || th > maxTex) throw new Error('texture too large');
      return { c, h, w, G, gc, gr, tw, th, map, t: tex(tw, th) };
    }
    function target(T) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, T.t, 0);
      gl.viewport(0, 0, T.tw, T.th);
    }
    function bind(unit, t, loc) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unit); }

    let wTex = null, wTexW = 4096, convInfo = null, model = null;

    // Builds GPU weight texture. Needs channel maps, so walk the graph once (shapes only).
    function load(m, W, S) {
      model = m;
      const shapes = new Map(); // id -> {c,h,w,map}
      const ident = c => ({ idx: Array.from({ length: c }, (_, i) => i), padded: Math.ceil(c / 4) * 4 });
      shapes.set(m.input, { c: 3, h: S, w: S, map: ident(3) });
      convInfo = new Map(); const blocks = []; let total = 0;
      for (let li = 0; li < m.layers.length; li++) {
        const l = m.layers[li];
        if (l.op === 'conv') {
          const x = shapes.get(l.i); const GI = x.map.padded / 4, GO = Math.ceil(l.co / 4), KK = l.k * l.k;
          const size = GO * (GI * KK * 4 + 1);
          convInfo.set(li, { off: total, GI, GO });
          blocks.push({ l, x, GI, GO, KK, off: total }); total += size;
          shapes.set(l.o, { c: l.co, h: x.h, w: x.w, map: ident(l.co) });
        } else if (l.op === 'pool') { const x = shapes.get(l.i); shapes.set(l.o, { c: x.c, h: Math.ceil(x.h / 2), w: Math.ceil(x.w / 2), map: x.map }); }
        else if (l.op === 'resize') { const x = shapes.get(l.i); shapes.set(l.o, { c: x.c, h: l.h, w: l.w, map: x.map }); }
        else if (l.op === 'add') { const x = shapes.get(l.in[0]); shapes.set(l.o, x); }
        else if (l.op === 'sig' || l.op === 'relu') { const x = shapes.get(l.i); shapes.set(l.o, x); }
        else if (l.op === 'cat') {
          const idx = []; let off = 0, c = 0; const xs = l.in.map(i => shapes.get(i));
          for (const x of xs) { for (const v of x.map.idx) idx.push(v + off); off += x.map.padded; c += x.c; }
          shapes.set(l.o, { c, h: xs[0].h, w: xs[0].w, map: { idx, padded: off } });
        }
      }
      const rows = Math.ceil(total / wTexW);
      const data = new Float32Array(rows * wTexW * 4);
      for (const b of blocks) {
        const { l, x, GI, KK, off } = b;
        for (let co = 0; co < l.co; co++) {
          const g = co >> 2, lane = co & 3; const gb = off + g * (GI * KK * 4 + 1);
          data[gb * 4 + lane] = W[l.b + co];
          for (let ci = 0; ci < l.ci; ci++) {
            const pc = x.map.idx[ci]; const gi = pc >> 2, j = pc & 3;
            for (let t = 0; t < KK; t++) {
              const texel = gb + 1 + (gi * KK + t) * 4 + j; // column j
              data[texel * 4 + lane] = W[l.w + (co * l.ci + ci) * KK + t];
            }
          }
        }
      }
      if (rows > maxTex) throw new Error('weights too large');
      wTex = tex(wTexW, rows, data);
      return true;
    }

    function upload(input, S) { // input planar float32 3xSxS
      const T = tensor(3, S, S, { idx: [0, 1, 2], padded: 4 });
      const d = new Float32Array(T.tw * T.th * 4);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) for (let c = 0; c < 3; c++) d[(y * T.tw + x) * 4 + c] = input[c * S * S + y * S + x];
      gl.bindTexture(gl.TEXTURE_2D, T.t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, T.tw, T.th, 0, gl.RGBA, gl.FLOAT, d);
      return T;
    }

    async function run(input, S, onProgress) {
      const T = new Map(); T.set(model.input, upload(input, S));
      const L = model.layers; const live = [];
      for (let li = 0; li < L.length; li++) {
        const l = L[li]; let out;
        if (l.op === 'conv') {
          const x = T.get(l.i), ci = convInfo.get(li);
          out = tensor(l.co, x.h, x.w, { idx: Array.from({ length: l.co }, (_, i) => i), padded: ci.GO * 4 });
          target(out); const p = P.conv; gl.useProgram(p.p); bind(0, x.t, p.u.X); bind(1, wTex, p.u.Wt);
          const u = p.u;
          gl.uniform1i(u.H, x.h); gl.uniform1i(u.Wd, x.w); gl.uniform1i(u.GI, ci.GI); gl.uniform1i(u.GO, ci.GO);
          gl.uniform1i(u.gcIn, x.gc); gl.uniform1i(u.gcOut, out.gc); gl.uniform1i(u.K, l.k); gl.uniform1i(u.P, l.p); gl.uniform1i(u.D, l.d);
          gl.uniform1i(u.wOff, ci.off); gl.uniform1i(u.relu, l.relu ? 1 : 0); gl.uniform1i(u.wTexW, wTexW);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        } else if (l.op === 'pool' || l.op === 'resize') {
          const x = T.get(l.i); const oh = l.op === 'pool' ? Math.ceil(x.h / 2) : l.h, ow = l.op === 'pool' ? Math.ceil(x.w / 2) : l.w;
          out = tensor(x.c, oh, ow, x.map); target(out); const p = P[l.op]; gl.useProgram(p.p); bind(0, x.t, p.u.X);
          gl.uniform1i(p.u.H, x.h); gl.uniform1i(p.u.Wd, x.w); gl.uniform1i(p.u.oH, oh); gl.uniform1i(p.u.oW, ow);
          gl.uniform1i(p.u.G, x.G); gl.uniform1i(p.u.gcIn, x.gc); gl.uniform1i(p.u.gcOut, out.gc);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        } else if (l.op === 'add') {
          const a = T.get(l.in[0]), b = T.get(l.in[1]);
          out = tensor(a.c, a.h, a.w, a.map); target(out); const p = P.add; gl.useProgram(p.p); bind(0, a.t, p.u.A); bind(1, b.t, p.u.B);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        } else if (l.op === 'cat') {
          const xs = l.in.map(i => T.get(i)); const idx = []; let off = 0, c = 0;
          for (const x of xs) { for (const v of x.map.idx) idx.push(v + off); off += x.map.padded; c += x.c; }
          out = tensor(c, xs[0].h, xs[0].w, { idx, padded: off });
          gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, out.t, 0);
          const p = P.copy; gl.useProgram(p.p); let gd = 0;
          for (const x of xs) {
            bind(0, x.t, p.u.X);
            for (let g = 0; g < x.G; g++, gd++) {
              const sx = (g % x.gc) * x.w, sy = Math.floor(g / x.gc) * x.h, dx = (gd % out.gc) * out.w, dy = Math.floor(gd / out.gc) * out.h;
              gl.viewport(dx, dy, out.w, out.h); gl.uniform2i(p.u.srcOrg, sx, sy); gl.uniform2i(p.u.dstOrg, dx, dy);
              gl.drawArrays(gl.TRIANGLES, 0, 3);
            }
          }
        } else if (l.op === 'sig' || l.op === 'relu') {
          out = T.get(l.i); out = { ...out, post: l.op }; // only final sigmoid in this model; applied on readback
        }
        for (const f of l.free) { const t = T.get(f); if (t && t !== out && !(out && out.t === t.t)) gl.deleteTexture(t.t); T.delete(f); }
        T.set(l.o, out);
        if (li % 12 === 0) { gl.flush(); if (onProgress) onProgress(li / L.length); await new Promise(r => setTimeout(r, 0)); }
      }
      const R = T.get(model.output);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, R.t, 0);
      const buf = new Float32Array(R.w * R.h * 4);
      gl.readPixels(0, 0, R.w, R.h, gl.RGBA, gl.FLOAT, buf);
      const d = new Float32Array(R.w * R.h);
      for (let i = 0; i < d.length; i++) { const v = buf[i * 4]; d[i] = R.post === 'sig' ? 1 / (1 + Math.exp(-v)) : v; }
      for (const t of T.values()) if (t && t.t) gl.deleteTexture(t.t);
      return { c: 1, h: R.h, w: R.w, d };
    }
    return { load, run, gl };
  }
  return { create };
})();

