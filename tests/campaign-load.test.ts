import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { newCampaign } from '../app/src/state/campaign';
import { MapMigrationError, newCurrentCampaign, prepareCampaignState } from '../app/src/state/campaignLoad';

const files = () => Promise.resolve({
  scene: JSON.parse(readFileSync('locations/ch04/K/scene.json','utf8')),
  grid: JSON.parse(readFileSync('locations/ch04/K/grid.json','utf8')),
});
describe('campaign load preparation',()=>{
  it('marks only fresh Castle campaigns current without requesting Castle data',async()=>{
    const load=vi.fn(files),fresh=await prepareCampaignState('cos',undefined,load);
    expect(fresh.state.mapRevisions).toEqual({K:1});expect(fresh.migrated).toBe(false);expect(load).not.toHaveBeenCalled();
    expect(newCurrentCampaign('wsc').mapRevisions).toBeUndefined();
  });
  it('preserves missing saved markers as legacy and returns a separate prepared state',async()=>{
    const saved=newCampaign('cos'),before=structuredClone(saved),load=vi.fn(files);
    const result=await prepareCampaignState('cos',saved,load);
    expect(result.migrated).toBe(true);expect(result.state.mapRevisions).toEqual({K:1});
    expect(saved).toEqual(before);expect(saved.mapRevisions).toBeUndefined();expect(load).toHaveBeenCalledTimes(1);
  });
  it('does not fetch Castle for an already migrated save or another campaign',async()=>{
    const load=vi.fn(files);
    expect((await prepareCampaignState('cos',newCurrentCampaign('cos'),load)).migrated).toBe(false);
    expect((await prepareCampaignState('wsc',newCampaign('wsc'),load)).state.mapRevisions).toBeUndefined();
    expect(load).not.toHaveBeenCalled();
  });
  it.each(['1',Infinity,-1,null])('does not accept malformed revision %s as current',async value=>{
    const saved=newCampaign('cos');Object.assign(saved,{mapRevisions:{K:value}});
    await expect(prepareCampaignState('cos',saved,files)).rejects.toBeInstanceOf(MapMigrationError);
  });
  it('keeps the original save when required Castle data is unavailable',async()=>{
    const saved=newCampaign('cos'),before=structuredClone(saved);
    await expect(prepareCampaignState('cos',saved,async()=>{throw new Error('offline Castle data');})).rejects.toThrow('offline Castle data');
    expect(saved).toEqual(before);
  });
  it.each([null,0,false,[],42,'bad',true])('rejects malformed saved root %j before adding defaults',async saved=>{
    const load=vi.fn(files);
    await expect(prepareCampaignState('cos',saved as any,load)).rejects.toBeInstanceOf(MapMigrationError);
    expect(load).not.toHaveBeenCalled();
  });
});
