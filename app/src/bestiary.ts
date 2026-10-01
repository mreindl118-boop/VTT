// The creature repository: every NPC, monster and beast the module names (manifests/characters.json), with a
// figure for the map, what players see, and the DM's quick numbers. Nothing here is the book's prose.
import * as THREE from 'three';
import characters from '../../manifests/characters.json';
import { CREATURES, humanoid, horse, bear, ape, sheep, swarm, vampireSpawn, gargoyle, scarecrow, animatedArmor, skeletonStanding, ghost, specter, shadow, ghoul, ghast, cultist, broom, type HumanoidOpts } from './kit/creatures';
import { pawn } from './kit/pieces';
import { baseRingFt, type CreatureSize } from './core/units';
import { PALETTE } from './kit/palette';

export interface Figure { kind?: string; skin?: string; cloth?: string; accent?: string; hair?: string; cloak?: boolean; weapon?: string; robe?: boolean; hunch?: number }
export interface CreatureEntry {
  id: string; name: string; tier: number; size: CreatureSize; visibility: string; tags: string[];
  kind: 'npc' | 'creature' | 'monster-manual' | 'generic' | 'pc' | 'token'; figure?: Figure; role?: string; variants?: string[];
}
/** The DM's numbers for the open-content creatures: armour class, hit points, speed, challenge. */
export interface Stats { ac: number; hp: number; speed: string; cr: string }

const RAW = (characters as { characters: CreatureEntry[] }).characters;
export const BESTIARY: CreatureEntry[] = RAW.filter((e) => e.kind !== 'token' && e.kind !== 'pc');
export const creatureById = (id: string): CreatureEntry | undefined => RAW.find((e) => e.id === id);

