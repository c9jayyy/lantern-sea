'use strict';
/* World generation: seeded archipelago layout, analytic height field, streamed island meshes (2 LODs),
   harvestable nodes, vegetation instancing, sea-floor follower mesh. */
(function () {
  const G = window.G;
  const CELL = 560, GN = 6;
  const BIOME = {
    tropical: { sand: [1.0, 0.88, 0.62], grass: [0.26, 0.44, 0.10], rock: [0.52, 0.50, 0.45], dirt: [0.40, 0.29, 0.16], pow: 1.3, shelf: 0.11 },
    jungle: { sand: [0.88, 0.76, 0.53], grass: [0.11, 0.27, 0.06], rock: [0.38, 0.38, 0.34], dirt: [0.23, 0.16, 0.09], pow: 1.15, shelf: 0.16 },
    volcanic: { sand: [0.075, 0.072, 0.08], grass: [0.2, 0.3, 0.11], rock: [0.15, 0.14, 0.14], dirt: [0.15, 0.11, 0.09], pow: 1.2, shelf: 0.24 },
    rocky: { sand: [0.68, 0.64, 0.55], grass: [0.31, 0.37, 0.15], rock: [0.5, 0.49, 0.46], dirt: [0.4, 0.34, 0.24], pow: 0.9, shelf: 0.26, cliff: 5 },
    mangrove: { sand: [0.40, 0.31, 0.19], grass: [0.18, 0.29, 0.08], rock: [0.3, 0.29, 0.24], dirt: [0.24, 0.18, 0.1], pow: 1.5, shelf: 0.08, channels: true }
  };
  const TYPE = {
    tropical: { biome: 'tropical', r: [70, 125], elev: [6, 13] }, jungle: { biome: 'jungle', r: [110, 158], elev: [20, 36] },
    volcanic: { biome: 'volcanic', r: [120, 158], elev: [8, 12], cone: [50, 78] }, rocky: { biome: 'rocky', r: [45, 95], elev: [12, 24] },
    mangrove: { biome: 'mangrove', r: [90, 140], elev: [1.2, 1.8] }, settlement: { biome: 'tropical', r: [88, 120], elev: [5, 9] },
    research: { biome: 'rocky', r: [95, 128], elev: [9, 15] }
  };
  // harvestable node definitions
  const D = (item, a, b) => [item, a, b];
  const NODES = G.NODES = {
    palm: { name: 'Palm tree', vis: ['palm0', 'palm1', 'palm2'], rad: 0.32, hp: 5, act: 'chop', tier: 0, drops: [D('plank', 3, 4), D('palm_leaf', 2, 4), D('coconut', 0, 2)], respawn: 6, fall: 1, scale: [0.85, 1.2], far: 'palm' },
    tree: { name: 'Hardwood tree', vis: ['tree0', 'tree1', 'tree2'], rad: 0.5, hp: 8, act: 'chop', tier: 1, drops: [D('log', 3, 5), D('stick', 1, 3), D('vine', 0, 2)], respawn: 9, fall: 1, scale: [0.85, 1.35], far: 'tree' },
    deadtree: { name: 'Dead tree', vis: ['deadtree'], rad: 0.28, hp: 3, act: 'chop', tier: 0, drops: [D('stick', 3, 5), D('plank', 1, 2)], respawn: 12, fall: 1, scale: [0.8, 1.2] },
    mangrove: { name: 'Mangrove', vis: ['mangrove'], rad: 0.5, hp: 6, act: 'chop', tier: 0, drops: [D('log', 1, 2), D('stick', 2, 4), D('vine', 1, 2)], respawn: 8, scale: [0.8, 1.3], far: 'tree' },
    bamboo: { name: 'Bamboo', vis: ['bamboo'], rad: 0.4, hp: 3, act: 'chop', tier: 0, drops: [D('bamboo', 3, 5)], respawn: 4, scale: [0.8, 1.2] },
    bush: { name: 'Shrub', vis: ['bush'], hp: 1, act: 'pick', drops: [D('fiber', 1, 2), D('stick', 0, 1)], respawn: 3, scale: [0.8, 1.4] },
    berry: { name: 'Berry bush', vis: ['berry'], act: 'pick', drops: [D('berries', 2, 4)], respawn: 2, scale: [0.8, 1.1] },
    flax: { name: 'Sea flax', vis: ['flax'], act: 'pick', drops: [D('fiber', 2, 3), D('seeds_flax', 0, 1)], respawn: 2, scale: [0.9, 1.3] },
    aloe: { name: 'Aloe', vis: ['aloe'], act: 'pick', drops: [D('aloe', 1, 2), D('seeds_aloe', 0, 1)], respawn: 4, scale: [0.9, 1.4] },
    mushroom: { name: 'Mushrooms', vis: ['mushroom'], act: 'pick', drops: [D('mushroom', 1, 3)], respawn: 3, scale: [1, 1.6] },
    banana: { name: 'Banana plant', vis: ['banana'], act: 'pick', drops: [D('banana', 2, 4)], respawn: 4, scale: [0.9, 1.2], keep: 1 },
    mango: { name: 'Mango tree', vis: ['mango'], rad: 0.4, act: 'pick', drops: [D('mango', 2, 3)], respawn: 4, scale: [0.9, 1.2], keep: 1, far: 'tree' },
    pineapple: { name: 'Wild pineapple', vis: ['pineapple'], act: 'pick', drops: [D('pineapple', 1, 1), D('seeds_pineapple', 0, 1)], respawn: 5, scale: [1, 1.3] },
    potato: { name: 'Wild potato', vis: ['potato'], act: 'pick', drops: [D('potato', 1, 3), D('seeds_potato', 0, 1)], respawn: 4, scale: [1, 1.5] },
    rock: { name: 'Boulder', vis: ['rock0', 'rock1'], rad: 0.9, hp: 5, act: 'mine', tier: 0, drops: [D('stone', 3, 5), D('flint', 0, 2)], respawn: 10, scale: [0.8, 1.9] },
    basalt: { name: 'Basalt', vis: ['basalt'], rad: 0.9, hp: 6, act: 'mine', tier: 0, drops: [D('stone', 3, 5), D('obsidian', 0, 1)], respawn: 10, scale: [0.9, 2.2] },
    ore_iron: { name: 'Iron-bearing rock', vis: ['ore_iron'], rad: 0.9, hp: 7, act: 'mine', tier: 1, drops: [D('iron_ore', 2, 4), D('stone', 1, 2)], respawn: 14, scale: [0.9, 1.4] },
    ore_copper: { name: 'Copper-bearing rock', vis: ['ore_copper'], rad: 0.9, hp: 7, act: 'mine', tier: 1, drops: [D('copper_ore', 2, 4), D('stone', 1, 2)], respawn: 14, scale: [0.9, 1.4] },
    sulfur: { name: 'Sulfur deposit', vis: ['sulfur'], rad: 0.8, hp: 5, act: 'mine', tier: 1, drops: [D('sulfur', 2, 3)], respawn: 14, scale: [0.8, 1.2] },
    obsidian: { name: 'Obsidian', vis: ['obsidian'], rad: 0.8, hp: 9, act: 'mine', tier: 2, drops: [D('obsidian', 2, 3)], respawn: 16, scale: [0.8, 1.3] },
    titanium: { name: 'Titanium nodule', vis: ['titanium'], rad: 0.8, hp: 10, act: 'mine', tier: 2, drops: [D('titanium', 1, 2)], respawn: 20, scale: [0.7, 1.1] },
    crystal: { name: 'Resonant crystal', vis: ['crystal'], rad: 0.5, hp: 6, act: 'mine', tier: 2, drops: [D('crystal', 1, 1)], respawn: 30, scale: [1, 1.5] },
    clay: { name: 'Clay deposit', vis: ['clay'], act: 'pick', drops: [D('clay', 2, 3)], respawn: 5, scale: [0.8, 1.4] },
    stone: { name: 'Loose stones', vis: ['stone'], act: 'pick', drops: [D('stone', 1, 2)], respawn: 3, scale: [0.9, 1.5] },
    flint: { name: 'Flint', vis: ['flint'], act: 'pick', drops: [D('flint', 1, 1)], respawn: 4, scale: [1, 1.5] },
    stick: { name: 'Sticks', vis: ['stick'], act: 'pick', drops: [D('stick', 1, 2)], respawn: 2, scale: [0.8, 1.3] },
    driftwood: { name: 'Driftwood', vis: ['driftwood'], act: 'pick', drops: [D('plank', 1, 2), D('stick', 1, 2)], respawn: 3, scale: [0.8, 1.3] },
    shell: { name: 'Seashell', vis: ['shell'], act: 'pick', drops: [D('shell', 1, 1)], respawn: 3, scale: [0.9, 1.6] },
    coconut: { name: 'Coconut', vis: ['coconut'], act: 'pick', drops: [D('coconut', 1, 1)], respawn: 2, scale: [0.9, 1.1] },
    clam: { name: 'Clam', vis: ['clam'], act: 'pick', drops: [D('clam', 1, 2)], respawn: 3, scale: [0.9, 1.4] },
    oyster: { name: 'Pearl oyster', vis: ['oyster'], act: 'pick', drops: [D('clam', 1, 1), D('pearl', 0, 1)], respawn: 9, scale: [1, 1.3] },
    seaweed: { name: 'Seaweed', vis: ['seaweed'], act: 'pick', drops: [D('seaweed', 1, 3)], respawn: 2, scale: [0.8, 1.5] },
    sponge: { name: 'Sea sponge', vis: ['sponge'], act: 'pick', drops: [D('sponge', 1, 1)], respawn: 6, scale: [0.9, 1.4] },
    scrap: { name: 'Scrap heap', vis: ['scrap'], act: 'pick', drops: [D('scrap', 1, 3), D('nails', 0, 2)], respawn: 0, scale: [0.9, 1.4] },
    vent: { name: 'Steam vent', vis: ['vent'], rad: 0.7, decor: 1, hazard: 'heat', scale: [0.9, 1.4] },
    coral: { name: 'Coral', vis: ['coral0', 'coral1', 'coral2', 'coral3', 'coral4', 'coral5', 'coral6', 'coral7'], decor: 1, scale: [0.8, 2.4] },
    kelp: { name: 'Kelp', vis: ['kelp'], decor: 1, scale: [0.8, 1.4] }
  };
  // [type, count per 100m radius-equivalent, zone]
  const SPAWN = {
    tropical: [['palm', 58, 'beach'], ['palm', 26, 'inland'], ['bush', 30, 'inland'], ['flax', 14, 'mid'], ['coconut', 12, 'beach'], ['driftwood', 9, 'shore'], ['stick', 16, 'beach'], ['stone', 18, 'beachAll'], ['flint', 6, 'beachAll'], ['shell', 12, 'shore'], ['rock', 9, 'mid'], ['berry', 7, 'inland'], ['aloe', 5, 'mid'], ['banana', 4, 'inland'], ['pineapple', 3, 'inland'], ['potato', 4, 'inland'], ['mango', 2, 'inland'], ['tree', 10, 'inland'], ['clam', 14, 'water'], ['seaweed', 22, 'water'], ['coral', 60, 'water'], ['sponge', 5, 'water'], ['oyster', 2, 'water']],
    jungle: [['tree', 150, 'inland'], ['palm', 30, 'beach'], ['bush', 60, 'inland'], ['bamboo', 16, 'inland'], ['mushroom', 14, 'inland'], ['berry', 12, 'inland'], ['mango', 6, 'inland'], ['banana', 9, 'inland'], ['aloe', 8, 'inland'], ['flax', 10, 'mid'], ['potato', 6, 'inland'], ['rock', 16, 'inland'], ['ore_iron', 3, 'inland'], ['stick', 22, 'mid'], ['stone', 14, 'beachAll'], ['flint', 6, 'beachAll'], ['driftwood', 6, 'shore'], ['deadtree', 6, 'inland'], ['clay', 5, 'shore'], ['clam', 8, 'water'], ['seaweed', 18, 'water'], ['coral', 30, 'water']],
    volcanic: [['basalt', 40, 'inland'], ['obsidian', 10, 'high'], ['sulfur', 12, 'high'], ['ore_iron', 9, 'inland'], ['ore_copper', 7, 'inland'], ['vent', 9, 'high'], ['deadtree', 12, 'mid'], ['bush', 12, 'mid'], ['palm', 10, 'beach'], ['stone', 20, 'beachAll'], ['flint', 10, 'beachAll'], ['stick', 8, 'beach'], ['aloe', 4, 'mid'], ['seaweed', 10, 'water'], ['titanium', 2, 'water'], ['coral', 14, 'water']],
    rocky: [['rock', 34, 'inland'], ['ore_iron', 8, 'inland'], ['ore_copper', 7, 'inland'], ['stone', 24, 'beachAll'], ['flint', 12, 'beachAll'], ['bush', 12, 'inland'], ['flax', 8, 'inland'], ['deadtree', 5, 'inland'], ['palm', 5, 'beach'], ['shell', 8, 'shore'], ['driftwood', 6, 'shore'], ['aloe', 3, 'inland'], ['clam', 10, 'water'], ['seaweed', 16, 'water'], ['coral', 24, 'water'], ['oyster', 3, 'water']],
    mangrove: [['mangrove', 90, 'swamp'], ['clay', 16, 'shore'], ['bush', 20, 'mid'], ['flax', 16, 'beach'], ['mushroom', 10, 'beach'], ['stick', 20, 'beachAll'], ['driftwood', 10, 'shore'], ['palm', 10, 'mid'], ['aloe', 6, 'beach'], ['potato', 6, 'beach'], ['stone', 8, 'beachAll'], ['clam', 20, 'water'], ['seaweed', 26, 'water'], ['oyster', 4, 'water'], ['coral', 10, 'water']]
  };
  const ZONE = {
    beach: (h, s) => h > 1.0 && h < 3.4 && s < 0.4, beachAll: (h, s) => h > 0.5 && h < 5 && s < 0.5, shore: (h) => h > -0.3 && h < 1.1,
    inland: (h, s) => h > 3.0 && s < 0.55, mid: (h, s) => h > 1.8 && h < 12 && s < 0.5, high: (h, s) => h > 14 && s < 0.9,
    water: (h) => h < -1.6 && h > -13, swamp: (h) => h > -0.9 && h < 1.7
  };
  const SYL_A = ['Ka', 'Mo', 'Tal', 'Ni', 'Sa', 'Oro', 'Lu', 'Ve', 'Hai', 'Pel', 'Ana', 'Rua', 'Ki', 'Tor', 'Mar', 'Eli', 'Ba', 'Wai', 'Sol', 'Isa'];
  const SYL_B = ['lani', 'reva', 'mua', 'kai', 'tonga', 'veda', 'nui', 'lau', 'mera', 'sina', 'rota', 'hina', 'pua', 'tavi', 'luma', 'noa'];
  const SUFFIX = { tropical: ['Cay', 'Atoll', 'Key', 'Isle'], jungle: ['Island', 'Wilds', 'Isle'], volcanic: ['Peak', 'Crown', 'Caldera'], rocky: ['Rock', 'Stack', 'Skerry'], mangrove: ['Shallows', 'Fen', 'Mire'], settlement: ['Landing', 'Harbor'], research: ['Station', 'Point'] };

  const W = G.world = {
    CELL, seed: 1, islands: [], pois: [], owners: [], byCell: new Map(), floorSites: [], removed: {}, opened: {}, loadedSolids: [], current: null, story: {},
    key(cx, cz) { return cx + ',' + cz; },

    generate(seed) {
      this.unloadAll();
      this.seed = seed >>> 0; this.islands = []; this.pois = []; this.byCell = new Map(); this.floorSites = []; this.story = {};
      const rnd = G.rng(this.seed ^ 0x51ed);
      const used = new Set(['0,0']);
      const base = rnd() * Math.PI * 2;
      const place = (ang, ring) => {
        for (let tries = 0; tries < 40; tries++) {
          let cx = Math.round(Math.cos(ang) * ring), cz = Math.round(Math.sin(ang) * ring);
          cx = G.clamp(cx, -GN, GN); cz = G.clamp(cz, -GN, GN); const k = this.key(cx, cz);
          if (!used.has(k)) { used.add(k); return [cx, cz]; } ang += 0.37;
        }
        return [GN, GN];
      };
      const forced = {};
      const story = (id, ang, ring, def) => { const c = place(base + ang, ring); forced[this.key(c[0], c[1])] = Object.assign({ story: id }, def); };
      story('start', 0.0, 1, { type: 'tropical', name: 'Castaway Cay', toward: 0.3 });
      story('calloway', 4.9, 1, { poi: 'calloway', name: 'Wreck of the RV Calloway' });
      story('lanternA', 0.9, 2, { type: 'rocky', name: 'Lantern Alpha — Petrel Rock' });
      story('lanternB', 2.6, 3, { type: 'jungle', name: 'Lantern Beta — Greenhollow' });
      story('lanternC', 4.4, 4, { type: 'mangrove', name: 'Lantern Gamma — The Mire' });
      story('haven', 1.9, 3, { type: 'settlement', name: 'Haven' });
      story('mayday', 1.3, 4, { type: 'rocky', name: 'Gull Skerry' });
      story('meridian', 5.4, 4, { type: 'research', name: 'Meridian Station' });
      story('deepwell', 3.0, 4, { poi: 'deepwell', name: 'Deepwell Laboratory' });
      story('cinder', 3.6, 5, { type: 'volcanic', name: 'Cinder Crown' });
      story('keystone', 0.2, 6, { poi: 'keystone', name: 'The Keystone' });
      let id = 0;
      for (let cz = -GN; cz <= GN; cz++) for (let cx = -GN; cx <= GN; cx++) {
        const k = this.key(cx, cz); if (k === '0,0') continue;
        const h = G.hash2(cx, cz, this.seed), h2 = G.hash2(cx + 91, cz - 37, this.seed), h3 = G.hash2(cx - 13, cz + 57, this.seed);
        const f = forced[k]; const ring = Math.hypot(cx, cz);
        let x = cx * CELL + (h2 - 0.5) * 0.3 * CELL, z = cz * CELL + (h3 - 0.5) * 0.3 * CELL;
        if (f && f.toward) { x = cx * CELL * (1 - f.toward); z = cz * CELL * (1 - f.toward); }
        const r2 = G.rng((this.seed + id * 7919 + 13) >>> 0);
        if (f ? !!f.type : h < 0.56) {
          let type = f ? f.type : null;
          if (!type) {
            const t = ring < 2.3 ? [['tropical', 5], ['rocky', 2], ['settlement', 1.2], ['mangrove', 1]] :
              ring < 4.3 ? [['tropical', 3], ['jungle', 3.5], ['mangrove', 2], ['rocky', 2], ['settlement', 1.5], ['research', 1.2], ['volcanic', 0.6]] :
                [['jungle', 3], ['volcanic', 2.6], ['rocky', 2.4], ['research', 1.6], ['tropical', 1.5], ['mangrove', 1.2], ['settlement', 0.8]];
            type = G.weighted(r2, t);
          }
          const T = TYPE[type]; const I = {
            id: 'i' + id, kind: 'island', type, biome: T.biome, x, z, cx, cz, seed: (this.seed + id * 104729) >>> 0,
            r: G.lerp(T.r[0], T.r[1], r2()), elev: G.lerp(T.elev[0], T.elev[1], r2()), cone: T.cone ? G.lerp(T.cone[0], T.cone[1], r2()) : 0,
            ox: r2() * 50, oz: r2() * 50, story: f ? f.story : null, sites: []
          };
          if (f && f.story === 'start') { I.r = 96; I.elev = 9; }
          if (f && f.story === 'haven') { I.r = 118; I.elev = 7; }
          I.p = BIOME[I.biome]; I.shelf = I.p.shelf;
          I.name = f && f.name ? f.name : G.pick(r2, SYL_A) + G.pick(r2, SYL_B) + ' ' + G.pick(r2, SUFFIX[type]);
          this.islands.push(I); this.byCell.set(k, I); if (I.story) this.story[I.story] = I;
          G.sites.planIsland(I, r2);
        } else {
          let kind = f ? f.poi : null;
          if (!kind) kind = G.weighted(r2, [['wreck', 1.5], ['plane', 0.8], ['yacht', 0.7], ['reef', 2], ['kelp', 1.4], ['buoy', 0.9], ['rig', 0.6], ['cache', 0.9], ['none', 0.7]]);
          if (kind === 'none') { id++; continue; }
          const P = { id: 'p' + id, kind: 'poi', poi: kind, x, z, cx, cz, seed: (this.seed + id * 15485863) >>> 0, story: f ? f.story : null, name: f && f.name ? f.name : null };
          G.sites.planPoi(P, r2); this.pois.push(P); if (P.story) this.story[P.story] = P;
        }
        id++;
      }
      this.owners = this.islands.concat(this.pois);
      G.ocean.setBaseDir(base * 0.37 + 0.4);
    },

    // ---------- height field ----------
    floorH(x, z) {
      const s = this.seed;
      // a shallow tropical bank: mostly 12-28 m, so the bottom shows through clear water; sand banks rise higher,
      // and a few trenches still drop away for deep diving
      let h = -12 - G.fbm(x * 0.0016, z * 0.0016, s + 50, 4) * 16;
      h -= G.sstep(0.66, 0.82, G.fbm(x * 0.0009 + 40, z * 0.0009 - 13, s + 51, 3)) * 70;
      h += G.sstep(0.6, 0.76, G.fbm(x * 0.004, z * 0.004, s + 53, 3)) * 7;
      h += (G.fbm(x * 0.02, z * 0.02, s + 52, 2) - 0.5) * 5;
      const F = this.floorSites;
      for (let i = 0; i < F.length; i++) { const f = F[i], d = Math.hypot(x - f.x, z - f.z); if (d < f.r) h = G.lerp(h, f.h + (f.bump ? (G.fbm(x * 0.06, z * 0.06, s + 60, 3) - 0.5) * f.bump : 0), G.sstep(f.r, f.r * 0.45, d)); }
      return Math.min(h, -2.5);
    },
    rawIsland(I, x, z) {
      const dx = x - I.x, dz = z - I.z, d = Math.hypot(dx, dz) || 0.001, P = I.p;
      const na = G.fbm(dx / d * 1.25 + I.ox, dz / d * 1.25 + I.oz, I.seed, 3);
      const m = I.r * (0.70 + 0.58 * na) - d + (G.fbm(x * 0.03, z * 0.03, I.seed + 7, 2) - 0.5) * 18;
      this._m = m; let L;
      if (m < 0) L = Math.max(m * I.shelf, -14);
      else {
        const beach = P.cliff ? P.cliff * G.sstep(1, 6, m) + 0.7 * G.sstep(0, 3, m) : 1.4 * G.sstep(0, 13, m);
        const inland = G.sstep(9, I.r * 0.7, m), hn = G.fbm(x * 0.011 + 3, z * 0.011 - 5, I.seed + 3, 4);
        L = beach + I.elev * Math.pow(inland, P.pow) * (0.4 + hn) + (G.fbm(x * 0.045, z * 0.045, I.seed + 9, 2) - 0.5) * 1.6 * inland;
        if (I.cone) { const c = 1 - d / (I.r * 0.5); if (c > 0) { L += I.cone * Math.pow(c, 1.25); const cd = d / (I.r * 0.11); if (cd < 1) L -= I.cone * 0.4 * (1 - cd * cd); } }
        if (P.channels) { const ch = Math.abs(G.fbm(x * 0.018 + 9, z * 0.018, I.seed + 5, 3) - 0.5); L = Math.min(L, 1.2 + hn * 1.2); if (ch < 0.04 && m > 6) L = G.lerp(L, -1.0, 1 - ch / 0.04); }
      }
      return L;
    },
    islandH(I, x, z) {
      let L = this.rawIsland(I, x, z); const S = I.sites;
      for (let i = 0; i < S.length; i++) {
        const s = S[i], ds = Math.hypot(x - s.x, z - s.z);
        if (ds < s.r + 12) { L = G.lerp(L, s.h, G.sstep(s.r + 12, s.r, ds)); if (s.kind === 'pond') { const q = ds / (s.r * 0.85); if (q < 1) L -= 1.1 * (1 - q * q); } }
      }
      return L;
    },
    islandNear(x, z) {
      const cx = Math.round(x / CELL), cz = Math.round(z / CELL); let best = null, bd = 1e9;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const I = this.byCell.get(this.key(cx + i, cz + j)); if (!I) continue;
        const d = Math.hypot(x - I.x, z - I.z) - I.r; if (d < bd) { bd = d; best = I; }
      }
      this._nearD = bd; return bd < I_REACH ? best : null;
    },
    height(x, z) {
      const f = this.floorH(x, z); const I = this.islandNear(x, z); if (!I) return f;
      const L = this.islandH(I, x, z); const w = G.sstep(-120, -35, this._m);
      return w <= 0 ? f : G.lerp(f, L, w);
    },
    // fast path: bilinear sample of the loaded island grid (matches the rendered mesh)
    heightAt(x, z) {
      const I = this.islandNear(x, z);
      if (I && I.inst && I.inst.grid) {
        const n = I.inst, u = (x - I.x + n.E) / (2 * n.E) * n.N, v = (z - I.z + n.E) / (2 * n.E) * n.N;
        if (u >= 0 && v >= 0 && u < n.N && v < n.N) {
          const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, s = n.N + 1, g = n.grid;
          const a = g[j * s + i], b = g[j * s + i + 1], c = g[(j + 1) * s + i], d = g[(j + 1) * s + i + 1];
          return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv;
        }
      }
      return this.height(x, z);
    },
    slopeAt(x, z) { const h = this.heightAt(x, z); return Math.hypot(this.heightAt(x + 0.8, z) - h, this.heightAt(x, z + 0.8) - h) / 0.8; },

    // ---------- terrain meshes ----------
    // surface colour (procedural fallback and tint) and, when w is given, texture splat weights [sand, vegetation, rock, seabed, jungle share]
    color(I, x, z, h, ny, out, w) {
      const P = I ? I.p : BIOME.tropical, n = G.noise2(x * 0.07, z * 0.07, 7), n2 = G.noise2(x * 0.3, z * 0.3, 8);
      let c, ws = 0, wv = 0, wr = 0, wb = 0;
      if (h < -0.4) {
        const dk = G.sstep(-4, -40, h); c = [G.lerp(P.sand[0] * 0.95, 0.30, dk), G.lerp(P.sand[1] * 0.95, 0.31, dk), G.lerp(P.sand[2] * 0.95, 0.30, dk)];
        const rk = G.sstep(0.58, 0.7, G.noise2(x * 0.035, z * 0.035, 9)); c = mix(c, [0.22, 0.24, 0.2], rk * 0.75);
        // shallow water keeps clean sand; deeper it becomes coral rubble, with rock outcrops
        const sb = G.sstep(-1.5, -7, h) * (0.55 + 0.45 * G.sstep(0.35, 0.6, n)); ws = 1 - sb; wb = sb; wr = rk * 0.8;
        if (ny < 0.8) { c = mix(c, P.rock, 0.8); wr = Math.max(wr, G.sstep(0.8, 0.62, ny)); }
      } else if (h < 1.9 + n * 0.9) { c = mix(P.sand, [P.sand[0] * 0.8, P.sand[1] * 0.8, P.sand[2] * 0.78], n2 * 0.4); ws = 1; }
      else {
        c = mix(P.grass, P.dirt, G.sstep(0.45, 0.8, n) * 0.7 + n2 * 0.15);
        const sd = 1 - G.sstep(1.9, 3.4, h); c = mix(c, P.sand, sd); ws = sd; wv = 1 - sd;
        if (I && I.cone && h > 16) { const k = G.sstep(16, 30, h); c = mix(c, mix(P.rock, [0.36, 0.13, 0.06], G.sstep(0.5, 0.9, n)), k); wr = Math.max(wr, k); }
        if (I && I.biome === 'rocky') wr = Math.max(wr, G.sstep(0.35, 0.75, n) * 0.85);
      }
      if (h >= -0.4) { const k = G.sstep(0.84, 0.66, ny); c = mix(c, [P.rock[0] * (0.85 + n2 * 0.3), P.rock[1] * (0.85 + n2 * 0.3), P.rock[2] * (0.85 + n2 * 0.3)], k); wr = Math.max(wr, k); }
      out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
      if (w) {
        const t = ws + wv + wb + 1e-6, k = 1 - wr; w[0] = ws / t * k; w[1] = wv / t * k; w[2] = wr; w[3] = wb / t * k;
        const jb = I ? (I.biome === 'jungle' || I.biome === 'mangrove' ? 0.85 : I.biome === 'tropical' ? 0.35 : 0.15) : 0;
        w[4] = G.clamp(jb + (G.noise2(x * 0.02, z * 0.02, 11) - 0.5) * 0.9, 0, 1);
      }
    },
    buildTerrain(I, N, keepGrid) {
      const E = I.r * 1.28 + 135, s = N + 1, step = 2 * E / N;
      const grid = new Float32Array(s * s), pos = new Float32Array(s * s * 3), uv = new Float32Array(s * s * 2), idx = new Uint32Array(N * N * 6);
      let p = 0;
      for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
        const x = I.x - E + i * step, z = I.z - E + j * step; const f = this.floorH(x, z), L = this.islandH(I, x, z), w = G.sstep(-120, -35, this._m);
        const h = w <= 0 ? f : G.lerp(f, L, w); grid[p] = h; pos[p * 3] = x; pos[p * 3 + 1] = h; pos[p * 3 + 2] = z; uv[p * 2] = x * 0.22; uv[p * 2 + 1] = z * 0.22; p++;
      }
      p = 0;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * s + i, b = a + 1, c = a + s, d = c + 1; idx[p++] = a; idx[p++] = c; idx[p++] = b; idx[p++] = b; idx[p++] = c; idx[p++] = d; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.computeVertexNormals(); const nor = g.attributes.normal; const col = new Float32Array(s * s * 3), spl = new Float32Array(s * s * 4), jun = new Float32Array(s * s), tmp = [0, 0, 0], w = [0, 0, 0, 0, 0];
      for (let k = 0; k < s * s; k++) { this.color(I, pos[k * 3], pos[k * 3 + 2], pos[k * 3 + 1], nor.getY(k), tmp, w); col[k * 3] = tmp[0]; col[k * 3 + 1] = tmp[1]; col[k * 3 + 2] = tmp[2]; spl[k * 4] = w[0]; spl[k * 4 + 1] = w[1]; spl[k * 4 + 2] = w[2]; spl[k * 4 + 3] = w[3]; jun[k] = w[4]; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aSplat', new THREE.BufferAttribute(spl, 4)); g.setAttribute('aJungle', new THREE.BufferAttribute(jun, 1));
      const mesh = new THREE.Mesh(g, G.mats.terrain); mesh.receiveShadow = true; mesh.castShadow = N > 80;
      return { mesh, grid: keepGrid ? grid : null, N, E };
    },

    // ---------- nodes ----------
    planNodes(I) {
      if (I.nodes) return I.nodes;
      const rnd = G.rng(I.seed ^ 0xabc), nodes = [], occ = new Set(), table = SPAWN[I.biome], area = (I.r / 100) * (I.r / 100), R = I.r * 1.3 + 60;
      const tryPlace = (type, zone, extra) => {
        const x = I.x + (rnd() * 2 - 1) * R, z = I.z + (rnd() * 2 - 1) * R; this.islandH(I, x, z);
        if (this._m < -110) return false;
        // the real ground (island shape blended with the ocean floor), so seabed nodes sit on the bottom
        const h = this.height(x, z), s = Math.hypot(this.height(x + 1, z) - h, this.height(x, z + 1) - h);
        if (!ZONE[zone](h, s)) return false;
        for (const st of I.sites) if (Math.hypot(x - st.x, z - st.z) < st.r + 1.5) return false;
        const def = NODES[type]; const k = Math.round(x / 2.2) + ',' + Math.round(z / 2.2);
        if (def.rad) { if (occ.has(k)) return false; occ.add(k); }
        const sc = G.lerp(def.scale[0], def.scale[1], rnd());
        nodes.push(Object.assign({ t: type, v: G.pick(rnd, def.vis), x, y: h - (def.rad ? 0.08 : 0.02), z, s: sc, r: rnd() * 6.283, alive: true, hp: def.hp || 1, id: nodes.length }, extra));
        return true;
      };
      for (const [type, per, zone] of table) { const want = Math.round(per * area); let got = 0; for (let t = 0; t < want * 8 && got < want; t++) if (tryPlace(type, zone)) got++; }
      if (I.story === 'cinder') { let got = 0; for (let t = 0; t < 4000 && got < 6; t++) { const a = rnd() * 6.28, d = rnd() * I.r * 0.09; const x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d; nodes.push({ t: 'crystal', v: 'crystal', x, y: this.islandH(I, x, z) - 0.05, z, s: 1.2, r: rnd() * 6, alive: true, hp: 6, id: nodes.length }); got++; } }
      I.nodes = nodes; return nodes;
    },
    buildVeg(I) {
      const inst = I.inst, nodes = this.planNodes(I), grp = new THREE.Group(), day = G.time ? G.time.day : 0, rem = this.removed[I.id] || {};
      const byVis = {};
      for (const n of nodes) {
        if (rem[n.id] != null) { const rs = NODES[n.t].respawn; if (rs && day - rem[n.id] >= rs) { delete rem[n.id]; n.alive = true; n.hp = NODES[n.t].hp || 1; } else n.alive = false; }
        (byVis[n.v] = byVis[n.v] || []).push(n);
      }
      // decorative ground cover (not saved, scaled by settings)
      const rnd = G.rng(I.seed ^ 0x77), deco = Math.round(1600 * (I.r / 100) * (I.r / 100) * G.settings.veg * (I.biome === 'jungle' ? 1.6 : I.biome === 'volcanic' ? 0.3 : 1));
      const R = I.r * 1.2;
      for (let i = 0, got = 0; i < deco * 4 && got < deco; i++) {
        const x = I.x + (rnd() * 2 - 1) * R, z = I.z + (rnd() * 2 - 1) * R, h = this.heightAt(x, z); if (h < 2.4 || h > 60) continue;
        const v = rnd() < 0.8 ? 'grass' : 'fern'; (byVis[v] = byVis[v] || []).push({ x, y: h - 0.03, z, s: 0.7 + rnd() * 0.9, r: rnd() * 6.28, alive: true, deco: true }); got++;
      }
      // the reef: dense patch reefs of mixed coral, sponges and sea grass on the shallow shelf, with sand between them
      { const RR = I.r * 1.3 + 90, want = Math.round(2600 * (I.r / 100) * (I.r / 100) * G.settings.veg * (I.biome === 'volcanic' ? 0.4 : I.biome === 'mangrove' ? 0.5 : 1)), sd = (I.seed % 97) + 11;
        const pick = [['coral0', 13], ['coral1', 13], ['coral2', 9], ['coral3', 11], ['coral4', 9], ['coral5', 12], ['coral6', 6], ['coral7', 5], ['sponge', 7], ['seaweed', 14], ['_rock1', 4]];
        for (let i = 0, got = 0; i < want * 6 && got < want; i++) {
          const x = I.x + (rnd() * 2 - 1) * RR, z = I.z + (rnd() * 2 - 1) * RR, h = this.heightAt(x, z); if (h > -1.4 || h < -22) continue;
          const patch = G.noise2(x * 0.03, z * 0.03, sd), fine = G.noise2(x * 0.15, z * 0.15, sd + 3);
          if (rnd() > (patch > 0.5 ? 1 : patch > 0.42 ? 0.45 : 0.06) * (0.6 + fine * 0.6)) continue;
          let v = G.weighted(rnd, pick); if ((v === 'coral6' || v === 'coral7') && h > -5) v = 'coral0'; if (v === 'seaweed' && patch > 0.55) v = 'coral3';
          const sc = v === 'seaweed' ? 0.8 + rnd() * 0.8 : v === '_rock1' ? 0.25 + rnd() * 0.5 : 0.45 + rnd() * 1.3;
          (byVis[v] = byVis[v] || []).push({ x, y: h - 0.06, z, s: sc, r: rnd() * 6.28, alive: true, deco: true }); got++;
        }
        // rock outcrops scattered along the reef and giant kelp forests on the sandier, deeper ground
        const nr = Math.round(want * 0.05), nk = Math.round(want * 0.05);
        for (let i = 0, got = 0; i < nr * 8 && got < nr; i++) { const x = I.x + (rnd() * 2 - 1) * RR, z = I.z + (rnd() * 2 - 1) * RR, h = this.heightAt(x, z); if (h > -2.5 || h < -26) continue; const v = rnd() < 0.5 ? 'rock0' : 'rock1'; (byVis[v] = byVis[v] || []).push({ x, y: h - 0.4, z, s: 0.8 + rnd() * 2.4, r: rnd() * 6.28, alive: true, deco: true }); got++; }
        for (let i = 0, got = 0; i < nk * 10 && got < nk; i++) { const x = I.x + (rnd() * 2 - 1) * RR, z = I.z + (rnd() * 2 - 1) * RR, h = this.heightAt(x, z); if (h > -5 || h < -24 || G.noise2(x * 0.03, z * 0.03, sd) > 0.48 || G.noise2(x * 0.012, z * 0.012, sd + 9) < 0.5) continue; const kc = 3 + Math.floor(rnd() * 5); for (let c = 0; c < kc; c++) { const kx = x + (rnd() - 0.5) * 7, kz = z + (rnd() - 0.5) * 7, kh = this.heightAt(kx, kz); if (kh > -4) continue; (byVis.kelp = byVis.kelp || []).push({ x: kx, y: kh - 0.05, z: kz, s: Math.min(1.5, (-kh - 1) / 10) * (0.8 + rnd() * 0.3), r: rnd() * 6.28, alive: true, deco: true }); } got++; }
      }
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
      inst.meshes = {};
      for (const v in byVis) {
        const list = byVis[v], gs = G.nodeGeo[v]; if (!gs) continue; const arr = [];
        for (const mk in gs) {
          const geo = gs[mk]; if (!geo || !geo.isBufferGeometry) continue;
          const im = new THREE.InstancedMesh(geo, G.mats[mk], list.length);
          im.castShadow = !(mk === 'grassCard' || mk === 'kelp' || mk === 'coral' || mk === 'brain' || mk === 'fan' || v === 'grass' || v === 'fern' || v === 'sponge' || v === 'seaweed' || v === '_rock1'); im.receiveShadow = true;
          if (mk === 'frond') im.customDepthMaterial = G.mats.frondDepth; if (mk === 'leafCard') im.customDepthMaterial = G.mats.leafDepth; if (mk === 'foliage') im.customDepthMaterial = G.mats.foliageDepth;
          list.forEach((n, i) => {
            n.ii = i; e.set(0, n.r, 0); q.setFromEuler(e); p.set(n.x, n.y, n.z); const s = n.alive ? n.s : 0; sc.set(s, s, s); im.setMatrixAt(i, m4.compose(p, q, sc));
          });
          im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); grp.add(im); arr.push(im);
        }
        inst.meshes[v] = arr;
      }
      // spatial hash for interaction and collision
      inst.nodeGrid = new Map();
      for (const n of nodes) { const k = Math.floor(n.x / 8) + ',' + Math.floor(n.z / 8); let a = inst.nodeGrid.get(k); if (!a) inst.nodeGrid.set(k, a = []); a.push(n); }
      inst.veg = grp; G.scene.add(grp);
    },
    setNodeVisible(I, n, vis) {
      const arr = I.inst && I.inst.meshes && I.inst.meshes[n.v]; if (!arr) return;
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, n.r, 0)), s = vis ? n.s : 0;
      m4.compose(new THREE.Vector3(n.x, n.y, n.z), q, new THREE.Vector3(s, s, s));
      for (const im of arr) { im.setMatrixAt(n.ii, m4); im.instanceMatrix.needsUpdate = true; }
    },
    removeNode(I, n) {
      n.alive = false; (this.removed[I.id] = this.removed[I.id] || {})[n.id] = G.time.day;
      if (!NODES[n.t].keep) this.setNodeVisible(I, n, false);
    },
    buildFar(I) {
      const nodes = this.planNodes(I), pos = [], col = [], idx = []; let vn = 0;
      const oct = (x, y, z, rx, ry, c) => {
        const P = [[rx, 0, 0], [-rx, 0, 0], [0, ry, 0], [0, -ry, 0], [0, 0, rx], [0, 0, -rx]];
        for (const q of P) { pos.push(x + q[0], y + q[1], z + q[2]); const k = 0.75 + (q[1] > 0 ? 0.4 : 0) - (q[1] < 0 ? 0.3 : 0); col.push(c[0] * k, c[1] * k, c[2] * k); }
        for (const f of [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]]) idx.push(vn + f[0], vn + f[1], vn + f[2]);
        vn += 6;
      };
      for (const n of nodes) {
        const f = NODES[n.t].far; if (!f) continue;
        if (f === 'palm') oct(n.x + 1, n.y + 7.6 * n.s, n.z, 3.2 * n.s, 1.3 * n.s, [0.1, 0.22, 0.06]); else oct(n.x, n.y + 7 * n.s, n.z, 3.6 * n.s, 3.2 * n.s, [0.06, 0.15, 0.04]);
      }
      if (!vn) return null;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
      if (!G.mats.farVeg) G.mats.farVeg = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
      const m = new THREE.Mesh(g, G.mats.farVeg); G.scene.add(m); return m;
    },

    // ---------- streaming ----------
    loadLo(I) { const t = this.buildTerrain(I, 56, false); I.inst = { lo: t.mesh, hiLoaded: false, solids: [], interact: [] }; G.scene.add(t.mesh); I.inst.far = this.buildFar(I); },
    loadHi(I) {
      const n = I.inst, t = this.buildTerrain(I, 152, true);
      n.hi = t.mesh; n.grid = t.grid; n.N = t.N; n.E = t.E; G.scene.add(n.hi); n.lo.visible = false; if (n.far) n.far.visible = false;
      this.buildVeg(I); G.sites.buildIsland(I); n.hiLoaded = true; G.emit('islandLoaded', I);
    },
    unloadHi(I) {
      const n = I.inst; if (!n || !n.hiLoaded) return;
      G.emit('islandUnloading', I);
      G.scene.remove(n.hi); n.hi.geometry.dispose(); n.hi = null; n.grid = null; n.lo.visible = true; if (n.far) n.far.visible = true;
      if (n.veg) { n.veg.traverse((o) => { if (o.isInstancedMesh) o.dispose(); }); G.scene.remove(n.veg); n.veg = null; n.meshes = null; n.nodeGrid = null; }
      G.sites.unload(I); n.hiLoaded = false;
    },
    unload(I) { if (!I.inst) return; this.unloadHi(I); G.scene.remove(I.inst.lo); I.inst.lo.geometry.dispose(); if (I.inst.far) { G.scene.remove(I.inst.far); I.inst.far.geometry.dispose(); } I.inst = null; },
    unloadAll() { for (const I of this.islands) this.unload(I); for (const P of this.pois) if (P.inst) G.sites.unload(P); if (this.floor) { G.scene.remove(this.floor); this.floor.geometry.dispose(); this.floor = null; } },
    // budget: number of heavy builds allowed this call (Infinity during loading screens)
    stream(px, pz, budget) {
      const dd = G.settings.drawDist; let work = 0; const near = [];
      for (const I of this.islands) {
        const d = Math.hypot(px - I.x, pz - I.z) - I.r; I._d = d;
        if (d < dd + 400) near.push(I);
        if (!I.inst) { if (d < dd && work < budget) { this.loadLo(I); work += 0.5; } }
        else if (d > dd + 250) this.unload(I);
        if (I.inst) {
          if (!I.inst.hiLoaded && d < 520 && work < budget) { this.loadHi(I); work += 1; }
          else if (I.inst.hiLoaded && d > 720) this.unloadHi(I);
        }
      }
      for (const P of this.pois) {
        const d = Math.hypot(px - P.x, pz - P.z), range = P.range || 520; P._d = d;
        if (!P.inst && d < range && work < budget) { G.sites.buildPoi(P); work += 0.5; } else if (P.inst && d > range + 150) G.sites.unload(P);
      }
      near.sort((a, b) => a._d - b._d); G.ocean.islands = near.slice(0, 8).map((I) => ({ x: I.x, z: I.z, r: I.r }));
      this.current = near.length && near[0]._d < near[0].r * 0.35 + 30 ? near[0] : null; this.nearest = near[0] || null;
      this.updateFloor(px, pz);
      return work;
    },
    updateFloor(px, pz) {
      const S = 14, N = 60, cx = Math.round(px / 56) * 56, cz = Math.round(pz / 56) * 56;
      if (this.floor && this.floor.userData.cx === cx && this.floor.userData.cz === cz) return;
      let g;
      if (!this.floor) {
        g = new THREE.BufferGeometry(); const s = N + 1; const idx = new Uint32Array(N * N * 6); let p = 0;
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * s + i, b = a + 1, c = a + s, d = c + 1; idx[p++] = a; idx[p++] = c; idx[p++] = b; idx[p++] = b; idx[p++] = c; idx[p++] = d; }
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(s * s * 3), 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(s * s * 2), 2));
        g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(s * s * 3), 3)); g.setAttribute('aSplat', new THREE.BufferAttribute(new Float32Array(s * s * 4), 4)); g.setAttribute('aJungle', new THREE.BufferAttribute(new Float32Array(s * s), 1)); g.setIndex(new THREE.BufferAttribute(idx, 1));
        this.floor = new THREE.Mesh(g, G.mats.terrain); this.floor.receiveShadow = true; this.floor.frustumCulled = false; G.scene.add(this.floor);
      }
      g = this.floor.geometry; const pos = g.attributes.position.array, uv = g.attributes.uv.array, col = g.attributes.color.array, spl = g.attributes.aSplat.array, tmp = [0, 0, 0], w = [0, 0, 0, 0, 0]; let p = 0;
      for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
        const x = cx + (i - N / 2) * S, z = cz + (j - N / 2) * S, h = this.height(x, z);
        pos[p * 3] = x; pos[p * 3 + 1] = h - 0.6; pos[p * 3 + 2] = z; uv[p * 2] = x * 0.22; uv[p * 2 + 1] = z * 0.22;
        this.color(null, x, z, Math.min(h, -1), 1, tmp, w); col[p * 3] = tmp[0]; col[p * 3 + 1] = tmp[1]; col[p * 3 + 2] = tmp[2]; spl[p * 4] = w[0]; spl[p * 4 + 1] = w[1]; spl[p * 4 + 2] = w[2]; spl[p * 4 + 3] = w[3]; p++;
      }
      g.attributes.position.needsUpdate = true; g.attributes.uv.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.aSplat.needsUpdate = true; g.computeVertexNormals();
      this.floor.userData.cx = cx; this.floor.userData.cz = cz;
    },

    // ---------- queries ----------
    // nearest alive, interactive node close to a view ray
    pickNode(ox, oy, oz, dx, dy, dz, reach) {
      let best = null, bs = 1e9, bI = null;
      for (const I of this.owners) {
        if (!I.inst || !I.inst.nodeGrid || I._d > 80) continue;
        const gx = Math.floor(ox / 8), gz = Math.floor(oz / 8);
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
          const a = I.inst.nodeGrid.get((gx + i) + ',' + (gz + j)); if (!a) continue;
          for (const n of a) {
            const def = NODES[n.t]; if (!n.alive || def.decor) continue;
            const hgt = def.fall ? 1.4 : (def.rad ? def.rad * n.s * 0.6 : 0.25);
            const px = n.x - ox, py = n.y + hgt - oy, pz = n.z - oz; const t = px * dx + py * dy + pz * dz; if (t < 0 || t > reach + (def.rad || 0.3)) continue;
            const cxp = px - dx * t, cyp = py - dy * t, czp = pz - dz * t; const off = Math.hypot(cxp, def.fall ? cyp * 0.3 : cyp, czp);
            const tol = (def.rad ? def.rad * n.s : 0.3) + 0.35; if (off > tol) continue;
            const score = t + off * 2; if (score < bs) { bs = score; best = n; bI = I; }
          }
        }
      }
      return best ? { node: best, island: bI } : null;
    },
    // push a circle out of node colliders
    collideNodes(pos, rad, feetY) {
      for (const I of this.owners) {
        if (!I.inst || !I.inst.nodeGrid || I._d > 60) continue;
        const gx = Math.floor(pos.x / 8), gz = Math.floor(pos.z / 8);
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
          const a = I.inst.nodeGrid.get((gx + i) + ',' + (gz + j)); if (!a) continue;
          for (const n of a) {
            const def = NODES[n.t]; if (!n.alive || !def.rad) continue;
            if (!def.fall && feetY > n.y + def.rad * n.s * 1.1) continue;
            const r = def.rad * (def.fall ? 1 : n.s) + rad, dx = pos.x - n.x, dz = pos.z - n.z, d = Math.hypot(dx, dz);
            if (d < r && d > 0.0001) { pos.x = n.x + dx / d * r; pos.z = n.z + dz / d * r; }
          }
        }
      }
    },
    serialize() { return { removed: this.removed, opened: this.opened }; },
    deserialize(d) { this.removed = (d && d.removed) || {}; this.opened = (d && d.opened) || {}; }
  };
  const I_REACH = 320;
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
})();
