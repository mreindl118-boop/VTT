import { expect, test } from '@playwright/test';
import { boot, quiet, SCENES } from './helpers';

test.setTimeout(120_000);

test('the Party panel\'s Transform button switches a standing character\'s miniature to its transformed look and back', async ({ page }) => {
  await quiet(page);
  // a stand-in party (not a table's): one character whose miniature has a transformed look (wings), one without
  const { scene, level, spawn } = SCENES[0];
  const pack = { schema: 1, kind: 'party', characters: [
    { id: 'e2e-a', name: 'Aster', color: '#6b3fa0', figure: { frame: 'feminine', transform: { wings: { color: '#ffffff', count: 2 } } } },
    { id: 'e2e-b', name: 'Bram', color: '#aeb4bf', figure: { frame: 'masculine' } },
  ], placement: { scene, level, at: { 'e2e-a': [spawn[0] + 5, spawn[1]], 'e2e-b': [spawn[0] + 10, spawn[1]] } } };
  await page.addInitScript((text) => localStorage.setItem('mistlab.partyPack', text), JSON.stringify(pack));
  await boot(page);
  const openParty = async () => { await page.locator('[data-act="encounter"]').click(); await page.locator('.sheet.encounter [data-a="party"]').click(); };
  await openParty();
  // before the party stands on the map there is nobody to transform
  await expect(page.locator('.pp-card')).toHaveCount(2);
  await expect(page.locator('.pp-card [data-a="transform"]')).toHaveCount(0);
  await page.locator('.party-packs [data-a="apply"]').click();
  await expect(page.locator('.party-packs')).toHaveCount(0);
  await page.locator('.sheet.encounter .close').click();
  await openParty();
  const aster = page.locator('.pp-card', { hasText: 'Aster' }), bram = page.locator('.pp-card', { hasText: 'Bram' });
  const btn = aster.locator('[data-a="transform"]');
  await expect(bram.locator('[data-a="down"]')).toHaveText('Down');
  await expect(bram.locator('[data-a="transform"]')).toHaveCount(0);
  await expect(btn).toHaveText('Transform');
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  const seen = () => page.evaluate(() => {
    const a = (window as any).__mistlab.app, t = a.state.tokens.find((x: any) => x.sheetId === 'e2e-a'), fig = a.cur.tokens.get(t.id).userData.fig.fig;
    let meshes = 0; fig.traverse((o: any) => { if (o.isMesh) meshes++; });
    return { transformed: t.transformed, meshes, down: t.down };
  });
  const off = await seen();
  expect(off.transformed).toBeUndefined();
  await btn.click();
  await expect(btn).toHaveText('Change back');
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  const on = await seen();
  expect(on.transformed).toBe(true);
  expect(on.meshes).toBeGreaterThan(off.meshes);
  // the switch is the token's own, beside Down: going down leaves it on
  await aster.locator('[data-a="down"]').click();
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await aster.locator('[data-a="down"]').click();
  await btn.click();
  await expect(btn).toHaveText('Transform');
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  const back = await seen();
  expect(back.transformed).toBeUndefined();
  expect(back.meshes).toBe(off.meshes);
});
