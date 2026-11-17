// Downloads the game's real-world assets from Poly Haven (all CC0) into public/assets and writes public/assets/manifest.json.
// Every file is checked against Poly Haven's MD5 and its file signature before it is kept. Re-running skips verified files.
//   node scripts/fetch-assets.mjs
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'assets');
const UA = { 'User-Agent': 'lantern-sea-asset-fetch/2.0' };
const API = 'https://api.polyhaven.com';

// ---- what the game uses -------------------------------------------------------------------------------------------
// textures: [poly haven id, folder, resolution of colour+normal, resolution of the packed AO/rough/metal map]
const TEXTURES = {
  sand_dry:  ['coast_sand_01', 'island', '2k', '1k'],      // dry beach sand
  sand_wet:  ['damp_beach_sand', 'island', '2k', '1k'],    // wave-washed sand at the waterline
  seabed:    ['coral_ground_02', 'ocean', '1k', '1k'],     // coral rubble and sand under the water
  rock:      ['seaside_rock', 'island', '2k', '1k'],       // weathered coastal rock, cliffs
  jungle:    ['forest_leaves_02', 'island', '2k', '1k'],   // leaf litter on jungle floors
  grass:     ['aerial_grass_rock', 'island', '1k', '1k'],  // grassy island interiors
  deck:      ['weathered_planks', 'raft', '2k', '1k'],     // sun- and salt-bleached raft planks
  planks:    ['old_planks_02', 'raft', '1k', '1k'],        // walls and frames
  palm_bark: ['palm_tree_bark', 'island', '1k', '1k'],     // palm trunks
  bark:      ['bark_brown_02', 'island', '1k', '1k'],      // other tree trunks, driftwood
};
// sky HDRIs: the time-of-day series is blended by sun elevation; the weather skies are blended in by cloud cover
const HDRIS = {
  dawn: 'qwantani_dawn_puresky', sunrise: 'qwantani_sunrise_puresky', morning: 'qwantani_morning_puresky', mid_morning: 'qwantani_mid_morning_puresky',
  noon: 'qwantani_noon_puresky', late_afternoon: 'qwantani_late_afternoon_puresky', sunset: 'qwantani_sunset_puresky', dusk: 'qwantani_dusk_2_puresky',
  night: 'qwantani_night_puresky', cloudy: 'kloofendal_48d_partly_cloudy_puresky', overcast: 'kloofendal_overcast_puresky',
};
// glTF models (1k textures)
const MODELS = {
  crate: ['wooden_crate_01', 'props'], crate2: ['wooden_crate_02', 'props'], barrel: ['barrel_03', 'props'], plastic_crate: ['plastic_crate_01', 'props'],
  jerrycan: ['plastic_jerrycan', 'props'], jerrycan_metal: ['metal_jerrycan', 'props'], bucket: ['wooden_bucket_01', 'props'], lantern: ['wooden_lantern_01', 'props'],
  fire_pit: ['stone_fire_pit', 'props'], buoy: ['lateral_sea_marker', 'wrecks'], chest: ['treasure_chest', 'props'], military_crate: ['old_military_crate', 'wrecks'],
  medical_box: ['medical_box', 'props'], gallon: ['plastic_bottle_gallon', 'props'], can: ['can_rusted', 'props'], compass: ['seadogs_compass', 'props'],
  axe: ['wooden_axe_02', 'props'], knife: ['fish_knife', 'props'],
  fern: ['fern_02', 'foliage'], shrub: ['shrub_03', 'foliage'], sorrel: ['shrub_sorrel_01', 'foliage'], branches: ['dry_branches_medium_01', 'foliage'],
  rock_a: ['rock_07', 'environment'], rock_b: ['rock_09', 'environment'], stone: ['stone_01', 'environment'], boulder: ['boulder_01', 'environment'],
  conch: ['lambis_shell', 'environment'], stump: ['tree_stump_01', 'environment'], drift_log: ['dead_tree_trunk_02', 'environment'],
};

