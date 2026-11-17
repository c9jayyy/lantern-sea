# Lantern Sea

An open-world ocean survival and raft-building game for desktop browsers, built with Three.js (WebGL2) and Vite.
Terrain, raft, sky and props use real scanned CC0 assets from Poly Haven; animals, the ocean and the world are generated
by the game's own code. Many sound effects are public-domain field recordings.

## Running it

**Play in the browser:** https://c9jayyy.github.io/lantern-sea/ (published from this repository by GitHub Actions on
every push to `main`; nothing to install).

| What | How |
|---|---|
| Easiest (Windows) | Double-click `play.bat`. First run installs dependencies, downloads the assets (~170 MB) and builds; then it opens the game at http://localhost:4173. Keep that window open while you play. |
| Development | `npm install`, `npm run fetch-assets`, then `npm run dev` and open http://localhost:5173 |
| Production build | `npm run build`, then `npm run preview` |
| Check downloaded assets | `npm run verify-assets` |

The game must be served (as above); opening `index.html` straight from disk will not work, because browsers block
module scripts and texture loading from `file://`. Needs Node.js 18 or newer and a current Chrome, Edge or Firefox with
hardware acceleration. Saves live in the browser (IndexedDB); use **Load Game → Export** for a backup file.

## Playing together (online, two players)

Both of you open https://c9jayyy.github.io/lantern-sea/ (or each run a local copy with `play.bat`). Both need an
internet connection while connecting.

1. **Host:** start or load a game, press **Esc**, choose **Invite partner**, type your name. Six letters and numbers
   appear — send them to your partner (text message, phone, anything).
2. **Partner:** on the main menu choose **Join Partner**, type your name and the code, press **Join**. You arrive on
   the host's raft in the host's world.
3. Press **Enter** in game to chat. On either co-op screen you can pick your shirt colour, skin tone and hair, which
   is how your partner sees you. Closing the invite (**Stop inviting**) or quitting ends the session.

What is shared: both players and what they are holding, the raft and anything built (walls, equipment, chest
contents), harvested trees and rocks, the raft's sail, anchor, helm and paddling, time of day and weather. Each player
keeps their own inventory, health and skills. Floating debris, fish and animals are separate on each computer, so you
may each see different ones. Only the host's game saves the world; the partner's progress lives in it. While a partner
is connected the host's game does not pause in menus.

The connection is made with WebRTC (PeerJS): the free public PeerJS server only introduces the two computers, then
the game data travels directly between them. A few strict networks (some offices, some mobile hotspots) block direct
connections; if joining hangs at "Still trying…", try a different network.

## Controls (rebindable in Settings → Controls)

| Key | Action | Key | Action |
|---|---|---|---|
| W A S D | Move | Mouse | Look |
| Shift | Sprint / swim fast | Space | Jump / swim up / climb out |
| Ctrl | Crouch / dive down | E | Interact |
| Left mouse | Use tool, strike (bare-handed too), place piece | Right mouse | Eat / drink / use item, cancel |
| 1–9, wheel | Hotbar | Tab | Inventory |
| C | Crafting | B | Build menu |
| R | Rotate piece | X | Dismantle mode |
| M | Chart | J | Journal |
| F | Dive light | G | Drop held item |
| P | Photo mode | F5 | Quick save |
| H | Help | Esc | Pause / close |

**The hook:** hold and release left-click to throw. Once it floats, hold left-click to haul it in; it gathers every
piece of debris it touches on the way. Right-click hauls it all the way without holding.

**Crabs** must be killed (any weapon, or two bare-handed blows) before the carcass can be picked up.

Browser caveat: **Ctrl+W closes the tab** and a page cannot stop it; the game saves on close. Rebind Crouch if needed.

## What is in it

- **Ocean** — wind-driven FFT wave spectrum (four cascades), sun glitter, reflections of sky, clouds, raft and islands,
  refraction and absorption, whitecaps, shoreline foam, caustics, storm seas. Buoyancy reads the same wave field.
- **Under water** — ray-marched light shafts shadowed by the raft and islands, per-colour absorption with depth,
  forward-scattering glow toward the sun, Snell's window with exact Fresnel, drifting marine snow.
- **Atmosphere** — sun shafts streaming through fronds, clouds and around the raft when you look toward the sun; rain as
  soft motion-blurred streaks lit by the sky, with raindrop rings spreading on the sea. Fronds, leaves and grass let sunlight through: seen
  against the sun they glow yellow-green.
