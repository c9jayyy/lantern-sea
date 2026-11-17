'use strict';
/* Game panels: inventory, crafting, building, storage, stations, research, chart, journal, dialogue, trading, sleep, story. */
(function () {
  const G = window.G, el = G.el, U = G.ui, P = U.panels;
  const div = (parent, cls, html) => { const d = el('div', cls, html); parent.appendChild(d); return d; };
  const EQ = ['head', 'face', 'body', 'back', 'feet', 'pack'], gsv = (d) => `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`, EQG = { head: gsv('M3 16h18M6 16c0-4.5 2.7-8 6-8s6 3.5 6 8'), face: gsv('M3 9h18v5a3 3 0 0 1-3 3h-2.5L12 14l-3.5 3H6a3 3 0 0 1-3-3z'), body: gsv('M8 4 4 7l2 3 2-1v11h8V9l2 1 2-3-4-3c0 1.7-1.3 3-4 3S8 5.7 8 4z'), back: gsv('M9 4h6v3H9zM8 7h8v13H8zM12 2v2'), feet: gsv('M7 4v10l-3 3v3h9v-2l-2-4V4zM15 9h4'), pack: gsv('M7 7a5 5 0 0 1 10 0M5 8h14v12H5zM9 13h6') };
  function equipSrc() {
    const inv = G.inv; return {
      size: 6, cols: 2, get: (i) => inv.equip[EQ[i]], accept: (s, i) => G.ITEMS[s.id].equip === EQ[i], ghost: (i) => EQG[EQ[i]], lab: (i) => EQ[i],
      set: (i, s) => { inv.equip[EQ[i]] = s; if (EQ[i] === 'pack' && !s) for (let k = 30; k < 40; k++) { const st = inv.slots[k]; if (!st) continue; inv.slots[k] = null; const left = G.cont.add(inv, st.id, st.n, st, 30); if (left > 0) G.drops.spawn(st.id, left, st); } G.emit('equip'); }
    };
  }
  function quickEquip(i) { const inv = G.inv, s = inv.slots[i]; if (!s) return; const d = G.ITEMS[s.id]; if (d.equip) { const old = inv.equip[d.equip]; inv.equip[d.equip] = s; inv.slots[i] = old || null; G.emit('equip'); } else if (d.food || d.med) G.actions.consume(i); }
  function invBlock(body, extra) { div(body, 'sect', 'Pack <span class="muted" style="text-transform:none;letter-spacing:0">— click to pick up and place · right-click splits · shift-click ' + (extra && extra.quickLabel || 'equips or uses') + '</span>'); U.grid(body, U.invSrc(extra)); }

  // ---------- inventory ----------
  const IS = { focus: null };
  function invDetail(box, st) {
    box.innerHTML = ''; if (!st) { div(box, 'muted ph', 'Point at an item to see what it does.'); return; }
    const d = G.ITEMS[st.id]; div(box, 'hero', `<div class="big">${d.i}</div><div><div class="cat">${{ mat: 'Material', food: 'Food', med: 'Medicine', tool: 'Tool', gear: 'Gear', story: 'Expedition', seed: 'Seeds' }[d.c] || d.c || ''}</div><h3>${d.n}${st.n > 1 ? ` <span class="muted">×${st.n}</span>` : ''}</h3><div class="muted desc">${d.d || ''}</div></div>`);
    div(box, 'stats', itemStats(d));
    if (st.dur != null && d.tool && d.tool.dur < 9000) { const f = st.dur / d.tool.dur; div(box, 'meterl', `<span>Condition</span><div class="pb"><i style="width:${f * 100}%;background:${f < .25 ? 'var(--bad)' : f < .6 ? '#ffd36b' : 'var(--good)'}"></i></div><b>${Math.ceil(st.dur)}/${d.tool.dur}</b>`); }
    if (d.food && d.food.spoil && st.made != null) { const left = Math.max(0, d.food.spoil - (G.time.now() - st.made)), f = left / d.food.spoil; div(box, 'meterl', `<span>Freshness</span><div class="pb"><i style="width:${f * 100}%;background:${f < .25 ? 'var(--bad)' : f < .6 ? '#ffd36b' : 'var(--good)'}"></i></div><b>${left > 48 ? Math.round(left / 24) + ' d' : Math.max(1, Math.round(left)) + ' h'}</b>`); }
    if (d.air && st.air != null) div(box, 'meterl', `<span>Air</span><div class="pb"><i style="width:${st.air / d.air * 100}%;background:#7fc8ff"></i></div><b>${Math.ceil(st.air)} s</b>`);
    if (d.c !== 'story') div(box, 'muted', G.tech.studied[st.id] ? 'Studied' : `<span class="glass">Not yet studied</span> · +${d.rv} insight at a research table`).style.cssText = 'font-size:.76em;margin-top:.6em';
    const uses = G.RECIPES.filter((x) => x.ing[st.id]); if (uses.length) { div(box, 'sect', 'Ingredient in'); const ul = div(box, 'uses'); for (const x of uses.slice(0, 12)) { const e = div(ul, 'use', G.ITEMS[x.out].i); e.title = G.ITEMS[x.out].n; e.onclick = () => { CS.sel = x.id; CS.cat = 'all'; CS.q = ''; U.open('craft'); }; } }
  }
  P.inventory = {
    title: 'Inventory',
    render(body) {
      body.classList.add('invui'); const pl = G.player, inv = G.inv;
      const cols = div(body, 'inv-cols'), L = div(cols, 'inv-l'), M = div(cols, 'inv-m'), R = div(cols, 'inv-r');
      // worn gear
      div(L, 'sect', 'Worn'); U.grid(L, Object.assign(equipSrc(), { gcls: 'eqg', hover: (i, st) => { IS.focus = st ? { src: 'eq', i } : IS.focus; invDetail(R, st); }, noTip: true }));
      // body readout
      div(L, 'sect', 'Body'); const bm = div(L, 'bmeters');
      for (const [k, n, c] of [['hp', 'Health', '#ef5b4c'], ['hunger', 'Food', '#e9a54d'], ['thirst', 'Water', '#4fb4ec'], ['stamina', 'Stamina', '#b6e27c'], ['energy', 'Rest', '#a897ec']]) { const v = Math.round(pl[k]); div(bm, 'bm' + (v < 22 ? ' low' : ''), `<span>${n}</span><div class="pb"><i style="width:${v}%;background:${c}"></i></div><b>${v}</b>`); }
      const kv = div(L, 'kv2'); const row = (a, b) => { kv.appendChild(el('span', '', a)); kv.appendChild(el('b', '', b)); };
      row('Feels like', Math.round(pl.feels) + '°C' + (pl.temp > 45 ? ' <span class="bad">hot</span>' : pl.temp < -45 ? ' <span class="bad">cold</span>' : '')); row('Armour', Math.round(pl.armor() * 100) + '%'); row('Breath', Math.round(pl.airMax) + ' s'); row('Pack', inv.size() + ' slots');
      const cs = Object.keys(pl.cond); row('Ailments', cs.length ? '<span class="bad">' + cs.join(', ') + '</span>' : '<span class="good">none</span>'); row('Insight', '<span class="glass">' + G.tech.points + '</span>');
      // pack
      const top = div(M, 'inv-top'); const sr = el('input'); sr.type = 'text'; sr.placeholder = 'Search pack…'; top.appendChild(sr);
      const used = inv.slots.slice(0, inv.size()).filter(Boolean).length; div(top, 'cap', `<b>${used}</b> / ${inv.size()}`);
      U.btn(top, 'Sort', () => { G.cont.sort(inv, 9, inv.size()); U.refresh(); }, 'small'); U.btn(top, 'Drop held', () => { if (U.carry) { G.drops.spawn(U.carry.id, U.carry.n, U.carry); U.setCarry(null); } }, 'small');
      const g = U.grid(M, U.invSrc({ quick: quickEquip, gcls: 'packg', noTip: true, hover: (i, st) => invDetail(R, st) }));
      sr.oninput = () => { const q = sr.value.toLowerCase(); [...g.children].forEach((c, i) => { const s = inv.slots[i]; c.classList.toggle('dim', !!q && !(s && G.ITEMS[s.id].n.toLowerCase().includes(q))); }); };
      div(M, 'hint muted', 'Top row is the hotbar (1–9, mouse wheel) · drag or click to move · right-click splits a stack · shift-click equips, eats or applies');
      invDetail(R, null);
    }
  };

  // ---------- crafting ----------
  const CS = { cat: 'all', q: '', sel: null, only: false, n: 1 };
  const SVG = (d) => `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`;
  const CAT_IC = {
    all: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', basics: 'M4 8l8-4 8 4-8 4zM4 12l8 4 8-4M4 16l8 4 8-4', tools: 'M14.5 5.5a4 4 0 0 0 4.9 4.9L11 19a2.1 2.1 0 0 1-3-3l8.6-8.4a4 4 0 0 0-2.1-2.1z',
    gear: 'M8 4 4 7l2 3 2-1v11h8V9l2 1 2-3-4-3c0 1.7-1.3 3-4 3S8 5.7 8 4z', medical: 'M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z', food: 'M7 3v7a2.5 2.5 0 0 0 5 0V3M9.5 3v18M17 21V3c-2.2 1.2-3.2 3.6-3.2 6.5 0 2 1.2 3 3.2 3',
    industry: 'M3 21V10l5 3V10l5 3V6h3l1 4h4v11z', boats: 'M3 16h18l-2 4H5zM12 3v13M12 4l6 9h-6', story: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z', fav: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z'
  };
  const ST_IC = { workbench: 'M3 10h18M5 10v9M19 10v9M7 10V6h4v4', fire: 'M12 21c-3.9 0-6-2.6-6-5.7 0-3.6 3-5.3 3.5-8.8 2.4 1.4 3.5 3.6 3.6 5.4.9-.6 1.6-1.9 1.7-3.1 2.1 1.7 3.2 4 3.2 6.5 0 3.1-2.1 5.7-6 5.7z', grill: 'M4 10h16M6 10v2a6 6 0 0 0 12 0v-2M8 20l2-4M16 20l-2-4', forge: 'M4 20h16M6 20V9l6-5 6 5v11M10 20v-5h4v5', machine: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2' };
  const LOCK = 'M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3';
  function maxCraft(r) { let m = 999; for (const k in r.ing) m = Math.min(m, Math.floor(G.inv.countAll(k) / r.ing[k])); return Math.max(0, m); }
  function itemStats(d) {
    const out = [], chip = (lab, val, cls) => out.push(`<div class="stc ${cls || ''}"><span>${lab}</span><b>${val}</b></div>`);
    if (d.food) { if (d.food.h) chip('Food', (d.food.h > 0 ? '+' : '') + d.food.h, 'f-h'); if (d.food.t) chip('Water', (d.food.t > 0 ? '+' : '') + d.food.t, 'f-t'); if (d.food.hp) chip('Health', (d.food.hp > 0 ? '+' : '') + d.food.hp, 'f-hp'); chip('Keeps', d.food.spoil ? (d.food.spoil >= 48 ? Math.round(d.food.spoil / 24) + ' days' : d.food.spoil + ' h') : 'forever'); if (d.food.sick) chip('Risk', Math.round(d.food.sick * 100) + '%', 'bad'); }
    if (d.med) { chip('Treats', d.med.cure.length ? d.med.cure.join(', ') : '—', 'good'); if (d.med.hp) chip('Health', '+' + d.med.hp, 'f-hp'); }
    if (d.tool) { if (d.tool.dur < 9000) chip('Durability', d.tool.dur); if (d.tool.dmg) chip('Damage', d.tool.dmg); if (d.tool.tier != null) chip('Tier', d.tool.tier + 1); }
    if (d.equip) chip('Worn on', d.equip); if (d.armor) chip('Armour', Math.round(d.armor * 100) + '%'); if (d.warm != null && d.c === 'gear') chip('Wind chill', '−' + Math.round((1 - d.warm) * 100) + '%'); if (d.shade) chip('Shade', Math.round(d.shade * 100) + '%'); if (d.rainproof) chip('Rain', 'proof'); if (d.swim) chip('Swim', '×' + d.swim); if (d.air) chip('Air', d.air + ' s'); if (d.slots) chip('Slots', '+' + d.slots); if (d.fuel) chip('Burns', d.fuel + ' s');
    chip('Value', d.v, 'brass'); return out.join('');
  }
  P.craft = {
    title: 'Crafting',
    render(body) {
      const st = G.craft.stations(); G.inv._st = G.inv.storages(); body.classList.add('craftui');
      const head = div(body, 'craft-top'); const sr = el('input'); sr.type = 'text'; sr.placeholder = 'Search ' + G.RECIPES.length + ' recipes…'; sr.value = CS.q; head.appendChild(sr);
      const tog = div(head, 'toggle' + (CS.only ? ' on' : ''), '<i></i>Craftable now'); tog.onclick = () => { CS.only = !CS.only; U.refresh(); };
      const stl = div(head, 'stations'); for (const k of ['workbench', 'fire', 'forge', 'machine']) { const on = st[k] || (k === 'fire' && st.grill), cold = st[k + '_cold']; const e = div(stl, 'stn' + (on ? ' on' : cold ? ' cold' : ''), SVG(ST_IC[k])); U.tipOn(e, `<b>${G.STATION_NAMES[k]}</b><br><span class="muted">${on ? 'In reach' : cold ? 'In reach but unlit — add fuel' : 'Not in reach'}</span>`); }
      const cols = div(body, 'craft-cols'), rail = div(cols, 'rail'), list = div(cols, 'tiles scroll'), det = div(cols, 'cdet');
      const avail = (r) => (!G.TECH[r.tech] || !G.TECH[r.tech].flag || G.tech.flags[G.TECH[r.tech].flag] || G.tech.has(r.tech));
      const cats = G.RECIPE_CATS.concat([['fav', 'Favourites']]);
      for (const [id, n] of cats) { const rs = G.RECIPES.filter((r) => avail(r) && (id === 'all' || (id === 'fav' ? G.craft.fav[r.id] : r.cat === id))); const ok = rs.filter((r) => G.craft.status(r, st) === 'ok').length; const c = div(rail, 'rc' + (CS.cat === id ? ' on' : ''), `${SVG(CAT_IC[id] || CAT_IC.all)}<span>${n}</span><em>${ok ? '<b>' + ok + '</b>/' : ''}${rs.length}</em>`); c.onclick = () => { CS.cat = id; U.refresh(); }; }
      const rank = { ok: 0, mats: 1, station: 2, tech: 3 };
      const draw = () => {
        list.innerHTML = ''; const q = CS.q.toLowerCase();
        let rs = G.RECIPES.filter((r) => avail(r) && (CS.cat === 'all' || (CS.cat === 'fav' ? G.craft.fav[r.id] : r.cat === CS.cat)) && (!q || G.ITEMS[r.out].n.toLowerCase().includes(q) || Object.keys(r.ing).some((k) => G.ITEMS[k].n.toLowerCase().includes(q)))).map((r) => ({ r, s: G.craft.status(r, st) }));
        if (CS.only) rs = rs.filter((x) => x.s === 'ok');
        rs.sort((a, b) => (G.craft.fav[b.r.id] ? 1 : 0) - (G.craft.fav[a.r.id] ? 1 : 0) || rank[a.s] - rank[b.s] || G.ITEMS[a.r.out].n.localeCompare(G.ITEMS[b.r.out].n));
        if (!rs.length) div(list, 'empty muted', CS.only ? 'Nothing you can make right now.' : 'Nothing matches.');
        if (!CS.sel && rs.length) CS.sel = rs[0].r.id;
        const dup = {}; for (const r of G.RECIPES) dup[r.out] = (dup[r.out] || 0) + 1;
        for (const { r, s } of rs) {
          const d = G.ITEMS[r.out], via = dup[r.out] > 1 ? `<small>from ${G.ITEMS[Object.keys(r.ing).sort((a, b) => r.ing[b] - r.ing[a])[0]].n.toLowerCase()}</small>` : ''; const badge = s === 'tech' ? SVG(LOCK) : s === 'station' ? SVG(ST_IC[r.st === 'grill' ? 'grill' : r.st] || ST_IC.workbench) : '';
          const c = div(list, 'tile s-' + s + (CS.sel === r.id ? ' on' : ''), `<span class="ic">${d.i}</span>${r.q > 1 ? `<span class="q">×${r.q}</span>` : ''}${badge ? `<span class="bdg">${badge}</span>` : ''}${G.craft.fav[r.id] ? '<span class="fv">★</span>' : ''}<span class="nm">${d.n}${via}</span>`);
          c.onclick = () => { CS.sel = r.id; CS.n = 1; U.refresh(); }; c.ondblclick = () => { if (G.craft.start(r, 1)) U.refresh(); else G.audio.sfx('deny'); };
        }
      };
      draw(); sr.oninput = () => { CS.q = sr.value; draw(); }; setTimeout(() => { if (CS.q) { sr.focus(); sr.setSelectionRange(sr.value.length, sr.value.length); } }, 0);
      const r = G.RECIPES.find((x) => x.id === CS.sel);
      if (!r) div(det, 'muted', 'Select a recipe. Crafting draws on your pack and any storage within a few paces.');
      else {
        const d = G.ITEMS[r.out], s = G.craft.status(r, st), mx = maxCraft(r);
        div(det, 'hero', `<div class="big">${d.i}</div><div><div class="cat">${(G.RECIPE_CATS.find((c) => c[0] === r.cat) || ['', ''])[1]}</div><h3>${d.n}${r.q > 1 ? ` <span class="muted">×${r.q}</span>` : ''}</h3><div class="muted desc">${d.d || ''}</div></div>`);
        div(det, 'stats', itemStats(d));
        div(det, 'sect', 'Requires'); const ing = div(det, 'ings');
        for (const k in r.ing) { const have = G.inv.countAll(k), need = r.ing[k] * Math.max(1, CS.n), ok = have >= need; const row = div(ing, 'ing' + (ok ? ' ok' : ''), `<span class="ic">${G.ITEMS[k].i}</span><span class="nm">${G.ITEMS[k].n}</span><span class="ct"><b>${Math.min(have, 9999)}</b> / ${need}</span><div class="pb"><i style="width:${Math.min(100, have / need * 100)}%"></i></div>`); U.tipOn(row, () => U.itemTip({ id: k, n: 1 })); row.onclick = () => { const rr = G.RECIPES.find((x) => x.out === k); if (rr) { CS.sel = rr.id; CS.cat = 'all'; CS.q = ''; U.refresh(); } }; }
        if (r.also) div(det, 'muted', 'Also yields ' + Object.keys(r.also).map((k) => `${G.ITEMS[k].i} ${G.ITEMS[k].n} ×${r.also[k]}`).join(', ')).style.cssText = 'font-size:.82em;margin-top:.4em';
        const req = div(det, 'reqs');
        if (r.st) div(req, 'req ' + (st[r.st] ? 'ok' : 'no'), `${SVG(ST_IC[r.st] || ST_IC.workbench)}<span>${G.STATION_NAMES[r.st]}</span><em>${st[r.st] ? 'in reach' : st[r.st + '_cold'] ? 'unlit — add fuel' : 'not in reach'}</em>`);
        if (r.tech && G.TECH[r.tech]) div(req, 'req ' + (G.tech.has(r.tech) ? 'ok' : 'no'), `${SVG(LOCK)}<span>${G.TECH[r.tech].n}</span><em>${G.tech.has(r.tech) ? 'known' : 'research needed'}</em>`);
        div(req, 'req', `${SVG('M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z')}<span>Time</span><em>${r.t} s each</em>`);
        const act = div(det, 'cact'); const qty = div(act, 'qty'); const dec = el('button', 'qb', '−'), num = el('span', 'qn', String(CS.n)), inc = el('button', 'qb', '+'), all = el('button', 'qb mx', 'Max'); qty.append(dec, num, inc, all);
        dec.onclick = () => { CS.n = Math.max(1, CS.n - 1); U.refresh(); }; inc.onclick = () => { CS.n = Math.min(Math.max(1, mx), CS.n + 1); U.refresh(); }; all.onclick = () => { CS.n = Math.max(1, mx); U.refresh(); };
        const go = U.btn(act, s === 'ok' ? `Craft${CS.n > 1 ? ' ×' + CS.n : ''}` : { mats: 'Missing materials', station: 'Needs a station', tech: 'Not yet known' }[s], () => { const m = G.craft.start(r, CS.n); if (!m) G.audio.sfx('deny'); CS.n = 1; U.refresh(); }, 'primary go'); go.disabled = s !== 'ok';
        const tg = div(det, 'row'); tg.style.cssText = 'gap:.4em;margin-top:.5em';
        U.btn(tg, (G.craft.fav[r.id] ? '★ Favourite' : '☆ Favourite'), () => { if (G.craft.fav[r.id]) delete G.craft.fav[r.id]; else G.craft.fav[r.id] = 1; U.refresh(); }, 'small' + (G.craft.fav[r.id] ? ' on' : ''));
        U.btn(tg, G.craft.tracked === r.id ? 'Tracking on HUD' : 'Track on HUD', () => { G.craft.tracked = G.craft.tracked === r.id ? null : r.id; U.refresh(); }, 'small' + (G.craft.tracked === r.id ? ' on' : ''));
        const uses = G.RECIPES.filter((x) => x.ing[r.out] && avail(x)); if (uses.length) { div(det, 'sect', 'Used to make'); const ul = div(det, 'uses'); for (const x of uses.slice(0, 14)) { const e = div(ul, 'use', G.ITEMS[x.out].i); U.tipOn(e, `<b>${G.ITEMS[x.out].n}</b>`); e.onclick = () => { CS.sel = x.id; CS.n = 1; U.refresh(); }; } }
      }
      if (G.craft.queue.length) { const qd = div(det, 'queue'); div(qd, 'sect', 'Crafting queue'); const row = div(qd, 'qrow'); G.craft.queue.slice(0, 10).forEach((q, i) => { const out = G.RECIPES.find((x) => x.id === q.id).out; div(row, 'qi' + (i ? '' : ' cur'), `${G.ITEMS[out].i}${i ? '' : `<div class="pb"><i id="qprog" style="width:${q.t / q.need * 100}%"></i></div>`}`); }); if (G.craft.queue.length > 10) div(row, 'muted', '+' + (G.craft.queue.length - 10)); }
      G.inv._st = null;
    },
    tick() { const q = G.craft.queue[0], e = G.$('#qprog'); if (this._ql !== G.craft.queue.length) { this._ql = G.craft.queue.length; if (!U.carry) return U.refresh(); } if (q && e) e.style.width = Math.min(100, q.t / q.need * 100) + '%'; }
  };

  // ---------- build menu ----------
  let buildCat = 'structure';
  P.build = {
    title: 'Construction', noLock: false,
    render(body) {
      body.classList.add('buildui');
      const tabs = div(body, 'tabs'); for (const [id, n] of G.BUILD_CATS) { const cnt = Object.values(G.BUILD).filter((d) => d.cat === id).length; const t = div(tabs, 'tab' + (buildCat === id ? ' on' : ''), `${n} <span class="muted">${cnt}</span>`); t.onclick = () => { buildCat = id; U.refresh(); }; }
      const hasMallet = G.inv.slots.some((s) => s && s.id === 'mallet'); if (!hasMallet) div(body, 'warnbar', `You need a <b>Builder's Mallet</b> in your pack to build — craft one first <span class="kbd">${G.keyLabel(G.settings.bindings.craft)}</span>`);
      const grid = div(body, 'btiles scroll'); G.inv._st = G.inv.storages();
      for (const id in G.BUILD) {
        const d = G.BUILD[id]; if (d.cat !== buildCat) continue; const known = G.tech.has(d.tech), cost = G.build.cost(d), can = known && !G.build.missing(cost).length;
        const costs = Object.keys(cost).map((k) => { const have = G.inv.countAll(k); return `<span class="bc${have >= cost[k] ? '' : ' no'}">${G.ITEMS[k].i}<b>${cost[k]}</b></span>`; }).join('');
        const c = div(grid, 'btile' + (known ? '' : ' locked') + (can ? ' can' : ''), `<div class="bimg">${d.i}</div><div class="bn">${d.n}</div><div class="bcost">${known ? costs : `<span class="lk">Needs ${G.TECH[d.tech].n}</span>`}</div>`);
        U.tipOn(c, () => `<b>${d.n}</b><br><span class="muted">${d.d || ''}</span>${d.raftOnly ? '<br><span class="glass">Raft only</span>' : ''}<br>${U.costHtml(cost)}`);
        c.onclick = () => { if (!known) return G.audio.sfx('deny'); U.close(); G.build.enter(id); };
      }
      G.inv._st = null; const f = div(body, 'row between'); f.style.marginTop = '.9em'; div(f, 'muted', 'Pieces snap to your raft or island base. Equipment can also stand directly on land. R rotates while placing.').style.fontSize = '.8em'; U.btn(f, 'Dismantle mode', () => { U.close(); G.build.enterDemolish(); }, 'small danger');
    }
  };

  // ---------- storage ----------
  P.storage = {
    title: (it) => it.name || G.BUILD[it.type].n,
    render(body, it) {
      const c = it.s.c, inv = G.inv; const src = { size: c.slots.length, cols: Math.min(8, c.slots.length), get: (i) => c.slots[i], set: (i, s) => { c.slots[i] = s; }, quick: (i) => { const s = c.slots[i]; const left = G.cont.add(inv, s.id, s.n, s, inv.size()); if (left) s.n = left; else c.slots[i] = null; } };
      const top = div(body, 'row between'); div(top, 'sect', 'Contents').style.cssText = 'margin:0;flex:1'; const b = div(top, 'row');
      U.btn(b, 'Take all', () => { c.slots.forEach((s, i) => { if (!s) return; const left = G.cont.add(inv, s.id, s.n, s, inv.size()); if (left) s.n = left; else c.slots[i] = null; }); U.refresh(); }, 'small');
      U.btn(b, 'Store matching', () => { for (let i = 9; i < inv.size(); i++) { const s = inv.slots[i]; if (!s || !c.slots.some((x) => x && x.id === s.id)) continue; const left = G.cont.add(c, s.id, s.n, s); if (left) s.n = left; else inv.slots[i] = null; } U.refresh(); }, 'small');
      U.btn(b, 'Sort', () => { G.cont.sort(c, 0, c.slots.length); U.refresh(); }, 'small'); U.grid(body, src).style.margin = '.5em 0 .3em';
      invBlock(body, { quickLabel: 'moves between pack and storage', quick: (i) => { const s = inv.slots[i]; const left = G.cont.add(c, s.id, s.n, s); if (left) s.n = left; else inv.slots[i] = null; } });
    }
  };

  // ---------- processors (fire, smoker, rack, furnace, still, recycler, composter) ----------
  P.processor = {
    title: (it) => G.BUILD[it.type].n,
    render(body, it, cur) {
      const d = G.BUILD[it.type], s = it.s, recs = G.PROCESS[d.proc], inv = G.inv; const okIn = (st) => recs.some((r) => r[0] === st.id);
      const row = div(body, 'row'); row.style.cssText = 'gap:2em;align-items:flex-start;margin-bottom:.4em';
      const a = div(row, ''); div(a, 'sect', 'Input'); U.grid(a, { size: d.slots, cols: d.slots, get: (i) => s.in[i], set: (i, st) => { if (st) st.t = 0; s.in[i] = st; }, accept: okIn });
      const pb = div(a, ''); pb.id = 'procbars'; pb.style.cssText = 'display:grid;grid-template-columns:repeat(' + d.slots + ',3.5em);gap:.3em;margin-top:.3em'; for (let i = 0; i < d.slots; i++) div(pb, 'bar', '<i style="width:0"></i>');
      const o = div(row, ''); div(o, 'sect', 'Output'); U.grid(o, { size: d.slots, cols: d.slots, get: (i) => s.out[i], set: (i, st) => { s.out[i] = st; }, accept: () => false, swap: false, quick: (i) => { const st = s.out[i]; const left = G.cont.add(inv, st.id, st.n, st, inv.size()); if (left) st.n = left; else s.out[i] = null; } });
      if (d.fueled) { const f = div(row, ''); div(f, 'sect', 'Fuel'); U.grid(f, { size: 1, cols: 1, get: () => s.fuel, set: (i, st) => { s.fuel = st; }, accept: (st) => !!G.ITEMS[st.id].fuel, ghost: () => '🪵' }); const fb = div(f, 'bar', '<i></i>'); fb.id = 'burnbar'; fb.style.cssText = 'width:3.5em;margin-top:.3em'; }
      if (d.power < 0) div(body, it.struct.powered ? 'good' : 'bad', it.struct.powered ? '⚡ Powered' : '⚡ No power — build solar panels, a wind turbine or a generator on this structure');
      if (d.proc === 'rack' || d.proc === 'still') div(body, 'muted', 'Works by sun and wind: slow at night, quickest on a bright breezy day.');
      div(body, 'muted', 'Accepts: ' + recs.map((r) => `${G.ITEMS[r[0]].i}${r[1] > 1 ? '×' + r[1] : ''} → ${G.ITEMS[r[2]].i}`).join(' &nbsp; ')).style.cssText = 'font-size:.9em;margin:.5em 0';
      invBlock(body, { quickLabel: 'loads the station', quick: (i) => { const st = inv.slots[i], def = G.ITEMS[st.id]; if (okIn(st)) { for (let k = 0; k < d.slots; k++) { if (!s.in[k]) { s.in[k] = st; st.t = 0; inv.slots[i] = null; return; } if (s.in[k].id === st.id && s.in[k].n < def.s) { const m = Math.min(st.n, def.s - s.in[k].n); s.in[k].n += m; st.n -= m; if (st.n <= 0) { inv.slots[i] = null; return; } } } } else if (d.fueled && def.fuel) { if (!s.fuel) { s.fuel = st; inv.slots[i] = null; } else if (s.fuel.id === st.id) { const m = Math.min(st.n, def.s - s.fuel.n); s.fuel.n += m; st.n -= m; if (st.n <= 0) inv.slots[i] = null; } } } });
      cur.sig = this.sig(it);
    },
    sig(it) { const s = it.s; return s.in.map((x) => x ? x.id + x.n : '-').join() + '|' + s.out.map((x) => x ? x.id + x.n : '-').join() + '|' + (s.fuel ? s.fuel.n : 0); },
    tick(it, cur) {
      const d = G.BUILD[it.type], s = it.s, recs = G.PROCESS[d.proc]; if (!U.carry && this.sig(it) !== cur.sig) return U.refresh();
      const pb = G.$('#procbars'); if (pb) for (let i = 0; i < d.slots; i++) { const st = s.in[i], r = st && recs.find((x) => x[0] === st.id); pb.children[i].firstChild.style.width = (r ? Math.min(100, (st.t || 0) / r[4] * 100) : 0) + '%'; }
      const bb = G.$('#burnbar'); if (bb) { bb.firstChild.style.width = Math.min(100, s.burn / 70 * 100) + '%'; bb.firstChild.style.background = '#ff9a4a'; }
    }
  };

  // ---------- research ----------
  P.research = {
    title: 'Research Desk',
    render(body) {
      const T = G.tech, inv = G.inv; const cols = div(body, 'cols'), L = div(cols, 'col'); L.style.width = '17em'; const R = div(cols, 'col grow');
      div(L, '', `<div class="muted">Insight</div><div class="glass" style="font-family:var(--serif);font-size:2.4em;line-height:1">${T.points}</div>`); div(L, 'sect', 'Study specimens');
      const seen = {}, list = []; for (let i = 0; i < inv.size(); i++) { const s = inv.slots[i]; if (s && !T.studied[s.id] && !seen[s.id]) { seen[s.id] = 1; list.push(s.id); } }
      if (!list.length) div(L, 'muted', 'Nothing new in your pack. Every kind of item can be studied once — bring back things you have not seen before.');
      else { U.btn(L, `Study all (+${list.reduce((a, id) => a + G.ITEMS[id].rv, 0)})`, () => { let t = 0; for (const id of list) t += T.study(id); G.audio.sfx('discover'); G.skills.xp('crafting', t); U.refresh(); }, 'primary small').style.marginBottom = '.5em'; const sc = div(L, 'scroll'); sc.style.maxHeight = '46vh'; for (const id of list) { const d = G.ITEMS[id]; const c = div(sc, 'card', `<span class="ic">${d.i}</span><span>${d.n}</span><span class="st glass">+${d.rv}</span>`); c.onclick = () => { T.study(id); G.audio.sfx('page'); U.refresh(); }; } }
      div(L, 'muted', 'Studying does not consume the item. Notes, new creatures, new fish and discoveries also grant insight.').style.cssText = 'font-size:.8em;margin-top:.6em';
      for (let tier = 1; tier <= 5; tier++) {
        div(R, 'sect', ['', 'I — Primitive survival', 'II — Sustainable living', 'III — Industry and seafaring', 'IV — Power and depth', 'V — The deep ocean'][tier]); const row = div(R, 'techtier');
        for (const id in G.TECH) {
          const t = G.TECH[id]; if (t.tier !== tier) continue; if (t.cost === 0 && !T.known[id]) continue; const known = T.known[id], can = T.canUnlock(id), bp = t.flag && !T.flags[t.flag];
          const c = div(row, 'tech ' + (known ? 'known' : can ? 'can' : 'no'), `<b>${t.i} ${t.n}</b><div class="muted" style="font-size:.85em">${t.d}</div><div style="font-size:.85em;margin-top:.2em">${known ? '<span class="good">Learned</span>' : bp ? '<span class="bad">Needs a blueprint found in the world</span>' : (t.req.filter((r) => !T.known[r]).length ? '<span class="bad">Requires ' + t.req.filter((r) => !T.known[r]).map((r) => G.TECH[r].n).join(', ') + '</span> · ' : '') + '<span class="' + (T.points >= t.cost ? 'glass' : 'bad') + '">' + t.cost + ' insight</span>'}</div>`);
          c.onclick = () => { if (T.unlock(id)) U.refresh(); else if (!known) G.audio.sfx('deny'); };
        }
      }
    }
  };

  // ---------- chart ----------
  P.map = {
    title: 'Nautical Chart',
    render(body) {
      const M = G.map, W = M.WORLD, S = Math.min(Math.floor(innerHeight * 0.74), 700); const wrap = div(body, 'map-wrap'); const cv = el('canvas'); cv.width = cv.height = S; wrap.appendChild(cv); const g = cv.getContext('2d');
      const info = div(body, 'row between'); info.style.marginTop = '.5em'; const pos = div(info, 'muted', ''); div(info, 'muted', 'Left-click: place or remove a marker · Right-click: set or clear your waypoint ⚑').style.fontSize = '.84em';
      const X = (x) => (x + W) / (2 * W) * S, P0 = G.player;
      const draw = () => {
        if (!M.base) M.buildBase(); g.imageSmoothingEnabled = true; g.drawImage(M.base, 0, 0, S, S);
        const fc = document.createElement('canvas'); fc.width = fc.height = M.MAPN; const fg = fc.getContext('2d'), im = fg.createImageData(M.MAPN, M.MAPN); for (let i = 0; i < M.fog.length; i++) { im.data[i * 4] = 16; im.data[i * 4 + 1] = 30; im.data[i * 4 + 2] = 44; im.data[i * 4 + 3] = M.fog[i] ? 0 : 246; } fg.putImageData(im, 0, 0); g.drawImage(fc, 0, 0, S, S);
        g.strokeStyle = 'rgba(201,167,101,.13)'; g.lineWidth = 1; for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(i * S / 8, 0); g.lineTo(i * S / 8, S); g.moveTo(0, i * S / 8); g.lineTo(S, i * S / 8); g.stroke(); }
        g.textAlign = 'center'; g.font = `${Math.round(S / 58)}px Georgia`;
        const K = G.world.story.keystone; if (K && (M.known[K.id] || G.journal.places[K.id]) && !G.game.flags.eyeCalm) { g.strokeStyle = 'rgba(255,141,122,.5)'; g.setLineDash([5, 5]); g.beginPath(); g.arc(X(K.x), X(K.z), (G.game.flags.eyeSmall ? 420 : 1000) / (2 * W) * S, 0, 6.28); g.stroke(); g.setLineDash([]); }
        for (const I of G.world.islands) { const disc = G.journal.places[I.id]; if (!disc && !M.known[I.id]) continue; const x = X(I.x), y = X(I.z); if (!disc) { g.strokeStyle = 'rgba(223,233,238,.6)'; g.setLineDash([3, 3]); g.beginPath(); g.arc(x, y, Math.max(5, I.r / (2 * W) * S), 0, 6.28); g.stroke(); g.setLineDash([]); } g.fillStyle = disc ? '#fff6e0' : 'rgba(223,233,238,.7)'; g.fillText(disc ? I.name : '?', x, y - I.r / (2 * W) * S - 4); if (I.story === 'haven' && disc) g.fillText('🏠', x, y + 4); if (I.story && I.story.startsWith('lantern') && G.game.flags[I.story]) g.fillText('💡', x, y + 4); }
        for (const p of G.world.pois) { if (!G.journal.places[p.id] && !M.known[p.id]) continue; g.fillStyle = '#7fd6cf'; g.fillText({ wreck: '⚓', plane: '✈', yacht: '⛵', reef: '🪸', kelp: '🌿', buoy: '◉', rig: '🏗', cache: '✦', calloway: '⚓', deepwell: '🔬', keystone: '🗝' }[p.poi] || '•', X(p.x), X(p.z) + 4); if (G.journal.places[p.id] || p.story) g.fillText(p.name, X(p.x), X(p.z) - 8); }
        for (const st of G.structs.list) { if (st.kind === 'ground') continue; g.fillText(st.kind === 'raft' ? '⛵' : '🏕', X(st.pos.x), X(st.pos.z) + 4); } for (const v of G.vehicles.list) g.fillText('🚣', X(v.x), X(v.z) + 4);
        for (const m of M.markers) { g.fillStyle = '#ffd36b'; g.fillText('✚', X(m.x), X(m.z) + 4); } if (M.waypoint) { g.fillStyle = '#7fd6cf'; g.fillText('⚑', X(M.waypoint.x), X(M.waypoint.z) + 4); g.strokeStyle = 'rgba(127,214,207,.5)'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(X(P0.pos.x), X(P0.pos.z)); g.lineTo(X(M.waypoint.x), X(M.waypoint.z)); g.stroke(); g.setLineDash([]); }
        for (const m of G.quests.markers()) { g.fillStyle = m.main ? '#ffcf6b' : '#9fe8e0'; g.font = `${Math.round(S / 40)}px Georgia`; g.fillText(m.main ? '◆' : '◇', X(m.x), X(m.z) + 5); g.font = `${Math.round(S / 58)}px Georgia`; g.fillText(m.name || '', X(m.x), X(m.z) + 18); }
        g.save(); g.translate(X(P0.pos.x), X(P0.pos.z)); g.rotate(-P0.yaw); g.fillStyle = '#ff6b57'; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.fill(); g.stroke(); g.restore();
        g.fillStyle = '#c9a765'; g.font = `${Math.round(S / 34)}px Georgia`; g.fillText('N', S - 26, 30); g.beginPath(); g.moveTo(S - 26, 36); g.lineTo(S - 26, 62); g.strokeStyle = '#c9a765'; g.stroke(); g.fillRect(16, S - 22, 500 / (2 * W) * S, 3); g.textAlign = 'left'; g.font = `${Math.round(S / 60)}px Georgia`; g.fillText('500 m', 16, S - 28);
      };
      draw(); const world = (e) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width * 2 - 1) * W, z: ((e.clientY - r.top) / r.height * 2 - 1) * W }; };
      cv.onmousemove = (e) => { const w = world(e); pos.textContent = `${Math.round(w.x)} E, ${Math.round(-w.z)} N — ${Math.round(Math.hypot(w.x - P0.pos.x, w.z - P0.pos.z))} m from you`; };
      cv.oncontextmenu = (e) => { e.preventDefault(); const w = world(e); M.waypoint = M.waypoint && Math.hypot(M.waypoint.x - w.x, M.waypoint.z - w.z) < 120 ? null : w; draw(); };
      cv.onclick = (e) => { const w = world(e), i = M.markers.findIndex((m) => Math.hypot(m.x - w.x, m.z - w.z) < 110); if (i >= 0) M.markers.splice(i, 1); else if (M.markers.length < 30) M.markers.push(w); draw(); };
    }
  };

  // ---------- journal ----------
  let jTab = 'story', jNote = null;
  P.journal = {
    title: 'Journal',
    render(body) {
      const tabs = div(body, 'tabs'); for (const [id, n] of [['story', 'Story'], ['side', 'Missions'], ['notes', 'Notes'], ['places', 'Places'], ['life', 'Creatures'], ['fish', 'Fish'], ['skills', 'Skills'], ['guide', 'Survival'], ['log', 'Records']]) { const t = div(tabs, 'tab' + (jTab === id ? ' on' : ''), n); t.onclick = () => { jTab = id; U.refresh(); }; }
      const B = div(body, 'scroll'); B.style.cssText = 'width:54em;max-width:86vw;height:60vh;padding-right:.5em'; const Q = G.quests, J = G.journal;
      const quest = (id, done) => { const d = G.QUESTS[id]; let h = `<b class="${done ? 'muted' : 'brass'}" style="font-family:var(--serif);font-size:1.15em">${done ? '✓ ' : ''}${d.title}</b><div class="muted">${d.desc}</div>`; if (!done) { const a = Q.active[id]; d.steps.forEach((s, i) => { h += `<div style="margin-left:1em" class="${i < a.step ? 'muted' : i === a.step ? '' : 'muted'}">${i < a.step ? '✓' : i === a.step ? '▸' : '·'} ${typeof s.t === 'function' ? s.t(a.S) : s.t}</div>`; }); } div(B, '', h).style.marginBottom = '.8em'; };
      if (jTab === 'story' || jTab === 'side') { const main = jTab === 'story'; if (main) div(B, '', `<h3 class="brass">Chapter ${Q.chapter()} — ${G.CHAPTERS[Q.chapter()]}</h3>`).style.marginBottom = '.7em'; const act = Q.order.filter((id) => !!G.QUESTS[id].ch === main); div(B, 'sect', 'Active'); if (!act.length) div(B, 'muted', main ? 'Nothing pressing. The sea is yours.' : 'No side missions. Talk to people; read what you find.'); act.forEach((id) => quest(id)); const dn = Object.keys(Q.done).filter((id) => !!G.QUESTS[id].ch === main); if (dn.length) { div(B, 'sect', 'Completed'); dn.reverse().forEach((id) => quest(id, true)); } }
      else if (jTab === 'notes') { if (!J.notes.length) return div(B, 'muted', 'You have found no writings or recordings yet.'); const cols = div(B, 'cols'), L = div(cols, 'col'); L.style.width = '19em'; const R = div(cols, 'col grow'); for (const id of J.notes) { const n = G.NOTES[id]; const c = div(L, 'card' + (jNote === id ? ' on' : ''), `<div>${n.t}<div class="muted" style="font-size:.8em">${n.by}</div></div>`); c.onclick = () => { jNote = id; U.refresh(); }; } const n = G.NOTES[jNote] || G.NOTES[J.notes[J.notes.length - 1]]; div(R, '', `<h3 class="brass">${n.t}</h3><div class="muted" style="margin-bottom:.6em">${n.by}</div><div class="notetext">${n.x}</div>`); }
      else if (jTab === 'places') { const ids = Object.keys(J.places); div(B, 'muted', `${ids.filter((i) => J.places[i].kind === 'island').length} of ${G.world.islands.length} islands · ${ids.filter((i) => J.places[i].kind !== 'island').length} of ${G.world.pois.length} other locations`).style.marginBottom = '.6em'; for (const id of ids.reverse()) div(B, 'card', `<span class="ic">${J.places[id].kind === 'island' ? '🏝️' : '⚓'}</span><span>${J.places[id].name}</span><span class="st muted">day ${J.places[id].day}</span>`); }
      else if (jTab === 'life') { for (const id in G.CREATURES) { const c = G.CREATURES[id], seen = J.creatures[id]; div(B, 'card' + (seen ? '' : ' locked'), `<span class="ic">${seen ? c.i : '❔'}</span><div><div>${seen ? c.n : 'Unknown'}</div><div class="muted" style="font-size:.86em">${seen ? c.d : 'Not yet observed.'}</div></div>`).style.cursor = 'default'; } }
      else if (jTab === 'fish') { div(B, 'muted', `${Object.keys(J.fish).length} of ${Object.keys(G.FISH).length} species recorded`).style.marginBottom = '.6em'; for (const id in G.FISH) { const f = G.FISH[id], r = J.fish[id]; div(B, 'card' + (r ? '' : ' locked'), `<span class="ic">${r ? '🐟' : '❔'}</span><div><div>${r ? f.n : '???'} <span class="pill">${['', 'common', 'uncommon', 'rare', 'legendary'][f.r]}</span></div><div class="muted" style="font-size:.86em">${r ? f.d : 'Habitat: ' + f.hab.join(', ') + (f.when !== 'any' ? ' · ' + f.when : '')}</div></div><span class="st">${r ? r.n + ' caught · best ' + r.best + ' cm' : ''}</span>`).style.cursor = 'default'; } }
      else if (jTab === 'skills') { for (const k in G.SKILLS) { const s = G.SKILLS[k], d = G.skills.data[k]; div(B, 'card', `<span class="ic">${s.i}</span><div class="grow"><div>${s.n} — level ${d.lvl}${d.lvl >= 10 ? ' (max)' : ''}</div><div class="muted" style="font-size:.86em">${s.d}</div><div class="bar" style="margin-top:.3em"><i style="width:${d.lvl >= 10 ? 100 : d.xp / G.skillNeed(d.lvl) * 100}%"></i></div></div>`).style.cursor = 'default'; } }
      else if (jTab === 'guide') div(B, 'notetext', GUIDE).style.maxWidth = '50em';
      else { const s = J.stats, k = div(B, 'kv'); const row = (a, b) => { k.appendChild(el('span', '', a)); k.appendChild(el('span', '', String(b))); }; row('Days survived', G.time.day); row('Time played', Math.floor(G.game.playtime / 3600) + ' h ' + Math.floor(G.game.playtime / 60 % 60) + ' min'); row('World seed', G.game.seedText); row('Difficulty', G.DIFF[G.game.difficulty].n); row('Debris collected', s.debris || 0); row('Resources harvested', s.harvest || 0); row('Pieces built', s.built || 0); row('Fish landed', s.fish || 0); row('Containers searched', s.containers || 0); row('Caches unearthed', s.treasure || 0); row('Missions completed', s.quests || 0); row('Deaths', s.deaths || 0); row('Technologies', Object.keys(G.tech.known).length + ' / ' + Object.keys(G.TECH).length); div(B, 'sect', 'Achievements'); const a = Object.values(J.ach); if (!a.length) div(B, 'muted', 'None yet.'); for (const x of a) div(B, '', `🏅 ${x.name} <span class="muted">— day ${x.day}</span>`); }
    }
  };
  const GUIDE = `WATER — You cannot drink the sea. Coconuts, rain catchers, solar stills (fill a flask with seawater first) and island ponds keep you alive. Thirst falls faster in heat.

FOOD — Raw fish and meat can make you sick; cook them over a fire. Smoked and dried food keeps for a voyage. Fresh food spoils — the dot on the icon shows how fresh it is. Compost what rots.

REST — Sleep in a bed each night. A roof overhead makes sleep worth more and keeps rain off. Exhaustion slows you and halves your stamina recovery.

WEATHER — Wet and wind chill you; sun and exertion heat you. A hat, shade, or a swim cool you down. A fire, dry clothes and hot food warm you up. Storms damage plain decks: reinforce the outer ring and carry planks.

THE RAFT — Build outward from any deck. A sail drives you forward, best with the wind astern; a paddle steers until you can build a helm. Always drop anchor before you leave. Run aground and you stop.

THE SEA — Sharks patrol deep water. They investigate, then circle, then commit — count the circles and be out by the second. A spear strike drives one off. Jellyfish drift in open water. Things live in wrecks.

DIVING — Your breath is short. A mask lengthens it, fins speed you, an air tank buys minutes. Below 34 m the pressure hurts without a wetsuit; below 52 m only a rebreather will do.

KNOWLEDGE — Study every new thing at a Research Desk to earn insight, and spend it on technology. Blueprints for the rarest knowledge must be found.`;

  // ---------- sleep ----------
  P.sleep = {
    title: 'Rest',
    render(body, it) {
      const d = G.BUILD[it.type], st = it.struct, roof = st.roofs.has(st.key(it.ix, it.iz, it.lv)) || st.hasFloor(it.ix, it.iz, it.lv + 1), storm = G.weather.storm > 0.5, q = G.clamp(d.bed * (roof ? 1 : 0.7) * (storm && !roof ? 0.6 : 1), 0.3, 1);
      div(body, '', `<div class="notetext" style="max-width:26em">${roof ? 'A roof overhead. ' : 'Open to the sky. '}${storm ? 'The storm will make this a hard night. ' : ''}${st.kind === 'raft' && !st.anchored ? '<span class="bad">The raft is not anchored — you will drift while you sleep.</span>' : ''}</div><div class="muted" style="margin:.6em 0">Sleep quality: <span class="glass">${Math.round(q * 100)}%</span></div>`);
      const row = div(body, 'row'); const go = (hours, label) => U.btn(row, label, () => G.game.sleep(hours, q, it), hours > 3 ? 'primary' : '');
      const h = G.time.hour, toDawn = h < 6 ? 6 - h : 30 - h; go(Math.min(toDawn, 10), h > 18 || h < 5 ? 'Sleep until dawn' : 'Sleep ' + Math.round(Math.min(toDawn, 10)) + ' hours'); go(2, 'Nap two hours');
      div(body, 'muted', 'Sleeping saves the game and makes this bed your waking point.').style.cssText = 'font-size:.84em;margin-top:.7em';
    }
  };

  // ---------- dialogue & trade ----------
  let dlg = { npc: null, text: '' };
  P.dialogue = {
    title: (id) => G.NPCS[id].n,
    onOpen(id) { dlg = { npc: id, text: G.NPCS[id].greet() }; G.quests.talk(id); U.refresh(); },
    render(body, id) {
      const N = G.NPCS[id]; body.style.width = '40em'; div(body, 'muted', N.role).style.cssText = 'letter-spacing:.1em;text-transform:uppercase;font-size:.8em'; div(body, 'notetext', '“' + (dlg.text || N.greet()) + '”').style.cssText = 'margin:.6em 0 1em;min-height:6em;max-width:none';
      const opts = G.quests.topicsFor(id).concat(N.topics().filter((t) => !t.c || t.c()));
      for (const t of opts) { const c = div(body, 'card', t.l); if (t.disabled) c.classList.add('locked'); c.onclick = () => { dlg.text = typeof t.x === 'function' ? t.x() : t.x; if (t.a) t.a(); G.audio.sfx('page'); U.refresh(); }; }
      const row = div(body, 'row'); row.style.marginTop = '.7em'; if (N.trade) U.btn(row, 'Trade', () => U.open('trade', id), 'primary'); U.btn(row, 'Farewell', () => U.close());
    }
  };
  let basket = { give: {}, get: {} };
  P.trade = {
    title: (id) => 'Trading with ' + G.NPCS[id].n,
    onOpen() { basket = { give: {}, get: {} }; },
    stock(id) { const T = G.game.trade, N = G.NPCS[id]; if (!T[id] || G.time.day - T[id].day >= 3) { T[id] = { day: G.time.day, stock: {} }; for (const [k, n] of N.trade.stock) T[id].stock[k] = n; } return T[id].stock; },
    sell(id) { return Math.max(1, Math.ceil(G.ITEMS[id].v * (1.75 - Math.min(60, G.game.rep) * 0.006))); },
    buy(id, npc) { const d = G.ITEMS[id], w = G.NPCS[npc].trade.wants; return Math.max(d.v > 0 ? 1 : 0, Math.floor(d.v * (w.includes(id) || w.includes(d.c) ? 1.0 : 0.55))); },
    render(body, id) {
      const stock = this.stock(id), inv = G.inv; let gv = 0, tv = 0; for (const k in basket.give) gv += basket.give[k] * this.buy(k, id); for (const k in basket.get) tv += basket.get[k] * this.sell(k);
      const cols = div(body, 'cols'), L = div(cols, 'col'), M = div(cols, 'col'), R = div(cols, 'col'); L.style.width = R.style.width = '19em'; M.style.width = '15em';
      div(L, 'sect', 'They offer'); const ls = div(L, 'scroll'); ls.style.maxHeight = '52vh';
      for (const k in stock) { const left = stock[k] - (basket.get[k] || 0); if (left <= 0) continue; const d = G.ITEMS[k]; const c = div(ls, 'card', `<span class="ic">${d.i}</span><span>${d.n} <span class="muted">×${left}</span></span><span class="st brass">${this.sell(k)}</span>`); U.tipOn(c, U.itemTip({ id: k, n: 1 })); c.onclick = (e) => { basket.get[k] = (basket.get[k] || 0) + (e.shiftKey ? Math.min(5, left) : 1); U.refresh(); }; }
      div(R, 'sect', 'You offer'); const rs = div(R, 'scroll'); rs.style.maxHeight = '52vh'; const have = {}; for (let i = 0; i < inv.size(); i++) { const s = inv.slots[i]; if (s && G.ITEMS[s.id].c !== 'story' && s.dur == null && s.air == null) have[s.id] = (have[s.id] || 0) + s.n; }
      for (const k in have) { const left = have[k] - (basket.give[k] || 0), v = this.buy(k, id); if (left <= 0 || v <= 0) continue; const d = G.ITEMS[k]; const c = div(rs, 'card', `<span class="ic">${d.i}</span><span>${d.n} <span class="muted">×${left}</span></span><span class="st ${v >= d.v ? 'good' : 'brass'}">${v}</span>`); c.onclick = (e) => { basket.give[k] = (basket.give[k] || 0) + (e.shiftKey ? Math.min(5, left) : 1); U.refresh(); }; }
      div(M, 'sect', 'The bargain'); const lst = (o, label) => { let h = `<div class="muted">${label}</div>`; for (const k in o) h += `<div>${G.ITEMS[k].i} ${G.ITEMS[k].n} ×${o[k]}</div>`; return h + (Object.keys(o).length ? '' : '<div class="muted">—</div>'); };
      div(M, '', lst(basket.get, 'You receive') + '<br>' + lst(basket.give, 'You give')); const ok = gv >= tv && (tv > 0 || gv > 0);
      div(M, '', `<div style="margin:.7em 0">Value given <b class="${ok ? 'good' : 'bad'}">${gv}</b> / asked <b class="brass">${tv}</b></div>`);
      const row = div(M, 'row wrapf'); U.btn(row, 'Agree', () => { for (const k in basket.give) inv.remove(k, basket.give[k]); for (const k in basket.get) { inv.add(k, basket.get[k]); stock[k] -= basket.get[k]; } for (const k in basket.give) stock[k] = (stock[k] || 0) + basket.give[k]; G.game.rep = Math.min(100, G.game.rep + Math.min(3, Math.floor(tv / 40))); basket = { give: {}, get: {} }; G.audio.sfx('craftdone'); G.journal.stat('trades'); G.emit('trade', id); U.refresh(); }, 'primary').disabled = !ok;
      U.btn(row, 'Clear', () => { basket = { give: {}, get: {} }; U.refresh(); }); U.btn(row, 'Back', () => U.open('dialogue', id));
      div(M, 'muted', 'Barter only: what you give must be worth at least what you take. Green prices are things this trader especially wants. Shift-click adds five.').style.cssText = 'font-size:.8em;margin-top:.7em';
    }
  };

  // ---------- story panels ----------
  P.note = { title: (id) => G.NOTES[id].t, render(body, id) { const n = G.NOTES[id]; div(body, 'muted', n.by).style.marginBottom = '.7em'; div(body, 'notetext', n.x); const r = div(body, 'row'); r.style.marginTop = '1em'; U.btn(r, 'Close', () => U.close(), 'primary'); div(r, 'muted', 'Saved to your journal.').style.fontSize = '.84em'; } };
  P.ending = {
    title: 'The Keystone', modal: true,
    render(body) {
      body.style.width = '40em'; div(body, 'notetext', 'The key seats with a click you feel in your teeth. Outside, the whole sky is turning around this room. The console offers three directives, and waits.').style.cssText = 'max-width:none;margin-bottom:1em';
      for (const o of G.quests.endingOptions()) { const c = div(body, 'card' + (o.ok ? '' : ' locked'), `<div><b class="brass" style="font-family:var(--serif);font-size:1.2em">${o.t}</b><div>${o.d}</div>${o.ok ? '' : `<div class="bad" style="font-size:.86em">${o.why}</div>`}</div>`); c.onclick = () => { if (!o.ok) return G.audio.sfx('deny'); U.close(true); G.quests.ending(o.id); }; }
      U.btn(body, 'Step back from the console', () => U.close()).style.marginTop = '.6em';
    }
  };
  const EPI = {
    vent: ['Still Water', 'You key the sequence by hand, one Lantern at a time. Alpha takes its share and holds. Beta. Gamma. Far away across the dark water, three lights you lit with your own hands flare white and begin to sing.\n\nThe column does not fall. It leans, and thins, and for the first time in four years rain that is only rain comes down on the Keystone.\n\nIt will take days. The Chain will carry it. You sit down on the control room floor with your back against the console and listen to the Eye forget how to be a storm.'],
    stop: ['The Breaking', 'You turn the key all the way over. Every indicator on the console goes dark at once.\n\nFor one long breath, nothing. Then the column lets go.\n\nThe sea comes back to itself the only way it knows how — all at once. You hold on to a welded stanchion while a century of stolen calm goes roaring outward past you toward every cay in the Chain. It is terrible, and it is finished. When the rain thins you can see a horizon that has not been visible from here since the array was switched on.'],
    retune: ['The Keeper\'s Bargain', 'The spare crystal slides into the resonator and the pitch of the whole platform drops, like a held breath let out halfway.\n\nThe Eye does not die. It draws in, tightens, steadies — a third of the size, standing over the Keystone like a lid on a pot. The lanes will stay calm. The barges will work. Haven is safe for a generation.\n\nOn the console, a line of text appears that was plainly written long ago and saved for this: "THANK YOU. I WILL TAKE IT FROM HERE. — A.K." You wonder who will stand in this room when the crystal wears out.']
  };
  P.epilogue = { title: (c) => EPI[c][0], modal: true, render(body, c) { body.style.width = '42em'; div(body, 'notetext', EPI[c][1]).style.maxWidth = 'none'; div(body, 'muted', 'Your world continues. Sail home to Haven — and after that, the sea is yours: islands uncharted, wrecks undived, a raft still unfinished.').style.margin = '1em 0'; U.btn(body, 'Continue', () => U.close(), 'primary'); } };
  P.credits = { title: 'Credits', render(body) { body.style.width = '36em'; div(body, 'notetext', 'LANTERN SEA\nAn original ocean survival game for the browser.\n\nDesign, code, world, story and sound: generated procedurally and written for this project.\n\nRendering: Three.js (MIT licence) on WebGL2 — custom ocean, sky and post-processing shaders.\nTextures, models, terrain and music are synthesised at runtime. Many sound effects and ambiences are excerpts of public-domain field recordings from the PDsounds.org collection on Wikimedia Commons; the rest are synthesised.\n\nThank you for playing. Mind the weather that never moves.').style.maxWidth = 'none'; const SC = G.SNDCREDITS || []; if (SC.length) { div(body, 'sect', 'Recordings (public domain)'); div(body, 'muted', SC.map((c) => `${c.file.replace(/\.ogg$/, '')} — ${c.author}`).join('<br>')).style.cssText = 'font-size:.8em;line-height:1.6;max-height:12em;overflow:auto'; } if (G.state === 'play') div(body, 'brass', '<br>The story is complete — your world goes on. Finish the fortress, chart every island, land the legendary fish.'); U.btn(body, 'Close', () => U.close(), 'primary').style.marginTop = '1em'; } };
  P.exit = { title: 'Leaving', render(body) { body.style.width = '30em'; div(body, '', 'A browser page cannot close its own window. To leave, close this tab or window.<br><br><span class="muted">Your progress is stored in this browser by the game\'s save system. Use <b>Load Game → Export</b> to keep a backup file.</span>'); U.btn(body, 'Back', () => U.close(), 'primary').style.marginTop = '1em'; } };
  P.death = { title: 'You did not make it', modal: true, noLock: true, render(body, cause) { body.style.width = '30em'; const D = G.DIFF[G.game.difficulty]; div(body, 'notetext', `Claimed by ${cause}, on day ${G.time.day}.`); div(body, 'muted', D.keepOnDeath >= 1 ? 'You will wake at your bed with everything you carried.' : D.keepOnDeath > 0 ? 'You will wake at your bed. Some of what you carried has been lost.' : 'You will wake at your bed. Everything you carried is gone.').style.margin = '.8em 0'; U.btn(body, 'Wake', () => G.game.respawn(), 'primary'); } };
  P.help = {
    title: 'Help', render(body) {
      body.style.width = '46em'; const B = G.settings.bindings, k = div(body, 'kv'); k.style.gridTemplateColumns = 'auto 1fr auto 1fr'; const row = (a, b) => { k.appendChild(el('span', '', `<span class="kbd">${a}</span>`)); k.appendChild(el('span', '', b)); };
      row('W A S D', 'Move'); row('Mouse', 'Look'); row(G.keyLabel(B.sprint), 'Sprint / swim fast'); row(G.keyLabel(B.jump), 'Jump / swim up / climb out'); row(G.keyLabel(B.crouch), 'Crouch / dive down'); row(G.keyLabel(B.interact), 'Interact'); row('LMB', 'Use held tool · place'); row('RMB', 'Eat / use held item · cancel'); row('1–9, wheel', 'Hotbar'); row(G.keyLabel(B.inventory), 'Inventory'); row(G.keyLabel(B.craft), 'Crafting'); row(G.keyLabel(B.build), 'Build menu'); row(G.keyLabel(B.rotate), 'Rotate piece'); row(G.keyLabel(B.demolish), 'Dismantle mode'); row(G.keyLabel(B.map), 'Chart'); row(G.keyLabel(B.journal), 'Journal'); row(G.keyLabel(B.light), 'Dive light'); row(G.keyLabel(B.drop), 'Drop one (Shift: stack)'); row(G.keyLabel(B.photo), 'Photo mode'); row(G.keyLabel(B.quicksave), 'Quick save'); row('Esc', 'Pause / close');
      div(body, 'sect', 'Getting started'); div(body, '', 'Throw your hook at floating debris (hold and release left-click). Craft a mallet, repair and extend the raft, catch rain, fish, cook. Then raise a sail toward the birds. The Journal\'s Survival tab explains the rest.'); U.btn(body, 'Close', () => U.close(), 'primary').style.marginTop = '.8em';
    }
  };

  // ---------- pause, settings, saves, new game ----------
  P.pause = {
    title: 'Paused', onOpen() { G.game.pause(); },
    render(body) {
      body.style.width = '20em'; const b = (l, f, c) => { const x = U.btn(body, l, f, c); x.style.cssText = 'display:block;width:100%;margin-bottom:.45em'; return x; };
      b('Resume', () => U.close(), 'primary'); b('Save game', () => { G.game.save(G.game.slot).then(() => U.toast('Game saved.', 'good')); }); b(G.net && G.net.connected() ? 'Playing together…' : 'Invite partner', () => U.open('coop')); b('Settings', () => U.open('settings')); b('Help', () => U.open('help')); b('Photo mode', () => { U.close(); G.game.photo(true); }); b('Save and quit to menu', () => { G.game.save(G.game.slot).then(() => G.game.quitToMenu()); }, 'danger');
      div(body, 'muted', `Slot ${G.game.slot} · ${G.game.name} · day ${G.time.day}`).style.cssText = 'font-size:.82em;text-align:center;margin-top:.4em';
    }
  };
  let setTab = 'graphics';
  P.settings = {
    title: 'Settings', onClose() { G.saveSettings(); },
    render(body) {
      body.style.width = '44em'; const S = G.settings; const tabs = div(body, 'tabs'); for (const [id, n] of [['graphics', 'Graphics'], ['audio', 'Audio'], ['controls', 'Controls'], ['access', 'Accessibility']]) { const t = div(tabs, 'tab' + (setTab === id ? ' on' : ''), n); t.onclick = () => { setTab = id; U.refresh(); }; }
      const row = (label, ctl, note) => { const r = div(body, 'row between'); r.style.margin = '.45em 0'; div(r, '', label + (note ? `<div class="muted" style="font-size:.78em">${note}</div>` : '')); r.appendChild(ctl); return r; };
      const slider = (key, min, max, step, fmt) => { const w = el('span', 'row'), i = el('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = S[key]; const v = el('span', 'muted', fmt(S[key])); v.style.width = '4em'; i.oninput = () => { S[key] = parseFloat(i.value); v.textContent = fmt(S[key]); S.preset = setTab === 'graphics' ? 'custom' : S.preset; G.emit('settings'); }; w.appendChild(i); w.appendChild(v); return w; };
      const select = (key, opts) => { const s = el('select'); for (const [v, n] of opts) { const o = el('option', '', n); o.value = v; if (String(S[key]) === String(v)) o.selected = true; s.appendChild(o); } s.onchange = () => { const v = s.value; S[key] = isNaN(v) || v === '' ? v : parseFloat(v); if (setTab === 'graphics') S.preset = 'custom'; G.emit('settings'); }; return s; };
      const check = (key) => { const l = el('label', 'chk'), i = el('input'); i.type = 'checkbox'; i.checked = !!S[key]; i.onchange = () => { S[key] = i.checked; if (setTab === 'graphics') S.preset = 'custom'; G.emit('settings'); }; l.appendChild(i); return l; };
      const pct = (v) => Math.round(v * 100) + '%';
      if (setTab === 'graphics') {
        const pr = el('span', 'row'); for (const p of ['low', 'medium', 'high', 'ultra']) { const b = U.btn(pr, p[0].toUpperCase() + p.slice(1), () => { G.applyPreset(p); G.emit('settings'); U.refresh(); }, 'small' + (S.preset === p ? ' primary' : '')); } row('Preset', pr, S.preset === 'custom' ? 'custom' : '');
        row('Resolution scale', slider('resScale', 0.5, 1.5, 0.05, pct), 'Largest effect on performance. The game also lowers it automatically if frames drop.'); row('Shadow quality', select('shadows', [[0, 'Off'], [1, 'Low'], [2, 'High'], [3, 'Ultra']])); row('Water detail', select('water', [[0, 'Low'], [1, 'Medium'], [2, 'High'], [3, 'Ultra']])); row('Draw distance', slider('drawDist', 800, 3000, 100, (v) => v + ' m')); row('Vegetation density', slider('veg', 0.2, 1.5, 0.05, pct), 'Applies as islands load.');
        row('Sky reflections on water', check('reflections')); row('Post-processing (grade, vignette, smoothing)', check('post')); row('Bloom', check('bloom')); row('Sky lighting (image-based)', check('ibl')); row('Ambient occlusion', check('ao')); row('Field of view', slider('fov', 55, 100, 1, (v) => v + '°')); row('Frame-rate limit', select('fpsLimit', [[0, 'Unlimited (display sync)'], [30, '30'], [60, '60'], [120, '120']]));
        div(body, 'muted', `Measured now: ${Math.round(G.render.fps)} fps at ${G.render.w}×${G.render.h}.`).style.fontSize = '.82em';
      } else if (setTab === 'audio') { row('Master volume', slider('volMaster', 0, 1, 0.02, pct)); row('Music', slider('volMusic', 0, 1, 0.02, pct)); row('Effects', slider('volSfx', 0, 1, 0.02, pct)); row('Ambience', slider('volAmb', 0, 1, 0.02, pct)); row('Subtitles for radio and recordings', check('subtitles')); row('Recorded sound effects (off = synthesised only)', check('recordedSfx')); }
      else if (setTab === 'controls') {
        row('Mouse sensitivity', slider('sens', 0.2, 3, 0.05, (v) => v.toFixed(2) + '×')); row('Invert vertical look', check('invertY')); div(body, 'sect', 'Key bindings — click one, then press a key'); const k = div(body, ''); k.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:.3em 1.5em';
        for (const a in G.bindingNames) { const r = div(k, 'row between'); div(r, '', G.bindingNames[a]); const b = U.btn(r, G.keyLabel(S.bindings[a]), () => { b.textContent = 'press…'; G.input.rebind = (code) => { if (code !== 'Escape') S.bindings[a] = code; U.refresh(); }; }, 'small'); b.style.minWidth = '5em'; }
        U.btn(body, 'Reset bindings', () => { S.bindings = Object.assign({}, G.defaultBindings); U.refresh(); }, 'small').style.marginTop = '.7em';
      } else { row('Interface scale', slider('uiScale', 0.75, 1.5, 0.05, pct)); row('Colour-vision-friendly indicators', check('colorblind'), 'Swaps red/green status colours for orange/blue.'); row('Reduced motion', check('reducedMotion'), 'Removes camera sway, head bob and interface animation.'); row('Camera bob', slider('camBob', 0, 1.5, 0.05, pct)); row('Tutorial hints', check('tutorials')); }
      U.btn(body, 'Done', () => U.close(), 'primary').style.marginTop = '.9em';
    }
  };
  const NG = { slot: 1, name: '', seed: '', diff: 'standard' };
  // ---------- play together ----------
  const nameField = (body) => { const r = div(body, 'row'); r.style.cssText = 'gap:.6em;margin:.4em 0 1em'; div(r, 'muted', 'Your name').style.fontSize = '.85em'; const n = el('input'); n.type = 'text'; n.maxLength = 18; n.value = G.net.name || ''; n.placeholder = 'Castaway'; n.style.flex = '1'; n.oninput = () => G.net.setName(n.value); r.appendChild(n); if (!G.net.name) G.net.setName('Castaway');
    // how you look to your partner
    const lk = G.net.look, L = G.net.LOOKS, lr = div(body, 'row'); lr.style.cssText = 'gap:.45em;margin:-.4em 0 1em;flex-wrap:wrap;align-items:center';
    div(lr, 'muted', 'Look').style.cssText = 'font-size:.85em;margin-right:.4em';
    L.shirt.forEach((c, i) => { const sw = div(lr, 'swatch' + (lk.shirt === i ? ' on' : '')); sw.style.background = c; sw.title = 'Shirt'; sw.onclick = () => { G.net.setLook({ shirt: i }); U.refresh(); }; });
    div(lr, '', '').style.width = '.6em';
    L.skin.forEach((c, i) => { const sw = div(lr, 'swatch round' + (lk.skin === i ? ' on' : '')); sw.style.background = c; sw.title = 'Skin tone'; sw.onclick = () => { G.net.setLook({ skin: i }); U.refresh(); }; });
    U.btn(lr, lk.hair === 'long' ? 'Long hair' : 'Short hair', () => { G.net.setLook({ hair: lk.hair === 'long' ? 'short' : 'long' }); U.refresh(); }, 'small');
    return n; };
  P.coop = {
    title: 'Play together', onOpen() { if (!G.net.peer) { if (!G.net.name) G.net.setName('Castaway'); G.net.host(); } },
    render(body) {
      const N = G.net; body.style.width = '30em';
      div(body, 'muted', 'Your partner opens <b>Join Partner</b> on the main menu of their copy of the game and types this code. They join your world, on your raft. Your game keeps the world saved.').style.cssText = 'font-size:.86em;line-height:1.5';
      nameField(body);
      div(body, 'coopcode', N.code ? N.code.split('').map((c) => `<span>${c}</span>`).join('') : '<span>…</span>');
      const row = div(body, 'row'); row.style.cssText = 'gap:.5em;justify-content:center;margin:.6em 0 1em';
      U.btn(row, 'Copy code', () => { try { navigator.clipboard.writeText(N.code); U.toast('Code copied.', 'good'); } catch (e) { U.toast('Select the code and copy it.'); } }, 'small');
      U.btn(row, 'Stop inviting', () => { N.stop(); U.close(); }, 'small danger');
      div(body, N.connected() && N.partner ? 'good' : 'muted', N.connected() && N.partner ? N.partner.name + ' is here with you. Press Enter in game to chat.' : (N.status || 'Starting…')).style.cssText = 'text-align:center;font-size:.9em';
    }
  };
  P.join = {
    title: 'Join a partner',
    render(body) {
      const N = G.net; body.style.width = '28em';
      div(body, 'muted', 'Ask your partner to open <b>Invite partner</b> from their pause menu, then type the six-letter code they see.').style.cssText = 'font-size:.86em;line-height:1.5';
      nameField(body);
      const code = el('input'); code.type = 'text'; code.maxLength = 6; code.placeholder = 'CODE'; code.className = 'codein'; code.value = N.role === 'guest' ? N.code : ''; body.appendChild(code); setTimeout(() => code.focus(), 0);
      const row = div(body, 'row'); row.style.cssText = 'gap:.5em;justify-content:center;margin:1em 0 .8em';
      const go = () => N.join(code.value); code.addEventListener('keydown', (e) => { if (e.code === 'Enter') go(); });
      U.btn(row, 'Join', go, 'primary'); if (N.peer) U.btn(row, 'Cancel', () => { N.stop(); U.refresh(); }, 'small');
      div(body, 'muted', N.status || 'Both of you need this game running on your own computers.').style.cssText = 'text-align:center;font-size:.86em';
    }
  };
  P.newgame = {
    title: 'New Voyage', onOpen() { NG.seed = String(Math.floor(Math.random() * 900000 + 100000)); G.saves.list().then((l) => { const used = l.map((s) => s.slot); NG.slot = [1, 2, 3, 4].find((n) => !used.includes(n)) || 1; P.newgame.used = used; U.refresh(); }); },
    render(body) {
      body.style.width = '46em'; const row = (label, ctl) => { const r = div(body, 'row'); r.style.margin = '.55em 0'; const l = div(r, 'muted', label); l.style.width = '8em'; r.appendChild(ctl); return r; };
      const nm = el('input'); nm.type = 'text'; nm.placeholder = 'Name this voyage'; nm.value = NG.name; nm.maxLength = 28; nm.style.width = '18em'; nm.oninput = () => { NG.name = nm.value; }; row('Voyage', nm);
      const sw = el('span', 'row'); const sd = el('input'); sd.type = 'text'; sd.value = NG.seed; sd.style.width = '12em'; sd.oninput = () => { NG.seed = sd.value; }; sw.appendChild(sd); U.btn(sw, 'Random', () => { NG.seed = String(Math.floor(Math.random() * 900000 + 100000)); U.refresh(); }, 'small'); row('World seed', sw); div(body, 'muted', 'The seed shapes the whole archipelago: the same seed always gives the same islands. Words work too.').style.cssText = 'font-size:.8em;margin:-.3em 0 .5em 8.6em';
      const sl = el('span', 'row'); for (let n = 1; n <= 4; n++) U.btn(sl, 'Slot ' + n + ((P.newgame.used || []).includes(n) ? ' ●' : ''), () => { NG.slot = n; U.refresh(); }, 'small' + (NG.slot === n ? ' primary' : '')); row('Save slot', sl); if ((P.newgame.used || []).includes(NG.slot)) div(body, 'bad', 'This slot holds a saved voyage. Starting here overwrites it.').style.cssText = 'font-size:.84em;margin-left:8.6em';
      div(body, 'sect', 'Difficulty'); const dr = div(body, 'row'); dr.style.alignItems = 'stretch'; for (const k in G.DIFF) { const d = div(dr, 'diff' + (NG.diff === k ? ' on' : ''), `<b>${G.DIFF[k].n}</b><span>${G.DIFF[k].d}</span>`); d.onclick = () => { NG.diff = k; U.refresh(); }; }
      const f = div(body, 'row between'); f.style.marginTop = '1.2em'; const l = el('label', 'chk'), i = el('input'); i.type = 'checkbox'; i.checked = G.settings.tutorials; i.onchange = () => { G.settings.tutorials = i.checked; }; l.appendChild(i); l.appendChild(document.createTextNode(' Tutorial hints')); f.appendChild(l);
      U.btn(f, 'Cast off', () => { const o = Object.assign({}, NG); U.close(true); G.game.newGame({ slot: o.slot, name: o.name || 'Voyage ' + o.slot, seed: o.seed || '1', difficulty: o.diff }); }, 'primary');
    }
  };
  P.load = {
    title: 'Saved Voyages', onOpen() { G.saves.list().then((l) => { P.load.list = l; U.refresh(); }); },
    render(body) {
      body.style.width = '44em'; const l = P.load.list; if (!l) return div(body, 'muted', 'Reading saves…'); if (!l.length) div(body, 'muted', 'No saved voyages yet.');
      for (const s of l) { const m = s.meta; const c = div(body, 'card', `<span class="ic">${s.slot === 'auto' ? '🕰️' : '⛵'}</span><div class="grow"><div>${m.name} <span class="muted">— ${s.slot === 'auto' ? 'autosave' : 'slot ' + s.slot}</span></div><div class="muted" style="font-size:.84em">Day ${m.day} · Chapter ${m.chapter} · ${G.DIFF[m.difficulty] ? G.DIFF[m.difficulty].n : ''} · seed ${m.seed} · ${Math.floor(m.playtime / 3600)}h ${Math.floor(m.playtime / 60 % 60)}m · ${new Date(m.saved).toLocaleString()}</div></div>`); c.style.cursor = 'default'; const b = el('span', 'row'); c.appendChild(b);
        U.btn(b, 'Load', () => { U.close(true); G.game.load(s.slot); }, 'small primary'); U.btn(b, 'Export', () => G.saves.export(s.slot), 'small'); U.btn(b, 'Delete', (e) => { if (e.target.dataset.sure) G.saves.del(s.slot).then(() => P.load.onOpen()); else { e.target.dataset.sure = 1; e.target.textContent = 'Sure?'; } }, 'small danger'); }
      const f = div(body, 'row between'); f.style.marginTop = '.9em'; const fi = el('input'); fi.type = 'file'; fi.accept = '.json,application/json'; fi.style.display = 'none'; fi.onchange = () => { if (fi.files[0]) G.saves.import(fi.files[0]).then((slot) => { U.toast('Imported into slot ' + slot + '.', 'good'); P.load.onOpen(); }).catch((e) => { div(body, 'bad', 'Import failed: ' + e.message); }); }; body.appendChild(fi);
      U.btn(f, 'Import a save file…', () => fi.click()); U.btn(f, 'Back', () => U.close());
    }
  };
})();
