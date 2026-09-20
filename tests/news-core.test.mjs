import test from 'node:test';
import assert from 'node:assert/strict';
import { sportTopic, financeTopic, safeUrl, shorten, selectItems, recent, mergeSource, parseRss, clean } from '../scripts/news-core.mjs';
const now = Date.parse('2026-09-20T12:00:00+08:00');
const item = { category: '体育', topic: 'NBA', title: '勇士签下新后卫', summary: '球队公布新合同。', source: '测试来源', sourceId: 'test', url: 'https://example.com/one', publishedAt: '2026-09-20T10:00:00+08:00' };
test('sports filters reject betting and lookalike names outside requested leagues', () => {
  for (const title of ['格拉斯哥流浪者1-0凯尔特人', '库里蒂巴迎来胜利', '彩经前瞻：AC米兰至少赢两球', '四大AI预测AC米兰vs莱切', '转战意甲：前掘金后卫加盟']) assert.equal(sportTopic(title), null);
  for (const [title, topic] of [['NBA训练营开幕', 'NBA'], ['曼城英超获胜', '英超'], ['西甲赛程', '西甲'], ['拜仁德甲获胜', '德甲'], ['意甲赛程', '意甲'], ['法甲赛程', '法甲'], ['郑钦文晋级', '网球']]) assert.equal(sportTopic(title), topic);
});
test('finance filtering distinguishes A shares, private financing, Hong Kong and domestic futures', () => {
  assert.equal(financeTopic({ title: '公司完成数亿元B+++轮融资' }, 'A股'), null);
  assert.equal(financeTopic({ title: '港股公司净利润增长' }, 'A股'), null);
  assert.equal(financeTopic({ title: 'A股公司公布增持计划' }, 'A股'), 'A股');
  assert.equal(financeTopic({ title: '股民索赔条件公布 A股' }, 'A股'), null);
  assert.equal(financeTopic({ title: '国内PTA期货市场周报' }, '中国期货'), '中国期货');
  assert.equal(financeTopic({ title: '美国电影票房增长' }, '美股'), null);
  assert.equal(financeTopic({ title: '纳斯达克指数调整' }, '美股'), '美股');
});
test('failed source preserves successful data and timestamp, successful empty feed clears stale data', () => {
  const previous = { lastSuccess: '2026-09-19T08:00:00Z', items: [item] };
  const failed = mergeSource(previous, { id: 'test', status: 'rejected' }, '2026-09-20T08:00:00Z');
  assert.deepEqual(failed.items, [item]); assert.equal(failed.lastSuccess, previous.lastSuccess); assert.equal(failed.status, 'error');
  assert.deepEqual(mergeSource(previous, { id: 'test', status: 'fulfilled', value: [] }).items, []);
});
test('stale and future news are not relabeled as fresh, dedup retains continuous global numbers', () => {
  assert.equal(recent({ publishedAt: '2026-09-10T08:00:00Z' }, now), false);
  assert.equal(recent({ publishedAt: '2026-09-25T08:00:00Z' }, now), false);
  const rows = selectItems([item, { ...item, url: item.url + '?tracking=1' }, { ...item, title: '网球赛事', topic: '网球', url: 'https://example.com/two' }, { ...item, title: '旧报道', url: 'https://example.com/old', publishedAt: '2026-08-01T08:00:00Z' }], now);
  assert.equal(rows.length, 2); assert.deepEqual(rows.map(x => x.number), [1, 2]);
});
test('source markup and unsafe URLs do not become executable, summary length uses Unicode characters', () => {
  assert.equal(safeUrl('javascript:alert(1)'), ''); assert.equal(safeUrl('https://user:pass@example.com'), '');
  assert.equal(safeUrl('https://example.com/a'), 'https://example.com/a');
  assert.equal(Array.from(shorten('新闻🙂'.repeat(70))).length, 60);
  assert.equal(clean('新华网&amp;#8195;消息'), '新华网 消息');
  const rows = parseRss('<rss><channel><item><title><![CDATA[标题 &amp; 新闻]]></title><link>https://example.com</link><description><![CDATA[<b>摘要</b>]]></description><pubDate>Sun, 20 Sep 2026 10:00:00 +0800</pubDate></item></channel></rss>');
  assert.equal(rows[0].title, '标题 & 新闻'); assert.equal(rows[0].summary, '摘要');
  assert.throws(() => parseRss('<html>Access denied</html>'));
});
