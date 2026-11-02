import {test,expect} from '@playwright/test';
import {mockMap} from './map-fixture.js';
test.beforeEach(async({page})=>{await mockMap(page);});
test('discover, save, reorder, persist, and export a day plan',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('#map canvas')).toBeVisible();
 await expect(page.locator('.place-card')).toHaveCount(8);
 await page.locator('#search').fill('temple');await expect(page.locator('.place-card')).toHaveCount(1);
 await page.locator('[data-open="manakula"]').click();await expect(page.locator('.detail h2')).toHaveText('Manakula Vinayagar Temple');
 await page.locator('#detail-save').click();await expect(page.locator('#count')).toHaveText('1');
 await page.locator('#search').fill('');await page.locator('[data-save="promenade"]').click();
 await page.locator('[data-tab="trip"]').click();await expect(page.locator('.place-card')).toHaveCount(2);
 await page.locator('[data-move="promenade"][data-dir="-1"]').click();await expect(page.locator('.place-card h3').first()).toHaveText('Promenade Beach');
 await page.reload();await expect(page.locator('#count')).toHaveText('2');await page.locator('[data-tab="trip"]').click();
 const download=page.waitForEvent('download');await page.locator('#export').click();expect((await download).suggestedFilename()).toBe('my-pondy-day.txt');
 await page.locator('#about').click();await expect(page.locator('dialog')).toBeVisible();await page.keyboard.press('Escape');
 await page.screenshot({path:'/tmp/pondy-desktop.png'});expect(errors).toEqual([]);
});
test('mobile categories and map controls work without horizontal overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.locator('[data-category="Outdoors"]').click();await expect(page.locator('.place-card')).toHaveCount(3);
 await page.locator('#dimension').click();await expect(page.locator('#dimension')).toHaveText('3D');await page.locator('#reset').click();await expect(page.locator('#dimension')).toHaveText('2D');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'/tmp/pondy-mobile.png',fullPage:true});
});
test('neighborhood close-up supports geographic movement and returns to map view',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await expect(page.locator('.map-data-status')).toBeHidden();await page.locator('#walk').click();await expect(page.locator('#walk')).toHaveAttribute('aria-pressed','true');await expect(page.locator('.walk-ui')).toBeVisible();
 await page.screenshot({path:'/tmp/pondy-street.png'});
 const before=await page.locator('#map canvas').screenshot();await page.keyboard.down('w');await page.waitForTimeout(800);await page.keyboard.up('w');const after=await page.locator('#map canvas').screenshot();expect(before.equals(after)).toBe(false);
 await page.locator('#walk').click();await expect(page.locator('.walk-ui')).toBeHidden();await expect(page.locator('#walk')).toHaveAttribute('aria-pressed','false');expect(errors).toEqual([]);
});

test('geographic map renders buildings, preserves attribution, and reports provider failure',async({page})=>{
 const errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/');await expect(page.locator('.map-data-status')).toBeHidden();
 await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('OpenStreetMap');
 await expect(page.locator('.maplibregl-ctrl-scale')).toBeVisible();
 await expect(page.locator('.geo-pin')).toHaveCount(8);
 await page.locator('[data-category="Outdoors"]').click();await expect(page.locator('.geo-pin:visible')).toHaveCount(3);
 await page.locator('#dimension').click();await expect(page.locator('#dimension')).toHaveText('3D');
 expect(errors.filter(e=>!e.includes('fonts.googleapis'))).toEqual([]);
 await page.unroute('https://tiles.openfreemap.org/**');
 await page.route('https://tiles.openfreemap.org/**',route=>route.abort('failed'));
 await page.reload();await expect(page.locator('.map-data-status')).toContainText('could not load');
 await expect(page.getByRole('button',{name:'Retry map'})).toBeVisible();
 await page.locator('[data-save="promenade"]').click();await expect(page.locator('#count')).toHaveText('1');
});
