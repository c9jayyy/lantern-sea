'use strict';
/* Procedural geometry: model builder (merges parts per material) + vegetation / rock / pickup geometries. */
(function () {
  const G = window.G;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Matrix3(), _v = new THREE.Vector3();

  class MB {
    constructor() { this.parts = {}; }
    part(k) { return this.parts[k] || (this.parts[k] = { pos: [], nor: [], uv: [], col: [], idx: [], n: 0 }); }
    add(geo, mat, matrix, color) {
      const P = this.part(mat), gp = geo.attributes.position, gn = geo.attributes.normal, gu = geo.attributes.uv, gc = geo.attributes.color;
      if (matrix) _n.getNormalMatrix(matrix);
      const base = P.n;
      for (let i = 0; i < gp.count; i++) {
        _v.fromBufferAttribute(gp, i); if (matrix) _v.applyMatrix4(matrix); P.pos.push(_v.x, _v.y, _v.z);
        if (gn) { _v.fromBufferAttribute(gn, i); if (matrix) _v.applyMatrix3(_n).normalize(); P.nor.push(_v.x, _v.y, _v.z); } else P.nor.push(0, 1, 0);
        if (gu) P.uv.push(gu.getX(i), gu.getY(i)); else P.uv.push(0, 0);
        if (gc) P.col.push(gc.getX(i) * (color ? color[0] : 1), gc.getY(i) * (color ? color[1] : 1), gc.getZ(i) * (color ? color[2] : 1));
        else if (color) P.col.push(color[0], color[1], color[2]); else P.col.push(1, 1, 1);
      }
      if (geo.index) { const ix = geo.index; for (let i = 0; i < ix.count; i++) P.idx.push(base + ix.getX(i)); }
      else for (let i = 0; i < gp.count; i++) P.idx.push(base + i);
      P.n += gp.count; return this;
    }
    mat4(x, y, z, rx, ry, rz, sx, sy, sz) { _e.set(rx || 0, ry || 0, rz || 0, 'YXZ'); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx || 1, sy || sx || 1, sz || sx || 1); return _m.compose(_p, _q, _s); }
    box(w, h, d, x, y, z, mat, ry, rx, rz, color) { return this.add(G.geo.box(w, h, d), mat, this.mat4(x, y, z, rx, ry, rz), color); }
    cyl(rt, rb, h, x, y, z, mat, seg, rx, ry, rz, color) { return this.add(G.geo.cyl(rt, rb, h, seg || 8), mat, this.mat4(x, y, z, rx, ry, rz), color); }
    sph(r, x, y, z, mat, sx, sy, sz, color, seg) { return this.add(G.geo.sph(seg || 8), mat, this.mat4(x, y, z, 0, 0, 0, r * (sx || 1), r * (sy || 1), r * (sz || 1)), color); }
    // beam between two points
    beam(ax, ay, az, bx, by, bz, r, mat, seg) {
      const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz);
      const g = G.geo.cyl(r, r, len, seg || 6); _q.setFromUnitVectors(_v.set(0, 1, 0), _p.set(dx / len, dy / len, dz / len));
      _m.compose(_p.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), _q, _s.set(1, 1, 1)); return this.add(g, mat, _m);
    }
    merge(other, matrix) { for (const k in other.parts) { const g = partGeo(other.parts[k]); this.add(g, k, matrix); } return this; }
    geos() { const out = {}; for (const k in this.parts) if (this.parts[k].n) out[k] = partGeo(this.parts[k]); return out; }
    build(opts) {
      opts = opts || {}; const grp = new THREE.Group(); const gs = this.geos();
      for (const k in gs) {
        const mat = opts.override || G.mats[k]; if (!mat) { console.warn('missing material', k); continue; }
        const mesh = new THREE.Mesh(gs[k], mat); mesh.castShadow = opts.shadow !== false; mesh.receiveShadow = true;
        if (mat.transparent) { mesh.layers.set(1); mesh.castShadow = false; }
        grp.add(mesh);
      }
      return grp;
    }
  }
  function partGeo(P) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(P.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(P.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(P.col, 3));
    g.setIndex(P.idx); return g;
  }
  G.MB = MB;
  G.disposeGroup = function (grp) { grp.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); if (grp.parent) grp.parent.remove(grp); };

  // ---- primitive geometries with world-scaled UVs ----
  G.geo = {
    box(w, h, d) {
      const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv; const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1]); }
      return g;
    },
    cyl(rt, rb, h, seg) {
      const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1); const uv = g.attributes.uv; const circ = Math.PI * (rt + rb);
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(circ, 0.3), uv.getY(i) * h);
      return g;
    },
    sph(seg) { return new THREE.SphereGeometry(1, seg, Math.max(4, Math.round(seg * 0.7))); },
    // lumpy sphere: displaced along normal by seeded noise
    blob(seed, seg, amp, squash) {
      const g = new THREE.SphereGeometry(1, seg, Math.max(5, Math.round(seg * 0.7))); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        _v.fromBufferAttribute(p, i); const n = G.fbm(_v.x * 1.3 + 7 + seed * 3.1, _v.y * 1.3 + _v.z * 1.9 + seed, seed, 3);
        const k = 1 + (n - 0.5) * 2 * amp; _v.multiplyScalar(k); _v.y *= (squash || 1); p.setXYZ(i, _v.x, _v.y, _v.z);
      }
      g.computeVertexNormals(); return g;
    }
  };
  function tint(geo, fn) {
    const p = geo.attributes.position; const c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); const col = fn(_v, i); c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2]; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo;
  }
  G.tintGeo = tint;

  // ---- vegetation ----
  function palm(seed) {
    const r = G.rng(seed), H = 7 + r() * 3, bend = 0.9 + r() * 1.9, lean2 = (r() - 0.5) * 0.8, SEG = 22, RAD = 12;
    const tb = new MB(), fb = new MB();
    // trunk: a gently S-curved tube with a flared base and the ring scars of fallen fronds
    const pos = [], uv = [], idx = [], at = (t) => [bend * t * t + lean2 * Math.sin(t * Math.PI) * 0.4, t * H, lean2 * t * t * 0.6];
    for (let s = 0; s <= SEG; s++) {
      const t = s / SEG, [cx, y, cz] = at(t), flare = Math.exp(-t * 18) * 0.22, ring = 0.012 * Math.max(0, Math.sin(y * 13.0)), rad = 0.2 - 0.06 * t + flare + ring;
      for (let a = 0; a <= RAD; a++) { const an = a / RAD * Math.PI * 2; pos.push(cx + Math.cos(an) * rad, y, cz + Math.sin(an) * rad); uv.push(a / RAD * 1.0, y * 0.5); }
    }
    for (let s = 0; s < SEG; s++) for (let a = 0; a < RAD; a++) { const i0 = s * (RAD + 1) + a, i1 = i0 + 1, i2 = i0 + RAD + 1, i3 = i2 + 1; idx.push(i0, i2, i1, i1, i2, i3); }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); tg.setIndex(idx); tg.computeVertexNormals();
    { const col = []; for (let k = 0; k < pos.length; k += 3) { const t = pos[k + 1] / H, base = 0.55 + 0.45 * G.sstep(0.0, 0.22, t), top = G.sstep(0.88, 1.0, t); col.push(base * (1 - top * 0.25), base * (1 - top * 0.12), base * (1 - top * 0.35)); } tg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); }
    tb.add(tg, 'palmTrunk');
    const [tx, ty, tz] = at(1);
    // crown: fibrous boot of old frond bases, then the coconut cluster tucked under the leaves
    tb.sph(0.3, tx, ty - 0.12, tz, 'palmTrunk', 1, 0.75, 1, [0.62, 0.52, 0.38], 9);
    const nc = 5 + Math.floor(r() * 6);
    for (let i = 0; i < nc; i++) { const a = r() * 6.28, d = 0.18 + r() * 0.12; tb.sph(0.12 + r() * 0.03, tx + Math.cos(a) * d, ty - 0.35 - r() * 0.25, tz + Math.sin(a) * d, 'palmTrunk', 1, 1.12, 1, r() < 0.3 ? [0.75, 0.6, 0.25] : [0.42, 0.48, 0.18], 8); }
    // fronds: long arching leaves, folded along the rib, tapering to the tip; a few dead ones hang below
    const NF = 16 + Math.floor(r() * 5);
    for (let i = 0; i < NF; i++) {
      const dead = i >= NF - 3, az = i / NF * Math.PI * 2 * 2.618 + r() * 0.4, len = (dead ? 2.6 : 3.4 + r() * 1.6), FS = 12;
      const e0 = dead ? -0.9 - r() * 0.4 : 1.05 - (i % 4) * 0.34 + r() * 0.15, droop = dead ? 0.3 : 1.5 + r() * 0.9, twist = (r() - 0.5) * 0.6;
      const fp = [], fu = [], fc = [], fi = []; let px = 0, py = 0; const cx = Math.cos(az), cz = Math.sin(az);
      const col = dead ? [0.62, 0.48, 0.28] : [0.92 + r() * 0.1, 1, 0.9 + r() * 0.1];
      for (let s = 0; s <= FS; s++) {
        const t = s / FS, pitch = e0 - t * t * droop;
        if (s > 0) { px += Math.cos(pitch) * len / FS; py += Math.sin(pitch) * len / FS; }
        const w = (dead ? 0.35 : 0.75) * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08)) * (1 - t * 0.35), ca = Math.cos(twist * t), sa = Math.sin(twist * t);
        const sx = -cz * w * ca, sz = cx * w * ca, fold = w * (0.28 + 0.2 * t) + sa * w * 0.3, foldB = w * (0.28 + 0.2 * t) - sa * w * 0.3;
        const bx = tx + cx * px, by = ty + py, bz = tz + cz * px;
        fp.push(bx + sx, by - fold, bz + sz, bx, by, bz, bx - sx, by - foldB, bz - sz); fu.push(t * 0.97, 0, t * 0.97, 0.5, t * 0.97, 1);
        const k = 0.75 + 0.25 * (1 - t); for (let q = 0; q < 3; q++) fc.push(col[0] * k, col[1] * k, col[2] * k);
      }
      for (let s = 0; s < FS; s++) { const a = s * 3; fi.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(fu, 2)); fg.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3)); fg.setIndex(fi); fg.computeVertexNormals();
      fb.add(fg, 'frond');
    }
    return { palmTrunk: tb.geos().palmTrunk, frond: fb.geos().frond, h: H, topX: tx };
  }
  // tapered, smoothly bending limb along a list of points (bark UVs run along the length)
  function limb(b, pts, r0, r1, mat, rs) {
    const curve = new THREE.CatmullRomCurve3(pts), n = Math.max(3, Math.round(curve.getLength() * 2.2)), P = curve.getSpacedPoints(n), pos = [], nor = [], uv = [], idx = [];
    const up = new THREE.Vector3(0, 1, 0), t = new THREE.Vector3(), nx = new THREE.Vector3(), ny = new THREE.Vector3(); let len = 0;
    for (let i = 0; i <= n; i++) {
      if (i < n) t.subVectors(P[i + 1], P[i]); else t.subVectors(P[i], P[i - 1]); if (i > 0) len += P[i].distanceTo(P[i - 1]); t.normalize();
      nx.crossVectors(Math.abs(t.y) > 0.95 ? nx.set(1, 0, 0) : up, t).normalize(); ny.crossVectors(t, nx).normalize();
      const f = i / n, r = (r0 + (r1 - r0) * f) * (1 + (i === 0 ? 0.25 : 0));
      for (let j = 0; j <= rs; j++) { const a = j / rs * 6.2832, c = Math.cos(a), sn = Math.sin(a); const ox = nx.x * c + ny.x * sn, oy = nx.y * c + ny.y * sn, oz = nx.z * c + ny.z * sn; pos.push(P[i].x + ox * r, P[i].y + oy * r, P[i].z + oz * r); nor.push(ox, oy, oz); uv.push(j / rs * Math.max(1, r0 * 9), len / 1.2); }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < rs; j++) { const q = i * (rs + 1) + j, w = q + rs + 1; idx.push(q, w, q + 1, q + 1, w, w + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); b.add(g, mat); return P;
  }
  // a spray of individually modelled leaves around a twig tip; normals point out of the cluster so it shades as a volume
  const LEAF = { almond: [[0, 0], [0.045, 0.07], [0.07, 0.17], [0.05, 0.24], [0, 0.27]], mango: [[0, 0], [0.028, 0.08], [0.035, 0.18], [0.022, 0.3], [0, 0.36]] };
  function leafCluster(L, r, c, rad, flat, n, kind, scale, colFn) {
    const shp = LEAF[kind];
    for (let k = 0; k < n; k++) {
      const u = r() * 6.2832, v = Math.acos(2 * r() - 1), rr = Math.cbrt(r()) * rad, ox = Math.sin(v) * Math.cos(u) * rr, oy = Math.cos(v) * rr * flat, oz = Math.sin(v) * Math.sin(u) * rr;
      const px = c.x + ox, py = c.y + oy, pz = c.z + oz, yaw = Math.atan2(oz, ox) + (r() - 0.5) * 1.2, pitch = 0.25 + r() * 0.6 - (oy < 0 ? 0.4 : 0), s = scale * (0.75 + r() * 0.5);
      const fwd = [Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch)], side = [-Math.sin(yaw), 0, Math.cos(yaw)];
      const ol = Math.hypot(ox, oy + rad * 0.3, oz) || 1, nn = [ox / ol, (oy + rad * 0.3) / ol, oz / ol], col = colFn(r), base = L.pos.length / 3;
      for (let q = 0; q < shp.length; q++) for (const sg of q === 0 || q === shp.length - 1 ? [0] : [-1, 1]) {
        const w = shp[q][0] * sg * s, l = shp[q][1] * s, fold = sg ? 0.012 * s * 4 : 0;
        L.pos.push(px + fwd[0] * l + side[0] * w, py + fwd[1] * l + fold, pz + fwd[2] * l + side[2] * w); L.nor.push(nn[0], nn[1], nn[2]);
        const k2 = 0.7 + 0.3 * (q / (shp.length - 1)); L.col.push(col[0] * k2, col[1] * k2, col[2] * k2);
      }
      // vertices: 0 base, 1..2 pair1(L,R), 3..4 pair2, 5..6 pair3, 7 tip
      const T = [[0, 1, 2], [1, 3, 2], [2, 3, 4], [3, 5, 4], [4, 5, 6], [5, 7, 6]]; for (const t of T) L.idx.push(base + t[0], base + t[1], base + t[2]);
    }
  }
  function leafGeo(L) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(L.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(L.nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(L.col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(L.pos.length / 3 * 2), 2)); g.setIndex(L.idx); return g; }
  // Broadleaf island tree. 'tiers' = sea almond (pagoda layers of near-horizontal branches, leaves crowded at the tips,
  // a few red leaves); 'dome' = mango (dense rounded crown of long narrow leaves).
  function tree(seed, opts) {
    opts = opts || {}; const r = G.rng(seed), H = opts.h || (7 + r() * 5), dome = opts.shape === 'dome', b = new MB(), L = { pos: [], nor: [], col: [], idx: [] }, V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const leafCol = dome ? (rr) => { const k = 0.6 + rr() * 0.5; return rr() < 0.1 ? [0.16 * k, 0.12 * k, 0.05 * k] : [0.02 * k, 0.05 * k, 0.015 * k]; }
      : (rr) => { const k = 0.6 + rr() * 0.55, q = rr(); return q < 0.03 ? [0.2 * k, 0.04 * k, 0.015 * k] : q < 0.08 ? [0.12 * k, 0.1 * k, 0.02 * k] : [0.022 * k, 0.055 * k, 0.014 * k]; };
    const lean = [(r() - 0.5) * 0.08 * H, (r() - 0.5) * 0.08 * H], R0 = 0.05 + H * 0.032, top = dome ? H * 0.42 : H * 0.82;
    const trunk = limb(b, [V3(0, -0.3, 0), V3(lean[0] * 0.2 + (r() - 0.5) * 0.15, top * 0.35, lean[1] * 0.2), V3(lean[0] * 0.6, top * 0.7, lean[1] * 0.6), V3(lean[0], top, lean[1])], R0 * 1.15, R0 * 0.45, 'trunk', 9);
    b.cyl(R0 * 1.3, R0 * 2.1, 0.45, 0, 0.12, 0, 'trunk', 9);   // root flare
    const tip = (pts) => pts[pts.length - 1];
    if (!dome) {
      const tiers = 3 + Math.floor(r() * 2);
      for (let t = 0; t < tiers; t++) {
        const f = t / (tiers - 1), y = H * (0.38 + f * 0.42), nB = 4 + Math.floor(r() * 2), L0 = H * (0.42 - f * 0.24), a0 = r() * 6.28;
        const tp = trunk[Math.min(trunk.length - 1, Math.round(trunk.length * (y / top) * 0.98))] || tip(trunk);
        for (let k = 0; k < nB; k++) {
          const a = a0 + k / nB * 6.28 + (r() - 0.5) * 0.5, ca = Math.cos(a), sa = Math.sin(a), Lb = L0 * (0.8 + r() * 0.4);
          const pts = limb(b, [V3(tp.x, tp.y, tp.z), V3(tp.x + ca * Lb * 0.35, tp.y + Lb * 0.06, tp.z + sa * Lb * 0.35), V3(tp.x + ca * Lb * 0.7, tp.y + Lb * 0.02, tp.z + sa * Lb * 0.7), V3(tp.x + ca * Lb, tp.y + Lb * 0.16, tp.z + sa * Lb)], R0 * (0.5 - f * 0.2), 0.02, 'trunk', 6);
          const e = tip(pts); leafCluster(L, r, e, 0.85 + Lb * 0.2, 0.38, 230, 'almond', 1.15, leafCol);
          for (let s2 = 0; s2 < 2; s2++) { const m = pts[Math.round(pts.length * (0.45 + s2 * 0.2))], b2 = a + (s2 ? 0.7 : -0.7), l2 = Lb * 0.35; const p2 = limb(b, [V3(m.x, m.y, m.z), V3(m.x + Math.cos(b2) * l2 * 0.6, m.y + l2 * 0.05, m.z + Math.sin(b2) * l2 * 0.6), V3(m.x + Math.cos(b2) * l2, m.y + l2 * 0.2, m.z + Math.sin(b2) * l2)], 0.035, 0.012, 'trunk', 5); leafCluster(L, r, tip(p2), 0.68, 0.4, 110, 'almond', 1.1, leafCol); }
        }
      }
      leafCluster(L, r, tip(trunk), 1.2, 0.5, 260, 'almond', 1.15, leafCol);
    } else {
      const nB = 7 + Math.floor(r() * 3), tp = tip(trunk);
      for (let k = 0; k < nB; k++) {
        const a = k / nB * 6.28 + r() * 0.5, ca = Math.cos(a), sa = Math.sin(a), up = 0.7 + r() * 0.5, Lb = H * (0.38 + r() * 0.14);
        const pts = limb(b, [V3(tp.x, tp.y, tp.z), V3(tp.x + ca * Lb * 0.35, tp.y + Lb * up * 0.4, tp.z + sa * Lb * 0.35), V3(tp.x + ca * Lb * 0.7, tp.y + Lb * up * 0.7, tp.z + sa * Lb * 0.7)], R0 * 0.55, 0.03, 'trunk', 6);
        for (let q = 0; q < 3; q++) { const m = pts[Math.round((pts.length - 1) * (0.5 + q * 0.25))]; leafCluster(L, r, V3(m.x + ca * 0.4 * q, m.y + 0.3, m.z + sa * 0.4 * q), 0.9 + q * 0.2, 0.6, 150, 'mango', 1.05, leafCol); }
      }
      leafCluster(L, r, V3(tp.x, tp.y + H * 0.42, tp.z), H * 0.24, 0.55, 330, 'mango', 1.05, leafCol);
    }
    const gs = b.geos(); gs.leaf3d = leafGeo(L); gs.h = H; return gs;
  }
  function bush(seed, col) {
    const r = G.rng(seed), b = new MB();
    for (let i = 0; i < 4; i++) {
      const g = G.geo.blob(seed + i * 7, 7, 0.28, 0.75); const k0 = 0.6 + r() * 0.5;
      tint(g, (v) => { const k = k0 * (0.5 + 0.5 * G.clamp(v.y + 0.7, 0, 1.2)); return [k * col[0], k * col[1], k * col[2]]; });
      const a = r() * 6.28, d = i ? 0.35 + r() * 0.3 : 0; b.add(g, 'canopy', b.mat4(Math.cos(a) * d, 0.45 + r() * 0.25, Math.sin(a) * d, 0, r() * 6, 0, 0.55 + r() * 0.25));
    }
    return b.geos();
  }
  // Grass tussock from real blades: tapered, curved strips rooted in a round footprint, shorter and leaning further out at
  // the rim so the clump has a soft natural outline. Normals lean mostly up (how turf actually catches light).
  function grassClump(seed, o) {
    o = o || {}; const r = G.rng(seed), n = o.n || 70, R = o.r || 0.32, H = o.h || 0.62, pos = [], nor = [], col = [], uv = [], idx = [];
    const rootC = o.root || [0.03, 0.05, 0.015], midC = o.mid || [0.075, 0.11, 0.03], tipC = o.tip || [0.17, 0.21, 0.06], dryT = o.dry || [0.3, 0.26, 0.11];
    for (let b = 0; b < n; b++) {
      const rr = Math.pow(r(), 0.7) * R, a = r() * 6.283, x0 = Math.cos(a) * rr, z0 = Math.sin(a) * rr, edge = rr / R;
      const h = H * (0.5 + r() * 0.55) * (1 - edge * 0.45), w = (o.w || 0.019) * (0.7 + r() * 0.6), dry = r() < (o.dryP == null ? 0.12 : o.dryP), lum = 0.75 + r() * 0.5;
      const la = a + (r() - 0.5) * 1.2, lean = (0.04 + edge * edge * 0.55 + r() * 0.16) * h, dx = Math.cos(la), dz = Math.sin(la), face = la + Math.PI / 2 + (r() - 0.5) * 0.8;
      const fx = Math.cos(face), fz = Math.sin(face), base = pos.length / 3, SEG = 4;
      const nx = dx * 0.35, nz = dz * 0.35, nl = Math.hypot(nx, 1, nz);
      for (let i = 0; i <= SEG; i++) {
        const t = i / SEG, cx = x0 + dx * lean * t * t, cz = z0 + dz * lean * t * t, cy = h * (t - 0.18 * t * t * (lean / h)) - 0.04, ww = w * (1 - t * 0.92);
        pos.push(cx - fx * ww, cy, cz - fz * ww, cx + fx * ww, cy, cz + fz * ww);
        for (let k = 0; k < 2; k++) nor.push(nx / nl, 1 / nl, nz / nl);
        const c = t < 0.4 ? rootC.map((v, j) => v + (midC[j] - v) * (t / 0.4)) : midC.map((v, j) => v + ((dry ? dryT : tipC)[j] - v) * ((t - 0.4) / 0.6));
        for (let k = 0; k < 2; k++) col.push(c[0] * lum, c[1] * lum, c[2] * lum);
        uv.push(0, t, 1, t);
      }
      for (let i = 0; i < SEG; i++) { const q = base + i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return { grassBlade: g };
  }
  G.grassClump = grassClump;
  function cards(mat, n, w, h, seed, colFn) {
    const b = new MB(), r = G.rng(seed);
    for (let i = 0; i < n; i++) {
      const g = new THREE.PlaneGeometry(w, h); g.translate(0, h / 2, 0);
      const c = colFn ? colFn(r) : [1, 1, 1]; tint(g, () => c);
      b.add(g, mat, b.mat4((r() - 0.5) * w * 0.4, 0, (r() - 0.5) * w * 0.4, (r() - 0.5) * 0.3, i / n * Math.PI + r() * 0.4, 0));
    }
    return b.geos();
  }
  function bamboo(seed) {
    const r = G.rng(seed), b = new MB();
    for (let i = 0; i < 7; i++) {
      const a = r() * 6.28, d = r() * 0.5, h = 4 + r() * 3, lean = (r() - 0.5) * 0.18;
      b.cyl(0.035, 0.05, h, Math.cos(a) * d, h / 2, Math.sin(a) * d, 'canopy', 5, lean, 0, lean, [0.75, 1.1, 0.5]);
      const g = new THREE.PlaneGeometry(1.2, 1.2); tint(g, () => [0.9, 1.1, 0.7]);
      b.add(g, 'leafCard', b.mat4(Math.cos(a) * d, h * 0.9, Math.sin(a) * d, 0, r() * 6, 0));
    }
    return b.geos();
  }
  function mangrove(seed) {
    const r = G.rng(seed), b = new MB(), H = 4 + r() * 2;
    for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28 + r() * 0.4, d = 1.0 + r() * 0.8; b.beam(Math.cos(a) * d, -0.8, Math.sin(a) * d, Math.cos(a) * 0.15, 1.3 + r() * 0.5, Math.sin(a) * 0.15, 0.07, 'trunk', 5); }
    b.cyl(0.14, 0.2, H * 0.6, 0, 1.3 + H * 0.3, 0, 'trunk', 6);
    for (let i = 0; i < 4; i++) {
      const g = G.geo.blob(seed + i, 8, 0.25, 0.6); const k0 = 0.6 + r() * 0.4; tint(g, (v) => { const k = k0 * (0.6 + 0.4 * G.clamp(v.y + 0.6, 0, 1)); return [k * 0.7, k * 0.95, k * 0.6]; });
      const a = r() * 6.28, d = i ? 1.2 * r() + 0.4 : 0; b.add(g, 'canopy', b.mat4(Math.cos(a) * d, 1.3 + H * (0.6 + r() * 0.2), Math.sin(a) * d, 0, r() * 6, 0, 1.4 + r() * 0.7));
    }
    return b.geos();
  }
  function rock(seed, col, amp) {
    const g = G.geo.blob(seed, 10, amp || 0.3, 0.72); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < -0.3) p.setY(i, -0.3 - (p.getY(i) + 0.3) * 0.2);
    g.computeVertexNormals(); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 2);
    tint(g, (v) => { const k = 0.7 + G.noise2(v.x * 3 + seed, v.z * 3, seed) * 0.5; return [col[0] * k, col[1] * k, col[2] * k]; });
    return { rockObj: g };
  }
  function oreRock(seed, col, vein) {
    const b = new MB(); b.add(rock(seed, col, 0.3).rockObj, 'rockObj'); const r = G.rng(seed);
    for (let i = 0; i < 7; i++) { const a = r() * 6.28, e = r() * 1.2; const g = G.geo.blob(seed + i, 5, 0.3, 0.8); tint(g, () => vein); b.add(g, 'rockObj', b.mat4(Math.cos(a) * Math.cos(e) * 0.82, Math.sin(e) * 0.55, Math.sin(a) * Math.cos(e) * 0.82, r(), r(), r(), 0.16 + r() * 0.12)); }
    return b.geos();
  }
  function crystalCluster(seed) {
    const b = new MB(), r = G.rng(seed);
    for (let i = 0; i < 6; i++) { const a = r() * 6.28, d = r() * 0.4, h = 0.5 + r() * 0.9; b.cyl(0.0, 0.1 + r() * 0.08, h, Math.cos(a) * d, h / 2, Math.sin(a) * d, 'crystal', 5, (r() - 0.5) * 0.7, 0, (r() - 0.5) * 0.7); }
    return b.geos();
  }
  // branching (staghorn) coral: tapering branches that fork and end in rounded, paler tips
  function coral(seed, col, lite) {
    const b = new MB(), r = G.rng(seed), RS = lite ? 6 : 9, DEP = lite ? 2 : 4, TIP = lite ? 6 : 9;
    const rec = (x, y, z, dx, dy, dz, len, rad, depth) => {
      const ex = x + dx * len, ey = y + dy * len, ez = z + dz * len, L = Math.hypot(ex - x, ey - y, ez - z);
      const g = G.geo.cyl(rad * 0.75, rad, L, RS); _q.setFromUnitVectors(_v.set(0, 1, 0), _p.set(dx, dy, dz).normalize()); _m.compose(_p.set((x + ex) / 2, (y + ey) / 2, (z + ez) / 2), _q, _s.set(1, 1, 1)); b.add(g, 'coral', _m, col);
      if (depth > 0) b.sph(rad * 0.77, ex, ey, ez, 'coral', 1, 1, 1, col, RS);   // rounded fork, no crease where branches meet
      if (depth > 0) { const n = depth > 2 ? 2 : 2 + (r() < 0.4 ? 1 : 0); for (let i = 0; i < n; i++) { let nx = dx + (r() - 0.5) * 1.2, ny = dy + 0.15 + r() * 0.3, nz = dz + (r() - 0.5) * 1.2; const l = Math.hypot(nx, ny, nz); rec(ex, ey, ez, nx / l, ny / l, nz / l, len * (0.7 + r() * 0.15), rad * 0.72, depth - 1); } }
      else b.sph(rad * 0.8, ex, ey, ez, 'coral', 1, 1, 1, [Math.min(2, col[0] * 1.35), Math.min(2, col[1] * 1.35), Math.min(2, col[2] * 1.35)], TIP);
    };
    const nb = 4 + Math.floor(r() * 3); for (let i = 0; i < nb; i++) { const a = r() * 6.28; rec(Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12, Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5, (0.28 + r() * 0.14) * (lite ? 1.35 : 1), lite ? 0.065 : 0.055, DEP); }
    return b.geos();
  }
  // brain coral: a squat, lumpy dome carrying the meandering-groove texture
  function brain(seed, col) {
    const g = new THREE.SphereGeometry(0.5, 18, 9, 0, Math.PI * 2, 0, Math.PI * 0.55), p = g.attributes.position, r = G.rng(seed);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + (G.noise2(x * 3 + seed, z * 3, 3) - 0.5) * 0.25; p.setXYZ(i, x * k, Math.max(0, y - 0.05) * 0.75 * k, z * k); }
    g.computeVertexNormals(); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 1.6);
    tint(g, () => col); return { brain: g };
  }
  // table / plate coral: a short stalk carrying overlapping wavy-edged plates
  function plate(seed, col) {
    const b = new MB(), r = G.rng(seed); b.cyl(0.07, 0.12, 0.35, 0, 0.17, 0, 'coral', 7, 0, 0, 0, col);
    for (let i = 0; i < 3; i++) { const g = new THREE.CylinderGeometry(0.55 - i * 0.12, 0.5 - i * 0.12, 0.05, 24, 1); const p = g.attributes.position; for (let k = 0; k < p.count; k++) { const x = p.getX(k), z = p.getZ(k), a = Math.atan2(z, x); p.setY(k, p.getY(k) + Math.sin(a * 5 + seed) * 0.04 * Math.hypot(x, z) * 2); } g.computeVertexNormals(); b.add(g, 'coral', b.mat4((r() - 0.5) * 0.15, 0.36 + i * 0.07, (r() - 0.5) * 0.15, (r() - 0.5) * 0.15, r() * 6, (r() - 0.5) * 0.15), col); }
    return b.geos();
  }
  // gorgonian sea fan: two or three crossing lattice fans
  function fan(seed, col) { const b = new MB(), r = G.rng(seed); for (let i = 0; i < 2 + (r() < 0.5 ? 1 : 0); i++) { const s = 0.9 + r() * 0.5, g = new THREE.PlaneGeometry(s, s); g.translate(0, s / 2, 0); b.add(g, 'fan', b.mat4((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3, (r() - 0.5) * 0.2, r() * 3.14, 0), col); } return b.geos(); }
  function small(fn) { const b = new MB(); fn(b); return b.geos(); }

  // Geometry sets per node visual key. Each is {materialKey: geometry}
  G.buildNodeGeos = function () {
    const N = G.nodeGeo = {};
    for (let i = 0; i < 3; i++) { N['palm' + i] = palm(100 + i * 17); N['tree' + i] = tree(200 + i * 31); }
    N.deadtree = small((b) => { b.cyl(0.1, 0.3, 4.5, 0, 2.2, 0, 'trunk', 6, 0.1, 0, 0.06); b.beam(0, 2.6, 0, 0.9, 3.8, 0.3, 0.06, 'trunk', 5); b.beam(0, 3.2, 0, -0.7, 4.2, -0.4, 0.05, 'trunk', 5); });
    N.bush = bush(301, [0.8, 1, 0.7]); N.berry = small((b) => { const g = bush(302, [0.75, 0.95, 0.75]).canopy; b.add(g, 'canopy'); const r = G.rng(4); for (let i = 0; i < 14; i++) b.sph(0.05, (r() - 0.5) * 1.3, 0.4 + r() * 0.7, (r() - 0.5) * 1.3, 'canopy', 1, 1, 1, [2.4, 0.2, 0.5], 5); });
    N.fern = cards('leafCard', 3, 1.5, 1.1, 311, (r) => { const k = 0.7 + r() * 0.5; return [k * 0.8, k, k * 0.7]; });
    N.grass = grassClump(312, { n: 120, r: 0.36, h: 0.6 });
    N.flax = grassClump(313, { n: 46, r: 0.22, h: 1.15, w: 0.012, root: [0.04, 0.07, 0.03], mid: [0.12, 0.2, 0.08], tip: [0.3, 0.36, 0.16], dryP: 0.05 });
    N.aloe = small((b) => { for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; b.cyl(0.0, 0.06, 0.55, Math.cos(a) * 0.14, 0.24, Math.sin(a) * 0.14, 'canopy', 4, Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6, [0.6, 1.25, 0.9]); } });
    N.bamboo = bamboo(320); N.mangrove = mangrove(330);
    N.banana = small((b) => { b.cyl(0.08, 0.13, 2.2, 0, 1.1, 0, 'canopy', 6, 0, 0, 0, [0.8, 1, 0.5]); for (let i = 0; i < 6; i++) { const g = new THREE.PlaneGeometry(0.7, 2.0); g.translate(0, 1.0, 0); tint(g, () => [0.75, 1.1, 0.6]); b.add(g, 'canopy', b.mat4(0, 2.0, 0, 0.9 + (i % 2) * 0.3, i / 6 * 6.28, 0)); } b.sph(0.14, 0.15, 1.8, 0, 'canopy', 0.7, 1.6, 0.7, [2.2, 1.9, 0.3], 6); });
    N.mango = small((b) => { const t = tree(340, { h: 6.5, shape: 'dome' }); for (const k in t) if (t[k] && t[k].isBufferGeometry) b.add(t[k], k); const r = G.rng(8); for (let i = 0; i < 9; i++) { const a = r() * 6.28; b.sph(0.11, Math.cos(a) * (0.8 + r()), 3.0 + r() * 0.7, Math.sin(a) * (0.8 + r()), 'canopy', 1, 1.25, 1, [2.4, 1.2, 0.2], 6); } });
    N.pineapple = small((b) => { for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; b.cyl(0.0, 0.05, 0.6, Math.cos(a) * 0.16, 0.2, Math.sin(a) * 0.16, 'canopy', 4, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9, [0.6, 0.95, 0.6]); } b.sph(0.13, 0, 0.42, 0, 'canopy', 1, 1.4, 1, [1.9, 1.3, 0.25], 6); });
    N.potato = small((b) => { for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; const g = new THREE.PlaneGeometry(0.35, 0.5); g.translate(0, 0.25, 0); tint(g, () => [0.6, 1, 0.5]); b.add(g, 'canopy', b.mat4(Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1, 0.5, a, 0)); } });
    N.mushroom = small((b) => { for (let i = 0; i < 3; i++) { const x = (i - 1) * 0.12, h = 0.1 + i * 0.04; b.cyl(0.02, 0.025, h, x, h / 2, i * 0.05, 'canopy', 5, 0, 0, 0, [2.2, 2.0, 1.7]); b.sph(0.07, x, h, i * 0.05, 'canopy', 1, 0.55, 1, [1.9, 0.9, 0.5], 6); } });
    N.rock0 = rock(401, [0.95, 0.93, 0.9]); N.rock1 = rock(402, [0.8, 0.8, 0.82], 0.36); N.basalt = rock(403, [0.3, 0.29, 0.3], 0.34);
    N.ore_iron = oreRock(411, [0.75, 0.7, 0.68], [1.4, 0.55, 0.3]); N.ore_copper = oreRock(412, [0.72, 0.72, 0.7], [0.35, 1.3, 1.0]);
    N.sulfur = oreRock(413, [0.6, 0.58, 0.5], [2.2, 1.9, 0.3]); N.obsidian = rock(414, [0.09, 0.08, 0.11], 0.42); N.titanium = oreRock(415, [0.4, 0.42, 0.46], [1.5, 1.7, 2.0]);
    N.clay = small((b) => { const g = G.geo.blob(420, 8, 0.2, 0.35); tint(g, () => [1.25, 0.72, 0.5]); b.add(g, 'rockObj'); });
    N.stone = small((b) => { const g = rock(421, [1, 0.98, 0.95], 0.25).rockObj; b.add(g, 'rockObj', b.mat4(0, 0.05, 0, 0, 0, 0, 0.17, 0.12, 0.15)); b.add(g, 'rockObj', b.mat4(0.2, 0.03, 0.1, 0, 2, 0, 0.1, 0.08, 0.1)); });
    N.flint = small((b) => { const g = rock(422, [0.3, 0.3, 0.36], 0.4).rockObj; b.add(g, 'rockObj', b.mat4(0, 0.04, 0, 0, 0, 0, 0.16, 0.07, 0.1)); });
    N.stick = small((b) => { b.cyl(0.035, 0.045, 1.1, 0, 0.05, 0, 'log', 5, 0, 0.3, 1.5708); b.cyl(0.025, 0.03, 0.6, 0.15, 0.05, 0.2, 'log', 5, 0, 1.2, 1.5708); });
    N.driftwood = small((b) => { b.cyl(0.12, 0.16, 2.0, 0, 0.12, 0, 'log', 6, 0, 0.3, 1.5708, [1.5, 1.45, 1.4]); b.beam(0.3, 0.15, 0, 0.7, 0.55, 0.3, 0.05, 'log', 5); });
    N.shell = small((b) => { b.sph(0.09, 0, 0.03, 0, 'canopy', 1, 0.45, 0.85, [2.4, 2.1, 1.9], 7); });
    N.coconut = small((b) => { b.sph(0.13, 0, 0.11, 0, 'palmTrunk', 1, 0.95, 1, [0.55, 0.42, 0.3], 7); });
    N.clam = small((b) => { b.sph(0.16, 0, 0.05, 0, 'coral', 1, 0.45, 0.8, [1.3, 1.2, 1.1], 7); });
    N.oyster = small((b) => { b.sph(0.2, 0, 0.06, 0, 'coral', 1, 0.4, 0.75, [0.6, 0.55, 0.65], 7); b.sph(0.04, 0.02, 0.12, 0, 'crystal', 1, 1, 1, null, 5); });
    N.seaweed = grassClump(431, { n: 34, r: 0.22, h: 0.55, w: 0.03, root: [0.03, 0.05, 0.02], mid: [0.06, 0.11, 0.035], tip: [0.12, 0.17, 0.06], dry: [0.16, 0.14, 0.05], dryP: 0.2 });
    // giant kelp: a stipe rising to the surface with gas floats and long golden-brown blades along its length
    N.kelp = small((b) => {   // giant kelp: several stipes from one holdfast, broad ruffled blades on gas bladders all the way up
      const r = G.rng(432), L = { pos: [], nor: [], col: [], idx: [] };
      b.sph(0.22, 0, 0.05, 0, 'coral', 1.3, 0.5, 1.3, [0.4, 0.3, 0.16], 7);
      const ribbon = (x, y, z, ang, len, wid, droop) => {
        const base = L.pos.length / 3, SEG = 7, ca = Math.cos(ang), sa = Math.sin(ang), k = 0.75 + r() * 0.35;
        for (let i = 0; i <= SEG; i++) {
          const t = i / SEG, out = len * t * (1 - droop * 0.3), dn = -len * droop * t * t + len * 0.25 * t, w = wid * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.08)) * (1 + 0.18 * Math.sin(t * 19 + ang * 3));
          const cx = x + ca * out, cy = y + dn, cz = z + sa * out, ex = -sa * w, ez = ca * w, ruf = 0.025 * Math.sin(t * 23 + ang);
          L.pos.push(cx - ex, cy + ruf, cz - ez, cx + ex, cy - ruf, cz + ez);
          for (let q = 0; q < 2; q++) { L.nor.push(0, 1, 0); const g = 0.6 + t * 0.4; L.col.push(0.32 * k * g + 0.05, 0.27 * k * g + 0.04, 0.06 * k); }
        }
        for (let i = 0; i < SEG; i++) { const q = base + i * 2; L.idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
      };
      for (let st = 0; st < 7; st++) {
        const ox = (r() - 0.5) * 0.6, oz = (r() - 0.5) * 0.6, H = 7 + r() * 6, lean = (r() - 0.5) * 1.2, lean2 = (r() - 0.5) * 1.2;
        b.beam(ox * 0.3, 0.1, oz * 0.3, ox + lean, H, oz + lean2, 0.02, 'coral', 5);
        for (let y = 0.6; y < H; y += 0.28 + r() * 0.16) {
          const t = y / H, x = ox * 0.3 + (ox + lean - ox * 0.3) * t, z = oz * 0.3 + (oz + lean2 - oz * 0.3) * t, a = r() * 6.28;
          b.sph(0.028, x, y, z, 'coral', 1, 1.5, 1, [0.55, 0.45, 0.16], 5);
          ribbon(x, y, z, a, 0.7 + r() * 0.6, 0.075 + r() * 0.05, 0.25 + r() * 0.5);
        }
        for (let q = 0; q < 5; q++) ribbon(ox + lean, H - 0.05, oz + lean2, r() * 6.28, 0.9 + r() * 0.7, 0.08, 0.05);   // canopy blades spread at the surface
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(L.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(L.nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(L.col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(L.pos.length / 3 * 2), 2)); g.setIndex(L.idx); g.computeVertexNormals();
      b.add(g, 'leaf3d');
    });
    N.coral0 = coral(441, [1.05, 0.62, 0.42], true); N.coral1 = coral(442, [1.0, 0.82, 0.48], true); N.coral2 = coral(443, [0.7, 0.45, 0.85], true);   // light builds: they are placed by the thousand
    N.coral3 = brain(444, [1.15, 0.95, 0.62]); N.coral4 = brain(445, [0.62, 1.0, 0.82]);
    N.coral5 = plate(446, [0.85, 0.95, 0.75]); N.coral6 = fan(447, [1.2, 1.0, 1.1]); N.coral7 = fan(448, [1.6, 1.3, 0.5]);
    // barrel and tube sponges
    N.sponge = small((b) => { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(0.22 + 0.12 * Math.sin(t * 2.6) - (t > 0.92 ? (t - 0.92) * 2.5 : 0), t * 0.7)); } const g = new THREE.LatheGeometry(pts, 18); const p = g.attributes.position; for (let k = 0; k < p.count; k++) { const a = Math.atan2(p.getZ(k), p.getX(k)), f = 1 + 0.06 * Math.sin(a * 14); p.setX(k, p.getX(k) * f); p.setZ(k, p.getZ(k) * f); } g.computeVertexNormals(); b.add(g, 'coral', null, [1.25, 0.72, 0.38]); for (let i = 0; i < 3; i++) b.cyl(0.05, 0.045, 0.35 + i * 0.12, 0.32 + i * 0.07, 0.17 + i * 0.06, 0.1 - i * 0.12, 'coral', 8, 0, 0, 0, [1.4, 1.05, 0.25]); });
    N.scrap = small((b) => { b.box(0.9, 0.06, 0.6, 0, 0.1, 0, 'metal', 0.4, 0.2, 0.1); b.box(0.5, 0.05, 0.7, 0.3, 0.2, 0.1, 'metal', 1.2, -0.3, 0.2); b.cyl(0.07, 0.07, 0.9, -0.2, 0.15, 0.2, 'metal', 6, 0, 0.5, 1.4); });

    // ---- near-field reef life (light models for dense placement around a diver) ----
    N.reef_finger0 = coral(461, [1.1, 0.75, 0.5], true); N.reef_finger1 = coral(462, [0.75, 0.55, 0.95], true); N.reef_finger2 = coral(463, [0.95, 1.0, 0.6], true);
    N.reef_urchin = small((b) => { b.sph(0.07, 0, 0.05, 0, 'reefPlain', 1, 0.8, 1, [0.04, 0.03, 0.05], 8); const r = G.rng(470); for (let i = 0; i < 46; i++) { const u = r() * 6.28, v = Math.acos(1 - r() * 1.6), d = [Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)], L = 0.12 + r() * 0.1, g = new THREE.ConeGeometry(0.006, L, 3); g.translate(0, L / 2, 0); _q.setFromUnitVectors(_v.set(0, 1, 0), _p.set(d[0], d[1], d[2])); _m.compose(_p.set(d[0] * 0.06, 0.05 + d[1] * 0.05, d[2] * 0.06), _q, _s.set(1, 1, 1)); b.add(g, 'reefPlain', _m, [0.05, 0.03, 0.06]); } });
    const anem = (seed, c1, c2) => small((b) => { b.cyl(0.09, 0.11, 0.08, 0, 0.04, 0, 'reefPlain', 10, 0, 0, 0, c1); const r = G.rng(seed); for (let i = 0; i < 70; i++) { const a = r() * 6.28, rr = Math.sqrt(r()) * 0.1, L = 0.08 + r() * 0.07, g = new THREE.CylinderGeometry(0.004, 0.008, L, 4); g.translate(0, L / 2, 0); _q.setFromUnitVectors(_v.set(0, 1, 0), _p.set(Math.cos(a) * rr * 4, 1, Math.sin(a) * rr * 4).normalize()); _m.compose(_p.set(Math.cos(a) * rr, 0.08, Math.sin(a) * rr), _q, _s.set(1, 1, 1)); b.add(g, 'reefPlain', _m, c2); b.sph(0.007, _m.elements[12] + _m.elements[4] * L, _m.elements[13] + _m.elements[5] * L, _m.elements[14] + _m.elements[6] * L, 'reefPlain', 1, 1, 1, [c2[0] * 1.4, c2[1] * 1.4, c2[2] * 1.4], 4); } });
    N.reef_anemone0 = anem(471, [0.5, 0.25, 0.2], [0.75, 0.45, 0.35]); N.reef_anemone1 = anem(472, [0.3, 0.3, 0.2], [0.45, 0.62, 0.3]);
    N.reef_star = small((b) => { for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28, g = new THREE.ConeGeometry(0.035, 0.13, 6); g.rotateZ(-Math.PI / 2); g.scale(1, 0.45, 1); g.translate(0.07, 0.012, 0); b.add(g, 'reefPlain', b.mat4(0, 0, 0, 0, -a, 0), [0.9, 0.3, 0.08]); } b.sph(0.035, 0, 0.012, 0, 'reefPlain', 1, 0.45, 1, [0.9, 0.3, 0.08], 8); });
    N.reef_star_blue = small((b) => { for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28, g = new THREE.CylinderGeometry(0.014, 0.018, 0.16, 6); g.rotateZ(-Math.PI / 2); g.translate(0.08, 0.014, 0); b.add(g, 'reefPlain', b.mat4(0, 0, 0, 0, -a, 0), [0.1, 0.25, 0.75]); } b.sph(0.022, 0, 0.014, 0, 'reefPlain', 1, 0.6, 1, [0.1, 0.25, 0.75], 8); });
    N.reef_clam = small((b) => { for (const sg of [-1, 1]) { const g = new THREE.SphereGeometry(0.2, 14, 6, 0, Math.PI, 0, Math.PI / 2); const p = g.attributes.position; for (let k = 0; k < p.count; k++) { const a = Math.atan2(p.getZ(k), p.getX(k)); p.setY(k, p.getY(k) * (1 + 0.18 * Math.sin(a * 10))); } g.computeVertexNormals(); b.add(g, 'reefPlain', b.mat4(0, 0.02, sg * 0.01, sg * 1.35, 0, 0, 1, 1, 0.55), [0.55, 0.52, 0.45]); } b.box(0.34, 0.03, 0.06, 0, 0.13, 0, 'reefPlain', 0, 0, 0, [0.05, 0.25, 0.55]); });
    N.reef_leather = small((b) => {   // mushroom leather coral: a smooth stalk under a broad cap with deep wavy folds at the rim
      const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(0.06 + 0.02 * Math.sin(t * 3), t * 0.16)); } b.add(new THREE.LatheGeometry(pts, 14), 'reefPlain', null, [0.55, 0.5, 0.36]);
      const g = new THREE.CircleGeometry(0.2, 48, 0, Math.PI * 2); const p = g.attributes.position; g.rotateX(-Math.PI / 2);
      for (let k = 0; k < p.count; k++) { const x = p.getX(k), z = p.getZ(k), rr = Math.hypot(x, z), a = Math.atan2(z, x), e = rr / 0.2; p.setY(k, 0.17 + 0.03 * (1 - e * e) + Math.sin(a * 7) * 0.035 * e * e + Math.sin(a * 3 + 1) * 0.02 * e); }
      g.computeVertexNormals(); b.add(g, 'reefPlain', null, [0.4, 0.36, 0.22]); const g2 = g.clone(); g2.scale(1, 1, 1); g2.translate(0, -0.012, 0); const ix = g2.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k]; ix[k] = ix[k + 1]; ix[k + 1] = t; } g2.computeVertexNormals(); b.add(g2, 'reefPlain', null, [0.4, 0.37, 0.28]);
    });
    N.reef_rubble = small((b) => { const r = G.rng(476); for (let i = 0; i < 9; i++) { const k = 0.8 + r() * 0.4; b.cyl(0.015, 0.02, 0.12 + r() * 0.12, (r() - 0.5) * 0.5, 0.015, (r() - 0.5) * 0.5, 'reefPlain', 5, r() * 3, r() * 3, Math.PI / 2, [0.62 * k, 0.6 * k, 0.55 * k]); } for (let i = 0; i < 4; i++) { const g = G.geo.blob(480 + i, 6, 0.4, 0.6); b.add(g, 'reefPlain', b.mat4((r() - 0.5) * 0.5, 0.01, (r() - 0.5) * 0.5, r() * 3, r() * 3, 0, 0.05 + r() * 0.04), [0.55, 0.53, 0.48]); } });
    N.crystal = crystalCluster(450);
    // downloaded scans replace the procedural stand-ins where present
    const GA = G.assets, real = (name, o, fn) => { const gs = GA.geos(name, o); if (!gs) return null; if (!fn) return gs; return small((b) => fn(b, gs)); };
    N.bush = real('fern', { size: 1.5, part: 0, foliage: true, sway: 0.02 }) || N.bush;
    N.fern = real('fern', { size: 1.0, part: 2, foliage: true, sway: 0.025 }) || N.fern;
    N.berry = real('shrub', { size: 1.25, byHeight: true, part: 0, foliage: true, sway: 0.015, tris: 6000 }, (b, gs) => { for (const k in gs) b.add(gs[k].clone(), k); const r = G.rng(4); for (let i = 0; i < 16; i++) b.sph(0.045, (r() - 0.5) * 1.0, 0.45 + r() * 0.6, (r() - 0.5) * 1.0, 'canopy', 1, 1, 1, [1.9, 0.25, 0.4], 5); }) || N.berry;
    N._rock0 = N.rock0; N._rock1 = N.rock1;   // procedural rocks stay available for site props (fire rings, cairns)
    N.rock0 = real('rock_a', { size: 1.9, tris: 2500 }) || N.rock0; N.rock1 = real('rock_b', { size: 1.6, tris: 2500 }) || N.rock1;
    N.shell = real('conch', { size: 0.24, tris: 900 }) || N.shell;
    N.stick = real('branches', { size: 1.15, part: 0, tris: 2500 }) || N.stick;
    N.vent = small((b) => { const g = rock(460, [0.25, 0.22, 0.2], 0.3).rockObj; b.add(g, 'rockObj', b.mat4(0, 0, 0, 0, 0, 0, 0.9, 0.5, 0.9)); b.cyl(0.25, 0.4, 0.3, 0, 0.35, 0, 'ember', 7); });
  };
})();
