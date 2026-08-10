import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SITE_DIR = path.join(ROOT, "site");
const ARCHIVE_DIR = path.join(SITE_DIR, "archive");
const API_ROOT = "https://aihot.virxact.com/api/v1";
const USER_AGENT = "aihot-skill/1.3.0 (+https://aihot.virxact.com/aihot-skill/)";

const sectionMeta = [
  { label: "模型发布/更新", short: "模型" },
  { label: "产品发布/更新", short: "产品" },
  { label: "行业动态", short: "行业" },
  { label: "论文研究", short: "论文" },
  { label: "技巧与观点", short: "技巧" },
];

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const shorten = (value, max = 60) => {
  const clean = String(value ?? "").replace(/\s+/g, " ").trim();
  const chars = Array.from(clean);
  return chars.length <= max ? clean : `${chars.slice(0, max - 1).join("")}…`;
};

const shanghaiDateKey = (date = new Date()) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(date);

const formatReportDate = (dateKey) => new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
}).format(new Date(`${dateKey}T12:00:00+08:00`));

const timeParts = (iso) => Object.fromEntries(new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).formatToParts(new Date(iso)).map(({ type, value }) => [type, value]));

const formatBeijingTime = (iso) => {
  const part = timeParts(iso);
  return `${part.year}年${part.month}月${part.day}日 ${part.hour}:${part.minute}`;
};

const formatWindowTime = (iso) => {
  const part = timeParts(iso);
  return `${part.month}月${part.day}日 ${part.hour}:${part.minute}`;
};

