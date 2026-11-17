'use strict';
/* Placed equipment: models, state, interaction and simulation (cooking, water, power, farming, traps, lights). */
(function () {
  const G = window.G;
  const PI = Math.PI;
  // [halfX, height, halfZ] collider per item type
  G.itemDims = {
    campfire: [0.4, 0.3, 0.4], grill: [0.4, 0.9, 0.3], smoker: [0.4, 1.5, 0.4], rack: [0.6, 1.4, 0.2], collector: [0.5, 1.0, 0.5], still: [0.45, 0.6, 0.45], desalinator: [0.5, 1.2, 0.4],
    bed_leaf: [0.5, 0.25, 0.75], bed: [0.5, 0.6, 0.78], chest: [0.45, 0.55, 0.32], locker: [0.5, 1.6, 0.3], workbench: [0.7, 0.9, 0.35], research: [0.6, 0.9, 0.35], furnace: [0.55, 1.5, 0.55],
    machine_bench: [0.7, 1.0, 0.4], recycler: [0.5, 1.2, 0.45], composter: [0.4, 0.8, 0.4], compressor: [0.4, 0.9, 0.35], sail: [0.12, 2.2, 0.12], helm: [0.3, 1.1, 0.25], anchor: [0.35, 0.7, 0.35],
    engine: [0.35, 1.0, 0.45], nav_table: [0.6, 0.9, 0.4], radio: [0.35, 0.8, 0.25], weather_station: [0.12, 1.2, 0.12], solar: [0.6, 0.9, 0.5], turbine: [0.12, 2.2, 0.12], battery_bank: [0.45, 0.7, 0.3],
    generator: [0.45, 0.8, 0.35], planter: [0.65, 0.4, 0.45], fish_trap: [0.35, 0.5, 0.35], chair: [0.25, 0.5, 0.25], table: [0.55, 0.78, 0.4], shelf: [0.55, 1.5, 0.2]
  };
  const flames = [];

  const MODEL = {
    campfire(b) { for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; b.add(G.nodeGeo._rock0.rockObj, 'rockObj', b.mat4(Math.cos(a) * 0.38, 0.07, Math.sin(a) * 0.38, 0, a, 0, 0.13, 0.11, 0.13)); } for (let i = 0; i < 3; i++) b.cyl(0.05, 0.06, 0.6, 0, 0.1, 0, 'log', 6, 0, i * 1.05, 1.2); b.cyl(0.2, 0.25, 0.05, 0, 0.03, 0, 'dark', 8); },
    grill(b) { b.box(0.8, 0.08, 0.5, 0, 0.8, 0, 'metal'); for (const [x, z] of [[-0.35, -0.2], [0.35, -0.2], [-0.35, 0.2], [0.35, 0.2]]) b.cyl(0.025, 0.025, 0.8, x, 0.4, z, 'metal', 5); b.box(0.74, 0.14, 0.44, 0, 0.7, 0, 'dark'); for (let i = 0; i < 7; i++) b.box(0.015, 0.015, 0.48, -0.33 + i * 0.11, 0.85, 0, 'steel'); },
    smoker(b) { b.box(0.75, 1.3, 0.75, 0, 0.75, 0, 'woodDark'); b.box(0.85, 0.08, 0.85, 0, 1.44, 0, 'metal'); b.cyl(0.07, 0.07, 0.4, 0.2, 1.66, 0.2, 'metal', 6); b.box(0.5, 0.7, 0.03, 0, 0.8, 0.385, 'wood'); b.box(0.8, 0.1, 0.8, 0, 0.05, 0, 'stone'); },
    rack(b) { for (const x of [-0.55, 0.55]) { b.beam(x, 0, -0.2, x, 1.4, 0, 0.03, 'log', 5); b.beam(x, 0, 0.2, x, 1.4, 0, 0.03, 'log', 5); } for (const y of [1.38, 1.0, 0.62]) b.beam(-0.6, y, 0, 0.6, y, 0, 0.018, 'rope', 4); },
    collector(b) { for (const [x, z] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) b.cyl(0.03, 0.03, 1.0, x, 0.5, z, 'log', 5); b.box(0.95, 0.02, 0.5, -0.02, 0.92, -0.22, 'thatch', 0, 0.3); b.box(0.95, 0.02, 0.5, -0.02, 0.92, 0.22, 'thatch', 0, -0.3); b.cyl(0.26, 0.22, 0.42, 0, 0.21, 0, 'woodDark', 10); b.cyl(0.23, 0.23, 0.02, 0, 0.36, 0, 'glass', 10); },
    still(b) { b.box(0.8, 0.22, 0.8, 0, 0.11, 0, 'woodDark'); b.cyl(0.0, 0.52, 0.42, 0, 0.44, 0, 'glass', 4, 0, PI / 4); b.cyl(0.12, 0.1, 0.16, 0, 0.3, 0, 'plastic', 8); },
    desalinator(b) { b.box(0.9, 0.9, 0.7, 0, 0.45, 0, 'steel'); b.cyl(0.2, 0.2, 0.7, -0.15, 1.05, 0, 'plastic', 10); b.cyl(0.03, 0.03, 0.5, 0.25, 1.1, 0.1, 'copper', 5); b.box(0.2, 0.14, 0.02, 0.2, 0.6, 0.36, 'screen'); },
    bed_leaf(b) { b.box(0.95, 0.1, 1.5, 0, 0.05, 0, 'woodDark'); b.box(0.9, 0.12, 1.42, 0, 0.14, 0, 'thatch'); b.box(0.6, 0.1, 0.3, 0, 0.24, -0.52, 'fabricTan'); },
    bed(b) { b.box(1.0, 0.25, 1.56, 0, 0.3, 0, 'wood'); for (const [x, z] of [[-0.45, -0.72], [0.45, -0.72], [-0.45, 0.72], [0.45, 0.72]]) b.box(0.08, 0.6, 0.08, x, 0.3, z, 'woodDark'); b.box(0.92, 0.14, 1.46, 0, 0.48, 0, 'cloth'); b.box(0.92, 0.06, 0.9, 0, 0.56, 0.26, 'fabricBlue'); b.box(0.55, 0.1, 0.3, 0, 0.6, -0.5, 'cloth'); b.box(1.0, 0.5, 0.06, 0, 0.65, -0.78, 'woodDark'); },
    chest(b) { if (G.assets.addTo(b, 'crate2', { size: 0.88 }, 0, 0, 0)) return; b.box(0.86, 0.42, 0.6, 0, 0.21, 0, 'wood'); b.box(0.9, 0.14, 0.64, 0, 0.48, 0, 'woodDark'); for (const x of [-0.3, 0.3]) b.box(0.07, 0.57, 0.66, x, 0.28, 0, 'metal'); b.box(0.1, 0.12, 0.03, 0, 0.4, 0.32, 'brass'); },
    locker(b) { b.box(1.0, 1.6, 0.56, 0, 0.8, 0, 'woodDark'); b.box(0.46, 1.5, 0.03, -0.24, 0.8, 0.29, 'metal'); b.box(0.46, 1.5, 0.03, 0.24, 0.8, 0.29, 'metal'); b.box(0.03, 0.2, 0.04, -0.04, 0.85, 0.31, 'brass'); b.box(0.03, 0.2, 0.04, 0.04, 0.85, 0.31, 'brass'); },
    workbench(b) { b.box(1.4, 0.09, 0.7, 0, 0.86, 0, 'wood'); for (const [x, z] of [[-0.62, -0.28], [0.62, -0.28], [-0.62, 0.28], [0.62, 0.28]]) b.box(0.09, 0.82, 0.09, x, 0.41, z, 'woodDark'); b.box(1.3, 0.05, 0.6, 0, 0.25, 0, 'woodDark'); b.box(0.2, 0.14, 0.16, -0.45, 0.97, -0.15, 'metal'); b.box(0.04, 0.04, 0.4, 0.3, 0.92, 0.05, 'woodDark', 0.5); b.box(0.12, 0.07, 0.07, 0.38, 0.93, 0.2, 'metal', 0.5); b.box(1.4, 0.6, 0.04, 0, 1.25, -0.33, 'woodDark'); },
    research(b) { b.box(1.2, 0.07, 0.7, 0, 0.84, 0, 'woodDark'); for (const [x, z] of [[-0.52, -0.28], [0.52, -0.28], [-0.52, 0.28], [0.52, 0.28]]) b.box(0.07, 0.82, 0.07, x, 0.41, z, 'wood'); b.cyl(0.05, 0.07, 0.2, -0.35, 0.98, -0.1, 'glass', 8); b.cyl(0.04, 0.04, 0.26, -0.2, 1.0, -0.15, 'glass', 8); b.box(0.3, 0.02, 0.4, 0.25, 0.89, 0.05, 'cloth', 0.2); b.cyl(0.03, 0.06, 0.3, 0.42, 1.0, -0.2, 'brass', 6); b.sph(0.07, 0.42, 1.2, -0.2, 'lamp', 1, 1, 1, null, 6); },
    furnace(b) { b.cyl(0.42, 0.55, 1.15, 0, 0.58, 0, 'stone', 10); b.cyl(0.2, 0.36, 0.5, 0, 1.38, 0, 'stone', 8); b.box(0.36, 0.3, 0.1, 0, 0.42, 0.5, 'dark'); b.box(0.3, 0.22, 0.04, 0, 0.42, 0.53, 'ember'); },
    machine_bench(b) { b.box(1.4, 0.1, 0.8, 0, 0.9, 0, 'steel'); b.box(1.3, 0.8, 0.7, 0, 0.42, 0, 'metal'); b.box(0.3, 0.4, 0.3, -0.4, 1.15, -0.15, 'steel'); b.cyl(0.1, 0.1, 0.06, -0.4, 1.38, -0.15, 'brass', 10); b.box(0.36, 0.26, 0.04, 0.35, 1.12, -0.3, 'screen'); b.cyl(0.03, 0.03, 0.5, 0.1, 1.2, 0.1, 'steel', 5, 0.5); },
    recycler(b) { b.box(1.0, 1.0, 0.9, 0, 0.5, 0, 'metal'); b.box(0.7, 0.3, 0.6, 0, 1.12, 0, 'steel', 0, 0, 0); b.cyl(0.12, 0.12, 0.74, 0, 1.05, 0, 'dark', 8, 0, 0, PI / 2); b.box(0.2, 0.14, 0.02, 0.3, 0.7, 0.46, 'screen'); },
    composter(b) { b.cyl(0.38, 0.34, 0.78, 0, 0.4, 0, 'woodDark', 10); b.cyl(0.4, 0.4, 0.04, 0, 0.3, 0, 'metal', 10); b.cyl(0.4, 0.4, 0.04, 0, 0.62, 0, 'metal', 10); b.cyl(0.33, 0.33, 0.02, 0, 0.74, 0, 'soil', 10); },
    compressor(b) { b.cyl(0.22, 0.22, 0.7, 0, 0.42, 0, 'plasticRed', 10, 0, 0, PI / 2); b.box(0.4, 0.3, 0.3, 0, 0.78, 0, 'steel'); b.box(0.7, 0.08, 0.5, 0, 0.1, 0, 'dark'); b.cyl(0.02, 0.02, 0.5, 0.3, 0.7, 0.15, 'rubber', 5, 0.8); b.cyl(0.07, 0.07, 0.03, 0, 0.82, 0.16, 'brass', 8, PI / 2); },
    sail(b) { b.cyl(0.07, 0.1, 4.6, 0, 2.3, 0, 'log', 8); b.box(0.5, 0.08, 0.5, 0, 0.04, 0, 'woodDark'); b.beam(-1.3, 4.3, 0, 1.3, 4.3, 0, 0.045, 'log', 6); b.beam(-1.3, 1.2, 0, 1.3, 1.2, 0, 0.04, 'log', 6); b.beam(0, 4.5, 0, 0.7, 0.05, 0.7, 0.012, 'rope', 4); b.beam(0, 4.5, 0, -0.7, 0.05, 0.7, 0.012, 'rope', 4); },
    helm(b) { b.box(0.36, 0.9, 0.3, 0, 0.45, 0, 'woodDark'); const g = new THREE.TorusGeometry(0.32, 0.03, 6, 16); b.add(g, 'wood', b.mat4(0, 1.02, 0.2, 0, 0, 0)); for (let i = 0; i < 6; i++) { const a = i / 6 * PI; b.beam(Math.cos(a) * 0.4, 1.02 + Math.sin(a) * 0.4, 0.2, -Math.cos(a) * 0.4, 1.02 - Math.sin(a) * 0.4, 0.2, 0.018, 'wood', 4); } b.cyl(0.05, 0.05, 0.14, 0, 1.02, 0.14, 'brass', 8, PI / 2); },
    anchor(b) { b.cyl(0.26, 0.26, 0.4, 0, 0.3, 0, 'woodDark', 10, 0, 0, PI / 2); b.cyl(0.3, 0.3, 0.03, -0.2, 0.3, 0, 'wood', 10, 0, 0, PI / 2); b.cyl(0.3, 0.3, 0.03, 0.2, 0.3, 0, 'wood', 10, 0, 0, PI / 2); b.cyl(0.22, 0.22, 0.34, 0, 0.3, 0, 'rope', 10, 0, 0, PI / 2); b.box(0.5, 0.08, 0.5, 0, 0.04, 0, 'woodDark'); b.add(G.nodeGeo._rock1.rockObj, 'rockObj', b.mat4(0.05, 0.62, 0.05, 0, 0, 0, 0.2, 0.16, 0.18)); },
    engine(b) { b.box(0.5, 0.5, 0.6, 0, 0.75, 0, 'steel'); b.box(0.42, 0.14, 0.5, 0, 1.06, 0, 'plasticRed'); b.cyl(0.05, 0.05, 1.1, 0, 0.1, 0.35, 'metal', 6); b.box(0.6, 0.5, 0.1, 0, 0.3, 0.1, 'metal'); b.cyl(0.03, 0.03, 0.6, 0.15, 1.1, -0.45, 'dark', 5, 1.1); const g = new THREE.TorusGeometry(0.13, 0.03, 5, 10); b.add(g, 'brass', b.mat4(0, -0.42, 0.42, 0, 0, 0)); },
    nav_table(b) { b.box(1.2, 0.07, 0.8, 0, 0.84, 0, 'wood'); for (const [x, z] of [[-0.52, -0.32], [0.52, -0.32], [-0.52, 0.32], [0.52, 0.32]]) b.box(0.08, 0.82, 0.08, x, 0.41, z, 'woodDark'); b.box(0.9, 0.012, 0.6, 0, 0.885, 0, 'cloth', 0.08); b.cyl(0.09, 0.09, 0.04, 0.35, 0.91, 0.2, 'brass', 12); b.cyl(0.02, 0.02, 0.3, -0.3, 0.9, -0.2, 'brass', 5, PI / 2, 0.6); },
    radio(b) { b.box(0.6, 0.5, 0.36, 0, 0.25, 0, 'woodDark'); b.box(0.52, 0.3, 0.3, 0, 0.66, 0, 'metal'); b.box(0.2, 0.12, 0.02, -0.12, 0.68, 0.155, 'screen'); b.cyl(0.035, 0.035, 0.03, 0.14, 0.72, 0.16, 'brass', 8, PI / 2); b.cyl(0.035, 0.035, 0.03, 0.14, 0.6, 0.16, 'brass', 8, PI / 2); b.cyl(0.008, 0.012, 1.3, 0.2, 1.45, -0.1, 'steel', 4, 0, 0, -0.12); },
    weather_station(b) { b.cyl(0.03, 0.04, 2.0, 0, 1.0, 0, 'steel', 6); b.box(0.18, 0.24, 0.12, 0, 1.2, 0.06, 'plastic'); b.beam(-0.3, 2.0, 0, 0.3, 2.0, 0, 0.012, 'steel', 4); b.sph(0.05, -0.3, 2.0, 0, 'brass', 1, 1, 1, null, 6); b.sph(0.05, 0.3, 2.0, 0, 'brass', 1, 1, 1, null, 6); b.box(0.3, 0.12, 0.01, 0.1, 1.78, 0, 'plasticRed'); b.box(0.5, 0.06, 0.5, 0, 0.03, 0, 'woodDark'); },
    solar(b) { b.box(1.2, 0.04, 0.9, 0, 0.75, 0, 'dark', 0, -0.45); b.box(1.1, 0.02, 0.8, 0, 0.775, 0.01, 'solarCell', 0, -0.45); b.cyl(0.03, 0.03, 0.7, -0.4, 0.38, -0.1, 'steel', 5); b.cyl(0.03, 0.03, 0.7, 0.4, 0.38, -0.1, 'steel', 5); b.box(1.0, 0.05, 0.6, 0, 0.03, 0, 'metal'); },
    turbine(b) { b.cyl(0.05, 0.08, 4.0, 0, 2.0, 0, 'steel', 8); b.box(0.5, 0.08, 0.5, 0, 0.04, 0, 'metal'); b.box(0.16, 0.16, 0.5, 0, 4.0, 0, 'steel'); },
    battery_bank(b) { b.box(0.9, 0.12, 0.56, 0, 0.06, 0, 'woodDark'); for (let i = 0; i < 3; i++) { b.box(0.26, 0.5, 0.46, -0.3 + i * 0.3, 0.37, 0, 'dark'); b.cyl(0.03, 0.03, 0.06, -0.36 + i * 0.3, 0.65, 0, 'copper', 6); b.cyl(0.03, 0.03, 0.06, -0.24 + i * 0.3, 0.65, 0, 'brass', 6); } },
    generator(b) { b.box(0.86, 0.5, 0.6, 0, 0.4, 0, 'plasticYellow'); b.box(0.9, 0.08, 0.64, 0, 0.08, 0, 'dark'); b.cyl(0.14, 0.14, 0.3, -0.2, 0.75, 0, 'steel', 10); b.cyl(0.03, 0.03, 0.5, 0.3, 0.85, 0.2, 'metal', 5); b.box(0.2, 0.12, 0.02, 0.2, 0.45, 0.31, 'screen'); },
    planter(b) { b.box(1.3, 0.32, 0.9, 0, 0.16, 0, 'woodDark'); b.box(1.2, 0.04, 0.8, 0, 0.32, 0, 'soil'); },
    fish_trap(b) { for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; b.beam(Math.cos(a) * 0.3, 0.02, Math.sin(a) * 0.3, Math.cos(a) * 0.3, 0.5, Math.sin(a) * 0.3, 0.012, 'log', 4); } for (const y of [0.03, 0.26, 0.5]) { const g = new THREE.TorusGeometry(0.3, 0.014, 4, 14); b.add(g, 'rope', b.mat4(0, y, 0, PI / 2, 0, 0)); } b.beam(0, 0.5, 0, 0.25, 0.02, 0.6, 0.01, 'rope', 4); },
    lantern(b) { b.cyl(0.07, 0.09, 0.04, 0, 0.02, 0, 'metal', 8); b.cyl(0.06, 0.06, 0.16, 0, 0.12, 0, 'glass', 8); b.cyl(0.02, 0.08, 0.06, 0, 0.23, 0, 'metal', 8); },
    torch_post(b) { b.cyl(0.03, 0.04, 1.5, 0, 0.75, 0, 'log', 6); b.cyl(0.07, 0.04, 0.16, 0, 1.55, 0, 'rope', 7); },
    chair(b) { b.box(0.46, 0.05, 0.46, 0, 0.46, 0, 'wood'); for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) b.box(0.05, 0.46, 0.05, x, 0.23, z, 'woodDark'); b.box(0.46, 0.5, 0.05, 0, 0.74, -0.21, 'wood'); },
    table(b) { b.box(1.1, 0.06, 0.8, 0, 0.75, 0, 'wood'); for (const [x, z] of [[-0.48, -0.33], [0.48, -0.33], [-0.48, 0.33], [0.48, 0.33]]) b.box(0.07, 0.74, 0.07, x, 0.37, z, 'woodDark'); },
    shelf(b) { b.box(0.06, 1.5, 0.36, -0.52, 0.75, 0, 'woodDark'); b.box(0.06, 1.5, 0.36, 0.52, 0.75, 0, 'woodDark'); for (const y of [0.1, 0.55, 1.0, 1.45]) b.box(1.04, 0.05, 0.36, 0, y, 0, 'wood'); b.box(0.2, 0.2, 0.2, -0.25, 0.68, 0, 'fabricTan'); b.cyl(0.07, 0.07, 0.22, 0.2, 1.14, 0, 'glass', 8); },
    rug(b) { b.box(1.3, 0.02, 0.9, 0, 0.012, 0, 'fabricRed'); b.box(1.1, 0.022, 0.7, 0, 0.013, 0, 'fabricTan'); b.box(0.8, 0.024, 0.4, 0, 0.014, 0, 'fabricBlue'); },
    plant_pot(b) { b.cyl(0.16, 0.11, 0.24, 0, 0.12, 0, 'soil', 9, 0, 0, 0, [2.4, 1.2, 0.8]); for (let i = 0; i < 6; i++) { const g = new THREE.PlaneGeometry(0.22, 0.75); g.translate(0, 0.37, 0); G.tintGeo(g, () => [0.7, 1.1, 0.6]); b.add(g, 'canopy', b.mat4(0, 0.22, 0, 0.55, i / 6 * 6.28, 0)); } },
    trophy(b) { b.box(0.7, 0.34, 0.04, 0, 1.3, 0, 'woodDark'); b.sph(0.12, 0, 1.3, 0.06, 'fish', 2.3, 0.9, 0.5, [0.6, 0.75, 0.9], 8); b.cyl(0.02, 0.02, 1.15, 0, 0.575, 0, 'log', 5); b.box(0.3, 0.05, 0.3, 0, 0.025, 0, 'woodDark'); },
    flag(b) { b.cyl(0.025, 0.03, 2.6, 0, 1.3, 0, 'log', 6); b.box(0.3, 0.05, 0.3, 0, 0.025, 0, 'woodDark'); }
  };

  G.ITEM_MODEL = MODEL;
  const I = G.items = {
    lights: [],
    initState(type) {
      const d = G.BUILD[type], s = {};
      if (d.proc) { s.in = []; s.out = []; s.burn = 0; s.fuel = null; }
      if (d.store) s.c = { slots: new Array(d.store).fill(null) };
      if (d.water) s.w = type === 'collector' ? 1 : 0;
      if (d.engine || d.gen) { s.fuel = 0; s.on = false; }
      if (d.planter) { s.crop = null; s.g = 0; s.water = 0.5; s.fert = 0; }
      if (d.trap) s.catch = [];
      if (d.light && !d.proc) s.on = true;
      return s;
    },
    model(it) {
      const b = new G.MB(); (MODEL[it.type] || MODEL.chest)(b, it); const g = b.build();
      const d = G.BUILD[it.type];
      if (it.type === 'sail') {
        const geo = new THREE.PlaneGeometry(2.5, 3.0, 6, 6); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, -Math.sin((p.getX(i) / 2.5 + 0.5) * PI) * 0.35 * Math.sin((p.getY(i) / 3 + 0.5) * PI)); geo.computeVertexNormals();
        const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.5, uv.getY(i) * 3);
        it.cloth = new THREE.Mesh(geo, G.mats.cloth); it.cloth.position.set(0, 2.75, 0); it.cloth.castShadow = true; g.add(it.cloth);
        it.furl = new THREE.Mesh(G.geo.cyl(0.1, 0.1, 2.5, 7), G.mats.cloth); it.furl.rotation.z = PI / 2; it.furl.position.set(0, 4.18, 0); g.add(it.furl);
      }
      if (it.type === 'turbine') { const rb = new G.MB(); for (let i = 0; i < 3; i++) rb.box(0.12, 1.3, 0.03, Math.sin(i * 2.094) * 0.65, Math.cos(i * 2.094) * 0.65, 0, 'cloth', 0, 0, -i * 2.094); it.rotor = rb.build(); it.rotor.position.set(0, 4.0, 0.28); g.add(it.rotor); }
      if (it.type === 'flag') { const geo = new THREE.PlaneGeometry(0.9, 0.55, 6, 2); geo.translate(0.47, 0, 0); it.flag = new THREE.Mesh(geo, G.mats.fabricRed); it.flag.position.set(0, 2.25, 0); g.add(it.flag); }
      if (it.type === 'planter') { it.plant = new THREE.Group(); it.plant.position.y = 0.34; g.add(it.plant); }
      if (d.light || d.proc === 'fire' || it.type === 'furnace' || it.type === 'smoker') {
        const y = { campfire: 0.35, grill: 0.72, furnace: 0.45, smoker: 0.25, lantern: 0.13, torch_post: 1.72 }[it.type] || 0.4;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.dot, color: 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        sp.position.set(0, y, it.type === 'furnace' ? 0.5 : 0); sp.layers.set(1); sp.userData.base = it.type === 'lantern' ? 0.3 : it.type === 'torch_post' ? 0.5 : 0.8; g.add(sp); it.flame = sp; flames.push(it);
      }
      return g;
    },
    ghost(type, mat) { const b = new G.MB(); (MODEL[type] || MODEL.chest)(b, { type }); return b.build({ override: mat, shadow: false }); },
    burning(it) { const d = G.BUILD[it.type]; if (d.proc && d.fueled) return it.s.burn > 0; return it.s.on !== false; },
    refresh(it) {
      const st = it.struct;
      if (it.type === 'sail') { it.cloth.visible = st.sailOpen; it.furl.visible = !st.sailOpen; }
      if (it.flame) it.flame.visible = this.burning(it);
      if (it.type === 'planter') {
        while (it.plant.children.length) { const c = it.plant.children.pop(); c.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
        if (it.s.crop) {
          const b = new G.MB(), g = Math.max(0.15, it.s.g), col = it.s.g >= 1 ? [0.9, 1.3, 0.6] : [0.6, 1.0, 0.5];
          for (let i = 0; i < 6; i++) { const x = -0.42 + (i % 3) * 0.42, z = i < 3 ? -0.2 : 0.2; for (let k = 0; k < 4; k++) { const ge = new THREE.PlaneGeometry(0.16, 0.5 * g); ge.translate(0, 0.25 * g, 0); G.tintGeo(ge, () => col); b.add(ge, 'canopy', b.mat4(x, 0, z, 0.4, k * 1.57 + i, 0)); } if (it.s.g >= 1) b.sph(0.06, x, 0.3, z, 'canopy', 1, 1, 1, [2.2, 1.6, 0.4], 5); }
          it.plant.add(b.build({ shadow: false }));
        }
      }
    },
    label(it) {
      const d = G.BUILD[it.type], s = it.s, st = it.struct;
      if (d.proc) { const busy = s.in.filter((x) => x).length, done = s.out.filter((x) => x).length; return d.n + (done ? ' — ready to collect' : busy ? (d.fueled && s.burn <= 0 && !s.fuel ? ' — needs fuel' : ' — working') : ''); }
      if (d.water) return d.n + ' — ' + Math.floor(s.w) + '/' + d.water + ' water';
      if (d.sail) return st.sailOpen ? 'Furl sail' : 'Set sail';
      if (d.anchor) return st.anchored ? 'Weigh anchor' : 'Drop anchor';
      if (d.helm) return 'Take the helm';
      if (d.engine) return 'Engine — fuel ' + Math.round(s.fuel) + '%';
      if (d.gen) return 'Generator ' + (s.on ? 'ON' : 'OFF') + ' — fuel ' + Math.round(s.fuel) + '%';
      if (d.bed) return 'Sleep'; if (d.store) return 'Open ' + d.n.toLowerCase();
      if (d.planter) { if (!s.crop) return 'Grow bed — empty'; const c = G.CROPS[s.crop]; return s.g >= 1 ? 'Harvest ' + c.name.toLowerCase() : c.name + ' — ' + Math.round(s.g * 100) + '%' + (s.water < 0.15 ? ' (dry!)' : ''); }
      if (d.trap) return 'Fish trap — ' + s.catch.length + ' caught';
      if (d.radio) return s.broken ? 'Damaged radio' : 'Listen to radio';
      if (d.research) return 'Research'; if (d.nav) return 'Study chart'; if (d.compressor) return 'Refill air tank';
      if (d.forecast) return 'Read forecast'; if (d.solar || d.wind || d.cap) return d.n + ' — bank ' + Math.round(st.energy) + '/' + Math.round(st.cap);
      if (d.station) return 'Use ' + d.n.toLowerCase(); if (d.light) return (s.on ? 'Douse ' : 'Light ') + d.n.toLowerCase();
      return d.n;
    },
    use(it) {
      const d = G.BUILD[it.type], s = it.s, st = it.struct, P = G.player, inv = G.inv, held = inv.held();
      if (d.proc) return G.ui.open('processor', it);
      if (d.store) return G.ui.open('storage', it);
      if (d.research) return G.ui.open('research', it);
      if (d.station) return G.ui.open('craft', it);
      if (d.water) {
        if (s.w < 1) return G.ui.toast(d.n + ' is empty.' + (it.type === 'collector' ? ' It fills when it rains.' : ' It needs power.'));
        if (held && held.id === 'bottle') { inv.removeAt(inv.sel, 1); inv.add('bottle_fresh', 1); s.w -= 1; G.audio.sfx('water'); G.ui.toast('Filled a flask with fresh water.'); }
        else { s.w -= 1; P.drink(40, 'fresh'); }
        return;
      }
      if (d.sail) { st.sailOpen = !st.sailOpen; for (const o of st.items.values()) if (o.type === 'sail') this.refresh(o); G.audio.sfx('sail'); G.emit('sail', st.sailOpen); return; }
      if (d.anchor) { st.anchored = !st.anchored; G.audio.sfx(st.anchored ? 'splash' : 'rope'); G.ui.toast(st.anchored ? 'Anchor down. The raft will hold here.' : 'Anchor up.'); G.emit('anchor', st.anchored); return; }
      if (d.helm) return P.takeHelm(st, it);
      if (d.engine || d.gen) {
        if (held && held.id === 'fuel' && s.fuel < 95) { inv.removeAt(inv.sel, 1); s.fuel = Math.min(100, s.fuel + 50); G.audio.sfx('water'); return G.ui.toast('Added fuel.'); }
        if (d.gen) { if (s.fuel <= 0) return G.ui.toast('The generator needs biofuel. Hold a can and interact.'); s.on = !s.on; return G.ui.toast('Generator ' + (s.on ? 'started.' : 'stopped.')); }
        return G.ui.toast(s.fuel > 0 ? 'Take the helm and use W/S for throttle.' : 'The engine needs biofuel. Hold a can and interact.');
      }
      if (d.bed) return G.ui.open('sleep', it);
      if (d.planter) return this.usePlanter(it);
      if (d.trap) { if (!s.catch.length) return G.ui.toast('The trap is empty. It fills while the raft floats in open water.'); for (const id of s.catch) inv.add(id, 1); G.ui.toast('Emptied the trap: ' + s.catch.length + ' caught.'); G.skills.xp('fishing', 4 * s.catch.length); s.catch = []; G.audio.sfx('pickup'); return; }
      if (d.radio) return G.quests.useRadio(it);
      if (d.nav) return G.ui.open('map');
      if (d.forecast) return G.ui.toast('Barometer: ' + G.wsim.forecastText());
      if (d.compressor) {
        const tank = inv.equip.back; if (!tank || !G.ITEMS[tank.id].air) return G.ui.toast('Wear an air tank to refill it.');
        if (!st.powered) return G.ui.toast('The compressor has no power.'); tank.air = G.ITEMS[tank.id].air; G.audio.sfx('hiss'); return G.ui.toast('Tank filled.');
      }
      if (d.light) { s.on = !s.on; this.refresh(it); return; }
      if (it.type === 'chair') { P.energy = Math.min(100, P.energy + 4); return G.ui.toast('You rest a moment and watch the water.'); }
      if (it.type === 'trophy') { const b = G.journal.bestCatch(); return G.ui.toast(b ? 'Best catch: ' + b.name + ', ' + b.cm + ' cm.' : 'Nothing mounted yet. Go fishing.'); }
      if (d.solar || d.wind || d.cap) return G.ui.toast('Power: ' + (st.powerNet >= 0 ? '+' : '') + st.powerNet.toFixed(1) + ' / stored ' + Math.round(st.energy) + ' of ' + Math.round(st.cap));
    },
    usePlanter(it) {
      const s = it.s, inv = G.inv, held = inv.held();
      if (s.crop && s.g >= 1) {
        const c = G.CROPS[s.crop], n = Math.round(G.lerp(c.q[0], c.q[1], Math.random()) * (s.fert ? 1.5 : 1)); inv.add(c.out, n); if (Math.random() < 0.6) inv.add(Object.keys(G.ITEMS).find((k) => G.ITEMS[k].crop === s.crop), 1);
        G.ui.toast('Harvested ' + n + ' ' + G.ITEMS[c.out].n + '.'); s.crop = null; s.g = 0; s.fert = 0; this.refresh(it); G.skills.xp('survival', 10); G.emit('harvestCrop', c.out); G.audio.sfx('pickup'); return;
      }
      if (held) {
        const def = G.ITEMS[held.id];
        if (def.crop && !s.crop) { inv.removeAt(inv.sel, 1); s.crop = def.crop; s.g = 0; this.refresh(it); G.audio.sfx('plant'); G.emit('planted', def.crop); return G.ui.toast('Planted ' + G.CROPS[def.crop].name.toLowerCase() + '. Keep it watered.'); }
        if (held.id === 'bottle_fresh') { inv.removeAt(inv.sel, 1); inv.add('bottle', 1); s.water = 1; G.audio.sfx('water'); return G.ui.toast('Watered.'); }
        if (held.id === 'fertilizer' && !s.fert) { inv.removeAt(inv.sel, 1); s.fert = 1; return G.ui.toast('Compost worked in: faster growth and a bigger harvest.'); }
      }
      if (!s.crop) return G.ui.toast('Hold seeds or cuttings and interact to plant.');
      G.ui.toast(G.CROPS[s.crop].name + ': ' + Math.round(s.g * 100) + '% grown, soil ' + (s.water > 0.5 ? 'moist' : s.water > 0.15 ? 'drying' : 'dry — hold a flask of fresh water and interact') + '.');
    },
    // dt-step for one structure's equipment
    simulate(st, dt) {
      const W = G.weather; let prod = 0, cons = 0, cap = 20; st.lightItems = [];
      const roofed = (it) => st.roofs.has(st.key(it.ix, it.iz, it.lv)) || st.hasFloor(it.ix, it.iz, it.lv + 1);
      for (const it of st.items.values()) {
        const d = G.BUILD[it.type], s = it.s;
        if (d.solar) prod += d.power * G.sky.dayLight * (1 - W.cloud * 0.5);
        if (d.wind) { prod += d.power * G.clamp(W.wind * 1.4, 0.1, 1.6); }
        if (d.gen && s.on) { if (s.fuel > 0) { s.fuel -= dt / 6; prod += d.power; } else s.on = false; }
        if (d.cap) cap += d.cap;
      }
      for (const it of st.items.values()) {
        const d = G.BUILD[it.type], s = it.s; const needs = d.power < 0;
        const active = needs && ((d.proc && s.in.some((x) => x)) || (d.water && s.w < d.water));
        if (active) cons += -d.power;
      }
      st.energy = G.clamp(st.energy + (prod - cons) * dt, 0, cap); st.cap = cap; st.powerNet = prod - cons; st.powered = st.energy > 0.2 || prod >= cons && prod > 0;
      for (const it of st.items.values()) {
        const d = G.BUILD[it.type], s = it.s;
        if (d.proc) this.process(it, d, s, dt, st);
        if (it.type === 'collector' && !roofed(it)) s.w = Math.min(d.water, s.w + dt * (W.rain * 0.035 + 0.0012));
        if (it.type === 'desalinator' && st.powered) s.w = Math.min(d.water, s.w + dt * 0.03);
        if (d.planter && s.crop) {
          if (W.rain > 0.2 && !roofed(it)) s.water = 1; s.water = Math.max(0, s.water - dt / 900);
          if (s.g < 1 && s.water > 0.05) { const c = G.CROPS[s.crop]; const was = s.g; s.g = Math.min(1, s.g + dt / (c.days * 1440) * (s.fert ? 1.6 : 1) * (0.5 + G.sky.dayLight * 0.8)); if (Math.floor(was * 4) !== Math.floor(s.g * 4)) this.refresh(it); }
        }
        if (d.trap && st.kind === 'raft' && s.catch.length < 4) { s.t = (s.t || 0) + dt; if (s.t > 110) { s.t = 0; if (G.world.height(st.pos.x, st.pos.z) < -3) s.catch.push(Math.random() < 0.72 ? 'raw_fish' : 'raw_crab'); } }
        if (d.light) { if (d.proc ? s.burn > 0 : s.on) st.lightItems.push(it); }
      }
    },
    process(it, d, s, dt, st) {
      const recs = G.PROCESS[d.proc]; let working = false; const wasBurning = s.burn > 0;
      if (d.power < 0 && !st.powered) return;
      for (let i = 0; i < d.slots; i++) {
        const stack = s.in[i]; if (!stack) continue;
        const r = recs.find((x) => x[0] === stack.id); if (!r || stack.n < r[1]) continue;
        if (s.out[i] && (s.out[i].id !== r[2] || s.out[i].n + r[3] > G.ITEMS[r[2]].s)) continue;
        if (d.fueled && s.burn <= 0) { if (s.fuel && s.fuel.n > 0) { s.burn += G.ITEMS[s.fuel.id].fuel; s.fuel.n--; if (s.fuel.n <= 0) s.fuel = null; } else continue; }
        working = true;
        let speed = (d.speed || 1) * (1 + G.skills.level('cooking') * 0.05); if (d.proc === 'rack' || d.proc === 'still') speed *= 0.35 + G.sky.dayLight * 1.0 + G.weather.wind * 0.3;
        stack.t = (stack.t || 0) + dt * speed;
        if (stack.t >= r[4]) {
          stack.t = 0; stack.n -= r[1]; if (stack.n <= 0) s.in[i] = null;
          if (s.out[i]) s.out[i].n += r[3]; else s.out[i] = { id: r[2], n: r[3], made: G.time.now() };
          if (G.ITEMS[stack.id].returns && r[2] !== 'bottle_fresh') { /* flask consumed by evaporation */ }
          G.emit('processed', r[2], it); if (d.proc === 'fire') G.skills.xp('cooking', 5);
        }
      }
      if (d.fueled && s.burn > 0) s.burn = Math.max(0, s.burn - dt * (working ? 1 : 0.5));
      if ((s.burn > 0) !== wasBurning) this.refresh(it);
    },
    // per-frame visual animation (flames, rotors, flags)
    animate(t, dt) {
      for (let i = flames.length - 1; i >= 0; i--) {
        const it = flames[i]; if (!it.group.parent) { flames.splice(i, 1); continue; }
        if (it.flame.visible) { const f = it.flame.userData.base * (0.85 + 0.25 * Math.sin(t * 13 + i * 3) * Math.sin(t * 7.3 + i)); it.flame.scale.set(f, f * 1.3, 1); }
      }
      for (const st of G.structs.list) for (const it of st.items.values()) {
        if (it.rotor) it.rotor.rotation.z -= dt * (1 + G.weather.wind * 9);
        if (it.flag) { const p = it.flag.geometry.attributes.position; for (let k = 0; k < p.count; k++) p.setZ(k, Math.sin(p.getX(k) * 6 - t * (4 + G.weather.wind * 6)) * 0.07 * p.getX(k) * (0.5 + G.weather.wind)); p.needsUpdate = true; it.flag.rotation.y = -st.yaw - G.weather.windDir; }
        if (it.cloth && it.cloth.visible) { it.cloth.scale.z = 0.6 + G.weather.wind * 0.9 + Math.sin(t * 2.2) * 0.08; }
      }
    }
  };

  // pooled point lights follow the nearest active light sources at night
  G.lightPool = {
    pool: [],
    init() { for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffb060, 0, 14, 1.6); l.layers.enableAll(); G.scene.add(l); this.pool.push(l); } this.hand = new THREE.SpotLight(0xdff4ff, 0, 60, 0.5, 0.5, 1.2); this.hand.layers.enableAll(); G.scene.add(this.hand); G.scene.add(this.hand.target); },
    update(t) {
      const P = G.player, L = []; for (const st of G.structs.list) if (st.lightItems) for (const it of st.lightItems) L.push(it); const v = new THREE.Vector3(); const dark = 1 - G.sky.dayLight * 0.9;
      const list = L.map((it) => { it.struct.itemWorld(it, v); return { x: v.x, y: v.y + 0.3, z: v.z, d: v.distanceToSquared(P.pos), k: it.type === 'lantern' ? 0.7 : 1 }; }).sort((a, b) => a.d - b.d);
      for (let i = 0; i < this.pool.length; i++) {
        const l = this.pool[i], s = list[i];
        if (s && s.d < 2500) { l.position.set(s.x, s.y, s.z); l.intensity = (22 + 5 * Math.sin(t * 11 + i * 2.1)) * s.k * (0.25 + dark * 0.75); } else l.intensity = 0;
      }
    }
  };
})();
