# ANL 本地实施与验收记录

2026-10-08；功能 `ANL`。关联[台账](../../feature-ledger.md)、[规范](../../specs/analytics-v1.md)、[Test Matrix](../../test-matrix-analytics.md)。源码基线 `39b51748776c4f723007b60c3c77893d16c8faf2` 加本地未提交测试/流程变更；未提交、推送或部署。

**已完成本次授权的本地可验证范围，ANL 整体待人工验收。** 用户确认按已采纳 ANL 范围继续，真实后台与 SPEC GAP 场景仍保留阻塞。现有统计页面和接入符合本次可测行为，无需新建接入、接口或修改页面功能逻辑。本轮新增的是正式测试、属性反例保留、执行入口与 CI 快速检查，并修复 Windows 固定包字节保真问题。

## 行为与小循环

| 行为与需求 | 测试及结果 | 最小实现或修复 | 循环性质 |
| --- | --- | --- | --- |
| 指标解释，ANL-001、ANL-012/013 边界；TM-ANL-001 | 先新增双语真实页面断言，再执行；1/1 直接通过，[日志](metrics-e2e.log) | 页面已有正确说明，没有改写它制造缺陷 | 已有行为补测试，不是红绿 TDD |
| 主机/后台边界，ANL-006；TM-ANL-009 | 先写实际 loader 控制样例及 GP-ANL-01；2/2 直接通过，192 生成样本；再写构建页面的四条隔离 E2E，4/4 通过 | 正式 helper 从真实源码/构建产物读取，不复制替代统计实现；当前 loader 不需改动 | 已有行为补正式测试；研究结果未代替执行 |
| 未启用范围，ANL-008、ANL-012/013/014 边界；TM-ANL-012 | 选定服务接入/入口边界检查 1/1 直接通过，[日志](scope-unit.log) | 仅检查实际接入、不启用候选服务；不扫描/禁止博客其他既有评论服务 | 直接验证已有正确行为 |
| 新文档恢复机会，ANL-007/008；TM-ANL-013 | blocked→正常新文档→模块可执行正式 E2E，1/1 直接通过，[日志](recovery-e2e.log) | 将研究思路重写为独立受控 helper，所有外部请求拦截；不运行真实 beacon | 不承诺真实入库或历史补采，未扩大行为范围 |
| 公开产物与解释边界，ANL-005/014、ANL-001/012；TM-ANL-007/014 | [产物审阅](public-artifact-review.json)、[语义样例审阅](semantics-review.json)有执行日期、文件 hash 与结论 | 只读检查列明产物与说明；没有将模拟身份或样例数值当生产记录 | 人工本地验收；不证明服务商授权或真实统计 |
| 回归与执行入口 | 基线两条 E2E、SW 单测通过；新增正式测试进入 `npm run test:analytics` 和现有 Validate 的快速步骤 | 扩展手动 runner 为 8 条浏览器选择，默认仍 Prepare；Node 单元可用 Unit 模式 | 不是每次编辑都自动启动浏览器 |

测试审阅时剔除了“配置只能有 token 一个字段”的过强假设：规范不限制所有技术配置键，只禁止未经采纳的身份/事件能力。现在针对禁止字段与服务选择检查；原检查也已经通过，因此不是降低断言以修复红灯。同文档重复接入属于 TM-ANL-021 的候选规则，当前正向控制不擅自要求只有一个发送请求。

## 失败原因与修复

1. 安装锁定的本地依赖后，外部旧工作区 CLI 与本仓库 test imports 同时加载了两个 Playwright 实例，导致 `test.use/test() did not expect`。修复为使用本地依赖，并在 runner 中拒绝不兼容的外部实例选择。没有修改产品断言；这是执行环境错误，不是预期红灯。
2. 既有 Node 回归初次 61/62 通过，唯一失败是 Waline 固定上游 hash。Windows 的 `core.autocrlf=true` 把已提交 LF 包转换成 109 个 CRLF，原始 hash 从 `e724ca39…` 变为 `ed464c22…`。检查确认去掉换行转换后的内容与 Git blob 完全一致，保留原固定 hash 与所有断言；`.gitattributes` 对该固定包设置 `-text`，工作区恢复精确提交字节。再次单测 1/1、完整 Node 62/62、相关资产 Python 4/4 均通过。

Waline 文件本身没有 Git 内容差异；没有修改第三方功能逻辑、原 hash 或未知包拒绝条件。[初次回归日志](feedback-regression.log)、[字节校验修复结果](vendor-byte-regression.log)、[修复后回归](feedback-regression-fixed.log)。此处失败属于基线环境保真，不计为 ANL 缺失行为的 TDD 红灯。

## 最终执行证据

