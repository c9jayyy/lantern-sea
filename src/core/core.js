'use strict';
/* LANTERN SEA — core: namespace, math, noise, events, settings, input */
(function () {
  const G = window.G = { TITLE: 'LANTERN SEA', BUILD_VER: '1.0.0', SAVE_VERSION: 2 };

  // ---------- math ----------
  G.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.sstep = (a, b, x) => { let t = G.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  G.damp = (a, b, k, dt) => G.lerp(a, b, 1 - Math.exp(-k * dt));
  G.angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
  G.dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
  G.fmt = (n) => Math.round(n).toLocaleString();

  // ---------- rng / hash / noise ----------
  G.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
  G.strSeed = function (s) {
    s = String(s); let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  G.hash2 = function (x, y, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  G.noise2 = function (x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    let fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = G.hash2(xi, yi, s), b = G.hash2(xi + 1, yi, s), c = G.hash2(xi, yi + 1, s), d = G.hash2(xi + 1, yi + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  G.fbm = function (x, y, s, oct) {
    let v = 0, amp = 0.5, tot = 0;
    for (let i = 0; i < (oct || 4); i++) { v += amp * G.noise2(x, y, s + i * 101); tot += amp; x = x * 2.03 + 17.1; y = y * 2.03 - 9.7; amp *= 0.5; }
    return v / tot;
  };
  G.pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length) % arr.length];
  G.weighted = function (rnd, table) { // [[item, weight],...]
    let t = 0; for (const e of table) t += e[1];
    let r = rnd() * t; for (const e of table) { r -= e[1]; if (r <= 0) return e[0]; }
    return table[table.length - 1][0];
  };

  // ---------- events ----------
  const handlers = {};
  G.on = (evt, fn) => { (handlers[evt] = handlers[evt] || []).push(fn); };
  G.emit = function (evt, a, b, c) {
    const h = handlers[evt]; if (!h) return;
    for (let i = 0; i < h.length; i++) { try { h[i](a, b, c); } catch (e) { console.error('[event ' + evt + ']', e); } }
  };

  // ---------- settings ----------
  const PRESETS = {
    low: { resScale: 0.7, shadows: 0, water: 0, drawDist: 1100, veg: 0.45, reflections: false, post: false, bloom: false },
    medium: { resScale: 0.85, shadows: 1, water: 1, drawDist: 1500, veg: 0.7, reflections: true, post: true, bloom: false },
    high: { resScale: 1.0, shadows: 2, water: 2, drawDist: 2000, veg: 1.0, reflections: true, post: true, bloom: true },
    ultra: { resScale: 1.0, shadows: 3, water: 3, drawDist: 2600, veg: 1.3, reflections: true, post: true, bloom: true }
  };
  G.PRESETS = PRESETS;
  G.defaultBindings = {
    forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', sprint: 'ShiftLeft', crouch: 'ControlLeft',
    jump: 'Space', interact: 'KeyE', inventory: 'Tab', craft: 'KeyC', build: 'KeyB', map: 'KeyM', journal: 'KeyJ',
    light: 'KeyF', rotate: 'KeyR', demolish: 'KeyX', drop: 'KeyG', photo: 'KeyP', quicksave: 'F5', help: 'KeyH'
  };
  G.bindingNames = {
    forward: 'Move forward', back: 'Move back', left: 'Strafe left', right: 'Strafe right', sprint: 'Sprint / swim fast',
    crouch: 'Crouch / dive down', jump: 'Jump / swim up', interact: 'Interact', inventory: 'Inventory', craft: 'Crafting',
    build: 'Build menu', map: 'Chart', journal: 'Journal', light: 'Flashlight', rotate: 'Rotate piece', demolish: 'Demolish mode',
    drop: 'Drop held item', photo: 'Photo mode', quicksave: 'Quick save', help: 'Help'
  };
  G.settings = Object.assign({
    preset: 'high', fpsLimit: 0, fov: 72, sens: 1.0, invertY: false,
    volMaster: 0.8, volMusic: 0.5, volSfx: 0.8, volAmb: 0.7,
    uiScale: 1.0, subtitles: true, colorblind: false, reducedMotion: false, camBob: 1.0, tutorials: true, recordedSfx: true, ibl: true, ao: true,
    bindings: Object.assign({}, G.defaultBindings)
  }, PRESETS.high);
  G.loadSettings = function () {
    try {
      const raw = localStorage.getItem('lanternsea.settings');
      if (raw) { const s = JSON.parse(raw); const b = Object.assign({}, G.defaultBindings, s.bindings || {}); Object.assign(G.settings, s); G.settings.bindings = b; }
    } catch (e) { console.warn('settings load failed', e); }
  };
  G.saveSettings = function () {
    try { localStorage.setItem('lanternsea.settings', JSON.stringify(G.settings)); } catch (e) { /* private mode */ }
    G.emit('settings');
  };
  G.applyPreset = function (name) { if (PRESETS[name]) { Object.assign(G.settings, PRESETS[name]); G.settings.preset = name; } };

  // ---------- input ----------
  const I = G.input = { keys: {}, pressed: {}, mdx: 0, mdy: 0, mb: [false, false, false], mpressed: [false, false, false], mreleased: [false, false, false], wheel: 0, locked: false, enabled: false };
  I.down = (action) => !!I.keys[G.settings.bindings[action]];
  I.hit = (action) => !!I.pressed[G.settings.bindings[action]];
  I.endFrame = function () { I.pressed = {}; I.mdx = 0; I.mdy = 0; I.wheel = 0; I.mpressed = [false, false, false]; I.mreleased = [false, false, false]; };
  I.clear = function () { I.keys = {}; I.mb = [false, false, false]; };
  G.keyLabel = function (code) {
    if (!code) return '—';
    return code.replace('Key', '').replace('Digit', '').replace('ShiftLeft', 'Shift').replace('ControlLeft', 'Ctrl').replace('ArrowUp', '↑').replace('ArrowDown', '↓');
  };
  I.init = function (canvas) {
    I.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (I.rebind) { e.preventDefault(); const cb = I.rebind; I.rebind = null; cb(e.code); return; }
      const t = e.target; const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
      if (typing) { if (e.code === 'Escape') t.blur(); return; }
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code) || ((e.ctrlKey || e.code === 'F5') && G.state === 'play')) e.preventDefault();
      if (!e.repeat) { I.keys[e.code] = true; I.pressed[e.code] = true; G.emit('key', e.code); }
    });
    window.addEventListener('keyup', (e) => { I.keys[e.code] = false; });
    window.addEventListener('blur', () => I.clear());
    canvas.addEventListener('mousedown', (e) => {
      if (G.state === 'play' && !G.ui.blocking() && !I.locked) { I.lock(); return; }
      I.mb[e.button] = true; I.mpressed[e.button] = true;
    });
    window.addEventListener('mouseup', (e) => { if (I.mb[e.button]) I.mreleased[e.button] = true; I.mb[e.button] = false; });
    // Chrome occasionally reports a single bogus, enormous movement while the pointer is locked (worse when frames stall),
    // which snaps the view round. Drop those, and the first event after locking, instead of turning the camera.
    let skipNext = false; document.addEventListener('pointerlockchange', () => { skipNext = true; });
    window.addEventListener('mousemove', (e) => {
      if (!I.locked) return; const mx = e.movementX || 0, my = e.movementY || 0;
      if (skipNext) { skipNext = false; return; }
      const lim = Math.max(180, Math.min(window.innerWidth, window.innerHeight) * 0.35); if (Math.abs(mx) > lim || Math.abs(my) > lim) return;
      I.mdx += mx; I.mdy += my;
    });
    canvas.addEventListener('wheel', (e) => { I.wheel += Math.sign(e.deltaY); }, { passive: true });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      I.locked = document.pointerLockElement === canvas;
      if (!I.locked) { I.mb = [false, false, false]; G.emit('unlock'); }
    });
  };
  I.lock = function () { try { const p = I.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { /* ignore */ } };
  I.unlock = function () { if (document.pointerLockElement) document.exitPointerLock(); };

  // tiny helpers used everywhere
  G.el = function (tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  G.$ = (sel) => document.querySelector(sel);
  G.state = 'boot'; // boot | menu | play | paused | ending
})();
