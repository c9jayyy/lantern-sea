'use strict';
/* UI core: panel manager, item-slot widget with drag/carry, tooltips, toasts, HUD, main menu, settings. */
(function () {
  const G = window.G, el = G.el;
  // line icons for the HUD (24-unit grid, stroked)
  const P = (d) => `<path d="${d}"/>`;
  const ICONS = G.HUD_ICONS = {
    hp: P('M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z'),
    hunger: P('M7 3v7a2.5 2.5 0 0 0 5 0V3M9.5 3v18M17 21V3c-2.2 1.2-3.2 3.6-3.2 6.5 0 2 1.2 3 3.2 3'),
    thirst: P('M12 3.2s6.2 6.6 6.2 11.1a6.2 6.2 0 0 1-12.4 0C5.8 9.8 12 3.2 12 3.2z'),
    stamina: P('M13.5 2.8 5.5 13.6h6l-1 7.6 8-10.8h-6z'),
    energy: P('M19.5 14.6A8 8 0 1 1 9.4 4.5a6.4 6.4 0 0 0 10.1 10.1z'),
    temp: P('M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0zM12 9v8'),
    drop: P('M12 4s5 5.3 5 9a5 5 0 0 1-10 0c0-3.7 5-9 5-9z'), drops: P('M8 5s3 3.2 3 5.4a3 3 0 0 1-6 0C5 8.2 8 5 8 5zM16 11s3 3.2 3 5.4a3 3 0 0 1-6 0c0-2.2 3-5.4 3-5.4z'),
    skull: P('M12 3a7 7 0 0 0-7 7c0 2.6 1.4 4.3 3 5.2V19h8v-3.8c1.6-.9 3-2.6 3-5.2a7 7 0 0 0-7-7zM9.5 11h.01M14.5 11h.01M10.5 19v2M13.5 19v2'),
    sick: P('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 10h.01M15.5 10h.01M8 16c2.5-2 5.5-2 8 0'), virus: P('M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5 19 19M5 19l3.5-3.5M15.5 8.5 19 5'),
    bone: P('M7 17 17 7M6 14.5a2.5 2.5 0 1 1-1.5 4.5 2.5 2.5 0 1 1 4.5-1.5M18 9.5a2.5 2.5 0 1 1 1.5-4.5A2.5 2.5 0 1 1 15 6.5'),
    sun: P('M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'),
    heat: P('M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0zM18 4v4M20 6h-4'), cold: P('M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0zM17 6h4'),
    roof: P('M3 11 12 4l9 7M5.5 9.2V20h13V9.2'), fire: P('M12 21c-3.9 0-6-2.6-6-5.7 0-3.6 3-5.3 3.5-8.8 2.4 1.4 3.5 3.6 3.6 5.4.9-.6 1.6-1.9 1.7-3.1 2.1 1.7 3.2 4 3.2 6.5 0 3.1-2.1 5.7-6 5.7z'), warn: P('M12 3 2 20h20L12 3zM12 10v4M12 17h.01'),
    diamond: P('M12 3 20 12 12 21 4 12z'), flag: P('M5 21V4M5 4h11l-2 4 2 4H5'), raft: P('M3 16h18l-2 4H5zM12 3v13M12 4l6 9h-6'),
    wx_clear: P('M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'),
    wx_fair: P('M8 4v1.5M3.5 8.5H5M4.6 5.1l1 1M11.4 5.1l-1 1M5.6 10.6A3 3 0 1 1 11 8M7 19h10a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8 12.5 3.3 3.3 0 0 0 7 19z'),
    wx_breezy: P('M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8'), wx_overcast: P('M6.5 19h11a4 4 0 0 0 .4-8A6 6 0 0 0 6.6 11.4 3.8 3.8 0 0 0 6.5 19z'),
    wx_drizzle: P('M6.5 15h11a4 4 0 0 0 .4-8A6 6 0 0 0 6.6 7.4 3.8 3.8 0 0 0 6.5 15zM9 18l-.5 1.5M15 18l-.5 1.5M12 19l-.5 1.5'),
    wx_rain: P('M6.5 14h11a4 4 0 0 0 .4-8A6 6 0 0 0 6.6 6.4 3.8 3.8 0 0 0 6.5 14zM8 17l-1.5 4M12 17l-1.5 4M16 17l-1.5 4'),
    wx_storm: P('M6.5 14h11a4 4 0 0 0 .4-8A6 6 0 0 0 6.6 6.4 3.8 3.8 0 0 0 6.5 14zM13 14l-3 4h4l-3 4'),
    wx_gale: P('M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0M12 4c-4.4 0-8 2-8 4.5M20 15.5C20 18 16.4 20 12 20M4 12c0 3 2 5.5 6 6.5M20 12c0-3-2-5.5-6-6.5'),
    wx_fog: P('M4 9h16M3 13h18M5 17h14M7 5h10'), wx_calm: P('M3 10c2 0 2-1 4.5-1s2.5 1 4.5 1 2-1 4.5-1S19 10 21 10M3 15h18'),
  };
  const U = G.ui = {
    cur: null, carry: null, panels: {}, hudT: 0, cache: {},
    blocking() { return !!this.cur || G.state !== 'play'; },
    init() {
      const r = this.root = G.$('#ui'); r.innerHTML = '';
      this.hud = el('div', 'hide', ''); this.hud.id = 'hud'; r.appendChild(this.hud);
      this.hud.innerHTML = `<div id="objectives"></div><div id="compass"></div><div id="topright"><div id="clock"></div><div id="wx"></div><div id="place"></div><div id="raftinfo" class="hide"></div></div>
        <div id="cross"></div><div id="prompt"></div><div id="charge" class="hide"><i></i></div><div id="conds"></div>
        <div id="stats"></div><div id="held"></div><div id="hotbar"></div><div id="air" class="hide"><div class="bar"><i></i></div><span></span></div>
        <div id="fishing" class="hide"></div><div id="gains"></div><div id="buildbar" class="hide"></div><div id="depth" class="hide"></div>`;
      const ring = (k, big) => `<svg viewBox="0 0 44 44"><circle class="trk" cx="22" cy="22" r="19"/><circle class="val" cx="22" cy="22" r="19" pathLength="100" transform="rotate(-90 22 22)"/><g class="gl" transform="translate(11.5 11.5) scale(.875)">${ICONS[k]}</g></svg>`;
      for (const k of ['hp', 'hunger', 'thirst', 'stamina', 'energy', 'temp']) { const s = el('div', 'meter m-' + k, ring(k)); s.id = 'st_' + k; G.$('#stats').appendChild(s); }
      const hb = G.$('#hotbar'); for (let i = 0; i < 9; i++) { const s = el('div', 'slot', `<span class="k">${i + 1}</span><span class="ic"></span><span class="q"></span><div class="dur hide"><i></i></div>`); hb.appendChild(s); }
      for (const id of ['toasts', 'banner', 'radio', 'chapter', 'fade']) { const d = el('div', id === 'banner' || id === 'radio' || id === 'chapter' ? 'hide' : ''); d.id = id; r.appendChild(d); }
      this.layer = el('div'); r.appendChild(this.layer);
      this.carryEl = el('div', 'hide'); this.carryEl.id = 'carry'; document.body.appendChild(this.carryEl);
      this.tipEl = el('div', 'hide'); this.tipEl.id = 'tip'; document.body.appendChild(this.tipEl);
      window.addEventListener('mousemove', (e) => { this.mx = e.clientX; this.my = e.clientY; if (this.carry) { this.carryEl.style.left = e.clientX + 'px'; this.carryEl.style.top = e.clientY + 'px'; } if (!this.tipEl.classList.contains('hide')) this.placeTip(); });
      G.on('key', (c) => this.onKey(c)); G.on('unlock', () => { if (G.state === 'play' && !this.cur && !G.photo && G.player.alive && !this._selfUnlock) this.open('pause'); this._selfUnlock = false; });
      G.on('settings', () => this.applySettings()); this.applySettings();
    },
    applySettings() { const S = G.settings; document.documentElement.style.setProperty('--uis', S.uiScale); document.body.classList.toggle('cb', !!S.colorblind); document.body.classList.toggle('nomotion', !!S.reducedMotion); },

    // ---------- panel manager ----------
    open(name, arg) {
      const P = this.panels[name]; if (!P) return console.warn('no panel', name);
      if (this.cur) this.close(true);
      const wrap = el('div', 'wrap w-' + name), panel = el('div', 'panel p-' + name); wrap.appendChild(panel);
      const head = el('div', 'panel-head', `<h2></h2><span class="x">✕</span>`), body = el('div', 'panel-body'); panel.appendChild(head); panel.appendChild(body);
      this.cur = { name, arg, wrap, panel, body, head, P }; head.querySelector('.x').onclick = () => this.close();
      if (P.modal) head.querySelector('.x').classList.add('hide'); else wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) this.close(); });
      this.layer.appendChild(wrap); this._selfUnlock = G.input.locked; G.input.unlock(); G.input.clear(); if (G.audio.ready) G.audio.sfx('click');
      this.refresh(); if (P.onOpen) P.onOpen(arg, this.cur); G.emit('panel', name);
    },
    refresh() { const c = this.cur; if (!c) return; const sc = c.body.scrollTop, subs = [...c.body.querySelectorAll('.scroll')].map((s) => s.scrollTop); c.body.innerHTML = ''; c.head.querySelector('h2').textContent = typeof c.P.title === 'function' ? c.P.title(c.arg) : c.P.title; c.P.render(c.body, c.arg, c); c.body.scrollTop = sc; [...c.body.querySelectorAll('.scroll')].forEach((s, i) => { if (subs[i]) s.scrollTop = subs[i]; }); this.hideTip(); },
    close(switching) {
      const c = this.cur; if (!c) return; if (c.P.onClose) c.P.onClose(c.arg);
      if (this.carry) { G.inv.add(this.carry.id, this.carry.n, this.carry, true); this.setCarry(null); }
      c.wrap.remove(); this.cur = null; this.hideTip();
      if (!switching && G.state === 'paused') G.game.resume(); if (!switching && G.state === 'play' && !c.P.noLock) G.input.lock();
    },
    onKey(code) {
      const B = G.settings.bindings;
      if (G.state !== 'play') { if (code === 'Escape' && this.cur && !this.cur.P.modal) this.close(); return; }
      if (G.photo) { if (code === 'Escape' || code === B.photo) G.game.photo(false); else if (code === 'Enter' || code === 'Space') G.render.screenshot(); return; }
      if (code === 'Escape') { if (this.cur) { if (!this.cur.P.modal) this.close(); } else if (G.build.active) G.build.exit(); else this.open('pause'); return; }
      if (this.cur && this.cur.P.modal) return; if (!G.player.alive) return;
      const map = { [B.inventory]: 'inventory', [B.craft]: 'craft', [B.build]: 'build', [B.map]: 'map', [B.journal]: 'journal', [B.help]: 'help' }, name = map[code];
      if (name) { if (name === 'build' && G.build.active && !this.cur) return G.build.exit(); if (this.cur && this.cur.name === name) this.close(); else this.open(name); return; }
      if (this.cur) return;
      if (code === B.photo) G.game.photo(true); else if (code === B.quicksave) { G.game.save(G.game.slot); }
      else if (code === B.demolish && !G.build.active && G.player.mode === 'walk') G.build.enterDemolish();
    },

    // ---------- small feedback elements ----------
    toast(msg, kind) { if (!msg) return; const box = G.$('#toasts'); if (box.lastChild && box.lastChild.textContent === msg) return; const t = el('div', 'toast ' + (kind || ''), msg); box.appendChild(t); while (box.children.length > 4) box.firstChild.remove(); setTimeout(() => t.remove(), 4200 + msg.length * 28); },
    questToast(kind, title, done) { const box = G.$('#toasts'); const t = el('div', 'qtoast', `<small>${kind}</small><b>${title}</b>`); box.appendChild(t); setTimeout(() => t.remove(), 5000); },
    gain(id, n) { const g = G.$('#gains'), d = G.ITEMS[id]; const last = g.lastChild; if (last && last.dataset.id === id) { last.dataset.n = +last.dataset.n + n; last.innerHTML = `<span class="gi">${d.i}</span><span class="gn">${d.n}</span><b>+${last.dataset.n}</b>`; clearTimeout(last._t); last._t = setTimeout(() => last.remove(), 3000); return; } const e = el('div', 'gain', `<span class="gi">${d.i}</span><span class="gn">${d.n}</span><b>+${n}</b>`); e.dataset.id = id; e.dataset.n = n; g.appendChild(e); while (g.children.length > 7) g.firstChild.remove(); e._t = setTimeout(() => e.remove(), 3000); },
    banner(title, sub) { const b = G.$('#banner'); b.innerHTML = `<h1>${title}</h1><div>${sub || ''}</div>`; b.classList.remove('hide'); b.style.opacity = 1; clearTimeout(this._bt); this._bt = setTimeout(() => { b.style.opacity = 0; this._bt = setTimeout(() => b.classList.add('hide'), 1000); }, 3800); },
    radio(title, lines) { const r = G.$('#radio'); let i = 0; clearTimeout(this._rt); const step = () => { if (i >= lines.length) { r.classList.add('hide'); return; } r.innerHTML = `<small>📻 ${title}</small><div>${lines[i]}</div>`; r.classList.toggle('hide', !G.settings.subtitles); const d = 2600 + lines[i].length * 55; i++; this._rt = setTimeout(step, d); }; step(); },
    chapter(n) { const c = G.$('#chapter'); c.innerHTML = `<small>Chapter ${['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'][n]}</small><h1>${G.CHAPTERS[n]}</h1>`; c.classList.remove('hide'); c.style.opacity = 1; G.audio.sfx('discover'); setTimeout(() => { c.style.opacity = 0; setTimeout(() => c.classList.add('hide'), 1300); }, 3600); },
    fade(v, ms) { const f = G.$('#fade'); f.style.transitionDuration = (ms || 800) + 'ms'; f.style.opacity = v; },
    fishing(s) { const f = G.$('#fishing'); if (!s) return f.classList.add('hide'); f.classList.remove('hide'); if (s.bite) f.innerHTML = '<div class="bite">A bite — click!</div>'; else f.innerHTML = `<div class="muted">Hold to reel · release when the line strains${s.surge ? ' · <b class="bad">it is running!</b>' : ''}</div><div class="bar ten"><i style="width:${Math.min(100, s.tension * 100)}%"></i></div><div class="bar"><i style="width:${Math.min(100, s.progress * 100)}%"></i></div>`; },
    credits() { this.open('credits'); },

    // ---------- item slots ----------
    icon(id) { return G.ITEMS[id] ? G.ITEMS[id].i : '❔'; },
    setCarry(s) { this.carry = s; if (!s) return this.carryEl.classList.add('hide'); this.carryEl.classList.remove('hide'); this.carryEl.innerHTML = `<span class="ic">${this.icon(s.id)}</span>${s.n > 1 ? `<span class="q">${s.n}</span>` : ''}`; this.carryEl.style.left = this.mx + 'px'; this.carryEl.style.top = this.my + 'px'; },
    fillSlot(e, s, opts) {
      const d = s && G.ITEMS[s.id]; let h = '';
      if (opts && opts.key) h += `<span class="k">${opts.key}</span>`;
      if (s && d) { h += `<span class="ic">${d.i}</span>`; if (s.n > 1) h += `<span class="q">${s.n}</span>`; if (s.dur != null && d.tool && d.tool.dur < 9000) { const f = s.dur / d.tool.dur; h += `<div class="dur"><i style="width:${f * 100}%;background:${f < 0.25 ? 'var(--bad)' : f < 0.6 ? '#ffd36b' : 'var(--good)'}"></i></div>`; } if (s.air != null) h += `<div class="dur"><i style="width:${s.air / d.air * 100}%;background:#7fc8ff"></i></div>`; if (d.food && d.food.spoil && s.made != null) { const left = 1 - (G.time.now() - s.made) / d.food.spoil; h += `<span class="fresh" style="background:${left < 0.25 ? 'var(--bad)' : left < 0.6 ? '#ffd36b' : 'var(--good)'}"></span>`; } }
      else if (opts && opts.ghost) h += `<span class="ic ghost">${opts.ghost}</span>`;
      if (opts && opts.lab) h += `<span class="lab">${opts.lab}</span>`; e.innerHTML = h;
    },
    // src: { size, get(i), set(i, stack), accept?(stack, i), quick?(i), cls?(i), key?(i), ghost?(i), lab?(i), cols? }
    grid(parent, src) {
      const g = el('div', 'grid' + (src.gcls ? ' ' + src.gcls : '')); if (src.cols) g.style.gridTemplateColumns = `repeat(${src.cols}, var(--slot, 3.5em))`; parent.appendChild(g);
      for (let i = 0; i < src.size; i++) {
        const s = src.get(i), e = el('div', 'slot ' + (src.cls ? src.cls(i) : '')); this.fillSlot(e, s, { key: src.key && src.key(i), ghost: src.ghost && src.ghost(i), lab: src.lab && src.lab(i) }); g.appendChild(e);
        e.addEventListener('mouseenter', () => { const st = src.get(i); if (src.hover) src.hover(i, st); if (st && !src.noTip) this.showTip(this.itemTip(st)); }); e.addEventListener('mouseleave', () => this.hideTip());
        e.addEventListener('contextmenu', (ev) => ev.preventDefault());
        e.addEventListener('mousedown', (ev) => { ev.preventDefault(); this.slotClick(src, i, ev); });
        e.addEventListener('mouseup', () => { if (this.carry && this._from && (this._from.src !== src || this._from.i !== i) && performance.now() - this._from.t > 180) this.slotClick(src, i, { button: 0 }); });
      }
      return g;
    },
    slotClick(src, i, ev) {
      const cur = src.get(i), c = this.carry, ok = (st) => !src.accept || src.accept(st, i); G.audio.sfx('click');
      if (ev.shiftKey && cur && src.quick) { src.quick(i); return this.refresh(); }
      if (ev.button === 2) {
        if (c) { if (!ok(c)) return; if (!cur) { src.set(i, Object.assign({}, c, { n: 1 })); c.n--; } else if (cur.id === c.id && cur.n < G.ITEMS[c.id].s) { cur.n++; c.n--; } this.setCarry(c.n > 0 ? c : null); }
        else if (cur && cur.n > 1) { const h = Math.ceil(cur.n / 2); cur.n -= h; this.setCarry(Object.assign({}, cur, { n: h })); if (src.onTake) src.onTake(i); } else if (cur) { src.set(i, null); this.setCarry(cur); if (src.onTake) src.onTake(i); }
        return this.refresh();
      }
      if (!c) { if (!cur) return; src.set(i, null); this.setCarry(cur); this._from = { src, i, t: performance.now() }; if (src.onTake) src.onTake(i); }
      else {
        if (!ok(c)) { G.audio.sfx('deny'); return; }
        if (!cur) { src.set(i, c); this.setCarry(null); }
        else if (cur.id === c.id && G.ITEMS[c.id].s > 1) { const k = Math.min(c.n, G.ITEMS[c.id].s - cur.n); if (cur.made != null && c.made != null) cur.made = (cur.made * cur.n + c.made * k) / (cur.n + k); cur.n += k; c.n -= k; this.setCarry(c.n > 0 ? c : null); }
        else if (src.swap === false) { G.audio.sfx('deny'); return; } else { src.set(i, c); this.setCarry(cur); }
        this._from = null;
      }
      this.refresh();
    },
    invSrc(extra) { const inv = G.inv; return Object.assign({ size: inv.size(), get: (i) => inv.slots[i], set: (i, s) => { inv.slots[i] = s; }, cls: (i) => (i < 9 ? 'hot ' : '') + (i === inv.sel ? 'sel' : ''), key: (i) => i < 9 ? i + 1 : '' }, extra); },
    itemTip(s) {
      const d = G.ITEMS[s.id]; let h = `<b>${d.i} ${d.n}</b><br><span class="muted">${d.d || ''}</span>`;
      if (d.food) { const f = d.food, p = []; if (f.h) p.push(`🍖 ${f.h > 0 ? '+' : ''}${f.h}`); if (f.t) p.push(`💧 ${f.t > 0 ? '+' : ''}${f.t}`); if (f.hp) p.push(`❤️ ${f.hp > 0 ? '+' : ''}${f.hp}`); h += `<br>${p.join(' &nbsp; ')}`; if (f.sick) h += `<br><span class="bad">${Math.round(f.sick * 100)}% chance of sickness</span>`; if (f.spoil && s.made != null) { const left = f.spoil - (G.time.now() - s.made); h += `<br><span class="${left < f.spoil * 0.25 ? 'bad' : 'muted'}">Spoils in ${left > 48 ? Math.round(left / 24) + ' days' : Math.max(1, Math.round(left)) + ' h'}</span>`; } else if (!f.spoil) h += '<br><span class="muted">Does not spoil</span>'; }
      if (d.med) h += `<br><span class="good">Treats: ${d.med.cure.join(', ')}${d.med.hp ? ' · ❤️ +' + d.med.hp : ''}</span>`;
      if (d.tool && d.tool.dur < 9000 && s.dur != null) h += `<br>Durability ${Math.ceil(s.dur)} / ${d.tool.dur}`; if (d.air) h += `<br>Air ${Math.ceil(s.air || 0)} s / ${d.air} s`;
      if (d.equip) h += `<br><span class="glass">Wearable — ${d.equip}</span>`; if (d.fuel) h += `<br><span class="muted">Burns for ${d.fuel} s</span>`;
      if (d.c !== 'story') h += `<br><span class="brass">Trade value ${d.v}</span>` + (G.tech.studied[s.id] ? '' : ' <span class="glass">· unstudied</span>');
      return h;
    },
    showTip(html) { this.tipEl.innerHTML = html; this.tipEl.classList.remove('hide'); this.placeTip(); },
    placeTip() { const t = this.tipEl, w = t.offsetWidth, h = t.offsetHeight; let x = this.mx + 18, y = this.my + 18; if (x + w > innerWidth - 8) x = this.mx - w - 12; if (y + h > innerHeight - 8) y = innerHeight - h - 8; t.style.left = x + 'px'; t.style.top = y + 'px'; },
    hideTip() { this.tipEl.classList.add('hide'); },
    tipOn(e, html) { e.addEventListener('mouseenter', () => this.showTip(typeof html === 'function' ? html() : html)); e.addEventListener('mouseleave', () => this.hideTip()); },
    btn(parent, label, fn, cls) { const b = el('button', 'btn ' + (cls || ''), label); b.onclick = (e) => { G.audio.sfx('click'); fn(e); }; parent.appendChild(b); return b; },
    costHtml(cost) { return Object.keys(cost).map((k) => { const have = G.inv.countAll(k); return `<span class="pill ${have >= cost[k] ? '' : 'bad'}">${G.ITEMS[k].i} ${G.ITEMS[k].n} ${Math.min(have, 999)}/${cost[k]}</span>`; }).join(''); },

    // ---------- HUD ----------
    set(id, html) { if (this.cache[id] === html) return; this.cache[id] = html; G.$('#' + id).innerHTML = html; },
    show(id, on) { const k = 'v_' + id; if (this.cache[k] === on) return; this.cache[k] = on; G.$('#' + id).classList.toggle('hide', !on); },
    updateHUD(dt) {
      const play = G.state === 'play' && !G.photo; this.show('hud', play); if (!play) return;
      this.hudT -= dt; const P = G.player, inv = G.inv, A = G.actions;
      // every frame: prompt, charge, compass
      const t = P.target; let ph = '';
      if (!G.input.locked && !this.cur) ph = '<span class="muted">Click to take control</span>';
      else if (G.build.active) ph = '';
      else if (P.mode === 'helm') ph = `<kbd>${G.keyLabel(G.settings.bindings.interact)}</kbd>Let go of the helm`;
      else if (P.mode === 'boat') ph = `<kbd>${G.keyLabel(G.settings.bindings.interact)}</kbd>Step out`;
      else if (t && t.label) ph = (t.key ? `<kbd>${G.keyLabel(G.settings.bindings.interact)}</kbd>` : '') + t.label + (t.hint ? `<span class="hint">${t.hint}</span>` : '');
      this.set('prompt', ph); G.$('#cross').classList.toggle('act', !!(t && t.label));
      this.show('charge', A.charge > 0); if (A.charge > 0) G.$('#charge i').style.width = A.charge * 100 + '%';
      this.compass();
      if (this.hudT > 0) return; this.hudT = 0.12;
      for (const k of ['hp', 'hunger', 'thirst', 'stamina', 'energy']) { const v = Math.max(0, Math.min(100, Math.round(P[k]))); if (this.cache['s' + k] !== v) { this.cache['s' + k] = v; const e = G.$('#st_' + k); e.querySelector('.val').style.strokeDashoffset = 100 - v; e.classList.toggle('low', v < 22); e.classList.toggle('full', v > 96); } }
      { const tv = Math.round(P.temp || 0), e = G.$('#st_temp'); if (this.cache.stemp !== tv) { this.cache.stemp = tv; e.querySelector('.val').style.strokeDashoffset = 100 - Math.min(100, Math.abs(tv)); e.classList.toggle('hot', tv > 0); e.classList.toggle('cold', tv < 0); e.classList.toggle('hide', Math.abs(tv) < 18); e.classList.toggle('low', Math.abs(tv) > 45); } }
      // hotbar
      const hb = G.$('#hotbar').children; for (let i = 0; i < 9; i++) { const s = inv.slots[i], key = s ? s.id + ':' + s.n + ':' + Math.round(s.dur || 0) + (i === inv.sel) : 'e' + (i === inv.sel); if (this.cache['h' + i] === key) continue; this.cache['h' + i] = key; this.fillSlot(hb[i], s, { key: i + 1 }); hb[i].className = 'slot' + (i === inv.sel ? ' sel' : ''); }
      const held = inv.held(), hn = held ? G.ITEMS[held.id].n : ''; if (this.cache.held !== hn + inv.sel) { this.cache.held = hn + inv.sel; const e = G.$('#held'); e.textContent = hn; e.style.opacity = 1; clearTimeout(this._ht); this._ht = setTimeout(() => { e.style.opacity = 0; }, 2200); }
      // air
      const tank = inv.equip.back && G.ITEMS[inv.equip.back.id].air ? inv.equip.back : null, showAir = P.headUnder || P.air < P.airMax - 0.5; this.show('air', showAir);
      if (showAir) { G.$('#air i').style.width = P.air / P.airMax * 100 + '%'; G.$('#air span').textContent = tank ? `Tank ${Math.floor(tank.air / 60)}:${String(Math.floor(tank.air % 60)).padStart(2, '0')}` : P.air < 8 ? 'Surface now!' : 'Breath'; }
      const gauge = inv.count('depth_gauge') > 0 && P.headUnder; this.show('depth', gauge); if (gauge) this.set('depth', `${P.depth.toFixed(1)} m<br><span class="muted" style="font-size:.6em">sea floor ${Math.max(0, -G.world.heightAt(P.pos.x, P.pos.z)).toFixed(0)} m</span>`);
      // conditions
      let c = ''; const CN = { bleeding: ['drop', 'Bleeding'], poison: ['skull', 'Poisoned'], sick: ['sick', 'Sick'], infection: ['virus', 'Infection'], fracture: ['bone', 'Fracture'], sunburn: ['sun', 'Sunburn'] }, chip = (ic, t, ok) => `<div class="cond${ok ? ' ok' : ''}"><svg viewBox="0 0 24 24">${ICONS[ic] || ''}</svg>${t}</div>`;
      for (const k in P.cond) c += chip(CN[k] ? CN[k][0] : 'warn', CN[k] ? CN[k][1] : k); if (P.temp > 45) c += chip('heat', P.temp > 80 ? 'Heatstroke' : 'Overheating'); if (P.temp < -45) c += chip('cold', P.temp < -80 ? 'Hypothermia' : 'Cold'); if (P.wet > 0.4 && !P.swimming) c += chip('drops', 'Wet', 1); if (P.shaded) c += chip('roof', 'Sheltered', 1); if (P.nearFire) c += chip('fire', 'Warm', 1);
      this.set('conds', c);
      // clock & weather
      const W = G.wsim, ws = W.STATES[W.cur]; this.set('clock', `<b>${G.time.label()}</b><span>Day ${G.time.day}</span>`);
      const raft = G.structs.raft; let fc = ''; if (G.structs.list.some((s) => s.hasForecast && Math.hypot(s.pos.x - P.pos.x, s.pos.z - P.pos.z) < 60)) fc = `<div class="fc">then <svg viewBox="0 0 24 24">${ICONS['wx_' + W.next] || ''}</svg> ${W.STATES[W.next].n.toLowerCase()} in ${Math.max(1, Math.round(W.until - G.time.now()))}h</div>`;
      this.set('wx', `<div class="now"><svg viewBox="0 0 24 24">${ICONS[W.eye > 0.4 ? 'wx_gale' : 'wx_' + W.cur] || ''}</svg><span>${W.eye > 0.4 ? 'The Eye' : ws.n}</span><b>${Math.round(G.weather.temp)}°</b></div>${fc}`);
      const I = G.world.current; this.set('place', I && G.journal.places[I.id] ? I.name : '');
      const aboard = P.parent && P.parent.kind === 'raft' || P.mode === 'boat'; this.show('raftinfo', !!aboard);
      if (aboard) { const v = G.vehicles.current, sp = v ? Math.abs(v.speed) : raft.speed || 0; const rel = G.angDiff(-(v ? v.yaw : raft.yaw), Math.atan2(Math.cos(G.weather.windDir), -Math.sin(G.weather.windDir))); const arrow = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8]; this.set('raftinfo', `<b>${(sp * 1.94).toFixed(1)}</b> kn &nbsp;·&nbsp; wind <span class="arr">${arrow}</span> ${Math.round(G.weather.wind * 22)} kn` + (v ? (v.type === 'skiff' ? ` · fuel ${Math.round(v.fuel)}%` : '') : `<br>${raft.nSails ? (raft.sailOpen ? 'sail set' : 'sail furled') : 'no sail'} · ${raft.anchored ? 'anchored' : 'adrift'}${raft.aground ? ' · <span class="bad">aground</span>' : ''}`)); }
      // objectives
      const Q = G.quests; let o = `<div class="ch">Chapter ${Q.chapter()} — ${G.CHAPTERS[Q.chapter()]}</div>`; const ids = [...Q.order].sort((a, b) => (G.QUESTS[b].ch ? 1 : 0) - (G.QUESTS[a].ch ? 1 : 0)).slice(0, 4);
      for (const id of ids) o += `<div class="obj ${G.QUESTS[id].ch ? '' : 'side'}"><b>${G.QUESTS[id].title}</b><div>${Q.stepText(id)}</div></div>`;
      const tr = G.craft.tracked && G.RECIPES.find((r) => r.id === G.craft.tracked); if (tr) o += `<div class="obj side"><b>Tracking · ${G.ITEMS[tr.out].n}</b><div>${Object.keys(tr.ing).map((k) => `<span class="tri">${G.ITEMS[k].i}<span class="${inv.countAll(k) >= tr.ing[k] ? 'good' : ''}">${Math.min(inv.countAll(k), tr.ing[k])}/${tr.ing[k]}</span></span>`).join('')}</div></div>`;
      if (G.craft.queue.length) { const q = G.craft.queue[0], r = G.RECIPES.find((x) => x.id === q.id); o += `<div class="obj side"><b>Crafting ${G.ITEMS[r.out].n}${G.craft.queue.length > 1 ? ' (+' + (G.craft.queue.length - 1) + ')' : ''}</b><div class="bar"><i style="width:${q.t / q.need * 100}%"></i></div></div>`; }
      this.set('objectives', o);
      // build bar
      const B = G.build; this.show('buildbar', B.active);
      if (B.active) { const kb = G.settings.bindings, d = B.sel && G.BUILD[B.sel], inf = B.info; this.set('buildbar', B.demolish ? `<b class="bad">Dismantle</b> — left-click a piece to remove it (half materials back) · <span class="kbd">${G.keyLabel(kb.demolish)}</span>or right-click to finish${inf && !inf.valid ? `<br><span class="bad">${inf.why}</span>` : ''}` : `<b class="brass">${d.i} ${d.n}</b> — left-click place · <span class="kbd">${G.keyLabel(kb.rotate)}</span>rotate · <span class="kbd">${G.keyLabel(kb.demolish)}</span>dismantle · right-click exit<br>${this.costHtml(B.cost(d))}${inf && !inf.valid && inf.why && !inf.why.startsWith('Missing') ? ` <span class="bad">${inf.why}</span>` : ''}`); }
    },
    compass() {
      const has = G.inv.count('compass') > 0; this.show('compass', has); if (!has) return; const P = G.player, c = G.$('#compass'); const heading = ((-P.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); // 0 = north (-z)
      let h = ''; const W = c.clientWidth || 450, span = Math.PI * 0.8; const put = (ang, html, cls) => { const d = G.angDiff(heading, ang); if (Math.abs(d) < span / 2) h += `<span class="${cls}" style="left:${((0.5 + d / span) * W).toFixed(1)}px">${html}</span>`; };
      const N = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']; for (let i = 0; i < 72; i++) { const a = i * Math.PI / 36; if (i % 9 === 0) put(a, N[i / 9], i % 18 ? 'ic2' : 'cd'); else put(a, '', i % 3 ? 'tk' : 'tk big'); }
      const deg = Math.round(heading * 180 / Math.PI) % 360; h += `<div class="hdg">${String(deg).padStart(3, '0')}</div>`;
      const mk = (x, z, ic, cls) => { const dx = x - P.pos.x, dz = z - P.pos.z; put(Math.atan2(dx, -dz), `<svg viewBox="0 0 24 24">${ICONS[ic]}</svg><small>${Math.round(Math.hypot(dx, dz))} m</small>`, 'mk ' + cls); };
      for (const m of G.quests.markers()) mk(m.x, m.z, 'diamond', m.main ? '' : 'side'); if (G.map.waypoint) mk(G.map.waypoint.x, G.map.waypoint.z, 'flag', 'way');
      const raft = G.structs.raft; if (raft && P.parent !== raft && Math.hypot(raft.pos.x - P.pos.x, raft.pos.z - P.pos.z) > 12) mk(raft.pos.x, raft.pos.z, 'raft', 'raft');
      if (G.net && G.net.av && G.net.av.root.visible && G.net.partner) { const ap = G.net.av.root.position; if (Math.hypot(ap.x - P.pos.x, ap.z - P.pos.z) > 6) mk(ap.x, ap.z, 'hp', 'way'); }
      if (this.cache.cmp !== h) { this.cache.cmp = h; c.innerHTML = h; }
    },

    // ---------- main menu ----------
    showMenu() {
      this.hideMenu(); const m = el('div'); m.id = 'menu'; this.root.insertBefore(m, this.layer);
      m.innerHTML = `<div class="title">LANTERN<br><b>SEA</b></div><div class="sub">Ocean survival</div><div id="mbtns"></div><div class="foot">Build ${G.BUILD_VER} · procedural world · saves stored in this browser</div>`;
      const box = m.querySelector('#mbtns'); const add = (label, fn, dis) => { const b = el('button', 'mbtn', label); b.disabled = !!dis; b.onclick = () => { G.audio.init(); G.audio.sfx('click'); fn(); }; box.appendChild(b); return b; };
      const cont = add('Continue', () => G.saves.latest().then((s) => s && G.game.load(s.slot)), true);
      add('New Game', () => this.open('newgame')); add('Join Partner', () => this.open('join')); const load = add('Load Game', () => this.open('load'), true); add('Settings', () => this.open('settings')); add('Credits', () => this.open('credits')); add('Exit', () => this.open('exit'));
      G.saves.list().then((l) => { if (l.length) { cont.disabled = false; load.disabled = false; } });
    },
    hideMenu() { const m = G.$('#menu'); if (m) m.remove(); },
    loading(text, frac) { let l = G.$('#loading'); if (text == null) { if (l) l.remove(); return; } if (!l) { l = el('div'); l.id = 'loading'; l.innerHTML = '<h1>LANTERN SEA</h1><div class="muted" id="ldt"></div><div class="bar"><i></i></div>'; this.root.appendChild(l); } l.querySelector('#ldt').textContent = text; l.querySelector('i').style.width = (frac || 0) * 100 + '%'; }
  };
})();
