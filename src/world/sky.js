'use strict';
/* Sky dome, sun/moon, clouds, stars, lights, rain. Shared GLSL sky function is reused by the ocean for reflections. */
(function () {
  const G = window.G;
  G.glsl = G.glsl || {};
  G.glsl.noise = `
    float hash21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
    float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x), mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x), f.y); }
    float fbm3(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<3;i++){ v+=a*vnoise(p); p=p*2.03+vec2(17.1,-9.7); a*=0.5; } return v/0.875; }
    float fbm5(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*vnoise(p); p=p*2.03+vec2(17.1,-9.7); a*=0.5; } return v/0.96875; }
  `;
  G.glsl.sky = `
    uniform vec3 uSunDir; uniform vec3 uMoonDir; uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunCol;
    uniform float uNight; uniform float uCloud; uniform float uFlash; uniform vec3 uGlow; uniform float uEnvPass;
    vec3 skyBase(vec3 d){
      float h = clamp(d.y, 0.0, 1.0);
      vec3 col = mix(uHorizon, uZenith, pow(h, 0.42));
      float sa = max(dot(normalize(d.xz + vec2(0.00001)), normalize(uSunDir.xz + vec2(0.00001))), 0.0);
      col += uGlow * (pow(1.0 - h, 7.0) * (0.22 + 0.78 * sa * sa * sa) + pow(1.0 - h, 2.5) * sa * sa * 0.22);
      float sd = max(dot(d, uSunDir), 0.0);
      col += uSunCol * (pow(sd, 5.0) * 0.10 + pow(sd, 40.0) * 0.30) * (1.0 - uCloud * 0.85);
      float md = max(dot(d, uMoonDir), 0.0);
      col += vec3(0.35, 0.45, 0.6) * pow(md, 30.0) * 0.25 * uNight * (1.0 - uCloud);
      col = mix(col, uHorizon * 0.55, smoothstep(0.0, -0.35, d.y));
      return col + vec3(0.5, 0.55, 0.7) * uFlash;
    }
    uniform vec3 uCloudCol; uniform vec3 uCloudDark; uniform vec2 uCloudOff;
    // photographed skies (Poly Haven HDRIs): two time-of-day skies cross-faded, plus an overcast sky by cloud cover.
    // Each is rotated so its sun sits on the game's sun azimuth; the sun itself is clipped out and drawn by the game.
    uniform sampler2D tSkyA; uniform sampler2D tSkyB; uniform sampler2D tSkyO; uniform sampler2D tSkyC; uniform float uHDR; uniform float uSkyMix; uniform float uOver; uniform float uCloudy;
    uniform vec4 uSkyRot; uniform vec4 uSkyScale; uniform vec4 uSkyCap; uniform float uSkyDark;
    vec3 hdrAt(sampler2D t, vec3 d, float rot, float cap){ vec2 uv = vec2(atan(d.z, d.x) * 0.1591549 + 0.5 - rot, asin(clamp(d.y, -1.0, 1.0)) * 0.3183099 + 0.5); vec3 c = textureLod(t, uv, 0.0).rgb; float l = max(c.r, max(c.g, c.b)); /* explicit level 0: no mip seam where the panorama wraps */ return c * min(1.0, cap / max(l, 1e-4)); }
    vec3 skyHDR(vec3 d){
      vec3 dd = vec3(d.x, max(d.y, 0.003), d.z);
      vec3 c = mix(hdrAt(tSkyA, dd, uSkyRot.x, uSkyCap.x) * uSkyScale.x, hdrAt(tSkyB, dd, uSkyRot.y, uSkyCap.y) * uSkyScale.y, uSkyMix);
      if (uCloudy > 0.001) c = mix(c, hdrAt(tSkyC, dd, uSkyRot.w, uSkyCap.w) * uSkyScale.w, uCloudy);
      if (uOver > 0.001) c = mix(c, hdrAt(tSkyO, dd, uSkyRot.z, uSkyCap.z) * uSkyScale.z, uOver);
      c *= uSkyDark;
      // below the horizon the photo has no data: continue the horizon haze down
      c = mix(c, uHorizon * 0.55, smoothstep(0.0, -0.35, d.y));
      return c + vec3(0.5, 0.55, 0.7) * uFlash;
    }
    vec3 skyClouds(vec3 col, vec3 d, float sd){
      if (d.y > 0.004) {
        vec2 uv = d.xz / (d.y + 0.10) * 0.55 + uCloudOff;
        float n = fbm5(uv);
        float th = mix(0.74, 0.24, uCloud);
        float dens = smoothstep(th, th + 0.22, n);
        float n2 = fbm3(uv + uSunDir.xz * 0.12);
        float shade = clamp((n - n2) * 3.0 + 0.55, 0.0, 1.0);
        vec3 cc = mix(uCloudDark, uCloudCol, shade * (1.0 - dens * 0.45));
        cc += uSunCol * pow(max(sd, 0.0), 12.0) * 0.6 * (1.0 - dens);
        float hz = smoothstep(0.004, 0.14, d.y);
        col = mix(col, cc + vec3(uFlash) * 1.5, dens * hz);
      }
      return col;
    }
  `;
  const skyUniforms = G.skyUniforms = {
    uSunDir: { value: new THREE.Vector3(0.5, 0.5, 0.2).normalize() }, uMoonDir: { value: new THREE.Vector3(-0.5, 0.5, -0.2).normalize() },
    uZenith: { value: new THREE.Color(0.1, 0.3, 0.7) }, uHorizon: { value: new THREE.Color(0.6, 0.75, 0.9) }, uSunCol: { value: new THREE.Color(1, 0.9, 0.7) },
    uNight: { value: 0 }, uCloud: { value: 0.3 }, uFlash: { value: 0 }, uGlow: { value: new THREE.Color(0, 0, 0) },
    uCloudCol: { value: new THREE.Color(1, 1, 1) }, uCloudDark: { value: new THREE.Color(0.5, 0.55, 0.6) }, uCloudOff: { value: new THREE.Vector2() },
    tSkyA: { value: null }, tSkyB: { value: null }, tSkyO: { value: null }, tSkyC: { value: null }, uHDR: { value: 0 }, uSkyMix: { value: 0 }, uOver: { value: 0 }, uCloudy: { value: 0 },
    uSkyRot: { value: new THREE.Vector4() }, uSkyScale: { value: new THREE.Vector4(1, 1, 1, 1) }, uEnvPass: { value: 0 }, uSkyCap: { value: new THREE.Vector4(10, 10, 10, 10) }, uSkyDark: { value: 1 }
  };

  // weather values consumed by rendering; the weather simulation (systems.js) drives the targets
  G.weather = { cloud: 0.25, rain: 0, fog: 0, wind: 0.5, windDir: 0.6, sea: 0.6, storm: 0, flash: 0, type: 'clear', temp: 27 };

  const fogFallback = new THREE.Color();
  G.sky = {
    sunDir: skyUniforms.uSunDir.value, moonDir: skyUniforms.uMoonDir.value, dayLight: 1, fogColor: new THREE.Color(), ambient: 1,
    init(scene) {
      const mat = new THREE.ShaderMaterial({
        uniforms: Object.assign({ uTime: G.uni.uTime }, skyUniforms),
        vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
        fragmentShader: `precision highp float; varying vec3 vDir; uniform float uTime;
          ${G.glsl.noise} ${G.glsl.sky}
          void main(){
            vec3 d = normalize(vDir);
            vec3 col = uHDR > 0.5 ? skyHDR(d) : skyBase(d);
            float sd = dot(d, uSunDir);
            float disc = smoothstep(0.99955, 0.99985, sd);
            col += uSunCol * disc * 28.0 * (1.0 - uCloud * 0.9) * smoothstep(-0.02, 0.03, d.y) * (1.0 - uEnvPass);
            float md = dot(d, uMoonDir);
            float mdisc = smoothstep(0.9993, 0.9996, md);
            col += vec3(0.9, 0.95, 1.0) * mdisc * 1.6 * uNight * smoothstep(0.0, 0.05, d.y);
            if (uHDR < 0.5 && uNight > 0.01 && d.y > 0.0) {
              vec2 sp = d.xz / (d.y + 0.35) * 190.0; vec2 ci = floor(sp); float hsh = hash21(ci);
              float star = step(0.985, hsh) * smoothstep(0.35, 0.0, length(fract(sp) - 0.5 - (vec2(hash21(ci + 3.1), hash21(ci + 7.7)) - 0.5) * 0.5));
              star *= 0.6 + 0.4 * sin(uTime * 2.0 + hsh * 90.0);
              col += vec3(1.0, 0.95, 0.9) * star * 2.2 * uNight * (1.0 - uCloud) * smoothstep(0.0, 0.2, d.y);
            }
            if (uHDR < 0.5) col = skyClouds(col, d, sd);
            gl_FragColor = vec4(col, 1.0);
          }`,
        side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false
      });
      // sky probe: the whole sky and its clouds in a small azimuth / sqrt(elevation) map; water reflects it, blurred by mip level
      this.probe = new THREE.WebGLRenderTarget(256, 64, { type: THREE.HalfFloatType, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: false, wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping });
      this.probeMat = new THREE.ShaderMaterial({
        uniforms: skyUniforms, depthTest: false, depthWrite: false,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: `precision highp float; varying vec2 vUv; ${G.glsl.noise} ${G.glsl.sky}
          void main(){ float az = vUv.x * 6.2831853, y = vUv.y * vUv.y, r = sqrt(max(1.0 - y * y, 0.0)); vec3 d = vec3(cos(az) * r, y, sin(az) * r);
            gl_FragColor = vec4(min(uHDR > 0.5 ? skyHDR(d) : skyClouds(skyBase(d), d, max(dot(d, uSunDir), 0.0)), vec3(8.0)), 1.0); }`
      });
      // image-based lighting: the live sky (without the sun disc, which the sun light already provides) is captured into a
      // prefiltered environment every few seconds, so every PBR surface gets real sky reflections and sky-coloured ambient
      this.envScene = new THREE.Scene(); const ed = new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), mat); ed.frustumCulled = false; this.envScene.add(ed);
      // a dark sea below the horizon so lower hemispheres pick up ocean-coloured bounce, not sky
      const sea = new THREE.Mesh(new THREE.CircleGeometry(49, 48), new THREE.MeshBasicMaterial({ color: 0x0a2a3a })); sea.rotation.x = -Math.PI / 2; sea.position.y = -0.5; this.envScene.add(sea); this.envSea = sea;
      this.pmrem = new THREE.PMREMGenerator(G.render.renderer); this.envT = 0; this.envRT = null;
      // underwater lighting environment: Snell's window bright overhead, blue-green water all around, dark below
      this.uwScene = new THREE.Scene(); this.uwMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uBot: { value: new THREE.Color() } },
        vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot; varying vec3 vD; void main(){ float y = vD.y; vec3 c = mix(uBot, uMid, smoothstep(-0.6, 0.35, y)); c = mix(c, uTop, smoothstep(0.6, 0.78, y)); gl_FragColor = vec4(c, 1.0); }' });
      this.uwScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), this.uwMat)); this.uwRT = null; this.uwT = 0;
      this.dome = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 16), mat);
      this.dome.frustumCulled = false; this.dome.renderOrder = -1000; scene.add(this.dome);
      this.mat = mat;
      this.sun = new THREE.DirectionalLight(0xffffff, 3); this.sun.castShadow = true; this.sun.layers.enableAll();
      this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.06;
      scene.add(this.sun); scene.add(this.sun.target);
      this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x6a5a48, 1); this.hemi.layers.enableAll(); scene.add(this.hemi);
      this.applyShadowQuality();
      this.initRain(scene);
      G.on('settings', () => this.applyShadowQuality());
    },
    applyShadowQuality() {
      const q = G.settings.shadows; const s = this.sun;
      s.castShadow = q > 0; const size = [512, 1024, 2048, 4096][q] || 1024;
      if (s.shadow.mapSize.x !== size) { s.shadow.mapSize.set(size, size); if (s.shadow.map) { s.shadow.map.dispose(); s.shadow.map = null; } }
      const ext = q >= 3 ? 70 : 55; const c = s.shadow.camera; c.left = -ext; c.right = ext; c.top = ext; c.bottom = -ext; c.near = 1; c.far = 400; c.updateProjectionMatrix();
    },
    // rain: thousands of instanced, camera-facing streaks. Each is a soft, thin, motion-blurred quad aligned with its
    // velocity (fall speed plus wind), brighter toward the sun side and fading with distance, like rain on film
    initRain(scene) {
      const N = 9000, r = G.rng(99), off = new Float32Array(N * 3), rnd = new Float32Array(N);
      for (let i = 0; i < N; i++) { off[i * 3] = r() * 36; off[i * 3 + 1] = r() * 24; off[i * 3 + 2] = r() * 36; rnd[i] = r(); }
      const g = new THREE.InstancedBufferGeometry(); const q = new THREE.PlaneGeometry(1, 1); g.index = q.index; g.setAttribute('position', q.attributes.position); g.setAttribute('uv', q.attributes.uv);
      g.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 3)); g.setAttribute('aRnd', new THREE.InstancedBufferAttribute(rnd, 1)); g.instanceCount = N;
      this.rainMat = new THREE.ShaderMaterial({
        uniforms: { uTime: G.uni.uTime, uCam: { value: new THREE.Vector3() }, uRain: { value: 0 }, uWindV: { value: new THREE.Vector2() }, uCol: { value: new THREE.Color(0.7, 0.75, 0.8) }, uSunDir: skyUniforms.uSunDir },
        vertexShader: `attribute vec3 aOff; attribute float aRnd; uniform float uTime; uniform vec3 uCam; uniform vec2 uWindV; uniform float uRain; uniform vec3 uSunDir; varying vec2 vUv; varying float vA; varying float vSun;
          void main(){
            vec3 vel = vec3(uWindV.x, -(8.5 + aRnd * 2.0), uWindV.y);
            vec3 p = aOff + vel * uTime; p = mod(p - uCam, vec3(36.0, 24.0, 36.0)) - vec3(18.0, 9.0, 18.0) + uCam;
            vec3 dir = normalize(vel), toCam = normalize(cameraPosition - p), side = normalize(cross(dir, toCam));
            float dist = length(cameraPosition - p), len = 0.75 + aRnd * 0.45, w0 = 0.0065 + aRnd * 0.004, wid = max(w0, dist * 0.0017);
            vec3 w = p + dir * position.y * len + side * position.x * wid;
            vA = step(aRnd, uRain) * smoothstep(0.4, 1.5, dist) * (1.0 - smoothstep(10.0, 18.0, dist)) * sqrt(w0 / wid);   // at least a pixel wide; fainter when widened
            vSun = pow(max(dot(-toCam, uSunDir), 0.0), 6.0); vUv = uv;
            gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
          }`,
        fragmentShader: `uniform vec3 uCol; varying vec2 vUv; varying float vA; varying float vSun;
          void main(){ if (vA < 0.01) discard; float x = 1.0 - abs(vUv.x * 2.0 - 1.0), y = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
            gl_FragColor = vec4(uCol * (1.0 + vSun * 2.5), x * x * y * 0.42 * vA); }`,
        transparent: true, depthWrite: false
      });
      this.rain = new THREE.Mesh(g, this.rainMat); this.rain.frustumCulled = false; this.rain.layers.set(1); this.rain.visible = false; this.rain.renderOrder = 8; scene.add(this.rain);
    },
    // analyse each downloaded sky once: where its sun is, how bright its sky is, its horizon and zenith colours
    prepHDR() {
      const H = G.assets && G.assets.hdri; if (!H || !H.noon) return false; const half = THREE.DataUtils.fromHalfFloat; this.hdr = {};
      for (const [name, h] of Object.entries(H)) {
        const t = h.tex, img = t.image, W = img.width, Hh = img.height, d = img.data, isHalf = d instanceof Uint16Array, gv = (i) => isHalf ? half(d[i]) : d[i];
        let best = -1, bu = 0, bv = 0, sum = 0, n = 0; const hor = [0, 0, 0], zen = [0, 0, 0]; let nh = 0, nz = 0;
        for (let y = 0; y < Hh; y += 4) for (let x = 0; x < W; x += 4) {
          const i = (y * W + x) * 4, r = gv(i), g = gv(i + 1), b = gv(i + 2), L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const v = t.flipY ? 1 - y / Hh : y / Hh; const el = (0.5 - v) * Math.PI;   // row 0 is the top of the image
          if (L > best) { best = L; bu = x / W; bv = el; }
          if (el > 0.03) { const w = Math.cos(el); sum += Math.min(L, 6) * w; n += w; }
          if (el > 0.0 && el < 0.12) { hor[0] += r; hor[1] += g; hor[2] += b; nh++; }
          if (el > 1.1) { zen[0] += r; zen[1] += g; zen[2] += b; nz++; }
        }
        const phi = (bu - 0.5) * Math.PI * 2;
        t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
        this.hdr[name] = { tex: t, az: phi, el: bv, mean: sum / Math.max(n, 1), hor: hor.map((c) => c / Math.max(nh, 1)), zen: zen.map((c) => c / Math.max(nz, 1)), peak: best };
      }
      // the image row convention decides the sign of elevation; the noon sky must have its sun high
      if (this.hdr.noon.el < 0) for (const h of Object.values(this.hdr)) h.el = -h.el;
      // around twilight the brightest spot is the glow, not the sun: use the known solar elevations of these photographs
      const KNOWN = { night: -30, dawn: -4, dusk: -4, sunrise: 2, sunset: 3 }; for (const k in KNOWN) if (this.hdr[k]) this.hdr[k].el = KNOWN[k] * Math.PI / 180;
      skyUniforms.tSkyC.value = (this.hdr.cloudy || this.hdr.noon).tex;
      skyUniforms.uHDR.value = 1; skyUniforms.tSkyO.value = (this.hdr.overcast || this.hdr.noon).tex;
      return true;
    },
    pickHDR(hour, e, sunAz, W) {
      const H = this.hdr, U = skyUniforms, rising = hour < 12;
      const seq = (rising ? ['night', 'dawn', 'sunrise', 'morning', 'mid_morning', 'noon'] : ['night', 'dusk', 'sunset', 'late_afternoon', 'noon']).filter((k) => H[k]);
      const elev = (k) => k === 'night' ? -0.5 : H[k].el;
      let a = seq[0], b = seq[0], t = 0;
      for (let i = 0; i < seq.length - 1; i++) { const e0 = elev(seq[i]), e1 = elev(seq[i + 1]); if (e >= e0 && e <= e1) { a = seq[i]; b = seq[i + 1]; t = (e - e0) / Math.max(e1 - e0, 1e-4); break; } if (e > e1) { a = b = seq[i + 1]; t = 0; } }
      const A = H[a], B = H[b], O = H.overcast || H.noon, C = H.cloudy || H.noon, rot = (h) => (sunAz - h.az) / (Math.PI * 2);
      U.tSkyA.value = A.tex; U.tSkyB.value = B.tex; U.uSkyMix.value = G.sstep(0, 1, t); U.uSkyCap.value.set(A.mean * 4.5, B.mean * 4.5, O.mean * 3, C.mean * 6); U.uSkyRot.value.set(rot(A), rot(B), rot(O), rot(C));
      // brightness follows the game's own sky model so exposure and lighting stay consistent through the day
      const zen = U.uZenith.value, hor = U.uHorizon.value, target = Math.max(0.0015, (zen.r + zen.g + zen.b) / 3 * 0.55 + (hor.r + hor.g + hor.b) / 3 * 0.45);
      const night = a === 'night' && b === 'night';
      U.uSkyScale.value.set(target / Math.max(A.mean, 1e-5) * (a === 'night' ? 1.4 : 1), target / Math.max(B.mean, 1e-5) * (b === 'night' ? 1.4 : 1), target / Math.max(O.mean, 1e-5) * 0.85, target / Math.max(C.mean, 1e-5));
      // fair-weather cumulus come from the partly-cloudy photograph, which is a midday sky
      U.uCloudy.value = G.sstep(0.22, 0.5, W.cloud) * G.sstep(0.22, 0.5, e) * 0.9;
      U.uOver.value = G.sstep(0.5, 0.95, W.cloud) * (night ? 0.5 : 1); U.uSkyDark.value = 1 - W.storm * 0.55;
      // fog and ambient take their colour from the photographed horizon and zenith
      const m = U.uSkyMix.value, s = U.uSkyScale.value, cy = U.uCloudy.value, mixc = (k) => [0, 1, 2].map((i) => (G.lerp(A[k][i] * s.x, B[k][i] * s.y, m) * (1 - cy) + C[k][i] * s.w * cy) * (1 - U.uOver.value) + O[k][i] * s.z * U.uOver.value);
      const hc = mixc('hor'), zc = mixc('zen'), dk = U.uSkyDark.value;
      this.hdrHor = (this.hdrHor || new THREE.Color()).setRGB(hc[0] * dk, hc[1] * dk, hc[2] * dk); this.hdrZen = (this.hdrZen || new THREE.Color()).setRGB(zc[0] * dk, zc[1] * dk, zc[2] * dk);
    },
    // hour: 0..24
    update(hour, dt, camera, focus) {
      const W = G.weather;
      const ang = (hour - 6) / 12 * Math.PI;
      const sd = this.sunDir; sd.set(Math.cos(ang) * 0.92, Math.sin(ang), 0.38).normalize();
      this.moonDir.set(-sd.x, Math.max(0.25, -sd.y * 0.9 + 0.1), -sd.z * 0.7 + 0.3).normalize();
      const e = sd.y; // elevation
      const day = G.sstep(-0.12, 0.25, e), night = 1 - G.sstep(-0.22, 0.02, e), gold = Math.max(0, 1 - Math.abs(e - 0.02) / 0.3);
      const over = G.clamp(W.cloud * 1.15 - 0.35, 0, 1), storm = W.storm;
      const U = skyUniforms;
      const zen = U.uZenith.value, hor = U.uHorizon.value, sc = U.uSunCol.value;
      zen.setRGB(G.lerp(0.004, 0.085, day), G.lerp(0.008, 0.27, day), G.lerp(0.022, 0.74, day));
      hor.setRGB(G.lerp(0.012, 0.56, day), G.lerp(0.018, 0.72, day), G.lerp(0.04, 0.88, day));
      // golden hour tint
      hor.r += gold * 0.16 * (1 - over); hor.g += gold * 0.05 * (1 - over); hor.b -= gold * 0.05 * (1 - over) * day;
      zen.r += gold * 0.02; zen.b += gold * 0.03;
      const gl = gold * (1 - over) * (1 - storm) * G.sstep(-0.2, 0.0, e); U.uGlow.value.setRGB(1.25 * gl, 0.50 * gl, 0.12 * gl);
      // overcast / storm desaturate and darken
      const grey = (zen.r + zen.g + zen.b) / 3 * 0.9 + 0.02 * day;
      zen.lerp(new THREE.Color(grey * 0.75, grey * 0.8, grey * 0.9), over * 0.9); const hg = (hor.r + hor.g + hor.b) / 3;
      hor.lerp(new THREE.Color(hg * 0.8, hg * 0.84, hg * 0.9), over * 0.85);
      zen.multiplyScalar(1 - storm * 0.55); hor.multiplyScalar(1 - storm * 0.5);
      hor.lerp(new THREE.Color(hg, hg, hg * 1.02), W.fog * 0.6);
      sc.setRGB(1.0, G.lerp(0.42, 0.93, G.sstep(0, 0.4, e)), G.lerp(0.16, 0.82, G.sstep(0, 0.45, e)));
      U.uNight.value = night; U.uCloud.value = W.cloud; U.uFlash.value = W.flash;
      const m = this.mat.uniforms;
      const lit = day * (1 - storm * 0.6);
      m.uCloudCol.value.setRGB(lit * (1 + gold * 0.5) + 0.03, lit * (0.97 + gold * 0.05) + 0.035, lit * (0.95 - gold * 0.3) + 0.05).multiplyScalar(1 - over * 0.45);
      m.uCloudDark.value.setRGB(lit * 0.42 + 0.012, lit * 0.46 + 0.014, lit * 0.54 + 0.022).multiplyScalar(1 - over * 0.3);
      m.uCloudOff.value.x += Math.cos(W.windDir) * dt * 0.004 * (0.4 + W.wind); m.uCloudOff.value.y += Math.sin(W.windDir) * dt * 0.004 * (0.4 + W.wind);
      // lights
      const sunVis = G.sstep(-0.04, 0.12, e) * (1 - over * 0.82) * (1 - storm * 0.5);
      const useMoon = sunVis < 0.02;
      const ld = useMoon ? this.moonDir : sd;
      this.sun.color.setRGB(useMoon ? 0.5 : sc.r, useMoon ? 0.62 : sc.g, useMoon ? 0.85 : sc.b);
      this.sun.intensity = useMoon ? 0.22 * night * (1 - W.cloud * 0.8) : 4.2 * sunVis;
      G.uni.uSunC.value.copy(this.sun.color).multiplyScalar(useMoon ? 0 : this.sun.intensity * 0.25);
      this.sun.position.copy(focus).addScaledVector(ld, 160); this.sun.target.position.copy(focus);
      this.hemi.color.copy(zen).lerp(hor, 0.5); this.hemi.groundColor.setRGB(hor.r * 0.45, hor.g * 0.4, hor.b * 0.34);
      this.hemi.intensity = (this.envRT && G.settings.ibl !== false ? 0.55 + night * 1.5 : 2.3 + night * 3.0) + W.flash * 6;
      // refresh the lighting environment: every 4 s, or immediately when the light changes a lot
      this.envT -= dt; const key = Math.round(e * 40) + Math.round(W.cloud * 10) * 100 + Math.round(W.storm * 5) * 10000;
      if (G.settings.ibl !== false && (this.envT <= 0 || key !== this.envKey) && G.render.renderer) {
        this.envT = 4; this.envKey = key; skyUniforms.uEnvPass.value = 1; this.envSea.material.color.copy(this.fogColor).multiplyScalar(0.12).lerp(new THREE.Color(0.01, 0.05, 0.07), 0.6);
        const prev = G.render.renderer.getRenderTarget(), rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 200); G.render.renderer.setRenderTarget(prev);
        skyUniforms.uEnvPass.value = 0; if (this.envRT) this.envRT.dispose(); this.envRT = rt; G.scene.environment = rt.texture;
      } else if (G.settings.ibl === false && G.scene.environment) { G.scene.environment = null; }
      if (G.settings.ibl !== false && this.uwMat) {
        const under = !!(G.render && G.render.underwater); this.uwT -= dt;
        if (under && (this.uwT <= 0 || !this.uwRT)) {
          this.uwT = 3; const dl = Math.max(0.03, sunVis * 0.9 + 0.06), dk = Math.exp(-(G.render.camDepth || 0) * 0.05), u = this.uwMat.uniforms;
          u.uTop.value.setRGB(0.55 * dl, 0.75 * dl, 0.8 * dl); u.uMid.value.setRGB(0.02 * dl * dk, 0.16 * dl * dk, 0.2 * dl * dk); u.uBot.value.setRGB(0.003 * dl * dk, 0.025 * dl * dk, 0.04 * dl * dk);
          const prev = G.render.renderer.getRenderTarget(), rt = this.pmrem.fromScene(this.uwScene, 0, 0.1, 200); G.render.renderer.setRenderTarget(prev); if (this.uwRT) this.uwRT.dispose(); this.uwRT = rt;
        }
        const want = under && this.uwRT ? this.uwRT.texture : this.envRT ? this.envRT.texture : null; if (want && G.scene.environment !== want) G.scene.environment = want;
      }
      this.dayLight = Math.max(sunVis, 0.03 + night * 0.02); this.ambient = day; this.sunVis = sunVis; this.night = night;
      this.fogColor.copy(hor).lerp(zen, 0.12); this.fogColor.r += U.uGlow.value.r * 0.16; this.fogColor.g += U.uGlow.value.g * 0.16;
      if (this.hdr === undefined) this.prepHDR() || (this.hdr = null);
      if (this.hdr) {
        this.pickHDR(hour, e, Math.atan2(sd.z, sd.x), W);
        this.fogColor.copy(this.hdrHor).lerp(fogFallback.copy(hor), W.fog * 0.6);
        this.hemi.color.copy(this.hdrZen).lerp(this.hdrHor, 0.45).multiplyScalar(1 / Math.max(0.05, (zen.r + zen.g + zen.b) / 3 * 0.55 + (hor.r + hor.g + hor.b) / 3 * 0.45) * ((zen.r + zen.g + zen.b) / 3 * 0.55 + (hor.r + hor.g + hor.b) / 3 * 0.45));
      }
      this.dome.position.copy(camera.position);
      // rain
      this.rain.visible = W.rain > 0.02 && !G.render.underwater;
      const ru = this.rainMat.uniforms; ru.uRain.value = W.rain; ru.uCam.value.copy(camera.position);
      ru.uWindV.value.set(Math.cos(W.windDir) * W.wind * 9, Math.sin(W.windDir) * W.wind * 9);
      ru.uCol.value.setRGB(0.55 * day + 0.12, 0.6 * day + 0.13, 0.66 * day + 0.16);
    }
  };
})();
