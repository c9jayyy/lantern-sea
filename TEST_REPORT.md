# Lantern Sea — test report

Build tested: Vite production build (`npm run build`, served with `vite preview`) and the Vite dev server, 16 November 2026.
This is the third version: the project moved to a Vite + Three.js layout with real CC0 assets (Poly Haven HDRI skies,
PBR textures and glTF models), recorded sound effects, a rebuilt underwater renderer, and rebuilt animals.
Environment: Chromium 156 embedded browser, WebGL2, AMD Radeon RX 6600 (ANGLE / Direct3D 11).

**Latest self-test: 70 of 70 passed, 0 console errors** (dev build, 16 November 2026, after the interface round: rendered
item icons, new HUD, crafting/inventory/construction screens, 96 more items, cloud shadows, gulls, raft wake). The UI and
HUD checks were updated for the new markup and now also confirm the inventory detail pane fills and the hotbar shows
rendered icons. `npm run build` succeeds; the full suite was not re-run on the production bundle.
Data validation in the page: 335 items, 254 recipes, no recipe, process or loot entry pointing at a missing item or
technology, no duplicate recipe ids; all 335 items and 63 construction pieces received a rendered icon.

New checks in this version: hook gathers debris on the way back; climbing onto the raft is a timed haul; the shark
latches onto the raft edge and wears a plank down; a live crab cannot be picked up, a killed one can.

Looks were judged from screenshots of the running game: beach, waterline, island interior, raft, clear/partly cloudy/
sunset/storm skies, underwater looking toward and away from the sun, and close-ups of shark, dolphin, ray, turtle,
grouper, barracuda and crab. Also checked by eye since: moray (fin fixed), whale at distance, new palms, reef, held axe and knife. Jellyfish and fish schools were checked up close in the latest round.

## How it was tested

`tools/selftest.js` runs inside the live game page. It does not mock anything: it sets input state, steps the real
simulation and render loop frame by frame, and asserts on the resulting game state. A check passes only if its
assertion holds **and** no error was logged while it ran. Final run on the final build: **69 of 69 passed, 0 skipped,
0 console errors.** The checks say that systems work; they say nothing about how the game looks or sounds. Looks were
judged from screenshots of the running game (calm, breezy, sunset, storm, shoreline, underwater, menus).

To repeat it: `npm run dev`, start a throwaway voyage, then in the browser console run
`fetch('/tools/selftest.js').then(r => r.text()).then(eval).then(r => console.table(r))`. It rewrites the current save heavily.

During development the same suite caught and led to fixes for: sinking instead of floating after falling in; no fish
over deep water; equipment silently replacing equipment on an occupied tile; drinking not returning the empty flask;
foundation placement requiring an awkward downward aim; a solar panel unable to run a desalinator.

## Results by area

