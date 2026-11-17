'use strict';
/* Game data: items, crafting recipes, processor recipes, buildables, technology, skills, fish. */
(function () {
  const G = window.G;
  const IT = G.ITEMS = {};
  // it(id, name, icon, stack, category, value, desc, extra)
  const it = (id, n, i, s, c, v, d, x, y) => { IT[id] = Object.assign({ id, n, i, s, c, v, d }, x || {}, y || {}); };
  const food = (h, t, hp, spoil, sick) => ({ food: { h, t, hp: hp || 0, spoil: spoil || 0, sick: sick || 0 } });
  const tool = (type, tier, dur, dmg, x) => Object.assign({ tool: { type, tier, dur, dmg: dmg || 4 }, s: 1 }, x || {});

  // ---- materials ----
  it('plank', 'Plank', '🪵', 40, 'mat', 2, 'Sea-worn timber. The backbone of every raft.', { fuel: 18 });
  it('stick', 'Stick', '🥢', 40, 'mat', 1, 'Straight enough for handles, frames and kindling.', { fuel: 8 });
  it('log', 'Hardwood Log', '🌲', 30, 'mat', 4, 'Dense jungle hardwood. Saws into planks or burns down to charcoal.', { fuel: 30 });
  it('bamboo', 'Bamboo', '🎋', 40, 'mat', 2, 'Light, strong and hollow.');
  it('palm_leaf', 'Palm Leaf', '🌿', 40, 'mat', 1, 'Broad fronds for thatch, bedding and catching rain.', { fuel: 4 });
  it('fiber', 'Plant Fiber', '🌾', 60, 'mat', 1, 'Tough strands, twisted into cordage or woven into cloth.');
  it('vine', 'Vine', '🍃', 40, 'mat', 2, 'A ready-made length of jungle cord.');
  it('rope', 'Rope', '🪢', 40, 'mat', 4, 'Holds a raft together. You will always want more.');
  it('cloth', 'Cloth', '🧵', 30, 'mat', 5, 'Salvaged or woven fabric for sails, bandages and beds.');
  it('stone', 'Stone', '🪨', 60, 'mat', 1, 'A fist-sized rock.');
  it('flint', 'Flint', '🔻', 40, 'mat', 2, 'Flakes to a keen edge and throws sparks.');
  it('clay', 'Clay', '🟤', 40, 'mat', 2, 'Wet river clay. Fires into brick and flasks.');
  it('sand', 'Sand', '⏳', 60, 'mat', 1, 'Clean beach sand. Melts into glass in a furnace.');
  it('brick', 'Brick', '🧱', 40, 'mat', 4, 'Fired clay brick.');
  it('glass', 'Glass', '🔷', 30, 'mat', 6, 'A cloudy pane of furnace glass.');
  it('plastic', 'Plastic', '♻️', 60, 'mat', 2, 'The ocean is full of it. Finally, a use.');
  it('scrap', 'Scrap Metal', '🔩', 60, 'mat', 3, 'Bent plate and rusted fittings. Smelts back to iron.');
  it('nails', 'Nails', '📌', 80, 'mat', 1, 'Pulled, straightened and reused.');
  it('rubber', 'Rubber', '⚫', 30, 'mat', 4, 'Seals, hoses and gaskets.');
  it('electronics', 'Electronic Parts', '📟', 30, 'mat', 10, 'Capacitors, relays and salvageable boards.');
  it('wire', 'Copper Wire', '🧶', 40, 'mat', 6, 'Drawn copper conductor.');
  it('circuit', 'Circuit Board', '💾', 20, 'mat', 24, 'A working control board.');
  it('machine_part', 'Machine Part', '⚙️', 20, 'mat', 16, 'Gears, bearings and couplings.');
  it('battery', 'Battery', '🔋', 10, 'mat', 22, 'A sealed sulfur cell.');
  it('lens', 'Glass Lens', '🔍', 10, 'mat', 18, 'Ground and polished glass.');
  it('iron_ore', 'Iron Ore', '🟫', 40, 'mat', 4, 'Rust-streaked rock.');
  it('copper_ore', 'Copper Ore', '🟧', 40, 'mat', 4, 'Green-veined rock.');
  it('iron_ingot', 'Iron Ingot', '🔗', 40, 'mat', 10, 'Smelted iron.');
  it('copper_ingot', 'Copper Ingot', '🟠', 40, 'mat', 10, 'Smelted copper.');
  it('steel', 'Steel Plate', '⬜', 40, 'mat', 22, 'Carbon-hardened plate.');
  it('titanium', 'Titanium Nodule', '⚪', 30, 'mat', 34, 'A light, incorruptible metal from the deep shelf.');
  it('sulfur', 'Sulfur', '🟡', 40, 'mat', 6, 'Yellow crystals from volcanic vents.');
  it('obsidian', 'Obsidian', '⬛', 30, 'mat', 12, 'Volcanic glass, sharper than steel.');
  it('charcoal', 'Charcoal', '◼️', 40, 'mat', 3, 'Burns hot and long.', { fuel: 70 });
  it('fuel', 'Biofuel', '⛽', 20, 'mat', 12, 'A can of rough but serviceable fuel.', { fuel: 160 });
  it('shell', 'Seashell', '🐚', 40, 'mat', 3, 'Pretty, and useful ground into lime.');
  it('pearl', 'Pearl', '🔘', 20, 'mat', 45, 'Traders will give a great deal for one of these.');
  it('sponge', 'Sea Sponge', '🧽', 20, 'mat', 8, 'Natural filter material.');
  it('hide', 'Boar Hide', '🐗', 20, 'mat', 9, 'Thick, tough hide.');
  it('feather', 'Feather', '🪶', 40, 'mat', 2, 'Seabird flight feather.');
  it('bone', 'Bone', '🦴', 40, 'mat', 2, 'Carves well.');
  it('relic', 'Old Relic', '🗿', 10, 'mat', 55, 'A carved stone figure, older than any chart of these waters. Traders prize them.');
  it('salt', 'Sea Salt', '🧂', 40, 'mat', 3, 'Evaporated from seawater. Preserves food.');
  it('fertilizer', 'Compost', '💩', 40, 'mat', 3, 'Rich, dark and alive. Crops love it.');
  it('spoiled', 'Spoiled Food', '🤢', 40, 'mat', 0, 'Do not eat this. Compost it.', food(2, 0, -8, 0, 0.9));
  // ---- food & water ----
  it('ration', 'Emergency Ration', '🥫', 10, 'food', 8, 'Sealed lifeboat ration. Tasteless and eternal.', food(32, 4, 0, 0));
  it('coconut', 'Coconut', '🥥', 20, 'food', 3, 'Food and drink in one shell.', food(9, 20, 0, 240));
  it('berries', 'Shore Berries', '🫐', 30, 'food', 2, 'Tart and safe.', food(6, 4, 0, 60));
  it('mango', 'Mango', '🥭', 20, 'food', 4, 'Sweet and dripping.', food(14, 10, 2, 72));
  it('banana', 'Banana', '🍌', 20, 'food', 3, 'Reliable energy.', food(13, 3, 0, 72));
  it('pineapple', 'Pineapple', '🍍', 10, 'food', 6, 'Worth the prickles.', food(17, 13, 2, 110));
  it('mushroom', 'Forest Mushroom', '🍄', 30, 'food', 2, 'Better cooked into something.', food(7, 0, 0, 60, 0.18));
  it('potato', 'Wild Potato', '🥔', 30, 'food', 3, 'Starchy and filling once baked.', food(8, 0, 0, 200, 0.1));
  it('baked_potato', 'Baked Potato', '🍠', 20, 'food', 6, 'Hot, simple, good.', food(27, 0, 2, 96));
  it('seaweed', 'Seaweed', '🥬', 40, 'food', 1, 'Salty greens. Also composts and wraps.', food(4, -2, 0, 90));
  it('raw_fish', 'Raw Fish', '🐟', 20, 'food', 3, 'Cook it. You can eat it raw, once.', food(10, 2, 0, 30, 0.35));
  it('raw_fillet', 'Raw Fillet', '🍣', 20, 'food', 5, 'A thick cut from a large fish.', food(14, 2, 0, 30, 0.3));
  it('cooked_fish', 'Grilled Fish', '🍤', 20, 'food', 7, 'Crisp skin, flaky flesh.', food(26, 2, 3, 72));
  it('cooked_fillet', 'Grilled Fillet', '🍱', 20, 'food', 11, 'A proper meal.', food(38, 2, 5, 72));
  it('smoked_fish', 'Smoked Fish', '🍢', 20, 'food', 10, 'Keeps for weeks.', food(28, -2, 2, 600));
  it('dried_fish', 'Dried Fish', '🍘', 20, 'food', 8, 'Chewy and durable.', food(22, -4, 0, 900));
  it('raw_crab', 'Raw Crab', '🦀', 20, 'food', 4, 'Still pinching.', food(8, 0, 0, 30, 0.4));
  it('cooked_crab', 'Steamed Crab', '🦞', 20, 'food', 9, 'Sweet white meat.', food(30, 2, 4, 60));
  it('clam', 'Clam', '🦪', 30, 'food', 3, 'Slippery.', food(6, 2, 0, 36, 0.25));
  it('steamed_clam', 'Steamed Clams', '🍜', 20, 'food', 7, 'Briny broth.', food(20, 8, 2, 60));
  it('raw_meat', 'Raw Meat', '🥩', 20, 'food', 5, 'Boar. Needs fire.', food(10, 0, 0, 24, 0.5));
  it('cooked_meat', 'Roast Meat', '🍖', 20, 'food', 12, 'Rich and filling.', food(42, 0, 6, 60));
  it('jerky', 'Jerky', '🥓', 20, 'food', 11, 'Salt, smoke and patience.', food(30, -4, 2, 900));
  it('fish_soup', 'Fisherman\'s Soup', '🍲', 10, 'food', 18, 'Warms you through. Dries you out, too.', food(46, 28, 8, 48, 0), { warm: 20 });
  it('stew', 'Islander Stew', '🥘', 10, 'food', 24, 'A feast. Restores a great deal.', food(64, 12, 14, 48), { warm: 20 });
  it('fruit_salad', 'Fruit Salad', '🥗', 10, 'food', 14, 'Bright and hydrating.', food(34, 26, 6, 36), { energy: 10 });
  it('curry', 'Coconut Curry', '🍛', 10, 'food', 22, 'Fragrant and sustaining.', food(56, 14, 10, 48), { warm: 10 });
  it('wrap', 'Seaweed Wrap', '🌯', 10, 'food', 12, 'Trail food for sailors.', food(32, 0, 3, 96));
  it('herbal_tea', 'Herbal Tea', '🍵', 10, 'food', 9, 'Soothing. Eases chills and settles the stomach.', food(2, 34, 4, 24), { warm: 25, cure: ['sick'] });
  it('bottle', 'Flask', '🍾', 10, 'tool', 4, 'Empty. Fill it from the sea (to purify) or from fresh water.', { use: 'fill' });
  it('bottle_sea', 'Flask of Seawater', '🌊', 10, 'food', 4, 'Drinking this makes things worse. Purify it.', food(0, -14, -2, 0, 0.5), { returns: 'bottle' });
  it('bottle_fresh', 'Flask of Fresh Water', '💧', 10, 'food', 8, 'Clean, sweet water.', food(0, 42, 0, 0), { returns: 'bottle' });
  // ---- seeds ----
  it('seeds_potato', 'Potato Cuttings', '🌱', 30, 'seed', 3, 'Plant in a grow bed.', { crop: 'potato' });
  it('seeds_pineapple', 'Pineapple Crown', '🌱', 30, 'seed', 4, 'Plant in a grow bed.', { crop: 'pineapple' });
  it('seeds_aloe', 'Aloe Pup', '🌱', 30, 'seed', 4, 'Plant in a grow bed.', { crop: 'aloe' });
  it('seeds_flax', 'Flax Seed', '🌱', 30, 'seed', 2, 'Plant in a grow bed.', { crop: 'fiber' });
  // ---- medical ----
  it('aloe', 'Aloe Leaf', '🪴', 20, 'med', 4, 'Cooling gel. Soothes sunburn and small wounds.', { med: { hp: 6, cure: ['sunburn'] } });
  it('bandage', 'Bandage', '🩹', 20, 'med', 6, 'Stops bleeding.', { med: { hp: 8, cure: ['bleeding'] } });
  it('salve', 'Herbal Salve', '🧪', 10, 'med', 12, 'Draws out infection.', { med: { hp: 6, cure: ['infection', 'sunburn'] } });
  it('antidote', 'Antidote', '⚗️', 10, 'med', 16, 'Neutralises venom and food poisoning.', { med: { hp: 4, cure: ['poison', 'sick'] } });
  it('splint', 'Splint', '🦯', 10, 'med', 8, 'Sets a fracture so it can heal.', { med: { hp: 2, cure: ['fracture'] } });
  it('medkit', 'Field Medkit', '🩺', 5, 'med', 40, 'Treats everything at once.', { med: { hp: 55, cure: ['bleeding', 'infection', 'poison', 'sick', 'fracture', 'sunburn'] } });
  // ---- tools ----
  it('hook', 'Driftwood Hook', '🪝', 1, 'tool', 5, 'Hold and release to throw. Reels in floating debris.', tool('hook', 0, 120));
  it('hook_metal', 'Grapple Hook', '🪝', 1, 'tool', 20, 'Flies farther, reels faster, lasts longer.', tool('hook', 1, 400));
  it('mallet', 'Builder\'s Mallet', '🔨', 1, 'tool', 6, 'Required for construction. Left-click a damaged structure to repair it.', tool('mallet', 0, 300));
  it('stone_knife', 'Stone Knife', '🔪', 1, 'tool', 4, 'Cuts, skins and, if it must, defends.', tool('knife', 0, 60, 9));
  it('stone_axe', 'Stone Axe', '🪓', 1, 'tool', 6, 'Fells palms and soft wood.', tool('axe', 0, 70, 8));
  it('axe', 'Iron Axe', '🪓', 1, 'tool', 30, 'Bites into hardwood.', tool('axe', 1, 220, 13));
  it('axe_steel', 'Steel Axe', '🪓', 1, 'tool', 70, 'Fells anything, quickly.', tool('axe', 2, 520, 18));
  it('stone_pick', 'Stone Pick', '⛏️', 1, 'tool', 6, 'Breaks boulders.', tool('pick', 0, 70, 6));
  it('pick', 'Iron Pick', '⛏️', 1, 'tool', 30, 'Opens ore-bearing rock.', tool('pick', 1, 220, 9));
  it('pick_steel', 'Steel Pick', '⛏️', 1, 'tool', 70, 'Cracks obsidian, titanium and crystal.', tool('pick', 2, 520, 12));
  it('shovel', 'Shovel', '⚒️', 1, 'tool', 14, 'Dig sand on beaches, and whatever is buried under an X.', tool('shovel', 0, 160));
  it('machete', 'Machete', '🗡️', 1, 'tool', 18, 'Clears brush fast and hits hard.', tool('knife', 1, 200, 16));
  it('spear', 'Wooden Spear', '🔱', 1, 'tool', 6, 'Reach matters. Works underwater for spearfishing.', tool('spear', 0, 60, 14));
  it('spear_iron', 'Iron Spear', '🔱', 1, 'tool', 34, 'A serious weapon and a fine fishing tool.', tool('spear', 1, 220, 24));
  it('bow', 'Hunting Bow', '🏹', 1, 'tool', 22, 'Needs arrows. Quiet and accurate.', tool('bow', 0, 150, 26));
  it('arrow', 'Arrow', '➹', 40, 'mat', 1, 'Flint-tipped.');
  it('fishing_rod', 'Fishing Rod', '🎣', 1, 'tool', 10, 'Cast with left-click. Reel when the float dips.', tool('rod', 0, 80));
  it('rod_pro', 'Geared Rod', '🎣', 1, 'tool', 46, 'A real reel. Handles big fish and deep water.', tool('rod', 1, 260));
  it('bait', 'Bait', '🪱', 40, 'mat', 1, 'Fish bite sooner with bait on the hook.');
  it('lure', 'Feather Lure', '🪰', 20, 'mat', 5, 'Attracts rarer fish.');
  it('paddle', 'Paddle', '🛶', 1, 'tool', 5, 'Hold left-click aboard the raft to paddle where you look.', tool('paddle', 0, 300));
  it('torch', 'Torch', '🔥', 1, 'tool', 3, 'Light and a little warmth. Burns down while held.', tool('torch', 0, 240));
  it('flashlight', 'Dive Light', '🔦', 1, 'tool', 40, 'Waterproof. Toggle with the light key from anywhere in your pack.', { passive: 'light' });
  it('binoculars', 'Binoculars', '🔭', 1, 'tool', 30, 'Hold right-click to scan the horizon. Reveals islands on the chart.', tool('binoculars', 0, 9999));
  it('metal_detector', 'Metal Detector', '🧲', 1, 'tool', 60, 'Ticks faster near buried caches.', tool('detector', 0, 9999));
  it('sonar', 'Handheld Sonar', '📡', 1, 'tool', 90, 'Left-click to ping. Marks wrecks and structures on the chart.', tool('sonar', 0, 9999));
  it('repair_kit', 'Repair Kit', '🧰', 10, 'tool', 12, 'Use to fully restore the tool in your first worn slot.', { use: 'repair' });
  it('compass', 'Compass', '🧭', 1, 'tool', 15, 'Shows your heading on the HUD while carried.', { passive: 'compass' });
  it('depth_gauge', 'Depth Gauge', '⏱️', 1, 'tool', 30, 'Shows depth and remaining air margin while diving.', { passive: 'depth' });
  it('treasure_map', 'Tattered Chart', '🗺️', 5, 'tool', 20, 'Use to mark the X on your chart. Bring a shovel.', { use: 'treasure' });
  // ---- wearable gear ----
  it('sun_hat', 'Woven Hat', '👒', 1, 'gear', 6, 'Shade. Slows overheating and sunburn.', { equip: 'head' });
  it('dive_mask', 'Dive Mask', '🥽', 1, 'gear', 26, 'See clearly underwater and hold your breath longer.', { equip: 'face' });
  it('raincoat', 'Slicker', '🧥', 1, 'gear', 14, 'Keeps rain off. You stay warm and dry.', { equip: 'body' });
  it('wetsuit', 'Wetsuit', '🩱', 1, 'gear', 60, 'Insulates in cold water and guards against stings.', { equip: 'body' });
  it('fins', 'Swim Fins', '🩴', 1, 'gear', 24, 'Much faster swimming.', { equip: 'feet' });
  it('tank_small', 'Air Tank', '🧯', 1, 'gear', 80, 'Two extra minutes of air. Refill at an air compressor.', { equip: 'back', air: 120 });
  it('tank_large', 'Twin Tank', '🧯', 1, 'gear', 160, 'Five minutes of air for serious dives.', { equip: 'back', air: 300 });
  it('rebreather', 'Rebreather', '🤿', 1, 'gear', 320, 'Ten minutes of air and protection from deep pressure.', { equip: 'back', air: 600, deep: true });
  it('backpack', 'Canvas Pack', '🎒', 1, 'gear', 30, 'Ten more inventory slots while worn.', { equip: 'pack' });
  // ---- story ----
  it('radio_part', 'Radio Component', '📻', 10, 'story', 0, 'A salvaged valve assembly. Your damaged radio needs three.');
  it('beacon_core', 'Beacon Core', '🔆', 5, 'story', 0, 'Lens, coil and cell. Relights a Lantern station.');
  it('data_core', 'Data Core', '💽', 5, 'story', 0, 'Sealed research storage from Deepwell.');
  it('keycard', 'Meridian Keycard', '💳', 1, 'story', 0, 'Opens Institute doors.');
  it('keystone_key', 'Keystone Key', '🗝️', 1, 'story', 0, 'A crystal-cored command key for the central array.');
  // ---- boats ----
  it('kit_rowboat', 'Rowboat (kit)', '🚣', 1, 'tool', 60, 'Use at the water\'s edge to launch a nimble two-seat rowboat.', { use: 'boat', boat: 'rowboat' });
  it('kit_sailboat', 'Sailing Dinghy (kit)', '⛵', 1, 'tool', 140, 'Use on water to launch a fast sailing dinghy with storage.', { use: 'boat', boat: 'sailboat' });
  it('kit_skiff', 'Motor Skiff (kit)', '🚤', 1, 'tool', 300, 'Use on water to launch a fuel-powered skiff. Fastest thing on the sea.', { use: 'boat', boat: 'skiff' });
  for (const k in IT) { const o = IT[k]; o.rv = o.c === 'story' ? 6 : Math.max(1, Math.round(o.v / 2.5)); }

  // ---- crafting recipes: [id, output, qty, ingredients, station, tech, category, time] ----
  const R = G.RECIPES = [];
  const rc = (id, out, q, ing, st, tech, cat, t) => R.push({ id, out, q, ing, st: st || null, tech: tech || null, cat, t: t || 2 });
  rc('rope', 'rope', 1, { fiber: 4 }, null, null, 'basics'); rc('rope_vine', 'rope', 1, { vine: 2 }, null, null, 'basics'); rc('rope_leaf', 'rope', 1, { palm_leaf: 4 }, null, null, 'basics');
  rc('plank_log', 'plank', 3, { log: 1 }, null, null, 'basics'); rc('stick_plank', 'stick', 2, { plank: 1 }, null, null, 'basics');
  rc('cloth', 'cloth', 1, { fiber: 6 }, null, null, 'basics', 4); rc('nails', 'nails', 4, { scrap: 1 }, 'workbench', null, 'basics');
  rc('bottle', 'bottle', 1, { clay: 3 }, 'fire', null, 'basics', 5); rc('lens', 'lens', 1, { glass: 2 }, 'workbench', null, 'basics', 5);
  rc('wire', 'wire', 3, { copper_ingot: 1 }, 'workbench', null, 'basics'); rc('bait', 'bait', 4, { raw_fish: 1 }, null, null, 'basics'); rc('bait_m', 'bait', 2, { mushroom: 1 }, null, null, 'basics');
  rc('arrow', 'arrow', 3, { stick: 1, flint: 1, feather: 1 }, null, null, 'basics');
  rc('mallet', 'mallet', 1, { plank: 2, rope: 1 }, null, null, 'tools'); rc('stone_knife', 'stone_knife', 1, { stone: 1, flint: 1, stick: 1 }, null, null, 'tools');
  rc('stone_axe', 'stone_axe', 1, { stone: 2, stick: 2, rope: 1 }, null, null, 'tools'); rc('stone_pick', 'stone_pick', 1, { stone: 2, stick: 2, flint: 1, rope: 1 }, null, null, 'tools');
  rc('hook', 'hook', 1, { stick: 2, rope: 2 }, null, null, 'tools'); rc('spear', 'spear', 1, { stick: 3, flint: 1, rope: 1 }, null, null, 'tools');
  rc('paddle', 'paddle', 1, { plank: 2, rope: 1 }, null, null, 'tools'); rc('torch', 'torch', 1, { stick: 1, fiber: 2 }, null, null, 'tools');
  rc('fishing_rod', 'fishing_rod', 1, { stick: 3, rope: 2, flint: 1 }, null, null, 'tools'); rc('shovel', 'shovel', 1, { scrap: 3, stick: 2, rope: 1 }, 'workbench', null, 'tools');
  rc('machete', 'machete', 1, { scrap: 3, stick: 1, rope: 1 }, 'workbench', null, 'tools'); rc('hook_metal', 'hook_metal', 1, { scrap: 3, rope: 3 }, 'workbench', 'seafaring', 'tools');
  rc('bow', 'bow', 1, { bamboo: 2, rope: 2 }, 'workbench', null, 'tools'); rc('repair_kit', 'repair_kit', 1, { scrap: 2, rope: 1, nails: 2 }, 'workbench', null, 'tools');
  rc('rod_pro', 'rod_pro', 1, { bamboo: 3, rope: 2, machine_part: 1, nails: 2 }, 'workbench', 'angling', 'tools'); rc('lure', 'lure', 2, { feather: 1, nails: 1, fiber: 1 }, 'workbench', 'angling', 'tools');
  rc('axe', 'axe', 1, { iron_ingot: 2, stick: 2, rope: 1 }, 'forge', 'smelting', 'tools', 5); rc('pick', 'pick', 1, { iron_ingot: 2, stick: 2, rope: 1 }, 'forge', 'smelting', 'tools', 5);
  rc('spear_iron', 'spear_iron', 1, { iron_ingot: 1, stick: 2, rope: 1 }, 'forge', 'smelting', 'tools', 5);
  rc('steel', 'steel', 1, { iron_ingot: 2, charcoal: 2 }, 'forge', 'machinery', 'industry', 6);
  rc('axe_steel', 'axe_steel', 1, { steel: 3, log: 1, rope: 1 }, 'forge', 'steelwork', 'tools', 6); rc('pick_steel', 'pick_steel', 1, { steel: 3, log: 1, rope: 1 }, 'forge', 'steelwork', 'tools', 6);
  rc('binoculars', 'binoculars', 1, { lens: 2, plastic: 2 }, 'workbench', 'navigation', 'tools', 5);
  rc('sun_hat', 'sun_hat', 1, { palm_leaf: 4, fiber: 2 }, null, null, 'gear'); rc('raincoat', 'raincoat', 1, { plastic: 6, rope: 1 }, 'workbench', null, 'gear');
  rc('backpack', 'backpack', 1, { cloth: 4, rope: 3 }, 'workbench', null, 'gear', 5);
  rc('dive_mask', 'dive_mask', 1, { glass: 2, rubber: 2 }, 'workbench', 'freediving', 'gear', 5); rc('fins', 'fins', 1, { rubber: 3, plastic: 2 }, 'workbench', 'freediving', 'gear', 5);
  rc('bandage', 'bandage', 2, { cloth: 1 }, null, null, 'medical'); rc('bandage_leaf', 'bandage', 1, { palm_leaf: 2, fiber: 2 }, null, null, 'medical');
  rc('splint', 'splint', 1, { stick: 2, rope: 1 }, null, null, 'medical'); rc('salve', 'salve', 1, { aloe: 2, fiber: 1 }, null, null, 'medical');
  rc('antidote', 'antidote', 1, { aloe: 1, mushroom: 1, charcoal: 1 }, 'fire', 'medicine', 'medical', 5); rc('medkit', 'medkit', 1, { bandage: 2, salve: 1, antidote: 1, cloth: 1 }, 'workbench', 'medicine', 'medical', 6);
  rc('fruit_salad', 'fruit_salad', 1, { mango: 1, banana: 1, berries: 2 }, null, null, 'food'); rc('wrap', 'wrap', 1, { seaweed: 2, cooked_fish: 1 }, null, null, 'food');
  rc('herbal_tea', 'herbal_tea', 1, { bottle_fresh: 1, aloe: 1, berries: 1 }, 'fire', null, 'food', 5);
  rc('fish_soup', 'fish_soup', 1, { cooked_fish: 1, potato: 1, bottle_fresh: 1 }, 'grill', 'cooking', 'food', 6); rc('stew', 'stew', 1, { cooked_meat: 1, potato: 1, mushroom: 2 }, 'grill', 'cooking', 'food', 6);
  rc('curry', 'curry', 1, { coconut: 1, cooked_fillet: 1, aloe: 1 }, 'grill', 'cooking', 'food', 6);
  rc('machine_part', 'machine_part', 1, { iron_ingot: 2, copper_ingot: 1 }, 'forge', 'machinery', 'industry', 6);
  rc('circuit', 'circuit', 1, { electronics: 2, wire: 2, plastic: 1 }, 'machine', 'electrics', 'industry', 6);
  rc('battery', 'battery', 1, { copper_ingot: 1, iron_ingot: 1, sulfur: 1, plastic: 1 }, 'machine', 'electrics', 'industry', 6);
  rc('flashlight', 'flashlight', 1, { plastic: 2, battery: 1, lens: 1, wire: 1 }, 'workbench', 'electrics', 'gear', 6);
  rc('metal_detector', 'metal_detector', 1, { circuit: 1, battery: 1, wire: 3, stick: 1 }, 'machine', 'electrics', 'tools', 8);
  rc('fuel', 'fuel', 2, { seaweed: 4, charcoal: 1 }, 'machine', 'engines', 'industry', 6);
  rc('tank_small', 'tank_small', 1, { steel: 3, rubber: 1, machine_part: 1 }, 'machine', 'scuba', 'gear', 8); rc('wetsuit', 'wetsuit', 1, { rubber: 6, cloth: 3 }, 'machine', 'scuba', 'gear', 8);
  rc('depth_gauge', 'depth_gauge', 1, { glass: 1, machine_part: 1 }, 'machine', 'scuba', 'gear', 5);
  rc('tank_large', 'tank_large', 1, { titanium: 3, steel: 2, machine_part: 2 }, 'machine', 'deepdive', 'gear', 10);
  rc('rebreather', 'rebreather', 1, { titanium: 4, circuit: 2, rubber: 3, tank_large: 1 }, 'machine', 'deepdive', 'gear', 12);
  rc('sonar', 'sonar', 1, { circuit: 2, battery: 1, plastic: 3, wire: 2 }, 'machine', 'sonar', 'tools', 8);
  rc('kit_rowboat', 'kit_rowboat', 1, { plank: 12, rope: 4, nails: 8 }, 'workbench', 'seafaring', 'boats', 10);
  rc('kit_sailboat', 'kit_sailboat', 1, { plank: 16, log: 4, cloth: 6, rope: 6, nails: 10 }, 'workbench', 'shipwright', 'boats', 14);
  rc('kit_skiff', 'kit_skiff', 1, { steel: 6, machine_part: 3, rubber: 4, plastic: 8 }, 'machine', 'engines', 'boats', 16);
  rc('beacon_core', 'beacon_core', 1, { lens: 1, wire: 2, glass: 1, scrap: 2 }, 'workbench', 'lanternwork', 'story', 8);
  rc('keystone_key', 'keystone_key', 1, { data_core: 3, crystal: 1, circuit: 2 }, 'machine', 'keystone', 'story', 12);
  it('crystal', 'Resonant Crystal', '💎', 5, 'story', 60, 'It hums against your palm, in time with the distant storm.');
  IT.crystal.rv = 8;
  G.RECIPE_CATS = [['all', 'All'], ['basics', 'Materials'], ['tools', 'Tools'], ['gear', 'Gear'], ['medical', 'Medical'], ['food', 'Food'], ['industry', 'Industry'], ['boats', 'Boats'], ['story', 'Expedition']];
  G.STATION_NAMES = { workbench: 'Workbench', fire: 'Campfire or Grill', grill: 'Grill', forge: 'Furnace', machine: 'Machine Bench' };

  // ---- processors: station -> [input, n, output, m, seconds] ----
  G.PROCESS = {
    fire: [['raw_fish', 1, 'cooked_fish', 1, 18], ['raw_fillet', 1, 'cooked_fillet', 1, 24], ['raw_crab', 1, 'cooked_crab', 1, 20], ['clam', 2, 'steamed_clam', 1, 18], ['raw_meat', 1, 'cooked_meat', 1, 26], ['potato', 1, 'baked_potato', 1, 18], ['log', 1, 'charcoal', 2, 22], ['clay', 2, 'brick', 1, 22], ['bottle_sea', 1, 'bottle_fresh', 1, 30]],
    smoker: [['raw_fish', 1, 'smoked_fish', 1, 50], ['raw_fillet', 1, 'smoked_fish', 2, 60], ['raw_meat', 1, 'jerky', 1, 60]],
    rack: [['raw_fish', 1, 'dried_fish', 1, 110], ['raw_meat', 1, 'jerky', 1, 130], ['bottle_sea', 1, 'salt', 2, 90], ['fiber', 6, 'cloth', 1, 60]],
    furnace: [['iron_ore', 2, 'iron_ingot', 1, 22], ['copper_ore', 2, 'copper_ingot', 1, 22], ['sand', 2, 'glass', 1, 18], ['scrap', 3, 'iron_ingot', 1, 20], ['log', 1, 'charcoal', 3, 14], ['clay', 2, 'brick', 1, 14], ['shell', 3, 'fertilizer', 1, 12]],
    still: [['bottle_sea', 1, 'bottle_fresh', 1, 70]],
    recycler: [['scrap', 2, 'iron_ingot', 1, 10], ['plastic', 3, 'fuel', 1, 14], ['electronics', 3, 'circuit', 1, 16], ['bottle', 1, 'glass', 1, 8], ['cloth', 1, 'fiber', 4, 6]],
    composter: [['spoiled', 2, 'fertilizer', 1, 40], ['seaweed', 4, 'fertilizer', 1, 50], ['palm_leaf', 6, 'fertilizer', 1, 60]]
  };
  G.CROPS = {
    potato: { name: 'Potato', out: 'potato', q: [3, 5], days: 2.0, icon: '🥔' }, pineapple: { name: 'Pineapple', out: 'pineapple', q: [1, 2], days: 3.0, icon: '🍍' },
    aloe: { name: 'Aloe', out: 'aloe', q: [2, 4], days: 2.5, icon: '🪴' }, fiber: { name: 'Flax', out: 'fiber', q: [6, 10], days: 1.5, icon: '🌾' }
  };

  // ---- buildables ----
  const B = G.BUILD = {};
  const bd = (id, n, i, cat, kind, cost, tech, x) => { B[id] = Object.assign({ id, n, i, cat, kind, cost, tech: tech || null }, x || {}); };
  bd('foundation', 'Raft Foundation', '🟫', 'structure', 'foundation', { plank: 3, rope: 1 }, null, { hp: 60, d: 'Floating deck on lashed logs. On land it stands on posts.' });
  bd('foundation_reinf', 'Reinforced Foundation', '🟧', 'structure', 'foundation', { plank: 2, scrap: 2, nails: 2 }, 'carpentry', { hp: 140, d: 'Iron-strapped deck. Shrugs off storm damage.' });
  bd('foundation_metal', 'Steel Foundation', '⬜', 'structure', 'foundation', { steel: 2, scrap: 2 }, 'steelwork', { hp: 320, d: 'Pontoon deck plate. Built for the open ocean.' });
  bd('floor', 'Upper Floor', '🟨', 'structure', 'floor', { plank: 3, nails: 2 }, 'carpentry', { hp: 60, d: 'A second storey. Needs a wall or stairs beneath, or a supported neighbour.' });
  bd('wall', 'Plank Wall', '🧱', 'structure', 'wall', { plank: 3 }, null, { d: 'Shelter from wind and spray.' });
  bd('wall_window', 'Window Wall', '🪟', 'structure', 'wall', { plank: 2, stick: 2 }, null, { d: 'A wall with a view.' });
  bd('wall_door', 'Doorway', '🚪', 'structure', 'wall', { plank: 4, rope: 1 }, null, { d: 'A wall you can walk through. Interact to open and close.' });
  bd('wall_metal', 'Steel Wall', '⬛', 'structure', 'wall', { steel: 1, scrap: 2 }, 'steelwork', { d: 'Riveted plate.' });
  bd('railing', 'Railing', '🪜', 'structure', 'wall', { stick: 2, rope: 1 }, null, { d: 'Keeps you aboard in rough water.' });
  bd('stairs', 'Stairs', '📶', 'structure', 'stairs', { plank: 5, nails: 2 }, 'carpentry', { d: 'Climb to the next level.' });
  bd('roof', 'Thatch Roof', '🛖', 'structure', 'roof', { palm_leaf: 4, stick: 2 }, null, { d: 'Covers the tile below: shade, dry sleep, and a warmer night.' });
  bd('campfire', 'Campfire', '🔥', 'survival', 'item', { stone: 4, stick: 3 }, null, { station: ['fire'], proc: 'fire', slots: 1, fueled: true, light: true, d: 'Cooks one item at a time. Warmth and light.' });
  bd('grill', 'Grill', '♨️', 'survival', 'item', { scrap: 3, stone: 2, nails: 2 }, 'cooking', { station: ['fire', 'grill'], proc: 'fire', slots: 3, fueled: true, speed: 1.5, light: true, d: 'Three cooking slots, faster, and enables prepared meals.' });
  bd('smoker', 'Smoker', '🏺', 'survival', 'item', { plank: 4, scrap: 2, stone: 2 }, 'preserving', { proc: 'smoker', slots: 3, fueled: true, d: 'Slow smoke turns catch into food that keeps.' });
  bd('rack', 'Drying Rack', '🧺', 'survival', 'item', { stick: 6, rope: 2 }, null, { proc: 'rack', slots: 3, d: 'Sun and wind do the work. No fuel needed.' });
  bd('collector', 'Rain Catcher', '☔', 'survival', 'item', { plank: 3, palm_leaf: 4, rope: 1 }, null, { water: 6, d: 'Fills in rain, and slowly from dew. Drink, or fill flasks.' });
  bd('still', 'Solar Still', '🫙', 'survival', 'item', { plank: 2, plastic: 3, palm_leaf: 2 }, null, { proc: 'still', slots: 2, d: 'Distils flasks of seawater into fresh water. Slow, free.' });
  bd('desalinator', 'Desalinator', '🚰', 'survival', 'item', { steel: 3, machine_part: 2, circuit: 1, plastic: 4 }, 'watertech', { water: 20, power: -1.5, d: 'Powered. Produces fresh water continuously.' });
  bd('bed_leaf', 'Leaf Bed', '🛏️', 'survival', 'item', { palm_leaf: 6, rope: 2 }, null, { bed: 0.6, d: 'Sleep through the night. Better under a roof.' });
  bd('bed', 'Bunk', '🛌', 'survival', 'item', { plank: 6, cloth: 4, fiber: 8 }, 'carpentry', { bed: 1.0, d: 'Real rest. Sets your respawn point.' });
  bd('chest', 'Storage Crate', '📦', 'survival', 'item', { plank: 5, rope: 2 }, null, { store: 16, d: 'Sixteen slots. Crafting draws from nearby storage.' });
  bd('locker', 'Cargo Locker', '🗄️', 'survival', 'item', { plank: 8, scrap: 4, nails: 4 }, 'carpentry', { store: 32, d: 'Thirty-two slots.' });
  bd('workbench', 'Workbench', '🛠️', 'stations', 'item', { plank: 6, stone: 2, rope: 2 }, null, { station: ['workbench'], d: 'Unlocks tool, gear and boat recipes.' });
  bd('research', 'Research Desk', '🔬', 'stations', 'item', { plank: 4, bottle: 1, scrap: 2 }, null, { research: true, d: 'Study what you find to earn insight, and spend it on technology.' });
  bd('furnace', 'Furnace', '🏭', 'stations', 'item', { stone: 10, clay: 6 }, 'smelting', { station: ['forge'], proc: 'furnace', slots: 3, fueled: true, light: true, d: 'Smelts ore, melts sand to glass, forges tools.' });
  bd('machine_bench', 'Machine Bench', '🗜️', 'stations', 'item', { steel: 4, machine_part: 2, nails: 6, plank: 4 }, 'machinery', { station: ['machine', 'workbench'], d: 'Precision work: electronics, dive gear, engines.' });
  bd('recycler', 'Recycler', '♻️', 'stations', 'item', { steel: 3, machine_part: 2, circuit: 1 }, 'recycling', { proc: 'recycler', slots: 3, power: -1, d: 'Powered. Breaks salvage down into useful stock.' });
  bd('composter', 'Composter', '🪣', 'stations', 'item', { plank: 4, nails: 2 }, 'farming', { proc: 'composter', slots: 3, d: 'Turns spoiled food and greens into compost.' });
  bd('compressor', 'Air Compressor', '🫁', 'stations', 'item', { steel: 2, machine_part: 2, rubber: 2, circuit: 1 }, 'scuba', { power: -1.5, compressor: true, d: 'Powered. Refills the air tank you are wearing.' });
  bd('sail', 'Sail', '⛵', 'sailing', 'item', { plank: 4, cloth: 2, rope: 3 }, null, { sail: true, raftOnly: true, d: 'Interact to set or furl. Drives the raft forward; strongest with the wind behind.' });
  bd('helm', 'Helm', '☸️', 'sailing', 'item', { plank: 4, rope: 2, scrap: 1 }, 'seafaring', { helm: true, raftOnly: true, d: 'Take the wheel to steer. A/D turn, W/S trim the sail or throttle.' });
  bd('anchor', 'Anchor', '⚓', 'sailing', 'item', { stone: 4, rope: 4 }, null, { anchor: true, raftOnly: true, d: 'Interact to drop or weigh. Holds the raft against current and wind.' });
  bd('engine', 'Outboard Engine', '🛥️', 'sailing', 'item', { steel: 4, machine_part: 4, wire: 2, rubber: 2 }, 'engines', { engine: true, raftOnly: true, d: 'Burns biofuel. Pushes even a heavy raft against the wind.' });
  bd('nav_table', 'Navigation Table', '🧭', 'sailing', 'item', { plank: 4, glass: 1, cloth: 1 }, 'navigation', { nav: true, d: 'Widens your chart survey and lets you plot coordinates you recover.' });
  bd('radio', 'Radio Set', '📻', 'sailing', 'item', { electronics: 2, wire: 2, plastic: 2 }, 'electrics', { radio: true, d: 'Receives transmissions. Interact to listen.' });
  bd('weather_station', 'Weather Station', '🌡️', 'sailing', 'item', { scrap: 2, glass: 1, plank: 2, wire: 1 }, 'meteorology', { forecast: true, d: 'Forecasts the next weather change on your HUD.' });
  bd('solar', 'Solar Panel', '🔆', 'power', 'item', { glass: 3, circuit: 1, wire: 2, scrap: 2 }, 'electrics', { power: 2, solar: true, d: 'Generates power in daylight.' });
  bd('turbine', 'Wind Turbine', '🌀', 'power', 'item', { steel: 2, machine_part: 2, cloth: 2, wire: 2 }, 'electrics', { power: 2, wind: true, d: 'Generates power from wind, day and night.' });
  bd('battery_bank', 'Battery Bank', '🔋', 'power', 'item', { battery: 3, wire: 2, plastic: 2 }, 'electrics', { cap: 400, d: 'Stores surplus power for the night.' });
  bd('generator', 'Generator', '⚡', 'power', 'item', { steel: 3, machine_part: 3, wire: 2 }, 'engines', { power: 5, gen: true, d: 'Burns biofuel for steady power.' });
  bd('planter', 'Grow Bed', '🌱', 'farming', 'item', { plank: 4, stone: 1 }, 'farming', { planter: true, d: 'Plant seeds, keep it watered, harvest in a few days. Rain waters it for you.' });
  bd('fish_trap', 'Fish Trap', '🪤', 'farming', 'item', { stick: 6, rope: 2, fiber: 2 }, 'angling', { trap: true, raftOnly: true, d: 'Catches small fish and crabs over time while the raft is at sea.' });
  bd('lantern', 'Lantern', '🏮', 'decor', 'item', { bottle: 1, scrap: 1, fiber: 1 }, null, { light: true, small: true, d: 'Warm light after dark.' });
  bd('torch_post', 'Torch Post', '🕯️', 'decor', 'item', { stick: 3, fiber: 2 }, null, { light: true, small: true, d: 'A standing torch.' });
  bd('chair', 'Chair', '🪑', 'decor', 'item', { plank: 2, stick: 2 }, null, { d: 'Somewhere to watch the sunset.' });
  bd('table', 'Table', '🍽️', 'decor', 'item', { plank: 4, stick: 2 }, null, { d: 'A place to eat like a person.' });
  bd('shelf', 'Shelf', '📚', 'decor', 'item', { plank: 3, nails: 2 }, 'carpentry', { store: 8, d: 'Eight slots of open storage.' });
  bd('rug', 'Woven Rug', '🟥', 'decor', 'item', { cloth: 3, fiber: 2 }, null, { flat: true, d: 'Softens a deck.' });
  bd('plant_pot', 'Potted Palm', '🪴', 'decor', 'item', { clay: 2, fiber: 1 }, null, { small: true, d: 'A little green aboard.' });
  bd('trophy', 'Catch Mount', '🐠', 'decor', 'item', { plank: 2, nails: 1, raw_fillet: 1 }, 'angling', { small: true, d: 'Shows off your largest catch.' });
  bd('flag', 'Signal Flag', '🚩', 'decor', 'item', { cloth: 2, stick: 2 }, null, { small: true, d: 'Shows the wind and marks your home.' });
  G.BUILD_CATS = [['structure', 'Structure'], ['survival', 'Survival'], ['stations', 'Stations'], ['sailing', 'Sailing'], ['power', 'Power'], ['farming', 'Farming'], ['decor', 'Comfort']];

  // ---- technology ----
  const T = G.TECH = {};
  const tc = (id, n, i, tier, cost, req, d, flag) => { T[id] = { id, n, i, tier, cost, req: req || [], d, flag: flag || null }; };
  tc('carpentry', 'Carpentry', '🪚', 1, 10, [], 'Upper floors, stairs, reinforced foundations, bunks, lockers and shelves.');
  tc('cooking', 'Camp Cookery', '🍳', 1, 8, [], 'The grill and prepared meals: soup, stew and curry.');
  tc('seafaring', 'Seafaring', '⛵', 1, 10, [], 'The helm for steering, the grapple hook and the rowboat.');
  tc('farming', 'Cultivation', '🌱', 1, 12, [], 'Grow beds and composting.');
  tc('angling', 'Angling', '🎣', 1, 10, [], 'Fish traps, the geared rod, lures and catch mounts.');
  tc('preserving', 'Preserving', '🧂', 1, 10, [], 'The smoker, for food that lasts a voyage.');
  tc('smelting', 'Smelting', '🔥', 2, 18, ['carpentry'], 'The furnace: iron tools, glass and brick.');
  tc('navigation', 'Navigation', '🧭', 2, 15, ['seafaring'], 'Navigation table and binoculars.');
  tc('medicine', 'Field Medicine', '🩺', 2, 14, [], 'Antidotes and medkits.');
  tc('freediving', 'Freediving', '🥽', 2, 14, [], 'Dive mask and swim fins.');
  tc('meteorology', 'Meteorology', '🌡️', 2, 14, ['navigation'], 'A weather station that forecasts storms.');
  tc('machinery', 'Machinery', '⚙️', 3, 28, ['smelting'], 'Steel, machine parts and the machine bench.');
  tc('steelwork', 'Steelwork', '🏗️', 3, 24, ['machinery'], 'Steel tools, walls and ocean-going foundations.');
  tc('shipwright', 'Shipwright', '🚢', 3, 24, ['seafaring', 'carpentry'], 'The sailing dinghy.');
  tc('electrics', 'Electrics', '💡', 3, 30, ['machinery'], 'Circuits, batteries, solar and wind power, dive light, radio sets.');
  tc('engines', 'Engines', '🛥️', 4, 36, ['machinery'], 'Biofuel, outboard engines, generators and the motor skiff.');
  tc('scuba', 'Scuba', '🧯', 4, 34, ['freediving', 'machinery'], 'Air tanks, wetsuits, depth gauges and compressors.');
  tc('watertech', 'Desalination', '🚰', 4, 26, ['electrics'], 'Unlimited fresh water from a powered desalinator.');
  tc('recycling', 'Recycling', '♻️', 4, 26, ['electrics'], 'A powered recycler for salvage.');
  tc('sonar', 'Sonar', '📡', 4, 32, ['electrics'], 'Handheld sonar that charts what lies below.');
  tc('deepdive', 'Deep Diving', '🤿', 5, 44, ['scuba'], 'Twin tanks and the rebreather. Requires Institute pressure tables.', 'bp_deepdive');
  tc('lanternwork', 'Lantern Repair', '🔆', 2, 0, [], 'Beacon cores for the Lantern Chain. Learned from the Castaway Cay recording.', 'bp_lantern');
  tc('keystone', 'Keystone Protocol', '🗝️', 5, 0, [], 'Assembly of the Keystone command key. Learned at Deepwell.', 'bp_keystone');

  G.SKILLS = {
    sailing: { n: 'Sailing', i: '⛵', d: '+4% raft and boat speed per level.' }, fishing: { n: 'Fishing', i: '🎣', d: 'Faster bites and steadier lines.' },
    harvesting: { n: 'Harvesting', i: '🪓', d: '+6% chance of extra yield and gentler tool wear per level.' }, crafting: { n: 'Crafting', i: '🛠️', d: 'Faster crafting; a chance to save materials.' },
    diving: { n: 'Diving', i: '🤿', d: '+6% breath and +3% swim speed per level.' }, survival: { n: 'Survival', i: '🔥', d: 'Slower hunger and thirst; faster recovery.' },
    cooking: { n: 'Cooking', i: '🍳', d: 'Cooked food restores more and cooks faster.' }
  };
  G.skillNeed = (lvl) => Math.round(50 * Math.pow(lvl + 1, 1.55));

  // ---- fish: [id, name, habitats, minCm, maxCm, rarity 1-4, when, description] ----
  G.FISH = {};
  const fs = (id, n, hab, a, b, r, when, d) => { G.FISH[id] = { id, n, hab, a, b, r, when: when || 'any', d }; };
  fs('sandperch', 'Sand Perch', ['lagoon'], 14, 30, 1, 'any', 'Hovers over pale sand in the shallows.');
  fs('reeftang', 'Azure Tang', ['lagoon', 'reef'], 12, 26, 1, 'day', 'A flash of blue among the coral heads.');
  fs('parrot', 'Coral Parrotfish', ['lagoon', 'reef'], 25, 55, 2, 'day', 'You can hear it crunching coral from the surface.');
  fs('lionfin', 'Spined Lionfin', ['reef'], 20, 38, 3, 'night', 'Beautiful. Do not touch.');
  fs('snapper', 'Crimson Snapper', ['reef'], 30, 65, 1, 'any', 'A dependable dinner.');
  fs('grouper', 'Mottled Grouper', ['reef'], 50, 115, 2, 'any', 'Ambushes from holes in the reef. Fights like an anchor.');
  fs('moray', 'Ribbon Moray', ['reef'], 60, 125, 3, 'night', 'All teeth and bad temper.');
  fs('skimmer', 'Wave Skimmer', ['open'], 15, 26, 1, 'day', 'Leaps and glides ahead of the bow.');
  fs('mackerel', 'Stripe Mackerel', ['open'], 25, 48, 1, 'any', 'Runs in great silver schools.');
  fs('dorado', 'Goldcrest Dorado', ['open'], 70, 145, 2, 'day', 'Gold and green and gone in a second.');
  fs('runner', 'Bluefin Runner', ['open', 'deep'], 80, 190, 2, 'any', 'Pure muscle. Brings a geared rod to its knees.');
  fs('marlin', 'Sailback Marlin', ['open', 'deep'], 180, 330, 4, 'day', 'The catch of a lifetime.');
  fs('goby', 'Mud Goby', ['mangrove'], 8, 16, 1, 'any', 'Walks on its fins between the roots.');
  fs('barra', 'Mangrove Barra', ['mangrove'], 50, 105, 2, 'any', 'Lies still as a log until it is not.');
  fs('whisker', 'Whisker Cat', ['mangrove'], 30, 72, 2, 'night', 'Feeds in the mud after dark.');
  fs('palecod', 'Pale Cod', ['deep'], 40, 95, 2, 'any', 'From water that never sees the sun.');
  fs('lanternjaw', 'Lanternjaw', ['deep'], 20, 42, 3, 'night', 'Carries its own light, and far too many teeth.');
  fs('ribbon', 'Silver Ribbonfish', ['deep', 'storm'], 300, 620, 4, 'any', 'Old sailors said it rises before a storm. They were right.');
  fs('glassfin', 'Stillwater Glassfin', ['eye'], 40, 80, 4, 'any', 'Found only beneath the standing storm. You can see straight through it.');

  G.DIFF = {
    relaxed: { n: 'Relaxed', drain: 0.55, dmg: 0.5, loot: 1.35, predator: 0.4, keepOnDeath: 1, d: 'Exploration and building. Needs fall slowly; wildlife is forgiving; nothing is lost on death.' },
    standard: { n: 'Standard', drain: 1.0, dmg: 1.0, loot: 1.0, predator: 1.0, keepOnDeath: 0.5, d: 'The intended experience. On death you wake at your bed and lose some carried materials.' },
    hardcore: { n: 'Hardcore', drain: 1.4, dmg: 1.6, loot: 0.7, predator: 1.5, keepOnDeath: 0, d: 'Scarce supplies, harsh weather, dangerous seas. On death everything you carried is gone.' }
  };
})();
