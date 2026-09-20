import { TOPICS, clean, shorten, safeUrl, dateKey } from './news-core.mjs';
import { LESSONS, lessonForDate } from './english-lessons.mjs';

function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function humanTime(value) {
  if (!value) return '暂未成功更新';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '暂未成功更新';
  const today = dateKey(), yesterday = dateKey(new Date(Date.now() - 86400000));
  const day = dateKey(d);
  const clock = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return (day === today ? '今天' : day === yesterday ? '昨天' : `${d.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric' })}`) + ' ' + clock;
}
function visibleItems(data) {
  return data.items.filter(item => {
    const age = Date.now() - Date.parse(item.publishedAt);
    return Number.isFinite(age) && age >= -300000 && age <= (item.category === 'AI' ? 14 : item.category === '时事' ? 1 : 3) * 86400000;
  });
}
function renderEnglish(offset = 0, showChinese = true) {
  const e = escapeHtml, lesson = lessonForDate(dateKey(), offset);
  const date = lesson.date.replace(/-/g, '/');
  return `<section class="lesson-section" aria-labelledby="lesson-title"><div class="lesson-heading"><div><p class="eyebrow">TRAVEL ENGLISH · 每天 5 分钟</p><h2 id="lesson-title">${e(lesson.title)}</h2><p class="lesson-meta">${date} · ${lesson.review ? '复习' : '今日'}第 ${lesson.number} / ${lesson.total} 课</p></div><button type="button" class="chip-button" data-toggle-chinese aria-pressed="${showChinese}">${showChinese ? '隐藏中文，自测一下' : '显示中文对照'}</button></div><div class="lesson-layout"><div class="dialogue" aria-label="旅游英语中英对照"><h3>跟着对话练一遍</h3><p class="lesson-tip">先读英文，再看中文；把姓名、时间和地点换成自己的行程。</p>${lesson.lines.map(([en, zh], i) => `<div class="dialogue-line"><p class="speaker">${i % 2 === 0 ? 'You · 你' : e(lesson.partner)}</p><p class="english" lang="en">${e(en)}</p><p class="translation" ${showChinese ? '' : 'hidden'}>${e(zh)}</p></div>`).join('')}</div><aside class="vocabulary" aria-label="关键单词注释"><h3>关键单词与短语</h3><dl>${lesson.words.map(([word, meaning, note]) => `<div class="word-entry"><dt lang="en">${e(word)}</dt><dd><p>${e(meaning)}</p><p class="word-note">${e(note)}</p></dd></div>`).join('')}</dl><div class="sentence-pattern"><h3>今天记住这一句</h3><p class="english" lang="en">${e(lesson.pattern[0])}</p><p>${e(lesson.pattern[1])}</p></div></aside></div><div class="lesson-actions"><button type="button" class="chip-button" data-lesson-previous>← 复习上一课</button>${lesson.review ? '<button type="button" class="chip-button" data-lesson-today>回到今日课程</button>' : ''}</div><p class="lesson-note">原创情景练习 · 30 个旅游场景按北京时间每天轮换，学完后进入复习。对话中的价格、航班和服务规则仅用于语言练习。</p></section>`;
}
function view(data, category = '时事', topic = '全部', lessonOffset = 0, showChinese = true) {
  const e = escapeHtml, all = visibleItems(data);
  const items = all.filter(x => x.category === category && (topic === '全部' || x.topic === topic));
  const tabs = [...Object.keys(TOPICS), '英语学习'].map(name => `<button type="button" class="tab ${name === category ? 'active' : ''}" data-category="${name}" aria-pressed="${name === category}">${name}${name === '英语学习' ? '' : `<span>${all.filter(x => x.category === name).length}</span>`}</button>`).join('');
  const subnav = category === '英语学习' ? '<p class="subhint">每天一段旅游对话 · 中英对照 · 关键词注释</p>' : ['全部', ...TOPICS[category]].map(name => `<button type="button" class="chip-button ${name === topic ? 'active' : ''}" data-topic="${e(name)}" aria-pressed="${name === topic}">${e(name)}${name === '全部' ? '' : ` <span>${all.filter(x => x.category === category && x.topic === name).length}</span>`}</button>`).join('');
  if (category === '英语学习') return { tabs, subnav, content: renderEnglish(lessonOffset, showChinese), count: all.length, shown: 0 };
  const card = item => {
    const stale = data.sources.find(s => s.id === item.sourceId)?.status === 'error';
    const time = (item.timeLabel ? item.timeLabel + ' · ' : '') + humanTime(item.publishedAt);
    return `<article class="news-card"><div class="card-kicker"><span class="number">NO. ${String(item.number).padStart(2, '0')}</span><span>${e(item.category)} / ${e(item.topic)}</span>${item.kind === '观点' ? '<span class="opinion">观点</span>' : ''}${stale ? '<span class="warning">暂用缓存</span>' : ''}</div><h3><a href="${e(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">${e(item.title)}</a></h3><p class="summary">${e(shorten(item.summary))}</p><div class="card-meta"><span class="source-chip">${e(item.source)}</span><span>${e(time)}</span></div>${item.reportDate && item.reportDate !== dateKey() ? `<p class="older">AI 最近一期：${e(item.reportDate.replace(/-/g, '/'))}，今日版待更新</p>` : ''}<a class="original" href="${e(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">${e(item.linkLabel || '阅读原文')} <span aria-hidden="true">↗</span></a></article>`;
  };
  const groups = topic === '全部' ? TOPICS[category] : [topic];
  const content = groups.map((group, i) => {
    const rows = items.filter(x => x.topic === group);
    return `<section class="news-section" id="group-${i}" aria-labelledby="heading-${i}"><div class="section-heading"><h2 id="heading-${i}">${category === '时事' ? '时事 · 百度热搜' : e(group)}</h2><span>${rows.length} 条</span></div>${rows.length ? `<div class="news-grid">${rows.map(card).join('')}</div>` : `<p class="empty">${category === 'AI' ? '最近一期暂无此类条目。' : category === '时事' ? '近 24 小时暂未收录符合范围的时事热搜。' : '近 72 小时暂未收录符合范围的报道。'}${data.sources.some(s => s.status === 'error') ? ' 部分来源暂时不可用，可展开页尾查看。' : ''}</p>`}</section>`;
  }).join('');
  return { tabs, subnav, content, count: all.length, shown: items.length };
}
function browserApp() {
  let data = JSON.parse(document.getElementById('initial-data').textContent);
  let category = '时事', topic = '全部', busy = false, lastChecked = 0;
  let lessonOffset = 0, showChinese = true, lessonDay = dateKey();
  const $ = id => document.getElementById(id);
  function render() {
    if (lessonDay !== dateKey()) { lessonDay = dateKey(); lessonOffset = 0; }
    const result = view(data, category, topic, lessonOffset, showChinese);
    $('tabs').innerHTML = result.tabs; $('subnav').innerHTML = result.subnav; $('content').innerHTML = result.content;
    $('subnav').classList.toggle('wrap', category === '金融');
    $('total').textContent = result.count; $('footer-total').textContent = result.count;
    $('collected').textContent = humanTime(data.collectedAt);
    $('today').textContent = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    $('source-list').innerHTML = data.sources.map(s => `<li><a href="${escapeHtml(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.name)}</a><span>${s.status === 'error' ? '采集失败 · ' : ''}最近成功：${escapeHtml(humanTime(s.lastSuccess))}</span></li>`).join('');
    const stale = Date.now() - Date.parse(data.collectedAt) > 6 * 3600000;
    $('freshness').textContent = category === '英语学习' ? '课程按北京时间每天切换，无需等待新闻更新。中英对照可随时隐藏自测。' : category === '时事' ? '筛选百度热搜中的时事话题，过滤娱乐和赛事。时间为热搜采集时间，链接进入百度相关新闻搜索。' + (stale ? ' 当前快照超过 6 小时未更新。' : '') : stale ? '已发布内容超过 6 小时未更新。定时发布可能延迟，当前保留最近内容。' : '体育、金融、政治收录近 72 小时内容；AI 显示最近一期。时间均为北京时间。';
    $('freshness').classList.toggle('warning', stale && category !== '英语学习');
  }
  document.addEventListener('click', event => {
    if (event.target.closest('[data-toggle-chinese]')) { showChinese = !showChinese; render(); $('content').querySelector('[data-toggle-chinese]')?.focus({ preventScroll: true }); return; }
    if (event.target.closest('[data-lesson-previous]')) { lessonOffset--; render(); $('content').scrollIntoView({ block: 'start', behavior: 'instant' }); return; }
    if (event.target.closest('[data-lesson-today]')) { lessonOffset = 0; render(); $('content').scrollIntoView({ block: 'start', behavior: 'instant' }); return; }
    const cat = event.target.closest('[data-category]');
    const sub = event.target.closest('[data-topic]');
    if (cat) { category = cat.dataset.category; topic = '全部'; }
    else if (sub) topic = sub.dataset.topic;
    else return;
    render();
    $('navigation').scrollIntoView({ block: 'start', behavior: 'instant' });
    const focus = cat ? [...$('tabs').children].find(x => x.dataset.category === category) : [...$('subnav').children].find(x => x.dataset.topic === topic);
    focus?.focus({ preventScroll: true });
  });
  function validSnapshot(value) {
    return value?.schemaVersion === 1 && Number.isFinite(Date.parse(value.collectedAt)) && Date.parse(value.collectedAt) <= Date.now() + 300000 && Array.isArray(value.items) && value.items.length > 0 && Array.isArray(value.sources) && value.sources.every(s => typeof s.id === 'string' && typeof s.name === 'string') && value.items.every(x => TOPICS[x.category]?.includes(x.topic) && safeUrl(x.url) && typeof x.title === 'string' && typeof x.summary === 'string' && Number.isFinite(Date.parse(x.publishedAt)));
  }
  async function get(url) {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  }
  async function refresh(manual = false) {
    if (busy || (!manual && Date.now() - lastChecked < 60000)) return;
    busy = true; $('refresh').disabled = true; $('refresh').textContent = '检查中…';
    $('status').textContent = '正在检查已发布新闻和 AI 最新日报…'; $('status').dataset.state = 'loading';
    const before = JSON.stringify(data.items.map(x => [x.url, x.title, x.summary]));
    try {
      const result = await Promise.allSettled([get(new URL('latest.json?t=' + Date.now(), location.href)), get('https://aihot.virxact.com/api/v1/dailies/latest')]);
      let snapshotOK = false, aiOK = false;
      if (result[0].status === 'fulfilled' && validSnapshot(result[0].value)) {
        const next = result[0].value;
        if (Date.parse(next.collectedAt) >= Date.parse(data.collectedAt)) {
          // A slower static deployment must not replace a more recent live AI report.
          const priorAI = data.items.filter(x => x.category === 'AI');
          const oldDate = priorAI.map(x => x.reportDate || '').sort().at(-1) || '';
          const nextDate = next.items.filter(x => x.category === 'AI').map(x => x.reportDate || '').sort().at(-1) || '';
          const oldTime = Math.max(0, ...priorAI.map(x => Date.parse(x.publishedAt)));
          const nextTime = Math.max(0, ...next.items.filter(x => x.category === 'AI').map(x => Date.parse(x.publishedAt)));
          if (oldDate > nextDate || (oldDate === nextDate && oldTime > nextTime)) { next.items = next.items.filter(x => x.category !== 'AI').concat(priorAI); next.sources = next.sources.filter(x => x.id !== 'aihot').concat(data.sources.filter(x => x.id === 'aihot')); }
          data = next;
        }
        snapshotOK = true;
      }
      if (result[1].status === 'fulfilled') {
        const report = result[1].value.report;
        const currentDate = data.items.filter(x => x.category === 'AI').map(x => x.reportDate || '').sort().at(-1) || '';
        const currentTime = Math.max(0, ...data.items.filter(x => x.category === 'AI').map(x => Date.parse(x.publishedAt)));
        if (/^\d{4}-\d{2}-\d{2}$/.test(report?.date || '') && report.date >= currentDate && report.date <= dateKey() && Array.isArray(report.sections) && Date.parse(report.generatedAt) >= currentTime && Date.parse(report.generatedAt) <= Date.now() + 300000) {
          const rows = report.sections.flatMap(s => (Array.isArray(s.items) ? s.items : []).map(x => ({ category: 'AI', topic: s.label, title: clean(x.title), summary: shorten(x.summary || '该来源未提供摘要，可点开原文查看完整报道。'), url: safeUrl(x.links?.original || x.url || x.link || x.links?.aihot), source: clean(typeof x.source === 'string' ? x.source : x.source?.name || 'AI HOT'), sourceId: 'aihot', publishedAt: report.generatedAt, reportDate: report.date, timeLabel: '日报生成' }))).filter(x => TOPICS.AI.includes(x.topic) && x.url && x.title);
          if (rows.length) {
            data.items = data.items.filter(x => x.category !== 'AI').concat(rows);
            data.sources = data.sources.filter(x => x.id !== 'aihot').concat({ id: 'aihot', name: 'AI HOT', url: 'https://aihot.news/', status: 'ok', lastSuccess: new Date().toISOString() });
            aiOK = true;
          }
        }
      }
      const seen = new Set();
      data.items = data.items.filter(x => { const key = x.sourceId === 'baidu' ? new URL(x.url).origin + '/s?wd=' + new URL(x.url).searchParams.get('wd') : x.url.split(/[?#]/)[0]; if (seen.has(key)) return false; seen.add(key); return true; });
      data.items.forEach((x, i) => { x.number = i + 1; });
      render();
      const changed = before !== JSON.stringify(data.items.map(x => [x.url, x.title, x.summary]));
      const failedSources = data.sources.some(x => x.status === 'error');
      $('status').dataset.state = snapshotOK && aiOK && !failedSources ? 'success' : 'error';
      $('status').textContent = `${humanTime(new Date())} 已检查。${changed ? '内容已更新。' : '暂无新增，保留当前新闻。'}${snapshotOK ? '其他栏目截至 ' + humanTime(data.collectedAt) + '。' : '新闻快照检查失败。'}${aiOK ? '' : ' AI 实时检查未成功，保留最近一期。'}${failedSources ? ' 部分来源采集失败，详见页尾。' : ''}`;
    } catch {
      $('status').dataset.state = 'error'; $('status').textContent = '检查暂未成功，已保留当前新闻。请稍后重试。';
    } finally { busy = false; lastChecked = Date.now(); $('refresh').disabled = false; $('refresh').textContent = '检查更新'; }
  }
  $('refresh').addEventListener('click', () => refresh(true));
  window.addEventListener('pageshow', () => refresh());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); refresh(); } });
  setInterval(() => { if (lessonDay !== dateKey()) render(); }, 60000);
  render(); refresh();
}