| Area | Check | Result |
|---|---|---|
| General | Game boots to the main menu with no console errors | PASS |
| General | Menu buttons (Continue, New Game, Load, Settings, Credits, Exit) open and close, driven through the DOM | PASS |
| General | New game created through the New Voyage panel (name, slot) enters play | PASS |
| General | Continue loads the most recent save | PASS |
| Movement | Walking on the raft moves the player and keeps them aboard | PASS |
| Movement | Raft carries the player as it drifts and heaves (2.07 m each) | PASS |
| Movement | Mouse look changes yaw and pitch within limits (simulated mouse deltas) | PASS |
| Collision | Jumping lands back on the deck | PASS |
| Collision | Walls block movement; an opened door lets you through | PASS |
| Collision | Stairs climb to the next level | PASS |
| Collision | Swimming to the raft and climbing aboard | PASS |
| Survival | Hunger, thirst and energy fall over time | PASS |
| Survival | Food restores hunger, water restores thirst, seawater harms, flasks are returned | PASS |
| Survival | Starvation and dehydration damage health; bleeding applies and a bandage cures it | PASS |
| Survival | Spoilage converts food past its shelf life | PASS |
| Survival | Death shows the death screen; waking restores the player at the raft | PASS |
| Inventory | Items collected, stacked, split, merged, moved between slots | PASS |
| Inventory | Storage panel opens and renders (transfer buttons not individually clicked) | PASS (render only) |
| Crafting | Recipe consumes ingredients and yields the item after its craft time | PASS |
| Crafting | Missing materials, missing station and missing technology are refused | PASS |
| Stations | Campfire burns fuel and cooks; solar still desalinates | PASS |
| Stations | Rain catcher fills in rain and gives fresh water | PASS |
| Stations | Crops grow when watered and harvest; solar charges the battery; desalinator runs on power | PASS |
| Raft | Foundation ghost validates and places; detached foundations are rejected | PASS |
| Raft | Walls, door, roof, stairs, upper floor and the support rule | PASS |
| Raft | Equipment places and is usable; dismantling refunds materials | PASS |
| Raft | Dismantle mode targets pieces and refuses removals that would split the raft | PASS |
| Raft | Mallet repairs a damaged deck for one plank | PASS |
| Raft | Sail drives the raft (3.4 m/s), helm steers, anchor stops it, paddle pushes it | PASS |
| Raft | Storm damages plain decks | PASS |
| Debris | Debris spawns and drifts; grabbing collects it | PASS |
| Hook | Thrown hook lands and floats, waits until hauled, and sweeps up a second piece on the way back | PASS |
| Boarding | Climbing out of the water is a timed haul (35 frames at 30 fps, largest vertical step 0.10 m), not a jump | PASS |
| Exploration | Island terrain, vegetation and sites load; player walks on the ground | PASS |
| Exploration | Islands load near the player and unload when far | PASS |
| Exploration | Picking plants, chopping a palm and mining a rock yield resources and persist as removed | PASS |
| Exploration | Camp recording, crate and lifeboat give story items; pond gives fresh water | PASS |
| Exploration | Calloway wreck (21 m) and Deepwell lab (46 m) load with loot, data cores and notes | PASS |
| Exploration | Chart reveals around the player; sonar marks contacts; base chart renders | PASS |
| Exploration | Treasure chart marks a beach and the shovel digs it up | PASS |
| Diving | Entering water floats at the surface; diving submerges, drains breath; surfacing refills | PASS |
| Diving | Drowning damages; an air tank is used before breath | PASS |
| Diving | Depth pressure hurts without gear; a wetsuit protects at 43 m | PASS |
| Fishing | Cast, bite, fight and land a fish; the journal records the species | PASS |
| Wildlife | Fish schools spawn; shark runs patrol → investigate → circle → attack → retreat and bites | PASS |
| Wildlife | Spear strike wounds and drives off a shark | PASS |
| Wildlife | Shark latches onto a raft edge and wears a deck plank down (deck total 780 → 724) | PASS |
| Audio | All 66 sound effects, thunder and the ambience loop build and schedule without error | PASS (not listened to) |
| Boats | Deploy a rowboat, board, row 13.6 m, step out | PASS |
| Weather | Gale brings rain, wind, bigger seas and lightning | PASS |
| Weather | Time advances, night falls, day rolls over | PASS |
| Sleep | Bed skips the night, restores energy, sets the waking point and saves | PASS |
| Progression | Quest objectives advance from play and complete | PASS |
| Progression | Studying items grants insight; technology unlocks recipes; blueprint-gated tech stays locked | PASS |
| Progression | Skills level from experience | PASS |
| Story | Radio repair with three components plays the broadcast | PASS |
| Story | Beacon core relights a Lantern, reveals the next, logs its note | PASS |
| Story | Haven is populated; dialogue, quest offers and barter prices work | PASS |
| Story | All three endings resolve and change the standing storm | PASS |
| Events | Cargo container, debris field and travelling trader fire without error | PASS |
| Saving | State serialises and is written to browser storage (about 11 KB) | PASS |
| Saving | Reload restores raft, structures, inventory, quests, world changes and position | PASS |
| Saving | Corrupt, foreign and newer-version saves are rejected | PASS |
| Saving | Import of a save file into a free slot; invalid JSON refused | PASS |
| UI | All 18 panels open and render, including every Journal, Settings and Build tab | PASS |
| UI | HUD bars, hotbar, compass, objectives and clock update | PASS |
| UI | Settings persist across reload; presets change render size, water grid and shadows | PASS |
| UI | Photo mode engages and returns control | PASS |
| Performance | No runaway object growth over 600 frames (geometries 115 → 117) | PASS |
| Performance | Wave synthesis (12 inverse FFTs per frame, on the CPU): 2.2 ms per frame | MEASURED |
| Performance | Whole frame, GPU included, at sea: about 4 ms at 1024×768 in the test pane, of which water is roughly half. First version of the new water cost three times that; reflected clouds were moved to a pre-rendered sky probe and the reflection march was tightened | MEASURED (hidden pane, indicative only) |
| Performance | Loading the largest island at full detail: 58 ms (a one-frame hitch) | MEASURED |

