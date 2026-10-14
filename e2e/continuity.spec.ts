import { expect, test, type Page } from '@playwright/test';
import { quiet } from './helpers';

test('lower outdoor ledges keep the valley while true interiors use the underground cutaway',async({page})=>{
  for(const path of ['ch02/H','ch02/J','ch02/P']){
    await open(page,path);
    const levels=await page.evaluate(()=>{const a=(window as any).__mistlab.app;return a.cur.scene.levels.filter((l:any)=>(l.ambient??a.cur.scene.ambient)==='barovian-overcast').map((l:any)=>l.id);});
    expect(levels.length).toBeGreaterThan(0);
    for(const id of levels){
      const state=await page.evaluate(id=>{const a=(window as any).__mistlab.app;a.setLevel(id);return {under:a.underground,stage:a.stage.root.layers.isEnabled(0)};},id);
      expect(state,`${path}/${id}`).toEqual({under:false,stage:true});
    }
  }
});

async function open(page:Page,path:string) {
  await quiet(page); await page.goto(`/?nosw&scene=${path}`);
  await page.evaluate(()=>(window as any).__mistlab.ready);
  await page.waitForFunction(()=>!(window as any).__mistlab.app.world.flying);
}
for (const device of [{name:'desktop',touch:false,width:1366,height:768},{name:'phone',touch:true,width:390,height:844}]) test.describe(device.name,()=>{
  test.use({viewport:{width:device.width,height:device.height},hasTouch:device.touch,isMobile:device.touch});
  test('bridge and poolside camp keep their terrain through movement and zoom in both views',async({page},info)=>{
    test.setTimeout(240_000);
    for(const path of ['ch09/T','ch02/G']) {
      await open(page,path);
      for(const view of ['dm','players']) {
        const check=await page.evaluate(({path,view})=>{
          const m=(window as any).__mistlab,a=m.app,f=a.stage.land.field;
          const start=path==='ch09/T'?[155,145]:[90,70],end=path==='ch09/T'?[155,150]:[95,70];
          m.moveParty(a.levelId,...start);a.setView(view);
          const moved=a.moveTokenTo(a.party.id,end);
          const e=m.atlas.scenes[path],p=m.frames.toWorld3(e.placement,path==='ch09/T'?[155,0,170]:[100,0,15]);
          const site=f.sites.find((s:any)=>s.path===path);
          return {moved,position:[...a.party.pos],expected:end,clearance:site.base-f.surface(p[0],p[2]),northWater:f.lakeAt(p[0],p[2])>=0};
        },{path,view});
        expect(check.moved).toBe(true); expect(check.position).toEqual(check.expected);
        if(path==='ch09/T') expect(check.clearance).toBeGreaterThan(450);
        else expect(check.northWater).toBe(true);
        // Moving the party starts its own follow flight; measure zoom from the settled view.
        await page.waitForFunction(()=>!(window as any).__mistlab.app.world.flying);
        await page.screenshot({path:info.outputPath(`${path.replace('/','-')}-${view}-near.png`)});
        const before=await page.evaluate(()=>{const w=(window as any).__mistlab.app.world;return w.camera.position.distanceTo(w.controls.target);});
        if(device.touch) for(let k=0;k<5;k++) await page.locator('[data-cam="zoomOut"]').tap();
        else {await page.mouse.move(device.width/2,device.height/2);for(let k=0;k<5;k++)await page.mouse.wheel(0,400);}
        await page.waitForTimeout(700);
        const far=await page.evaluate(()=>{const w=(window as any).__mistlab.app.world;return w.camera.position.distanceTo(w.controls.target);});
        expect(far).toBeGreaterThan(before*1.5);
        await page.screenshot({path:info.outputPath(`${path.replace('/','-')}-${view}-far.png`)});
        if(device.touch) for(let k=0;k<5;k++)await page.locator('[data-cam="zoomIn"]').tap();
        else for(let k=0;k<5;k++)await page.mouse.wheel(0,-400);
        await page.waitForTimeout(700);
        const back=await page.evaluate(()=>{const w=(window as any).__mistlab.app.world;return w.camera.position.distanceTo(w.controls.target);});
        expect(back).toBeLessThan(far*.8);
      }
    }
  });
  test('Amber interior cutaway restores the exposed facade and the valley on exit',async({page},info)=>{
    test.setTimeout(120_000); await open(page,'ch13/X');
    for(const view of ['dm','players']) for(const level of ['upper','lower','facade']) {
      const state=await page.evaluate(({view,level})=>{const a=(window as any).__mistlab.app;a.setView(view);a.setLevel(level,true);return {under:a.underground,stage:a.stage.root.layers.isEnabled(0),map:a.cur.root.layers.isEnabled(0)};},{view,level});
      expect(state).toEqual({under:level!=='facade',stage:level==='facade',map:true});
      await page.screenshot({path:info.outputPath(`X-${view}-${level}.png`)});
    }
  });
});

test('nested Gates hides the distant castle substitute through view changes',async({page})=>{
  await open(page,'ch02/J');
  for(const view of ['dm','players','dm']) {
    const state=await page.evaluate(view=>{const a=(window as any).__mistlab.app;a.setView(view);a.setT(.8);a.setT(1);const found:any[]=[];a.cur.root.traverse((o:any)=>{if(o.userData.worldStandin)found.push({hidden:!o.layers.isEnabled(0),parts:o.children.length});});return found;},view);
    expect(state.length).toBeGreaterThan(0); expect(state.every(s=>s.hidden)).toBe(true);
  }
});