| 检查 | 实际结果与证据 |
| --- | --- |
| ANL Node 正式检查 | 3/3 通过；[日志](analytics-unit-regression.log)；[生成覆盖记录](property-coverage.json)为 3 seeds×64＝192 样本，当前用时约 0.22 秒，无反例 |
| Python 项目回归 | 122/122 通过，[日志](python-regression.log)；字节保真相关资产回归另有 4/4 通过，[日志](asset-byte-regression.log) |
| 既有 Node 反馈回归 | 修复后 62/62 通过，[日志](feedback-regression-fixed.log)；其既有随机序列不算新增 ANL 状态机覆盖 |
| 浏览器项目回归 | 123/123 通过，零重试、零跳过、零 flaky；[日志](browser-regression.log)、[机器结果](browser-regression.json)。包括 8 条 ANL 手动选择中的用例、后台缓存、旧地址与离线重定向回归 |
| 源文件验证 | Posts、CMS、翻译同步、作品结构均通过；[结果](source-checks.json) |
| 构建与搜索 | Hugo Extended 构建成功；Pagefind 1.5.2 索引 420 页，[构建/环境记录](environment.json)、[索引日志](pagefind.log) |
| 生成产物 | 运行时资源、40,381 个内部引用、短地址、作品、SEO、首页结构检查通过；[结果](output-checks.json) |
| 评论生产配置回归 | 只在本地构建/检查，209 个规范讨论路径；[构建](discussion-build.log)、[清单校验](discussion-check.log)；不访问或更改评论服务 |
| 依赖审计 | 原锁文件安装，无新增 npm 库；根目录与主题审计都为 0 vulnerabilities，[根日志](npm-audit.log)、[主题日志](theme-npm-audit.log)；不是完整安全审计 |

环境：Windows amd64、Node 24.18.0、Python 3.12.10、Hugo Extended 0.154.5、Playwright 1.62.1、Chromium 151.0.7922.34。本次在项目本地安装锁定依赖；[环境记录](environment.json)包括路径与时间。浏览器 JSON 的源码是上述基线加未提交测试变更，不能将 GitHub 上该 SHA 的历史 CI 冒称此次执行。

[变更文件与 SHA-256 快照](change-manifest.json)记录本地实际测试/流程版本。独立手动入口也已执行：Unit 3/3、E2E 8/8，[Unit 日志](runner-unit.log)、[选择 E2E 日志](scoped-e2e.log)；不是仅发现用例后推测可运行。

复现命令：

```powershell
npm ci
npm run test:analytics
.\tests\analytics\run-local.ps1 -Mode List
.\tests\analytics\run-local.ps1 -Mode E2E

# 阶段回归，按已执行流程；不要每次编辑自动运行
$env:PYTHONUTF8 = '1'
py -3.12 -m unittest discover -s tests/python -p 'test_*.py'
npm run test:feedback
hugo --minify --panicOnWarning --cleanDestinationDir
npx --yes pagefind@1.5.2 --site public
npm run test:e2e -- --reporter=line
```

GP-ANL-01 由 Node 内建 runner/VM/URL/assert 实现；固定 seeds 20261008/09/10、每 seed 64 样本，合法 ASCII URL/主机约束及 5 秒批次预算保持。失败时将原始 input、规范化 host、seed/index、实际 append、source hash 与分类保存到 `test-results/analytics-properties/failure-*.json`；对实际性质反例尝试缩小，执行/生成器错误不伪称行为缺失。本次没有反例，不报告缩小成功。GP-ANL-02/03 的 oracle 仍未定，未启用模糊或状态机。

## 未运行 阻塞 延期及影响

- TM-ANL-002/004/005/006：本人真实后台的数据、页面、来源与允许/拒绝权限证据仍未取得。保留 P0/P1 阻塞，不能声称 ANL 整体通过。
- TM-ANL-016 至 023：等待、有效零、完整故障隔离、重复接入、采样/并发上下文与编码细化仍是 SPEC GAP，仅暂停这些行为，没有按实现猜预期。
- TM-ANL-025：趋势、辅助设备/国家与导出等未采纳，延期。TM-ANL-024/026 仍为不适用或 Won’t 正向能力，范围边界已按相关 ID 验证。
- 本轮没有新增功能端点、离线队列、身份追踪、读取 API Key、服务商选型或技术 spike。未执行生产 smoke/部署/真实后台登录；本地所有新路由观测拦截统计请求，未发送合成统计数据。

## 一次实际反馈的 A B 解释

指标说明的新测试直接通过。A 情况是测试发现实际缺失，先确认预期和失败原因，再做最小功能修复；B 情况是行为已有正确实现，用新增正式测试锁定它即可。本次属于 B，不能为了教学把页面改坏或称为完成红绿循环。

另一次回归反馈是固定字节 hash 失败：应修复造成字节变化的 checkout 条件并保留原断言，而不是改 hash 接受未知来源。已验证 Git 原始包正确，选择了前者；这一环境修复不能证明 Cloudflare 的数据入库。
