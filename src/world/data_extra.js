'use strict';
/* Third catalogue expansion: refined materials and machine parts, a full galley of island cooking, field medicine,
   upgraded tools, clothing with real effects, and trade goods/trophies. Every item has a recipe, a station process
   or a world source, and every recipe only uses items that can be obtained. Loaded after data_more.js. */
(function () {
  const G = window.G, IT = G.ITEMS, R = G.RECIPES, P = G.PROCESS, N = G.NODES;
  const it = (id, n, i, s, c, v, d, x) => { IT[id] = Object.assign({ id, n, i, s, c, v, d }, x || {}); IT[id].rv = Math.max(1, Math.round(v / 2.5)); };
  const food = (h, t, hp, spoil, sick) => ({ food: { h, t, hp: hp || 0, spoil: spoil || 0, sick: sick || 0 } });
  const tool = (type, tier, dur, dmg, x) => Object.assign({ tool: { type, tier, dur, dmg: dmg || 4 }, s: 1 }, x || {});
  const rc = (id, out, q, ing, st, tech, cat, t, also) => R.push({ id, out, q, ing, st: st || null, tech: tech || null, cat, t: t || 2, also: also || null });
  const proc = (st, a, an, b, bn, secs) => (P[st] || (P[st] = [])).push([a, an, b, bn, secs]);
  const med = (cure, hp) => ({ med: { cure, hp: hp || 0 } });

  // ---------------------------------------------------------------- materials & parts
  it('bamboo_strip', 'Bamboo Strips', '🎋', 60, 'mat', 1, 'Split bamboo. Weaves into baskets, lashes into frames.', { fuel: 4 });
  it('charcoal_brick', 'Charcoal Briquette', '⬛', 30, 'mat', 4, 'Charcoal dust bound with clay. Burns long and hot.', { fuel: 120 });
  it('ceramic_tile', 'Fired Tile', '🟫', 30, 'mat', 4, 'Kiln-fired clay. Hearths, roofs and still linings.');
  it('glass_jar', 'Glass Jar', '🫙', 20, 'mat', 5, 'A stoppered jar. Preserves, medicine and lamp oil.');
  it('copper_sheet', 'Copper Sheet', '🟧', 20, 'mat', 9, 'Hammered copper. Stills, boilers and hull sheathing.');
  it('rivets', 'Rivets', '🔩', 80, 'mat', 2, 'Soft iron rivets for plate work.');
  it('steel_cable', 'Steel Cable', '🪢', 10, 'mat', 16, 'Twisted wire rope. Rigging that never rots.');
  it('bearing', 'Ball Bearing', '⚙️', 20, 'mat', 12, 'Ground steel races and balls. Anything that spins wants one.');
  it('valve', 'Brass Valve', '🚰', 20, 'mat', 10, 'Controls pressure in pipes and tanks.');
  it('gauge', 'Pressure Gauge', '⏲️', 10, 'mat', 14, 'Glass-faced dial with a spring mechanism.');
  it('electromagnet', 'Electromagnet', '🧲', 10, 'mat', 18, 'Copper coil around an iron core.');
  it('motor', 'Electric Motor', '🔌', 5, 'mat', 30, 'Magnet, coil and bearing. Drives pumps and propellers.');
  it('led', 'LED Lamp', '💡', 20, 'mat', 8, 'Tiny bright light that sips power.');
  it('antenna', 'Antenna', '📡', 5, 'mat', 12, 'Aluminium whip and copper lead.');
  it('fuse', 'Fuse', '🧯', 30, 'mat', 4, 'Glass tube and thin wire. Protects circuits.');
  it('hawser', 'Hawser', '🪢', 10, 'mat', 9, 'Heavy tarred rope for anchors and towing.');
  it('sailcloth', 'Sailcloth', '⛵', 10, 'mat', 14, 'Tarred, doubled canvas that takes a gale.');
  it('fishing_line', 'Fishing Line', '🧵', 30, 'mat', 3, 'Thin resin-waxed thread.');
  it('fish_net', 'Fishing Net', '🕸️', 5, 'mat', 12, 'Weighted net for traps and nets.');
  it('bone_meal', 'Bone Meal', '🦴', 40, 'mat', 2, 'Ground bone. Feeds a garden.');
  it('fish_oil', 'Fish Oil', '🛢️', 20, 'mat', 4, 'Rendered from fish scraps. Lamp fuel and leather dressing.', { fuel: 60 });
  it('shark_oil', 'Shark Liver Oil', '🛢️', 20, 'mat', 9, 'Rich oil. Waterproofing, lamps and medicine.', { fuel: 90 });
  it('leather_strap', 'Leather Strap', '🎗️', 40, 'mat', 4, 'Cut and oiled. Bindings, belts and slings.');
  it('concrete_mix', 'Concrete Mix', '🧱', 20, 'mat', 6, 'Lime, sand and gravel. Sets underwater.');
  it('insulation', 'Insulation Wad', '🧶', 20, 'mat', 4, 'Coir packed in cloth. Holds warmth in.');
  it('rubber_seal', 'Rubber Seal', '⭕', 40, 'mat', 3, 'Gaskets for anything watertight.');
  it('epoxy', 'Marine Epoxy', '🧴', 20, 'mat', 12, 'Two-part resin. Mends hulls under water.');
  it('gull_egg', 'Gull Egg', '🥚', 10, 'food', 3, 'Speckled and warm. Better cooked.', food(6, 1, 0, 30, 0.12));

  // ---------------------------------------------------------------- the galley
  it('bouillabaisse', 'Bouillabaisse', '🍲', 5, 'food', 26, 'Fish, crab and clams stewed in fresh water.', food(48, 26, 14, 30));
  it('salt_baked_fish', 'Salt-Baked Fish', '🐟', 10, 'food', 9, 'Baked in a salt crust. Moist and long-keeping.', food(30, -4, 2, 96));
  it('ceviche', 'Ceviche', '🥗', 5, 'food', 12, 'Raw fish cured in fruit juice and salt.', food(24, 8, 4, 12, 0.05));
  it('crab_soup', 'Crab Soup', '🥣', 5, 'food', 14, 'Crab and kelp in a clear broth.', food(26, 22, 6, 30));
  it('shark_jerky', 'Shark Jerky', '🥩', 20, 'food', 10, 'Salted, wind-dried shark. Keeps for weeks.', food(26, -6, 0, 400));
  it('smoked_meat', 'Smoked Boar', '🍖', 20, 'food', 9, 'Slow-smoked pork. Keeps for days.', food(34, -2, 2, 160));
  it('roast_boar', 'Roast Boar', '🍗', 5, 'food', 22, 'A whole haunch roasted with salt.', food(70, -4, 12, 48));
  it('potato_soup', 'Potato Soup', '🥣', 5, 'food', 8, 'Thick and filling.', food(28, 22, 4, 30));
  it('potato_chips', 'Potato Crisps', '🥔', 20, 'food', 6, 'Thin slices fried in coconut oil.', food(14, -3, 0, 240));
  it('grilled_pineapple', 'Grilled Pineapple', '🍍', 10, 'food', 6, 'Caramelised over the coals.', food(14, 10, 3, 30));
  it('banana_fritter', 'Banana Fritters', '🍌', 10, 'food', 7, 'Banana in coconut batter, fried golden.', food(20, 0, 3, 30));
  it('berry_jam', 'Berry Jam', '🍯', 10, 'food', 10, 'Berries cooked down in a sealed jar. Keeps a long time.', food(16, 2, 4, 600));
  it('mushroom_soup', 'Mushroom Soup', '🥣', 5, 'food', 8, 'Earthy and warming.', food(22, 20, 4, 30));
  it('nori', 'Nori Sheets', '🟩', 30, 'food', 4, 'Pressed, sun-dried seaweed. Salty and light.', food(6, -2, 2, 800));
  it('kelp_noodles', 'Kelp Noodles', '🍜', 10, 'food', 7, 'Boiled ribbons of kelp.', food(14, 14, 3, 24));
  it('fish_cake', 'Fish Cakes', '🧆', 10, 'food', 9, 'Mashed fish and potato, pan-fried.', food(30, 0, 4, 30));
  it('fish_pie', 'Fish Pie', '🥧', 5, 'food', 18, 'Fish baked under mashed potato and coconut cream.', food(52, 6, 10, 36));
  it('smoothie', 'Tropical Smoothie', '🥤', 10, 'food', 9, 'Mango, banana and coconut milk.', food(16, 30, 6, 12));
  it('aloe_juice', 'Aloe Water', '🧃', 10, 'food', 5, 'Bitter but soothing. Helps with sunburn.', Object.assign(food(0, 24, 4, 24), med(['sunburn'], 2), { cure: ['sunburn'] }));
  it('pickled_fish', 'Pickled Fish', '🫙', 10, 'food', 11, 'Brined in a sealed jar. Keeps for a month.', food(24, -6, 0, 720));
  it('survival_bar', 'Survival Bar', '🍫', 20, 'food', 12, 'Pressed coconut, dried fruit and berries. Never spoils.', food(34, -2, 4, 0));
  it('boiled_egg', 'Boiled Egg', '🥚', 10, 'food', 5, 'Simple, safe protein.', food(14, 0, 2, 48));
  it('omelette', 'Mushroom Omelette', '🍳', 5, 'food', 10, 'Gull eggs and mushrooms.', food(30, 0, 6, 24));
  it('fish_stock', 'Fish Stock', '🥣', 10, 'food', 5, 'Bones simmered down. Mostly water, very welcome.', food(6, 30, 2, 30));
  it('coconut_curry', 'Coconut Fish Curry', '🍛', 5, 'food', 20, 'Fish simmered in coconut milk with mango.', food(46, 14, 10, 30));

  // ---------------------------------------------------------------- field medicine
  it('aloe_gel', 'Aloe Gel', '🧴', 10, 'med', 8, 'Cool gel for burns and sunburn.', med(['sunburn'], 6));
  it('tourniquet', 'Tourniquet', '🩹', 10, 'med', 5, 'Cloth and a stick. Stops heavy bleeding fast.', med(['bleeding'], 0));
  it('fever_tea', 'Bark Tea', '🍵', 10, 'med', 6, 'Bitter bark brewed in fresh water. Settles fever and sickness.', Object.assign(med(['sick'], 4), food(0, 18, 0, 24), { cure: ['sick'] }));
  it('antibiotics', 'Antibiotics', '💊', 10, 'med', 30, 'Cultured from island mould, purified with charcoal. Clears infection.', med(['infection', 'sick'], 10));
  it('sting_relief', 'Sting Relief', '🧪', 10, 'med', 8, 'Ash and seawater paste for jellyfish and venom.', med(['poison'], 4));
  it('bamboo_splint', 'Bamboo Splint', '🦴', 5, 'med', 9, 'Light, rigid and padded. Sets a fracture well.', med(['fracture'], 6));
  it('tonic', 'Island Tonic', '🧉', 10, 'med', 14, 'Fruit, aloe and sea salt. A quick lift.', med([], 25));
  it('trauma_kit', 'Trauma Kit', '🧰', 5, 'med', 60, 'Sutures, splints and antiseptic in one roll.', med(['bleeding', 'infection', 'fracture'], 45));

  // ---------------------------------------------------------------- tools & weapons
  it('axe_copper', 'Copper Axe', '🪓', 1, 'tool', 16, 'Soft but sharp. Better than stone.', tool('axe', 1, 160, 12));
  it('pick_copper', 'Copper Pickaxe', '⛏️', 1, 'tool', 16, 'Breaks ore that stone tools bounce off.', tool('pick', 1, 160, 9));
  it('dive_knife', 'Dive Knife', '🔪', 1, 'tool', 22, 'Stainless blade, rubber grip. Never rusts.', tool('knife', 1, 420, 13));
  it('fillet_knife', 'Fillet Knife', '🔪', 1, 'tool', 14, 'Thin and flexible. More meat off every fish.', tool('knife', 1, 260, 8));
  it('bone_spear', 'Bone Spear', '🔱', 1, 'tool', 6, 'A sharpened bone lashed to bamboo.', tool('spear', 0, 90, 12));
  it('trident', 'Trident', '🔱', 1, 'tool', 40, 'Three steel tines. Fish rarely slip off.', tool('spear', 1, 520, 26));
  it('shark_spear', 'Shark-Tooth Spear', '🔱', 1, 'tool', 24, 'Serrated with a ring of shark teeth.', tool('spear', 1, 240, 22));
  it('longbow', 'Longbow', '🏹', 1, 'tool', 30, 'Tall laminated bamboo. Long reach, heavy draw.', tool('bow', 1, 360, 30));
  it('rod_steel', 'Steel Rod', '🎣', 1, 'tool', 34, 'Steel-cored rod with a brass reel. Lands the big ones.', tool('rod', 2, 700, 2));
  it('hook_titanium', 'Titanium Grapple', '🪝', 1, 'tool', 50, 'Light, strong and practically unbreakable.', tool('hook', 2, 2400, 2));
  it('oar', 'Oar', '🛶', 1, 'tool', 10, 'Long-bladed oar. More push per stroke.', tool('paddle', 1, 600, 3));
  it('torch_resin', 'Resin Torch', '🔥', 1, 'tool', 6, 'Resin-soaked head. Burns far longer.', tool('torch', 1, 900, 4));
  it('hatchet_steel', 'Steel Hatchet', '🪓', 1, 'tool', 34, 'Light and keen. Fast on palms and bamboo.', tool('axe', 2, 520, 16));
  it('pick_titanium', 'Titanium Pickaxe', '⛏️', 1, 'tool', 70, 'Light, hard and nearly unbreakable.', tool('pick', 2, 1800, 14));

  // ---------------------------------------------------------------- clothing & gear
  it('straw_hat', 'Straw Hat', '👒', 1, 'gear', 6, 'Woven palm straw. Wide brim, good shade.', { equip: 'head', shade: 0.5 });
  it('scrap_helmet', 'Scrap Helmet', '⛑️', 1, 'gear', 14, 'Beaten sheet metal over a padded cap.', { equip: 'head', armor: 0.1, shade: 0.2 });
  it('scrap_armor', 'Scrap Armour', '🛡️', 1, 'gear', 30, 'Riveted plates over leather. Sharks hate it.', { equip: 'body', armor: 0.24, warm: 0.9 });
  it('thermal_suit', 'Thermal Suit', '🧥', 1, 'gear', 40, 'Insulated, layered suit for cold nights and deep water.', { equip: 'body', warm: 0.15 });
  it('oilskin', 'Oilskin Coat', '🧥', 1, 'gear', 28, 'Canvas rubbed with shark oil. Sheds rain, keeps warmth.', { equip: 'body', rainproof: true, warm: 0.7 });
  it('reef_shoes', 'Reef Shoes', '🩴', 1, 'gear', 12, 'Rubber-soled. Coral and urchins can\'t get you.', { equip: 'feet', armor: 0.04, swim: 1.15 });
  it('monofin', 'Monofin', '🧜', 1, 'gear', 46, 'One wide blade for both feet. Fastest swimmer in the sea.', { equip: 'feet', swim: 2.0 });
  it('steel_boots', 'Steel-Toe Boots', '🥾', 1, 'gear', 30, 'Heavy, solid, safe.', { equip: 'feet', armor: 0.1 });
  it('scuba_mask', 'Scuba Mask', '🤿', 1, 'gear', 40, 'Full-face mask with a purge valve. Easier breathing below.', { equip: 'face', air: 20 });
  it('dive_helmet', 'Brass Dive Helmet', '🪖', 1, 'gear', 90, 'Copper-and-brass helmet. Breath lasts much longer.', { equip: 'face', air: 30 });
  it('tank_titanium', 'Titanium Tank', '🧯', 1, 'gear', 240, 'Eight minutes of air in a feather-light tank.', { equip: 'back', air: 480 });
  it('basket', 'Woven Basket', '🧺', 1, 'gear', 6, 'Carried on the back. A few more slots.', { equip: 'pack', slots: 3 });
  it('duffel', 'Canvas Duffel', '👝', 1, 'gear', 22, 'Tarred canvas kit bag.', { equip: 'pack', slots: 7 });

  // ---------------------------------------------------------------- trade goods & trophies
  it('shark_jaw', 'Shark Jaw', '🦈', 1, 'mat', 80, 'Cleaned and mounted. Traders pay well for proof.');
  it('shell_necklace', 'Shell Necklace', '📿', 5, 'mat', 18, 'Pierced shells on thread. Haven folk love them.');
  it('pearl_necklace', 'Pearl Necklace', '📿', 1, 'mat', 140, 'A strand of matched pearls. A fortune in trade.');
  it('carved_idol', 'Carved Idol', '🗿', 5, 'mat', 30, 'A small figure in island hardwood.');
  it('ship_bottle', 'Ship in a Bottle', '🍾', 1, 'mat', 90, 'Patience, thread and a steady hand.');
  it('coral_carving', 'Coral Carving', '🪸', 5, 'mat', 34, 'Polished coral shaped into a fish.');
  it('obsidian_blade', 'Obsidian Blade', '🔪', 10, 'mat', 12, 'A knapped volcanic glass edge, sharper than steel.');
  it('dried_starfish', 'Dried Starfish', '⭐', 10, 'mat', 8, 'A sun-bleached keepsake.');

  // ---------------------------------------------------------------- recipes
  // materials
  rc('bamboo_strip', 'bamboo_strip', 4, { bamboo: 1 }, null, null, 'basics', 1);
  rc('charcoal_brick', 'charcoal_brick', 2, { charcoal_dust: 3, clay: 1 }, null, null, 'basics', 2);
  rc('glass_jar', 'glass_jar', 2, { glass: 1, resin: 1 }, 'workbench', null, 'basics', 3);
  rc('copper_sheet', 'copper_sheet', 1, { copper_ingot: 2 }, 'forge', 'smelting', 'industry', 4);
  rc('rivets', 'rivets', 8, { iron_ingot: 1 }, 'forge', 'smelting', 'industry', 3);
  rc('steel_cable', 'steel_cable', 1, { steel: 1, wire: 2 }, 'machine', 'steelwork', 'industry', 6);
  rc('bearing', 'bearing', 2, { steel: 1 }, 'machine', 'machinery', 'industry', 6);
  rc('valve', 'valve', 1, { copper_pipe: 1, bolts: 2, rubber_seal: 1 }, 'workbench', 'machinery', 'industry', 4);
  rc('gauge', 'gauge', 1, { glass: 1, spring: 1, copper_sheet: 1 }, 'machine', 'machinery', 'industry', 6);
  rc('electromagnet', 'electromagnet', 1, { iron_rod: 1, wire: 3 }, 'machine', 'electrics', 'industry', 5);
  rc('motor', 'motor', 1, { electromagnet: 2, bearing: 1, sheet_metal: 1 }, 'machine', 'electrics', 'industry', 10);
  rc('led', 'led', 2, { electronics: 1, glass: 1 }, 'machine', 'electrics', 'industry', 4);
  rc('antenna', 'antenna', 1, { aluminium: 2, wire: 2 }, 'workbench', 'electrics', 'industry', 4);
  rc('fuse', 'fuse', 3, { glass: 1, wire: 1 }, 'workbench', 'electrics', 'industry', 2);
  rc('hawser', 'hawser', 1, { rope: 3, tar: 1 }, 'workbench', 'seafaring', 'basics', 4);
  rc('sailcloth', 'sailcloth', 1, { canvas: 2, tar: 1, thread: 2 }, 'workbench', 'shipwright', 'basics', 6);
  rc('fishing_line', 'fishing_line', 3, { thread: 3, resin: 1 }, null, 'angling', 'basics', 2);
  rc('fish_net', 'fish_net', 1, { net_mesh: 2, rope: 1, stone: 4 }, 'workbench', 'angling', 'basics', 5);
  rc('bone_meal', 'bone_meal', 3, { bone: 2 }, null, 'farming', 'basics', 2);
  rc('leather_strap', 'leather_strap', 4, { leather: 1 }, null, null, 'basics', 2);
  rc('concrete_mix', 'concrete_mix', 2, { lime: 1, sand: 2, stone: 2 }, 'workbench', 'carpentry', 'basics', 4);
  rc('insulation', 'insulation', 1, { coir: 2, cloth: 1 }, null, null, 'basics', 2);
  rc('rubber_seal', 'rubber_seal', 4, { rubber: 1 }, 'workbench', null, 'basics', 2);
  rc('epoxy', 'epoxy', 1, { resin: 2, charcoal_dust: 1, glass_jar: 1 }, 'workbench', 'shipwright', 'basics', 4);
  rc('obsidian_blade', 'obsidian_blade', 2, { obsidian: 1 }, null, null, 'basics', 3);
  // the galley
  rc('bouillabaisse', 'bouillabaisse', 1, { raw_fillet: 2, raw_crab: 1, clam: 2, bottle_fresh: 1 }, 'fire', 'cooking', 'food', 6);
  rc('salt_baked_fish', 'salt_baked_fish', 1, { raw_fish: 1, salt: 2 }, 'fire', 'cooking', 'food', 4);
  rc('ceviche', 'ceviche', 1, { raw_fillet: 2, mango: 1, salt: 1 }, null, null, 'food', 2);
  rc('ceviche_p', 'ceviche', 1, { raw_fillet: 2, pineapple: 1, salt: 1 }, null, null, 'food', 2);
  rc('crab_soup', 'crab_soup', 1, { raw_crab: 1, seaweed: 2, bottle_fresh: 1 }, 'fire', 'cooking', 'food', 4);
  rc('roast_boar', 'roast_boar', 1, { raw_meat: 3, salt: 1 }, 'fire', 'cooking', 'food', 8);
  rc('potato_soup', 'potato_soup', 1, { potato: 2, bottle_fresh: 1, salt: 1 }, 'fire', 'cooking', 'food', 4);
  rc('potato_chips', 'potato_chips', 2, { potato: 2, coconut_oil: 1, salt: 1 }, 'fire', 'cooking', 'food', 4);
  rc('grilled_pineapple', 'grilled_pineapple', 2, { pineapple: 1 }, 'fire', null, 'food', 3);
  rc('banana_fritter', 'banana_fritter', 2, { banana: 2, coconut_milk: 1, coconut_oil: 1 }, 'fire', 'cooking', 'food', 4);
  rc('berry_jam', 'berry_jam', 2, { berries: 6, glass_jar: 1 }, 'fire', 'preserving', 'food', 5);
  rc('mushroom_soup', 'mushroom_soup', 1, { mushroom: 3, bottle_fresh: 1 }, 'fire', 'cooking', 'food', 4);
  rc('kelp_noodles', 'kelp_noodles', 2, { seaweed: 3, bottle_fresh: 1 }, 'fire', 'cooking', 'food', 3);
  rc('fish_cake', 'fish_cake', 2, { raw_fillet: 2, potato: 1, coconut_oil: 1 }, 'fire', 'cooking', 'food', 4);
  rc('fish_pie', 'fish_pie', 1, { raw_fillet: 2, mash: 1, coconut_milk: 1 }, 'fire', 'cooking', 'food', 6);
  rc('smoothie', 'smoothie', 1, { mango: 1, banana: 1, coconut_milk: 1 }, null, null, 'food', 2);
  rc('aloe_juice', 'aloe_juice', 1, { aloe: 1, bottle_fresh: 1 }, null, null, 'food', 2);
  rc('pickled_fish', 'pickled_fish', 2, { raw_fillet: 3, salt: 2, glass_jar: 1 }, null, 'preserving', 'food', 4);
  rc('survival_bar', 'survival_bar', 3, { coconut_meat: 2, dried_mango: 1, berries: 3 }, 'fire', 'preserving', 'food', 5);
  rc('boiled_egg', 'boiled_egg', 1, { gull_egg: 1, bottle_fresh: 1 }, 'fire', null, 'food', 3, { bottle: 1 });
  rc('omelette', 'omelette', 1, { gull_egg: 2, mushroom: 1 }, 'fire', 'cooking', 'food', 3);
  rc('fish_stock', 'fish_stock', 2, { bone: 1, raw_fish: 1, bottle_fresh: 1 }, 'fire', 'cooking', 'food', 4);
  rc('coconut_curry', 'coconut_curry', 1, { raw_fillet: 2, coconut_milk: 1, mango: 1, salt: 1 }, 'fire', 'cooking', 'food', 6);
  // medicine
  rc('aloe_gel', 'aloe_gel', 2, { aloe: 2, glass_jar: 1 }, null, 'medicine', 'medical', 3);
  rc('tourniquet', 'tourniquet', 1, { cloth: 1, stick: 1 }, null, null, 'medical', 1);
  rc('fever_tea', 'fever_tea', 1, { bark: 2, bottle_fresh: 1 }, 'fire', null, 'medical', 3);
  rc('antibiotics', 'antibiotics', 2, { mushroom: 3, charcoal_tablet: 1, antiseptic: 1 }, 'workbench', 'medicine', 'medical', 8);
  rc('sting_relief', 'sting_relief', 2, { ash: 2, bottle_sea: 1 }, null, null, 'medical', 2);
  rc('bamboo_splint', 'bamboo_splint', 1, { bamboo_strip: 3, cloth: 1, leather_strap: 1 }, null, 'medicine', 'medical', 3);
  rc('tonic', 'tonic', 1, { fruit_juice: 1, aloe: 1, salt: 1 }, null, 'medicine', 'medical', 2);
  rc('trauma_kit', 'trauma_kit', 1, { suture_kit: 1, sterile_bandage: 2, bamboo_splint: 1, antiseptic: 1 }, 'workbench', 'medicine', 'medical', 8);
  // tools & weapons
  rc('axe_copper', 'axe_copper', 1, { copper_ingot: 2, stick: 1, leather_strap: 1 }, 'workbench', 'smelting', 'tools', 5);
  rc('pick_copper', 'pick_copper', 1, { copper_ingot: 3, stick: 1, leather_strap: 1 }, 'workbench', 'smelting', 'tools', 5);
  rc('dive_knife', 'dive_knife', 1, { steel: 1, rubber: 1 }, 'machine', 'steelwork', 'tools', 6);
  rc('fillet_knife', 'fillet_knife', 1, { iron_ingot: 1, bone: 1 }, 'forge', 'angling', 'tools', 4);
  rc('bone_spear', 'bone_spear', 1, { bone: 2, bamboo: 1, sinew: 1 }, null, null, 'tools', 3);
  rc('trident', 'trident', 1, { steel: 2, iron_rod: 1, leather_strap: 1 }, 'machine', 'steelwork', 'tools', 8);
  rc('shark_spear', 'shark_spear', 1, { spear_iron: 1, shark_tooth: 6, sinew: 2 }, 'workbench', null, 'tools', 5);
  rc('longbow', 'longbow', 1, { bamboo: 3, glue: 1, sinew: 3 }, 'workbench', 'carpentry', 'tools', 6);
  rc('rod_steel', 'rod_steel', 1, { iron_rod: 1, fishing_line: 3, bearing: 1, copper_sheet: 1 }, 'machine', 'angling', 'tools', 8);
  rc('hook_titanium', 'hook_titanium', 1, { titanium: 3, steel_cable: 1 }, 'machine', 'deepdive', 'tools', 10);
  rc('oar', 'oar', 1, { beam: 1, plank: 1 }, 'workbench', 'seafaring', 'tools', 4);
  rc('torch_resin', 'torch_resin', 1, { stick: 1, resin: 2, cloth: 1 }, null, null, 'tools', 2);
  rc('hatchet_steel', 'hatchet_steel', 1, { steel: 2, beam: 1, leather_strap: 1 }, 'machine', 'steelwork', 'tools', 7);
  rc('pick_titanium', 'pick_titanium', 1, { titanium: 4, beam: 1, leather_strap: 1 }, 'machine', 'deepdive', 'tools', 10);
  // clothing & gear
  rc('straw_hat', 'straw_hat', 1, { palm_leaf: 4, fiber: 2 }, null, null, 'gear', 3);
  rc('scrap_helmet', 'scrap_helmet', 1, { sheet_metal: 1, cloth: 1, rivets: 4 }, 'workbench', null, 'gear', 5);
  rc('scrap_armor', 'scrap_armor', 1, { sheet_metal: 3, leather: 2, rivets: 8 }, 'workbench', 'steelwork', 'gear', 8);
  rc('thermal_suit', 'thermal_suit', 1, { insulation: 3, cloth: 3, thread: 4 }, 'workbench', 'scuba', 'gear', 8);
  rc('oilskin', 'oilskin', 1, { canvas: 2, shark_oil: 2, thread: 3 }, 'workbench', null, 'gear', 6);
  rc('reef_shoes', 'reef_shoes', 1, { rubber: 2, cloth: 1 }, 'workbench', 'freediving', 'gear', 4);
  rc('monofin', 'monofin', 1, { rubber: 4, sheet_metal: 1, rubber_seal: 2 }, 'machine', 'freediving', 'gear', 8);
  rc('steel_boots', 'steel_boots', 1, { leather: 2, steel: 1, rivets: 4 }, 'workbench', 'steelwork', 'gear', 6);
  rc('scuba_mask', 'scuba_mask', 1, { glass: 2, rubber: 2, valve: 1 }, 'machine', 'scuba', 'gear', 8);
  rc('dive_helmet', 'dive_helmet', 1, { copper_sheet: 4, glass: 3, valve: 2, gauge: 1 }, 'machine', 'deepdive', 'gear', 12);
  rc('tank_titanium', 'tank_titanium', 1, { titanium: 4, valve: 1, gauge: 1 }, 'machine', 'deepdive', 'gear', 12);
  rc('basket', 'basket', 1, { bamboo_strip: 6, vine: 2 }, null, null, 'gear', 4);
  rc('duffel', 'duffel', 1, { canvas: 2, leather_strap: 2, thread: 3 }, 'workbench', null, 'gear', 6);
  // trade goods
  rc('shark_jaw', 'shark_jaw', 1, { shark_tooth: 10, bone: 2, plank: 1 }, 'workbench', null, 'basics', 8);
  rc('shell_necklace', 'shell_necklace', 1, { shell: 4, thread: 1 }, null, null, 'basics', 2);
  rc('pearl_necklace', 'pearl_necklace', 1, { pearl: 6, thread: 1, copper_ingot: 1 }, 'workbench', null, 'basics', 6);
  rc('carved_idol', 'carved_idol', 1, { log: 1 }, 'workbench', null, 'basics', 6);
  rc('ship_bottle', 'ship_bottle', 1, { bottle: 1, dowel: 2, cloth: 1, thread: 2, glue: 1 }, 'workbench', 'shipwright', 'basics', 10);
  rc('coral_carving', 'coral_carving', 1, { coral_fragment: 4 }, 'workbench', null, 'basics', 5);
  // a few useful alternatives that use the new materials
  rc('fuel_bio', 'fuel', 1, { coconut_oil: 2, fish_oil: 1 }, 'workbench', 'engines', 'industry', 4);
  rc('fertilizer_bm', 'fertilizer', 2, { bone_meal: 2, guano: 1 }, null, 'farming', 'basics', 2);
  rc('rope_coir2', 'rope', 2, { coir: 2, fishing_line: 1 }, null, null, 'basics', 2);

  // ---------------------------------------------------------------- station processes
  // (inputs already claimed by an existing station process get crafting recipes instead, so nothing is shadowed)
  proc('fire', 'gull_egg', 1, 'boiled_egg', 1, 18);
  rc('fish_oil', 'fish_oil', 1, { raw_fish: 2 }, 'fire', 'cooking', 'basics', 5);
  rc('shark_oil', 'shark_oil', 2, { raw_shark: 1 }, 'fire', 'cooking', 'basics', 5);
  rc('ceramic_tile', 'ceramic_tile', 3, { clay: 2, sand: 1 }, 'forge', 'smelting', 'basics', 5);
  rc('nori', 'nori', 2, { seaweed: 3, salt: 1 }, null, 'preserving', 'food', 3);
  rc('shark_jerky', 'shark_jerky', 2, { raw_shark: 1, salt: 2 }, null, 'preserving', 'food', 4);
  rc('smoked_meat', 'smoked_meat', 2, { raw_meat: 2, charcoal: 1 }, 'fire', 'preserving', 'food', 6);
  // ---------------------------------------------------------------- where it all comes from
  const addDrop = (node, item, a, b) => { if (N[node] && !N[node].drops.some((d) => d[0] === item)) N[node].drops.push([item, a, b]); };
  addDrop('palm', 'gull_egg', 0, 1); addDrop('mangrove', 'gull_egg', 0, 2); addDrop('shell', 'dried_starfish', 0, 1); addDrop('tree', 'bark', 1, 2);
  if (G.LOOT_EXTRA) { const L = G.LOOT_EXTRA; L.BARREL.push([['fishing_line', 3], 1.5], [['glass_jar', 1], 1.2], [['rubber_seal', 2], 1], [['charcoal_brick', 2], 1]); L.CRATE.push([['rivets', 6], 1.5], [['fuse', 2], 1], [['led', 1], 0.6], [['bearing', 1], 0.5], [['steel_cable', 1], 0.3], [['survival_bar', 2], 1], [['tourniquet', 1], 0.8]); }
})();
