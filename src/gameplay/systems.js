'use strict';
/* Inventory & containers, time, weather simulation, skills, research/technology, crafting queue, journal. */
(function () {
  const G = window.G;

  // ---------- containers ----------
  const C = G.cont = {
    add(c, id, n, meta, limit) {
      const def = G.ITEMS[id]; if (!def) return n; const size = limit || c.slots.length; const now = G.time.now();
      if (def.s > 1) for (let i = 0; i < size && n > 0; i++) {
        const s = c.slots[i]; if (!s || s.id !== id || s.n >= def.s) continue;
        const k = Math.min(n, def.s - s.n); if (def.food && def.food.spoil) s.made = (s.made * s.n + ((meta && meta.made) || now) * k) / (s.n + k); s.n += k; n -= k;
      }
      for (let i = 0; i < size && n > 0; i++) {
        if (c.slots[i]) continue; const k = Math.min(n, def.s); const s = { id, n: k };
        if (def.tool) s.dur = meta && meta.dur != null ? meta.dur : def.tool.dur; if (def.air) s.air = meta && meta.air != null ? meta.air : def.air;
        if (def.food && def.food.spoil) s.made = (meta && meta.made) || now; c.slots[i] = s; n -= k;
      }
      return n;
    },
    count(c, id) { let t = 0; for (const s of c.slots) if (s && s.id === id) t += s.n; return t; },
    remove(c, id, n) { for (let i = c.slots.length - 1; i >= 0 && n > 0; i--) { const s = c.slots[i]; if (!s || s.id !== id) continue; const k = Math.min(n, s.n); s.n -= k; n -= k; if (s.n <= 0) c.slots[i] = null; } return n; },
    sort(c, from, to) {
      const part = c.slots.slice(from, to).filter(Boolean); const order = { tool: 0, gear: 1, food: 2, med: 3, mat: 4, seed: 5, story: 6 };
      const merged = []; for (const s of part) { const def = G.ITEMS[s.id]; const m = def.s > 1 && merged.find((x) => x.id === s.id && x.n < def.s); if (m) { const k = Math.min(s.n, def.s - m.n); m.n += k; s.n -= k; } if (s.n > 0) merged.push(s); }
      merged.sort((a, b) => (order[G.ITEMS[a.id].c] - order[G.ITEMS[b.id].c]) || G.ITEMS[a.id].n.localeCompare(G.ITEMS[b.id].n));
      for (let i = from; i < to; i++) c.slots[i] = merged[i - from] || null;
    },
    spoil(c, now) { for (const s of c.slots) { if (!s) continue; const f = G.ITEMS[s.id].food; if (f && f.spoil && now - (s.made || now) > f.spoil) { s.id = 'spoiled'; delete s.made; } } }
  };

  const inv = G.inv = {
    slots: new Array(40).fill(null), equip: { head: null, face: null, body: null, back: null, feet: null, pack: null }, sel: 0,
    reset() { this.slots = new Array(40).fill(null); this.equip = { head: null, face: null, body: null, back: null, feet: null, pack: null }; this.sel = 0; },
    size() { const p = this.equip.pack; return p ? Math.min(40, 30 + ((G.ITEMS[p.id] && G.ITEMS[p.id].slots) || 10)) : 30; },
    held() { return this.slots[this.sel]; },
    add(id, n, meta, quiet) {
      n = n || 1; const left = C.add(this, id, n, meta, this.size());
      if (n - left > 0) { if (!quiet) G.ui.gain(id, n - left); G.emit('gain', id, n - left); }
      if (left > 0) { G.drops.spawn(id, left, meta); if (!this._fullT || performance.now() - this._fullT > 4000) { this._fullT = performance.now(); G.ui.toast('Your pack is full — some items were dropped at your feet.', 'bad'); } }
      return left;
    },
    count(id) { return C.count(this, id); },
    remove(id, n) { return C.remove(this, id, n); },
    removeAt(i, n) { const s = this.slots[i]; if (!s) return; s.n -= n; if (s.n <= 0) this.slots[i] = null; },
    has(ing) { for (const k in ing) if (this.countAll(k) < ing[k]) return false; return true; },
    storages() { const out = []; const P = G.player; G.structs.nearbyItems(P.pos.x, P.pos.z, 9, (it) => { if (it.s.c) out.push(it.s.c); }); return out; },
    countAll(id) { let t = this.count(id); for (const c of this._st || this.storages()) t += C.count(c, id); return t; },
    removeAll(id, n) { n = this.remove(id, n); if (n > 0) for (const c of this.storages()) { n = C.remove(c, id, n); if (n <= 0) break; } return n; },
    pay(cost) { for (const k in cost) this.removeAll(k, cost[k]); },
    wear(i, amt) {
      const s = this.slots[i]; if (!s || s.dur == null) return; const save = G.skills.level('harvesting') * 0.04;
      if (Math.random() < save) return; s.dur -= amt; if (s.dur <= 0) { G.ui.toast(G.ITEMS[s.id].n + ' broke.', 'bad'); G.audio.sfx('break'); this.slots[i] = null; }
    },
    serialize() { return { slots: this.slots, equip: this.equip, sel: this.sel }; },
    deserialize(d) { this.reset(); if (!d) return; const ok = (s) => s && G.ITEMS[s.id] ? s : null; this.slots = d.slots.map(ok); while (this.slots.length < 40) this.slots.push(null); for (const k in this.equip) this.equip[k] = ok(d.equip[k]); this.sel = d.sel || 0; }
  };

  // ---------- time ----------
  const T = G.time = {
    day: 1, hour: 6.2, rate: 1 / 60,
    now() { return this.day * 24 + this.hour; },
    update(dt) { this.hour += dt * this.rate; if (this.hour >= 24) { this.hour -= 24; this.day++; G.emit('newDay', this.day); } },
    skipTo(hour) { if (hour <= this.hour) { this.day++; G.emit('newDay', this.day); } this.hour = hour; },
    label() { const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60); return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; },
    serialize() { return { day: this.day, hour: this.hour }; }, deserialize(d) { this.day = d.day; this.hour = d.hour; }
  };

  // ---------- weather ----------
  const WS = {
    clear: { n: 'Clear skies', i: '☀️', cloud: 0.12, rain: 0, fog: 0, wind: 0.36, sea: 0.55, storm: 0 }, fair: { n: 'Fair, some cloud', i: '🌤️', cloud: 0.42, rain: 0, fog: 0, wind: 0.5, sea: 0.7, storm: 0 },
    breezy: { n: 'Strong breeze', i: '💨', cloud: 0.32, rain: 0, fog: 0, wind: 0.95, sea: 1.15, storm: 0 }, overcast: { n: 'Overcast', i: '☁️', cloud: 0.82, rain: 0, fog: 0, wind: 0.5, sea: 0.8, storm: 0 },
    drizzle: { n: 'Light rain', i: '🌦️', cloud: 0.86, rain: 0.3, fog: 0.1, wind: 0.5, sea: 0.85, storm: 0 }, rain: { n: 'Heavy rain', i: '🌧️', cloud: 0.96, rain: 0.78, fog: 0.15, wind: 0.75, sea: 1.15, storm: 0.22 },
    storm: { n: 'Thunderstorm', i: '⛈️', cloud: 1, rain: 1, fog: 0.15, wind: 1.1, sea: 1.9, storm: 0.75 }, gale: { n: 'Tropical storm', i: '🌀', cloud: 1, rain: 1, fog: 0.2, wind: 1.5, sea: 2.7, storm: 1 },
    fog: { n: 'Sea fog', i: '🌫️', cloud: 0.6, rain: 0, fog: 1, wind: 0.1, sea: 0.3, storm: 0 }, calm: { n: 'Dead calm', i: '🪞', cloud: 0.1, rain: 0, fog: 0, wind: 0.07, sea: 0.25, storm: 0 }
  };
  const NEXT = {
    clear: [['clear', 3], ['fair', 4], ['calm', 1.4], ['breezy', 1.5], ['fog', 0.6]], fair: [['clear', 3], ['fair', 2], ['overcast', 2.4], ['breezy', 1.6]], breezy: [['fair', 3], ['overcast', 2], ['rain', 1]],
    overcast: [['fair', 2.5], ['drizzle', 2.5], ['rain', 1.4], ['fog', 0.8]], drizzle: [['overcast', 2], ['rain', 1.8], ['fair', 1.8]], rain: [['drizzle', 2], ['overcast', 2], ['storm', 1.5]],
    storm: [['rain', 3], ['gale', 0.7]], gale: [['storm', 2], ['rain', 2]], fog: [['clear', 2], ['fair', 2], ['overcast', 1]], calm: [['clear', 3], ['fair', 2], ['fog', 0.8]]
  };
  const ws = G.wsim = {
    STATES: WS, cur: 'clear', next: 'fair', until: 0, flashT: 8, dmgT: 0, rnd: Math.random, eye: 0,
    reset(seed) { this.rnd = G.rng((seed ^ 0x9e37) >>> 0); this.cur = 'clear'; this.next = 'fair'; this.until = T.now() + 9; const w = G.weather; Object.assign(w, { cloud: 0.15, rain: 0, fog: 0, wind: 0.4, sea: 0.55, storm: 0, windDir: this.rnd() * 6.28, type: 'clear' }); },
    roll(from) { const tb = NEXT[from].map((e) => [e[0], e[0] === 'gale' && G.game.difficulty === 'hardcore' ? e[1] * 2 : e[0] === 'storm' && G.game.difficulty === 'relaxed' ? e[1] * 0.5 : e[1]]); return G.weighted(this.rnd, tb); },
    forecastText() { const h = Math.max(0, this.until - T.now()); return WS[this.cur].n + ' now; ' + WS[this.next].n.toLowerCase() + ' in about ' + Math.max(1, Math.round(h)) + 'h.'; },
    update(dt) {
      const w = G.weather, now = T.now();
      if (now >= this.until) { this.cur = this.next; this.next = this.roll(this.cur); const stormy = WS[this.cur].storm > 0.5; this.until = now + (stormy ? 1.4 + this.rnd() * 2 : 2.5 + this.rnd() * 3.5); w.type = this.cur; G.emit('weather', this.cur); }
      const s = WS[this.cur]; const k = 0.045;
      // the Eye: a standing storm around the Keystone until it is resolved
      let eye = 0; const K = G.world.story.keystone;
      if (K && !G.game.flags.eyeCalm) { const d = Math.hypot(G.player.pos.x - K.x, G.player.pos.z - K.z); const sm = G.game.flags.eyeSmall; eye = G.sstep(sm ? 420 : 1000, sm ? 150 : 380, d) * (sm ? 0.7 : 1); }
      this.eye = eye; const g = WS.gale; const tg = (f) => G.lerp(s[f], Math.max(s[f], g[f]), eye);
      for (const f of ['cloud', 'rain', 'fog', 'wind', 'sea', 'storm']) w[f] = G.damp(w[f], tg(f), k * (f === 'sea' ? 0.6 : 1) * (eye > 0.1 ? 4 : 1), dt);
      w.windDir += (G.noise2(now * 0.25, 3.3, 77) - 0.5) * dt * 0.02;
      const sunH = Math.max(0, Math.sin((T.hour - 6) / 12 * Math.PI));
      w.temp = 22.5 + 8 * sunH * (1 - w.cloud * 0.4) - w.rain * 3 - w.storm * 2.5 + (G.world.current && G.world.current.biome === 'volcanic' ? 3 : 0);
      w.flash = Math.max(0, w.flash - dt * 4.5);
      if (w.storm > 0.42) {
        this.flashT -= dt; if (this.flashT <= 0) { this.flashT = 3 + this.rnd() * 11 / w.storm; w.flash = 1; G.audio.thunder(0.4 + this.rnd() * 2.5); }
        this.dmgT += dt; const raft = G.structs.raft;
        if (this.dmgT > 22 && raft && w.storm > 0.6 && G.game.difficulty !== 'relaxed') { this.dmgT = 0; const t = raft.damageRandom(16 * w.storm); if (t) { G.audio.sfx('creak'); if (t.hp < t.max * 0.5) G.ui.toast('The storm is tearing at the raft. Repair damaged decks with your mallet.', 'bad'); } }
      }
      G.uni.uWind.value = 0.35 + w.wind * 1.4; G.uni.uSea.value = w.sea;
      // surfaces soak quickly in rain and dry slowly afterwards, faster in sun and wind
      const wu = G.uni.uWet; if (w.rain > 0.08) wu.value = Math.min(1, wu.value + dt * 0.08 * (0.5 + w.rain)); else wu.value = Math.max(0, wu.value - dt * (0.004 + (G.sky.sunVis || 0) * 0.008 + (w.wind || 0) * 0.004)); if (!isFinite(wu.value)) wu.value = 0;
    },
    serialize() { return { cur: this.cur, next: this.next, until: this.until, w: Object.assign({}, G.weather) }; },
    deserialize(d) { this.cur = d.cur; this.next = d.next; this.until = d.until; Object.assign(G.weather, d.w); }
  };

  // ---------- skills ----------
  const sk = G.skills = {
    data: {},
    reset() { this.data = {}; for (const k in G.SKILLS) this.data[k] = { xp: 0, lvl: 0 }; },
    level(k) { return this.data[k] ? this.data[k].lvl : 0; },
    xp(k, amt) { const d = this.data[k]; if (!d || d.lvl >= 10) return; d.xp += amt; while (d.lvl < 10 && d.xp >= G.skillNeed(d.lvl)) { d.xp -= G.skillNeed(d.lvl); d.lvl++; G.ui.toast(G.SKILLS[k].i + ' ' + G.SKILLS[k].n + ' reached level ' + d.lvl + '.', 'good'); G.audio.sfx('levelup'); G.emit('skill', k, d.lvl); } },
    serialize() { return this.data; }, deserialize(d) { this.reset(); for (const k in d || {}) if (this.data[k]) this.data[k] = d[k]; }
  };

  // ---------- research / technology ----------
  const tech = G.tech = {
    known: {}, studied: {}, points: 0, flags: {},
    reset() { this.known = {}; this.studied = {}; this.points = 0; this.flags = {}; },
    has(id) { return !id || !!this.known[id]; },
    canUnlock(id) { const t = G.TECH[id]; if (this.known[id]) return false; if (t.flag && !this.flags[t.flag]) return false; return t.req.every((r) => this.known[r]) && this.points >= t.cost; },
    unlock(id, free) { const t = G.TECH[id]; if (this.known[id]) return false; if (!free) { if (!this.canUnlock(id)) return false; this.points -= t.cost; } this.known[id] = true; G.ui.toast('Technology learned: ' + t.n, 'good'); G.audio.sfx('discover'); G.emit('tech', id); return true; },
    blueprint(flag, autoTech) { if (this.flags[flag]) return; this.flags[flag] = true; if (autoTech) this.unlock(autoTech, true); },
    study(id) { if (this.studied[id]) return 0; this.studied[id] = true; const v = G.ITEMS[id].rv; this.points += v; G.emit('studied', id); return v; },
    insight(n, why) { this.points += n; G.ui.toast('+' + n + ' insight — ' + why, 'good'); },
    serialize() { return { known: this.known, studied: this.studied, points: this.points, flags: this.flags }; },
    deserialize(d) { this.reset(); if (d) Object.assign(this, { known: d.known || {}, studied: d.studied || {}, points: d.points || 0, flags: d.flags || {} }); }
  };

  // ---------- crafting ----------
  const cr = G.craft = {
    queue: [], fav: {}, tracked: null,
    reset() { this.queue = []; this.fav = {}; this.tracked = null; },
    stations() { const P = G.player, out = {}; G.structs.nearbyItems(P.pos.x, P.pos.z, 5.5, (it) => { const d = G.BUILD[it.type]; if (d.station) for (const s of d.station) { if (s === 'fire' || s === 'grill' || s === 'forge') { if (it.s.burn > 0 || (it.s.fuel && it.s.fuel.n > 0)) out[s] = true; else out[s + '_cold'] = true; } else out[s] = true; } }); return out; },
    status(r, st) { // 'ok' | 'tech' | 'station' | 'mats'
      if (!G.tech.has(r.tech)) return 'tech'; if (r.st && !st[r.st]) return 'station'; return G.inv.has(r.ing) ? 'ok' : 'mats';
    },
    start(r, n) {
      const st = this.stations(); G.inv._st = G.inv.storages(); let made = 0;
      for (let i = 0; i < n; i++) { if (this.status(r, st) !== 'ok') break; const cost = Object.assign({}, r.ing); if (Math.random() < G.skills.level('crafting') * 0.03) { const ks = Object.keys(cost); const k = ks[Math.floor(Math.random() * ks.length)]; if (cost[k] > 1) cost[k]--; } G.inv.pay(cost); for (const k in r.ing) if (G.ITEMS[k].returns && r.out !== G.ITEMS[k].returns) G.inv.add(G.ITEMS[k].returns, r.ing[k], null, true); this.queue.push({ id: r.id, t: 0, need: r.t * (1 - G.skills.level('crafting') * 0.05) }); made++; }
      G.inv._st = null; if (made) G.audio.sfx('craft'); return made;
    },
    update(dt) {
      const q = this.queue[0]; if (!q) return; q.t += dt;
      if (q.t >= q.need) { this.queue.shift(); const r = G.RECIPES.find((x) => x.id === q.id); G.inv.add(r.out, r.q); if (r.also) for (const k in r.also) G.inv.add(k, r.also[k]); G.skills.xp('crafting', 4 + r.t); G.audio.sfx('craftdone'); G.emit('crafted', r.out, r.q); }
    },
    serialize() { return { fav: this.fav, tracked: this.tracked, queue: this.queue }; }, deserialize(d) { this.reset(); if (d) { this.fav = d.fav || {}; this.tracked = d.tracked || null; this.queue = d.queue || []; } }
  };

  // ---------- journal ----------
  const J = G.journal = {
    notes: [], fish: {}, creatures: {}, places: {}, stats: {}, ach: {},
    reset() { this.notes = []; this.fish = {}; this.creatures = {}; this.places = {}; this.stats = {}; this.ach = {}; },
    stat(k, n) { this.stats[k] = (this.stats[k] || 0) + (n == null ? 1 : n); G.emit('stat', k, this.stats[k]); return this.stats[k]; },
    addNote(id) { if (this.notes.includes(id)) return false; this.notes.push(id); G.tech.points += 2; G.emit('note', id); return true; },
    logFish(id, cm) { const f = this.fish[id] || (this.fish[id] = { n: 0, best: 0 }); const first = f.n === 0; f.n++; if (cm > f.best) f.best = cm; if (first) { G.tech.insight(3, 'new species recorded'); } this.stat('fish'); G.emit('fish', id, cm); return first; },
    bestCatch() { let b = null; for (const k in this.fish) if (!b || this.fish[k].best > b.cm) b = { name: G.FISH[k].n, cm: this.fish[k].best }; return b; },
    seeCreature(id) { if (this.creatures[id]) return; this.creatures[id] = { day: T.day }; G.tech.insight(3, 'new creature observed: ' + G.CREATURES[id].n); G.emit('creature', id); },
    discover(id, name, kind) { if (this.places[id]) return false; this.places[id] = { name, kind, day: T.day }; G.ui.banner(name, kind === 'island' ? 'Island discovered' : 'Location discovered'); G.audio.sfx('discover'); G.tech.points += 2; this.stat('places'); G.emit('discover', id, kind); return true; },
    achieve(id, name) { if (this.ach[id]) return; this.ach[id] = { name, day: T.day }; G.ui.toast('🏅 Achievement: ' + name, 'good'); },
    serialize() { return { notes: this.notes, fish: this.fish, creatures: this.creatures, places: this.places, stats: this.stats, ach: this.ach }; },
    deserialize(d) { this.reset(); if (d) for (const k of ['notes', 'fish', 'creatures', 'places', 'stats', 'ach']) if (d[k]) this[k] = d[k]; }
  };

  // ---------- dropped item bundles ----------
  G.drops = {
    list: [],
    spawn(id, n, meta, x, y, z) {
      const P = G.player; x = x == null ? P.pos.x + (Math.random() - 0.5) : x; z = z == null ? P.pos.z + (Math.random() - 0.5) : z; y = y == null ? P.pos.y + 0.15 : y;
      let d = null;
      // the item's own model at a real size (a tan parcel only if it has none)
      let m = G.icons && G.icons.worldModel ? G.icons.worldModel(id, (nm) => { if (!this.list.includes(d)) return; G.scene.remove(d.mesh); d.mesh = nm; G.scene.add(nm); nm.position.set(d.x, d.y, d.z); }) : null; if (!m) { m = new THREE.Mesh(G.geo.box(0.32, 0.26, 0.32), G.mats.fabricTan); m.castShadow = true; } G.scene.add(m);
      d = { id, n, meta, mesh: m, x, y, z, tag: 'drop', r: 0.6, parent: P.parent, born: T.now() }; if (d.parent) d.local = d.parent.toLocal(x, y, z);
      d.label = () => 'Pick up ' + G.ITEMS[id].n + (n > 1 ? ' ×' + n : ''); d.use = () => { const free = G.inv.slots.slice(0, G.inv.size()).some((s) => !s || (s.id === id && s.n < G.ITEMS[id].s)); if (!free) return G.ui.toast('No room.', 'bad'); this.remove(d); G.inv.add(id, n, meta); G.audio.sfx('pickup'); };
      this.list.push(d); G.interact.add(d); return d;
    },
    remove(d) { G.scene.remove(d.mesh); if (d.mesh.isMesh) d.mesh.geometry.dispose(); G.interact.remove(d); this.list.splice(this.list.indexOf(d), 1); },
    update() { for (const d of this.list) { if (d.parent && G.structs.list.includes(d.parent)) { const w = d.parent.toWorld(d.local.x, d.local.y, d.local.z); d.x = w.x; d.y = w.y; d.z = w.z; } else { const wh = G.ocean.height(d.x, d.z), g = G.world.heightAt(d.x, d.z); d.y = Math.max(g + 0.13, wh - 0.05); } d.mesh.position.set(d.x, d.y, d.z); } },
    clear() { for (const d of [...this.list]) this.remove(d); },
    serialize() { return this.list.map((d) => ({ id: d.id, n: d.n, meta: d.meta, x: d.x, y: d.y, z: d.z })); },
    deserialize(a) { this.clear(); for (const d of a || []) if (G.ITEMS[d.id]) { const o = this.spawn(d.id, d.n, d.meta, d.x, d.y, d.z); o.parent = null; } }
  };

  // spoilage sweep
  let spoilT = 0;
  G.systemsUpdate = function (dt) {
    T.update(dt); ws.update(dt); cr.update(dt); G.drops.update();
    spoilT += dt; if (spoilT > 6) { spoilT = 0; const now = T.now(); C.spoil(inv, now); for (const st of G.structs.list) for (const it of st.items.values()) { if (it.s.c) C.spoil(it.s.c, now); if (it.s.out) C.spoil({ slots: it.s.out }, now); } }
  };
})();
