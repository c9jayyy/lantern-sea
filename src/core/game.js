'use strict';
/* Save storage (IndexedDB with localStorage fallback), game lifecycle, boot sequence and the main loop. */
(function () {
  const G = window.G;

  // ---------- save storage ----------
  const LS = 'lanternsea.save.';
  const SV = G.saves = {
    db: null, mem: {},
    open() {
      if (this._p) return this._p;
      this._p = new Promise((res) => { try { const r = indexedDB.open('lanternsea', 1); r.onupgradeneeded = () => r.result.createObjectStore('saves', { keyPath: 'slot' }); r.onsuccess = () => { this.db = r.result; res(true); }; r.onerror = () => res(false); r.onblocked = () => res(false); } catch (e) { res(false); } });
      return this._p;
    },
    tx(mode, fn) { return this.open().then((ok) => { if (!ok || !this.db) return null; return new Promise((res, rej) => { const t = this.db.transaction('saves', mode), st = t.objectStore('saves'), rq = fn(st); t.oncomplete = () => res(rq ? rq.result : null); t.onerror = () => rej(t.error); }); }); },
    lsAll() { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(LS)) out.push(JSON.parse(localStorage.getItem(k))); } } catch (e) { /* unavailable */ } return out.concat(Object.values(this.mem)); },
    list() { return this.tx('readonly', (s) => s.getAll()).then((r) => (r || this.lsAll())).catch(() => this.lsAll()).then((l) => l.filter((x) => x && x.meta).map((x) => ({ slot: x.slot, meta: x.meta })).sort((a, b) => b.meta.saved - a.meta.saved)); },
    get(slot) { return this.tx('readonly', (s) => s.get(slot)).then((r) => r || this.lsAll().find((x) => x.slot === slot)).catch(() => this.lsAll().find((x) => x.slot === slot)); },
    put(slot, meta, data) {
      const rec = { slot, meta, data };
      return this.tx('readwrite', (s) => s.put(rec)).then((r) => { if (r === null && !this.db) throw new Error('no idb'); return true; }).catch(() => { try { localStorage.setItem(LS + slot, JSON.stringify(rec)); } catch (e) { this.mem[slot] = rec; if (!this._warned) { this._warned = true; G.ui.toast('This browser is blocking storage. Your save is held in memory only — export it from the Load menu before closing.', 'bad'); } } return true; });
    },
    del(slot) { try { localStorage.removeItem(LS + slot); } catch (e) { /* ignore */ } delete this.mem[slot]; return this.tx('readwrite', (s) => s.delete(slot)).catch(() => null); },
    latest() { return this.list().then((l) => l[0] || null); },
    validate(d) { if (!d || typeof d !== 'object') throw new Error('not a save file'); if (d.game !== 'lantern-sea') throw new Error('not a Lantern Sea save'); if (!d.player || !d.inv || !d.structs || d.seedText == null) throw new Error('save is incomplete'); if (d.v > G.SAVE_VERSION) throw new Error('save is from a newer version of the game'); return this.migrate(d); },
    migrate(d) { if (d.v < 2) { d.map = d.map || null; d.vehicles = d.vehicles || []; d.trade = d.trade || {}; d.v = 2; } return d; },
    export(slot) { return this.get(slot).then((r) => { if (!r) return; const blob = new Blob([JSON.stringify({ meta: r.meta, data: r.data })], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'lantern-sea-' + r.meta.name.replace(/[^a-z0-9]+/gi, '-') + '-day' + r.meta.day + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }); },
    import(file) { return file.text().then((t) => { let j; try { j = JSON.parse(t); } catch (e) { throw new Error('file is not valid JSON'); } const data = this.validate(j.data); return this.list().then((l) => { const used = l.map((s) => s.slot), slot = [1, 2, 3, 4].find((n) => !used.includes(n)) || 4; return this.put(slot, j.meta, data).then(() => slot); }); }); }
  };

  // ---------- game lifecycle ----------
  const Game = G.game = {
    flags: {}, difficulty: 'standard', seedText: '1', seed: 1, slot: 1, name: '', rep: 0, trade: {}, treasure: null, playtime: 0, autoT: 0, backupT: 0, streamT: 0, tickT: 0, hints: [],
    resetAll() {
      G.build.active && G.build.exit(); if (G.fishing.active) G.fishing.cancel(); G.player.mode = 'walk'; G.player.helm = null;
      G.structs.clear(); G.vehicles.clear(); G.drops.clear(); G.debris.clear(); G.wildlife.clear(); G.interact.list = []; G.collide.sets = [];
      G.inv.reset(); G.skills.reset(); G.tech.reset(); G.craft.reset(); G.journal.reset(); G.quests.reset(); G.map.reset(); G.world.removed = {}; G.world.opened = {};
      this.flags = {}; this.rep = 0; this.trade = {}; this.treasure = null; this.playtime = 0; this.hints = []; G.photo = false; G.render.fade = 0; G.render.damage = 0;
    },
    begin(text) { G.state = 'loading'; G.ui.hideMenu(); if (G.ui.cur) G.ui.close(true); G.ui.loading(text, 0.2); return new Promise((r) => setTimeout(r, 60)); },
    enter() {
      const P = G.player; G.world.stream(P.pos.x, P.pos.z, 1e9); G.ui.loading('Raising the horizon…', 0.9);
      return new Promise((r) => setTimeout(r, 40)).then(() => { G.ui.loading(null); G.state = 'play'; G.ui.cache = {}; G.ui.fade(1, 0); setTimeout(() => G.ui.fade(0, 2600), 80); G.audio.init(); });
    },
    newGame(o) {
      return this.begin('Charting an ocean…').then(() => {
        this.resetAll(); this.slot = o.slot; this.name = o.name; this.seedText = String(o.seed); this.seed = /^\d+$/.test(this.seedText) ? parseInt(this.seedText, 10) >>> 0 : G.strSeed(this.seedText); this.difficulty = o.difficulty;
        G.world.generate(this.seed); G.time.day = 1; G.time.hour = 5.85; G.wsim.reset(this.seed);
        const raft = G.structs.starterRaft(0, 0), P = G.player, S = G.world.story.start; P.reset(1.0, 0.4, 1.0); raft.update(0.016); P.parent = raft; P.local.set(0.2, raft.floorY(0), 0.6); P.onGround = true; P.yaw = Math.atan2(-(S.x), -(S.z)) + 0.5;
        const I = G.inv; I.add('hook', 1, null, true); I.add('ration', 3, null, true); I.add('bottle', 1, null, true); I.add('rope', 2, null, true); I.add('plank', 4, null, true); I.add('compass', 1, null, true); I.add('coconut', 1, null, true);
        G.map.reveal(0, 0, 300); return this.enter();
      }).then(() => {
        G.quests.start('m1'); G.ui.chapter(1);
        if (G.settings.tutorials) this.hints = [[7, 'You are adrift. Debris from your ship is floating past — hold and release left-click to throw your hook past it, then hold left-click to haul it back. The hook gathers everything it touches on the way.'], [22, 'Press ' + G.keyLabel(G.settings.bindings.craft) + ' to craft, ' + G.keyLabel(G.settings.bindings.build) + ' to build, ' + G.keyLabel(G.settings.bindings.journal) + ' for your journal. Objectives are listed at the top left.'], [50, 'Watch your thirst. Crack the coconut (right-click while holding it) and plan a Rain Catcher or Solar Still.'], [95, 'Right-click with a Flask at the raft edge to fill it with seawater — a Solar Still turns it into drinking water.']];
        this.save(this.slot);
      }).catch((e) => this.fail(e));
    },
    serialize() {
      return { game: 'lantern-sea', v: G.SAVE_VERSION, seedText: this.seedText, seed: this.seed, difficulty: this.difficulty, name: this.name, flags: this.flags, rep: this.rep, trade: this.trade, treasure: this.treasure, playtime: this.playtime, time: G.time.serialize(), weather: G.wsim.serialize(), world: G.world.serialize(), structs: G.structs.serialize(), vehicles: G.vehicles.serialize(), drops: G.drops.serialize(), player: G.player.serialize(), inv: G.inv.serialize(), skills: G.skills.serialize(), tech: G.tech.serialize(), craft: G.craft.serialize(), journal: G.journal.serialize(), quests: G.quests.serialize(), map: G.map.serialize() };
    },
    save(slot) {
      if (G.state !== 'play' && G.state !== 'paused') return Promise.resolve(false); if (!G.player.alive) return Promise.resolve(false);
      if (G.net && G.net.role === 'guest') return Promise.resolve(false);   // a joining partner plays in the host's world; only the host saves it
      let data; try { data = JSON.parse(JSON.stringify(this.serialize())); } catch (e) { console.error(e); G.ui.toast('Could not save: ' + e.message, 'bad'); return Promise.resolve(false); }
      const meta = { name: this.name, day: G.time.day, chapter: G.quests.chapter(), difficulty: this.difficulty, seed: this.seedText, playtime: this.playtime, saved: Date.now() };
      return SV.put(slot, meta, data).then(() => { G.emit('saved', slot); return true; });
    },
    load(slot) {
      return this.begin('Reading the log…').then(() => SV.get(slot)).then((rec) => {
        if (!rec) throw new Error('That save could not be found.'); const d = SV.validate(rec.data);
        this.resetAll(); this.slot = slot === 'auto' ? 1 : slot; this.name = d.name; this.seedText = d.seedText; this.seed = d.seed; this.difficulty = G.DIFF[d.difficulty] ? d.difficulty : 'standard'; this.flags = d.flags || {}; this.rep = d.rep || 0; this.trade = d.trade || {}; this.treasure = d.treasure || null; this.playtime = d.playtime || 0;
        G.world.generate(this.seed); G.world.deserialize(d.world); G.time.deserialize(d.time); G.wsim.reset(this.seed); if (d.weather) G.wsim.deserialize(d.weather);
        G.skills.deserialize(d.skills); G.tech.deserialize(d.tech); G.inv.deserialize(d.inv); G.structs.deserialize(d.structs); for (const s of G.structs.list) s.update(0.016);
        G.vehicles.deserialize(d.vehicles); G.craft.deserialize(d.craft); G.journal.deserialize(d.journal); G.quests.deserialize(d.quests); G.map.deserialize(d.map); G.player.deserialize(d.player); G.drops.deserialize(d.drops);
        return this.enter();
      }).then(() => { G.ui.toast('Welcome back to ' + this.name + ' — day ' + G.time.day + '.', 'good'); }).catch((e) => this.fail(e));
    },
    fail(e) { console.error(e); G.ui.loading(null); this.quitToMenu(); G.ui.toast('Something went wrong: ' + (e && e.message || e), 'bad'); },
    quitToMenu() { if (G.net && G.net.role === 'guest') G.net.stop(true); if (G.ui.cur) G.ui.close(true); this.resetAll(); G.input.unlock(); this.menuScene(); G.ui.showMenu(); },
    menuScene() {
      G.state = 'menu'; this.difficulty = 'standard'; this.flags = {}; G.world.generate(G.strSeed('lantern-menu')); G.time.day = 1; G.time.hour = 6.35; G.wsim.reset(7); Object.assign(G.weather, { cloud: 0.36, wind: 0.5, sea: 0.62 });
      const S = G.world.story.start; this.menuC = { x: S.x - S.r - 95, z: S.z + 55, a: 0 };
      const raft = G.structs.starterRaft(this.menuC.x, this.menuC.z); raft.anchored = true; G.structs.addTile(raft, 2, 0, 0, 'foundation'); G.structs.addTile(raft, 2, 1, 0, 'foundation'); raft.rebuild(); raft.addItem(2, 0, 0, 'sail', 0); raft.addItem(0, 0, 0, 'chest', 1); raft.addItem(2, 1, 0, 'lantern', 0); raft.sailOpen = true; raft.rebuild(); for (const it of raft.items.values()) G.items.refresh(it);
      G.player.pos.set(this.menuC.x, 0.4, this.menuC.z); G.world.stream(this.menuC.x, this.menuC.z, 1e9);
    },
    pause() { if (G.state === 'play' && !(G.net && G.net.connected())) G.state = 'paused'; },   // the world keeps running while a partner is connected resume() { if (G.state === 'paused') G.state = 'play'; },
    onDeath(cause) { G.journal.stat('deaths'); G.audio.sfx('hurt'); if (G.fishing.active) G.fishing.cancel(); if (G.build.active) G.build.exit(); G.player.leaveHelm(); if (G.vehicles.current) G.vehicles.leave(); G.ui.fade(0.75, 1500); setTimeout(() => G.ui.open('death', cause), 900); },
    respawn() {
      const P = G.player, D = G.DIFF[this.difficulty], inv = G.inv;
      if (D.keepOnDeath < 1) for (let i = 0; i < inv.slots.length; i++) { const s = inv.slots[i]; if (!s) continue; const c = G.ITEMS[s.id].c; if (c === 'story') continue; if (D.keepOnDeath === 0) inv.slots[i] = null; else if (c === 'mat' || c === 'food' || c === 'seed') { s.n = Math.floor(s.n / 2); if (s.n <= 0) inv.slots[i] = null; } }
      let st = P.spawn && G.structs.list[P.spawn.st], key = P.spawn && P.spawn.k; if (!st || !st.tiles.has(key)) { st = G.structs.raft; key = st ? [...st.tiles.keys()].find((k) => k.endsWith(',0')) : null; }
      P.cond = {}; P.hp = 60; P.hunger = Math.max(P.hunger, 45); P.thirst = Math.max(P.thirst, 45); P.energy = 60; P.air = 30; P.temp = 0; P.vel.set(0, 0, 0); P.alive = true; P.mode = 'walk';
      if (st && key) { const [ix, iz, lv] = key.split(',').map(Number); P.parent = st; P.local.set(ix * G.structs.T, st.floorY(lv) + 0.05, iz * G.structs.T); st.toWorld(P.local.x, P.local.y, P.local.z, P.pos); P.onGround = true; }
      else { const S = G.world.story.start; P.parent = null; P.pos.set(S.x, G.world.height(S.x, S.z) + 0.5, S.z); }
      G.time.hour = (G.time.hour + 3) % 24; G.wildlife.clear(); G.world.stream(P.pos.x, P.pos.z, 1e9); if (G.ui.cur) G.ui.close(true); G.ui.fade(0, 2000); G.input.lock(); G.ui.toast('You wake, aching, where you last slept.'); this.save(this.slot);
    },
    sleep(hours, q, it) {
      const P = G.player; G.ui.close(true); P.mode = 'sleep'; G.ui.fade(1, 900); G.input.clear();
      setTimeout(() => {
        const T = G.time; T.hour += hours; while (T.hour >= 24) { T.hour -= 24; T.day++; G.emit('newDay', T.day); }
        for (const st of G.structs.list) for (let i = 0; i < 12; i++) G.items.simulate(st, hours * 60 / 12);
        const raft = G.structs.raft; if (raft && !raft.anchored) { const dv = G.debris.drift(new THREE.Vector2()), k = Math.min(hours * 60 * 0.14, 110); const nx = raft.pos.x + dv.x * k, nz = raft.pos.z + dv.y * k; if (G.world.height(nx, nz) < -4) { raft.pos.x = nx; raft.pos.z = nz; } }
        P.energy = G.clamp(P.energy + 100 * q * hours / 8, 0, 100); P.hunger = Math.max(4, P.hunger - hours * 2.4); P.thirst = Math.max(4, P.thirst - hours * 3); P.heal(hours * 4 * q); P.wet = 0; P.temp *= 0.3;
        P.spawn = { st: G.structs.list.indexOf(it.struct), k: it.struct.key(it.ix, it.iz, it.lv) }; P.mode = 'walk'; G.skills.xp('survival', hours * 2);
        G.ui.fade(0, 1600); G.input.lock(); G.ui.toast(hours > 3 ? 'You wake on day ' + T.day + '. ' + (q > 0.8 ? 'You slept well.' : q > 0.5 ? 'You slept fitfully.' : 'It was a hard night.') : 'You feel a little better.'); G.emit('slept', hours); this.save(this.slot);
      }, 1100);
    },
    photo(on) {
      G.photo = on; let p = G.$('#photo'); if (p) p.remove(); if (!on) return; p = G.el('div', '', 'Photo mode — WASD and mouse to fly · Space / Ctrl up and down · Enter saves a PNG · Esc returns'); p.id = 'photo'; G.ui.root.appendChild(p); G.input.lock(); this.pc = { yaw: G.player.yaw, pitch: G.player.pitch };
    },
    photoFly(dt) { const I = G.input, c = G.camera, pc = this.pc; if (I.locked) { pc.yaw -= I.mdx * 0.0022; pc.pitch = G.clamp(pc.pitch - I.mdy * 0.0022, -1.5, 1.5); } c.rotation.set(pc.pitch, pc.yaw, 0, 'YXZ'); const sp = (I.keys.ShiftLeft ? 30 : 8) * dt, f = (I.keys.KeyW ? 1 : 0) - (I.keys.KeyS ? 1 : 0), s = (I.keys.KeyD ? 1 : 0) - (I.keys.KeyA ? 1 : 0), v = new THREE.Vector3(s, 0, -f).applyEuler(c.rotation); c.position.addScaledVector(v, sp); c.position.y += ((I.keys.Space ? 1 : 0) - (I.keys.ControlLeft ? 1 : 0)) * sp; c.updateMatrixWorld(); },

    // ---------- boot ----------
    boot() {
      G.loadSettings(); const canvas = G.$('#game'); G.ui.init(); G.ui.loading('Mixing pigments…', 0.1);
      const steps = [
        ['Loading skies, textures and models…', () => G.assets.load((f, label) => G.ui.loading('Loading ' + label + '…', 0.05 + f * 0.3))],
        ['Weaving textures…', () => G.buildTextures()], ['Growing palms and coral…', () => G.buildNodeGeos()],
        ['Filling the sea…', () => { G.render.init(canvas); G.sky.init(G.scene); G.ocean.init(G.scene); G.fx.init(); G.chips.init(); G.actions.init(); G.debris.init(); G.fishing.init(); G.wildlife.init(); G.groundCover.init(G.scene); G.lightPool.init(); G.skills.reset(); G.quests.init(); G.input.init(canvas); }],
        ['Photographing the supplies…', () => { try { G.icons.renderAll(); } catch (e) { console.warn('item icons fell back to symbols:', e); } }],
        ['Lighting the lanterns…', () => { this.menuScene(); }]
      ];
      let i = 0; const next = () => { if (i >= steps.length) { G.ui.loading(null); G.ui.showMenu(); this.last = performance.now(); requestAnimationFrame((t) => this.loop(t)); return; } G.ui.loading(steps[i][0], 0.1 + i / steps.length * 0.85); setTimeout(() => { try { Promise.resolve(steps[i][1]()).then(() => { i++; next(); }, (e) => this.fatal(e)); } catch (e) { this.fatal(e); } }, 30); };
      next();
      document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play') this.save(this.slot); });
      window.addEventListener('beforeunload', () => { if (G.state === 'play' || G.state === 'paused') this.save(this.slot); });
    },
    fatal(e) { console.error(e); const l = G.$('#loading') || G.ui.root.appendChild(G.el('div')); l.id = 'loading'; l.innerHTML = `<h1>LANTERN SEA</h1><div class="bad" style="max-width:40em;text-align:center">The game could not start.<br><br>${String(e && e.message || e)}<br><br><span class="muted">This game needs a desktop browser with WebGL2 (a current Chrome, Edge or Firefox) and hardware acceleration enabled.</span></div>`; },
    loop(now) {
      requestAnimationFrame((t) => this.loop(t));
      const lim = G.settings.fpsLimit; if (lim && now - this.last < 1000 / lim - 1.5) return;
      let dt = (now - this.last) / 1000; this.last = now; if (dt > 0.1) dt = 0.1; if (dt <= 0) return;
      try { this.step(dt); this.errs = 0; } catch (e) { this.errs = (this.errs || 0) + 1; if (this.errs < 3) console.error(e); if (this.errs === 3) G.ui.toast('An internal error keeps recurring: ' + e.message + '. Save from the pause menu and reload if things look wrong.', 'bad'); }
      G.input.endFrame();
    },
    step(dt) {
      const P = G.player, cam = G.camera, st = G.state; G.uni.uTime.value += dt; if (G.net) G.net.preUpdate();
      if (st === 'play') {
        this.playtime += dt; G.structs.update(dt); G.vehicles.update(dt);
        if (G.photo) this.photoFly(dt); else P.update(dt);
        G.actions.update(dt); G.build.update(); G.systemsUpdate(dt); G.debris.update(dt); G.fishing.update(dt); G.wildlife.update(dt); G.quests.update(dt); G.map.update(dt);
        this.streamT -= dt; if (this.streamT <= 0) { this.streamT = 0.25; G.world.stream(P.pos.x, P.pos.z, 1); }
        this.tickT -= dt; if (this.tickT <= 0) { this.tickT = 0.4; const c = G.ui.cur; if (c && c.P.tick) c.P.tick(c.arg, c); G.render.turbidity = 1 + G.sstep(12, 60, -G.world.height(P.pos.x, P.pos.z)) * 0.7; }
        this.autoT += dt; if (this.autoT > 180) { this.autoT = 0; this.save(this.slot); } this.backupT += dt; if (this.backupT > 600) { this.backupT = 0; this.save('auto'); }
        while (this.hints.length && this.playtime > this.hints[0][0]) { const h = this.hints.shift(); if (G.settings.tutorials && !G.ui.cur) G.ui.toast(h[1]); }
      } else if (st === 'menu') {
        const m = this.menuC, t = G.uni.uTime.value * 0.035; G.structs.update(dt);
        const raft = G.structs.raft, rx = raft ? raft.pos.x : m.x, rz = raft ? raft.pos.z : m.z; const oa = Math.sin(t) * 0.22;
        cam.position.set(rx - 9.5 * Math.cos(oa) + 1.5, 2.2 + Math.sin(t * 1.7) * 0.3, rz + 6.5 + 9.5 * Math.sin(oa));
        cam.lookAt(rx + 14, 2.4, rz - 9); cam.updateMatrixWorld();
      }
      G.items.animate(G.uni.uTime.value, dt); G.fx.update(dt); G.chips.update(dt); if (G.net) G.net.update(dt); G.sites.update(G.uni.uTime.value); G.lightPool.update(G.uni.uTime.value);
      const focus = st === 'menu' ? cam.position : P.pos; G.sky.update(G.time.hour, dt, cam, focus); G.ocean.update(dt, cam); G.groundCover.update(cam.position); G.world.cullDeco(cam.position); G.render.frame(dt); G.ui.updateHUD(dt); G.audio.update(dt);
    }
  };
  window.addEventListener('error', (e) => { if (G.ui && G.ui.root && G.state === 'play' && !window._errShown) { window._errShown = true; G.ui.toast('Script error: ' + e.message, 'bad'); } });
})();
