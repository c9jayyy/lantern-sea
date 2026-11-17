'use strict';
/* Procedural PBR textures + shared material library. Everything is generated at boot: no image files needed. */
(function () {
  const G = window.G;
  G.uni = { uTime: { value: 0 }, uWind: { value: 1 }, uSea: { value: 0.6 }, uWet: { value: 0 }, uSunC: { value: new THREE.Color(0, 0, 0) } };

  // tileable value noise
  function tn(x, y, p, s) {
    const xi = Math.floor(x), yi = Math.floor(y); let fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const w = (v) => ((v % p) + p) % p;
    const a = G.hash2(w(xi), w(yi), s), b = G.hash2(w(xi + 1), w(yi), s), c = G.hash2(w(xi), w(yi + 1), s), d = G.hash2(w(xi + 1), w(yi + 1), s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function tfbm(u, v, p, s, oct) {
    let val = 0, amp = 0.5, tot = 0;
    for (let i = 0; i < oct; i++) { val += amp * tn(u * p, v * p, p, s + i * 37); tot += amp; p *= 2; amp *= 0.5; }
    return val / tot;
  }
  G.tfbm = tfbm;

  function finish(canvas, srgb, repeat) {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = repeat === false ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true; return t;
  }
  // heightFn(u,v)->0..1 ; colorFn(h,u,v)->[r,g,b] 0..255
  function makeTex(size, heightFn, colorFn, nStrength) {
    const H = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) H[y * size + x] = heightFn(x / size, y / size);
    const c1 = document.createElement('canvas'); c1.width = c1.height = size; const g1 = c1.getContext('2d'); const d1 = g1.createImageData(size, size);
    const c2 = document.createElement('canvas'); c2.width = c2.height = size; const g2 = c2.getContext('2d'); const d2 = g2.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = y * size + x, h = H[i];
      const col = colorFn(h, x / size, y / size);
      d1.data[i * 4] = col[0]; d1.data[i * 4 + 1] = col[1]; d1.data[i * 4 + 2] = col[2]; d1.data[i * 4 + 3] = 255;
      const hx = H[y * size + (x + 1) % size] - H[y * size + (x + size - 1) % size];
      const hy = H[((y + 1) % size) * size + x] - H[((y + size - 1) % size) * size + x];
      let nx = -hx * nStrength, ny = -hy * nStrength, nz = 1; const l = Math.hypot(nx, ny, nz);
      d2.data[i * 4] = (nx / l * 0.5 + 0.5) * 255; d2.data[i * 4 + 1] = (ny / l * 0.5 + 0.5) * 255; d2.data[i * 4 + 2] = (nz / l * 0.5 + 0.5) * 255; d2.data[i * 4 + 3] = 255;
    }
    g1.putImageData(d1, 0, 0); g2.putImageData(d2, 0, 0);
    return { map: finish(c1, true), normalMap: finish(c2, false) };
  }
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const sc = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

  G.buildTextures = function () {
    const T = G.tex = {};
    // terrain detail: neutral grey grain (multiplied with vertex colours)
    T.detail = makeTex(256, (u, v) => tfbm(u, v, 6, 11, 5) * 0.6 + tfbm(u, v, 48, 12, 2) * 0.4,
      (h) => { const g = 150 + h * 110; return [g, g, g]; }, 5);
    T.rock = makeTex(256, (u, v) => { const a = tfbm(u, v, 4, 21, 5); const r = 1 - Math.abs(tfbm(u, v, 6, 22, 4) * 2 - 1); return a * 0.55 + r * r * 0.45; },
      (h, u, v) => { const t = tfbm(u, v, 3, 23, 3); return sc(mix3([112, 106, 98], [150, 143, 130], t), 0.55 + h * 0.65); }, 9);
    T.wood = makeTex(256, (u, v) => {
      const plank = Math.floor(v * 4); const pv = (v * 4) % 1; const seam = pv < 0.035 || pv > 0.965 ? 0 : 1;
      const off = G.hash2(plank, 0, 5) * 7; const end = ((u + off * 0.37) % 1) < 0.012 ? 0 : 1;
      const grain = tfbm(u * 0.35 + off, v * 3 + plank * 0.13, 16, 31 + plank, 4);
      const fine = tn(u * 40 + off * 9, v * 256, 256, 33);
      return seam * end * (0.45 + grain * 0.4 + fine * 0.15);
    }, (h, u, v) => {
      const plank = Math.floor(v * 4); const tone = 0.82 + G.hash2(plank, 7, 5) * 0.3;
      const base = mix3([92, 62, 36], [176, 132, 84], h); return sc(base, tone * (h < 0.05 ? 0.35 : 1));
    }, 7);
    T.woodDark = makeTex(256, (u, v) => {
      const plank = Math.floor(v * 3); const pv = (v * 3) % 1; const seam = pv < 0.04 || pv > 0.96 ? 0 : 1;
      const grain = tfbm(u * 0.4 + plank * 3.1, v * 3, 16, 41 + plank, 4); return seam * (0.4 + grain * 0.6);
    }, (h, u, v) => sc(mix3([48, 34, 24], [112, 84, 58], h), 0.85 + G.hash2(Math.floor(v * 3), 3, 9) * 0.3), 7);
    T.bark = makeTex(256, (u, v) => { const r = 1 - Math.abs(tfbm(u * 2, v * 0.4, 8, 51, 4) * 2 - 1); return r * 0.7 + tfbm(u, v, 24, 52, 3) * 0.3; },
      (h) => mix3([54, 40, 30], [138, 112, 86], h * h), 10);
    T.palmBark = makeTex(256, (u, v) => { const ring = Math.abs(((v * 14 + tn(u * 8, v * 8, 8, 61) * 0.5) % 1) - 0.5) * 2; return ring * 0.6 + tfbm(u, v, 20, 62, 3) * 0.4; },
      (h) => mix3([66, 58, 48], [146, 134, 114], h), 9);
    T.thatch = makeTex(256, (u, v) => { const s = tn(u * 90, v * 6, 6, 71) * 0.6 + tn(u * 200, v * 16, 16, 72) * 0.4; const row = ((v * 5) % 1); return s * (0.55 + row * 0.45); },
      (h, u, v) => mix3([112, 86, 44], [214, 184, 112], h * (0.8 + tfbm(u, v, 5, 73, 2) * 0.4)), 8);
    T.metal = makeTex(256, (u, v) => { const r = tfbm(u, v, 5, 81, 5); const pu = (u * 2) % 1, pv = (v * 2) % 1; const seam = (pu < 0.012 || pv < 0.012) ? 0.2 : 1; return seam * (0.5 + r * 0.5); },
      (h, u, v) => { const rust = G.sstep(0.48, 0.66, tfbm(u, v, 4, 82, 5)); return mix3(sc([126, 134, 140], 0.7 + h * 0.5), sc([134, 72, 38], 0.6 + h * 0.6), rust); }, 5);
    T.steel = makeTex(256, (u, v) => {
      const pu = (u * 2) % 1, pv = (v * 2) % 1; const seam = (pu < 0.015 || pv < 0.015) ? 0.1 : 1;
      const rv = Math.hypot(((u * 8) % 1) - 0.5, ((v * 8) % 1) - 0.5) < 0.09 && (pu < 0.12 || pu > 0.88 || pv < 0.12 || pv > 0.88) ? 1.5 : 1;
      return seam * rv * (0.55 + tfbm(u, v, 8, 91, 3) * 0.25);
    }, (h, u, v) => sc(mix3([92, 104, 112], [166, 178, 184], h * 0.8), 0.9 + tfbm(u, v, 3, 92, 2) * 0.2), 5);
    T.cloth = makeTex(128, (u, v) => (Math.sin(u * 128 * Math.PI * 0.5) * 0.5 + 0.5) * 0.5 + (Math.sin(v * 128 * Math.PI * 0.5) * 0.5 + 0.5) * 0.5,
      (h, u, v) => sc([226, 214, 188], 0.72 + h * 0.2 + tfbm(u, v, 4, 95, 3) * 0.16), 3);
    T.rope = makeTex(64, (u, v) => (Math.sin((u + v * 2) * Math.PI * 8) * 0.5 + 0.5), (h) => mix3([110, 86, 52], [196, 168, 118], h), 6);
    T.concrete = makeTex(256, (u, v) => tfbm(u, v, 8, 101, 5) * 0.7 + tn(u * 128, v * 128, 128, 102) * 0.3,
      (h, u, v) => { const st = G.sstep(0.55, 0.75, tfbm(u * 0.5, v * 2, 4, 103, 4)); return mix3(sc([168, 170, 166], 0.8 + h * 0.3), [96, 104, 92], st * 0.5); }, 4);
    T.leafy = makeTex(256, (u, v) => { const a = tfbm(u, v, 10, 111, 4); const b = 1 - Math.abs(tfbm(u, v, 14, 112, 3) * 2 - 1); return a * 0.5 + b * 0.5; },
      (h) => mix3([22, 52, 20], [108, 156, 62], h * h), 10);
    T.coral = makeTex(128, (u, v) => { const b = 1 - Math.abs(tfbm(u, v, 8, 121, 4) * 2 - 1); return b; }, (h) => { const g = 120 + h * 135; return [g, g, g]; }, 10);
    T.plastic = makeTex(64, (u, v) => tfbm(u, v, 8, 131, 3), (h) => { const g = 200 + h * 50; return [g, g, g]; }, 1.5);

    // ---- alpha cut-outs drawn with 2D canvas ----
    // tapered blade/leaf outline: base at (x0,y0), tip at (x1,y1), bulging by w at fraction m along it, bent by bend
    function blade(g, x0, y0, x1, y1, w, m, bend) {
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, cx = x0 + dx * m + nx * bend, cy = y0 + dy * m + ny * bend;
      g.beginPath(); g.moveTo(x0 - nx * w * 0.35, y0 - ny * w * 0.35); g.quadraticCurveTo(cx - nx * w, cy - ny * w, x1, y1); g.quadraticCurveTo(cx + nx * w, cy + ny * w, x0 + nx * w * 0.35, y0 + ny * w * 0.35); g.closePath(); g.fill();
    }
    function frond() {
      const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d'); const rnd = G.rng(77);
      for (let i = 0; i < 64; i++) {
        const t = i / 63, x = 10 + t * 470, len = (24 + 100 * Math.sin(Math.PI * Math.pow(t, 0.55))) * (0.85 + rnd() * 0.3);
        for (const sd of [-1, 1]) {
          const lum = 0.75 + rnd() * 0.45, dry = rnd() < 0.08 ? 1 : 0, ang = 0.55 + rnd() * 0.25;
          const gr = g.createLinearGradient(x, 128, x + Math.cos(ang) * len, 128 + sd * Math.sin(ang) * len);
          gr.addColorStop(0, dry ? `rgb(${120 * lum | 0},${104 * lum | 0},${52 * lum | 0})` : `rgb(${38 * lum | 0},${86 * lum | 0},${30 * lum | 0})`);
          gr.addColorStop(1, dry ? `rgb(${150 * lum | 0},${126 * lum | 0},${62 * lum | 0})` : `rgb(${86 * lum | 0},${132 * lum | 0},${44 * lum | 0})`);
          g.fillStyle = gr; blade(g, x, 128, x + Math.cos(ang) * len * 0.9 + 14, 128 + sd * Math.sin(ang) * len, 3.2 + rnd() * 1.6, 0.4, sd * 6 * rnd());
        }
      }
      g.strokeStyle = '#7d7a3e'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 128); g.lineTo(500, 128); g.stroke();
      return finish(c, true, false);
    }
    function leaves(seed, hue) {
      const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); const rnd = G.rng(seed);
      // a few twigs radiating from the cluster, leaves along them
      g.lineCap = 'round';
      for (let t = 0; t < 7; t++) {
        const a0 = rnd() * Math.PI * 2, len = 150 + rnd() * 90; let x = S / 2 + Math.cos(a0) * 40, y = S / 2 + Math.sin(a0) * 40, a = a0;
        g.strokeStyle = 'rgb(70,55,38)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, y);
        const pts = []; for (let k = 0; k < 10; k++) { a += (rnd() - 0.5) * 0.35; x += Math.cos(a) * len / 10; y += Math.sin(a) * len / 10; g.lineTo(x, y); pts.push([x, y, a]); } g.stroke();
        for (const [px, py, pa] of pts) for (const sd of [-1, 1]) {
          if (rnd() < 0.15) continue; const la = pa + sd * (0.5 + rnd() * 0.5), L = 34 + rnd() * 26, lum = 0.62 + rnd() * 0.55, ex = px + Math.cos(la) * L, ey = py + Math.sin(la) * L;
          const gr = g.createLinearGradient(px, py, ex, ey); gr.addColorStop(0, `rgb(${hue[0] * lum * 0.7 | 0},${hue[1] * lum * 0.75 | 0},${hue[2] * lum * 0.7 | 0})`); gr.addColorStop(1, `rgb(${Math.min(255, hue[0] * lum * 1.15) | 0},${Math.min(255, hue[1] * lum * 1.1) | 0},${hue[2] * lum | 0})`);
          g.fillStyle = gr; blade(g, px, py, ex, ey, 7 + rnd() * 6, 0.45, sd * 3);
          g.strokeStyle = `rgba(25,45,15,0.45)`; g.lineWidth = 1; g.beginPath(); g.moveTo(px, py); g.lineTo(ex, ey); g.stroke();
        }
      }
      return finish(c, true, false);
    }
    function grass() {
      const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); const rnd = G.rng(5);
      for (let i = 0; i < 300; i++) {
        const x = 12 + rnd() * (S - 24), h = 160 + rnd() * 330, lean = (rnd() - 0.5) * 120, lum = 0.6 + rnd() * 0.55, dry = rnd() < 0.18;
        const gr = g.createLinearGradient(x, S, x + lean, S - h);
        gr.addColorStop(0, dry ? `rgb(${92 * lum | 0},${84 * lum | 0},${50 * lum | 0})` : `rgb(${34 * lum | 0},${62 * lum | 0},${22 * lum | 0})`);
        gr.addColorStop(0.6, dry ? `rgb(${168 * lum | 0},${150 * lum | 0},${92 * lum | 0})` : `rgb(${78 * lum | 0},${122 * lum | 0},${44 * lum | 0})`);
        gr.addColorStop(1, dry ? `rgb(${196 * lum | 0},${178 * lum | 0},${118 * lum | 0})` : `rgb(${128 * lum | 0},${156 * lum | 0},${70 * lum | 0})`);
        g.fillStyle = gr; blade(g, x, S, x + lean, S - h, 2.2 + rnd() * 2.6, 0.55, lean * 0.12);
      }
      return finish(c, true, false);
    }
    function dot(inner, outer) {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, inner); gr.addColorStop(1, outer);
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return finish(c, true, false);
    }
    T.frond = frond(); T.leafCard = leaves(3, [66, 118, 46]); T.grassCard = grass();
    T.dot = dot('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    T.fernCard = leaves(9, [48, 120, 44]);
    // ---- reef ----
    // brain coral: meandering ridges from a domain-warped stripe field
    T.brain = makeTex(256, (u, v) => { const w = tfbm(u, v, 3, 515, 3), w2 = tfbm(u, v, 5, 516, 2); return Math.pow(Math.abs(Math.sin((u * 9 + w * 2.6) * Math.PI * 2 + (v * 3 + w2 * 2.2) * Math.PI * 2)), 0.55); }, (h) => { const g = 95 + h * 150; return [g, g * 0.97, g * 0.9]; }, 9);
    // polyp-studded surface for branching and plate corals
    T.polyp = makeTex(128, (u, v) => { const cu = (u * 10) % 1 - 0.5, cv = (v * 10 + Math.floor(u * 10) * 0.5) % 1 - 0.5; return Math.max(0, 1 - Math.hypot(cu, cv) * 2.6) * 0.45 + tfbm(u, v, 10, 517, 3) * 0.55; }, (h) => { const g = 120 + h * 135; return [g, g * 0.96, g * 0.9]; }, 3);
    T.kelpBlade = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 512; const g = c.getContext('2d'); const rnd = G.rng(61);
      for (let k = 0; k < 3; k++) { const x0 = 22 + k * 42, gr = g.createLinearGradient(0, 512, 0, 0); gr.addColorStop(0, 'rgb(70,58,20)'); gr.addColorStop(0.5, 'rgb(122,104,34)'); gr.addColorStop(1, 'rgb(150,128,52)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x0, 512);
        for (let y = 512; y >= 8; y -= 8) { const w = 15 * Math.sin(Math.PI * (1 - y / 512) * 0.95 + 0.15) + 2 * Math.sin(y * 0.21 + k); g.lineTo(x0 + w + rnd() * 1.5, y); }
        for (let y = 8; y <= 512; y += 8) { const w = 15 * Math.sin(Math.PI * (1 - y / 512) * 0.95 + 0.15) + 2 * Math.sin(y * 0.19 + k * 2); g.lineTo(x0 - w - rnd() * 1.5, y); } g.closePath(); g.fill();
        g.strokeStyle = 'rgba(60,45,12,0.45)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x0, 512); g.lineTo(x0, 12); g.stroke(); }
      return finish(c, true, false); })();
    T.fan = (() => { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); const rnd = G.rng(62); g.lineCap = 'round';
      const br = (x, y, a, len, w, d) => { if (d > 7 || len < 6) return; const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len; g.strokeStyle = `rgb(${150 + rnd() * 40 | 0},${60 + rnd() * 30 | 0},${120 + rnd() * 40 | 0})`; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke(); br(ex, ey, a - 0.18 - rnd() * 0.3, len * 0.82, w * 0.78, d + 1); br(ex, ey, a + 0.18 + rnd() * 0.3, len * 0.82, w * 0.78, d + 1); };
      br(256, 510, -Math.PI / 2, 90, 7, 0);
      g.globalAlpha = 0.55; g.strokeStyle = 'rgb(170,80,140)'; g.lineWidth = 1; for (let i = 0; i < 900; i++) { const a = -Math.PI / 2 + (rnd() - 0.5) * 2.2, r0 = 60 + rnd() * 380, x = 256 + Math.cos(a) * r0, y = 510 + Math.sin(a) * r0; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 22, y + (rnd() - 0.5) * 22); g.stroke(); }
      return finish(c, true, false); })();

    // ---- materials ----
    const M = G.mats = {};
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const rep = (t, r) => { const map = t.map.clone(); map.repeat.set(r, r); map.needsUpdate = true; const n = t.normalMap.clone(); n.repeat.set(r, r); n.needsUpdate = true; return { map, normalMap: n }; };
    M.wood = std(Object.assign(rep(T.wood, 0.55), { roughness: 0.82, metalness: 0 }));
    M.woodDark = std(Object.assign(rep(T.woodDark, 0.6), { roughness: 0.85 }));
    M.log = std(Object.assign(rep(T.bark, 0.7), { roughness: 0.95 }));
    M.thatch = std(Object.assign(rep(T.thatch, 0.6), { roughness: 1, side: THREE.DoubleSide }));
    M.metal = std(Object.assign(rep(T.metal, 0.5), { roughness: 0.62, metalness: 0.6, color: 0x7d8078 }));   // weathered painted steel, rust only in the texture's streaks
    M.steel = std(Object.assign(rep(T.steel, 0.5), { roughness: 0.38, metalness: 0.9 }));
    M.cloth = std(Object.assign(rep(T.cloth, 2), { roughness: 0.95, side: THREE.DoubleSide }));
    M.rope = std(Object.assign(rep(T.rope, 3), { roughness: 1 }));
    M.stone = std(Object.assign(rep(T.rock, 0.5), { roughness: 0.92 }));
    M.concrete = std(Object.assign(rep(T.concrete, 0.3), { roughness: 0.9 }));
    M.plastic = std({ map: T.plastic.map, color: 0x2f7f9c, roughness: 0.45 });
    M.plasticRed = std({ map: T.plastic.map, color: 0xb5432c, roughness: 0.5 });
    M.plasticYellow = std({ map: T.plastic.map, color: 0xd6a62a, roughness: 0.5 });
    M.rubber = std({ color: 0x1c1c1e, roughness: 0.9 });
    M.glass = std({ color: 0x9fd6e0, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.35 });
    M.brass = std({ color: 0xb08d3c, roughness: 0.35, metalness: 1 });
    M.copper = std({ color: 0xb46a3c, roughness: 0.4, metalness: 1 });
    M.dark = std({ color: 0x15181b, roughness: 0.7, metalness: 0.3 });
    // skin: fine pore and freckle noise, a warm subsurface tint, soft sheen (sun-tanned castaway)
    T.skin = makeTex(256, (u, v) => tfbm(u, v, 40, 611, 3) * 0.6 + tfbm(u, v, 9, 612, 2) * 0.4, (h, u, v) => { const k = 0.88 + h * 0.18, fr = tfbm(u, v, 22, 613, 2) > 0.68 ? 0.9 : 1; return [156 * k * fr, 112 * k * fr, 90 * k * fr]; }, 1.2);
    M.skin = new THREE.MeshPhysicalMaterial({ map: T.skin.map, normalMap: T.skin.normalMap, roughness: 0.58, metalness: 0, sheen: 0.25, sheenRoughness: 0.7, sheenColor: new THREE.Color(0.75, 0.5, 0.42), emissive: 0x1a0805, emissiveIntensity: 0.3 });   // a little warmth for light scattering under the skin, without going orange
    M.skin.normalScale.set(0.25, 0.25);
    M.sleeve = std(Object.assign(rep(T.cloth, 6), { color: 0x6f7f86, roughness: 0.95 }));
    M.fabricBlue = std({ map: T.cloth.map, color: 0x3d5f86, roughness: 0.95 });
    M.fabricRed = std({ map: T.cloth.map, color: 0x9a4032, roughness: 0.95 });
    M.fabricGreen = std({ map: T.cloth.map, color: 0x4f6b3c, roughness: 0.95 });
    M.fabricTan = std({ map: T.cloth.map, color: 0xb59c72, roughness: 0.95 });
    M.soil = std({ map: T.detail.map, color: 0x4a3524, roughness: 1 });
    M.ember = std({ color: 0x220a02, emissive: 0xff5a14, emissiveIntensity: 2.2, roughness: 1 });
    M.lamp = std({ color: 0xfff0c0, emissive: 0xffc878, emissiveIntensity: 3, roughness: 0.5 });
    M.lampOff = std({ color: 0x55504a, roughness: 0.5 });
    M.solarCell = std({ color: 0x0c1f44, roughness: 0.18, metalness: 0.7 });
    M.screen = std({ color: 0x06222a, emissive: 0x3de0c8, emissiveIntensity: 1.4, roughness: 0.3 });
    M.crystal = std({ color: 0x7fe9ff, emissive: 0x2bb8ff, emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.85 });
    M.ghostOk = new THREE.MeshBasicMaterial({ color: 0x5fe3c0, transparent: true, opacity: 0.45, depthWrite: false });
    M.ghostBad = new THREE.MeshBasicMaterial({ color: 0xe0563c, transparent: true, opacity: 0.45, depthWrite: false });
    M.fish = std({ color: 0xffffff, roughness: 0.35, metalness: 0.3, vertexColors: true });
    M.creature = std({ color: 0xffffff, roughness: 0.6, vertexColors: true });
    M.rockObj = std(Object.assign(rep(T.rock, 1), { roughness: 0.95, vertexColors: true }));
    M.coral = std({ map: T.polyp.map, normalMap: T.polyp.normalMap, roughness: 0.8, vertexColors: true });
    M.brain = std({ map: T.brain.map, normalMap: T.brain.normalMap, roughness: 0.78, vertexColors: true }); M.brain.normalScale.set(1.4, 1.4);
    M.fan = swayPatch(std({ map: T.fan, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.75, vertexColors: true }), 0.04);
    M.canopy = swayPatch(std({ map: T.leafy.map, normalMap: T.leafy.normalMap, roughness: 0.85, vertexColors: true }), 0.012);
    M.frond = swayPatch(std({ map: T.frond, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.62, vertexColors: true }), 0.03);
    M.leafCard = swayPatch(std({ map: T.leafCard, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8, vertexColors: true }), 0.012);
    // canopy cards carry normals pointing out of the crown; keep them on both faces and let light glow through thin leaves
    M.foliage = swayPatch(std({ map: T.leafCard, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.75, vertexColors: true }), 0.01);
    { const sp = M.foliage.onBeforeCompile; M.foliage.onBeforeCompile = function (sh) { sp(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal *= faceDirection;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * 0.06;'); }; }
    M.reefPlain = std({ vertexColors: true, roughness: 0.75, metalness: 0 });
    // modelled leaves: no texture or alpha; both faces lit alike, a touch of transmitted light
    M.leaf3d = swayPatch(std({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.62, metalness: 0 }), 0.008);
    { const sp = M.leaf3d.onBeforeCompile; M.leaf3d.onBeforeCompile = function (sh) { sp(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal *= faceDirection;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * 0.04;'); }; }
    // real-blade grass: double-sided without the back-face normal flip, so both sides of a blade light the same
    M.grassBlade = swayPatch(std({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.82, metalness: 0 }), 0.22);
    { const sw = M.grassBlade.onBeforeCompile; M.grassBlade.onBeforeCompile = (sh) => { sw(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace(/gl_FrontFacing \? 1\.0 : - 1\.0/, '1.0')); }; }
    M.grassCard = swayPatch(std({ map: T.grassCard, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9, vertexColors: true }), 0.15);
    M.kelp = swayPatch(std({ map: T.kelpBlade, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.55, vertexColors: true }), 0.012);
    // thin leaves let sunlight through: looking toward the sun through a frond or blade it glows yellow-green
    const translucent = (mat, k) => { const ob = mat.onBeforeCompile; mat.onBeforeCompile = (sh) => { if (ob) ob(sh); sh.uniforms.uSunDirT = G.skyUniforms.uSunDir; sh.uniforms.uSunCT = G.uni.uSunC;
      sh.fragmentShader = 'uniform vec3 uSunDirT; uniform vec3 uSunCT;' + String.fromCharCode(10) + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec3 Lv = normalize((viewMatrix * vec4(uSunDirT, 0.0)).xyz); float bt = max(dot(normalize(-vViewPosition), Lv), 0.0);
          totalEmissiveRadiance += diffuseColor.rgb * vec3(1.05, 1.1, 0.75) * uSunCT * (pow(bt, 6.0) * ${k.toFixed(3)} + pow(bt, 2.0) * ${(k * 0.15).toFixed(3)}); }`); };
      mat.customProgramCacheKey = () => 'transl' + k; return mat; };
    translucent(M.frond, 0.9); translucent(M.leaf3d, 0.7); translucent(M.grassBlade, 0.6); translucent(M.foliage, 0.6);
    M.palmTrunk = swayPatch(std(Object.assign(rep(T.palmBark, 1), { roughness: 0.95, vertexColors: true })), 0.03);   // vertex colours: weathered base, coconut and crown tints
    M.trunk = std(Object.assign(rep(T.bark, 1), { roughness: 0.95 }));
    M.frondDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: T.frond, alphaTest: 0.45 });
    M.leafDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: T.leafCard, alphaTest: 0.4 });
    M.foliageDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: T.leafCard, alphaTest: 0.42 });
    M.terrain = G.assets.has('sand_dry') && G.assets.has('rock') ? pbrTerrainMat() : terrainMat();
    // real scanned materials where they were downloaded (scripts/fetch-assets.mjs); procedural ones stay as fallbacks
    const X = G.assets.tex, pbr = (name, rx, o) => { const t = X[name]; if (!t || !t.diff) return null; const c = (tx) => { if (!tx) return null; const k = tx.clone(); k.repeat.set(rx, rx); k.needsUpdate = true; return k; };
      return Object.assign({ map: c(t.diff), normalMap: c(t.nor), roughnessMap: c(t.arm), aoMap: null, roughness: 1, metalness: 0 }, o || {}); };
    const swap = (key, name, rx, o) => { const p = pbr(name, rx, o); if (!p) return; const old = M[key]; const m = new THREE.MeshStandardMaterial(Object.assign({ side: old.side, vertexColors: old.vertexColors }, p)); if (old.onBeforeCompile && old.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) m.onBeforeCompile = old.onBeforeCompile; M[key] = m; };
    swap('wood', 'deck', 0.42); swap('woodDark', 'planks', 0.5, { color: 0x8a7a68 }); swap('log', 'bark', 0.6); swap('trunk', 'bark', 0.7);
    swap('palmTrunk', 'palm_bark', 1.0); swap('stone', 'rock', 0.35); swap('rockObj', 'rock', 0.5, { vertexColors: false });
    M.sprite = new THREE.SpriteMaterial({ map: T.dot, transparent: true, depthWrite: false });
  };

  // wind sway: displaces vertices by a slow sine, weighted by height above the object's origin
  function swayPatch(mat, amount) {
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uTime = G.uni.uTime; sh.uniforms.uWind = G.uni.uWind;
      sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec3 ip = (instanceMatrix * vec4(0.,0.,0.,1.)).xyz;
          #else
            vec3 ip = (modelMatrix * vec4(0.,0.,0.,1.)).xyz;
          #endif
          float wgt = max(position.y, 0.0); wgt = (wgt * wgt * 0.12 + abs(position.y) * 0.25) * ${amount.toFixed(3)};
          float ph = uTime * 1.6 + ip.x * 0.31 + ip.z * 0.27;
          transformed.x += (sin(ph) + 0.4 * sin(ph * 2.7 + position.y)) * wgt * uWind;
          transformed.z += (cos(ph * 0.8) + 0.3 * sin(ph * 3.1 + position.x)) * wgt * uWind * 0.7;
        }`);
    };
    return mat;
  }
  G.swayPatch = swayPatch;

  // terrain from real textures: sand / wet sand / seabed / rock (triplanar) / jungle floor / grass, weighted per vertex (world.js color())
  function pbrTerrainMat() {
    const X = G.assets.tex, t = (n, m) => (X[n] && X[n][m]) || null, U = {};
    const L = { SandD: t('sand_dry', 'diff'), SandN: t('sand_dry', 'nor'), SandA: t('sand_dry', 'arm'), WetD: t('sand_wet', 'diff') || t('sand_dry', 'diff'), WetN: t('sand_wet', 'nor') || t('sand_dry', 'nor'),
      SeaD: t('seabed', 'diff') || t('sand_dry', 'diff'), SeaN: t('seabed', 'nor') || t('sand_dry', 'nor'), RockD: t('rock', 'diff'), RockN: t('rock', 'nor'), RockA: t('rock', 'arm'),
      JungD: t('jungle', 'diff') || t('grass', 'diff'), JungN: t('jungle', 'nor') || t('sand_dry', 'nor'), GrassD: t('grass', 'diff') || t('jungle', 'diff') };
    for (const k in L) U['t' + k] = { value: L[k] };
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
    m.onBeforeCompile = function (sh) {
      Object.assign(sh.uniforms, U); sh.uniforms.uTime = G.uni.uTime; sh.uniforms.uSea = G.uni.uSea; sh.uniforms.uWet = G.uni.uWet;
      sh.vertexShader = 'attribute vec4 aSplat; attribute float aJungle; varying vec4 vSpl; varying float vJun; varying vec3 vWP; varying vec3 vWN;\n' + sh.vertexShader
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n vSpl = aSplat; vJun = aJungle; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = Object.keys(L).map((k) => 'uniform sampler2D t' + k + ';').join('\n') + `
        varying vec4 vSpl; varying float vJun; varying vec3 vWP; varying vec3 vWN; uniform float uTime; uniform float uSea; uniform float uWet;
        float tHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float tNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(tHash(i), tHash(i + vec2(1, 0)), f.x), mix(tHash(i + vec2(0, 1)), tHash(i + vec2(1, 1)), f.x), f.y); }
        float gT_film; float gT_foam;
        vec3 gT_alb; vec3 gT_n; float gT_r; float gT_ao; vec4 gT_w;
        vec4 tri(sampler2D tx, vec3 p, vec3 bw, float sc){ return texture2D(tx, p.zy * sc) * bw.x + texture2D(tx, p.xz * sc) * bw.y + texture2D(tx, p.xy * sc) * bw.z; }
        vec3 triN(sampler2D tx, vec3 p, vec3 bw, float sc, vec3 Nw){
          vec3 nx = texture2D(tx, p.zy * sc).xyz * 2.0 - 1.0, ny = texture2D(tx, p.xz * sc).xyz * 2.0 - 1.0, nz = texture2D(tx, p.xy * sc).xyz * 2.0 - 1.0;
          vec3 a = vec3(0.0, nx.y, nx.x) * sign(Nw.x), b = vec3(ny.x, 0.0, ny.y), c = vec3(nz.x, nz.y, 0.0) * sign(Nw.z);
          return a * bw.x + b * bw.y + c * bw.z; }
        // two scales at a slight rotation, mixed by a slow noise, so no repeat is visible
        vec4 top2(sampler2D tx, vec2 p, float sc, float mixk){ vec2 q = vec2(p.x * 0.92 - p.y * 0.39, p.x * 0.39 + p.y * 0.92); return mix(texture2D(tx, p * sc), texture2D(tx, q * sc * 0.43 + 0.31), mixk); }
        ` + sh.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
          {
            vec3 Nw = normalize(vWN), P = vWP; vec4 w = max(vSpl, 0.0);
            float mk = 0.5 + 0.5 * sin(P.x * 0.043 + sin(P.z * 0.031) * 2.3) * sin(P.z * 0.052 + 1.7);
            vec3 bw = pow(abs(Nw), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
            // wet band: from just below the waterline to where the swash reaches
            // swash: each wave runs a thin sheet of water up the beach and draws it back; the sand stays wet up to the
            // highest reach, the moving edge carries a lace of foam
            float ph = uTime * 0.42 + tNoise(P.xz * 0.025) * 6.2832 + tNoise(P.xz * 0.11) * 0.8;
            float surge = pow(0.5 + 0.5 * sin(ph), 2.2), reach = 0.12 + (0.22 + 0.38 * uSea) * surge, top = 0.12 + 0.6 * uSea;
            gT_film = smoothstep(reach + 0.01, reach - 0.07, P.y) * step(-0.4, P.y) * (1.0 - surge * 0.2);
            float lace = smoothstep(0.55, 0.85, tNoise(P.xz * 3.1 + vec2(uTime * 0.3, 0.0)) * 0.6 + tNoise(P.xz * 9.0) * 0.5);
            float dr = (P.y - reach) / 0.035; gT_foam = exp(-dr * dr) * lace * (0.4 + 0.6 * surge) + gT_film * lace * 0.25 * (1.0 - surge);
            float wet = max((1.0 - smoothstep(top - 0.3, top + 0.08, P.y)) * step(-1.6, P.y), uWet * 0.85);
            vec3 sD = top2(tSandD, P.xz, 0.31, mk * 0.45).rgb, wD = top2(tWetD, P.xz, 0.33, mk * 0.45).rgb;
            vec3 sN = top2(tSandN, P.xz, 0.31, mk * 0.45).xyz * 2.0 - 1.0, wN = top2(tWetN, P.xz, 0.33, mk * 0.45).xyz * 2.0 - 1.0;
            vec3 sandD = mix(sD, wD, wet), sandN = vec3(mix(sN.xy, wN.xy, wet), 1.0);
            float sandR = mix(top2(tSandA, P.xz, 0.31, 0.0).g, 0.32, wet);
            vec3 seaD = top2(tSeaD, P.xz, 0.25, mk * 0.5).rgb, seaN = top2(tSeaN, P.xz, 0.25, mk * 0.5).xyz * 2.0 - 1.0;
            vec3 rD = tri(tRockD, P, bw, 0.17).rgb; vec3 rN = triN(tRockN, P, bw, 0.17, Nw); float rR = tri(tRockA, P, bw, 0.17).g, rAO = tri(tRockA, P, bw, 0.17).r;
            vec3 jD = top2(tJungD, P.xz, 0.28, mk * 0.5).rgb, gD = top2(tGrassD, P.xz, 0.12, mk * 0.5).rgb;
            vec3 jN = top2(tJungN, P.xz, 0.28, mk * 0.5).xyz * 2.0 - 1.0;
            vec3 vegD = mix(gD, jD, vJun); vec3 vegN = mix(vec3(0.0, 0.0, 1.0), jN, vJun);
            // height-aware blending: rock shows through sand in its crevices rather than as a smooth fade
            float rl = dot(rD, vec3(0.333)); w.z = clamp(w.z * (0.6 + rl * 1.2), 0.0, 1.0);
            float tot = w.x + w.y + w.z + w.w + 1e-4; w /= tot; gT_w = w;
            gT_alb = sandD * w.x + vegD * w.y + rD * w.z + seaD * w.w;
            vec3 tn = vec3(sandN.xy * w.x + vegN.xy * w.y + seaN.xy * w.w, 0.0);
            gT_n = normalize(Nw + vec3(tn.x, 0.0, tn.y) * 0.9 + rN * w.z * 0.9);
            gT_r = sandR * w.x + 0.88 * w.y + rR * w.z + 0.8 * w.w; gT_ao = mix(1.0, rAO, w.z);
            // rain soaks every surface: darker and glossier, rock and leaves included
            float soak = uWet * (1.0 - w.x * 0.3);
            gT_alb *= mix(1.0, 0.62, soak); gT_r = mix(gT_r, 0.2, soak * 0.85);
            // the moving water sheet and its foam (sand only)
            float fs = gT_film * (w.x + w.w);
            gT_alb = mix(gT_alb, gT_alb * vec3(0.55, 0.62, 0.66), fs); gT_r = mix(gT_r, 0.04, fs); gT_n = normalize(mix(gT_n, Nw, fs * 0.8));
            gT_alb = mix(gT_alb, vec3(0.85, 0.88, 0.88), clamp(gT_foam * (w.x + w.w), 0.0, 1.0) * 0.85);
            diffuseColor.rgb = gT_alb;
          }`)
        .replace('#include <color_fragment>', '// biome tint from the vertex colour, kept gentle so the textures read as themselves\n float vl = dot(vColor, vec3(0.333)); diffuseColor.rgb *= mix(vec3(1.0), clamp(vColor / max(vl, 0.05), 0.4, 1.6), 0.22 * (gT_w.x + gT_w.w)) * mix(1.0, clamp(vl / 0.42, 0.45, 1.9), 0.6 * (gT_w.x + gT_w.w)) * gT_ao;\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15))) * vec3(0.5, 0.82, 0.3), gT_w.y * 0.6);')
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gT_r;')
        .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(gT_n, 0.0)).xyz);');
    };
    return m;
  }

  function terrainMat() {
    const m = new THREE.MeshStandardMaterial({ map: G.tex.detail.map, normalMap: G.tex.detail.normalMap, vertexColors: true, roughness: 0.95, metalness: 0 });
    m.normalScale.set(0.9, 0.9);
    m.onBeforeCompile = function (sh) {
      sh.vertexShader = 'varying float vWY;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWY = (modelMatrix * vec4(transformed, 1.0)).y;');
      sh.fragmentShader = 'varying float vWY;\n' + sh.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
          diffuseColor.rgb *= mix(vec3(1.0), texture2D(map, vMapUv * 0.137).rgb * 1.7, 0.55);
          float wetS = (1.0 - smoothstep(-0.1, 0.75, vWY)) * step(-1.2, vWY);
          diffuseColor.rgb *= mix(1.0, 0.66, wetS);`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.22, (1.0 - smoothstep(-0.1, 0.75, vWY)) * step(-0.6, vWY));');
    };
    return m;
  }
})();
