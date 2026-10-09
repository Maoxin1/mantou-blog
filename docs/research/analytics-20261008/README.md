# 博客访问统计行为与证据研究

研究日期：2026-10-08，Asia/Shanghai。关联功能：[ANL 功能台账](../../feature-ledger.md)。研究 ID：`RES-ANL-001`。

当前需要的是已有参考行为及其证据，少量问题需确定产品验收口径。基础统计已经有接入和查看入口，没有证据要求更换服务商或验证新的架构。本次跳过外部开源项目对比、新仓库克隆和技术 spike，复用现有博客副本、历史 PR 与官方文档。研究不交付正式功能，也不把隔离演示作为生产数据验收。

## 1 项目比较与主要参考选择

此次没有进行开源候选排名。下面比较的是可用证据来源；Cloudflare 是服务商，不冒称其统计后端为已审查的开源项目。

| 来源 | 功能接近程度与成熟度 | 维护及历史 | 测试与真实使用证据 | 选择 |
| --- | --- | --- | --- | --- |
| [mantou-blog 当前主分支](https://github.com/Maoxin1/mantou-blog/tree/39b51748776c4f723007b60c3c77893d16c8faf2) | 与已采纳范围完全一致：Hugo 静态博客、PV/Visits、页面/来源、服务商私有后台；接入与入口已部署 | 最新提交 2026-10-07；统计主机隔离追溯到 PR #39，入口追溯到 PR #105 | 两条直接相关 E2E 本次通过；正式 HTML 有入口和加载器；真实 Analytics 数据仍未查看 | **主要实现参考**。复用本地副本，不把实现自动当作正确规范 |
| Cloudflare Web Analytics 官方文档与 beacon 发布记录 | 直接规定当前服务的指标和限制；能回答采样、来源及不支持的能力 | 发布记录包含 2026-10-05 兼容性与配置变化、2026-09-02 CLS 修复 | 可查官方说明；未取得服务内部测试、部署版本、Issue 全集或本站后台结果 | **主要能力口径依据**，不能替代本站端到端验收 |
| [现有 PR #114](https://github.com/Maoxin1/mantou-blog/pull/114)，head `52c37696a95bea98fe13fb458c596f676498b100` | 已有 Umami 与行为漏斗候选；超出已采纳 A | 本次复核仍 OPEN、CONFLICTING；Website ID 为空 | PR 记录候选验证；本次未执行候选测试，也未审查 Umami 上游全套测试及历史 | 保留未来参考，不启用、不合并、不重新做 Umami/Plausible/GoatCounter 对比 |

“是否可看到本人的真实数据”是账户与生产配置证据问题；多研究几个开源项目不会解决它。当前方案也没有尚待探索的算法、存储或新 API，因此不制作技术原型。最小浏览器观测是现有实现的研究仪器，单独保存在本目录，不是新统计实现。

当前项目原创代码的 [LICENSE](../../../LICENSE) 为 MIT。此次没有移植外部项目代码，也没有对 Cloudflare 服务代码作再分发许可判断。未来若复用候选或上游代码，应重新核对实际文件和版本的许可证，而非沿用此结论。

## 2 Feature Tests Bugs Design Decisions 证据索引

实现基线为 `39b51748776c4f723007b60c3c77893d16c8faf2`。除另注明，下面文件均指此版本。

证据状态按用户定义记录：**A** 有测试未执行；**B** 在记录的版本、命令、环境执行通过；**C** 从实现推断；**D** 来自 Issue、历史讨论或发布说明，未在本站复现该历史问题；**E** 暂时无法确定。官方能力文档另标为“官方口径”，不冒充执行通过。一个结论可同时有 B 与 C 支持，但 B 的范围不自动扩展。

### 调用关系

```text
Hugo 公开页面
  layouts/_default/baseof.html:15
    → layouts/partials/head/custom.html:5
      → layouts/partials/analytics.html:4-11
        → 精确检查 window.location.hostname
        → 创建 module script，设置公开站点标识，追加到 head
        → Cloudflare 托管 beacon
        → 服务商采集与后台聚合（本次未验证）

static/admin/index.html:16 或 static/admin/sveltia/index.html:41
  → static/admin/analytics/index.html:10
    → Cloudflare 登录与站点权限（本次未验证）

static/sw.js:108-117
  → 非 GET、跨源、/admin 请求直接放行
  → 不由博客离线缓存接管外部统计脚本
```

项目覆盖的 `layouts/_default/baseof.html` 才是实际注入点；不能只看到 vendored 主题文件就判断没有统计。后台入口是独立静态 HTML，不经过该公开页面模板。这里的精确主机限制是本站特有规则，比服务商允许的域名范围更窄。

| 索引 | Feature 与实现 | Tests 与状态 | Bugs 与历史证据 | Design Decisions 与适用边界 |
| --- | --- | --- | --- | --- |
| IDX-ANL-01 | ANL-006：`layouts/partials/analytics.html:4-11` 精确生产主机判断、动态加载 | **B** `tests/e2e/portfolio.spec.js:371`；**B** 隔离生产/预览观测 | [PR #39](https://github.com/Maoxin1/mantou-blog/pull/39)、[提交 dee6a8f](https://github.com/Maoxin1/mantou-blog/commit/dee6a8ffc289e9148a6190bfb085fd01bf9fa9d7)的 patch 把无条件加载改为生产主机判断；已核对差异。未找到独立误报 Issue，不宣称曾复现污染 Bug | **C** 防止开发与预览流量污染，保留原公开站点标识；这是预防性治理，不是已证明发生的事故 |
| IDX-ANL-02 | ANL-005：两套 CMS → 统计静态页 → Cloudflare | **B** `tests/e2e/bilingual.spec.js:98`：noindex、目标链接、无 iframe；**B** HTTP 静态快照 | [PR #105](https://github.com/Maoxin1/mantou-blog/pull/105)、[提交 49f16e1](https://github.com/Maoxin1/mantou-blog/commit/49f16e13131a1b7f3d32a4c83ee7ed43fd581887)新增入口和测试 | 不在博客内嵌真实数据；权限由服务商提供。**E** 实际登录和越权拒绝未验。测试名称里的“需要登录”没有相应认证断言 |
| IDX-ANL-03 | ANL-007：loader 不把正文或导航放在统计成功回调里 | **B** 拦截脚本后 h1 可见、点击桌面作品导航成功；**C** 无显式 onerror、队列或重试循环 | 未检索到本站直接针对 beacon 故障的 Issue/修复；现有一般运行时检查不等于故障注入测试 | 阅读与统计加载没有该代码层面的成功依赖；本次只证实正文和作品导航，不能扩展为搜索、评论全链路通过 |
| IDX-ANL-04 | ANL-007/008：刷新新文档重新创建脚本；本地无访问计数持久化 | **B** blocked → reload → stand-in 加载一次；**C** loader 不写 localStorage/IndexedDB、不补发失败数据 | 未找到本站离线统计补报的实现或回归 | 刷新会重试加载，不证明真实服务恢复或遗漏访问可补回；替身只代表脚本可执行 |
| IDX-ANL-05 | ANL-006/007：SW 放行跨源与后台请求，后台响应 no-store | **A** `tests/e2e/pwa.spec.js:38`、`tests/python/test_service_worker_reliability.py:362`、`tests/smoke/deployment.spec.js:120`相关定义；**C** SW 分支；**B** 本次静态 HTTP 中后台 no-store | [PR #132](https://github.com/Maoxin1/mantou-blog/pull/132)及[当前提交](https://github.com/Maoxin1/mantou-blog/commit/39b51748776c4f723007b60c3c77893d16c8faf2)修正带 redirected 标记的缓存响应回放；已核对源码差异，历史重现结果仍为 **D** | `navigationResponse()`重建可导航响应，缓存 v5→v6；这是阅读可靠性的相关修复，**不是统计计数 Bug**。本次隔离观测禁用了 SW，不证明该回归通过 |
| IDX-ANL-06 | ANL-001/003/004/008：服务商计算与来源维度 | 官方[指标定义](https://developers.cloudflare.com/web-analytics/data-metrics/high-level-metrics/)、[维度](https://developers.cloudflare.com/web-analytics/data-metrics/dimensions/)、[FAQ](https://developers.cloudflare.com/web-analytics/faq/)；**E** 本站后台及实际数值 | 服务商公开[beacon 发布记录](https://developers.cloudflare.com/web-analytics/changelog/)有 CLS 精度和兼容性修复，历史记录为 **D**，未复现供应商 Bug | 保留 Visits 与 UV 区别；筛选、采样和真实数据时区需要验收；官方能力不等于本账户已启用 |

### 测试类型覆盖

| 类型 | 本功能相关证据 | 限制 |
| --- | --- | --- |
| 单元或组件 | loader 没有专用已发现单元套件；SW 的 Node VM/Python 组件用例含跨源和后台放行 | SW 用例为 A，本次未执行；不证明服务商计数算法 |
| 集成、E2E | 两条直接相关 Playwright E2E 为 B；隔离观测执行当前构建 HTML 与实际 loader | 实际 Cloudflare 脚本和采集后端未执行，服务商端到端为 E |
| 回归 | PR #39 主机限制伴随负向测试；PR #132 有真实 HTTP 重定向模拟及 SW 回归定义 | 历史 PR 的全套通过是历史报告，本次只给自己实际执行的两条标 B |
| 快照 | 本轮保存 HTTP 与浏览器观测 JSON，作为证据快照 | 不是具备基线比较的自动快照测试；未发现统计专用视觉/报表快照 |
| 兼容性 | 本轮 Chromium；官方 beacon 更新记载 ES2017 与 iOS/MacOS 改善 | 本轮未执行 Firefox、WebKit、iOS/Android 真人统计验证 |
| 属性、模糊、状态机 | 在本次相关路径和测试扫描中未发现统计专用属性/模糊/模型化状态机测试 | 观测覆盖少数固定状态转换，不冒称状态机测试；其他评论模块的固定 seed 测试不能算本功能覆盖 |

### 执行记录

工作目录：`D:\mx\github\Maoxin1\mantou-blog-monitoring-plan`。环境为 Windows amd64、Node `24.18.0`、Python `3.12.10`、Hugo Extended `0.154.5`、Playwright `1.62.1`、Chromium `151.0.7922.34`（revision 1234）。复用已有 `D:\mx\github\Maoxin1\mantou-blog\node_modules`，其中测试包版本与本基线一致，没有安装新的产品依赖。

构建命令 `hugo --minify --panicOnWarning --cleanDestinationDir` 成功，生成中文 254 页、英文 253 页。只运行入口与加载隔离测试，不需要为它们重复生成搜索索引；这也意味着本次不验证搜索。

```powershell
$env:NODE_PATH = 'D:\mx\github\Maoxin1\mantou-blog\node_modules'
$env:PYTHONUTF8 = '1'
node 'D:\mx\github\Maoxin1\mantou-blog\node_modules\@playwright\test\cli.js' test --grep '非生产域名不会加载 Cloudflare 统计脚本|统计入口指向需要登录的 Cloudflare 后台' --reporter=line
node 'docs\research\analytics-20261008\browser-observations.cjs'
```

结果分别为 **2 passed** 和 **4 isolated observations passed**。原始记录：[现有 E2E 日志](existing-e2e.log)、[浏览器观测日志](browser-observations.log)、[观测 JSON](browser-observations.json)、[HTTP 快照](live-http.json)。观测代码：[browser-observations.cjs](browser-observations.cjs)。

观测使用本地 Hugo 输出映射生产/预览主机，所有请求通过本地文件、脚本替身或 abort 完成。没有向统计服务发送请求，未执行服务商脚本，SW 被禁用。生产主机是隔离路由条件，不能把它写成正式站在线测试。成功替身只有一个执行标记，不实现采集或计数；恢复观测只证明页面刷新重新执行加载。

观测的 loader SHA-256：`b0f45ba725a16691944a1fcd7357ae50f6ad5e1ce159b804bbeface3937f701a`。HTTP GET 不执行 JavaScript：中文首页与英文首页各有一个自定义加载器、无额外直接 beacon 标签；统计入口无加载器。这只限制该时刻返回 HTML 的重复注入风险，不能证明账户配置在所有页面、地区、缓存或未来版本都不重复。

## 3 参考行为记录

以下为当前行为或服务口径，不是自动采纳的新规范。适用需求沿用台账 ID。

| 类别与行为 ID | 参考行为 | 状态与证据 | 适用范围或待决定事项 |
| --- | --- | --- | --- |
| 正常 RB-ANL-01 | 生产页面尝试加载 module beacon；非生产主机返回而不追加脚本 | B、C；IDX-ANL-01 与观测 | 本站精确主机白名单特有；更换域名需要更新配置，不能泛化为所有 Pages 子域都采集 |
| 正常 RB-ANL-02 | CMS 经静态入口跳到服务商，不在博客显示报表 | B、C；IDX-ANL-02 | 已采纳后台位置；公开入口的 noindex 是索引指令，不是认证或权限控制 |
| 边界 RB-ANL-03 | 中文和英文具有不同 URL；loader 不合并成同一内容 ID | C；模板及 `docs/bilingual-site.md:49` | 按路径分别看符合当前说明；按同篇内容合并是产品选择，不由现有代码决定 |
| 无效配置 RB-ANL-04 | 站点域名或上报条件不匹配可能导致采集失败 | 官方 FAQ；本站结果 E | 不通过 GET 采集端点判健康、不自造采集载荷；下一步核对账户站点与真实 beacon |
| 状态 RB-ANL-05 | 文档加载 → 主机判断 → 脚本尝试 → 被拦截时正文/作品导航仍可操作 | B；blocked 观测 | 不把预期网络错误当成正文崩溃；搜索和互动仍需独立验收 |
| 恢复 RB-ANL-06 | 刷新新文档会再次加载；没有已发现的离线队列或显式自动重试 | B（替身加载）、C（缺少队列） | 不承诺统计服务真实恢复或补回漏计 |
| 并发 RB-ANL-07 | 每个文档初始化独立；loader 无重复执行保护 | C；loader 创建并 append，无去重标记 | 不能据此推断多标签页为多人；没有实测服务端并发合并。未来重复注入需单独检查 |
| 持久化 RB-ANL-08 | 博客不保存统计总数；数据是否进入后台取决于服务商 | C、E；IDX-ANL-04/06 | 本地演示不能证明持久化、历史数据或数据恢复 |
| 失败 RB-ANL-09 | 来源缺失、统计拦截和网络波动可以造成未知来源或漏计 | 官方说明；本站样本 E | “直接/未知”具体显示与分类仍需后台验收；不能等同于主动输入地址 |
| 兼容 RB-ANL-10 | module 设置符合供应商当前接入说明；供应商持续更新托管脚本 | 官方说明、D；发布记录 | 宿主 loader 自身也使用现代语法。只实测 Chromium，不承诺旧浏览器全面兼容 |
| 安全 RB-ANL-11 | 公开站点标识用于采集，静态页无管理密钥和访客报表 | C；入口和 loader 审阅 | 不能把公开采集标识当作管理 API 密钥；后台权限本次为 E，不宣称已证明越权防护 |

Cloudflare 官方 FAQ 的相关约束：无 UTM/自定义事件支持；仅客户端统计；上报可在加载及离开页面时发生；可能被拦截或漏计；原始数据近 7 天未采样，查询仍可能采样；目前可查此前 6 个月。手动和自动注入不可重复，托管 beacon 不支持版本固定。以上是服务口径，本账户的可见历史、延迟、时区仍待核对。[官方 FAQ](https://developers.cloudflare.com/web-analytics/faq/)

指标定义中 Visits 按来路计算，可以包含多个 PV；后台 Referer 维度提供来源主机，不能据此承诺具体社群/活动归因。设备和机器人过滤是官方列出的维度，但“Exclude Bots”不能证明所有机器人都已剔除。[指标定义](https://developers.cloudflare.com/web-analytics/data-metrics/high-level-metrics/)、[维度](https://developers.cloudflare.com/web-analytics/data-metrics/dimensions/)

公开更新记录中的 2026-09-02 CLS 精度修复、2026-10-05 兼容与配置更新，提示应记录浏览器和时间，不能把动态脚本 URL 当固定版本。没有从这些记录推导本站 PV/Visits 存在 Bug，也未复现相应供应商故障。[beacon 发布记录](https://developers.cloudflare.com/web-analytics/changelog/)

## 4 未知项与研究范围限制

| 未知 ID | 类型与关联 | 当前结论 | 下一步证据或决策 |
| --- | --- | --- | --- |
| UNK-ANL-01 | 生产证据；GAP-ANL-01、ANL-005/008 | E：未取得本人账户内数据、角色权限或无权限拒绝结果 | 查看正确站点，在固定区间核对 PV/Visits、页面与来源；保存遮蔽无关账户信息的证据 |
| UNK-ANL-02 | SPEC GAP；GAP-ANL-03/06 | E：具体上报延迟、时区和无数据判据未定 | 测一次正常上报与后台刷新，再约定等待窗口；24 小时仍只是旧台账候选，不是供应商 SLA |
| UNK-ANL-03 | 配置证据；GAP-ANL-04 | 单次正式 HTML 未看到重复直接注入；完整控制台配置仍 E | 核对自动注入、站点规则与实际脚本数量；无需先新增第二套采集 |
| UNK-ANL-04 | 产品决定；GAP-ANL-05 | 官方不支持 UTM；可获得来源与活动归因是不同目标 | 现有 A 继续只要求来源；若必须区分活动，重开范围。现有 Umami 候选也需适配当前主分支 |
| UNK-ANL-05 | 验收细化；ANL-007 | B 只覆盖统计脚本拦截后的正文与作品导航 | 搜索、互动、SW 离线等尚未因本次观测获得通过证据；必要时运行已有相关验收，不重复全部测试 |
| UNK-ANL-06 | 能力边界；ANL-001/004/008 | 官方已说明采样与有限历史，本账户实际数据 E | 验收不能要求共享生产总数精确加 1；记录区间、筛选及可见精度。是否接受具体误差是待确认产品口径 |

研究访问与历史覆盖：

- 本地仓库仍为 shallow clone；本次通过 GitHub API 补查特定路径提交、选定提交 patch 和 PR #39/#105/#114/#132，**没有获取完整 Git 历史**。
- 对 `layouts/partials/analytics.html` 的路径历史 API 返回 2 条，对统计入口返回 1 条；也查看 `portfolio.spec.js` 的路径历史摘要。不能由摘要声称每个历史版本均已执行或不存在其他回归。
- 用 `analytics`、`统计` 进行 Issue/PR 搜索，并筛选仓库 Issues API 首批 100 项。结果没有识别出直接相关、可复核的独立统计故障 Issue；搜索漏检、分页与未公开讨论仍可能存在。没有读到的内容不等于不存在。
- GitHub Releases API 查询成功，前 10 项查询结果为空；本项目查到的变更依据主要是提交和 PR。供应商发布记录另有公开页面，两者不可混用。
- Cloudflare 采集与后台不是本次可审查的开源源码；没有其内部单元、属性、模糊或全套兼容测试，以及私有 Issue、客服工单或事件记录。官方 FAQ 是约束说明，不是本站故障重现证据。
- 真实登录、服务端采集、存储、指标算法与历史报表、真实来源样本、Firefox/WebKit 与移动真机均未检查。PR #114 的旧测试及服务商历史修复为历史资料，没有升级为本次 B。

研究结果不改变已采纳的 A 范围。待确认建议仍留在台账；下一步优先取得后台数据与时间口径证据。没有适用的技术 spike：未知主要是账户/配置、真实数据和产品判据，替身原型无法解决它们。