export const STATS: Record<string, Stats> = {
  wolf: { ac: 13, hp: 11, speed: '40 ft', cr: '1/4' }, 'dire-wolf': { ac: 14, hp: 37, speed: '50 ft', cr: '1' }, werewolf: { ac: 11, hp: 58, speed: '30 ft', cr: '3' },
  bat: { ac: 12, hp: 1, speed: '5 ft, fly 30 ft', cr: '0' }, 'swarm-of-bats': { ac: 12, hp: 22, speed: 'fly 30 ft', cr: '1/4' }, raven: { ac: 12, hp: 1, speed: '10 ft, fly 50 ft', cr: '0' },
  'swarm-of-ravens': { ac: 12, hp: 24, speed: 'fly 50 ft', cr: '1/4' }, 'swarm-of-rats': { ac: 10, hp: 24, speed: '30 ft', cr: '1/4' }, 'swarm-of-insects': { ac: 12, hp: 22, speed: '20 ft', cr: '1/2' },
  'giant-spider': { ac: 14, hp: 26, speed: '30 ft, climb 30 ft', cr: '1' }, ghoul: { ac: 12, hp: 22, speed: '30 ft', cr: '1' }, ghast: { ac: 13, hp: 36, speed: '30 ft', cr: '2' },
  zombie: { ac: 8, hp: 22, speed: '20 ft', cr: '1/4' }, skeleton: { ac: 13, hp: 13, speed: '30 ft', cr: '1/4' }, shadow: { ac: 12, hp: 16, speed: '40 ft', cr: '1/2' },
  specter: { ac: 12, hp: 22, speed: 'fly 50 ft', cr: '1' }, poltergeist: { ac: 12, hp: 22, speed: 'fly 50 ft', cr: '2' }, wraith: { ac: 13, hp: 67, speed: 'fly 60 ft', cr: '5' },
  wight: { ac: 14, hp: 45, speed: '30 ft', cr: '3' }, ghost: { ac: 11, hp: 45, speed: 'fly 40 ft', cr: '4' }, banshee: { ac: 12, hp: 58, speed: 'fly 40 ft', cr: '4' },
  revenant: { ac: 13, hp: 136, speed: '30 ft', cr: '5' }, 'vampire-spawn': { ac: 15, hp: 82, speed: '30 ft', cr: '5' }, scarecrow: { ac: 11, hp: 36, speed: '30 ft', cr: '1' },
  'twig-blight': { ac: 13, hp: 4, speed: '20 ft', cr: '1/8' }, 'needle-blight': { ac: 12, hp: 11, speed: '30 ft', cr: '1/4' }, 'vine-blight': { ac: 12, hp: 26, speed: '10 ft', cr: '1/2' },
  druid: { ac: 11, hp: 27, speed: '30 ft', cr: '2' }, berserker: { ac: 13, hp: 67, speed: '30 ft', cr: '2' }, 'will-o-wisp': { ac: 19, hp: 22, speed: 'fly 50 ft', cr: '2' },
  'night-hag': { ac: 17, hp: 112, speed: '30 ft', cr: '5' }, gargoyle: { ac: 15, hp: 52, speed: '30 ft, fly 60 ft', cr: '2' }, 'animated-armor': { ac: 18, hp: 33, speed: '25 ft', cr: '1' },
  'flying-sword': { ac: 17, hp: 17, speed: 'fly 50 ft', cr: '1/4' }, 'rug-of-smothering': { ac: 12, hp: 33, speed: '10 ft', cr: '2' }, 'crawling-claw': { ac: 12, hp: 2, speed: '20 ft', cr: '0' },
  'gray-ooze': { ac: 8, hp: 22, speed: '10 ft', cr: '1/2' }, 'red-dragon-wyrmling': { ac: 17, hp: 75, speed: '30 ft, fly 60 ft', cr: '4' }, mimic: { ac: 12, hp: 58, speed: '15 ft', cr: '2' },
  grick: { ac: 14, hp: 27, speed: '30 ft', cr: '2' }, 'shambling-mound': { ac: 15, hp: 136, speed: '20 ft', cr: '5' }, flameskull: { ac: 13, hp: 40, speed: 'fly 40 ft', cr: '4' },
  'shield-guardian': { ac: 17, hp: 142, speed: '30 ft', cr: '7' }, arcanaloth: { ac: 17, hp: 104, speed: '30 ft, fly 30 ft', cr: '12' }, lich: { ac: 17, hp: 135, speed: '30 ft', cr: '21' },
  deva: { ac: 17, hp: 136, speed: '30 ft, fly 90 ft', cr: '10' }, 'hell-hound': { ac: 15, hp: 45, speed: '50 ft', cr: '3' }, nightmare: { ac: 13, hp: 68, speed: '60 ft, fly 90 ft', cr: '3' },
  vrock: { ac: 15, hp: 104, speed: '40 ft, fly 60 ft', cr: '6' }, roc: { ac: 15, hp: 248, speed: '20 ft, fly 120 ft', cr: '11' }, 'saber-toothed-tiger': { ac: 12, hp: 52, speed: '40 ft', cr: '2' },
  quasit: { ac: 13, hp: 7, speed: '40 ft', cr: '1' }, imp: { ac: 13, hp: 10, speed: '20 ft, fly 40 ft', cr: '1' }, 'invisible-stalker': { ac: 14, hp: 104, speed: '50 ft, fly 50 ft', cr: '6' },
  'black-cat': { ac: 12, hp: 2, speed: '40 ft', cr: '0' }, 'riding-horse': { ac: 10, hp: 13, speed: '60 ft', cr: '1/4' }, 'draft-horse': { ac: 10, hp: 19, speed: '40 ft', cr: '1/4' }, mastiff: { ac: 12, hp: 5, speed: '40 ft', cr: '1/8' },
  commoner: { ac: 10, hp: 4, speed: '30 ft', cr: '0' }, scout: { ac: 13, hp: 16, speed: '30 ft', cr: '1/2' }, guard: { ac: 16, hp: 11, speed: '30 ft', cr: '1/8' }, priest: { ac: 13, hp: 27, speed: '30 ft', cr: '2' },
  acolyte: { ac: 10, hp: 9, speed: '30 ft', cr: '1/4' }, mage: { ac: 12, hp: 40, speed: '30 ft', cr: '6' }, noble: { ac: 15, hp: 9, speed: '30 ft', cr: '1/8' }, knight: { ac: 18, hp: 52, speed: '30 ft', cr: '3' },
  bandit: { ac: 12, hp: 11, speed: '30 ft', cr: '1/8' }, 'bandit-captain': { ac: 15, hp: 65, speed: '30 ft', cr: '2' }, cultist: { ac: 12, hp: 9, speed: '30 ft', cr: '1/8' }, 'cult-fanatic': { ac: 13, hp: 33, speed: '30 ft', cr: '2' },
  assassin: { ac: 15, hp: 78, speed: '30 ft', cr: '8' }, spy: { ac: 12, hp: 27, speed: '30 ft', cr: '1' }, thug: { ac: 11, hp: 32, speed: '30 ft', cr: '1/2' }, veteran: { ac: 17, hp: 58, speed: '30 ft', cr: '3' },
};

