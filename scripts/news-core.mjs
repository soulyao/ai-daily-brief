export const TOPICS = {
  时事: ['百度热搜'],
  体育: ['NBA', '英超', '西甲', '德甲', '意甲', '法甲', '网球'],
  金融: ['美股', 'A股', '中国期货', '宏观财经'],
  政治: ['美国', '中国'],
  AI: ['模型发布/更新', '产品发布/更新', '行业动态', '论文研究', '技巧与观点'],
};

export function clean(value = '') {
  return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, '')
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:x[\da-f]+|\d+);/gi, entity => {
      const named = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' };
      if (named[entity]) return named[entity];
      const n = entity[2].toLowerCase() === 'x' ? parseInt(entity.slice(3), 16) : parseInt(entity.slice(2), 10);
      return Number.isFinite(n) && n <= 0x10ffff ? String.fromCodePoint(n) : '';
    }).replace(/&?#(\d{2,6});/g, (_, n) => Number(n) <= 0x10ffff ? String.fromCodePoint(Number(n)) : '').replace(/\s+/g, ' ').trim();
}
export const shorten = (s, max = 60) => { const a = Array.from(clean(s)); return a.length > max ? a.slice(0, max - 1).join('') + '…' : a.join(''); };
export function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
export const dateKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
export function recent(item, now = Date.now(), days = 3) {
  const time = Date.parse(item.publishedAt);
  return Number.isFinite(time) && time <= now + 5 * 60000 && time >= now - days * 86400000;
}
const excluded = /竞彩|足彩|彩票|彩经|投注|赔率|半全场|角球统计|AI预测|索赔征集|索赔登记|维权征集|预登记|免费荐股|加群|卧槽|稳赚|带单/;
export function sportTopic(title) {
  if (excluded.test(title)) return null;
  if (/格拉斯哥|苏超|苏格兰|库里蒂巴|女篮|CBA|篮协/i.test(title)) return null;
  if (/NBA|湖人|勇士|凯尔特人|尼克斯|东契奇|詹姆斯|约基奇|文班亚马|库里(?!蒂巴)/i.test(title) && !/女篮|CBA|篮协|库里蒂巴/i.test(title)) return 'NBA';
  if (/网球|ATP\b|WTA\b|郑钦文|阿尔卡拉斯|辛纳|德约|温网|澳网|法网|美网|萨巴伦卡|斯瓦泰克/i.test(title)) return '网球';
  if (/篮球|男篮|女篮|掘金|篮板|NBA|CBA/i.test(title)) return null;
  for (const [topic, re] of [
    ['英超', /英超|阿森纳|曼城|曼联|利物浦|切尔西|热刺/],
    ['西甲', /西甲|皇马|皇家马德里|巴塞罗那|巴萨|马竞|马德里竞技/],
    ['德甲', /德甲|拜仁|多特蒙德|勒沃库森/],
    ['意甲', /意甲|国际米兰|AC米兰|尤文图斯|那不勒斯/],
    ['法甲', /法甲|巴黎圣日耳曼/],
  ]) if (re.test(title)) return topic;
  return null;
}
export function financeTopic(item, preferred) {
  const title = clean(item.title), text = title + ' ' + clean(item.summary || item.intro), url = item.url || '';
  if (excluded.test(text) || /股民索赔|索赔条件|索赔范围|维权|rightscase/.test(text + url)) return null;
  if (/期货|沪金|沪银|螺纹|豆粕|PTA|纸浆|郑商所|大商所|上期所|中金所/.test(text) && /国内|中国|沪|郑商所|大商所|上期所|中金所|华安期货|豆粕|螺纹/.test(text)) return '中国期货';
  if (preferred === '美股' && /美股|纳指|纳斯达克|道指|标普|美联储|英伟达|特斯拉|亚马逊|微软|谷歌|Meta|诺和诺德|苹果.*(?:股|业绩|营收|财报)/i.test(title) && !/比特币/.test(title)) return '美股';
  if (preferred === 'A股' && !/港股|港元|港币|\.HK|港交所|香港联交所|H股|03223|[A-F][+＋]*轮融资|天使轮/.test(text) && /A股|沪指|上证|深证|创业板|科创板|证监会|北交所|募资|回购|净利润|业绩|重组|涨停|股价|股票|增持|减持|上市公司/.test(text)) return 'A股';
  return null;
}
export function normalize(item, sourceId, now = Date.now()) {
  const url = safeUrl(item.url), title = clean(item.title);
  if (!url || !title || !TOPICS[item.category]?.includes(item.topic) || excluded.test(title)) return null;
  if (!recent(item, now, item.category === 'AI' ? 14 : item.category === '时事' ? 1 : 3)) return null;
  return { ...item, sourceId, url, title, source: clean(item.source), ...(item.category === '金融' ? { kind: financeKind(item) } : {}), summary: shorten(item.summary || '该来源未提供摘要，可点开原文查看完整报道。'), publishedAt: new Date(item.publishedAt).toISOString() };
}
export function financeKind(item) {
  if (item.kind === '观点') return '观点';
  const title = clean(item.title), lead = clean(item.summary || item.intro).slice(0,180);
  return /策略[：:]|机构论市|研报|后市|展望|预测|预言|预计|看好|有望|需求料|影响几何|年内还会|^(?:高盛|瑞银|大摩|摩根士丹利|摩根大通)[：:]/.test(title) || /来源[：:]\s*\S*期货投研|核心观点[：:]|投资策略建议[：:]|核心逻辑及市场展望/.test(lead) ? '观点' : '报道';
}
export function selectItems(items, now = Date.now()) {
  const seenUrl = new Set(), seenTitle = new Set();
  const sorted = items.filter(x => normalize(x, x.sourceId, now)).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const result = [];
  for (const [category, topics] of Object.entries(TOPICS)) for (const topic of topics) {
    let count = 0;
    const candidates = sorted.filter(x => x.category === category && x.topic === topic);
    // Keep the newly requested source visible even when another feed publishes more frequently.
    const reserved = category === '金融' ? candidates.filter(x => x.sourceId?.startsWith('eastmoney-')).slice(0,2) : [];
    const ordered = [...reserved, ...candidates.filter(x => !reserved.includes(x))];
    const selected = [];
    for (const item of ordered) {
      const key = clean(item.title).replace(/[\p{P}\p{Z}\p{S}]/gu, '').toLowerCase();
      const url = item.sourceId === 'baidu' ? new URL(item.url).origin + '/s?wd=' + new URL(item.url).searchParams.get('wd') : item.url.split(/[?#]/)[0];
      if (seenUrl.has(url) || seenTitle.has(key)) continue;
      if (count >= (category === 'AI' ? 12 : category === '体育' ? 3 : 6)) break;
      seenUrl.add(url); seenTitle.add(key); count++;
      selected.push(normalize(item, item.sourceId, now));
    }
    selected.sort((a,b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
    for (const item of selected) result.push({ ...item, number: result.length + 1 });
  }
  return result;
}
export function mergeSource(previous, result, now = new Date().toISOString()) {
  if (result.status === 'fulfilled') return { id: result.id, name: result.name, url: result.url, status: 'ok', lastAttempt: now, lastSuccess: now, items: result.value };
  return { id: result.id, name: result.name, url: result.url, status: 'error', lastAttempt: now, lastSuccess: previous?.lastSuccess || null, items: previous?.items || [] };
}
export function parseRss(xml) {
  if (!/<(?:rss|feed)\b/.test(xml)) throw new Error('Invalid RSS feed');
  const tag = (s, name) => clean(s.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + name + '>'))?.[1] || '');
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)].map(m => ({ title: tag(m[1], 'title'), url: tag(m[1], 'link'), summary: tag(m[1], 'description'), publishedAt: tag(m[1], 'pubDate') }));
}
