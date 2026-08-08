# AI Daily Brief

一个面向手机阅读的 AI 晨报站点。每天从 AI HOT 匿名只读 API 拉取最新日报，生成固定首页与日期归档，并通过 GitHub Pages 发布。

## 在线地址

https://soulyao.github.io/ai-daily-brief/

## 自动更新

- 每天北京时间 08:17、08:47、09:17 错峰尝试，避免单次定时任务被平台延迟或丢弃。
- 如果今日日报尚未生成，回退到最近一期。
- 可以在 GitHub Actions 页面手动运行 `Generate and deploy AI daily brief`。

## 本地生成

```powershell
node scripts/generate.mjs
```

生成结果位于 `site/`。

## 数据来源

[AI HOT](https://aihot.virxact.com)；第三方原文权利归原作者与原平台所有。