async function getJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!response.ok) {
    const error = new Error(`AI HOT request failed: ${response.status} ${response.statusText}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function getDaily() {
  try {
    const latest = await getJson(`${API_ROOT}/dailies/latest`);
    return { payload: latest, fallback: latest.report?.date !== shanghaiDateKey() };
  } catch (error) {
    if (error.status !== 404) throw error;
    const archive = await getJson(`${API_ROOT}/dailies?limit=7`);
    const date = archive.items?.[0]?.date;
    if (!date) throw new Error("AI HOT daily archive is empty");
    return { payload: await getJson(`${API_ROOT}/dailies/${date}`), fallback: true };
  }
}

function styles() {
  return `<style>
    :root{--bg:#f4f6f3;--surface:#fff;--ink:#14221e;--muted:#60706a;--line:#dbe2de;--primary:#0d5d4b;--soft:#e5f0ec;--accent:#c77732;--max:1200px}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);background:var(--bg);font-family:"Microsoft YaHei UI","PingFang SC",system-ui,sans-serif;-webkit-font-smoothing:antialiased}a{color:inherit}button{font:inherit}.shell{width:min(calc(100% - 40px),var(--max));margin:auto}
    .hero{padding:42px 0 28px;border-bottom:1px solid var(--line);background:var(--surface)}.eyebrow{margin:0 0 12px;color:var(--primary);font-size:13px;font-weight:800;letter-spacing:.14em}.hero-main{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:30px}h1{margin:0;font-size:clamp(34px,5vw,64px);line-height:1;letter-spacing:-.045em}.hero-copy{margin:14px 0 0;color:var(--muted);font-size:15px;line-height:1.8}.total{min-width:156px;padding-left:26px;border-left:1px solid var(--line)}.total>span{display:block;color:var(--muted);font-size:13px}.total strong{display:block;margin-top:5px;color:var(--primary);font-size:42px;line-height:1}.total small{margin-left:4px;color:var(--muted);font-size:14px}.stats{display:grid;grid-template-columns:repeat(5,1fr);margin-top:28px;border:1px solid var(--line);border-radius:8px;overflow:hidden}.stat{display:flex;align-items:baseline;justify-content:space-between;gap:14px;padding:15px 17px;background:#fafbf9}.stat+.stat{border-left:1px solid var(--line)}.stat span{color:var(--muted);font-size:13px}.stat strong{font-size:23px}
    .sync-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:14px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:#fafbf9}.sync-message{display:flex;align-items:center;gap:9px;min-width:0;color:var(--muted);font-size:13px;line-height:1.5}.sync-dot{width:8px;height:8px;flex:none;border-radius:50%;background:var(--primary)}.sync-bar[data-state="loading"] .sync-dot{animation:pulse 1s ease-in-out infinite}.sync-bar[data-state="error"]{border-color:#e4c5a8;background:#fff9f3}.sync-bar[data-state="error"] .sync-dot{background:var(--accent)}.refresh-button{min-height:42px;flex:none;padding:8px 13px;border:1px solid var(--primary);border-radius:6px;color:var(--primary);background:#fff;cursor:pointer;font-weight:700}.refresh-button:hover,.refresh-button:focus-visible{background:var(--soft);outline:0}.refresh-button:disabled{cursor:wait;opacity:.6}@keyframes pulse{50%{opacity:.35}}
    .nav{position:sticky;top:0;z-index:20;border-bottom:1px solid var(--line);background:rgba(244,246,243,.96);backdrop-filter:blur(10px)}.nav-inner{display:flex;gap:8px;padding:12px 0;overflow-x:auto;scrollbar-width:thin}.nav button,.archive-link{display:inline-flex;flex:0 0 auto;align-items:center;gap:8px;min-height:42px;padding:9px 14px;border:1px solid var(--line);border-radius:6px;color:var(--muted);background:var(--surface);cursor:pointer;text-decoration:none}.nav button:hover,.nav button:focus-visible,.nav button.is-active,.archive-link:hover{border-color:var(--primary);color:var(--primary);background:var(--soft);outline:0}.nav strong{font-size:12px}
    main{padding:12px 0 56px}.daily-section{padding-top:46px;scroll-margin-top:70px}.section-header{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:18px}.section-kicker{color:var(--primary);font-size:12px;font-weight:800;letter-spacing:.12em}h2{margin:6px 0 0;font-size:clamp(25px,3vw,34px);letter-spacing:-.025em}.section-count{color:var(--muted);font-size:13px}.card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.news-card{display:flex;min-width:0;min-height:250px;flex-direction:column;padding:20px;border:1px solid var(--line);border-radius:8px;background:var(--surface);box-shadow:0 1px 1px rgba(18,43,35,.03)}.card-topline{display:flex;align-items:center;gap:10px;min-width:0}.item-number{flex:none;color:var(--accent);font-size:13px;font-weight:900;letter-spacing:.06em}.source-chip{min-width:0;max-width:100%;overflow:hidden;padding:5px 8px;border-radius:999px;color:var(--primary);background:var(--soft);font-size:11px;font-weight:700;text-overflow:ellipsis;white-space:nowrap}.news-card h3{margin:18px 0 10px;font-size:18px;line-height:1.45;overflow-wrap:anywhere}.news-card p{margin:0 0 20px;color:var(--muted);font-size:14px;line-height:1.8}.read-link{display:inline-flex;align-items:center;gap:6px;align-self:flex-start;margin-top:auto;color:var(--primary);font-size:13px;font-weight:800;text-decoration:none}.read-link:hover,.read-link:focus-visible{text-decoration:underline;text-underline-offset:4px}.empty{grid-column:1/-1;padding:24px;border:1px dashed var(--line);color:var(--muted);background:var(--surface)}
    footer{padding:26px 0 34px;border-top:1px solid var(--line);color:var(--muted);background:var(--surface)}.footer-inner{display:flex;align-items:center;justify-content:space-between;gap:20px;font-size:13px;line-height:1.7}footer p{margin:0}footer a{color:var(--primary);font-weight:700;text-underline-offset:3px}.back-top{flex:none;min-height:42px;padding:9px 13px;border:1px solid var(--line);border-radius:6px;color:var(--primary);background:#fff;cursor:pointer}
    .archive-main{min-height:70vh;padding:40px 0 64px}.archive-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:0;list-style:none}.archive-list a{display:flex;justify-content:space-between;padding:18px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);font-weight:700;text-decoration:none}.archive-list a:hover{border-color:var(--primary);color:var(--primary)}
    @media(max-width:920px){.card-grid,.archive-list{grid-template-columns:repeat(2,minmax(0,1fr))}.stats{grid-template-columns:repeat(5,minmax(110px,1fr));overflow-x:auto}.stat{min-width:110px}}
    @media(max-width:640px){.shell{width:min(calc(100% - 28px),var(--max))}.hero{padding-top:30px}.hero-main{grid-template-columns:1fr;gap:20px}.total{padding:0;border:0}.stats{grid-template-columns:repeat(5,104px);margin-top:23px}.stat{min-width:104px;padding:13px 12px}.sync-bar{align-items:flex-start}.sync-message{padding-top:10px}.card-grid,.archive-list{grid-template-columns:1fr}.news-card{min-height:0}.daily-section{padding-top:38px}.footer-inner{align-items:flex-start}}
    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition-duration:.01ms!important}}
  </style>`;
}

function liveRefreshScript() {
  return `<script>(()=>{const API_URL="https://aihot.virxact.com/api/v1/dailies/latest";const sectionMeta=[{label:"模型发布/更新",short:"模型"},{label:"产品发布/更新",short:"产品"},{label:"行业动态",short:"行业"},{label:"论文研究",short:"论文"},{label:"技巧与观点",short:"技巧"}];const statusBar=document.getElementById("sync-bar");const statusText=document.getElementById("sync-status");const refreshButton=document.getElementById("refresh-button");let running=false;let lastChecked=0;let observer;const shorten=(value,max=60)=>{const chars=Array.from(String(value??"").replace(/\\s+/g," ").trim());return chars.length<=max?chars.join(""):chars.slice(0,max-1).join("")+"…"};const reportDate=(date)=>new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",year:"numeric",month:"long",day:"numeric",weekday:"long"}).format(new Date(date+"T12:00:00+08:00"));const timeParts=(iso)=>Object.fromEntries(new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",year:"numeric",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date(iso)).map(({type,value})=>[type,value]));const beijingTime=(iso)=>{const p=timeParts(iso);return p.year+"年"+p.month+"月"+p.day+"日 "+p.hour+":"+p.minute};const windowTime=(iso)=>{const p=timeParts(iso);return p.month+"月"+p.day+"日 "+p.hour+":"+p.minute};const safeUrl=(value,fallback)=>{try{const url=new URL(value||fallback,location.href);return ["http:","https:"].includes(url.protocol)?url.href:fallback}catch{return fallback}};const element=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node};const normalize=(report)=>{if(!report||!/^\\d{4}-\\d{2}-\\d{2}$/.test(report.date)||!Array.isArray(report.sections))throw new Error("AI HOT 数据格式异常");const byLabel=new Map(report.sections.map(section=>[section?.label,Array.isArray(section?.items)?section.items:[]]));return {...report,sections:sectionMeta.map((meta,index)=>({...meta,index,id:"section-"+(index+1),items:(byLabel.get(meta.label)||[]).filter(item=>item&&typeof item.title==="string")}))}};const setupObserver=()=>{observer?.disconnect();const navButtons=[...document.querySelectorAll(".nav button[data-target]")];observer=new IntersectionObserver(entries=>{const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(!visible)return;navButtons.forEach(button=>button.classList.toggle("is-active",button.dataset.target===visible.target.id))},{rootMargin:"-20% 0px -65% 0px",threshold:[0,.25,.5]});document.querySelectorAll(".daily-section").forEach(section=>observer.observe(section))};const render=(raw)=>{const report=normalize(raw);let globalIndex=0;const total=report.sections.reduce((sum,section)=>sum+section.items.length,0);document.body.dataset.reportDate=report.date;document.title="AI 晨报 · "+report.date;document.querySelector('meta[name="description"]').content=report.date+" AI 日报，共 "+total+" 条，数据来源 AI HOT。";const heroCopy=document.getElementById("hero-copy");heroCopy.replaceChildren(document.createTextNode(reportDate(report.date)+" · 最新版"),document.createElement("br"),document.createTextNode("生成于北京时间 "+beijingTime(report.generatedAt)+" · 数据窗口 "+windowTime(report.windowStart)+" 至 "+windowTime(report.windowEnd)));document.getElementById("total-count").textContent=total;const stats=document.getElementById("stats");stats.replaceChildren(...report.sections.map(section=>{const stat=element("div","stat");stat.append(element("span","",section.short),element("strong","",section.items.length));return stat}));const nav=document.getElementById("nav-sections");nav.replaceChildren(...report.sections.map(section=>{const button=element("button");button.type="button";button.dataset.target=section.id;button.setAttribute("aria-label","跳转到"+section.label);button.append(element("span","",section.short),element("strong","",section.items.length));return button}));const content=document.getElementById("content");content.replaceChildren(...report.sections.map(section=>{const sectionNode=element("section","daily-section");sectionNode.id=section.id;const header=element("header","section-header");const headingWrap=element("div");headingWrap.append(element("span","section-kicker","0"+(section.index+1)+" · "+section.short),element("h2","",section.label));header.append(headingWrap,element("span","section-count",section.items.length+" 条"));const grid=element("div","card-grid");if(!section.items.length){grid.append(element("p","empty","本期该版块暂无条目"))}else{section.items.forEach(item=>{globalIndex+=1;const source=item.source?.name||"来源未标注";const fallback=report.attribution?.url||report.links?.aihot||"https://aihot.virxact.com";const card=element("article","news-card");const top=element("div","card-topline");const number=element("span","item-number",String(globalIndex).padStart(2,"0"));number.setAttribute("aria-label","第 "+globalIndex+" 条");const chip=element("span","source-chip",source);chip.title=source;top.append(number,chip);const title=element("h3","",item.title);const summary=element("p","",shorten(item.summary));const link=element("a","read-link","查看原文 ");link.href=safeUrl(item.links?.original||item.links?.aihot,fallback);link.target="_blank";link.rel="noopener noreferrer";link.setAttribute("aria-label","打开原文："+item.title);const arrow=element("span","","↗");arrow.setAttribute("aria-hidden","true");link.append(arrow);card.append(top,title,summary,link);grid.append(card)})}sectionNode.append(header,grid);return sectionNode}));document.getElementById("footer-total").textContent=total;const sourceLink=document.getElementById("source-link");sourceLink.href=safeUrl(report.attribution?.url||report.links?.aihot,"https://aihot.virxact.com");setupObserver();return report};const setStatus=(message,state)=>{statusText.textContent=message;statusBar.dataset.state=state};const checkLatest=async(force=false)=>{if(running)return;if(!force&&Date.now()-lastChecked<60000)return;running=true;refreshButton.disabled=true;setStatus("正在检查最新日报…","loading");const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),8000);try{const response=await fetch(API_URL,{cache:"no-store",headers:{Accept:"application/json"},signal:controller.signal});if(!response.ok)throw new Error("HTTP "+response.status);const payload=await response.json();const current=document.body.dataset.reportDate;const latest=normalize(payload.report);if(latest.date<current){setStatus("当前已是最新一期","success")}else{render(latest);const checked=new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date());setStatus((latest.date>current?"已同步今日日报":"当前已是最新一期")+" · 北京时间 "+checked,"success")}}catch(error){setStatus("实时更新失败，正在显示最近缓存；可再次检查","error");console.warn("AI 晨报实时检查失败",error)}finally{clearTimeout(timeout);lastChecked=Date.now();running=false;refreshButton.disabled=false}};document.addEventListener("click",event=>{const target=event.target.closest("[data-target]");if(target)document.getElementById(target.dataset.target)?.scrollIntoView({behavior:"smooth",block:"start"})});refreshButton.addEventListener("click",()=>checkLatest(true));window.addEventListener("pageshow",event=>{if(event.persisted)checkLatest(true)});document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")checkLatest(false)});setupObserver();checkLatest(true)})();</script>`;
}

