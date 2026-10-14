import { describe,expect,it } from 'vitest';
import { mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditMaps,discoverMaps,overlaps } from './audits/mapCoverage';
import type { SceneFile,Wall } from '../app/src/core/schema';

describe('manifest-discovered map coverage audit',()=>{
  it('discovers new campaign manifests, unbuilt entries, unregistered scenes and development fixtures',()=>{
    const root=mkdtempSync(join(tmpdir(),'mistlab-inventory-'));
    const put=(p:string,v:unknown)=>{mkdirSync(join(root,p,'..'),{recursive:true});writeFileSync(join(root,p),JSON.stringify(v));};
    try {
      put('manifests/campaigns.json',{campaigns:[{id:'new',manifest:'new.json'}]});
      put('manifests/new.json',{locations:[{path:'locations/new/unbuilt'}]});
      put('manifests/unassigned.json',{locations:[{path:'locations/new/region'}]});
      put('locations/new/region/world.json',{});put('locations/new/orphan/scene.json',{});put('locations/dev/fixture/scene.json',{});
      const r=discoverMaps(root);
      expect(r.maps.map(m=>m.path)).toEqual(['locations/dev/fixture','locations/new/orphan','locations/new/region','locations/new/unbuilt']);
      expect(r.maps[0].scope).toBe('development');expect(r.maps[1].manifests).toEqual([]);
      expect(r.maps[3].scene).toBe(false);expect(r.manifests[1].campaigns).toEqual([]);
    } finally {rmSync(root,{recursive:true,force:true});}
  });
  it('distinguishes positive aperture overlap from crossing, touching and parallel walls',()=>{
    const wall=(a:number[],b:number[])=>({a,b} as Wall),a=wall([0,0],[10,0]);
    expect(overlaps(a,wall([8,0],[2,0]))).toBe(true);
    for(const b of [wall([10,0],[15,0]),wall([5,-5],[5,5]),wall([0,1],[10,1])]) expect(overlaps(a,b)).toBe(false);
  });
  it('accounts for every production level, endpoint and door without hiding geometry findings',()=>{
    const r=auditMaps(process.cwd());
    if(process.env.MAP_COVERAGE_OUTPUT) writeFileSync(process.env.MAP_COVERAGE_OUTPUT,JSON.stringify(r,null,2)+'\n');
    expect(r).toEqual(auditMaps(process.cwd()));
    expect(r.inventory.missingCampaignManifests).toEqual([]);expect(r.errors).toEqual([]);
    let levels=0,directions=0,doors=0;
    for(const m of r.inventory.maps.filter(m=>m.scope==='production'&&m.scene)) {
      const s=JSON.parse(readFileSync(join(m.path,'scene.json'),'utf8')) as SceneFile;
      levels+=s.levels.length;directions+=s.links.length*2;
      doors+=s.levels.reduce((n,l)=>n+l.walls.filter(w=>w.flags.some(f=>f==='door'||f==='secret-door')).length,0);
    }
    expect(r.levels).toHaveLength(levels);expect(r.transitions).toHaveLength(directions);expect(r.doors).toHaveLength(doors);
    expect(r.transitions.filter(t=>t.dispatch!=='exact-endpoint-both-orders'||t.marker!=='retained-once')).toEqual([]);
    expect(r.doors.filter(d=>d.closed==='finding-not-blocking'||d.opened==='finding-still-blocking')).toEqual([]);
    // Off-floor points and overlaps remain visible evidence, not silently excluded or asserted fixed.
    expect(r.transitions.every(t=>t.runtime.startsWith('untested:'))).toBe(true);
    expect(r.doors.every(d=>d.runtime.startsWith('untested:'))).toBe(true);
    console.log(JSON.stringify({maps:r.inventory.maps.length,productionBuilt:r.inventory.maps.filter(m=>m.scope==='production'&&(m.scene||m.world)).length,
      levels,directions,doors,offFloor:r.transitions.filter(t=>t.floor==='finding-authored-point-off-floor').length,
      unsupportedFloor:r.transitions.filter(t=>t.floor.startsWith('unsupported')).length,overlappingDoors:r.doors.filter(d=>d.overlaps.length).length}));
  });
});