const CSS = `
:root{color-scheme:light;--bg:#f4f5f3;--paper:#fff;--ink:#202b27;--muted:#5e6e65;--line:#dce3dd;--accent:#176448;--soft:#eaf2ec;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-size:15px;line-height:1.65}a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}button{font:inherit;cursor:pointer;touch-action:manipulation}button:disabled{cursor:wait;opacity:.6}a:focus-visible,button:focus-visible,summary:focus-visible{outline:3px solid #43866a;outline-offset:3px}.shell{max-width:1160px;margin:auto;padding:0 28px}.masthead{padding:27px 0 20px;background:var(--paper);border-top:4px solid var(--accent);border-bottom:1px solid var(--line)}.brand-row{display:flex;justify-content:space-between;align-items:center;gap:12px}.eyebrow{letter-spacing:.12em;font-size:11px;font-weight:750;color:var(--accent);margin:0 0 2px}h1{font-size:30px;letter-spacing:-.04em;margin:0;font-weight:750}.edition{border:1px solid var(--line);border-radius:4px;padding:4px 9px;color:var(--muted);font-size:12px;white-space:nowrap}.date-line{margin:8px 0 15px;color:var(--muted);font-size:13px}.date-line strong{color:var(--accent)}.sync{display:flex;align-items:center;gap:20px;justify-content:space-between;border-top:1px solid var(--line);padding-top:13px}.sync-copy{min-width:0}.sync-copy p{margin:0;font-size:12px;color:var(--muted)}#refresh{background:var(--accent);color:#fff;border:0;border-radius:6px;min-height:44px;padding:0 17px;white-space:nowrap}#status{margin-top:3px;font-size:12px}#status[data-state=error],.warning{color:#885313!important}.navigation{position:sticky;top:0;z-index:5;background:var(--paper);border-bottom:1px solid var(--line)}.tabs{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;padding-top:8px}.tab{min-height:46px;border:0;background:transparent;border-radius:5px 5px 0 0;color:var(--muted);border-bottom:3px solid transparent;font-weight:650}.tab span{margin-left:7px;font-size:11px;font-weight:400}.tab.active{color:var(--accent);border-bottom-color:var(--accent);background:var(--soft)}.subnav{display:flex;gap:7px;overflow-x:auto;padding:11px 0;scrollbar-width:thin;min-height:60px;align-items:center}.chip-button{flex:none;min-height:38px;padding:4px 13px;border:1px solid var(--line);border-radius:5px;background:var(--paper);color:var(--muted);font-size:13px}.chip-button.active{background:var(--soft);border-color:var(--accent);color:var(--accent)}.chip-button span{font-size:11px}.subhint{margin:0;font-size:12px;color:var(--muted)}.freshness{font-size:12px;color:var(--muted);margin:18px 0 0}.news-section{scroll-margin-top:140px;margin:20px 0 30px}.section-heading{display:flex;gap:12px;align-items:baseline;margin-bottom:12px}.section-heading h2{font-size:19px;margin:0}.section-heading>span{font-size:12px;color:var(--muted)}.text-button{margin-left:auto;border:0;background:none;color:var(--accent);font-size:13px;min-height:44px}.news-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.news-card{background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:20px;display:flex;flex-direction:column;min-width:0;overflow-wrap:anywhere}.card-kicker{display:flex;gap:9px;align-items:center;flex-wrap:wrap;font-size:11px;color:var(--accent)}.number{font-variant-numeric:tabular-nums;color:var(--muted);font-size:11px}.news-card h3{font-size:18px;line-height:1.55;letter-spacing:.01em;margin:11px 0 9px}.news-card h3 a{color:var(--ink)}.summary{font-size:14px;color:#4d5b53;margin:0 0 18px;line-height:1.8}.card-meta{display:flex;gap:7px 9px;align-items:center;flex-wrap:wrap;margin-top:auto;color:var(--muted);font-size:11px}.source-chip{background:var(--soft);border-radius:4px;padding:2px 7px;max-width:100%}.original{align-self:flex-start;min-height:44px;display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;margin-top:6px}.older{font-size:11px;color:#885313;margin:7px 0 0}.empty{font-size:13px;color:var(--muted);padding:14px 0;border-top:1px solid var(--line);margin:0}footer{border-top:1px solid var(--line);padding:24px 0 35px;color:var(--muted);font-size:12px}footer p{margin:5px 0}footer details{margin-top:14px}summary{cursor:pointer;min-height:44px;display:list-item;padding:10px 0}#source-list{padding-left:18px}#source-list li{margin:8px 0}#source-list span{display:block;font-size:11px}.footer-links{display:flex;gap:24px;margin:15px 0;flex-wrap:wrap}.footer-links a{min-height:44px;display:inline-flex;align-items:center}noscript{display:block;padding:15px;background:#fff4d5}
.opinion{color:#805219;background:#faf0df;border:1px solid #e7d4b5;border-radius:4px;padding:0 6px}.subnav.wrap{flex-wrap:wrap}
.tabs{grid-template-columns:repeat(6,minmax(0,1fr))}.lesson-section{margin:22px 0 32px;scroll-margin-top:185px}.lesson-heading{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:18px}.lesson-heading h2{font-size:24px;margin:4px 0}.lesson-meta,.lesson-note,.lesson-tip{font-size:13px;color:var(--muted)}.lesson-meta{margin:5px 0}.lesson-layout{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:20px;align-items:start}.dialogue,.vocabulary{background:white;border:1px solid var(--line);border-radius:8px;padding:22px;min-width:0;overflow-wrap:anywhere}.dialogue h3,.vocabulary h3{font-size:17px;margin:0 0 10px}.dialogue-line{padding:16px 0;border-top:1px solid var(--line)}.speaker{font-size:12px;font-weight:650;color:var(--accent);margin:0 0 5px}.english{font-size:18px;line-height:1.65;margin:0}.translation{font-size:15px;color:var(--muted);margin:7px 0 0}.word-entry{padding:13px 0;border-top:1px solid var(--line)}.word-entry dt{font-size:18px;font-weight:650;color:var(--accent)}.word-entry dd{margin:3px 0 0}.word-entry p{margin:4px 0}.word-note{font-size:13px;color:var(--muted)}.sentence-pattern{border-top:2px solid var(--line);padding-top:18px;margin-top:10px}.lesson-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:20px}.lesson-heading button,.lesson-actions button{min-height:44px}.lesson-note{line-height:1.8}#content{scroll-margin-top:195px}
@media(max-width:950px){.news-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.shell{padding:0 16px}.masthead{padding:19px 0 16px}h1{font-size:26px}.edition{font-size:11px}.date-line{font-size:12px;margin:7px 0 12px}.sync{gap:12px;align-items:flex-start}#refresh{padding:0 13px;font-size:13px}.sync-copy p{font-size:11px}.tab{font-size:14px;padding:5px 0}.tab span{font-size:10px;margin-left:4px}.tabs{gap:3px}.subhint{font-size:11px}.news-grid{grid-template-columns:minmax(0,1fr);gap:12px}.news-card{padding:17px}.news-card h3{font-size:19px}.summary{font-size:15px;line-height:1.8}.news-section{margin-top:15px;margin-bottom:22px}.freshness{font-size:11px}.section-heading{margin-bottom:8px}.source-chip{font-size:11px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
@media(max-width:600px){.tabs{grid-template-columns:repeat(3,minmax(0,1fr))}.lesson-heading{align-items:flex-start;flex-direction:column}.lesson-heading h2{font-size:23px}.lesson-layout{grid-template-columns:minmax(0,1fr);gap:14px}.dialogue,.vocabulary{padding:18px}.lesson-note{font-size:12px}.news-section{scroll-margin-top:205px}}
`;

