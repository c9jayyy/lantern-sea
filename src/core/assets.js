'use strict';
/* Asset loader: real CC0 assets fetched by scripts/fetch-assets.mjs into public/assets (see public/assets/manifest.json).
   Everything is optional: a missing file falls back to the procedural version, so the game always starts. */
(function () {
  const G = window.G;
  const A = G.assets = {
    manifest: null, tex: {}, hdri: {}, models: {}, failed: [],
    url(p) { return 'assets/' + p; },
    async load(progress) {
      try { const r = await fetch(this.url('manifest.json'), { cache: 'no-cache' }); if (r.ok) this.manifest = await r.json(); } catch (e) { /* no assets: fully procedural */ }
      const M = this.manifest; if (!M) return;
      const jobs = [];
      const tl = new THREE.TextureLoader(), hl = new THREE.RGBELoader(), gl = new THREE.GLTFLoader();
      for (const [name, set] of Object.entries(M.textures || {})) for (const [map, file] of Object.entries(set.maps)) jobs.push(['texture ' + name, () => tl.loadAsync(this.url(file)).then((t) => { (this.tex[name] || (this.tex[name] = {}))[map] = t; })]);
      for (const [name, h] of Object.entries(M.hdris || {})) jobs.push(['sky ' + name, () => hl.loadAsync(this.url(h.file)).then((t) => { this.hdri[name] = Object.assign({ tex: t }, h); })]);
      for (const [name, m] of Object.entries(M.models || {})) jobs.push(['model ' + name, () => gl.loadAsync(this.url(m.file)).then((g) => { this.models[name] = Object.assign({ gltf: g }, m); })]);
      let done = 0; const N = jobs.length, LIM = 6; let k = 0;
      await new Promise((resolve) => {
        const run = () => {
          if (k >= N) { if (done >= N) resolve(); return; }
          const [label, fn] = jobs[k++];
          fn().catch((e) => { this.failed.push(label); console.warn('asset failed', label, e && e.message); }).then(() => { done++; if (progress) progress(done / N, label); if (done >= N) resolve(); else run(); });
        };
        if (!N) resolve(); for (let i = 0; i < Math.min(LIM, N); i++) run();
      });
      // colour maps are sRGB, the rest linear; everything tiles
      const aniso = 8;
      for (const set of Object.values(this.tex)) for (const [map, t] of Object.entries(set)) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; t.colorSpace = map === 'diff' ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true; }
    },
    has(name) { return !!this.tex[name] && !!this.tex[name].diff; },
    // scanned item models are not kept: they load for the item pictures at start-up, are freed, and an item lying in the
    // world loads its own again (from the browser cache)
    _itemLoads: {},
    loadItem(name) {
      const M = this.manifest, m = M && M.items && M.items[name]; if (!m) return Promise.resolve(false); if (this.models[name]) return Promise.resolve(true);
      if (!this._itemLoads[name]) this._itemLoads[name] = new THREE.GLTFLoader().loadAsync(this.url(m.file)).then((g) => { this.models[name] = Object.assign({ gltf: g, item: true }, m); delete this._itemLoads[name]; return true; }, (e) => { console.warn('item model failed', name, e && e.message); delete this._itemLoads[name]; return false; });
      return this._itemLoads[name];
    },
    loadItems(progress) { const names = Object.keys((this.manifest && this.manifest.items) || {}); let d = 0; return Promise.all(names.map((n) => this.loadItem(n).then(() => { d++; if (progress) progress(d / names.length); }))); },
    freeItems(keep) {
      for (const name of Object.keys(this.models)) {
        const m = this.models[name]; if (!m.item || (keep && keep.has(name))) continue;
        m.gltf.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const mt of ms) { for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) if (mt[k]) { if (mt[k].image && mt[k].image.close) mt[k].image.close(); mt[k].dispose(); } mt.dispose(); } });
        delete this.models[name]; for (const id in this._geo || {}) if (id.startsWith(name + ':')) { for (const g of Object.values(this._geo[id])) g.dispose(); delete this._geo[id]; }
        for (const k of Object.keys(G.mats)) if (k.startsWith('gl_' + name + '_')) { G.mats[k].dispose(); delete G.mats[k]; }
      }
    },
    // a downloaded model as the game's instancing format { materialKey: geometry }: one merged geometry per material,
    // base on y = 0, centred, scaled so its largest extent (or height with o.byHeight) equals o.size. Materials go into G.mats.
    geos(name, o) {
      o = o || {}; const id = name + ':' + (o.size || 0) + ':' + (o.byHeight ? 1 : 0) + ':' + (o.part == null ? 'a' : o.part) + ':' + (o.tris || 0); this._geo = this._geo || {}; if (this._geo[id]) return this._geo[id];
      const m = this.models[name]; if (!m) return null;
      const root = m.gltf.scene; root.updateMatrixWorld(true); const parts = {}, mats = {};
      const meshes = []; root.traverse((n) => { if (n.isMesh) meshes.push(n); });
      (o.part == null ? meshes : [meshes[o.part % meshes.length]]).forEach((n) => {
        if (!n.isMesh) return; const mat = Array.isArray(n.material) ? n.material[0] : n.material, key = 'gl_' + name + '_' + (mat.name || mat.uuid.slice(0, 6)).replace(/\W+/g, '_');
        let g = n.geometry.clone(); g.applyMatrix4(n.matrixWorld); if (g.index) g = g.toNonIndexed();
        for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal' && a !== 'uv') g.deleteAttribute(a);
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        if (!g.attributes.normal) g.computeVertexNormals();
        (parts[key] || (parts[key] = [])).push(g); mats[key] = mat;
      });
      const out = {}, box = new THREE.Box3();
      for (const k in parts) {
        let g = parts[k].length > 1 ? THREE.BufferGeometryUtils.mergeGeometries(parts[k]) : parts[k][0];
        // dense scans are reduced once at load to a game budget (o.tris triangles)
        if (o.tris && g.attributes.position.count / 3 > o.tris * 1.2) {
          try { const mg = THREE.BufferGeometryUtils.mergeVertices(g, 1e-4), n0 = mg.index.count / 3; const sg = new THREE.SimplifyModifier().modify(mg, Math.floor(mg.attributes.position.count * (1 - o.tris / n0))); sg.computeVertexNormals(); g = sg; } catch (e) { console.warn('simplify failed', name, e.message); }
        }
        out[k] = g; g.computeBoundingBox(); box.union(g.boundingBox);
      }
      const sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3()), s = o.size ? o.size / (o.byHeight ? sz.y : Math.max(sz.x, sz.y, sz.z)) : 1;
      for (const k in out) {
        const g = out[k]; g.translate(-c.x, -box.min.y, -c.z); g.scale(s, s, s); g.computeBoundingSphere();
        if (!G.mats[k]) {
          const src = mats[k], mm = new THREE.MeshStandardMaterial({ map: src.map, normalMap: src.normalMap, roughnessMap: src.roughnessMap, metalnessMap: src.metalnessMap, aoMap: src.aoMap,
            roughness: src.roughness, metalness: src.metalness, color: src.color, alphaTest: o.foliage ? 0.5 : src.alphaTest, side: o.foliage || src.side === THREE.DoubleSide ? THREE.DoubleSide : THREE.FrontSide, transparent: false });
          if (src.normalScale) mm.normalScale.copy(src.normalScale);
          G.mats[k] = o.sway ? G.swayPatch(mm, o.sway) : mm;
        }
      }
      return (this._geo[id] = out);
    },
    // add a model with its longest axis turned to point up (for held tools), length L, base at y0
    addToUpright(b, name, L, y0) {
      const gs = this.geos(name, { size: L }); if (!gs) return false; const box = new THREE.Box3(); for (const k in gs) { gs[k].computeBoundingBox(); box.union(gs[k].boundingBox); }
      const sz = box.getSize(new THREE.Vector3()), m = new THREE.Matrix4();
      if (sz.x >= sz.y && sz.x >= sz.z) m.makeRotationZ(Math.PI / 2); else if (sz.z >= sz.y) m.makeRotationX(-Math.PI / 2);
      // centre on the handle: the average of the vertices in the lowest third (after turning upright), not the whole box
      const v = new THREE.Vector3(); let lo = 1e9, hi = -1e9; for (const k in gs) { const p = gs[k].attributes.position; for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m); lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); } }
      let hx = 0, hz = 0, n = 0; const cut = lo + (hi - lo) * 0.33; for (const k in gs) { const p = gs[k].attributes.position; for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m); if (v.y < cut) { hx += v.x; hz += v.z; n++; } } }
      m.premultiply(new THREE.Matrix4().makeTranslation(-hx / Math.max(n, 1), y0 - lo, -hz / Math.max(n, 1)));
      for (const k in gs) b.add(gs[k].clone(), k, m); return true;
    },
    // add a downloaded model to a model builder (G.MB) at a transform
    addTo(b, name, o, x, y, z, rx, ry, rz, sc) { const gs = this.geos(name, o); if (!gs) return false; for (const k in gs) b.add(gs[k].clone(), k, b.mat4(x || 0, y || 0, z || 0, rx || 0, ry || 0, rz || 0, sc || 1)); return true; }
  };
})();
