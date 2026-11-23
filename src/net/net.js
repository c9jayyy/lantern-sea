// Two-player online co-op. One player hosts (their world is the shared world and the only one that is saved); the
// partner joins with a six-letter code. Peers connect directly over WebRTC (PeerJS); the public PeerJS server is only
// used to introduce the two browsers. What is shared: both players (with a visible avatar), the raft's position and its
// controls, everything built (structures, equipment, chest contents), harvested trees/rocks, time of day, weather, chat.
// Each player keeps their own inventory; floating debris, fish and animals are simulated separately on each side.
import Peer from 'peerjs';

(function () {
  const G = window.G;
  const PREFIX = 'lantern-sea-coop-';
  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const _v = new THREE.Vector3();

  const N = G.net = {
    role: null, peer: null, conn: null, code: '', status: '', partner: null, applying: false, typing: false,
    name: (() => { try { return localStorage.getItem('ls-coop-name') || ''; } catch (e) { return ''; } })(),
    sigs: [], hostCtl: [], pending: [], tgt: [], t: { p: 0, w: 0, s: 0, c: 0 },

    setName(n) { this.name = String(n || '').trim().slice(0, 18) || 'Castaway'; try { localStorage.setItem('ls-coop-name', this.name); } catch (e) { /* private mode */ } },
    connected() { return !!(this.conn && this.conn.open); },
    say(s, kind) { this.status = s; G.emit('coopStatus', s); if (kind) G.ui.toast(s, kind === 'info' ? undefined : kind); if (G.ui.cur && (G.ui.cur.name === 'coop' || G.ui.cur.name === 'join')) G.ui.refresh(); },

    // ---------- connecting ----------
    host() {
      if (this.peer) return; this.role = 'host'; this.code = Array.from({ length: 6 }, () => ALPH[Math.floor(Math.random() * ALPH.length)]).join('');
      this.peer = new Peer(PREFIX + this.code.toLowerCase());
      this.peer.on('open', () => this.say('Waiting for your partner. Give them the code.'));
      this.peer.on('connection', (c) => { if (this.conn) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); }); return; } this.wire(c); c.on('open', () => this.welcome()); });
      this.peer.on('error', (e) => { if (e.type === 'unavailable-id') { this.stop(true); this.host(); return; } this.say('Connection problem: ' + (e.type || e.message), 'bad'); });
    },
    join(code) {
      code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (code.length !== 6) return this.say('The code has six letters and numbers.', 'bad');
      this.stop(true); this.role = 'guest'; this.code = code; this.say('Finding your partner…');
      this.peer = new Peer();
      this.peer.on('open', () => { const c = this.peer.connect(PREFIX + code.toLowerCase(), { reliable: true }); this.wire(c); c.on('open', () => { this.say('Connected. Receiving the world…'); c.send({ t: 'hello', name: this.name }); }); });
      this.peer.on('error', (e) => this.say(e.type === 'peer-unavailable' ? 'No game is waiting with that code. Check it, and that your partner has the invite open.' : 'Connection problem: ' + (e.type || e.message), 'bad'));
      setTimeout(() => { if (this.role === 'guest' && !this.connected()) this.say('Still trying… If this takes long, one of your networks may block direct connections.'); }, 12000);
    },
    wire(c) {
      this.conn = c;
      c.on('data', (m) => { try { this.recv(m); } catch (e) { console.error('[coop]', e); } });
      c.on('close', () => this.lost());
      c.on('error', (e) => console.warn('[coop] channel', e));
    },
    lost() {
      const was = this.role, had = !!this.partner; this.conn = null; this.partner = null; this.hideAvatar();
      if (was === 'guest') { this.stop(true); if (G.state === 'play' || G.state === 'paused') { G.game.quitToMenu(); G.ui.toast('The connection to your partner closed. Their world is saved on their computer.', 'bad'); } }
      else if (had) this.say('Your partner left. You can keep playing; open the invite again for them to rejoin.', 'info');
    },
    stop(quiet) {
      if (this.conn) { try { this.conn.send({ t: 'bye' }); } catch (e) { /* closing */ } try { this.conn.close(); } catch (e) { /* closing */ } }
      if (this.peer) { try { this.peer.destroy(); } catch (e) { /* closing */ } }
      this.peer = null; this.conn = null; this.partner = null; this.role = null; this.code = ''; this.sigs = []; this.hostCtl = []; this.pending = []; this.tgt = []; this.hideAvatar();
      if (!quiet) this.say('Not connected.');
    },
    send(m) { if (this.connected()) try { this.conn.send(m); } catch (e) { console.warn('[coop] send', e); } },

    // ---------- the host hands over its world ----------
    welcome() {
      const P = G.player, st = P.parent ? G.structs.list.indexOf(P.parent) : -1;
      this.send({ t: 'welcome', name: this.name, save: JSON.parse(JSON.stringify(G.game.serialize())), at: { st, lx: P.local.x, ly: P.local.y, lz: P.local.z, x: P.pos.x, y: P.pos.y, z: P.pos.z } });
      this.sigs = G.structs.list.map((s) => this.sig(s));
    },
    joinWorld(d, at) {
      const g = G.game;
      return g.begin('Joining your partner…').then(() => {
        g.resetAll(); g.slot = 1; g.name = d.name; g.seedText = d.seedText; g.seed = d.seed; g.difficulty = G.DIFF[d.difficulty] ? d.difficulty : 'standard'; g.flags = d.flags || {}; g.rep = d.rep || 0; g.trade = d.trade || {}; g.treasure = null; g.playtime = 0;
        G.world.generate(g.seed); G.world.deserialize(d.world); G.time.deserialize(d.time); G.wsim.reset(g.seed); if (d.weather) G.wsim.deserialize(d.weather); G.wsim.until = 1e12;
        G.structs.deserialize(d.structs); for (const s of G.structs.list) s.update(0.016); G.vehicles.deserialize(d.vehicles);
        const P = G.player, I = G.inv; P.reset(at.x + 1, at.y, at.z + 1);
        I.add('hook', 1, null, true); I.add('ration', 3, null, true); I.add('bottle', 1, null, true); I.add('rope', 2, null, true); I.add('compass', 1, null, true);
        const s = at.st >= 0 && G.structs.list[at.st];
        if (s) { P.parent = s; P.local.set(at.lx + 0.7, at.ly, at.lz + 0.5); s.toWorld(P.local.x, P.local.y, P.local.z, P.pos); P.onGround = true; }
        G.map.reveal(P.pos.x, P.pos.z, 300); this.sigs = G.structs.list.map((x) => this.sig(x));
        return g.enter();
      }).then(() => { G.quests.start('m1'); G.ui.toast('You are on ' + (this.partner ? this.partner.name : 'your partner') + '’s raft. Their game keeps the world saved.', 'good'); }).catch((e) => { g.fail(e); this.stop(true); });
    },

    // ---------- messages ----------
    recv(m) {
      if (!m || !m.t) return;
      switch (m.t) {
        case 'hello': this.partner = { name: m.name || 'Partner' }; if (G.state === 'paused') G.state = 'play'; this.say(this.partner.name + ' joined your game.', 'good'); break;   // a shared world never stands still
        case 'welcome': this.partner = { name: m.name || 'Partner' }; this.joinWorld(m.save, m.at); break;
        case 'full': this.say('That game already has two players.', 'bad'); this.stop(true); break;
        case 'p': this.partnerState(m); break;
        case 'w': this.worldTick(m); break;
        case 'st': this.applyStruct(m.i, m.d); break;
        case 'ctl': { const s = G.structs.list[m.i]; if (s) { if (m.sailOpen != null) s.sailOpen = m.sailOpen; if (m.anchored != null) s.anchored = m.anchored; if (m.steer != null) s.steer = m.steer; if (m.throttle != null) s.throttle = m.throttle; } break; }
        case 'pad': { const s = G.structs.list[m.i]; if (s) { s.paddle.x = G.clamp(s.paddle.x + m.x, -3.2, 3.2); s.paddle.y = G.clamp(s.paddle.y + m.y, -3.2, 3.2); G.fx.splash(m.px, s.pos.y + 0.1, m.pz, 6); } break; }
        case 'node': { const I = G.world.islands.find((x) => x.id === m.I); if (!I) break; const n = G.world.planNodes(I)[m.n]; if (n && n.alive) { this.applying = true; try { G.world.removeNode(I, n); } finally { this.applying = false; } } break; }
        case 'chat': G.ui.toast((this.partner ? this.partner.name : 'Partner') + ': ' + String(m.m).slice(0, 200)); G.audio.sfx('click'); break;
        case 'bye': this.lost(); break;
      }
    },
    partnerState(m) {
      if (!this.partner) this.partner = { name: m.name || 'Partner' };
      const p = this.partner; p.name = m.name || p.name; p.s = m; p.seen = performance.now(); this.showAvatar();
    },
    worldTick(m) {
      if (this.role !== 'guest') return;
      G.time.hour = m.hour; G.time.day = m.day; Object.assign(G.weather, m.wx); G.wsim.cur = m.cur || G.wsim.cur; G.wsim.until = 1e12;
      const now = performance.now();
      m.s.forEach((x, i) => { const s = G.structs.list[i]; if (!s) return; this.tgt[i] = x; const pd = this.pending[i] || {}, hc = this.hostCtl[i] = this.hostCtl[i] || {};
        for (const k of ['sailOpen', 'anchored']) { hc[k] = x[k]; if (!(pd[k] && now - pd[k] < 1500)) s[k] = x[k]; } });
    },

    // ---------- structures: whoever changes one sends it whole ----------
    sig(s) { const items = []; for (const [k, it] of s.items) items.push(k + it.type + it.rot + (it.s && it.s.c ? JSON.stringify(it.s.c) : '')); return JSON.stringify([s.kind, [...s.tiles].map(([k, t]) => k + t.type + Math.round(t.hp / 10)), [...s.walls].map(([k, w]) => k + w.type + (w.open ? 1 : 0)), [...s.stairs].map(([k, x]) => k + x.dir), [...s.roofs.keys()], items]); },
    applyStruct(i, d) {
      let s = G.structs.list[i]; if (!s) { while (G.structs.list.length < i) G.structs.create('ground', d.x, d.y, d.z, d.yaw); s = G.structs.create(d.kind, d.x, d.y, d.z, d.yaw); }
      s.tiles.clear(); for (const [k, type, hp] of d.tiles) { const def = G.BUILD[type]; if (def) s.tiles.set(k, { type, hp, max: def.hp }); }
      s.walls.clear(); for (const [k, type, open] of d.walls) if (G.BUILD[type]) s.walls.set(k, { type, open: !!open });
      s.stairs.clear(); for (const [k, dir] of d.stairs) s.stairs.set(k, { dir }); s.roofs.clear(); for (const k of d.roofs) s.roofs.set(k, { type: 'roof' });
      const keep = new Set(d.items.map((x) => x.k));
      for (const k of [...s.items.keys()]) { const it = s.items.get(k), nd = d.items.find((x) => x.k === k); if (!keep.has(k) || !nd || nd.type !== it.type || nd.rot !== it.rot) s.removeItem(k); }
      for (const it of d.items) { if (!G.BUILD[it.type]) continue; const cur = s.items.get(it.k); if (cur) { if (it.s && it.s.c && cur.s) cur.s.c = it.s.c; continue; } const [ix, iz, lv] = it.k.split(',').map(Number); s.addItem(ix, iz, lv, it.type, it.rot, it.s); }
      s.rebuild(); for (const it of s.items.values()) G.items.refresh && G.items.refresh(it);
      this.sigs[i] = this.sig(s);
      if (G.ui.cur && G.ui.cur.name === 'storage') G.ui.refresh();
    },

    // ---------- per frame ----------
    preUpdate() { if (this.typing) G.input.clear(); },
    update(dt) {
      if (!this.connected() || (G.state !== 'play' && G.state !== 'paused')) { this.updateAvatar(dt); return; }
      const T = this.t, P = G.player, L = G.structs.list;
      T.p -= dt; if (T.p <= 0) { T.p = 0.1; const held = G.inv.held(), st = P.parent ? L.indexOf(P.parent) : -1;
        this.send({ t: 'p', name: this.name, x: +P.pos.x.toFixed(3), y: +P.pos.y.toFixed(3), z: +P.pos.z.toFixed(3), yaw: +P.yaw.toFixed(3), pitch: +P.pitch.toFixed(3), st, lx: +P.local.x.toFixed(3), ly: +P.local.y.toFixed(3), lz: +P.local.z.toFixed(3), sw: !!(P.swimming || P.headUnder), held: held ? held.id : null, swing: G.actions.swP != null ? 1 : 0, alive: P.alive, mode: P.mode, look: this.look }); }
      if (this.role === 'host') { T.w -= dt; if (T.w <= 0) { T.w = 0.25; this.send({ t: 'w', hour: G.time.hour, day: G.time.day, cur: G.wsim.cur, wx: { cloud: G.weather.cloud, rain: G.weather.rain, fog: G.weather.fog, wind: G.weather.wind, windDir: G.weather.windDir, sea: G.weather.sea, storm: G.weather.storm, type: G.weather.type, temp: G.weather.temp }, s: L.map((s) => ({ x: s.pos.x, y: s.pos.y, z: s.pos.z, yaw: s.yaw, vx: s.vel.x, vz: s.vel.y, yv: s.yawVel, sailOpen: s.sailOpen, anchored: s.anchored })) }); } }
      T.s -= dt; if (T.s <= 0) { T.s = 0.5; L.forEach((s, i) => { const g = this.sig(s); if (g !== this.sigs[i]) { this.sigs[i] = g; this.send({ t: 'st', i, d: s.serialize() }); } }); }
      if (this.role === 'guest') {
        // follow the host's raft; changes made here to sail, anchor or helm go to the host
        const now = performance.now(), k = Math.min(1, dt * 4);
        L.forEach((s, i) => { const x = this.tgt[i]; if (!x) return; const d = Math.hypot(x.x - s.pos.x, x.z - s.pos.z);
          if (d > 6) { s.pos.x = x.x; s.pos.z = x.z; s.yaw = x.yaw; } else { s.pos.x += (x.x - s.pos.x) * k; s.pos.z += (x.z - s.pos.z) * k; s.yaw += G.angDiff(s.yaw, x.yaw) * k; }
          s.vel.set(x.vx, x.vz); s.yawVel = x.yv; s.cos = Math.cos(s.yaw); s.sin = Math.sin(s.yaw);
          const hc = this.hostCtl[i] || {}, pd = this.pending[i] = this.pending[i] || {}, msg = {};
          for (const f of ['sailOpen', 'anchored']) if (hc[f] != null && s[f] !== hc[f] && !(pd[f] && now - pd[f] < 1500)) { pd[f] = now; msg[f] = s[f]; }
          if (P.mode === 'helm' && P.parent === s) { msg.steer = s.steer; msg.throttle = s.throttle; }
          if (Object.keys(msg).length) { T.c -= dt; if (T.c <= 0 || msg.sailOpen != null || msg.anchored != null) { T.c = 0.1; msg.t = 'ctl'; msg.i = i; this.send(msg); } }
        });
      }
      this.updateAvatar(dt);
    },

    // ---------- the partner's body ----------
    showAvatar() { const lk = this.partner && this.partner.s && this.partner.s.look; if (this.av && lk && this.av.look !== JSON.stringify(lk)) { G.disposeGroup(this.av.root); this.av = null; } if (!this.av) this.av = makeAvatar(lk); this.av.root.visible = true; },
    hideAvatar() { if (this.av) this.av.root.visible = false; },
    updateAvatar(dt) {
      const p = this.partner, A = this.av; if (!A || !p || !p.s) return; const m = p.s;
      if (!this.connected() || performance.now() - p.seen > 5000) { A.root.visible = false; return; } A.root.visible = G.state === 'play' || G.state === 'paused';
      const s = m.st >= 0 && G.structs.list[m.st]; if (s) s.toWorld(m.lx, m.ly, m.lz, _v); else _v.set(m.x, m.y, m.z);
      const r = A.root, k = Math.min(1, dt * 12), ox = r.position.x, oz = r.position.z;
      if (r.position.distanceTo(_v) > 8) r.position.copy(_v); else r.position.lerp(_v, k);
      r.rotation.y += G.angDiff(r.rotation.y, m.yaw) * k;
      const spd = Math.hypot(r.position.x - ox, r.position.z - oz) / Math.max(dt, 1e-3); A.speed = G.damp(A.speed || 0, spd, 8, dt);
      const sw = m.sw, walk = Math.min(1, A.speed / 2.2), t = performance.now() / 1000; A.ph = (A.ph || 0) + dt * (sw ? 3.2 : 1.6 + A.speed * 2.8);
      // body: upright when standing, laid out for swimming; a little bob and lean while walking
      A.body.rotation.x = G.damp(A.body.rotation.x, sw ? 1.35 : walk * 0.06, 4, dt); A.body.position.y = G.damp(A.body.position.y, sw ? 0.9 : Math.abs(Math.sin(A.ph)) * 0.03 * walk, 6, dt);
      A.torso.scale.x = 1 + Math.sin(t * 1.6) * 0.012; A.torso.scale.z = 0.62 * (1 + Math.sin(t * 1.6) * 0.02);
      const ph = A.ph, a = Math.sin(ph);
      if (sw) {   // front crawl with a flutter kick
        A.legL.top.rotation.x = Math.sin(ph * 2.2) * 0.35; A.legR.top.rotation.x = -Math.sin(ph * 2.2) * 0.35; A.legL.mid.rotation.x = A.legR.mid.rotation.x = 0.25;
        A.armL.top.rotation.x = -Math.PI + ((ph % (2 * Math.PI)) / Math.PI) * Math.PI * 0.95; A.armR.top.rotation.x = -Math.PI + (((ph + Math.PI) % (2 * Math.PI)) / Math.PI) * Math.PI * 0.95; A.armL.mid.rotation.x = A.armR.mid.rotation.x = -0.3;
        A.armL.top.rotation.z = -0.15; A.armR.top.rotation.z = 0.15;
      } else {   // walking: legs swing from the hip and fold at the knee on the back swing; arms swing opposite, elbows soft
        A.legL.top.rotation.x = -a * 0.55 * walk; A.legR.top.rotation.x = a * 0.55 * walk;
        A.legL.mid.rotation.x = Math.max(0, a) * 0.95 * walk + 0.04; A.legR.mid.rotation.x = Math.max(0, -a) * 0.95 * walk + 0.04;
        A.armL.top.rotation.x = a * 0.5 * walk + Math.sin(t * 1.6) * 0.02; A.armL.mid.rotation.x = -0.25 - walk * 0.2; A.armL.top.rotation.z = -0.08;
        if (m.swing) { A.swT = 0.45; }
        if (A.swT > 0) { A.swT -= dt; const q = 1 - A.swT / 0.45, up = q < 0.4 ? q / 0.4 : 1 - (q - 0.4) / 0.6; A.armR.top.rotation.x = -2.4 * up + 0.4 * (1 - up); A.armR.mid.rotation.x = -0.6 * up; }
        else { A.armR.top.rotation.x = A.held ? -0.55 : -a * 0.5 * walk; A.armR.mid.rotation.x = A.held ? -0.9 : -0.25 - walk * 0.2; }
        A.armR.top.rotation.z = 0.08;
      }
      A.head.rotation.x = G.clamp(-m.pitch * 0.7, -0.5, 0.5);
      if (A.heldId !== m.held) { A.heldId = m.held; if (A.held) { G.disposeGroup(A.held); A.held = null; } const def = m.held && G.ITEMS[m.held]; if (def && def.tool && G.HAND[def.tool.type]) { const b = new G.MB(); G.HAND[def.tool.type](b, def.tool.tier > 0); A.held = b.build(); A.held.position.set(0, -0.05, -0.01); A.held.rotation.set(-Math.PI / 2, 0, 0); A.armR.end.add(A.held); } }
      A.tag.material.opacity = A.root.position.distanceTo(G.camera.position) < 60 ? 0.95 : 0;
      if (A.tagName !== p.name) { A.tagName = p.name; drawTag(A.tag, p.name); }
    },

    // ---------- chat ----------
    openChat() {
      if (this.typing || !this.connected()) return; this.typing = true; G.input.clear();
      const box = G.el('div', '', ''); box.id = 'chatbox'; const inp = document.createElement('input'); inp.type = 'text'; inp.maxLength = 160; inp.placeholder = 'Say something to ' + (this.partner ? this.partner.name : 'your partner') + '…  (Enter to send, Esc to cancel)'; box.appendChild(inp); G.ui.root.appendChild(box);
      setTimeout(() => inp.focus(), 0);
      const done = (sendIt) => { const t = inp.value.trim(); if (sendIt && t) { this.send({ t: 'chat', m: t }); G.ui.toast('You: ' + t); } box.remove(); this.typing = false; G.input.clear(); };
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.code === 'Enter' || e.code === 'NumpadEnter') done(true); else if (e.code === 'Escape') done(false); });
    }
  };

  // ---------- partner avatar: a castaway with a shaped body, face, hair, clothes and jointed limbs ----------
  const LOOKS = { shirt: ['#3d5f86', '#b8463a', '#e6dfcf', '#4f6b3a', '#d49a3a', '#6a4a7a'], skin: ['#e8b896', '#c8926c', '#9a6a48', '#6a4630'] };
  N.LOOKS = LOOKS;
  N.look = (() => { try { return JSON.parse(localStorage.getItem('ls-coop-look')) || { shirt: 0, hair: 'short', skin: 1 }; } catch (e) { return { shirt: 0, hair: 'short', skin: 1 }; } })();
  N.setLook = (o) => { Object.assign(N.look, o); try { localStorage.setItem('ls-coop-look', JSON.stringify(N.look)); } catch (e) { /* private mode */ } };
  function makeAvatar(look) {
    look = look || { shirt: 0, hair: 'short', skin: 1 };
    const T = G.tex || {}, cloth = T.cloth || {}, mat = (hex, o) => new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: 0.9 }, o || {}));
    const skin = G.mats.skin.clone(); skin.color = new THREE.Color(LOOKS.skin[look.skin] || LOOKS.skin[1]); skin.map = null;
    const shirt = mat(LOOKS.shirt[look.shirt] || LOOKS.shirt[0], { map: cloth.map || null, normalMap: cloth.normalMap || null }), shorts = mat('#5a5040', { map: cloth.map || null, normalMap: cloth.normalMap || null });
    const hairM = mat(look.hair === 'long' ? '#3a2416' : '#1c1612', { roughness: 0.75 }), dark = mat('#0c0a09', { roughness: 0.3 }), white = mat('#f2efe8', { roughness: 0.3 }), sole = mat('#5a4030');
    const mesh = (g, m, x, y, z, rx, ry, rz) => { const o = new THREE.Mesh(g, m); o.position.set(x || 0, y || 0, z || 0); o.rotation.set(rx || 0, ry || 0, rz || 0); o.castShadow = true; o.receiveShadow = true; return o; };
    const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg || 24);
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    // torso: chest, waist and hips from a turned profile, flattened front to back; shorts over the hips
    const torso = mesh(lathe([[0.001, 0.9], [0.155, 0.92], [0.15, 1.0], [0.135, 1.07], [0.15, 1.2], [0.172, 1.32], [0.19, 1.42], [0.16, 1.47], [0.07, 1.5], [0.001, 1.505]], 26), shirt); torso.scale.z = 0.62; body.add(torso);
    const hips = mesh(lathe([[0.001, 0.78], [0.13, 0.8], [0.165, 0.86], [0.16, 0.96], [0.001, 0.97]], 24), shorts); hips.scale.z = 0.7; body.add(hips);
    body.add(mesh(new THREE.CylinderGeometry(0.048, 0.056, 0.12, 14), skin, 0, 1.53, 0.005));
    // head: skull, jaw, nose, ears, eyes and brows, then hair
    const head = new THREE.Group(); head.position.set(0, 1.6, 0); body.add(head);
    const skull = mesh(new THREE.SphereGeometry(0.1, 24, 18), skin, 0, 0.08, 0); skull.scale.set(0.88, 1.08, 0.98); head.add(skull);
    const jaw = mesh(new THREE.SphereGeometry(0.075, 18, 12), skin, 0, 0.02, -0.018); jaw.scale.set(0.95, 0.85, 1); head.add(jaw);
    head.add(mesh(new THREE.ConeGeometry(0.016, 0.04, 8), skin, 0, 0.07, -0.1, -1.35));
    for (const sx of [-1, 1]) { const ear = mesh(new THREE.SphereGeometry(0.022, 10, 8), skin, sx * 0.087, 0.075, 0.005); ear.scale.set(0.45, 1.1, 0.8); head.add(ear);
      head.add(mesh(new THREE.SphereGeometry(0.011, 10, 8), white, sx * 0.033, 0.098, -0.082)); head.add(mesh(new THREE.SphereGeometry(0.0062, 8, 6), dark, sx * 0.033, 0.098, -0.091));
      const brow = mesh(new THREE.BoxGeometry(0.03, 0.006, 0.01), hairM, sx * 0.033, 0.118, -0.088, 0, 0, sx * -0.12); head.add(brow); }
    head.add(mesh(new THREE.BoxGeometry(0.034, 0.005, 0.008), mat('#8a4a40'), 0, 0.035, -0.088));
    const cap = mesh(new THREE.SphereGeometry(0.106, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM, 0, 0.09, 0.008); cap.scale.set(0.92, 1.1, 1.02); cap.rotation.x = 0.25; head.add(cap);
    if (look.hair === 'long') { const fall = mesh(lathe([[0.001, -0.2], [0.07, -0.17], [0.09, -0.05], [0.097, 0.06], [0.06, 0.12], [0.001, 0.13]], 18), hairM, 0, 0.02, 0.03); fall.scale.set(1.0, 1, 0.75); head.add(fall); }
    // limbs: each a shoulder/hip pivot with an elbow/knee pivot inside, so they bend
    const capsule = (r, len, m) => { const g = new THREE.CapsuleGeometry(r, len, 6, 14); g.translate(0, -len / 2 - r * 0.2, 0); return mesh(g, m); };
    const limb = (x, y, r0, l0, r1, l1, sleeveM, sleeveLen) => {
      const top = new THREE.Group(); top.position.set(x, y, 0); body.add(top);
      top.add(capsule(r0, l0, skin)); if (sleeveM) { const sl = mesh(new THREE.CylinderGeometry(r0 * 1.32, r0 * 1.22, sleeveLen, 16, 1, true), sleeveM, 0, -sleeveLen / 2 + 0.02, 0); sl.material = sleeveM.clone(); sl.material.side = THREE.DoubleSide; top.add(sl); }
      const mid = new THREE.Group(); mid.position.set(0, -l0 - r0 * 0.4, 0); top.add(mid); mid.add(capsule(r1, l1, skin));
      const end = new THREE.Group(); end.position.set(0, -l1 - r1 * 0.5, 0); mid.add(end); return { top, mid, end };
    };
    const armL = limb(-0.205, 1.42, 0.043, 0.24, 0.036, 0.22, shirt, 0.15), armR = limb(0.205, 1.42, 0.043, 0.24, 0.036, 0.22, shirt, 0.15);
    for (const a of [armL, armR]) { const hand = mesh(new THREE.CapsuleGeometry(0.03, 0.05, 4, 10), skin, 0, -0.05, 0); hand.scale.set(0.75, 1, 0.48); a.end.add(hand); a.end.add(mesh(new THREE.CapsuleGeometry(0.011, 0.03, 3, 8), skin, 0.022 * (a === armL ? 1 : -1), -0.02, -0.02, -0.5, 0, 0)); }
    const legL = limb(-0.088, 0.88, 0.068, 0.36, 0.052, 0.37, shorts, 0.22), legR = limb(0.088, 0.88, 0.068, 0.36, 0.052, 0.37, shorts, 0.22);
    for (const l of [legL, legR]) { const foot = mesh(new THREE.CapsuleGeometry(0.04, 0.13, 4, 10), skin, 0, -0.02, -0.05, Math.PI / 2, 0, 0); foot.scale.set(0.95, 1, 0.6); l.end.add(foot); l.end.add(mesh(new THREE.BoxGeometry(0.085, 0.012, 0.22), sole, 0, -0.045, -0.05)); }
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(document.createElement('canvas')), transparent: true, depthTest: false, opacity: 0.95 })); tag.position.set(0, 2.0, 0); tag.scale.set(0.9, 0.225, 1); tag.renderOrder = 20; tag.layers.set(1); root.add(tag);
    G.scene.add(root); return { root, body, head, armL, armR, legL, legR, tag, torso, look: JSON.stringify(look) };
  }
  function drawTag(sp, name) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.font = '600 30px Segoe UI, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = Math.min(250, g.measureText(name).width + 28); g.fillStyle = 'rgba(8,11,14,0.6)'; g.beginPath(); g.roundRect ? g.roundRect(128 - w / 2, 10, w, 44, 22) : g.rect(128 - w / 2, 10, w, 44); g.fill(); g.fillStyle = '#fff'; g.fillText(name, 128, 33);
    sp.material.map.dispose(); sp.material.map = new THREE.CanvasTexture(c); sp.material.map.colorSpace = THREE.SRGBColorSpace; sp.material.needsUpdate = true;
  }

  // share harvested trees and rocks; forward paddle strokes; open chat on Enter
  const W = G.world, rm = W.removeNode;
  W.removeNode = function (I, n) { rm.call(this, I, n); if (N.connected() && !N.applying) N.send({ t: 'node', I: I.id, n: n.id }); };
  G.on('paddle', (st, dx, dz, px, pz) => { if (N.role === 'guest' && st) N.send({ t: 'pad', i: G.structs.list.indexOf(st), x: dx, y: dz, px, pz }); });
  window.addEventListener('keydown', (e) => { if ((e.code === 'Enter' || e.code === 'NumpadEnter') && N.connected() && G.state === 'play' && !G.ui.cur && !N.typing) { e.preventDefault(); N.openChat(); } });
  window.addEventListener('beforeunload', () => N.stop(true));
})();