/** What players are told when a creature stands in sight and the DM has not named it. Own wording, by figure. */
const SEEN: Record<string, string> = {
  wolf: 'A grey wolf, lean and watchful.', bat: 'Bats, wheeling and squeaking.', raven: 'Black birds with knowing eyes.', horse: 'A horse.', spider: 'A spider as big as a pony.',
  blight: 'Something that moves like a plant and should not.', blob: 'A shapeless, glistening mass.', armor: 'A suit of armour that stands too still.', broom: 'A broom, standing on its bristles.',
  hut: 'A hut on a pair of enormous legs.', sword: 'A sword hanging in the air.', rug: 'A rug that stirs.', claw: 'A severed hand that crawls.', skull: 'A skull wreathed in green flame.',
};
const SEEN_ID: Record<string, string> = {
  skeleton: 'A skeleton in rotted gear.', zombie: 'A shambling corpse.', ghoul: 'A hunched, grey-skinned thing with long nails.', ghast: 'A gaunt, stinking corpse that moves with purpose.',
  'vampire-spawn': 'A pale figure with a hungry stare.', gargoyle: 'A stone gargoyle, which is not stone.', scarecrow: 'A scarecrow with a leering face.', ghost: 'A translucent figure drifting above the floor.',
  specter: 'A faint, furious shade.', shadow: 'A patch of darkness that moves on its own.', wraith: 'A hooded shape of smoke and malice.', wight: 'A dead warrior with burning eyes.',
  banshee: 'A wailing spirit of a woman.', revenant: 'A corpse that walks with terrible purpose.', 'strahd-zombie': 'A corpse stitched and sutured, limbs barely attached.',
  'barovian-witch': 'A ragged woman muttering over something foul.', mongrelfolk: 'A person patched together from several animals.', 'phantom-warrior': 'A knight of pale light.',
  commoner: 'A Barovian in drab clothes.', guard: 'A guard in a worn uniform.', cultist: 'A robed figure.', 'cult-fanatic': 'A robed figure with wild eyes.', 'vistani-bandit': 'A Vistani with a ready blade.',
  'vistani-thug': 'A heavy-set Vistani with a club.', 'strahd-von-zarovich': 'A tall, pale nobleman in black, utterly composed.', rahadin: 'A dark-haired elf in a grey cloak, quiet as a cat.',
  'madam-eva': 'An old Vistani woman with knowing eyes.', 'ireena-kolyana': 'A young woman with auburn hair and a watchful look.', 'ismark-kolyanovich': 'A broad young man with a sword and a worried face.',
};

/** The name players read on a placed creature until the DM renames it: monsters by kind, people as strangers. */
export function aliasFor(e: CreatureEntry): string {
  if (e.kind === 'npc') return e.size === 'small' ? 'A small figure' : 'A stranger';
  return e.name;
}
export function seenAs(e: CreatureEntry): string | undefined {
  return SEEN_ID[e.id] ?? (e.figure?.kind ? SEEN[e.figure.kind] : undefined) ?? (e.kind === 'npc' ? 'Someone you have not met.' : undefined);
}
export function statsOf(e: CreatureEntry): Stats | undefined { return STATS[e.id]; }
export function speedFtOf(e: CreatureEntry): number { const m = /(\d+) ft/.exec(STATS[e.id]?.speed ?? ''); return m ? Number(m[1]) : 30; }

