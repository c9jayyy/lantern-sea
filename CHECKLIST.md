# Lantern Sea — implementation checklist

Status against the sections of the original brief. **Done** = implemented and exercised by the self-test.
**Partial** = works but narrower than the brief asks. **Absent** = not built. "Unverified" notes point to
`TEST_REPORT.md`.

| # | Brief section | Status | Notes |
|---|---|---|---|
| 1 | HTML/WebGL foundation | Done | Vite + Three.js r160 project (`index.html`, `src/`), CC0 asset pipeline (`scripts/fetch-assets.mjs`). Three.js r160, WebGL2, custom shaders, PBR materials, HDR pipeline with ACES tone mapping, bloom, grading, vignette, edge smoothing. Offline, no services. No WebGPU path. No ambient occlusion or screen-space reflections. |
| 2 | Concept and opening | Done | Wake on a damaged 2×2 raft at dawn with hook, rations, flask, rope, planks, compass and a dead radio. Ten opening objectives in order. No cut-scene camera; the opening is a fade and chapter card. |
| 3 | Ocean simulation | Done | FFT wave spectrum in four cascades (rebuilt after first feedback), roughness-aware reflection and sun glitter, sky and cloud reflection, screen-space reflections, refraction, absorption, whitecaps from surface folding, shoreline foam, caustics, weather-driven sea state, buoyancy and tilt for raft, boats and debris from the same height field. Raft and boat leave a foam wake trail; drifting cloud shadows darken sea and land. No planar reflections; no real breaking-wave geometry. |
| 4 | Open world | Partial | About 90 islands and 70 ocean sites per seed across a 7 km square, streamed with two levels of detail. The brief asked for hundreds. Seven island types; coastlines, hills, cliffs, a volcano cone and crater, mangrove channels, ponds. **No rivers or waterfalls.** |
| 5 | Discoveries | Partial | Wrecks, a cargo-scale research ship, a seaplane, yachts, a rig, buoys, reefs, kelp forests, caches, ruins, camps, villages, labs, three Lantern stations, an underwater lab, the Keystone platform. Every one holds loot, a note or a story step. **No enterable caves or tunnels** (grottos are rock overhangs); no military sites. |
| 6 | Survival | Done | All listed stats, six ailments, spoilage, three difficulties. Broken bones come from falls only. |
| 7 | Harvesting | Done | 37 node types with tool types and tiers, hit feedback, falling trees, respawn timers, underwater nodes. |
| 8 | Crafting | Done | 254 recipes over 335 items, every one producing a working item. Search (by name or ingredient), category counts, craftable-only filter, favourites, HUD tracking, quantity picker, queue with progress, station and research gates, nearby storage, "used to make" links. Item art is a 3D render of each item made at load time. No saw or separate GPS item. |
| 9 | Raft building | Done | Snapping ghost, rotation, validity reasons, costs, dismantle with refund, repair, support rule, three levels. Structural integrity is a placement rule, not a physics collapse. Decorations are limited to nine items. |
| 10 | Boats | Partial | Rowboat, sailing dinghy, motor skiff with steering, wind, fuel and cargo. No boat damage or upgrades; three hulls rather than six. |
| 11 | Island bases | Partial | The raft building system works on land, and equipment can stand on bare ground. No treehouses or defensive barriers; furniture is the same small set. |
| 12 | Wildlife | Partial | Eleven creature types with state-machine behaviour. The shark was rebuilt: smooth lofted body, painted skin, tail-beat animation, resident shadowing of the raft, swimmer attack runs and raft attacks. Other animals are still simple shapes. No lizards or insects. Behaviour of most species is unverified beyond "runs without error". |
| 13 | Fishing and food | Done | Rod fishing with tension fight, bait and lures, 19 species, journal, spearfishing, one trap type, four preservation methods, prepared meals, four crops with water and compost. No nets. |
| 14 | Underwater | Partial | Reefs, kelp, wrecks, a three-module lab, trenches, breath and gear tiers, pressure limits, underwater rendering and muffled audio. No cave systems or strong currents. |
| 15 | Story | Done | Six chapters, 27 main objectives, three endings with different world outcomes, play continues after. Told through recordings, notes, radio, dialogue and place. |
| 16 | Quests | Done | Main, exploration, rescue, research, building, trading, fishing, treasure and diving missions; journal, HUD tracking, chart and compass markers. Twelve side missions, one repeatable. |
| 17 | Research | Done | 21 technologies in five tiers (the brief listed seven), insight from studying items and from discoveries, blueprint gates. |
| 18 | Skills | Done | Seven skills, ten levels each, earned through use. |
| 19 | Weather | Done | Ten states with transitions, effects on sea, visibility, sailing, hull, temperature, water collection, fishing and power; a forecasting station. |
| 20 | Navigation | Done | Compass strip, fog-of-war chart, markers, waypoint, navigation table, binoculars, sonar, depth gauge. No multi-leg route planning. |
| 21 | NPCs and trading | Partial | Seven characters (one a travelling trader) with dialogue, missions and barter with stock, specialities and reputation. They stand in place and face you; no schedules, no hostile humans. |
| 22 | Combat | Partial | Spears, knives, machete, bow with hit detection, durability and enemy reactions. Simple: no blocking or dodging mechanics. |
| 23 | Main menu | Done | Live 3D scene, six buttons, new-game panel with slot, seed and difficulty. **No character customisation.** |
| 24 | In-game UI | Done | Rebuilt HUD (ring gauges, tick compass with heading, weather icons, pickup feed), inventory with worn gear and detail pane, crafting and construction screens with rendered icons; journal, trading, stations, storage, radio subtitles, chart, research, sleep, saving, settings. Items move by click-carry or drag. |
| 25 | Movement and camera | Partial | Walk, sprint, crouch, jump, swim, dive, board boats, walk a moving raft. **No ladders or climbing, no third-person camera.** Tool swings are simple held-item animations. |
| 26 | Audio | Done (rewritten), unverified | Synthesised ocean, wind, rain, thunder, underwater filter, wildlife, 66 action sounds, mood-following generative music, four volume sliders. Rewritten from physical recipes after feedback that it sounded unreal; still entirely synthesised, with no recordings, and still not listened to. |
| 27 | Quality of life | Done | Stacking, sorting, tracking, quick transfer, autosave, four slots, UI scale, tutorials, rebinding, photo mode, subtitles, colour-vision option, reduced motion, help. |
| 28 | World events | Done | Cargo, debris fields, travelling trader, unexplained signals, storms, treasure bottles. Distress signals appear only as the scripted rescue. |
| 29 | Postgame | Done | World persists after the ending; long-form raft missions, collection journals, achievements, new seeds. |
| 30 | Performance | Done, partly unverified | Frustum culling, instancing, two island LODs, far-vegetation impostors, streaming, merged structure geometry, pooled lights and particles, dynamic resolution, four presets. Frame rate itself was not measurable in the test environment. |
| 31 | Save and load | Done | IndexedDB with fallback, four slots plus a rolling backup, autosave, validation, versioning and migration, export and import. Export click itself untested. |
| 32–34 | Interconnection, motivation, balance | Done in design, unverified in play | Systems feed each other as the brief describes. Balance and the hours of play the content supports have not been measured by playing it through. |
| 35 | Premium details | Partial | Sun glitter, wet sand, swaying palms, fish under the surface, bubbles, circling gulls with flapping/gliding wings, cloud shadows, raft wake, rain, lightning, firelight, sails and flags in wind, haze, moving shadows. No footprints, no rain splashes on decks. Ground litter and a seaweed wrack line on beaches. |
| 36–38 | Process, QA, deliverables | Done | Built in tested increments; `TEST_REPORT.md` records what was and was not verified. |

## Visual fidelity, plainly

Water, sky (real photographed HDRIs), beaches, rock, raft wood, ferns, shrubs, boulders and floating props now use real
scanned material. Broadleaf trees and grass are now built from individually modelled leaves and blades, and the ground near the player
carries grass, litter and beach wrack. Still procedural and visibly less real: palms, coral and kelp, the player's hands and
tools, NPCs and most buildings. The animals are custom-built bodies with painted skins and swim animation, not scans.
