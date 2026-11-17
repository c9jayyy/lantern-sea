'use strict';
/* Quest engine, story interactions (radio, lanterns, Keystone, endings), world events, treasure hunts, chart/map data. */
(function () {
  const G = window.G;
  const F = () => G.game.flags;

  const QS = G.quests = {
    active: {}, done: {}, order: [], pollT: 0, evT: 240, merchant: null, queue: [],
    init() {
      const evs = new Set(); for (const id in G.QUESTS) for (const e in G.QUESTS[id].on) evs.add(e);
      for (const e of evs) G.on(e, (a, b) => { for (const id of this.order) { const d = G.QUESTS[id]; if (d.on[e]) d.on[e](this.active[id].S, a, b); } });
      G.on('weather', (cur) => { if (this._lastW && (this._lastW === 'storm' || this._lastW === 'gale') && cur !== 'storm' && cur !== 'gale') { G.debris.boost = 200; G.ui.toast('The storm has scattered wreckage across the water. Good salvage while it lasts.', 'good'); } this._lastW = cur; });
    },
    reset() { this.active = {}; this.done = {}; this.order = []; this.queue = []; this.evT = 240; if (this.merchant) this.dismissMerchant(); },
    start(id) {
      const d = G.QUESTS[id]; if (!d || this.active[id] || (this.done[id] && !d.repeat)) return; delete this.done[id];
      this.active[id] = { step: 0, S: {} }; this.order.push(id); if (d.onStart) d.onStart();
      G.ui.questToast(d.ch ? 'New objective' : 'Side mission', d.title); G.audio.sfx('quest'); G.emit('questStart', id);
    },
    complete(id) {
      const d = G.QUESTS[id]; delete this.active[id]; this.order.splice(this.order.indexOf(id), 1); this.done[id] = true;
      G.ui.questToast('Completed', d.title, true); G.audio.sfx('questdone'); if (d.reward) d.reward(); G.tech.points += d.ch ? 3 : 2;
      for (const n of d.next) this.start(n); G.emit('questDone', id); G.journal.stat('quests');
    },
    update(dt) {
      this.pollT -= dt; if (this.pollT > 0) return; this.pollT = 0.4;
      for (const id of [...this.order]) {
        const a = this.active[id], d = G.QUESTS[id]; if (!a) continue; if (d.on.tick) d.on.tick(a.S);
        let guard = 0; while (a.step < d.steps.length && d.steps[a.step].done(a.S) && guard++ < 8) { a.step++; if (a.step < d.steps.length) { G.audio.sfx('step'); if (d.onStep) d.onStep(a.step); } }
        if (a.step >= d.steps.length) this.complete(id);
      }
      for (const id in G.QUESTS) { const d = G.QUESTS[id]; if (d.auto && !this.active[id] && !this.done[id] && d.auto()) this.start(id); }
      if (this.done.m21 && this.done.m22 && !this.active.m23 && !this.done.m23) this.start('m23');
      this.discoverTick(); this.eventTick(); this.detectorTick();
      // deferred radio traffic plays once a working set exists
      if (this.queue.length && F().radioFixed && !G.ui.blocking()) this.play(this.queue.shift());
    },
    stepText(id) { const a = this.active[id], d = G.QUESTS[id]; const s = d.steps[Math.min(a.step, d.steps.length - 1)]; return typeof s.t === 'function' ? s.t(a.S) : s.t; },
    markers() { const out = []; for (const id of this.order) { const a = this.active[id], d = G.QUESTS[id], s = d.steps[a.step]; if (s && s.mark) { const m = s.mark(); if (m) out.push({ x: m.x, z: m.z, name: m.name, main: !!d.ch, id }); } } return out; },
    chapter() { let c = 1; for (const id in this.done) c = Math.max(c, G.QUESTS[id].ch); for (const id of this.order) c = Math.max(c, G.QUESTS[id].ch); return c; },

    // ---- dialogue hooks ----
    talk(npc) { if (npc === 'mara') { F().metMara = true; if (F().ending && !F().epilogue) F().epilogue = true; } G.emit('talk', npc); },
    topicsFor(npc) {
      const out = [];
      for (const id in G.QUESTS) {
        const d = G.QUESTS[id];
        if (d.giver === npc && d.offer && !this.active[id] && !this.done[id] && (!d.req || d.req())) out.push({ l: '★ ' + d.title, x: d.offer, a: () => this.start(id), quest: true });
        const a = this.active[id], t = d.turnin;
        if (a && t && t.npc === npc && !(t.flag && F()[t.flag]) && !(t.local && a.S[t.local])) {
          const ok = !t.need || Object.keys(t.need).every((k) => G.inv.count(k) >= t.need[k]); const stepOk = !t.needStep || a.step >= t.needStep;
          const goal = d.steps.length > 1 && t.local ? a.step >= d.steps.length - 1 : true;
          if (goal && stepOk) out.push({ l: '✔ ' + t.l + (ok ? '' : '  (you lack: ' + Object.keys(t.need).filter((k) => G.inv.count(k) < t.need[k]).map((k) => (t.need[k] - G.inv.count(k)) + ' ' + G.ITEMS[k].n).join(', ') + ')'), x: ok ? t.x : 'Come back when you have everything.', disabled: !ok, a: ok ? () => { for (const k in t.need || {}) G.inv.remove(k, t.need[k]); if (t.flag) F()[t.flag] = true; if (t.local) a.S[t.local] = true; G.audio.sfx('questdone'); } : null, quest: true });
        }
      }
      return out;
    },

    // ---- notes & radio ----
    readNote(id) { const first = G.journal.addNote(id); G.ui.open('note', id); if (first) { G.audio.sfx('page'); if (id === 'venn_report' || id === 'calloway_log' || id === 'brandt_tape') G.audio.sfx('discover'); } },
    hasRadio() { return G.structs.list.some((s) => [...s.items.values()].some((i) => i.type === 'radio' && !i.s.broken)); },
    radio(id) { if (this.hasRadio()) this.play(id); else this.queue.push(id); },
    play(id) { const m = G.RADIO[id]; G.audio.sfx('radio'); G.ui.radio(m.t, m.l); F().heard = F().heard || {}; F().heard[id] = true; },
    needsRadioPart() { return this.active.m8 && !F().radioFixed && G.inv.count('radio_part') < 3; },
    useRadio(it) {
      if (it.s.broken) {
        const n = G.inv.count('radio_part'); if (n < 3) return G.ui.toast('The radio is dead. It needs 3 radio components (you have ' + n + ').');
        G.inv.remove('radio_part', 3); it.s.broken = false; F().radioFixed = true; G.audio.sfx('craftdone'); G.ui.toast('The valves glow. The radio is alive.', 'good'); G.skills.xp('crafting', 30); return setTimeout(() => this.play('haven_loop'), 900);
      }
      F().radioFixed = true; if (this.queue.length) return this.play(this.queue.shift());
      if (F().ending) return this.play('after'); if (!this.done.m15) return this.play('haven_loop');
      G.ui.radio('Scanning', ['...static, and far off, a voice reading the weather:', '"' + G.wsim.forecastText() + '"']);
    },

    // ---- lanterns & the Keystone ----
    useLantern(key, site) {
      const noteId = { lanternA: 'lantern_a', lanternB: 'lantern_b', lanternC: 'lantern_c' }[key];
      if (F()[key]) return this.readNote(noteId);
      if (G.inv.count('beacon_core') < 1) return G.ui.toast('The lamp housing is empty. It needs a Beacon Core.' + (G.tech.known.lanternwork ? ' Craft one at a workbench: lens, copper wire, glass and scrap.' : ''), 'bad');
      G.inv.remove('beacon_core', 1); F()[key] = true; if (site.lamp) site.lamp.material = G.mats.lamp; if (site.glow) site.glow.visible = true;
      G.audio.sfx('lantern'); G.ui.banner(G.world.story[key].name.split('—')[0].trim() + ' relit', 'The Lantern Chain'); G.skills.xp('crafting', 40);
      const next = { lanternA: 'lanternB', lanternB: 'lanternC', lanternC: 'haven' }[key]; G.map.revealPlace(G.world.story[next]); if (key === 'lanternC') G.map.revealPlace(G.world.story.keystone);
      setTimeout(() => this.readNote(noteId), 1600); G.emit('lantern', key);
    },
    endingOptions() {
      const lit = F().lanternA && F().lanternB && F().lanternC, cores = (F().cores || 0) >= 3 && G.journal.notes.includes('venn_report');
      return [
        { id: 'vent', t: 'Staged vent', d: 'Bleed the column down through the Lantern Chain over days. Dr. Venn\'s protocol.', ok: lit && cores, why: !cores ? 'Requires all three Deepwell data cores and Venn\'s report.' : 'Requires all three Lanterns lit.' },
        { id: 'stop', t: 'Hard stop', d: 'Cut the array. The Eye collapses at once — the Breaking. Everything nearby will feel it.', ok: true },
        { id: 'retune', t: 'Retune', d: 'Seat a fresh crystal and hold the Eye smaller. Director Kerr\'s plan. The array keeps running.', ok: G.inv.count('crystal') >= 1, why: 'Requires a spare Resonant Crystal.' }
      ];
    },
    useKeystone() {
      if (F().ending) return G.ui.toast('The console is quiet. Its work is done.');
      if (G.inv.count('keystone_key') < 1) return G.ui.toast('COMMAND KEY NOT PRESENT. The console will not listen without the Keystone Key.', 'bad');
      G.ui.open('ending');
    },
    ending(choice) {
      G.inv.remove('keystone_key', 1); if (choice === 'retune') G.inv.remove('crystal', 1); F().ending = choice; F().endDay = G.time.day;
      G.weather.flash = 1; G.audio.thunder(0.1); G.audio.sfx('lantern');
      if (choice === 'vent') { F().eyeCalm = true; G.wsim.cur = 'rain'; G.wsim.next = 'fair'; G.wsim.until = G.time.now() + 2; }
      else if (choice === 'stop') { F().eyeCalm = true; G.wsim.cur = 'gale'; G.wsim.next = 'storm'; G.wsim.until = G.time.now() + 9; const r = G.structs.raft; if (r) for (let i = 0; i < 6; i++) r.damageRandom(30); }
      else { F().eyeSmall = true; G.wsim.cur = 'overcast'; G.wsim.next = 'fair'; G.wsim.until = G.time.now() + 3; }
      G.journal.achieve('ending_' + choice, { vent: 'Still Water', stop: 'The Breaking', retune: 'The Keeper\'s Bargain' }[choice]); G.emit('ending', choice);
      setTimeout(() => this.radio('after'), 30000); G.ui.open('epilogue', choice); G.game.save('auto');
    },

    // ---- discovery ----
    discoverTick() {
      const W = G.world, P = G.player; const I = W.current; if (I) G.journal.discover(I.id, I.name, 'island');
      for (const p of W.pois) { if (p._d == null) continue; const lim = p.poi === 'keystone' || p.poi === 'rig' ? 60 : p.poi === 'reef' || p.poi === 'kelp' ? 45 : 32; if (p._d < lim && (p.poi === 'yacht' || p.poi === 'buoy' || p.poi === 'rig' || p.poi === 'keystone' || P.headUnder || P.swimming || p._d < 14)) G.journal.discover(p.id, p.name, 'poi'); }
    },

    // ---- world events ----
    eventTick() {
      const P = G.player; this.evT -= 0.4; if (this.merchant) this.merchantTick();
      if (this.evT > 0) return; this.evT = 300 + Math.random() * 240;
      const atSea = G.world.height(P.pos.x, P.pos.z) < -6 && (P.parent && P.parent.kind === 'raft' || P.mode === 'boat'); if (!atSea || G.weather.storm > 0.6 || G.wsim.eye > 0.2) return;
      const pick = G.weighted(Math.random, [['cargo', 3], ['merchant', this.done.m8 && !this.merchant ? 2 : 0], ['signal', F().radioFixed ? 2 : 0], ['field', 1.5]]);
      if (pick === 'cargo') { const dv = G.debris.drift(new THREE.Vector2()), a = Math.atan2(-dv.y, -dv.x) + (Math.random() - 0.5); G.debris.spawn('container', P.pos.x + Math.cos(a) * 55, P.pos.z + Math.sin(a) * 55); G.ui.toast('A cargo container is drifting toward you. Hook it or swim out before it passes.', 'good'); G.audio.sfx('quest'); }
      else if (pick === 'field') { G.debris.boost = 150; G.ui.toast('You are crossing a debris field. Plenty to gather.', 'good'); }
      else if (pick === 'signal') { const c = G.world.pois.filter((p) => !G.journal.places[p.id] && !p.story && !G.map.known[p.id] && Math.hypot(p.x - P.pos.x, p.z - P.pos.z) < 1800); if (c.length) { const p = c[Math.floor(Math.random() * c.length)]; G.map.revealPlace(p); G.ui.radio('Unidentified signal', ['...a carrier wave, pulsing. No voice.', 'You take a bearing and mark it on the chart: ' + p.name + '.']); G.audio.sfx('radio'); } }
      else if (pick === 'merchant') this.spawnMerchant();
    },
    spawnMerchant() {
      const P = G.player, a = Math.random() * 6.28, x = P.pos.x + Math.cos(a) * 38, z = P.pos.z + Math.sin(a) * 38; if (G.world.height(x, z) > -4) return;
      const mesh = G.vehicles.model('sailboat'); mesh.scale.setScalar(1.6); G.scene.add(mesh);
      const m = this.merchant = { x, z, mesh, t: 260, tag: 'merchant', r: 2.2, reach: 7, y: 0.6, label: 'Hail the trader', use: () => G.ui.open('dialogue', 'merchant') }; G.interact.add(m);
      G.ui.toast('A trading boat has hove to nearby. Its skipper is waving.', 'good'); G.audio.sfx('quest');
    },
    merchantTick() { const m = this.merchant, P = G.player; m.t -= 0.4; m.y = G.ocean.height(m.x, m.z) + 0.8; m.mesh.position.set(m.x, m.y - 0.8, m.z); m.mesh.rotation.y += 0.002; if (m.t <= 0 && !G.ui.blocking() || Math.hypot(P.pos.x - m.x, P.pos.z - m.z) > 220) this.dismissMerchant(); },
    dismissMerchant() { const m = this.merchant; if (!m) return; G.disposeGroup(m.mesh); G.interact.remove(m); this.merchant = null; },

    // ---- treasure ----
    startTreasure() {
      if (G.game.treasure) { G.ui.toast('You already have a cross to dig up: ' + G.game.treasure.name + '.'); return false; }
      const P = G.player, W = G.world; const c = W.islands.filter((I) => Math.hypot(I.x - P.pos.x, I.z - P.pos.z) < 2600 && I !== W.current); if (!c.length) return false;
      for (let t = 0; t < 200; t++) { const I = c[Math.floor(Math.random() * c.length)], a = Math.random() * 6.28, d = I.r * (0.45 + Math.random() * 0.7), x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d, h = W.islandH(I, x, z); if (h > 1.0 && h < 2.8) { G.game.treasure = { x, z, name: I.name }; this.start('s_treasure'); G.ui.toast('The chart shows a cross on a beach at ' + I.name + '. Marked.', 'good'); G.map.revealPlace(I); return true; } }
      return false;
    },
    dig() {
      const t = G.game.treasure, P = G.player; if (!t || Math.hypot(P.pos.x - t.x, P.pos.z - t.z) > 3.6) return false;
      for (const [id, n] of G.lootRoll(4, G.LOOT_SITES.chest)) G.inv.add(id, n); G.inv.add('relic', 1); if (Math.random() < 0.5) G.inv.add('pearl', 1 + Math.floor(Math.random() * 2));
      G.game.treasure = null; G.audio.sfx('discover'); G.ui.banner('Buried cache unearthed', 'Treasure'); G.fx.burst(P.pos.x, P.pos.y + 0.2, P.pos.z, [1, 0.85, 0.3, 1], 20, 2.5, 0.9, 6, 0.1); G.journal.stat('treasure'); G.emit('treasure'); G.skills.xp('survival', 30); return true;
    },
    detectorTick() { const t = G.game.treasure, h = G.inv.held(); if (!t || !h || h.id !== 'metal_detector') return; const d = Math.hypot(G.player.pos.x - t.x, G.player.pos.z - t.z); if (d > 70) return; this._bt = (this._bt || 0) + 0.4; if (this._bt >= Math.max(0.4, d / 14)) { this._bt = 0; G.audio.sfx('beep'); if (d < 3.6) G.ui.toast('The detector is screaming. Dig here.', 'good'); } },

    serialize() { return { active: this.active, done: this.done, order: this.order, queue: this.queue }; },
    deserialize(d) { this.reset(); if (!d) return; this.done = d.done || {}; for (const id of d.order || []) if (G.QUESTS[id] && d.active[id]) { this.active[id] = d.active[id]; this.order.push(id); } this.queue = d.queue || []; }
  };

  // ---------- chart ----------
  const MAPN = 180, WORLD = 3800;
  const M = G.map = {
    fog: new Uint8Array(MAPN * MAPN), known: {}, markers: [], waypoint: null, base: null, revT: 0,
    reset() { this.fog = new Uint8Array(MAPN * MAPN); this.known = {}; this.markers = []; this.waypoint = null; this.base = null; },
    cell(v) { return Math.floor((v + WORLD) / (2 * WORLD) * MAPN); },
    reveal(x, z, r) { const c = this.cell(x), d = this.cell(z), k = Math.ceil(r / (2 * WORLD / MAPN)); for (let j = -k; j <= k; j++) for (let i = -k; i <= k; i++) { if (i * i + j * j > k * k) continue; const a = c + i, b = d + j; if (a >= 0 && b >= 0 && a < MAPN && b < MAPN) this.fog[b * MAPN + a] = 1; } },
    seen(x, z) { const a = this.cell(x), b = this.cell(z); return a >= 0 && b >= 0 && a < MAPN && b < MAPN && this.fog[b * MAPN + a] === 1; },
    revealPlace(o) { if (!o) return; this.known[o.id] = 1; },
    update(dt) {
      this.revT -= dt; if (this.revT > 0) return; this.revT = 1; const P = G.player; let r = 240; const raft = G.structs.raft;
      if (raft && raft.hasNav && Math.hypot(raft.pos.x - P.pos.x, raft.pos.z - P.pos.z) < 30) r = 520; if (P.pos.y > 12) r += P.pos.y * 6;
      r *= 1 - G.weather.fog * 0.6; this.reveal(P.pos.x, P.pos.z, r);
      for (const I of G.world.islands) if (!this.known[I.id] && I._d != null && I._d < r) this.known[I.id] = 1;
    },
    scan() { // binoculars: chart islands near the centre of view
      const P = G.player, d = new THREE.Vector3(); G.camera.getWorldDirection(d); for (const I of G.world.islands) { if (this.known[I.id]) continue; const dx = I.x - P.pos.x, dz = I.z - P.pos.z, dist = Math.hypot(dx, dz); if (dist > 2800 * (1 - G.weather.fog * 0.7)) continue; if ((dx * d.x + dz * d.z) / dist > 0.985) { this.known[I.id] = 1; G.ui.toast('Charted: ' + I.name, 'good'); G.audio.sfx('step'); } }
    },
    ping() { const P = G.player; let n = 0; for (const p of G.world.pois) if (!this.known[p.id] && Math.hypot(p.x - P.pos.x, p.z - P.pos.z) < 750) { this.known[p.id] = 1; n++; } G.audio.sfx('sonar'); G.ui.toast(n ? 'Sonar return: ' + n + ' new contact' + (n > 1 ? 's' : '') + ' marked on the chart.' : 'Sonar: no new contacts within 750 m.', n ? 'good' : ''); this.reveal(P.pos.x, P.pos.z, 500); },
    // base layer: sampled height field, rendered once per world
    buildBase() {
      const S = 360, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), img = g.createImageData(S, S), W = G.world;
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        const x = (i / S * 2 - 1) * WORLD, z = (j / S * 2 - 1) * WORLD, h = W.height(x, z); let r, gr, b;
        if (h > 0.2) { const I = W.islandNear(x, z); const bio = I ? I.biome : 'tropical'; const land = { tropical: [196, 186, 128], jungle: [96, 132, 82], volcanic: [92, 84, 82], rocky: [150, 146, 136], mangrove: [118, 128, 88] }[bio]; const k = h < 2 ? 1.12 : 0.92 + Math.min(h, 40) / 200; r = land[0] * k; gr = land[1] * k; b = land[2] * k; if (h < 2) { r = 222; gr = 208; b = 160; } }
        else { const d = Math.min(1, -h / 70); r = 150 - d * 62; gr = 186 - d * 66; b = 190 - d * 44; if (h > -6) { r = 168; gr = 208; b = 202; } }
        const o = (j * S + i) * 4; img.data[o] = r; img.data[o + 1] = gr; img.data[o + 2] = b; img.data[o + 3] = 255;
      }
      g.putImageData(img, 0, 0); this.base = c; return c;
    },
    WORLD, MAPN,
    serialize() { let s = ''; for (let i = 0; i < this.fog.length; i += 6) { let v = 0; for (let k = 0; k < 6; k++) v |= (this.fog[i + k] || 0) << k; s += String.fromCharCode(48 + v); } return { fog: s, known: this.known, markers: this.markers, waypoint: this.waypoint }; },
    deserialize(d) { this.reset(); if (!d) return; if (d.fog) for (let i = 0; i < this.fog.length; i += 6) { const v = d.fog.charCodeAt(i / 6) - 48; for (let k = 0; k < 6 && i + k < this.fog.length; k++) this.fog[i + k] = (v >> k) & 1; } this.known = d.known || {}; this.markers = d.markers || []; this.waypoint = d.waypoint || null; }
  };
})();
