'use strict';
/* Wildlife: schooling fish, sharks (patrol / investigate / circle / attack / retreat), dolphins, turtles, rays,
   jellyfish, crabs, seabirds, boars, wreck eels and a deep-water giant. Spawned by context around the player. */
(function () {
  const G = window.G;
  const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _sc = new THREE.Vector3(), _c = new THREE.Color();
  G.CREATURES = {
    fish: { n: 'Reef fish', i: '🐠', d: 'Schools gather wherever there is coral or shade — including under your raft. A spear will take one.' },
    shark: { n: 'Grey reef shark', i: '🦈', d: 'Patrols deep water. It investigates before it commits: when the circles tighten, get out of the water. A hard strike drives it off.' },
    dolphin: { n: 'Spinner dolphin', i: '🐬', d: 'Curious and harmless. Pods ride alongside a raft under sail.' },
    turtle: { n: 'Green turtle', i: '🐢', d: 'Grazes on reef flats. Entirely unbothered by you.' },
    ray: { n: 'Lagoon ray', i: '🪽', d: 'Glides over sand in shallow lagoons.' },
    jelly: { n: 'Lantern jellyfish', i: '🪼', d: 'Drifts in open water. Its sting is venomous; a wetsuit stops it.' },
    crab: { n: 'Shore crab', i: '🦀', d: 'Scuttles along beaches. Quick, but catchable — and good eating.' },
    gull: { n: 'Storm petrel', i: '🕊️', d: 'Circles islands and follows rafts. Where they gather, land is near.' },
    boar: { n: 'Island boar', i: '🐗', d: 'Territorial. It warns once, then charges. Meat, hide and bone if you can bring it down.' },
    eel: { n: 'Green moray', i: '🐍', d: 'Lairs in sunken hulls and reef holes and bites anything that reaches in.' },
    barracuda: { n: 'Great barracuda', i: '🐟', d: 'Hangs motionless in open water, watching. Curious about swimmers and shiny things; it keeps its distance unless you corner it.' },
    grouper: { n: 'Goliath grouper', i: '🐟', d: 'A slow, enormous fish that guards reef ledges and wrecks. It booms when disturbed. A lot of meat.' },
    giant: { n: 'Humpback whale', i: '🐋', d: 'Thirteen metres of whale moving through the deep water. It does not seem to notice you. You are grateful.' }
  };
  // ---------- shark: lofted body, swept fins, painted skin, tail-beat in the vertex shader ----------
  let sharkGeoC = null, sharkSkinC = null;
  function sharkSkin() {
    if (sharkSkinC) return sharkSkinC;
    const W = 512, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
    const hs = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
    const vn = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); const a = hs(ix, iy), b = hs(ix + 1, iy), c = hs(ix, iy + 1), e = hs(ix + 1, iy + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + e) * fx * fy; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H, dd = Math.abs(v - 0.5) * 2;                       // u: snout -> tail, dd: 0 on the back .. 1 on the belly
      const edge = 0.5 + (vn(u * 11, 3.1) - 0.5) * 0.12 - Math.max(0, 0.1 - u) * 1.4;
      const k = G.sstep(edge - 0.06, edge + 0.08, dd);
      const mott = vn(u * 30, dd * 9) * 0.55 + vn(u * 90, dd * 30 + 7) * 0.3 + hs(x, y) * 0.15;
      const ridge = 1 - 0.18 * (1 - G.sstep(0, 0.14, dd)), bk = (0.78 + mott * 0.42) * ridge, bl = 0.93 + mott * 0.09;
      const r = G.lerp(0.155 * bk, 0.66 * bl, k), g = G.lerp(0.165 * bk, 0.67 * bl, k), b = G.lerp(0.175 * bk, 0.65 * bl, k), o = (y * W + x) * 4;
      d[o] = 255 * Math.pow(r, 1 / 2.2); d[o + 1] = 255 * Math.pow(g, 1 / 2.2); d[o + 2] = 255 * Math.pow(b, 1 / 2.2); d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0); ctx.lineCap = 'round';
    for (const sd of [0.265, 0.735]) {
      ctx.strokeStyle = 'rgba(14,17,20,0.8)'; ctx.lineWidth = 1.7;                   // gill slits
      for (let i = 0; i < 5; i++) { const x = (0.215 + i * 0.0135) * W, len = (0.06 - i * 0.004) * H; ctx.beginPath(); ctx.moveTo(x - 1.5, sd * H - len); ctx.quadraticCurveTo(x + 2, sd * H, x - 1.5, sd * H + len); ctx.stroke(); }
      const ey = (sd < 0.5 ? 0.3 : 0.7) * H; ctx.fillStyle = '#050607'; ctx.beginPath(); ctx.ellipse(0.078 * W, ey, 5, 9, 0, 0, 6.3); ctx.fill();   // eye
      ctx.strokeStyle = 'rgba(120,130,135,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0.078 * W, ey, 6, 10.5, 0, 0, 6.3); ctx.stroke();
      ctx.fillStyle = 'rgba(210,220,225,0.55)'; ctx.beginPath(); ctx.ellipse(0.076 * W, ey - 3, 1.2, 2, 0, 0, 6.3); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(30,18,20,0.9)'; ctx.lineWidth = 3;                        // mouth: a crescent under the snout, crossing the belly seam
    for (const m of [0, 1]) { ctx.beginPath(); for (let i = 0; i <= 12; i++) { const q = i / 12, v = q * 0.15, u = 0.095 + 0.055 * q * q, yy = (m ? 1 - v : v) * H; if (i) ctx.lineTo(u * W, yy); else ctx.moveTo(u * W, yy); } ctx.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.flipY = false; return (sharkSkinC = t);
  }
  function sharkGeo() {
    if (sharkGeoC) return sharkGeoC;
    const P = [], U = [], I = [];
    // body: elliptical sections along z (head at -z)
    const CT = [[0, 0.004, 0.004, -0.035], [0.02, 0.058, 0.04, -0.03], [0.06, 0.128, 0.086, -0.02], [0.12, 0.2, 0.152, 0], [0.22, 0.28, 0.262, 0.01], [0.34, 0.312, 0.318, 0.02], [0.46, 0.296, 0.31, 0.02], [0.58, 0.25, 0.265, 0.02], [0.7, 0.185, 0.2, 0.025], [0.82, 0.115, 0.135, 0.03], [0.92, 0.06, 0.085, 0.04], [1, 0.03, 0.06, 0.05]];
    const NS = 40, RS = 22, st = [];
    for (let i = 0; i <= NS; i++) { const t = Math.pow(i / NS, 1.25); let k = 0; while (k < CT.length - 2 && CT[k + 1][0] < t) k++; const a = CT[k], b = CT[k + 1], f = G.clamp((t - a[0]) / (b[0] - a[0]), 0, 1); st.push([t, G.lerp(a[1], b[1], f), G.lerp(a[2], b[2], f), G.lerp(a[3], b[3], f)]); }
    for (let pass = 0; pass < 3; pass++) for (let i = 1; i < NS; i++) for (let c = 1; c < 4; c++) st[i][c] = st[i][c] * 0.5 + (st[i - 1][c] + st[i + 1][c]) * 0.25;
    for (let i = 0; i <= NS; i++) { const [t, w, h, yc] = st[i], z = -1.55 + t * 2.85; for (let j = 0; j <= RS; j++) { const ph = j / RS * 6.2831853, cs = Math.cos(ph); P.push(-w * Math.sin(ph), yc - h * cs * (cs > 0 ? 0.86 : 1), z); U.push(t, j / RS); } }
    for (let i = 0; i < NS; i++) for (let j = 0; j < RS; j++) { const a = i * (RS + 1) + j, b = a + 1, c = a + RS + 1, e = c + 1; I.push(a, c, b, b, c, e); }
    const bodyVerts = P.length / 3;
    // fins: thin lens-section surfaces swept back from the root
    const fin = (bx, by, bz, sx, sy, sz, span, chord, sweep, thick, tipF, uOff) => {
      const sl = Math.hypot(sx, sy, sz); sx /= sl; sy /= sl; sz /= sl; let nx = sy * 1 - sz * 0, ny = sz * 0 - sx * 1, nz = 0; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;   // normal = span x chord(0,0,1)
      const A = 8, B = 8;
      for (const side of [1, -1]) {
        const base = P.length / 3;
        for (let r = 0; r <= B; r++) { const rr = r / B, ch = chord * (tipF + (1 - tipF) * Math.pow(1 - rr, 0.75)), off = sweep * span * Math.pow(rr, 1.2);
          for (let q = 0; q <= A; q++) { const ss = q / A, al = -chord * 0.5 + off + ss * ch, th = side * thick * (1 - rr * 0.9) * Math.sqrt(Math.max(0, 4 * ss * (1 - ss))) * (1 - ss * 0.35);
            P.push(bx + sx * rr * span + nx * th, by + sy * rr * span + ny * th, bz + sz * rr * span + al); U.push(uOff + ss * 0.07, 0.5 + rr * 0.05); } }
        for (let r = 0; r < B; r++) for (let q = 0; q < A; q++) { const a = base + r * (A + 1) + q, b = a + 1, c = a + A + 1, e = c + 1; if (side > 0) I.push(a, c, b, b, c, e); else I.push(a, b, c, b, e, c); }
      }
    };
    fin(0, 0.27, -0.28, 0, 1, 0.12, 0.52, 0.56, 0.78, 0.028, 0.14, 0.4);           // first dorsal
    fin(0, 0.14, 0.72, 0, 1, 0.2, 0.15, 0.17, 0.7, 0.012, 0.2, 0.62);              // second dorsal
    fin(0, -0.11, 0.8, 0, -1, 0.25, 0.13, 0.16, 0.7, 0.012, 0.2, 0.62);            // anal
    for (const sgn of [1, -1]) { fin(sgn * 0.24, -0.13, -0.6, sgn * 0.86, -0.36, 0.22, 0.66, 0.38, 0.62, 0.02, 0.16, 0.3); fin(sgn * 0.11, -0.17, 0.42, sgn * 0.62, -0.72, 0.2, 0.2, 0.2, 0.6, 0.012, 0.2, 0.55); }
    fin(0, 0.05, 1.3, 0, 0.74, 0.66, 0.92, 0.36, 0.2, 0.022, 0.2, 0.7);            // tail, upper lobe
    fin(0, 0.05, 1.3, 0, -0.8, 0.52, 0.5, 0.3, 0.25, 0.02, 0.2, 0.7);              // tail, lower lobe
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
    const n = g.attributes.normal; for (let i = 0; i <= NS; i++) { const a = i * (RS + 1), b = a + RS, x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1; n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l); }
    g.computeBoundingSphere(); g.boundingSphere.radius += 0.6; g.userData.shared = true; g.userData.bodyVerts = bodyVerts; return (sharkGeoC = g);
  }
  function sharkModel() {
    const m = new THREE.MeshStandardMaterial({ map: sharkSkin(), roughness: 0.36, metalness: 0 }), u = m.userData.u = { uSw: { value: 0 }, uAmp: { value: 1 } };
    m.onBeforeCompile = (sh) => { sh.uniforms.uSw = u.uSw; sh.uniforms.uAmp = u.uAmp; sh.vertexShader = 'uniform float uSw; uniform float uAmp;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float tw = smoothstep(-1.4, 2.1, position.z); transformed.x += (sin(position.z * 1.75 - uSw) * 0.36 * tw * tw - sin(uSw) * 0.045 * (1.0 - tw)) * uAmp;`); };
    const mesh = new THREE.Mesh(sharkGeo(), m); mesh.castShadow = true; mesh.receiveShadow = true; mesh.scale.setScalar(1.12); const g = new THREE.Group(); g.add(mesh); g.sharkU = u; return g;
  }
  // Herring gull, nose +z, wings along ±x (span ~1.4 m). aSpan carries the distance along the wing for the flap hinge.
  function birdGeo() {
    const b = new G.MB(), W = [0.97, 0.97, 0.96], GR = [0.6, 0.64, 0.68], BK = [0.07, 0.07, 0.08], Y = [1.0, 0.82, 0.25];
    b.sph(1, 0, 0, 0.02, 'creature', 0.085, 0.08, 0.27, W, 14); b.sph(1, 0, 0.045, 0.25, 'creature', 0.058, 0.06, 0.07, W, 12);
    { const g = new THREE.ConeGeometry(0.016, 0.075, 8); g.rotateX(Math.PI / 2); b.add(g, 'creature', b.mat4(0, 0.035, 0.345), Y); }
    { const g = new THREE.PlaneGeometry(0.16, 0.16, 2, 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const v = p.getY(i); p.setX(i, p.getX(i) * (0.55 + (0.5 - v / 0.16) * 0.6)); } g.rotateX(-Math.PI / 2); b.add(g, 'creature', b.mat4(0, 0.01, -0.3), W); }
    const geo = b.geos().creature; const n0 = geo.attributes.position.count;
    // wings: tapered, swept, grey above with black tips and a white trailing edge
    const pos = [], col = [], spn = [], idx = [], nrm = [], NS = 12, NC = 3;
    for (const face of [1, -1]) for (const sg of [-1, 1]) {   // upper surface grey, under surface white; both with black primaries
      const base = pos.length / 3;
      for (let i = 0; i <= NS; i++) {
        const t = i / NS, x = 0.06 + t * 0.6, chord = 0.25 * (1 - t * t * 0.8) + 0.015, sweep = -0.1 * t * t - 0.03 * t, lead = 0.07 + sweep;
        for (let j = 0; j <= NC; j++) {
          const u = j / NC, z = lead - u * chord, th = 0.012 * (1 - t) * Math.sin(Math.PI * Math.min(1, u * 1.3)); pos.push(sg * x, 0.02 - t * t * 0.02 + face * th, z); nrm.push(0, face, 0);
          let c = face > 0 ? GR : [0.93, 0.93, 0.92]; if (t > 0.78) c = (u < 0.25 && t > 0.9) ? W : (face > 0 ? BK : [0.22, 0.22, 0.23]); if (u > 0.82 && t < 0.78) c = W; col.push(c[0], c[1], c[2]); spn.push(x);
        }
      }
      const flip = (sg > 0) !== (face > 0);
      for (let i = 0; i < NS; i++) for (let j = 0; j < NC; j++) { const a0 = base + i * (NC + 1) + j, a1 = a0 + NC + 1; if (flip) idx.push(a0, a0 + 1, a1, a1, a0 + 1, a1 + 1); else idx.push(a0, a1, a0 + 1, a1, a1 + 1, a0 + 1); }
    }
    const P0 = geo.attributes.position.array, C0 = geo.attributes.color.array, N0 = geo.attributes.normal.array, U0 = geo.attributes.uv.array;
    const P = new Float32Array(P0.length + pos.length); P.set(P0); P.set(pos, P0.length);
    const C = new Float32Array(C0.length + col.length); C.set(C0); C.set(col, C0.length);
    const NN = new Float32Array(P.length); NN.set(N0); NN.set(nrm, N0.length);
    const UV = new Float32Array(P.length / 3 * 2); UV.set(U0);
    const SP = new Float32Array(P.length / 3); SP.set(spn, n0);
    const I0 = [...geo.index.array]; for (const k of idx) I0.push(k + n0);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(NN, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setAttribute('uv', new THREE.BufferAttribute(UV, 2)); g.setAttribute('aSpan', new THREE.BufferAttribute(SP, 1)); g.setIndex(I0);
    return g;
  }
  function birdMaterial() {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = 'attribute float aSpan; attribute vec2 aWing;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        if (aSpan > 0.0) {   // shoulder and wrist hinges about the body axis
          float sg = sign(transformed.x), d = abs(transformed.x), d0 = 0.06, d1 = 0.36, A = aWing.x, B = aWing.y, y0 = transformed.y;
          vec2 q = d <= d1 ? vec2(d0, 0.0) + (d - d0) * vec2(cos(A), sin(A)) : vec2(d0, 0.0) + (d1 - d0) * vec2(cos(A), sin(A)) + (d - d1) * vec2(cos(A + B), sin(A + B));
          transformed.x = sg * q.x; transformed.y = y0 + q.y;
        }`);
    };
    return m;
  }
  function boarModel() { const b = new G.MB(), c = [0.3, 0.22, 0.16]; b.sph(0.4, 0, 0.55, 0, 'creature', 0.75, 0.8, 1.6, c, 9); b.sph(0.22, 0, 0.58, -0.68, 'creature', 0.85, 0.9, 1.3, [0.26, 0.19, 0.14], 7); b.cyl(0.07, 0.09, 0.14, 0, 0.52, -0.95, 'creature', 6, Math.PI / 2, 0, 0, [0.5, 0.35, 0.3]); for (const [x, z] of [[-0.18, -0.4], [0.18, -0.4], [-0.18, 0.42], [0.18, 0.42]]) b.cyl(0.05, 0.04, 0.4, x, 0.2, z, 'creature', 5, 0, 0, 0, [0.2, 0.15, 0.1]); for (const s of [-1, 1]) b.cyl(0.0, 0.02, 0.12, s * 0.1, 0.5, -0.9, 'creature', 4, -0.5, 0, s * 0.5, [2, 2, 1.8]); return b.build(); }
  const CM = G.creatureModels;
  // reef fish species: atlas row, body plan, group size, size (m), cruising speed, how far they roam, how high they hover
  const REEF_TYPES = [
    { name: 'butterflyfish', sp: 6, plan: 'deep', n: [2, 2], size: [0.15, 0.2], speed: 0.45, range: 3, hover: 1.2, shy: 2.2, w: 4 },
    { name: 'blue tang', sp: 1, plan: 'deep', n: [3, 7], size: [0.2, 0.27], speed: 0.6, range: 5, hover: 1.6, shy: 2.5, w: 3 },
    { name: 'yellow tang', sp: 9, plan: 'deep', n: [3, 6], size: [0.16, 0.2], speed: 0.55, range: 4, hover: 1.3, shy: 2.5, w: 3 },
    { name: 'moorish idol', sp: 8, plan: 'idol', n: [1, 3], size: [0.18, 0.22], speed: 0.45, range: 4, hover: 1.4, shy: 2.2, w: 2 },
    { name: 'parrotfish', sp: 4, plan: 'parrot', n: [1, 3], size: [0.4, 0.6], speed: 0.5, range: 6, hover: 0.9, shy: 3, graze: true, w: 3 },
    { name: 'chromis', sp: 7, plan: 'damsel', n: [12, 28], size: [0.08, 0.11], speed: 0.35, range: 1.6, hover: 1.4, shy: 1.4, w: 4 },
    { name: 'sergeant major', sp: 2, plan: 'damsel', n: [5, 12], size: [0.14, 0.18], speed: 0.5, range: 3, hover: 1.8, shy: 1.8, w: 3 },
    { name: 'grunts', sp: 5, plan: 'fusi', n: [6, 12], size: [0.22, 0.28], speed: 0.4, range: 2.5, hover: 1.0, shy: 2.2, w: 2 }];
  G.REEF_TYPES = REEF_TYPES;
  const MODELS = { shark: sharkModel, dolphin: CM.dolphin, turtle: CM.turtle, ray: CM.ray, jelly: CM.jelly, crab: CM.crab, boar: boarModel, eel: CM.eel, giant: CM.giant, barracuda: CM.barracuda, grouper: CM.grouper };

  const W = G.wildlife = {
    list: [], schools: [], threat: 0, sharkCd: 40, dolphinCd: 150, t: 0, eels: [],
    init() {
      const fg = G.fishGeo().clone(); this.fishSp = new THREE.InstancedBufferAttribute(new Float32Array(600), 1); this.fishPh = new THREE.InstancedBufferAttribute(new Float32Array(600), 1); fg.setAttribute('aSp', this.fishSp); fg.setAttribute('aPh', this.fishPh);
      this.fishMesh = new THREE.InstancedMesh(fg, G.fishMaterial(), 600); this.fishMesh.frustumCulled = false; this.fishMesh.count = 0; this.fishMesh.castShadow = true; G.scene.add(this.fishMesh);
      // reef fish: one instanced mesh per body plan, all on the shared atlas material
      this.reefMeshes = {}; const gs = G.fishGeos();
      for (const k of ['fusi', 'deep', 'idol', 'parrot', 'damsel']) { const g = gs[k].clone(), sp = new THREE.InstancedBufferAttribute(new Float32Array(400), 1), ph = new THREE.InstancedBufferAttribute(new Float32Array(400), 1); g.setAttribute('aSp', sp); g.setAttribute('aPh', ph); const m = new THREE.InstancedMesh(g, G.fishMaterial(), 400); m.frustumCulled = false; m.count = 0; m.castShadow = true; G.scene.add(m); this.reefMeshes[k] = { m, sp, ph }; }
      this.reefGroups = [];
      const bg = birdGeo(); this.birdWing = new THREE.InstancedBufferAttribute(new Float32Array(14 * 2), 2); bg.setAttribute('aWing', this.birdWing); this.birdMesh = new THREE.InstancedMesh(bg, birdMaterial(), 14); this.birdMesh.castShadow = true; this.birdMesh.frustumCulled = false; G.scene.add(this.birdMesh);
    },
    add(type, x, y, z, extra) { const mesh = MODELS[type](); G.scene.add(mesh); const c = Object.assign({ type, x, y, z, yaw: Math.random() * 6.28, pitch: 0, speed: 0, hp: 30, state: 'idle', t: 0, mesh, r: 0.6, age: 0 }, extra); this.list.push(c); return c; },
    remove(c) { G.disposeGroup(c.mesh); if (c.io) G.interact.remove(c.io); const i = this.list.indexOf(c); if (i >= 0) this.list.splice(i, 1); },
    clear() { for (const c of [...this.list]) this.remove(c); this.schools = []; this.fishMesh.count = 0; this.reefGroups = []; for (const k in this.reefMeshes) this.reefMeshes[k].m.count = 0; this.threat = 0; this.sharkCd = 40; this.eels = []; },
    count(type) { let n = 0; for (const c of this.list) if (c.type === type) n++; return n; },
    steer(c, tx, ty, tz, dt, turn) {
      const dx = tx - c.x, dz = tz - c.z; const want = Math.atan2(-dx, -dz); c.yaw += G.clamp(G.angDiff(c.yaw, want), -turn * dt, turn * dt);
      c.x += -Math.sin(c.yaw) * c.speed * dt; c.z += -Math.cos(c.yaw) * c.speed * dt; if (ty != null) c.y = G.damp(c.y, ty, 1.2, dt);
    },
    place(c, roll) { c.mesh.position.set(c.x, c.y, c.z); c.mesh.rotation.set(c.pitch || 0, c.yaw, roll || 0, 'YXZ'); },
    see(c, range) { const P = G.player; if (!c.seen && Math.hypot(c.x - P.pos.x, c.z - P.pos.z, c.y - P.pos.y) < range) { c.seen = true; G.journal.seeCreature(c.type); } },

    update(dt) {
      const P = G.player, O = G.ocean, Wd = G.world; this.t += dt; const px = P.pos.x, pz = P.pos.z;
      const floorH = Wd.height(px, pz), depth = -floorH, inWater = P.swimming, D = G.DIFF[G.game.difficulty];
      this.updateSchools(dt, px, pz); this.updateReefFish(dt, px, pz); this.updateBirds(dt);
      // --- spawning by context (checked twice a second) ---
      this.spT = (this.spT || 0) - dt;
      if (this.spT <= 0) {
        this.spT = 0.5;
        this.sharkCd -= 0.5; if (depth > 7 && (inWater || (P.parent && P.parent.kind === 'raft') || P.mode === 'boat')) this.threat += 0.5 * (inWater ? 1.6 : 0.5) * D.predator; else this.threat = Math.max(0, this.threat - 1);
        if (this.threat > 55 && this.sharkCd <= 0 && this.count('shark') < (G.game.difficulty === 'hardcore' ? 2 : 1)) { const a = Math.random() * 6.28; this.add('shark', px + Math.cos(a) * 55, -3, pz + Math.sin(a) * 55, { state: 'patrol', hp: 60, r: 1.0, speed: 2.4, ca: a, life: 0, hits: 0 }); this.threat = 0; this.sharkCd = 240 / D.predator; }
        this.dolphinCd -= 0.5; const raft = G.structs.raft; const fast = (raft && P.parent === raft && raft.speed > 2.4) || (P.mode === 'boat' && Math.abs(G.vehicles.current.speed) > 4);
        if (fast && depth > 14 && this.dolphinCd <= 0 && G.weather.storm < 0.4) { this.dolphinCd = 260 + Math.random() * 200; for (let i = 0; i < 3; i++) this.add('dolphin', px + 20 + i * 3, -1, pz + 18 + i * 4, { state: 'escort', off: i * 2.1, life: 45, speed: 6 }); }
        if ((P.headUnder || inWater || (P.parent && P.parent.kind === 'raft')) && depth > 8 && this.count('barracuda') < 1 && Math.random() < 0.02) { const a = Math.random() * 6.28; this.add('barracuda', px + Math.cos(a) * 26, -2 - Math.random() * 3, pz + Math.sin(a) * 26, { state: 'watch', speed: 0.5, life: 160, r: 0.5, hp: 20 }); }
        if (P.headUnder && depth > 6 && depth < 40 && this.count('grouper') < 1 && Math.random() < 0.03) { const a = Math.random() * 6.28, x = px + Math.cos(a) * 18, z = pz + Math.sin(a) * 18; this.add('grouper', x, Wd.height(x, z) + 1.2, z, { speed: 0.4, hx: x, hz: z, life: 200, r: 0.7, hp: 40 }); }
        if (P.headUnder && depth < 26 && depth > 3 && this.count('turtle') < 1 && Math.random() < 0.05) { const a = Math.random() * 6.28; this.add('turtle', px + Math.cos(a) * 22, floorH + 2 + Math.random() * 3, pz + Math.sin(a) * 22, { speed: 0.8, tx: px, tz: pz, life: 120 }); }
        if (depth < 9 && depth > 1.5 && this.count('ray') < 1 && Math.random() < 0.035) { const a = Math.random() * 6.28; this.add('ray', px + Math.cos(a) * 20, floorH + 0.5, pz + Math.sin(a) * 20, { speed: 1.1, tx: px, tz: pz, life: 120 }); }
        if (depth > 14 && this.count('jelly') < 5 && Math.random() < 0.06 && (P.headUnder || inWater)) { const a = Math.random() * 6.28; for (let i = 0; i < 5; i++) this.add('jelly', px + Math.cos(a) * 16 + (Math.random() - 0.5) * 9, -2 - Math.random() * 8, pz + Math.sin(a) * 16 + (Math.random() - 0.5) * 9, { life: 150, r: 0.45, ph: Math.random() * 6 }); }
        if (P.headUnder && P.depth > 52 && this.count('giant') < 1 && Math.random() < 0.06) { const a = Math.random() * 6.28; this.add('giant', px + Math.cos(a) * 85, -P.depth - 14, pz + Math.sin(a) * 85, { speed: 3.2, ca: a, life: 90, r: 6 }); G.audio.sfx('whale'); }
        const I = Wd.current;
        if (I && I.inst && I.inst.hiLoaded) {
          if (this.count('crab') < 5 && Math.random() < 0.4) { const a = Math.random() * 6.28, d = 10 + Math.random() * 16, x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d, h = Wd.heightAt(x, z); if (h > 0.15 && h < 1.6) this.addCrab(x, h, z); }
          if ((I.biome === 'jungle' || (I.biome === 'tropical' && I.r > 105)) && this.count('boar') < 2 && Math.random() < 0.12) { const a = Math.random() * 6.28, d = 28 + Math.random() * 18, x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d, h = Wd.heightAt(x, z); if (h > 3.5 && Wd.slopeAt(x, z) < 0.5) this.add('boar', x, h, z, { hp: 45, r: 0.75, state: 'wander', hx: x, hz: z }); }
        }
      }
      // --- behaviours ---
      for (let i = this.list.length - 1; i >= 0; i--) {
        const c = this.list[i]; c.age += dt; c.t -= dt; const dist = Math.hypot(c.x - px, c.z - pz);
        if (!c.keep && ((c.life && c.age > c.life && dist > 30) || dist > 190)) { this.remove(c); continue; }
        this[c.type](c, dt, P, dist, depth, inWater);
        const an = c.mesh.anim; if (an && c.type !== 'shark') { an.uSw.value += dt * (c.type === 'jelly' ? 1.6 : 2.2 + (c.speed || 0) * 1.7); an.uAmp.value = c.type === 'jelly' ? 1 : G.clamp(0.45 + (c.speed || 0) * 0.18, 0.4, 1.3); }
        if (c.type === 'turtle' && c.mesh.flip) { c.fp = (c.fp || 0) + dt * (1.2 + c.speed); for (const f of c.mesh.flip) f.pv.rotation.z = f.s * (f.front ? Math.sin(c.fp) * 0.55 : Math.sin(c.fp + 1.5) * 0.25); }
      }
    },

    // one swimming step: speed and heading change smoothly, the body banks into turns and pitches with its climb
    swim(c, tx, ty, tz, sp, turn, dt) {
      c.speed = G.damp(c.speed, sp, sp > c.speed ? 2.2 : 1.2, dt);
      const dy = G.clamp(G.angDiff(c.yaw, Math.atan2(-(tx - c.x), -(tz - c.z))), -turn * dt, turn * dt); c.yaw += dy; c.turn = G.damp(c.turn || 0, dy / Math.max(dt, 1e-4), 3.5, dt);
      c.x += -Math.sin(c.yaw) * c.speed * dt; c.z += -Math.cos(c.yaw) * c.speed * dt; const oy = c.y; c.y = G.damp(c.y, ty, 0.9, dt);
      c.pitch = G.damp(c.pitch || 0, G.clamp((c.y - oy) / Math.max(dt, 1e-4) / Math.max(c.speed, 1.5), -0.45, 0.45), 3, dt); c.sw += dt * (2.4 + c.speed * 1.55);
    },
    raftEdge(st) { // a ground-level deck tile with open water beside it: [tile, key, world x, world z]
      const T = G.structs.T, out = [];
      for (const [k, t] of st.tiles) { if (!k.endsWith(',0') || t.type === 'foundation_metal') continue; const [ix, iz] = k.split(',').map(Number); for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!st.tiles.has(st.key(ix + ox, iz + oz, 0))) out.push([t, k, ix * T + ox * T * 0.95, iz * T + oz * T * 0.95, ix * T, iz * T]); }
      return out.length ? out[Math.floor(Math.random() * out.length)] : null;
    },
    shark(c, dt, P, dist, depth, inWater) {
      const O = G.ocean, wh = O.height(c.x, c.z), fl = G.world.height(c.x, c.z), D = G.DIFF[G.game.difficulty], raft = G.structs.raft; this.see(c, 22);
      if (c.sw == null) { c.sw = Math.random() * 6; c.seed = Math.random() * 100; c.dir = Math.random() < 0.5 ? 1 : -1; c.raftCd = (70 + Math.random() * 60) / D.predator; c.pitch = 0; c.turn = 0; }
      if (fl > -3.2 && c.state !== 'retreat') { c.state = 'retreat'; c.t = 8; }
      const py = P.pos.y + 0.8, onRaft = raft && P.parent === raft, calm = G.game.difficulty === 'relaxed';
      // what it orbits: the swimmer, or the raft the player is standing on
      const cx = onRaft ? raft.pos.x : P.pos.x, cz = onRaft ? raft.pos.z : P.pos.z, cd = Math.hypot(c.x - cx, c.z - cz), tt = this.t + c.seed;
      if (c.state === 'patrol') {
        // shadowing: a loose, wandering orbit near the surface, now and then a slow pass right under the raft
        const pass = (tt % 47) < 7, or = pass ? 1.5 : 14 + Math.sin(tt * 0.071) * 6 + Math.sin(tt * 0.19) * 2.5;
        if (Math.sin(tt * 0.023) > 0.985) c.dir = -c.dir;
        const ang = Math.atan2(c.z - cz, c.x - cx) + c.dir * G.clamp(4.5 / Math.max(cd, 3), 0.25, 0.9);
        this.swim(c, cx + Math.cos(ang) * or, wh - (pass ? 2.6 : 0.5 + (0.5 + 0.5 * Math.sin(tt * 0.13)) * 2.2), cz + Math.sin(ang) * or, 2.3 + Math.sin(tt * 0.3) * 0.5, 0.75, dt);
        if (inWater && c.age > 3) { c.state = 'investigate'; c.t = (calm ? 12 : 5) + Math.random() * 3; G.audio.sfx('tension'); }
        else if (onRaft && !calm && depth > 6) { c.raftCd -= dt; if (c.raftCd <= 0) { const e = this.raftEdge(raft); if (e) { c.state = 'raft'; c.t = 30; c.ph = 0; c.edge = e; } else c.raftCd = 60; } }
      } else if (c.state === 'investigate') {
        // comes straight in for a close look and brushes past
        const sx = -Math.cos(c.yaw) * 1.6, sz = Math.sin(c.yaw) * 1.6; this.swim(c, P.pos.x + sx * c.dir, Math.min(wh - 0.9, py), P.pos.z + sz * c.dir, 3.8, 1.3, dt);
        if (dist < 2.4 && !c.brushed) { c.brushed = true; G.ui.toast('Something big brushes past you.', 'bad'); G.audio.sfx('heartbeat'); }
        if (!inWater) { c.state = 'patrol'; c.brushed = false; } else if (c.t <= 0) { c.state = 'circle'; c.t = (calm ? 9 : 4) + Math.random() * 2.5; c.brushed = false; G.ui.toast('The shark is circling you. Get out of the water!', 'bad'); G.audio.sfx('heartbeat'); }
      } else if (c.state === 'circle') {
        const or = 4.6 + Math.max(0, c.t) * 0.45, ang = Math.atan2(c.z - P.pos.z, c.x - P.pos.x) + c.dir * 0.75;
        this.swim(c, P.pos.x + Math.cos(ang) * or, py - 0.2, P.pos.z + Math.sin(ang) * or, 4.6, 1.9, dt);
        if (!inWater) c.state = 'patrol'; else if (c.t <= 0 && dist > 3.5) { c.state = 'attack'; c.t = 5; }
      } else if (c.state === 'attack') {
        this.swim(c, P.pos.x, py, P.pos.z, 9.5, 2.8, dt);
        if (!inWater) { c.state = 'retreat'; c.t = 4; }
        else if (dist < 1.7 && Math.abs(c.y - py) < 1.6) { P.damage(22, 'a shark'); P.afflict('bleeding', 50); G.audio.sfx('bite2'); G.fx.burst(P.pos.x, py, P.pos.z, [0.6, 0.05, 0.05, 0.7], 14, 1.2, 1.4, -0.2, 0.25); P.vel.x += -Math.sin(c.yaw) * 3; P.vel.z += -Math.cos(c.yaw) * 3; c.state = 'retreat'; c.t = 6 + Math.random() * 3; c.again = true; }
        else if (c.t <= 0) { c.state = 'retreat'; c.t = 5; c.again = true; }
      } else if (c.state === 'raft') {
        const e = c.edge, st = raft;
        if (!st || !st.tiles.has(e[1]) || !onRaft && !inWater && dist > 60) { c.state = 'patrol'; c.raftCd = 60; }
        else if (c.ph === 0) {
          st.toWorld(e[2], 0, e[3], _v); this.swim(c, _v.x, wh - 0.45, _v.z, 6.5, 1.8, dt);
          if (Math.hypot(c.x - _v.x, c.z - _v.z) < 1.5) { c.ph = 1; c.t = 9; c.biteT = 0; G.ui.toast('The shark is tearing at the raft. Drive it off!', 'bad'); G.audio.sfx('bite2'); }
          else if (c.t <= 0) { c.state = 'patrol'; c.raftCd = 40; }
        } else {
          // latched on: head against the deck edge, thrashing, wearing the plank down until struck or satisfied
          st.toWorld(e[2], 0, e[3], _v); st.toWorld(e[4], 0, e[5], _p); c.x = G.damp(c.x, _v.x, 6, dt); c.z = G.damp(c.z, _v.z, 6, dt); c.y = G.damp(c.y, wh - 0.3, 4, dt); c.speed = 0.5;
          c.yaw = Math.atan2(-(_p.x - c.x), -(_p.z - c.z)) + Math.sin(this.t * 13) * 0.3; c.pitch = 0.22 + Math.sin(this.t * 9) * 0.08; c.turn = Math.sin(this.t * 13) * 2.5; c.sw += dt * 14;
          if (Math.random() < dt * 14) G.fx.splash(c.x + (Math.random() - 0.5), wh, c.z + (Math.random() - 0.5), 3);
          c.biteT -= dt; if (c.biteT <= 0) { c.biteT = 0.7; const t = e[0]; t.hp = Math.max(4, t.hp - (t.type === 'foundation_reinf' ? 2 : 6)); st.dirty = true; G.audio.sfx(Math.random() < 0.5 ? 'creak' : 'bite2'); if (onRaft) G.render.damage = Math.min(0.25, G.render.damage + 0.05); }
          if (c.t <= 0 || e[0].hp <= 4) { c.state = 'retreat'; c.t = 9; c.raftCd = (110 + Math.random() * 90) / D.predator; }
        }
      } else {
        const a = Math.atan2(c.z - P.pos.z, c.x - P.pos.x); this.swim(c, c.x + Math.cos(a) * 30, wh - 3.5, c.z + Math.sin(a) * 30, 5.5, 1.5, dt);
        if (c.raftCd < 30) c.raftCd = (110 + Math.random() * 90) / D.predator;
        if (c.t <= 0) { if (c.hits >= 3 || (c.life && c.age > c.life)) { c.life = 1; c.age = 2; c.state = 'retreat'; c.t = 60; } else if (c.again && inWater) { c.state = 'circle'; c.t = (calm ? 8 : 3.5) + Math.random() * 2; } else c.state = 'patrol'; c.again = false; }
      }
      // stay in the water column, and below the hull when passing under the raft
      let top = wh - 0.32; if (raft && c.state !== 'raft' && Math.hypot(c.x - raft.pos.x, c.z - raft.pos.z) < raft.radius + 0.8) top = wh - 1.25;
      if (c.y > top) c.y = top; if (c.y < fl + 0.8) c.y = fl + 0.8;
      if (c.y > wh - 0.75 && c.speed > 1.6 && Math.random() < dt * 9) G.fx.splash(c.x + Math.sin(c.yaw) * 0.3, wh, c.z + Math.cos(c.yaw) * 0.3, 1);   // the fin cuts the surface
      this.place(c, G.clamp(-c.turn * 0.22, -0.5, 0.5)); const u = c.mesh.sharkU; if (u) { u.uSw.value = c.sw; u.uAmp.value = G.clamp(0.55 + c.speed * 0.07, 0.55, 1.25); }
    },
    dolphin(c, dt, P) {
      const raft = G.vehicles.current || G.structs.raft; const fx = raft ? -Math.sin(raft.yaw) : 0, fz = raft ? -Math.cos(raft.yaw) : -1; this.see(c, 30);
      const side = c.off % 2 > 1 ? 1 : -1; c.speed = 7.5; this.steer(c, P.pos.x + fx * (10 + c.off * 2) + fz * side * (7 + c.off), null, P.pos.z + fz * (10 + c.off * 2) - fx * side * (7 + c.off), dt, 1.6);
      const ph = (this.t * 0.55 + c.off) % 3.2; const wh = G.ocean.height(c.x, c.z); const jump = ph < 1 ? Math.sin(ph * Math.PI) : 0; c.y = wh - 0.9 + jump * 2.6; c.pitch = ph < 1 ? Math.cos(ph * Math.PI) * 0.9 : 0;
      if (ph < 0.05 && !c.spl) { c.spl = true; G.fx.splash(c.x, wh, c.z, 8); } else if (ph > 0.9 && ph < 1 && c.spl) { c.spl = false; G.fx.splash(c.x, wh, c.z, 12); if (Math.random() < 0.3) G.audio.sfx('dolphin'); }
      this.place(c);
    },
    turtle(c, dt) { this.see(c, 14); if (c.t <= 0) { c.t = 8 + Math.random() * 8; c.tx = c.x + (Math.random() - 0.5) * 40; c.tz = c.z + (Math.random() - 0.5) * 40; c.ty = Math.max(G.world.height(c.tx, c.tz) + 1.5, -18) + Math.random() * 3; } this.steer(c, c.tx, Math.min(c.ty, G.ocean.height(c.x, c.z) - 0.6), c.tz, dt, 0.5); this.place(c, Math.sin(this.t * 1.5) * 0.08); },
    ray(c, dt) { this.see(c, 12); if (c.t <= 0) { c.t = 6 + Math.random() * 6; c.tx = c.x + (Math.random() - 0.5) * 30; c.tz = c.z + (Math.random() - 0.5) * 30; } const fl = G.world.height(c.x, c.z); if (fl > -1.2) { c.t = 0; } this.steer(c, c.tx, Math.min(fl + 0.45, -0.8), c.tz, dt, 0.8); this.place(c, Math.sin(this.t * 2) * 0.1); c.mesh.scale.y = 1 + Math.sin(this.t * 3) * 0.3; },
    jelly(c, dt, P, dist) {
      if (c.ph == null) c.ph = Math.random() * 6; this.see(c, 9); c.y += Math.sin(this.t * 0.8 + c.ph) * dt * 0.25; c.x += Math.sin(this.t * 0.1 + c.ph) * dt * 0.1; c.mesh.position.set(c.x, c.y, c.z); const s = 1 + Math.sin(this.t * 2 + c.ph) * 0.12; c.mesh.scale.set(s, 2 - s, s);
      if (dist < 0.9 && Math.abs(c.y - (P.pos.y + 0.9)) < 1.1 && c.t <= 0) { c.t = 4; if (G.inv.equip.body && G.inv.equip.body.id === 'wetsuit') G.ui.toast('The jellyfish brushes harmlessly against your wetsuit.'); else { P.damage(6, 'a jellyfish'); P.afflict('poison', 22); } }
    },
    addCrab(x, y, z) { return this.add('crab', x, y, z, { r: 0.35, hp: 4, state: 'idle', speed: 0, gait: 0 }); },
    // a crab has to be killed (spear, knife, club or a stamp of the foot) before it can be picked up
    killCrab(c) {
      if (c.dead) return; c.dead = true; c.hp = 0; c.vx = c.vz = 0; c.deadT = 0; G.audio.sfx('break');
      c.io = G.interact.add({ x: c.x, y: c.y + 0.1, z: c.z, r: 0.5, reach: 2.4, tag: 'crab', label: 'Take dead crab', use: () => { G.inv.add('raw_crab', 1); G.audio.sfx('pickup'); G.skills.xp('survival', 4); G.emit('crab'); this.remove(c); } });
    },
    crab(c, dt, P, dist) {
      this.see(c, 6);
      if (c.dead) { c.deadT += dt; c.mesh.rotation.set(Math.PI, c.yaw, 0); c.mesh.position.set(c.x, c.y + 0.11, c.z); G.crabPose(c.mesh, 0, false, true); if (c.deadT > 400) this.remove(c); return; }
      const sneak = P.crouch ? 1.6 : 4.2;
      if (dist < sneak) { const a = Math.atan2(c.z - P.pos.z, c.x - P.pos.x) + Math.sin(this.t * 3) * 0.6; c.vx = Math.cos(a) * 2.4; c.vz = Math.sin(a) * 2.4; } else if (c.t <= 0) { c.t = 1 + Math.random() * 3; const a = Math.random() * 6.28, s = Math.random() < 0.5 ? 0 : 0.6; c.vx = Math.cos(a) * s; c.vz = Math.sin(a) * s; }
      const nx = c.x + (c.vx || 0) * dt, nz = c.z + (c.vz || 0) * dt, h = G.world.heightAt(nx, nz); if (h > -0.2 && h < 2.6) { c.x = nx; c.z = nz; c.y = h; } else { c.vx = -(c.vx || 0); c.vz = -(c.vz || 0); }
      // crabs walk sideways: the body faces across its direction of travel
      const sp = Math.hypot(c.vx || 0, c.vz || 0); if (sp > 0.05) c.yaw = G.damp(c.yaw, Math.atan2(-(c.vz || 0), c.vx || 0.001) + Math.PI / 2, 6, dt);
      c.gait += dt * sp * 9; this.place(c); G.crabPose(c.mesh, c.gait, sp > 0.05, false);
    },
    boar(c, dt, P, dist) {
      this.see(c, 16); const calm = G.game.difficulty === 'relaxed';
      if (c.state === 'wander') { if (c.t <= 0) { c.t = 3 + Math.random() * 5; c.tx = c.hx + (Math.random() - 0.5) * 30; c.tz = c.hz + (Math.random() - 0.5) * 30; c.speed = Math.random() < 0.35 ? 0 : 1.2; } if (dist < 9 && !P.swimming) { c.state = calm || c.hp < 18 ? 'flee' : 'alert'; c.t = calm ? 6 : 1.6; if (!calm) G.audio.sfx('boar'); } }
      else if (c.state === 'alert') { c.speed = 0; c.tx = P.pos.x; c.tz = P.pos.z; if (c.t <= 0) { c.state = dist < 14 ? 'charge' : 'wander'; c.t = 3.2; } }
      else if (c.state === 'charge') { c.speed = 7.8; c.tx = P.pos.x; c.tz = P.pos.z; if (dist < 1.4 && Math.abs(c.y - P.pos.y) < 1.5) { P.damage(14, 'a boar'); if (Math.random() < 0.3) P.afflict('bleeding', 30); P.vel.x += -Math.sin(c.yaw) * 7; P.vel.z += -Math.cos(c.yaw) * 7; P.vel.y = 3.5; P.onGround = false; c.state = 'flee'; c.t = 4; } else if (c.t <= 0 || P.swimming) { c.state = 'wander'; c.t = 2; } }
      else { c.speed = 6; const a = Math.atan2(c.z - P.pos.z, c.x - P.pos.x); c.tx = c.x + Math.cos(a) * 20; c.tz = c.z + Math.sin(a) * 20; if (c.t <= 0) { c.state = 'wander'; c.hx = c.x; c.hz = c.z; } }
      const ox = c.x, oz = c.z; this.steer(c, c.tx, null, c.tz, dt, c.state === 'charge' ? 2.2 : 3.5); const h = G.world.heightAt(c.x, c.z); if (h < 1.2 || G.world.slopeAt(c.x, c.z) > 1.1) { c.x = ox; c.z = oz; c.t = 0; if (c.state === 'flee') c.state = 'wander'; } else c.y = h;
      _p.set(c.x, c.y, c.z); G.world.collideNodes(_p, 0.4, c.y); c.x = _p.x; c.z = _p.z; this.place(c); c.mesh.position.y += c.speed > 0.5 ? Math.abs(Math.sin(this.t * 12)) * 0.07 : 0;
    },
    eel(c, dt, P, dist) {
      this.see(c, 6); const dy = Math.abs(c.y - (P.pos.y + 0.8)); const near = dist < 3.4 && dy < 2.2;
      c.out = G.damp(c.out || 0, near ? 1 : 0.15, 3, dt); c.yaw = Math.atan2(-(P.pos.x - c.hx), -(P.pos.z - c.hz));
      c.x = c.hx - Math.sin(c.yaw) * c.out * 1.2; c.z = c.hz - Math.cos(c.yaw) * c.out * 1.2; this.place(c, Math.sin(this.t * 6) * 0.1);
      if (near && dist < 2.0 && c.t <= 0) { c.t = 5; P.damage(12, 'a wreck eel'); P.afflict('bleeding', 35); G.audio.sfx('bite2'); G.ui.toast('Something in the wreck bites you!', 'bad'); }
    },
    // hangs in the water facing the swimmer at a fixed distance, drifts off when approached, darts away when struck
    barracuda(c, dt, P, dist) {
      this.see(c, 18); const wh = G.ocean.height(c.x, c.z), fl = G.world.height(c.x, c.z), py = P.pos.y + 0.6;
      const want = c.t > 0 ? 30 : 7 + Math.sin(this.t * 0.2 + c.age) * 1.5, a = Math.atan2(c.z - P.pos.z, c.x - P.pos.x) + 0.25 * Math.sin(this.t * 0.07);
      const tx = P.pos.x + Math.cos(a) * want, tz = P.pos.z + Math.sin(a) * want, gap = Math.hypot(tx - c.x, tz - c.z);
      c.speed = G.damp(c.speed, c.t > 0 ? 6 : G.clamp(gap * 0.4, 0, 2.2), 1.5, dt);
      if (gap > 0.6 || c.t > 0) { const yaw = Math.atan2(-(tx - c.x), -(tz - c.z)); c.yaw += G.clamp(G.angDiff(c.yaw, yaw), -dt * 1.6, dt * 1.6); c.x += -Math.sin(c.yaw) * c.speed * dt; c.z += -Math.cos(c.yaw) * c.speed * dt; }
      else c.yaw += G.clamp(G.angDiff(c.yaw, Math.atan2(-(P.pos.x - c.x), -(P.pos.z - c.z))), -dt * 0.8, dt * 0.8);
      c.y = G.damp(c.y, G.clamp(py, fl + 1, wh - 0.8), 0.6, dt); this.place(c, 0);
    },
    // a big grouper patrols a small home range near the bottom and turns to face divers
    grouper(c, dt, P, dist) {
      this.see(c, 14); const fl = G.world.height(c.x, c.z);
      if (c.t <= 0) { c.t = 4 + Math.random() * 6; const a = Math.random() * 6.28; c.tx = c.hx + Math.cos(a) * 6; c.tz = c.hz + Math.sin(a) * 6; if (dist < 6 && Math.random() < 0.3) G.audio.sfx('thud'); }
      c.speed = dist < 3 ? 1.2 : 0.45; this.steer(c, c.tx, Math.max(fl + 0.9, Math.min(c.y, G.ocean.height(c.x, c.z) - 1.5)), c.tz, dt, 0.5); this.place(c, Math.sin(this.t * 0.8) * 0.04);
    },
    giant(c, dt, P) { this.see(c, 75); c.ca += dt * 0.035; this.steer(c, P.pos.x + Math.cos(c.ca) * 60, -P.depth - 10, P.pos.z + Math.sin(c.ca) * 60, dt, 0.25); c.y = Math.max(c.y, G.world.height(c.x, c.z) + 6); this.place(c, 0); if (c.t <= 0) { c.t = 22; G.audio.sfx('whale'); } },

    // Reef fish live around a home patch near the bottom: pairs of butterflyfish, small groups of tangs and idols,
    // parrotfish grazing the coral, clouds of chromis hovering over a coral head. Each fish picks its own targets
    // around home, turns smoothly toward them and scatters from a diver who comes too close.
    updateReefFish(dt, px, pz) {
      const Wd = G.world, P = G.player, RT = REEF_TYPES;
      for (let i = this.reefGroups.length - 1; i >= 0; i--) { const g = this.reefGroups[i]; if (Math.hypot(g.hx - px, g.hz - pz) > 70) this.reefGroups.splice(i, 1); }
      if (this.reefGroups.length < 14 && Math.random() < dt * 2.5) {
        const a = Math.random() * 6.28, d = 6 + Math.random() * 40, x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d, fl = Wd.height(x, z);
        if (fl < -1.6 && fl > -20) {
          const T = G.weighted(Math.random, RT.map((t) => [t, t.w])), n = T.n[0] + Math.floor(Math.random() * (T.n[1] - T.n[0] + 1)), f = [];
          for (let k = 0; k < n; k++) f.push({ x: x + (Math.random() - 0.5) * 2, y: fl + 0.4 + Math.random() * T.hover, z: z + (Math.random() - 0.5) * 2, yaw: Math.random() * 6.28, pitch: 0, sp: 0, tx: x, ty: fl + 1, tz: z, tt: 0, ph: Math.random() * 6, s: T.size[0] + Math.random() * (T.size[1] - T.size[0]), alive: true });
          this.reefGroups.push({ T, hx: x, hz: z, fl, f });
        }
      }
      const cnt = {}; for (const k in this.reefMeshes) cnt[k] = 0;
      const pdive = P.swimming || P.headUnder;
      for (const g of this.reefGroups) {
        const T = g.T, M = this.reefMeshes[T.plan];
        for (const f of g.f) {
          if (!f.alive) continue;
          const dp = Math.hypot(f.x - P.pos.x, f.y - P.pos.y - 0.6, f.z - P.pos.z), scared = pdive && dp < T.shy;
          f.tt -= dt;
          if (scared) { const ax = f.x - P.pos.x, az = f.z - P.pos.z, l = Math.hypot(ax, az) || 1; f.tx = f.x + ax / l * 4; f.tz = f.z + az / l * 4; f.ty = f.y + 0.3; f.tt = 1.2; }
          else if (f.tt <= 0 || Math.hypot(f.tx - f.x, f.tz - f.z) < 0.3) {
            const a = Math.random() * 6.28, r = Math.random() * T.range; f.tx = g.hx + Math.cos(a) * r; f.tz = g.hz + Math.sin(a) * r;
            const fl = Wd.height(f.tx, f.tz); f.ty = T.graze && Math.random() < 0.5 ? fl + 0.15 : fl + 0.3 + Math.random() * T.hover; f.tt = 2 + Math.random() * 5;
          }
          const want = Math.atan2(-(f.tx - f.x), -(f.tz - f.z)), dist = Math.hypot(f.tx - f.x, f.tz - f.z);
          f.yaw += G.clamp(G.angDiff(f.yaw, want), -dt * (scared ? 6 : 2.2), dt * (scared ? 6 : 2.2));
          const vmax = scared ? T.speed * 4 : T.speed * Math.min(1, 0.3 + dist); f.sp = G.damp(f.sp, vmax, scared ? 6 : 2, dt);
          f.x -= Math.sin(f.yaw) * f.sp * dt; f.z -= Math.cos(f.yaw) * f.sp * dt; const dy = G.clamp(f.ty - f.y, -0.6, 0.6); f.y += dy * dt * 0.8; f.pitch = G.damp(f.pitch, dy * 0.5, 3, dt);
          const floor = Wd.height(f.x, f.z); if (f.y < floor + 0.12) f.y = floor + 0.12; if (f.y > -0.4) f.y = -0.4;
          f.wx = f.x; f.wy = f.y; f.wz = f.z;
          if (cnt[T.plan] >= 400) continue; const i = cnt[T.plan]++;
          _e.set(f.pitch, f.yaw, 0, 'YXZ'); _q.setFromEuler(_e); _m.compose(_p.set(f.x, f.y, f.z), _q, _sc.set(f.s, f.s, f.s)); M.m.setMatrixAt(i, _m); M.sp.array[i] = T.sp; M.ph.array[i] = f.ph;
        }
        if (!g.seen && Math.hypot(g.hx - P.pos.x, g.hz - P.pos.z) < 8 && pdive) { g.seen = true; G.journal.seeCreature('fish'); }
      }
      for (const k in this.reefMeshes) { const M = this.reefMeshes[k]; M.m.count = cnt[k]; M.m.instanceMatrix.needsUpdate = true; M.sp.needsUpdate = true; M.ph.needsUpdate = true; }
    },
    updateSchools(dt, px, pz) {
      const Wd = G.world;
      for (let i = this.schools.length - 1; i >= 0; i--) { const s = this.schools[i]; if (Math.hypot(s.x - px, s.z - pz) > 75) this.schools.splice(i, 1); }
      if (this.schools.length < 5 && Math.random() < dt * 0.8) {
        const a = Math.random() * 6.28, d = 8 + Math.random() * 30, x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d, fl = Wd.height(x, z);
        if (fl < -1.8) { const reef = fl > -16, spc = reef ? [0, 0, 3, 5][Math.floor(Math.random() * 4)] : (Math.random() < 0.7 ? 3 : 0), big = spc === 3 ? 1.7 : spc === 4 ? 1.5 : 1, deep = spc === 1 || spc === 4 ? 1.35 : 1; const col = [spc, deep]; const n = (spc === 3 ? 60 : 22) + Math.floor(Math.random() * (spc === 3 ? 60 : 20)), m = []; for (let k = 0; k < n; k++) m.push({ ox: (Math.random() - 0.5) * 3.5 * big, oy: (Math.random() - 0.5) * 1.6, oz: (Math.random() - 0.5) * 3.5 * big, ph: Math.random() * 6, alive: true, s: (0.22 + Math.random() * 0.12) * big }); this.schools.push({ x, y: Math.max(fl + 1, -1.6 - Math.random() * 5), z, yaw: Math.random() * 6.28, t: 0, m, col, sp: 1 }); }
      }
      let n = 0; const P = G.player;
      for (const s of this.schools) {
        s.t -= dt; if (s.t <= 0) { s.t = 3 + Math.random() * 5; s.ty = s.yaw + (Math.random() - 0.5) * 2.5; }
        const pd = Math.hypot(s.x - P.pos.x, s.z - P.pos.z, s.y - P.pos.y - 0.8); if (pd < 4 && P.swimming) { s.ty = Math.atan2(-(s.x - P.pos.x), -(s.z - P.pos.z)); s.sp = 3.2; } else s.sp = G.damp(s.sp, 0.9, 1, dt);
        s.yaw += G.clamp(G.angDiff(s.yaw, s.ty), -dt * 1.5, dt * 1.5); const nx = s.x - Math.sin(s.yaw) * s.sp * dt, nz = s.z - Math.cos(s.yaw) * s.sp * dt, fl = Wd.height(nx, nz);
        if (fl < -1.6) { s.x = nx; s.z = nz; s.y = G.clamp(s.y, fl + 0.8, -1.0); } else s.ty = s.yaw + Math.PI;
        if (!s.seen && pd < 9) { s.seen = true; G.journal.seeCreature('fish'); }
        for (const f of s.m) {
          if (!f.alive || n >= 600) continue; const w = this.t * 1.3 + f.ph; f.wx = s.x + f.ox + Math.sin(w) * 0.4; f.wy = s.y + f.oy + Math.sin(w * 0.7) * 0.2; f.wz = s.z + f.oz + Math.cos(w * 0.9) * 0.4;
          _e.set(0, s.yaw + Math.sin(w * 0.7) * 0.15, 0); _q.setFromEuler(_e); _m.compose(_p.set(f.wx, f.wy, f.wz), _q, _sc.set(f.s, f.s * s.col[1], f.s)); this.fishMesh.setMatrixAt(n, _m); this.fishSp.array[n] = s.col[0]; this.fishPh.array[n] = f.ph; n++;
        }
      }
      this.fishMesh.count = n; this.fishMesh.instanceMatrix.needsUpdate = true; this.fishSp.needsUpdate = true; this.fishPh.needsUpdate = true;
    },
    updateBirds(dt) {
      const I = G.world.nearest, P = G.player; let cx = P.pos.x, cz = P.pos.z, rad = 16, hgt = 14;
      if (I && I._d < 500) { cx = I.x; cz = I.z; rad = I.r * 0.7; hgt = 26 + I.elev; } this.bc = this.bc || { x: cx, z: cz }; this.bc.x = G.damp(this.bc.x, cx, 0.3, dt); this.bc.z = G.damp(this.bc.z, cz, 0.3, dt);
      const storm = G.weather.storm > 0.6; this.birdMesh.visible = !storm; this.birdPos = this.birdPos || [];
      const wg = this.birdWing.array; this.birdSt = this.birdSt || [];
      for (let i = 0; i < 14; i++) {
        // each bird circles on its own ring and height band; it flaps to climb or keep speed and glides in between
        const st = this.birdSt[i] || (this.birdSt[i] = { ph: Math.random() * 6.28, flap: Math.random() < 0.5 ? 1 : 0, k: 0, sw: 1 + Math.random() * 3 });
        const w = 0.16 + (i % 5) * 0.025, dir = i % 4 === 3 ? -1 : 1, a = dir * this.t * w + i * 0.9, r = rad * (0.45 + (i % 4) * 0.2) + 6 * Math.sin(this.t * 0.11 + i);
        const x = this.bc.x + Math.cos(a) * r, z = this.bc.z + Math.sin(a) * r, vy = Math.cos(this.t * 0.35 + i * 1.7), y = hgt + Math.sin(this.t * 0.35 + i * 1.7) * 4 + (i % 5) * 2.2;
        st.sw -= dt; if (st.sw <= 0) { st.flap = vy > 0.2 || Math.random() < 0.35 ? 1 : 0; st.sw = st.flap ? 0.8 + Math.random() * 1.6 : 1.5 + Math.random() * 3.5; }
        st.k = G.damp(st.k, st.flap, 4, dt); st.ph += dt * (7.5 + (i % 3) * 0.6) * (0.4 + st.k * 0.6);
        const sn = Math.sin(st.ph); wg[i * 2] = G.lerp(0.1, 0.18 + sn * 0.62, st.k); wg[i * 2 + 1] = G.lerp(-0.12, 0.34 * Math.sin(st.ph - 0.9), st.k);
        const bank = dir * (0.22 + w * 0.6) * (1 - st.k * 0.4), pitch = -vy * 0.08;
        _e.set(pitch, -a + (dir < 0 ? Math.PI : 0), dir * bank, 'YXZ'); _q.setFromEuler(_e); _m.compose(_p.set(x, y, z), _q, _sc.set(1, 1, 1)); this.birdMesh.setMatrixAt(i, _m); this.birdPos[i] = [x, y, z];
      }
      this.birdWing.needsUpdate = true;
      this.birdMesh.instanceMatrix.needsUpdate = true;
      if (!this.birdSeen && I && I._d < 60) { this.birdSeen = true; G.journal.seeCreature('gull'); }
    },
    extraDrops(type) { for (const [id, a, b] of (G.EXTRA_DROPS || {})[type] || []) { const n = a + Math.floor(Math.random() * (b - a + 1)); if (n > 0 && G.ITEMS[id]) G.inv.add(id, n); } },
    // weapon / tool hits. returns true when something was struck
    strike(o, d, reach, dmg, type) {
      const hitRay = (x, y, z, r) => { const px = x - o.x, py = y - o.y, pz = z - o.z, t = px * d.x + py * d.y + pz * d.z; if (t < 0 || t > reach + r) return false; return Math.hypot(px - d.x * t, py - d.y * t, pz - d.z * t) < r; };
      for (const c of this.list) {
        if (c.type === 'jelly' || c.type === 'giant' || c.type === 'dolphin' || (c.type === 'crab' && c.dead)) continue; if (!hitRay(c.x, c.y + (c.type === 'boar' ? 0.55 : 0), c.z, c.r + 0.25)) continue;
        c.hp -= dmg; G.audio.sfx('hit');
        if (c.y < G.ocean.height(c.x, c.z) - 0.2) { for (let k = 0; k < 18; k++) G.fx.emit(c.x + (Math.random() - 0.5) * 0.3, c.y + Math.random() * 0.3, c.z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.6, (Math.random() - 0.3) * 0.4, (Math.random() - 0.5) * 0.6, 0.28, 0.02, 0.03, 0.35, 0.18 + Math.random() * 0.25, 2.5 + Math.random() * 1.5, -0.05); }   // a slow dark cloud that hangs in the water
        else G.fx.burst(c.x, c.y + 0.4, c.z, [0.6, 0.05, 0.05, 0.8], 10, 1.8, 0.6, 9, 0.06);
        if (c.type === 'shark') { c.hits++; c.state = 'retreat'; c.t = 14; if (c.hp <= 0) { G.inv.add('raw_fillet', 4); G.inv.add('hide', 1); G.inv.add('bone', 2); this.extraDrops('shark'); G.journal.achieve('shark', 'Killed a shark'); this.remove(c); } else G.ui.toast('The shark veers away.', 'good'); }
        else if (c.type === 'boar') { if (c.hp <= 0) { this.extraDrops('boar'); G.inv.add('raw_meat', 2 + Math.floor(Math.random() * 2)); G.inv.add('hide', 1 + Math.floor(Math.random() * 2)); G.inv.add('bone', 1 + Math.floor(Math.random() * 2)); G.skills.xp('survival', 20); G.emit('hunt', 'boar'); this.remove(c); } else { c.state = c.hp < 18 ? 'flee' : 'charge'; c.t = 3; } }
        else if (c.type === 'crab') { if (c.dead) continue; if (c.hp <= 0) this.killCrab(c); else { c.t = 0; c.vx = (Math.random() - 0.5) * 5; c.vz = (Math.random() - 0.5) * 5; } }
        else if (c.type === 'turtle' || c.type === 'ray') { c.t = 0; c.speed = 3; c.life = 0; }
        else if (c.type === 'barracuda' || c.type === 'grouper') { c.t = 8; if (c.hp <= 0) { G.inv.add('raw_fillet', c.type === 'grouper' ? 5 : 2); G.skills.xp('fishing', 12); this.remove(c); } }
        else if (c.type === 'eel') { if (c.hp <= 0) { G.inv.add('raw_fillet', 1); this.remove(c); } else c.t = 8; }
        return true;
      }
      if (type === 'spear' || type === 'knife' || type === 'arrow') for (const s of this.schools.concat(this.reefGroups.map((g) => ({ m: g.f })))) for (const f of s.m) if (f.alive && f.wx != null && hitRay(f.wx, f.wy, f.wz, 0.42)) { f.alive = false; G.inv.add('raw_fish', 1); G.skills.xp('fishing', 6); G.audio.sfx('hit'); G.fx.bubbles(f.wx, f.wy, f.wz, 6); G.emit('speared'); s.ty = s.yaw + Math.PI; s.sp = 4; return true; }
      if (type === 'arrow' && this.birdPos && this.birdMesh.visible) for (const b of this.birdPos) if (hitRay(b[0], b[1], b[2], 1.1)) { G.inv.add('feather', 2 + Math.floor(Math.random() * 2)); G.inv.add('raw_meat', 1); G.audio.sfx('hit'); G.ui.toast('Bird down.'); return true; }
      return false;
    }
  };
})();