function interactionScript() {
  return `<script>(()=>{const buttons=[...document.querySelectorAll("[data-target]")];const navButtons=[...document.querySelectorAll(".nav button")];buttons.forEach(button=>button.addEventListener("click",()=>document.getElementById(button.dataset.target)?.scrollIntoView({behavior:"smooth",block:"start"})));const observer=new IntersectionObserver(entries=>{const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(!visible)return;navButtons.forEach(button=>button.classList.toggle("is-active",button.dataset.target===visible.target.id))},{rootMargin:"-20% 0px -65% 0px",threshold:[0,.25,.5]});document.querySelectorAll(".daily-section").forEach(section=>observer.observe(section))})();</script>`;
}

function enhanceManualRefresh(script) {
  return script
    .replace(
      "const checkLatest=async(force=false)=>",
      "const checkLatest=async(force=false,reveal=false)=>",
    )
    .replace(
      "const latest=normalize(payload.report);",
      'const latest=normalize(payload.report);const latestTotal=latest.sections.reduce((sum,section)=>sum+section.items.length,0);const firstWithNews=latest.sections.find(section=>section.items.length);const locationNote=firstWithNews?"，位于“"+firstWithNews.label+"”":"";',
    )
    .replace(
      'setStatus((latest.date>current?"已同步今日日报":"当前已是最新一期")+" · 北京时间 "+checked,"success")',
      'setStatus((latest.date>current?"已同步今日日报":"当前已是最新一期")+" · 共"+latestTotal+"条"+locationNote+" · 北京时间 "+checked,"success");if(reveal&&firstWithNews)document.getElementById(firstWithNews.id)?.scrollIntoView({behavior:"smooth",block:"start"})',
    )
    .replace(
      'refreshButton.addEventListener("click",()=>checkLatest(true));',
      'refreshButton.addEventListener("click",()=>checkLatest(true,true));',
    );
}

