// Campaigns: each has its own manifest (the module's structure), its own world map and its own saved state.
// The active campaign follows the open location's path prefix; the library switches between them.
import campaigns from '../../manifests/campaigns.json';
import cos from '../../manifests/locations.json';
import wsc from '../../manifests/wsc-locations.json';
import barovia from '../../locations/ch02/barovia-region/world.json';
import sheep from '../../locations/wsc/00-region/world.json';

export interface Theme { id: string; mist: string; page0: string; page1: string; skyLight: string; groundLight: string; hemi: number; key: number; keyColor: string; fogOut: number; fogIn: number; apron: string; forest: [string, string] }
export interface Campaign { id: string; name: string; subtitle: string; manifest: string; prefixes: string[]; world: string; home: string; theme: Theme }
export interface WorldData {
  name: string; bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** blurb: what players read about the place; dm: the DM's own note. */
  /** heightFt: how far the site stands above the surrounding land (a castle on its crag). */
  pins: { key: string; name: string; pos: [number, number]; type: string; scenes?: string[]; blurb?: string; dm?: string; heightFt?: number }[];
  roads: { name: string; pts: [number, number][] }[]; rivers: { name: string; pts: [number, number][] }[];
  lakes: { name: string; center: [number, number]; r: [number, number] }[]; peaks: { name: string; pos: [number, number] }[];
  woods: { name: string; pos: [number, number] }[]; high: [number, number][];
}
export interface ManifestLoc { id: string; name: string; chapter: string; status: string; mapPages: number[]; areas: { key: string; name: string }[]; path: string; section?: string; notes?: string }
export interface Manifest { chapters: { id: string; number: number | null; title: string }[]; locations: ManifestLoc[]; sections?: { id: string; title: string }[]; pointers?: { id: string; title: string; pointsTo: string[]; note: string }[] }

export const CAMPAIGNS: Campaign[] = (campaigns as unknown as { campaigns: Campaign[] }).campaigns;
const MANIFESTS: Record<string, Manifest> = { 'locations.json': cos as unknown as Manifest, 'wsc-locations.json': wsc as unknown as Manifest };
const WORLDS: Record<string, WorldData> = { 'ch02/barovia-region': barovia as unknown as WorldData, 'wsc/00-region': sheep as unknown as WorldData };

export const campaignOf = (path: string): Campaign => CAMPAIGNS.find((c) => c.prefixes.some((p) => path.startsWith(p + '/'))) ?? CAMPAIGNS[0];
export const manifestOf = (c: Campaign): Manifest => MANIFESTS[c.manifest];
export const worldOf = (c: Campaign): WorldData => WORLDS[c.world];
