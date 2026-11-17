'use strict';
/* Things on the water: drifting debris, the collection hook, fishing, and small boats. */
(function () {
  const G = window.G;
  const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _v = new THREE.Vector3(), _s = { h: 0, nx: 0, nz: 0 };
  const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  // ---------- debris ----------
  const KINDS = {
    plank: { w: 30, loot: () => [['plank', R(1, 2)]], m: (b) => { b.box(0.9, 0.06, 0.2, 0, 0, 0, 'wood', 0.3); b.box(0.7, 0.05, 0.16, 0.1, 0.03, 0.15, 'woodDark', -0.4); } },
    plastic: { w: 22, loot: () => [['plastic', R(1, 2)]], m: (b) => { b.cyl(0.09, 0.09, 0.3, 0, 0.02, 0, 'plastic', 8, 0, 0.5, 1.57); b.box(0.3, 0.03, 0.25, 0.2, 0, 0.1, 'plasticRed', 0.8); } },
    leaf: { w: 16, loot: () => [['palm_leaf', R(1, 2)]], m: (b) => { const g = new THREE.PlaneGeometry(1.5, 0.7); g.rotateX(-Math.PI / 2); b.add(g, 'frond', b.mat4(0, 0.03, 0, 0, 0.5, 0)); } },
    rope: { w: 9, loot: () => Math.random() < 0.5 ? [['rope', 1]] : [['fiber', R(2, 3)]], m: (b) => { const g = new THREE.TorusGeometry(0.18, 0.04, 5, 12); g.rotateX(Math.PI / 2); b.add(g, 'rope', b.mat4(0, 0.02, 0)); } },
    cloth: { w: 7, loot: () => [['cloth', 1]], m: (b) => { b.box(0.6, 0.02, 0.5, 0, 0.02, 0, 'cloth', 0.4); } },
    scrap: { w: 8, loot: () => [['scrap', R(1, 2)], ['nails', R(0, 2)]], m: (b) => { if (G.assets.addTo(b, 'plastic_crate', { size: 0.6 }, 0, -0.16, 0, 0.2, 0, 0.1)) return; b.box(0.5, 0.2, 0.4, 0, 0, 0, 'plastic'); b.box(0.5, 0.03, 0.35, 0.05, 0.12, 0, 'metal', 0.4, 0.2); } },
    bottle: { w: 5, loot: () => Math.random() < 0.22 ? [['bottle', 1], ['treasure_map', 1]] : [['bottle', 1]], m: (b) => { if (G.assets.addTo(b, 'gallon', { size: 0.34 }, 0, 0.08, 0, 0, 0, Math.PI / 2 - 0.2)) return; b.cyl(0.05, 0.05, 0.2, 0, 0.02, 0, 'glass', 8, 0, 0, 1.4); b.cyl(0.02, 0.03, 0.08, 0.13, 0.04, 0, 'glass', 6, 0, 0, 1.4); } },
    coconut: { w: 5, loot: () => [['coconut', 1]], m: (b) => { b.sph(0.13, 0, 0, 0, 'palmTrunk', 1, 1, 1, [0.55, 0.42, 0.3], 7); } },
    seaweed: { w: 5, loot: () => [['seaweed', R(1, 3)]], m: (b) => { const g = new THREE.PlaneGeometry(0.9, 0.9); g.rotateX(-Math.PI / 2); b.add(g, 'kelp', b.mat4(0, 0.02, 0)); } },
    barrel: { w: 5.5, big: 1, loot: () => rolls(4, BARREL), m: (b) => { if (G.assets.addTo(b, 'barrel', { size: 0.95 }, 0, 0.3, 0, 0, 0.4, Math.PI / 2)) return; b.cyl(0.3, 0.3, 0.85, 0, 0.05, 0, 'plastic', 12, 0, 0, 1.57); b.cyl(0.31, 0.31, 0.05, -0.3, 0.05, 0, 'dark', 12, 0, 0, 1.57); b.cyl(0.31, 0.31, 0.05, 0.3, 0.05, 0, 'dark', 12, 0, 0, 1.57); } },
    crate: { w: 2.2, big: 1, loot: () => rolls(5, CRATE), m: (b) => { if (G.assets.addTo(b, Math.random() < 0.5 ? 'crate' : 'crate2', { size: 0.85 }, 0, -0.28, 0, 0.12, 0, 0.05)) return; b.box(0.8, 0.6, 0.6, 0, 0.05, 0, 'wood'); b.box(0.84, 0.08, 0.64, 0, 0.3, 0, 'woodDark'); b.box(0.06, 0.62, 0.64, -0.3, 0.05, 0, 'metal'); b.box(0.06, 0.62, 0.64, 0.3, 0.05, 0, 'metal'); } },
    jerrycan: { w: 3, loot: () => Math.random() < 0.35 ? [['fuel', 1], ['plastic', 2]] : [['plastic', R(2, 3)]], m: (b) => { if (!G.assets.addTo(b, Math.random() < 0.6 ? 'jerrycan' : 'jerrycan_metal', { size: 0.5 }, 0, 0.12, 0, 0, 0, Math.PI / 2)) b.box(0.45, 0.32, 0.18, 0, 0.05, 0, 'plasticRed'); } },
    container: { w: 0, big: 1, loot: () => rolls(10, CRATE).concat(rolls(4, CARGO)), m: (b) => { b.box(2.4, 1.3, 1.2, 0, 0.1, 0, 'metal', 0, 0, 0.12); b.box(0.06, 1.2, 1.1, 1.2, 0.1, 0, 'steel', 0, 0, 0.12); } }
  };
  const BARREL = [[['plank', 2], 4], [['plastic', 3], 4], [['rope', 1], 3], [['cloth', 1], 2.5], [['scrap', 2], 3], [['nails', 4], 2.5], [['potato', 2], 2], [['ration', 1], 1.2], [['rubber', 1], 1.2], [['bottle', 1], 1.2], [['electronics', 1], 0.7], [['seeds_potato', 1], 0.8], [['seeds_flax', 1], 0.8], [['fuel', 1], 0.3], [['bait', 3], 1]];
  const CRATE = [[['electronics', 1], 3], [['wire', 2], 2.5], [['glass', 1], 2.5], [['cloth', 2], 3], [['nails', 6], 3], [['ration', 2], 2], [['bandage', 2], 2], [['scrap', 3], 3], [['rubber', 2], 2], [['machine_part', 1], 0.9], [['treasure_map', 1], 0.5], [['seeds_pineapple', 1], 1], [['seeds_aloe', 1], 1], [['battery', 1], 0.5], [['fuel', 1], 0.8], [['lens', 1], 0.6]];
  const CARGO = [[['machine_part', 2], 2], [['circuit', 1], 1.5], [['steel', 2], 2], [['fuel', 2], 2], [['battery', 1], 1.5], [['medkit', 1], 1]];
  function rolls(n, table) { const out = {}; const k = G.DIFF[G.game.difficulty].loot; n = Math.max(2, Math.round(n * k)); for (let i = 0; i < n; i++) { const [id, q] = G.weighted(Math.random, table); out[id] = (out[id] || 0) + q; } return Object.entries(out); }
  if (G.LOOT_EXTRA) { BARREL.push(...G.LOOT_EXTRA.BARREL); CRATE.push(...G.LOOT_EXTRA.CRATE); }
  G.lootRoll = rolls; G.LOOT = { BARREL, CRATE, CARGO }; G.DEBRIS_KINDS = KINDS;
  const geoCache = {};

  // three-pronged throwing hook: wooden shaft, lashed prongs, rope eye
  G.hookModel = function (sc) {
    const b = new G.MB(), S = sc;
    b.cyl(0.017 * S, 0.021 * S, 0.34 * S, 0, 0.17 * S, 0, 'log', 8);
    for (let i = 0; i < 3; i++) {
      const g = new THREE.TorusGeometry(0.085 * S, 0.0135 * S, 6, 14, Math.PI * 0.86); g.rotateZ(Math.PI); g.translate(0.085 * S, 0.035 * S, 0); g.rotateY(i * 2.0944 + 0.3); b.add(g, 'woodDark', b.mat4(0, 0, 0));
      const tip = new THREE.ConeGeometry(0.0135 * S, 0.05 * S, 6); tip.rotateZ(-0.44); tip.translate(0.172 * S, 0.021 * S, 0); tip.rotateY(i * 2.0944 + 0.3); b.add(tip, 'woodDark', b.mat4(0, 0, 0));
    }
    for (const y of [0.02, 0.05, 0.08]) b.cyl(0.027 * S, 0.027 * S, 0.02 * S, 0, y * S, 0, 'rope', 8);           // lashings holding the prongs
    b.cyl(0.024 * S, 0.024 * S, 0.05 * S, 0, 0.3 * S, 0, 'rope', 8);
    const eye = new THREE.TorusGeometry(0.03 * S, 0.009 * S, 5, 12); eye.translate(0, 0.365 * S, 0); b.add(eye, 'rope', b.mat4(0, 0, 0));
    return b;
  };

  const D = G.debris = {
    list: [], hook: null, hookOut: false, spawnT: 0, boost: 0, radioGiven: false,
    init() {
      this.hookMesh = G.hookModel(1.0).build({ shadow: true }); this.hookMesh.visible = false; G.scene.add(this.hookMesh);
      // rope: a real tube rebuilt every frame along a sagging curve that floats where it meets the water
      const SEG = 22, RS = 5, rg = new THREE.BufferGeometry(), ri = [];
      rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 1) * RS * 3), 3)); rg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array((SEG + 1) * RS * 3), 3));
      const uv = new Float32Array((SEG + 1) * RS * 2); for (let i = 0; i <= SEG; i++) for (let j = 0; j < RS; j++) { uv[(i * RS + j) * 2] = j / RS; uv[(i * RS + j) * 2 + 1] = i * 0.9; } rg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      for (let i = 0; i < SEG; i++) for (let j = 0; j < RS; j++) { const a = i * RS + j, b = i * RS + (j + 1) % RS, c = a + RS, d = b + RS; ri.push(a, c, b, b, c, d); } rg.setIndex(ri);
      this.rope = new THREE.Mesh(rg, G.mats.rope); this.rope.frustumCulled = false; this.rope.visible = false; this.rope.castShadow = true; this.rope.SEG = SEG; this.rope.RS = RS; G.scene.add(this.rope);
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      this.line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x8a7350 })); this.line.frustumCulled = false; this.line.visible = false; G.scene.add(this.line);
    },
    endHook() { this.hook = null; this.hookOut = false; this.hookMesh.visible = false; this.rope.visible = false; },
    spawn(kind, x, z) {
      const K = KINDS[kind]; if (!geoCache[kind]) { const b = new G.MB(); K.m(b); geoCache[kind] = b; }
      const mesh = geoCache[kind].build({ shadow: !!K.big }); mesh.rotation.y = Math.random() * 6.28; G.scene.add(mesh);
      const d = { kind, x, y: 0, z, mesh, r: K.big ? 1.0 : 0.75, reach: 3.4, tag: 'debris', ph: Math.random() * 6, hooked: false };
      d.label = () => 'Grab ' + (kind === 'leaf' ? 'palm fronds' : kind === 'container' ? 'cargo container' : kind); d.use = () => this.collect(d);
      this.list.push(d); G.interact.add(d); return d;
    },
    collect(d) {
      let loot = KINDS[d.kind].loot();
      if (KINDS[d.kind].big && G.quests.needsRadioPart() && !this.radioGiven) { this.radioGiven = true; loot = loot.concat([['radio_part', 1]]); }
      for (const [id, n] of loot) if (n > 0) G.inv.add(id, n);
      G.audio.sfx('pickup'); G.journal.stat('debris'); G.emit('debris', d.kind); this.remove(d);
    },
    remove(d) { G.disposeGroup(d.mesh); G.interact.remove(d); const i = this.list.indexOf(d); if (i >= 0) this.list.splice(i, 1); },
    clear() { for (const d of [...this.list]) this.remove(d); this.endHook(); },
    drift(out) { const W = G.weather; out.x = Math.cos(W.windDir) * (1.05 + W.wind * 0.85) + 0.3; out.y = Math.sin(W.windDir) * (1.05 + W.wind * 0.85) + 0.15; return out; },
    update(dt) {
      const P = G.player, O = G.ocean, dv = this._dv || (this._dv = new THREE.Vector2()); this.drift(dv);
      const deep = G.world.height(P.pos.x, P.pos.z) < -2.5;
      this.spawnT -= dt; this.boost = Math.max(0, this.boost - dt);
      const want = this.boost > 0 ? 30 : 20;
      if (this.spawnT <= 0 && deep && this.list.length < want) {
        this.spawnT = this.boost > 0 ? 0.6 : 1.5 + Math.random() * 2.0; const up = Math.atan2(-dv.y, -dv.x) + (Math.random() - 0.5) * 1.5, r = 55 + Math.random() * 30;
        const raft = G.structs.raft; const vx = raft && P.parent === raft ? raft.vel.x : 0, vz = raft && P.parent === raft ? raft.vel.y : 0;
        const x = P.pos.x + Math.cos(up) * r + vx * 8, z = P.pos.z + Math.sin(up) * r + vz * 8;
        if (G.world.height(x, z) < -1.5) { const tb = Object.keys(KINDS).filter((k) => KINDS[k].w).map((k) => [k, KINDS[k].w]); this.spawn(G.weighted(Math.random, tb), x, z); }
      }
      for (let i = this.list.length - 1; i >= 0; i--) {
        const d = this.list[i];
        if (!d.hooked) { d.x += dv.x * dt; d.z += dv.y * dt; }
        if (G.world.height(d.x, d.z) > -0.4) { d.x -= dv.x * dt; d.z -= dv.y * dt; }
        O.sample(d.x, d.z, _s); d.y = _s.h + 0.02 + Math.sin(O.time * 1.7 + d.ph) * 0.015; d.mesh.position.set(d.x, d.y, d.z); d.mesh.rotation.x = -_s.nz * 0.8 + Math.sin(O.time * 1.1 + d.ph) * 0.05; d.mesh.rotation.z = _s.nx * 0.8; if (!d.hooked) d.mesh.rotation.y += dt * 0.12 * Math.sin(d.ph * 7);
        if (Math.hypot(d.x - P.pos.x, d.z - P.pos.z) > 125) this.remove(d);
      }
      this.updateHook(dt);
    },
    throwHook(power, tier) {
      G.camera.getWorldPosition(_o); G.camera.getWorldDirection(_d); const sp = (13 + power * 17) * (tier ? 1.25 : 1);
      this.hook = { x: _o.x + _d.x * 0.6, y: _o.y - 0.2, z: _o.z + _d.z * 0.6, vx: _d.x * sp, vy: _d.y * sp + 3.5, vz: _d.z * sp, state: 'fly', got: [], tier: tier || 0, t: 0, spd: 0, spin: 0 };
      this.hookOut = true; this.hookMesh.visible = true; this.rope.visible = true; this.pullT = 0; G.audio.sfx('throw');
    },
    reel() { if (this.hook && this.hook.state !== 'fly') { this.hook.state = 'back'; G.audio.sfx('rope'); } },   // haul all the way in without holding
    hold() { this.pullT = 0.12; },                                                                             // called every frame the button is held
    updateHook(dt) {
      const h = this.hook; if (!h) return; const P = G.player, dv = this._dv; h.t += dt; this.pullT = (this.pullT || 0) - dt;
      const dx = P.pos.x - h.x, dz = P.pos.z - h.z, dist = Math.hypot(dx, dz) || 1e-3, ux = dx / dist, uz = dz / dist;
      let slack = 0.02;
      if (h.state === 'fly') {
        h.vy -= 16 * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.z += h.vz * dt; h.spin += dt * 9; const wh = G.ocean.height(h.x, h.z), g = G.world.heightAt(h.x, h.z);
        if (h.y <= wh || h.y <= g) { h.state = g > wh ? 'back' : 'float'; if (g <= wh) { G.fx.splash(h.x, wh, h.z, 12); G.audio.sfx('plop'); } }
        this.hookMesh.rotation.set(h.spin, Math.atan2(h.vx, h.vz), 0.4); slack = 0.05;
      } else {
        const auto = h.state === 'back' || h.t > 75 || dist > 62, pulling = auto || this.pullT > 0;
        if (pulling && !h.wasPull) G.audio.sfx('rope'); h.wasPull = pulling;
        h.spd = G.damp(h.spd, pulling ? (h.tier ? 9.5 : 7.5) : 0, pulling ? 7 : 4, dt);
        h.x += ux * h.spd * dt; h.z += uz * h.spd * dt;
        if (!pulling) { h.x += dv.x * dt * 0.55; h.z += dv.y * dt * 0.55; }          // left alone it rides the current, more slowly than loose debris
        h.y = Math.max(G.ocean.height(h.x, h.z), G.world.heightAt(h.x, h.z));
        // anything the hook touches, floating or on the way back, is snagged and towed behind it
        const rad = h.tier ? 1.5 : 1.15;
        for (const d of this.list) if (!d.hooked && Math.hypot(d.x - h.x, d.z - h.z) < rad + (d.r - 0.75)) { d.hooked = true; d.hy = d.mesh.rotation.y; h.got.push(d); G.audio.sfx('snag'); G.fx.splash(d.x, h.y, d.z, 3); }
        for (let i = 0; i < h.got.length; i++) {
          const d = h.got[i], k = 0.4 + Math.floor(i / 2) * 0.5 + (i & 1) * 0.2, sd = (i & 1 ? 1 : -1) * Math.min(0.22 + i * 0.03, 0.4);
          d.x = G.damp(d.x, h.x - ux * k - uz * sd, 9, dt); d.z = G.damp(d.z, h.z - uz * k + ux * sd, 9, dt);
        }
        if (h.spd > 2.5 && Math.random() < dt * (8 + h.got.length * 4)) G.fx.splash(h.x - ux * 0.3, h.y, h.z - uz * 0.3, 1);
        if (pulling && dist < 2.0) { for (const d of h.got) if (this.list.includes(d)) this.collect(d); this.endHook(); return; }
        // lies on its side in the water, shaft pointing down the rope
        this.hookMesh.rotation.set(0, Math.atan2(ux, uz), 0); this.hookMesh.rotateX(-1.25 + Math.sin(G.ocean.time * 2 + h.t) * 0.08);
        slack = pulling ? 0.015 : 0.09;
      }
      this.hookMesh.position.set(h.x, h.y + (h.state === 'fly' ? 0 : 0.03), h.z);
      this.setRope(h.x, h.y + 0.04, h.z, slack);
    },
    setRope(x, y, z, slack) {
      const R = this.rope, SEG = R.SEG, RS = R.RS, P = R.geometry.attributes.position, Nn = R.geometry.attributes.normal, O = G.ocean;
      G.actions.handRoot.getWorldPosition(_v); const ax = _v.x, ay = _v.y + 0.05, az = _v.z, len = Math.hypot(x - ax, y - ay, z - az), sag = Math.min(len * slack * 4, 2.5), rr = 0.014;
      let px = ax, py = ay, pz = az;
      for (let i = 0; i <= SEG; i++) {
        const t = i / SEG, cx = ax + (x - ax) * t, cz = az + (z - az) * t; let cy = ay + (y - ay) * t - sag * 4 * t * (1 - t);
        if (i > 1 && i < SEG) { const wh = O.height(cx, cz) + 0.012; if (cy < wh) cy = wh; }
        // frame from the previous point
        let tx = cx - px, ty = cy - py, tz = cz - pz; if (i === 0) { tx = x - ax; ty = y - ay - sag * 4; tz = z - az; } const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
        let sx = tz, sz = -tx; const sl = Math.hypot(sx, sz) || 1; sx /= sl; sz /= sl; const ux = -ty * sz, uy = tx * sz - tz * sx, uz = ty * sx; // side = t x up, up2 = side x t
        for (let j = 0; j < RS; j++) {
          const a = j / RS * 6.2832, c = Math.cos(a), s2 = Math.sin(a), nx = sx * c + ux * s2, ny = uy * s2, nz = sz * c + uz * s2, o = i * RS + j;
          P.setXYZ(o, cx + nx * rr, cy + ny * rr, cz + nz * rr); Nn.setXYZ(o, nx, ny, nz);
        }
        px = cx; py = cy; pz = cz;
      }
      P.needsUpdate = true; Nn.needsUpdate = true;
    },
    setLine(line, x, y, z) { const p = line.geometry.attributes.position; G.actions.handRoot.getWorldPosition(_v); p.setXYZ(0, _v.x, _v.y + 0.1, _v.z); p.setXYZ(1, x, y, z); p.needsUpdate = true; }
  };

  // ---------- fishing ----------
  const F = G.fishing = {
    active: false, state: 'idle', bob: null, fish: null, tension: 0, progress: 0,
    init() {
      const b = new G.MB(); b.sph(0.06, 0, 0, 0, 'plasticRed', 1, 1, 1, null, 8); b.sph(0.045, 0, 0.05, 0, 'cloth', 1, 1, 1, null, 8); this.mesh = b.build({ shadow: false }); this.mesh.visible = false; G.scene.add(this.mesh);
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)); this.line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.6 })); this.line.frustumCulled = false; this.line.visible = false; this.line.layers.set(1); G.scene.add(this.line);
    },
    habitat(x, z) {
      const depth = -G.world.height(x, z), I = G.world.nearest; const tags = [];
      if (G.wsim.eye > 0.5) tags.push('eye');
      if (I && I.biome === 'mangrove' && I._d < 140) tags.push('mangrove'); else if (depth < 9) tags.push('lagoon'); else if (depth < 30) tags.push('reef'); else if (depth > 72) tags.push('deep'); else tags.push('open');
      if (G.weather.storm > 0.5) tags.push('storm'); return tags;
    },
    pick(x, z, lure, tier) {
      const tags = this.habitat(x, z), night = G.sky.night > 0.5; const tb = [];
      for (const k in G.FISH) { const f = G.FISH[k]; if (!f.hab.some((h) => tags.includes(h))) continue; if (f.when === 'day' && night) continue; if (f.when === 'night' && !night) continue; let w = [0, 60, 24, 8, 2.2][f.r]; if (lure && f.r >= 3) w *= 2.5; if (f.r === 4 && !tier) w *= 0.35; w *= 1 + (f.r > 1 ? G.skills.level('fishing') * 0.08 : 0); if (tags.includes('eye') && f.hab.includes('eye')) w *= 12; tb.push([f, w]); }
      if (!tb.length) return null; const f = G.weighted(Math.random, tb); const u = Math.pow(Math.random(), 1.8 - G.skills.level('fishing') * 0.05); return { f, cm: Math.round(G.lerp(f.a, f.b, u)) };
    },
    cast(tier) {
      const P = G.player; if (this.active) return; G.camera.getWorldPosition(_o); G.camera.getWorldDirection(_d);
      if (_d.y > 0.5) return G.ui.toast('Aim at the water.'); const dist = 7 + (1 - Math.abs(_d.y)) * 9; const hx = Math.hypot(_d.x, _d.z) || 1;
      const x = _o.x + _d.x / hx * dist, z = _o.z + _d.z / hx * dist; if (G.world.height(x, z) > -0.9) return G.ui.toast('Too shallow. Cast into deeper water.');
      if (P.swimming) return G.ui.toast('You cannot cast while swimming.');
      const lure = G.inv.count('lure') > 0, bait = !lure && G.inv.count('bait') > 0; if (lure) G.inv.remove('lure', 1); else if (bait) G.inv.remove('bait', 1);
      const base = (bait || lure ? 5 : 11) + Math.random() * (bait || lure ? 7 : 13);
      this.active = true; this.state = 'wait'; this.tier = tier; this.lure = lure; this.bob = { x, z, y: 0, dip: 0 }; this.t = base * (1 - G.skills.level('fishing') * 0.04) * (G.weather.rain > 0.3 ? 0.8 : 1); this.mesh.visible = true; this.line.visible = true;
      G.audio.sfx('cast'); G.player.swingT = 1; G.fx.splash(x, G.ocean.height(x, z), z, 6); G.emit('cast');
      if (!bait && !lure && !this._hint) { this._hint = true; G.ui.toast('Cast without bait — fish will take longer to bite.'); }
    },
    cancel() { this.active = false; this.state = 'idle'; this.mesh.visible = false; this.line.visible = false; G.ui.fishing(null); },
    input(down, pressed) {
      if (this.state === 'wait' && pressed) { this.cancel(); G.audio.sfx('rope'); }
      else if (this.state === 'bite' && pressed) { this.state = 'fight'; this.tension = 0.25; this.progress = 0.12; this.surge = 0; this.surgeT = 2; G.audio.sfx('snag'); }
      else if (this.state === 'fight') this.reeling = down;
    },
    update(dt) {
      if (!this.active) return; const P = G.player, b = this.bob; b.y = G.ocean.height(b.x, b.z) - b.dip; this.mesh.position.set(b.x, b.y + 0.03, b.z); G.debris.setLine(this.line, b.x, b.y + 0.05, b.z);
      if (Math.hypot(b.x - P.pos.x, b.z - P.pos.z) > 30 || P.swimming) return this.cancel();
      if (this.state === 'wait') { this.t -= dt; b.dip = 0; if (this.t <= 0) { this.fish = this.pick(b.x, b.z, this.lure, this.tier); if (!this.fish) { this.t = 8; return; } this.state = 'bite'; this.t = 1.7; G.audio.sfx('bite'); G.fx.splash(b.x, b.y, b.z, 8); G.ui.fishing({ bite: true }); } }
      else if (this.state === 'bite') { b.dip = 0.12 + Math.sin(G.uni.uTime.value * 30) * 0.05; this.t -= dt; if (this.t <= 0) { this.state = 'wait'; this.t = 6 + Math.random() * 8; G.ui.fishing(null); G.ui.toast('It got away. Click as soon as the float dips.'); } }
      else if (this.state === 'fight') {
        const f = this.fish, size = f.cm / 100, hard = (0.55 + size * 0.5 + f.f.r * 0.14) * (this.tier ? 0.62 : 1) * (1 - G.skills.level('fishing') * 0.035);
        this.surgeT -= dt; if (this.surgeT <= 0) { this.surge = this.surge > 0 ? 0 : 1; this.surgeT = this.surge ? 0.9 + Math.random() * 1.3 : 1.4 + Math.random() * 2.2; if (this.surge) G.fx.splash(b.x, b.y, b.z, 5); }
        if (this.reeling) { this.progress += dt * (0.2 / hard) * (this.surge ? 0.25 : 1); this.tension += dt * (0.2 + hard * 0.2 + this.surge * hard * 0.75); }
        else { this.tension -= dt * 0.5; this.progress -= dt * (0.035 + this.surge * 0.07) * hard; }
        this.tension = Math.max(0, this.tension); this.progress = Math.max(0, this.progress); b.dip = 0.1;
        const t = G.clamp(this.progress, 0, 1); b.x = G.lerp(b.x, P.pos.x, dt * 0.25 * t); b.z = G.lerp(b.z, P.pos.z, dt * 0.25 * t);
        G.ui.fishing({ tension: this.tension, progress: this.progress, surge: this.surge, name: '???' });
        if (this.tension >= 1) { G.ui.toast('The line snapped!', 'bad'); G.audio.sfx('break'); G.inv.wear(G.inv.sel, 6); return this.cancel(); }
        if (this.progress <= 0) { G.ui.toast('The fish threw the hook.'); return this.cancel(); }
        if (this.progress >= 1) return this.land();
      }
    },
    land() {
      const f = this.fish; this.cancel(); const small = f.cm < 45; const n = small ? (f.cm > 28 ? 2 : 1) : Math.min(7, Math.ceil(f.cm / 45));
      G.inv.add(small ? 'raw_fish' : 'raw_fillet', n); if (f.f.r >= 3 && Math.random() < 0.5) G.inv.add('bone', 1);
      const first = G.journal.logFish(f.f.id, f.cm); G.skills.xp('fishing', 8 + f.f.r * 8 + f.cm * 0.05); G.inv.wear(G.inv.sel, 1);
      G.ui.banner(f.f.n + ' — ' + f.cm + ' cm', first ? 'New species!' : ['', 'Common catch', 'Uncommon catch', 'Rare catch', 'Legendary catch'][f.f.r]); G.audio.sfx(f.f.r >= 3 ? 'discover' : 'catch');
      if (f.f.r === 4) G.journal.achieve('legend_' + f.f.id, 'Landed a ' + f.f.n);
    }
  };

  // ---------- boats ----------
  const BOATS = {
    rowboat: { n: 'Rowboat', len: 2.0, wid: 0.75, speed: 4.6, turn: 1.3, store: 6 }, sailboat: { n: 'Sailing Dinghy', len: 2.7, wid: 0.95, speed: 9.5, turn: 1.0, store: 14, sail: true },
    skiff: { n: 'Motor Skiff', len: 2.6, wid: 0.95, speed: 14, turn: 1.25, store: 10, motor: true }
  };
  function boatModel(type) {
    const B = BOATS[type], b = new G.MB();
    const hull = new THREE.SphereGeometry(1, 14, 10); const p = hull.attributes.position;
    for (let i = 0; i < p.count; i++) { let y = p.getY(i); const z = p.getZ(i); if (y > 0.05) y = 0.05; p.setXYZ(i, p.getX(i) * B.wid * (1 - Math.max(0, -z) * 0.35), y * 0.55 + 0.22, z * B.len); }
    hull.computeVertexNormals(); b.add(hull, type === 'skiff' ? 'steel' : 'wood');
    b.box(B.wid * 1.5, 0.04, B.len * 1.5, 0, 0.0, 0, 'woodDark'); b.box(B.wid * 1.6, 0.05, 0.25, 0, 0.2, 0.5, 'wood'); b.box(B.wid * 1.4, 0.05, 0.25, 0, 0.2, -0.6, 'wood');
    if (type === 'rowboat') { b.beam(-B.wid, 0.3, 0, -B.wid - 1.0, 0.05, 0.3, 0.025, 'log', 5); b.beam(B.wid, 0.3, 0, B.wid + 1.0, 0.05, 0.3, 0.025, 'log', 5); }
    if (B.sail) { b.cyl(0.04, 0.06, 4.2, 0, 2.2, -0.5, 'log', 7); const g = new THREE.PlaneGeometry(1.9, 3.2); g.translate(0.95, 0, 0); b.add(g, 'cloth', b.mat4(0, 2.5, -0.5, 0, -1.3, 0)); b.beam(0, 0.95, -0.5, 0.5, 0.95, 1.4, 0.03, 'log', 5); }
    if (B.motor) { b.box(0.3, 0.45, 0.35, 0, 0.5, B.len - 0.15, 'plasticRed'); b.cyl(0.04, 0.04, 0.8, 0, 0.0, B.len, 'metal', 6); b.box(B.wid * 1.2, 0.5, 0.06, 0, 0.55, -0.9, 'glass'); }
    return b.build();
  }
  const V = G.vehicles = {
    list: [], current: null, BOATS, model: boatModel,
    spawn(type, x, z, yaw, state) {
      const v = { type, x, y: 0, z, yaw: yaw || 0, speed: 0, mesh: boatModel(type), tag: 'boat', r: 1.5, reach: 4, c: { slots: (state && state.c) || new Array(BOATS[type].store).fill(null) }, fuel: state ? state.fuel || 0 : 0, tilt: new THREE.Vector2() };
      G.scene.add(v.mesh); v.label = () => V.current === v ? '' : 'Board ' + BOATS[type].n + '  ·  hold Shift+E for cargo'; v.use = () => { if (G.input.keys.ShiftLeft) return G.ui.open('storage', { s: v, type: 'boat', name: BOATS[type].n }); this.board(v); };
      this.list.push(v); G.interact.add(v); return v;
    },
    deploy(type) {
      const P = G.player; G.camera.getWorldDirection(_d); const x = P.pos.x + _d.x * 3.5, z = P.pos.z + _d.z * 3.5;
      if (G.world.height(x, z) > -0.8) { G.ui.toast('Launch it on water at least waist deep — face the sea.', 'bad'); return false; }
      this.spawn(type, x, z, P.yaw); G.audio.sfx('splash'); G.fx.splash(x, 0, z, 20); G.ui.toast(BOATS[type].n + ' launched. Interact to board.', 'good'); G.emit('boat', type); return true;
    },
    board(v) { const P = G.player; if (P.mode !== 'walk') return; this.current = v; P.mode = 'boat'; P.parent = null; P.vel.set(0, 0, 0); P.swimming = false; G.ui.toast('W/S ' + (BOATS[v.type].motor ? 'throttle' : BOATS[v.type].sail ? 'trim sail' : 'row') + ', A/D steer, E to step out.'); G.audio.sfx('stepwood'); },
    leave() {
      const P = G.player, v = this.current; if (!v) return; this.current = null; P.mode = 'walk';
      let bx = v.x - Math.cos(v.yaw) * 1.6, bz = v.z + Math.sin(v.yaw) * 1.6;
      for (let a = 0; a < 8; a++) { const x = v.x + Math.cos(a * 0.785) * 2.6, z = v.z + Math.sin(a * 0.785) * 2.6; if (G.world.heightAt(x, z) > -0.9) { bx = x; bz = z; break; } }
      const st = G.structs.near(v.x, v.z, 3.5, ['raft', 'base']); if (st) { let bd = 1e9; for (const k of st.tiles.keys()) { const [ix, iz, lv] = k.split(',').map(Number); if (lv) continue; st.toWorld(ix * G.structs.T, st.floorY(0), iz * G.structs.T, _v); const d = Math.hypot(_v.x - v.x, _v.z - v.z); if (d < bd) { bd = d; bx = _v.x; bz = _v.z; P.pos.y = _v.y + 0.05; } } P.pos.x = bx; P.pos.z = bz; P.parent = st; st.toLocal(P.pos.x, P.pos.y, P.pos.z, P.local); P.onGround = true; return; }
      P.pos.set(bx, Math.max(G.world.heightAt(bx, bz), G.ocean.height(bx, bz) - 1.3), bz); P.onGround = false; P.groundY = G.world.heightAt(bx, bz);
    },
    drive(dt, ctl) {
      const v = this.current, P = G.player, I = G.input, B = BOATS[v.type], W = G.weather; let thr = 0, steer = 0;
      if (ctl) { thr = (I.down('forward') ? 1 : 0) - (I.down('back') ? 0.5 : 0); steer = (I.down('left') ? 1 : 0) - (I.down('right') ? 1 : 0); if (I.hit('interact')) { I.pressed = {}; return this.leave(); } }
      let target = 0; const fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw), skill = 1 + G.skills.level('sailing') * 0.04;
      if (B.motor) { if (v.fuel > 0) { target = thr * B.speed; v.fuel = Math.max(0, v.fuel - Math.abs(thr) * dt / 7); } else if (thr && !v._nf) { v._nf = true; G.ui.toast('Out of fuel. Hold a biofuel can and press F to refuel.', 'bad'); } }
      else if (B.sail) { const al = fx * Math.cos(W.windDir) + fz * Math.sin(W.windDir); const eff = al < -0.6 ? 0.2 : 0.5 + 0.5 * Math.max(0, al); target = thr > 0 ? B.speed * eff * (0.35 + W.wind * 0.75) : thr * 1.5; }
      else { if (thr && P.stamina > 2) { target = thr * B.speed; P.stamina -= dt * 3.2; } }
      if (ctl && I.hit('light') && B.motor) { const h = G.inv.held(); if (h && h.id === 'fuel') { G.inv.removeAt(G.inv.sel, 1); v.fuel = Math.min(100, v.fuel + 50); v._nf = false; G.ui.toast('Refuelled.'); } }
      v.speed = G.damp(v.speed, target * skill, 0.9, dt); v.yaw += steer * B.turn * dt * G.clamp(Math.abs(v.speed) / 3 + 0.25, 0.25, 1);
      const nx = v.x + fx * v.speed * dt, nz = v.z + fz * v.speed * dt;
      if (G.world.height(nx + fx * B.len, nz + fz * B.len) < -0.45 && G.world.height(nx, nz) < -0.45) { v.x = nx; v.z = nz; } else { v.speed *= 0.5; }
      for (const st of G.structs.list) { if (st.kind === 'ground') continue; const d = Math.hypot(v.x - st.pos.x, v.z - st.pos.z); if (d < st.radius + 0.6) { v.x += (v.x - st.pos.x) / d * dt * 3; v.z += (v.z - st.pos.z) / d * dt * 3; v.speed *= 0.9; } }
      if (Math.abs(v.speed) > 1.5) { G.skills.xp('sailing', dt * 0.6); if (Math.random() < dt * 6) G.fx.splash(v.x - fx * B.len, v.y, v.z - fz * B.len, 2); }
      P.pos.set(v.x - fx * 0.3, v.y + 0.25, v.z - fz * 0.3); P.onGround = true; P.eye = 1.15;
    },
    update(dt) {
      for (const v of this.list) {
        G.ocean.sample(v.x, v.z, _s); v.y = G.damp(v.y, _s.h, 8, dt); const c = Math.cos(v.yaw), s = Math.sin(v.yaw), lx = _s.nx * c - _s.nz * s, lz = _s.nx * s + _s.nz * c;
        v.tilt.x = G.damp(v.tilt.x, G.clamp(-lz * 0.8, -0.3, 0.3), 4, dt); v.tilt.y = G.damp(v.tilt.y, G.clamp(lx * 0.8, -0.3, 0.3), 4, dt);
        if (this.current !== v && G.world.height(v.x, v.z) < -1) { /* moored: holds position */ }
        v.mesh.position.set(v.x, v.y, v.z); v.mesh.rotation.set(v.tilt.x, v.yaw, v.tilt.y, 'YXZ');
      }
    },
    clear() { for (const v of this.list) { G.disposeGroup(v.mesh); G.interact.remove(v); } this.list = []; this.current = null; },
    serialize() { return this.list.map((v) => ({ type: v.type, x: v.x, z: v.z, yaw: v.yaw, c: v.c.slots, fuel: v.fuel })); },
    deserialize(a) { this.clear(); for (const d of a || []) if (BOATS[d.type]) this.spawn(d.type, d.x, d.z, d.yaw, d); }
  };
})();
