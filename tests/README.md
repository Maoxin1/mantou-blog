# 浏览器验收与参考来源

本目录验证公开作品集的真实访客路径，不替代 `scripts/` 中的内容结构、生成结果和内部链接检查。运行前先生成 `public/`，再执行：

```powershell
npm ci
npx playwright install chromium
npm run test:e2e
```

## 当前验收范围

- 首页 → 代表作品 → 证据与复盘 → 工作原则的访客路径；
- 自动发现并验收作品集中的全部公开作品；
- 输入中文关键词、获得搜索结果并打开对应作品；
- 首页、作品集、案例页、关于页在桌面、平板和手机宽度下无横向溢出；
- 平板宽度下的长标题不重叠，行高仍可读；
- 页面无 JavaScript 运行时错误；
- `lang`、单一 `h1`、描述和 canonical 等基础语义与 SEO 信息；
- 主题选择刷新后保留、手机导航可用；
- Service Worker接管后，已访问作品断网可读，未访问路径显示离线说明；
- 非生产域名不加载 Cloudflare Web Analytics。

失败时 Playwright 会把截图、trace 和 HTML 报告写入被 Git 忽略的 `test-results/` 与 `playwright-report/`。

## 生产部署冒烟

正式域名和外部成品不进入每次PR的快速门禁。GitHub Actions每天运行一次，也可在Actions页面手动触发：

```powershell
npm run test:smoke
```

它检查正式博客关键路径、正式中文搜索，以及公开案例链接指向的清单编辑器。失败会重试一次，并保留14天的截图与trace；外部短时故障不会阻塞普通内容提交。

## 参考仓库审计

审计日期为 2026-08-31。测试为针对本 Hugo 站点重新编写的验收，借鉴测试分层和检查思路，没有复制参考仓库的测试实现。

| 参考仓库 | 审计结果 | 本项目的取舍 |
| --- | --- | --- |
| [Case](https://github.com/erlandv/case) | 未发现独立测试或 CI；`build` 包含 `astro check` | 保留“问题、约束、决策、结果”的案例结构，不移植测试 |
| [Lewis Kori Portfolio](https://github.com/lewis-kori/astro-portfolio-v3) | 未发现独立测试或 CI | 保留作品、文章和关于页的内容分层，不移植测试 |
| [al-folio](https://github.com/alshedivat/al-folio) | 7 个 shell 集成测试、1 个样式契约、3 个 Playwright 视觉规格，并有可访问性、断链和视觉回归工作流 | 借鉴运行时错误、交互、响应式与构建契约思路；不采用跨框架像素快照 |
| [Adritian](https://github.com/zetxek/adritian-free-hugo-theme) | 37 个 Playwright E2E 规格、6 个 Node 单元测试、1 个 shell 构建测试、13 张视觉快照 | 主要来源：访客路径、移动导航、主题持久化、SEO、语义和无溢出验收 |
| [Portfolio Template](https://github.com/hmbldv/portfolio-template) | 未发现独立测试或 CI | 保留项目归档、深色主题等设计参考，不移植测试 |
| [Blowfish](https://github.com/nunocoracao/blowfish) | 未发现独立 test/spec；CI 负责 Hugo 示例构建，并提供 Lighthouse 配置 | 现阶段保留 Hugo 生产构建门禁；Lighthouse 暂不纳入每次 CI |
| [Magic Portfolio](https://github.com/once-ui-system/magic-portfolio) | 未发现独立测试或 CI，只有 lint/build 脚本 | 仅作视觉与作品信息架构参考，不移植框架代码或测试 |

没有采用视觉像素基线，是因为中文字体在 Windows、Linux 和移动设备上的渲染差异容易制造伪失败；没有把 Lighthouse 放进每次提交，是因为单次波动和执行成本暂时高于当前收益。出现真实性能问题后，再用明确预算补充性能验收。
