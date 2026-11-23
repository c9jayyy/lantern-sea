'use strict';
/* Player actions: targeting, interaction, tool use, harvesting, consuming, held-item model, particle effects. */
(function () {
  const G = window.G;
  const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _v = new THREE.Vector3(), _m = new THREE.Matrix4();

  // ---------- particles ----------
  const NP = 500;
  const fx = G.fx = {
    i: 0, vel: new Float32Array(NP * 3), life: new Float32Array(NP), max: new Float32Array(NP), grav: new Float32Array(NP),
    init() {
      const g = new THREE.BufferGeometry(); this.pos = new Float32Array(NP * 3).fill(-9999); this.col = new Float32Array(NP * 4); this.size = new Float32Array(NP);
      g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('acol', new THREE.BufferAttribute(this.col, 4)); g.setAttribute('asize', new THREE.BufferAttribute(this.size, 1));
      const m = new THREE.ShaderMaterial({
        uniforms: { tMap: { value: G.tex.dot }, uScale: { value: 600 } }, transparent: true, depthWrite: false,
        vertexShader: 'attribute vec4 acol; attribute float asize; varying vec4 vC; uniform float uScale; void main(){ vC = acol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = asize * uScale / max(-mv.z, 0.1); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform sampler2D tMap; varying vec4 vC; void main(){ vec4 t = texture2D(tMap, gl_PointCoord); gl_FragColor = vec4(vC.rgb, vC.a * t.a); }'
      });
      this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.layers.set(1); G.scene.add(this.points);
    },
    emit(x, y, z, vx, vy, vz, r, g, b, a, size, life, grav) {
      const i = this.i = (this.i + 1) % NP; this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
      this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a; this.size[i] = size; this.life[i] = this.max[i] = life; this.grav[i] = grav;
    },
    burst(x, y, z, col, n, speed, life, grav, size) { for (let k = 0; k < n; k++) { const a = Math.random() * 6.28, e = Math.random() * 1.4 - 0.2, s = speed * (0.4 + Math.random() * 0.8); this.emit(x, y, z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + speed * 0.4, Math.sin(a) * Math.cos(e) * s, col[0], col[1], col[2], col[3] == null ? 1 : col[3], (size || 0.08) * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.8), grav == null ? 9 : grav); } },
    splash(x, y, z, n) { this.burst(x, y, z, [0.85, 0.93, 1, 0.8], n || 14, 2.6, 0.7, 9, 0.12); },
    bubbles(x, y, z, n) { for (let k = 0; k < n; k++) this.emit(x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4, 0, 0.6 + Math.random() * 0.7, 0, 0.8, 0.95, 1, 0.5, 0.05 + Math.random() * 0.06, 2.2, -0.3); },
    update(dt) {
      for (let i = 0; i < NP; i++) {
        if (this.life[i] <= 0) continue; this.life[i] -= dt;
        if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -9999; this.col[i * 4 + 3] = 0; continue; }
        this.vel[i * 3 + 1] -= this.grav[i] * dt; this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
        if (this.life[i] < this.max[i] * 0.3) this.col[i * 4 + 3] *= 0.9;
      }
      const a = this.points.geometry.attributes; a.position.needsUpdate = true; a.acol.needsUpdate = true; a.asize.needsUpdate = true;
    }
  };

  // ---------- impact debris: real wood chips and stone fragments that tumble, bounce, float or sink ----------
  const CH = G.chips = {
    N: 140, kinds: {},
    init() {
      const mk = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat === 'wood' ? new THREE.MeshStandardMaterial({ color: 0xc8a676, roughness: 0.85 }) : G.mats[mat], this.N);   // fresh-cut wood is pale m.frustumCulled = false; m.castShadow = true; m.count = this.N; const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < this.N; i++) m.setMatrixAt(i, z); G.scene.add(m);
        return { m, i: 0, p: new Float32Array(this.N * 3), v: new Float32Array(this.N * 3), r: new Float32Array(this.N * 3), w: new Float32Array(this.N * 3), s: new Float32Array(this.N), life: new Float32Array(this.N), float: mat === 'wood' }; };
      this.kinds.wood = mk(new THREE.BoxGeometry(1, 0.22, 0.45), 'wood'); this.kinds.stone = mk(G.geo.blob(77, 5, 0.4, 0.7), 'stone');
    },
    spawn(kind, x, y, z, dx, dz, n, size) {
      const K = this.kinds[kind]; if (!K) return;
      for (let k = 0; k < n; k++) { const i = K.i = (K.i + 1) % this.N, sp = 1.5 + Math.random() * 2.5, a = Math.atan2(dz, dx) + (Math.random() - 0.5) * 2.2;
        K.p[i * 3] = x; K.p[i * 3 + 1] = y; K.p[i * 3 + 2] = z; K.v[i * 3] = Math.cos(a) * sp; K.v[i * 3 + 1] = 1.2 + Math.random() * 2.6; K.v[i * 3 + 2] = Math.sin(a) * sp;
        for (let j = 0; j < 3; j++) { K.r[i * 3 + j] = Math.random() * 6.28; K.w[i * 3 + j] = (Math.random() - 0.5) * 24; } K.s[i] = (size || 0.05) * (0.5 + Math.random()); K.life[i] = 3 + Math.random() * 2; }
    },
    update(dt) {
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pv = new THREE.Vector3(), sv = new THREE.Vector3();
      for (const key in this.kinds) {
        const K = this.kinds[key]; let any = false;
        for (let i = 0; i < this.N; i++) {
          if (K.life[i] <= 0) continue; any = true; K.life[i] -= dt; const o = i * 3;
          const wy = G.ocean.height(K.p[o], K.p[o + 2]), gy = G.world.heightAt(K.p[o], K.p[o + 2]), inW = K.p[o + 1] < wy && wy > gy;
          if (inW) { if (K.float) { K.v[o + 1] += (wy - K.p[o + 1]) * 20 * dt; } else K.v[o + 1] -= 1.2 * dt; for (let j = 0; j < 3; j++) { K.v[o + j] *= 1 - Math.min(1, 3 * dt); K.w[o + j] *= 1 - Math.min(1, 2 * dt); } }
          else K.v[o + 1] -= 9.8 * dt;
          for (let j = 0; j < 3; j++) { K.p[o + j] += K.v[o + j] * dt; K.r[o + j] += K.w[o + j] * dt; }
          const floor = gy + K.s[i] * 0.2; if (K.p[o + 1] < floor) { K.p[o + 1] = floor; if (K.v[o + 1] < -0.6) { K.v[o + 1] *= -0.35; } else K.v[o + 1] = 0; K.v[o] *= 0.6; K.v[o + 2] *= 0.6; for (let j = 0; j < 3; j++) K.w[o + j] *= 0.5; }
          const sc = K.s[i] * Math.min(1, K.life[i] / 0.6); e.set(K.r[o], K.r[o + 1], K.r[o + 2]); q.setFromEuler(e); K.m.setMatrixAt(i, m4.compose(pv.set(K.p[o], K.p[o + 1], K.p[o + 2]), q, sv.set(sc, sc, sc)));
        }
        if (any || K.dirty) { K.m.instanceMatrix.needsUpdate = true; K.dirty = any; }
      }
    }
  };
  // ---------- held item models ----------
  const HAND = {
    axe(b, t) { if (t && G.assets.addToUpright(b, 'axe', 0.62, 0.0)) return; if (!t) return stoneHead(b, 0.6, [0.08, 0.05, 0.02], 0.045); b.cyl(0.018, 0.022, 0.6, 0, 0, 0, 'woodDark', 6); b.box(0.16, 0.1, 0.03, 0.06, 0.24, 0, t ? 'steel' : 'stone'); },
    pick(b, t) { if (!t) return stoneHead(b, 0.6, [0.15, 0.028, 0.025], 0.0); b.cyl(0.018, 0.022, 0.6, 0, 0, 0, 'woodDark', 6); b.box(0.32, 0.045, 0.04, 0, 0.26, 0, t ? 'steel' : 'stone'); },
    knife(b, t) {
      if (t && G.assets.addToUpright(b, 'knife', 0.36, -0.1)) return;
      if (t) { b.cyl(0.018, 0.02, 0.16, 0, -0.08, 0, 'woodDark', 6); b.box(0.035, 0.4, 0.008, 0, 0.2, 0, 'steel'); return; }
      // knapped flint blade: a flaked, leaf-shaped edge bound into a split stick with cord
      b.cyl(0.016, 0.019, 0.17, 0, -0.07, 0, 'log', 8);
      const g = G.geo.blob(733, 9, 0.18, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 - Math.max(0, y) * 0.75)); } g.computeVertexNormals();
      b.add(g, 'stone', b.mat4(0, 0.1, 0, 0, 0.3, 0, 0.022, 0.095, 0.007));
      for (let i = 0; i < 4; i++) b.cyl(0.021, 0.021, 0.01, 0, 0.0 + i * 0.012, 0, 'rope', 10, 0, 0, i % 2 ? 0.3 : -0.3);
    },
    spear(b, t) { b.cyl(0.014, 0.016, 1.7, 0, 0.3, 0, 'log', 6); b.cyl(0.0, 0.03, 0.2, 0, 1.24, 0, t ? 'steel' : 'stone', 5); },
    mallet(b) { b.cyl(0.018, 0.02, 0.45, 0, 0, 0, 'woodDark', 6); b.cyl(0.055, 0.055, 0.18, 0, 0.22, 0, 'wood', 8, 0, 0, Math.PI / 2); },
    hook(b) { b.merge(G.hookModel(0.9), b.mat4(0, 0.2, 0, Math.PI, 0, 0)); const c = new THREE.TorusGeometry(0.06, 0.016, 5, 12); b.add(c, 'rope', b.mat4(-0.02, -0.15, 0.02, 1.3, 0, 0)); const c2 = new THREE.TorusGeometry(0.055, 0.016, 5, 12); b.add(c2, 'rope', b.mat4(-0.02, -0.175, 0.02, 1.4, 0.3, 0)); },
    rod(b) { b.cyl(0.006, 0.014, 1.9, 0, 0.7, 0, 'log', 5); b.cyl(0.03, 0.03, 0.03, 0.03, -0.05, 0, 'brass', 8, 0, 0, Math.PI / 2); },
    paddle(b, t) {   // T-grip, oval shaft, and a shaped blade (tapering throat, rounded tip, thin edges)
      const L = t ? 1.25 : 1.1; b.cyl(0.017, 0.019, L, 0, 0.55 - L / 2, 0, 'wood', 10); b.cyl(0.02, 0.02, 0.13, 0, 0.56, 0, 'woodDark', 8, 0, 0, Math.PI / 2);
      const sh = new THREE.Shape(), w = t ? 0.1 : 0.085, bl = t ? 0.55 : 0.46; sh.moveTo(-0.018, 0); sh.bezierCurveTo(-0.03, -0.06, -w, -0.08, -w, -0.16); sh.lineTo(-w, -bl + 0.07); sh.quadraticCurveTo(-w, -bl, 0, -bl); sh.quadraticCurveTo(w, -bl, w, -bl + 0.07); sh.lineTo(w, -0.16); sh.bezierCurveTo(w, -0.08, 0.03, -0.06, 0.018, 0); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 10 }); g.translate(0, 0.55 - L, -0.006); b.add(g, 'wood');
      for (let i = 0; i < 3; i++) b.cyl(0.022, 0.022, 0.01, 0, 0.55 - L - 0.01 + i * 0.014, 0, 'rope', 10);
    },
    torch(b) {   // stick with a resin-soaked cloth head, charred where it burns (the flame itself is added live in setHand)
      b.cyl(0.016, 0.02, 0.5, 0, 0, 0, 'log', 8);
      for (let i = 0; i < 5; i++) { const g = new THREE.TorusGeometry(0.03 - i * 0.002, 0.012, 6, 14); b.add(g, i < 2 ? 'rope' : 'dark', b.mat4(0, 0.22 + i * 0.022, 0, Math.PI / 2 + (i - 2) * 0.12, 0, 0)); }
      b.cyl(0.034, 0.028, 0.03, 0, 0.33, 0, 'ember', 10);
    },
    shovel(b) {   // D-handle, ash shaft, socket and a dished, pointed blade
      b.cyl(0.017, 0.019, 0.85, 0, 0.12, 0, 'woodDark', 10); const d = new THREE.TorusGeometry(0.05, 0.011, 6, 14, Math.PI); b.add(d, 'woodDark', b.mat4(0, 0.55, 0)); b.cyl(0.011, 0.011, 0.1, 0, 0.55, 0, 'woodDark', 6, 0, 0, Math.PI / 2);
      b.cyl(0.022, 0.03, 0.12, 0, -0.33, 0, 'metal', 10);
      const sh = new THREE.Shape(); sh.moveTo(-0.09, 0); sh.lineTo(0.09, 0); sh.lineTo(0.095, -0.18); sh.quadraticCurveTo(0.06, -0.26, 0, -0.29); sh.quadraticCurveTo(-0.06, -0.26, -0.095, -0.18); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: false, curveSegments: 8 }); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, p.getZ(i) + x * x * 2.2); } g.computeVertexNormals(); g.translate(0, -0.38, -0.01); b.add(g, 'metal');
    },
    bow(b, t) {   // limbs bending back toward the archer from a leather-wrapped handle in the hand, tips slightly recurved, taut string
      const L = t ? 0.68 : 0.62, pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24 * 2 - 1; pts.push(new THREE.Vector3(0, u * L, 0.11 * u * u - 0.03 * Math.pow(Math.abs(u), 8))); }
      b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.011, 7), 'woodDark');
      b.beam(0, -L, 0.08, 0, L, 0.08, 0.0022, 'rope', 4); b.cyl(0.016, 0.016, 0.12, 0, 0, 0, 'rope', 8);
    },
    binoculars(b) { b.cyl(0.035, 0.04, 0.14, -0.04, 0.1, 0, 'dark', 8, Math.PI / 2); b.cyl(0.035, 0.04, 0.14, 0.04, 0.1, 0, 'dark', 8, Math.PI / 2); },
    detector(b) {   // shaft through the hand, foam grip, control box, arm cuff on top, and the search coil at the foot
      b.cyl(0.011, 0.011, 1.0, 0, -0.15, 0, 'steel', 8); b.cyl(0.017, 0.017, 0.13, 0, 0, 0, 'dark', 10);
      b.box(0.05, 0.08, 0.035, 0, 0.1, -0.028, 'plasticYellow'); b.box(0.035, 0.02, 0.005, 0, 0.12, -0.047, 'screen');
      const cuff = new THREE.TorusGeometry(0.035, 0.008, 6, 14, Math.PI * 1.2); b.add(cuff, 'dark', b.mat4(0, 0.33, 0.02, Math.PI / 2, 0, 0)); b.cyl(0.006, 0.006, 0.04, 0, 0.33, 0, 'dark', 6, 0, 0, 0);
      const coil = new THREE.TorusGeometry(0.11, 0.012, 8, 28); coil.scale(1, 0.8, 1); b.add(coil, 'dark', b.mat4(0, -0.66, -0.02, 1.25, 0, 0)); b.cyl(0.1, 0.1, 0.006, 0, -0.66, -0.02, 'plasticYellow', 24, 1.25 - Math.PI / 2, 0, 0);
    },
    sonar(b) { b.box(0.12, 0.2, 0.05, 0, 0.05, 0, 'plasticYellow'); b.box(0.09, 0.08, 0.01, 0, 0.09, 0.03, 'screen'); }
  };

  // tapered limb segment between two points (r0 at a, r1 at b)
  const _ta = new THREE.Vector3(), _tb = new THREE.Vector3(), _tq = new THREE.Quaternion(), _tm = new THREE.Matrix4();
  function taper(b, a, c, r0, r1, mat) {
    _ta.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]); const L = _ta.length(); _ta.normalize(); _tq.setFromUnitVectors(_tb.set(0, 1, 0), _ta);
    const g = G.geo.cyl(r1, r0, L, 14); _tm.compose(_tb.set((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2), _tq, new THREE.Vector3(1, 1, 1)); b.add(g, mat, _tm);
  }
  // the right forearm and hand, closed around a handle that runs along local Y through the origin
  // a fingernail lying on the outside of a fingertip: centre p, outward direction n, along-finger direction t
  const _nq = new THREE.Quaternion(), _nm = new THREE.Matrix4(), _nb = new THREE.Matrix4(), _nx = new THREE.Vector3(), _ny = new THREE.Vector3(), _nz = new THREE.Vector3();
  function nail(b, p, n, t, w) {
    _nz.set(n[0], n[1], n[2]).normalize(); _ny.set(t[0], t[1], t[2]).normalize(); _nx.crossVectors(_ny, _nz).normalize(); _ny.crossVectors(_nz, _nx);
    _nb.makeBasis(_nx, _ny, _nz); _nq.setFromRotationMatrix(_nb);
    _nm.compose(_tb.set(p[0], p[1], p[2]), _nq, new THREE.Vector3(w * 0.74, w * 0.95, w * 0.26)); b.add(G.geo.sph(10), 'nail', _nm);
  }
  // the right forearm and hand, closed around a handle of radius R that runs along local Y through the origin.
  // Fingers touch their neighbours, each phalanx tapers and is as long as a real one, so a thin handle makes a tight fist.
  function arm(b, R) {
    R = R || 0.02; const dx = R - 0.031, ring = (a, y, r) => [Math.cos(a) * r, y, -Math.sin(a) * r];
    const LEN = [[0.044, 0.027, 0.02], [0.048, 0.03, 0.021], [0.045, 0.029, 0.02], [0.036, 0.022, 0.018]];   // index, middle, ring, little
    for (let i = 0; i < 4; i++) {
      const fr = [0.0106, 0.0108, 0.0101, 0.0088][i], y = 0.033 - [0, 0.0212, 0.0418, 0.0608][i], rad = R + fr * 0.92;
      const angs = [0.2]; for (let k = 0; k < 3; k++) angs.push(angs[k] - 2 * Math.asin(Math.min(0.98, LEN[i][k] / (2 * rad))));
      const pts = angs.map((a, k) => ring(Math.max(a, -3.55), y - 0.0015 * k, rad - k * 0.0006));
      for (let k = 0; k < 3; k++) {
        const r0 = fr * (1 - k * 0.1), r1 = fr * (0.9 - k * 0.1);
        taper(b, pts[k], pts[k + 1], r0, r1, 'skin'); b.sph(r1 * 1.04, pts[k + 1][0], pts[k + 1][1], pts[k + 1][2], 'skin', 1, 1, 1, null, 10);
      }
      b.sph(fr * 1.18, pts[0][0], pts[0][1], pts[0][2], 'skin', 1, 1.0, 1.05, null, 10);   // knuckle
      // nail on the last joint, facing away from the handle
      const a3 = (angs[2] + angs[3]) / 2 - 0.08, pn = ring(a3, y - 0.004, rad + fr * 0.62), tn = [-Math.sin(a3), 0, -Math.cos(a3)];
      nail(b, pn, [Math.cos(a3), 0, -Math.sin(a3)], [tn[0], tn[1], tn[2]], fr * 0.85);
    }
    // thumb: from the ball of the thumb, over the index finger, its tip pressing round the back of the handle
    const rt = R + 0.0115, t0 = [0.052 + dx, 0.05, 0.03], t1 = ring(1.05, 0.058, rt), t2 = ring(1.75, 0.054, rt - 0.001);
    taper(b, t0, t1, 0.0135, 0.0122, 'skin'); b.sph(0.0124, t1[0], t1[1], t1[2], 'skin', 1, 1, 1, null, 10);
    taper(b, t1, t2, 0.0122, 0.0104, 'skin'); b.sph(0.0106, t2[0], t2[1], t2[2], 'skin', 1, 1, 1, null, 10);
    const at = 1.62; nail(b, ring(at, 0.06, rt + 0.0075), [Math.cos(at) * 0.6, 0.8, -Math.sin(at) * 0.6], [-Math.sin(at), 0, -Math.cos(at)], 0.0095);
    // palm and thenar pad, back of the hand with its knuckle ridge
    b.sph(1, 0.058 + dx, -0.006, 0.006, 'skin', 0.034, 0.062, 0.043, null, 18);
    b.sph(1, 0.05 + dx, 0.03, 0.028, 'skin', 0.022, 0.03, 0.02, null, 12);
    for (let i = 0; i < 4; i++) b.sph(0.0118, 0.049 + dx, 0.033 - i * 0.0205, 0.028, 'skin', 1, 1, 1, null, 10);
    // wrist and a tapering, muscular forearm; a rolled shirt sleeve beyond, out of view
    taper(b, [0.066 + dx, -0.05, 0.012], [0.17 + dx, -0.17, 0.13], 0.031, 0.04, 'skin');
    taper(b, [0.17 + dx, -0.17, 0.13], [0.34 + dx, -0.37, 0.36], 0.04, 0.049, 'skin'); b.sph(0.0395, 0.17 + dx, -0.17, 0.13, 'skin', 1, 1, 1, null, 14);
    taper(b, [0.29 + dx, -0.31, 0.29], [0.44 + dx, -0.48, 0.48], 0.06, 0.064, 'sleeve'); b.cyl(0.068, 0.066, 0.06, 0.29 + dx, -0.31, 0.29, 'sleeve', 16, 0.75, 0, -0.62);
  }
  // radius of the handle where each tool is held (the fist closes to it)
  const HANDLE_R = { axe: 0.02, pick: 0.02, knife: 0.018, spear: 0.016, hook: 0.019, mallet: 0.019, rod: 0.013, paddle: 0.019, torch: 0.019, shovel: 0.018, detector: 0.017, sonar: 0.03, bow: 0.017, binoculars: 0.03 };
  // a knapped stone head lashed to a crooked stick: handle length L, head size [w, h, d], head offset sideways
  function stoneHead(b, L, sz, off) {
    b.cyl(0.017, 0.022, L, 0, 0, 0, 'log', 8, 0, 0, 0.04);
    const g = G.geo.blob(707, 8, 0.32, 0.8); b.add(g, 'stone', b.mat4(off, L * 0.42, 0, 0.1, 0.2, 0.05, sz[0], sz[1], sz[2]));
    for (let i = 0; i < 4; i++) b.cyl(0.026, 0.026, 0.012, 0, L * 0.42 - 0.03 + i * 0.016, 0, 'rope', 10, 0, 0, (i % 2 ? 0.35 : -0.35));
  }
  // where each held tool is gripped (height along its handle)
  const GRIP = { axe: -0.18, pick: -0.18, knife: -0.06, spear: -0.05, hook: 0.05, mallet: -0.14, rod: -0.1, paddle: 0.05, torch: -0.12, shovel: 0.1, detector: 0.0, sonar: -0.02, bow: 0, binoculars: 0.02 };
  const GRIP_SCAN = { axe: 0.12, knife: 0.03 };
  // resting pose per tool, with the grip at the hand's origin: [position offset], [rotation]
  const POSE = { def: [[0, 0.16, 0], [-0.5, 0.2, -0.38]], bow: [[-0.12, 0.2, -0.05], [-0.05, 0.35, -0.15]], shovel: [[-0.08, 0.42, -0.02], [0.3, 0, -0.5]], detector: [[-0.08, 0.38, -0.02], [0.35, 0, -0.45]], paddle: [[-0.08, 0.44, -0.02], [0.3, 0, -0.5]], spear: [[0.0, 0.16, 0.05], [-1.3, 0.1, -0.12]], rod: [[0, 0.16, 0], [-0.85, 0.2, -0.3]], knife: [[0, 0.06, 0], [-0.55, 0.25, -0.35]], hook: [[0, 0.18, 0], [-0.5, 0.2, -0.38]] };

  // paddle stroke keys: [phase, z (forward -), y, extra pitch, x, extra yaw]
  const PADDLE_KEYS = [[0, 0, 0, 0, 0, 0], [0.18, -0.2, 0.06, 0.14, -0.03, 0.05], [0.32, -0.18, -0.12, -0.38, -0.02, 0.0], [0.72, 0.18, -0.14, -0.26, 0.04, -0.15], [0.86, 0.2, 0.06, 0.12, 0.03, -0.1], [1, 0, 0, 0, 0, 0]];
  let _flameTex = null;
  function flameTex() { if (_flameTex) return _flameTex; const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 92, 2, 32, 80, 60); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(32, 2); g.bezierCurveTo(52, 50, 60, 80, 54, 104); g.quadraticCurveTo(32, 126, 10, 104); g.bezierCurveTo(4, 80, 12, 50, 32, 2); g.fill();
    _flameTex = new THREE.CanvasTexture(c); _flameTex.colorSpace = THREE.SRGBColorSpace; return _flameTex; }
  // swing animations per kind of tool. Keys: [phase, dx, dy, dz (+ toward you), drx (- tips forward), dry, drz]
  const SWING = {
    chop: { dur: 0.5, k: [[0, 0, 0, 0, 0, 0, 0], [0.3, 0.06, 0.15, 0.12, 0.95, -0.1, -0.25], [0.46, -0.08, -0.07, -0.18, -1.15, 0.15, 0.25], [0.56, -0.07, -0.09, -0.16, -1.05, 0.15, 0.22], [1, 0, 0, 0, 0, 0, 0]] },
    slash: { dur: 0.38, k: [[0, 0, 0, 0, 0, 0, 0], [0.25, 0.14, 0.05, 0.03, -0.2, -0.6, 0.5], [0.55, -0.28, -0.02, -0.12, -0.5, 0.7, -0.45], [1, 0, 0, 0, 0, 0, 0]] },
    thrust: { dur: 0.45, k: [[0, 0, 0, 0, 0, 0, 0], [0.3, 0.02, 0.02, 0.18, 0.05, 0, 0], [0.48, -0.04, 0, -0.45, -0.05, 0, 0], [0.62, -0.04, 0, -0.42, -0.05, 0, 0], [1, 0, 0, 0, 0, 0, 0]] },
    dig: { dur: 0.6, k: [[0, 0, 0, 0, 0, 0, 0], [0.3, 0, 0.04, -0.16, -0.22, 0, 0], [0.6, 0, -0.1, -0.2, 0.28, 0, 0], [1, 0, 0, 0, 0, 0, 0]] },
    throw: { dur: 0.45, k: [[0, 0, -0.04, 0.16, 0.6, 0, 0], [0.35, 0, 0.05, -0.25, -0.9, 0, 0], [1, 0, 0, 0, 0, 0, 0]] },
    cast: { dur: 0.6, k: [[0, 0, 0, 0, 0, 0, 0], [0.3, 0, 0.06, 0.1, 0.8, 0, 0], [0.55, 0, 0, -0.1, -0.6, 0, 0], [1, 0, 0, 0, 0, 0, 0]] },
    recoil: { dur: 0.4, k: [[0, 0, 0, 0, 0, 0, 0], [0.1, 0, 0.01, 0.06, 0.12, 0, 0], [1, 0, 0, 0, 0, 0, 0]] },
    bash: { dur: 0.35, k: [[0, 0, 0, 0, 0, 0, 0], [0.4, 0, -0.02, -0.15, -1.2, 0, 0], [1, 0, 0, 0, 0, 0, 0]] }
  };
  const SWING_OF = { axe: 'chop', pick: 'chop', mallet: 'chop', knife: 'slash', spear: 'thrust', shovel: 'dig', hook: 'throw', rod: 'cast', bow: 'recoil' };
  const keyAt = (K, p, out) => { let k = 0; while (k < K.length - 2 && K[k + 1][0] < p) k++; const a = K[k], c = K[k + 1], f = G.sstep(0, 1, (p - a[0]) / Math.max(1e-4, c[0] - a[0])); for (let i = 1; i < 7; i++) out[i - 1] = a[i] + (c[i] - a[i]) * f; return out; };
  const _kv = [0, 0, 0, 0, 0, 0];
  G.HAND = HAND; G.stoneHead = stoneHead;
  const A = G.actions = {
    hand: null, handKey: '', charge: 0, cd: 0, paddleT: 0, sandT: 0, target: null,
    init() { this.handRoot = new THREE.Group(); this.handRoot.position.set(0.4, -0.42, -0.72); G.camera.add(this.handRoot); this.torchLight = new THREE.PointLight(0xff9a4a, 0, 16, 1.6); this.torchLight.layers.enableAll(); G.camera.add(this.torchLight); this.torchLight.position.set(0.3, 0, -0.4); },
    setHand(stack) {
      const def = stack && G.ITEMS[stack.id]; const key = def && def.tool && HAND[def.tool.type] ? def.tool.type + (def.tool.tier > 0 ? 1 : 0) : '';
      if (key === this.handKey) return; this.handKey = key; if (this.hand) { G.disposeGroup(this.hand); this.hand = null; }
      if (!key) return; const b = new G.MB(), ty = def.tool.type; HAND[ty](b, def.tool.tier > 0);
      // the hand closes on the handle; scanned tools sit on their base, so their grip height differs
      const scanned = def.tool.tier > 0 && G.assets.models[ty === 'axe' ? 'axe' : 'knife'] && (ty === 'axe' || ty === 'knife'), gy = scanned ? GRIP_SCAN[ty] : (GRIP[ty] != null ? GRIP[ty] : -0.1);
      // every tool is moved so its grip sits at the hand's origin, so the hand is always where the pose puts it
      const fb = new G.MB(); fb.merge(b, fb.mat4(0, -gy, 0)); const ab = new G.MB(); arm(ab, HANDLE_R[ty]); fb.merge(ab, fb.mat4(0, 0, 0));
      this.hand = fb.build({ shadow: false }); const pose = POSE[ty] || POSE.def; this.hand.userData.pose = pose; this.hand.userData.ty = ty;
      this.hand.position.set(pose[0][0], pose[0][1], pose[0][2]); this.hand.rotation.set(pose[1][0], pose[1][1], pose[1][2]); this.handRoot.add(this.hand);
      if (ty === 'torch') {   // layered additive flame: wide orange body, yellow core, white-hot root; flickers every frame
        const tex = flameTex(), mk = (c, o) => new THREE.SpriteMaterial({ map: tex, color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
        const f = new THREE.Group(); f.position.set(0, 0.36 - gy + 0.06, 0); f.userData.parts = [];
        for (const [c, o, s, y] of [[0xff5a10, 0.55, 0.16, 0.05], [0xff9a2a, 0.75, 0.11, 0.03], [0xffd860, 0.9, 0.065, 0.015], [0xfff4d0, 0.9, 0.035, 0.0]]) { const sp = new THREE.Sprite(mk(c, o)); sp.scale.set(s, s * 1.7, 1); sp.position.y = y; sp.userData.b = [s, y]; sp.layers.set(1); sp.renderOrder = 9; f.add(sp); f.userData.parts.push(sp); }
        this.hand.add(f); this.flame = f;
      } else this.flame = null;
    },
    ray() { G.camera.getWorldPosition(_o); G.camera.getWorldDirection(_d); },

    findTarget() {
      this.ray(); const P = G.player; let best = null, bs = 1e9;
      const test = (x, y, z, r, reach, mk) => { const px = x - _o.x, py = y - _o.y, pz = z - _o.z, t = px * _d.x + py * _d.y + pz * _d.z; if (t < 0.05 || t > reach) return; const off = Math.hypot(px - _d.x * t, py - _d.y * t, pz - _d.z * t); if (off > r) return; const sc = t + off * 1.6; if (sc < bs) { bs = sc; best = mk(); } };
      const T = G.structs.T;
      for (const st of G.structs.list) {
        if (Math.hypot(P.pos.x - st.pos.x, P.pos.z - st.pos.z) > st.radius + 5) continue;
        for (const it of st.items.values()) { st.itemWorld(it, _v); const d = G.itemDims[it.type]; test(_v.x, st.pos.y + st.floorY(it.lv) + (d ? Math.min(d[1] * 0.55, 1.2) : 0.25), _v.z, 0.75, 3.2, () => ({ kind: 'item', it, label: G.items.label(it), key: true })); }
        for (const [k, w] of st.walls) if (w.type === 'wall_door') { const [ix, iz, lv, side] = k.split(',').map(Number); st.toWorld(side === 0 ? ix * T : ix * T - T / 2, st.floorY(lv) + 1.1, side === 0 ? iz * T - T / 2 : iz * T, _v); test(_v.x, _v.y, _v.z, 0.7, 3, () => ({ kind: 'door', st, k, w, label: w.open ? 'Close door' : 'Open door', key: true })); }
      }
      for (const o of G.interact.list) { if (Math.abs(o.x - _o.x) > 8 || Math.abs(o.z - _o.z) > 8) continue; test(o.x, o.y, o.z, o.r || 0.6, o.reach || 3.2, () => ({ kind: 'obj', o, label: typeof o.label === 'function' ? o.label() : o.label, key: true })); }
      const n = G.world.pickNode(_o.x, _o.y, _o.z, _d.x, _d.y, _d.z, 3.0);
      if (n && (!best || bs > 2.2)) {
        const def = G.NODES[n.node.t]; const held = G.inv.held(), tool = held && G.ITEMS[held.id].tool; let label = def.name, key = false, hint = '';
        if (def.act === 'pick') { label = 'Gather ' + def.name.toLowerCase(); key = true; }
        else { const need = def.act === 'chop' ? 'axe' : 'pick'; const ok = tool && (tool.type === need || (need === 'axe' && tool.type === 'knife' && tool.tier > 0 && def.tier === 0)); hint = !ok ? 'needs ' + (need === 'axe' ? 'an axe' : 'a pickaxe') : tool.tier < def.tier ? 'needs a stronger ' + (need === 'axe' ? 'axe' : 'pick') : 'left-click to ' + (need === 'axe' ? 'chop' : 'mine'); }
        best = { kind: 'node', node: n.node, island: n.island, label, key, hint };
      }
      this.target = P.target = best; return best;
    },

    interact() {
      const t = this.target; if (!t) return;
      if (t.kind === 'item') G.items.use(t.it);
      else if (t.kind === 'door') { t.w.open = !t.w.open; t.st.dirty = true; G.audio.sfx('door'); }
      else if (t.kind === 'obj') t.o.use(t.o);
      else if (t.kind === 'node' && t.key) this.harvest(t.node, t.island);
    },
    harvest(n, I) {
      const def = G.NODES[n.t]; const bonus = G.skills.level('harvesting') * 0.06; let got = false;
      for (const [id, a, b] of def.drops) { let q = a + Math.floor(Math.random() * (b - a + 1)); if (q > 0 && Math.random() < bonus) q++; q = Math.round(q * (a === 0 ? 1 : Math.max(1, G.DIFF[G.game.difficulty].loot * 0.5 + 0.5))); if (q > 0) { G.inv.add(id, q); got = true; } }
      if (def.fall) this.fell(n);
      G.world.removeNode(I, n); G.skills.xp('harvesting', def.act === 'pick' ? 2 : 8); G.audio.sfx(def.act === 'pick' ? 'pickup' : def.act === 'chop' ? 'treefall' : 'rockbreak');
      G.journal.stat('harvest'); G.emit('harvest', n.t, I); if (!got) G.ui.toast('Nothing useful this time.');
      if (n.t === 'bush' && Math.random() < 0.25) G.inv.add('bait', 1);
    },
    fell(n) {
      const gs = G.nodeGeo[n.v], grp = new THREE.Group();
      for (const mk in gs) { if (!gs[mk] || !gs[mk].isBufferGeometry) continue; const m = new THREE.Mesh(gs[mk], G.mats[mk]); m.castShadow = true; grp.add(m); }
      grp.position.set(n.x, n.y, n.z); grp.rotation.y = n.r; grp.scale.setScalar(n.s); G.scene.add(grp);
      const ax = Math.random() * 6.28; this.falling.push({ grp, t: 0, ax });
    },
    falling: [],

    // bare-handed blow: enough to kill a crab or bruise a fish, not much else
    punch() { if (this.cd > 0) return; this.cd = 0.55; const P = G.player; this.ray(); P.swingT = 1; if (!G.wildlife.strike(_o, _d, 1.7, 2.2, 'fist')) G.audio.sfx('whoosh'); },
    swingAt(tool, slot) {
      const P = G.player; this.ray();
      const reach = tool.type === 'spear' ? 3.4 : 2.7;
      if (G.wildlife.strike(_o, _d, reach, tool.dmg * (1 + tool.tier * 0.1), tool.type)) { G.inv.wear(slot, 2); this.hitHold = 0.08; this.kick = 0.03; return; }
      const hit = G.world.pickNode(_o.x, _o.y, _o.z, _d.x, _d.y, _d.z, reach); if (!hit) { G.audio.sfx('whoosh'); return; }
      const n = hit.node, def = G.NODES[n.t]; if (def.act === 'pick') return this.harvest(n, hit.island);
      const need = def.act === 'chop' ? 'axe' : 'pick'; const ok = tool.type === need || (need === 'axe' && tool.type === 'knife' && tool.tier > 0 && def.tier === 0);
      if (!ok) { G.audio.sfx('thud'); return G.ui.toast(def.name + ' — ' + (need === 'axe' ? 'you need an axe.' : 'you need a pickaxe.')); }
      if (tool.tier < def.tier) { G.audio.sfx('clang'); return G.ui.toast('Your ' + need + ' is not strong enough for ' + def.name.toLowerCase() + '.', 'bad'); }
      n.hp -= 1 + (tool.tier - def.tier) * 0.8; G.inv.wear(slot, 1);
      const py = n.y + (def.fall ? 1.2 : def.rad * n.s * 0.5);
      // the blow lands where the swing meets the surface, on the side facing you; chips fly back toward you and sideways
      const ddx = n.x - _o.x, ddz = n.z - _o.z, dl = Math.hypot(ddx, ddz) || 1, rr = (def.rad || 0.4) * (n.s || 1) * (def.fall ? 0.6 : 0.9), hx = n.x - ddx / dl * rr, hz = n.z - ddz / dl * rr, hy = Math.min(py, _o.y + _d.y * Math.max(0.5, dl - rr));
      if (def.act === 'chop') { G.chips.spawn('wood', hx, hy, hz, -ddx / dl, -ddz / dl, 5 + Math.floor(Math.random() * 4), 0.045); fx.burst(hx, hy, hz, [0.62, 0.5, 0.34, 0.6], 6, 1.2, 0.5, 2, 0.05); G.audio.sfx('chop'); }
      else { G.chips.spawn('stone', hx, hy, hz, -ddx / dl, -ddz / dl, 4 + Math.floor(Math.random() * 4), 0.04); fx.burst(hx, hy, hz, [0.7, 0.68, 0.64, 0.45], 14, 0.9, 0.9, -0.2, 0.16); for (let k = 0; k < 5; k++) fx.emit(hx, hy, hz, (Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6, 1, 0.75, 0.35, 1, 0.025, 0.25, 9); G.audio.sfx('mine'); }
      this.shake = 0.25; this.shakeNode = { n, I: hit.island }; this.hitHold = 0.07; this.kick = 0.035;
      if (n.hp <= 0) this.harvest(n, hit.island);
    },

    consume(slot) {
      const s = G.inv.slots[slot]; if (!s) return false; const def = G.ITEMS[s.id], P = G.player;
      if (def.food) {
        const f = def.food; const cooked = f.sick === 0 && f.h > 20 ? 1 + G.skills.level('cooking') * 0.04 : 1;
        if (f.h > 0 && P.hunger > 97 && f.t <= 0 && !def.med) { G.ui.toast('You are not hungry.'); return true; }
        P.hunger = G.clamp(P.hunger + f.h * cooked, 0, 100); P.thirst = G.clamp(P.thirst + f.t, 0, 100); if (f.hp > 0) P.heal(f.hp); else if (f.hp < 0) P.damage(-f.hp, 'bad food', { silent: true });
        if (f.sick && Math.random() < f.sick) P.afflict('sick', 110); if (def.warm) P.temp = Math.min(P.temp + def.warm, 40); if (def.energy) P.energy = Math.min(100, P.energy + def.energy);
        if (def.cure) for (const c of def.cure) P.cure(c);
        G.inv.removeAt(slot, 1); if (def.returns) G.inv.add(def.returns, 1, null, true);
        G.audio.sfx(f.h > f.t ? 'eat' : 'drink'); G.emit('ate', s.id); if (s.id === 'bottle_fresh' || s.id === 'coconut' || s.id === 'herbal_tea') G.emit('drank', 'fresh'); return true;
      }
      if (def.med) { let used = def.med.hp > 0 && P.hp < 100; for (const c of def.med.cure) if (P.cure(c)) used = true; if (!used) { G.ui.toast('You don\'t need that right now.'); return true; } P.heal(def.med.hp); G.inv.removeAt(slot, 1); G.audio.sfx('bandage'); G.emit('healed', s.id); return true; }
      if (def.use === 'fill') {
        this.ray(); const wh = G.ocean.height(P.pos.x, P.pos.z); const near = P.swimming || (wh - P.pos.y > -1.6 && G.world.heightAt(P.pos.x + _d.x * 2, P.pos.z + _d.z * 2) < wh + 0.1 && _d.y < -0.15) || (P.parent && P.parent.kind === 'raft' && _d.y < -0.3);
        if (!near) { G.ui.toast('Stand at the water and look down to fill the flask. Fresh water comes from ponds and rain catchers.'); return true; }
        G.inv.removeAt(slot, 1); G.inv.add('bottle_sea', 1); G.audio.sfx('water'); return true;
      }
      if (def.use === 'repair') { const i = G.inv.slots.findIndex((x) => x && x.dur != null && x.dur < G.ITEMS[x.id].tool.dur && G.ITEMS[x.id].tool.dur < 9000); if (i < 0) { G.ui.toast('Nothing needs repair.'); return true; } G.inv.slots[i].dur = G.ITEMS[G.inv.slots[i].id].tool.dur; G.inv.removeAt(slot, 1); G.ui.toast(G.ITEMS[G.inv.slots[i].id].n + ' repaired.', 'good'); G.audio.sfx('craftdone'); return true; }
      if (def.use === 'treasure') { if (G.quests.startTreasure()) G.inv.removeAt(slot, 1); return true; }
      if (def.use === 'boat') { if (G.vehicles.deploy(def.boat)) G.inv.removeAt(slot, 1); return true; }
      return false;
    },

    update(dt) {
      const I = G.input, P = G.player, inv = G.inv; this.cd -= dt;
      // falling trees
      for (let i = this.falling.length - 1; i >= 0; i--) { const f = this.falling[i]; f.t += dt; const a = Math.min(1.5, f.t * f.t * 1.3); f.grp.rotation.set(Math.cos(f.ax) * a, f.grp.rotation.y, Math.sin(f.ax) * a); if (f.t > 1.6) { f.grp.scale.multiplyScalar(0.9); } if (f.t > 2.1) { G.scene.remove(f.grp); this.falling.splice(i, 1); } }
      if (this.shake > 0 && this.shakeNode) { this.shake -= dt; const { n, I: isl } = this.shakeNode; if (n.alive && isl.inst && isl.inst.meshes) { const arr = isl.inst.meshes[n.v]; if (arr) { const k = this.shake > 0 ? Math.sin(this.shake * 60) * 0.03 * this.shake * 4 : 0; _m.compose(_v.set(n.x, n.y, n.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(k, n.r, k)), new THREE.Vector3(n.s, n.s, n.s)); for (const im of arr) { im.setMatrixAt(n.ii, _m); im.instanceMatrix.needsUpdate = true; } } } }
      if (G.state !== 'play' || !P.alive) return;
      const ctl = I.locked && !G.ui.blocking();
      const held = inv.held(), def = held && G.ITEMS[held.id], tool = def && def.tool;
      this.setHand(held);
      // hand animation
      if (this.hand) {
        const pose = this.hand.userData.pose, h = this.hand, bob = Math.sin(P.bob) * 0.012;
        if (h.userData.ty === 'paddle') {
          // a real stroke: reach forward, catch (blade dips), pull back along the side, lift out, recover
          this.strokeT = Math.max(0, (this.strokeT || 0) - dt / 0.75); const p = 1 - this.strokeT, K = PADDLE_KEYS; let k = 0; while (k < K.length - 2 && K[k + 1][0] < p) k++;
          const a = K[k], c = K[k + 1], f = G.sstep(0, 1, (p - a[0]) / (c[0] - a[0])), lp = (i) => a[i] + (c[i] - a[i]) * f;
          h.position.set(pose[0][0] + lp(4), pose[0][1] + lp(2) + bob, pose[0][2] + lp(1)); h.rotation.set(pose[1][0] + lp(3), pose[1][1] + lp(5), pose[1][2]);
        } else {
          // start a swing when an action sets swingT; play that tool's keyframes; idle breathing and walking sway on top
          const kind = SWING_OF[h.userData.ty] || 'bash', S = SWING[kind];
          if (P.swingT >= 1) { this.swP = 0; P.swingT = 0.999; }
          if (this.hitHold > 0) this.hitHold -= dt; else if (this.swP != null) { this.swP += dt / S.dur; if (this.swP >= 1) this.swP = null; }   // brief hit-stop on impact
          P.swingT = Math.max(0, P.swingT - dt * 3.2);
          const v = this.swP != null ? keyAt(S.k, this.swP, _kv) : (_kv.fill(0), _kv), t = G.uni.uTime.value;
          const br = Math.sin(t * 1.3) * 0.006, sway = Math.sin(P.bob * 0.5) * 0.012, ch = this.charge > 0 ? this.charge : 0;
          h.position.set(pose[0][0] + v[0] + sway, pose[0][1] + v[1] + bob + br - ch * 0.08, pose[0][2] + v[2] + ch * 0.14);
          h.rotation.set(pose[1][0] + v[3] + ch * 0.55, pose[1][1] + v[4], pose[1][2] + v[5] + br * 0.6);
        }
        if (this.kick > 0) { G.camera.rotation.x += this.kick * Math.sin(this.kick / 0.035 * Math.PI); this.kick = Math.max(0, this.kick - dt * 0.35); }   // small jolt through the camera
        this.handRoot.visible = P.mode !== 'boat' && !G.build.active && !G.photo;
        if (this.flame) { const t = G.uni.uTime.value, out = P.headUnder; this.flame.visible = !out; let i = 0; for (const sp of this.flame.userData.parts) { const [s0, y0] = sp.userData.b, k = 0.85 + 0.2 * Math.sin(t * (13 + i * 3.1)) + 0.12 * Math.sin(t * (29 + i * 5.3)); sp.scale.set(s0 * (0.9 + 0.12 * Math.sin(t * 17 + i)), s0 * 1.7 * k, 1); sp.position.set(Math.sin(t * 9 + i) * 0.004, y0 + (k - 1) * s0 * 0.5, 0); i++; } }
      }
      this.torchLight.intensity = (tool && tool.type === 'torch' && !P.headUnder) ? (14 + Math.sin(G.uni.uTime.value * 12) * 2) * (1 - G.sky.dayLight * 0.8) : 0;
      if (tool && tool.type === 'torch') { this.torchT = (this.torchT || 0) + dt; if (this.torchT > 2) { this.torchT = 0; inv.wear(inv.sel, P.headUnder ? 200 : 2); } }
      const hl = G.lightPool.hand; if (P.lightOn && inv.count('flashlight') > 0) { hl.intensity = 220 * (1.15 - G.sky.dayLight * (P.headUnder ? 0.3 : 0.9)); G.camera.getWorldPosition(hl.position); G.camera.getWorldDirection(_v); hl.target.position.copy(hl.position).addScaledVector(_v, 10); } else hl.intensity = 0;
      P.zoom = false;
      if (!ctl || P.mode === 'helm' || P.mode === 'boat') { if (ctl && P.mode === 'boat') this.findTarget(); else { this.target = P.target = null; } this.charge = 0; return; }
      // hotbar
      for (let k = 1; k <= 9; k++) if (I.pressed['Digit' + k]) inv.sel = k - 1;
      if (I.wheel && !G.build.active) inv.sel = (inv.sel + (I.wheel > 0 ? 1 : 8)) % 9;
      if (I.hit('light')) { if (inv.count('flashlight') > 0) { P.lightOn = !P.lightOn; G.audio.sfx('click'); } else G.ui.toast('You have no dive light.'); }
      if (I.hit('drop') && held) { const all = I.keys.ShiftLeft; const n = all ? held.n : 1; G.drops.spawn(held.id, n, { dur: held.dur, made: held.made, air: held.air }); inv.removeAt(inv.sel, n); }
      if (G.build.active) return;
      const t = this.findTarget();
      if (I.hit('interact')) { if (G.fishing.active) G.fishing.cancel(); else this.interact(); }
      if (G.fishing.active) { G.fishing.input(I.mb[0], I.mpressed[0]); return; }
      // right click: use / consume, binocular zoom
      if (tool && tool.type === 'binoculars' && I.mb[2]) { P.zoom = true; G.map.scan(); }
      else if (I.mpressed[2] && held) this.consume(inv.sel);
      if (!held) { if (I.mpressed[0]) { if (t && t.key) this.interact(); else this.punch(); } return; }
      if (!tool) { if (I.mpressed[0]) { if (!this.consume(inv.sel)) { if (t && t.key) this.interact(); else this.punch(); } } return; }
      const ty = tool.type;
      if (ty === 'hook') {
        if (G.debris.hookOut) { if (I.mb[0]) G.debris.hold(); if (I.mpressed[2]) G.debris.reel(); }
        else if (I.mb[0]) this.charge = Math.min(1, this.charge + dt * 1.1); else if (this.charge > 0) { G.debris.throwHook(0.25 + this.charge * 0.75, tool.tier); this.charge = 0; P.swingT = 1; inv.wear(inv.sel, 1); }
      } else if (ty === 'rod') { if (I.mpressed[0]) G.fishing.cast(tool.tier); }
      else if (ty === 'paddle') {
        if (I.mb[0] && P.parent && P.parent.kind === 'raft' && this.cd <= 0 && P.stamina > 4) {
          const st = P.parent; this.cd = 0.75; P.swingT = 1; this.strokeT = 1; P.stamina -= 3.5; const fx2 = -Math.sin(P.yaw), fz2 = -Math.cos(P.yaw), pow = 1.9 / (1 + st.tiles.size * 0.05);
          st.paddle.x = G.clamp(st.paddle.x + fx2 * pow, -3.2, 3.2); st.paddle.y = G.clamp(st.paddle.y + fz2 * pow, -3.2, 3.2);
          G.audio.sfx('paddle'); G.skills.xp('sailing', 1); inv.wear(inv.sel, 1); fx.splash(P.pos.x + fx2 * -0.6, st.pos.y + 0.1, P.pos.z + fz2 * -0.6, 6); G.emit('paddle', st, fx2 * pow, fz2 * pow, P.pos.x + fx2 * -0.6, P.pos.z + fz2 * -0.6);
        } else if (I.mpressed[0] && !(P.parent && P.parent.kind === 'raft')) G.ui.toast('Paddle while standing on your raft.');
      } else if (ty === 'mallet') { if (I.mpressed[0] && this.cd <= 0) { this.cd = 0.5; P.swingT = 1; G.build.repair(); } }
      else if (ty === 'shovel') {
        if (I.mpressed[0] && this.cd <= 0) {
          this.cd = 0.8; P.swingT = 1; G.audio.sfx('dig'); if (G.quests.dig()) { inv.wear(inv.sel, 2); return; }
          const h = G.world.heightAt(P.pos.x, P.pos.z), isl = G.world.current; if (isl && h > 0.2 && h < 3.2 && !P.parent) { inv.add('sand', 1); inv.wear(inv.sel, 1); fx.burst(P.pos.x - Math.sin(P.yaw), h + 0.1, P.pos.z - Math.cos(P.yaw), [0.9, 0.8, 0.55, 1], 6, 1.6, 0.5); if (Math.random() < 0.06) inv.add('bait', 1); } else G.ui.toast('Nothing to dig here. Beaches give sand.');
        }
      } else if (ty === 'sonar') { if (I.mpressed[0] && this.cd <= 0) { this.cd = 5; G.map.ping(); } }
      else if (ty === 'bow') { if (I.mpressed[0] && this.cd <= 0) { if (inv.count('arrow') < 1) return G.ui.toast('No arrows.'); this.cd = 1.1; inv.remove('arrow', 1); P.swingT = 1; this.ray(); G.audio.sfx('bow'); if (!G.wildlife.strike(_o, _d, 48, tool.dmg, 'arrow')) { /* miss */ } inv.wear(inv.sel, 1); } }
      else if (ty === 'axe' || ty === 'pick' || ty === 'knife' || ty === 'spear') {
        if (I.mb[0] && this.cd <= 0 && P.stamina > 3) { this.cd = ty === 'spear' ? 0.7 : 0.55; P.swingT = 1; P.stamina -= 3; this.swingAt(tool, inv.sel); }
      } else if (ty === 'detector') { /* passive: handled by quests.detectorTick */ }
      else if (I.mpressed[0] && t && t.key) this.interact();
    }
  };
})();
