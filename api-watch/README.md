# API Watch · GitHub API 维护助手

面向个人 GitHub API 项目的维护工具。把 Developer Program 的 API 变更通知整理成任务，并对 Profile Viewer 使用的公开接口做实时抽样检查。

## 使用

1. 点击“运行检查”：实时请求 `/versions`，再检查用户资料与最近更新仓库接口。
2. 收到 API 变更邮件后，填写标题、相关段落和可选期限。
3. 生成清单，逐项核对官方原文、接口行为并完成维护。
4. 导出 Markdown，作为个人记录或 GitHub Issue 草稿（不会自动提交）。

自带标为“虚构示例”的演示通知，不代表 GitHub 发布了实际变更。生成逻辑为关键词匹配，不能理解所有通知，也不验证邮件真伪。日期由使用者核对输入。

## 与开发者计划的关系

API 变更通知是计划提供的权益之一；本工具帮助将通知落实为维护工作。公开 API 检查本身无需会员。它不自动接收邮箱内容、不提高 API 配额、不授予提前体验或开发许可证、不代表 GitHub 官方认证。

## 数据与边界

- 无后端、无 Token、无第三方分析脚本。API 请求直接从浏览器发往 `api.github.com`，不发送通知正文。
- 通知原文不写入存储；生成后从输入框清除。生成任务标题、截止日期、勾选状态保存在同源浏览器 `localStorage`，同源脚本也可访问。请不要输入秘密或保密预览材料。
- 更换浏览器或清除站点数据会丢失任务，按需导出 Markdown。移除卡片会删除其本地记录。
- 每次最多 3 次请求，顺序执行，无自动轮询。遇到 403/429 中止，并尊重 Retry-After/额度重置时间；403 也可能由访问策略导致，界面不会将其一律视为配额耗尽。
- 20 秒整体超时；展示当前出口 IP 的匿名 API 额度，不是会员专属额度。
- 检查核心字段类型和版本支持列表，不比较完整 JSON，不自动升级代码。成功不等于全部行为兼容。
- 浏览器受 CORS 限制，未读到 Deprecation/Sunset 响应头不能证明服务没有弃用计划。

## 本地运行

在父目录运行 `python3 -m http.server 8000 --bind 127.0.0.1`，访问 `http://127.0.0.1:8000/api-watch/`。使用静态 HTTP 服务以加载 JavaScript 模块。

所有文件都位于 `api-watch/`，原 Profile Viewer 的页面与逻辑保持独立。GitHub Pages 会随该目录合并到发布分支而一同发布。

## 官方资料

- https://docs.github.com/en/integrations/concepts/github-developer-program
- https://docs.github.com/en/rest/meta/meta#get-all-api-versions
- https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api
- https://docs.github.com/en/rest/about-the-rest-api/api-versions
