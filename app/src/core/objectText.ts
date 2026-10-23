// What players and the DM read about a scene object when it has no words of its own, and what players call it.
// Pure data and string helpers (no rendering), so the rules-link review list can read them outside the app.
import type { SceneObject } from './schema';

/** Generic player-facing descriptions by kind, used when an object has none of its own. Original wording. */
export const KIND_DESC: Record<string, string> = {
  table: 'A wooden table.', chair: 'A wooden chair.', bed: 'A bed with a straw mattress.', 'bed-plain': 'A plain wood-framed bed.', 'four-poster-bed': 'A four-poster bed hung with curtains.',
  'child-bed': 'A small bed, sized for a child.', chest: 'A wooden chest.', trunk: 'A wooden trunk.', 'crate-chest': 'A wooden chest with an iron padlock.', 'claw-chest-skeleton': 'A heavy chest on clawed iron feet. A skeleton in leather armor hangs half out of it.',
  coffin: 'A wooden coffin.', 'bier-coffin': 'A stone bier with a coffin resting on it.', 'stone-slab': 'A heavy stone slab.', column: 'A stone pillar.', post: 'A thick wooden post with a crossbeam.',
  fireplace: 'A fireplace, unlit.', chandelier: 'A chandelier hangs from the ceiling.', drapes: 'Heavy drapes cover the window.', 'shield-of-arms': 'A shield painted with a coat of arms: a golden windmill on a red field.',
  portrait: 'A framed portrait.', 'stag-head': "A stag's head mounted above the mantel.", 'stuffed-wolf': 'A stuffed wolf, posed mid-snarl.', 'cloak-hooks': 'Cloaks hang from hooks on the wall; a top hat sits on the shelf above.',
  shelves: 'Shelves stacked with wares.', bookshelf: 'Shelves of books.', desk: 'A writing desk.', wardrobe: 'A tall wardrobe.', stove: 'A small iron stove.', oven: 'A domed stone oven with a bent stovepipe.',
  crib: 'A crib draped in a black shroud.', harpsichord: 'A harpsichord with a bench.', harp: 'A tall standing harp.', 'armor-suit': 'A suit of armor with a wolf-shaped visor, holding a spear.', 'glass-hanging': 'A stained-glass hanging of figures singing and playing.',
  tub: 'A wooden tub on clawed feet.', 'barrel-spigot': 'A barrel beneath a spigot in the wall.', 'standing-mirror': 'A full-length mirror in a carved frame.', nightstand: 'A small bedside table.', 'rocking-chair': 'A rocking chair.',
  candlestick: 'An iron candlestick.', 'oil-lamp': 'An oil lamp, unlit.', lamp: 'An oil lamp.', tapestry: 'A tapestry of riders and hounds at the hunt.', bench: 'A long wooden bench.', 'torch-crate': 'An open crate of torches.',
  doll: 'A smiling doll in a lacy yellow dress, draped in cobwebs.', bones: 'Moldy bones scattered on the floor.', skeleton: 'Skeletal remains.', 'shackled-skeleton': 'A skeleton hangs from rusted shackles on the wall.', 'small-skeletons': 'Two small skeletons in tattered clothes; the smaller cradles a stuffed doll.',
  'strahd-statue': 'A painted wooden statue of a gaunt, pale man in a black cloak, one hand resting on the head of a wolf. He holds a smoky crystal orb.', 'ghoul-altar': 'A stone altar carved with grasping ghouls, stained dark with old blood.',
  chains: 'Rusty chains and shackles hang from the ceiling.', 'planks-ceiling': 'A low ceiling of close-fitting planks.', 'pit-open': 'An open pit lined with sharpened stakes.', 'pit-cover': 'The earthen floor.', well: 'A stone-lipped well; a bucket hangs from a rope and pulley.',
  pallet: 'A moldy straw pallet.', niche: 'A wall niche holding a small object.', dais: 'An octagonal stone dais rising from the water.', ledge: 'A dry stone ledge above the water.', altar: 'A stone altar.', wheel: 'A wooden wheel half-embedded in the wall.',
  refuse: 'A half-submerged heap of refuse.', portcullis: 'A rusty iron portcullis.', gate: 'A wrought-iron gate on shrieking hinges.', 'timber-brace': 'Timber braces shore up the tunnel.', cobweb: 'Thick cobwebs.', sheeted: 'Old furniture draped in dusty white sheets.',
  'wine-cask': 'A small cask of wine.', 'dumbwaiter-shaft': 'A small door in the wall opens onto a dumbwaiter shaft.', dumbwaiter: 'A dumbwaiter door.', trapdoor: 'A trapdoor set into the floor.', 'toy-chest-windmills': 'A toy chest painted with windmills.', 'dollhouse-replica': 'A dollhouse: an exact replica of this house.',
  'toy-chest': 'A small box.', 'spiral-stair': 'A spiral staircase.', 'stairs-straight': 'A staircase.', cabinet: 'A wooden cabinet.', 'secret-panel': 'A section of wall.', 'pressure-plate': 'The floor.',
  ghoul: 'A hunched, gray-skinned corpse with long claws.', ghast: 'A gaunt, robed corpse that reeks of the grave.', shadow: 'A patch of darkness shaped like a person.', ghost: 'A translucent figure drifting above the floor.', specter: 'A skeletally thin, translucent woman, screaming silently.',
  'animated-armor': 'A suit of black plate armor draped in cobwebs.', mimic: 'A wooden door.', 'shambling-mound': 'A mound of rotting vegetation and refuse.', grick: 'A worm-like thing with a beak ringed by tentacles.', 'swarm-of-insects': 'A boiling mass of centipedes.', 'broom-of-animated-attack': 'A cobweb-covered broom leaning against the wall.',
};
export function kindName(kind: string): string { return kind.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()); }

/** What players call a thing: never the DM label of something hidden or disguised. */
export function playerLabel(o: SceneObject): string {
  if (o.playerLabel) return o.playerLabel;
  return o.vis === 'player' || !o.vis ? o.label ?? kindName(o.kind) : kindName(o.kind);
}
/** What players read: the authored description, else a generic one for plainly visible things. */
export function playerDesc(o: SceneObject): string | undefined {
  return o.desc ?? (o.vis === 'player' || !o.vis || o.vis === 'hidden-creature' ? KIND_DESC[o.kind] : undefined);
}
