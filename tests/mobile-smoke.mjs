// Optional local browser verification: PLAYWRIGHT_MODULE points to an installed Playwright module.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = await readFile(new URL('../site/index.html', import.meta.url), 'utf8');
const original = JSON.parse(await readFile(new URL('../site/latest.json', import.meta.url), 'utf8'));
let snapshot = structuredClone(original), fail = false, aiFail = false;
const aiPayload = { report: { date: original.items.find(x => x.category === 'AI').reportDate, generatedAt: original.items.find(x => x.category === 'AI').publishedAt, sections: original.topics.AI.map(label => ({ label, items: original.items.filter(x => x.topic === label).map(x => ({ title: x.title, summary: x.summary, source: { name: x.source }, links: { original: x.url } })) })) } };
const server = createServer((request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/New_York' });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/latest.json?*', route => fail ? route.abort() : route.fulfill({ json: snapshot }));
  await page.route('https://aihot.virxact.com/**', route => fail || aiFail ? route.abort() : route.fulfill({ json: aiPayload }));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => !document.getElementById('refresh').disabled);
  assert.equal(await page.locator('.news-card').count(), original.items.filter(x=>x.category==='时事').length);
  assert.equal(await page.locator('h1').innerText(),'肖瑶的每日阅读');
  assert.equal(await page.locator('[data-category="速览"]').count(),0);
  assert.equal(await page.getByText('手机试读版',{exact:true}).count(),0);
  const artifactDir = new URL('../../outputs/daily-brief-preview/', import.meta.url);
  await mkdir(artifactDir, { recursive: true });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width > 800 ? 1000 : 844 });
    for (const category of Object.keys(original.topics)) {
      await page.locator(`#tabs [data-category="${category}"]`).click();
      for (const topic of original.topics[category]) {
        await page.locator(`#subnav [data-topic="${topic}"]`).click();
        const expected = original.items.filter(x => x.category === category && x.topic === topic).length;
        assert.equal(await page.locator('.news-card').count(), expected, category + topic);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow ${width} ${topic}`);
        if (expected) assert.ok((await page.locator('.card-kicker').allTextContents()).every(x => x.includes(topic)));
        else assert.ok(await page.locator('.empty').isVisible());
      }
    }
    await page.locator('#tabs [data-category="英语学习"]').click();
    assert.equal(await page.locator('.dialogue-line').count(),6);
    assert.equal(await page.locator('.translation:visible').count(),6);
    assert.equal(await page.locator('.word-entry').count(),3);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`English overflow ${width}`);
    await page.locator('[data-toggle-chinese]').click();
    assert.equal(await page.locator('.translation:visible').count(),0);
    await page.locator('[data-toggle-chinese]').click();
    const lessonTitle=await page.locator('#lesson-title').innerText();
    await page.locator('[data-lesson-previous]').click();
    assert.notEqual(await page.locator('#lesson-title').innerText(),lessonTitle);
    await page.locator('[data-lesson-today]').click();
    assert.equal(await page.locator('#lesson-title').innerText(),lessonTitle);
    if (width === 390 || width === 1440) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: fileURLToPath(new URL(`english-${width}.png`, artifactDir)), fullPage: width === 390 });
    }
    await page.locator('#tabs [data-category="时事"]').click();
    if(width===390) await page.screenshot({path:fileURLToPath(new URL('current-affairs.png',artifactDir)),fullPage:true});
  }
  assert.ok(await page.locator('.original').evaluateAll(links => links.every(x => x.target === '_blank' && x.rel.includes('noopener') && x.rel.includes('noreferrer'))));
  const text = await page.locator('body').innerText();
  assert.ok(!/\d{4}-\d\d-\d\dT\d\d:\d\d/.test(text), 'visible times must be human Beijing time');
  await page.locator('#tabs [data-category="金融"]').click();
  assert.equal(await page.locator('.opinion').count(), original.items.filter(x => x.category === '金融' && x.kind === '观点').length);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#subnav [data-topic="宏观财经"]').click();
  assert.ok(await page.locator('#subnav [data-topic="宏观财经"]').isVisible());
  assert.ok((await page.locator('.source-chip').allTextContents()).some(x => x.includes('东方财富')));
  await page.screenshot({ path: fileURLToPath(new URL('finance-macro.png', artifactDir)), fullPage: true });
  await page.locator('#tabs [data-category="体育"]').click();
  const count = await page.locator('.news-card').count();
  fail = true;
  await page.locator('#refresh').click(); await page.waitForFunction(() => !document.getElementById('refresh').disabled);
  assert.equal(await page.locator('.news-card').count(), count);
  assert.match(await page.locator('#status').innerText(), /失败/);
  fail = false;
  snapshot.items.find(x=>x.topic==='NBA').title = 'NBA 测试更新条目'; snapshot.collectedAt = new Date().toISOString();
  await page.locator('#refresh').click(); await page.waitForFunction(() => !document.getElementById('refresh').disabled);
  assert.ok(await page.getByRole('heading', { name: 'NBA 测试更新条目' }).isVisible());
  assert.match(await page.locator('#status').innerText(), /内容已更新/);
  // An older deployment must not replace the newer downloaded snapshot.
  snapshot = structuredClone(original); aiFail = true;
  await page.locator('#refresh').click(); await page.waitForFunction(() => !document.getElementById('refresh').disabled);
  assert.ok(await page.getByRole('heading', { name: 'NBA 测试更新条目' }).isVisible());
  assert.deepEqual(errors, []);
  // A page left open over Beijing midnight switches lessons without a news deployment.
  const daily=await context.newPage();
  await daily.clock.install({time:new Date('2026-09-20T15:59:30Z')});
  await daily.route('**/latest.json?*',route=>route.fulfill({json:original}));
  await daily.route('https://aihot.virxact.com/**',route=>route.fulfill({json:aiPayload}));
  await daily.goto(`http://127.0.0.1:${server.address().port}/`);
  await daily.locator('#tabs [data-category="英语学习"]').click();
  assert.equal(await daily.locator('#lesson-title').innerText(),'酒店办理入住');
  await daily.clock.fastForward(61000);
  assert.equal(await daily.locator('#lesson-title').innerText(),'机场办理值机');
  await daily.close();
  console.log('Browser verification passed: 4 widths, all topic filters, safe original links, Beijing times, failed refresh preservation, new snapshot update and regression protection.');
  await context.close();
} finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