function buildDailyHtml(report, fallback, { liveRefresh = false } = {}) {
  const byLabel = new Map(report.sections.map((section) => [section.label, section.items ?? []]));
  const sections = sectionMeta.map((meta, index) => ({ ...meta, index, id: `section-${index + 1}`, items: byLabel.get(meta.label) ?? [] }));
  let globalIndex = 0;
  const sectionsHtml = sections.map((section) => {
    const cards = section.items.map((item) => {
      globalIndex += 1;
      const source = item.source?.name || "来源未标注";
      const url = item.links?.original || item.links?.aihot || report.links?.aihot;
      return `<article class="news-card"><div class="card-topline"><span class="item-number" aria-label="第 ${globalIndex} 条">${String(globalIndex).padStart(2, "0")}</span><span class="source-chip" title="${escapeHtml(source)}">${escapeHtml(source)}</span></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(shorten(item.summary))}</p><a class="read-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" aria-label="打开原文：${escapeHtml(item.title)}">查看原文 <span aria-hidden="true">↗</span></a></article>`;
    }).join("");
    return `<section class="daily-section" id="${section.id}"><header class="section-header"><div><span class="section-kicker">0${section.index + 1} · ${escapeHtml(section.short)}</span><h2>${escapeHtml(section.label)}</h2></div><span class="section-count">${section.items.length} 条</span></header><div class="card-grid">${cards || '<p class="empty">本期该版块暂无条目</p>'}</div></section>`;
  }).join("");

  const total = globalIndex;
  const stats = sections.map((section) => `<div class="stat"><span>${escapeHtml(section.short)}</span><strong>${section.items.length}</strong></div>`).join("");
  const nav = sections.map((section) => `<button type="button" data-target="${section.id}" aria-label="跳转到${escapeHtml(section.label)}"><span>${escapeHtml(section.short)}</span><strong>${section.items.length}</strong></button>`).join("");
  const sourceUrl = report.attribution?.url || report.links?.aihot || "https://aihot.virxact.com";
  const fallbackNote = fallback ? " · 今日版尚未生成，已回退到最近一期" : " · 今日版";
  const bodyAttributes = liveRefresh ? ` data-live-refresh data-report-date="${escapeHtml(report.date)}"` : "";
  const syncBar = liveRefresh ? '<div class="sync-bar" id="sync-bar" data-state="loading" role="status" aria-live="polite"><div class="sync-message"><span class="sync-dot" aria-hidden="true"></span><span id="sync-status">正在检查最新日报…</span></div><button class="refresh-button" id="refresh-button" type="button">检查更新</button></div>' : "";
  const script = liveRefresh ? enhanceManualRefresh(liveRefreshScript()) : interactionScript();

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0d5d4b"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="AI晨报"><meta name="description" content="${report.date} AI 日报，共 ${total} 条，数据来源 AI HOT。"><title>AI 晨报 · ${report.date}</title>${styles()}</head><body${bodyAttributes}><header class="hero" id="top"><div class="shell"><p class="eyebrow">AI HOT DAILY · MORNING BRIEF</p><div class="hero-main"><div><h1>AI 晨报</h1><p class="hero-copy" id="hero-copy">${escapeHtml(formatReportDate(report.date))}${escapeHtml(fallbackNote)}<br>生成于北京时间 ${escapeHtml(formatBeijingTime(report.generatedAt))} · 数据窗口 ${escapeHtml(formatWindowTime(report.windowStart))} 至 ${escapeHtml(formatWindowTime(report.windowEnd))}</p></div><div class="total"><span>本期收录</span><strong><span id="total-count">${total}</span><small>条</small></strong></div></div><div class="stats" id="stats" aria-label="五版块统计">${stats}</div>${syncBar}</div></header><nav class="nav" aria-label="日报版块导航"><div class="shell nav-inner"><div id="nav-sections" style="display:contents">${nav}</div><a class="archive-link" href="archive/">历史日报</a></div></nav><main class="shell" id="content">${sectionsHtml}</main><footer><div class="shell footer-inner"><p>本期共 <strong id="footer-total">${total}</strong> 条 · 数据来源：<a id="source-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">AI HOT</a> · 首页实时检查，归档每日更新</p><button class="back-top" type="button" data-target="top">返回顶部 ↑</button></div></footer>${script}</body></html>`;
}

