/** Read-only CPU coverage ledger. Findings are observations, never all-map acceptance. */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pointInPolygon, type Vec2 } from '../../app/src/core/geometry';
import { moveBlockers } from '../../app/src/core/light';
import { linkMarkerGroups } from '../../app/src/core/linkMarkers';
import { VerticalTransitions } from '../../app/src/core/verticalLinks';
import type { GridFile, SceneFile, Wall } from '../../app/src/core/schema';

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
export function discoverMaps(root: string) {
  const campaigns = read(join(root, 'manifests/campaigns.json')).campaigns as {id:string;manifest:string}[];
  const manifests = readdirSync(join(root, 'manifests')).filter(p => p.endsWith('.json')).sort()
    .map(name => ({name, data:read(join(root,'manifests',name))})).filter(m => Array.isArray(m.data.locations));
  const paths = new Map<string, string[]>();
  for (const m of manifests) for (const loc of m.data.locations) {
    if (typeof loc.path !== 'string') throw new Error(`Missing location path in ${m.name}`);
    paths.set(loc.path, [...(paths.get(loc.path) ?? []), m.name]);
  }
  const walk = (dir: string) => {
    for (const e of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      const p=join(dir,e.name);
      if(e.isDirectory()) walk(p);
      else if(e.name==='scene.json' || e.name==='world.json') {
        const map=relative(root,dir).replaceAll('\\','/');
        if(!paths.has(map)) paths.set(map,[]);
      }
    }
  };
  walk(join(root,'locations'));
  return {
    manifests:manifests.map(m=>({name:m.name,campaigns:campaigns.filter(c=>c.manifest===m.name).map(c=>c.id)})),
    missingCampaignManifests:campaigns.filter(c=>!manifests.some(m=>m.name===c.manifest)).map(c=>c.manifest),
    maps:[...paths].sort(([a],[b])=>a.localeCompare(b)).map(([path,refs])=>({path,manifests:refs,
      scope:path.startsWith('locations/dev/')?'development':'production',
      scene:existsSync(join(root,path,'scene.json')),world:existsSync(join(root,path,'world.json'))})),
  };
}

/** Positive collinear overlap only; a crossing/touch is not an aperture overlap. */
export function overlaps(a: Wall, b: Wall): boolean {
  const dx=a.b[0]-a.a[0],dy=a.b[1]-a.a[1],len=Math.hypot(dx,dy);
  if(!len) return false;
  const cross=(p:Vec2)=>Math.abs(dx*(p[1]-a.a[1])-dy*(p[0]-a.a[0]))/len;
  if(cross(b.a)>1e-6 || cross(b.b)>1e-6) return false;
  const at=(p:Vec2)=>((p[0]-a.a[0])*dx+(p[1]-a.a[1])*dy)/len;
  return Math.min(len,Math.max(at(b.a),at(b.b)))-Math.max(0,Math.min(at(b.a),at(b.b)))>1e-6;
}
export function auditMaps(root: string) {
  const inventory=discoverMaps(root);
  const levels:{map:string;level:string;grid:boolean;floor:boolean;directions:number;doors:number}[]=[];
  const transitions:{map:string;link:string;end:string;dispatch:string;marker:string;floor:string;runtime:string}[]=[];
  const doors:{map:string;level:string;door:string;kind:string;closed:string;opened:string;overlaps:string[];runtime:string}[]=[];
  const errors:string[]=[];
  for(const map of inventory.maps.filter(m=>m.scope==='production' && m.scene)) {
    const scene=read(join(root,map.path,'scene.json')) as SceneFile;
    const gp=join(root,map.path,'grid.json'); const grid:GridFile|undefined=existsSync(gp)?read(gp):undefined;
    const markers=scene.levels.flatMap(l=>linkMarkerGroups(scene,l.id).flat());
    for(const level of scene.levels) {
      const doorWalls=level.walls.filter(w=>w.flags.includes('door')||w.flags.includes('secret-door'));
      levels.push({map:map.path,level:level.id,grid:!!grid?.levels[level.id],floor:!!grid?.levels[level.id]?.floorPolygons?.length,
        directions:scene.links.flatMap(k=>[k.from,k.to]).filter(e=>e.level===level.id).length,doors:doorWalls.length});
      for(const w of doorWalls) {
        // Revealed secret is explicitly modelled as a door; unrevealed behavior is not claimed.
        const asDoor={...w,flags:w.flags.map(f=>f==='secret-door'?'door':f)} as Wall;
        const closed=moveBlockers([{...asDoor,open:false}]).length;
        const opened=moveBlockers([{...asDoor,open:true}]).length;
        doors.push({map:map.path,level:level.id,door:w.id,kind:w.flags.includes('secret-door')?'revealed-secret':'door',
          closed:w.flags.includes('ethereal')?'unsupported-ethereal-layer':closed===1?'blocks':'finding-not-blocking',
          opened:opened===0?'target-unblocks':'finding-still-blocking',
          overlaps:level.walls.filter(other=>other!==w && moveBlockers([other]).length && overlaps(w,other)).map(other=>other.id).sort(),
          runtime:'untested: route, lock action, reveal action, token clearance and UI'});
      }
    }
    for(const k of scene.links) for(const end of ['from','to'] as const) {
      const from=k[end],to=k[end==='from'?'to':'from'];
      const result=new VerticalTransitions().resolve(scene.links,{level:from.level,pos:[...from.pos]}, {linkId:k.id,from:end});
      const reverse=new VerticalTransitions().resolve([...scene.links].reverse(),{level:from.level,pos:[...from.pos]}, {linkId:k.id,from:end});
      const valid=scene.levels.some(l=>l.id===from.level)&&scene.levels.some(l=>l.id===to.level);
      const polys=grid?.levels[from.level]?.floorPolygons;
      transitions.push({map:map.path,link:k.id,end,
        dispatch:!valid?'finding-missing-level':result?.to===to && reverse?.to===to?'exact-endpoint-both-orders':'finding-wrong-endpoint',
        marker:markers.filter(m=>m.linkId===k.id&&m.linkEnd===end).length===1?'retained-once':'finding-missing-or-duplicate',
        floor:!polys?.length?'unsupported-no-floor':polys.some(p=>pointInPolygon(from.pos,p))?'authored-point-on-floor':'finding-authored-point-off-floor',
        runtime:'untested: snapping, approach/departure, automatic trigger, fog, reveal and browser action'});
    }
    const unique=(xs:string[])=>new Set(xs).size===xs.length;
    if(!unique(scene.levels.map(l=>l.id))) errors.push(`${map.path}:duplicate-level`);
    if(!unique(scene.links.map(l=>l.id))) errors.push(`${map.path}:duplicate-link`);
    for(const l of scene.levels) if(!unique(l.walls.map(w=>w.id))) errors.push(`${map.path}/${l.id}:duplicate-wall`);
  }
  return {inventory,levels,transitions,doors,errors};
}
