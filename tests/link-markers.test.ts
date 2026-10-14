import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { linkMarkerGroups } from '../app/src/core/linkMarkers';
import { validateScene, type SceneFile } from '../app/src/core/schema';

const scene = (path: string): SceneFile => JSON.parse(readFileSync(`locations/${path}/scene.json`, 'utf8'));
const endpoints = (s: SceneFile) => s.levels.flatMap(l => linkMarkerGroups(s, l.id).flat());

describe('link marker choices', () => {
  it('retains all 346 production endpoints, including all 48 original and the corrected Tsolenka shared choice', () => {
    const inventory = JSON.parse(readFileSync('docs/handoff/allmap-audit-inventory.json', 'utf8'));
    let total = 0, merged = 0, originalMerged = 0;
    for (const map of inventory.maps.filter((m: {scope:string;levelCount:number}) => m.scope === 'production' && m.levelCount)) {
      const s = scene(map.path);
      for (const level of s.levels) {
        const groups = linkMarkerGroups(s, level.id), choices = groups.flat();
        const expected = s.links.flatMap(k => (['from','to'] as const).filter(end => k[end].level === level.id).map(end => `${k.id}/${end}`));
        expect(choices.map(e => `${e.linkId}/${e.linkEnd}`).sort(), map.path).toEqual(expected.sort());
        expect(linkMarkerGroups(s, level.id)).toEqual(groups);
        total += choices.length; merged += choices.length - groups.length;
        const original = structuredClone(s);
        // Preserve the pre-correction 48-choice regression as well as the new landing.
        if (map.path === 'ch09/T') original.links.find(k => k.id === 'T-stair')!.to.pos = [253, 360];
        originalMerged += choices.length - linkMarkerGroups(original, level.id).length;
      }
    }
    expect(total).toBe(346); expect(originalMerged).toBe(48); expect(merged).toBe(49);
    expect(linkMarkerGroups(scene('ch09/T'), 'tower-upper').map(g => g.map(e => `${e.linkId}/${e.linkEnd}`)))
      .toEqual([['T-stair/to', 'T-ladder/from']]);
  });

  it('preserves separate endpoint identity for a same-level link', () => {
    const s = scene('appB/death-house');
    s.links = [{ id:'same', kind:'stairs', from:{level:'f1',pos:[10,10]}, to:{level:'f1',pos:[15,10]} }];
    expect(linkMarkerGroups(s,'f1')).toEqual([[
      {linkId:'same',linkEnd:'from',level:'f1',pos:[10,10],otherLevel:'f1',kind:'stairs'},
      {linkId:'same',linkEnd:'to',level:'f1',pos:[15,10],otherLevel:'f1',kind:'stairs'},
    ]]);
    expect(linkMarkerGroups(s,'absent')).toEqual([]);
  });

  it('uses first-anchor greedy clusters, retaining the strict twelve-foot boundary', () => {
    const s = scene('appB/death-house');
    s.links = [0,11,12,22].map((x,i) => ({id:`k${i}`,kind:'stairs',from:{level:'f1',pos:[x,100]},to:{level:'f2',pos:[x,100]}}));
    expect(linkMarkerGroups(s,'f1').map(g=>g.map(e=>e.linkId))).toEqual([['k0','k1'],['k2','k3']]);
  });

  it('gates concealed hatches per endpoint, including ladder, slide and hook-operated hatches', () => {
    const cases = [
      ['ch05/N2','lk-n2-attic-o','from','upper-N2o-trap'],
      ['ch05/N2','lk-n2-attic-p','from','upper-N2p-trap'],
      ['ch05/N3','lk-n3-attic','from','upper-N3o-trap'],
      ['ch05/N3','lk-n3-attic','to','attic-N3r-trap'],
      ['appB/death-house','lk-trapdoor','from','dungeon-trapdoor32'],
      ['appB/death-house','lk-trapdoor','to','f1-trapdoor'],
      ['ch04/K','lk-k82','from','dungeon-trap-k81'],
      ['ch04/K','lk-k51','from','spires-hook-k51'],
      ['ch04/K','lk-k51','to','south-tower-trap-k51-top'],
    ];
    for (const [path,id,end,object] of cases) expect(endpoints(scene(path)).find(e=>e.linkId===id && e.linkEnd===end)?.hiddenObjectId,`${path}/${id}/${end}`).toBe(object);
    expect(endpoints(scene('ch05/N2')).find(e=>e.linkId==='lk-n2-attic-o' && e.linkEnd==='to')?.hiddenObjectId).toBeUndefined();
  });

  it('does not infer hatch secrecy from a sack, pressure plate or nearby hidden object', () => {
    expect(endpoints(scene('ch02/L')).find(e=>e.linkId==='L-dive')?.hiddenObjectId).toBeUndefined();
    expect(endpoints(scene('ch04/K')).find(e=>e.linkId==='lk-elevator')?.hiddenObjectId).toBeUndefined();
    const s=scene('ch05/N2'), k=s.links.find(k=>k.id==='lk-n2-attic-o')!;
    k.from.pos=[k.from.pos[0]+0.1,k.from.pos[1]];
    expect(endpoints(s).find(e=>e.linkId===k.id && e.linkEnd==='from')?.hiddenObjectId).toBeUndefined();
  });

  it('preserves an authored reveal gate when the operating object is off the arrival point', () => {
    const s=scene('ch05/N2'), k=s.links.find(k=>k.id==='lk-n2-attic-o')!;
    k.from.pos=[k.from.pos[0]+4,k.from.pos[1]];
    Object.assign(k.from, {hiddenObjectId:'upper-N2o-trap'});
    expect(validateScene(s)).toEqual([]);
    expect(endpoints(s).find(e=>e.linkId===k.id && e.linkEnd==='from')?.hiddenObjectId).toBe('upper-N2o-trap');
    expect(endpoints(s).find(e=>e.linkId===k.id && e.linkEnd==='to')?.hiddenObjectId).toBeUndefined();
  });

  it.each(['absent-object', 'attic-N2q-hole', 'upper-N2o-trap', '', null])('rejects invalid authored gate %s before exposing any marker', id => {
    const s=scene('ch05/N2'), k=s.links.find(k=>k.id==='lk-n2-attic-o')!;
    if(id==='upper-N2o-trap') s.levels.find(l=>l.id===k.from.level)!.objects.find(o=>o.id===id)!.vis='player';
    Object.assign(k.from, {hiddenObjectId:id});
    expect(validateScene(s)).toContain(`link ${k.id}/from reveal gate must reference a hidden object on its level`);
    expect(()=>endpoints(s)).toThrow(`link ${k.id}/from reveal gate must reference a hidden object on its level`);
  });
});
