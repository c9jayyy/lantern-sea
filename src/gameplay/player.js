'use strict';
/* First-person controller: walking, swimming, diving, riding the raft, box/terrain collision, survival simulation. */
(function () {
  const G = window.G;
  const STEP = 0.55, RAD = 0.34, HEIGHT = 1.75;
  const _l = new THREE.Vector3(), _w = new THREE.Vector3(), _res = { ground: -1e9, src: null, ceil: 1e9, mantle: null };
  G.collide = { sets: [] }; // static world collider sets: {x, z, r, boxes[]}
  G.interact = { list: [], add(o) { this.list.push(o); return o; }, remove(o) { const i = this.list.indexOf(o); if (i >= 0) this.list.splice(i, 1); }, removeTag(tag) { this.list = this.list.filter((o) => o.tag !== tag); } };

  // p is in the same frame as the boxes. Pushes p out of walls; reports walkable top under the feet.
  function resolveBoxes(boxes, p, res, src, yOff) {
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i], dx = p.x - b.x, dz = p.z - b.z;
      if (Math.abs(dx) > b.hx + b.hz + 1 || Math.abs(dz) > b.hx + b.hz + 1) continue;
      let lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
      let top = b.y + b.hy; const bottom = b.y - b.hy;
      if (b.ramp) top = b.base + G.clamp((b.hz - lz) / (2 * b.hz), 0, 1) * b.ramp + 0.04;
      const ax = Math.abs(lx) - b.hx, az = Math.abs(lz) - b.hz;
      if (ax < 0 && az < 0) {
        if (top <= p.y + STEP + (b.ramp ? 0.25 : 0)) { if (top + yOff > res.ground) { res.ground = top + yOff; res.src = src; } continue; }
        if (bottom >= p.y + HEIGHT * 0.5) { if (bottom + yOff < res.ceil) res.ceil = bottom + yOff; continue; }
      }
      if (ax > RAD || az > RAD) continue;
      if (p.y + HEIGHT <= bottom || p.y >= top - 0.03) continue;
      if (top <= p.y + STEP && !b.ramp) continue;
      if (top <= p.y + 2.0 && (!res.mantle || top + yOff > res.mantle.top)) res.mantle = { top: top + yOff, ltop: top, src };
      // push out along least penetration (with rounded corners)
      if (ax > 0 && az > 0) { const d = Math.hypot(ax, az); if (d >= RAD || d < 1e-5) continue; const k = (RAD - d) / d; lx += Math.sign(lx) * ax * k; lz += Math.sign(lz) * az * k; }
      else if (ax > az) lx = Math.sign(lx || 1) * (b.hx + RAD); else lz = Math.sign(lz || 1) * (b.hz + RAD);
      p.x = b.x + lx * b.c + lz * b.s; p.z = b.z - lx * b.s + lz * b.c; res.hit = true;
    }
  }
  G.resolveBoxes = resolveBoxes;

  const P = G.player = {
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, onGround: false, swimming: false, headUnder: false, crouch: false,
    parent: null, local: new THREE.Vector3(), mode: 'walk', eye: 1.62, bob: 0, fallV: 0, groundY: 0, depth: 0, shaded: false, nearFire: false,
    hp: 100, hunger: 100, thirst: 100, stamina: 100, energy: 100, air: 30, airMax: 30, temp: 0, wet: 0, feels: 26,
    cond: {}, target: null, swingT: 0, useCd: 0, spawn: null, stepT: 0, lightOn: false, hurtT: 0, sunT: 0, alive: true,

    reset(x, y, z) {
      this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.climb = null; this.climbK = 0; this.yaw = 0; this.pitch = 0; this.parent = null; this.mode = 'walk';
      this.hp = 100; this.hunger = 78; this.thirst = 70; this.stamina = 100; this.energy = 85; this.air = 30; this.temp = 0; this.wet = 0; this.cond = {}; this.alive = true; this.spawn = null; this.lightOn = false;
    },
    has(c) { return (this.cond[c] || 0) > 0; },
    afflict(c, secs) { if (!this.has(c)) { const N = { bleeding: 'You are bleeding. Use a bandage.', poison: 'Poisoned. An antidote will clear it.', sick: 'You feel sick. Rest, drink clean water, or brew herbal tea.', infection: 'The wound is infected. Apply herbal salve.', fracture: 'Something cracked. You need a splint.', sunburn: 'Sunburnt. Find shade; aloe helps.' }; G.ui.toast(N[c], 'bad'); } this.cond[c] = Math.max(this.cond[c] || 0, secs); },
    cure(c) { if (this.has(c)) { delete this.cond[c]; return true; } return false; },
    damage(n, cause, opts) {
      if (!this.alive || G.state !== 'play') return;
      n *= G.DIFF[G.game.difficulty].dmg * (cause === 'starvation' || cause === 'dehydration' || cause === 'drowning' ? 1 : 1 - this.armor()); this.hp -= n; this.hurtT = 0.6; G.render.damage = Math.min(1, G.render.damage + n / 30);
      if (!opts || !opts.silent) G.audio.sfx('hurt');
      if (this.hp <= 0) { this.hp = 0; this.alive = false; G.game.onDeath(cause || 'injuries'); }
    },
    heal(n) { this.hp = Math.min(100, this.hp + n); },
    drink(t, kind) { this.thirst = G.clamp(this.thirst + t, 0, 100); G.audio.sfx('drink'); if (kind === 'fresh') G.emit('drank', 'fresh'); },
    takeHelm(st, it) { this.mode = 'helm'; this.helm = { st, it }; this.vel.set(0, 0, 0); G.ui.toast('At the helm — A/D steer, W/S ' + (st.nEngines ? 'throttle' : 'set / furl sail') + ', E to let go.'); G.emit('helm'); },
    leaveHelm() { if (this.helm) { this.helm.st.throttle = 0; } this.mode = 'walk'; this.helm = null; },
    // worn gear is data-driven: see the item fields air, swim, warm, rainproof, shade, armor
    gear(slot, key, def) { const s = G.inv.equip[slot]; const v = s && G.ITEMS[s.id] && G.ITEMS[s.id][key]; return v == null ? def : v; },
    armor() { let a = 0; for (const sl of ['head', 'body', 'feet']) a += this.gear(sl, 'armor', 0); return Math.min(0.6, a); },
    airCapacity() { const eq = G.inv.equip; return (28 + (eq.face ? this.gear('face', 'air', 14) : 0)) * (1 + G.skills.level('diving') * 0.06); },
    forward(out) { const cp = Math.cos(this.pitch); return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp); },

    update(dt) {
      const I = G.input, S = G.settings;
      if (this.parent) { const st = this.parent; st.toWorld(this.local.x, this.local.y, this.local.z, this.pos); this.yaw += st.dYaw; }
      if (I.active() && this.mode !== 'sleep') {
        const k = 0.0022 * S.sens * (this.zoom ? 0.3 : 1);
        // cap the turn a single frame can make (12 rad/s, at least 0.2 rad): no real hand turns faster, but a stray input burst can
        const cap = Math.max(0.2, 12 * dt), dYaw = G.clamp(I.mdx * k, -cap, cap), dPitch = G.clamp(I.mdy * k * (S.invertY ? -1 : 1), -cap, cap);
        this.yaw -= dYaw; this.pitch = G.clamp(this.pitch - dPitch, -1.5, 1.5);
      }
      const ctl = I.active() && !G.ui.blocking();
      if (this.mode === 'helm') this.updateHelm(dt, ctl);
      else if (this.mode === 'boat') G.vehicles.drive(dt, ctl);
      else if (this.climb) this.updateClimb(dt);
      else if (this.alive) this.move(dt, ctl);
      if (this.parent) this.parent.toLocal(this.pos.x, this.pos.y, this.pos.z, this.local);
      this.updateCamera(dt);
      this.survive(dt);
    },

    updateHelm(dt, ctl) {
      const h = this.helm, st = h.st, I = G.input;
      if (!st.items.has(st.key(h.it.ix, h.it.iz, h.it.lv))) return this.leaveHelm();
      const ry = h.it.rot * Math.PI / 2; const ox = Math.sin(ry) * 0.75, oz = Math.cos(ry) * 0.75;
      st.toWorld(h.it.ix * G.structs.T + ox, st.floorY(h.it.lv), h.it.iz * G.structs.T + oz, this.pos); this.parent = st;
      if (ctl) {
        st.steer = (I.down('left') ? 1 : 0) - (I.down('right') ? 1 : 0);
        if (st.nEngines) st.throttle = (I.down('forward') ? 1 : 0) - (I.down('back') ? 0.4 : 0);
        else { if (I.hit('forward') && st.nSails && !st.sailOpen) G.items.use([...st.items.values()].find((x) => x.type === 'sail')); if (I.hit('back') && st.sailOpen) G.items.use([...st.items.values()].find((x) => x.type === 'sail')); }
        if (I.hit('interact') || I.hit('jump')) { this.leaveHelm(); I.pressed = {}; }
      }
      if (st.speed > 1) G.skills.xp('sailing', dt * 0.5);
    },

    updateClimb(dt) {
      const c = this.climb;
      // moved by something else (respawn, load, being carried off): abandon the climb
      if ((c.st && this.parent !== c.st) || (c.last && c.last.distanceToSquared(this.pos) > 4) || !this.alive) { this.climb = null; this.climbK = 0; return; }
      c.t += dt / c.dur; const t = Math.min(c.t, 1);
      // arms pull the body up first, then the weight goes forward onto the deck
      const us = Math.min(t / 0.7, 1), up = us * us * (3 - 2 * us), fw = G.sstep(0.4, 1, t);
      _w.set(G.lerp(c.from.x, c.to.x, fw), G.lerp(c.from.y, c.to.y, up), G.lerp(c.from.z, c.to.z, fw));
      if (c.st) { if (G.structs.list.indexOf(c.st) < 0) { this.climb = null; this.climbK = 0; return; } this.parent = c.st; this.local.copy(_w); c.st.toWorld(_w.x, _w.y, _w.z, this.pos); } else this.pos.copy(_w);
      this.vel.set(0, 0, 0); this.swimming = false; this.onGround = false; this.crouch = false; this.climbK = Math.sin(Math.PI * t);
      if (t >= 1) { this.climb = null; this.climbK = 0; this.onGround = true; this.groundY = this.pos.y; this.wet = 1; }
      this.depth = 0; if (this.climb) (c.last || (c.last = new THREE.Vector3())).copy(this.pos);
    },

    move(dt, ctl) {
      const I = G.input, O = G.ocean, W = G.world, pos = this.pos, vel = this.vel;
      const f = ctl ? (I.down('forward') ? 1 : 0) - (I.down('back') ? 1 : 0) : 0, s = ctl ? (I.down('right') ? 1 : 0) - (I.down('left') ? 1 : 0) : 0;
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      let wx = -sy * f + cy * s, wz = -cy * f - sy * s; const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
      const waterH = O.height(pos.x, pos.z); const sub = waterH - pos.y;
      const wantSprint = ctl && I.down('sprint') && this.stamina > 1 && !this.has('fracture') && (f > 0 || this.swimming);
      const frac = this.has('fracture') ? 0.6 : 1, tired = this.energy < 12 ? 0.8 : 1;
      this.crouch = ctl && I.down('crouch') && !this.swimming;
      const swim = sub > 1.15 && this.groundY < waterH - 1.1;
      if (swim && !this.swimming) { if (vel.y < -4) G.audio.sfx('splash'); vel.y *= 0.3; this.parent = null; }
      this.swimming = swim; _res.ground = -1e9; _res.src = null; _res.ceil = 1e9; _res.mantle = null; _res.hit = false;
      let nx, ny, nz;
      if (swim) {
        const fins = this.gear('feet', 'swim', 1), sp = 2.5 * fins * (wantSprint ? 1.45 : 1) * (1 + G.skills.level('diving') * 0.03) * frac;
        const cp = Math.cos(this.pitch); let tx = wx * sp * (f ? cp : 1), tz = wz * sp * (f ? cp : 1), ty = Math.sin(this.pitch) * f * sp;
        if (ctl && I.down('jump')) ty += sp * 0.9; if (ctl && I.down('crouch')) ty -= sp * 0.9;
        if (ty === 0) ty = sub < 3.2 ? G.clamp((sub - 1.3) * 2.2, -1.5, 1.7) : 0.15;
        vel.x = G.damp(vel.x, tx, 4, dt); vel.y = G.damp(vel.y, ty, 4, dt); vel.z = G.damp(vel.z, tz, 4, dt);
        if (wantSprint && (f || s)) this.stamina -= dt * 6;
        nx = pos.x + vel.x * dt; ny = pos.y + vel.y * dt; nz = pos.z + vel.z * dt;
        if (ny > waterH - 1.24) ny = waterH - 1.24;
        this.onGround = false; this.stepT += dt * (Math.hypot(vel.x, vel.z) + 0.5); if (this.stepT > 3.2) { this.stepT = 0; if (!this.headUnder) G.audio.sfx('swim'); }
      } else {
        let sp = (this.crouch ? 2.0 : wantSprint ? 6.6 : 4.2) * frac * tired; if (sub > 0.5) sp *= 0.62;
        if (wantSprint && wl > 0) this.stamina -= dt * 8;
        const acc = this.onGround ? 14 : 3;
        vel.x = G.damp(vel.x, wx * sp, acc, dt); vel.z = G.damp(vel.z, wz * sp, acc, dt);
        vel.y -= 22 * dt; if (vel.y < -45) vel.y = -45;
        if (ctl && I.hit('jump') && this.onGround && this.stamina > 4 && !this.has('fracture')) { vel.y = 6.6; this.onGround = false; this.stamina -= 5; G.audio.sfx('jump'); }
        nx = pos.x + vel.x * dt; ny = pos.y + vel.y * dt; nz = pos.z + vel.z * dt;
      }
      // --- collisions ---
      _l.set(nx, ny, nz);
      W.collideNodes(_l, RAD, _l.y);
      for (const set of G.collide.sets) { if (Math.abs(_l.x - set.x) > set.r + 2 || Math.abs(_l.z - set.z) > set.r + 2) continue; resolveBoxes(set.boxes, _l, _res, 'world', 0); }
      for (const st of G.structs.list) {
        if (Math.abs(_l.x - st.pos.x) > st.radius + 2 || Math.abs(_l.z - st.pos.z) > st.radius + 2) continue;
        st.toLocal(_l.x, _l.y, _l.z, _w); const hadHit = _res.hit; _res.hit = false;
        resolveBoxes(st.boxes, _w, _res, st, st.pos.y);
        if (_res.hit) st.toWorld(_w.x, _w.y, _w.z, _l); _res.hit = _res.hit || hadHit;
      }
      const terr = W.heightAt(_l.x, _l.z); let ground = terr, src = null;
      if (_res.ground > ground) { ground = _res.ground; src = _res.src; }
      this.groundY = ground;
      if (_l.y + HEIGHT > _res.ceil && vel.y > 0) { vel.y = 0; _l.y = Math.min(_l.y, _res.ceil - HEIGHT); }
      if (swim) {
        if (_l.y < ground) { _l.y = ground; if (vel.y < 0) vel.y = 0; }
        // climb out onto decks and docks
        if (_res.mantle && _res.hit && (f > 0 || (ctl && I.down('jump'))) && _res.mantle.top > waterH - 0.5 && _res.mantle.top < _l.y + 2.3) {
          // haul out over the edge: a short timed climb in the frame of whatever is being climbed, so it follows a heaving raft
          const m = _res.mantle, st = m.src && m.src !== 'world' ? m.src : null, dx = wl ? wx : -sy, dz = wl ? wz : -cy;
          const c = this.climb = { t: 0, dur: 1.15, st, from: new THREE.Vector3(), to: new THREE.Vector3() };
          if (st) { st.toLocal(_l.x, _l.y, _l.z, c.from); st.toLocal(_l.x + dx * 0.8, m.top, _l.z + dz * 0.8, c.to); c.to.y = m.ltop + 0.02; this.parent = st; }
          else { c.from.copy(_l); c.to.set(_l.x + dx * 0.8, m.top + 0.02, _l.z + dz * 0.8); }
          vel.set(0, 0, 0); G.audio.sfx('climb'); G.emit('climbOut');
        }
      } else {
        const wasGround = this.onGround;
        if (_l.y <= ground || (wasGround && vel.y <= 0 && _l.y - ground < 0.45)) {
          if (!wasGround && vel.y < -11) { const d = (-vel.y - 11) * 5.5; this.damage(d, 'a fall'); if (d > 26) this.afflict('fracture', 240); }
          if (!wasGround && vel.y < -3) G.audio.sfx(sub > 0.2 ? 'splash' : 'land');
          _l.y = ground; vel.y = 0; this.onGround = true;
          this.parent = src && src !== 'world' ? src : null;
        } else this.onGround = false;
        if (this.onGround && wl > 0) { this.stepT += dt * Math.hypot(vel.x, vel.z); if (this.stepT > 2.1) { this.stepT = 0; G.audio.sfx(sub > 0.1 ? 'wade' : src ? 'stepwood' : terr < 2 ? 'stepsand' : 'stepgrass'); } }
      }
      pos.copy(_l);
      this.depth = Math.max(0, waterH - (pos.y + this.eye));
    },

    updateCamera(dt) {
      const cam = G.camera, S = G.settings; const ck = this.climbK || 0, te = this.crouch ? 1.0 : this.swimming ? 1.55 : 1.62 - ck * 0.5; this.eye = G.damp(this.eye, te, 10, dt);
      const sp = Math.hypot(this.vel.x, this.vel.z);
      if (this.onGround && sp > 0.5 && !S.reducedMotion) this.bob += dt * sp * 1.9; const bobY = Math.sin(this.bob) * 0.035 * S.camBob * Math.min(1, sp / 4), bobX = Math.cos(this.bob * 0.5) * 0.02 * S.camBob * Math.min(1, sp / 4);
      let roll = 0;
      if (this.parent && this.parent.kind === 'raft') {
        const st = this.parent; st.group.updateMatrixWorld(); _w.set(this.local.x, this.local.y + this.eye, this.local.z); st.group.localToWorld(_w); cam.position.copy(_w);
        roll = S.reducedMotion ? 0 : (st.tilt.y * Math.cos(this.yaw - st.yaw) + st.tilt.x * Math.sin(this.yaw - st.yaw)) * 0.7;
      } else cam.position.set(this.pos.x, this.pos.y + this.eye, this.pos.z);
      cam.position.y += bobY; cam.position.x += Math.cos(this.yaw) * bobX; cam.position.z -= Math.sin(this.yaw) * bobX;
      if (this.swimming && !S.reducedMotion) { cam.position.y += Math.sin(G.uni.uTime.value * 1.4) * 0.04; roll += Math.sin(G.uni.uTime.value * 0.9) * 0.012; }
      cam.rotation.set(this.pitch - ck * 0.32, this.yaw, roll + ck * 0.045, 'YXZ');
      const fov = S.fov * (this.zoom ? 0.28 : 1) + (sp > 5.5 && this.onGround ? 4 : 0); if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = G.damp(cam.fov, fov, 8, dt); cam.updateProjectionMatrix(); }
      cam.updateMatrixWorld();
      this.headUnder = cam.position.y < G.ocean.height(cam.position.x, cam.position.z) - 0.02;
      G.render.damage = Math.max(0, G.render.damage - dt * 0.7);
      if (this.hp < 25) G.render.damage = Math.max(G.render.damage, 0.35 + 0.15 * Math.sin(G.uni.uTime.value * 4));
    },

    survive(dt) {
      if (!this.alive || G.state !== 'play') return;
      const D = G.DIFF[G.game.difficulty], W = G.weather, eq = G.inv.equip, sv = 1 - G.skills.level('survival') * 0.03, drain = D.drain * sv;
      for (const c in this.cond) { this.cond[c] -= dt; if (this.cond[c] <= 0) { delete this.cond[c]; if (c === 'bleeding' && Math.random() < 0.25) this.afflict('infection', 300); else G.ui.toast({ bleeding: 'The bleeding has stopped.', poison: 'The poison has run its course.', sick: 'Your stomach settles.', infection: 'The infection clears.', fracture: 'The bone has knit.', sunburn: 'Your skin has calmed down.' }[c] || ''); } }
      const sick = this.has('sick') ? 1.9 : 1, sprinting = Math.hypot(this.vel.x, this.vel.z) > 5 ? 1.5 : 1;
      const hot = this.temp > 55 ? 1.6 : 1;
      if (this.mode !== 'sleep') {
        this.hunger = Math.max(0, this.hunger - dt * 0.064 * drain * sick * sprinting);
        this.thirst = Math.max(0, this.thirst - dt * 0.09 * drain * sick * hot);
        this.energy = Math.max(0, this.energy - dt * 0.048 * drain);
      }
      // stamina
      const maxSt = this.has('infection') ? 60 : this.has('sick') ? 55 : 100, need = Math.min(this.hunger, this.thirst);
      if (this.stamina < maxSt) this.stamina = Math.min(maxSt, this.stamina + dt * (need > 20 ? 13 : 6) * (this.temp < -55 ? 0.5 : 1) * (this.energy < 12 ? 0.5 : 1)); else this.stamina = Math.min(this.stamina, maxSt + 0.01);
      if (this.stamina < 0) this.stamina = 0;
      // air
      this.airMax = this.airCapacity(); const tank = eq.back && G.ITEMS[eq.back.id].air ? eq.back : null;
      if (this.headUnder) {
        if (tank && tank.air > 0) tank.air = Math.max(0, tank.air - dt); else this.air -= dt;
        if (this.air <= 0) { this.air = 0; this.damage(9 * dt, 'drowning', { silent: true }); this.drownT = (this.drownT || 0) + dt; if (this.drownT > 1.2) { this.drownT = 0; G.audio.sfx('choke'); } }
        G.skills.xp('diving', dt * 0.35);
        const limit = (eq.back && G.ITEMS[eq.back.id].deep) ? 400 : eq.body && eq.body.id === 'wetsuit' ? 52 : 34;
        if (this.depth > limit) { this.damage((this.depth - limit) * 0.12 * dt + 0.6 * dt, 'the crushing depth', { silent: true }); this.pressT = (this.pressT || 0) + dt; if (this.pressT > 4) { this.pressT = 0; G.ui.toast('The pressure is crushing you. You need better dive gear to go this deep.', 'bad'); G.audio.sfx('creak'); } }
      } else this.air = Math.min(this.airMax, this.air + dt * this.airMax / 2.5);
      // exposure
      const st = this.parent; this.shaded = false; this.nearFire = false;
      if (st) { const T = G.structs.T, ix = Math.round(this.local.x / T), iz = Math.round(this.local.z / T), lv = Math.round((this.local.y - st.floorY(0)) / G.structs.LH); this.shaded = st.roofs.has(st.key(ix, iz, lv)) || st.hasFloor(ix, iz, lv + 1); }
      G.structs.nearbyItems(this.pos.x, this.pos.z, 3.2, (it) => { if ((it.type === 'campfire' || it.type === 'grill' || it.type === 'furnace') && it.s.burn > 0) this.nearFire = true; });
      const held = G.inv.held(); if (held && held.id === 'torch') this.torch = true; else this.torch = false;
      const inWater = this.swimming || G.ocean.height(this.pos.x, this.pos.z) - this.pos.y > 0.6;
      if (inWater) this.wet = 1; else if (W.rain > 0.15 && !this.shaded && !this.gear('body', 'rainproof', 0)) this.wet = Math.min(0.8, this.wet + dt * 0.03 * W.rain);
      else this.wet = Math.max(0, this.wet - dt * (0.012 + (this.nearFire ? 0.06 : 0) + G.sky.dayLight * 0.012));
      const sun = G.sky.sunVis * (this.shaded ? 0 : 1) * (eq.head ? this.gear('head', 'shade', 0.45) : 1) * (inWater ? 0.4 : 1);
      let feels = W.temp + sun * 7 - this.wet * (5 + W.wind * 5) * this.gear('body', 'warm', 1) + (this.nearFire ? 9 : 0) + (this.torch ? 2 : 0) + (this.shaded ? 1.5 * (W.temp < 24 ? 1 : -1) : 0);
      if (inWater && this.headUnder) feels -= Math.min(12, this.depth * 0.28) * (eq.body && eq.body.id === 'wetsuit' ? 0.2 : 1);
      this.feels = feels; const tt = feels > 31 ? (feels - 31) * 16 : feels < 20 ? (feels - 20) * 13 : 0;
      this.temp = G.damp(this.temp, G.clamp(tt, -100, 100), 0.05, dt);
      if (this.temp > 85) this.damage(0.45 * dt, 'heatstroke', { silent: true }); if (this.temp < -85) this.damage(0.45 * dt, 'hypothermia', { silent: true });
      if (sun > 0.75 && G.game.difficulty !== 'relaxed') { this.sunT += dt; if (this.sunT > 420) { this.sunT = 0; this.afflict('sunburn', 200); } } else this.sunT = Math.max(0, this.sunT - dt * 2);
      // health
      let dh = 0;
      if (this.hunger <= 0) dh -= 0.3; if (this.thirst <= 0) dh -= 0.45;
      if (this.has('bleeding')) dh -= 0.55; if (this.has('poison')) dh -= 0.5; if (this.has('infection')) dh -= 0.12; if (this.has('sunburn')) dh -= 0.04;
      if (dh === 0 && this.hunger > 35 && this.thirst > 35 && this.hp < 100) dh += 0.22 * (this.energy > 30 ? 1 : 0.5) / sv;
      if (dh < 0) this.damage(-dh * dt / D.dmg * Math.sqrt(D.dmg), this.hunger <= 0 ? 'starvation' : this.thirst <= 0 ? 'dehydration' : 'your wounds', { silent: true }); else this.heal(dh * dt);
      // warnings
      this.warnT = (this.warnT || 0) + dt;
      if (this.warnT > 45) { this.warnT = 0; if (this.thirst < 18) G.ui.toast('You are badly dehydrated. Find fresh water.', 'bad'); else if (this.hunger < 18) G.ui.toast('You are starving. Eat something.', 'bad'); else if (this.energy < 12) G.ui.toast('You are exhausted. You need to sleep.', 'bad'); else if (this.temp > 60) G.ui.toast('You are overheating. Find shade or get in the water.', 'bad'); else if (this.temp < -60) G.ui.toast('You are freezing. Dry off and get near a fire.', 'bad'); }
    },

    serialize() { return { p: [this.pos.x, this.pos.y, this.pos.z], yaw: this.yaw, pitch: this.pitch, hp: this.hp, hunger: this.hunger, thirst: this.thirst, stamina: this.stamina, energy: this.energy, temp: this.temp, wet: this.wet, cond: this.cond, spawn: this.spawn, onRaft: this.parent ? G.structs.list.indexOf(this.parent) : -1, local: [this.local.x, this.local.y, this.local.z] }; },
    deserialize(d) {
      this.reset(d.p[0], d.p[1], d.p[2]); this.yaw = d.yaw; this.pitch = d.pitch; for (const k of ['hp', 'hunger', 'thirst', 'stamina', 'energy', 'temp', 'wet']) if (d[k] != null) this[k] = d[k];
      this.cond = d.cond || {}; this.spawn = d.spawn || null;
      if (d.onRaft >= 0 && G.structs.list[d.onRaft]) { this.parent = G.structs.list[d.onRaft]; this.local.set(d.local[0], d.local[1], d.local[2]); this.onGround = true; }
    }
  };
})();
