'use strict';
/* Ground cover around the player: a dense carpet of short grass tufts where the terrain is grassy, and scattered litter
   (pebbles, twigs, dead leaves, shell grit on sand). World-anchored cells in a ring that follows the camera; when the
   camera crosses a cell boundary only the newly exposed row/column is re-sampled. The outer edge shrinks smoothly in the
   vertex shader, so there is no visible border. */
(function () {
  const G = window.G;
  const CELL = 0.4, N = 104, HALF = N / 2, R = HALF * CELL - 1.5;   // ~20 m radius
  const LCELL = 1.6, LN = 26, LHALF = LN / 2;                        // litter: sparser, smaller ring
  const hash = (x, z, s) => { let h = (x * 374761393 + z * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), tmp = [0, 0, 0], w = [0, 0, 0, 0, 0];

  function fadeMat(base, radius) {
    const sw = base.onBeforeCompile;
    base.onBeforeCompile = (sh) => {
      if (sw) sw(sh);
      sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `{
          vec3 ipn = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          transformed *= smoothstep(${radius.toFixed(1)}, ${(radius * 0.72).toFixed(1)}, distance(ipn.xz, cameraPosition.xz));
        }
        #include <project_vertex>`);
    };
    base.customProgramCacheKey = () => 'fade' + radius;
    return base;
  }

  // litter patch: a few pebbles, a twig and some curled dead leaves within half a metre
  function litterGeo() {
    const b = new G.MB(), r = G.rng(91);
    for (let i = 0; i < 5; i++) { const g = G.geo.blob(200 + i, 6, 0.3, 0.55); const k = 0.5 + r() * 0.35; b.add(g, 'litter', b.mat4((r() - 0.5) * 0.8, 0.0, (r() - 0.5) * 0.8, r() * 3, r() * 3, 0, 0.025 + r() * 0.035), [0.3 * k, 0.28 * k, 0.24 * k]); }
    for (let i = 0; i < 2; i++) b.cyl(0.006, 0.009, 0.22 + r() * 0.2, (r() - 0.5) * 0.6, 0.01, (r() - 0.5) * 0.6, 'litter', 5, 0, r() * 3, Math.PI / 2, [0.24, 0.16, 0.09]);
    for (let i = 0; i < 4; i++) {
      const g = new THREE.PlaneGeometry(0.045, 0.075, 2, 2), p = g.attributes.position; for (let k = 0; k < p.count; k++) { const x = p.getX(k); p.setZ(k, x * x * 6 + Math.abs(p.getY(k)) * 0.15); p.setX(k, x * (1 - Math.abs(p.getY(k)) * 5)); }
      g.rotateX(-Math.PI / 2); g.computeVertexNormals(); const t = r(); b.add(g, 'litter', b.mat4((r() - 0.5) * 0.9, 0.012, (r() - 0.5) * 0.9, (r() - 0.5) * 0.4, r() * 6.28, 0), [0.1 + t * 0.07, 0.065 + t * 0.04, 0.028]);
    }
    return b.geos().litter;
  }

  // beach litter: shells, bleached coral rubble, a bit of driftwood and strands of washed-up seaweed
  function beachGeo() {
    const b = new G.MB(), r = G.rng(57);
    for (let i = 0; i < 4; i++) { const k = 0.85 + r() * 0.3, g = new THREE.SphereGeometry(1, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2); const p = g.attributes.position; for (let v = 0; v < p.count; v++) { const a = Math.atan2(p.getZ(v), p.getX(v)); p.setY(v, p.getY(v) * (1 + 0.15 * Math.sin(a * 9))); } g.computeVertexNormals(); b.add(g, 'litter', b.mat4((r() - 0.5) * 0.9, 0, (r() - 0.5) * 0.9, (r() - 0.5) * 0.4, r() * 6.28, 0, 0.025 + r() * 0.02, 0.012, 0.03 + r() * 0.015), [0.36 * k, 0.31 * k, 0.26 * k]); }
    for (let i = 0; i < 3; i++) { const g = G.geo.blob(300 + i, 6, 0.45, 0.6); b.add(g, 'litter', b.mat4((r() - 0.5) * 0.8, 0.005, (r() - 0.5) * 0.8, r() * 3, r() * 3, 0, 0.02 + r() * 0.025), [0.4, 0.38, 0.34]); }
    b.cyl(0.012, 0.018, 0.35, (r() - 0.5) * 0.4, 0.012, (r() - 0.5) * 0.4, 'litter', 6, 0, r() * 3, Math.PI / 2, [0.3, 0.28, 0.25]);
    { const cx = (r() - 0.5) * 0.4, cz = (r() - 0.5) * 0.4; for (let i = 0; i < 12; i++) { const g = new THREE.PlaneGeometry(0.055, 0.22 + r() * 0.12, 1, 5), p = g.attributes.position; for (let v = 0; v < p.count; v++) p.setX(v, p.getX(v) + Math.sin(p.getY(v) * 11 + i) * 0.02); g.rotateX(-Math.PI / 2); const t = r(); b.add(g, 'litter', b.mat4(cx + (r() - 0.5) * 0.22, 0.004 + i * 0.0015, cz + (r() - 0.5) * 0.22, 0, r() * 6.28, 0), [0.035 + t * 0.035, 0.028 + t * 0.022, 0.012]); } }
    return b.geos().litter;
  }

  // ---------------- reef field: dense coral, anemones, urchins, stars and rubble within ~26 m of a diver ----------------
  const RCELL = 0.85, RRAD = 26, RV = [
    ['reef_finger0', 10, -1.5, -18], ['reef_finger1', 8, -2, -18], ['reef_finger2', 8, -1.5, -14], ['coral3', 7, -2, -20], ['coral4', 6, -2, -20], ['coral5', 6, -3, -22],
    ['coral6', 3, -5, -25], ['coral7', 3, -5, -25], ['sponge', 4, -3, -25], ['reef_leather', 6, -1.5, -15], ['reef_anemone0', 3, -1.5, -12], ['reef_anemone1', 3, -1.5, -12],
    ['reef_urchin', 6, -1, -15], ['reef_clam', 2, -1.5, -10], ['reef_rubble', 9, -1, -25], ['seaweed', 6, -1, -9]];
  const SAND = [['reef_star', 3], ['reef_star_blue', 1], ['reef_rubble', 2], ['seaweed', 5], ['reef_urchin', 1]];
  const RF = {
    cache: new Map(), meshes: {}, cx: null, cz: null,
    init(scene) {
      const cap = Math.ceil(Math.PI * (RRAD / RCELL) * (RRAD / RCELL)) + 10;
      for (const [v] of RV.concat(SAND)) {
        if (this.meshes[v]) continue; const gs = G.nodeGeo[v]; if (!gs) continue; const arr = [];
        for (const mk in gs) { const geo = gs[mk]; if (!geo || !geo.isBufferGeometry) continue; const im = new THREE.InstancedMesh(geo, G.mats[mk], cap); im.count = 0; im.frustumCulled = false; im.receiveShadow = true; im.castShadow = false; scene.add(im); arr.push(im); }
        this.meshes[v] = arr;
      }
    },
    cell(I, ix, iz) {
      const key = ix + ',' + iz; let c = this.cache.get(key); if (c !== undefined) return c;
      const x = (ix + hash(ix, iz, 21)) * RCELL, z = (iz + hash(ix, iz, 22)) * RCELL, h = G.world.heightAt(x, z); c = null;
      if (h < -1.0 && h > -26 && G.world.slopeAt(x, z) < 0.9) {
        const sd = (I.seed % 97) + 11, patch = G.noise2(x * 0.03, z * 0.03, sd), fine = G.noise2(x * 0.18, z * 0.18, sd + 5), u = hash(ix, iz, 23);
        const occ = (patch > 0.5 ? 0.85 : patch > 0.44 ? 0.4 : 0.0) * (0.55 + fine * 0.7);
        const rr = { i: 0 }, rnd = () => hash(ix, iz, 30 + rr.i++);
        if (u < occ) { const ok = RV.filter((e) => h <= e[2] && h >= e[3]); if (ok.length) { const v = G.weighted(rnd, ok.map((e) => [e[0], e[1]])); c = { v, x, y: h - 0.04, z, s: (v.startsWith('coral') || v === 'sponge' ? 0.35 + rnd() * 0.7 : 0.7 + rnd() * 0.8) * (patch > 0.55 ? 1.15 : 1), r: rnd() * 6.28 }; } }
        else if (u < occ + 0.07) { const v = G.weighted(rnd, SAND); c = { v, x, y: h - 0.01, z, s: 0.7 + rnd() * 0.6, r: rnd() * 6.28 }; }
      }
      if (this.cache.size > 90000) this.cache.clear(); this.cache.set(key, c); return c;
    },
    update(pos, on) {
      const vis = (v) => { for (const k in this.meshes) for (const im of this.meshes[k]) im.visible = v; };
      if (!on) { if (this.cx !== null) { vis(false); this.cx = null; } return; }
      if (this.cx !== null && Math.hypot(pos.x - this.cx, pos.z - this.cz) < 2.5) return;
      this.cx = pos.x; this.cz = pos.z; vis(true); const I = G.world.nearest, cnt = {};
      for (const k in this.meshes) cnt[k] = 0;
      const n = Math.ceil(RRAD / RCELL), bx = Math.floor(pos.x / RCELL), bz = Math.floor(pos.z / RCELL);
      for (let a = bx - n; a <= bx + n; a++) for (let b = bz - n; b <= bz + n; b++) {
        const c = this.cell(I, a, b); if (!c || !this.meshes[c.v]) continue; const d = Math.hypot(c.x - pos.x, c.z - pos.z); if (d > RRAD) continue;
        const sc = c.s * G.sstep(RRAD, RRAD - 6, d); _e.set(0, c.r, 0); _q.setFromEuler(_e); _m.compose(_p.set(c.x, c.y, c.z), _q, _s.set(sc, sc, sc));
        for (const im of this.meshes[c.v]) im.setMatrixAt(cnt[c.v], _m); cnt[c.v]++;
      }
      for (const k in this.meshes) for (const im of this.meshes[k]) { im.count = cnt[k]; im.instanceMatrix.needsUpdate = true; }
    }
  };

  const GC = G.groundCover = {
    init(scene) {
      const grassGeo = G.grassClump(77, { n: 16, r: 0.16, h: 0.34, w: 0.011, dryP: 0.15 }).grassBlade;
      const gm = G.mats.grassBlade.clone(); gm.onBeforeCompile = G.mats.grassBlade.onBeforeCompile; fadeMat(gm, R);
      this.grass = new THREE.InstancedMesh(grassGeo, gm, N * N); this.grass.frustumCulled = false; this.grass.receiveShadow = true;
      const lm = fadeMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), LHALF * LCELL - 1);
      this.litter = new THREE.InstancedMesh(litterGeo(), lm, LN * LN); this.litter.frustumCulled = false; this.litter.receiveShadow = true;
      this.beach = new THREE.InstancedMesh(beachGeo(), lm, LN * LN); this.beach.frustumCulled = false; this.beach.receiveShadow = true;
      _m.makeScale(0, 0, 0); for (let i = 0; i < N * N; i++) this.grass.setMatrixAt(i, _m); for (let i = 0; i < LN * LN; i++) { this.litter.setMatrixAt(i, _m); this.beach.setMatrixAt(i, _m); }
      scene.add(this.grass); scene.add(this.litter); scene.add(this.beach); RF.init(scene); this.reef = RF; this.cx = this.cz = this.lx = this.lz = null; this.active = false;
    },
    // how grassy the ground is here, from the same rules the terrain shader uses
    sample(I, x, z) {
      const h = G.world.heightAt(x, z); if (h < 1.9) return { h, grass: 0, sand: h > -0.3 ? 1 : 0 };
      const sl = G.world.slopeAt(x, z), ny = 1 / Math.sqrt(1 + sl * sl); G.world.color(I, x, z, h, ny, tmp, w);
      return { h, grass: w[1] * (1 - 0.6 * w[2]) * (1 - 0.6 * (w[4] || 0)), sand: w[0] };
    },
    cellGrass(I, ix, iz) {
      const slot = (((ix % N) + N) % N) + (((iz % N) + N) % N) * N, j1 = hash(ix, iz, 1), j2 = hash(ix, iz, 2);
      const x = (ix + j1) * CELL, z = (iz + j2) * CELL, s = this.sample(I, x, z), d = G.sstep(0.12, 0.5, s.grass) * (hash(ix, iz, 3) < 0.9 ? 1 : 0);
      const sc = d > 0.02 ? (0.55 + hash(ix, iz, 4) * 0.75) * (0.4 + 0.6 * d) : 0;
      _e.set((hash(ix, iz, 5) - 0.5) * 0.25, hash(ix, iz, 6) * 6.28, (hash(ix, iz, 7) - 0.5) * 0.25); _q.setFromEuler(_e);
      this.grass.setMatrixAt(slot, _m.compose(_p.set(x, s.h - 0.02, z), _q, _s.set(sc, sc * (0.8 + hash(ix, iz, 8) * 0.5), sc)));
    },
    cellLitter(I, ix, iz) {
      const slot = (((ix % LN) + LN) % LN) + (((iz % LN) + LN) % LN) * LN, x = (ix + hash(ix, iz, 11)) * LCELL, z = (iz + hash(ix, iz, 12)) * LCELL, s = this.sample(I, x, z);
      const sl = G.world.slopeAt(x, z), inland = s.grass > 0.2, onBeach = !inland && s.sand > 0.5 && s.h > 0.25;
      const wrack = 1 - G.sstep(0.35, 0.5, Math.abs(s.h - 1.0));   // the high-tide line collects the most
      const on = sl < 0.6 && (inland ? hash(ix, iz, 13) < 0.55 : onBeach && hash(ix, iz, 13) < 0.12 + wrack * 0.7);
      const sc = on ? 0.7 + hash(ix, iz, 14) * 0.8 : 0; _e.set(0, hash(ix, iz, 15) * 6.28, 0); _q.setFromEuler(_e); _p.set(x, s.h - 0.005, z);
      _m.compose(_p, _q, _s.set(inland ? sc : 0, inland ? sc : 0, inland ? sc : 0)); this.litter.setMatrixAt(slot, _m);
      _m.compose(_p, _q, _s.set(inland ? 0 : sc, inland ? 0 : sc, inland ? 0 : sc)); this.beach.setMatrixAt(slot, _m);
    },
    update(pos) {
      if (!this.grass) return; const I = G.world.nearest, near = !!(I && I._d < I.r * 1.4 + 60) && G.settings.veg > 0;
      RF.update(pos, near && pos.y < 1.5);
      const under = G.render && G.render.underwater; this.grass.visible = this.litter.visible = this.beach.visible = near && !under; if (!near) { this.cx = this.lx = null; return; }
      const cx = Math.floor(pos.x / CELL), cz = Math.floor(pos.z / CELL);
      if (this.cx === null || Math.abs(cx - this.cx) > 6 || Math.abs(cz - this.cz) > 6) { for (let a = cx - HALF; a < cx + HALF; a++) for (let b = cz - HALF; b < cz + HALF; b++) this.cellGrass(I, a, b); }
      else {
        // only the rows and columns that entered the ring
        if (cx !== this.cx) { const s = Math.sign(cx - this.cx); for (let a = this.cx; a !== cx; a += s) { const col = s > 0 ? a + HALF : a - HALF - 1; for (let b = cz - HALF; b < cz + HALF; b++) this.cellGrass(I, col, b); } }
        if (cz !== this.cz) { const s = Math.sign(cz - this.cz); for (let b = this.cz; b !== cz; b += s) { const row = s > 0 ? b + HALF : b - HALF - 1; for (let a = cx - HALF; a < cx + HALF; a++) this.cellGrass(I, a, row); } }
      }
      if (cx !== this.cx || cz !== this.cz) { this.cx = cx; this.cz = cz; this.grass.instanceMatrix.needsUpdate = true; }
      const lx = Math.floor(pos.x / LCELL), lz = Math.floor(pos.z / LCELL);
      if (lx !== this.lx || lz !== this.lz) { for (let a = lx - LHALF; a < lx + LHALF; a++) for (let b = lz - LHALF; b < lz + LHALF; b++) this.cellLitter(I, a, b); this.lx = lx; this.lz = lz; this.litter.instanceMatrix.needsUpdate = true; this.beach.instanceMatrix.needsUpdate = true; }
    },
    reset() { this.cx = this.lx = null; }
  };
})();
