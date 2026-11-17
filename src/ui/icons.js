'use strict';
/* Icon studio. Every item is rendered once, at load, from a 3D model under neutral studio light (three-quarter view,
   soft key and rim light, a little ambient occlusion from the image-based environment). The renders replace the emoji
   placeholders everywhere the interface shows an item. Items with no specific model get a purpose-built object by kind. */
(function () {
  const G = window.G;
  const SIZE = 128;
  const ICON = G.icons = { url: {}, ready: false };
  const C = {};   // colour materials, created on demand
  const col = (hex, o) => { const k = 'icn_' + hex.toString(16) + (o ? JSON.stringify(o) : ''); if (!G.mats[k]) G.mats[k] = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: 0.6, metalness: 0 }, o || {})); return k; };

  // ---------- shape kit ----------
  const S = {
    ingot(b, c, m) { const g = new THREE.CylinderGeometry(0.5, 0.62, 0.32, 4, 1); g.rotateY(Math.PI / 4); g.scale(1.4, 1, 0.75); b.add(g, col(c, { metalness: m == null ? 0.9 : m, roughness: 0.35 }), b.mat4(0, 0.16, 0)); },
    sheet(b, c, m) { b.box(1.2, 0.06, 0.9, 0, 0.03, 0, col(c, { metalness: m == null ? 0.85 : m, roughness: 0.4 }), 0.2); b.box(1.2, 0.06, 0.9, 0.08, 0.1, 0.05, col(c, { metalness: m == null ? 0.85 : m, roughness: 0.4 }), 0.35); },
    rods(b, c) { for (let i = 0; i < 3; i++) b.cyl(0.07, 0.07, 1.4, (i - 1) * 0.18, 0.08 + (i % 2) * 0.12, 0, col(c, { metalness: 0.85, roughness: 0.4 }), 10, 0, 0.3, Math.PI / 2); },
    pipe(b, c) { const g = new THREE.CylinderGeometry(0.16, 0.16, 1.3, 16, 1, true); g.rotateZ(Math.PI / 2); b.add(g, col(c, { metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }), b.mat4(0, 0.2, 0, 0, 0.4, 0)); },
    can(b, c, label) { b.cyl(0.32, 0.32, 0.7, 0, 0.35, 0, col(label || c, { metalness: 0.3, roughness: 0.5 }), 20); b.cyl(0.33, 0.33, 0.04, 0, 0.71, 0, col(0xb0b4b8, { metalness: 0.9, roughness: 0.3 }), 20); b.cyl(0.33, 0.33, 0.04, 0, 0.0, 0, col(0xb0b4b8, { metalness: 0.9, roughness: 0.3 }), 20); },
    jar(b, c, lid) { const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(0.32 * Math.sin(Math.PI * (0.15 + t * 0.7)) + 0.04, t * 0.8)); } b.add(new THREE.LatheGeometry(pts, 20), col(c, { roughness: 0.3 })); b.cyl(0.2, 0.22, 0.12, 0, 0.84, 0, col(lid || 0x6b4a2a), 16); },
    bottle(b, c, cork) { const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2(t < 0.6 ? 0.28 : 0.28 - (t - 0.6) * 0.5, t * 1.1)); } b.add(new THREE.LatheGeometry(pts, 20), col(c, { roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.75 })); b.cyl(0.09, 0.08, 0.14, 0, 1.12, 0, col(cork || 0x9a7a4e), 12); },
    bowl(b, c) { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(0.15 + Math.sin(t * Math.PI / 2) * 0.48, t * 0.42)); } const g = new THREE.LatheGeometry(pts, 24); b.add(g, col(0x8a5a34, { roughness: 0.7, side: THREE.DoubleSide })); b.cyl(0.6, 0.6, 0.03, 0, 0.36, 0, col(c, { roughness: 0.25 }), 24); },
    plate(b, c, food) { b.cyl(0.62, 0.55, 0.06, 0, 0.03, 0, col(0x8a6a44, { roughness: 0.75 }), 24); if (food) food(b); else b.sph(0.35, 0, 0.18, 0, col(c), 1.3, 0.5, 1, null, 14); },
    packet(b, c) { b.box(0.7, 0.95, 0.12, 0, 0.47, 0, col(c, { roughness: 0.8 }), 0.2); b.box(0.72, 0.1, 0.13, 0, 0.92, 0, col(0x6b5a3a), 0.2); },
    roll(b, c) { b.cyl(0.32, 0.32, 0.6, 0, 0.32, 0, col(c, { roughness: 0.9 }), 20, 0, 0, Math.PI / 2); b.cyl(0.1, 0.1, 0.62, 0, 0.32, 0, col(0xc8c0b0), 12, 0, 0, Math.PI / 2); },
    box(b, c, band) { b.box(0.9, 0.6, 0.6, 0, 0.3, 0, col(c, { roughness: 0.6 }), 0.25); if (band) b.box(0.92, 0.12, 0.62, 0, 0.32, 0, col(band), 0.25); },
    kit(b, c) { b.box(0.9, 0.55, 0.45, 0, 0.27, 0, col(c, { roughness: 0.45, metalness: 0.2 }), 0.25); b.box(0.35, 0.08, 0.12, 0, 0.6, 0, col(0x222222), 0.25); b.box(0.2, 0.2, 0.47, 0, 0.3, 0, col(0xeeeeee), 0.25); },
    pile(b, c, n, r) { const rr = G.rng(7); for (let i = 0; i < (n || 7); i++) { const g = G.geo.blob(30 + i, 7, 0.3, 0.8); b.add(g, col(c, { roughness: 0.8 }), b.mat4((rr() - 0.5) * 0.7, 0.15 + rr() * 0.2, (rr() - 0.5) * 0.6, rr() * 3, rr() * 3, 0, (r || 0.18) * (0.8 + rr() * 0.4))); } },
    lump(b, c, s) { b.add(G.geo.blob(41, 9, 0.28, 0.75), col(c, { roughness: 0.85 }), b.mat4(0, 0.35, 0, 0.3, 0.5, 0, s || 0.55)); },
    gem(b, c) { const g = new THREE.OctahedronGeometry(0.5, 0); g.scale(0.7, 1.1, 0.7); b.add(g, col(c, { roughness: 0.1, metalness: 0.3, emissive: c, emissiveIntensity: 0.3 }), b.mat4(0, 0.6, 0, 0.2, 0.4, 0)); },
    pills(b, c) { const rr = G.rng(3); for (let i = 0; i < 6; i++) b.sph(0.14, (rr() - 0.5) * 0.6, 0.12, (rr() - 0.5) * 0.5, col(c, { roughness: 0.6 }), 1, 0.55, 1, null, 12); },
    hat(b, c) { b.cyl(0.75, 0.75, 0.04, 0, 0.05, 0, col(c, { roughness: 0.9 }), 28); b.cyl(0.36, 0.42, 0.42, 0, 0.27, 0, col(c, { roughness: 0.9 }), 24); b.cyl(0.43, 0.43, 0.08, 0, 0.12, 0, col(0x5a3a24), 24); },
    shirt(b, c) { b.box(0.9, 1.0, 0.18, 0, 0.5, 0, col(c, { roughness: 0.95 }), 0.2); for (const s of [-1, 1]) b.box(0.45, 0.3, 0.17, s * 0.62, 0.82, 0, col(c, { roughness: 0.95 }), 0.2, 0, s * 0.5); },
    boot(b, c) { for (const s of [-1, 1]) { b.box(0.32, 0.65, 0.36, s * 0.22, 0.4, -0.1, col(c, { roughness: 0.7 }), 0.2); b.box(0.34, 0.2, 0.75, s * 0.22, 0.1, 0.08, col(c, { roughness: 0.7 }), 0.2); } },
    mask(b, c) { b.box(0.9, 0.42, 0.25, 0, 0.4, 0, col(0x1e2a33, { roughness: 0.5 }), 0.3); b.box(0.75, 0.3, 0.05, 0, 0.42, 0.14, col(0x9fd6e0, { roughness: 0.05, transparent: true, opacity: 0.6 }), 0.3); b.box(1.2, 0.07, 0.05, 0, 0.42, -0.12, col(c), 0.3); },
    pack(b, c) { b.box(0.8, 1.0, 0.4, 0, 0.5, 0, col(c, { roughness: 0.95 }), 0.25); b.box(0.6, 0.45, 0.15, 0, 0.35, 0.25, col(c, { roughness: 0.95 }), 0.25); b.box(0.82, 0.25, 0.42, 0, 0.9, 0.02, col(c, { roughness: 0.95 }), 0.25); },
    tank(b, c) { b.cyl(0.26, 0.26, 1.2, 0, 0.6, 0, col(c, { metalness: 0.6, roughness: 0.35 }), 20); b.sph(0.26, 0, 1.2, 0, col(c, { metalness: 0.6, roughness: 0.35 }), 1, 1, 1, null, 16); b.cyl(0.07, 0.07, 0.2, 0, 1.5, 0, col(0x333333, { metalness: 0.9 }), 10); },
    fins(b, c) { for (const s of [-1, 1]) { b.box(0.38, 0.06, 1.2, s * 0.25, 0.05, 0, col(c, { roughness: 0.5 }), s * 0.1); b.box(0.36, 0.22, 0.4, s * 0.25, 0.14, -0.35, col(0x222222), s * 0.1); } },
    bandage(b) { this.roll(b, 0xf2efe6); },
    skewer(b, c) { b.cyl(0.025, 0.025, 1.5, 0, 0.3, 0, col(0x9a7a4e), 8, 0, 0.3, Math.PI / 2); for (let i = 0; i < 4; i++) b.add(G.geo.blob(60 + i, 7, 0.25, 0.85), col(c, { roughness: 0.6 }), b.mat4(-0.45 + i * 0.3, 0.3, 0, 0, i, 0, 0.16)); },
    slab(b, c, skin) { b.box(1.0, 0.18, 0.55, 0, 0.1, 0, col(c, { roughness: 0.55 }), 0.3); if (skin) b.box(1.0, 0.04, 0.56, 0, 0.0, 0, col(skin), 0.3); },
    leaf(b, c) { const g = new THREE.PlaneGeometry(1.4, 0.5, 8, 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, x * x * 0.2); p.setY(i, p.getY(i) * (1 - Math.abs(x) * 0.6)); } g.rotateX(-Math.PI / 2.3); g.computeVertexNormals(); b.add(g, col(c, { side: THREE.DoubleSide, roughness: 0.7 }), b.mat4(0, 0.3, 0, 0, 0.5, 0)); },
    stickbundle(b, c) { for (let i = 0; i < 5; i++) b.cyl(0.05, 0.06, 1.3, (i - 2) * 0.1, 0.1 + (i % 2) * 0.08, 0, col(c, { roughness: 0.9 }), 8, 0, 0.3 + i * 0.05, Math.PI / 2); },
    tooth(b, c) { for (let i = 0; i < 3; i++) { const g = new THREE.ConeGeometry(0.16, 0.45, 3); b.add(g, col(c, { roughness: 0.35 }), b.mat4((i - 1) * 0.35, 0.22, 0, 0, i, (i - 1) * 0.3)); } },
    skin(b, c) { const g = new THREE.PlaneGeometry(1.2, 0.9, 6, 4); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 3) * 0.05 + Math.cos(p.getY(i) * 4) * 0.04); g.rotateX(-Math.PI / 2.2); g.computeVertexNormals(); b.add(g, col(c, { side: THREE.DoubleSide, roughness: 0.85 }), b.mat4(0, 0.2, 0)); },
    feather(b) { const g = new THREE.PlaneGeometry(0.35, 1.3); g.rotateZ(0.6); b.add(g, col(0xe8e4dc, { side: THREE.DoubleSide, roughness: 0.9 }), b.mat4(0, 0.4, 0, -0.6, 0, 0)); b.cyl(0.02, 0.02, 1.3, 0, 0.42, 0.02, col(0xbfb8a8), 6, -0.6, 0, 0.6); },
    bone(b) { b.cyl(0.08, 0.08, 1.1, 0, 0.15, 0, col(0xe6dcc6, { roughness: 0.6 }), 10, 0, 0.3, Math.PI / 2); for (const s of [-1, 1]) for (const t of [-1, 1]) b.sph(0.12, s * 0.52 * Math.cos(0.3), 0.15 + t * 0.07, s * 0.52 * Math.sin(0.3) * -1, col(0xe6dcc6, { roughness: 0.6 }), 1, 1, 1, null, 10); },
    needle(b, c) { b.cyl(0.015, 0.03, 1.3, 0, 0.2, 0, col(c || 0xe6dcc6, { roughness: 0.5 }), 8, 0, 0.3, 1.2); },
    hook(b, c) { const g = new THREE.TorusGeometry(0.3, 0.05, 8, 20, 4.4); b.add(g, col(c || 0xe6dcc6), b.mat4(0, 0.4, 0, 0, 0, 0)); b.cyl(0.05, 0.05, 0.6, 0.3, 0.7, 0, col(c || 0xe6dcc6), 8); },
    chain(b) { for (let i = 0; i < 5; i++) { const g = new THREE.TorusGeometry(0.16, 0.05, 8, 16); g.scale(1.4, 1, 1); b.add(g, col(0x6a6e72, { metalness: 0.9, roughness: 0.4 }), b.mat4(-0.7 + i * 0.35, 0.15, 0, i % 2 ? Math.PI / 2 : 0, 0, 0)); } },
    spring(b) { const pts = []; for (let i = 0; i <= 120; i++) { const t = i / 120; pts.push(new THREE.Vector3(Math.cos(t * 40) * 0.25, t * 1.1, Math.sin(t * 40) * 0.25)); } b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.035, 8), col(0x9aa0a6, { metalness: 0.9, roughness: 0.3 })); },
    bolts(b) { const rr = G.rng(5); for (let i = 0; i < 5; i++) { const x = (rr() - 0.5) * 0.8, z = (rr() - 0.5) * 0.6; b.cyl(0.05, 0.05, 0.6, x, 0.05, z, col(0x8a8e92, { metalness: 0.9, roughness: 0.4 }), 8, 0, rr() * 3, Math.PI / 2); b.cyl(0.11, 0.11, 0.08, x + 0.3, 0.05, z, col(0x8a8e92, { metalness: 0.9 }), 6, 0, 0, Math.PI / 2); } },
    board(b, c) { b.box(1.0, 0.08, 0.7, 0, 0.1, 0, col(c || 0x1d6a3a, { roughness: 0.5 }), 0.3); for (let i = 0; i < 6; i++) b.box(0.12, 0.08, 0.1, -0.35 + i * 0.14, 0.18, (i % 2) * 0.2 - 0.1, col(0x222222), 0.3); },
    cell(b) { b.box(1.0, 0.05, 1.0, 0, 0.1, 0, col(0x0c1f44, { metalness: 0.7, roughness: 0.2 }), 0.3); for (let i = 0; i < 3; i++) b.box(1.0, 0.055, 0.02, 0, 0.1, -0.33 + i * 0.33, col(0xc0c4c8, { metalness: 0.9 }), 0.3); },
    beam(b, c) { b.box(1.4, 0.3, 0.3, 0, 0.16, 0, c, 0.3); },
  };
  const tint = (k, c) => () => col(c);

  // item -> builder. Order: explicit table, then tools, then debris/harvest models, then a category default.
  const T = {
    // materials
    stick: ['node', 'stick'], stone: ['node', 'stone'], flint: ['node', 'flint'], clay: ['node', 'clay'], shell: ['node', 'shell'], coconut: ['node', 'coconut'],
    log: ['fn', (b) => S.beam(b, 'log')], beam: ['fn', (b) => S.beam(b, 'wood')], bamboo: ['fn', (b) => S.stickbundle(b, 0x9ab05a)], palm_leaf: ['fn', (b) => S.leaf(b, 0x4f7a2e)], vine: ['fn', (b) => S.roll(b, 0x4a6a2a)],
    fiber: ['fn', (b) => S.pile(b, 0xb0a070, 9, 0.12)], sand: ['fn', (b) => S.pile(b, 0xd8c79a, 10, 0.16)], brick: ['fn', (b) => { b.box(1.0, 0.3, 0.5, 0, 0.15, 0, col(0x9a4a30, { roughness: 0.9 }), 0.3); }],
    glass: ['fn', (b) => { b.box(1.0, 0.05, 0.8, 0, 0.1, 0, col(0x9fd6e0, { roughness: 0.05, transparent: true, opacity: 0.6 }), 0.3); }],
    nails: ['fn', (b) => S.bolts(b)], bolts: ['fn', (b) => S.bolts(b)], rubber: ['fn', (b) => { const g = new THREE.TorusGeometry(0.4, 0.14, 12, 24); b.add(g, col(0x1c1c1e, { roughness: 0.9 }), b.mat4(0, 0.15, 0, Math.PI / 2, 0, 0)); }],
    electronics: ['fn', (b) => S.board(b, 0x1d6a3a)], circuit: ['fn', (b) => S.board(b, 0x0e4a2a)], wire: ['fn', (b) => S.roll(b, 0xb46a3c)], machine_part: ['fn', (b) => { const g = new THREE.TorusGeometry(0.4, 0.12, 6, 12); b.add(g, col(0x7a7e82, { metalness: 0.9, roughness: 0.35 }), b.mat4(0, 0.15, 0, Math.PI / 2, 0, 0)); for (let i = 0; i < 12; i++) b.box(0.12, 0.14, 0.1, Math.cos(i / 12 * 6.28) * 0.55, 0.15, Math.sin(i / 12 * 6.28) * 0.55, col(0x7a7e82, { metalness: 0.9 }), -i / 12 * 6.28); }],
    battery: ['fn', (b) => S.can(b, 0x2a2a2a, 0xc0a020)], lens: ['fn', (b) => { b.sph(0.5, 0, 0.3, 0, col(0xbfe6ee, { roughness: 0.02, transparent: true, opacity: 0.7 }), 1, 0.3, 1, null, 24); }],
    iron_ore: ['node', 'ore_iron'], copper_ore: ['node', 'ore_copper'], iron_ingot: ['fn', (b) => S.ingot(b, 0x6e7378)], copper_ingot: ['fn', (b) => S.ingot(b, 0xc06a3c)], steel: ['fn', (b) => S.sheet(b, 0xa8b0b8)],
    titanium: ['fn', (b) => S.lump(b, 0xb8c0cc, 0.45)], sulfur: ['node', 'sulfur'], obsidian: ['node', 'obsidian'], charcoal: ['fn', (b) => S.pile(b, 0x1a1a1a, 6, 0.2)], fuel: ['fn', (b) => S.can(b, 0x9a2a1a)],
    pearl: ['fn', (b) => b.sph(0.4, 0, 0.4, 0, col(0xf2ecf0, { roughness: 0.15, metalness: 0.2 }), 1, 1, 1, null, 20)], sponge: ['fn', (b) => S.lump(b, 0xd0a040, 0.5)], hide: ['fn', (b) => S.skin(b, 0x6a4a30)], feather: ['fn', (b) => S.feather(b)], bone: ['fn', (b) => S.bone(b)],
    relic: ['fn', (b) => { b.box(0.4, 0.9, 0.3, 0, 0.45, 0, col(0x6a6458, { roughness: 0.95 }), 0.3); b.sph(0.25, 0, 1.0, 0, col(0x6a6458, { roughness: 0.95 }), 1, 1.2, 0.9, null, 10); }], salt: ['fn', (b) => S.pile(b, 0xf0f0ea, 10, 0.12)], fertilizer: ['fn', (b) => S.pile(b, 0x3a2a1a, 9, 0.18)], spoiled: ['fn', (b) => S.lump(b, 0x4a5a2a, 0.45)],
    coconut_husk: ['fn', (b) => S.pile(b, 0x8a6a40, 6, 0.2)], coconut_shell: ['fn', (b) => S.bowl(b, 0xf2efe6)], coir: ['fn', (b) => S.roll(b, 0x8a6a40)], resin: ['fn', (b) => S.lump(b, 0xd08a20, 0.4)], bark: ['fn', (b) => S.stickbundle(b, 0x5a4030)],
    tinder: ['fn', (b) => S.pile(b, 0xa08050, 10, 0.12)], glue: ['fn', (b) => S.jar(b, 0xd08a20)], tar: ['fn', (b) => S.jar(b, 0x1a1410)], treated_plank: ['fn', (b) => b.box(1.3, 0.12, 0.35, 0, 0.1, 0, col(0x3a2a1c, { roughness: 0.5 }), 0.3)], dowel: ['fn', (b) => S.stickbundle(b, 0xb08a5a)],
    wicker: ['fn', (b) => b.box(1.0, 0.08, 0.9, 0, 0.1, 0, col(0x9a8050, { roughness: 0.95 }), 0.3)], palm_mat: ['fn', (b) => b.box(1.0, 0.05, 0.9, 0, 0.1, 0, col(0x7a8a40, { roughness: 0.95 }), 0.3)], thread: ['fn', (b) => S.roll(b, 0xe0d8c0)], canvas: ['fn', (b) => S.roll(b, 0xc8b890)],
    tarp: ['fn', (b) => S.roll(b, 0x2a5aa0)], net_mesh: ['fn', (b) => S.roll(b, 0x9a8a60)], sinew: ['fn', (b) => S.roll(b, 0xd8c8a0)], leather: ['fn', (b) => S.skin(b, 0x7a4a28)], bone_needle: ['fn', (b) => S.needle(b)], bone_hook: ['fn', (b) => S.hook(b)],
    shark_tooth: ['fn', (b) => S.tooth(b, 0xf0ead8)], shark_skin: ['fn', (b) => S.skin(b, 0x6a7078)], lime: ['fn', (b) => S.pile(b, 0xf4f2ea, 9, 0.15)], mortar: ['fn', (b) => S.bowl(b, 0xc0bcb0)], ash: ['fn', (b) => S.pile(b, 0x8a8a88, 9, 0.14)],
    soap: ['fn', (b) => b.box(0.7, 0.3, 0.45, 0, 0.15, 0, col(0xe8dcc0, { roughness: 0.4 }), 0.3)], coconut_oil: ['fn', (b) => S.jar(b, 0xf0e6c0)], clay_pot: ['fn', (b) => S.jar(b, 0xa0583a, 0xa0583a)], sheet_metal: ['fn', (b) => S.sheet(b, 0x8a9096)],
    iron_rod: ['fn', (b) => S.rods(b, 0x6e7378)], chain: ['fn', (b) => S.chain(b)], hinge: ['fn', (b) => S.sheet(b, 0x6e7378)], spring: ['fn', (b) => S.spring(b)], pipe: ['fn', (b) => S.pipe(b, 0x6e7378)], copper_pipe: ['fn', (b) => S.pipe(b, 0xc06a3c)],
    solar_cell: ['fn', (b) => S.cell(b)], aluminium: ['fn', (b) => S.can(b, 0xc8ccd0, 0xb02a2a)], gunpowder: ['fn', (b) => S.pile(b, 0x2a2a2a, 10, 0.1)], saltpeter: ['fn', (b) => S.pile(b, 0xeae6da, 9, 0.13)], guano: ['fn', (b) => S.pile(b, 0xd8d0b8, 9, 0.13)],
    charcoal_dust: ['fn', (b) => S.pile(b, 0x202020, 12, 0.08)], coral_fragment: ['fn', (b) => S.pile(b, 0xe8d8c8, 6, 0.2)], crystal: ['fn', (b) => S.gem(b, 0x7fe9ff)], arrow: ['fn', (b) => { b.cyl(0.03, 0.03, 1.4, 0, 0.2, 0, col(0x9a7a4e), 8, 0, 0.3, Math.PI / 2); const g = new THREE.ConeGeometry(0.08, 0.22, 6); g.rotateZ(-Math.PI / 2); b.add(g, col(0x3a3a3a), b.mat4(0.78, 0.2 - 0.24, 0.24)); }],
    bait: ['fn', (b) => S.jar(b, 0x6a4a3a)], lure: ['fn', (b) => S.feather(b)],
    // food
    ration: ['fn', (b) => S.can(b, 0x6a7a3a)], berries: ['fn', (b) => S.pile(b, 0x3a3a8a, 10, 0.12)], mango: ['node', 'mango'], banana: ['fn', (b) => { for (let i = 0; i < 3; i++) { const g = new THREE.TorusGeometry(0.5, 0.11, 8, 20, 1.6); b.add(g, col(0xe8c840, { roughness: 0.5 }), b.mat4(0, 0.15 + i * 0.05, i * 0.12 - 0.12, Math.PI / 2, 0, 0.9)); } }],
    pineapple: ['fn', (b) => { b.sph(0.35, 0, 0.42, 0, col(0xc89a30, { roughness: 0.7 }), 1, 1.3, 1, null, 14); for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; b.cyl(0.0, 0.05, 0.4, Math.cos(a) * 0.08, 1.0, Math.sin(a) * 0.08, col(0x4a7a2e), 4, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); } }],
    mushroom: ['node', 'mushroom'], potato: ['fn', (b) => S.lump(b, 0xb08a5a, 0.42)], baked_potato: ['fn', (b) => S.lump(b, 0x7a4a24, 0.42)], seaweed: ['fn', (b) => S.leaf(b, 0x3a5a2a)],
    raw_fish: ['fish', 0, null], cooked_fish: ['fish', 0, 0x8a5020], smoked_fish: ['fish', 3, 0x6a3a18], dried_fish: ['fish', 3, 0xa08050], salted_fish: ['fish', 3, 0xd8d0c0],
    raw_fillet: ['fn', (b) => S.slab(b, 0xe08070, 0x6a7078)], cooked_fillet: ['fn', (b) => S.slab(b, 0xb07040, 0x4a3a30)], raw_crab: ['crab'], cooked_crab: ['crab', 0xd84020], clam: ['node', 'clam'], steamed_clam: ['fn', (b) => S.bowl(b, 0xd8c8a0)],
    raw_meat: ['fn', (b) => S.slab(b, 0xa03030, 0xe8d8c8)], cooked_meat: ['fn', (b) => S.slab(b, 0x6a3418, 0x8a5020)], jerky: ['fn', (b) => S.stickbundle(b, 0x5a2a18)], fish_soup: ['fn', (b) => S.bowl(b, 0xd0b080)], stew: ['fn', (b) => S.bowl(b, 0x7a4a24)],
    fruit_salad: ['fn', (b) => S.bowl(b, 0xe8a040)], curry: ['fn', (b) => S.bowl(b, 0xd8a030)], wrap: ['fn', (b) => S.roll(b, 0x2a4a22)], herbal_tea: ['fn', (b) => S.bowl(b, 0x8a9a40)],
    bottle: ['fn', (b) => S.bottle(b, 0xd8e8ea)], bottle_sea: ['fn', (b) => S.bottle(b, 0x4a8ab0)], bottle_fresh: ['fn', (b) => S.bottle(b, 0xa8d8f0)],
    coconut_meat: ['fn', (b) => S.bowl(b, 0xf4f0e6)], coconut_water: ['fn', (b) => S.bowl(b, 0xe8f0f0)], roast_coconut: ['fn', (b) => S.pile(b, 0xb08050, 6, 0.2)], coconut_milk: ['fn', (b) => S.bowl(b, 0xf8f6f0)],
    sashimi: ['fn', (b) => S.plate(b, 0xe08070, (bb) => { for (let i = 0; i < 4; i++) bb.box(0.4, 0.06, 0.18, 0, 0.1, -0.3 + i * 0.2, col(0xe88a78, { roughness: 0.3 }), 0.3); })], fish_skewer: ['fn', (b) => S.skewer(b, 0xb07040)], boar_skewer: ['fn', (b) => S.skewer(b, 0x7a3a18)],
    crab_cake: ['fn', (b) => S.plate(b, 0, (bb) => { for (let i = 0; i < 3; i++) bb.cyl(0.18, 0.18, 0.1, -0.25 + i * 0.25, 0.1, 0, col(0xb07a40), 14); })], seaweed_salad: ['fn', (b) => S.bowl(b, 0x2a6a2a)], kelp_crisps: ['fn', (b) => S.pile(b, 0x2a3a1a, 10, 0.13)],
    raw_shark: ['fn', (b) => S.slab(b, 0xd8b0b0, 0x6a7078)], shark_steak: ['fn', (b) => S.slab(b, 0x8a5a30, 0x4a3a30)], fin_soup: ['fn', (b) => S.bowl(b, 0xc0a060)], sausage: ['fn', (b) => { for (let i = 0; i < 3; i++) b.cyl(0.13, 0.13, 0.9, 0, 0.13, -0.3 + i * 0.3, col(0x7a3a20, { roughness: 0.4 }), 12, 0, 0.3, Math.PI / 2); }],
    dried_mango: ['fn', (b) => S.stickbundle(b, 0xe09030)], banana_chips: ['fn', (b) => S.pile(b, 0xe8d080, 10, 0.12)], baked_banana: ['fn', (b) => S.lump(b, 0x3a2410, 0.4)], grilled_mushroom: ['fn', (b) => S.skewer(b, 0x7a5a3a)],
    mash: ['fn', (b) => S.bowl(b, 0xf0e0b0)], chowder: ['fn', (b) => S.bowl(b, 0xf0e8d8)], fruit_juice: ['fn', (b) => S.bottle(b, 0xf0b040, 0x3a5a2a)], island_feast: ['fn', (b) => S.plate(b, 0, (bb) => { S.skewer(bb, 0x9a5a30); bb.sph(0.2, 0.3, 0.2, 0.2, col(0xe8a040), 1, 1, 1, null, 12); })],
    hardtack: ['fn', (b) => { for (let i = 0; i < 3; i++) b.box(0.6, 0.12, 0.6, 0, 0.07 + i * 0.13, 0, col(0xd8b880, { roughness: 0.9 }), 0.3 + i * 0.2); }], herbal_broth: ['fn', (b) => S.bowl(b, 0x8a9a50)],
    // medicine
    aloe: ['node', 'aloe'], bandage: ['fn', (b) => S.bandage(b)], salve: ['fn', (b) => S.jar(b, 0x8ac080)], antidote: ['fn', (b) => S.bottle(b, 0x7a3aa0)], splint: ['fn', (b) => S.stickbundle(b, 0xb08a5a)], medkit: ['fn', (b) => S.kit(b, 0xc0302a)],
    charcoal_tablet: ['fn', (b) => S.pills(b, 0x222222)], antiseptic: ['fn', (b) => S.bottle(b, 0xd8c060)], sterile_bandage: ['fn', (b) => S.bandage(b)], suture_kit: ['fn', (b) => S.kit(b, 0x2a6a8a)], burn_cream: ['fn', (b) => S.jar(b, 0xb8e0a0)],
    rehydration: ['fn', (b) => S.packet(b, 0xe0e0e0)], poultice: ['fn', (b) => S.jar(b, 0x4a6a2a)], sling: ['fn', (b) => S.roll(b, 0xe8e0d0)],
    // seeds
    seeds_potato: ['fn', (b) => S.packet(b, 0x8a6a40)], seeds_pineapple: ['fn', (b) => S.packet(b, 0xc89a30)], seeds_aloe: ['fn', (b) => S.packet(b, 0x6a9a5a)], seeds_flax: ['fn', (b) => S.packet(b, 0x6a7ab0)],
    // gear & clothing
    sun_hat: ['fn', (b) => S.hat(b, 0xc8a860)], bandana: ['fn', (b) => S.roll(b, 0xa03030)], leather_hat: ['fn', (b) => S.hat(b, 0x6a4024)], dive_mask: ['fn', (b) => S.mask(b, 0x1e2a33)], goggles: ['fn', (b) => S.mask(b, 0x2a4a8a)],
    raincoat: ['fn', (b) => S.shirt(b, 0xd8a020)], poncho: ['fn', (b) => S.shirt(b, 0x2a5aa0)], shirt: ['fn', (b) => S.shirt(b, 0xe0d8c0)], leather_vest: ['fn', (b) => S.shirt(b, 0x6a4024)], shark_armor: ['fn', (b) => S.shirt(b, 0x6a7078)], wetsuit: ['fn', (b) => S.shirt(b, 0x1a1c1e)],
    fins: ['fn', (b) => S.fins(b, 0x1a6aa0)], sandals: ['fn', (b) => S.fins(b, 0x9a8050)], boots: ['fn', (b) => S.boot(b, 0x5a3820)], tank_small: ['fn', (b) => S.tank(b, 0xd8a020)], tank_large: ['fn', (b) => S.tank(b, 0x2a5aa0)], rebreather: ['fn', (b) => S.tank(b, 0x2a2a2a)],
    backpack: ['fn', (b) => S.pack(b, 0x5a6a4a)], satchel: ['fn', (b) => S.pack(b, 0x9a8050)], dive_pack: ['fn', (b) => S.pack(b, 0x1a4a6a)],
    // tools without a held model
    compass: ['model', 'compass'], flashlight: ['fn', (b) => { b.cyl(0.13, 0.13, 0.9, 0, 0.2, 0, col(0x2a2a2a, { metalness: 0.5 }), 14, 0, 0.3, Math.PI / 2); b.cyl(0.19, 0.13, 0.2, 0.52, 0.2, -0.16, col(0x2a2a2a, { metalness: 0.5 }), 14, 0, 0.3, Math.PI / 2); }],
    depth_gauge: ['fn', (b) => { b.cyl(0.4, 0.4, 0.15, 0, 0.1, 0, col(0x2a2a2a), 24); b.cyl(0.33, 0.33, 0.16, 0, 0.1, 0, col(0xe8e8e0), 24); }], repair_kit: ['fn', (b) => S.kit(b, 0x8a6a2a)], repair_kit_pro: ['fn', (b) => S.kit(b, 0x2a2a2a)],
    treasure_map: ['fn', (b) => S.roll(b, 0xd8c890)], kit_rowboat: ['fn', (b) => S.box(b, 0x8a6a40, 0x4a3a2a)], kit_sailboat: ['fn', (b) => S.box(b, 0x8a6a40, 0xe0d8c0)], kit_skiff: ['fn', (b) => S.box(b, 0x6a7078, 0xc0302a)],
    radio_part: ['fn', (b) => S.board(b, 0x3a3a3a)], beacon_core: ['fn', (b) => S.gem(b, 0xffd070)], data_core: ['fn', (b) => S.box(b, 0x2a3a4a, 0x40c0e0)], keycard: ['fn', (b) => b.box(1.0, 0.04, 0.65, 0, 0.1, 0, col(0x2a3a4a), 0.3)], keystone_key: ['fn', (b) => S.gem(b, 0x9fb8ff)],
  };

  // third catalogue (data_extra.js)
  const ring3 = (b, c, n, r) => { for (let i = 0; i < n; i++) { const a = i / n * 6.28; b.sph(0.11, Math.cos(a) * r, 0.1, Math.sin(a) * r, col(c, { roughness: 0.3 }), 1, 1, 1, null, 10); } };
  Object.assign(T, {
    bamboo_strip: ['fn', (b) => S.stickbundle(b, 0xc8b878)], charcoal_brick: ['fn', (b) => { for (let i = 0; i < 4; i++) b.box(0.32, 0.22, 0.32, (i % 2) * 0.36 - 0.18, 0.11 + Math.floor(i / 2) * 0.23, 0, col(0x1c1c1c, { roughness: 0.95 }), 0.3); }],
    ceramic_tile: ['fn', (b) => { for (let i = 0; i < 3; i++) b.box(0.7, 0.06, 0.7, i * 0.05, 0.04 + i * 0.07, i * 0.04, col(0xa4583a, { roughness: 0.7 }), 0.2 + i * 0.15); }], glass_jar: ['fn', (b) => S.jar(b, 0xcfe8ec, 0x9a7a4e)],
    copper_sheet: ['fn', (b) => S.sheet(b, 0xc06a3c)], rivets: ['fn', (b) => S.bolts(b)], steel_cable: ['fn', (b) => S.roll(b, 0x9aa0a6)], bearing: ['fn', (b) => { const g = new THREE.TorusGeometry(0.42, 0.1, 10, 28); b.add(g, col(0xb8bec4, { metalness: 1, roughness: 0.2 }), b.mat4(0, 0.12, 0, Math.PI / 2, 0, 0)); ring3(b, 0xd8dde2, 10, 0.42); }],
    valve: ['fn', (b) => { S.pipe(b, 0xc8a050); b.cyl(0.05, 0.05, 0.4, 0, 0.4, 0, col(0xc8a050, { metalness: 0.9 }), 8); const g = new THREE.TorusGeometry(0.22, 0.04, 8, 20); b.add(g, col(0xb02a2a, { roughness: 0.5 }), b.mat4(0, 0.62, 0, Math.PI / 2, 0, 0)); }],
    gauge: ['fn', (b) => { b.cyl(0.42, 0.42, 0.16, 0, 0.42, 0, col(0xc8a050, { metalness: 0.9, roughness: 0.3 }), 28, Math.PI / 2); b.cyl(0.36, 0.36, 0.17, 0, 0.42, 0.01, col(0xf0eee6), 28, Math.PI / 2); b.box(0.04, 0.3, 0.02, 0.06, 0.48, 0.1, col(0xb02a2a), 0.4); }],
    electromagnet: ['fn', (b) => { b.cyl(0.08, 0.08, 1.0, 0, 0.3, 0, col(0x6e7378, { metalness: 0.9 }), 10, 0, 0, Math.PI / 2); b.cyl(0.24, 0.24, 0.6, 0, 0.3, 0, col(0xc06a3c, { metalness: 0.8, roughness: 0.35 }), 20, 0, 0, Math.PI / 2); }],
    motor: ['fn', (b) => { b.cyl(0.34, 0.34, 0.7, 0, 0.36, 0, col(0x3a4a5a, { metalness: 0.6, roughness: 0.4 }), 24, 0, 0, Math.PI / 2); b.cyl(0.06, 0.06, 0.3, 0.5, 0.36, 0, col(0xc0c4c8, { metalness: 1 }), 10, 0, 0, Math.PI / 2); b.box(0.5, 0.08, 0.5, 0, 0.02, 0, col(0x2a2a2a), 0); }],
    led: ['fn', (b) => { b.sph(0.3, 0, 0.5, 0, col(0xfff6d8, { emissive: 0xfff2c0, emissiveIntensity: 1.2, roughness: 0.2 }), 1, 1.1, 1, null, 16); b.cyl(0.18, 0.2, 0.3, 0, 0.2, 0, col(0xb0b4b8, { metalness: 0.9 }), 16); }],
    antenna: ['fn', (b) => { b.cyl(0.015, 0.03, 1.5, 0, 0.75, 0, col(0xc8ccd0, { metalness: 0.9 }), 8); b.cyl(0.12, 0.14, 0.15, 0, 0.07, 0, col(0x2a2a2a), 12); }], fuse: ['fn', (b) => { b.cyl(0.12, 0.12, 0.8, 0, 0.2, 0, col(0xd8eef2, { transparent: true, opacity: 0.6, roughness: 0.05 }), 14, 0, 0.3, Math.PI / 2); }],
    hawser: ['fn', (b) => S.roll(b, 0x5a4024)], sailcloth: ['fn', (b) => S.roll(b, 0xd8ccb0)], fishing_line: ['fn', (b) => S.roll(b, 0xd0e4e8)], fish_net: ['fn', (b) => S.skin(b, 0x8a7a50)], bone_meal: ['fn', (b) => S.pile(b, 0xeee6d4, 10, 0.12)],
    fish_oil: ['fn', (b) => S.bottle(b, 0xd8a840)], shark_oil: ['fn', (b) => S.bottle(b, 0xb07820)], leather_strap: ['fn', (b) => S.stickbundle(b, 0x6a4024)], concrete_mix: ['fn', (b) => S.packet(b, 0x9a9a94)], insulation: ['fn', (b) => S.lump(b, 0xc8b080, 0.5)],
    rubber_seal: ['fn', (b) => { for (let i = 0; i < 3; i++) { const g = new THREE.TorusGeometry(0.28, 0.06, 10, 24); b.add(g, col(0x1c1c1e, { roughness: 0.8 }), b.mat4(i * 0.2 - 0.2, 0.08 + i * 0.03, 0, Math.PI / 2, 0, 0)); } }], epoxy: ['fn', (b) => S.jar(b, 0x5a8aa0, 0x2a2a2a)],
    gull_egg: ['fn', (b) => { for (let i = 0; i < 2; i++) b.sph(0.26, i * 0.36 - 0.18, 0.3, i * 0.1, col(0xd8ccb0, { roughness: 0.7 }), 0.8, 1.05, 0.8, null, 16); }],
    bouillabaisse: ['fn', (b) => S.bowl(b, 0xd07a3a)], salt_baked_fish: ['fish', 3, 0xe8e2d6], ceviche: ['fn', (b) => S.bowl(b, 0xf0d0b0)], crab_soup: ['fn', (b) => S.bowl(b, 0xe08a5a)], shark_jerky: ['fn', (b) => S.stickbundle(b, 0x4a2a1a)], smoked_meat: ['fn', (b) => S.slab(b, 0x5a2a14, 0x3a1a0c)],
    roast_boar: ['fn', (b) => S.plate(b, 0, (bb) => { bb.sph(0.35, 0, 0.3, 0, col(0x7a3a18, { roughness: 0.5 }), 1.3, 0.8, 1, null, 16); bb.cyl(0.05, 0.05, 0.5, 0.45, 0.36, 0, col(0xe6dcc6), 8, 0, 0, 1.2); })], potato_soup: ['fn', (b) => S.bowl(b, 0xe8d8a8)], potato_chips: ['fn', (b) => S.pile(b, 0xe8c070, 12, 0.12)],
    grilled_pineapple: ['fn', (b) => S.skewer(b, 0xd8a030)], banana_fritter: ['fn', (b) => S.pile(b, 0xc88a30, 5, 0.22)], berry_jam: ['fn', (b) => S.jar(b, 0x6a1a3a, 0xd8ccb0)], mushroom_soup: ['fn', (b) => S.bowl(b, 0x9a7a5a)], nori: ['fn', (b) => { for (let i = 0; i < 3; i++) b.box(0.8, 0.02, 0.8, i * 0.06, 0.03 + i * 0.03, i * 0.05, col(0x1a2a1a, { roughness: 0.6 }), 0.3); }],
    kelp_noodles: ['fn', (b) => S.bowl(b, 0x4a6a2a)], fish_cake: ['fn', (b) => S.plate(b, 0, (bb) => { for (let i = 0; i < 3; i++) bb.cyl(0.18, 0.18, 0.1, -0.25 + i * 0.25, 0.1, 0, col(0xc8904a), 14); })], fish_pie: ['fn', (b) => { b.cyl(0.55, 0.45, 0.3, 0, 0.15, 0, col(0x8a5a30, { roughness: 0.7 }), 24); b.cyl(0.52, 0.52, 0.06, 0, 0.3, 0, col(0xe8c070, { roughness: 0.6 }), 24); }],
    smoothie: ['fn', (b) => S.bottle(b, 0xf0a050, 0x3a6a2a)], aloe_juice: ['fn', (b) => S.bottle(b, 0xb8e0a0)], pickled_fish: ['fn', (b) => S.jar(b, 0xd8d0a0, 0x6a6a6a)], survival_bar: ['fn', (b) => S.packet(b, 0x8a3a2a)], boiled_egg: ['fn', (b) => S.plate(b, 0, (bb) => bb.sph(0.24, 0, 0.28, 0, col(0xf4f0e8, { roughness: 0.4 }), 0.85, 1.1, 0.85, null, 16))],
    omelette: ['fn', (b) => S.plate(b, 0, (bb) => bb.sph(0.4, 0, 0.12, 0, col(0xf0c850, { roughness: 0.6 }), 1, 0.25, 0.8, null, 16))], fish_stock: ['fn', (b) => S.bowl(b, 0xe0d0a0)], coconut_curry: ['fn', (b) => S.bowl(b, 0xe0a030)],
    aloe_gel: ['fn', (b) => S.jar(b, 0x9ad08a)], tourniquet: ['fn', (b) => { S.roll(b, 0xc8402a); b.cyl(0.03, 0.03, 0.9, 0, 0.7, 0, col(0x9a7a4e), 8, 0, 0, Math.PI / 2); }], fever_tea: ['fn', (b) => S.bowl(b, 0x8a5a2a)], antibiotics: ['fn', (b) => { S.bottle(b, 0xe8e8e0, 0xffffff); }],
    sting_relief: ['fn', (b) => S.bottle(b, 0x9aa0a6)], bamboo_splint: ['fn', (b) => S.stickbundle(b, 0xc8b878)], tonic: ['fn', (b) => S.bottle(b, 0xd0603a, 0x9a7a4e)], trauma_kit: ['fn', (b) => S.kit(b, 0xc8402a)],
    axe_copper: ['hand', 'axe', 1, 0xc06a3c], pick_copper: ['hand', 'pick', 1, 0xc06a3c], dive_knife: ['hand', 'knife', 1], fillet_knife: ['hand', 'knife', 1], bone_spear: ['hand', 'spear', 0], trident: ['fn', (b) => { b.cyl(0.02, 0.02, 1.8, 0, 0.6, 0, col(0x5a4a3a), 8); b.box(0.36, 0.04, 0.04, 0, 1.5, 0, col(0xb8bec4, { metalness: 1, roughness: 0.25 }), 0); for (const x of [-0.17, 0, 0.17]) b.cyl(0.0, 0.025, 0.36, x, 1.7, 0, col(0xb8bec4, { metalness: 1, roughness: 0.25 }), 6); }],
    shark_spear: ['hand', 'spear', 1], longbow: ['hand', 'bow', 1], rod_steel: ['hand', 'rod', 1], hook_titanium: ['hand', 'hook', 1], oar: ['hand', 'paddle', 1], torch_resin: ['hand', 'torch', 1], hatchet_steel: ['hand', 'axe', 1], pick_titanium: ['hand', 'pick', 1],
    straw_hat: ['fn', (b) => S.hat(b, 0xd8c070)], scrap_helmet: ['fn', (b) => { b.sph(0.5, 0, 0.0, 0, col(0x7a7e82, { metalness: 0.8, roughness: 0.45 }), 1, 0.85, 1, null, 20); b.cyl(0.62, 0.62, 0.04, 0, 0.02, 0, col(0x6a6e72, { metalness: 0.8 }), 24); }], scrap_armor: ['fn', (b) => S.shirt(b, 0x7a7e82)], thermal_suit: ['fn', (b) => S.shirt(b, 0x2a4a6a)], oilskin: ['fn', (b) => S.shirt(b, 0x6a5a2a)],
    reef_shoes: ['fn', (b) => S.boot(b, 0x2a6a8a)], monofin: ['fn', (b) => { b.box(1.0, 0.06, 1.1, 0, 0.05, 0.2, col(0x1a5a9a, { roughness: 0.4 }), 0); for (const s of [-1, 1]) b.box(0.32, 0.22, 0.4, s * 0.2, 0.15, -0.3, col(0x222222), 0); }], steel_boots: ['fn', (b) => S.boot(b, 0x3a2a1a)],
    scuba_mask: ['fn', (b) => S.mask(b, 0x1a1a1a)], dive_helmet: ['fn', (b) => { b.sph(0.55, 0, 0.6, 0, col(0xc8904a, { metalness: 1, roughness: 0.3 }), 1, 1, 1, null, 24); b.cyl(0.6, 0.65, 0.2, 0, 0.1, 0, col(0xc8a050, { metalness: 1, roughness: 0.3 }), 24); b.cyl(0.2, 0.2, 0.08, 0, 0.62, 0.52, col(0x9fd6e0, { transparent: true, opacity: 0.6, roughness: 0.05 }), 20, Math.PI / 2); }],
    tank_titanium: ['fn', (b) => S.tank(b, 0xb8c0cc)], basket: ['fn', (b) => S.bowl(b, 0x9a8050)], duffel: ['fn', (b) => S.roll(b, 0x6a6a3a)],
    shark_jaw: ['fn', (b) => { const g = new THREE.TorusGeometry(0.5, 0.06, 8, 30, Math.PI * 1.4); b.add(g, col(0xe6dcc6, { roughness: 0.5 }), b.mat4(0, 0.55, 0, 0, 0, -0.85)); for (let i = 0; i < 14; i++) { const a = -0.85 + i / 13 * Math.PI * 1.4, cg = new THREE.ConeGeometry(0.05, 0.16, 3); b.add(cg, col(0xf4f0e6), b.mat4(Math.cos(a) * 0.44, 0.55 + Math.sin(a) * 0.44, 0, 0, 0, a + Math.PI / 2)); } }],
    shell_necklace: ['fn', (b) => ring3(b, 0xe8d8c8, 10, 0.4)], pearl_necklace: ['fn', (b) => ring3(b, 0xf2ecf0, 16, 0.42)], carved_idol: ['fn', (b) => { b.box(0.36, 0.8, 0.3, 0, 0.4, 0, col(0x6a4024, { roughness: 0.7 }), 0); b.sph(0.24, 0, 0.92, 0, col(0x6a4024, { roughness: 0.7 }), 1, 1.3, 0.9, null, 12); }],
    ship_bottle: ['fn', (b) => { S.bottle(b, 0xd8eef2); b.box(0.3, 0.1, 0.12, 0, 0.3, 0, col(0x6a4024), 0); b.box(0.02, 0.3, 0.2, 0, 0.5, 0, col(0xf0ece0), 0); }], coral_carving: ['fn', (b) => S.lump(b, 0xe88a70, 0.45)], obsidian_blade: ['fn', (b) => { const g = new THREE.ConeGeometry(0.2, 1.0, 4); g.scale(1, 1, 0.25); b.add(g, col(0x14121a, { roughness: 0.08, metalness: 0.2 }), b.mat4(0, 0.5, 0, 0, 0, 0.3)); }],
    dried_starfish: ['fn', (b) => { for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28, g = new THREE.ConeGeometry(0.13, 0.5, 6); g.rotateZ(-Math.PI / 2); b.add(g, col(0xe0904a, { roughness: 0.85 }), b.mat4(Math.cos(a) * 0.25, 0.06, Math.sin(a) * 0.25, 0, -a, 0)); } b.sph(0.15, 0, 0.08, 0, col(0xe0904a, { roughness: 0.85 }), 1, 0.5, 1, null, 12); }],
  });

  function buildFor(id) {
    const d = G.ITEMS[id]; if (!d) return null; const b = new G.MB(), t = T[id];
    try {
      if (t && t[0] === 'fn') { t[1](b); return b; }
      if (t && t[0] === 'node') { const gs = G.nodeGeo && G.nodeGeo[t[1]]; if (gs) { for (const k in gs) if (gs[k] && gs[k].isBufferGeometry) b.add(gs[k].clone(), k); return b; } }
      if (t && t[0] === 'model') { if (G.assets.addTo(b, t[1], { size: 1.0 })) return b; }
      if (t && t[0] === 'fish') { const g = G.fishGeo().clone(); const m = 'icn_fish' + (t[2] || ''); if (!G.mats[m]) { const mm = new THREE.MeshStandardMaterial({ map: rowTex(t[1]), color: t[2] || 0xffffff, roughness: t[2] ? 0.6 : 0.32, metalness: t[2] ? 0 : 0.15, side: THREE.DoubleSide }); G.mats[m] = mm; } b.add(g, m, b.mat4(0, 0.15, 0, 0, Math.PI / 2, 0, 1.6)); return b; }
      if (t && t[0] === 'hand' && G.HAND && G.HAND[t[1]]) { G.HAND[t[1]](b, t[2] > 0); if (t[3]) { for (const k in b.parts) if (k === 'steel' || k === 'metal') { b.parts[col(t[3], { metalness: 0.9, roughness: 0.35 })] = b.parts[k]; delete b.parts[k]; } } return b; }
      if (t && t[0] === 'crab') { const grp = G.creatureModels.crab(); G.crabPose(grp, 0, false, false); if (t[1]) grp.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.setHex(t[1]); } }); return grp; }
      if (d.tool && G.HAND && G.HAND[d.tool.type]) { G.HAND[d.tool.type](b, d.tool.tier > 0); return b; }
      const K = G.DEBRIS_KINDS; const dk = { plank: 'plank', plastic: 'plastic', rope: 'rope', cloth: 'cloth', scrap: 'scrap' }[id]; if (K && dk) { K[dk].m(b); return b; }
    } catch (e) { console.warn('icon model failed', id, e.message); }
    // category defaults
    const c = d.c; if (c === 'food') S.bowl(b, 0xc8a070); else if (c === 'med') S.jar(b, 0xd0d0d0); else if (c === 'gear') S.pack(b, 0x6a6a6a); else if (c === 'tool') S.kit(b, 0x6a6a6a); else S.lump(b, 0x8a8a8a, 0.45);
    return b;
  }
  // construction pieces: structural parts go through the real structure mesher, equipment through its own model
  function buildPiece(id) {
    const d = G.BUILD[id]; if (!d) return null;
    if (d.kind === 'item') { const M = G.ITEM_MODEL; if (!M) return null; const b = new G.MB(); (M[id] || M.chest)(b, { type: id, rot: 0, s: {} }); return b; }
    const st = Object.create(G.Structure.prototype); Object.assign(st, { kind: 'raft', tiles: new Map(), walls: new Map(), stairs: new Map(), roofs: new Map(), items: new Map(), group: new THREE.Group(), staticGroup: new THREE.Group(), sailOpen: false });
    if (d.kind === 'foundation') st.tiles.set('0,0,0', { type: id, hp: 100, max: 100 });
    else if (d.kind === 'floor') st.tiles.set('0,0,1', { type: id, hp: 100, max: 100 });
    else if (d.kind === 'wall') st.walls.set('0,0,0,0', { type: id, open: false });
    else if (d.kind === 'stairs') st.stairs.set('0,0,0', { dir: 0 });
    else if (d.kind === 'roof') st.roofs.set('0,0,0', {});
    st.rebuild(); const g = st.staticGroup; g.parent && g.parent.remove(g); return g;
  }
  let _rows = {};
  function rowTex(row) { if (_rows[row]) return _rows[row]; const a = G.fishAtlas(), img = a.image, h = img.height / G.FISH_SPECIES, cv = document.createElement('canvas'); cv.width = img.width; cv.height = h; cv.getContext('2d').drawImage(img, 0, -row * h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; return (_rows[row] = t); }

  ICON.renderAll = function () {
    // orthographic three-quarter view, framed tightly on the object's actual silhouette
    const r = G.render.renderer, scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100); cam.layers.enableAll();
    const pm = new THREE.PMREMGenerator(r), env = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environment = env; scene.environmentIntensity = 0.9;
    const key = new THREE.DirectionalLight(0xfff1e0, 2.6); key.position.set(2.2, 3.2, 2.4); scene.add(key);
    const rim = new THREE.DirectionalLight(0xc4dcff, 1.8); rim.position.set(-2.6, 1.4, -2.2); scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-1, -0.5, 3); scene.add(fill);
    const rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 4, type: THREE.HalfFloatType }), px = new Uint16Array(SIZE * SIZE * 4);
    const cv = document.createElement('canvas'); cv.width = cv.height = SIZE; const ctx = cv.getContext('2d'), img = ctx.createImageData(SIZE, SIZE);
    const prevT = r.getRenderTarget(), prevC = r.getClearColor(new THREE.Color()), prevA = r.getClearAlpha();
    r.setClearColor(0x000000, 0); const H = THREE.DataUtils.fromHalfFloat;
    const lin2srgb = (x) => { x = x * 1.1; x = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14); return Math.round(255 * Math.pow(Math.min(1, Math.max(0, x)), 1 / 2.2)); };
    const view = new THREE.Vector3(0, 0.5, 1).normalize(), right = new THREE.Vector3(1, 0, 0), up = new THREE.Vector3().crossVectors(view, right).normalize(), v = new THREE.Vector3();
    const jobs = Object.keys(G.ITEMS).map((id) => [id, () => buildFor(id)]).concat(Object.keys(G.BUILD).map((id) => ['b:' + id, () => buildPiece(id)]));
    const emit = G.emit; G.emit = () => {};
    for (const [id, make] of jobs) {
      let obj, own = true; try { const b = make(); if (!b) continue; own = !b.isObject3D; obj = own ? b.build({ shadow: false }) : b; } catch (e) { console.warn('icon build failed', id, e.message); continue; }
      const pivot = new THREE.Group(), roll = new THREE.Group(); pivot.add(obj); roll.add(pivot); pivot.rotation.set(0.0, -0.72, 0); scene.add(roll);
      let x0, x1, y0, y1, z0, z1;
      const measure = () => { roll.updateMatrixWorld(true); x0 = y0 = z0 = 1e9; x1 = y1 = z1 = -1e9; obj.traverse((o) => { if (!o.isMesh || !o.geometry) return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); const a = v.dot(right), c = v.dot(up), d = v.dot(view); if (a < x0) x0 = a; if (a > x1) x1 = a; if (c < y0) y0 = c; if (c > y1) y1 = c; if (d < z0) z0 = d; if (d > z1) z1 = d; } }); };
      measure();
      // long thin things (tools, rods, spears) read best laid corner to corner
      const asp = (y1 - y0) / Math.max(1e-4, x1 - x0); if (asp > 1.9 || asp < 1 / 1.9) { roll.quaternion.setFromAxisAngle(view, asp > 1 ? -Math.PI / 4 : Math.PI / 4); measure(); }
      if (x1 < x0) { scene.remove(roll); continue; }
      const half = Math.max(x1 - x0, y1 - y0) * 0.5 * 1.1, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half; cam.near = 0.01; cam.far = (z1 - z0) + 2; cam.updateProjectionMatrix();
      cam.position.copy(right).multiplyScalar(cx).addScaledVector(up, cy).addScaledVector(view, z1 + 1); cam.up.copy(up); cam.lookAt(v.copy(cam.position).sub(view));
      r.setRenderTarget(rt); r.clear(true, true, true); r.render(scene, cam); r.readRenderTargetPixels(rt, 0, 0, SIZE, SIZE, px);
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) { const s = ((SIZE - 1 - y) * SIZE + x) * 4, o = (y * SIZE + x) * 4, a = Math.min(1, Math.max(0, H(px[s + 3]))), ia = 1 / Math.max(a, 1e-3); img.data[o] = lin2srgb(H(px[s]) * ia); img.data[o + 1] = lin2srgb(H(px[s + 1]) * ia); img.data[o + 2] = lin2srgb(H(px[s + 2]) * ia); img.data[o + 3] = Math.round(a * 255); }
      ctx.putImageData(img, 0, 0); ICON.url[id] = cv.toDataURL('image/png');
      scene.remove(roll); if (own) obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    }
    G.emit = emit; r.setRenderTarget(prevT); r.setClearColor(prevC, prevA); rt.dispose(); env.dispose(); pm.dispose();
    // the interface reads .i into HTML everywhere: swap the emoji for the render (the emoji stays as .emoji)
    for (const id in ICON.url) { const d = id.startsWith('b:') ? G.BUILD[id.slice(2)] : G.ITEMS[id]; if (!d) continue; if (!d.emoji) d.emoji = d.i; d.i = `<img class="ico" src="${ICON.url[id]}" alt="" draggable="false">`; }
    ICON.ready = true;
  };
})();
