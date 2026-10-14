import { expect, test, type Page } from '@playwright/test';
import { quiet } from './helpers';

async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__mistlab?.ready);
  await page.evaluate(() => (window as any).__mistlab.ready);
}
async function boot(page: Page, scene='ch04/K', display=false) {
  await quiet(page); await page.goto(`/?nosw&scene=${scene}${display?'&display=player':''}`); await ready(page);
}
async function legacySave(page: Page) {
  return page.evaluate(async () => {
    const a=(window as any).__mistlab.app;
    a.state.tokens=[{...a.party,id:'castle-party',location:'K',level:'spires',pos:[190,263],role:'party'}];
    a.state.encounter={location:'K',level:'south-tower',partyPos:[190,256],round:3,order:[],turn:0,movedFt:15};
    a.state.seen={'K/spires':'c1:0x28536'}; a.state.reveals=[];
    delete a.state.mapRevisions;
    await a.flush(); return structuredClone(a.state);
  });
}
async function persisted(page: Page) {
  return page.evaluate(() => new Promise<any>((resolve,reject) => {
    const r=indexedDB.open('mistlab',1); r.onerror=()=>reject(r.error);
    r.onsuccess=()=>{const db=r.result,t=db.transaction('kv','readonly'),q=t.objectStore('kv').get('campaign:default');
      t.oncomplete=()=>{db.close();resolve(q.result);};t.onerror=()=>{db.close();reject(t.error);};};
  }));
}

test('legacy Castle state migrates before coverage and token construction, persists once and survives reload',async({page})=>{
  await boot(page); const old=await legacySave(page);
  await page.reload(); await ready(page);
  const current=await page.evaluate(()=>{
    const a=(window as any).__mistlab.app,c=a.cur.coverage.get('spires');
    return {revision:a.state.mapRevisions?.K,token:structuredClone(a.party),encounter:structuredClone(a.state.encounter),frame:[c.originX,c.originZ,c.width,c.height]};
  });
  expect(current.revision).toBe(1);
  expect(current.token).toEqual({...old.tokens[0],pos:[210,257.5]});
  expect(current.encounter).toEqual({...old.encounter,partyPos:[210,257.5]});
  expect(current.frame).toEqual([78,103,174,172]);
  await expect.poll(async()=> (await persisted(page))?.mapRevisions?.K).toBe(1);
  const first=await persisted(page); await page.reload(); await ready(page);
  expect(await page.evaluate(()=>structuredClone((window as any).__mistlab.app.state.tokens))).toEqual(first.tokens);
  expect((await persisted(page)).mapRevisions.K).toBe(1);
});

test('fresh and reset campaigns use the current map revision without remapping new coordinates',async({page})=>{
  await boot(page);
  expect(await page.evaluate(()=>(window as any).__mistlab.app.state.mapRevisions?.K)).toBe(1);
  await page.evaluate(async()=>{const a=(window as any).__mistlab.app;a.party.level='spires';a.party.pos=[190,260];await a.flush();});
  await page.reload();await ready(page);
  expect(await page.evaluate(()=>(window as any).__mistlab.app.party.pos)).toEqual([190,260]);
  await page.evaluate(()=>(window as any).__mistlab.app.resetCampaign());
  expect(await page.evaluate(()=>{const a=(window as any).__mistlab.app;return [a.state.id,a.state.mapRevisions?.K];})).toEqual(['cos',1]);
});

test('a failed campaign open never persists the staged migration or changes the committed campaign',async({page})=>{
  await boot(page);await legacySave(page);
  await page.evaluate(async()=>{const a=(window as any).__mistlab.app;await a.open('wsc/01-tavern');});
  const old=await persisted(page);
  const result=await page.evaluate(async()=>{
    const a=(window as any).__mistlab.app,before=JSON.stringify(a.state),load=a.load;
    a.load=async()=>{throw new Error('controlled scene failure after migration');};
    try{return {opened:await a.open('ch04/K'),same:JSON.stringify(a.state)===before,campaign:a.campaign.id};}
    finally{a.load=load;}
  });
  expect(result).toEqual({opened:false,same:true,campaign:'wsc'});
  expect(await persisted(page)).toEqual(old);
});

test('Player Display follows migrated DM state without writing or transforming its local legacy save',async({page})=>{
  await boot(page);const old=await legacySave(page);
  await page.addInitScript(()=>{
    (window as any).__puts=[];const put=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(value,key){(window as any).__puts.push(key);return put.call(this,value,key);};
  });
  await boot(page,'ch04/K',true);
  await page.evaluate(async()=>{
    const a=(window as any).__mistlab.app;a.channel.bc?.close();
    const state=structuredClone(a.state);state.mapRevisions={K:1};state.tokens[0].pos=[210,257.5];
    state.encounter.partyPos=[210,257.5];state.seen={};
    await a.onMsg({kind:'state',state,location:'ch04/K',level:'spires',nested:a.nested});
  });
  expect(await page.evaluate(()=>(window as any).__mistlab.app.party.pos)).toEqual([210,257.5]);
  expect(await page.evaluate(()=>(window as any).__puts)).toEqual([]);
  expect(await persisted(page)).toEqual(old);
});

test('an unavailable campaign save aborts navigation and cannot become an empty replacement',async({page})=>{
  await boot(page);await legacySave(page);
  await page.evaluate(async()=>{await (window as any).__mistlab.app.open('wsc/01-tavern');});
  const old=await persisted(page);
  const result=await page.evaluate(async()=>{
    const a=(window as any).__mistlab.app,before=JSON.stringify(a.state),get=IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get=function(key){if(key==='campaign:default')throw new Error('controlled storage read failure');return get.call(this,key);};
    try{return {opened:await a.open('ch04/K'),same:JSON.stringify(a.state)===before,campaign:a.campaign.id};}
    finally{IDBObjectStore.prototype.get=get;}
  });
  expect(result).toEqual({opened:false,same:true,campaign:'wsc'});
  await page.evaluate(async()=>{await (window as any).__mistlab.app.open('wsc/02-street');});
  expect(await persisted(page)).toEqual(old);
});