function buildArchiveIndex(dates) {
  const items = dates.map((date) => `<li><a href="./${date}.html"><span>${escapeHtml(formatReportDate(date))}</span><span aria-hidden="true">→</span></a></li>`).join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0d5d4b"><title>AI 晨报 · 历史归档</title>${styles()}</head><body><header class="hero"><div class="shell"><p class="eyebrow">AI HOT DAILY · ARCHIVE</p><h1>历史日报</h1><p class="hero-copy">按日期查看已经生成的 AI 晨报。</p></div></header><main class="shell archive-main"><p><a class="archive-link" href="../">← 返回今日晨报</a></p><ul class="archive-list">${items}</ul></main><footer><div class="shell footer-inner"><p>共 ${dates.length} 期 · 数据来源：<a href="https://aihot.virxact.com" target="_blank" rel="noopener noreferrer">AI HOT</a></p></div></footer></body></html>`;
}

await mkdir(ARCHIVE_DIR, { recursive: true });
const { payload, fallback } = await getDaily();
const report = payload.report;
if (!report?.date || !Array.isArray(report.sections)) throw new Error("Unexpected AI HOT daily response");

const dailyHtml = buildDailyHtml(report, fallback, { liveRefresh: true });
await writeFile(path.join(SITE_DIR, "index.html"), dailyHtml, "utf8");
await writeFile(path.join(ARCHIVE_DIR, `${report.date}.html`), buildDailyHtml(report, fallback, { liveRefresh: false }).replaceAll('href="archive/"', 'href="./"'), "utf8");

const archiveFiles = await readdir(ARCHIVE_DIR);
const dates = archiveFiles
  .map((name) => name.match(/^(\d{4}-\d{2}-\d{2})\.html$/)?.[1])
  .filter(Boolean)
  .sort((a, b) => b.localeCompare(a));
await writeFile(path.join(ARCHIVE_DIR, "index.html"), buildArchiveIndex(dates), "utf8");

const counts = Object.fromEntries(sectionMeta.map(({ label }) => [label, report.sections.find((section) => section.label === label)?.items?.length ?? 0]));
console.log(JSON.stringify({ reportDate: report.date, fallback, total: Object.values(counts).reduce((sum, count) => sum + count, 0), counts }, null, 2));
