'use strict';
/* Structures: the raft (floating, sailable) and island bases. Grid of tiles with levels, edge walls, stairs, roofs
   and placed equipment. Geometry is merged per material on every change; colliders are simple boxes in local space. */
(function () {
  const G = window.G;
  const T = 1.6, LH = 2.6, DECK = 0.36;
  const _v = new THREE.Vector3(), _samp = { h: 0, nx: 0, nz: 0 };
  let NEXT = 1;
  const hsh = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 2246822519) | 0; h = (h ^ (h >>> 13)) * 1274126177; h ^= h >>> 16; return (h >>> 0) / 4294967296; };

  class Structure {
    constructor(kind, x, y, z, yaw) {
      this.id = NEXT++; this.kind = kind; this.pos = new THREE.Vector3(x, y, z); this.yaw = yaw || 0;
      this.tiles = new Map(); this.walls = new Map(); this.stairs = new Map(); this.roofs = new Map(); this.items = new Map();
      this.group = new THREE.Group(); this.staticGroup = new THREE.Group(); this.group.add(this.staticGroup); G.scene.add(this.group);
      this.boxes = []; this.vel = new THREE.Vector2(); this.yawVel = 0; this.sailOpen = false; this.anchored = false; this.throttle = 0; this.steer = 0;
      this.radius = 2; this.energy = 0; this.cap = 0; this.powerNet = 0; this.tilt = new THREE.Vector2(); this.dYaw = 0; this.dirty = true; this.simT = Math.random() * 0.5;
      this.cos = Math.cos(this.yaw); this.sin = Math.sin(this.yaw); this.paddle = new THREE.Vector2();
    }
    key(ix, iz, lv) { return ix + ',' + iz + ',' + lv; }
    wkey(ix, iz, lv, side) { return ix + ',' + iz + ',' + lv + ',' + side; }
    floorY(lv) { return (this.kind === 'ground' ? 0 : DECK) + lv * LH; }
    toWorld(lx, ly, lz, out) { out = out || new THREE.Vector3(); out.set(this.pos.x + lx * this.cos + lz * this.sin, this.pos.y + ly, this.pos.z - lx * this.sin + lz * this.cos); return out; }
    toLocal(wx, wy, wz, out) { out = out || new THREE.Vector3(); const dx = wx - this.pos.x, dz = wz - this.pos.z; out.set(dx * this.cos - dz * this.sin, wy - this.pos.y, dx * this.sin + dz * this.cos); return out; }
    hasFloor(ix, iz, lv) { return this.tiles.has(this.key(ix, iz, lv)); }
    // canonical edge for a tile side: 0=N(-z) 1=W(-x) 2=S(+z) 3=E(+x)
    edge(ix, iz, lv, side) { if (side === 2) return this.wkey(ix, iz + 1, lv, 0); if (side === 3) return this.wkey(ix + 1, iz, lv, 1); return this.wkey(ix, iz, lv, side); }
    supported(ix, iz, lv) {
      if (lv === 0) return this.hasFloor(ix, iz, 0);
      const walled = (x, z) => { for (let s = 0; s < 4; s++) { const w = this.walls.get(this.edge(x, z, lv - 1, s)); if (w && w.type !== 'railing') return true; } return false; };
      if (walled(ix, iz)) return true;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (this.stairs.has(this.key(ix + dx, iz + dz, lv - 1))) return true; if (this.hasFloor(ix + dx, iz + dz, lv) && walled(ix + dx, iz + dz)) return true; }
      return false;
    }
    connectedWithout(rk) {
      const keys = [...this.tiles.keys()].filter((k) => k.endsWith(',0') && k !== rk); if (!keys.length) return false;
      const seen = new Set([keys[0]]), q = [keys[0]];
      while (q.length) { const [x, z] = q.pop().split(',').map(Number); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = this.key(x + dx, z + dz, 0); if (k !== rk && this.tiles.has(k) && !seen.has(k)) { seen.add(k); q.push(k); } } }
      return seen.size === keys.length;
    }
    count() { return this.tiles.size; }

    // ---------- geometry + colliders ----------
    rebuild() {
      this.dirty = false; const b = new G.MB(), boxes = this.boxes = []; const raft = this.kind === 'raft';
      let maxR = 1;
      for (const [k, t] of this.tiles) {
        const [ix, iz, lv] = k.split(',').map(Number), x = ix * T, z = iz * T, y = this.floorY(lv);
        maxR = Math.max(maxR, Math.hypot(x, z) + T);
        const dmg = t.hp < t.max * 0.5;
        if (lv === 0) {
          if (t.type === 'foundation_metal') { b.box(T - 0.02, 0.1, T - 0.02, x, y - 0.05, z, 'steel'); if (raft) { b.cyl(0.24, 0.24, T - 0.1, x - 0.45, y - 0.33, z, 'metal', 8, Math.PI / 2); b.cyl(0.24, 0.24, T - 0.1, x + 0.45, y - 0.33, z, 'metal', 8, Math.PI / 2); } }
          else {
            // deck: five hand-cut planks of uneven width with gaps, laid across two bearers and nailed down
            const NP = 5; let off = -T / 2 + 0.01;
            for (let i = 0; i < NP; i++) {
              const r1 = hsh(ix * 7 + i, iz, 1), r2 = hsh(ix, iz * 7 + i, 2), w = (T - 0.02) / NP * (0.86 + r1 * 0.14), cx = off + w / 2; off += (T - 0.02) / NP;
              if (dmg && i === 2) continue; const len = T - 0.02 - r2 * 0.08, sh = (r2 - 0.5) * 0.04;
              b.box(w - 0.012, 0.055 + r1 * 0.012, len, x + cx, y - 0.03 + (r1 - 0.5) * 0.008, z + sh, (i + ix + iz) % 3 ? 'wood' : 'woodDark', (r1 - 0.5) * 0.02, 0, dmg ? (i - 2) * 0.03 : 0);
              for (const ez of [-0.52, 0.52]) for (const ex of [-0.28, 0.28]) b.cyl(0.011, 0.011, 0.012, x + cx + ex * w, y + 0.003, z + ez, 'metal', 5);
            }
            if (t.type === 'foundation_reinf') { b.box(T - 0.01, 0.02, 0.1, x, y + 0.005, z - 0.6, 'metal'); b.box(T - 0.01, 0.02, 0.1, x, y + 0.005, z + 0.6, 'metal'); }
            b.box(T - 0.04, 0.07, 0.11, x, y - 0.1, z - 0.52, 'woodDark'); b.box(T - 0.04, 0.07, 0.11, x, y - 0.1, z + 0.52, 'woodDark');   // bearers
            if (raft) {
              // floats: three bark-on logs lashed under the bearers, rope wraps where they cross; now and then a salvaged drum
              for (const lz of [-0.55, 0, 0.55]) { const rr = 0.15 + hsh(ix, iz, 3 + lz * 10) * 0.04; b.cyl(rr, rr * 1.05, T + 0.06, x, y - 0.3, z + lz, 'log', 9, 0, 0, Math.PI / 2);
                for (const lx of [-0.55, 0.55]) { const g = new THREE.TorusGeometry(rr + 0.012, 0.018, 5, 14); b.add(g, 'rope', b.mat4(x + lx, y - 0.3, z + lz, 0, Math.PI / 2, 0)); const g2 = new THREE.TorusGeometry(rr + 0.012, 0.018, 5, 14); b.add(g2, 'rope', b.mat4(x + lx + 0.05, y - 0.3, z + lz, 0, Math.PI / 2, 0.25)); } }
              if (hsh(ix, iz, 9) < 0.3 && t.type !== 'foundation_metal') { b.cyl(0.24, 0.24, 0.8, x, y - 0.58, z, 'plastic', 14, 0, 0, Math.PI / 2); for (const lx of [-0.25, 0.25]) { const g = new THREE.TorusGeometry(0.25, 0.016, 5, 16); b.add(g, 'rope', b.mat4(x + lx, y - 0.58, z, 0, Math.PI / 2, 0)); } }
            }
          }
          if (!raft) { for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.cyl(0.07, 0.08, 3.4, x + px * (T / 2 - 0.1), y - 1.75, z + pz * (T / 2 - 0.1), 'log', 6); }
          boxes.push({ x, y: y - 0.2, z, hx: T / 2, hy: 0.2, hz: T / 2, c: 1, s: 0, tile: k });
        } else {
          for (let i = 0; i < 4; i++) b.box(T / 4 - 0.02, 0.08, T - 0.02, x - T / 2 + T / 8 + i * T / 4, y - 0.04, z, i % 2 ? 'wood' : 'woodDark');
          b.box(T, 0.1, 0.08, x, y - 0.13, z - T / 2 + 0.04, 'woodDark'); b.box(T, 0.1, 0.08, x, y - 0.13, z + T / 2 - 0.04, 'woodDark');
          boxes.push({ x, y: y - 0.09, z, hx: T / 2, hy: 0.09, hz: T / 2, c: 1, s: 0, tile: k });
        }
      }
      for (const [k, w] of this.walls) {
        const [ix, iz, lv, side] = k.split(',').map(Number), y0 = this.floorY(lv);
        const x = side === 0 ? ix * T : ix * T - T / 2, z = side === 0 ? iz * T - T / 2 : iz * T, ry = side === 0 ? 0 : Math.PI / 2;
        const W = (w2, h, d, ox, oy, mat) => { const lx = side === 0 ? ox : 0, lz = side === 0 ? 0 : ox; b.box(w2, h, d, x + lx, y0 + oy, z + lz, mat, ry); };
        let colH = LH, solid = true;
        if (w.type === 'wall') {   // vertical boards of uneven width and height on two battens, between corner posts
          const NB = 7; let o = -T / 2 + 0.1; const span = T - 0.2;
          for (let i = 0; i < NB; i++) { const r1 = hsh(ix * 11 + i, iz * 3 + side, lv), bw = span / NB, h = LH - 0.12 - r1 * 0.08; W(bw - 0.014, h, 0.045 + r1 * 0.01, o + bw / 2, h / 2 + 0.02, i % 3 ? 'wood' : 'woodDark'); o += bw; }
          W(T - 0.12, 0.09, 0.04, 0, 0.45, 'woodDark'); W(T - 0.12, 0.09, 0.04, 0, LH - 0.5, 'woodDark');
          W(0.1, LH, 0.12, -T / 2 + 0.05, LH / 2, 'woodDark'); W(0.1, LH, 0.12, T / 2 - 0.05, LH / 2, 'woodDark');
        }
        else if (w.type === 'wall_metal') { W(T, LH, 0.07, 0, LH / 2, 'steel'); }
        else if (w.type === 'wall_window') { W(T, 0.95, 0.08, 0, 0.475, 'wood'); W(T, 0.5, 0.08, 0, LH - 0.25, 'wood'); W(0.28, 1.15, 0.08, -T / 2 + 0.14, 1.525, 'wood'); W(0.28, 1.15, 0.08, T / 2 - 0.14, 1.525, 'wood'); W(1.06, 0.05, 0.12, 0, 0.97, 'woodDark'); W(0.04, 1.15, 0.05, 0, 1.525, 'woodDark'); }
        else if (w.type === 'wall_door') {
          W(0.22, LH, 0.1, -T / 2 + 0.11, LH / 2, 'woodDark'); W(0.22, LH, 0.1, T / 2 - 0.11, LH / 2, 'woodDark'); W(T, 0.4, 0.1, 0, LH - 0.2, 'woodDark');
          if (w.open) { const lx = side === 0 ? -T / 2 + 0.24 : 0.55, lz = side === 0 ? 0.55 : -T / 2 + 0.24; b.box(1.1, 2.15, 0.06, x + lx, y0 + 1.1, z + lz, 'wood', ry + Math.PI / 2); solid = false; }
          else { W(1.14, 2.18, 0.06, 0, 1.1, 'wood'); W(0.05, 0.14, 0.12, 0.42, 1.05, 'brass'); }
        } else if (w.type === 'railing') { colH = 1.0; W(0.07, 1.0, 0.07, -T / 2 + 0.05, 0.5, 'woodDark'); W(0.07, 1.0, 0.07, T / 2 - 0.05, 0.5, 'woodDark'); W(T, 0.05, 0.05, 0, 0.95, 'rope'); W(T, 0.04, 0.04, 0, 0.55, 'rope'); }
        if (solid) boxes.push({ x, y: y0 + colH / 2, z, hx: side === 0 ? T / 2 : 0.07, hy: colH / 2, hz: side === 0 ? 0.07 : T / 2, c: 1, s: 0, wall: k });
      }
      for (const [k, s] of this.stairs) {
        const [ix, iz, lv] = k.split(',').map(Number), x = ix * T, z = iz * T, y0 = this.floorY(lv), ry = -s.dir * Math.PI / 2; const c = Math.cos(ry), sn = Math.sin(ry);
        for (let i = 0; i < 8; i++) { const f = (i + 0.5) / 8, lz = T / 2 - f * T, ly = f * LH; b.box(T * 0.82, 0.06, T / 8 + 0.06, x + lz * sn, y0 + ly, z + lz * c, 'wood', ry); }
        for (const sx of [-1, 1]) { const ox = sx * T * 0.42; b.beam(x + ox * c + (T / 2) * sn, y0 - 0.02, z - ox * sn + (T / 2) * c, x + ox * c - (T / 2) * sn, y0 + LH - 0.02, z - ox * sn - (T / 2) * c, 0.05, 'woodDark', 5); }
        boxes.push({ x, y: y0 + LH / 2, z, hx: T * 0.44, hy: LH / 2, hz: T / 2, c, s: sn, ramp: LH, base: y0 });
      }
      for (const [k] of this.roofs) {
        const [ix, iz, lv] = k.split(',').map(Number), x = ix * T, z = iz * T, y0 = this.floorY(lv) + LH;
        // thatch: a thick top layer on each slope over a longer, ragged under-layer that forms the eaves, on rafters and a ridge pole
        b.box(T + 0.3, 0.07, T * 0.62, x, y0 + 0.28, z - T * 0.26, 'thatch', 0, 0.42); b.box(T + 0.3, 0.07, T * 0.62, x, y0 + 0.28, z + T * 0.26, 'thatch', 0, -0.42);
        for (const sg of [-1, 1]) { const r1 = hsh(ix, iz, lv + (sg > 0 ? 3 : 7)); b.box(T + 0.38 + (r1 - 0.5) * 0.06, 0.05, T * 0.7, x + (r1 - 0.5) * 0.03, y0 + 0.21, z + sg * T * 0.3, 'thatch', 0, -sg * 0.42); }
        for (const rx of [-T / 2 + 0.06, 0, T / 2 - 0.06]) for (const sg of [-1, 1]) b.box(0.05, 0.05, T * 0.66, x + rx, y0 + 0.15, z + sg * T * 0.27, 'woodDark', 0, -sg * 0.42);
        b.cyl(0.055, 0.055, T + 0.3, x, y0 + 0.47, z, 'log', 7, 0, 0, Math.PI / 2); b.box(T, 0.06, 0.06, x, y0 + 0.02, z - T / 2 + 0.03, 'woodDark'); b.box(T, 0.06, 0.06, x, y0 + 0.02, z + T / 2 - 0.03, 'woodDark');
      }
      G.disposeGroup(this.staticGroup); this.staticGroup = b.build(); this.group.add(this.staticGroup);
      // equipment colliders
      for (const [k, it] of this.items) {
        const def = G.BUILD[it.type]; if (def.flat || def.small) continue; const [ix, iz, lv] = k.split(',').map(Number);
        const d = G.itemDims[it.type] || [0.5, 0.9, 0.5]; const ry = it.rot * Math.PI / 2;
        boxes.push({ x: ix * T, y: this.floorY(lv) + d[1] / 2, z: iz * T, hx: d[0], hy: d[1] / 2, hz: d[2], c: Math.cos(ry), s: Math.sin(ry), item: k });
        maxR = Math.max(maxR, Math.hypot(ix * T, iz * T) + T);
      }
      this.radius = maxR + 0.5; this.nSails = 0; this.nEngines = 0; this.hasHelm = false; this.hasNav = false; this.hasForecast = false;
      for (const it of this.items.values()) { const d = G.BUILD[it.type]; if (d.sail) this.nSails++; if (d.engine) this.nEngines++; if (d.helm) this.hasHelm = true; if (d.nav) this.hasNav = true; if (d.forecast) this.hasForecast = true; }
      if (!this.nSails) this.sailOpen = false;
      G.emit('structureChanged', this);
    }
    addItem(ix, iz, lv, type, rot, state) {
      if (this.items.has(this.key(ix, iz, lv))) this.removeItem(this.key(ix, iz, lv));
      const it = { type, rot: rot || 0, s: state || G.items.initState(type), ix, iz, lv, struct: this }; this.items.set(this.key(ix, iz, lv), it);
      it.group = G.items.model(it); it.group.position.set(ix * T, this.floorY(lv), iz * T); it.group.rotation.y = it.rot * Math.PI / 2; this.group.add(it.group);
      G.items.refresh(it); this.dirty = true; return it;
    }
    removeItem(k) { const it = this.items.get(k); if (!it) return; G.disposeGroup(it.group); this.items.delete(k); this.dirty = true; }
    itemWorld(it, out) { return this.toWorld(it.ix * T, this.floorY(it.lv) + 0.6, it.iz * T, out); }
    destroy() { for (const it of this.items.values()) G.disposeGroup(it.group); G.disposeGroup(this.staticGroup); G.scene.remove(this.group); }

    // ---------- simulation ----------
    update(dt) {
      if (this.dirty) this.rebuild();
      const prevYaw = this.yaw;
      if (this.kind === 'raft') this.sail(dt);
      this.cos = Math.cos(this.yaw); this.sin = Math.sin(this.yaw); this.dYaw = this.yaw - prevYaw;
      this.group.position.copy(this.pos); this.group.rotation.set(this.tilt.x, this.yaw, this.tilt.y, 'YXZ');
      this.simT += dt; if (this.simT > 0.5) { G.items.simulate(this, this.simT); this.simT = 0; }
    }
    sail(dt) {
      const W = G.weather, O = G.ocean; const fx = -this.sin, fz = -this.cos; // forward (local -z)
      const wx = Math.cos(W.windDir), wz = Math.sin(W.windDir);
      const mass = 1 + this.tiles.size * 0.045 + this.items.size * 0.03;
      const skill = 1 + G.skills.level('sailing') * 0.04;
      let target = 0;
      if (this.sailOpen && this.nSails) {
        const al = fx * wx + fz * wz; const eff = al < -0.55 ? 0.12 : 0.38 + 0.62 * Math.max(0, al);
        const sails = Math.min(this.nSails, 1 + this.tiles.size / 9);
        target += Math.pow(sails, 0.7) * eff * (2.6 + 5.2 * W.wind) / mass * skill;
      }
      this.engineOn = false;
      if (this.nEngines && this.throttle !== 0) {
        let eng = null; for (const it of this.items.values()) if (G.BUILD[it.type].engine && it.s.fuel > 0) { eng = it; break; }
        if (eng) { eng.s.fuel = Math.max(0, eng.s.fuel - dt * Math.abs(this.throttle) / 9); target += this.throttle * (8.5 + this.nEngines * 1.5) / Math.sqrt(mass) * skill; this.engineOn = true; }
      }
      const cur = this.anchored ? 0 : 1;
      // drift: gentle current + windage
      const cx = Math.cos(G.world.seed * 0.001 + this.pos.z * 0.0006) * 0.22 + wx * W.wind * 0.22, cz = Math.sin(G.world.seed * 0.001 + this.pos.x * 0.0006) * 0.22 + wz * W.wind * 0.22;
      let tx = fx * target + cx * cur, tz = fz * target + cz * cur;
      tx += this.paddle.x; tz += this.paddle.y; this.paddle.multiplyScalar(Math.exp(-dt * 1.2));
      if (this.anchored) { tx = 0; tz = 0; }
      const k = this.anchored ? 2.5 : 0.55;
      this.vel.x = G.damp(this.vel.x, tx, k, dt); this.vel.y = G.damp(this.vel.y, tz, k, dt);
      const speed = this.vel.length();
      this.yawVel = G.damp(this.yawVel, this.steer * (0.25 + Math.min(speed, 6) * 0.07) / Math.sqrt(mass), 2, dt);
      this.yaw += this.yawVel * dt; this.steer = 0;
      // grounding: keep the hull off the shallows
      let nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.y * dt; const R = Math.min(this.radius, 6);
      this.aground = false;
      for (let a = 0; a < 6; a++) {
        const ang = a / 6 * Math.PI * 2, px = nx + Math.cos(ang) * R, pz = nz + Math.sin(ang) * R;
        if (G.world.height(px, pz) > -0.75) { nx -= Math.cos(ang) * (0.05 + speed * dt); nz -= Math.sin(ang) * (0.05 + speed * dt); this.vel.multiplyScalar(0.8); this.aground = true; }
      }
      this.pos.x = nx; this.pos.z = nz;
      // heave + tilt from the wave field
      const r = Math.min(this.radius * 0.7, 5); let h = 0, sx = 0, sz = 0;
      for (const [ox, oz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) { O.sample(this.pos.x + ox, this.pos.z + oz, _samp); h += _samp.h; sx += _samp.nx; sz += _samp.nz; }
      h /= 5; sx /= 5; sz /= 5;
      this.pos.y = G.damp(this.pos.y, h, 6, dt);
      const damp = 1 / (1 + this.tiles.size * 0.02); // big rafts ride steadier
      const lx = sx * this.cos - sz * this.sin, lz = sx * this.sin + sz * this.cos;
      this.tilt.x = G.damp(this.tilt.x, G.clamp(-lz * 0.6 * damp, -0.16, 0.16), 3, dt); this.tilt.y = G.damp(this.tilt.y, G.clamp(lx * 0.6 * damp, -0.16, 0.16), 3, dt);
      this.speed = speed;
    }
    damageRandom(amount) {
      const c = []; for (const [k, t] of this.tiles) if (k.endsWith(',0') && t.type !== 'foundation_metal') c.push([k, t]);
      if (!c.length) return null; const [k, t] = c[Math.floor(Math.random() * c.length)];
      const dmg = t.type === 'foundation_reinf' ? amount * 0.3 : amount; t.hp = Math.max(4, t.hp - dmg); this.dirty = true; return t;
    }
    serialize() {
      const items = []; for (const [k, it] of this.items) items.push({ k, type: it.type, rot: it.rot, s: it.s });
      return { kind: this.kind, x: this.pos.x, y: this.pos.y, z: this.pos.z, yaw: this.yaw, tiles: [...this.tiles].map(([k, t]) => [k, t.type, Math.round(t.hp)]), walls: [...this.walls].map(([k, w]) => [k, w.type, w.open ? 1 : 0]), stairs: [...this.stairs].map(([k, s]) => [k, s.dir]), roofs: [...this.roofs.keys()], items, sailOpen: this.sailOpen, anchored: this.anchored, energy: this.energy };
    }
  }

  G.Structure = Structure;
  const S = G.structs = {
    T, LH, DECK, list: [], raft: null,
    create(kind, x, y, z, yaw) { const s = new Structure(kind, x, y, z, yaw); this.list.push(s); if (kind === 'raft' && !this.raft) this.raft = s; return s; },
    remove(s) { s.destroy(); this.list.splice(this.list.indexOf(s), 1); if (this.raft === s) this.raft = null; },
    clear() { for (const s of this.list) s.destroy(); this.list = []; this.raft = null; },
    addTile(s, ix, iz, lv, type, hp) { const d = G.BUILD[type]; s.tiles.set(s.key(ix, iz, lv), { type, hp: hp != null ? hp : d.hp, max: d.hp }); s.dirty = true; },
    update(dt) { for (const s of this.list) s.update(dt); },
    starterRaft(x, z) {
      const s = this.create('raft', x, 0, z, 0.4);
      this.addTile(s, 0, 0, 0, 'foundation'); this.addTile(s, 1, 0, 0, 'foundation', 22); this.addTile(s, 0, 1, 0, 'foundation', 18); this.addTile(s, 1, 1, 0, 'foundation');
      s.rebuild(); s.addItem(1, 1, 0, 'radio', 1, { broken: true }); s.rebuild(); return s;
    },
    // nearest structure whose footprint is close to a point
    near(x, z, margin, kinds) { let best = null, bd = 1e9; for (const s of this.list) { if (kinds && !kinds.includes(s.kind)) continue; const d = Math.hypot(x - s.pos.x, z - s.pos.z) - s.radius; if (d < margin && d < bd) { bd = d; best = s; } } return best; },
    // all containers / stations within range of the player (for crafting from storage)
    nearbyItems(x, z, range, fn) { for (const s of this.list) { if (Math.hypot(x - s.pos.x, z - s.pos.z) > s.radius + range) continue; for (const it of s.items.values()) { s.itemWorld(it, _v); if (Math.hypot(_v.x - x, _v.z - z) <= range) fn(it, s); } } },
    serialize() { return this.list.map((s) => s.serialize()); },
    deserialize(arr) {
      this.clear();
      for (const d of arr || []) {
        const s = this.create(d.kind, d.x, d.y, d.z, d.yaw);
        for (const [k, type, hp] of d.tiles) { const def = G.BUILD[type]; if (def) s.tiles.set(k, { type, hp, max: def.hp }); }
        for (const [k, type, open] of d.walls) if (G.BUILD[type]) s.walls.set(k, { type, open: !!open });
        for (const [k, dir] of d.stairs) s.stairs.set(k, { dir }); for (const k of d.roofs) s.roofs.set(k, { type: 'roof' });
        s.sailOpen = !!d.sailOpen; s.anchored = !!d.anchored; s.energy = d.energy || 0;
        for (const it of d.items) { if (!G.BUILD[it.type]) continue; const [ix, iz, lv] = it.k.split(',').map(Number); s.addItem(ix, iz, lv, it.type, it.rot, it.s); }
        s.rebuild();
      }
    }
  };
})();
