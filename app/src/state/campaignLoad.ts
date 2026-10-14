import { newCampaign, type CampaignState } from './campaign';
import { CASTLE_MAP_REVISION, migrateMapState } from './mapMigrations';
import type { GridFile, SceneFile } from '../core/schema';

export class MapMigrationError extends Error {
  constructor(readonly issues: string[]) { super(`Saved Castle layout: ${issues.join('; ')}`); }
}

/** Only newly created saves start current. A missing marker in a saved payload is legacy. */
export function newCurrentCampaign(id: string): CampaignState {
  const state = newCampaign(id);
  if (id === 'cos') state.mapRevisions = { K: CASTLE_MAP_REVISION };
  return state;
}

/** Prepare a DM save without mutating it or persisting anything. The caller commits
 * it only after the requested map has loaded and the navigation is still current. */
export async function prepareCampaignState(id: string, saved: unknown,
  castle: () => Promise<{ scene: SceneFile; grid: GridFile }>,
): Promise<{ state: CampaignState; migrated: boolean }> {
  if (saved === undefined) return { state: newCurrentCampaign(id), migrated: false };
  // Validate the stored root before defaults can turn an unsupported payload into
  // an apparently valid empty campaign and persist it over the original record.
  if (typeof saved !== 'object' || saved === null || Array.isArray(saved)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(saved))) {
    throw new MapMigrationError(['invalid saved campaign record']);
  }
  const state: CampaignState = { ...newCampaign(id), ...saved };
  const revisions = state.mapRevisions;
  if (id !== 'cos' || (revisions && typeof revisions === 'object' && !Array.isArray(revisions)
    && Number.isSafeInteger(revisions.K) && revisions.K >= CASTLE_MAP_REVISION)) return { state, migrated: false };
  // The legacy Castle coverage frame has no embedded origin. Its authored target
  // must be available before any map can stream using this campaign's old memory.
  const { scene, grid } = await castle();
  const result = migrateMapState(state, scene, grid);
  if (result.issues.length) throw new MapMigrationError(result.issues);
  return { state: result.state, migrated: result.applied };
}