- **Lighting** — image-based lighting captured from the live sky every few seconds (real sky reflections and ambient on
  every PBR surface), screen-space ambient occlusion, light reaching underwater objects dimmed by the water above them. Underwater, surfaces are lit by a water environment (bright
  Snell's window overhead, blue water around, dark below) instead of the above-water sky.
- **Sky** — eleven photographed HDRI skies cross-faded by sun elevation (dawn → noon → sunset → night), real cumulus
  in fair weather, an overcast sky for storms, rotated to match the game's sun. Fog and ambient light follow the sky.
- **Islands** — scanned sand, wet sand, seabed, rock, leaf litter and grass blended by height, slope and biome; scanned
  ferns, shrubs, boulders, conch shells and branches; procedural coconut palms (ringed grey-brown trunks weathered dark at
  the base, folded arching fronds, dead fronds, green and brown coconut clusters); sea-almond trees with tiered branches and thousands of modelled leaves (a few
  turned red); mango trees with dense domed crowns; grass tussocks made of real curved blades.
- **Ground cover** — around the player, a dense carpet of short grass where the terrain is grassy, scattered pebbles,
  twigs and dead leaves inland, and shells, coral rubble, driftwood and a seaweed wrack line on the beaches.
- **Reefs** — patch reefs on the island shelves with sand channels between: around a diver, a dense field of branching
  and finger corals, brain, table and leather corals, sea fans, sponges, anemones, urchins, giant clams, sea stars,
  coral rubble and sea grass; sparser coral further out, and giant kelp with gas floats. Reef plants sit on the real
  sea floor.
- **First person** — a forearm and hand that closes around each tool's handle, every tool posed for how it is used:
  the paddle held diagonally with a shaped blade and a full stroke (reach, catch, pull, lift out), the spear levelled to
  thrust, a burning torch with a flickering layered flame that lights the hand, a knapped flint knife bound with cord,
  stone axes lashed to sticks, scanned steel axe and knife, a bow held at its leather grip
  with a taut string, a D-handled shovel with a dished blade, and a metal detector with grip, control box, arm cuff
  and search coil. Each kind of tool has its own motion: axes and picks chop over the shoulder, knives slash across,
  the spear draws back and thrusts, the shovel pushes and levers, the hook is thrown and the rod cast, the bow
  recoils; the hand breathes and sways as you walk.
- **Raft and debris** — an improvised raft: uneven hand-cut planks with gaps and nail heads on cross-bearers, three
  bark-on logs per tile lashed with rope (and now and then a salvaged drum tied underneath), board walls on battens
  between corner posts, thatched roofs with ragged eaves over rafters and a ridge pole; scanned crates, barrels, plastic crates, jerrycans and bottles drift past.
- **Wildlife** — goliath grouper with a heavy head, wide mouth, mottled skin and rounded fins; green turtle with a
  tortoiseshell carapace of radiating streaks and dark scaly flippers; grey reef shark (shadows the raft, attacks swimmers and the raft itself), schooling jacks and fusiliers in open
  water; on the reefs, pairs of butterflyfish, groups of blue and yellow tangs, moorish idols, grazing parrotfish,
  clouds of chromis over coral heads, sergeant majors and grunts, each fish with its own body shape and its own
  wandering, darting away from a diver who gets close, spotted eagle ray, green sea turtle, dolphins, moon jellyfish, green moray, great barracuda, goliath grouper,
  humpback whale, shore crabs, seabirds, boars.
- **Sky effects** — drifting cloud shadows on sea and land that follow the wind, gulls that circle islands and follow
  the raft (shaped body, swept grey wings with black tips, flapping and gliding), and a foam wake behind the raft or boat.
- **Items and crafting** — 335 items and 254 recipes: refined materials and machine parts, a full galley of island
  cooking, field medicine, copper/steel/titanium tools, clothing with real effects (armour, shade, rain, wind chill,
  swim speed, breath, pack slots) and trade goods. Every item can be obtained (recipe, station, harvest, animal or loot).
- **Interface** — every item and construction piece is shown as a 3D render made at load time (no emoji). HUD with ring
  gauges, a tick-strip compass with heading, clean clock/weather block and icon pickups. Crafting screen with category
  counts, icon tiles, ingredient progress bars, item stats, quantity picker and "used to make" links. Inventory with
  worn gear, body readout and an item detail pane. Construction menu as rendered tiles with costs.
- **Everything from before** — survival stats and ailments, research, skills, building, boats, fishing, diving,
  weather, a six-chapter story with three endings, quests, NPCs and trading, save slots.

## Project layout

```
index.html                 entry (loads src/main.js)
src/main.js                imports every system in order
src/core/                  core, assets loader, textures/materials, models, renderer, audio, sounds, game loop
src/ocean/ocean.js         FFT ocean, water shading, marine snow
src/world/                 sky (HDRI blending), world generation, ground cover, sites, game data (data.js, data_more.js, data_extra.js)
src/gameplay/              player, raft/structures, building, debris and hook, fishing, boats, creatures, wildlife, story, quests
src/net/net.js             two-player online co-op (PeerJS / WebRTC)
src/ui/                    HUD and panels; icons.js renders every item/build piece to an icon at load
public/assets/             downloaded textures, HDRIs, glTF models, manifest.json
scripts/fetch-assets.mjs   downloads and verifies the Poly Haven assets
scripts/verify-assets.mjs  re-checks them
tools/selftest.js          in-page functional test (70 checks)
tools/viewer.js            console camera helpers used for screenshots during development
tools/sounds.py            packs the public-domain recordings into src/core/sounds.js
audio_src/                 source recordings
```

Credits: `ASSET_CREDITS.md` and `SOUND_CREDITS.md`. Test results: `TEST_REPORT.md`. Status against the original brief:
`CHECKLIST.md`.
