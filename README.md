# mantou-blog

`mantou-blog` 是使用 Hugo 和 LoveIt 主题构建、部署到 Cloudflare Pages 的中文个人博客。仓库同时包含 Decap CMS 配置、Pagefind 站内搜索和图片压缩自动化。

线上站点：https://mantou-blog.pages.dev/

## 本地验证

需要 Hugo Extended 0.154.5、Python 3.12 或更高版本，以及 Node.js/npm。

```powershell
python scripts/validate_admin_config.py
python scripts/validate_posts.py
python scripts/validate_portfolio.py
python -m unittest discover -s tests/python -p "test_*.py"
hugo --minify --panicOnWarning --cleanDestinationDir
npx --yes pagefind@1.5.2 --site public
python scripts/check_internal_links.py
python scripts/check_portfolio_output.py
npm ci
npx playwright install chromium
npm run test:e2e
```

其中 Python 脚本检查内容结构、CMS契约、投资隐私预检、生成结果与内部链接；Playwright 在真实 Chromium 中验证首页到案例的访客路径、全部公开作品、中文搜索、桌面/平板/手机布局、主题与移动导航、基础语义以及页面运行时错误。失败时会生成 `playwright-report/` 和 `test-results/`，这两个目录不提交到 Git。测试范围、参考来源和未移植项见 [`tests/README.md`](tests/README.md)，新功能先使用[`功能验收模板`](docs/feature-acceptance-template.md)定义主张与失败条件，并在[`边缘风险登记表`](docs/edge-case-register.md)记录仍未覆盖的风险。投资作品发布前还需完成[`人工检查单`](docs/investment-publication-checklist.md)。

Cloudflare Pages 项目采用 Direct Upload，验证和部署是两条相互隔离的流水线：

- `Validate` 在 PR 与 `main` 上运行全部校验，不读取任何 Cloudflare 凭据，也不部署；
- `Deploy Pages` 只在 `main` 验证成功后自动发布正式站；需要在线预览时，从 `main` 手动运行该工作流并填写待预览的分支、标签或提交；
- 待发布源码先在无凭据的任务中构建并验证，只有受 `pages-deploy` Environment 和 `main` 分支限制的部署任务能够读取最小权限凭据；
- Wrangler 固定在 `package-lock.json` 中，`public/` 和 Hugo 本地缓存不提交到 Git。

具体操作、权限边界与凭据轮换步骤见[`部署运行手册`](docs/deployment-runbook.md)。

## 内容管理

Decap CMS 位于 `/admin/`，通过仓库指定的 OAuth 代理登录。后台采用Editorial Workflow：保存草稿会建立`cms/...`分支和PR，等待`validate`通过后再使用压缩合并发布，不能直接绕过受保护的`main`。字段定义见`static/admin/config.yml`，完整操作和故障处理见[`后台发布手册`](docs/cms-publishing-runbook.md)。

图片推送到 `static/images/` 或文章包后，GitHub Actions 会用固定版本的 Pillow 压缩符合条件的 JPEG/PNG，并且只提交图片目录中的变化。

## 仓库结构

- `content/`：文章和特殊页面；
- `data/`：站点使用的结构化数据；
- `layouts/`、`assets/`：主题覆盖与自定义样式；
- `static/`：图片、视频、PWA 和 CMS 静态资源；
- `themes/LoveIt-0.3.0/`：随仓库维护的 LoveIt 主题版本；
- `scripts/`：内容、构建和图片验证工具。

本仓库中的文章、健康记录和其他数据会随公开站点发布；提交者应只加入明确准备公开的信息。

## 许可

仓库原创代码采用 [MIT License](LICENSE)。博客文章、图片和个人数据不包含在 MIT 许可中，详见 [CONTENT_LICENSE.md](CONTENT_LICENSE.md)。LoveIt 主题及其第三方依赖遵循各自随附的许可证。
