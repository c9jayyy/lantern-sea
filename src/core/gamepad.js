'use strict';
/* Controllers. Any pad the browser exposes through the Gamepad API (Xbox, PlayStation, Switch Pro, generic) in the
   standard mapping. In play, buttons drive the same actions as the keyboard (they press the bound key), the left stick
   walks, the right stick looks, the triggers are the mouse buttons and the bumpers step through the hotbar. In menus the
   D-pad or left stick moves a highlight between buttons, slots and tabs, A selects, B goes back, X moves a stack, Y
   splits it, the bumpers change tab and the right stick scrolls. Every button can be rebound in Settings → Controls. */
(function () {
  const G = window.G;
  // actions a button can carry: the keyboard actions (except walking, which is the stick) plus the mouse and hotbar
  G.padActionNames = Object.assign({ use: 'Use tool / attack / place (primary)', alt: 'Eat, drink, use item (secondary)', prev: 'Previous hotbar slot', next: 'Next hotbar slot', pause: 'Pause menu' },
    Object.fromEntries(Object.entries(G.bindingNames).filter(([k]) => !['forward', 'back', 'left', 'right'].includes(k))));
  G.defaultPadBindings = { jump: 0, crouch: 1, interact: 2, inventory: 3, prev: 4, next: 5, alt: 6, use: 7, map: 8, pause: 9, sprint: 10, light: 11, craft: 12, drop: 13, build: 14, rotate: 15, demolish: -1, journal: -1, photo: -1, quicksave: -1, help: -1 };
  Object.assign(G.settings, Object.assign({ padSens: 1.0, padInvert: false, padDead: 0.16, padVibe: true }, G.settings), { padBindings: Object.assign({}, G.defaultPadBindings, G.settings.padBindings || {}) });
  { const ld = G.loadSettings; G.loadSettings = function () { ld(); G.settings.padBindings = Object.assign({}, G.defaultPadBindings, G.settings.padBindings || {}); for (const [k, v] of Object.entries({ padSens: 1.0, padInvert: false, padDead: 0.16, padVibe: true })) if (G.settings[k] == null) G.settings[k] = v; }; }

  const NAMES = {
    xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L-stick click', 'R-stick click', 'D-pad up', 'D-pad down', 'D-pad left', 'D-pad right', 'Xbox'],
    ps: ['Cross', 'Circle', 'Square', 'Triangle', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3', 'D-pad up', 'D-pad down', 'D-pad left', 'D-pad right', 'PS'],
    nin: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'L-stick click', 'R-stick click', 'D-pad up', 'D-pad down', 'D-pad left', 'D-pad right', 'Home']
  };
  const I = G.input, FOCUSABLE = 'button:not([disabled]), .tab, .slot, .tile, .rc, input, select, .x, [data-pad]';
  const P = G.pad = {
    on: false, type: 'xbox', name: '', prev: [], held: {}, latchSprint: false, focus: null, rep: 0, repDir: '', rebind: null, scrollAcc: 0,
    label(i) { return i == null || i < 0 ? '—' : (NAMES[this.type][i] || 'Button ' + i); },
    pad() { const ps = navigator.getGamepads ? navigator.getGamepads() : []; for (const p of ps) if (p && p.connected && p.buttons.length >= 12) return p; return null; },
    // press / release a keyboard key exactly as if it were typed, so every listener sees it
    key(code, down) { if (!code) return; if (down === !!this.held[code]) return; this.held[code] = down; window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true })); },
    releaseAll() { for (const c in this.held) if (this.held[c]) this.key(c, false); if (I.mb[0]) { I.mb[0] = false; I.mreleased[0] = true; } if (I.mb[2]) { I.mb[2] = false; I.mreleased[2] = true; } this.latchSprint = false; },
    rumble(strong, weak, ms) { if (!this.on || !G.settings.padVibe) return; const p = this.pad(), a = p && p.vibrationActuator; if (a && a.playEffect) a.playEffect('dual-rumble', { duration: ms || 120, strongMagnitude: strong, weakMagnitude: weak }).catch(() => { }); },
    setOn(v) { if (v === this.on) return; this.on = v; document.body.classList.toggle('pad', v); if (!v) { this.releaseAll(); this.blur(); } G.emit('padmode', v); },

    poll(dt) {
      const p = this.pad(); if (!p) { if (this.on) this.setOn(false); this.prev = []; return; }
      const id = p.id.toLowerCase(); this.type = /054c|playstation|dualsense|dualshock|wireless controller/.test(id) ? 'ps' : /057e|nintendo|pro controller|joy-con/.test(id) ? 'nin' : 'xbox'; this.name = p.id;
      const S = G.settings, dz = S.padDead, B = p.buttons.map((b, i) => (i === 6 || i === 7) ? b.value > 0.35 : b.pressed), was = this.prev; this.prev = B;
      const edge = (i) => i >= 0 && B[i] && !was[i], ax = (v) => Math.abs(v) < dz ? 0 : Math.sign(v) * (Math.abs(v) - dz) / (1 - dz);
      let lx = ax(p.axes[0] || 0), ly = ax(p.axes[1] || 0), rx = ax(p.axes[2] || 0), ry = ax(p.axes[3] || 0); const lm = Math.hypot(lx, ly);
      if (B.some((b, i) => b && !was[i]) || lm > 0.4 || Math.hypot(rx, ry) > 0.4) this.setOn(true);
      if (!this.on) return;
      // waiting for a button to rebind in Settings
      if (this.rebind) { const i = B.findIndex((b, k) => b && !was[k]); if (i >= 0) { const cb = this.rebind; this.rebind = null; cb(i); } return; }
      const menu = G.state !== 'play' || !!G.ui.cur || !G.player.alive;
      if (menu) { if (Object.values(this.held).some(Boolean) || I.mb[0] || I.mb[2]) this.releaseAll(); this.menu(B, edge, lx, ly, ry, dt); return; }
      this.blur();
      const PB = S.padBindings, KB = S.bindings;
      if (G.photo) { this.key(KB.forward, ly < -0.3); this.key(KB.back, ly > 0.3); this.key(KB.left, lx < -0.3); this.key(KB.right, lx > 0.3); }
      // walking: the stick presses the movement keys; L3 latches sprint until the stick comes back
      this.key(KB.forward, ly < -0.3); this.key(KB.back, ly > 0.3); this.key(KB.left, lx < -0.38); this.key(KB.right, lx > 0.38);
      if (edge(PB.sprint)) this.latchSprint = !this.latchSprint; if (lm < 0.25) this.latchSprint = false; this.key(KB.sprint, this.latchSprint);
      // looking: response curve, faster when held at the rim
      const k = 1150 * S.padSens * dt, cx = (v) => Math.sign(v) * Math.pow(Math.abs(v), 1.7) * (Math.abs(v) > 0.95 ? 1.35 : 1);
      I.mdx += cx(rx) * k; I.mdy += cx(ry) * k * 0.78 * (S.padInvert ? -1 : 1);
      // buttons → actions
      for (const a in PB) {
        const i = PB[a]; if (i == null || i < 0 || a === 'sprint') continue; const on = !!B[i];
        if (a === 'use' || a === 'alt') { const m = a === 'use' ? 0 : 2; if (on && !I.mb[m]) I.mpressed[m] = true; if (!on && I.mb[m]) I.mreleased[m] = true; I.mb[m] = on; continue; }
        if (a === 'prev' || a === 'next') { if (edge(i)) I.wheel += a === 'next' ? 1 : -1; continue; }
        if (a === 'pause') { if (edge(i)) { this.key('Escape', true); this.key('Escape', false); } continue; }
        this.key(KB[a], on);
      }
    },

    // ---------- menus: a highlight that moves between the things you can press ----------
    root() { return (G.ui.cur && G.ui.cur.wrap) || G.$('#menu') || G.$('#ui'); },
    items() { const r = this.root(); if (!r) return []; return [...r.querySelectorAll(FOCUSABLE)].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 2 && b.height > 2 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('.hide'); }); },
    blur() { if (this.focus) { this.focus.classList.remove('padfocus'); this.focus.dispatchEvent(new MouseEvent('mouseleave')); } this.focus = null; },
    setFocus(e) {
      if (e === this.focus) return; this.blur(); if (!e) return; this.focus = e; e.classList.add('padfocus'); e.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const b = e.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2; window.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y })); e.dispatchEvent(new MouseEvent('mouseenter', { clientX: x, clientY: y }));
      if (G.audio.ready) G.audio.sfx('click');
    },
    move(dir) {
      const all = this.items(); if (!all.length) return; const f = this.focus && all.includes(this.focus) ? this.focus : null; if (!f) return this.setFocus(all[0]);
      const a = f.getBoundingClientRect(), ax0 = a.left + a.width / 2, ay0 = a.top + a.height / 2, dx = dir === 'l' ? -1 : dir === 'r' ? 1 : 0, dy = dir === 'u' ? -1 : dir === 'd' ? 1 : 0;
      let best = null, bs = 1e9;
      for (const e of all) { if (e === f) continue; const b = e.getBoundingClientRect(), vx = b.left + b.width / 2 - ax0, vy = b.top + b.height / 2 - ay0, along = vx * dx + vy * dy; if (along <= 2) continue; const across = Math.abs(vx * dy) + Math.abs(vy * dx), s = along + across * 2.4; if (s < bs) { bs = s; best = e; } }
      if (best) this.setFocus(best);
    },
    press(e, button) {
      if (!e) return; const b = e.getBoundingClientRect(), o = { clientX: b.left + b.width / 2, clientY: b.top + b.height / 2, button: button || 0, bubbles: true, shiftKey: button === 'shift' };
      if (button === 'shift') o.button = 0;
      if (e.tagName === 'SELECT') { e.selectedIndex = (e.selectedIndex + 1) % e.options.length; e.dispatchEvent(new Event('change')); return; }
      if (e.tagName === 'INPUT' && e.type === 'range') return; if (e.tagName === 'INPUT' && e.type === 'text') { e.focus(); return; }
      if (e.classList.contains('slot')) { e.dispatchEvent(new MouseEvent('mousedown', o)); e.dispatchEvent(new MouseEvent('mouseup', o)); }
      else e.click();
      setTimeout(() => { if (this.focus && !document.contains(this.focus)) { this.focus = null; const it = this.items(); const near = it.find((x) => x.classList.contains('primary')) || it[0]; if (near) this.setFocus(near); } }, 30);
    },
    menu(B, edge, lx, ly, ry, dt) {
      const PB = G.settings.padBindings; let items = null;
      if (!this.focus || !document.contains(this.focus)) { this.focus = null; items = this.items(); const pri = items.find((e) => e.classList.contains('primary') || e.classList.contains('mbtn')) || items[0]; if (pri) this.setFocus(pri); }
      const dir = B[12] || ly < -0.5 ? 'u' : B[13] || ly > 0.5 ? 'd' : B[14] || lx < -0.5 ? 'l' : B[15] || lx > 0.5 ? 'r' : '';
      const f = this.focus, range = f && f.tagName === 'INPUT' && f.type === 'range';
      if (dir) { this.rep -= dt; if (dir !== this.repDir || this.rep <= 0) { if (range && (dir === 'l' || dir === 'r')) { const st = parseFloat(f.step) || 0.05; f.value = Math.min(+f.max, Math.max(+f.min, parseFloat(f.value) + (dir === 'r' ? st : -st))); f.dispatchEvent(new Event('input')); } else this.move(dir); this.rep = dir !== this.repDir ? 0.38 : 0.11; this.repDir = dir; } } else { this.repDir = ''; this.rep = 0; }
      if (edge(0)) this.press(this.focus);
      if (edge(2)) this.press(this.focus, 'shift');            // X: move the whole stack across (like shift-click)
      if (edge(3)) this.press(this.focus, 2);                  // Y: take half / place one (like right-click)
      if (edge(1) || edge(PB.pause)) { const cur = G.ui.cur; if (cur) { if (!cur.P.modal) G.ui.close(); } else if (G.state === 'play') G.ui.open('pause'); }
      if (edge(4) || edge(5)) { const r = this.root(), tabs = r ? [...r.querySelectorAll('.tab')] : []; if (tabs.length) { const i = tabs.findIndex((t) => t.classList.contains('on')), n = tabs[(i + (edge(5) ? 1 : tabs.length - 1)) % tabs.length]; n.click(); this.focus = null; } }
      if (Math.abs(ry) > 0.1) { const sc = (this.focus && this.focus.closest('.scroll, .panel-body')) || (G.ui.cur && G.ui.cur.body); if (sc) sc.scrollTop += ry * 900 * dt; }
    }
  };
  window.addEventListener('gamepadconnected', (e) => { if (e.gamepad.buttons.length >= 12 && G.ui && G.ui.toast) G.ui.toast('Controller connected: ' + e.gamepad.id.replace(/\(.*?\)/g, '').trim().slice(0, 40)); });
  window.addEventListener('gamepaddisconnected', () => { P.setOn(false); if (G.ui && G.ui.toast) G.ui.toast('Controller disconnected.'); });
  // using the mouse or keyboard hands control back to them
  window.addEventListener('mousemove', (e) => { if (P.on && e.isTrusted && (Math.abs(e.movementX) + Math.abs(e.movementY) > 6)) P.setOn(false); });
  window.addEventListener('keydown', (e) => { if (P.on && e.isTrusted) P.setOn(false); });
  // play is under control while the pointer is captured or a controller is in use
  I.active = () => I.locked || P.on;
})();
