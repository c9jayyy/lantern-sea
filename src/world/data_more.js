'use strict';
/* Expanded survival catalogue: intermediate materials, cooking, medicine, tools, weapons and clothing, with recipes,
   station processes and world sources (harvest and animal drops) so every new item can actually be obtained and used.
   Loaded after world.js so it can extend the harvest tables. */
(function () {
  const G = window.G, IT = G.ITEMS, R = G.RECIPES, P = G.PROCESS, N = G.NODES;
  const it = (id, n, i, s, c, v, d, x) => { IT[id] = Object.assign({ id, n, i, s, c, v, d }, x || {}); IT[id].rv = Math.max(1, Math.round(v / 2.5)); };
  const food = (h, t, hp, spoil, sick) => ({ food: { h, t, hp: hp || 0, spoil: spoil || 0, sick: sick || 0 } });
  const tool = (type, tier, dur, dmg, x) => Object.assign({ tool: { type, tier, dur, dmg: dmg || 4 }, s: 1 }, x || {});
  const rc = (id, out, q, ing, st, tech, cat, t, also) => R.push({ id, out, q, ing, st: st || null, tech: tech || null, cat, t: t || 2, also: also || null });
  const proc = (st, a, an, b, bn, secs) => (P[st] || (P[st] = [])).push([a, an, b, bn, secs]);

  // ---------------------------------------------------------------- materials
  it('coconut_husk', 'Coconut Husk', '🟫', 40, 'mat', 1, 'Coarse brown fibre from the outer shell. Twists into coir, burns well.', { fuel: 10 });
  it('coconut_shell', 'Coconut Shell', '🥥', 30, 'mat', 1, 'Half a hard shell. A bowl, a cup, or charcoal.', { fuel: 14 });
  it('coir', 'Coir Cord', '🧶', 40, 'mat', 3, 'Rope spun from coconut fibre. Salt-proof and strong.');
  it('resin', 'Tree Resin', '🟠', 30, 'mat', 3, 'Sticky sap from a cut trunk. Glue, torches and caulking.', { fuel: 20 });
  it('bark', 'Bark Strips', '🪵', 40, 'mat', 1, 'Peeled from hardwood. Cordage, tinder and tanning.', { fuel: 6 });
  it('tinder', 'Tinder Bundle', '🔥', 30, 'mat', 1, 'Shredded husk and bark that catches a spark.', { fuel: 6 });
  it('glue', 'Resin Glue', '🍯', 20, 'mat', 6, 'Resin cooked with charcoal dust. Sets hard.');
  it('tar', 'Pine Tar', '⚫', 20, 'mat', 6, 'Boiled-down resin. Waterproofs wood and rope.');
  it('treated_plank', 'Tarred Plank', '🪵', 40, 'mat', 5, 'Sealed against rot and shipworm.', { fuel: 22 });
  it('beam', 'Timber Beam', '🪵', 20, 'mat', 8, 'A squared hardwood beam for frames and keels.', { fuel: 40 });
  it('dowel', 'Wooden Pegs', '🥢', 60, 'mat', 1, 'Joinery without nails.');
  it('wicker', 'Wicker Panel', '🧺', 20, 'mat', 4, 'Woven vine and bamboo. Light walls and baskets.');
  it('palm_mat', 'Palm Mat', '🟩', 20, 'mat', 3, 'Plaited fronds. Bedding, shade and roofing.');
  it('thread', 'Thread', '🧵', 60, 'mat', 1, 'Fine twisted fibre for sewing.');
  it('canvas', 'Canvas', '⬜', 20, 'mat', 9, 'Heavy tarred cloth. Sails and tarps.');
  it('tarp', 'Tarp', '🟦', 10, 'mat', 10, 'Plastic sheeting stitched with rope. Keeps rain out.');
  it('net_mesh', 'Net Mesh', '🕸️', 20, 'mat', 6, 'Knotted cord mesh for nets and traps.');
  it('sinew', 'Sinew', '🧶', 30, 'mat', 4, 'Dried tendon. The best bowstring there is.');
  it('leather', 'Leather', '🟤', 20, 'mat', 14, 'Hide cured with salt and bark tannin.');
  it('bone_needle', 'Bone Needle', '🪡', 10, 'mat', 3, 'For sewing leather and stitching wounds.');
  it('bone_hook', 'Bone Fishhook', '🪝', 40, 'mat', 2, 'Carved and barbed.');
  it('shark_tooth', 'Shark Tooth', '🦷', 30, 'mat', 6, 'Serrated and wickedly sharp.');
  it('shark_skin', 'Shark Skin', '🩶', 10, 'mat', 12, 'Rough as sandpaper. Grips, sheaths, abrasive.');
  it('lime', 'Quicklime', '⚪', 40, 'mat', 3, 'Burnt shell. Mortar, plaster and tanning.');
  it('mortar', 'Lime Mortar', '🪣', 20, 'mat', 5, 'Lime, sand and water. Binds stone and brick.');
  it('ash', 'Wood Ash', '🌫️', 40, 'mat', 1, 'Lye for soap; fertiliser for crops.');
  it('soap', 'Ash Soap', '🧼', 20, 'mat', 5, 'Ash lye and coconut oil. Cleans wounds and kills infection.');
  it('coconut_oil', 'Coconut Oil', '🫙', 20, 'mat', 6, 'Pressed and rendered. Lamp fuel, cooking and soap.', { fuel: 40 });
  it('clay_pot', 'Clay Pot', '🏺', 10, 'mat', 6, 'Fired earthenware for boiling and storage.');
  it('sheet_metal', 'Sheet Metal', '⬜', 30, 'mat', 12, 'Hammered iron sheet.');
  it('iron_rod', 'Iron Rod', '➖', 30, 'mat', 8, 'Drawn bar stock.');
  it('chain', 'Chain', '⛓️', 20, 'mat', 18, 'Forged links. Anchors and hoists.');
  it('hinge', 'Hinge', '🔗', 30, 'mat', 6, 'For doors, lids and hatches.');
  it('bolts', 'Bolts', '🔩', 60, 'mat', 2, 'Threaded and nutted.');
  it('spring', 'Spring', '🌀', 30, 'mat', 8, 'Coiled steel.');
  it('pipe', 'Iron Pipe', '🧪', 20, 'mat', 10, 'Plumbing for stills and pumps.');
  it('copper_pipe', 'Copper Pipe', '🧪', 20, 'mat', 12, 'Conducts heat for condensers.');
  it('solar_cell', 'Solar Cell', '🔲', 10, 'mat', 30, 'Glass, silicon and copper.');
  it('aluminium', 'Aluminium', '🥫', 40, 'mat', 6, 'Melted down from cans. Light and rustproof.');
  it('gunpowder', 'Black Powder', '💥', 20, 'mat', 12, 'Saltpetre, sulfur and charcoal. Flares and signals.');
  it('saltpeter', 'Saltpetre', '🧂', 30, 'mat', 6, 'Leached from seabird guano.');
  it('guano', 'Guano', '💩', 40, 'mat', 1, 'Seabird droppings. Fertiliser and saltpetre.');
  it('charcoal_dust', 'Charcoal Dust', '◼️', 40, 'mat', 2, 'Ground charcoal. Filters water, settles stomachs.');
  it('coral_fragment', 'Coral Fragment', '🪸', 40, 'mat', 2, 'Dead coral rubble. Burns to lime.');

  // ---------------------------------------------------------------- food & drink
  it('coconut_meat', 'Coconut Meat', '🥥', 30, 'food', 3, 'White, rich and filling.', food(12, 3, 0, 60));
  it('coconut_water', 'Coconut Water', '🥥', 20, 'food', 3, 'Clean, sweet and full of salts.', food(2, 30, 1, 48), { returns: 'coconut_shell' });
  it('roast_coconut', 'Roasted Coconut', '🥥', 20, 'food', 5, 'Toasted flesh, nutty and sweet.', food(18, 0, 2, 120));
  it('coconut_milk', 'Coconut Milk', '🥛', 10, 'food', 6, 'Grated flesh squeezed through cloth.', food(10, 18, 2, 24));
  it('sashimi', 'Sashimi', '🍣', 20, 'food', 6, 'Thin slices of the freshest fish. Eat it now.', food(16, 4, 1, 12, 0.08));
  it('fish_skewer', 'Fish Skewer', '🍢', 20, 'food', 9, 'Chunks of fish grilled on a stick.', food(30, 0, 3, 60));
  it('salted_fish', 'Salted Fish', '🐟', 20, 'food', 10, 'Packed in salt. Keeps for a long voyage.', food(24, -8, 1, 1400));
  it('crab_cake', 'Crab Cakes', '🥮', 10, 'food', 16, 'Crab and mashed potato, pan-fried.', food(40, 0, 6, 48));
  it('seaweed_salad', 'Seaweed Salad', '🥗', 10, 'food', 7, 'Rinsed, dressed with coconut oil.', food(14, 6, 3, 24));
  it('kelp_crisps', 'Kelp Crisps', '🍘', 20, 'food', 5, 'Sun-dried seaweed. Salty snack.', food(9, -4, 0, 400));
  it('raw_shark', 'Shark Meat', '🥩', 20, 'food', 6, 'Firm and dense. Must be cooked well.', food(12, 0, 0, 24, 0.45));
  it('shark_steak', 'Shark Steak', '🍖', 20, 'food', 14, 'Thick, meaty and filling.', food(44, 0, 6, 60));
  it('fin_soup', 'Fin Soup', '🍲', 10, 'food', 26, 'Rich broth. Restores a great deal.', food(52, 24, 12, 36), { warm: 20 });
  it('boar_skewer', 'Meat Skewer', '🍢', 20, 'food', 12, 'Boar and pineapple on a stick.', food(40, 6, 5, 48));
  it('sausage', 'Boar Sausage', '🌭', 20, 'food', 14, 'Smoked and spiced. Keeps.', food(38, -2, 4, 700));
  it('dried_mango', 'Dried Mango', '🥭', 30, 'food', 6, 'Chewy, sweet strips.', food(14, -2, 1, 900));
  it('banana_chips', 'Banana Chips', '🍌', 30, 'food', 5, 'Crisp dried slices.', food(13, -2, 0, 900));
  it('baked_banana', 'Baked Banana', '🍌', 20, 'food', 5, 'Caramelised in its skin.', food(18, 2, 2, 48));
  it('grilled_mushroom', 'Grilled Mushrooms', '🍄', 20, 'food', 5, 'Safe once cooked through.', food(14, 0, 1, 48));
  it('mash', 'Potato Mash', '🥣', 10, 'food', 8, 'Soft and warm.', food(30, 4, 3, 36), { warm: 8 });
  it('chowder', 'Clam Chowder', '🍲', 10, 'food', 20, 'Clams, potato and coconut milk.', food(50, 20, 8, 36), { warm: 20 });
  it('fruit_juice', 'Fruit Juice', '🧃', 10, 'food', 8, 'Pressed pineapple and mango.', food(8, 40, 3, 24), { energy: 6 });
  it('island_feast', 'Island Feast', '🍱', 5, 'food', 44, 'Fish, crab, fruit and roast. A celebration.', food(90, 30, 25, 36), { energy: 20, warm: 10 });
  it('hardtack', 'Hardtack', '🍪', 20, 'food', 6, 'Baked coconut and potato biscuit. Almost eternal.', food(22, -6, 0, 3000));
  it('herbal_broth', 'Herbal Broth', '🍵', 10, 'food', 10, 'Seaweed, aloe and mushroom in hot water.', food(14, 26, 6, 24), { warm: 20, cure: ['sick'] });

  // ---------------------------------------------------------------- medicine
  it('charcoal_tablet', 'Charcoal Tablets', '⚫', 20, 'med', 6, 'Binds toxins in the gut. Cures food poisoning.', { med: { hp: 2, cure: ['sick', 'poison'] } });
  it('antiseptic', 'Antiseptic Wash', '🧴', 10, 'med', 10, 'Soap and boiled water. Prevents and treats infection.', { med: { hp: 4, cure: ['infection'] } });
  it('sterile_bandage', 'Sterile Dressing', '🩹', 10, 'med', 12, 'Boiled cloth and salve. Stops bleeding, guards against infection.', { med: { hp: 16, cure: ['bleeding', 'infection'] } });
  it('suture_kit', 'Suture Kit', '🪡', 5, 'med', 20, 'Needle and thread for deep cuts. Big heal.', { med: { hp: 30, cure: ['bleeding'] } });
  it('burn_cream', 'Burn Cream', '🧴', 10, 'med', 9, 'Aloe in coconut oil. Soothes sunburn and heals.', { med: { hp: 10, cure: ['sunburn'] } });
  it('rehydration', 'Rehydration Salts', '🧂', 10, 'med', 8, 'Salt, fruit sugar and clean water.', { med: { hp: 4, cure: ['sick'] }, food: { h: 0, t: 45, hp: 0, spoil: 0, sick: 0 } });
  it('poultice', 'Herbal Poultice', '🌿', 10, 'med', 7, 'Mashed aloe and mushroom. Draws out venom.', { med: { hp: 6, cure: ['poison'] } });
  it('sling', 'Arm Sling', '🦺', 10, 'med', 9, 'Splint and cloth. Sets a fracture and eases pain.', { med: { hp: 10, cure: ['fracture'] } });

  // ---------------------------------------------------------------- tools & weapons
  it('bone_knife', 'Bone Knife', '🔪', 1, 'tool', 5, 'Ground from a long bone. Holds an edge better than stone.', tool('knife', 0, 90, 10));
  it('shark_knife', 'Shark-tooth Knife', '🔪', 1, 'tool', 16, 'Serrated teeth set in a hardwood grip.', tool('knife', 1, 160, 14));
  it('obsidian_knife', 'Obsidian Blade', '🗡️', 1, 'tool', 26, 'Glass-sharp. Brittle, but nothing cuts cleaner.', tool('knife', 1, 120, 19));
  it('club', 'War Club', '🏏', 1, 'tool', 6, 'Heavy hardwood. Stuns boar, cracks shells.', tool('knife', 0, 140, 12));
  it('harpoon', 'Harpoon', '🔱', 1, 'tool', 22, 'Barbed bone head on a line. Lands big fish and wounds sharks.', tool('spear', 1, 180, 20));
  it('obsidian_spear', 'Obsidian Spear', '🔱', 1, 'tool', 30, 'Volcanic glass point. Brutal.', tool('spear', 1, 160, 26));
  it('spear_steel', 'Steel Spear', '🔱', 1, 'tool', 64, 'Forged point, bamboo shaft.', tool('spear', 2, 420, 30));
  it('machete_steel', 'Steel Machete', '🗡️', 1, 'tool', 60, 'Holds an edge through a jungle.', tool('knife', 2, 420, 22));
  it('hatchet', 'Hatchet', '🪓', 1, 'tool', 22, 'A light iron axe. Quick on palms and small trees.', tool('axe', 1, 180, 11));
  it('hammer', 'Claw Hammer', '🔨', 1, 'tool', 18, 'Builds and repairs faster than a mallet.', tool('mallet', 1, 400));
  it('shovel_steel', 'Steel Spade', '⚒️', 1, 'tool', 40, 'Digs twice as fast.', tool('shovel', 1, 400));
  it('rod_bamboo', 'Bamboo Rod', '🎣', 1, 'tool', 12, 'Light and springy, with a bone hook.', tool('rod', 0, 140));
  it('crossbow', 'Crossbow', '🏹', 1, 'tool', 70, 'Spring-steel prod. Powerful and steady.', tool('bow', 1, 300, 40));
  it('lantern_hand', 'Oil Lantern', '🏮', 1, 'tool', 18, 'Coconut-oil lamp in a glass chimney. Lasts far longer than a torch.', tool('torch', 1, 1200));
  it('spyglass', 'Spyglass', '🔭', 1, 'tool', 46, 'Brass and two lenses. Sees farther than binoculars.', tool('binoculars', 1, 9999));
  it('repair_kit_pro', 'Toolsmith Kit', '🧰', 10, 'tool', 30, 'Files, rivets and grease. Restores a tool completely.', { use: 'repair' });

  // ---------------------------------------------------------------- clothing & gear (data-driven effects; see player.js)
  it('bandana', 'Bandana', '🧣', 1, 'gear', 4, 'Cloth over the head and neck. Some shade.', { equip: 'head', shade: 0.65 });
  it('leather_hat', 'Wide Leather Hat', '🤠', 1, 'gear', 22, 'Deep shade and sheds rain.', { equip: 'head', shade: 0.35, armor: 0.05 });
  it('goggles', 'Swim Goggles', '🥽', 1, 'gear', 12, 'Plastic and rubber. See underwater, a little more breath.', { equip: 'face', air: 8 });
  it('sandals', 'Palm Sandals', '🩴', 1, 'gear', 5, 'Woven soles. Hot sand and coral cannot hurt you.', { equip: 'feet', swim: 1.0 });
  it('boots', 'Leather Boots', '🥾', 1, 'gear', 26, 'Sure footing. Slightly slower in water.', { equip: 'feet', swim: 0.9, armor: 0.05 });
  it('shirt', 'Linen Shirt', '👕', 1, 'gear', 10, 'Keeps the sun off your back.', { equip: 'body', warm: 0.85, sunproof: 1 });
  it('leather_vest', 'Leather Vest', '🦺', 1, 'gear', 34, 'Turns a bite or a tusk.', { equip: 'body', armor: 0.18, warm: 0.8 });
  it('shark_armor', 'Sharkskin Jerkin', '🦺', 1, 'gear', 70, 'Shark skin over leather. Teeth slide off.', { equip: 'body', armor: 0.32, warm: 0.75 });
  it('poncho', 'Tarp Poncho', '🧥', 1, 'gear', 12, 'Cheap and waterproof.', { equip: 'body', rainproof: 1 });
  it('satchel', 'Woven Satchel', '👜', 1, 'gear', 12, 'Five more pack slots.', { equip: 'pack', slots: 5 });
  it('dive_pack', 'Dry Pack', '🎒', 1, 'gear', 60, 'Rubberised canvas. Ten more slots, and it floats.', { equip: 'pack', slots: 10 });

  // ---------------------------------------------------------------- recipes
  // materials
  rc('crack_coconut', 'coconut_meat', 2, { coconut: 1 }, null, null, 'food', 2, { coconut_water: 1, coconut_husk: 2 });
  rc('coir', 'coir', 2, { coconut_husk: 4 }, null, null, 'basics', 3); rc('rope_coir', 'rope', 1, { coir: 2 }, null, null, 'basics');
  rc('rope_bark', 'rope', 1, { bark: 4 }, null, null, 'basics'); rc('tinder', 'tinder', 2, { coconut_husk: 1, bark: 1 }, null, null, 'basics');
  rc('thread', 'thread', 4, { fiber: 2 }, null, null, 'basics'); rc('thread_sinew', 'thread', 3, { sinew: 1 }, null, null, 'basics');
  rc('dowel', 'dowel', 8, { stick: 2 }, null, null, 'basics'); rc('palm_mat', 'palm_mat', 1, { palm_leaf: 5 }, null, null, 'basics', 3);
  rc('wicker', 'wicker', 1, { vine: 3, bamboo: 1 }, null, null, 'basics', 3); rc('net_mesh', 'net_mesh', 1, { rope: 3 }, null, null, 'basics', 4);
  rc('glue', 'glue', 2, { resin: 2, charcoal_dust: 1 }, 'fire', null, 'basics', 4); rc('tar', 'tar', 1, { resin: 3 }, 'fire', null, 'basics', 5);
  rc('treated_plank', 'treated_plank', 2, { plank: 2, tar: 1 }, 'workbench', null, 'basics', 3);
  rc('beam', 'beam', 1, { log: 2 }, 'workbench', null, 'basics', 5); rc('charcoal_dust', 'charcoal_dust', 3, { charcoal: 1 }, null, null, 'basics');
  rc('canvas', 'canvas', 1, { cloth: 2, tar: 1 }, 'workbench', null, 'basics', 4); rc('tarp', 'tarp', 1, { plastic: 6, thread: 2 }, null, null, 'basics', 4);
  rc('bone_needle', 'bone_needle', 2, { bone: 1 }, null, null, 'basics'); rc('bone_hook', 'bone_hook', 3, { bone: 1 }, null, null, 'basics');
  rc('mortar', 'mortar', 2, { lime: 1, sand: 2, bottle_fresh: 1 }, null, null, 'basics', 3, { bottle: 1 });
  rc('soap', 'soap', 2, { ash: 2, coconut_oil: 1 }, 'fire', null, 'basics', 5); rc('clay_pot', 'clay_pot', 1, { clay: 4 }, 'fire', null, 'basics', 5);
  rc('coconut_oil', 'coconut_oil', 1, { coconut_meat: 3, clay_pot: 1 }, 'fire', null, 'basics', 6, { clay_pot: 1 });
  rc('leather', 'leather', 1, { hide: 1, salt: 2, bark: 2 }, 'rack', null, 'basics', 8); rc('saltpeter', 'saltpeter', 1, { guano: 4, ash: 1 }, 'fire', null, 'industry', 6);
  rc('gunpowder', 'gunpowder', 2, { saltpeter: 2, sulfur: 1, charcoal_dust: 1 }, 'workbench', 'machinery', 'industry', 5);
  rc('sheet_metal', 'sheet_metal', 2, { iron_ingot: 1 }, 'forge', 'smelting', 'industry', 5); rc('iron_rod', 'iron_rod', 2, { iron_ingot: 1 }, 'forge', 'smelting', 'industry', 4);
  rc('chain', 'chain', 1, { iron_rod: 3 }, 'forge', 'smelting', 'industry', 6); rc('hinge', 'hinge', 2, { sheet_metal: 1, nails: 2 }, 'workbench', 'smelting', 'industry', 3);
  rc('bolts', 'bolts', 8, { iron_rod: 1 }, 'workbench', 'smelting', 'industry', 3); rc('spring', 'spring', 2, { steel: 1 }, 'forge', 'steelwork', 'industry', 5);
  rc('pipe', 'pipe', 1, { sheet_metal: 2 }, 'forge', 'smelting', 'industry', 5); rc('copper_pipe', 'copper_pipe', 1, { copper_ingot: 2 }, 'forge', 'smelting', 'industry', 5);
  rc('solar_cell', 'solar_cell', 1, { glass: 2, wire: 2, sand: 4 }, 'machine', 'electrics', 'industry', 8);
  // food
  rc('sashimi', 'sashimi', 2, { raw_fish: 1 }, null, null, 'food'); rc('fish_skewer', 'fish_skewer', 1, { raw_fish: 1, stick: 1 }, 'fire', null, 'food', 4);
  rc('salted_fish', 'salted_fish', 1, { raw_fish: 1, salt: 2 }, null, null, 'food', 3); rc('coconut_milk', 'coconut_milk', 1, { coconut_meat: 2, cloth: 1 }, null, null, 'food', 3, { cloth: 1 });
  rc('crab_cake', 'crab_cake', 2, { cooked_crab: 1, baked_potato: 1, coconut_oil: 1 }, 'grill', 'cooking', 'food', 5);
  rc('seaweed_salad', 'seaweed_salad', 1, { seaweed: 3, coconut_oil: 1 }, null, null, 'food', 2);
  rc('fin_soup', 'fin_soup', 1, { shark_steak: 1, seaweed: 2, clay_pot: 1, bottle_fresh: 1 }, 'grill', 'cooking', 'food', 7, { clay_pot: 1, bottle: 1 });
  rc('boar_skewer', 'boar_skewer', 2, { raw_meat: 1, pineapple: 1, stick: 2 }, 'fire', null, 'food', 5);
  rc('mash', 'mash', 1, { baked_potato: 2, coconut_milk: 1 }, null, null, 'food', 2);
  rc('chowder', 'chowder', 1, { steamed_clam: 1, potato: 1, coconut_milk: 1, clay_pot: 1 }, 'grill', 'cooking', 'food', 7, { clay_pot: 1 });
  rc('fruit_juice', 'fruit_juice', 1, { pineapple: 1, mango: 1, bottle: 1 }, null, null, 'food', 3);
  rc('island_feast', 'island_feast', 1, { cooked_fillet: 1, cooked_crab: 1, cooked_meat: 1, fruit_salad: 1 }, 'grill', 'cooking', 'food', 10);
  rc('hardtack', 'hardtack', 4, { coconut_meat: 2, potato: 2, salt: 1 }, 'fire', null, 'food', 6);
  rc('herbal_broth', 'herbal_broth', 1, { seaweed: 1, aloe: 1, mushroom: 1, bottle_fresh: 1 }, 'fire', null, 'food', 5, { bottle: 1 });
  rc('sausage', 'sausage', 3, { raw_meat: 2, salt: 1, fiber: 1 }, 'workbench', 'cooking', 'food', 5);
  // medicine
  rc('charcoal_tablet', 'charcoal_tablet', 3, { charcoal_dust: 2, coconut_meat: 1 }, null, null, 'medical', 3);
  rc('antiseptic', 'antiseptic', 1, { soap: 1, bottle_fresh: 1 }, 'fire', null, 'medical', 4, { bottle: 1 });
  rc('sterile_bandage', 'sterile_bandage', 2, { bandage: 2, salve: 1, bottle_fresh: 1 }, 'fire', 'medicine', 'medical', 5, { bottle: 1 });
  rc('suture_kit', 'suture_kit', 1, { bone_needle: 1, thread: 3, antiseptic: 1 }, 'workbench', 'medicine', 'medical', 5);
  rc('burn_cream', 'burn_cream', 2, { aloe: 2, coconut_oil: 1 }, null, null, 'medical', 3);
  rc('rehydration', 'rehydration', 2, { salt: 1, fruit_juice: 1, bottle_fresh: 1 }, null, null, 'medical', 3, { bottle: 1 });
  rc('poultice', 'poultice', 1, { aloe: 1, mushroom: 1, cloth: 1 }, null, null, 'medical', 3);
  rc('sling', 'sling', 1, { splint: 1, cloth: 2 }, null, null, 'medical', 3);
  // tools & weapons
  rc('bone_knife', 'bone_knife', 1, { bone: 2, fiber: 2 }, null, null, 'tools', 3); rc('club', 'club', 1, { log: 1, rope: 1 }, null, null, 'tools', 3);
  rc('shark_knife', 'shark_knife', 1, { shark_tooth: 3, stick: 1, glue: 1, rope: 1 }, 'workbench', null, 'tools', 5);
  rc('obsidian_knife', 'obsidian_knife', 1, { obsidian: 2, stick: 1, leather: 1 }, 'workbench', null, 'tools', 5);
  rc('harpoon', 'harpoon', 1, { bamboo: 2, bone: 2, rope: 3, glue: 1 }, 'workbench', 'angling', 'tools', 6);
  rc('obsidian_spear', 'obsidian_spear', 1, { obsidian: 2, bamboo: 2, sinew: 2 }, 'workbench', null, 'tools', 6);
  rc('spear_steel', 'spear_steel', 1, { steel: 2, bamboo: 2, leather: 1 }, 'forge', 'steelwork', 'tools', 6);
  rc('machete_steel', 'machete_steel', 1, { steel: 2, log: 1, leather: 1 }, 'forge', 'steelwork', 'tools', 6);
  rc('hatchet', 'hatchet', 1, { iron_ingot: 1, stick: 1, leather: 1 }, 'forge', 'smelting', 'tools', 5);
  rc('hammer', 'hammer', 1, { iron_ingot: 1, stick: 1, rope: 1 }, 'forge', 'smelting', 'tools', 4);
  rc('shovel_steel', 'shovel_steel', 1, { steel: 2, log: 1, rope: 1 }, 'forge', 'steelwork', 'tools', 6);
  rc('rod_bamboo', 'rod_bamboo', 1, { bamboo: 2, thread: 4, bone_hook: 1 }, null, null, 'tools', 4);
  rc('crossbow', 'crossbow', 1, { log: 1, spring: 2, rope: 2, bolts: 4 }, 'workbench', 'steelwork', 'tools', 8);
  rc('lantern_hand', 'lantern_hand', 1, { glass: 1, sheet_metal: 1, coconut_oil: 2, fiber: 1 }, 'workbench', 'smelting', 'tools', 6);
  rc('spyglass', 'spyglass', 1, { lens: 2, copper_pipe: 1, leather: 1 }, 'workbench', 'navigation', 'tools', 6);
  rc('repair_kit_pro', 'repair_kit_pro', 1, { steel: 1, bolts: 4, coconut_oil: 1, leather: 1 }, 'workbench', 'steelwork', 'tools', 6);
  // clothing
  rc('bandana', 'bandana', 1, { cloth: 1 }, null, null, 'gear', 2); rc('sandals', 'sandals', 1, { palm_leaf: 4, fiber: 3 }, null, null, 'gear', 3);
  rc('shirt', 'shirt', 1, { cloth: 3, thread: 4 }, 'workbench', null, 'gear', 5); rc('poncho', 'poncho', 1, { tarp: 1, thread: 2 }, null, null, 'gear', 3);
  rc('satchel', 'satchel', 1, { wicker: 1, palm_mat: 1, rope: 2 }, null, null, 'gear', 4);
  rc('goggles', 'goggles', 1, { plastic: 2, rubber: 1, glass: 1 }, 'workbench', null, 'gear', 4);
  rc('leather_hat', 'leather_hat', 1, { leather: 2, thread: 3 }, 'workbench', null, 'gear', 5);
  rc('boots', 'boots', 1, { leather: 3, rubber: 1, thread: 4 }, 'workbench', null, 'gear', 6);
  rc('leather_vest', 'leather_vest', 1, { leather: 4, thread: 6, bone_needle: 1 }, 'workbench', null, 'gear', 7, { bone_needle: 1 });
  rc('shark_armor', 'shark_armor', 1, { shark_skin: 3, leather_vest: 1, sinew: 3 }, 'workbench', null, 'gear', 9);
  rc('dive_pack', 'dive_pack', 1, { canvas: 3, rubber: 3, rope: 2 }, 'machine', 'scuba', 'gear', 8);

  // ---------------------------------------------------------------- station processes
  proc('fire', 'coconut_meat', 2, 'roast_coconut', 1, 16); proc('fire', 'raw_shark', 1, 'shark_steak', 1, 30); proc('fire', 'banana', 1, 'baked_banana', 1, 14);
  proc('fire', 'mushroom', 2, 'grilled_mushroom', 1, 14); proc('fire', 'coconut_shell', 2, 'charcoal', 1, 20); proc('fire', 'log', 1, 'ash', 2, 30);
  proc('furnace', 'shell', 2, 'lime', 1, 14); proc('furnace', 'coral_fragment', 3, 'lime', 1, 14); proc('furnace', 'aluminium', 3, 'iron_ingot', 1, 20);
  proc('smoker', 'raw_shark', 1, 'jerky', 2, 70); proc('rack', 'mango', 1, 'dried_mango', 2, 100); proc('rack', 'banana', 1, 'banana_chips', 2, 100);
  proc('rack', 'seaweed', 3, 'kelp_crisps', 2, 80); proc('rack', 'hide', 1, 'leather', 1, 240); proc('composter', 'guano', 2, 'fertilizer', 2, 30);
  proc('recycler', 'aluminium', 4, 'scrap', 2, 10); proc('recycler', 'treated_plank', 1, 'plank', 1, 6);

  // ---------------------------------------------------------------- where it all comes from
  const addDrop = (node, item, a, b) => { if (N[node] && !N[node].drops.some((d) => d[0] === item)) N[node].drops.push([item, a, b]); };
  addDrop('tree', 'resin', 0, 2); addDrop('tree', 'bark', 1, 3); addDrop('palm', 'coconut_husk', 0, 2); addDrop('deadtree', 'bark', 1, 2); addDrop('mangrove', 'bark', 1, 2);
  addDrop('rock', 'guano', 0, 1); addDrop('bush', 'resin', 0, 1);
  addDrop('shell', 'coral_fragment', 0, 2); addDrop('clam', 'coral_fragment', 0, 1);
  G.EXTRA_DROPS = { shark: [['shark_tooth', 2, 5], ['shark_skin', 1, 2], ['raw_shark', 3, 5]], boar: [['sinew', 1, 2]], gull: [['guano', 0, 1]] };
  // loot tables (floating barrels and crates, wreck chests)
  G.LOOT_EXTRA = { BARREL: [], CRATE: [] }; const L = G.LOOT_EXTRA; { L.BARREL.push([['coconut', 2], 2], [['resin', 2], 1.5], [['aluminium', 3], 2], [['thread', 4], 1.5], [['tarp', 1], 0.6], [['soap', 1], 0.6]); L.CRATE.push([['bolts', 6], 1.5], [['hinge', 2], 1], [['leather', 1], 0.8], [['sheet_metal', 1], 0.8], [['canvas', 1], 0.6], [['antiseptic', 1], 0.6], [['spring', 1], 0.5], [['goggles', 1], 0.3]); }
  Object.assign(IT.fins, { swim: 1.6 }); Object.assign(IT.dive_mask, { air: 14 }); Object.assign(IT.wetsuit, { warm: 0.25 }); Object.assign(IT.raincoat, { rainproof: 1 }); Object.assign(IT.sun_hat, { shade: 0.45 }); Object.assign(IT.backpack, { slots: 10 });
  G.RECIPE_CATS = [['all', 'All'], ['basics', 'Materials'], ['tools', 'Tools & weapons'], ['gear', 'Clothing & gear'], ['medical', 'Medical'], ['food', 'Food'], ['industry', 'Industry'], ['boats', 'Boats'], ['story', 'Expedition']];
})();
