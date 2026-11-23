/* Developer camera helpers for inspecting the game from the browser console (used for screenshots during development).
     await fetch('/tools/viewer.js').then(r => r.text()).then(eval); await V.start();
   V.start()              start a throwaway voyage, hide the HUD, freeze the weather
   V.wx({...})            set weather values and keep them
   V.at(x, z, yaw, pitch) stand on the ground at x,z      V.dive(x, y, z, yaw, pitch) float at a point
   V.look(creature, dist, side, height)  frame a creature                V.spawn(type, dx, dy, dz, yaw) add a creature in front
   The simulation is paused after each call so the frame stays put for a screenshot. */
(function () {
  const G = window.G;
  const V = window.V = {
    hour: 11,
    async start(o) {
      o = o || {}; for (let i = 0; i < 40 && G.state !== 'menu'; i++) await new Promise((r) => setTimeout(r, 1000));
      await G.game.newGame({ slot: 4, name: 'viewer', seed: o.seed || 'look1', difficulty: 'standard' }); await new Promise((r) => setTimeout(r, 4500));
      document.querySelectorAll('body > *').forEach((e) => { if (e.tagName !== 'CANVAS' && e.id !== 'game') e.style.visibility = 'hidden'; });
      this.wx({ wind: 0.4, sea: 0.6, storm: 0, cloud: 0.35, rain: 0, fog: 0 }); const r = G.structs.raft; r.anchored = true; this.raft = r.pos.clone(); return 'ready';
    },
    wx(o) { G.wsim.until = 1e12; this._wx = Object.assign(this._wx || {}, o); Object.assign(G.weather, this._wx); },
    run(n, fn) { G.state = 'play'; for (let i = 0; i < (n || 20); i++) { Object.assign(G.weather, this._wx); G.time.hour = this.hour; if (fn) fn(i); G.game.step(1 / 30); const cam = G.render.camera; G.sky.update(G.time.hour, 1 / 30, cam, G.player.pos); G.ocean.update(1 / 30, cam); if (G.groundCover) G.groundCover.update(cam.position); G.world.cullDeco(cam.position); } G.state = 'paused'; G.render.fade = 0; G.render.frame(0.016); return 'ok'; },
    pose(x, y, z, yaw, pitch) { const P = G.player; P.parent = null; P.climb = null; P.pos.set(x, y, z); P.vel.set(0, 0, 0); P.yaw = yaw; P.pitch = pitch; },
    dive(x, y, z, yaw, pitch, n) { return this.run(n || 6, () => this.pose(x, y, z, yaw, pitch)); },
    at(x, z, yaw, pitch, n) { G.world.stream(x, z, 1e9); return this.run(n || 10, () => this.pose(x, G.world.heightAt(x, z), z, yaw, pitch)); },
    look(c, dist, side, h) { const a = c.yaw + (side == null ? 1.57 : side), x = c.x + Math.sin(a) * dist, z = c.z + Math.cos(a) * dist, y = c.y + (h || 0.3); return this.dive(x, y - 1.55, z, Math.atan2(-(c.x - x), -(c.z - z)), Math.atan2(c.y - y, dist), 4); },
    spawn(type, x, y, z, yaw, extra) { const c = G.wildlife.add(type, x, y, z, Object.assign({ life: 0, speed: 0, state: 'hold', ph: 1, hits: 0, hp: 60, ca: 0 }, extra || {})); c.yaw = yaw || 0; c.keep = true; return c; },
    freeze(types) { for (const t of types) G.wildlife[t] = function (c) { c.speed = 1.2; this.place(c, 0); }; },
  };
})();
