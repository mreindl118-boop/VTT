import { describe, expect, it } from 'vitest';
import { buildAtlas } from '../scripts/world-atlas';
import { buildMassing } from '../scripts/world-massing';
import world from '../locations/ch02/barovia-region/world.json';
import { siteOf } from '../app/src/render/worldstage';
import { buildLand, LandField, worldPaths } from '../app/src/render/worldland';
import { buildGridOverlay } from '../app/src/render/gridOverlay';
import grid from '../locations/ch09/T/grid.json';
import type { GridLevel } from '../app/src/core/schema';
import * as THREE from 'three';
import campaigns from '../manifests/campaigns.json';
import camp from '../locations/ch02/G/scene.json';
import type { Theme } from '../app/src/campaigns';
import { toLocal3, toWorld3, worldOfMiles } from '../app/src/core/frames';
import type { WorldData } from '../app/src/campaigns';

const atlas = buildAtlas(), data = world as unknown as WorldData;
const sites = Object.values(atlas.scenes).filter(e => e.campaign === 'cos' && e.worldBounds).map(siteOf);
const field = new LandField(data, sites);
const point = (path: string, x: number, z: number, y = 0) => toWorld3(atlas.scenes[path].placement, [x, y, z]);
function distance(p: number[], a: number[], b: number[]): number {
  const dx=b[0]-a[0], dz=b[1]-a[1], t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz || 1)));
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);
}

