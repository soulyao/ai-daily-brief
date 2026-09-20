import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { TOPICS, clean, normalize, selectItems, mergeSource, parseRss, sportTopic, financeTopic, recent } from './news-core.mjs';
import { buildHomepage } from './news-page.mjs';
import { collectEastmoney, futuresFeedUrl } from './eastmoney.mjs';

const site = new URL('../site/', import.meta.url);
const collectedAt = new Date().toISOString();
async function request(url, json = false) {
  let error;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(18000), headers: { 'User-Agent': 'aihot-skill/1.3.0 (+https://aihot.virxact.com/aihot-skill/)' }, cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return json ? await response.json() : await response.text();
    } catch (e) { error = e; }
  }
  throw error;
}

async function sports() {
  const html = await request('https://sports.163.com/');
  if (!html.includes('channel_news_item')) throw new Error('Sports list schema changed');
  const rows = [...html.matchAll(/<li class="channel_news_item[\s\S]*?<\/li>/g)].map(m => {
    const text = m[0], title = clean(text.match(/<h3[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/)?.[1]);
    return {
      title, url: text.match(/<h3[\s\S]*?href="([^"]+)/)?.[1],
      source: clean(text.match(/channel_news_source">([^<]+)/)?.[1]),
      publishedAt: (text.match(/channel_news_time">([^<]+)/)?.[1] || '').replace(' ', 'T') + '+08:00',
      category: '体育', topic: sportTopic(title), sourceId: 'sports',
    };
  }).filter(x => x.topic && recent(x) && /懂球帝|直播吧|北京青年报|澎湃|新华社|央视|网球之家|新京报|中国新闻网|人民网|红星新闻/.test(x.source));
  const chosen = selectItems(rows);
  return Promise.all(chosen.map(async item => {
    // The list can resurface older stories; use the article's actual publication time.
    try {
      const article = await request(item.url);
      const time = article.match(/property="article:published_time" content="([^"]+)"/)?.[1];
      if (!time) return null;
      const body = article.split(/<div class="post_body">/)[1]?.split(/<div class="post_(?:statement|recommend)|<!--相关新闻/)[0] || '';
      const paragraphs = [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map(m => clean(m[1])).filter(x => x.length > 15 && !/网易|举报|责任编辑|特别声明|点击|广告/.test(x));
      return { ...item, publishedAt: time, summary: paragraphs[0] || '', source: item.source + ' · 网易体育' };
    } catch { return null; }
  })).then(items => {
    const valid = items.filter(Boolean);
    if (chosen.length && !valid.length) throw new Error('Sports article details unavailable');
    return valid;
  });
}
async function finance(lid, preferred, page = 1) {
  const payload = await request(`https://feed.mix.sina.com.cn/api/roll/get?pageid=${lid === 2516 ? 153 : 384}&lid=${lid}&num=50&page=${page}`, true);
  if (!Array.isArray(payload.result?.data) || payload.result.status?.code !== 0) throw new Error('Invalid finance response');
  return payload.result.data.map(x => {
    const topic = financeTopic(x, preferred);
    return { title: x.title, url: x.url, summary: x.intro || x.summary, source: (x.media_name && x.media_name !== '新浪财经' ? x.media_name + ' · ' : '') + '新浪财经', publishedAt: new Date(Number(x.ctime) * 1000).toISOString(), category: '金融', topic };
  }).filter(x => x.topic && (!preferred || x.topic === preferred));
}
async function politics(country, feed) {
  const rows = parseRss(await request(feed));
  return rows.filter(x => {
    const title = x.title;
    if (country === '美国') return /美国|美方|白宫|特朗普|美国会|美联邦/.test(title);
    return /习近平|李强|国务院|外交部|人大|政协|中共|中央|政策|立法|条例|办法|中美|中俄|中方|副总理|部长|十五五|政府/.test(title);
  }).map(x => ({ ...x, category: '政治', topic: country, source: '中国新闻网' }));
}
async function ai() {
  let data;
  try { data = await request('https://aihot.virxact.com/api/v1/dailies/latest', true); }
  catch {
    const list = await request('https://aihot.virxact.com/api/v1/dailies?limit=7', true);
    const date = (list.items || list.reports || list.dailies || [])[0]?.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('AI daily unavailable');
    data = await request('https://aihot.virxact.com/api/v1/dailies/' + date, true);
  }
  const report = data.report;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(report?.date || '') || !Array.isArray(report.sections)) throw new Error('Invalid AI report');
  return report.sections.flatMap(section => (section.items || []).map(item => ({
    category: 'AI', topic: section.label, title: item.title, summary: item.summary,
    source: typeof item.source === 'string' ? item.source : item.source?.name || 'AI HOT',
    url: item.links?.original || item.url || item.link || item.links?.aihot, publishedAt: report.generatedAt || report.date + 'T08:00:00+08:00', reportDate: report.date,
    timeLabel: '日报生成',
  })));
}

const eastmoneyCache = new Map();
const eastmoneyFuturesIndex = futuresFeedUrl(Date.parse(collectedAt));
const eastmoneyRequest = url => {
  if (!eastmoneyCache.has(url)) eastmoneyCache.set(url, request(url));
  return eastmoneyCache.get(url);
};
const sources = [
  { id: 'sports', name: '网易体育（署名媒体）', url: 'https://sports.163.com/', run: sports },
  ...[
    ['us-stock', '美股', 'https://stock.eastmoney.com/america.html'],
    ['cn-stock', 'A股', 'https://stock.eastmoney.com/'],
    ['futures', '中国期货', 'https://futures.eastmoney.com/'],
    ['macro', '宏观财经', 'https://finance.eastmoney.com/'],
  ].map(([id, topic, url]) => ({ id: 'eastmoney-' + id, name: '东方财富 · ' + topic, url, run: () => collectEastmoney(eastmoneyRequest, topic === 'A股' ? ['https://finance.eastmoney.com/', url] : topic === '宏观财经' ? [url, eastmoneyFuturesIndex] : topic === '中国期货' ? eastmoneyFuturesIndex : url, topic) })),
  { id: 'us-stock', name: '新浪财经 · 美股', url: 'https://finance.sina.com.cn/stock/usstock/', run: () => finance(2672, '美股') },
  { id: 'cn-stock', name: '新浪财经 · A股', url: 'https://finance.sina.com.cn/stock/', run: () => finance(2671, 'A股') },
  ...[1, 2, 3].map(page => ({ id: 'futures-' + page, name: '新浪财经 · 期货订阅 ' + page, url: 'https://finance.sina.com.cn/', run: () => finance(2516, '中国期货', page) })),
  { id: 'us-politics', name: '中新网 · 国际', url: 'https://www.chinanews.com.cn/rss/world.xml', run() { return politics('美国', this.url); } },
  { id: 'cn-politics', name: '中新网 · 国内', url: 'https://www.chinanews.com.cn/rss/china.xml', run() { return politics('中国', this.url); } },
  { id: 'aihot', name: 'AI HOT', url: 'https://aihot.news/', run: ai },
];
let previous = {};
try { previous = JSON.parse(await readFile(new URL('latest.json', site), 'utf8')); } catch {}
const results = await Promise.allSettled(sources.map(source => source.run()));
const merged = sources.map((source, i) => {
  const result = results[i];
  if (result.status === 'rejected') console.warn(source.id + ': ' + result.reason.message);
  const value = result.status === 'fulfilled' ? result.value.map(x => x && normalize(x, source.id)).filter(Boolean) : [];
  return mergeSource(previous.sources?.find(s => s.id === source.id), { ...source, ...result, value }, collectedAt);
});
if (merged.every(x => x.status === 'error')) throw new Error('All sources failed; preserving published files');
const snapshot = { schemaVersion: 1, collectedAt, topics: TOPICS, sources: merged, items: selectItems(merged.flatMap(x => x.items)) };
await mkdir(site, { recursive: true });
await writeFile(new URL('latest.json', site), JSON.stringify(snapshot, null, 2));
await writeFile(new URL('index.html', site), buildHomepage(snapshot));
console.log(JSON.stringify({ collectedAt, total: snapshot.items.length, counts: Object.fromEntries(Object.entries(TOPICS).map(([k, v]) => [k, Object.fromEntries(v.map(t => [t, snapshot.items.filter(x => x.category === k && x.topic === t).length]))])), sources: merged.map(s => ({ id: s.id, status: s.status })) }, null, 2));
