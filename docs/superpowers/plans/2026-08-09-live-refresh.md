# AI 晨报实时更新实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 让手机打开首页时直接校验 AI HOT 最新日报，即使 GitHub 定时部署延迟也能显示今天内容。

**Architecture:** 保留生成器输出的完整静态日报作为可靠回退，同时只在首页内联一个无外部依赖的实时同步运行时。运行时在加载、页面恢复可见和手动点击时请求 AI HOT，校验后用安全 DOM API 重绘动态区域；历史归档保持固定快照。

**Tech Stack:** Node.js 22、原生 HTML/CSS/JavaScript、Node test runner、GitHub Pages/Actions。

---

### Task 1: 建立实时更新输出契约

**Files:**
- Create: tests/live-refresh.test.mjs
- Read: site/index.html
- Read: site/archive/2026-08-09.html

- [ ] **Step 1: 写失败测试**

测试读取首页与归档，要求首页包含 data-live-refresh、同步状态、手动刷新按钮、AI HOT latest 接口、cache:"no-store"、pageshow 和 visibilitychange；归档不得包含 data-live-refresh。

- [ ] **Step 2: 验证测试按预期失败**

Run: node --test tests/live-refresh.test.mjs

Expected: FAIL，原因是当前首页没有 data-live-refresh。

### Task 2: 实现首页实时同步与静态回退

**Files:**
- Modify: scripts/generate.mjs
- Modify: site/index.html
- Modify: site/archive/2026-08-09.html
- Modify: site/archive/index.html

- [ ] **Step 1: 给生成器增加首页/归档模式**

buildDailyHtml(report, fallback, { liveRefresh }) 只在 liveRefresh: true 时加入同步状态区、按钮、data-report-date 和实时脚本；归档调用 liveRefresh: false。

- [ ] **Step 2: 实现最小实时运行时**

运行时：

~~~js
const API_URL = "https://aihot.virxact.com/api/v1/dailies/latest";
const response = await fetch(API_URL + "?ts=" + Date.now(), {
  cache: "no-store",
  headers: { Accept: "application/json" },
  signal: controller.signal,
});
~~~

它校验 report.date、report.sections 和固定五版块，拒绝比静态页更旧的数据；动态文本一律使用 textContent，链接仅接受 http: 和 https:。

- [ ] **Step 3: 绑定三种检查时机**

首次加载执行一次；pageshow 在页面由后退缓存恢复时检查；visibilitychange 在页面重新可见且距上次检查超过 60 秒时检查；按钮始终允许手动重试。

- [ ] **Step 4: 添加可见状态与响应式样式**

状态文案覆盖“检查中”“已同步”“已是最新”“实时更新失败，显示最近缓存”，按钮触控高度至少 42 像素，无外部资源。

- [ ] **Step 5: 重新生成页面并验证测试通过**

Run: node scripts/generate.mjs

Run: node --test tests/live-refresh.test.mjs tests/workflow-schedule.test.mjs

Expected: 所有测试 PASS。

### Task 3: 文档与静态约束回归

**Files:**
- Modify: README.md
- Test: tests/live-refresh.test.mjs

- [ ] **Step 1: 记录新的更新机制**

README 说明首页打开时实时检查、GitHub Actions 仅负责快照与归档、接口失败显示最近缓存。

- [ ] **Step 2: 验证单文件及内容约束**

测试确认首页没有外部 CSS/JS，五个版块均存在，原文链接包含 target="_blank" 和 rel="noopener noreferrer"，生成内容没有 ISO 时间正文。

- [ ] **Step 3: 运行完整测试与差异检查**

Run: node --test tests/*.test.mjs

Run: git diff --check

Expected: 全部 PASS，diff 无空白错误。

### Task 4: 发布与线上手机验收

**Files:**
- Commit all changed files.

- [ ] **Step 1: 提交并推送**

Run: git add scripts/generate.mjs tests/live-refresh.test.mjs site README.md docs/superpowers/plans/2026-08-09-live-refresh.md && git commit -m "fix: refresh daily brief in the browser" && git push origin main

Expected: 远端 main 包含新提交。

- [ ] **Step 2: 触发并等待 Pages 部署**

Run: gh workflow run daily.yml --repo soulyao/ai-daily-brief

Run: gh run watch --repo soulyao/ai-daily-brief RUN_ID --exit-status

Expected: build 和 deploy 均 success。

- [ ] **Step 3: 浏览器桌面和手机验收**

验证流程：公网首页加载 → 同步状态变为已同步或已是最新 → 点击“检查更新”后状态更新时间改变 → 点击版块导航滚动到目标版块。

检查 1200×800 与 390×844 两种视口：无横向溢出、无重叠、非空白、无框架错误覆盖层、控制台无相关错误。

- [ ] **Step 4: 验证真实缓存修复**

用带旧静态日期的本地测试页加载同一运行时，确认其从 AI HOT 切换到当日日期和当日卡片；再模拟接口失败，确认静态内容保留且状态显示回退。