// ---- helpers ------------------------------------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJSON(url) {
  for (let i = 0; i < 5; i++) { try { const r = await fetch(url, { headers: UA }); if (r.ok) return await r.json(); if (r.status === 404) throw new Error('404 ' + url); } catch (e) { if (String(e.message).startsWith('404')) throw e; } await sleep(1500 * (i + 1)); }
  throw new Error('could not fetch ' + url);
}
const md5 = (buf) => createHash('md5').update(buf).digest('hex');
function signatureOK(path, buf) {
  if (/\.jpe?g$/i.test(path)) return buf[0] === 0xff && buf[1] === 0xd8;
  if (/\.png$/i.test(path)) return buf[0] === 0x89 && buf[1] === 0x50;
  if (/\.hdr$/i.test(path)) return buf.subarray(0, 2).toString() === '#?';
  if (/\.gltf$/i.test(path)) { try { JSON.parse(buf.toString('utf8')); return true; } catch { return false; } }
  return buf.length > 0;
}
async function exists(p, want) { try { const b = await readFile(p); return !want || md5(b) === want; } catch { return false; } }
let bytes = 0, files = 0, skipped = 0; const failures = [];
async function download(url, dest, wantMd5) {
  if (await exists(dest, wantMd5)) { skipped++; return; }
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (wantMd5 && md5(buf) !== wantMd5) throw new Error('md5 mismatch');
      if (!signatureOK(dest, buf)) throw new Error('bad file signature');
      await mkdir(dirname(dest), { recursive: true }); await writeFile(dest, buf); bytes += buf.length; files++; return;
    } catch (e) { if (i === 4) throw new Error(`${url}: ${e.message}`); await sleep(2000 * (i + 1)); }
  }
}
async function pool(tasks, n) { let k = 0; await Promise.all(Array.from({ length: n }, async () => { while (k < tasks.length) { const t = tasks[k++]; try { await t(); } catch (e) { failures.push(e.message); console.error('  FAILED', e.message); } } })); }

// ---- main ---------------------------------------------------------------------------------------------------------
const manifest = { source: 'Poly Haven (polyhaven.com), CC0 1.0 — no attribution required', generated: new Date().toISOString(), textures: {}, hdris: {}, models: {}, credits: [] };
const tasks = [];
const info = await getJSON(`${API}/assets?t=all`);
const credit = (id) => { const a = info[id] || {}; manifest.credits.push({ id, name: a.name || id, authors: Object.keys(a.authors || {}).join(', '), url: `https://polyhaven.com/a/${id}` }); };

for (const [name, [id, folder, res, armRes]] of Object.entries(TEXTURES)) {
  const f = await getJSON(`${API}/files/${id}`); credit(id);
  const maps = {}; const pick = { diff: ['Diffuse', res], nor: ['nor_gl', res], arm: ['arm', armRes] };
  for (const [map, [key, r]] of Object.entries(pick)) {
    const e = f[key] && (f[key][r] || f[key]['1k']); const j = e && e.jpg; if (!j) { console.warn(`  ${id}: no ${key}`); continue; }
    const rel = `textures/${folder}/${id}_${map}_${r}.jpg`; maps[map] = rel; tasks.push(() => download(j.url, join(OUT, rel), j.md5));
  }
  manifest.textures[name] = { id, maps };
}
for (const [name, id] of Object.entries(HDRIS)) {
  const f = await getJSON(`${API}/files/${id}`); credit(id);
  const h = f.hdri['2k'].hdr; const rel = `hdri/${id}_2k.hdr`; tasks.push(() => download(h.url, join(OUT, rel), h.md5));
  manifest.hdris[name] = { id, file: rel };
}
for (const [name, [id, folder]] of Object.entries(MODELS)) {
  const f = await getJSON(`${API}/files/${id}`); credit(id);
  const g = f.gltf && (f.gltf['1k'] || f.gltf['2k']); if (!g) { console.warn(`  ${id}: no glTF`); continue; }
  const base = `models/${folder}/${id}/`; const gl = g.gltf; const fname = gl.url.split('/').pop();
  tasks.push(() => download(gl.url, join(OUT, base + fname), gl.md5));
  for (const [inc, v] of Object.entries(gl.include || {})) tasks.push(() => download(v.url, join(OUT, base + inc), v.md5));
  manifest.models[name] = { id, file: base + fname, polycount: (info[id] || {}).polycount || 0 };
}

console.log(`fetching ${tasks.length} files…`);
const t0 = Date.now();
await pool(tasks, 6);
await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s: ${files} downloaded (${(bytes / 1048576).toFixed(1)} MB), ${skipped} already present, ${failures.length} failed`);
if (failures.length) { console.log('failures:\n ' + failures.join('\n ')); process.exitCode = 1; }
