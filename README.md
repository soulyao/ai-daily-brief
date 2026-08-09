# AI Daily Brief

一个面向手机阅读的 AI 晨报站点。每天从 AI HOT 匿名只读 API 拉取最新日报，生成固定首页与日期归档，并通过 GitHub Pages 发布。

## 在线地址

https://soulyao.github.io/ai-daily-brief/

## 自动更新

- 首页每次打开、从后台返回或点击“检查更新”时，都会直接检查 AI HOT 最新日报；因此首页的新鲜度不依赖 GitHub Actions 是否准时。
- 每天北京时间 08:17、08:47、09:17 错峰尝试，避免单次定时任务被平台延迟或丢弃。
- GitHub Actions 负责生成静态快照与日期归档；如果今日日报尚未生成，则回退到最近一期。
- 如果手机网络或 AI HOT 接口暂时不可用，页面会保留最近静态快照并显示回退状态，不会出现空白页。
- 可以在 GitHub Actions 页面手动运行 `Generate and deploy AI daily brief`。

## 本地生成

```powershell
node scripts/generate.mjs
```

生成结果位于 `site/`。

## 数据来源

[AI HOT](https://aihot.virxact.com)；第三方原文权利归原作者与原平台所有。