export function buildHomepage(data) {
  const first = view(data);
  const functions = [clean, shorten, safeUrl, dateKey, escapeHtml, humanTime, visibleItems, lessonForDate, renderEnglish, view, browserApp].map(fn => {
    const text = fn.toString();
    return text.startsWith('function') ? text : `const ${fn.name} = ${text};`;
  }).join('\n');
  const serialized = JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#176448"><meta name="apple-mobile-web-app-title" content="肖瑶的每日阅读"><meta name="description" content="面向手机阅读的个人每日简报：NBA、五大联赛、网球、美股、A股、中国期货、宏观财经、中美政治、AI与每日旅游英语。"><title>肖瑶的每日阅读 · 时事 / 体育 / 金融 / 政治 / AI / 英语学习</title><style>${CSS}</style></head><body id="top"><header class="masthead"><div class="shell"><div class="brand-row"><div><p class="eyebrow">DAILY BRIEF / 每日阅读</p><h1>肖瑶的每日阅读</h1></div></div><p class="date-line"><span id="today">${escapeHtml(new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }))}</span> · 收录 <strong id="total">${first.count}</strong> 条</p><div class="sync"><div class="sync-copy"><p>新闻采集于 <span id="collected">${humanTime(data.collectedAt)}</span></p><p id="status" role="status" aria-live="polite">已加载可阅读快照；打开后自动检查更新。</p></div><button type="button" id="refresh">检查更新</button></div></div></header><nav class="navigation" id="navigation" aria-label="新闻栏目"><div class="shell"><div class="tabs" id="tabs">${first.tabs}</div><div class="subnav" id="subnav">${first.subnav}</div></div></nav><main class="shell"><p id="freshness" class="freshness">体育、金融、政治收录近 72 小时内容；AI 显示最近一期。时间均为北京时间。</p><noscript>已展示时事新闻。启用 JavaScript 后可切换栏目、学习英语和检查更新。</noscript><div id="content">${first.content}</div></main><footer><div class="shell"><p>本页共 <strong id="footer-total">${first.count}</strong> 条新闻 · 数据来源：百度热搜、网易体育、东方财富、新浪财经、中国新闻网、AI HOT。</p><p>热点由主题筛选和时间排序产生，不代表全网热度排名。摘要为来源摘录，观点与未证实说法请结合署名及原文阅读。</p><p>时事、体育、金融、政治由云端约每 2 小时尝试更新，平台调度可能延迟；“检查更新”读取已发布内容。AI 额外直连最新日报。市场休市时仍可阅读最近报道。</p><div class="footer-links"><a href="ai.html">AI 完整日报</a><a href="archive/">AI 历史归档</a><a href="#top">返回顶部 ↑</a></div><details><summary>查看数据来源与更新状态</summary><ul id="source-list">${data.sources.map(s => `<li><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.name)}</a><span>${s.status === 'error' ? '采集失败 · ' : ''}最近成功：${humanTime(s.lastSuccess)}</span></li>`).join('')}</ul></details></div></footer><script type="application/json" id="initial-data">${serialized}</script><script>const TOPICS=${JSON.stringify(TOPICS)}; const LESSONS=${JSON.stringify(LESSONS).replace(/</g, "\\u003c")};\n${functions}\nbrowserApp();</script></body></html>`;
}
