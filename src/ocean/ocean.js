'use strict';
/* Ocean.
   Waves: a wind-driven wave spectrum synthesised by inverse FFT every frame (Tessendorf's method), split into four
   cascades of different patch size so the surface has structure from 370 m swell down to 6 cm ripples and never
   visibly tiles. The same height field the GPU draws is sampled on the CPU for buoyancy.
   Shading: per-pixel slopes from the spectrum, roughness from the slope variance too fine to resolve at that distance
   (so glitter widens and the horizon smooths naturally), Fresnel sky/cloud reflection, screen-space reflection of the
   world, refraction with depth absorption, subsurface scatter in crests, whitecaps from wave folding, shore foam. */
(function () {
  const G = window.G;
  const N = 64, N2 = N * N, NC = 4, GRAV = 9.81, MAXI = 8, TAU = Math.PI * 2;
  const LEN = [367, 57, 9.1, 1.87];                       // patch size of each cascade (m)
  const KB = [0, TAU / 17, TAU / 2.8, TAU / 0.45, 1e9];   // wavenumber band edges between cascades
  const LAM = [1.0, 1.0, 0.85, 0.5];                      // horizontal (choppy) displacement scale
  const DW = [[0, 1], [0.3, 0.7], [0.6, 0.4], [0.8, 0.2]]; // island sheltering per cascade: a + b * damp

  // ---------- FFT ----------
  const rev = new Uint8Array(N), cosT = new Float32Array(N / 2), sinT = new Float32Array(N / 2);
  for (let i = 0; i < N; i++) { let r = 0; for (let b = 0, v = i; b < 6; b++) { r = (r << 1) | (v & 1); v >>= 1; } rev[i] = r; }
  for (let i = 0; i < N / 2; i++) { cosT[i] = Math.cos(TAU * i / N); sinT[i] = Math.sin(TAU * i / N); }
  function fft1(re, im, off, st) {
    for (let i = 0; i < N; i++) { const j = rev[i]; if (j > i) { const a = off + i * st, b = off + j * st; let t = re[a]; re[a] = re[b]; re[b] = t; t = im[a]; im[a] = im[b]; im[b] = t; } }
    for (let size = 2, half = 1, step = N >> 1; size <= N; half = size, size <<= 1, step >>= 1) {
      for (let i = 0; i < N; i += size) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const a = off + (i + j) * st, b = a + half * st, wr = cosT[k], wi = sinT[k];
          const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        }
      }
    }
  }
  function fft2(re, im) { for (let j = 0; j < N; j++) fft1(re, im, j * N, 1); for (let i = 0; i < N; i++) fft1(re, im, i, N); }
  const r1 = new Float32Array(N2), i1 = new Float32Array(N2), r2 = new Float32Array(N2), i2 = new Float32Array(N2), r3 = new Float32Array(N2), i3 = new Float32Array(N2);

  function Cascade(ci, rnd) {
    const L = LEN[ci], dk = TAU / L, act = [], map = new Int32Array(N2).fill(-1);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (i === N / 2 || j === N / 2) continue;
      const nx = i < N / 2 ? i : i - N, nz = j < N / 2 ? j : j - N, k = Math.hypot(nx, nz) * dk;
      if (k === 0 || k < KB[ci] || k >= KB[ci + 1]) continue;
      map[j * N + i] = act.length; act.push(j * N + i);
    }
    const M = this.M = act.length; this.ci = ci; this.L = L; this.dk = dk; this.lam = LAM[ci];
    this.idx = Int32Array.from(act); this.neg = new Int32Array(M);
    this.kx = new Float32Array(M); this.kz = new Float32Array(M); this.k = new Float32Array(M); this.om = new Float32Array(M);
    this.xr = new Float32Array(M); this.xi = new Float32Array(M); this.h0r = new Float32Array(M); this.h0i = new Float32Array(M);
    for (let m = 0; m < M; m++) {
      const id = act[m], i = id % N, j = (id / N) | 0, nx = i < N / 2 ? i : i - N, nz = j < N / 2 ? j : j - N;
      this.kx[m] = nx * dk; this.kz[m] = nz * dk; this.k[m] = Math.hypot(nx, nz) * dk; this.om[m] = Math.sqrt(GRAV * this.k[m]);
      this.neg[m] = map[((N - j) % N) * N + ((N - i) % N)];
      const u1 = Math.max(rnd(), 1e-7), u2 = rnd(), g = Math.sqrt(-2 * Math.log(u1)); this.xr[m] = g * Math.cos(TAU * u2); this.xi[m] = g * Math.sin(TAU * u2);
    }
    this.A = new Float32Array(N2 * 4); // choppy dx, height, choppy dz, -
    this.B = new Float32Array(N2 * 4); // slope x, slope z, held surface folding, height
    this.mss = 0; this.varH = 0;
  }
  Cascade.prototype.evolve = function (t, dt) {
    const M = this.M, idx = this.idx, neg = this.neg, h0r = this.h0r, h0i = this.h0i, om = this.om, K = this.k, KX = this.kx, KZ = this.kz;
    r1.fill(0); i1.fill(0); r2.fill(0); i2.fill(0); r3.fill(0); i3.fill(0);
    for (let m = 0; m < M; m++) {
      const ph = om[m] * t, c = Math.cos(ph), s = Math.sin(ph), n = neg[m], a = h0r[m], b = h0i[m], a2 = h0r[n], b2 = -h0i[n];
      const hr = (a + a2) * c + (b - b2) * s, hi = (b + b2) * c + (a2 - a) * s;
      const id = idx[m], k = K[m], kx = KX[m], kz = KZ[m], ux = kx / k, uz = kz / k;
      r1[id] = hr - k * hi; i1[id] = hi + k * hr;                 // height + i * (|k| h)  -> surface convergence
      r2[id] = -(ux * hi + uz * hr); i2[id] = ux * hr - uz * hi;  // horizontal displacement x + i z
      r3[id] = -(kx * hi + kz * hr); i3[id] = kx * hr - kz * hi;  // slope x + i z
    }
    fft2(r1, i1); fft2(r2, i2); fft2(r3, i3);
    const A = this.A, B = this.B, lam = this.lam, rec = dt * (this.ci === 0 ? 0.22 : this.ci === 1 ? 0.3 : 0.8), doFoam = this.ci < 3;
    for (let q = 0, o = 0; q < N2; q++, o += 4) {
      const h = r1[q]; A[o] = r2[q] * lam; A[o + 1] = h; A[o + 2] = i2[q] * lam;
      B[o] = r3[q]; B[o + 1] = i3[q]; B[o + 3] = h;
      if (doFoam) { const jn = -lam * i1[q], f = B[o + 2] + rec; B[o + 2] = jn < f ? jn : f; } // folding of the surface (Jacobian - 1), held and slowly released so foam trails behind crests
    }
  };
  // bilinear sample of an interleaved N x N RGBA field at world (x, z); returns channels through _s
  const _s = [0, 0, 0, 0];
  function bil(D, L, x, z, c0, c1) {
    let fx = x / L * N, fz = z / L * N; const ix = Math.floor(fx), iz = Math.floor(fz); fx -= ix; fz -= iz;
    const x0 = ix & (N - 1), x1 = (ix + 1) & (N - 1), z0 = (iz & (N - 1)) * N, z1 = ((iz + 1) & (N - 1)) * N;
    const a = (z0 + x0) * 4, b = (z0 + x1) * 4, c = (z1 + x0) * 4, d = (z1 + x1) * 4, w00 = (1 - fx) * (1 - fz), w10 = fx * (1 - fz), w01 = (1 - fx) * fz, w11 = fx * fz;
    _s[0] = D[a + c0] * w00 + D[b + c0] * w10 + D[c + c0] * w01 + D[d + c0] * w11;
    _s[1] = D[a + c1] * w00 + D[b + c1] * w10 + D[c + c1] * w01 + D[d + c1] * w11;
  }

  function foamTexture() {
    const S = 256, data = new Uint8Array(S * S * 4), rnd = G.rng(4711);
    const mk = (C) => { const px = new Float32Array(C * C), py = new Float32Array(C * C); for (let i = 0; i < C * C; i++) { px[i] = rnd(); py[i] = rnd(); } return { C, px, py }; };
    const f12 = (W, u, v, out) => {
      const C = W.C, gx = u * C, gy = v * C, cx = Math.floor(gx), cy = Math.floor(gy); let a = 9, b = 9;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const qx = ((cx + i) % C + C) % C, qy = ((cy + j) % C + C) % C, id = qy * C + qx, dx = cx + i + W.px[id] - gx, dy = cy + j + W.py[id] - gy, d = Math.sqrt(dx * dx + dy * dy);
        if (d < a) { b = a; a = d; } else if (d < b) b = d;
      }
      out[0] = a; out[1] = b;
    };
    const w1 = mk(6), w2 = mk(15), w3 = mk(31), w4 = mk(10), o = [0, 0];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S, p = (y * S + x) * 4;
      f12(w1, u, v, o); const e1 = 1 - G.sstep(0.0, 0.42, o[1] - o[0]);
      f12(w2, u, v, o); const e2 = 1 - G.sstep(0.0, 0.5, o[1] - o[0]);
      f12(w3, u, v, o); const e3 = 1 - G.sstep(0.0, 0.6, o[1] - o[0]), b3 = 1 - Math.min(1, o[0] * 1.6);
      f12(w4, u, v, o); const blob = 1 - Math.min(1, o[0] * 1.25);
      data[p] = 255 * G.clamp(e1 * 0.62 + e2 * 0.38 + e3 * 0.16 - 0.08, 0, 1);   // large foam web
      data[p + 1] = 255 * G.clamp(e2 * 0.5 + e3 * 0.6 - 0.05, 0, 1);              // fine web
      data[p + 2] = 255 * G.clamp(blob * 0.7 + b3 * 0.3, 0, 1);                    // bubble clumps
      data[p + 3] = 255;
    }
    const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
    return t;
  }

  G.glsl.caustic = `
    float caustic(vec2 uv, float time){
      vec2 p = mod(uv * 6.28318530718, 6.28318530718) - 250.0; vec2 i = p; float c = 1.0; float inten = 0.005;
      for (int n = 0; n < 4; n++) {
        float t = time * (1.0 - (3.5 / float(n + 1)));
        i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
        c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
      }
      c /= 4.0; c = 1.17 - pow(c, 1.4); return pow(abs(c), 8.0);
    }`;

  const O = G.ocean = {
    time: 0, sea: 0.6, islands: [], dir: 0.7, cas: [], gen: { sea: -1, wind: -1, dir: -9, t: 0 }, rms: 0.2, cpuMs: 0,
    setBaseDir(a) { this.dir = a; this.gen.sea = -1; },
    dampAt(x, z) {
      let d = 1; const L = this.islands;
      for (let i = 0; i < L.length; i++) {
        const I = L[i], dist = Math.hypot(x - I.x, z - I.z);
        const f = 0.16 + 0.84 * G.sstep(I.r * 0.8, I.r * 1.45 + 70, dist); if (f < d) d = f;
      }
      return d;
    },
    // surface height at a world position (the two large cascades; ripples do not move a raft)
    height(x, z) {
      const C = this.cas; if (!C.length) return 0;
      const d = this.dampAt(x, z), w0 = d, w1 = 0.3 + 0.7 * d, c0 = C[0], c1 = C[1];
      let px = x, pz = z;
      for (let it = 0; it < 2; it++) { // undo the horizontal displacement so we read the column that ends up at (x, z)
        bil(c0.A, c0.L, px, pz, 0, 2); let ox = _s[0] * w0, oz = _s[1] * w0; bil(c1.A, c1.L, px, pz, 0, 2); ox += _s[0] * w1; oz += _s[1] * w1; px = x - ox; pz = z - oz;
      }
      bil(c0.A, c0.L, px, pz, 1, 1); let h = _s[0] * w0; bil(c1.A, c1.L, px, pz, 1, 1); return h + _s[0] * w1;
    },
    // out = {h, nx, nz}: height and the horizontal part of the (un-normalised, y = 1) surface normal
    sample(x, z, out) {
      const C = this.cas; if (!C.length) { out.h = 0; out.nx = 0; out.nz = 0; return out; }
      const d = this.dampAt(x, z), w0 = d, w1 = 0.3 + 0.7 * d, c0 = C[0], c1 = C[1];
      bil(c0.A, c0.L, x, z, 0, 2); let ox = _s[0] * w0, oz = _s[1] * w0; bil(c1.A, c1.L, x, z, 0, 2); const px = x - ox - _s[0] * w1, pz = z - oz - _s[1] * w1;
      bil(c0.A, c0.L, px, pz, 1, 1); let h = _s[0] * w0; bil(c1.A, c1.L, px, pz, 1, 1); h += _s[0] * w1;
      bil(c0.B, c0.L, px, pz, 0, 1); let sx = _s[0] * w0, sz = _s[1] * w0; bil(c1.B, c1.L, px, pz, 0, 1); sx += _s[0] * w1; sz += _s[1] * w1;
      out.h = h; out.nx = -sx; out.nz = -sz; return out;
    },
    // rebuild the spectrum amplitudes for the current sea state (random phases are fixed, so the sea morphs smoothly)
    spectrum(sea, wind) {
      const V = Math.min(3.2 + 3.8 * sea, 11.5), Lp = V * V / GRAV, wx = Math.cos(this.dir), wz = Math.sin(this.dir);
      const rip = 0.3 + 1.25 * Math.min(wind, 1.4);
      let varBig = 0;
      for (const c of this.cas) {
        const dk2 = c.dk * c.dk; let vh = 0;
        for (let m = 0; m < c.M; m++) {
          const k = c.k[m], kl = k * Lp, ct = (c.kx[m] * wx + c.kz[m] * wz) / k;
          const pw = G.clamp(6 - 1.15 * Math.log2(Math.max(kl * 1.41, 1)), 0.8, 6);
          const D = ct > 0 ? Math.pow(ct, pw) : 0.07 * Math.pow(-ct, pw);
          let P = Math.exp(-1 / (kl * kl)) / (k * k * k * k) * D * (0.4 + 0.6 * pw / 6);
          if (k > 0.3) P *= G.lerp(1, 0.75 + 0.5 * Math.min(wind, 1.5), G.sstep(0.3, 0.8, k)); // wind sea
          if (k > 1.2) P *= G.lerp(1, rip, G.sstep(1.2, 5, k));       // ripples follow the local wind
          if (k > 40) P *= Math.exp(-(k - 40) * 0.02);
          const amp = Math.sqrt(P * dk2 * 0.5);
          c.h0r[m] = c.xr[m] * amp; c.h0i[m] = c.xi[m] * amp; vh += 2 * (c.h0r[m] * c.h0r[m] + c.h0i[m] * c.h0i[m]);
        }
        c.varH = vh; if (c.ci < 2) varBig += vh;
      }
      const target = 0.36 * sea, sc = target / Math.sqrt(Math.max(varBig, 1e-9));
      for (const c of this.cas) {
        let ms = 0; for (let m = 0; m < c.M; m++) { c.h0r[m] *= sc; c.h0i[m] *= sc; ms += 2 * c.k[m] * c.k[m] * (c.h0r[m] * c.h0r[m] + c.h0i[m] * c.h0i[m]); }
        c.mss = ms; c.varH *= sc * sc;
      }
      this.rms = target; this.gen.sea = sea; this.gen.wind = wind; this.gen.dir = this.dir;
      if (this.mat) { const u = this.mat.uniforms; u.uVar.value.set(this.cas[0].mss, this.cas[1].mss, this.cas[2].mss, this.cas[3].mss); u.uRms.value = target; }
    },
    init(scene) {
      this.scene = scene;
      const rnd = G.rng(90210); for (let i = 0; i < NC; i++) this.cas.push(new Cascade(i, rnd));
      const gl = G.render.renderer.getContext(), ext = G.render.renderer.extensions;
      this.floatOK = !!(ext.has('OES_texture_float_linear') && ext.has('EXT_color_buffer_float'));
      const mips = this.floatOK || ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float');
      const maxAniso = G.render.renderer.capabilities.getMaxAnisotropy();
      const mkTex = (arr) => {
        const data = this.floatOK ? arr : new Uint16Array(arr.length);
        const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, this.floatOK ? THREE.FloatType : THREE.HalfFloatType);
        t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter; t.generateMipmaps = mips; t.anisotropy = Math.min(8, maxAniso); t.src = arr; t.needsUpdate = true; return t;
      };
      for (const c of this.cas) { c.tA = mkTex(c.A); c.tB = mkTex(c.B); }
      this.foamTex = foamTexture();
      const isl = []; for (let i = 0; i < MAXI; i++) isl.push(new THREE.Vector4(0, 0, 0, 0));
      this.islUniform = isl; const C = this.cas;
      const U = Object.assign({
        uTime: { value: 0 }, uSea: { value: 0.6 }, uIsl: { value: isl }, uLen: { value: new THREE.Vector4(LEN[0], LEN[1], LEN[2], LEN[3]) },
        tA0: { value: C[0].tA }, tA1: { value: C[1].tA }, tA2: { value: C[2].tA }, tB0: { value: C[0].tB }, tB1: { value: C[1].tB }, tB2: { value: C[2].tB }, tB3: { value: C[3].tB },
        uVar: { value: new THREE.Vector4() }, uRms: { value: 0.2 }, uMicro: { value: 0.002 }, tFoam: { value: this.foamTex },
        tScene: { value: null }, tDepth: { value: null }, tSky: { value: null }, tNoise: { value: G.tex.detail.map }, uRes: { value: new THREE.Vector2(1, 1) }, uProj: { value: new THREE.Matrix4() },
        uNear: { value: 0.25 }, uFar: { value: 12000 }, uWaterCol: { value: new THREE.Color(0.01, 0.1, 0.17) }, uLight: { value: new THREE.Color(1, 1, 1) }, uSunVis: { value: 1 },
        uFogCol: { value: new THREE.Color(0.6, 0.7, 0.8) }, uFogDens: { value: 0.0004 }, uWhitecap: { value: 0.2 }, uFoamBias: { value: 0.4 }, uWake: { value: Array.from({ length: 24 }, () => new THREE.Vector4()) }, uWakeC: { value: new THREE.Vector4() }, uCover: { value: 0 }, uRefl: { value: 1 }, uSSR: { value: 1 }, uRainAmt: { value: 0 }
      }, G.skyUniforms);
      const HT = (0.5 / N).toFixed(6), DWV = `vec4 wd = vec4(damp, ${DW[1][0]} + ${DW[1][1]} * damp, ${DW[2][0]} + ${DW[2][1]} * damp, ${DW[3][0]} + ${DW[3][1]} * damp);`;
      this.mat = new THREE.ShaderMaterial({
        uniforms: U, side: THREE.DoubleSide, fog: false,
        vertexShader: `
          uniform sampler2D tA0; uniform sampler2D tA1; uniform sampler2D tA2; uniform vec4 uLen; uniform vec4 uIsl[${MAXI}];
          attribute float aSp;
          varying vec3 vWorld; varying vec2 vXZ; varying float vViewZ; varying float vDamp;
          void main(){
            vec4 wp = modelMatrix * vec4(position, 1.0); vec2 p = wp.xz;
            float damp = 1.0;
            for (int i = 0; i < ${MAXI}; i++) { if (uIsl[i].z > 0.0) { float dd = length(p - uIsl[i].xy); damp = min(damp, 0.16 + 0.84 * smoothstep(uIsl[i].z * 0.8, uIsl[i].z * 1.45 + 70.0, dd)); } }
            ${DWV}
            // band-limit each cascade to what this part of the mesh can represent, so geometry never shimmers
            vec3 lod = max(log2(aSp * ${N}.0 / uLen.xyz) + 0.6, 0.0);
            vec3 d = textureLod(tA0, p / uLen.x + ${HT}, lod.x).xyz * wd.x + textureLod(tA1, p / uLen.y + ${HT}, lod.y).xyz * wd.y + textureLod(tA2, p / uLen.z + ${HT}, lod.z).xyz * wd.z;
            wp.xyz += d; vWorld = wp.xyz; vXZ = p; vDamp = damp;
            vec4 mv = viewMatrix * wp; vViewZ = -mv.z; gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          precision highp float;
          uniform float uTime; uniform float uSea; uniform vec4 uLen; uniform vec4 uVar; uniform float uRms; uniform float uMicro;
          uniform sampler2D tB0; uniform sampler2D tB1; uniform sampler2D tB2; uniform sampler2D tB3; uniform sampler2D tFoam;
          uniform sampler2D tScene; uniform sampler2D tDepth; uniform sampler2D tNoise; uniform vec2 uRes; uniform float uNear; uniform float uFar; uniform mat4 uProj;
          uniform vec3 uWaterCol; uniform vec3 uLight; uniform vec3 uFogCol; uniform float uFogDens; uniform float uWhitecap; uniform float uFoamBias; uniform vec4 uWake[24]; uniform vec4 uWakeC; uniform float uCover; uniform float uRefl; uniform float uSSR; uniform float uRainAmt; uniform float uSunVis;
          varying vec3 vWorld; varying vec2 vXZ; varying float vViewZ; varying float vDamp;
          ${G.glsl.noise} ${G.glsl.sky} ${G.glsl.caustic}
          float linDepth(float d){ float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
          uniform sampler2D tSky;
          vec3 skyRefl(vec3 d, float lod){ return textureLod(tSky, vec2(atan(d.z, d.x) * 0.15915494, sqrt(clamp(d.y, 0.0, 1.0))), lod).rgb; }
          // march the reflected ray through the depth buffer; rgb = scene colour, a = confidence
          vec4 ssr(vec3 P, vec3 R, float jit){
            float t = 0.6 + jit * 0.12, prev = 0.0, lo = -1.0, hi = 0.0;
            for (int i = 0; i < 16; i++) {
              vec3 q = P + R * t; vec4 vq = viewMatrix * vec4(q, 1.0); vec4 cq = uProj * vq;
              if (cq.w <= 0.0) break;
              vec2 suv = cq.xy / cq.w * 0.5 + 0.5;
              if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) break;
              if (linDepth(textureLod(tDepth, suv, 0.0).x) < -vq.z) { lo = prev; hi = t; break; }
              prev = t; t *= 1.6;
            }
            if (lo < 0.0) return vec4(0.0);
            for (int j = 0; j < 5; j++) {
              float m = 0.5 * (lo + hi); vec4 v2 = viewMatrix * vec4(P + R * m, 1.0); vec4 c2 = uProj * v2;
              if (linDepth(textureLod(tDepth, c2.xy / c2.w * 0.5 + 0.5, 0.0).x) < -v2.z) hi = m; else lo = m;
            }
            vec4 vh = viewMatrix * vec4(P + R * hi, 1.0); vec4 ch = uProj * vh; vec2 huv = ch.xy / ch.w * 0.5 + 0.5;
            float diff = -vh.z - linDepth(textureLod(tDepth, huv, 0.0).x);
            if (diff > 0.35 + hi * 0.06) return vec4(0.0);
            vec2 e = smoothstep(vec2(0.0), vec2(0.06), huv) * (1.0 - smoothstep(vec2(0.94), vec2(1.0), huv));
            return vec4(textureLod(tScene, huv, 0.0).rgb, e.x * e.y);
          }
          void main(){
            vec3 toCam = cameraPosition - vWorld; float dist = length(toCam); vec3 V = toCam / dist;
            float damp = vDamp; ${DWV}
            vec2 p = vXZ;
            vec4 b0 = texture2D(tB0, p / uLen.x + ${HT}), b1 = texture2D(tB1, p / uLen.y + ${HT}), b2 = texture2D(tB2, p / uLen.z + ${HT}), b3 = texture2D(tB3, p / uLen.w + ${HT});
            // the two small cascades are sampled a second time, rotated and rescaled, so their short repeat never shows
            vec2 pr = vec2(-0.454 * p.x - 0.891 * p.y, 0.891 * p.x - 0.454 * p.y);
            vec4 c2 = texture2D(tB2, pr * 0.73 / uLen.z + 0.31), c3 = texture2D(tB3, pr * 0.61 / uLen.w + 0.17);
            c2.xy = vec2(-0.454 * c2.x + 0.891 * c2.y, -0.891 * c2.x - 0.454 * c2.y); c3.xy = vec2(-0.454 * c3.x + 0.891 * c3.y, -0.891 * c3.x - 0.454 * c3.y);
            b2 = vec4((b2.xy + c2.xy) * 0.7071, min(b2.z, c2.z), b2.w); b3.xy = (b3.xy + c3.xy) * 0.7071;
            vec2 slope = b0.xy * wd.x + b1.xy * wd.y + b2.xy * wd.z + b3.xy * wd.w;
            float hgt = b0.w * wd.x + b1.w * wd.y + b2.w * wd.z;
            // slope variance the pixel cannot resolve becomes roughness
            vec2 ddx = dFdx(p), ddy = dFdy(p); float fa = length(ddx), fb = length(ddy); float fw = max(min(fa, fb), max(fa, fb) * 0.125);
            vec4 lost = clamp(log2(fw * ${N}.0 / uLen) * 0.24 + 0.12, 0.0, 1.0);
            float a2 = uMicro + dot(uVar * wd * wd, lost);
            float nfade = 1.0 - smoothstep(20.0, 160.0, dist);
            // raindrops: each hits, throws out a ring that spreads and fades (two layers of randomly timed drops)
            if (uRainAmt > 0.01 && dist < 40.0) {
              vec2 rg = vec2(0.0);
              for (int L = 0; L < 2; L++) {
                vec2 q = p * (2.2 + float(L) * 1.3) + float(L) * 7.31; vec2 cell = floor(q);
                for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
                  vec2 c = cell + vec2(float(i), float(j)); float h1 = hash21(c), h2 = hash21(c + 17.3), h3 = hash21(c + 41.9);
                  if (h3 > uRainAmt) continue;
                  vec2 o = c + vec2(h1, h2); vec2 dv = q - o; float dd = length(dv), ph = fract(uTime * 0.9 + h1 * 7.0), rr = ph * 0.6;
                  float dq = (dd - rr) * 18.0; float ring = exp(-dq * dq) * (1.0 - ph) * (1.0 - ph);
                  rg += dv / max(dd, 1e-3) * ring * sin((dd - rr) * 60.0);
                }
              }
              slope += rg * 0.22 * (1.0 - smoothstep(15.0, 40.0, dist)); a2 += uRainAmt * 0.01;
            }
            vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));
            float sig = sqrt(a2);
            vec2 uv = gl_FragCoord.xy / uRes;
            float sceneZ = linDepth(textureLod(tDepth, uv, 0.0).x);
            float rayScale = dist / max(vViewZ, 0.001);
            vec3 sunL = uSunCol * uLight * uSunVis;
            vec3 skyUp = uZenith;
            vec2 fuv = p * 0.14 + slope * 0.12;
            vec3 ft = texture2D(tFoam, fuv).rgb; vec3 ft2 = texture2D(tFoam, p * 0.47 + vec2(0.37, 0.11) - slope * 0.08).rgb;
            vec3 col;
            if (gl_FrontFacing) {
              float thick = max(sceneZ - vViewZ, 0.0) * rayScale;
              vec2 ruv = uv + N.xz * 0.05 * clamp(thick * 0.35, 0.0, 1.0) / (1.0 + vViewZ * 0.04);
              float sz2 = linDepth(textureLod(tDepth, ruv, 0.0).x);
              if (sz2 < vViewZ) { ruv = uv; sz2 = sceneZ; }
              float thick2 = max(sz2 - vViewZ, 0.0) * rayScale;
              vec3 scene = textureLod(tScene, ruv, 0.0).rgb;
              // caustics on the refracted floor
              vec3 sp = cameraPosition - V * (sz2 * rayScale);
              float below = max(-sp.y, 0.0);
              if (below > 0.2 && below < 35.0 && dist < 90.0 && uSunVis > 0.02) {
                float cz = caustic(sp.xz * 0.11 + uSunDir.xz * below * 0.05, uTime * 0.55) * exp(-below * 0.11) * (1.0 - smoothstep(30.0, 90.0, dist));
                scene *= 1.0 + cz * 1.9 * clamp(uSunDir.y * 3.0, 0.0, 1.0) * uSunVis;
              }
              // water body: absorption of what is behind it, plus light scattered back out of the volume
              // light reaching what lies under the water has already crossed that depth of water on its way down
              vec3 trans = exp(-vec3(0.3, 0.036, 0.024) * (thick2 + below * 0.8)) * mix(0.12, 1.0, uSunVis);   // clear tropical water: the bottom shows to 25-30 m
              float nl = max(dot(N, uSunDir), 0.0);
              vec3 amb = mix(vec3(dot(skyUp, vec3(0.3333))), skyUp, 0.35) * 2.0;
              vec3 body = uWaterCol * (amb + sunL * (0.7 + 0.9 * nl) * max(uSunDir.y, 0.0));
              // sunlight passing through thin crests towards the eye
              float crest = clamp(hgt / max(uRms * 2.2, 0.04) * 0.5 + 0.28, 0.0, 1.0);
              float thru = pow(max(dot(-V, uSunDir) * 0.5 + 0.5, 0.0), 4.0);
              float face = clamp(dot(N.xz, V.xz) * 3.0 + 0.25, 0.0, 1.0);
              body += vec3(0.01, 0.30, 0.25) * sunL * crest * crest * (thru * 0.9 + 0.08) * face * (1.0 - lost.y);
              vec3 refr = scene * trans + body * (1.0 - exp(-thick2 * 0.055));
              // reflection: sky and clouds, then anything on screen the ray hits
              vec3 R = reflect(-V, N); R.y = abs(R.y); R = normalize(R + vec3(0.0, sig * 0.85, 0.0));
              vec3 refl = skyRefl(R, log2(max(sig * 70.0, 1.0)));
              float nv = max(dot(N, V), 0.0);
              float fres = 0.02 + 0.98 * pow(1.0 - nv, 5.0 * exp(-2.69 * sig)) / (1.0 + 22.7 * pow(sig, 1.5));
              if (uSSR > 0.5 && fres > 0.035 && dist < 1500.0) { vec4 h = ssr(vWorld + vec3(0.0, 0.05, 0.0), R, hash21(gl_FragCoord.xy)); refl = mix(refl, h.rgb, h.a); }
              col = mix(refr, refl, clamp(fres * uRefl, 0.0, 1.0));
              // sun and moon glitter: Beckmann lobe whose width is the unresolved slope variance
              float ar = max(a2, 0.0009);
              vec3 Hs = normalize(V + uSunDir); float nh = max(dot(N, Hs), 0.001); float nh2 = nh * nh;
              float Dq = exp((nh2 - 1.0) / (nh2 * ar)) / (3.14159 * ar * nh2 * nh2);
              float Fs = 0.02 + 0.98 * pow(1.0 - max(dot(V, Hs), 0.0), 5.0);
              col += sunL * min(Fs * Dq / (4.0 * max(nv, 0.12)), 60.0) * 3.2 * smoothstep(-0.02, 0.06, uSunDir.y);
              vec3 Hm = normalize(V + uMoonDir); float mh = max(dot(N, Hm), 0.001); float mh2 = mh * mh;
              float Dm = exp((mh2 - 1.0) / (mh2 * ar)) / (3.14159 * ar * mh2 * mh2);
              col += vec3(0.55, 0.66, 0.9) * min((0.02 + 0.98 * pow(1.0 - max(dot(V, Hm), 0.0), 5.0)) * Dm / (4.0 * max(nv, 0.12)), 40.0) * 0.05 * uNight * (1.0 - uCloud);
              // foam: whitecaps where the surface folds, plus shoreline and contact foam from water thickness
              float pat = clamp(ft.r * 0.62 + ft2.g * 0.45 + ft2.b * 0.12, 0.0, 1.0);
              float jt = 1.0 + b0.z * wd.x + b1.z * wd.y + b2.z * wd.z;
              float capA = clamp((uFoamBias - jt) * 3.2, 0.0, 1.0);
              float thickV = thick * max(V.y, 0.25);
              float band = sin(thickV * 4.5 - uTime * 1.6 + ft.b * 5.0) * 0.5 + 0.5;
              // full breaking bands only on real shores (inside an island's sheltered zone); a thin wet line around anything else that floats
              float shoreK = 1.0 - smoothstep(0.7, 0.97, damp);
              float shore = mix((1.0 - smoothstep(0.0, 0.05, thickV)) * 0.55, (1.0 - smoothstep(0.0, 0.22, thickV)) + band * band * (1.0 - smoothstep(0.1, 1.5, thickV)) * 0.55, shoreK);
              shore *= step(thick, 40.0);
              float fa2 = clamp(capA + shore, 0.0, 1.0);
              // thin foam survives only on the lacy web of the pattern; dense foam fills in
              float foam = clamp((fa2 * 1.55 - (1.0 - pat)) * 2.6, 0.0, 1.0);
              foam *= 0.72 + 0.28 * ft2.b;
              // far away individual whitecaps are sub-pixel: keep their average brightness
              foam = max(foam, uCover * smoothstep(60.0, 400.0, dist) * damp);
              // wake of the raft or boat: churned water along the track plus two spreading edge lines
              if (uWakeC.w > 0.0 && length(vWorld.xz - uWakeC.xy) < uWakeC.z) {
                float wk = 0.0;
                for (int i = 0; i < 23; i++) {
                  vec4 a = uWake[i], b = uWake[i + 1]; if (a.w <= 0.0 || b.w <= 0.0) continue;
                  vec2 pa = vWorld.xz - a.xy, ba = b.xy - a.xy; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
                  float d = length(pa - ba * h), w = mix(a.z, b.z, h), k = mix(a.w, b.w, h);
                  float cen = exp(-(d * d) / (w * w * 0.3)), edg = exp(-pow((d - w) / (0.3 + w * 0.1), 2.0));
                  wk = max(wk, k * (cen * 0.8 + edg * 0.65));
                }
                foam = max(foam, clamp((wk * 1.35 - (1.0 - pat)) * 2.2, 0.0, 1.0) * 0.88);
              }
              vec3 foamCol = vec3(0.93) * (sunL * (0.35 + 0.65 * nl) * 1.25 * max(uSunDir.y, 0.0) + (skyUp + uHorizon) * 0.62);
              col = mix(col, foamCol, foam * 0.95);
              float fog = 1.0 - exp(-uFogDens * uFogDens * dist * dist);
              col = mix(col, uFogCol, fog);
            } else {
              // seen from below: Snell's window to the sky, total internal reflection elsewhere
              // the whole sky squeezed into a 97-degree cone, fading through a Fresnel rim into total internal reflection
              vec3 Nu = normalize(vec3(-slope.x * 0.5, 1.0, -slope.y * 0.5)), Nd = -Nu;
              vec3 rd = refract(-V, Nd, 1.333);
              // exact dielectric Fresnel from the water side: rises smoothly to 1 at the critical angle (48.6 degrees)
              float ci = clamp(dot(Nd, V), 0.0, 1.0), k2 = 1.0 - 1.777 * (1.0 - ci * ci), F = 1.0;
              if (k2 > 0.0) { float ctt = sqrt(k2), rs = (1.333 * ci - ctt) / (1.333 * ci + ctt), rp = (1.333 * ctt - ci) / (1.333 * ctt + ci); F = 0.5 * (rs * rs + rp * rp); }
              F = mix(F, 1.0, smoothstep(0.0, 0.25, 1.0 - k2) * 0.0) ;
              float lodS = log2(max(sig * 90.0, 1.0)) + 1.0;
              vec3 skyT = skyRefl(normalize(rd + vec3(0.0, 1e-4, 0.0)), lodS);
              // anything floating above (raft, debris, hull) blocks the sky where the depth buffer says it is above this surface point
              vec2 suv = uv + Nu.xz * 0.035;
              float zz = linDepth(textureLod(tDepth, suv, 0.0).x);
              vec3 obj = textureLod(tScene, suv, 0.0).rgb;
              vec3 through = (zz < vViewZ + 60.0 && zz > vViewZ - 0.2) ? obj * 0.8 : skyT * mix(0.45, 1.0, smoothstep(0.05, 0.6, rd.y));
              float sdt = max(dot(normalize(rd + vec3(0.0, 1e-4, 0.0)), uSunDir), 0.0);
              through += uSunCol * uSunVis * (pow(sdt, 400.0) * 40.0 + pow(sdt, 30.0) * 0.6);
              // reflected: the dark water column below, lit a little from above
              vec3 deep = uWaterCol * (uZenith * 2.4 + sunL * 0.55 * max(uSunDir.y, 0.0));
              col = mix(through, deep, F);
            }
            gl_FragColor = vec4(col, 1.0);
          }`
      });
      // marine snow: drifting organic specks filling the water around the camera; only drawn below the surface
      { const NP = 3200, pos = new Float32Array(NP * 3), sz = new Float32Array(NP), gl = new Float32Array(NP), rr = G.rng(5150);
        for (let i = 0; i < NP; i++) { pos[i * 3] = rr() * 28; pos[i * 3 + 1] = rr() * 28; pos[i * 3 + 2] = rr() * 28; sz[i] = 0.4 + Math.pow(rr(), 6) * 2.4; gl[i] = rr() < 0.05 ? 0.3 + rr() * 0.7 : 0; }   // a few glowing plankton among the specks
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aS', new THREE.BufferAttribute(sz, 1)); g.setAttribute('aG', new THREE.BufferAttribute(gl, 1));
        this.snowMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: true, blending: THREE.AdditiveBlending,   // depth so the fog dims each speck by its own distance
          uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color() }, uScale: { value: 300 } },
          vertexShader: `attribute float aS; attribute float aG; uniform float uTime; uniform vec3 uCam; uniform float uScale; varying float vA; varying float vY; varying float vG;
            void main(){ vec3 p = position + vec3(sin(uTime * 0.05 + position.y) * 0.6, -uTime * 0.035, cos(uTime * 0.04 + position.x) * 0.6);
              p = mod(p - uCam, 28.0) - 14.0 + uCam; vec4 mv = viewMatrix * vec4(p, 1.0); float z = -mv.z;
              vA = smoothstep(0.25, 1.2, z) * (1.0 - smoothstep(9.0, 14.0, length(p - uCam))) * step(p.y, -0.15); vY = p.y;
              vG = aG > 0.0 ? aG * (0.55 + 0.45 * sin(uTime * (1.5 + aG * 2.0) + position.x * 3.0)) : 0.0;
              gl_PointSize = clamp((aS + aG * 1.6) * uScale * 0.009 / max(z, 0.1), 1.2, 14.0); gl_Position = projectionMatrix * mv; }`,
          fragmentShader: `uniform vec3 uCol; varying float vA; varying float vY; varying float vG;
            void main(){ vec2 q = gl_PointCoord - 0.5; float r = dot(q, q) * 4.0; if (r > 1.0) discard; float a = (1.0 - r) * (1.0 - r) * vA;
              gl_FragColor = vec4((uCol * exp(vY * 0.05) + vec3(0.7, 1.0, 0.4) * vG * 2.2) * a, 1.0); }` });
        this.snow = new THREE.Points(g, this.snowMat); this.snow.frustumCulled = false; this.snow.layers.set(1); this.snow.renderOrder = 5; this.snow.visible = false; scene.add(this.snow); }
      this.spectrum(G.weather.sea, G.weather.wind);
      for (const c of this.cas) c.evolve(0, 0.016);
      this.upload();
      this.build();
      G.on('settings', () => this.build());
    },
    upload() {
      const half = !this.floatOK ? THREE.DataUtils.toHalfFloat : null;
      for (const c of this.cas) for (const t of [c.tA, c.tB]) {
        if (half) { const s = t.src, d = t.image.data; for (let i = 0; i < s.length; i++) d[i] = half(G.clamp(s[i], -60000, 60000)); }
        t.needsUpdate = true;
      }
    },
    build() {
      const q = G.settings.water, NR = [130, 180, 230, 290][q] || 180, M = [144, 208, 272, 336][q] || 208;
      if (this.mesh && this.NR === NR) return;
      if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); }
      this.NR = NR;
      // polar grid: ring spacing grows with distance so triangles stay roughly the same size on screen
      const c = 5, k = Math.log(9000 / c + 1), nv = (NR + 1) * M;
      const pos = new Float32Array(nv * 3), sp = new Float32Array(nv), idx = new Uint32Array(NR * M * 6);
      let p = 0;
      for (let i = 0; i <= NR; i++) {
        const r = c * (Math.exp(k * i / NR) - 1), s = Math.max(k * (r + c) / NR, TAU * r / M);
        for (let j = 0; j < M; j++) { const a = j / M * TAU + (i & 1) * Math.PI / M; pos[p * 3] = Math.cos(a) * r; pos[p * 3 + 2] = Math.sin(a) * r; sp[p] = s; p++; }
      }
      p = 0;
      for (let i = 0; i < NR; i++) for (let j = 0; j < M; j++) {
        const j1 = (j + 1) % M, a = i * M + j, b = i * M + j1, e = (i + 1) * M + j, f = (i + 1) * M + j1;
        if (i & 1) { idx[p++] = a; idx[p++] = b; idx[p++] = f; idx[p++] = a; idx[p++] = f; idx[p++] = e; }
        else { idx[p++] = a; idx[p++] = b; idx[p++] = e; idx[p++] = b; idx[p++] = f; idx[p++] = e; }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSp', new THREE.BufferAttribute(sp, 1)); g.setIndex(new THREE.BufferAttribute(idx, 1));
      this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.layers.set(1); this.mesh.renderOrder = -10;
      this.scene.add(this.mesh);
    },
    // trail of recent hull positions for the wake (raft or the boat being driven)
    updateWake(dt) {
      const U = this.mat.uniforms, tr = this.trail || (this.trail = []), V = G.vehicles && G.vehicles.current, R = G.structs && G.structs.raft;
      let src = null; if (V) src = { x: V.x, z: V.z, sp: Math.abs(V.speed || 0), w: 0.9 }; else if (R) src = { x: R.pos.x, z: R.pos.z, sp: R.speed || 0, w: 0.8 + Math.min(4, R.radius || 2) * 0.35 };
      for (const p of tr) p.age += dt;
      while (tr.length && tr[tr.length - 1].age > 22) tr.pop();
      if (src && src.sp > 0.25) { const h = tr[0]; if (!h || Math.hypot(h.x - src.x, h.z - src.z) > 1.4 || h.age > 0.6) { tr.unshift({ x: src.x, z: src.z, age: 0, k: Math.min(1, src.sp / 2.2), w: src.w }); if (tr.length > 24) tr.length = 24; } else { h.x = src.x; h.z = src.z; } }
      let ext = 0;
      for (let i = 0; i < 24; i++) { const p = tr[i], u = U.uWake.value[i]; if (!p) { u.set(0, 0, 0, 0); continue; } const f = 1 - p.age / 22; u.set(p.x, p.z, p.w + p.age * 0.55, p.k * f * f * (i === 0 ? 0.6 : 1)); if (tr[0]) ext = Math.max(ext, Math.hypot(p.x - tr[0].x, p.z - tr[0].z) + p.w + p.age * 0.6 + 4); }
      U.uWakeC.value.set(tr[0] ? tr[0].x : 0, tr[0] ? tr[0].z : 0, ext, tr.length > 1 ? 1 : 0);
    },
    update(dt, camera) {
      const t0 = performance.now();
      this.time += dt; const W = G.weather, U = this.mat.uniforms, gn = this.gen;
      this.sea = W.sea; U.uTime.value = this.time; U.uSea.value = this.sea;
      gn.t -= dt;
      if (gn.sea < 0 || (gn.t <= 0 && (Math.abs(W.sea - gn.sea) > 0.012 || Math.abs(W.wind - gn.wind) > 0.03))) { this.spectrum(W.sea, W.wind); gn.t = 0.2; }
      const wc = G.clamp((W.wind - 0.3) * 1.25 + W.storm * 0.6, 0, 1.2);
      for (const c of this.cas) c.evolve(this.time, dt);
      const w1 = Math.min(wc, 1); U.uFoamBias.value = G.lerp(0.36, 0.70, Math.pow(w1, 0.8)); U.uCover.value = w1 * w1 * 0.05;
      this.upload(); this.updateWake(dt);
      this.mesh.position.set(camera.position.x, 0, camera.position.z);
      for (let i = 0; i < MAXI; i++) { const I = this.islands[i]; if (I) this.islUniform[i].set(I.x, I.z, I.r, 0); else this.islUniform[i].set(0, 0, 0, 0); }
      const S = G.sky;
      const l = 0.04 + S.dayLight * 0.96; U.uLight.value.setRGB(l, l, l); U.uSunVis.value = S.sunVis;
      const st = W.storm, ov = G.clamp(W.cloud * 1.2 - 0.4, 0, 1);
      U.uWaterCol.value.setRGB(G.lerp(0.0035, 0.012, ov), G.lerp(0.037, 0.036, ov) * (1 - st * 0.3), G.lerp(0.070, 0.046, ov) * (1 - st * 0.2));
      U.uFogCol.value.copy(S.fogColor); U.uFogDens.value = G.render.fogDensity;
      U.uWhitecap.value = wc; U.uMicro.value = 0.0012 + 0.0045 * Math.min(W.wind, 1.5);
      U.uRefl.value = 1; U.uSSR.value = G.settings.reflections ? 1 : 0; U.uRainAmt.value = W.rain; U.uProj.value.copy(camera.projectionMatrix);
      const sn = this.snowMat.uniforms, uw = camera.position.y < this.height(camera.position.x, camera.position.z) + 0.3; this.snow.visible = uw;
      if (uw) { sn.uTime.value = this.time; sn.uCam.value.copy(camera.position); sn.uScale.value = G.render.h || 700; const sl = S.dayLight; sn.uCol.value.setRGB(0.32 * sl + 0.01, 0.62 * sl + 0.02, 0.66 * sl + 0.025); }
      this.cpuMs = this.cpuMs * 0.95 + (performance.now() - t0) * 0.05;
    }
  };
})();
