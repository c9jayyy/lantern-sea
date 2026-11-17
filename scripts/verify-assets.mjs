// Checks every file listed in public/assets/manifest.json: present, non-empty, and with the right file signature.
//   node scripts/verify-assets.mjs
import { readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');
const sig = (p, b) => /\.jpe?g$/i.test(p) ? b[0] === 0xff && b[1] === 0xd8 : /\.hdr$/i.test(p) ? b.subarray(0, 2).toString() === '#?' : /\.gltf$/i.test(p) ? (() => { try { JSON.parse(b.toString('utf8')); return true; } catch { return false; } })() : b.length > 0;
const M = JSON.parse(await readFile(join(OUT, 'manifest.json'), 'utf8'));
const files = [];
for (const t of Object.values(M.textures)) files.push(...Object.values(t.maps));
for (const h of Object.values(M.hdris)) files.push(h.file);
for (const m of Object.values(M.models)) {
  files.push(m.file); const g = JSON.parse(await readFile(join(OUT, m.file), 'utf8')); const base = dirname(m.file);
  for (const x of [...(g.buffers || []), ...(g.images || [])]) if (x.uri) files.push(join(base, x.uri).split('\\').join('/'));
}
let bad = 0, bytes = 0;
for (const f of files) { try { const b = await readFile(join(OUT, f)); bytes += b.length; if (!b.length || !sig(f, b)) { bad++; console.log('BAD  ', f); } } catch { bad++; console.log('MISSING', f); } }
console.log(`${files.length} files checked, ${(bytes / 1048576).toFixed(1)} MB, ${bad} problems`);
process.exitCode = bad ? 1 : 0;
