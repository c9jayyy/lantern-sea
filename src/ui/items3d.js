'use strict';
/* Item models, second generation. Replaces the placeholder shapes of the icon studio (plain cylinders, lumps, boxes)
   with modelled objects that use the game's real textures, tinted per item through vertex colour:
   rope and cable coils, spools, rolled cloth, powder heaps, tied bundles, carved bowls holding the actual dish,
   glass jars and bottles with their contents inside, tins, seed packets, hard cases, garments, hats, boots, bags,
   masks, fins, hides, fruit and a set of one-off objects. The same models are used for items lying in the world. */
(function () {
  const G = window.G, ICON = G.icons, T = ICON.T, PI = Math.PI, TAU = PI * 2;
  const C3 = (hex) => { if (Array.isArray(hex)) return hex; const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };   // accepts an already converted colour too
  const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

  // ---------- materials: textured bases, coloured per item through vertex colour ----------
  const MAT = {
    plain: { r: 0.6 }, matte: { r: 0.95 }, gloss: { r: 0.22 }, satin: { r: 0.42 }, metal: { m: 0.95, r: 0.3 }, oldMetal: { map: 'metal', m: 0.7, r: 0.55 },
    cloth: { map: 'cloth', r: 0.96 }, rope: { map: 'rope', r: 1 }, wood: { map: 'wood', r: 0.72 }, woodDark: { map: 'woodDark', r: 0.65 }, bark: { map: 'log', r: 0.95 },
    stone: { map: 'stone', r: 0.9 }, straw: { map: 'thatch', r: 0.95 }, leather: { map: 'skin', r: 0.55, ns: 0.6 }, paper: { r: 0.88 }, wax: { r: 0.35 },
    leaf: { r: 0.6, side: THREE.DoubleSide }, glass: { r: 0.04, glass: true }, liquid: { r: 0.08 }, flesh: { r: 0.38 }, rubber: { r: 0.85 }, plastic: { r: 0.35 }
  };
  function M(k) {
    const key = 'it_' + k; if (G.mats[key]) return key; const d = MAT[k];
    if (d.glass) G.mats[key] = new THREE.MeshPhysicalMaterial({ roughness: d.r, metalness: 0, transparent: true, opacity: 0.32, vertexColors: true, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 });
    else {
      const src = d.map && G.mats[d.map], o = { roughness: d.r, metalness: d.m || 0, vertexColors: true, side: d.side || THREE.FrontSide };
      if (src && src.map) { o.map = src.map; if (src.normalMap) { o.normalMap = src.normalMap; o.normalScale = new THREE.Vector2(d.ns || 1, d.ns || 1); } }
      G.mats[key] = new THREE.MeshStandardMaterial(o);
    }
    return key;
  }

  // ---------- geometry helpers ----------
  const _v = new THREE.Vector3();
  const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg || 28);
  function vcol(g, fn) { const p = g.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); const k = fn(_v, i); c[i * 3] = k[0]; c[i * 3 + 1] = k[1]; c[i * 3 + 2] = k[2]; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; }
  function bump(g, amp, f, seed) { const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); const k = (G.fbm(_v.x * f + seed, _v.y * f + _v.z * f * 1.3, seed, 3) - 0.5) * 2 * amp; p.setXYZ(i, _v.x + n.getX(i) * k, _v.y + n.getY(i) * k, _v.z + n.getZ(i) * k); } g.computeVertexNormals(); return g; }
  const speck = (c, f, seed, amt) => (v) => mul(c, 1 - amt + amt * 2 * G.fbm(v.x * f + seed, v.y * f + v.z * f, seed, 2));
  function tube(pts, r, seg, rad, closed) { const cv = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), !!closed); const g = new THREE.TubeGeometry(cv, seg || pts.length * 6, r, rad || 8, !!closed); const uv = g.attributes.uv, L = cv.getLength(); for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i) * L / (r * 9)); return g; }
  function rrect(w, h, r) { const s = new THREE.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; }
  const ext = (shape, depth, bev, seg) => { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: seg || 3, curveSegments: 14 }); g.translate(0, 0, -depth / 2); return g; };
  // a rounded box: a box with its corners pulled toward a superellipsoid
  function softBox(w, h, d, k, segs) { const s = segs || 8, g = new THREE.BoxGeometry(w, h, d, s, s, s), p = g.attributes.position; for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); const x = _v.x / (w / 2), y = _v.y / (h / 2), z = _v.z / (d / 2), l = Math.hypot(x, y, z) || 1, m = Math.max(Math.abs(x), Math.abs(y), Math.abs(z)), f = 1 + (m / l - 1) * k; p.setXYZ(i, _v.x * f, _v.y * f, _v.z * f); } g.computeVertexNormals(); return g; }

  // ---------- shape kit ----------
  const K = {
    // a loose coil of rope, cable, vine or line lying flat, with a tail
    coil(b, mk, c, th, R, turns) {
      th = th || 0.055; R = R || 0.42; turns = turns || 3.4; const pts = [], N = Math.round(turns * 18);
      for (let i = 0; i <= N; i++) { const t = i / N, a = t * turns * TAU, r = R * (1 - 0.1 * t) + Math.sin(a * 3 + 1.7) * 0.015; pts.push([Math.cos(a) * r, th + t * turns * th * 1.15 + Math.sin(a) * 0.012, Math.sin(a) * r]); }
      const e = pts[pts.length - 1]; pts.push([e[0] + 0.12, e[1] - th * 0.5, e[2] + 0.18], [e[0] + 0.3, th, e[2] + 0.42]);
      b.add(tube(pts, th, N * 4, 9), mk, null, c); b.sph(th * 1.05, pts[pts.length - 1][0], th, pts[pts.length - 1][2], mk, 1, 1, 1, mul(c, 0.85), 8);
    },
    spool(b, c, lineMk) { b.add(lathe([[0, -0.32], [0.34, -0.32], [0.34, -0.27], [0.15, -0.25], [0.15, 0.25], [0.34, 0.27], [0.34, 0.32], [0, 0.32]], 28), M('wood'), b.mat4(0, 0.34, 0, PI / 2, 0, 0), C3(0xc89a64)); b.add(new THREE.CylinderGeometry(0.29, 0.29, 0.5, 32, 1, true), lineMk || M('rope'), b.mat4(0, 0.34, 0, PI / 2, 0, 0), c); },
    // rolled fabric: a real spiral cross-section, tied with two cords and a loose end
    clothRoll(b, c, L, R, mk) {
      L = L || 1.1; R = R || 0.28; const sh = new THREE.Shape(), turns = 3.2, th = 0.028, n = 120, out = [], inn = [];
      for (let i = 0; i <= n; i++) { const a = i / n * turns * TAU, r = R * (0.22 + 0.78 * i / n); out.push([Math.cos(a) * r, Math.sin(a) * r]); inn.push([Math.cos(a) * (r - th), Math.sin(a) * (r - th)]); }
      sh.moveTo(out[0][0], out[0][1]); for (const p of out) sh.lineTo(p[0], p[1]); for (let i = inn.length - 1; i >= 0; i--) sh.lineTo(inn[i][0], inn[i][1]);
      const g = ext(sh, L, 0.008, 2); g.rotateY(PI / 2); g.translate(0, R, 0); b.add(g, mk || M('cloth'), null, c);
      const fl = new THREE.PlaneGeometry(L * 0.98, 0.35, 1, 4), p = fl.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, (y + 0.175) * (y + 0.175) * 0.6); } fl.rotateX(-PI / 2); fl.computeVertexNormals();
      b.add(fl, M('leaf'), b.mat4(0, 0.012, R + 0.16, 0, 0, 0), mul(c, 0.95));
      for (const s of [-1, 1]) b.add(new THREE.TorusGeometry(R + 0.012, 0.018, 8, 28), M('rope'), b.mat4(s * L * 0.3, R, 0, 0, PI / 2, 0), C3(0x8a6a44));
    },
    // a heap of powder, sand or grit, with loose grains around the foot
    heap(b, c, o) {
      o = o || {}; const h = o.h || 0.42, r = o.r || 0.62, pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([r * t, h * Math.pow(1 - t, 1.5) * (1 - 0.04 * Math.sin(t * 9))]); } pts.reverse();   // outside edge first, so the surface faces out
      const g = bump(lathe(pts, 32), o.lumpy || 0.025, 4, 3); vcol(g, speck([1, 1, 1], 9, 5, o.sp || 0.12)); b.add(g, M(o.mk || 'matte'), null, c);
      const rr = G.rng(11); for (let i = 0; i < (o.grains || 26); i++) { const a = rr() * TAU, d = r * (0.85 + rr() * 0.4), s = (o.gs || 0.025) * (0.6 + rr() * 0.8); b.add(G.geo.blob(80 + i, 5, 0.35, 0.7), M(o.mk || 'matte'), b.mat4(Math.cos(a) * d, s * 0.5, Math.sin(a) * d, rr() * 3, rr() * 3, 0, s), mul(c, 0.8 + rr() * 0.35)); }
    },
    // a pile of separate pieces (berries, chips, chunks)
    pieces(b, c, n, s, mk, shape) { const rr = G.rng(17); for (let i = 0; i < n; i++) { const a = rr() * TAU, d = Math.sqrt(rr()) * 0.45, lvl = i > n * 0.6 ? 1 : 0, sc = s * (0.8 + rr() * 0.4), g = shape ? shape(i) : G.geo.blob(120 + i, 9, 0.18, 0.85); b.add(g, M(mk || 'plain'), b.mat4(Math.cos(a) * d * (lvl ? 0.5 : 1), sc * 0.8 + lvl * s * 1.2, Math.sin(a) * d * (lvl ? 0.5 : 1), rr() * 3, rr() * 3, rr() * 3, sc), mul(c, 0.85 + rr() * 0.3)); } },
    // parallel sticks, strips or fibres tied with two bands of cord
    bundle(b, mk, c, n, L, r, o) {
      o = o || {}; const rr = G.rng(o.seed || 23), R = r * Math.sqrt(n) * 1.05;
      for (let i = 0; i < n; i++) { const a = rr() * TAU, d = Math.sqrt(rr()) * R, y = R + Math.sin(a) * d, z = Math.cos(a) * d, l = L * (0.88 + rr() * 0.2), bend = o.bend || 0, pts = []; for (let k = 0; k <= 6; k++) { const t = k / 6 - 0.5; pts.push([t * l, y + Math.sin(t * PI + rr()) * bend * (rr() - 0.3), z + (rr() - 0.5) * bend]); } b.add(o.flat ? (() => { const g = new THREE.BoxGeometry(l, r * 0.4, r * 2.2, 8, 1, 1); g.translate(0, y, z); return g; })() : tube(pts, r * (0.8 + rr() * 0.4), 14, o.rad || 6), mk, o.flat ? b.mat4(0, 0, 0, rr() * 0.2, 0, 0) : null, mul(c, 0.82 + rr() * 0.3)); }
      if (!o.noTie) for (const s of [-1, 1]) b.add(new THREE.TorusGeometry(R + r * 0.9, 0.022, 8, 24), M('rope'), b.mat4(s * L * 0.26, R, 0, 0, PI / 2, 0), C3(o.tie || 0x8a6a44));
    },
    // carved wooden bowl (or half coconut) holding a dish: a liquid surface and whatever floats in it
    bowl(b, liquid, bits, o) {
      o = o || {}; const shell = o.shell, rim = 0.58, hgt = 0.4;
      const pts = shell ? [[0.001, 0], [0.22, 0.02], [0.45, 0.12], [0.58, 0.3], [rim, hgt], [rim - 0.035, hgt], [0.52, 0.28], [0.4, 0.13], [0.2, 0.06], [0.001, 0.05]] : [[0.001, 0], [0.24, 0], [0.26, 0.04], [0.46, 0.13], [0.57, 0.3], [rim, hgt], [rim - 0.04, hgt + 0.01], [0.52, 0.3], [0.42, 0.15], [0.2, 0.08], [0.001, 0.07]];
      const g = lathe(pts, 36); b.add(g, M(shell ? 'bark' : 'wood'), null, C3(shell ? 0x6a4a2c : 0xa87a4c));
      K.contents(b, liquid, bits, o, o.fill || 0.31, 0.515, 0.4);
      if (o.spoon) { b.add(lathe([[0.001, 0], [0.07, 0.01], [0.09, 0.04], [0.001, 0.03]], 14), M('wood'), b.mat4(0.3, 0.36, 0.1, 0.2, 0, 0.5, 1, 1, 1.4), C3(0xc89a64)); b.cyl(0.018, 0.022, 0.7, 0.55, 0.55, 0.22, M('wood'), 8, 0.2, 0, 0.95, C3(0xc89a64)); }
    },
    // the dish itself: a liquid surface at height fy (radius fr) and pieces spread within radius sp
    contents(b, liquid, bits, o, fy, fr, sp) {
      o = o || {};
      if (liquid != null) { const d = new THREE.CircleGeometry(fr, 36); d.rotateX(-PI / 2); vcol(d, speck([1, 1, 1], 6, 9, 0.1)); b.add(d, M(o.thick ? 'satin' : 'liquid'), b.mat4(0, fy, 0), C3(liquid)); }
      const rr = G.rng(o.seed || 31), k = sp / 0.4; for (const [hex, n, s0, kind] of bits || []) for (let i = 0; i < n; i++) { const s = s0 * k, a = rr() * TAU, d = Math.sqrt(rr()) * sp, sc = s * (0.75 + rr() * 0.5), y = fy + (o.mound ? (sp * 1.05 - d) * o.mound : 0); const gg = kind === 'leaf' ? (() => { const q = new THREE.CircleGeometry(1, 7); q.scale(1, 0.45, 1); q.rotateX(-PI / 2 + (rr() - 0.5) * 0.6); return q; })() : kind === 'cube' ? new THREE.BoxGeometry(1.4, 1, 1.4) : kind === 'ring' ? new THREE.TorusGeometry(0.8, 0.3, 6, 12) : G.geo.blob(200 + i, 8, 0.22, 0.7); b.add(gg, M(kind === 'leaf' ? 'leaf' : 'flesh'), b.mat4(Math.cos(a) * d, y + sc * 0.2, Math.sin(a) * d, kind === 'ring' ? PI / 2 : rr(), rr() * 3, rr() * 0.5, sc), mul(C3(hex), 0.85 + rr() * 0.3)); }
    },
    // glass jar with its contents and a lid: 'cork', 'wood' or a 'cloth' cover tied with string
    jar(b, content, lid, fill, cmk) {
      fill = fill == null ? 0.72 : fill; const H = 0.78, pr = [[0.001, 0], [0.27, 0], [0.31, 0.06], [0.32, H * 0.75], [0.27, H * 0.92], [0.21, H], [0.22, H + 0.06], [0.2, H + 0.06]];
      b.add(lathe(pr, 32), M('glass'), null, C3(0xdff0f0));
      if (content != null) { const fh = H * 0.75 * fill + 0.03, ci = [[0.001, 0.025], [0.29, 0.03], [0.3, fh], [0.001, fh]]; const g = lathe(ci, 28); vcol(g, speck([1, 1, 1], 8, 4, 0.12)); b.add(g, M(cmk || 'satin'), null, C3(content)); }
      if (lid === 'cloth') { b.add(lathe([[0.001, H + 0.1], [0.24, H + 0.08], [0.27, H - 0.02], [0.29, H - 0.12], [0.3, H - 0.13]], 24), M('cloth'), null, C3(0xd8c8a4)); b.add(new THREE.TorusGeometry(0.235, 0.014, 6, 24), M('rope'), b.mat4(0, H + 0.0, 0, PI / 2, 0, 0), C3(0x7a5a3a)); }
      else if (lid === 'wood') b.cyl(0.24, 0.24, 0.1, 0, H + 0.09, 0, M('wood'), 24, 0, 0, 0, C3(0x9a6a3c));
      else b.cyl(0.2, 0.17, 0.16, 0, H + 0.1, 0, M('matte'), 18, 0, 0, 0, C3(0xb08a5a));
    },
    // glass bottle with liquid inside and a cork
    bottle(b, liquid, glassC, fill, cork) {
      fill = fill == null ? 0.7 : fill; const pr = [[0.001, 0], [0.26, 0], [0.285, 0.05], [0.29, 0.62], [0.24, 0.78], [0.12, 0.9], [0.1, 1.12], [0.115, 1.15], [0.1, 1.17]];
      b.add(lathe(pr, 32), M('glass'), null, C3(glassC || 0xd8eef0));
      if (liquid != null) { const fh = 0.62 * fill + 0.03, g = lathe([[0.001, 0.02], [0.265, 0.025], [0.27, fh], [0.001, fh]], 28); b.add(g, M('liquid'), null, C3(liquid)); }
      if (cork !== false) b.cyl(0.098, 0.086, 0.16, 0, 1.15, 0, M('matte'), 14, 0, 0, 0, C3(cork || 0xb08a5a));
    },
    // tin can: ribbed metal with a printed paper label
    tin(b, label, band) { const H = 0.72, pts = [[0.001, 0], [0.3, 0], [0.315, 0.02]]; for (let i = 0; i <= 10; i++) pts.push([0.315 - (i % 2) * 0.006, 0.05 + i * (H - 0.1) / 10]); pts.push([0.315, H - 0.02], [0.3, H], [0.27, H - 0.01], [0.001, H - 0.01]); b.add(lathe(pts, 32), M('metal'), null, C3(0xc8ccd0)); b.add(new THREE.CylinderGeometry(0.322, 0.322, H * 0.62, 32, 1, true), M('paper'), b.mat4(0, H * 0.5, 0), C3(label)); if (band) b.add(new THREE.CylinderGeometry(0.324, 0.324, H * 0.12, 32, 1, true), M('paper'), b.mat4(0, H * 0.5, 0), C3(band)); },
    // paper packet, pillowed by its contents, folded over at the top, with a picture on a pale label
    packet(b, c, pic, s) { s = s || 1; const g = new THREE.BoxGeometry(0.7 * s, 0.95 * s, 0.14 * s, 8, 10, 2), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (0.35 * s), y = p.getY(i) / (0.475 * s), z = p.getZ(i); p.setZ(i, z * (0.45 + 0.55 * Math.cos(x * PI / 2) * Math.cos(Math.max(0, y) * PI / 2.2))); } g.computeVertexNormals(); b.add(g, M('paper'), b.mat4(0, 0.48 * s, 0, -0.25, 0, 0), C3(c));
      b.box(0.7 * s, 0.1 * s, 0.05 * s, 0, 0.92 * s, -0.12 * s, M('paper'), 0, -0.25, 0, mul(C3(c), 0.8)); b.add(new THREE.PlaneGeometry(0.48 * s, 0.4 * s), M('paper'), b.mat4(0, 0.42 * s, 0.065 * s + 0.01, -0.25, 0, 0), C3(0xf0e8d4)); if (pic) b.sph(0.11 * s, 0, 0.44 * s, 0.09 * s, M('gloss'), 1, 1, 0.3, C3(pic), 14); },
    // hard carrying case with a handle and latches; medical cases carry a white cross
    kase(b, c, cross) { b.add(ext(rrect(1.0, 0.62, 0.1), 0.42, 0.03), M('plastic'), b.mat4(0, 0.33, 0), C3(c)); b.box(1.02, 0.03, 0.44, 0, 0.42, 0, M('metal'), 0, 0, 0, C3(0x5a5e62)); b.add(new THREE.TorusGeometry(0.15, 0.03, 8, 16, PI), M('rubber'), b.mat4(0, 0.67, 0), C3(0x1c1c1e)); for (const s of [-1, 1]) b.box(0.08, 0.1, 0.04, s * 0.3, 0.43, 0.25, M('metal'), 0, 0, 0, C3(0xb0b4b8)); if (cross) { b.box(0.26, 0.08, 0.02, 0, 0.3, 0.255, M('gloss'), 0, 0, 0, [1, 1, 1]); b.box(0.08, 0.26, 0.02, 0, 0.3, 0.255, M('gloss'), 0, 0, 0, [1, 1, 1]); } },
    // garments laid flat: shirt, vest, coat (long, hooded) and suit (long sleeves, legs)
    garment(b, kind, c, mk) {
      const sh = new THREE.Shape(), long = kind === 'coat', sleeve = kind !== 'vest', hem = long ? -0.75 : -0.5;
      sh.moveTo(-0.17, 0.5); sh.quadraticCurveTo(0, 0.36, 0.17, 0.5); sh.lineTo(0.42, 0.46);
      if (sleeve) { const sl = kind === 'suit' || long ? 0.95 : 0.7; sh.lineTo(sl, 0.2 - (sl - 0.7) * 0.6); sh.lineTo(sl - 0.14, 0.05 - (sl - 0.7) * 0.6); sh.lineTo(0.38, 0.2); } else sh.quadraticCurveTo(0.3, 0.2, 0.38, 0.05);
      sh.lineTo(0.42, hem); if (kind === 'suit') { sh.lineTo(0.36, -1.15); sh.lineTo(0.08, -1.15); sh.lineTo(0.02, -0.55); sh.lineTo(-0.02, -0.55); sh.lineTo(-0.08, -1.15); sh.lineTo(-0.36, -1.15); } else sh.lineTo(-0.42, hem);
      if (sleeve) { const sl = kind === 'suit' || long ? 0.95 : 0.7; sh.lineTo(-0.38, 0.2); sh.lineTo(-(sl - 0.14), 0.05 - (sl - 0.7) * 0.6); sh.lineTo(-sl, 0.2 - (sl - 0.7) * 0.6); } else { sh.lineTo(-0.38, 0.05); sh.quadraticCurveTo(-0.3, 0.2, -0.42, 0.46); }
      sh.lineTo(-0.42, 0.46); sh.closePath();
      const g = ext(sh, 0.05, 0.03, 3), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, p.getZ(i) + Math.sin(x * 7 + y * 3) * 0.018 + Math.sin(y * 11) * 0.01); } g.computeVertexNormals();
      g.rotateX(-PI / 2); b.add(g, mk || M('cloth'), b.mat4(0, 0.06, 0), C3(c));
      b.add(new THREE.TorusGeometry(0.19, 0.03, 8, 20, PI), mk || M('cloth'), b.mat4(0, 0.1, -0.47, -PI / 2, PI, 0, 1, 0.75, 1), mul(C3(c), 0.85));
      if (long) b.sph(0.3, 0, 0.08, -0.68, mk || M('cloth'), 1, 0.25, 0.7, mul(C3(c), 0.9), 16);
      if (kind === 'shirt') for (let i = 0; i < 4; i++) b.cyl(0.025, 0.025, 0.02, 0, 0.1, -0.3 + i * 0.18, M('gloss'), 10, 0, 0, 0, C3(0xe8e0d0));
      if (kind === 'vest') for (let i = 0; i < 4; i++) b.box(0.24, 0.015, 0.02, 0, 0.1, -0.25 + i * 0.16, M('rope'), (i % 2 ? 0.4 : -0.4), 0, 0, C3(0x5a3a22));
    },
    hat(b, c, mk, curl) { const brim = [], n = 16; for (let i = 0; i <= n; i++) { const t = i / n, r = 0.36 + t * 0.44; brim.push([r, 0.04 + (curl ? Math.pow(t, 2.5) * 0.22 : -Math.pow(t, 2) * 0.08)]); } const g = lathe(brim.concat([[0.8, 0.0], [0.36, 0.0]]), 40); b.add(g, mk || M('straw'), null, C3(c)); b.add(lathe([[0.37, 0.04], [0.36, 0.25], [0.32, 0.42], [0.2, 0.47], [0.001, 0.46]], 32), mk || M('straw'), null, C3(c)); b.add(new THREE.CylinderGeometry(0.372, 0.375, 0.08, 32, 1, true), M('cloth'), b.mat4(0, 0.1, 0), C3(0x4a2a1a)); },
    boots(b, c, low, mk) {
      const sh = new THREE.Shape(), top = low ? 0.3 : 0.72; sh.moveTo(-0.3, 0.04); sh.lineTo(0.32, 0.04); sh.quadraticCurveTo(0.5, 0.04, 0.5, 0.13); sh.quadraticCurveTo(0.48, 0.24, 0.26, 0.27); sh.lineTo(0.06, 0.32); sh.lineTo(0.02, top); sh.lineTo(-0.28, top); sh.lineTo(-0.31, 0.2); sh.quadraticCurveTo(-0.33, 0.04, -0.3, 0.04);
      const so = new THREE.Shape(); so.moveTo(-0.31, 0); so.lineTo(0.34, 0); so.quadraticCurveTo(0.52, 0, 0.51, 0.06); so.lineTo(-0.32, 0.06); so.closePath();
      for (const s of [-1, 1]) { const g = ext(sh, 0.18, 0.05, 3); g.rotateY(-PI / 2); b.add(g, mk || M('leather'), b.mat4(s * 0.2, 0, s * 0.06, 0, s * 0.08, 0), C3(c)); const gs = ext(so, 0.26, 0.012, 1); gs.rotateY(-PI / 2); b.add(gs, M('rubber'), b.mat4(s * 0.2, 0, s * 0.06, 0, s * 0.08, 0), C3(0x2a2420)); if (!low) for (let i = 0; i < 4; i++) b.box(0.16, 0.012, 0.012, s * 0.2, 0.36 + i * 0.09, s * 0.06 + 0.13, M('rope'), 0, 0, 0, C3(0xd8c8a0)); }
    },
    bag(b, c, kind, mk) {
      const m = mk || M('cloth'); if (kind === 'duffel') { const g = softBox(1.2, 0.5, 0.5, 0.85, 10); b.add(g, m, b.mat4(0, 0.25, 0), C3(c)); for (const s of [-1, 1]) b.add(new THREE.TorusGeometry(0.16, 0.025, 8, 16, PI), M('rope'), b.mat4(s * 0.2, 0.48, 0), C3(0x3a2a1a)); b.box(1.0, 0.015, 0.02, 0, 0.5, 0.0, M('metal'), 0, 0, 0, C3(0xa0a4a8)); return; }
      const flat = kind === 'satchel', W = flat ? 0.8 : 0.7, H = flat ? 0.6 : 0.9, D = flat ? 0.18 : 0.36; b.add(softBox(W, H, D, 0.6, 10), m, b.mat4(0, H / 2, 0), C3(c));
      const fl = softBox(W * 1.02, H * 0.42, D * 0.3, 0.5, 6); b.add(fl, m, b.mat4(0, H * 0.8, D * 0.42, -0.12, 0, 0), mul(C3(c), 0.88));
      if (!flat) b.add(softBox(W * 0.7, H * 0.36, D * 0.4, 0.6, 6), m, b.mat4(0, H * 0.3, D * 0.6), mul(C3(c), 0.92));
      for (const s of [-1, 1]) { b.box(0.07, 0.04, 0.025, s * W * 0.25, H * 0.62, D * 0.6 + (flat ? 0 : 0.02), M('metal'), 0, 0, 0, C3(0x9a9ea2)); if (!flat) b.add(tube([[s * 0.2, H * 0.95, -D * 0.5], [s * 0.24, H * 0.7, -D * 0.75], [s * 0.22, H * 0.25, -D * 0.72], [s * 0.2, 0.06, -D * 0.5]], 0.03, 20, 6), M('leather'), null, C3(0x3a2a1a)); }
      if (flat) b.add(tube([[-0.38, 0.5, 0], [-0.3, 1.1, 0], [0.3, 1.1, 0], [0.38, 0.5, 0]], 0.025, 30, 6), M('leather'), null, mul(C3(c), 0.6));
    },
    mask(b, c, goggles) {
      if (goggles) { for (const s of [-1, 1]) { b.add(new THREE.TorusGeometry(0.2, 0.05, 10, 24), M('rubber'), b.mat4(s * 0.26, 0.3, 0), C3(c)); b.add(new THREE.CircleGeometry(0.19, 24), M('glass'), b.mat4(s * 0.26, 0.3, 0.01), C3(0xcfe8f0)); } b.add(tube([[-0.46, 0.3, 0], [-0.5, 0.3, -0.35], [0, 0.32, -0.55], [0.5, 0.3, -0.35], [0.46, 0.3, 0]], 0.025, 30, 6), M('rubber'), null, C3(0x1a1a1a)); return; }
      const hole = rrect(0.7, 0.32, 0.12); const sh = rrect(0.86, 0.46, 0.18); sh.holes.push(hole); b.add(ext(sh, 0.1, 0.02), M('plastic'), b.mat4(0, 0.35, 0.05), C3(c));
      b.add(new THREE.PlaneGeometry(0.7, 0.32), M('glass'), b.mat4(0, 0.35, 0.06), C3(0xd8f0f4));
      b.add(lathe([[0.3, 0], [0.38, -0.08], [0.42, -0.18]], 28), M('rubber'), b.mat4(0, 0.35, 0.02, PI / 2, 0, 0, 1.25, 1, 0.75), C3(0x2a3a44));
      b.add(tube([[-0.46, 0.35, -0.05], [-0.52, 0.36, -0.4], [0, 0.4, -0.62], [0.52, 0.36, -0.4], [0.46, 0.35, -0.05]], 0.03, 30, 6), M('rubber'), null, C3(0x1a1a1a));
    },
    fins(b, c, mono) {
      const sh = new THREE.Shape(); sh.moveTo(-0.16, 0); sh.lineTo(0.16, 0); sh.lineTo(0.3, 0.9); sh.quadraticCurveTo(0.15, 0.82, 0, 0.88); sh.quadraticCurveTo(-0.15, 0.82, -0.3, 0.9); sh.closePath();
      const one = (x, w) => { const g = ext(sh, 0.025, 0.01, 1); g.scale(w, 1, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), xx = p.getX(i); p.setZ(i, p.getZ(i) + xx * xx * 0.6 - y * 0.05); } g.computeVertexNormals(); g.rotateX(-PI / 2); b.add(g, M('plastic'), b.mat4(x, 0.03, 0.3), C3(c)); b.add(softBox(0.3 * w, 0.18, 0.42, 0.7, 6), M('rubber'), b.mat4(x, 0.1, 0.5), C3(0x1c1c1e)); for (const s of [-1, 1]) b.box(0.03, 0.03, 0.7, x + s * 0.2 * w, 0.05, -0.05, M('plastic'), 0, 0, 0, mul(C3(c), 0.7)); };
      if (mono) one(0, 2.2); else { one(-0.22, 1); one(0.22, 1); }
    },
    // an animal hide or leather: irregular outline with the four legs, draped a little
    hide(b, c, mk, fur) { const sh = new THREE.Shape(), n = 48; for (let i = 0; i <= n; i++) { const a = i / n * TAU, leg = [0.6, 2.5, 3.8, 5.7].reduce((s, q) => s + Math.exp(-Math.pow((a - q) * 4, 2)) * 0.25, 0), r = 0.55 * (1 + 0.22 * Math.cos(2 * a) + leg + (G.noise2(Math.cos(a) * 2, Math.sin(a) * 2, 7) - 0.5) * 0.12); const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.75; i ? sh.lineTo(x, y) : sh.moveTo(x, y); }
      const g = ext(sh, 0.025, 0.012, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, p.getZ(i) + Math.sin(x * 4) * 0.05 + Math.cos(y * 5) * 0.04 + (x * x + y * y) * -0.08); } g.computeVertexNormals(); g.rotateX(-PI / 2); vcol(g, speck([1, 1, 1], 5, 3, fur ? 0.2 : 0.08)); b.add(g, mk || M('leather'), b.mat4(0, 0.1, 0), C3(c)); },
    // a pinnate palm frond: arching midrib with drooping leaflets on both sides
    frond(b, c) { const n = 22; const rib = []; for (let i = 0; i <= 10; i++) { const t = i / 10; rib.push([-0.7 + t * 1.4, 0.1 + Math.sin(t * PI) * 0.28, 0]); } b.add(tube(rib, 0.022, 40, 6), M('plain'), null, mul(C3(c), 1.2));
      for (let i = 0; i < n; i++) for (const s of [-1, 1]) { const t = (i + 0.5) / n, x = -0.7 + t * 1.4, y = 0.1 + Math.sin(t * PI) * 0.28, L = 0.22 + Math.sin(t * PI) * 0.28, g = new THREE.PlaneGeometry(L, 0.045, 4, 1), p = g.attributes.position; for (let k = 0; k < p.count; k++) { const u = p.getX(k) / L + 0.5; p.setY(k, p.getY(k) * (1 - u * 0.7) - u * u * 0.14); } g.translate(L / 2, 0, 0); b.add(g, M('leaf'), b.mat4(x, y, 0, -0.3 * s, s * (PI / 2 - 0.55), 0), mul(C3(c), 0.85 + (i % 3) * 0.08)); } },
    // ribbon seaweed / kelp blades
    weed(b, c, n) { const rr = G.rng(41); for (let i = 0; i < (n || 7); i++) { const L = 0.9 + rr() * 0.4, g = new THREE.PlaneGeometry(0.12, L, 1, 12), p = g.attributes.position, ph = rr() * 6; for (let k = 0; k < p.count; k++) { const y = p.getY(k) / L + 0.5; p.setX(k, p.getX(k) * (1 + Math.sin(y * 18 + ph) * 0.3) * (1 - y * 0.5)); p.setZ(k, Math.sin(y * 7 + ph) * 0.05); } g.rotateX(-PI / 2); b.add(g, M('leaf'), b.mat4((rr() - 0.5) * 0.3, 0.02 + i * 0.006, 0, 0, (rr() - 0.5) * 1.2, 0), mul(C3(c), 0.8 + rr() * 0.4)); } },
    // raw or cooked cut of meat or fish: rounded irregular slab, fat/skin layer, grill marks when cooked
    cut(b, c, fat, grill, fillet) { const sh = new THREE.Shape(); if (fillet) { sh.moveTo(-0.55, 0); sh.quadraticCurveTo(-0.3, 0.28, 0.2, 0.22); sh.quadraticCurveTo(0.55, 0.12, 0.62, 0); sh.quadraticCurveTo(0.5, -0.14, 0.2, -0.18); sh.quadraticCurveTo(-0.3, -0.2, -0.55, 0); } else { for (let i = 0; i <= 30; i++) { const a = i / 30 * TAU, r = 0.42 * (1 + 0.18 * Math.cos(a) + 0.08 * Math.sin(3 * a + 1)); const x = Math.cos(a) * r * 1.25, y = Math.sin(a) * r * 0.8; i ? sh.lineTo(x, y) : sh.moveTo(x, y); } }
      const g = ext(sh, fillet ? 0.12 : 0.16, 0.04, 3); g.rotateX(-PI / 2); vcol(g, (v) => { const marb = fillet ? 0.88 + 0.24 * Math.abs(Math.sin(v.x * 26 + Math.sin(v.z * 8) * 1.2)) : 0.85 + 0.3 * G.fbm(v.x * 6, v.z * 6, 3, 3); const gm = grill && v.y > 0.08 && Math.abs(Math.sin((v.x + v.z) * 9)) > 0.86 ? 0.35 : 1; return [marb * gm, marb * gm, marb * gm]; }); b.add(g, M('flesh'), b.mat4(0, 0.13, 0), C3(c));
      if (fat) { const g2 = ext(sh, 0.05, 0.02, 2); g2.rotateX(-PI / 2); b.add(g2, M('flesh'), b.mat4(0, 0.03, 0, 0, 0, 0, 1.02, 1, 1.02), C3(fat)); } },
    // a skewer of chunks over a stick
    skewer(b, c, c2) { b.cyl(0.022, 0.022, 1.5, 0, 0.3, 0, M('wood'), 8, 0, 0.3, PI / 2, C3(0xb08a5a)); for (let i = 0; i < 5; i++) b.add(G.geo.blob(60 + i, 9, 0.25, 0.85), M('flesh'), b.mat4((-0.5 + i * 0.25) * Math.cos(0.3), 0.3, (0.5 - i * 0.25) * Math.sin(0.3), 0, i, 0, 0.14), C3(i % 2 && c2 ? c2 : c)); },
  };
  ICON.K = K; ICON.M = M; ICON.C3 = C3;

  // ---------- per-item models ----------
  const f = (fn) => ['fn', fn];
  const dish = (liq, bits, o) => { const t = f((b) => K.bowl(b, liq, bits, o)); t._dish = [liq, bits, o]; return t; };
  const veg = [0x5a8a3a, 6, 0.06, 'leaf'], herb = [0x3a6a2a, 8, 0.035, 'leaf'], fishc = [0xf0e8dc, 6, 0.08, 'cube'], meat = [0x6a3418, 6, 0.08], potato = [0xe8d090, 5, 0.08, 'cube'], carrot = [0xe07a2a, 4, 0.05, 'cube'], chili = [0xc0281a, 4, 0.03];
  Object.assign(T, {
    // ---- raw materials ----
    vine: f((b) => { K.coil(b, M('bark'), C3(0x5a6a32), 0.035, 0.4, 3); const rr = G.rng(5); for (let i = 0; i < 10; i++) { const a = rr() * TAU, g = new THREE.CircleGeometry(0.09, 8); g.scale(1, 1.6, 1); b.add(g, M('leaf'), b.mat4(Math.cos(a) * 0.4, 0.12 + rr() * 0.1, Math.sin(a) * 0.4, -1.1 + rr() * 0.4, a, 0), C3(0x3a6a22)); } }),
    fiber: f((b) => K.bundle(b, M('plain'), C3(0xc8b47a), 70, 1.2, 0.017, { bend: 0.05, rad: 5 })),
    tinder: f((b) => K.bundle(b, M('matte'), C3(0xa88a52), 80, 0.8, 0.015, { bend: 0.1, rad: 5, tie: 0x6a5030 })),
    coir: f((b) => K.coil(b, M('rope'), C3(0x8a6232), 0.05, 0.4)),
    sinew: f((b) => K.coil(b, M('wax'), C3(0xd8c49a), 0.022, 0.32, 4)),
    wire: f((b) => K.coil(b, M('metal'), C3(0xc87a48), 0.018, 0.36, 6)),
    steel_cable: f((b) => K.coil(b, M('oldMetal'), C3(0xa0a6ac), 0.045, 0.42)),
    hawser: f((b) => K.coil(b, M('rope'), C3(0x8a6a44), 0.085, 0.48, 2.6)),
    fishing_line: f((b) => K.spool(b, C3(0xd8eef2), M('gloss'))), thread: f((b) => K.spool(b, C3(0xe8dcc0))),
    canvas: f((b) => K.clothRoll(b, C3(0xd8ccb0))), tarp: f((b) => K.clothRoll(b, C3(0x2a5aa0), 1.1, 0.26, M('plastic'))), sailcloth: f((b) => K.clothRoll(b, C3(0xf0ead8), 1.2, 0.3)),
    bandage: f((b) => K.clothRoll(b, C3(0xf4f0e6), 0.45, 0.2)), sterile_bandage: f((b) => { K.packet(b, 0xf0f0f0, 0xc02a2a, 0.8); }), sling: f((b) => { const sh = new THREE.Shape(); sh.moveTo(-0.7, 0); sh.lineTo(0.7, 0); sh.lineTo(0, 0.6); sh.closePath(); const g = ext(sh, 0.03, 0.015); g.rotateX(-PI / 2); b.add(g, M('cloth'), b.mat4(0, 0.04, 0.2), C3(0xece4d4)); }),
    bandana: f((b) => { const sh = new THREE.Shape(); sh.moveTo(-0.6, 0); sh.lineTo(0.6, 0); sh.lineTo(0, 0.55); sh.closePath(); const g = ext(sh, 0.03, 0.015); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + Math.sin(p.getX(i) * 6) * 0.03); g.computeVertexNormals(); g.rotateX(-PI / 2); vcol(g, (v) => (Math.floor(v.x * 8) + Math.floor(v.z * 8)) % 2 ? [1, 1, 1] : [0.75, 0.7, 0.7]); b.add(g, M('cloth'), b.mat4(0, 0.04, 0.2), C3(0xa83228)); }),
    treasure_map: f((b) => { const g = new THREE.PlaneGeometry(1.0, 0.8, 16, 4), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, x > 0.3 ? Math.pow((x - 0.3) / 0.2, 2) * 0.06 : Math.sin(x * 5) * 0.02); } g.rotateX(-PI / 2); g.computeVertexNormals(); vcol(g, (v) => { const xm = Math.hypot(v.x + 0.15, v.z - 0.05) < 0.05 ? [1.0, 0.25, 0.2] : null; const isl = G.noise2(v.x * 3, v.z * 3, 2) > 0.58 ? [0.75, 0.7, 0.45] : [0.95, 0.88, 0.68]; return xm || isl; }); b.add(g, M('leaf'), b.mat4(-0.1, 0.03, 0), C3(0xe8d8a8)); b.cyl(0.07, 0.07, 0.82, 0.45, 0.07, 0, M('paper'), 14, PI / 2, 0, 0, C3(0xd8c690)); b.add(new THREE.TorusGeometry(0.075, 0.01, 6, 16), M('rope'), b.mat4(0.45, 0.07, 0.1, 0, PI / 2, 0), C3(0xa0302a)); }),
    palm_leaf: f((b) => K.frond(b, C3(0x4f7a2e))), seaweed: f((b) => K.weed(b, C3(0x4a5a22))),
    bark: f((b) => { for (let i = 0; i < 4; i++) { const g = new THREE.CylinderGeometry(0.22, 0.22, 0.9, 16, 1, true, 0, 2.2); b.add(g, M('bark'), b.mat4((i - 1.5) * 0.18, 0.12 + (i % 2) * 0.06, (i % 2) * 0.1, 0, i * 0.4, PI / 2 + (i - 1.5) * 0.15), C3(0x7a5a40)); } }),
    log: f((b) => { b.cyl(0.24, 0.26, 1.4, 0, 0.26, 0, M('bark'), 18, 0, 0.3, PI / 2, C3(0x8a6a50)); for (const s of [-1, 1]) { const g = new THREE.CircleGeometry(0.245, 24, 0); vcol(g, (v) => { const r = Math.hypot(v.x, v.y); return mul([1, 1, 1], 0.78 + 0.22 * Math.abs(Math.sin(r * 70))); }); b.add(g, M('wood'), b.mat4(s * 0.7 * Math.cos(0.3), 0.26, -s * 0.7 * Math.sin(0.3), 0, s > 0 ? 0.3 + PI / 2 : 0.3 - PI / 2, 0), C3(0xc89a64)); } b.cyl(0.04, 0.05, 0.25, 0.1, 0.5, 0.1, M('bark'), 8, 0.3, 0, 0.5, C3(0x7a5a40)); }),
    beam: f((b) => { b.add(softBox(1.5, 0.26, 0.26, 0.15, 4), M('wood'), b.mat4(0, 0.13, 0, 0, 0.2, 0), C3(0xc0905c)); }),
    treated_plank: f((b) => { b.add(softBox(1.4, 0.07, 0.32, 0.2, 4), M('wood'), b.mat4(0, 0.05, 0, 0, 0.2, 0), C3(0x5a3a22)); b.add(softBox(1.4, 0.07, 0.32, 0.2, 4), M('wood'), b.mat4(0.05, 0.12, 0.05, 0, 0.32, 0), C3(0x5a3a22)); }),
    dowel: f((b) => K.bundle(b, M('wood'), C3(0xc8a070), 7, 1.2, 0.035, { tie: 0x5a3a22 })), bamboo: f((b) => { for (let i = 0; i < 3; i++) { b.cyl(0.07, 0.07, 1.4, 0, 0.07 + i * 0.13, (i - 1) * 0.15, M('gloss'), 14, 0, 0.2, PI / 2, C3(0xa8b860)); for (let k = 0; k < 4; k++) b.add(new THREE.TorusGeometry(0.072, 0.012, 6, 14), M('gloss'), b.mat4((-0.5 + k * 0.33) * Math.cos(0.2), 0.07 + i * 0.13, (i - 1) * 0.15 - (-0.5 + k * 0.33) * Math.sin(0.2), 0, 0.2 + PI / 2, 0), C3(0x8a9a48)); } }),
    bamboo_strip: f((b) => K.bundle(b, M('gloss'), C3(0xd0c080), 9, 1.2, 0.03, { flat: true })), leather_strap: f((b) => K.coil(b, M('leather'), C3(0x6a4024), 0.03, 0.34, 3)),
    wicker: f((b) => { const g = new THREE.BoxGeometry(1.0, 0.05, 0.9, 10, 1, 10); b.add(g, M('straw'), b.mat4(0, 0.04, 0), C3(0xb89a60)); b.add(new THREE.TorusGeometry(0.5, 0.03, 6, 4), M('straw'), b.mat4(0, 0.05, 0, PI / 2, PI / 4, 0, 1.0, 0.9, 1), C3(0x9a7a48)); }),
    palm_mat: f((b) => { const g = new THREE.BoxGeometry(1.0, 0.04, 0.8, 10, 1, 10); b.add(g, M('straw'), b.mat4(0, 0.03, 0.1), C3(0x9aa050)); K.clothRoll(b, C3(0x9aa050), 1.0, 0.16, M('straw')); }),
    sand: f((b) => K.heap(b, C3(0xe0cc98))), salt: f((b) => K.heap(b, C3(0xf4f4f0), { mk: 'gloss', sp: 0.06, gs: 0.03 })), ash: f((b) => K.heap(b, C3(0x8e8c88), { sp: 0.2 })), lime: f((b) => K.heap(b, C3(0xf2f0e8))),
    gunpowder: f((b) => K.heap(b, C3(0x2a2a2c), { mk: 'satin', sp: 0.15 })), saltpeter: f((b) => K.heap(b, C3(0xeeeae0), { mk: 'gloss', gs: 0.035 })), guano: f((b) => K.heap(b, C3(0xd8d0b4), { lumpy: 0.06, sp: 0.25 })),
    charcoal_dust: f((b) => K.heap(b, C3(0x1a1a1c), { sp: 0.1 })), bone_meal: f((b) => K.heap(b, C3(0xeee6d0))), fertilizer: f((b) => K.heap(b, C3(0x4a3a24), { lumpy: 0.06, sp: 0.2 })), concrete_mix: f((b) => K.packet(b, 0x9a9a94, 0x6a6a66)),
    charcoal: f((b) => K.pieces(b, C3(0x1c1c1e), 8, 0.2, 'satin', (i) => { const g = G.geo.blob(500 + i, 7, 0.35, 0.75); g.scale(1.3, 0.8, 1); return g; })),
    coral_fragment: f((b) => { const rr = G.rng(9); for (let i = 0; i < 5; i++) { const a = rr() * TAU; b.cyl(0.05, 0.07, 0.45, Math.cos(a) * 0.25, 0.07, Math.sin(a) * 0.25, M('stone'), 9, 0, a, PI / 2, C3(0xeee0d0)); } }),
    sponge: f((b) => { const g = bump(G.geo.blob(77, 20, 0.2, 0.75), 0.03, 14, 4); vcol(g, (v) => G.fbm(v.x * 12, v.y * 12 + v.z * 12, 8, 2) > 0.62 ? [0.35, 0.3, 0.2] : [1, 1, 1]); b.add(g, M('matte'), b.mat4(0, 0.36, 0, 0, 0, 0, 0.5), C3(0xd8a840)); }),
    resin: f((b) => { const g = bump(G.geo.blob(66, 18, 0.2, 0.6), 0.02, 5, 2); b.add(g, M('gloss'), b.mat4(0, 0.25, 0, 0, 0, 0, 0.45), C3(0xd07a10)); b.add(G.geo.blob(67, 12, 0.2, 0.6), M('gloss'), b.mat4(0.35, 0.12, 0.2, 0, 0, 0, 0.2), C3(0xc06a0c)); }),
    titanium: f((b) => { b.add(ext(rrect(1.1, 0.34, 0.04), 0.4, 0.02), M('metal'), b.mat4(0, 0.2, 0, -PI / 2, 0.2, 0), C3(0xb8c0cc)); b.add(ext(rrect(1.1, 0.34, 0.04), 0.4, 0.02), M('metal'), b.mat4(0.06, 0.62, 0.04, -PI / 2, 0.35, 0), C3(0xaab4c0)); }),
    rubber: f((b) => { for (let i = 0; i < 3; i++) { const g = new THREE.BoxGeometry(0.9, 0.05, 0.65, 12, 1, 10), p = g.attributes.position; for (let k = 0; k < p.count; k++) p.setY(k, p.getY(k) + Math.sin(p.getX(k) * 9 + i) * 0.02 + Math.cos(p.getZ(k) * 7) * 0.015); g.computeVertexNormals(); b.add(g, M('satin'), b.mat4(i * 0.04, 0.04 + i * 0.07, i * 0.03, 0, i * 0.25, 0), C3(0x5a3a1e)); } }),
    plastic: f((b) => { const g = lathe([[0.001, 0], [0.26, 0], [0.28, 0.05], [0.28, 0.6], [0.2, 0.78], [0.1, 0.9], [0.1, 1.05], [0.001, 1.05]], 24); bump(g, 0.06, 4, 9); g.rotateZ(PI / 2); b.add(g, M('plastic'), b.mat4(0.5, 0.28, 0, 0, 0.4, 0), C3(0x5ab0d8)); b.cyl(0.11, 0.11, 0.08, -0.05 * Math.cos(0.4) - 0.55, 0.28, 0.0, M('plastic'), 12, 0, 0.4, PI / 2, C3(0x2a6ab0)); }),
    brick: f((b) => { b.add(ext(rrect(1.0, 0.48, 0.03), 0.32, 0.02), M('stone'), b.mat4(0, 0.16, 0, -PI / 2, 0.2, 0), C3(0xa85438)); b.add(ext(rrect(1.0, 0.48, 0.03), 0.32, 0.02), M('stone'), b.mat4(0.1, 0.5, 0.06, -PI / 2, 0.5, 0), C3(0x9a4a30)); }),
    glass: f((b) => { for (let i = 0; i < 2; i++) { b.box(1.0, 0.035, 0.75, i * 0.06, 0.03 + i * 0.045, i * 0.05, M('glass'), 0.2 + i * 0.15, 0, 0, C3(0xcfeee8)); b.box(1.0, 0.036, 0.012, i * 0.06, 0.03 + i * 0.045, i * 0.05 + 0.37, M('gloss'), 0.2 + i * 0.15, 0, 0, C3(0x6aa89a)); } }),
    soap: f((b) => { b.add(ext(rrect(0.75, 0.45, 0.14), 0.18, 0.06, 4), M('wax'), b.mat4(0, 0.15, 0, -PI / 2, 0, 0), C3(0xece0c4)); b.add(ext(rrect(0.3, 0.12, 0.05), 0.02, 0.01), M('wax'), b.mat4(0, 0.27, 0, -PI / 2, 0, 0), C3(0xd8c8a4)); }),
    battery: f((b) => { b.cyl(0.24, 0.24, 0.8, 0, 0.4, 0, M('satin'), 28, 0, 0, 0, C3(0x1c1c1e)); b.add(new THREE.CylinderGeometry(0.242, 0.242, 0.3, 28, 1, true), M('satin'), b.mat4(0, 0.6, 0), C3(0xd0a020)); b.cyl(0.235, 0.235, 0.03, 0, 0.81, 0, M('metal'), 28, 0, 0, 0, C3(0xc0c4c8)); b.cyl(0.08, 0.08, 0.06, 0, 0.85, 0, M('metal'), 16, 0, 0, 0, C3(0xd0d4d8)); }),
    fuel: f((b) => { b.add(softBox(0.7, 0.9, 0.32, 0.25, 6), M('oldMetal'), b.mat4(0, 0.45, 0), C3(0xa82a1a)); for (const s of [-1, 1]) b.box(0.5, 0.04, 0.02, 0, 0.45, s * 0.17, M('oldMetal'), 0, 0, s * 0.85, C3(0x8a2216)); for (let i = 0; i < 3; i++) b.box(0.05, 0.16, 0.08, -0.15 + i * 0.15, 0.97, 0, M('oldMetal'), 0, 0, 0, C3(0x9a2618)); b.box(0.42, 0.04, 0.08, 0, 1.05, 0, M('oldMetal'), 0, 0, 0, C3(0x9a2618)); b.cyl(0.07, 0.07, 0.18, 0.28, 0.98, 0, M('metal'), 12, 0, 0, -0.5, C3(0x6a6e72)); }),
    aluminium: f((b) => { for (let i = 0; i < 3; i++) { const g = lathe([[0.001, 0], [0.2, 0], [0.22, 0.04], [0.22, 0.5], [0.18, 0.58], [0.001, 0.58]], 24); bump(g, i ? 0.05 : 0.015, 5, i); b.add(g, M('metal'), b.mat4((i - 1) * 0.42, i ? 0.21 : 0, i * 0.1, i ? PI / 2 : 0, i * 0.7, 0), C3(i === 1 ? 0xb02a2a : 0xc8ccd0)); } }),
    keycard: f((b) => { b.add(ext(rrect(1.0, 0.64, 0.06), 0.03, 0.006), M('plastic'), b.mat4(0, 0.03, 0, -PI / 2, 0.2, 0), C3(0x2a3a4a)); b.box(1.0, 0.035, 0.12, 0, 0.04, -0.2, M('gloss'), 0.2, 0, 0, C3(0x101418)); b.box(0.16, 0.035, 0.12, -0.28, 0.045, 0.08, M('metal'), 0.2, 0, 0, C3(0xd8b048)); b.box(0.4, 0.036, 0.04, 0.2, 0.045, 0.15, M('plain'), 0.2, 0, 0, C3(0x40c0e0)); }),
    hide: f((b) => K.hide(b, C3(0x7a5434), M('cloth'), true)), leather: f((b) => K.hide(b, C3(0x7a4a28))), shark_skin: f((b) => K.hide(b, C3(0x6a7078), M('leather'))),
    fish_net: f((b) => { const g = new THREE.PlaneGeometry(1.2, 0.9, 24, 18), p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 5) * 0.07 + Math.cos(p.getY(i) * 6) * 0.05); g.rotateX(-PI / 2); const w = new THREE.WireframeGeometry(g); const pos = w.attributes.position; for (let i = 0; i < pos.count; i += 2) b.beam(pos.getX(i), pos.getY(i) + 0.1, pos.getZ(i), pos.getX(i + 1), pos.getY(i + 1) + 0.1, pos.getZ(i + 1), 0.006, M('rope'), 4); for (let i = 0; i < 6; i++) b.sph(0.05, -0.6 + i * 0.24, 0.1, 0.45, M('gloss'), 1, 0.8, 1, C3(0xe8c040), 10); }),
    // ---- food ----
    mango: f((b) => { const g = G.geo.sph(24); g.scale(0.4, 0.5, 0.34); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.max(0, y) * 0.12 - y * y * 0.15); } g.computeVertexNormals(); vcol(g, (v) => { const t = G.sstep(-0.3, 0.45, v.y + v.x * 0.6); return [0.5 + t * 0.45, 0.62 - t * 0.18 + (1 - t) * 0.1, 0.16 - t * 0.06]; }); b.add(g, M('satin'), b.mat4(0, 0.42, 0, 0, 0, -0.5), C3(0xffffff)); b.cyl(0.02, 0.025, 0.12, 0.1, 0.92, 0, M('bark'), 8, 0, 0, -0.5, C3(0x4a3a24)); const lf = new THREE.CircleGeometry(0.1, 10); lf.scale(1, 3, 1); b.add(lf, M('leaf'), b.mat4(0.25, 0.95, 0.05, -0.3, 0, -1.0), C3(0x2a5a1a)); }),
    potato: f((b) => { for (let i = 0; i < 2; i++) { const g = bump(G.geo.blob(300 + i, 16, 0.12, 0.75), 0.015, 3, i); vcol(g, (v) => G.fbm(v.x * 9, v.y * 9 + v.z * 9, 4 + i, 2) > 0.72 ? [0.55, 0.45, 0.35] : [1, 1, 1]); b.add(g, M('matte'), b.mat4(i * 0.5 - 0.2, 0.22, i * 0.2, 0, i * 1.3, 0.2, 0.32, 0.26, 0.24), C3(0xb89060)); } }),
    baked_potato: f((b) => { for (const s of [-1, 1]) { const g = G.geo.sph(18); g.scale(0.38, 0.26, 0.28); b.add(g, M('matte'), b.mat4(s * 0.2, 0.2, 0, 0, 0, s * 0.5), C3(0x5a3418)); const c = new THREE.CircleGeometry(0.27, 18); c.scale(1.3, 1, 1); b.add(bump(c, 0.0, 1, 1), M('matte'), b.mat4(s * 0.13, 0.28, 0, -PI / 2 + s * 0.0, 0, -s * 1.05), C3(0xf0dca0)); } b.box(0.12, 0.08, 0.1, 0, 0.42, 0, M('wax'), 0.3, 0, 0, C3(0xf0d060)); }),
    berries: f((b) => { const lf = new THREE.CircleGeometry(0.4, 12); lf.scale(1, 1.6, 1); b.add(lf, M('leaf'), b.mat4(0, 0.02, 0, -PI / 2, 0.6, 0), C3(0x2a5a1a)); K.pieces(b, C3(0x3a2a6a), 16, 0.09, 'gloss', () => G.geo.sph(14)); }),
    coconut_meat: f((b) => { for (let i = 0; i < 4; i++) { const g = new THREE.SphereGeometry(0.4, 14, 6, i * 0.8, 0.7, 0, 0.5); b.add(g, M('satin'), b.mat4((i - 1.5) * 0.2, 0.05, (i % 2) * 0.15, PI, i, 0), C3(0xf4f0e6)); } }),
    coconut_shell: f((b) => K.bowl(b, null, [], { shell: true })), roast_coconut: f((b) => K.pieces(b, C3(0xc89058), 7, 0.16, 'satin', (i) => { const g = G.geo.blob(520 + i, 8, 0.25, 0.5); g.scale(1.3, 1, 1); return g; })),
    coconut_water: dish(0xe8f0ec, [], { shell: true }), coconut_milk: dish(0xf8f6f0, [], { shell: true, thick: true }),
    raw_meat: f((b) => K.cut(b, C3(0xa82a28), C3(0xf0e0d0))), cooked_meat: f((b) => K.cut(b, C3(0x7a3a1a), C3(0xb07a40), true)), raw_shark: f((b) => K.cut(b, C3(0xe8c8c0), C3(0x6a7078))), shark_steak: f((b) => K.cut(b, C3(0xa06a3a), C3(0x5a4a40), true)),
    raw_fillet: f((b) => K.cut(b, C3(0xf08a70), C3(0x8a9098), false, true)), cooked_fillet: f((b) => K.cut(b, C3(0xd8a070), C3(0x6a5040), true, true)), smoked_meat: f((b) => K.cut(b, C3(0x5a2a14), null, false)),
    jerky: f((b) => K.bundle(b, M('flesh'), C3(0x5a2618), 6, 0.9, 0.05, { flat: true, noTie: true, seed: 3 })), shark_jerky: f((b) => K.bundle(b, M('flesh'), C3(0x4a3022), 6, 0.9, 0.05, { flat: true, noTie: true, seed: 4 })), dried_mango: f((b) => K.bundle(b, M('flesh'), C3(0xe8902a), 7, 0.7, 0.05, { flat: true, noTie: true, seed: 5 })),
    sausage: f((b) => { const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([-0.6 + t * 1.2, 0.13, Math.sin(t * PI * 1.5) * 0.3]); } b.add(tube(pts, 0.12, 40, 12), M('satin'), null, C3(0x8a3a1c)); for (let i = 1; i < 3; i++) { const q = pts[i * 4]; b.add(new THREE.TorusGeometry(0.1, 0.02, 6, 12), M('rope'), b.mat4(q[0], q[1], q[2], 0, PI / 2 + 0.3, 0), C3(0xd8c8a0)); } }),
    hardtack: f((b) => { for (let i = 0; i < 3; i++) { b.add(ext(rrect(0.62, 0.62, 0.08), 0.1, 0.03), M('matte'), b.mat4(i * 0.03, 0.07 + i * 0.14, i * 0.02, -PI / 2, 0.3 + i * 0.25, 0), C3(0xd8b880)); } for (let k = 0; k < 9; k++) b.cyl(0.02, 0.02, 0.02, ((k % 3) - 1) * 0.17, 0.35, (Math.floor(k / 3) - 1) * 0.17, M('matte'), 6, 0, 0, 0, C3(0x8a6a3a)); }),
    wrap: f((b) => { b.add(softBox(0.8, 0.3, 0.42, 0.75, 8), M('leaf'), b.mat4(0, 0.16, 0), C3(0x3a6a28)); for (const s of [-1, 1]) b.add(new THREE.TorusGeometry(0.22, 0.012, 6, 20), M('rope'), b.mat4(s * 0.2, 0.16, 0, 0, PI / 2, 0, 1, 0.7, 1), C3(0x9a7a4a)); }),
    survival_bar: f((b) => { b.add(softBox(1.0, 0.16, 0.36, 0.5, 6), M('gloss'), b.mat4(0, 0.09, 0, 0, 0.2, 0), C3(0x8a3a2a)); for (const s of [-1, 1]) b.box(0.08, 0.1, 0.38, s * 0.52 * Math.cos(0.2), 0.09, -s * 0.52 * Math.sin(0.2), M('gloss'), 0.2, 0, 0, C3(0x6a2a1e)); b.box(0.5, 0.17, 0.2, 0, 0.1, 0, M('paper'), 0.2, 0, 0, C3(0xe8d8a0)); }),
    ration: f((b) => K.tin(b, 0x5a6a32, 0xe8d8a0)), bait: f((b) => K.jar(b, 0x5a3a2a, 'cloth', 0.6, 'matte')), glue: f((b) => K.jar(b, 0xd08a20, 'wood', 0.8, 'gloss')), tar: f((b) => K.jar(b, 0x141010, 'wood', 0.8, 'gloss')), epoxy: f((b) => K.jar(b, 0x3a8ab0, 'wood', 0.6, 'gloss')),
    coconut_oil: f((b) => K.jar(b, 0xf0e8c8, 'cloth', 0.8, 'wax')), berry_jam: f((b) => K.jar(b, 0x6a1030, 'cloth', 0.85, 'gloss')), pickled_fish: f((b) => { K.jar(b, 0xe0d8a8, 'wood', 0.85, 'glass'); K.pieces(b, C3(0xd8d0c0), 5, 0.1, 'flesh'); }), glass_jar: f((b) => K.jar(b, null, 'wood')),
    salve: f((b) => K.jar(b, 0x8ac080, 'wood', 0.7, 'wax')), burn_cream: f((b) => K.jar(b, 0xd8eccc, 'wood', 0.7, 'wax')), poultice: f((b) => K.jar(b, 0x4a6a2a, 'cloth', 0.7, 'matte')), aloe_gel: f((b) => K.jar(b, 0x9ad08a, 'wood', 0.8, 'gloss')),
    clay_pot: f((b) => { b.add(lathe([[0.001, 0], [0.25, 0], [0.4, 0.2], [0.42, 0.45], [0.3, 0.7], [0.24, 0.78], [0.27, 0.84], [0.22, 0.85], [0.18, 0.75], [0.001, 0.72]], 32), M('stone'), null, C3(0xa8583a)); b.add(new THREE.TorusGeometry(0.41, 0.012, 6, 32), M('stone'), b.mat4(0, 0.4, 0, PI / 2, 0, 0), C3(0x6a3020)); }),
    bottle: f((b) => K.bottle(b, null)), bottle_sea: f((b) => K.bottle(b, 0x2a7a9a, 0xd8eef0, 0.75)), bottle_fresh: f((b) => K.bottle(b, 0xcfeaf8, 0xd8eef0, 0.8)),
    fruit_juice: f((b) => K.bottle(b, 0xf0a030, null, 0.8)), smoothie: f((b) => K.bottle(b, 0xe86a5a, null, 0.85)), aloe_juice: f((b) => K.bottle(b, 0xb8e0a0, null, 0.8)), fish_oil: f((b) => K.bottle(b, 0xd8a840, 0xa8c8a0, 0.7)), shark_oil: f((b) => K.bottle(b, 0xb07820, 0xa8c8a0, 0.7)),
    antidote: f((b) => K.bottle(b, 0x7a2aa0, 0x5a3a2a, 0.7)), antiseptic: f((b) => K.bottle(b, 0xd8c060, null, 0.6)), tonic: f((b) => K.bottle(b, 0xd0603a, 0x6a4a2a, 0.75)), sting_relief: f((b) => K.bottle(b, 0xb0e0e8, null, 0.6)),
    fish_soup: dish(0xd8c090, [fishc, herb], { spoon: true }), stew: dish(0x7a4024, [meat, potato, carrot], { thick: true }), fruit_salad: dish(null, [[0xf0a030, 8, 0.08, 'cube'], [0xe8d070, 6, 0.08, 'cube'], [0x6a2a6a, 6, 0.05], [0xd83a2a, 4, 0.06, 'cube']], { fill: 0.28, mound: 0.35 }), curry: dish(0xd8a028, [meat, potato, herb], { thick: true }),
    herbal_tea: dish(0x8a7a30, [herb]), steamed_clam: dish(0xe8dcb4, [[0x3a2a2a, 6, 0.1, 'ring'], herb]), mash: dish(0xf0e0b0, [herb], { thick: true, fill: 0.34 }), chowder: dish(0xf0e8d6, [fishc, potato, herb], { thick: true }),
    herbal_broth: dish(0x9a8a40, [herb, veg]), seaweed_salad: dish(null, [[0x2a6a2a, 18, 0.08, 'leaf'], [0x9a7a2a, 10, 0.012]], { fill: 0.28, mound: 0.4 }), fin_soup: dish(0xc8a868, [[0xe8e0c8, 8, 0.05, 'cube'], herb]),
    bouillabaisse: dish(0xd0702e, [fishc, [0xc8402a, 3, 0.1, 'ring'], herb]), ceviche: dish(null, [fishc, fishc, [0xd83a2a, 5, 0.04], [0x5a9a3a, 6, 0.04, 'leaf']], { fill: 0.28, mound: 0.3 }), crab_soup: dish(0xe08a5a, [[0xd04020, 5, 0.08], herb]),
    potato_soup: dish(0xe8d8a8, [potato, herb], { thick: true }), mushroom_soup: dish(0x9a7a5a, [[0x7a5a3a, 6, 0.08], herb], { thick: true }), kelp_noodles: dish(0xa89060, [[0x3a5a22, 10, 0.07, 'ring'], herb]),
    fish_stock: dish(0xe0d0a0, [herb]), coconut_curry: dish(0xe8b040, [fishc, herb, chili], { thick: true }), fever_tea: dish(0x8a5a2a, [herb]),
    fish_skewer: f((b) => K.skewer(b, C3(0xc08048))), boar_skewer: f((b) => K.skewer(b, C3(0x7a3a1a), C3(0xd8a040))), grilled_mushroom: f((b) => K.skewer(b, C3(0x7a5a3a))), grilled_pineapple: f((b) => K.skewer(b, C3(0xe0a828))),
    banana_chips: f((b) => K.pieces(b, C3(0xe8d080), 12, 0.13, 'matte', () => { const g = new THREE.CylinderGeometry(1, 1, 0.18, 14); return g; })), kelp_crisps: f((b) => K.pieces(b, C3(0x2a3a1a), 12, 0.13, 'satin', () => { const g = new THREE.CircleGeometry(1, 9); g.rotateX(-PI / 2); return bump(g, 0.0, 1, 1); })),
    banana_fritter: f((b) => K.pieces(b, C3(0xc8882e), 5, 0.2, 'satin')), potato_chips: f((b) => K.pieces(b, C3(0xe8c060), 12, 0.14, 'satin', () => { const g = new THREE.SphereGeometry(1, 12, 4, 0, TAU, 0, 0.6); return g; })),
    kit_rowboat: f((b) => { b.add(softBox(1.2, 0.5, 0.7, 0.15, 4), M('wood'), b.mat4(0, 0.25, 0), C3(0xa07a4c)); for (const s of [-1, 1]) b.box(1.22, 0.06, 0.72, 0, 0.25 + s * 0.15, 0, M('rope'), 0, 0, 0, C3(0x8a6a44)); }),
  });
  T.kit_sailboat = T.kit_rowboat; T.kit_skiff = f((b) => { b.add(softBox(1.2, 0.5, 0.7, 0.15, 4), M('oldMetal'), b.mat4(0, 0.25, 0), C3(0x6a7078)); b.box(1.22, 0.06, 0.72, 0, 0.3, 0, M('plain'), 0, 0, 0, C3(0xc0302a)); });

  // ---- medicine, seeds, kits ----
  Object.assign(T, {
    medkit: f((b) => K.kase(b, 0xc0302a, true)), trauma_kit: f((b) => K.kase(b, 0xc8402a, true)), suture_kit: f((b) => K.kase(b, 0x2a6a8a, true)), repair_kit: f((b) => K.kase(b, 0x8a6a2a)), repair_kit_pro: f((b) => K.kase(b, 0x2a2a2a)),
    rehydration: f((b) => K.packet(b, 0xe8e8e8, 0x40a0d0)), seeds_potato: f((b) => K.packet(b, 0xc8a060, 0x8a6a40)), seeds_pineapple: f((b) => K.packet(b, 0xd8b050, 0xe0a020)), seeds_aloe: f((b) => K.packet(b, 0x9ab07a, 0x4a8a3a)), seeds_flax: f((b) => K.packet(b, 0x8a9ac8, 0x4a5ab0)),
    charcoal_tablet: f((b) => K.pieces(b, C3(0x222224), 8, 0.12, 'matte', () => new THREE.CylinderGeometry(1, 1, 0.45, 18))),
    antibiotics: f((b) => { b.add(lathe([[0.001, 0], [0.22, 0], [0.24, 0.05], [0.24, 0.6], [0.001, 0.6]], 24), M('plastic'), null, C3(0xd88a2a)); b.cyl(0.25, 0.25, 0.16, 0, 0.66, 0, M('plastic'), 24, 0, 0, 0, [0.95, 0.95, 0.95]); b.add(new THREE.CylinderGeometry(0.242, 0.242, 0.3, 24, 1, true), M('paper'), b.mat4(0, 0.3, 0), [0.95, 0.95, 0.92]); K.pieces(b, [0.95, 0.95, 0.95], 4, 0.07, 'gloss', () => { const g = G.geo.sph(12); g.scale(1.6, 0.7, 0.7); return g; }); }),
    splint: f((b) => K.bundle(b, M('wood'), C3(0xc8a070), 3, 1.1, 0.06, { flat: true, tie: 0xe8e0d0 })), bamboo_splint: f((b) => K.bundle(b, M('gloss'), C3(0xc8b878), 3, 1.1, 0.06, { flat: true, tie: 0xe8e0d0 })),
    tourniquet: f((b) => { K.coil(b, M('cloth'), C3(0xc8402a), 0.03, 0.3, 2.5); b.cyl(0.03, 0.03, 0.7, 0, 0.12, 0, M('wood'), 8, 0, 0.5, PI / 2, C3(0xb08a5a)); }),
  });
  // ---- clothing and gear ----
  Object.assign(T, {
    shirt: f((b) => K.garment(b, 'shirt', 0xe4dcc4)), raincoat: f((b) => K.garment(b, 'coat', 0xd8a020, M('plastic'))), poncho: f((b) => K.garment(b, 'coat', 0x2a5aa0, M('plastic'))), leather_vest: f((b) => K.garment(b, 'vest', 0x6a4024, M('leather'))),
    shark_armor: f((b) => { K.garment(b, 'vest', 0x6a7078, M('leather')); const rr = G.rng(3); for (let i = 0; i < 14; i++) b.add(new THREE.ConeGeometry(0.03, 0.09, 4), M('gloss'), b.mat4(-0.3 + (i % 7) * 0.1, 0.12, -0.2 + Math.floor(i / 7) * 0.35, -PI / 2, rr(), 0), C3(0xf0ead8)); }),
    wetsuit: f((b) => K.garment(b, 'suit', 0x1c2228, M('rubber'))), thermal_suit: f((b) => K.garment(b, 'suit', 0x2a4a7a, M('rubber'))), scrap_armor: f((b) => { K.garment(b, 'vest', 0x6a6e72, M('oldMetal')); }), oilskin: f((b) => K.garment(b, 'coat', 0x8a7a3a, M('satin'))),
    sun_hat: f((b) => K.hat(b, 0xd8b870)), straw_hat: f((b) => K.hat(b, 0xe0c878)), leather_hat: f((b) => K.hat(b, 0x6a4024, M('leather'), true)),
    boots: f((b) => K.boots(b, 0x5a3820)), steel_boots: f((b) => K.boots(b, 0x7a7e82, false, M('oldMetal'))), reef_shoes: f((b) => K.boots(b, 0x2a6a8a, true, M('rubber'))),
    sandals: f((b) => { for (const s of [-1, 1]) { const sh = new THREE.Shape(); sh.moveTo(-0.3, -0.12); sh.quadraticCurveTo(0.5, -0.16, 0.5, 0); sh.quadraticCurveTo(0.5, 0.16, -0.3, 0.12); sh.quadraticCurveTo(-0.36, 0, -0.3, -0.12); const g = ext(sh, 0.05, 0.015); g.rotateX(-PI / 2); b.add(g, M('leather'), b.mat4(0, 0.04, s * 0.2), C3(0x9a7048)); b.add(new THREE.TorusGeometry(0.11, 0.02, 6, 12, PI), M('leather'), b.mat4(0.15, 0.07, s * 0.2, 0, PI / 2, 0), C3(0x5a3a22)); b.add(new THREE.TorusGeometry(0.1, 0.02, 6, 12, PI), M('leather'), b.mat4(-0.15, 0.07, s * 0.2, 0, PI / 2, 0), C3(0x5a3a22)); } }),
    backpack: f((b) => K.bag(b, 0x5a6a4a)), satchel: f((b) => K.bag(b, 0x9a7a50, 'satchel', M('leather'))), dive_pack: f((b) => K.bag(b, 0x1a4a6a, null, M('rubber'))), duffel: f((b) => K.bag(b, 0x6a6a3a, 'duffel')),
    basket: f((b) => { b.add(lathe([[0.001, 0], [0.4, 0], [0.55, 0.45], [0.58, 0.5], [0.54, 0.5], [0.51, 0.45], [0.37, 0.05], [0.001, 0.05]], 32), M('straw'), null, C3(0xb08a50)); b.add(new THREE.TorusGeometry(0.4, 0.025, 6, 24, PI), M('straw'), b.mat4(0, 0.5, 0), C3(0x8a6a38)); }),
    dive_mask: f((b) => K.mask(b, 0x1e2a33)), scuba_mask: f((b) => K.mask(b, 0x141414)), goggles: f((b) => K.mask(b, 0x2a4a8a, true)),
    fins: f((b) => K.fins(b, 0x1a6aa0)), monofin: f((b) => K.fins(b, 0x1a5a9a, true)),
  });
  // ---- scanned models (Poly Haven, CC0) ----
  // a scanned model scaled to `size` (longest side); falls back to the modelled version if the scan is missing
  const scan = (name, size, extra, fallback) => f((b) => { if (G.assets.addTo(b, name, { size: size || 1 })) { if (extra) extra(b); } else if (fallback) fallback(b); else K.pieces(b, [0.6, 0.6, 0.6], 3, 0.2); });
  const geoBox = (name, size) => { const gs = G.assets.geos(name, { size }); if (!gs) return null; const bx = new THREE.Box3(); for (const k in gs) { gs[k].computeBoundingBox(); bx.union(gs[k].boundingBox); } return bx; };
  // a dish served in the scanned wooden bowl (with the modelled bowl as a fallback)
  const bowlDish = (liq, bits, o) => f((b) => { o = o || {}; const bx = G.assets.models.bowl && geoBox('bowl', 1.25); if (!bx) return K.bowl(b, liq, bits, o); G.assets.addTo(b, 'bowl', { size: 1.25 }); const H = bx.max.y, R = Math.min(bx.max.x - bx.min.x, bx.max.z - bx.min.z) / 2; K.contents(b, liq, bits, o, H * (o.fill ? o.fill / 0.31 * 0.62 : 0.62), R * 0.8, R * 0.62); if (o.spoon && G.assets.models.spoon) G.assets.addTo(b, 'spoon', { size: 1.0 }, R * 0.35, H * 0.75, 0.1, 0.35, 0.6, 0); });
  for (const id of Object.keys(T)) { const t = T[id]; if (t && t._dish) T[id] = bowlDish(...t._dish); }
  Object.assign(T, {
    banana: scan('bananas', 1.1), potato: scan('sweet_potato', 1.0), ration: scan('food_cans', 1.0, null, (b) => K.tin(b, 0x5a6a32, 0xe8d8a0)), clay_pot: scan('clay_pot', 1.0),
    basket: scan('basket', 1.1), bandage: scan('medical_tape', 0.8), sterile_bandage: scan('medical_tape', 0.8, (b) => K.packet(b, 0xf0f0f0, 0xc02a2a, 0.5)), medkit: scan('medical_box', 1.0), trauma_kit: scan('medical_box', 1.0),
    repair_kit: scan('toolbox', 1.1), repair_kit_pro: scan('tool_chest', 1.1), lens: scan('magnifier', 1.1), electronics: scan('circuit_board', 1.1), circuit: scan('circuit_board', 1.1), radio_part: scan('circuit_board', 1.0),
    led: scan('led', 1.0), boots: scan('rubber_boots', 1.1), sun_hat: scan('fishermans_hat', 1.1), rubber: scan('tyre', 1.1), concrete_mix: scan('cement_bag', 1.1), fertilizer: scan('compost_bag', 1.1),
    fuel: scan('jerrycan_metal', 1.1), flashlight: scan('flashlight', 1.1), binoculars: scan('binoculars', 1.0), metal_detector: scan('detector', 1.4),
    hatchet: scan('hatchet', 1.1), hatchet_steel: scan('hatchet', 1.1), machete: scan('machete', 1.2), machete_steel: scan('machete', 1.2), mallet: scan('mallet', 1.0), hammer: scan('hammer', 1.0), shovel: scan('spade', 1.4), shovel_steel: scan('spade', 1.4),
  });
  // which scanned item model each item needs (so an item dropped in the world can load it)
  ICON.SCAN = { banana: 'bananas', potato: 'sweet_potato', ration: 'food_cans', clay_pot: 'clay_pot', basket: 'basket', bandage: 'medical_tape', sterile_bandage: 'medical_tape', repair_kit: 'toolbox', repair_kit_pro: 'tool_chest', lens: 'magnifier', electronics: 'circuit_board', circuit: 'circuit_board', radio_part: 'circuit_board', led: 'led', boots: 'rubber_boots', sun_hat: 'fishermans_hat', rubber: 'tyre', concrete_mix: 'cement_bag', fertilizer: 'compost_bag' };

  // a few world-model fixes: the icon table pointed these at harvest nodes that are whole plants
  T.mushroom = f((b) => { for (let i = 0; i < 3; i++) { const x = (i - 1) * 0.3, s = 1 - Math.abs(i - 1) * 0.25; b.cyl(0.06 * s, 0.08 * s, 0.35 * s, x, 0.17 * s, (i % 2) * 0.15, M('matte'), 12, 0, 0, (i - 1) * 0.2, C3(0xeee4d0)); b.add(lathe([[0.001, 0.2], [0.18, 0.17], [0.26, 0.08], [0.25, 0.02], [0.001, 0.05]], 24), M('satin'), b.mat4(x + (i - 1) * 0.07, 0.3 * s, (i % 2) * 0.15, 0, 0, (i - 1) * 0.2, s, s, s), C3(0x8a5a32)); } });

  // ---------- items lying in the world ----------
  // the same models at a believable real size: longest side in metres, by item or by category
  const REAL = { log: 1.4, beam: 1.4, treated_plank: 1.3, plank: 1.2, stick: 0.8, bamboo: 1.2, bamboo_strip: 0.9, dowel: 0.8, palm_leaf: 1.4, seaweed: 0.6, hide: 0.9, leather: 0.6, shark_skin: 0.8, tarp: 0.7, canvas: 0.6, sailcloth: 0.7, fish_net: 0.9,
    backpack: 0.5, duffel: 0.7, dive_pack: 0.5, tank_small: 0.55, tank_large: 0.7, tank_titanium: 0.65, rebreather: 0.5, fins: 0.6, monofin: 0.7, kit_rowboat: 0.9, kit_sailboat: 0.9, kit_skiff: 0.9, coconut: 0.22, pearl: 0.03, berries: 0.15,
    hawser: 0.6, rope: 0.45, vine: 0.5, wire: 0.25, sinew: 0.2, thread: 0.08, fishing_line: 0.08, bandage: 0.12, nails: 0.1, bolts: 0.1, rivets: 0.08, shark_tooth: 0.06, crystal: 0.12, gem: 0.08, keycard: 0.09, battery: 0.07, led: 0.05, fuse: 0.06,
    medkit: 0.42, trauma_kit: 0.42, suture_kit: 0.3, repair_kit: 0.45, repair_kit_pro: 0.5, fuel: 0.45, boots: 0.32, steel_boots: 0.32, basket: 0.4, clay_pot: 0.32, rubber: 0.6, concrete_mix: 0.55, fertilizer: 0.5, banana: 0.22, potato: 0.14 };
  const CAT = { food: 0.22, med: 0.16, gear: 0.4, tool: 0.5, material: 0.3 };
  const cache = {};
  // onReady(model) is called later when the item's scanned model first has to be fetched
  ICON.worldModel = function (id, onReady) {
    const need = ICON.SCAN && ICON.SCAN[id];
    if (need && !cache[id] && !G.assets.models[need]) { G.assets.loadItem(need).then(() => { const m = ICON.worldModel(id); if (m && onReady) onReady(m); }); return null; }
    if (!cache[id]) {
      const d = G.ITEMS[id]; let made = null; try { made = ICON.build(id); } catch (e) { made = null; } if (!made) return null;
      const obj = made.isObject3D ? made : made.build({ shadow: true }); const box = new THREE.Box3().setFromObject(obj), sz = box.getSize(new THREE.Vector3());
      const real = REAL[id] || (d && d.tool ? 0.75 : CAT[d && d.c] || 0.3), k = real / Math.max(sz.x, sz.y, sz.z, 1e-3);
      const inner = new THREE.Group(); inner.add(obj); obj.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2); inner.scale.setScalar(k);
      const outer = new THREE.Group(); outer.add(inner); inner.position.y = -0.13; outer.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); cache[id] = outer;
    }
    const c = cache[id].clone(); c.rotation.y = Math.random() * TAU; return c;
  };
})();