describe('source-backed site continuity', () => {
  it('supplies finite unit normals to the kit shaders on regional roads and rivers', () => {
    const land=buildLand(data,sites.map(s=>({...s,crag:false})),campaigns.campaigns[0].theme as unknown as Theme);
    try {
      const ribbons=land.group.children.filter(o=>o.name==='ribbons') as THREE.Mesh[];
      expect(ribbons.length).toBeGreaterThan(0);
      for(const mesh of ribbons) {
        const normal=mesh.geometry.getAttribute('normal'), position=mesh.geometry.getAttribute('position');
        expect(normal).toBeDefined();
        expect(normal.count).toBe(position.count);
        for(let i=0;i<normal.count;i++) {
          const length=Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i));
          expect(Number.isFinite(length)).toBe(true);
          expect(length).toBeCloseTo(1,5);
        }
      }
    } finally {
      land.group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
    }
  });
  it('uses a curved camp shoreline and outdoor light, without the imported rectangular water props',()=>{
    expect(camp.ambient).toBe('barovian-overcast');
    expect(camp.levels[0].objects.some(o=>['camp-p1','camp-p2'].includes(o.id))).toBe(false);
    expect(camp.levels[0].terrain.find(t=>t.floor==='shallow-water')?.polygon.length).toBeGreaterThan(4);
  });
  it('places the camp water north of its dry room, matching the north-up source plan', () => {
    const lake=data.lakes.find(l=>l.name==='Tser Pool')!, [cx,cz]=field.feet(lake.center);
    const [, , localZ]=toLocal3(atlas.scenes['ch02/G'].placement,[cx,0,cz]);
    expect(localZ).toBeLessThan(0);
    for(const [x,z,wet] of [[100,15,true],[100,60,false],[120,100,false]] as const) {
      const [wx,,wz]=point('ch02/G',x,z);
      expect(field.lakeAt(wx,wz)>=0).toBe(wet);
    }
  });
  it('keeps the regional ground below the Tsolenka bridge and its 500-foot gorge', () => {
    const [x,y,z]=point('ch09/T',155,170);
    expect(field.surface(x,z)-y).toBeLessThan(-450);
  });
  it('routes the Luna River beneath the authored bridge, not beside the pass', () => {
    const [x,,z]=point('ch09/T',155,170);
    const ds=data.rivers.filter(r=>r.name==='Luna River').flatMap(r=>r.pts.slice(1).map((b,i)=>distance([x,z],worldOfMiles(data,r.pts[i]),worldOfMiles(data,b))));
    expect(Math.min(...ds)).toBeLessThan(10);
  });
  it('connects both authored Tsolenka road approaches to the regional road', () => {
    const roads=worldPaths(field).roads;
    for(const [lx,lz] of [[227.5,497.5],[225,47.5]]) {
      const [x,,z]=point('ch09/T',lx,lz);
      const ends=roads.flatMap(r=>[r.pts[0],r.pts.at(-1)!]);
      expect(Math.min(...ends.map(p=>Math.hypot(p[0]-x,p[1]-z)))).toBeLessThan(12);
    }
  });
  it('continues Tser Pool from the local camp water with dry usable camp ground', () => {
    const [x,y,z]=point('ch02/G',100,30), lake=data.lakes.find(l=>l.name==='Tser Pool')!;
    const [cx,cz]=field.feet(lake.center), rx=lake.r[0]*5280, rz=lake.r[1]*5280;
    const south=cz+rz*Math.sqrt(1-((x-cx)/rx)**2);
    expect(Math.abs(south-z)).toBeLessThan(12);
    expect(Math.abs(field.lakeLevel(data.lakes.indexOf(lake))-y)).toBeLessThan(0.2);
    expect(field.lakeAt(...(([point('ch02/G',90,70)[0],point('ch02/G',90,70)[2]]) as [number,number]))).toBe(-1);
  });
  it('keeps the world terrain below the Amber Temple rooms, including behind the facade', () => {
    for(const [lx,lz,y] of [[125,190,30],[125,190,0],[35,220,0]]) {
      const [x,wy,z]=point('ch13/X',lx,lz,y);
      expect(field.surface(x,z),`room at ${lx},${lz}`).toBeLessThan(wy-0.5);
    }
  });
  it('keeps the rendered Amber approach flush up to the excavation lip', () => {
    const land=buildLand(data,sites.map(s=>({...s,crag:false})),campaigns.campaigns[0].theme as unknown as Theme);
    land.group.updateMatrixWorld(true);
    try {
      for(const [lx,lz,ly] of [[125,360,39.6],[125,292.25,39.6],[125,291.75,-2]]) {
        const [x,y,z]=point('ch13/X',lx,lz,ly);
        const ray=new THREE.Raycaster(new THREE.Vector3(x,y+1000,z),new THREE.Vector3(0,-1,0));
        const hits=ray.intersectObjects(land.group.children.filter(m=>['land','aprons'].includes(m.name)));
        expect(hits.length).toBeGreaterThan(0);
        expect(Math.abs(hits[0].point.y-y),`rendered approach at ${lx},${lz}`).toBeLessThanOrEqual(.05);
      }
    } finally {
      land.group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
    }
  });
  it('preserves both sides of every Amber excavation edge on flat surrounding ground', () => {
    const amber=sites.find(s=>s.path==='ch13/X')!;
    // Isolate the hard-edge meshing from the coarse regional heightfield's
    // interpolation: extend this test's flat footprint over all of its room cuts.
    const bounds={...amber.bounds};
    for(const {bounds:b} of amber.cuts!) {
      bounds.minX=Math.min(bounds.minX,b.minX-1); bounds.maxX=Math.max(bounds.maxX,b.maxX+1);
      bounds.minZ=Math.min(bounds.minZ,b.minZ-1); bounds.maxZ=Math.max(bounds.maxZ,b.maxZ+1);
    }
    const land=buildLand(data,[{...amber,bounds,crag:false}],campaigns.campaigns[0].theme as unknown as Theme);
    land.group.updateMatrixWorld(true);
    try {
      const ground=land.group.children.filter(m=>['land','aprons'].includes(m.name)) as THREE.Mesh[];
      // Hundreds of rays share this footprint. Discard only triangles whose X/Z
      // bounds cannot intersect any probe; keep every possible land/apron hit.
      // Otherwise each ray also scans the entire distant regional lattice.
      for(const mesh of ground) {
        const position=mesh.geometry.getAttribute('position'), index=mesh.geometry.index!, nearby:number[]=[];
        for(let k=0;k<index.count;k+=3) {
          const tri=[index.getX(k),index.getX(k+1),index.getX(k+2)];
          const xs=tri.map(v=>position.getX(v)), zs=tri.map(v=>position.getZ(v));
          if(Math.max(...xs)<bounds.minX || Math.min(...xs)>bounds.maxX || Math.max(...zs)<bounds.minZ || Math.min(...zs)>bounds.maxZ) continue;
          nearby.push(...tri);
        }
        mesh.geometry.setIndex(nearby);
      }
      const probes: [number,number,number][]=[];
      for(const cut of amber.cuts!) {
        const b=cut.bounds, cx=(b.minX+b.maxX)/2, cz=(b.minZ+b.maxZ)/2;
        // Both sides of every room edge, including overlapping room excavations.
        for(const d of [-.25,.25]) for(const [px,pz] of [[b.minX+d,cz],[b.maxX+d,cz],[cx,b.minZ+d],[cx,b.maxZ+d]]) {
          probes.push([px,pz,land.field.surface(px,pz)]);
        }
      }
      for(const [px,pz,want] of probes) {
        const ray=new THREE.Raycaster(new THREE.Vector3(px,amber.base+1000,pz),new THREE.Vector3(0,-1,0));
        const hits=ray.intersectObjects(ground);
        expect(hits.length).toBeGreaterThan(0);
        expect(Math.abs(hits[0].point.y-want),`rendered ground at ${px},${pz}: ${hits[0].point.y}, expected ${want}`).toBeLessThanOrEqual(.05);
      }
    } finally {
      land.group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
    }
  });
  it('faces all four hard excavation walls into the opening', () => {
    const amber=sites.find(s=>s.path==='ch13/X')!, [x,,z]=point('ch13/X',125,360);
    const cut={bounds:{minX:x-10,maxX:x+10,minZ:z-10,maxZ:z+10},floor:amber.base-40,featherX:0,featherZ:0};
    const land=buildLand(data,[{...amber,crag:false,cuts:[cut]}],campaigns.campaigns[0].theme as unknown as Theme);
    land.group.updateMatrixWorld(true);
    try {
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const direction=new THREE.Vector3(dx,0,dz);
        const ray=new THREE.Raycaster(new THREE.Vector3(x,amber.base-20,z),direction,0,20);
        const hits=ray.intersectObjects(land.group.children.filter(m=>m.name==='aprons'));
        expect(hits.length,`wall seen from the opening toward ${dx},${dz}`).toBeGreaterThan(0);
        expect(hits[0].distance).toBeCloseTo(10,2);
        expect(hits[0].face!.normal.dot(direction)).toBeLessThan(-.99);
      }
    } finally {
      land.group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
    }
  });
  it('the Gates map detailed proxy does not draw a second distant Ravenloft', () => {
    expect(buildMassing(atlas).sites['ch02/J'].kits.map(k=>k[0])).not.toContain('j-castle-mass');
  });
  it('draws no tactical grid in the empty gorge beside the bridge', () => {
    const mesh = buildGridOverlay(grid.levels.pass as unknown as GridLevel, 0);
    mesh.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(140,100,170),new THREE.Vector3(0,-1,0));
    expect(ray.intersectObject(mesh)).toHaveLength(0);
    mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose();
  });
  it('cuts the actual apron mesh below the bridge and the Amber Temple rooms', () => {
    const land = buildLand(data, sites.map(s=>({...s,crag:false})), campaigns.campaigns[0].theme as unknown as Theme);
    land.group.updateMatrixWorld(true);
    for (const [path,lx,lz,y,drop] of [['ch09/T',155,170,0,450],['ch13/X',125,190,0,0.5],['ch13/X',35,220,0,0.5]] as const) {
      const [x,wy,z] = point(path,lx,lz,y);
      const ray = new THREE.Raycaster(new THREE.Vector3(x,wy+1000,z),new THREE.Vector3(0,-1,0));
      const hits=ray.intersectObjects(land.group.children.filter(m=>['land','aprons'].includes(m.name)));
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].point.y).toBeLessThan(wy-drop);
    }
    land.group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
  });
  it('keeps the actual camp apron under its dry floor and follows the curved water edge', () => {
    const land=buildLand(data,sites.map(s=>({...s,crag:false})),campaigns.campaigns[0].theme as unknown as Theme);
    land.group.updateMatrixWorld(true);
    const ground=(lx:number,lz:number)=>{
      const [x,wy,z]=point('ch02/G',lx,lz);
      const ray=new THREE.Raycaster(new THREE.Vector3(x,wy+100,z),new THREE.Vector3(0,-1,0));
      const hits=ray.intersectObjects(land.group.children.filter(m=>['land','aprons'].includes(m.name)));
      expect(hits.length).toBeGreaterThan(0);
      return hits[0].point.y-wy;
    };
    for(const [x,z] of [[90,75],[120,75],[130,75]])expect(ground(x,z)).toBeLessThan(-.05);
    for(let i=0;i<64;i++){
      const a=(i+.37)/64*Math.PI*2;
      expect(ground(100+178*Math.cos(a),-150+178*Math.sin(a)),`wet shore ${i}`).toBeLessThan(0);
      expect(ground(100+182*Math.cos(a),-150+182*Math.sin(a)),`dry shore ${i}`).toBeGreaterThan(-1);
    }
    land.group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
  });
});
