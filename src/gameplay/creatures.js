'use strict';
/* Creature bodies. Every animal is lofted from measured-looking cross-sections (smooth body, swept lens-section fins),
   wrapped in a painted skin (countershading, markings, eyes, gills) and animated in the vertex shader (tail beat,
   fluke beat, wing undulation, bell pulse), so they move like animals rather than rigid props.
   UV layout for all bodies: u 0..0.88 runs snout to tail around the body (v 0 belly, 0.5 back, 1 belly); fins sample
   a fin swatch at u 0.9..1. */
(function () {
  const G = window.G;
  const TAU = Math.PI * 2;

  // ---------- geometry ----------
  function Builder() { this.P = []; this.U = []; this.I = []; }
  // sections: [t, half width, half height, y centre]; body runs z0 .. z0+len, head at z0
  Builder.prototype.loft = function (CT, o) {
    const NS = o.ns || 36, RS = o.rs || 20, st = [], base = this.P.length / 3;
    for (let i = 0; i <= NS; i++) { const t = Math.pow(i / NS, o.bias || 1.15); let k = 0; while (k < CT.length - 2 && CT[k + 1][0] < t) k++; const a = CT[k], b = CT[k + 1], f = G.clamp((t - a[0]) / (b[0] - a[0]), 0, 1); st.push([t, G.lerp(a[1], b[1], f), G.lerp(a[2], b[2], f), G.lerp(a[3], b[3], f)]); }
    for (let pass = 0; pass < 2; pass++) for (let i = 1; i < NS; i++) for (let c = 1; c < 4; c++) st[i][c] = st[i][c] * 0.5 + (st[i - 1][c] + st[i + 1][c]) * 0.25;
    for (let i = 0; i <= NS; i++) {
      const [t, w, h, yc] = st[i], z = o.z0 + t * o.len;
      for (let j = 0; j <= RS; j++) { const ph = j / RS * TAU, cs = Math.cos(ph), sn = Math.sin(ph); const flat = cs > 0 ? (o.belly || 0.9) : 1; this.P.push(-w * sn * (o.squareness ? Math.pow(Math.abs(sn), o.squareness) * Math.sign(sn) / (sn || 1) : 1), yc - h * cs * flat, z); this.U.push(t * 0.88, j / RS); }
    }
    for (let i = 0; i < NS; i++) for (let j = 0; j < RS; j++) { const a = base + i * (RS + 1) + j, b = a + 1, c = a + RS + 1, e = c + 1; this.I.push(a, c, b, b, c, e); }
    this.seams = (this.seams || []).concat([{ base, NS, RS }]);
    return this;
  };
  // a lens-section fin swept back from a root point along a span direction
  Builder.prototype.fin = function (bx, by, bz, sx, sy, sz, span, chord, sweep, thick, tipF, chordAxis) {
    const sl = Math.hypot(sx, sy, sz); sx /= sl; sy /= sl; sz /= sl; const ca = chordAxis || [0, 0, 1];
    let nx = sy * ca[2] - sz * ca[1], ny = sz * ca[0] - sx * ca[2], nz = sx * ca[1] - sy * ca[0]; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const A = 7, B = 7;
    for (const side of [1, -1]) {
      const base = this.P.length / 3;
      for (let r = 0; r <= B; r++) {
        const rr = r / B, ch = chord * (tipF + (1 - tipF) * Math.pow(1 - rr, 0.75)), off = sweep * span * Math.pow(rr, 1.2);
        for (let q = 0; q <= A; q++) {
          const ss = q / A, al = -chord * 0.5 + off + ss * ch, th = side * thick * (1 - rr * 0.9) * Math.sqrt(Math.max(0, 4 * ss * (1 - ss))) * (1 - ss * 0.35);
          this.P.push(bx + sx * rr * span + nx * th + ca[0] * al, by + sy * rr * span + ny * th + ca[1] * al, bz + sz * rr * span + nz * th + ca[2] * al); this.U.push(0.9 + ss * 0.09, 0.1 + rr * 0.8);
        }
      }
      for (let r = 0; r < B; r++) for (let q = 0; q < A; q++) { const a = base + r * (A + 1) + q, b = a + 1, c = a + A + 1, e = c + 1; if (side > 0) this.I.push(a, c, b, b, c, e); else this.I.push(a, b, c, b, e, c); }
    }
    return this;
  };
  Builder.prototype.add = function (geo, uOff) { // merge an extra three.js geometry (eyes, shells), uvs squeezed into the fin swatch
    const g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position, uv = g.attributes.uv, base = this.P.length / 3;
    for (let i = 0; i < p.count; i++) { this.P.push(p.getX(i), p.getY(i), p.getZ(i)); this.U.push(uOff != null ? uOff : 0.9 + (uv ? uv.getX(i) : 0) * 0.09, uv ? 0.1 + uv.getY(i) * 0.8 : 0.5); this.I.push(base + i); }
    return this;
  };
  Builder.prototype.build = function () {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2)); g.setIndex(this.I); g.computeVertexNormals();
    const n = g.attributes.normal; for (const s of this.seams || []) for (let i = 0; i <= s.NS; i++) { const a = s.base + i * (s.RS + 1), b = a + s.RS, x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1; n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l); }
    g.computeBoundingSphere(); g.boundingSphere.radius += 0.5; return g;
  };

  // ---------- skins ----------
  const hs = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
  const vn = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); const a = hs(ix, iy), b = hs(ix + 1, iy), c = hs(ix, iy + 1), e = hs(ix + 1, iy + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + e) * fx * fy; };
  // fn(u along body 0..1, d 0 back .. 1 belly, side -1/1, x, y) -> [r,g,b] linear; fin(u,v) -> [r,g,b]; draw(ctx,W,H) overlays
  function skin(W, H, fn, fin, draw) {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const U = x / W, V = y / H, o = (y * W + x) * 4; let c;
      if (U < 0.885) c = fn(U / 0.88, Math.abs(V - 0.5) * 2, V < 0.5 ? -1 : 1, x, y); else c = fin ? fin((U - 0.9) / 0.09, (V - 0.1) / 0.8, x, y) : [0.3, 0.3, 0.3];
      d[o] = 255 * Math.pow(G.clamp(c[0], 0, 1), 1 / 2.2); d[o + 1] = 255 * Math.pow(G.clamp(c[1], 0, 1), 1 / 2.2); d[o + 2] = 255 * Math.pow(G.clamp(c[2], 0, 1), 1 / 2.2); d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0); if (draw) draw(ctx, W, H);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4; return t;
  }
  const eye = (ctx, W, H, u, v, r, iris) => { for (const vv of [v, 1 - v]) { const x = u * 0.88 * W, y = vv * H; ctx.fillStyle = iris || '#c9b25a'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.5, r * 1.5, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#050505'; ctx.beginPath(); ctx.ellipse(x, y, r, r, 0, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.35, r * 0.3, r * 0.3, 0, 0, 7); ctx.fill(); } };
  const finRays = (base, tip) => (u, v, x) => { const k = 0.85 + 0.15 * Math.sin(x * 0.9); return [G.lerp(base[0], tip[0], v) * k, G.lerp(base[1], tip[1], v) * k, G.lerp(base[2], tip[2], v) * k]; };
  const mixc = (a, b, t) => [G.lerp(a[0], b[0], t), G.lerp(a[1], b[1], t), G.lerp(a[2], b[2], t)];
  const counter = (back, belly, edge, d, u, sharp) => mixc(back, belly, G.sstep(edge - (sharp || 0.12), edge + (sharp || 0.12), d + (vn(u * 9, 1.7) - 0.5) * 0.12));

  // ---------- animated material ----------
  // mode 0: side-to-side tail beat (fish, sharks, eels)  1: up-down fluke beat (dolphins, whales)  2: wing undulation (rays)
  function animMat(map, o) {
    const m = new THREE.MeshStandardMaterial(Object.assign({ map, roughness: 0.45, metalness: 0 }, o.mat || {}));
    const u = { uSw: { value: 0 }, uAmp: { value: 1 } }; m.userData.u = u; const mode = o.mode || 0, k = (o.k || 1.75).toFixed(3), a = (o.amp || 0.3).toFixed(3), z0 = (o.z0 != null ? o.z0 : -1.4).toFixed(3), z1 = (o.z1 != null ? o.z1 : 2.1).toFixed(3);
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uSw = u.uSw; sh.uniforms.uAmp = u.uAmp;
      let body;
      if (mode === 2) body = `float wx = abs(position.x); transformed.y += sin(position.z * ${k} - uSw + wx * 0.8) * ${a} * wx * wx * uAmp;`;
      else body = `float tw = smoothstep(${z0}, ${z1}, position.z); float wv = (sin(position.z * ${k} - uSw) * ${a} * tw * tw - sin(uSw) * ${a} * 0.12 * (1.0 - tw)) * uAmp; ${mode === 1 ? 'transformed.y += wv;' : 'transformed.x += wv;'}`;
      sh.vertexShader = 'uniform float uSw; uniform float uAmp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + body);
    };
    return m;
  }
  function wrap(geo, mat, scale) { const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true; if (scale) mesh.scale.setScalar(scale); const g = new THREE.Group(); g.add(mesh); g.anim = mat.userData.u; return g; }
  const C = {}; const once = (k, f) => C[k] || (C[k] = f());

  // ---------- species ----------
  const M = G.creatureModels = {};

  // reef / pelagic fish, instanced in schools. Atlas rows: 0 yellowtail snapper, 1 blue tang, 2 sergeant major, 3 jack, 4 parrotfish, 5 bluestriped grunt
  G.FISH_SPECIES = 10;
  G.fishGeo = () => once('fishGeo', () => {
    const b = new Builder();
    b.loft([[0, 0.002, 0.004, 0], [0.04, 0.028, 0.05, 0], [0.14, 0.055, 0.105, 0.005], [0.3, 0.068, 0.135, 0.01], [0.5, 0.06, 0.125, 0.01], [0.7, 0.04, 0.085, 0.008], [0.86, 0.018, 0.04, 0.006], [1, 0.012, 0.03, 0.006]], { z0: -0.5, len: 0.86, ns: 22, rs: 12, belly: 0.95 });
    b.fin(0, 0.02, 0.36, 0, 0.75, 0.66, 0.24, 0.13, 0.2, 0.005, 0.5).fin(0, 0.02, 0.36, 0, -0.75, 0.66, 0.24, 0.13, 0.2, 0.005, 0.5);   // forked tail
    b.fin(0, 0.12, -0.12, 0, 1, 0.15, 0.08, 0.36, 0.5, 0.004, 0.35);  // dorsal
    b.fin(0, -0.1, 0.12, 0, -1, 0.3, 0.05, 0.16, 0.5, 0.004, 0.4);    // anal
    for (const s of [1, -1]) b.fin(s * 0.05, -0.04, -0.26, s * 0.7, -0.5, 0.5, 0.08, 0.05, 0.4, 0.003, 0.5);
    return b.build();
  });
  // reef fish body plans (nose -z, tail +z, ~0.8-1 unit long); all share the atlas and the swim-wiggle material
  G.fishGeos = () => once('fishGeos', () => {
    const deep = (idol) => { const b = new Builder();
      b.loft([[0, 0.004, 0.012, -0.01], [0.06, 0.028, 0.11, 0], [0.2, 0.045, 0.28, 0.02], [0.4, 0.05, 0.34, 0.02], [0.6, 0.042, 0.28, 0.01], [0.78, 0.024, 0.13, 0], [0.88, 0.014, 0.05, 0], [1, 0.012, 0.06, 0]], { z0: -0.42, len: 0.78, ns: 22, rs: 12, belly: 0.95 });
      b.fin(0, 0.27, 0.0, 0, 1, 0.75, 0.13, 0.42, 0.5, 0.005, 0.35).fin(0, -0.25, 0.05, 0, -1, 0.7, 0.12, 0.36, 0.5, 0.005, 0.35);
      b.fin(0, 0.02, 0.34, 0, 0.5, 0.86, 0.16, 0.12, 0.25, 0.004, 1.1).fin(0, 0.02, 0.34, 0, -0.5, 0.86, 0.16, 0.12, 0.25, 0.004, 1.1);
      for (const s of [1, -1]) b.fin(s * 0.04, -0.05, -0.18, s * 0.7, -0.4, 0.5, 0.09, 0.05, 0.4, 0.003, 0.5);
      if (idol) b.fin(0, 0.3, -0.12, 0, 1, 1.3, 0.55, 0.06, 0.6, 0.003, 0.25);
      return b.build(); };
    const parrot = () => { const b = new Builder();
      b.loft([[0, 0.02, 0.025, -0.01], [0.04, 0.07, 0.08, 0], [0.18, 0.115, 0.15, 0.01], [0.45, 0.12, 0.155, 0.01], [0.7, 0.085, 0.11, 0], [0.88, 0.035, 0.05, 0], [1, 0.03, 0.055, 0]], { z0: -0.5, len: 0.9, ns: 24, rs: 14, belly: 0.92 });
      b.fin(0, 0.0, 0.4, 0, 0, 1, 0.13, 0.2, 0, 0.006, 1.25, [0, 1, 0]); b.fin(0, 0.15, -0.12, 0, 1, 0.2, 0.06, 0.55, 0.2, 0.005, 0.8); b.fin(0, -0.13, 0.15, 0, -1, 0.3, 0.06, 0.25, 0.3, 0.005, 0.7);
      for (const s of [1, -1]) b.fin(s * 0.1, -0.03, -0.25, s * 0.8, -0.3, 0.5, 0.1, 0.06, 0.4, 0.004, 0.6);
      return b.build(); };
    const damsel = () => { const b = new Builder();
      b.loft([[0, 0.01, 0.02, 0], [0.08, 0.045, 0.11, 0], [0.3, 0.065, 0.19, 0.01], [0.55, 0.058, 0.17, 0.01], [0.8, 0.03, 0.08, 0], [1, 0.02, 0.05, 0]], { z0: -0.42, len: 0.72, ns: 18, rs: 10, belly: 0.95 });
      b.fin(0, 0.17, 0.0, 0, 1, 0.5, 0.08, 0.4, 0.4, 0.004, 0.5).fin(0, -0.15, 0.1, 0, -1, 0.5, 0.07, 0.2, 0.4, 0.004, 0.5);
      b.fin(0, 0.02, 0.28, 0, 0.7, 0.7, 0.16, 0.09, 0.2, 0.004, 0.5).fin(0, 0.02, 0.28, 0, -0.7, 0.7, 0.16, 0.09, 0.2, 0.004, 0.5);
      return b.build(); };
    return { fusi: G.fishGeo(), deep: deep(false), idol: deep(true), parrot: parrot(), damsel: damsel() };
  });
  G.fishAtlas = () => once('fishAtlas', () => {
    const W = 512, R = 128, N = G.FISH_SPECIES, cv = document.createElement('canvas'); cv.width = W; cv.height = R * N; const ctx = cv.getContext('2d');
    const rows = [
      { fn: (u, d) => { let c = counter([0.32, 0.42, 0.55], [0.86, 0.86, 0.82], 0.62, d, u); const st = Math.exp(-Math.pow((d - 0.42) / 0.06, 2)); c = mixc(c, [0.95, 0.75, 0.12], st * G.sstep(0.15, 0.4, u)); return mixc(c, [0.95, 0.78, 0.2], G.sstep(0.82, 0.95, u) * 0.8); }, fin: finRays([0.9, 0.7, 0.2], [0.98, 0.82, 0.28]) },
      { fn: (u, d) => { const sc = vn(u * 30, d * 12) > 0.62 ? 0.55 : 1; let c = mixc([0.06, 0.2, 0.62], [0.12, 0.3, 0.7], d); c = c.map((x) => x * sc); return mixc(c, [0.95, 0.82, 0.12], G.sstep(0.85, 0.93, u)); }, fin: finRays([0.08, 0.15, 0.5], [0.04, 0.07, 0.2]) },
      { fn: (u, d) => { let c = counter([0.62, 0.66, 0.42], [0.86, 0.87, 0.8], 0.6, d, u); const bar = Math.sin((u - 0.18) * 31) > 0.55 && u > 0.18 && u < 0.84 && d < 0.85 ? 1 : 0; return mixc(c, [0.05, 0.06, 0.06], bar * 0.88); }, fin: finRays([0.6, 0.62, 0.5], [0.25, 0.28, 0.25]) },
      { fn: (u, d) => { const c = counter([0.28, 0.36, 0.4], [0.82, 0.84, 0.84], 0.45, d, u, 0.2); const sh = 0.9 + 0.2 * vn(u * 60, d * 20); return c.map((x) => x * sh); }, fin: finRays([0.5, 0.55, 0.55], [0.75, 0.62, 0.2]) },
      { fn: (u, d) => { const scl = 0.82 + 0.18 * Math.abs(Math.sin(u * 70) * Math.sin(d * 26)); let c = mixc([0.12, 0.55, 0.45], [0.3, 0.7, 0.6], d * 0.6); c = mixc(c, [0.85, 0.42, 0.5], (1 - scl) * 3); if (u < 0.12) c = mixc(c, [0.1, 0.45, 0.62], 0.6); return c.map((x) => x * (0.85 + 0.15 * scl)); }, fin: finRays([0.2, 0.5, 0.6], [0.85, 0.45, 0.5]) },
      { fn: (u, d) => { let c = mixc([0.9, 0.72, 0.18], [0.92, 0.82, 0.45], d); const s = Math.abs(Math.sin((d + u * 0.25) * 22)); return mixc(c, [0.1, 0.42, 0.75], G.sstep(0.82, 0.95, s) * (d < 0.8 ? 1 : 0)); }, fin: finRays([0.85, 0.75, 0.3], [0.9, 0.82, 0.45]) },      // 6 butterflyfish: pale front, bright yellow rear, black bar through the eye, dark spot under the soft dorsal
      { fn: (u, d) => { let c = mixc([0.95, 0.93, 0.8], [0.98, 0.8, 0.12], G.sstep(0.3, 0.6, u)); c = mixc(c, [0.03, 0.03, 0.03], G.sstep(0.09, 0.11, u) * G.sstep(0.18, 0.16, u)); const sp = Math.hypot((u - 0.68) * 3, d - 0.18); return mixc(c, [0.04, 0.04, 0.05], G.sstep(0.16, 0.12, sp)); }, fin: finRays([0.95, 0.8, 0.15], [0.98, 0.9, 0.4]) },
      // 7 blue-green chromis (damselfish)
      { fn: (u, d) => { const c = counter([0.12, 0.45, 0.62], [0.55, 0.8, 0.85], 0.6, d, u); return mixc(c, [0.25, 0.75, 0.85], 0.25 * Math.sin(u * 40) * Math.sin(d * 12)); }, fin: finRays([0.2, 0.55, 0.7], [0.5, 0.8, 0.9]) },
      // 8 moorish idol: white and yellow with two broad black bands
      { fn: (u, d) => { let c = mixc([0.95, 0.93, 0.85], [0.98, 0.85, 0.2], G.sstep(0.4, 0.5, u) * G.sstep(0.62, 0.55, u)); const b1 = G.sstep(0.16, 0.19, u) * G.sstep(0.36, 0.33, u), b2 = G.sstep(0.6, 0.63, u) * G.sstep(0.76, 0.73, u); return mixc(c, [0.04, 0.04, 0.04], Math.max(b1, b2)); }, fin: finRays([0.08, 0.08, 0.08], [0.95, 0.95, 0.9]) },
      // 9 yellow tang
      { fn: (u, d) => { const c = mixc([0.98, 0.82, 0.08], [0.98, 0.88, 0.3], d * 0.5); return c.map((x) => x * (0.92 + 0.08 * vn(u * 50, d * 20))); }, fin: finRays([0.95, 0.8, 0.1], [0.98, 0.88, 0.3]) },
    ];
    rows.forEach((r, i) => { const t = skin(W, R, r.fn, r.fin, (c2, w, h) => eye(c2, w, h, 0.075, 0.33, 4.2, i === 1 ? '#7c6a3a' : '#d9c26b')); ctx.drawImage(t.image, 0, i * R); });
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4; return t;
  });
  G.fishMaterial = () => once('fishMat', () => {
    const m = new THREE.MeshStandardMaterial({ map: G.fishAtlas(), roughness: 0.32, metalness: 0.15, side: THREE.DoubleSide }); const u = { uTime: G.uni.uTime }; m.userData.u = u;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = u.uTime;
      sh.vertexShader = 'uniform float uTime; attribute float aSp; attribute float aPh;\n' + sh.vertexShader
        .replace('#include <uv_vertex>', `#include <uv_vertex>\n #ifdef USE_MAP\n vMapUv.y = (vMapUv.y + aSp) / ${G.FISH_SPECIES}.0;\n #endif`)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n float tw = smoothstep(-0.45, 0.5, position.z); transformed.x += sin(position.z * 7.5 - uTime * (9.0 + aPh * 0.4) - aPh * 6.2831) * 0.07 * tw * tw;');
    };
    return m;
  });

  M.shark = null; // built in wildlife.js (its own skin and loft)

  M.dolphin = () => {
    const geo = once('dolphinGeo', () => {
      const b = new Builder();
      b.loft([[0, 0.012, 0.012, -0.02], [0.03, 0.03, 0.028, -0.03], [0.09, 0.05, 0.045, -0.03], [0.13, 0.12, 0.13, 0.02], [0.2, 0.2, 0.22, 0.03], [0.36, 0.25, 0.27, 0.02], [0.55, 0.21, 0.23, 0.01], [0.75, 0.12, 0.14, 0.0], [0.9, 0.055, 0.075, 0.0], [1, 0.03, 0.045, 0.0]], { z0: -1.15, len: 2.15, ns: 36, rs: 20, belly: 0.95 });
      b.fin(0, 0.24, -0.05, 0, 1, 0.3, 0.32, 0.4, 0.75, 0.025, 0.12);                  // falcate dorsal
      for (const s of [1, -1]) b.fin(s * 0.18, -0.12, -0.5, s * 0.9, -0.35, 0.3, 0.32, 0.2, 0.55, 0.02, 0.2);
      for (const s of [1, -1]) b.fin(s * 0.02, 0.0, 0.98, s, 0.0, 0.45, 0.36, 0.24, 0.55, 0.018, 0.25, [0, 0, 1]); // flukes, horizontal
      return b.build();
    });
    const tex = once('dolphinSkin', () => skin(512, 256, (u, d) => { let c = counter([0.24, 0.28, 0.32], [0.8, 0.82, 0.84], 0.55, d, u, 0.08); const cape = G.sstep(0.25, 0.1, d) * G.sstep(0.15, 0.3, u) * G.sstep(0.8, 0.6, u); c = mixc(c, [0.17, 0.2, 0.24], cape * 0.6); return c; }, finRays([0.26, 0.3, 0.34], [0.2, 0.23, 0.26]), (c, W, H) => eye(c, W, H, 0.115, 0.36, 3.5, '#2a2016')));
    return wrap(geo, animMat(tex, { mode: 1, k: 2.4, amp: 0.14, z0: -0.4, z1: 1.1, mat: { roughness: 0.42 } }));
  };

  M.giant = () => {   // humpback-like baleen whale, ~13 m
    const geo = once('whaleGeo', () => {
      const b = new Builder();
      b.loft([[0, 0.25, 0.18, -0.15], [0.05, 0.9, 0.7, -0.2], [0.15, 1.5, 1.25, -0.1], [0.3, 1.75, 1.6, 0], [0.5, 1.5, 1.45, 0.05], [0.7, 0.9, 0.95, 0.05], [0.88, 0.35, 0.42, 0.05], [1, 0.18, 0.22, 0.05]], { z0: -6.5, len: 12.5, ns: 40, rs: 24, belly: 1.0 });
      for (const s of [1, -1]) b.fin(s * 1.3, -0.7, -3.4, s * 0.95, -0.3, 0.2, 4.2, 1.0, 0.25, 0.12, 0.3);
      for (const s of [1, -1]) b.fin(s * 0.1, 0.0, 5.9, s, 0, 0.3, 2.2, 1.3, 0.5, 0.1, 0.25, [0, 0, 1]);
      b.fin(0, 1.0, 2.8, 0, 1, 0.5, 0.35, 0.9, 0.6, 0.06, 0.3);
      return b.build();
    });
    const tex = once('whaleSkin', () => skin(512, 256, (u, d, s, x, y) => { let c = counter([0.05, 0.06, 0.075], [0.55, 0.56, 0.56], 0.72, d, u, 0.18); if (d > 0.72 && u < 0.45 && Math.sin(d * 140) > 0.6) c = mixc(c, [0.2, 0.2, 0.21], 0.6); if (vn(x * 0.4, y * 0.4) > 0.78 && u < 0.3) c = mixc(c, [0.62, 0.6, 0.55], 0.7); return c; }, finRays([0.6, 0.6, 0.6], [0.12, 0.13, 0.15])));
    return wrap(geo, animMat(tex, { mode: 1, k: 0.35, amp: 0.7, z0: -2, z1: 6.5, mat: { roughness: 0.5 } }));
  };

  M.barracuda = () => {
    const geo = once('cudaGeo', () => {
      const b = new Builder();
      b.loft([[0, 0.006, 0.006, -0.01], [0.05, 0.03, 0.03, -0.005], [0.12, 0.055, 0.065, 0], [0.35, 0.07, 0.085, 0], [0.6, 0.06, 0.075, 0], [0.82, 0.035, 0.045, 0], [1, 0.02, 0.03, 0]], { z0: -0.8, len: 1.45, ns: 30, rs: 14 });
      b.fin(0, 0.02, 0.66, 0, 0.75, 0.66, 0.26, 0.12, 0.25, 0.006, 0.4).fin(0, 0.02, 0.66, 0, -0.75, 0.66, 0.26, 0.12, 0.25, 0.006, 0.4);
      b.fin(0, 0.07, -0.15, 0, 1, 0.3, 0.1, 0.12, 0.5, 0.004, 0.4).fin(0, 0.06, 0.35, 0, 1, 0.3, 0.07, 0.1, 0.4, 0.004, 0.4);
      for (const s of [1, -1]) b.fin(s * 0.05, -0.04, -0.4, s * 0.7, -0.5, 0.5, 0.1, 0.05, 0.4, 0.003, 0.5);
      return b.build();
    });
    const tex = once('cudaSkin', () => skin(512, 128, (u, d) => { let c = counter([0.3, 0.36, 0.4], [0.85, 0.86, 0.86], 0.5, d, u, 0.25); const ch = Math.sin((u + d * 0.12) * 46) > 0.7 && d < 0.55 && u > 0.2 && u < 0.85 ? 1 : 0; c = mixc(c, [0.12, 0.14, 0.16], ch * 0.7); if (vn(u * 25, d * 6) > 0.85 && d < 0.7) c = mixc(c, [0.05, 0.05, 0.06], 0.8); return c; }, finRays([0.45, 0.48, 0.48], [0.15, 0.16, 0.17]), (c, W, H) => eye(c, W, H, 0.09, 0.36, 3.2, '#d8d070')));
    return wrap(geo, animMat(tex, { mode: 0, k: 3.5, amp: 0.08, z0: -0.4, z1: 0.75, mat: { roughness: 0.25, metalness: 0.25 } }));
  };

  M.grouper = () => {   // goliath grouper: massive head and gape, small eyes, rounded fins and a rounded (not forked) tail
    const geo = once('grouperGeo3', () => {
      const b = new Builder();
      b.loft([[0, 0.03, 0.03, -0.035], [0.04, 0.13, 0.12, -0.03], [0.13, 0.2, 0.25, -0.01], [0.32, 0.21, 0.31, 0.01], [0.56, 0.17, 0.28, 0.02], [0.78, 0.1, 0.19, 0.02], [0.91, 0.05, 0.12, 0.02], [1, 0.035, 0.1, 0.02]], { z0: -0.78, len: 1.38, ns: 30, rs: 20, belly: 0.86 });
      b.fin(0, 0.02, 0.57, 0, 0, 1, 0.27, 0.26, 0, 0.012, 1.15, [0, 1, 0]);                                   // rounded tail fan
      b.fin(0, 0.29, -0.3, 0, 1, 0.1, 0.1, 0.5, 0.3, 0.012, 0.55);                                        // low spiny dorsal
      b.fin(0, 0.25, 0.18, 0, 1, 0.45, 0.2, 0.34, 0.3, 0.012, 0.35);                                       // soft dorsal, rounded
      b.fin(0, -0.2, 0.28, 0, -1, 0.4, 0.16, 0.26, 0.3, 0.012, 0.35);                                      // anal, rounded
      for (const s of [1, -1]) { b.fin(s * 0.24, -0.04, -0.3, s * 0.85, -0.25, 0.45, 0.24, 0.2, 0.3, 0.01, 0.4); b.fin(s * 0.1, -0.24, -0.28, s * 0.3, -1, 0.5, 0.15, 0.13, 0.35, 0.008, 0.35); }
      return b.build();
    });
    const tex = once('grouperSkin2', () => skin(512, 256, (u, d, s, x, y) => {
      const blot = vn(x * 0.05, y * 0.08), bar = Math.sin(u * 22 + vn(x * 0.1, y * 0.1) * 3), sp = vn(x * 0.5, y * 0.5);
      let c = mixc([0.1, 0.09, 0.06], [0.22, 0.19, 0.12], G.sstep(0.3, 0.7, blot));
      c = mixc(c, [0.09, 0.08, 0.055], G.sstep(0.55, 0.9, bar) * 0.55 * (1 - d * 0.5));        // faint irregular bars
      if (u < 0.3 && sp > 0.8) c = mixc(c, [0.03, 0.03, 0.025], 0.8);                             // small black spots on the head
      return mixc(c, [0.42, 0.38, 0.28], G.sstep(0.7, 0.98, d) * 0.5);
    }, finRays([0.18, 0.15, 0.1], [0.1, 0.085, 0.06]), (c, W, H) => {
      eye(c, W, H, 0.085, 0.36, 3.2, '#6a5a2c');
      c.strokeStyle = 'rgba(10,8,5,0.85)'; c.lineWidth = 3; for (const v of [0.5]) { c.beginPath(); c.moveTo(0, v * H); c.quadraticCurveTo(0.05 * 0.88 * W, (v - 0.14) * H, 0.075 * 0.88 * W, (v - 0.2) * H); c.stroke(); c.beginPath(); c.moveTo(0, v * H); c.quadraticCurveTo(0.05 * 0.88 * W, (v + 0.14) * H, 0.075 * 0.88 * W, (v + 0.2) * H); c.stroke(); }
    }));
    return wrap(geo, animMat(tex, { mode: 0, k: 2.4, amp: 0.08, z0: -0.2, z1: 0.75, mat: { roughness: 0.62 } }));
  };

  M.eel = () => {   // green moray
    const geo = once('morayGeo', () => {
      const b = new Builder();
      b.loft([[0, 0.02, 0.025, -0.01], [0.04, 0.07, 0.085, 0], [0.1, 0.085, 0.11, 0.01], [0.3, 0.08, 0.1, 0], [0.7, 0.07, 0.09, 0], [0.92, 0.04, 0.06, 0], [1, 0.01, 0.03, 0]], { z0: -0.2, len: 1.9, ns: 44, rs: 14 });
      b.fin(0, 0.075, 0.78, 0, 1, 0, 0.06, 1.85, 0, 0.006, 0.95);   // one continuous dorsal fin merging into the tail
      return b.build();
    });
    const tex = once('moraySkin', () => skin(512, 128, (u, d, s, x, y) => { const m = vn(x * 0.12, y * 0.18); let c = mixc([0.12, 0.2, 0.08], [0.28, 0.38, 0.14], m); c = mixc(c, [0.05, 0.08, 0.03], vn(x * 0.5, y * 0.6) > 0.7 ? 0.5 : 0); return mixc(c, [0.32, 0.4, 0.2], G.sstep(0.6, 1, d) * 0.4); }, finRays([0.15, 0.24, 0.1], [0.1, 0.16, 0.06]), (c, W, H) => eye(c, W, H, 0.035, 0.38, 2.6, '#c8b860')));
    return wrap(geo, animMat(tex, { mode: 0, k: 4.2, amp: 0.22, z0: -0.1, z1: 1.4, mat: { roughness: 0.25 } }));
  };

  M.ray = () => {   // spotted eagle ray
    const geo = once('rayGeo', () => {
      const b = new Builder();
      // flat body: wide, thin sections; head lobe in front
      b.loft([[0, 0.05, 0.03, 0], [0.1, 0.12, 0.06, 0], [0.22, 0.75, 0.09, 0.01], [0.38, 1.05, 0.1, 0.01], [0.55, 0.7, 0.09, 0.01], [0.72, 0.22, 0.07, 0.01], [0.86, 0.06, 0.04, 0], [1, 0.02, 0.02, 0]], { z0: -0.75, len: 1.5, ns: 32, rs: 22, belly: 0.6 });
      const tail = new THREE.CylinderGeometry(0.003, 0.016, 2.0, 5); tail.rotateX(Math.PI / 2); tail.translate(0, 0.005, 1.7); b.add(tail, 0.95);
      return b.build();
    });
    const tex = once('raySkin', () => skin(512, 256, (u, d, s, x, y) => { if (d > 0.62) return [0.88, 0.88, 0.86]; let c = [0.06, 0.07, 0.11]; const sp = hs(Math.floor(x / 11), Math.floor(y / 11)), cx = (x % 11) - 5.5, cy = (y % 11) - 5.5; if (sp > 0.45 && cx * cx + cy * cy < 7) c = [0.86, 0.86, 0.84]; return c; }, finRays([0.08, 0.08, 0.1], [0.08, 0.08, 0.1])));
    return wrap(geo, animMat(tex, { mode: 2, k: 2.2, amp: 0.22, mat: { roughness: 0.4 } }));
  };

  M.turtle = () => {   // green sea turtle: domed carapace, head, flippers as separate meshes so they can row
    const g = new THREE.Group();
    const shellTex = once('turtleShell3', () => {
      const W = 512, cv = document.createElement('canvas'); cv.width = cv.height = W; const ctx = cv.getContext('2d'), R = G.rng(17);
      ctx.fillStyle = '#3b2e1a'; ctx.fillRect(0, 0, W, W);
      // scutes: each a polygon filled with tortoiseshell rays fanning from its rear edge, separated by thin dark seams
      const plate = (x, y, rx, ry, n, rot) => {
        const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU + rot; pts.push([x + Math.cos(a) * rx * (0.92 + R() * 0.12), y + Math.sin(a) * ry * (0.92 + R() * 0.12)]); }
        ctx.save(); ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.clip();
        const base = ctx.createLinearGradient(x, y - ry, x, y + ry); base.addColorStop(0, '#5a4424'); base.addColorStop(1, '#3a2b16'); ctx.fillStyle = base; ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2);
        const ox = x + (R() - 0.5) * rx * 0.3, oy = y + ry * 0.75;
        ctx.filter = 'blur(2.5px)'; for (let k = 0; k < 44; k++) { const a = -Math.PI * (0.08 + R() * 0.84), w = 0.015 + R() * 0.05, L = Math.max(rx, ry) * 2.2, lt = R(); ctx.fillStyle = lt < 0.45 ? `rgba(196,150,70,${0.2 + R() * 0.3})` : lt < 0.75 ? `rgba(120,86,40,${0.25 + R() * 0.3})` : `rgba(28,20,10,${0.25 + R() * 0.3})`; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(a - w) * L, oy + Math.sin(a - w) * L); ctx.lineTo(ox + Math.cos(a + w) * L, oy + Math.sin(a + w) * L); ctx.fill(); } ctx.filter = 'none';
        // growth rings
        ctx.strokeStyle = 'rgba(30,20,10,0.18)'; ctx.lineWidth = 1.2; for (let k = 1; k < 4; k++) { ctx.beginPath(); pts.forEach((p, i) => { const q = [ox + (p[0] - ox) * k / 4, oy + (p[1] - oy) * k / 4]; i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.stroke(); }
        ctx.restore(); ctx.strokeStyle = 'rgba(18,12,6,0.9)'; ctx.lineWidth = 2.2; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.stroke();
      };
      for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; plate(W / 2 + Math.cos(a) * 232, W / 2 + Math.sin(a) * 236, 34, 30, 5, a); }   // marginal ring
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) plate(W / 2 + s * 118, 108 + i * 98, 72, 56, 6, 0.3);                         // costals
      for (let i = 0; i < 5; i++) plate(W / 2, 62 + i * 96, 54, 52, 6, 0);                                                               // vertebrals
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
    });
    const skinTex = once('turtleSkin2', () => skin(256, 256, (u, d, s, x, y) => { const sc = vn(x * 0.3, y * 0.3), edge = Math.abs(Math.sin(x * 0.55) * Math.sin(y * 0.55)); return mixc(mixc([0.1, 0.1, 0.06], [0.24, 0.22, 0.13], G.sstep(0.35, 0.7, sc)), [0.5, 0.46, 0.32], (edge < 0.12 ? 0.55 : 0) + G.sstep(0.65, 0.95, d) * 0.5); }, (u, v, x, y) => { const sc = vn(x * 0.35, y * 0.35), edge = Math.abs(Math.sin(x * 0.7) * Math.sin(y * 0.7)); return mixc(mixc([0.1, 0.1, 0.06], [0.22, 0.2, 0.12], G.sstep(0.35, 0.7, sc)), [0.5, 0.46, 0.32], edge < 0.14 ? 0.6 : 0); }));
    const shell = new THREE.SphereGeometry(0.5, 32, 16, 0, TAU, 0, Math.PI / 2); shell.scale(0.82, 0.38, 1.05); { const uv = shell.attributes.uv, p = shell.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 0.84 + 0.5, p.getZ(i) / 1.07 + 0.5); }
    const sm = new THREE.Mesh(shell, new THREE.MeshStandardMaterial({ map: shellTex, roughness: 0.55 })); sm.castShadow = true; g.add(sm);
    const plast = new THREE.CircleGeometry(0.5, 32); plast.rotateX(Math.PI / 2); plast.scale(0.8, 1, 1.02); g.add(new THREE.Mesh(plast, new THREE.MeshStandardMaterial({ color: 0xc9b88a, roughness: 0.7 })));
    const fm = new THREE.MeshStandardMaterial({ map: skinTex, color: 0x6e6e66, roughness: 0.62, side: THREE.DoubleSide }); const hb = new Builder();
    hb.loft([[0, 0.02, 0.02, 0], [0.15, 0.07, 0.06, 0.01], [0.45, 0.09, 0.08, 0.02], [0.8, 0.075, 0.07, 0.01], [1, 0.07, 0.065, 0.0]], { z0: -0.78, len: 0.32, ns: 12, rs: 12 });
    const head = new THREE.Mesh(hb.build(), fm); head.castShadow = true; g.add(head);
    g.flip = [];
    for (const [s, front] of [[1, 1], [-1, 1], [1, 0], [-1, 0]]) {
      const fb = new Builder(); front ? fb.fin(0, 0, 0, s, -0.05, 0.25, 0.62, 0.2, 0.35, 0.025, 0.25) : fb.fin(0, 0, 0, s, -0.1, 0.6, 0.26, 0.17, 0.2, 0.02, 0.4);
      const pv = new THREE.Group(); pv.position.set(s * 0.32, -0.02, front ? -0.32 : 0.36); const fl = new THREE.Mesh(fb.build(), fm); fl.castShadow = true; pv.add(fl); g.add(pv); g.flip.push({ pv, s, front });
    }
    return g;
  };

  M.jelly = () => {   // translucent moon-jelly bell with frilled rim, four gonad rings, trailing tentacles and oral arms
    const g = new THREE.Group(), u = { uSw: { value: Math.random() * 6 }, uAmp: { value: 1 } };
    const pts = []; for (let i = 0; i <= 18; i++) { const t = i / 18, a = t * Math.PI * 0.5; pts.push(new THREE.Vector2(Math.sin(a) * 0.3 * (1 + 0.04 * Math.sin(t * 40)), Math.cos(a) * 0.17 - 0.02 * t * t)); }
    const bell = new THREE.LatheGeometry(pts, 36);
    const bm = new THREE.MeshPhysicalMaterial({ color: 0xb6cdf2, roughness: 0.1, metalness: 0, transmission: 0, transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: true, emissive: 0x2a3550, emissiveIntensity: 0.3, clearcoat: 1 });
    // thin-film look: the rim of the bell (seen edge-on) is denser than its face
    { const ob = bm.onBeforeCompile; bm.onBeforeCompile = (sh) => { ob(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', 'float rim = 1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))); diffuseColor.a = clamp(diffuseColor.a + rim * rim * 0.5, 0.0, 0.85);' + String.fromCharCode(10) + '#include <opaque_fragment>'); }; }   // writes depth so the underwater fog places it at its real distance
    bm.onBeforeCompile = (sh) => { sh.uniforms.uSw = u.uSw; sh.vertexShader = 'uniform float uSw;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n float pl = sin(uSw); transformed.xz *= 1.0 + 0.12 * pl * smoothstep(0.17, -0.02, position.y); transformed.y *= 1.0 - 0.1 * pl;'); };
    const bmesh = new THREE.Mesh(bell, bm); bmesh.layers.set(1); bmesh.renderOrder = 6; g.add(bmesh);
    const gon = new THREE.MeshBasicMaterial({ color: 0xd8a8e8, transparent: true, opacity: 0.7, depthWrite: true });
    for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.016, 6, 16), gon); const a = i / 4 * TAU; r.position.set(Math.cos(a) * 0.09, 0.08, Math.sin(a) * 0.09); r.rotation.x = Math.PI / 2; r.layers.set(1); r.renderOrder = 7; g.add(r); }
    // tentacles: thin strips that hang and sway
    const tb = []; for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, L = 0.7 + Math.random() * 0.6, gg = new THREE.PlaneGeometry(0.008, L, 1, 10); gg.translate(Math.cos(a) * 0.29, -L / 2, Math.sin(a) * 0.29); gg.rotateY(-a); tb.push(gg); }
    const tm = new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: true });
    tm.onBeforeCompile = (sh) => { sh.uniforms.uSw = u.uSw; sh.vertexShader = 'uniform float uSw;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n float dn = max(-position.y, 0.0); transformed.x += sin(uSw * 0.7 + dn * 4.0 + position.z * 9.0) * 0.06 * dn; transformed.z += cos(uSw * 0.6 + dn * 3.0 + position.x * 9.0) * 0.06 * dn;'); };
    const tmesh = new THREE.Mesh(THREE.BufferGeometryUtils.mergeGeometries(tb), tm); tmesh.layers.set(1); tmesh.renderOrder = 6; g.add(tmesh);
    // four frilled oral arms: ruffled ribbons that curl as they hang
    const ab = []; for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4, L = 0.42, gg = new THREE.PlaneGeometry(0.07, L, 6, 16); const p = gg.attributes.position; for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k), t = (L / 2 - y) / L; p.setZ(k, Math.sin(x * 120 + y * 30) * 0.012 + Math.sin(t * 7) * 0.03); p.setX(k, x * (1 + 0.6 * Math.sin(y * 40))); } gg.translate(0, -L / 2 - 0.02, 0); gg.rotateY(-a); gg.translate(Math.cos(a) * 0.035, 0, Math.sin(a) * 0.035); ab.push(gg); }
    const am = new THREE.MeshStandardMaterial({ color: 0xe8b8d8, roughness: 0.4, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: true, emissive: 0x402030, emissiveIntensity: 0.3 });
    am.onBeforeCompile = tm.onBeforeCompile; const amesh = new THREE.Mesh(THREE.BufferGeometryUtils.mergeGeometries(ab), am); amesh.layers.set(1); amesh.renderOrder = 6; g.add(amesh);
    g.anim = u; return g;
  };

  // shore crab: carapace, eye stalks, claws and eight jointed legs as separate parts so the gait is real
  M.crab = () => {
    const g = new THREE.Group();
    const tex = once('crabShell', () => skin(256, 256, (u, d, s, x, y) => { const sp = vn(x * 0.2, y * 0.2), sp2 = vn(x * 0.7, y * 0.7); let c = mixc([0.55, 0.16, 0.08], [0.78, 0.32, 0.14], G.sstep(0.3, 0.7, sp)); c = mixc(c, [0.25, 0.07, 0.04], sp2 > 0.78 ? 0.6 : 0); return mixc(c, [0.92, 0.82, 0.62], G.sstep(0.62, 0.8, d)); }, (u, v, x, y) => { const sp = vn(x * 0.4, y * 0.4); return mixc([0.62, 0.2, 0.1], [0.85, 0.42, 0.2], sp); }));
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.38 });
    const cb = new Builder(); cb.loft([[0, 0.02, 0.01, 0], [0.12, 0.085, 0.03, 0.01], [0.4, 0.12, 0.045, 0.015], [0.7, 0.11, 0.04, 0.012], [0.92, 0.06, 0.025, 0.008], [1, 0.01, 0.01, 0.005]], { z0: -0.09, len: 0.18, ns: 14, rs: 16, belly: 0.4 });
    // the shell is wider than long: rotate the loft so its long axis runs left-right
    const cg = cb.build(); cg.rotateY(Math.PI / 2); const body = new THREE.Mesh(cg, mat); body.position.y = 0.07; body.castShadow = true; g.add(body);
    const leg = (L1, L2, r) => { const b = new Builder(); b.loft([[0, r, r, 0], [1, r * 0.8, r * 0.8, 0]], { z0: 0, len: L1, ns: 3, rs: 6 }); const g1 = b.build(); g1.rotateY(Math.PI / 2); const b2 = new Builder(); b2.loft([[0, r * 0.8, r * 0.8, 0], [0.8, r * 0.5, r * 0.5, 0], [1, 0.002, 0.002, 0]], { z0: 0, len: L2, ns: 4, rs: 6 }); const g2 = b2.build(); g2.rotateY(Math.PI / 2); return [g1, g2]; };
    g.legs = [];
    for (const s of [1, -1]) for (let i = 0; i < 4; i++) {
      const [g1, g2] = leg(0.07, 0.085, 0.009), hip = new THREE.Group(); hip.position.set(s * 0.085, 0.07, -0.045 + i * 0.032); hip.rotation.y = s > 0 ? -(i - 1.5) * 0.28 : Math.PI + (i - 1.5) * 0.28;
      const seg1 = new THREE.Mesh(g1, mat); seg1.castShadow = true; hip.add(seg1); seg1.rotation.z = 0.5; const knee = new THREE.Group(); knee.position.set(0.07 * Math.cos(0.5), 0.07 * Math.sin(0.5), 0); hip.add(knee);
      const seg2 = new THREE.Mesh(g2, mat); seg2.rotation.z = -1.25; seg2.castShadow = true; knee.add(seg2); g.add(hip); g.legs.push({ hip, s, i });
    }
    g.claws = [];
    for (const s of [1, -1]) {
      const arm = new THREE.Group(); arm.position.set(s * 0.06, 0.075, -0.08); arm.rotation.y = s * 0.5 + Math.PI / 2 * 0; g.add(arm);
      const b = new Builder(); b.loft([[0, 0.012, 0.012, 0], [1, 0.016, 0.014, 0]], { z0: 0, len: 0.07, ns: 3, rs: 8 }); const a1 = new THREE.Mesh(b.build(), mat); a1.rotation.y = Math.PI; arm.add(a1);
      const pb = new Builder(); pb.loft([[0, 0.018, 0.015, 0], [0.4, 0.03, 0.022, 0], [0.8, 0.02, 0.016, 0], [1, 0.004, 0.004, 0]], { z0: 0, len: 0.075, ns: 6, rs: 10 }); const palm = new THREE.Mesh(pb.build(), mat); palm.position.z = -0.07; palm.rotation.y = Math.PI - s * 0.6; palm.castShadow = true; arm.add(palm); g.claws.push(arm);
    }
    for (const s of [1, -1]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.03, 5), mat); st.position.set(s * 0.02, 0.1, -0.075); g.add(st); const e = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.15 })); e.position.set(s * 0.02, 0.117, -0.075); g.add(e); }
    g.scale.setScalar(1.3); return g;
  };
  // gait: legs alternate in two tetrapods; claws sway; dead crabs lie on their backs with legs curled
  G.crabPose = (g, phase, moving, dead) => {
    for (const L of g.legs) { const p = phase + (L.i % 2 ? Math.PI : 0) + (L.s > 0 ? 0 : Math.PI); L.hip.rotation.z = dead ? 0.9 * L.s : (moving ? Math.max(0, Math.sin(p)) * 0.35 * L.s : 0); L.hip.rotation.x = moving && !dead ? Math.cos(p) * 0.3 : 0; }
    for (let i = 0; i < g.claws.length; i++) g.claws[i].rotation.x = dead ? -0.6 : Math.sin(phase * 0.5 + i) * 0.12 - (moving ? 0.2 : 0);
  };
})();
