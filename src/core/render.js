'use strict';
/* Renderer + frame pipeline:
   1) opaque world (layer 0) -> HDR target A (colour + depth texture)
   2) copy A -> target B (colour + depth)      3) water & transparents (layer 1) -> B, water samples A for refraction/depth
   4) optional bloom chain                      5) composite: underwater fog/caustics, bloom, ACES tone map, grade, vignette */
(function () {
  const G = window.G;
  const R = G.render = {
    underwater: false, fogDensity: 0.0005, dyn: 1, fade: 0, damage: 0, exposure: 1.0, camDepth: 0, frameMs: 16, fps: 60,
    init(canvas) {
      this.canvas = canvas;
      const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
      r.setPixelRatio(1); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.shadowMap.autoUpdate = false;
      r.toneMapping = THREE.NoToneMapping; r.outputColorSpace = THREE.LinearSRGBColorSpace; r.autoClear = false;
      r.info.autoReset = false;
      this.scene = G.scene = new THREE.Scene();
      this.scene.fog = new THREE.FogExp2(0x9fb8cc, 0.0005);
      this.camera = G.camera = new THREE.PerspectiveCamera(G.settings.fov, 1, 0.25, 12000);
      this.camera.rotation.order = 'YXZ';
      this.scene.add(this.camera);
      this.qscene = new THREE.Scene(); this.qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); this.quad.frustumCulled = false; this.qscene.add(this.quad);
      const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
      this.copyMat = new THREE.ShaderMaterial({
        uniforms: { tColor: { value: null }, tDepth: { value: null } }, vertexShader: vs,
        fragmentShader: 'uniform sampler2D tColor; uniform sampler2D tDepth; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tColor, vUv); gl_FragDepth = texture2D(tDepth, vUv).x; }',
        depthTest: true, depthFunc: THREE.AlwaysDepth, depthWrite: true
      });
      this.downMat = new THREE.ShaderMaterial({
        uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThresh: { value: 0 } }, vertexShader: vs, depthTest: false, depthWrite: false,
        fragmentShader: `uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThresh; varying vec2 vUv;
          void main(){ vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb
              + texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb; c *= 0.25;
            if (uThresh > 0.0) { float l = max(c.r, max(c.g, c.b)); c *= max(l - uThresh, 0.0) / max(l, 0.0001); c = min(c, vec3(24.0)); }
            gl_FragColor = vec4(c, 1.0); }`
      });
      // underwater in-scattering, ray-marched at half resolution: sunlight refracted at the surface, absorbed per colour with depth,
      // shadowed by the real sun shadow map (raft, islands), modulated by surface focusing into shafts, forward-scattered toward the eye
      this.uwMat = new THREE.ShaderMaterial({
        uniforms: { tDepth: { value: null }, tNoise: { value: null }, tShadow: { value: null }, uShadowM: { value: new THREE.Matrix4() }, uShadowOn: { value: 0 },
          uInvVP: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() }, uSunDir: G.skyUniforms.uSunDir, uSunC: { value: new THREE.Color() }, uAmbC: { value: new THREE.Color() },
          uSigT: { value: new THREE.Vector3(0.4, 0.09, 0.05) }, uSigS: { value: 0.035 }, uTime: G.uni.uTime, uRes: { value: new THREE.Vector2() } },
        vertexShader: vs, depthTest: false, depthWrite: false,
        fragmentShader: `precision highp float;
          uniform sampler2D tDepth; uniform sampler2D tNoise; uniform sampler2D tShadow; uniform mat4 uShadowM; uniform float uShadowOn;
          uniform mat4 uInvVP; uniform vec3 uCamPos; uniform vec3 uSunDir; uniform vec3 uSunC; uniform vec3 uAmbC; uniform vec3 uSigT; uniform float uSigS; uniform float uTime; uniform vec2 uRes;
          varying vec2 vUv;
          ${THREE.ShaderChunk.packing}
          float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
          void main(){
            float d = texture2D(tDepth, vUv).x;
            vec4 wp = uInvVP * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); wp /= wp.w;
            vec3 ray = wp.xyz - uCamPos; float dist = length(ray); vec3 rd = ray / max(dist, 1e-4);
            dist = d >= 0.99999 ? 110.0 : min(dist, 110.0);
            vec3 Ls = refract(-uSunDir, vec3(0.0, 1.0, 0.0), 0.7502); if (Ls.y > -0.05) Ls = normalize(vec3(Ls.x, -0.05, Ls.z));
            float c = dot(Ls, -rd), g = 0.85, hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * c, 1.5) * 0.0795775;
            float ph = mix(0.0795775, hg, 0.8);
            const int NS = 30;
            float jit = ign(gl_FragCoord.xy);
            float st = dist / float(NS); vec3 acc = vec3(0.0);
            for (int i = 0; i < NS; i++) {
              float t = (float(i) + jit) * st; vec3 p = uCamPos + rd * t; float dep = max(-p.y, 0.0);
              vec3 Tv = exp(-uSigT * t);
              float sl = dep / -Ls.y; vec3 Ts = exp(-uSigT * sl);
              float vis = 1.0;
              if (uShadowOn > 0.5) {
                vec4 sc = uShadowM * vec4(p, 1.0); sc.xyz /= sc.w;
                if (sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0 && sc.z < 1.0) vis = step(sc.z - 0.0015, unpackRGBAToDepth(texture2D(tShadow, sc.xy)));
              }
              // where this ray of light entered the water: focusing by the waves there makes the shaft pattern
              vec2 e = p.xz - Ls.xz * sl;
              // two scales of wave focusing: broad sheets and narrow bright beams a metre or two across, drifting with the swell
              float n1 = texture2D(tNoise, e * 0.06 + uTime * vec2(0.010, 0.006)).r, n2 = texture2D(tNoise, e * 0.19 - uTime * vec2(0.014, 0.018)).g;
              float pat = smoothstep(0.42, 0.88, n1 * 0.55 + n2 * 0.6);
              float sh = mix(1.0, 0.06 + 5.5 * pat * pat, 0.92 * exp(-dep * 0.012) + 0.08);
              vec3 Ls_ = uSunC * Ts * (vis * sh * ph) * 0.9;
              vec3 La = uAmbC * exp(-uSigT * dep * 1.15) * 0.1;
              acc += (Ls_ + La) * Tv * (uSigS * st);
            }
            gl_FragColor = vec4(acc, 1.0);
          }`
      });
      // screen-space ambient occlusion from the opaque depth buffer (half resolution)
      this.aoMat = new THREE.ShaderMaterial({
        uniforms: { tDepth: { value: null }, uProj: { value: new THREE.Matrix4() }, uInvProj: { value: new THREE.Matrix4() }, uRes: { value: new THREE.Vector2() }, uRadius: { value: 0.55 } },
        vertexShader: vs, depthTest: false, depthWrite: false,
        fragmentShader: `precision highp float; uniform sampler2D tDepth; uniform mat4 uProj; uniform mat4 uInvProj; uniform vec2 uRes; uniform float uRadius; varying vec2 vUv;
          vec3 vpos(vec2 uv){ float d = textureLod(tDepth, uv, 0.0).x; vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
          float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
          void main(){
            float d = textureLod(tDepth, vUv, 0.0).x; if (d >= 0.99999) { gl_FragColor = vec4(1.0); return; }
            vec3 P = vpos(vUv); vec2 t = 1.0 / uRes;
            vec3 r = vpos(vUv + vec2(t.x, 0.0)) - P, l = P - vpos(vUv - vec2(t.x, 0.0)), u = vpos(vUv + vec2(0.0, t.y)) - P, b = P - vpos(vUv - vec2(0.0, t.y));
            vec3 dx = abs(r.z) < abs(l.z) ? r : l, dy = abs(u.z) < abs(b.z) ? u : b; vec3 N = normalize(cross(dx, dy)); if (dot(N, P) > 0.0) N = -N;
            float rot = ign(gl_FragCoord.xy) * 6.2831853; vec3 T = normalize(abs(N.y) < 0.99 ? cross(N, vec3(0.0, 1.0, 0.0)) : cross(N, vec3(1.0, 0.0, 0.0))); vec3 B = cross(N, T);
            float rad = uRadius * (1.0 + -P.z * 0.012), occ = 0.0;
            for (int i = 0; i < 12; i++) {
              float fi = float(i), a = fi * 2.3999632 + rot, h = (fi + 0.5) / 12.0, rr = sqrt(h), sc = mix(0.15, 1.0, h * h);
              vec3 k = vec3(cos(a) * rr, sin(a) * rr, sqrt(max(0.0, 1.0 - h))) * sc; vec3 S = P + (T * k.x + B * k.y + N * k.z) * rad;
              vec4 c = uProj * vec4(S, 1.0); vec2 su = c.xy / c.w * 0.5 + 0.5; float sz = vpos(su).z;
              occ += step(S.z + 0.02, sz) * smoothstep(0.0, 1.0, rad / max(abs(P.z - sz), 1e-3));
            }
            float ao = 1.0 - occ / 12.0; ao = mix(1.0, ao * ao, 1.0 - smoothstep(60.0, 110.0, -P.z));
            gl_FragColor = vec4(vec3(ao), 1.0);
          }`
      });
      // crepuscular rays: march from each pixel toward the sun on screen, collecting open sky (anything not occluded by
      // terrain, trees, the raft or the sea), so light visibly streams through gaps in fronds and clouds
      this.rayMat = new THREE.ShaderMaterial({
        uniforms: { tDepth: { value: null }, tColor: { value: null }, uSun: { value: new THREE.Vector2() }, uAspect: { value: 1 } },
        vertexShader: vs, depthTest: false, depthWrite: false,
        fragmentShader: `precision highp float; uniform sampler2D tDepth; uniform sampler2D tColor; uniform vec2 uSun; uniform float uAspect; varying vec2 vUv;
          float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
          void main(){
            vec2 d = (uSun - vUv); float jit = ign(gl_FragCoord.xy); vec3 acc = vec3(0.0); float w = 1.0, tw = 0.0;
            for (int i = 0; i < 48; i++) {
              vec2 p = vUv + d * ((float(i) + jit * 0.5) / 48.0);
              if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) { w *= 0.96; continue; }
              float open = step(0.99999, textureLod(tDepth, p, 0.0).x);
              vec3 c = textureLod(tColor, p, 0.0).rgb; float l = max(c.r, max(c.g, c.b));
              acc += c * open * smoothstep(1.4, 5.0, l) * w; tw += w; w *= 0.965;
            }
            vec2 q = d * vec2(uAspect, 1.0); float fall = exp(-dot(q, q) * 5.0);
            gl_FragColor = vec4(acc / max(tw, 1.0) * fall, 1.0);
          }`
      });
      this.finalMat = new THREE.ShaderMaterial({
        uniforms: {
          tColor: { value: null }, tDepth: { value: null }, tB1: { value: null }, tB2: { value: null }, tB3: { value: null },
          uTime: G.uni.uTime, uUnder: { value: 0 }, uBloom: { value: 0 }, uExposure: { value: 1 }, uVig: { value: 0.35 }, uDamage: { value: 0 }, uFade: { value: 0 },
          uSat: { value: 1.06 }, uUnderK: { value: 1 }, uUnderCol: { value: new THREE.Color(0.02, 0.2, 0.3) }, uCamPos: { value: new THREE.Vector3() },
          uSunDir: G.skyUniforms.uSunDir, uInvVP: { value: new THREE.Matrix4() }, uSunK: { value: 1 }, tUW: { value: null }, uSigT: { value: new THREE.Vector3(0.4, 0.09, 0.05) }, tAO: { value: null }, tDepthA: { value: null }, uAO: { value: 0 }, tRays: { value: null }, uRays: { value: new THREE.Vector3() }, uTexel: { value: new THREE.Vector2() }, uAA: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) }, uCloud: { value: new THREE.Vector4() }
        }, vertexShader: vs, depthTest: false, depthWrite: false,
        fragmentShader: `precision highp float;
          uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tB1; uniform sampler2D tB2; uniform sampler2D tB3; uniform sampler2D tUW; uniform vec3 uSigT; uniform sampler2D tAO; uniform sampler2D tDepthA; uniform float uAO; uniform sampler2D tRays; uniform vec3 uRays;
          uniform float uTime; uniform float uUnder; uniform float uBloom; uniform float uExposure; uniform float uVig; uniform float uDamage; uniform float uFade; uniform float uSat; uniform float uUnderK; uniform float uSunK; uniform float uAA;
          uniform vec3 uUnderCol; uniform vec3 uCamPos; uniform vec3 uSunDir; uniform mat4 uInvVP; uniform vec2 uTexel; uniform vec3 uTint; uniform vec4 uCloud;
          varying vec2 vUv;
          float chash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
          float cnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(chash(i), chash(i + vec2(1.0, 0.0)), f.x), mix(chash(i + vec2(0.0, 1.0)), chash(i + vec2(1.0, 1.0)), f.x), f.y); }
          float cfbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * cnoise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; } return s; }
          ${G.glsl.caustic}
          vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
          float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
          void main(){
            vec2 uv = vUv;
            if (uUnder > 0.5) uv += vec2(sin(uv.y * 11.0 + uTime * 0.9), cos(uv.x * 9.0 + uTime * 0.8)) * 0.0011;
            vec3 col = texture2D(tColor, uv).rgb;
            if (uAO > 0.0) {   // occlusion only on solid surfaces: where the opaque depth is what the eye actually sees
              float da = texture2D(tDepthA, vUv).x, db = texture2D(tDepth, vUv).x;
              if (abs(da - db) < 1e-6 && da < 0.99999) { vec2 h = uTexel * 1.5; float ao = (texture2D(tAO, vUv).r * 2.0 + texture2D(tAO, vUv + vec2(h.x, h.y)).r + texture2D(tAO, vUv - vec2(h.x, h.y)).r + texture2D(tAO, vUv + vec2(h.x, -h.y)).r + texture2D(tAO, vUv - vec2(h.x, -h.y)).r) / 6.0; col *= mix(1.0, ao, uAO); }
            }
            if (uAA > 0.5) { // light edge-aware smoothing
              vec3 n = texture2D(tColor, uv + vec2(0.0, uTexel.y)).rgb, s = texture2D(tColor, uv - vec2(0.0, uTexel.y)).rgb;
              vec3 e = texture2D(tColor, uv + vec2(uTexel.x, 0.0)).rgb, w = texture2D(tColor, uv - vec2(uTexel.x, 0.0)).rgb;
              float lc = luma(col), ln = luma(n), ls = luma(s), le = luma(e), lw = luma(w);
              float rng = max(max(ln, ls), max(le, max(lw, lc))) - min(min(ln, ls), min(le, min(lw, lc)));
              float k = smoothstep(0.04, 0.25, rng / (lc + 0.15)) * 0.55;
              col = mix(col, (n + s + e + w) * 0.25, k);
            }
            if (uCloud.w > 0.0 && uUnder < 0.5) {   // drifting cloud shadows: follow the sun ray from the surface up to the cloud deck
              float d = texture2D(tDepth, vUv).x;
              if (d < 0.99999) {
                vec4 wp = uInvVP * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); wp /= wp.w;
                vec2 q = wp.xz + uSunDir.xz / max(uSunDir.y, 0.12) * (900.0 - wp.y);
                float n = cfbm((q + uCloud.xy) * 0.0016);
                float sh = smoothstep(1.0 - uCloud.z - 0.08, 1.0 - uCloud.z + 0.16, n);
                col *= 1.0 - sh * uCloud.w;
              }
            }
            if (uUnder > 0.5) {
              float d = texture2D(tDepth, uv).x;
              vec4 wp = uInvVP * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); wp /= wp.w;
              vec3 ray = wp.xyz - uCamPos; float dist = length(ray); vec3 rd = ray / max(dist, 0.001);
              bool sky = d >= 0.99999; if (sky) dist = 220.0; dist = min(dist, 220.0);
              float below = max(-wp.y, 0.0);
              if (!sky && wp.y < -0.25 && dist < 90.0) {
                float cz = caustic(wp.xz * 0.11 + uSunDir.xz * below * 0.05, uTime * 0.55) * exp(-below * 0.08);
                col *= 1.0 + cz * 2.6 * uSunK * (1.0 - smoothstep(45.0, 90.0, dist));
              }
              // daylight reaching a surface at that depth has already lost its reds; then the view path absorbs again
              if (!sky) col *= exp(-uSigT * below * 0.85);
              vec3 T = exp(-uSigT * dist);
              vec2 ht = uTexel * 2.2; vec3 ins = texture2D(tUW, vUv).rgb * 0.2; for (int k = 0; k < 8; k++) { float a = float(k) * 0.785398 + 0.39; ins += texture2D(tUW, vUv + vec2(cos(a), sin(a)) * ht * (k < 4 ? 1.0 : 2.0)).rgb * 0.1; }
              col = col * T + ins;
            }
            if (uRays.x > 0.0) { vec2 h = uTexel * 2.0; vec3 rr = (texture2D(tRays, vUv).rgb * 2.0 + texture2D(tRays, vUv + vec2(h.x, h.y)).rgb + texture2D(tRays, vUv - vec2(h.x, h.y)).rgb + texture2D(tRays, vUv + vec2(h.x, -h.y)).rgb + texture2D(tRays, vUv - vec2(h.x, -h.y)).rgb) / 6.0; col += rr * uRays.x; }
            if (uBloom > 0.0) col += (texture2D(tB1, vUv).rgb * 0.5 + texture2D(tB2, vUv).rgb * 0.8 + texture2D(tB3, vUv).rgb * 1.0) * uBloom;
            col *= uExposure * uTint;
            col = aces(col);
            float l = luma(col); col = mix(vec3(l), col, uSat);
            col = pow(col, vec3(1.0 / 2.2));
            vec2 q = vUv - 0.5; float vig = 1.0 - dot(q, q) * uVig * 1.6;
            col *= clamp(vig, 0.0, 1.0);
            col = mix(col, vec3(0.55, 0.02, 0.0), uDamage * smoothstep(0.12, 0.75, dot(q, q) * 2.2));
            col *= 1.0 - uFade;
            gl_FragColor = vec4(col, 1.0);
          }`
      });
      this.resize(); window.addEventListener('resize', () => this.resize());
      G.on('settings', () => { this.camera.fov = G.settings.fov; this.resize(); });
    },
    makeRT(w, h, depth) {
      const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: !!depth, stencilBuffer: false });
      if (depth) { rt.depthTexture = new THREE.DepthTexture(w, h); rt.depthTexture.type = THREE.UnsignedIntType; rt.depthTexture.minFilter = rt.depthTexture.magFilter = THREE.NearestFilter; }
      return rt;
    },
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const cw = window.innerWidth, ch = window.innerHeight;
      const s = G.settings.resScale * this.dyn * dpr;
      const w = Math.max(320, Math.floor(cw * s)), h = Math.max(200, Math.floor(ch * s));
      if (w === this.w && h === this.h) return;
      this.w = w; this.h = h;
      this.renderer.setSize(w, h, false); this.canvas.style.width = cw + 'px'; this.canvas.style.height = ch + 'px';
      this.camera.aspect = cw / ch; this.camera.updateProjectionMatrix();
      for (const k of ['rtA', 'rtB', 'b1', 'b2', 'b3', 'uw', 'aoRT', 'rayRT']) if (this[k]) { if (this[k].depthTexture) this[k].depthTexture.dispose(); this[k].dispose(); }
      this.rtA = this.makeRT(w, h, true); this.rtB = this.makeRT(w, h, true);
      this.b1 = this.makeRT(w >> 1, h >> 1, false); this.uw = this.makeRT(w >> 1, h >> 1, false); this.aoRT = this.makeRT(w >> 1, h >> 1, false); this.rayRT = this.makeRT(w >> 1, h >> 1, false); this.b2 = this.makeRT(w >> 2, h >> 2, false); this.b3 = this.makeRT(w >> 3, h >> 3, false);
    },
    pass(mat, target) { this.quad.material = mat; this.renderer.setRenderTarget(target); this.renderer.render(this.qscene, this.qcam); },
    frame(dt) {
      const r = this.renderer, cam = this.camera, sc = this.scene, S = G.settings;
      r.info.reset();
      const O = G.ocean, W = G.weather;
      const surf = O.height(cam.position.x, cam.position.z);
      this.underwater = cam.position.y < surf - 0.02; this.camDepth = Math.max(0, surf - cam.position.y);
      // below the surface the sky is only seen through the water (the surface shader samples its own sky probe); the dome
      // itself would otherwise show through wherever the distant sea floor leaves a gap
      if (G.sky.dome) G.sky.dome.visible = !this.underwater;
      // fog
      const base = 1.6 / S.drawDist;
      this.fogDensity = Math.max(base, 0.00035) + W.fog * 0.0055 + W.rain * 0.0009 + W.storm * 0.0012;
      sc.fog.color.copy(G.sky.fogColor); sc.fog.density = this.underwater ? 0.00002 : this.fogDensity;
      // pass 1: opaque
      cam.layers.set(0); r.shadowMap.needsUpdate = true;
      r.setRenderTarget(this.rtA); r.clear(true, true, false); r.render(sc, cam);
      // ambient occlusion from the opaque depth
      const fuA = this.finalMat.uniforms;
      if (S.ao !== false && S.post) { const au = this.aoMat.uniforms; au.tDepth.value = this.rtA.depthTexture; au.uProj.value.copy(cam.projectionMatrix); au.uInvProj.value.copy(cam.projectionMatrixInverse); au.uRes.value.set(this.w >> 1, this.h >> 1); this.pass(this.aoMat, this.aoRT); fuA.tAO.value = this.aoRT.texture; fuA.tDepthA.value = this.rtA.depthTexture; fuA.uAO.value = 0.85; } else fuA.uAO.value = 0;
      // pass 2: copy
      const cu = this.copyMat.uniforms; cu.tColor.value = this.rtA.texture; cu.tDepth.value = this.rtA.depthTexture;
      r.setRenderTarget(this.rtB); r.clear(true, true, false); this.pass(this.copyMat, this.rtB);
      // pass 3: water + transparents
      this.pass(G.sky.probeMat, G.sky.probe);
      const ou = O.mat.uniforms; ou.tSky.value = G.sky.probe.texture; ou.tScene.value = this.rtA.texture; ou.tDepth.value = this.rtA.depthTexture; ou.uRes.value.set(this.w, this.h); ou.uNear.value = cam.near; ou.uFar.value = cam.far;
      cam.layers.set(1); r.setRenderTarget(this.rtB); r.render(sc, cam); cam.layers.set(0);
      // sun shafts (above water, when the sun is up and in front of the camera)
      { const fr = this.finalMat.uniforms; fr.uRays.value.x = 0;
        if (S.post && !this.underwater && G.sky.sunVis > 0.05) {
          const sp = this._sp || (this._sp = new THREE.Vector3()); sp.copy(G.sky.sunDir).multiplyScalar(5000).add(cam.position).project(cam);
          const fwd = sp.z < 1, su = sp.x * 0.5 + 0.5, sv = sp.y * 0.5 + 0.5, inView = Math.max(0, 1 - Math.max(Math.abs(su - 0.5), Math.abs(sv - 0.5)) * 1.1);
          if (fwd && inView > 0) { const ru = this.rayMat.uniforms; ru.tDepth.value = this.rtB.depthTexture; ru.tColor.value = this.rtA.texture; ru.uSun.value.set(su, sv); ru.uAspect.value = this.w / this.h; this.pass(this.rayMat, this.rayRT); fr.tRays.value = this.rayRT.texture; fr.uRays.value.x = 0.16 * inView * G.sky.sunVis * (1 - W.storm) * (1 - W.fog * 0.5); }
        } }
      // bloom
      const fu = this.finalMat.uniforms; const bloom = S.post && S.bloom;
      if (bloom) {
        const du = this.downMat.uniforms;
        du.tSrc.value = this.rtB.texture; du.uTexel.value.set(1 / this.w, 1 / this.h); du.uThresh.value = 1.25; this.pass(this.downMat, this.b1);
        du.tSrc.value = this.b1.texture; du.uTexel.value.set(2 / this.w, 2 / this.h); du.uThresh.value = 0; this.pass(this.downMat, this.b2);
        du.tSrc.value = this.b2.texture; du.uTexel.value.set(4 / this.w, 4 / this.h); this.pass(this.downMat, this.b3);
        fu.tB1.value = this.b1.texture; fu.tB2.value = this.b2.texture; fu.tB3.value = this.b3.texture;
      }
      fu.uBloom.value = bloom ? 0.10 : 0;
      fu.tColor.value = this.rtB.texture; fu.tDepth.value = this.rtB.depthTexture; fu.uUnder.value = this.underwater ? 1 : 0;
      fu.uCamPos.value.copy(cam.position);
      fu.uInvVP.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).invert();
      // underwater palette: darker with depth, at night, and in storms; murkier in open/deep water
      const dl = G.sky.dayLight, dk = Math.exp(-this.camDepth * 0.022);
      const turb = this.turbidity || 1;
      fu.uUnderCol.value.setRGB(0.03 * dl * dk, (0.34 - 0.08 * (turb - 1)) * dl * dk + 0.004, (0.38 - 0.05 * (turb - 1)) * dl * dk + 0.008);
      fu.uUnderK.value = turb * (1 + W.storm * 0.8); fu.uSunK.value = G.sky.sunVis;
      if (this.underwater) {
        const uu = this.uwMat.uniforms, sun = G.sky.sun, hemi = G.sky.hemi, k = turb * (1 + W.storm * 0.8);
        uu.uSigT.value.set(0.24 + 0.04 * k, 0.026 + 0.016 * k, 0.03 + 0.012 * k); uu.uSigS.value = 0.06 + 0.03 * k;   // clear water: 35-45 m visibility in calm weather
        uu.tDepth.value = this.rtB.depthTexture; uu.tNoise.value = G.tex.detail.map; uu.uInvVP.value.copy(fu.uInvVP.value); uu.uCamPos.value.copy(cam.position);
        uu.uSunC.value.copy(sun.color).multiplyScalar(sun.intensity); uu.uAmbC.value.copy(hemi.color).multiplyScalar(hemi.intensity); uu.uAmbC.value.multiply(new THREE.Color(0.6, 1.0, 0.82));   // light scattered in shallow reef water skews green-teal
        const sm = sun.castShadow && sun.shadow.map; uu.uShadowOn.value = sm ? 1 : 0; if (sm) { uu.tShadow.value = sun.shadow.map.texture; uu.uShadowM.value.copy(sun.shadow.matrix); }
        uu.uRes.value.set(this.w >> 1, this.h >> 1); this.pass(this.uwMat, this.uw); fu.tUW.value = this.uw.texture; fu.uSigT.value.copy(uu.uSigT.value);
      }
      fu.uExposure.value = this.exposure * (this.underwater ? G.lerp(0.75, 1, dk) : 1);
      fu.uDamage.value = this.damage; fu.uFade.value = this.fade; fu.uVig.value = S.post ? 0.38 : 0.0; fu.uSat.value = S.post ? 1.08 : 1.0;
      fu.uTexel.value.set(1 / this.w, 1 / this.h); fu.uAA.value = S.post ? 1 : 0;
      { // cloud shadow deck: drifts with the wind; strongest on broken-cloud days, gone under full overcast or at night
        const cu = fu.uCloud.value, wd = W.windDir || 0, sp = 4 + W.wind * 14, ddt = Math.min(0.1, dt || 0.016); cu.x += Math.cos(wd) * sp * ddt; cu.y += Math.sin(wd) * sp * ddt;
        const cov = Math.min(0.92, 0.08 + W.cloud * 0.8); cu.z = cov; cu.w = (S.post ? 0.55 : 0) * (this.cloudK == null ? 1 : this.cloudK) * G.sky.sunVis * G.sstep(0.05, 0.3, W.cloud) * (1 - G.sstep(0.82, 0.98, W.cloud)) * (1 - W.fog * 0.7);
      }
      this.pass(this.finalMat, null);
      // dynamic resolution (only kicks in when clearly struggling)
      this.frameMs = this.frameMs * 0.95 + dt * 1000 * 0.05; this.fps = 1000 / this.frameMs;
      this._dynT = (this._dynT || 0) + dt;
      if (this._dynT > 3) {
        this._dynT = 0;
        if (this.frameMs > 30 && this.dyn > 0.6) { this.dyn = Math.max(0.6, this.dyn - 0.1); this.resize(); }
        else if (this.frameMs < 17.5 && this.dyn < 1) { this.dyn = Math.min(1, this.dyn + 0.1); this.resize(); }
      }
    },
    screenshot() {
      this.frame(0.016);
      const url = this.canvas.toDataURL('image/png');
      const a = document.createElement('a'); a.href = url; a.download = 'lantern-sea-' + Date.now() + '.png'; a.click();
    }
  };
})();
