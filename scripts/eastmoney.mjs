import { clean, safeUrl, recent, financeTopic, financeKind } from './news-core.mjs';

const articlePattern = /^https:\/\/(?:finance|stock|futures)\.eastmoney\.com\/a\/(\d{8})\d+\.html$/;
const macro = /LPR|贷款市场报价利率|央行|降准|降息|加息|逆回购|货币政策|财政政策|经济数据|GDP|CPI|PPI|PMI|社融|社会融资|消费(?:者)?信心|失业率|非农|全社会用电|进出口|外贸|汇率|人民币(?:升|贬|汇)|存款利率|经济增长/i;
const domesticCommodity = /SC原油|内外价差|双焦|焦煤|焦炭|碳酸锂|锂矿|沪金|沪银|沪铜|螺纹|豆粕|菜粕|PTA|纸浆|生猪|郑商所|大商所|上期所|中金所|广期所|商品期货|国内.*期货/i;
export function eastmoneyTopic(item, preferred) {
  const title = clean(item.title), text = title + ' ' + clean(item.summary);
  if (/索赔|维权|荐股|加群|广告|中签号|龙虎榜|热门.*收盘一览|造谣|裸奔|行拘/.test(title)) return null;
  if (preferred === '宏观财经') return macro.test(title) ? '宏观财经' : null;
  if (preferred === '中国期货') return domesticCommodity.test(title) || (domesticCommodity.test(text) && /期货|价差|期价|库存/.test(text)) ? '中国期货' : null;
  if (preferred === '美股') {
    if (/美股|纳斯达克|纳指|标普|道指|英伟达|特斯拉|微软|亚马逊|Meta|诺和诺德|美光|甲骨文|美股IPO/i.test(title)) return '美股';
    return null;
  }
  if (preferred === 'A股') {
    if (/港股|港元|港币|\.HK|H股|[A-F][+＋]*轮融资/.test(text)) return null;
    if (macro.test(title)) return null;
    return financeTopic(item, 'A股') || (/上市公司|沪深|MLCC|存储芯片|长鑫科技|半导体|宁德时代|产业链/.test(title) ? 'A股' : null);
  }
  return null;
}
export function parseEastmoneyLinks(html, preferred, now = Date.now()) {
  const found = new Map();
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = clean(match[2]);
    let url;
    try { url = new URL(match[1], 'https://finance.eastmoney.com/'); } catch { continue; }
    if (!['http:', 'https:'].includes(url.protocol)) continue;
    url.protocol = 'https:';
    const valid = url.href.match(articlePattern);
    if (!valid || title.length < 8 || title.length > 160 || !eastmoneyTopic({ title }, preferred)) continue;
    // URL dates only bound requests. Displayed publication time always comes from the article.
    const d = valid[1], date = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T23:59:59+08:00`;
    if (Date.parse(date) < now - 3 * 86400000 || Date.parse(date) > now + 86400000) continue;
    const prior = found.get(url.href);
    if (!prior || title.length > prior.title.length) found.set(url.href, { title, url: url.href, preferred });
  }
  return [...found.values()].sort((a,b) => b.url.match(articlePattern)[1].localeCompare(a.url.match(articlePattern)[1])).slice(0, 16);
}
export function parseEastmoneyArticle(html, url, preferred, now = Date.now()) {
  if (!articlePattern.test(safeUrl(url))) throw new Error('Unexpected Eastmoney article URL');
  const title = clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]).replace(/\s*[_-]\s*东方财富网\s*$/, '');
  const stamp = html.match(/(\d{4})年(\d{2})月(\d{2})日\s+(\d{2}):(\d{2})/);
  const publisher = clean(html.match(/<span>文章来源[：:]([^<]+)<\/span>/)?.[1]);
  const body = html.split(/id="ContentBody"[^>]*>/)[1]?.split('<!-- 正文中部')[0];
  if (!title || !stamp || !publisher || !body) throw new Error('Eastmoney article schema changed');
  // Do not use the site's automatically generated stock-price roundups as factual reporting.
  if (/本文基于AI生产/.test(body)) return null;
  const paragraphs = [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m => clean(m[1])).filter(x => x.length > 20 && !/文章来源|免责声明|原标题|责任编辑|打开.*APP/.test(x));
  if (!paragraphs.length) return null;
  const summary = paragraphs[0];
  const topic = eastmoneyTopic({ title, summary: paragraphs.slice(0,3).join(' ') }, preferred);
  const publishedAt = `${stamp[1]}-${stamp[2]}-${stamp[3]}T${stamp[4]}:${stamp[5]}:00+08:00`;
  if (!topic || !recent({ publishedAt }, now)) return null;
  return { category: '金融', topic, title, summary, url, publishedAt, source: `东方财富 · ${publisher}`, kind: financeKind({ title, summary }) };
}
export async function collectEastmoney(request, pageUrl, preferred) {
  const pages = await Promise.all((Array.isArray(pageUrl) ? pageUrl : [pageUrl]).map(url => request(url)));
  const links = parseEastmoneyLinks(pages.join('\n'), preferred);
  if (!links.length) throw new Error('No recent Eastmoney links found');
  const items = [], failures = [];
  // Limit article requests to four at once, preserving source-specific fallback on failure.
  for (let start = 0; start < links.length; start += 4) {
    const results = await Promise.allSettled(links.slice(start, start + 4).map(async item => parseEastmoneyArticle(await request(item.url), item.url, preferred)));
    for (const result of results) if (result.status === 'fulfilled') { if (result.value) items.push(result.value); } else failures.push(result.reason);
  }
  if (failures.length) throw new Error(`Eastmoney article requests failed (${failures.length}); preserving previous source snapshot`);
  return items;
}
