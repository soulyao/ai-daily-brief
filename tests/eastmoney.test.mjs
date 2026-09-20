import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEastmoneyLinks, parseEastmoneyArticle, eastmoneyTopic, collectEastmoney, parseEastmoneyFeed } from '../scripts/eastmoney.mjs';
import { financeKind, selectItems } from '../scripts/news-core.mjs';
const now = Date.parse('2026-09-20T22:00:00+08:00');
const url = 'https://finance.eastmoney.com/a/202609203879283870.html';
const article = `<title>9月LPR保持不变 _ 东方财富网</title><div>2026年09月20日 09:03</div><div id="ContentBody"><p>贷款市场报价利率本月保持不变，详细数据和报价期限见原文发布内容。</p><!-- 正文中部 --></div><span>文章来源：测试媒体</span>`;
test('Eastmoney resolves only article URLs, deduplicates links and bounds old requests', () => {
  const html = `<a href="${url}">9月LPR保持不变</a><a href="${url.replace('https:', 'http:')}">9月LPR保持不变 更多细节</a><a href="https://evil.example/a/202609203879283870.html">9月LPR保持不变</a><a href="https://finance.eastmoney.com/a/202608203879283870.html">8月LPR保持不变</a>`;
  const rows = parseEastmoneyLinks(html, '宏观财经', now);
  assert.equal(rows.length, 1); assert.equal(rows[0].url, url);
});
test('article extraction keeps true publication date and original publisher; rejects missing schema', () => {
  const item = parseEastmoneyArticle(article, url, '宏观财经', now);
  assert.equal(item.publishedAt, '2026-09-20T09:03:00+08:00');
  assert.equal(item.source, '东方财富 · 测试媒体'); assert.equal(item.kind, '报道');
  assert.equal(parseEastmoneyArticle(article.replace('2026年09月20日', '2026年08月20日'), url, '宏观财经', now), null);
  assert.throws(() => parseEastmoneyArticle('<html>Access denied</html>', url, '宏观财经', now));
  assert.equal(parseEastmoneyArticle(article.replace('<!-- 正文中部 -->', '<p>本文基于AI生产</p><!-- 正文中部 -->'), url, '宏观财经', now), null);
});
test('finance categories and opinion labels distinguish news, outlook and irrelevant content', () => {
  assert.equal(eastmoneyTopic({ title: '9月LPR保持不变' }, '宏观财经'), '宏观财经');
  assert.equal(eastmoneyTopic({ title: '高盛：AI投资热贡献美股盈利增长' }, '美股'), '美股');
  assert.equal(eastmoneyTopic({ title: '双焦期货价格下跌' }, '中国期货'), '中国期货');
  assert.equal(eastmoneyTopic({ title: 'MLCC订单增长' }, 'A股'), 'A股');
  assert.equal(eastmoneyTopic({ title: '公司股票目标价提高至48港元' }, 'A股'), null);
  assert.equal(eastmoneyTopic({ title: '伊朗军事冲突' }, '宏观财经'), null);
  assert.equal(financeKind({ title: '高盛：明年盈利增速预计放缓' }), '观点');
  assert.equal(financeKind({ title: '焦煤后市怎么走？' }), '观点');
  assert.equal(financeKind({ title: '马斯克预言：AI将使美国GDP增长' }), '观点');
  assert.equal(eastmoneyTopic({ title: '造谣宁德时代员工事件被行拘' }, 'A股'), null);
  assert.equal(financeKind({ title: '9月LPR不变' }), '报道');
  assert.equal(financeKind({ title: '上市公司发布年度业绩报告' }), '报道');
});
test('source fails explicitly on detail errors so existing fallback can retain previous news', async () => {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date()).replaceAll('-', '');
  const latestUrl = `https://finance.eastmoney.com/a/${date}3879283870.html`;
  await assert.rejects(collectEastmoney(async u => {
    if (u === 'https://finance.eastmoney.com/') return `<a href="${latestUrl}">9月LPR保持不变</a>`;
    throw new Error('Timeout');
  }, 'https://finance.eastmoney.com/', '宏观财经'), /preserving previous/);
});
test('requested finance source remains visible while final ordering stays chronological', () => {
  const rows = Array.from({length:9},(_,i)=>({category:'金融',topic:'A股',title:'公司新闻'+i,summary:'报告',url:`https://example.com/${i}`,source:'媒体',sourceId:i>6?'eastmoney-cn-stock':'cn-stock',publishedAt:new Date(now-i*60000).toISOString()}));
  const selected = selectItems(rows,now);
  assert.equal(selected.length,6); assert.equal(selected.filter(x=>x.sourceId.startsWith('eastmoney')).length,2);
  assert.ok(selected.every((x,i)=>!i || Date.parse(selected[i-1].publishedAt)>=Date.parse(x.publishedAt)));
  assert.deepEqual(selected.map(x=>x.number),[1,2,3,4,5,6]);
});
test('official futures list produces verified article links and rejects invalid responses', () => {
  const data = {code:'1',data:{list:[{code:'202609203879326876',title:'双焦期货价格下跌',showTime:'2026-09-20 13:01:00',np_dst:'CMS'},{code:'202609203879326877',title:'双焦期货观点',showTime:'2026-09-20 13:01:00',np_dst:'CFH'}]}};
  const rows = parseEastmoneyFeed(data,'中国期货',now);
  assert.equal(rows.length,1); assert.equal(rows[0].url,'https://finance.eastmoney.com/a/202609203879326876.html');
  assert.throws(()=>parseEastmoneyFeed({code:'0',data:null},'中国期货',now));
});
