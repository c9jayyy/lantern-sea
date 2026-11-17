'use strict';
/* Build mode: ghost preview, snapping to raft/base grids, validity, placement cost, demolition with refund, repairs. */
(function () {
  const G = window.G;
  const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _h = new THREE.Vector3(), _l = new THREE.Vector3(), _w = new THREE.Vector3();
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  const B = G.build = {
    active: false, sel: null, rot: 0, demolish: false, ghost: null, info: null,
    enter(id) { this.active = true; this.sel = id; this.demolish = false; this.makeGhost(); G.emit('buildMode', true); },
    enterDemolish() { this.active = true; this.demolish = true; this.sel = null; this.makeGhost(); G.emit('buildMode', true); },
    exit() { this.active = false; this.demolish = false; if (this.ghost) { G.disposeGroup(this.ghost); this.ghost = null; } this.info = null; G.emit('buildMode', false); },
    makeGhost() {
      if (this.ghost) G.disposeGroup(this.ghost); const S = G.structs, T = S.T, LH = S.LH; const b = new G.MB(); const def = this.sel && G.BUILD[this.sel];
      if (!def) b.box(T, 0.3, T, 0, 0.1, 0, 'ghostBad');
      else if (def.kind === 'foundation' || def.kind === 'floor') b.box(T, 0.16, T, 0, -0.08, 0, 'ghostOk');
      else if (def.kind === 'wall') { const h = def.id === 'railing' ? 1 : LH; b.box(T, h, 0.1, 0, h / 2, 0, 'ghostOk'); }
      else if (def.kind === 'stairs') { for (let i = 0; i < 8; i++) { const f = (i + 0.5) / 8; b.box(T * 0.82, 0.06, T / 8 + 0.06, 0, f * LH, T / 2 - f * T, 'ghostOk'); } }
      else if (def.kind === 'roof') { b.box(T + 0.3, 0.07, T * 0.62, 0, LH + 0.28, -T * 0.26, 'ghostOk', 0, 0.42); b.box(T + 0.3, 0.07, T * 0.62, 0, LH + 0.28, T * 0.26, 'ghostOk', 0, -0.42); }
      if (def && def.kind === 'item') this.ghost = G.items.ghost(def.id, G.mats.ghostOk); else this.ghost = b.build({ override: G.mats.ghostOk, shadow: false });
      this.ghost.traverse((o) => { if (o.isMesh) { o.layers.set(1); o.renderOrder = 5; } }); G.scene.add(this.ghost); this.ghostOk = true;
    },
    setGhostValid(ok) { if (ok === this.ghostOk) return; this.ghostOk = ok; const m = ok ? G.mats.ghostOk : G.mats.ghostBad; this.ghost.traverse((o) => { if (o.isMesh) o.material = m; }); },
    cost(def) { const c = {}; const k = G.game.difficulty === 'relaxed' ? 0.75 : 1; for (const id in def.cost) c[id] = Math.max(1, Math.round(def.cost[id] * k)); return c; },
    missing(cost) { const m = []; for (const k in cost) { const have = G.inv.countAll(k); if (have < cost[k]) m.push((cost[k] - have) + ' ' + G.ITEMS[k].n); } return m; },

    // where is the player aiming, in the grid of a structure?
    aim(st, lvUp) {
      const P = G.player, S = G.structs; G.camera.getWorldPosition(_o); G.camera.getWorldDirection(_d);
      let lv = P.parent === st ? Math.max(0, Math.round((P.local.y - st.floorY(0)) / S.LH)) : 0;
      let planeLv = lv; if (lvUp && _d.y > 0.12) planeLv = lv + 1;
      const py = st.pos.y + st.floorY(planeLv); let t = Math.abs(_d.y) > 0.02 ? (py - _o.y) / _d.y : -1; if (t < 0.3) t = 3.0; else if (t > 3.8) t = 3.8;
      _h.copy(_o).addScaledVector(_d, t); st.toLocal(_h.x, _h.y, _h.z, _l);
      return { lv, planeLv, ix: Math.round(_l.x / S.T), iz: Math.round(_l.z / S.T), fx: _l.x / S.T - Math.round(_l.x / S.T), fz: _l.z / S.T - Math.round(_l.z / S.T) };
    },
    groundHit() {
      G.camera.getWorldPosition(_o); G.camera.getWorldDirection(_d);
      for (let t = 0.6; t < 6.5; t += 0.2) { _h.copy(_o).addScaledVector(_d, t); const g = G.world.heightAt(_h.x, _h.z); if (_h.y <= g) return { x: _h.x, y: g, z: _h.z }; }
      return null;
    },
    evaluate() {
      const P = G.player, S = G.structs, T = S.T, def = G.BUILD[this.sel]; let info = null;
      const st = (P.parent && P.parent.kind !== 'ground') ? P.parent : S.near(P.pos.x, P.pos.z, 4.5, ['raft', 'base']);
      if (st) {
        const a = this.aim(st, def.kind === 'floor'); const k0 = st.key(a.ix, a.iz, a.lv);
        const has = st.hasFloor(a.ix, a.iz, a.lv), busy = st.items.has(k0) || st.stairs.has(k0);
        info = { st, ix: a.ix, iz: a.iz, lv: a.lv, x: a.ix * T, z: a.iz * T, y: st.floorY(a.lv), ry: 0, valid: false, why: '' };
        if (def.kind === 'foundation') {
          info.lv = 0; info.y = st.floorY(0); let adj = NB.some(([dx, dz]) => st.hasFloor(a.ix + dx, a.iz + dz, 0));
          if (st.hasFloor(a.ix, a.iz, 0) || !adj) { // looking outward: snap to the first free tile along the view that touches the structure
            const ld = st.toLocal(st.pos.x + _d.x, 0, st.pos.z + _d.z), ll = Math.hypot(ld.x, ld.z) || 1, lp = st.toLocal(P.pos.x, 0, P.pos.z);
            for (let d = 0.6; d < 7; d += 0.3) { const ix = Math.round((lp.x + ld.x / ll * d) / T), iz = Math.round((lp.z + ld.z / ll * d) / T); if (!st.hasFloor(ix, iz, 0) && NB.some(([dx, dz]) => st.hasFloor(ix + dx, iz + dz, 0))) { a.ix = ix; a.iz = iz; info.ix = ix; info.iz = iz; info.x = ix * T; info.z = iz * T; adj = true; break; } }
          }
          if (st.hasFloor(a.ix, a.iz, 0)) info.why = 'Occupied'; else if (!adj) { info.why = 'Must touch an existing foundation'; info.detached = true; }
          else { st.toWorld(info.x, 0, info.z, _w); const g = G.world.heightAt(_w.x, _w.z); if (st.kind === 'raft' ? g > -0.7 : (g > st.pos.y + st.floorY(0) + 0.25 || g < st.pos.y - 4)) info.why = st.kind === 'raft' ? 'Too shallow here' : 'Ground does not fit'; else info.valid = true; }
        } else if (def.kind === 'floor') {
          const lv = a.lv + 1; info.lv = lv; info.y = st.floorY(lv);
          if (lv > 3) info.why = 'Too high'; else if (st.hasFloor(a.ix, a.iz, lv)) info.why = 'Occupied'; else if (st.stairs.has(st.key(a.ix, a.iz, lv - 1))) info.why = 'Stairwell must stay open';
          else if (!st.supported(a.ix, a.iz, lv)) info.why = 'Needs a wall or stairs below, or a supported neighbour'; else info.valid = true;
        } else if (def.kind === 'wall') {
          const side = Math.abs(a.fx) > Math.abs(a.fz) ? (a.fx > 0 ? 3 : 1) : (a.fz > 0 ? 2 : 0); const ek = st.edge(a.ix, a.iz, a.lv, side); const [ex, ez, , es] = ek.split(',').map(Number);
          info.edge = ek; info.x = es === 0 ? ex * T : ex * T - T / 2; info.z = es === 0 ? ez * T - T / 2 : ez * T; info.ry = es === 0 ? 0 : Math.PI / 2;
          const other = es === 0 ? st.hasFloor(ex, ez - 1, a.lv) : st.hasFloor(ex - 1, ez, a.lv);
          if (!has && !other) info.why = 'Needs a floor'; else if (st.walls.has(ek)) info.why = 'Occupied'; else info.valid = true;
        } else if (def.kind === 'stairs') {
          info.ry = -this.rot * Math.PI / 2; if (!has) info.why = 'Needs a floor'; else if (busy) info.why = 'Occupied'; else if (a.lv >= 3) info.why = 'Too high'; else if (st.hasFloor(a.ix, a.iz, a.lv + 1)) info.why = 'Blocked by the floor above'; else info.valid = true;
        } else if (def.kind === 'roof') {
          if (!has) info.why = 'Needs a floor'; else if (st.roofs.has(k0)) info.why = 'Occupied'; else if (st.hasFloor(a.ix, a.iz, a.lv + 1)) info.why = 'Already covered'; else info.valid = true;
        } else {
          info.ry = this.rot * Math.PI / 2;
          if (!has) { info.why = 'Needs a floor'; info.detached = true; } else if (busy) info.why = 'Occupied'; else if (def.raftOnly && st.kind !== 'raft') info.why = 'Raft only'; else info.valid = true;
        }
      }
      // free placement on land: equipment directly on the ground, or the first foundation of a new base
      if ((!info || info.detached) && (def.kind === 'item' || def.kind === 'foundation')) {
        const g = this.groundHit();
        if (g && g.y > 0.35) {
          const slope = G.world.slopeAt(g.x, g.z); info = { ground: true, x: g.x, y: g.y, z: g.z, ry: 0, valid: false, why: '' };
          if (def.kind === 'item') { info.ry = P.yaw + this.rot * Math.PI / 2; if (def.raftOnly) info.why = 'Raft only'; else if (slope > 0.7) info.why = 'Too steep'; else if (S.list.some((s) => s.kind === 'ground' && Math.hypot(s.pos.x - g.x, s.pos.z - g.z) < 1.1)) info.why = 'Too close to something'; else info.valid = true; }
          else { info.newBase = true; info.y = g.y + 0.5; info.ry = Math.round(P.yaw / (Math.PI / 12)) * Math.PI / 12; if (slope > 0.9) info.why = 'Too steep'; else info.valid = true; }
        } else if (!info) info = null;
      }
      if (info && info.valid) { const miss = this.missing(this.cost(def)); if (miss.length) { info.valid = false; info.why = 'Missing: ' + miss.join(', '); } else if (!G.inv.slots.some((s) => s && s.id === 'mallet')) { info.valid = false; info.why = 'You need a Builder\'s Mallet'; } }
      return info;
    },
    evaluateDemolish() {
      const P = G.player, S = G.structs, T = S.T; const t = G.actions.findTarget();
      if (t && t.kind === 'item') { const it = t.it, st = it.struct; return { st, piece: 'item', key: st.key(it.ix, it.iz, it.lv), type: it.type, x: it.ix * T, y: st.floorY(it.lv), z: it.iz * T, valid: this.emptyItem(it), why: 'Empty it first' }; }
      const st = (P.parent && P.parent.kind !== 'ground') ? P.parent : S.near(P.pos.x, P.pos.z, 4.5, ['raft', 'base']); if (!st) return null;
      const a = this.aim(st, false), k = st.key(a.ix, a.iz, a.lv); const base = { st, x: a.ix * T, y: st.floorY(a.lv), z: a.iz * T, valid: true, why: '' };
      if (_d.y > 0.25 && st.roofs.has(k)) return Object.assign(base, { piece: 'roof', key: k, type: 'roof' });
      if (st.stairs.has(k)) return Object.assign(base, { piece: 'stairs', key: k, type: 'stairs' });
      const edge = Math.max(Math.abs(a.fx), Math.abs(a.fz));
      if (edge > 0.3 || !st.tiles.has(k)) { const side = Math.abs(a.fx) > Math.abs(a.fz) ? (a.fx > 0 ? 3 : 1) : (a.fz > 0 ? 2 : 0), ek = st.edge(a.ix, a.iz, a.lv, side), w = st.walls.get(ek); if (w) { const [ex, ez, , es] = ek.split(',').map(Number); return Object.assign(base, { piece: 'wall', key: ek, type: w.type, x: es === 0 ? ex * T : ex * T - T / 2, z: es === 0 ? ez * T - T / 2 : ez * T }); } }
      if (_d.y > 0.25 && st.tiles.has(st.key(a.ix, a.iz, a.lv + 1))) { const ku = st.key(a.ix, a.iz, a.lv + 1); const ok = !st.items.has(ku) && !st.stairs.has(ku); return Object.assign(base, { piece: 'tile', key: ku, type: st.tiles.get(ku).type, y: st.floorY(a.lv + 1), valid: ok, why: 'Clear it first' }); }
      const tile = st.tiles.get(k); if (!tile) return null;
      let ok = !st.items.has(k) && !st.stairs.has(k), why = 'Clear what stands on it first';
      if (ok && a.lv === 0) { if (st.tiles.size <= 1 && st.kind === 'raft') { ok = false; why = 'You cannot scrap your last foundation'; } else if (st.hasFloor(a.ix, a.iz, 1)) { ok = false; why = 'Something is built above'; } else if (st.tiles.size > 1 && !st.connectedWithout(k)) { ok = false; why = 'That would split the structure'; } }
      return Object.assign(base, { piece: 'tile', key: k, type: tile.type, valid: ok, why });
    },
    emptyItem(it) { const s = it.s; if (s.c && s.c.slots.some(Boolean)) return false; if (s.in && (s.in.some(Boolean) || s.out.some(Boolean))) return false; return !(G.player.helm && G.player.helm.it === it); },

    update() {
      if (!this.active) return; const I = G.input, P = G.player;
      if (!I.locked || G.ui.blocking() || P.mode !== 'walk') { if (this.ghost) this.ghost.visible = false; return; }
      if (I.hit('rotate') || I.wheel) this.rot = (this.rot + (I.wheel < 0 ? 3 : 1)) % 4;
      if (I.hit('demolish')) { if (this.demolish) return this.exit(); this.enterDemolish(); }
      if (I.mpressed[2]) return this.exit();
      const info = this.info = this.demolish ? this.evaluateDemolish() : this.evaluate();
      if (!info) { this.ghost.visible = false; return; }
      this.ghost.visible = true; this.setGhostValid(this.demolish ? false : info.valid);
      if (info.ground) { this.ghost.position.set(info.x, info.y, info.z); this.ghost.rotation.set(0, info.ry, 0); }
      else { const st = info.st; st.toWorld(info.x, info.y, info.z, _w); this.ghost.position.copy(_w); this.ghost.rotation.set(0, st.yaw + (info.ry || 0), 0); }
      if (I.mpressed[0]) { if (this.demolish) this.doDemolish(info); else this.place(info); }
    },
    place(info) {
      const def = G.BUILD[this.sel], S = G.structs;
      if (!info.valid) { G.audio.sfx('deny'); return G.ui.toast(info.why || 'Cannot build there.', 'bad'); }
      G.inv.pay(this.cost(def)); let st = info.st;
      if (info.ground) {
        if (info.newBase) { st = S.create('base', info.x, info.y - S.DECK, info.z, info.ry); S.addTile(st, 0, 0, 0, def.id); }
        else { st = S.create('ground', info.x, info.y, info.z, info.ry); st.addItem(0, 0, 0, def.id, 0); }
      } else if (def.kind === 'foundation' || def.kind === 'floor') S.addTile(st, info.ix, info.iz, info.lv, def.id);
      else if (def.kind === 'wall') st.walls.set(info.edge, { type: def.id, open: false });
      else if (def.kind === 'stairs') st.stairs.set(st.key(info.ix, info.iz, info.lv), { dir: this.rot });
      else if (def.kind === 'roof') st.roofs.set(st.key(info.ix, info.iz, info.lv), { type: 'roof' });
      else st.addItem(info.ix, info.iz, info.lv, def.id, this.rot);
      st.dirty = true; G.audio.sfx('build'); G.skills.xp('crafting', 6); G.journal.stat('built'); G.emit('built', def.id, st);
      const p = this.ghost.position; G.fx.burst(p.x, p.y + 0.2, p.z, [0.8, 0.7, 0.5, 0.8], 8, 1.5, 0.5, 4, 0.07);
    },
    doDemolish(info) {
      if (!info.valid) { G.audio.sfx('deny'); return G.ui.toast(info.why, 'bad'); }
      const st = info.st, def = G.BUILD[info.type];
      if (info.piece === 'item') { st.removeItem(info.key); if (st.kind === 'ground') G.structs.remove(st); }
      else if (info.piece === 'wall') st.walls.delete(info.key); else if (info.piece === 'stairs') st.stairs.delete(info.key); else if (info.piece === 'roof') st.roofs.delete(info.key);
      else { st.tiles.delete(info.key); const [ix, iz, lv] = info.key.split(',').map(Number); for (let s = 0; s < 4; s++) { const ek = st.edge(ix, iz, lv, s); const [ex, ez, , es] = ek.split(',').map(Number); const a = st.hasFloor(ex, ez, lv), b = es === 0 ? st.hasFloor(ex, ez - 1, lv) : st.hasFloor(ex - 1, ez, lv); if (!a && !b) st.walls.delete(ek); } st.roofs.delete(info.key); if (!st.tiles.size && st.kind === 'base') G.structs.remove(st); }
      st.dirty = true; for (const k in def.cost) { const n = Math.floor(def.cost[k] / 2); if (n > 0) G.inv.add(k, n, null, true); }
      G.audio.sfx('demolish'); G.ui.toast('Dismantled ' + def.n + ' — half the materials recovered.');
    },
    repair() {
      const P = G.player, S = G.structs; const st = (P.parent && P.parent.kind !== 'ground') ? P.parent : S.near(P.pos.x, P.pos.z, 3, ['raft', 'base']); if (!st) return G.audio.sfx('whoosh');
      const a = this.aim(st, false); let k = st.key(a.ix, a.iz, a.lv), t = st.tiles.get(k);
      if (!t || t.hp >= t.max) { t = null; let worst = 1; for (const [kk, tt] of st.tiles) { const [ix, iz] = kk.split(',').map(Number); st.toWorld(ix * S.T, 0, iz * S.T, _w); if (Math.hypot(_w.x - P.pos.x, _w.z - P.pos.z) < 2.6 && tt.hp / tt.max < worst) { worst = tt.hp / tt.max; t = tt; } } }
      if (!t) { G.audio.sfx('thud'); return G.ui.toast('Nothing here needs repair.'); }
      if (G.inv.countAll('plank') < 1) return G.ui.toast('Repairs need a plank.', 'bad');
      G.inv.removeAll('plank', 1); t.hp = Math.min(t.max, t.hp + 45); st.dirty = true; G.audio.sfx('build'); G.skills.xp('crafting', 5); G.emit('repair', st, t);
      if (t.hp >= t.max) G.ui.toast('Deck repaired.', 'good');
    }
  };
})();
