# GitHub Profile Viewer

一个使用 **GitHub REST API** 的公开用户资料查看器，由 [stefaneliu](https://github.com/stefaneliu) 制作。输入用户名，即可查看公开资料和最近更新的 6 个公开仓库。

[项目仓库](https://github.com/stefaneliu/github-profile-viewer) · [GitHub REST API 文档](https://docs.github.com/en/rest)

这是独立开发实践，与 GitHub 官方无隶属关系。Pages 需要在仓库设置中启用；以 **Settings → Pages** 显示的实际部署状态为准。

## 功能

- 查询头像、姓名、简介、位置、个人网站、加入日期、公开仓库数及关注数据。
- 展示最近更新的最多 6 个公开仓库（含 Fork），显示语言、Star 和 Fork 数。
- 桌面和手机响应式布局、键盘操作、状态消息播报。
- 输入校验，以及用户不存在、拒绝访问、限流、网络故障和 15 秒超时提示。
- 仓库加载失败时保留已加载的资料；新查询取消旧请求，避免结果串台。
- 用 `?user=octocat` 分享查询；页面打开后请求真实数据。
- 无构建依赖，无需登录，不收集或保存访问令牌。

## 实际 API 调用

```text
GET https://api.github.com/users/{username}
GET https://api.github.com/users/{username}/repos?sort=updated&direction=desc&per_page=6&type=owner
```

请求头为 `Accept: application/vnd.github+json` 和 `X-GitHub-Api-Version: 2026-03-10`。成功完成一次查询通常消耗 2 次请求。未认证请求的主要限额通常为每 IP 每小时 60 次，且可能另受次级限流影响；同一出口网络上的访问者可能共享额度。界面读取限流响应头，在可用时显示预计恢复时间。

数据来自公开接口，不获取私有仓库。仓库列表只显示一页 6 项，不代表全部仓库或贡献统计。没有缓存或后台数据库；浏览器直接连接 GitHub API 和 GitHub 头像服务。点击个人网站会访问该用户提供的外部网址。

资料和描述通过 `textContent` 渲染；链接仅允许 HTTPS，仓库链接限制为 `github.com`，头像限制为 `avatars.githubusercontent.com`。页面不需要 Token，请勿将任何秘密写入前端文件。

## 本地运行

在本目录启动静态服务器：

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

打开 `http://127.0.0.1:8000`。停止服务按 `Ctrl+C`。无需安装 Node.js 或其他依赖。

## 启用 GitHub Pages

1. 将页面 PR 合并到 `main`。
2. 打开仓库 **Settings → Pages**。
3. **Build and deployment → Source** 选择 **Deploy from a branch**。
4. **Branch** 选择 `main`，目录选择 **/(root)**，点击 **Save**。
5. 等待 Pages 构建完成，打开设置页返回的站点地址，查询 `octocat` 进行验证。
6. 验证后，将站点地址填入仓库 **About → Website**，也可放入个人 GitHub Profile 的网站字段。

标准项目站点预期地址为 `https://stefaneliu.github.io/github-profile-viewer/`。这是预期地址，只有 Pages 构建成功后才可作为在线演示使用。`.nojekyll` 用于禁用 Jekyll 处理。

## 验证

已在本地浏览器中验证 `stefaneliu` 和 `octocat` 的真实 API 查询，以及 390 像素宽度下的布局。逻辑模拟验证覆盖输入错误、404、403、429、限流、网络失败、仓库部分失败、空仓库、超时、连续查询与文本/链接安全处理。

修改后可手动检查：

1. 查询 `octocat`，确认资料、仓库与 GitHub 页面一致。
2. 输入空值或 `a--b`，确认输入提示；输入不存在的合法用户名，确认 404 提示。
3. 断开网络后查询，确认网络提示；恢复网络后重新查询。
4. 连续切换示例，确认显示最后选择的用户。
5. 检查手机宽度、键盘 Tab/Enter，以及 `?user=octocat` 链接。
6. 限流和超时使用模拟响应验证，避免故意耗尽 API 配额。

## 项目结构

```text
index.html   页面结构与项目介绍
styles.css   响应式样式
app.js       GitHub REST API 请求、校验、错误处理与安全渲染
.nojekyll    禁用 Jekyll 处理
README.md    项目说明与发布步骤
```

## 用于 Developer Program 申请

发布后可如实描述：

> GitHub Profile Viewer 是一个使用 GitHub REST API 的静态 Web 工具，可查询公开用户资料和最近更新的公开仓库，包含输入校验、限流与网络错误处理，以及响应式界面。

请使用真实可访问的项目和演示链接，并按申请页面当时的要求提交。本项目不会自动注册 GitHub App 或 OAuth App，不代表已通过 Developer Program 审核。

## 官方参考

- [用户资料接口](https://docs.github.com/en/rest/users/users#get-a-user)
- [用户仓库接口](https://docs.github.com/en/rest/repos/repos#list-repositories-for-a-user)
- [REST API 版本](https://docs.github.com/en/rest/about-the-rest-api/api-versions)
- [REST API 限流](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [GitHub Pages 发布源设置](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
