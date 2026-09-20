import { clean, safeUrl } from './news-core.mjs';
export const BAIDU_URL = 'https://top.baidu.com/board?tab=realtime';
export function isCurrentAffairs(title, summary = '') {
  if (/演唱|献唱|晚会|节目单|综艺|明星|演员|绯闻|嫁女|婚变|恋情|非亲生|票房|电视剧|亚运|奥运|夺冠|夺金|金牌|男篮|女篮|足球|乒乓|网球|游泳|开幕式/.test(title)) return false;
  return /政策|国务院|外交|制造业|经济|央行|公积金|安居钱|社保|医保|住房|就业|学历|毕业生|教育|学校|老师|教师|医院|医疗|交通|交警|电动车|住建|井盖|铁路|高铁|航班|台风|暴雨|地震|灾害|消防|警方|通报|法院|判决|检察|食品|安全|监管|科技|芯片|航天|卫星|iPhone|新能源|市值|企业|门店|消费|物价|关税|国际|停火|谈判|红海|局势/.test(title + ' ' + summary);
}
export function parseBaidu(html, collectedAt = new Date().toISOString()) {
  const block = html.match(/<!--s-data:([\s\S]*?)-->/);
  if (!block) throw new Error('Baidu hot-search data unavailable');
  const payload = JSON.parse(block[1]);
  const cards = payload.data?.cards;
  if (!Array.isArray(cards)) throw new Error('Invalid Baidu hot-search schema');
  const rows = cards.filter(x => x.component === 'hotList').flatMap(x => x.content || []);
  if (!rows.length) throw new Error('Empty Baidu hot-search feed');
  const seen = new Set();
  return rows.flatMap(row => {
    const title = clean(row.word), summary = clean(row.desc), url = safeUrl(row.url || row.appUrl);
    if (!title || !url || !isCurrentAffairs(title, summary) || seen.has(title)) return [];
    const target = new URL(url);
    if (!['www.baidu.com', 'm.baidu.com'].includes(target.hostname) || target.pathname !== '/s') return [];
    seen.add(title);
    // The feed has no article publication time. This is observation time, explicitly labeled.
    return [{ category: '时事', topic: '百度热搜', title, summary: summary || '百度热搜未提供摘要，可点开查看相关新闻。', url, source: '百度热搜', publishedAt: collectedAt, timeLabel: '热搜采集', linkLabel: '查看相关新闻' }];
  }).slice(0,6);
}
