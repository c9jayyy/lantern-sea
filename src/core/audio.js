'use strict';
/* Audio, synthesised with WebAudio (no audio files).
   Ambience is layered the way a sea actually sounds: a low continuous roar, individual waves washing past with a hissing
   tail, water slapping the hull, gusting wind in two bands. Effects are built from physical recipes rather than tones:
   struck wood and stone are sums of decaying inharmonic modes plus a contact click, water is band-swept noise plus
   rising "bubble" chirps, creaks are stick-slip grain trains. Interface cues are a struck wooden bar. */
(function () {
  const G = window.G;
  let ac = null, master, sfxBus, ambBus, musBus, muffle, white, pink, rev, comp;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const FADE_IN = new Float32Array(24), FADE_OUT = new Float32Array(24); for (let i = 0; i < 24; i++) { FADE_IN[i] = Math.sin(i / 23 * Math.PI / 2); FADE_OUT[i] = Math.cos(i / 23 * Math.PI / 2); }
  const CL = () => G.SNDCLIPS || {};
  const A = G.audio = {
    ready: false, mood: 'calm', t: 0, musT: 2, loops: {}, waveT: 1, lapT: 1, gust: 0.5, gustV: 0, smp: {}, smpFail: [], lastTake: {}, rl: {},
    init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ac = new AC(); comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2; comp.connect(ac.destination);
      master = ac.createGain(); master.connect(comp);
      muffle = ac.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 20000; muffle.connect(master);
      sfxBus = ac.createGain(); sfxBus.connect(muffle); ambBus = ac.createGain(); ambBus.connect(muffle); musBus = ac.createGain(); musBus.connect(master);
      const n = ac.sampleRate * 4; white = ac.createBuffer(1, n, ac.sampleRate); pink = ac.createBuffer(1, n, ac.sampleRate);
      const w = white.getChannelData(0), pk = pink.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < n; i++) { const x = Math.random() * 2 - 1; w[i] = x; b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759; b2 = 0.969 * b2 + x * 0.153852; b3 = 0.8665 * b3 + x * 0.3104856; b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898; pk[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11; b6 = x * 0.115926; }
      rev = ac.createDelay(1); rev.delayTime.value = 0.37; const fb = ac.createGain(); fb.gain.value = 0.52; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; rev.connect(lp); lp.connect(fb); fb.connect(rev); rev.connect(musBus);
      const L = this.loops; L.sea = this.loop(pink, 'lowpass', 620, 0.5); L.seaLow = this.loop(pink, 'lowpass', 150, 0.7); L.surf = this.loop(white, 'highpass', 4200, 0.4);
      L.wind = this.loop(pink, 'bandpass', 420, 0.9); L.windHi = this.loop(pink, 'bandpass', 1500, 3.5); L.rain = this.loop(white, 'highpass', 3600, 0.4); L.rainLow = this.loop(pink, 'bandpass', 950, 0.7);
      L.deep = this.loop(pink, 'lowpass', 130, 1.0); L.engine = this.loop(pink, 'lowpass', 180, 6);
      this.loadClips();
      this.ready = true; this.volumes(); G.on('settings', () => this.volumes());
    },
    volumes() { if (!ac) return; const S = G.settings; master.gain.value = S.volMaster; sfxBus.gain.value = S.volSfx; ambBus.gain.value = S.volAmb; musBus.gain.value = S.volMusic * 0.6; },
    loop(buf, type, freq, q) { const src = ac.createBufferSource(); src.buffer = buf; src.loop = true; src.playbackRate.value = rnd(0.85, 1.15); const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ac.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(ambBus); src.start(0, Math.random() * 3); return { f, g }; },
    dest(bus, pan) { if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = G.clamp(pan, -1, 1); p.connect(bus || sfxBus); return p; } return bus || sfxBus; },
    // band-limited noise burst. o: dur, vol, type, f0, f1 (sweep to), fm (pass through this frequency midway), q, att, delay, pan, bus, pinkN
    nz(o) {
      if (!ac) return; const t = ac.currentTime + (o.delay || 0), s = ac.createBufferSource(); s.buffer = o.pinkN ? pink : white; s.playbackRate.value = rnd(0.8, 1.25);
      const f = ac.createBiquadFilter(); f.type = o.type || 'bandpass'; f.Q.value = o.q || 0.8; f.frequency.setValueAtTime(o.f0 || 1000, t);
      if (o.fm) { f.frequency.exponentialRampToValueAtTime(o.fm, t + o.dur * 0.35); f.frequency.exponentialRampToValueAtTime(o.f1 || o.f0, t + o.dur); } else if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
      const g = ac.createGain(), att = o.att || Math.min(0.006, o.dur * 0.2); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
      s.connect(f); f.connect(g); g.connect(this.dest(o.bus, o.pan)); s.start(t, Math.random() * 3); s.stop(t + o.dur + 0.05);
    },
    // struck solid: decaying inharmonic partials. ratios/decays per mode
    modal(base, ratios, decays, vol, delay, pan, bus) {
      if (!ac) return; const t = ac.currentTime + (delay || 0), out = this.dest(bus, pan);
      for (let i = 0; i < ratios.length; i++) { const o = ac.createOscillator(), g = ac.createGain(), d = decays[i]; o.frequency.value = base * ratios[i] * rnd(0.985, 1.015); g.gain.setValueAtTime(vol / (1 + i * 0.7), t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.02); }
    },
    // a pitch glide with an envelope: bubbles (rising), thumps (falling), calls
    glide(f0, f1, dur, vol, type, delay, pan, bus, att) {
      if (!ac) return; const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (att || Math.min(0.008, dur * 0.25))); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(this.dest(bus, pan)); o.start(t); o.stop(t + dur + 0.03);
    },
    // ---------- recorded clips (js/sounds.js). Anything not yet decoded, or missing, falls back to the synthesis below ----------
    loadClips() {
      const S = G.SND; if (!S) return; const keys = Object.keys(S); let i = 0;
      const next = () => { if (i >= keys.length) return; const k = keys[i++]; try { const bin = atob(S[k]), u = new Uint8Array(bin.length); for (let j = 0; j < bin.length; j++) u[j] = bin.charCodeAt(j); ac.decodeAudioData(u.buffer, (b) => { this.smp[k] = b; }, () => { this.smpFail.push(k); }); } catch (e) { this.smpFail.push(k); } setTimeout(next, 12); };
      next();
    },
    // play part of a clip: o = { off, dur, vol, rate, pan, delay, bus, fin, fout }
    clip(key, o) {
      const b = this.smp[key]; if (!b || !ac) return false; o = o || {};
      const t = ac.currentTime + (o.delay || 0), src = ac.createBufferSource(), g = ac.createGain(); src.buffer = b; const rate = o.rate || rnd(0.95, 1.05); src.playbackRate.value = rate;
      const off = Math.min(o.off || 0, b.duration - 0.02), dur = Math.min(o.dur || b.duration, b.duration - off), real = dur / rate, v = o.vol == null ? 1 : o.vol, fi = o.fin || 0.004, fo = o.fout || Math.min(0.09, real * 0.3);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + fi); g.gain.setValueAtTime(v, t + Math.max(fi, real - fo)); g.gain.linearRampToValueAtTime(0.0001, t + real);
      src.connect(g); g.connect(this.dest(o.bus, o.pan)); src.start(t, off, dur); return true;
    },
    // pick one of several takes [key, off, dur, vol] (never the same one twice running)
    take(name, mul, o) {
      const L = CL()[name]; if (!L || !this.smp[L[0][0]]) return false; let i = Math.floor(Math.random() * L.length); if (L.length > 1 && i === this.lastTake[name]) i = (i + 1) % L.length; this.lastTake[name] = i;
      const c = L[i]; return this.clip(c[0], Object.assign({ off: c[1], dur: c[2], vol: (c[3] == null ? 1 : c[3]) * (mul == null ? 1 : mul) }, o));
    },
    // a recorded ambience that loops by cross-fading into a fresh copy of itself
    mkLoop(key, off, dur, gain) { const g = ac.createGain(); g.gain.value = 0; g.connect(ambBus); return { key, off: off || 0, dur, gain: gain || 1, g, next: 0, on: false }; },
    tickLoop(L, target, now) {
      L.g.gain.setTargetAtTime(Number.isFinite(target) ? target * L.gain : 0, now, 0.5); const b = this.smp[L.key]; if (!b) return false;
      if (target < 0.002) { if (now > L.next + 1) L.on = false; return true; }
      if (!L.on) { L.on = true; L.next = now; }
      if (now > L.next - 0.5) {
        const dur = Math.min(L.dur || b.duration, b.duration - L.off), xf = Math.min(2.5, dur * 0.2), t = Math.max(now, L.next), src = ac.createBufferSource(), e = ac.createGain(); src.buffer = b;
        e.gain.setValueAtTime(0, t); e.gain.setValueCurveAtTime(FADE_IN, t, xf); e.gain.setValueAtTime(1, t + dur - xf); e.gain.setValueCurveAtTime(FADE_OUT, t + dur - xf, xf - 0.01);
        src.connect(e); e.connect(L.g); src.start(t, L.off, dur); L.next = t + dur - xf;
      }
      return true;
    },
    tone(freq, dur, type, vol, to, bus, delay) { this.glide(freq, to || freq, dur, vol, type, delay, 0, bus); },
    bubble(f, vol, delay, pan, bus) { this.glide(f, f * rnd(1.5, 2.3), rnd(0.035, 0.08), vol, 'sine', delay, pan, bus, 0.004); },
    bubbles(n, f0, f1, vol, span, delay, pan, bus) { for (let i = 0; i < n; i++) this.bubble(rnd(f0, f1), vol * rnd(0.4, 1), (delay || 0) + Math.random() * span, pan, bus); },
    tick(vol, delay, pan) { this.nz({ dur: 0.008, vol, type: 'highpass', f0: 2500, delay, pan }); },
    wood(base, vol, delay, pan) { this.modal(base, [1, 2.76, 5.4, 8.93], [0.085, 0.05, 0.03, 0.018], vol, delay, pan); this.nz({ dur: 0.022, vol: vol * 0.9, f0: 1900, q: 0.9, delay, pan }); },
    stone(base, vol, delay, pan) { this.modal(base, [1, 1.47, 2.09, 2.56, 3.9], [0.045, 0.035, 0.028, 0.022, 0.016], vol, delay, pan); this.nz({ dur: 0.03, vol: vol * 1.2, type: 'highpass', f0: 2600, delay, pan }); this.nz({ dur: 0.11, vol: vol * 0.35, f0: 950, q: 1.2, delay, pan }); },
    thump(f, vol, delay, pan) { this.glide(f, f * 0.5, 0.13, vol, 'sine', delay, pan); this.nz({ dur: 0.07, vol: vol * 0.7, type: 'lowpass', f0: 320, delay, pan, pinkN: 1 }); },
    // stick-slip: a train of tiny resonant pulses whose rate drifts, the sound of loaded timber or rope
    creak(base, dur, vol, delay, pan, rate0, rate1) {
      let t = delay || 0; const end = t + dur; let k = 0;
      while (t < end && k < 60) { const u = (t - (delay || 0)) / dur, f = base * (1 + 0.18 * Math.sin(u * 5 + k)); this.modal(f, [1, 2.31, 3.7], [0.022, 0.014, 0.009], vol * (0.5 + 0.5 * Math.sin(u * Math.PI)) * rnd(0.6, 1), t, pan); t += 1 / G.lerp(rate0 || 22, rate1 || 46, u) * rnd(0.8, 1.2); k++; }
    },
    grains(n, span, o) { for (let i = 0; i < n; i++) this.nz(Object.assign({}, o, { delay: (o.delay || 0) + i / n * span * rnd(0.85, 1.15), vol: o.vol * rnd(0.5, 1) })); },
    bar(freq, vol, delay) { this.modal(freq, [1, 3.93, 9.2], [0.55, 0.18, 0.07], vol, delay); },                               // struck wooden bar: interface cues
    splash(vol, pan) { this.nz({ dur: 0.75, vol: vol * 0.5, f0: 2600, f1: 480, q: 0.6, att: 0.012, pan }); this.nz({ dur: 1.0, vol: vol * 0.12, type: 'highpass', f0: 4200, att: 0.05, delay: 0.05, pan }); this.thump(110, vol * 0.25, 0, pan); this.bubbles(6, 260, 900, vol * 0.16, 0.5, 0.05, pan); },
    // recorded takes for an effect, layered with a little synthesis where the recording alone lacks weight
    rec(name, pan) {
      const T = (k, m, o) => this.take(k, m, Object.assign({ pan }, o || {}));
      switch (name) {
        case 'splash': return T('splash', 1.0) && (this.thump(95, 0.12, 0, pan), true);
        case 'plop': return T('plop', 0.9);
        case 'swim': return T('stroke', 0.5, { rate: rnd(0.9, 1.1) });
        case 'wade': return T('stroke', 0.4, { rate: rnd(1.05, 1.25) });
        case 'paddle': return T('stroke', 0.75, { rate: rnd(0.85, 0.95) }) && (this.wood(140, 0.06, 0.02), true);
        case 'climb': return T('splash', 0.55, { rate: 0.9 }) && (T('drip', 0.6, { delay: 0.35 }), this.take('knock', 0.35, { delay: 0.55, rate: 0.8 }), true);
        case 'chop': return T('knock', 1.0, { rate: rnd(0.78, 0.9) }) && (this.thump(95, 0.18, 0, pan), this.nz({ dur: 0.05, vol: 0.12, f0: 1800, f1: 700, q: 0.8, pan }), true);
        case 'build': return T('knock', 0.9, { rate: rnd(0.85, 1.0) }) && (this.take('knock', 0.7, { delay: 0.16, rate: rnd(0.85, 1.0), pan }), true);
        case 'demolish': return T('knock', 0.9) && (this.take('splinter', 0.9, { delay: 0.08, pan }), this.take('knock', 0.6, { delay: 0.25, rate: 0.8, pan }), true);
        case 'stepwood': return T('knock', 0.13, { rate: rnd(0.55, 0.7) }) && (Math.random() < 0.15 && this.take('creak', 0.25, { rate: rnd(0.9, 1.2), pan }), true);
        case 'hit': return T('knock', 0.8, { rate: 0.6 }) && (this.thump(130, 0.25, 0, pan), true);
        case 'mine': return T('stone', 1.0, { rate: rnd(0.95, 1.1) }) && (this.thump(130, 0.1, 0, pan), true);
        case 'rockbreak': return T('stone', 1.0) && (this.take('stone', 0.8, { delay: 0.12, pan }), this.take('stone', 0.6, { delay: 0.3, pan }), true);
        case 'treefall': return T('creak', 0.9, { rate: 0.6 }) && (this.take('splinter', 1.0, { delay: 0.9, rate: 0.7, pan }), this.take('knock', 1.0, { delay: 1.15, rate: 0.5, pan }), this.thump(62, 0.5, 1.15), true);
        case 'creak': return T('creak', rnd(0.35, 0.6), { rate: rnd(0.75, 1.15), pan: rnd(-0.7, 0.7) });
        case 'door': case 'open': return T('door', 1.0);
        case 'rope': return T('rope', 0.9);
        case 'snag': return T('knock', 0.4, { rate: 1.3 }) && (T('plop', 0.4), true);
        case 'drink': return T('drink', 0.9);
        case 'water': return T('pour', 0.8);
        case 'eat': return T('eat', 0.9);
        case 'page': return T('page', 0.9);
        case 'radio': return T('radio', 0.7);
        case 'gull': return T('gull', 0.5, { pan: rnd(-0.8, 0.8) });
        case 'choke': return T('bubbles', 1.0) && (this.nz({ dur: 0.4, vol: 0.12, type: 'lowpass', f0: 420, pinkN: 1 }), true);
        case 'hiss': return T('sizzle', 0.8);
        case 'lantern': return T('flint', 0.8) && (this.glide(110, 112, 1.4, 0.05, 'sine', 0.2, 0, null, 0.4), true);
        case 'bite2': return T('splash', 1.0, { rate: 0.8 }) && (this.thump(70, 0.5, 0, pan), this.take('splinter', 0.5, { delay: 0.05, rate: 0.8, pan }), true);
        case 'catch': return T('splash', 0.6, { rate: 1.15 });
        case 'dig': return T('stone', 0.4, { rate: 0.6 }) && (this.thump(110, 0.1), true);
      }
      return false;
    },
    sfx(name) {
      if (!ac || G.state === 'menu' && name !== 'click') return; const r = () => rnd(0.9, 1.1), pan = rnd(-0.25, 0.25);
      if (G.settings.recordedSfx !== false && this.rec(name, pan)) return;
      switch (name) {
        case 'click': this.modal(1500, [1, 2.4], [0.02, 0.012], 0.06); this.tick(0.05); break;
        case 'deny': this.thump(120, 0.16); this.thump(105, 0.14, 0.11); break;
        case 'pickup': this.nz({ dur: 0.06, vol: 0.13, f0: 1500 * r(), q: 0.9 }); this.modal(310 * r(), [1, 2.6], [0.045, 0.025], 0.1); this.bubble(520 * r(), 0.035, 0.03); break;
        case 'open': this.creak(430, 0.28, 0.06, 0, pan, 30, 55); this.wood(170, 0.2, 0.3); break;
        case 'craft': this.wood(260 * r(), 0.14); this.nz({ dur: 0.16, vol: 0.07, f0: 1300, f1: 800, q: 1.5, delay: 0.05 }); this.wood(330 * r(), 0.1, 0.19); break;
        case 'craftdone': this.bar(660, 0.11); this.bar(990, 0.09, 0.09); break;
        case 'build': this.wood(210 * r(), 0.34); this.wood(190 * r(), 0.28, 0.14); this.thump(90, 0.12, 0.02); break;
        case 'demolish': this.nz({ dur: 0.09, vol: 0.32, type: 'highpass', f0: 1700 }); this.wood(240, 0.3); this.wood(180, 0.24, 0.12); this.wood(150, 0.2, 0.27); this.wood(205, 0.12, 0.4); break;
        case 'chop': this.wood(185 * r(), 0.42, 0, pan); this.nz({ dur: 0.07, vol: 0.3, f0: 1900, f1: 650, q: 0.8, pan }); this.thump(95, 0.2, 0, pan); break;
        case 'mine': this.stone(1050 * r(), 0.3, 0, pan); this.thump(130, 0.12, 0, pan); break;
        case 'treefall': this.creak(300, 1.0, 0.11, 0, pan, 14, 60); this.nz({ dur: 1.2, vol: 0.16, type: 'highpass', f0: 2200, att: 0.5, delay: 0.3 }); this.thump(62, 0.5, 1.15); this.nz({ dur: 0.5, vol: 0.3, type: 'lowpass', f0: 500, delay: 1.15, pinkN: 1 }); this.wood(120, 0.25, 1.17); break;
        case 'rockbreak': for (let i = 0; i < 5; i++) this.stone(rnd(600, 1300), 0.24, i * rnd(0.05, 0.09)); this.nz({ dur: 0.5, vol: 0.2, type: 'lowpass', f0: 380, pinkN: 1 }); break;
        case 'thud': case 'land': this.thump(88 * r(), 0.3); break;
        case 'clang': this.modal(540 * r(), [1, 2.32, 3.86, 5.1, 6.7], [0.5, 0.38, 0.28, 0.2, 0.14], 0.08); this.tick(0.12); break;
        case 'whoosh': this.nz({ dur: 0.24, vol: 0.2, f0: 480, fm: 1500, f1: 650, q: 1.3, att: 0.07 }); break;
        case 'hit': this.thump(140, 0.34); this.nz({ dur: 0.09, vol: 0.22, f0: 750, q: 0.8 }); break;
        case 'hurt': this.thump(100, 0.34); this.nz({ dur: 0.16, vol: 0.14, f0: 520, q: 1.1, delay: 0.02 }); break;
        case 'bite2': this.thump(75, 0.5); this.grains(5, 0.16, { dur: 0.045, vol: 0.3, f0: 1500, q: 1.6 }); this.splash(0.45, pan); break;
        case 'break': this.nz({ dur: 0.05, vol: 0.34, type: 'highpass', f0: 1900 }); this.modal(720 * r(), [1, 2.5, 4.3], [0.04, 0.025, 0.015], 0.2); break;
        case 'splash': this.splash(0.55, pan); break;
        case 'plop': this.bubble(250 * r(), 0.22); this.bubble(420 * r(), 0.14, 0.045); this.nz({ dur: 0.14, vol: 0.12, type: 'highpass', f0: 1600 }); this.nz({ dur: 0.35, vol: 0.05, f0: 900, f1: 400, q: 0.7, delay: 0.03 }); break;
        case 'swim': this.nz({ dur: 0.5, vol: 0.13, f0: 480, fm: 1300, f1: 430, q: 0.8, att: 0.12, pan }); this.bubbles(3, 300, 800, 0.05, 0.4, 0.1, pan); break;
        case 'wade': this.nz({ dur: 0.32, vol: 0.14, f0: 650, fm: 1500, f1: 600, q: 0.8, att: 0.05, pan }); this.bubbles(2, 300, 700, 0.05, 0.25, 0.05, pan); break;
        case 'paddle': this.nz({ dur: 0.55, vol: 0.2, f0: 420, fm: 1400, f1: 420, q: 0.8, att: 0.1 }); this.bubbles(4, 250, 700, 0.07, 0.45, 0.1); this.wood(140, 0.1, 0.02); break;
        case 'stepsand': this.grains(3, 0.07, { dur: 0.07, vol: 0.11, type: 'lowpass', f0: 1300, f1: 500, pan }); this.nz({ dur: 0.05, vol: 0.03, type: 'highpass', f0: 3500, pan }); break;
        case 'stepgrass': this.nz({ dur: 0.1, vol: 0.07, type: 'highpass', f0: 2600, att: 0.02, pan }); this.nz({ dur: 0.07, vol: 0.08, type: 'lowpass', f0: 450, pan, pinkN: 1 }); break;
        case 'stepwood': this.modal(92 * r(), [1, 2.3, 4.1], [0.07, 0.04, 0.02], 0.2, 0, pan); this.nz({ dur: 0.03, vol: 0.09, type: 'lowpass', f0: 900, pan }); if (Math.random() < 0.18) this.creak(420, 0.14, 0.035, 0.04, pan, 40, 60); break;
        case 'jump': this.nz({ dur: 0.09, vol: 0.06, f0: 900, q: 0.7, att: 0.03 }); break;
        case 'climb': this.nz({ dur: 1.1, vol: 0.2, f0: 1900, f1: 700, q: 0.7, att: 0.08 }); this.bubbles(9, 400, 1400, 0.06, 1.3, 0.2); this.wood(120, 0.16, 0.34); this.wood(105, 0.13, 0.62); break;
        case 'eat': for (let i = 0; i < 3; i++) { this.nz({ dur: 0.055, vol: 0.16, f0: 1800 * r(), q: 2, delay: i * 0.17 }); this.tick(0.06, i * 0.17); } break;
        case 'drink': for (let i = 0; i < 3; i++) { this.glide(190 * r(), 115, 0.09, 0.18, 'sine', i * 0.23); this.nz({ dur: 0.06, vol: 0.03, f0: 700, delay: i * 0.23 + 0.05 }); } break;
        case 'water': this.nz({ dur: 0.85, vol: 0.1, f0: 1500, q: 1.4, att: 0.08 }); this.bubbles(10, 350, 1300, 0.07, 0.8); break;
        case 'bandage': this.grains(12, 0.3, { dur: 0.03, vol: 0.09, type: 'highpass', f0: 1900 }); break;
        case 'page': this.nz({ dur: 0.2, vol: 0.06, type: 'highpass', f0: 3000, att: 0.05 }); this.grains(3, 0.12, { dur: 0.02, vol: 0.05, type: 'highpass', f0: 4000 }); break;
        case 'door': this.creak(380, 0.32, 0.06, 0, pan, 26, 50); this.wood(150, 0.22, 0.34); break;
        case 'rope': this.creak(900, 0.42, 0.045, 0, 0, 40, 75); this.nz({ dur: 0.4, vol: 0.035, f0: 1300, q: 1, att: 0.1 }); break;
        case 'sail': this.nz({ dur: 0.38, vol: 0.3, type: 'lowpass', f0: 750, f1: 240, pinkN: 1 }); this.nz({ dur: 0.3, vol: 0.2, type: 'lowpass', f0: 600, f1: 220, delay: 0.19, pinkN: 1 }); this.nz({ dur: 0.2, vol: 0.05, type: 'highpass', f0: 2500, att: 0.04 }); break;
        case 'creak': this.creak(rnd(260, 430), rnd(0.45, 0.9), 0.055, 0, rnd(-0.6, 0.6), rnd(14, 24), rnd(30, 52)); break;
        case 'throw': this.nz({ dur: 0.32, vol: 0.2, f0: 520, fm: 1900, f1: 800, q: 1.4, att: 0.09 }); this.nz({ dur: 0.5, vol: 0.03, f0: 1500, q: 3, att: 0.1, delay: 0.1 }); break;
        case 'snag': this.wood(250 * r(), 0.14); this.bubble(380, 0.07, 0.03); break;
        case 'cast': this.nz({ dur: 0.34, vol: 0.09, f0: 1500, fm: 4200, f1: 2200, q: 2, att: 0.1 }); break;
        case 'bite': this.bubble(330, 0.14); this.bubble(520, 0.1, 0.13); this.nz({ dur: 0.1, vol: 0.05, type: 'highpass', f0: 1800 }); break;
        case 'catch': this.splash(0.3, pan); this.grains(4, 0.3, { dur: 0.05, vol: 0.12, f0: 700, q: 1, delay: 0.15 }); break;
        case 'dig': this.grains(6, 0.25, { dur: 0.06, vol: 0.14, f0: 1200, f1: 500, q: 0.7 }); this.thump(110, 0.1); break;
        case 'plant': this.thump(120, 0.12); this.nz({ dur: 0.14, vol: 0.06, type: 'highpass', f0: 2400, att: 0.03 }); break;
        case 'hiss': this.nz({ dur: 0.9, vol: 0.11, type: 'highpass', f0: 4500, att: 0.03 }); break;
        case 'bow': this.modal(140 * r(), [1, 2, 3.01], [0.25, 0.12, 0.08], 0.16); this.nz({ dur: 0.18, vol: 0.07, type: 'highpass', f0: 2500, att: 0.02 }); break;
        case 'quest': this.bar(392, 0.1); this.bar(587, 0.09, 0.14); break;
        case 'questdone': this.bar(392, 0.1); this.bar(494, 0.09, 0.12); this.bar(587, 0.09, 0.24); this.bar(784, 0.1, 0.38); break;
        case 'step': this.bar(520, 0.07); break;
        case 'levelup': this.bar(523, 0.09); this.bar(659, 0.09, 0.1); this.bar(784, 0.1, 0.2); break;
        case 'discover': this.bar(440, 0.08); this.bar(660, 0.08, 0.16); this.glide(880, 880, 1.6, 0.03, 'sine', 0.3, 0, rev); break;
        case 'lantern': this.nz({ dur: 0.55, vol: 0.2, type: 'lowpass', f0: 380, f1: 1500, att: 0.2, pinkN: 1 }); this.grains(8, 0.7, { dur: 0.02, vol: 0.06, type: 'highpass', f0: 3000, delay: 0.2 }); this.glide(110, 112, 1.4, 0.06, 'sine', 0.2, 0, null, 0.4); break;
        case 'radio': this.nz({ dur: 0.7, vol: 0.1, f0: 1800, q: 2.5, att: 0.03 }); this.grains(7, 0.6, { dur: 0.04, vol: 0.09, f0: 2600, q: 4 }); this.glide(900, 1500, 0.3, 0.02, 'sine', 0.1); this.glide(1500, 720, 0.3, 0.02, 'sine', 0.4); break;
        case 'sonar': this.glide(1480, 1470, 1.0, 0.1, 'sine'); this.glide(1480, 1465, 0.8, 0.03, 'sine', 0.36); this.glide(1480, 1460, 0.7, 0.012, 'sine', 0.72); break;
        case 'beep': this.glide(1200, 1200, 0.08, 0.06, 'sine'); break;
        case 'tension': this.glide(55, 52, 2.6, 0.2, 'sine', 0, 0, null, 1.0); this.glide(58.5, 55, 2.6, 0.16, 'sine', 0, 0, null, 1.0); this.nz({ dur: 2.4, vol: 0.05, type: 'lowpass', f0: 220, att: 1.0, pinkN: 1 }); break;
        case 'heartbeat': this.glide(62, 38, 0.11, 0.42, 'sine'); this.glide(56, 36, 0.12, 0.32, 'sine', 0.27); break;
        case 'choke': this.bubbles(10, 180, 700, 0.14, 0.5); this.nz({ dur: 0.4, vol: 0.14, type: 'lowpass', f0: 420, pinkN: 1 }); break;
        case 'whale': this.glide(170, 105, 1.8, 0.11, 'sine', 0, 0, rev, 0.5); this.glide(105, 150, 1.6, 0.09, 'sine', 1.7, 0, rev, 0.4); this.glide(340, 215, 1.8, 0.02, 'sine', 0, 0, rev, 0.5); break;
        case 'dolphin': for (let i = 0; i < 12; i++) this.tick(0.05, i * 0.022 + (i > 5 ? 0.12 : 0)); this.glide(7000, 11500, 0.22, 0.03, 'sine', 0.3); this.glide(11000, 8000, 0.18, 0.025, 'sine', 0.55); break;
        case 'boar': for (let i = 0; i < 2; i++) { const d = i * 0.26; this.glide(92, 70, 0.22, 0.16, 'sawtooth', d); this.nz({ dur: 0.22, vol: 0.16, f0: 420, q: 2.2, delay: d, pinkN: 1 }); this.grains(7, 0.2, { dur: 0.02, vol: 0.1, f0: 1100, q: 2, delay: d }); } break;
        case 'gull': for (let i = 0; i < 3; i++) { const d = i * 0.34, f = 1750 * r() * (1 - i * 0.06); this.glide(f * 0.8, f * 1.25, 0.09, 0.022, 'sawtooth', d + rnd(0, 0.03), pan); this.glide(f * 1.25, f * 0.72, 0.2, 0.026, 'sawtooth', d + 0.09, pan); this.nz({ dur: 0.26, vol: 0.012, f0: 2700, q: 4, delay: d, pan }); } break;
        case 'chirp': { const f = rnd(3200, 4600); for (let i = 0; i < 4; i++) { this.glide(f, f * 1.28, 0.045, 0.022, 'sine', i * 0.085, pan); this.glide(f * 1.28, f * 0.9, 0.04, 0.018, 'sine', i * 0.085 + 0.045, pan); } break; }
        case 'cricket': for (let c = 0; c < 3; c++) for (let i = 0; i < 4; i++) this.glide(4500, 4500, 0.012, 0.012, 'sine', c * 0.2 + i * 0.022, pan); break;
      }
    },
    thunder(delay) {
      if (!ac) return; const d = delay || 0, pan = rnd(-0.6, 0.6);
      if (this.take('thunder', 1.0, { delay: d, pan, rate: rnd(0.85, 1.05), fout: 1.5 })) return;
      this.nz({ dur: 0.3, vol: 0.6, type: 'highpass', f0: 1100, f1: 300, delay: d, pan }); this.grains(5, 0.5, { dur: 0.12, vol: 0.4, f0: 600, q: 0.6, delay: d + 0.05, pan });
      this.nz({ dur: 5, vol: 0.8, type: 'lowpass', f0: 420, f1: 45, q: 0.6, delay: d + 0.08, pinkN: 1, att: 0.15 }); this.nz({ dur: 3.5, vol: 0.5, type: 'lowpass', f0: 170, f1: 40, q: 0.6, delay: d + 1.3, pinkN: 1, att: 0.6 }); this.nz({ dur: 3, vol: 0.3, type: 'lowpass', f0: 120, f1: 40, delay: d + 3, pinkN: 1, att: 0.8 });
    },
    // one pad note of the generative score
    pad(freq, dur, vol) {
      const t = ac.currentTime, g = ac.createGain(), f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = this.mood === 'under' ? 700 : 1500; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      for (const det of [-6, 0, 7]) { const o = ac.createOscillator(); o.type = det === 0 ? 'triangle' : 'sine'; o.frequency.value = freq; o.detune.value = det; o.connect(f); o.start(t); o.stop(t + dur + 0.1); }
      f.connect(g); g.connect(musBus); g.connect(rev);
    },
    music(dt) {
      this.musT -= dt; if (this.musT > 0 || G.settings.volMusic <= 0.001) return;
      const CH = { calm: [[0, 4, 7, 11], [5, 9, 12, 16], [-3, 0, 4, 7], [2, 5, 9, 12], [7, 11, 14, 16]], night: [[0, 3, 7, 10], [-4, 0, 3, 7], [5, 8, 12, 15], [-2, 2, 5, 9]], storm: [[0, 1, 7], [-5, 0, 6], [0, 3, 6], [-7, 0, 1]], under: [[0, 7, 14, 19], [-5, 2, 9, 16], [3, 10, 15, 22]], danger: [[0, 1, 6], [0, 6, 7]] }[this.mood] || [[0, 4, 7]];
      const c = CH[Math.floor(Math.random() * CH.length)], base = { calm: 196, night: 164.8, storm: 98, under: 130.8, danger: 82.4 }[this.mood] || 196, len = this.mood === 'danger' ? 3 : 9 + Math.random() * 5;
      c.forEach((s, i) => { if (Math.random() < 0.85) setTimeout(() => { if (ac) this.pad(base * Math.pow(2, s / 12), len, i === 0 ? 0.09 : 0.055); }, i * 350 * Math.random()); });
      if (this.mood !== 'storm' && this.mood !== 'danger' && Math.random() < 0.6) { const s = c[Math.floor(Math.random() * c.length)] + 12; this.tone(base * 2 * Math.pow(2, s / 12), 3.5, 'sine', 0.035, null, rev, 2 + Math.random() * 3); }
      this.musT = len * (this.mood === 'danger' ? 0.8 : 0.55) + Math.random() * 6;
    },
    update(dt) {
      if (!ac || !this.ready) return; this.t += dt; const W = G.weather, P = G.player, L = this.loops, now = ac.currentTime; const playing = G.state === 'play' || G.state === 'menu';
      const under = playing && G.render.underwater, k = 0.15; const set = (l, v) => l.g.gain.setTargetAtTime(playing && Number.isFinite(v) ? v : 0, now, k);   // a NaN from any input must never throw out of the game loop
      muffle.frequency.setTargetAtTime(under ? 520 : 20000, now, 0.08);
      const sea = W.sea, onRaft = P.parent && P.parent.kind === 'raft', I = G.world.nearest, shore = I ? G.clamp(1 - (I._d - I.r) / 90, 0, 1) : 0;
      // continuous bed: quiet, the character comes from the individual waves below
      set(L.sea, under ? 0.03 : 0.035 + sea * 0.05); L.sea.f.frequency.setTargetAtTime(480 + sea * 260, now, 0.5); set(L.seaLow, under ? 0.1 : 0.04 + sea * 0.09); set(L.surf, under ? 0 : 0.004 + sea * 0.008 + shore * 0.012);
      // wind gusts: a slow random walk, not a sine
      this.gustV += (Math.random() - 0.5) * dt * 1.6 - this.gustV * dt * 0.8; this.gust = G.clamp(this.gust + this.gustV * dt, 0, 1); const wv = Math.max(0, W.wind - 0.18) * (0.45 + this.gust * 0.9);
      set(L.wind, under ? 0 : wv * 0.11); L.wind.f.frequency.setTargetAtTime(300 + W.wind * 260 + this.gust * 260, now, 0.4); set(L.windHi, under ? 0 : Math.max(0, W.wind - 0.55) * (0.2 + this.gust) * 0.035); L.windHi.f.frequency.setTargetAtTime(1100 + this.gust * 900 + W.wind * 300, now, 0.3);
      set(L.rain, under ? 0.008 * W.rain : W.rain * 0.12 * (P.shaded ? 0.6 : 1)); set(L.rainLow, under ? 0 : W.rain * (onRaft ? 0.09 : 0.05)); set(L.deep, under ? 0.3 + Math.min(0.4, G.render.camDepth * 0.012) : 0);
      const raft = G.structs.raft, v = G.vehicles.current; const eng = (raft && raft.engineOn ? 0.12 : 0) + (v && v.type === 'skiff' && Math.abs(v.speed) > 0.5 ? 0.14 : 0); set(L.engine, eng); L.engine.f.frequency.setTargetAtTime(120 + (v ? Math.abs(v.speed) * 12 : 60), now, 0.3);
      // recorded beds: water working against the hull, surf on a nearby shore, rain, birds by day, insects by night, fire
      const RL = this.rl, mk = (k) => RL[k] || (CL()[k] && this.smp[CL()[k][0][0]] && (RL[k] = this.mkLoop(CL()[k][0][0], CL()[k][0][1], CL()[k][0][2], CL()[k][0][3])));
      const night = G.sky.night > 0.5, land = I ? G.clamp(1 - (I._d - I.r) / 140, 0, 1) : 0, inMenu = G.state === 'menu';
      const want = { lap: under ? 0 : (onRaft || P.mode === 'boat' || inMenu ? 0.55 + sea * 0.25 : P.swimming ? 0.3 : 0) * (1 - shore * 0.5), shore: under ? 0 : shore * 0.7, rain: under ? 0 : W.rain * (P.shaded ? 0.55 : 0.8),
        birds: under || night || W.rain > 0.3 ? 0 : land * 0.32, night: under || !night || W.rain > 0.3 ? 0 : land * 0.4, fire: P.nearFire && !under ? 0.5 : 0 };
      let recBed = false;
      for (const k in want) { const L = mk(k); if (L) { this.tickLoop(L, playing ? want[k] : 0, now); if (k === 'lap' || k === 'shore') recBed = true; } }
      if (recBed) { set(L.surf, 0); if (want.rain > 0 && RL.rain) set(L.rain, under ? 0.008 * W.rain : W.rain * 0.04); }
      if (playing && !under) {
        // individual waves: a swell of mid noise that sweeps downward, then a hissing foam tail
        this.waveT -= dt; if (this.waveT <= 0) { this.waveT = rnd(1.6, 4.6) / (0.6 + sea * 0.5); const pan = rnd(-0.8, 0.8), d = rnd(2.4, 4.2), v0 = (0.05 + sea * 0.07) * rnd(0.5, 1) * (1 + shore) * (recBed ? 0.55 : 1);
          this.nz({ dur: d, vol: v0, f0: rnd(700, 1100), f1: rnd(280, 420), q: 0.5, att: d * rnd(0.22, 0.38), pan, bus: ambBus, pinkN: 1 });
          this.nz({ dur: d * 0.8, vol: v0 * (0.16 + shore * 0.4), type: 'highpass', f0: rnd(3000, 4500), att: d * 0.3, delay: d * 0.25, pan, bus: ambBus }); }
        // water working against the hull
        if ((onRaft || G.state === 'menu') && !RL.lap) { this.lapT -= dt; if (this.lapT <= 0) { this.lapT = rnd(0.5, 2.2) / (0.7 + sea * 0.4); const pan = rnd(-0.9, 0.9), v0 = (0.035 + sea * 0.03) * rnd(0.4, 1);
          this.nz({ dur: rnd(0.16, 0.3), vol: v0, type: 'lowpass', f0: rnd(380, 700), att: 0.03, pan, bus: ambBus, pinkN: 1 }); this.bubble(rnd(140, 300), v0 * 0.7, rnd(0, 0.08), pan, ambBus); if (Math.random() < 0.4) this.bubble(rnd(300, 600), v0 * 0.4, rnd(0.05, 0.2), pan, ambBus); } }
      }
      if (G.state !== 'play') { if (G.state === 'menu') this.music(dt); return; }
      // incidental life
      this.amb = (this.amb || 0) - dt;
      if (this.amb <= 0) {
        this.amb = 1.5 + Math.random() * 4; const nearLand = I && I._d < 80, night = G.sky.night > 0.5;
        if (!under && W.storm < 0.5) { if (nearLand && !night && Math.random() < 0.6) this.sfx('chirp'); if (nearLand && night && Math.random() < 0.7) this.sfx('cricket'); if (!night && I && I._d < 400 && Math.random() < 0.25) this.sfx('gull'); }
        if (onRaft && Math.random() < 0.22 + sea * 0.25) this.sfx('creak');
        if (under && Math.random() < 0.5) { G.fx.bubbles(G.camera.position.x + (Math.random() - 0.5), G.camera.position.y - 0.3, G.camera.position.z + (Math.random() - 0.5), 3); this.bubbles(3, 200, 600, 0.05, 0.4); }
      }
      const shark = G.wildlife.list.some((c) => c.type === 'shark' && (c.state === 'circle' || c.state === 'attack' || c.state === 'raft'));
      const mood = shark ? 'danger' : W.storm > 0.5 ? 'storm' : under ? 'under' : G.sky.night > 0.6 ? 'night' : 'calm'; if (mood !== this.mood) { this.mood = mood; this.musT = Math.min(this.musT, 1.5); }
      this.music(dt);
    }
  };
})();