/** Search by name, id, kind or tag; named people first when the query matches a name. */
export function searchCreatures(q: string, limit = 60): CreatureEntry[] {
  const t = q.trim().toLowerCase();
  const hits = BESTIARY.filter((e) => !t || e.name.toLowerCase().includes(t) || (t.length > 2 && (e.id.includes(t) || e.kind.includes(t) || (e.figure?.kind ?? '').includes(t))) || e.tags.some((x) => x.toLowerCase() === t));
  const rank = (e: CreatureEntry) => (e.name.toLowerCase().startsWith(t) ? 0 : e.name.toLowerCase().includes(t) ? 1 : 2) * 10 + (e.kind === 'npc' ? 0 : e.kind === 'creature' ? 1 : 2);
  return hits.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)).slice(0, limit);
}

/** The colour a creature's base ring and label take. */
export function colorOf(e: CreatureEntry): string { return e.figure?.cloth ?? e.figure?.skin ?? (e.kind === 'npc' ? '#8a6a9a' : '#8a2b2b'); }

/** A figure for the map: the characterised humanoid when the manifest gives one, else the kit creature by figure kind or id. */
export function figureFor(e: CreatureEntry): THREE.Group {
  const f = e.figure ?? {}, scale = ({ tiny: 0.5, small: 0.75, medium: 1, large: 1, huge: 1.2, gargantuan: 1.4 } as Record<string, number>)[e.size] ?? 1;
  const byId: Record<string, () => THREE.Group> = {
    'vampire-spawn': vampireSpawn, gargoyle, scarecrow, 'animated-armor': animatedArmor, skeleton: skeletonStanding, ghost: () => ghost(), specter, shadow, ghoul, ghast, cultist,
    'strahd-zombie': () => humanoid({ skin: '#8f9a86', cloth: '#3a2e2a', trim: '#2a211e', hunch: 0.5, claws: true }), zombie: () => humanoid({ skin: '#8a9a7c', cloth: '#4a4238', trim: '#3b352c', hunch: 0.4 }),
    'dire-wolf': () => CREATURES['dire-wolf']({}), wolf: () => CREATURES.wolf({}), 'swarm-of-bats': () => swarm({ scale: 1 }), 'swarm-of-rats': () => swarm({ scale: 0.8 }), 'swarm-of-ravens': () => swarm({ scale: 1 }),
    'swarm-of-insects': () => swarm({}), 'riding-horse': () => horse({}), 'draft-horse': () => horse({ scale: 1.1 }), beucephalus: () => horse({ scale: 1.1 }), 'broom-of-animated-attack': broom,
    'saber-toothed-tiger': () => bear({ scale: 0.9 }), mastiff: () => CREATURES.wolf({ scale: 0.8 }), 'black-cat': () => CREATURES.wolf({ scale: 0.3 }), 'shambling-mound': () => CREATURES['shambling-mound']({}),
    mimic: () => CREATURES.mimic({}), grick: () => CREATURES.grick({}), commoner: () => CREATURES.commoner({}),
  };
  if (byId[e.id]) return byId[e.id]();
  const byKind: Record<string, () => THREE.Group> = {
    wolf: () => CREATURES.wolf({}), bat: () => swarm({ scale: 0.8 }), raven: () => swarm({ scale: 0.8 }), horse: () => horse({}), spider: () => CREATURES.grick({}), armor: animatedArmor, broom,
    blight: () => scarecrow(), blob: () => pawn(PALETTE.mist2, baseRingFt(e.size)), hut: () => pawn('#5a4a3a', baseRingFt(e.size)), sword: () => pawn(PALETTE.iron, baseRingFt(e.size)),
    rug: () => pawn('#6a2a2a', baseRingFt(e.size)), claw: () => pawn('#b09a80', baseRingFt(e.size)), skull: () => pawn('#d9d2c0', baseRingFt(e.size)),
  };
  if (f.kind && byKind[f.kind]) return byKind[f.kind]();
  if (/ape/.test(e.id)) return ape({}); if (/bear/.test(e.id)) return bear({}); if (/sheep/.test(e.id)) return sheep({});
  const opts: HumanoidOpts = { skin: f.skin, cloth: f.cloth, trim: f.accent, hair: f.hair, cloak: f.cloak, robe: f.robe, hunch: f.hunch, scale, weapon: f.weapon === 'axe' || f.weapon === 'sword' ? 'sword' : f.weapon === 'staff' ? 'staff' : f.weapon === 'lantern' ? 'torch' : 'none' };
  return humanoid(opts);
}
