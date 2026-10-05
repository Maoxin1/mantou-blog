# 浏览器验收与参考来源

本目录验证公开作品集的真实访客路径，不替代 `scripts/` 中的内容结构、生成结果和内部链接检查。运行前先生成 `public/`，再执行：

```powershell
npm ci
npx playwright install chromium
npm run test:e2e
```

## 当前验收范围

- 中英文文章及分页归档切换保留当前地址，两种语言各自搜索、RSS、离线说明；
- RSS 逐条包含机器初译或已审校说明；独立 Hugo 内容夹具覆盖 `machine` / `reviewed` 与原文同步 / 过期的四种组合，核对页面与 RSS，不要求未来新文章一律已审校；私有统计入口只链接账户控制台；
- 首页最近更新与跨类型精选 → 作品目录 → 结果与限制的访客路径；
- 自动发现并验收作品集中的全部公开作品；
- 输入中文关键词、获得搜索结果并打开对应作品；
- 首页、作品集、案例页、关于页在桌面、平板和手机宽度下无横向溢出；
- 平板宽度下的长标题不重叠，行高仍可读；
- 页面无 JavaScript 运行时错误；
- `lang`、单一 `h1`、描述和 canonical 等基础语义与 SEO 信息；
- 主题选择刷新后保留、手机导航可用；
- Service Worker接管后，已访问作品断网可读，未访问路径显示离线说明；后台配置不进入离线缓存，避免旧配置误触直接发布；
- 非生产域名不加载 Cloudflare Web Analytics。
- Decap稳定后台与Sveltia灰度后台都能加载并出现GitHub登录入口；Sveltia固定版本、
  SRI和备用CDN，公开配置固定使用PR和压缩合并发布；
- 后台使用真实移动设备参数验证触控环境与窄屏无溢出；全部后台入口与配置均绕过
  Service Worker缓存。

失败时 Playwright 会把截图、trace 和 HTML 报告写入被 Git 忽略的 `test-results/` 与 `playwright-report/`。

## 生产部署冒烟

正式域名和外部成品不进入每次PR的快速门禁。`Deploy Pages` 自动正式发布成功后立即运行一次，GitHub Actions 仍每天运行一次，也可在 Actions 页面手动触发；手动预览部署不会触发正式站检查：

```powershell
npm run test:smoke
```

它检查正式博客关键路径、中英文搜索、两套内容后台、后台`no-store`响应头，以及公开案例链接指向的清单编辑器。部署后检查从该次部署的独立元数据产物读取实际源码 SHA、运行 ID 和重试批次，与正式站不缓存的 `/version.json` 对照，最多等待两分钟以容纳发布传播；不使用下游 `workflow_run.head_sha` 猜测已发布源码。每日和手动冒烟只核对当前线上版本格式及正式分支，不假定最新仓库提交已经上线。失败会重试一次，并保留14天的截图与trace；外部短时故障不会阻塞普通内容提交。

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

## 发布与离线异常回归

- 两种真实固定版本 CMS 的 `preSave` 注册、首次保存别名、重复保存、历史文章与其他集合保持不变；不登录或创建真实草稿
- 严格 YAML/TOML、重复键、正文伪字段、缺失/错误 canonical 和 refresh
- Hugo 临时构建使用独立测试分类（41 篇中文、21 篇英文，每页 20 篇），验证中文第 3 页不会链接不存在的英文第 3 页，同时验证第 2 页的双语对应关系；语言切换回到英文归档，hreflang 不声明不存在的对应页，测试不依赖生产文章数量
- 桌面、平板、手机验证 sticky 导航没有额外页面补偿，首页阅读入口与文章目录标题不被遮挡
- Service Worker 异常执行与浏览器回归覆盖 503、断网、超时、存储失败和缓存隔离

Python 分页与翻译输出集成测试需要 PATH 中存在 Hugo，否则会明确跳过；CI 在运行测试之前安装 Hugo。翻译夹具使用临时源码副本，不修改仓库文章或已有译文状态。

## 评论本地失败与同页提交回归

首轮本地范围对应 Waline spec v0.2 的 TM-002/003/005/019/024：

```sh
HUGO_BIN=/path/to/hugo npm run test:feedback
```

Windows PowerShell 可先设置 `$env:HUGO_BIN = 'C:\path\to\hugo.exe'` 再运行
`npm run test:feedback`；Hugo 已在 PATH 时不用设置。

该命令使用 Node 24 原生测试 runner，无新增 npm 依赖。VM 模块需要显式的
`--experimental-vm-modules`（Node 会打印实验性 API 提醒）：

- Hugo 构建刻画：未配置服务仍生成正文和邮件入口，没有 Waline 入口/脚本
- loader 组件：执行实际加载脚本与 vendored API，DOM、网络、import/init 为受控替身；
  检查明确失败、锁定响应结构、显式恢复、重复打开和初始化次数
- submit 组件：执行实际 vendored 提交/快捷键函数，闭包依赖为受控替身；
  检查明确拒绝保稿、UA 异步窗口和请求中的防重复、早退/异常后解锁
- 3 个固定 seed（20261005/20261006/20261007）下的有限短序列回归；
  失败输出 seed、case、最小确定性重现或操作序列，禁止自动发往真实服务
- vendor 补丁逐字节可重现，升级时未知原始 hash 必须拒绝

这些检查不证明真实数据库持久化、跨设备幂等、未知提交结果恢复、浏览器模块缓存、
实际 CSS/Vue 渲染或真实 DNS/CORS/TLS 行为。对应真实浏览器用例仍在
`tests/e2e/reader-feedback.spec.js`，必要时单独运行：

```sh
npm run test:e2e -- tests/e2e/reader-feedback.spec.js
```

2026-10-05 的本地 Chromium 启动被执行环境的 Unix socket IPC 权限限制阻断；
功能断言未执行，不能把此环境失败当成 TDD 红灯或浏览器通过。已新增的 TM-019
浏览器定义需要在允许启动 Chromium 的隔离环境重新运行。

资源更新另由 `tests/python/test_reader_feedback_assets.py` 在临时 Hugo 构建和
真实 SW 的 Node VM 中检查：loader 与本地 Waline 按文件内容生成 SHA-256 URL，
新页面首次加载避开旧静态缓存。它随 Python 全量测试运行，也可单独运行：

```sh
HUGO_BIN=/path/to/hugo python -m unittest discover -s tests/python -p test_reader_feedback_assets.py -v
```

只覆盖线上重新导航获得新页面的生命周期；旧标签页和离线旧 HTML 保留旧引用。
