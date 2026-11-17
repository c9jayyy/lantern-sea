'use strict';
/* Points of interest: island sites (camps, ponds, ruins, villages, labs, lantern stations) and ocean locations
   (wrecks, reefs, kelp forests, drifting yachts, buoys, rigs, the Deepwell lab, the Keystone platform). */
(function () {
  const G = window.G;
  const PI = Math.PI;
  const LOOT = {
    camp: [[['rope', 2], 3], [['cloth', 2], 3], [['ration', 1], 2.5], [['bandage', 1], 2.5], [['bottle', 1], 2], [['plank', 4], 3], [['nails', 5], 2.5], [['flint', 2], 2], [['seeds_potato', 2], 1.5], [['torch', 1], 1.5], [['stick', 4], 2], [['coconut', 2], 2], [['treasure_map', 1], 0.6], [['feather', 3], 1.5], [['bait', 4], 1.5], [['glass', 1], 1.2], [['scrap', 2], 2]],
    village: [[['cloth', 3], 3], [['nails', 8], 3], [['scrap', 3], 3], [['rope', 3], 3], [['glass', 2], 2.5], [['bottle', 1], 2], [['seeds_pineapple', 2], 1.5], [['seeds_aloe', 2], 1.5], [['seeds_flax', 2], 1.5], [['ration', 2], 2], [['salt', 3], 2], [['brick', 4], 2], [['hide', 1], 1.5], [['lure', 2], 1.5], [['rubber', 2], 1.5], [['wire', 2], 1.2], [['treasure_map', 1], 0.5], [['plastic', 4], 2]],
    lab: [[['electronics', 2], 4], [['wire', 3], 3], [['glass', 2], 3], [['lens', 1], 2], [['battery', 1], 1.6], [['circuit', 1], 1.0], [['bandage', 2], 2], [['medkit', 1], 0.6], [['plastic', 4], 2.5], [['rubber', 2], 2.5], [['machine_part', 1], 1.6], [['fuel', 1], 1.5], [['antidote', 1], 1.2], [['steel', 1], 0.8]],
    wreck: [[['scrap', 4], 4], [['nails', 6], 3], [['machine_part', 1], 2.2], [['rubber', 2], 2.5], [['electronics', 2], 2.2], [['wire', 2], 2], [['rope', 2], 2], [['cloth', 2], 2], [['fuel', 1], 1.6], [['steel', 1], 1.2], [['bottle', 1], 1.5], [['ration', 2], 1.5], [['pearl', 1], 0.5], [['treasure_map', 1], 0.6], [['glass', 2], 1.6], [['battery', 1], 0.8]],
    ruin: [[['pearl', 1], 2], [['relic', 1], 2.5], [['obsidian', 2], 2], [['bone', 3], 2], [['shell', 4], 2], [['brick', 4], 2], [['treasure_map', 1], 1.2], [['clay', 4], 1.5]],
    deep: [[['titanium', 1], 3], [['circuit', 1], 2.5], [['battery', 1], 2.5], [['machine_part', 2], 2.5], [['steel', 2], 2.5], [['medkit', 1], 1.2], [['lens', 2], 1.5], [['fuel', 2], 1.5]],
    chest: [[['pearl', 2], 3], [['relic', 1], 2.5], [['brass_dummy', 0], 0], [['lens', 1], 1.5], [['steel', 2], 1.5], [['battery', 1], 1.2], [['machine_part', 2], 2], [['obsidian', 3], 1.5], [['medkit', 1], 1], [['fuel', 2], 1.5]]
  };
  LOOT.chest = LOOT.chest.filter((e) => e[1] > 0); G.LOOT_SITES = LOOT;
  const POOL = { camp: ['camp_a', 'camp_b', 'camp_c', 'camp_d'], village: ['village_a', 'village_b', 'village_c'], ruin: ['ruin_a', 'ruin_b'], lab: ['lab_a', 'lab_b', 'lab_c'], wreck: ['wreck_a', 'wreck_b'], plane: ['plane_a'], yacht: ['yacht_a'], buoy: ['buoy_a'], rig: ['rig_a'] };

  class Ctx {
    constructor(owner) { this.owner = owner; this.tag = owner.id; this.b = new G.MB(); this.boxes = []; this.group = new THREE.Group(); this.cos = 1; this.sin = 0; this.ox = 0; this.oy = 0; this.oz = 0; this.rot = 0; this.n = 0; }
    at(x, y, z, rot) { this.ox = x; this.oy = y; this.oz = z; this.rot = rot || 0; this.cos = Math.cos(this.rot); this.sin = Math.sin(this.rot); return this; }
    wx(lx, lz) { return this.ox + lx * this.cos + lz * this.sin; } wz(lx, lz) { return this.oz - lx * this.sin + lz * this.cos; }
    box(w, h, d, lx, ly, lz, mat, ry, rx, rz, col) { this.b.box(w, h, d, this.wx(lx, lz), this.oy + ly, this.wz(lx, lz), mat, this.rot + (ry || 0), rx, rz, col); return this; }
    cyl(rt, rb, h, lx, ly, lz, mat, seg, rx, ry, rz, col) { this.b.cyl(rt, rb, h, this.wx(lx, lz), this.oy + ly, this.wz(lx, lz), mat, seg, rx, this.rot + (ry || 0), rz, col); return this; }
    sph(r, lx, ly, lz, mat, sx, sy, sz, col, seg) { this.b.add(G.geo.sph(seg || 8), mat, this.b.mat4(this.wx(lx, lz), this.oy + ly, this.wz(lx, lz), 0, this.rot, 0, r * (sx || 1), r * (sy || 1), r * (sz || 1)), col); return this; }
    beam(ax, ay, az, bx, by, bz, r, mat, seg) { this.b.beam(this.wx(ax, az), this.oy + ay, this.wz(ax, az), this.wx(bx, bz), this.oy + by, this.wz(bx, bz), r, mat, seg); return this; }
    geo(g, mat, lx, ly, lz, ry, s, col, rx) { this.b.add(g, mat, this.b.mat4(this.wx(lx, lz), this.oy + ly, this.wz(lx, lz), rx || 0, this.rot + (ry || 0), 0, s || 1), col); return this; }
    solid(lx, ly, lz, hx, hy, hz, ry, extra) { const a = this.rot + (ry || 0); this.boxes.push(Object.assign({ x: this.wx(lx, lz), y: this.oy + ly, z: this.wz(lx, lz), hx, hy, hz, c: Math.cos(a), s: Math.sin(a) }, extra)); return this; }
    // box that is both drawn and solid
    wall(w, h, d, lx, ly, lz, mat, ry) { this.box(w, h, d, lx, ly, lz, mat, ry); return this.solid(lx, ly, lz, w / 2, h / 2, d / 2, ry); }
    ramp(w, len, rise, lx, ly, lz, mat, ry) { // rises toward local -z of the ramp
      const a = Math.atan2(rise, len), L = Math.hypot(len, rise); this.box(w, 0.1, L, lx, ly + rise / 2, lz, mat, ry, a);
      const yaw = this.rot + (ry || 0); this.boxes.push({ x: this.wx(lx, lz), y: this.oy + ly + rise / 2, z: this.wz(lx, lz), hx: w / 2, hy: rise / 2 + 0.3, hz: len / 2, c: Math.cos(yaw), s: Math.sin(yaw), ramp: rise, base: this.oy + ly }); return this;
    }
    inter(lx, ly, lz, o) { o.x = this.wx(lx, lz); o.y = this.oy + ly; o.z = this.wz(lx, lz); o.tag = this.tag; G.interact.add(o); return o; }
    id(prefix) { return this.owner.id + ':' + prefix + (this.n++); }
    container(kind, lx, ly, lz, ry, table, rollsN, opts) {
      const id = this.id('c'), name = { crate: 'crate', locker: 'locker', chest: 'old chest', case: 'equipment case', barrel: 'barrel' }[kind];
      if (kind === 'crate') { this.box(0.8, 0.55, 0.6, lx, ly + 0.28, lz, 'wood', ry); this.box(0.84, 0.07, 0.64, lx, ly + 0.57, lz, 'woodDark', ry); }
      else if (kind === 'locker') { this.box(0.7, 1.5, 0.5, lx, ly + 0.75, lz, 'metal', ry); this.box(0.6, 1.3, 0.03, lx + Math.sin(ry || 0) * 0.25, ly + 0.75, lz + Math.cos(ry || 0) * 0.25, 'steel', ry); }
      else if (kind === 'chest') { this.box(0.8, 0.4, 0.5, lx, ly + 0.2, lz, 'woodDark', ry); this.cyl(0.25, 0.25, 0.8, lx, ly + 0.4, lz, 'woodDark', 8, 0, ry, PI / 2); this.box(0.84, 0.06, 0.54, lx, ly + 0.38, lz, 'brass', ry); }
      else if (kind === 'case') { this.box(0.7, 0.3, 0.45, lx, ly + 0.15, lz, 'plasticYellow', ry); this.box(0.2, 0.05, 0.05, lx, ly + 0.32, lz, 'dark', ry); }
      else { this.cyl(0.28, 0.28, 0.8, lx, ly + 0.4, lz, 'metal', 10); }
      if (kind !== 'case') this.solid(lx, ly + 0.4, lz, 0.4, kind === 'locker' ? 0.75 : 0.4, 0.3, ry);
      const o = this.inter(lx, ly + 0.5, lz, { r: 0.7, id, label: () => G.world.opened[id] ? 'Empty ' + name : 'Search ' + name });
      o.use = () => {
        if (G.world.opened[id]) return G.ui.toast('Nothing left.'); if (opts && opts.key && G.inv.count(opts.key) < 1) return G.ui.toast('Locked. It needs ' + G.ITEMS[opts.key].n + '.', 'bad');
        G.world.opened[id] = 1; let loot = table ? G.lootRoll(rollsN || 3, table) : []; if (opts && opts.fixed) loot = loot.concat(opts.fixed);
        for (const [it, q] of loot) if (q > 0 && G.ITEMS[it]) G.inv.add(it, q); G.audio.sfx('open'); G.journal.stat('containers'); G.emit('looted', id, opts && opts.flag);
      }; return o;
    }
    note(noteId, lx, ly, lz, kind) {
      if (kind === 'tape') { this.box(0.22, 0.07, 0.14, lx, ly + 0.035, lz, 'dark', 0.3); this.box(0.1, 0.02, 0.06, lx, ly + 0.075, lz, 'screen', 0.3); } else this.box(0.24, 0.02, 0.32, lx, ly + 0.012, lz, 'cloth', 0.4);
      this.inter(lx, ly + 0.1, lz, { r: 0.5, label: () => (kind === 'tape' ? 'Play recording' : 'Read') + ': ' + G.NOTES[noteId].t, use: () => G.quests.readNote(noteId) });
    }
    npc(npcId, lx, ly, lz, ry) {
      const N = G.NPCS[npcId], b = new G.MB(), L = N.look;
      for (const s of [-1, 1]) { b.cyl(0.075, 0.065, 0.82, s * 0.1, 0.41, 0, L.pants, 7); b.box(0.11, 0.07, 0.24, s * 0.1, 0.035, 0.05, 'dark'); b.cyl(0.05, 0.045, 0.62, s * 0.27, 1.12, 0.02, L.shirt, 6, 0.08, 0, s * 0.12); b.sph(0.05, s * 0.3, 0.8, 0.05, 'skin', 1, 1, 1, null, 6); }
      b.cyl(0.17, 0.2, 0.62, 0, 1.13, 0, L.shirt, 9); b.sph(0.2, 0, 1.42, 0, L.shirt, 1, 0.45, 0.72, null, 8); b.cyl(0.055, 0.06, 0.1, 0, 1.5, 0, 'skin', 7); b.sph(0.115, 0, 1.64, 0, 'skin', 0.92, 1.08, 1, null, 10);
      if (L.hat === 'hat') { b.cyl(0.24, 0.26, 0.02, 0, 1.72, 0, 'thatch', 12); b.cyl(0.11, 0.13, 0.1, 0, 1.77, 0, 'thatch', 10); } else if (L.hat === 'cap') { b.sph(0.12, 0, 1.69, 0, L.pants, 1, 0.6, 1.05, null, 8); b.box(0.16, 0.015, 0.12, 0, 1.69, 0.13, L.pants); } else b.sph(0.12, 0, 1.68, -0.015, 'dark', 1, 0.75, 1.02, L.hair || [0.3, 0.2, 0.1], 8);
      if (L.beard) b.sph(0.08, 0, 1.57, 0.06, 'dark', 1, 0.8, 0.8, null, 6);
      const g = b.build(); g.position.set(this.wx(lx, lz), this.oy + ly, this.wz(lx, lz)); g.rotation.y = this.rot + (ry || 0); this.group.add(g);
      const o = this.inter(lx, ly + 1.3, lz, { r: 0.8, reach: 3.6, label: () => 'Talk to ' + N.n, use: () => G.ui.open('dialogue', npcId), npc: g }); this.npcs = this.npcs || []; this.npcs.push({ g, o }); this.solid(lx, ly + 0.9, lz, 0.25, 0.9, 0.25, 0); return o;
    }
    flame(lx, ly, lz, size) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.dot, color: 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sp.position.set(this.wx(lx, lz), this.oy + ly, this.wz(lx, lz)); sp.scale.set(size, size * 1.3, 1); sp.layers.set(1); this.group.add(sp); return sp; }
    finish(cx, cz, r) { const m = this.b.build(); this.group.add(m); G.scene.add(this.group); this.set = { x: cx, z: cz, r, boxes: this.boxes }; G.collide.sets.push(this.set); return this; }
    dispose() { G.interact.removeTag(this.tag); const i = G.collide.sets.indexOf(this.set); if (i >= 0) G.collide.sets.splice(i, 1); this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); G.scene.remove(this.group); }
  }

  // ---------- reusable props (local coordinates of the current frame) ----------
  const PROP = {
    firepit(c, x, z, lit) { for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; c.geo(G.nodeGeo._rock0.rockObj, 'rockObj', x + Math.cos(a) * 0.5, 0.06, z + Math.sin(a) * 0.5, a, 0.16); } c.cyl(0.05, 0.06, 0.7, x, 0.1, z, 'log', 6, 0, 0.4, 1.3).cyl(0.05, 0.06, 0.7, x, 0.1, z, 'log', 6, 0, 2.2, 1.3).cyl(0.4, 0.45, 0.04, x, 0.02, z, 'dark', 9); if (lit) c.flame(x, 0.5, z, 1.1); },
    tent(c, x, z, ry, mat) { const cs = Math.cos(ry), sn = Math.sin(ry), L = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs]; for (const s of [-1, 1]) { const [px, pz] = L(s * 0.62, 0); c.box(1.5, 0.04, 2.4, px, 0.72, pz, mat || 'fabricTan', ry, 0, s * -0.86); } const [a1, a2] = L(0, -1.2), [b1, b2] = L(0, 1.2); c.beam(a1, 0, a2, a1, 1.42, a2, 0.03, 'log', 5).beam(b1, 0, b2, b1, 1.42, b2, 0.03, 'log', 5).beam(a1, 1.4, a2, b1, 1.4, b2, 0.025, 'log', 5); c.box(1.6, 0.04, 2.0, x, 0.03, z, 'thatch', ry); },
    hut(c, x, z, ry, opts) {
      opts = opts || {}; const cs = Math.cos(ry), sn = Math.sin(ry), L = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs]; const W2 = 2.1, D2 = 1.8, H = 2.4, wm = opts.mat || 'wood';
      const P = (w, h, d, lx, ly, lz, mat, r2, solid) => { const [px, pz] = L(lx, lz); c.box(w, h, d, px, ly, pz, mat, ry + (r2 || 0)); if (solid) c.solid(px, ly, pz, w / 2, h / 2, d / 2, ry + (r2 || 0)); };
      P(W2 * 2 + 0.3, 0.16, D2 * 2 + 0.3, 0, 0.12, 0, 'woodDark', 0, true); P(W2 * 2, H, 0.1, 0, 0.2 + H / 2, -D2, wm, 0, true); P(0.1, H, D2 * 2, -W2, 0.2 + H / 2, 0, wm, 0, true); P(0.1, H, D2 * 2, W2, 0.2 + H / 2, 0, wm, 0, true);
      P(1.3, H, 0.1, -W2 + 0.65, 0.2 + H / 2, D2, wm, 0, true); P(1.3, H, 0.1, W2 - 0.65, 0.2 + H / 2, D2, wm, 0, true); P(1.6, 0.4, 0.1, 0, 0.2 + H - 0.2, D2, wm, 0, false);
      for (const s of [-1, 1]) { const [px, pz] = L(0, s * 1.15); c.box(W2 * 2 + 0.8, 0.09, 2.7, px, 0.2 + H + 0.62, pz, 'thatch', ry, s * 0.52); } P(W2 * 2 + 0.7, 0.1, 0.1, 0, 0.2 + H + 1.3, 0, 'woodDark');
      for (const [lx, lz] of [[-W2, -D2], [W2, -D2], [-W2, D2], [W2, D2]]) { const [px, pz] = L(lx, lz); c.cyl(0.09, 0.1, H + 0.6, px, (H + 0.2) / 2, pz, 'log', 6); }
      return L;
    },
    dock(c, len, wid) { for (let i = 0; i < len; i += 2) { c.box(wid, 0.1, 1.96, 0, 0, i + 1, i % 4 ? 'wood' : 'woodDark'); for (const s of [-1, 1]) c.cyl(0.09, 0.1, 4, s * (wid / 2 - 0.1), -1.9, i + 1, 'log', 6); } c.solid(0, -0.15, len / 2, wid / 2, 0.2, len / 2, 0); },
    tower(c, x, z, h) { for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.beam(x + sx * 1.3, 0, z + sz * 1.3, x + sx * 0.25, h, z + sz * 0.25, 0.06, 'steel', 5); for (let y = 2; y < h; y += 3) { const k = 1.3 - (y / h) * 1.05; c.beam(x - k, y, z - k, x + k, y, z - k, 0.03, 'steel', 4).beam(x + k, y, z - k, x + k, y, z + k, 0.03, 'steel', 4).beam(x + k, y, z + k, x - k, y, z + k, 0.03, 'steel', 4).beam(x - k, y, z + k, x - k, y, z - k, 0.03, 'steel', 4).beam(x - k, y, z - k, x + k, y + 3, z + k, 0.02, 'steel', 4); } c.cyl(0.02, 0.04, 4, x, h + 2, z, 'steel', 5).sph(0.12, x, h + 4, z, 'plasticRed', 1, 1, 1, null, 6); c.solid(x, 1, z, 0.9, 1, 0.9, 0); },
    lifeboat(c) { const g = new THREE.SphereGeometry(1, 12, 8); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i); if (y > 0.1) y = 0.1; p.setXYZ(i, p.getX(i) * 1.0, y * 0.75 + 0.5, p.getZ(i) * 2.6); } g.computeVertexNormals(); c.geo(g, 'plasticRed', 0, 0, 0, 0.3, 1, null, 0.12); c.box(1.5, 0.05, 0.3, 0, 0.45, 0.4, 'wood', 0.3).box(1.5, 0.05, 0.3, 0.1, 0.45, -0.8, 'wood', 0.3); c.solid(0, 0.3, 0, 1.0, 0.3, 2.4, 0.3); }
  };

  const S = G.sites = {
    // ---------- planning (deterministic, runs at world generation) ----------
    spot(I, rnd, hMin, hMax, f0, f1, r) {
      const W = G.world;
      for (let t = 0; t < 60; t++) {
        const a = rnd() * 6.28, d = I.r * (f0 + rnd() * (f1 - f0)), x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d, h = W.rawIsland(I, x, z);
        if (h < hMin || h > hMax) continue; if (Math.abs(W.rawIsland(I, x + 3, z) - h) > 2.2 || Math.abs(W.rawIsland(I, x, z + 3) - h) > 2.2) continue;
        if (I.sites.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + r + 8)) continue; return { x, z, h: Math.max(h, 1.7), r, rot: rnd() * 6.28 };
      }
      return null;
    },
    planIsland(I, rnd) {
      const add = (kind, hMin, hMax, f0, f1, r, extra) => { const s = this.spot(I, rnd, hMin, hMax, f0, f1, r); if (s) { Object.assign(s, { kind }, extra); I.sites.push(s); } return s; };
      const t = I.type, st = I.story;
      if (st && st.startsWith('lantern')) add('lantern', 2.5, 30, 0.1, 0.6, 7, { key: st });
      if (st === 'start') { add('camp', 2.2, 9, 0.15, 0.5, 7, { story: true }); const lb = add('lifeboat', 0.9, 1.9, 0.5, 1.1, 4); if (lb) lb.h = Math.max(1.1, lb.h); add('pond', 2.5, 9, 0.05, 0.45, 6.5); return; }
      if (st === 'mayday') { add('castaway', 2.5, 18, 0.1, 0.6, 5); return; }
      if (t === 'settlement') { const v = add('village', 2.2, 8, 0.2, 0.55, 17, { inhabited: st === 'haven' }); if (v) this.planDock(I, v); add('pond', 2.5, 9, 0.05, 0.5, 6.5); return; }
      if (t === 'research') { add('lab', 3, 16, 0.05, 0.5, 12, { story: st === 'meridian' }); if (rnd() < 0.5) add('camp', 2.2, 9, 0.3, 0.7, 6); return; }
      if (t === 'tropical') { if (rnd() < 0.62) add('pond', 2.5, 9, 0.05, 0.45, 6); if (rnd() < 0.55) add('camp', 2.2, 8, 0.2, 0.6, 6); }
      else if (t === 'jungle') { add('pond', 3, 16, 0.05, 0.5, 7); if (rnd() < 0.7) add('ruin', 4, 26, 0.05, 0.5, 7); if (rnd() < 0.4) add('camp', 2.2, 8, 0.4, 0.75, 6); }
      else if (t === 'rocky') { if (rnd() < 0.65) add('grotto', 5, 22, 0.05, 0.5, 5); if (rnd() < 0.7) add('nest', 6, 26, 0.05, 0.45, 3); if (rnd() < 0.3) add('camp', 2.5, 9, 0.3, 0.7, 6); }
      else if (t === 'mangrove') { if (rnd() < 0.45) add('camp', 1.2, 3, 0.05, 0.5, 6); }
      else if (t === 'volcanic') { if (rnd() < 0.75) add('grotto', 6, 30, 0.2, 0.7, 5); if (rnd() < 0.3) add('camp', 2, 8, 0.5, 0.9, 6); }
    },
    planDock(I, v) { const W = G.world, a = Math.atan2(v.z - I.z, v.x - I.x); for (let d = 6; d < 90; d += 1.5) { const x = v.x + Math.cos(a) * d, z = v.z + Math.sin(a) * d; if (W.rawIsland(I, x, z) < 0.7) { v.dock = { x, z, a }; return; } } },
    planPoi(P, rnd) {
      const W = G.world, k = P.poi; const F = (r, h, bump) => W.floorSites.push({ x: P.x, z: P.z, r, h, bump }); P.r = 30; P.range = 520;
      const NAMES = { wreck: 'Sunken trawler', plane: 'Downed seaplane', yacht: 'Drifting yacht', reef: 'Coral gardens', kelp: 'Kelp forest', buoy: 'Weather buoy', rig: 'Abandoned survey rig', cache: 'Seamount' };
      if (!P.name) P.name = NAMES[k]; P.rot = rnd() * 6.28;
      if (k === 'wreck') F(70, -14 - rnd() * 10, 2); else if (k === 'plane') F(55, -11 - rnd() * 8, 2); else if (k === 'reef') { F(110, -5.5, 5); P.r = 70; } else if (k === 'kelp') { F(100, -17, 3); P.r = 60; } else if (k === 'cache') F(50, -9, 3);
      else if (k === 'calloway') { F(90, -21, 2); P.r = 40; } else if (k === 'deepwell') { F(110, -46, 1.5); P.r = 45; } else if (k === 'keystone') { P.range = 1700; P.r = 20; } else if (k === 'rig') P.range = 1300; else if (k === 'yacht' || k === 'buoy') P.range = 900;
    },

    // ---------- island sites ----------
    buildIsland(I) {
      const c = new Ctx(I), W = G.world; I.inst.ctx = c; const hash = (n) => Math.floor(G.hash2(I.cx * 7 + n, I.cz * 13 - n, W.seed) * 1000);
      for (const [si, s] of I.sites.entries()) {
        c.at(s.x, s.h, s.z, s.rot);
        if (s.kind === 'pond') {
          const m = new THREE.Mesh(new THREE.CircleGeometry(s.r * 0.88, 20), this.pondMat || (this.pondMat = new THREE.MeshStandardMaterial({ color: 0x2f7f78, transparent: true, opacity: 0.78, roughness: 0.06, metalness: 0.3 })));
          m.rotation.x = -PI / 2; m.position.set(s.x, s.h - 0.32, s.z); m.layers.set(1); c.group.add(m);
          c.inter(0, -0.2, 0, { r: s.r * 0.75, reach: s.r + 2.5, label: 'Fresh water — drink, or fill your held flask', use: () => { const h = G.inv.held(); if (h && (h.id === 'bottle' || h.id === 'bottle_sea')) { G.inv.removeAt(G.inv.sel, 1); G.inv.add('bottle_fresh', 1); G.audio.sfx('water'); } else G.player.drink(35, 'fresh'); } });
        } else if (s.kind === 'camp') {
          PROP.firepit(c, 0, 0, false); PROP.tent(c, -2.6, 0.5, 0.5); c.box(1.6, 0.04, 0.7, 2.2, 0.03, 1.4, 'fabricBlue', 0.4); c.cyl(0.12, 0.14, 1.6, 1.2, 0.14, -2.2, 'log', 7, 0, 0.3, PI / 2);
          if (s.story) { c.container('crate', 2.6, 0, -1.2, 0.4, LOOT.camp, 3, { fixed: [['radio_part', 1], ['beacon_core', 1], ['bottle', 1]], flag: 'brandt_crate' }); c.box(0.5, 0.4, 0.4, -0.3, 0.2, -1.9, 'woodDark', 0.2); c.note('brandt_tape', -0.3, 0.4, -1.9, 'tape'); }
          else { c.container('crate', 2.6, 0, -1.2, 0.4, LOOT.camp, 4); if (hash(si) % 2) c.container('barrel', -1.2, 0, -2.6, 0, LOOT.camp, 2); c.note(POOL.camp[hash(si + 3) % 4], 2.0, 0.07, 1.3); }
        } else if (s.kind === 'lifeboat') { PROP.lifeboat(c); c.container('case', 0.2, 0.5, 0.3, 0.3, LOOT.camp, 2, { fixed: [['radio_part', 1], ['ration', 2], ['bandage', 2]], flag: 'lifeboat_case' }); c.note('lifeboat_note', -0.2, 0.5, -0.9); }
        else if (s.kind === 'castaway') { PROP.tent(c, 0, -1.2, 0, 'fabricRed'); PROP.firepit(c, 0.5, 1.6, true); c.npc('brandt', -1.3, 0, 1.2, 0.9); }
        else if (s.kind === 'ruin') {
          for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28, h = 1 + (hash(si + i) % 30) / 10; c.cyl(0.42, 0.5, h, Math.cos(a) * 4.2, h / 2, Math.sin(a) * 4.2, 'stone', 8); c.solid(Math.cos(a) * 4.2, h / 2, Math.sin(a) * 4.2, 0.45, h / 2, 0.45, 0); }
          c.wall(3, 0.5, 3, 0, 0.25, 0, 'stone', 0.2).wall(1.6, 0.4, 1.6, 0, 0.7, 0, 'stone', 0.2); c.container('chest', 0, 0.9, 0, 0.2, LOOT.ruin, 3, { fixed: [['relic', 1]] }); c.note(POOL.ruin[hash(si) % 2], 1.1, 0.52, 0.9);
        } else if (s.kind === 'grotto') {
          for (let i = 0; i < 6; i++) { const a = -0.9 + i * 0.36; c.geo(G.nodeGeo._rock1.rockObj, 'rockObj', Math.sin(a) * 3.4, 0.9, -Math.cos(a) * 3.4 + 2, i, 1.9 + (i % 2) * 0.5); c.solid(Math.sin(a) * 3.4, 1, -Math.cos(a) * 3.4 + 2, 1.2, 1.6, 1.2, 0); }
          c.geo(G.nodeGeo._rock0.rockObj, 'rockObj', 0, 3.0, -1.0, 0.5, 3.2); c.container('chest', 0, 0, -0.3, 0, I.biome === 'volcanic' ? LOOT.chest : LOOT.camp, 3, { fixed: I.biome === 'volcanic' ? [['sulfur', 3], ['obsidian', 2]] : [['iron_ore', 3], ['flint', 3]] });
        } else if (s.kind === 'nest') { c.cyl(0.5, 0.35, 0.22, 0, 0.11, 0, 'thatch', 9); c.sph(0.08, 0.05, 0.24, 0, 'cloth', 1, 1.2, 1, null, 6).sph(0.08, -0.1, 0.24, 0.08, 'cloth', 1, 1.2, 1, null, 6); const id = c.id('n'); c.inter(0, 0.3, 0, { r: 0.7, label: () => G.world.opened[id] ? 'Empty nest' : 'Search nest', use: () => { if (G.world.opened[id]) return G.ui.toast('Nothing but twigs.'); G.world.opened[id] = 1; G.inv.add('feather', 3 + hash(si) % 3); G.audio.sfx('pickup'); } }); }
        else if (s.kind === 'village') this.village(c, I, s, hash);
        else if (s.kind === 'lab') this.lab(c, I, s, hash);
        else if (s.kind === 'lantern') this.lantern(c, I, s);
      }
      c.finish(I.x, I.z, I.r * 1.4 + 30);
    },
    village(c, I, s, hash) {
      const live = s.inhabited; const huts = [[-9, -6, 0.5], [8, -7, -0.4], [-10, 6, 1.9], [9, 7, -2.2], [0, -11, 0]];
      huts.forEach(([x, z, ry], i) => { const L = PROP.hut(c, x, z, ry, { mat: i % 2 ? 'wood' : 'woodDark' }); const [cx, cz] = L(-1.2, -1.0); if (!live) { if (i < 4) c.container(i % 2 ? 'crate' : 'locker', cx, 0.2, cz, ry, LOOT.village, 4); if (i === 1) { const [nx, nz] = L(1.0, -0.8); c.box(0.9, 0.7, 0.6, nx, 0.55, nz, 'woodDark', ry); c.note(POOL.village[hash(1) % 3], nx, 0.9, nz); } } else { const [bx, bz] = L(1.1, -0.9); c.box(0.9, 0.3, 1.8, bx, 0.35, bz, 'wood', ry); c.box(0.86, 0.1, 1.7, bx, 0.55, bz, 'fabricBlue', ry); } });
      PROP.firepit(c, 0, 0, live); for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.5; c.cyl(0.14, 0.16, 1.5, Math.cos(a) * 2.2, 0.16, Math.sin(a) * 2.2, 'log', 7, 0, -a, PI / 2); }
      if (live) {
        // market stalls and the people of Haven
        for (const [x, z, ry, mat] of [[-4, 5.5, 2.6, 'fabricRed'], [4.5, 5, -2.6, 'fabricBlue'], [0, 8.5, PI, 'fabricGreen']]) { const cs = Math.cos(ry), sn = Math.sin(ry); for (const [lx, lz] of [[-1.1, -0.7], [1.1, -0.7], [-1.1, 0.7], [1.1, 0.7]]) c.cyl(0.05, 0.05, 2.3, x + lx * cs + lz * sn, 1.15, z - lx * sn + lz * cs, 'log', 5); c.box(2.6, 0.05, 1.8, x, 2.32, z, mat, ry, 0.12); c.box(2.2, 0.08, 0.8, x + 0.5 * sn, 0.85, z + 0.5 * cs, 'wood', ry); c.solid(x + 0.5 * sn, 0.45, z + 0.5 * cs, 1.1, 0.45, 0.4, ry); }
        c.npc('mara', -4.4, 0, 4.4, 2.6); c.npc('tobe', 4.9, 0, 3.9, -2.6); c.npc('pike', 0, 0, 7.4, PI); c.npc('venn', -6.5, 0, -1.5, 1.3);
        if (G.game.flags.brandtRescued) c.npc('brandt', 3.2, 0, -2.4, -0.8);
        PROP.tower(c, 13, -1, 9); c.box(1.2, 1.4, 0.1, -1.5, 0.9, 11.5, 'woodDark', 0.1); c.cyl(0.06, 0.06, 1.6, -1.5, 0.8, 11.6, 'log', 5);
      } else { c.container('barrel', 2.5, 0, 2.8, 0, LOOT.village, 2); c.container('crate', -3, 0, 3.2, 0.7, LOOT.village, 3); }
      if (s.dock) { const d = s.dock; c.at(d.x, 1.0, d.z, PI / 2 - d.a); PROP.dock(c, 18, 2.2); if (!live) c.container('crate', 0.5, 0.05, 15, 0.2, LOOT.village, 3); c.cyl(0.12, 0.12, 1.2, -0.9, 0.6, 17.5, 'log', 6); c.at(s.x, s.h, s.z, s.rot); }
    },
    lab(c, I, s, hash) {
      const W2 = 3.6, D2 = 2.6, H = 3; // concrete block with a doorway on +z
      c.wall(W2 * 2 + 0.5, 0.2, D2 * 2 + 0.5, 0, 0.1, 0, 'concrete'); c.wall(W2 * 2, H, 0.25, 0, 0.2 + H / 2, -D2, 'concrete'); c.wall(0.25, H, D2 * 2, -W2, 0.2 + H / 2, 0, 'concrete'); c.wall(0.25, H, D2 * 2, W2, 0.2 + H / 2, 0, 'concrete');
      c.wall(2.7, H, 0.25, -W2 + 1.35, 0.2 + H / 2, D2, 'concrete'); c.wall(2.7, H, 0.25, W2 - 1.35, 0.2 + H / 2, D2, 'concrete'); c.box(1.8, 0.7, 0.25, 0, 0.2 + H - 0.35, D2, 'concrete'); c.wall(W2 * 2 + 0.6, 0.25, D2 * 2 + 0.6, 0, 0.2 + H + 0.12, 0, 'concrete');
      c.box(1.6, 0.9, 0.04, -W2 + 1.35, 1.9, D2 + 0.13, 'glass').box(1.6, 0.9, 0.04, W2 - 1.35, 1.9, D2 + 0.13, 'glass'); c.box(2.4, 0.08, 0.9, -2.0, 1.0, -2.0, 'steel').box(2.3, 0.8, 0.8, -2.0, 0.6, -2.0, 'metal'); c.solid(-2.0, 0.6, -2.0, 1.2, 0.5, 0.45, 0); c.box(0.5, 0.36, 0.04, -2.3, 1.3, -2.3, 'screen');
      PROP.tower(c, 8, -3, 15); c.box(1.6, 1.2, 1.0, -6.5, 0.6, 1, 'plasticYellow').solid(-6.5, 0.6, 1, 0.8, 0.6, 0.5, 0); c.cyl(0.1, 0.1, 1.0, -6.0, 1.5, 1, 'metal', 6);
      c.container('locker', 2.9, 0.2, -2.0, -PI / 2, LOOT.lab, 4); c.container('case', 1.2, 0.2, -2.1, 0.2, LOOT.lab, 3); c.container('locker', 2.9, 0.2, -0.6, -PI / 2, LOOT.lab, 3, { key: 'keycard', fixed: [['circuit', 1], ['battery', 1]] });
      if (s.story) { c.npc('kerr', 0.5, 0.2, -0.6, 0); c.note('kerr_memo', -1.6, 1.05, -1.9); } else c.note(POOL.lab[hash(2) % 3], -1.6, 1.05, -1.9);
    },
    lantern(c, I, s) {
      const key = s.key, lit = !!G.game.flags[key]; c.cyl(1.7, 2.3, 7, 0, 3.5, 0, 'stone', 12); c.solid(0, 3.5, 0, 1.75, 3.5, 1.75, 0); c.cyl(2.3, 2.3, 0.2, 0, 7.1, 0, 'concrete', 12); c.cyl(1.0, 1.0, 1.7, 0, 8.0, 0, 'glass', 10); c.cyl(0.1, 1.3, 0.9, 0, 9.3, 0, 'metal', 10);
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; c.cyl(0.03, 0.03, 0.9, Math.cos(a) * 2.2, 7.6, Math.sin(a) * 2.2, 'steel', 4); }
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), lit ? G.mats.lamp : G.mats.lampOff); lamp.position.set(s.x, s.h + 8.0, s.z); c.group.add(lamp); s.lamp = lamp;
      const glow = c.flame(0, 8.0, 0, 9); glow.material.color.set(0xfff0b0); glow.visible = lit; s.glow = glow; c.lanternGlow = glow;
      c.box(0.9, 1.1, 0.5, 0, 0.55, 2.6, 'metal').box(0.6, 0.36, 0.04, 0, 0.85, 2.87, 'screen'); c.solid(0, 0.55, 2.6, 0.45, 0.55, 0.25, 0);
      c.inter(0, 1.0, 2.9, { r: 0.8, label: () => G.game.flags[key] ? 'Lantern console — lit' : 'Lantern console — install a Beacon Core', use: () => G.quests.useLantern(key, s) });
    },

    // ---------- ocean locations ----------
    scatter(P, list) { // list: [type, count, radius, yOffset]
      const rnd = G.rng(P.seed ^ 0x5a5a), nodes = []; for (const [type, count, rad, yo] of list) { const def = G.NODES[type]; for (let i = 0; i < count; i++) { const a = rnd() * 6.28, d = Math.sqrt(rnd()) * rad, x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d; nodes.push({ t: type, v: G.pick(rnd, def.vis), x, y: G.world.height(x, z) - 0.05 + (yo || 0), z, s: G.lerp(def.scale[0], def.scale[1], rnd()), r: rnd() * 6.28, alive: true, hp: def.hp || 1, id: nodes.length }); } }
      P.nodes = nodes; P.biome = 'volcanic'; P.sites = P.sites || []; const keep = P.r; P.r = 1; G.world.buildVeg(P); P.r = keep;
    },
    hull(c, len, wid, hgt, mat) { // a broken, listing hull: sides, deck, bow, deckhouse
      c.wall(wid, 0.3, len, 0, 0.15, 0, mat); c.wall(0.3, hgt, len, -wid / 2, hgt / 2, 0, mat).wall(0.3, hgt, len, wid / 2, hgt / 2, 0, mat); c.wall(wid, 0.25, len * 0.45, 0, hgt, -len * 0.25, mat); c.wall(wid, hgt, 0.3, 0, hgt / 2, len / 2, mat);
      c.box(wid * 0.75, hgt, 0.3, -wid * 0.19, hgt / 2, -len / 2 - wid * 0.3, mat, 0.55).box(wid * 0.75, hgt, 0.3, wid * 0.19, hgt / 2, -len / 2 - wid * 0.3, mat, -0.55); c.solid(0, hgt / 2, -len / 2 - wid * 0.3, wid / 2, hgt / 2, wid * 0.35, 0);
      c.wall(wid * 0.7, 2.2, 0.2, 0, hgt + 1.1, -len * 0.3, 'steel').wall(0.2, 2.2, len * 0.22, -wid * 0.35, hgt + 1.1, -len * 0.19, 'steel').wall(0.2, 2.2, len * 0.22, wid * 0.35, hgt + 1.1, -len * 0.19, 'steel').wall(wid * 0.75, 0.2, len * 0.24, 0, hgt + 2.3, -len * 0.19, 'steel');
      c.beam(0, hgt, len * 0.15, wid * 0.8, hgt + 5, len * 0.3, 0.12, mat, 6);
    },
    buildPoi(P) {
      const c = new Ctx(P), W = G.world, k = P.poi, fl = W.height(P.x, P.z); P.inst = { ctx: c, hiLoaded: true, meshes: null }; c.at(P.x, fl, P.z, P.rot);
      const hash = (n) => Math.floor(G.hash2(P.cx * 5 + n, P.cz * 11 - n, W.seed) * 1000);
      if (k === 'wreck') { this.hull(c, 16, 5, 2.6, 'metal'); c.container('locker', 1.2, 2.7, -4.2, 0, LOOT.wreck, 4); c.container('crate', -1.2, 0.3, 3, 0.4, LOOT.wreck, 4); c.container('chest', 0.8, 0.3, 6, 0.2, LOOT.wreck, 3); c.note(POOL.wreck[hash(1) % 2], -1, 2.75, -3.2); this.eel(P, c.wx(1.5, 1.5), fl + 0.9, c.wz(1.5, 1.5)); this.scatter(P, [['scrap', 9, 22], ['coral', 30, 30], ['seaweed', 14, 30], ['clam', 6, 28]]); }
      else if (k === 'plane') { c.cyl(1.4, 1.2, 11, 0, 1.3, 0, 'steel', 12, PI / 2); c.solid(-1.2, 1.3, 0, 0.2, 1.3, 5.5, 0).solid(1.2, 1.3, 0, 0.2, 1.3, 5.5, 0).solid(0, 2.6, 0, 1.3, 0.2, 5.5, 0); c.box(9, 0.25, 2.6, -5.4, 1.6, -1, 'steel', 0, 0, 0.12).box(6, 0.25, 2.4, 4.2, 2.4, -0.6, 'steel', 0, 0, -0.5); c.box(0.2, 2.6, 1.8, 0, 3.0, 4.6, 'steel'); c.sph(1.25, 0, 1.3, -5.6, 'glass', 1, 1, 1.3, null, 10); c.container('case', 0, 0.3, 1.5, 0.3, LOOT.wreck, 3, { fixed: [['electronics', 2]] }); c.container('case', 0.3, 0.3, -2.4, 1, LOOT.lab, 3); c.note('plane_a', -0.4, 0.32, 3.2); this.scatter(P, [['scrap', 6, 16], ['coral', 20, 24], ['seaweed', 10, 24]]); }
      else if (k === 'yacht') { c.at(P.x, 0, P.z, P.rot); const g = new THREE.SphereGeometry(1, 16, 10); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i); const z = p.getZ(i); if (y > 0.4) y = 0.4; p.setXYZ(i, p.getX(i) * 2.2 * (1 - Math.max(0, -z) * 0.4), y * 1.5 + 0.3, z * 6.5); } g.computeVertexNormals(); c.geo(g, 'cloth', 0, 0, 0, 0); c.wall(3.6, 0.2, 10, 0, 0.9, 0.5, 'wood'); c.wall(2.6, 1.5, 0.15, 0, 1.75, -2, 'cloth').wall(0.15, 1.5, 4, -1.3, 1.75, 0, 'cloth').wall(0.15, 1.5, 4, 1.3, 1.75, 0, 'cloth').wall(2.8, 0.15, 4.2, 0, 2.55, 0, 'cloth'); c.cyl(0.08, 0.1, 9, 0, 5.5, -3, 'steel', 8); c.beam(0, 9.5, -3, 0.4, 1.2, 4.5, 0.02, 'rope', 4); c.container('locker', 0.7, 1.0, -1.5, 0, LOOT.village, 4); c.container('case', -0.6, 1.0, 3.8, 0.5, LOOT.wreck, 3, { fixed: [['fuel', 1]] }); c.note('yacht_a', -0.7, 1.02, 0.6); }
      else if (k === 'buoy') { c.at(P.x, 0, P.z, P.rot); c.cyl(1.3, 1.0, 1.0, 0, 0.2, 0, 'plasticYellow', 14); c.solid(0, 0.2, 0, 1.2, 0.5, 1.2, 0); for (let i = 0; i < 3; i++) { const a = i * 2.094; c.beam(Math.cos(a) * 0.9, 0.7, Math.sin(a) * 0.9, 0, 3.6, 0, 0.04, 'steel', 5); } c.box(0.5, 0.5, 0.4, 0, 1.0, 0, 'metal'); c.sph(0.16, 0, 3.75, 0, 'lamp', 1, 1, 1, null, 8); c.container('case', 0.5, 0.7, 0.3, 0.4, LOOT.lab, 2, { fixed: [['electronics', 1]] }); c.note('buoy_a', -0.4, 0.72, 0.3); }
      else if (k === 'reef') { this.scatter(P, [['coral', 380, 62], ['clam', 22, 65], ['sponge', 26, 60], ['oyster', 7, 60], ['seaweed', 26, 68]]); if (hash(2) % 2) { c.container('chest', 3, 0.1, 2, 0.5, LOOT.chest, 3); } }
      else if (k === 'kelp') { this.scatter(P, [['kelp', 120, 60], ['seaweed', 40, 60], ['clam', 12, 55], ['oyster', 4, 50], ['coral', 20, 60]]); }
      else if (k === 'cache') { c.container('chest', 0, 0.1, 0, 0.5, LOOT.chest, 4, { fixed: [['pearl', 1]] }); c.geo(G.nodeGeo._rock1.rockObj, 'rockObj', 1.6, 0.6, 0.4, 1, 1.8); this.scatter(P, [['coral', 40, 30], ['clam', 8, 25], ['sponge', 5, 25], ['titanium', 1, 18]]); }
      else if (k === 'rig') this.rig(c, P, 11, 5, false);
      else if (k === 'keystone') this.rig(c, P, 17, 5, true);
      else if (k === 'calloway') {
        this.hull(c, 26, 7.5, 3.4, 'metal'); c.at(P.x, fl, P.z, P.rot + 0.5); c.wall(7, 3, 9, 6, 1.5, 22, 'metal', 0.3);
        c.at(P.x, fl, P.z, P.rot); c.container('locker', 2.2, 3.6, -8, 0, LOOT.wreck, 4, { fixed: [['dive_mask', 1]] }); c.container('locker', -2.2, 3.6, -8, 0, LOOT.lab, 4); c.container('crate', 1, 0.35, 4, 0.3, LOOT.wreck, 5); c.container('crate', -2, 0.35, 8, 1, LOOT.wreck, 4); c.container('case', 0, 3.6, -6.2, 0.2, LOOT.lab, 3, { fixed: [['machine_part', 2]] });
        c.box(0.8, 0.9, 0.5, 0, 3.9, -9.2, 'steel'); c.note('calloway_log', 0, 4.36, -9.2, 'tape'); this.eel(P, c.wx(-2.5, 2), fl + 1, c.wz(-2.5, 2)); this.scatter(P, [['scrap', 14, 30], ['coral', 30, 38], ['seaweed', 16, 36], ['clam', 8, 30]]);
      } else if (k === 'deepwell') this.deepwell(c, P, fl);
      c.finish(P.x, P.z, 60);
    },
    eel(P, x, y, z) { const e = G.wildlife.add('eel', x, y, z, { hx: x, hz: z, hp: 22, r: 0.5, keep: true, owner: P.id }); return e; },
    rig(c, P, size, deckY, key) {
      c.at(P.x, 0, P.z, P.rot); const h = size / 2;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { c.cyl(0.55, 0.65, 34 + deckY, sx * (h - 1), deckY - (34 + deckY) / 2, sz * (h - 1), 'metal', 10); c.solid(sx * (h - 1), deckY / 2 - 2, sz * (h - 1), 0.6, deckY / 2 + 2, 0.6, 0); }
      c.wall(size, 0.4, size, 0, deckY - 0.2, 0, 'steel'); for (const [x, z, ry] of [[0, -h, 0], [0, h, 0], [-h, 0, PI / 2], [h, 0, PI / 2]]) { if (z === h) continue; c.box(size, 0.06, 0.06, x, deckY + 1.0, z, 'steel', ry).box(size, 0.05, 0.05, x, deckY + 0.5, z, 'steel', ry); c.solid(x, deckY + 0.5, z, size / 2, 0.5, 0.05, ry); }
      // floating pontoon and a gangway up to the deck
      c.wall(4, 0.8, 4, 0, 0.0, h + 9.5, 'plasticYellow'); c.ramp(1.8, 9, deckY - 0.4, 0, 0.4, h + 3.2, 'steel', 0);
      c.box(size - 4, 0.3, 0.3, 0, deckY - 0.6, h - 2, 'metal'); c.box(0.3, 0.3, size - 4, h - 2, deckY - 0.6, 0, 'metal');
      if (!key) {
        c.wall(4, 2.4, 0.15, -2, deckY + 1.2, -3, 'metal').wall(0.15, 2.4, 3.4, -4, deckY + 1.2, -1.3, 'metal').wall(4.2, 0.15, 3.6, -2, deckY + 2.45, -1.3, 'metal'); c.cyl(0.9, 0.9, 2.2, 3, deckY + 1.1, -2.5, 'plasticRed', 12); c.solid(3, deckY + 1.1, -2.5, 0.9, 1.1, 0.9, 0);
        PROP.tower(c.at(P.x, deckY, P.z, P.rot), 3, 2.5, 9); c.at(P.x, 0, P.z, P.rot);
        c.container('locker', -3.4, deckY, -2.4, PI / 2, LOOT.wreck, 4, { fixed: [['fuel', 2]] }); c.container('crate', -1, deckY, -2, 0.2, LOOT.lab, 4); c.container('barrel', 1, deckY, 3, 0, LOOT.wreck, 3, { fixed: [['fuel', 1]] }); c.container('case', -2.4, deckY, 0.4, 0.6, LOOT.lab, 3, { fixed: [['machine_part', 1]] }); c.note('rig_a', -2.2, deckY + 0.02, -1.6);
      } else {
        // the Keystone: upper deck, control room and the resonator spire
        const uy = deckY + 4; c.wall(9, 0.3, 9, 0, uy - 0.15, -3, 'steel'); for (const [sx, sz] of [[-4, -7], [4, -7], [-4, 1], [4, 1]]) { c.cyl(0.2, 0.2, 4, sx, deckY + 2, sz, 'metal', 8); c.solid(sx, deckY + 2, sz, 0.2, 2, 0.2, 0); }
        c.ramp(1.6, 7, 4, 6.3, deckY, 1, 'steel', 0);
        c.wall(3.0, 0.3, 2.2, 5.6, uy - 0.15, -3.6, 'steel');
        c.wall(6, 2.6, 0.2, 0, uy + 1.3, -6.5, 'metal').wall(0.2, 2.6, 5, -3, uy + 1.3, -4, 'metal').wall(0.2, 2.6, 1.6, 3, uy + 1.3, -5.7, 'metal').wall(6.2, 0.2, 5.2, 0, uy + 2.7, -4, 'metal'); c.wall(6, 2.6, 0.08, 0, uy + 1.3, -1.52, 'glass');
        c.box(2.2, 1.0, 0.8, 0, uy + 0.5, -5.8, 'steel').solid(0, uy + 0.5, -5.8, 1.1, 0.5, 0.4, 0); c.box(1.6, 0.5, 0.05, 0, uy + 1.3, -6.1, 'screen'); c.note('keystone_log', 1.9, uy + 0.02, -5.2);
        c.inter(0, uy + 1.1, -5.4, { r: 0.9, label: () => G.game.flags.ending ? 'Keystone console — the array has answered' : 'Keystone console', use: () => G.quests.useKeystone() });
        c.cyl(0.5, 0.9, 20, -4.5, deckY + 10, 4, 'steel', 10); c.solid(-4.5, deckY + 3, 4, 0.9, 3, 0.9, 0); for (let i = 0; i < 4; i++) { const g = new THREE.TorusGeometry(1.6 + i * 0.5, 0.08, 6, 20); g.rotateX(PI / 2); c.geo(g, 'crystal', -4.5, deckY + 8 + i * 3.2, 4, 0); }
        const glow = c.flame(-4.5, deckY + 20.5, 4, 14); glow.material.color.set(0x66ddff); c.spireGlow = glow; c.sph(0.8, -4.5, deckY + 20.5, 4, 'crystal', 1, 1.4, 1, null, 8);
        c.container('locker', -2.4, uy, -5.9, 0, LOOT.deep, 4);
      }
    },
    deepwell(c, P, fl) {
      const mod = (x, z, ry) => { // hollow steel module, doorway on local +z
        c.at(P.x, fl, P.z, P.rot); const wx = c.wx(x, z), wz = c.wz(x, z); c.at(wx, fl, wz, P.rot + ry);
        const W2 = 3, H = 3.2; c.wall(W2 * 2, 0.3, W2 * 2, 0, 0.55, 0, 'steel'); c.wall(W2 * 2, 0.3, W2 * 2, 0, 0.7 + H, 0, 'steel'); c.wall(W2 * 2, H, 0.3, 0, 0.7 + H / 2, -W2, 'steel'); c.wall(0.3, H, W2 * 2, -W2, 0.7 + H / 2, 0, 'steel'); c.wall(0.3, H, W2 * 2, W2, 0.7 + H / 2, 0, 'steel');
        c.wall(2.1, H, 0.3, -W2 + 1.05, 0.7 + H / 2, W2, 'steel').wall(2.1, H, 0.3, W2 - 1.05, 0.7 + H / 2, W2, 'steel'); c.box(1.8, 0.8, 0.3, 0, 0.7 + H - 0.4, W2, 'steel');
        for (const [lx, lz] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) c.cyl(0.25, 0.3, 1.2, lx, 0, lz, 'metal', 8); c.box(4, 0.25, 0.05, 0, 3.0, -W2 + 0.18, 'screen'); c.box(0.05, 0.6, 2.4, -W2 - 0.16, 2.4, 0, 'screen').box(0.05, 0.6, 2.4, W2 + 0.16, 2.4, 0, 'screen');
      };
      const core = (i, lx, lz) => { const id = P.id + ':core' + i; c.cyl(0.3, 0.4, 1.0, lx, 1.2, lz, 'metal', 8); if (!G.world.opened[id]) { const m = new THREE.Mesh(G.geo.cyl(0.16, 0.16, 0.4, 8), G.mats.crystal); m.position.set(c.wx(lx, lz), c.oy + 1.95, c.wz(lx, lz)); m.layers.set(1); c.group.add(m); c.inter(lx, 1.9, lz, { r: 0.7, label: () => G.world.opened[id] ? '' : 'Take data core', use: () => { if (G.world.opened[id]) return; G.world.opened[id] = 1; m.visible = false; G.inv.add('data_core', 1); G.audio.sfx('discover'); G.emit('core'); } }); } };
      mod(0, -9, 0); core(0, 0, -1.6); c.container('locker', -2.2, 0.7, -2.2, PI / 2, LOOT.deep, 4); c.note('deepwell_1', 1.8, 0.72, -1.8);
      mod(-9, 6, PI * 0.66); core(1, 0, -1.6); c.container('case', 1.8, 0.7, -2, 0.4, LOOT.deep, 3); c.note('deepwell_2', -1.8, 0.72, -1.6);
      mod(9, 6, -PI * 0.66); core(2, 0, -1.6); c.container('locker', 2.2, 0.7, -2.2, -PI / 2, LOOT.deep, 4, { key: 'keycard', fixed: [['titanium', 3], ['circuit', 2]] }); c.note('venn_report', -1.6, 0.72, -1.9, 'tape');
      c.at(P.x, fl, P.z, P.rot); c.sph(3.2, 0, 1.2, 1, 'glass', 1, 0.8, 1, null, 14); c.cyl(3.4, 3.6, 1.0, 0, 0.5, 1, 'steel', 14); c.solid(0, 1.2, 1, 2.4, 1.8, 2.4, 0); c.sph(0.5, 0, 4.3, 1, 'lamp', 1, 1, 1, null, 8);
      for (const [x, z] of [[0, -4.5], [-4.6, 3.6], [4.6, 3.6]]) c.beam(0, 1.6, 1, x, 1.8, z, 0.7, 'steel', 8);
      const glow = c.flame(0, 4.4, 1, 8); glow.material.color.set(0x9fe8ff);
      this.eel(P, c.wx(6, -6), fl + 1, c.wz(6, -6)); this.scatter(P, [['titanium', 7, 34], ['coral', 14, 40], ['sponge', 6, 36]]);
    },
    unload(o) {
      const n = o.inst; if (!n) return; if (n.ctx) { n.ctx.dispose(); n.ctx = null; }
      if (o.kind === 'poi') { if (n.veg) { n.veg.traverse((m) => { if (m.isInstancedMesh) m.dispose(); }); G.scene.remove(n.veg); } for (const c of [...G.wildlife.list]) if (c.owner === o.id) G.wildlife.remove(c); o.inst = null; }
    },
    // NPCs turn to face the player; lantern glows pulse
    update(t) {
      const P = G.player; for (const I of G.world.islands) { const c = I.inst && I.inst.ctx; if (!c) continue; if (c.npcs) for (const n of c.npcs) { const d = Math.hypot(n.o.x - P.pos.x, n.o.z - P.pos.z); if (d < 7) { const want = Math.atan2(P.pos.x - n.o.x, P.pos.z - n.o.z); n.g.rotation.y += G.angDiff(n.g.rotation.y, want) * 0.08; } } for (const s of I.sites) if (s.glow && s.glow.visible) { const k = 8 + Math.sin(t * 2.2) * 1.5; s.glow.scale.set(k, k, 1); } }
      const K = G.world.story.keystone; if (K && K.inst && K.inst.ctx && K.inst.ctx.spireGlow) { const g = K.inst.ctx.spireGlow, calm = G.game.flags.eyeCalm; const k = calm ? 4 : 13 + Math.sin(t * 5) * 4; g.scale.set(k, k, 1); }
    }
  };
})();
