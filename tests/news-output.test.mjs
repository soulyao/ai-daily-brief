import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { TOPICS, safeUrl } from '../scripts/news-core.mjs';
test('published snapshot and standalone homepage agree and contain safe, sourced, globally numbered news', async () => {
  const html = await readFile(new URL('../site/index.html', import.meta.url), 'utf8');
  const data = JSON.parse(await readFile(new URL('../site/latest.json', import.meta.url), 'utf8'));
  const embedded = JSON.parse(html.match(/<script type="application\/json" id="initial-data">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(embedded, data); assert.ok(data.items.length);
  assert.deepEqual(data.items.map(x => x.number), data.items.map((_, i) => i + 1));
  for (const item of data.items) { assert.ok(TOPICS[item.category].includes(item.topic)); assert.ok(safeUrl(item.url)); assert.ok(item.source); assert.ok(Array.from(item.summary).length <= 60); }
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+rel=["']stylesheet/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /<h1>肖瑶的每日阅读<\/h1>/);
  assert.doesNotMatch(html, /你的每日简报|手机试读版|速览/);
  assert.match(html, /data-category="英语学习"/);
  [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(s => new Script(s[1]));
});