## Not tested

These could not be exercised in the automated environment, or were not attempted. Treat them as unverified.

| Item | Why |
|---|---|
| Real mouse capture (pointer lock) and hand-on-keyboard play | The test pane cannot grant pointer lock. Input was simulated by setting key and mouse state directly. The pointer-lock code path itself never ran. |
| Frame rate | The embedded pane throttled rendering to about 3 frames per second because it was in the background, so no FPS figure is meaningful. Only CPU time per frame was measured; GPU time was not. No FPS is claimed. |
| Audio output | Every effect was rewritten from physical recipes (struck-wood and stone modes, swept noise and bubble chirps for water, stick-slip creaks) and all of them run, but I cannot hear. Whether they sound real, and the mix levels, are unverified. |
| Opening from disk | Not supported any more: the Vite build must be served (`play.bat` does this). `play.bat` itself was written but not run end to end. |
| Firefox, Edge, Safari | Only Chromium 156 was used. |
| Save export | Triggers a browser download; not clicked. Import was tested with a constructed file. |
| Screenshot saving in photo mode | Same reason (download). |
| A full manual playthrough | The story chain was verified step by step through game state, not by playing ten hours. Pacing, difficulty balance and the playtime the content supports are unmeasured. |
| Key rebinding by keypress | Panel renders; the press-a-key capture was not driven. |
| Long sessions | No test longer than a few simulated minutes; slow leaks would not have shown. |
| Low-end hardware | Presets change real settings (verified), but their effect on a weak GPU is unmeasured. |
| Sailing dinghy and motor skiff | Share the rowboat's code path; only the rowboat was driven. |
| Shark behaviour by eye | The state sequence and the raft attack pass their checks; how convincing the swimming, banking and timing look in motion has not been watched at full frame rate. |
| Fallback for GPUs without linear float textures | The wave textures switch to half-float in that case; that path was never executed. |
| Boars, dolphins, turtles, rays, jellyfish, eels, the trench giant | Spawn code ran in the suite without error, but their individual behaviours were not asserted. |

## Fixed in the latest round

- Seabed plants (coral, sponge, sea grass) were placed using the island's own height function, which ignores the
  deeper ocean floor, so some floated in open water (one coral at −10 m over a −43 m bottom). They now use the real
  terrain height.
- Under water, the sky dome showed through as white sheets wherever the distant sea floor left a gap. The dome is now
  hidden while the camera is submerged (the surface shader shows the sky through Snell's window with its own probe).

- Shiny creatures (dolphin, fish) reflected the above-water sky while submerged, which washed them out to pale cyan.
  Underwater now uses its own lighting environment.
- The audio mixer threw on a non-finite volume (seen when a test creature's position became NaN); volumes are now
  guarded so a bad value can never stop the game loop.

- Coconuts rendered as grey bark: the palm material ignored vertex colours. Fixed.

- Holding the stone axe or the paddle showed no hand (the hand sat below the screen) and the paddle had no stroke;
  every tool's grip is now at the hand origin, each tool has its own pose, and the paddle has a stroke animation.

## Co-op (tested in two tabs of one browser, over the public PeerJS server)

Hosting produced a code; a second tab joined with it, received the world (same seed, raft and structures) and stood on
the host's raft. Checked both directions: a deck tile built by the host appeared for the partner; a wall, a chest and
three pearls placed in it, and dropping the anchor by the partner all appeared for the host; a palm felled by the host
disappeared for the partner; chat arrived; each saw the other's avatar with its name tag; when the partner left, their
game returned to the menu. **Not tested:** two different computers on different home networks (only one machine was
available), play over a long session, or networks that block direct WebRTC connections (there is no relay server).

## Underwater round (17 Nov)

- **View flicking:** Chrome can report a single bogus, very large mouse movement while the pointer is locked, more
  often when frames stall. Those events (and the first one after locking) are now ignored. Not reproduced here
  (no physical mouse in the test browser), so this fix is based on the known browser behaviour, not an observed repro.
- **Lag:** an underwater view drew about 26 million triangles a frame, mostly branching corals of 10-12k triangles
  each placed by the thousand. Corals now use a 1.5-1.7k triangle build, brain corals are lighter, small reef pieces
  no longer cast shadows, and the grass carpet is hidden while under water: about 4.7 million at the same spot. Tree
  crowns use 40% fewer, larger leaves. Frame time itself could not be measured in the test browser.
- **Look:** the open sea floor is now mostly 12-28 m (was 30-70 m) so the bottom shows; water absorbs far less
  (35-45 m visibility in calm weather) and glows green-teal; rock outcrops and giant kelp forests (broad ruffled
  blades on gas bladders) were added to the island shelves.

- Follow-up: the view turn from the mouse is also capped per frame (12 rad/s), as a second guard against stray input
  bursts. Underwater light shafts were rebuilt (narrower, higher-contrast beams from wave focusing), the haze toned
  down so they read, kelp brightened, and a few glowing plankton specks added among the marine snow. The new partner
  avatar was checked in two tabs: chosen shirt colour, long hair and skin tone arrived, face and held axe visible.

## Known issues

- The check "underwater sites: the Calloway wreck and Deepwell load with loot, cores and notes" failed once in two
  consecutive runs after the reef round and passed on the rerun (70/70). Cause not identified; it looks timing-related
  (the test steps the world only half a second after streaming a distant site).

- Island trees and palms are procedural (no usable CC0 scans: Poly Haven's trees are 2–5 million polygons and it has no palms). Palms now have curved ringed trunks, 16–20 arching folded fronds, dead fronds and coconut clusters.
- The visible sky is a 2K photograph, so clouds are softer than the rest of the scene on large screens.
- Underwater, the open-ocean seabed is too deep to see; reefs are only around islands and sites.
- Reefs were rebuilt (branching, brain, plate and fan corals, barrel and tube sponges, giant kelp with floats) but are still sparser than real reefs, to keep the triangle count down.
- Scanned rocks and branches are simplified at load time (to about 2,000 triangles each); loading takes a few seconds longer.
- The single-file `LanternSea.html` in Downloads is the previous version; the current game is the Vite project.
- First-person hands are procedural (tapered limbs, finger segments); up close they read as stylised, not photographic.
- Fixed in the latest rounds: rain was drawn as hard 1-pixel dashed lines (now soft streaks; a shader typo briefly hid it, caught by checking the compiled program); transparent animals and marine snow disappearing in the underwater fog (they did not write depth); fish near the surface glowing at night; yellow grass ground; orange radio.
- Fixed earlier: a vertical seam line in the sky where the panorama wraps; distant islands showing as bright shapes in the water surface seen from below.

- Islands swap between a simplified and a detailed version at about 500 m; the change is visible.
- Structures built on steep island ground can leave posts floating or buried.
- The Keystone's upper deck has no railing.
- Dynamic resolution lowers itself when the tab is in the background and takes a few seconds to recover.
- Seen from the raft, a shark just under the surface is hard to make out apart from its fin; its grey back is close to the water's own brightness.
- The sea floor is only drawn near islands, so where an island's terrain ends in a few metres of water the colour steps from see-through to deep blue.
- Item icons are still emoji glyphs (toned down), not drawn art.
- Reflections of the raft and islands come from what is on screen, so they vanish at the screen edges.
