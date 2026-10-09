# 基础访问统计 Test Matrix

矩阵 `TEST-MATRIX-ANL-001`，版本 `0.8`，2026-10-09；功能 `ANL`。依据[功能台账](feature-ledger.md)、[SPEC-ANL-001](specs/analytics-v1.md)、[边缘缺口](specs/analytics-edge-case-gaps.md)、[不变量](specs/analytics-invariants.md)与[研究 RES-ANL-001](research/analytics-20261008/README.md)。基线为 `39b51748776c4f723007b60c3c77893d16c8faf2` 加本地测试/流程变更；实施/对抗证据见 [E-ANL-02](implementation/analytics-20261008/README.md)、[E-ANL-03](acceptance/analytics-20261008/README.md)，权限摘要见 [E-ANL-04](acceptance/analytics-20261008/manual-check-01.md)，最新固定区间页面/来源见 [E-ANL-19](acceptance/analytics-20261008/manual-check-16.md)。当前 29 项：18 通过、8 阻塞候选、1 延期、2 不适用；TM-ANL-002 因 [E-ANL-24](acceptance/analytics-20261008/manual-check-17.md)实际本人完整入口摘要转通过。本轮已明确采纳行为已验收，详见[最终结论](acceptance/analytics-20261008/final-acceptance-20261009.md)；八项未采纳候选保留，不宣称全部规划细化完成。

本轮只验证基础 PV、Visits、页面、可获得来源及本人私有后台选择。`ANL-009/010/011` 为尚未采纳的 Should/Could；`ANL-012/013/014/015` 不实现其正向能力，但可以验证指标不误称、统计不公开及未启用新追踪等边界。没有适用 spike；四项隔离研究观测只用于提炼正式测试计划，不替代其执行证据。

## 状态与优先级

来源仅用 Reference Test、Historical Bug、Issue、Product Requirement、Invariant、Inferred Gap，并跟具体出处/ID。未查到可复核的独立相关 Issue，所以没有用 Issue 填补其他来源。源码推断或研究替身只填参考出处，不能直接使正式用例“通过”。

状态：未实现＝没有对应可执行正式用例或完整人工检查步骤；已实现未运行＝既有用例或本次已准备的完整人工步骤尚未按该 ID 执行；通过＝有实际版本/命令/环境/原始证据；失败＝已经执行且违反已确定预期；阻塞＝规范或环境前提不足；延期＝当前范围/触发条件不需要；不适用＝当前架构或已排除能力不具备此测试对象。

P0 用于核心数据不可查或严重公开泄露；P1 用于常见污染、重要边界、失败与恢复；P2 用于低影响辅助/组合场景。此优先级与 MoSCoW 不直接对应。阻塞候选的优先级只表示风险大小，不使它进入已采纳范围。BUG-ANL-QA-001/002 曾有真实红灯，现已修复，原失败证据保留在 TM-ANL-028；当前没有未修复的已确定预期失败。原风险登记中的 P2 总体观察等级不覆盖这里的 P0/P1 单项，未通过降级完成验收。

## 已确定范围及既有相关回归

| ID | 需求ID | 场景（输入/前置状态/操作） | 预期结果 | 测试层级与方法 | 优先级 | 来源 | 状态 | 证据 |
|---|---|---|---|---|---|---|---|---|
| TM-ANL-001 | ANL-001、ANL-012、ANL-013（边界） | 阅读中英文统计入口的指标说明 | 按 BH-ANL-002 解释 PV/Visits，不冒称 UV、真人数、阅读完成或订阅成功 | E2E：[analytics.spec.js](../tests/e2e/analytics.spec.js)真实构建页双语断言；记录语义另由 TM-ANL-014 审阅 | P1 | Product Requirement：BH-ANL-001/002；Invariant：INV-ANL-01 | 通过 | [首次直接通过](implementation/analytics-20261008/metrics-e2e.log)、[最终回归](implementation/analytics-20261008/browser-regression.json)；既有行为补测试，不是 TDD 红绿循环 |
| TM-ANL-002 | ANL-001、ANL-004、ANL-005、ANL-008 | 本人从 CMS 进入真实后台，固定站点/页面/区间核对实际 PV/Visits | BH-ANL-009、AC-ANL-07：可查真实结果并保存上下文；不以请求成功或精确 +1 判通过 | 少量关键人工 E2E；真实只读后台与配套被动网络观测 | P0 | Product Requirement：BH-ANL-001/005/009/019、DEC-ANL-04；Invariant：INV-ANL-06/10 | 通过 | [E-ANL-24](acceptance/analytics-20261008/manual-check-17.md)本人明确按 CMS→统计页→正确私有报表走通；[E-ANL-17/19](acceptance/analytics-20261008/manual-check-16.md)固定区间真实结果和 [E-ANL-20/21](acceptance/analytics-20261008/live-verification-20261009.md)正式采集/公开 CMS 点击支撑完整已定行为。精确执行时分未另报告；核对分钟已有，未冒充独立私有登录或精确入库 |
| TM-ANL-003 | ANL-005 | 本地打开统计入口，检查后台链接与页面结构 | 既有链接/noindex/无 iframe 断言成立；不推出服务商授权已验 | E2E，复用现有 Playwright 用例 | P1 | Reference Test：[bilingual.spec.js](../tests/e2e/bilingual.spec.js)第 98 行；Product Requirement：BH-ANL-005 | 通过 | 本次[基线](implementation/analytics-20261008/baseline-e2e.log)及[完整回归](implementation/analytics-20261008/browser-regression.json)均通过；另有 [E-ANL-21](acceptance/analytics-20261008/live-verification-20261009.md)两套实际生产 CMS 点击到统计页；仅公开入口部分，不代替本人登录流程 |
| TM-ANL-004 | ANL-002、ANL-004、ANL-005 | 本人在同一合法区间查中文文章、英文对应页及作品路径 | BH-ANL-003：实际路径可对应内容；不假定译文/别名自动合并、精确排名或明细求和 | 人工集成验收，与 TM-ANL-002 同一会话复用证据，不另造完整 E2E | P1 | Product Requirement：BH-ANL-003/009；Inferred Gap：EC-ANL-001/005/006 | 通过 | [E-ANL-19](acceptance/analytics-20261008/manual-check-16.md)在同一固定区间直接读到中文/英文 PV，作品完整身份由同区间 E-ANL-18 确认；[E-ANL-17](acceptance/analytics-20261008/manual-check-14.md)记录绝对字段。原断言未改，不把此前列表未显示当零，不证明全部路径/编码合并 |
| TM-ANL-005 | ANL-003、ANL-004、ANL-005 | 本人在固定区间查看服务商实际取得的来源主机 | BH-ANL-004：能查看可获得来源，不声称特定社群/活动归因；来源缺失分类另列 TM-ANL-017 | 人工集成检查；与 TM-ANL-002 共享上下文 | P1 | Product Requirement：BH-ANL-004/009；Inferred Gap：EC-ANL-001/002 | 通过 | [E-ANL-19](acceptance/analytics-20261008/manual-check-16.md)实际五类来源与数值在固定区间可读，原样记录，不推渠道或人物；此前 [E-ANL-12](acceptance/analytics-20261008/manual-check-09.md)对旧英文查询的纠正保留。完整缺失分类、等待与大列表精度仍在 017/018/022 |
| TM-ANL-006 | ANL-005 | 隔离未登录会话打开后台；本人授权会话查看报表 | BH-ANL-005/006：无权会话不见私有报表，有权本人可查；公开跳转页允许访问 | 人工权限集成检查；不自动处理登录、不撤销真实权限 | P0 | Product Requirement：BH-ANL-005/006；Invariant：INV-ANL-04；Inferred Gap：EC-ANL-009/022 | 通过 | [E-ANL-04](acceptance/analytics-20261008/manual-check-01.md)：mantou 于 2026-10-08 约 14:00 北京时间实际核对，本人“可以查看报表”、未登录窗口“登录提示”。仅这两个会话组合通过；其他已登录无权账户/共享配置未验，Codex 未代登录或独立重做 |
| TM-ANL-007 | ANL-005、ANL-014（边界） | 只读检查公开统计入口/相关产物，不登录服务商 | BH-ANL-006：没有管理凭据、访客原始报表或公开嵌入数据；公开采集标识不误判成管理密钥 | 静态产物人工审阅，补充权限流程而不重复它 | P0 | Product Requirement：BH-ANL-006；Invariant：INV-ANL-04；Inferred Gap：EC-ANL-022 | 通过 | [本地审阅记录](implementation/analytics-20261008/public-artifact-review.json)列明文件/hash、方法和结果；不证明服务商登录、分享或生产配置 |
| TM-ANL-008 | ANL-006 | 在本地 127.0.0.1 打开首页，观测加载器及脚本请求 | 既有 loader 存在，但不加载 Cloudflare beacon | E2E，复用现有 Playwright 负向用例 | P1 | Reference Test：[portfolio.spec.js](../tests/e2e/portfolio.spec.js)第 371 行；Product Requirement：BH-ANL-007 | 通过 | 本次[基线](implementation/analytics-20261008/baseline-e2e.log)及[完整回归](implementation/analytics-20261008/browser-regression.json)通过；其他组合看 TM-ANL-009 |
| TM-ANL-009 | ANL-006 | 用本地路由映射正式、预览、相似后缀主机及后台页面 | BH-ANL-007：正式公开页面有接入机会，未批准主机及后台无本站采集尝试；不验证供应商入库 | Node 单元属性 GP-ANL-01＋四条隔离 E2E；全部网络隔离 | P1 | Product Requirement：BH-ANL-007；Invariant：INV-ANL-03；Reference Test：portfolio.spec.js:371；Inferred Gap：EC-ANL-008、RES-ANL-001/RB-ANL-01 | 通过 | [正式属性结果](implementation/analytics-20261008/property-coverage.json)，192 样本；[E2E](implementation/analytics-20261008/host-boundary-e2e.log)、[最终回归](implementation/analytics-20261008/browser-regression.json)。实现见 [Node](../tests/analytics/analytics-loader.test.cjs)/[E2E](../tests/e2e/analytics.spec.js)，不挪用研究通过；[E-ANL-20/23](acceptance/analytics-20261008/live-verification-20261009.md)另补当前正式文档真实接入及目标文件版本一致性 |
| TM-ANL-010 | ANL-006 | 执行实际 SW 的非 GET、跨源、后台请求分支 | 既有 SW 测试中请求不由博客缓存接管；不证明私有权限或 beacon 计数 | 单元/组件：Python unittest 调用 Node VM，单个既有用例 | P1 | Reference Test：[test_service_worker_reliability.py](../tests/python/test_service_worker_reliability.py)第 362 行；Product Requirement：BH-ANL-007/015 | 通过 | [单个基线执行](implementation/analytics-20261008/baseline-unit.log)及[Python 122 项回归](implementation/analytics-20261008/python-regression.log)通过 |
| TM-ANL-011 | ANL-006 | SW 接管后访问后台页/配置，再断网尝试访问 | 既有 PWA 边界：后台资源不从博客缓存提供；不扩展成离线后台 | E2E，复用既有缓存边界用例，仅 SW/缓存相关改动时运行 | P1 | Reference Test：[pwa.spec.js](../tests/e2e/pwa.spec.js)第 38 行；Product Requirement：BH-ANL-007；Invariant：INV-ANL-03 | 通过 | [本次浏览器结果](implementation/analytics-20261008/browser-regression.json)含该用例 passed；不是 no-store 样本推断 |
| TM-ANL-012 | ANL-008、ANL-012、ANL-013、ANL-014（边界） | 审阅当前统计相关配置/生成资源/变更，检查新追踪与假数据 | BH-ANL-008/015/020：本轮不启用 UV/事件漏斗/自动只读接口/本地伪造计数；不禁止博客其他既有服务 | [统计 Node 检查](../tests/analytics/analytics-scope.test.cjs)＋定向产物/语义审阅，不全仓扫旧候选文案 | P1 | Product Requirement：BH-ANL-008/015/020；Invariant：INV-ANL-10；Inferred Gap：EC-ANL-024 | 通过 | [Node 结果](implementation/analytics-20261008/analytics-unit-regression.log)、[产物审阅](implementation/analytics-20261008/public-artifact-review.json)、[语义审阅](implementation/analytics-20261008/semantics-review.json)；只证明本站统计接入范围 |
| TM-ANL-013 | ANL-007、ANL-008 | 支持 loader 的浏览器中阻断统计，随后正常新文档/刷新恢复可加载条件 | BH-ANL-014：新文档重新尝试机会；不证明真实入库、BFCache 重执行或历史补采 | [隔离 E2E](../tests/e2e/analytics.spec.js)使用真实构建和受控模块，替身不作供应商验收 | P1 | Product Requirement：BH-ANL-014/015；Invariant：INV-ANL-09；Inferred Gap：EC-ANL-015、RES-ANL-001/RB-ANL-06 | 通过 | [正式单测执行](implementation/analytics-20261008/recovery-e2e.log)及[完整回归](implementation/analytics-20261008/browser-regression.json)通过；未提升为真实服务恢复 |
| TM-ANL-014 | ANL-001、ANL-012（边界） | 在报告解释中加入合法刷新、前进/后退、多设备访问样例 | BH-ANL-013/019：不把合法操作强制去重，不要求真人合并、严格一次或计数恒等式 | 人工语义/当前初始化实现审阅；不对服务商定义自己的数值 oracle | P2 | Product Requirement：BH-ANL-013/019；Invariant：INV-ANL-01；Inferred Gap：EC-ANL-011/017 | 通过 | [实际审阅及样例](implementation/analytics-20261008/semantics-review.json)标明 synthetic explanation inputs；不证明供应商 PV 或多设备统计数字 |
| TM-ANL-015 | ANL-002 | 打开已知中文 % 编码旧别名，核对实际落地短路径 | 既有路由断言仍跳到 `/p/20260406/`；不证明后台编码/归一化正确 | E2E，复用合法别名回归，URL/路由改动才运行 | P2 | Reference Test：[portfolio.spec.js](../tests/e2e/portfolio.spec.js)第 269 行；Inferred Gap：EC-ANL-005 | 通过 | [本次浏览器结果](implementation/analytics-20261008/browser-regression.json)该用例 passed；后台归一化 TM-ANL-023 仍阻塞 |
| TM-ANL-027 | ANL-007（既有阅读依赖回归） | 已缓存的中英文离线页经真实 HTTP 308 重定向，断网导航 | 既有 PWA 承诺可显示离线说明，避免回放 redirected Response 失效；不证明统计故障隔离 | E2E，复用历史 Bug 回归；只有相关 SW/缓存修改或发布需跑 | P1 | Historical Bug：[PR #132](https://github.com/Maoxin1/mantou-blog/pull/132)，提交 39b5174；Reference Test：[pwa-install.spec.js](../tests/e2e/pwa-install.spec.js)第 128 行 | 通过 | [本次浏览器结果](implementation/analytics-20261008/browser-regression.json)该回归 passed；不再仅依据历史报告 |

## 对抗审查新增验证（既有范围）

| ID | 需求ID | 场景（输入/前置状态/操作） | 预期结果 | 测试层级与方法 | 优先级 | 来源 | 状态 | 证据 |
|---|---|---|---|---|---|---|---|---|
| TM-ANL-028 | ANL-008（验收证据前提） | 旧 public 后手动 E2E；构建失败；仅发现测试而保留执行报告 | 使用当前源码生成的产物，构建失败停止；List/Prepare 发现不覆盖实际执行证据 | Node 启动真实 Windows PowerShell；两条用 Hugo/浏览器替身检验顺序，一条用真实 Playwright CLI 检验报告；再运行真实构建＋浏览器 | P1 | Product Requirement：BH-ANL-009；Historical Bug：BUG-ANL-QA-001/002；Inferred Gap：ADV-ANL-001 | 通过 | 构建[红灯 0/2](acceptance/analytics-20261008/runner-red.log)→[2/2](acceptance/analytics-20261008/runner-green.log)，报告[红灯 0/1](acceptance/analytics-20261008/discovery-red.log)→[最终 Node 7/7](acceptance/analytics-20261008/analytics-unit-final.log)、[E2E 9/9](acceptance/analytics-20261008/scoped-e2e.json)、[List 保留结果](acceptance/analytics-20261008/test-discovery-final.log)。Windows 专用三条在其他 OS 显式不适用/跳过 |
| TM-ANL-029 | ANL-002、ANL-006 | 批准主机下打开中文/英文首页、中文/英文文章及已发布作品，共五个真实构建页 | 各公开布局正文可见且保留本站统计接入机会；不宣称实际页面统计入库、别名归一化或总数精确 +1 | 一条隔离 E2E 循环五个 fixtures.known_pages，全部外部请求拦截，SW 禁用 | P1 | Product Requirement：BH-ANL-003/007；Inferred Gap：ADV-ANL-002、EC-ANL-001/005 | 通过 | [本轮 9/9 手动选择](acceptance/analytics-20261008/scoped-e2e.json)，已有正确行为补测即过，不算 TDD 红绿；实现 [analytics.spec.js](../tests/e2e/analytics.spec.js) |

TM-ANL-009 同时补充四个合法 URL 的大小写、Unicode 点分隔和相似字符控制：[本轮 7/7 Node](acceptance/analytics-20261008/analytics-unit-final.log)。将规范化后的 hostname 传给真实 loader；不新增 URL 解析规则、域名别名或允许范围。GP-ANL-01 原种子/预算保持，[192 样本重新执行](acceptance/analytics-20261008/property-coverage.json)；192 次采样不代表 192 个不同主机或全部 Unicode/长度边界。

## SPEC GAP 阻塞的候选

以下先反馈未定义预期，不增加已采纳测试范围。解决 SPEC GAP 并确认相应候选行为后，再实现/运行；不能把当前实现直接视为 oracle。

| ID | 需求ID | 场景（输入/前置状态/操作） | 预期结果 | 测试层级与方法 | 优先级 | 来源 | 状态 | 证据 |
|---|---|---|---|---|---|---|---|---|
| TM-ANL-016 | ANL-008 | 后台空表、合法零、查询中、无权限、超时、缺字段 | **SPEC GAP** GAP-ANL-06/BH-ANL-010：有效零的判据未定；不得猜测用 0 填缺失 | 人工状态决策表；未来若有自有状态处理器才考虑 GP-ANL-03 | P1 | Inferred Gap：EC-ANL-003/007/019；Invariant：INV-ANL-02/06（候选部分）；Product Requirement：BH-ANL-010（候选） | 阻塞 | 只有候选[状态数据](../tests/analytics/fixtures.json)，不是产品状态机；无执行结果 |
| TM-ANL-017 | ANL-003、ANL-008 | 正常 Referrer、空 Referrer、分享应用移除来源 | **SPEC GAP** GAP-ANL-05/06：实际 Direct/Unknown 名称和解释未核对；不推断具体渠道 | 人工来源分类检查；本地受控样本不向真实服务发假来源 | P1 | Product Requirement：BH-ANL-004；Inferred Gap：EC-ANL-002、RES-ANL-001/RB-ANL-09 | 阻塞 | 真实分类 E；不得按参考词汇创造供应商预期 |
| TM-ANL-018 | ANL-004、ANL-008 | 倒置/未来/过期区间，午夜、绝对区间、时区和等待窗口 | **SPEC GAP** GAP-ANL-03/06：支持区间、端点包含、时区及停止等待未定；不直接用 24h/7d 当 SLA | 人工区间检查；只有自有转换代码存在且规则采纳后才做日期属性测试 | P1 | Inferred Gap：EC-ANL-004/016；Invariant：INV-ANL-07（候选）；Product Requirement：BH-ANL-009/016（细化未定） | 阻塞 | [E-ANL-17](acceptance/analytics-20261008/manual-check-14.md)已见固定日期选择及当前汇总，GMT+8/From/To 可读；异常区间、端点包含和等待判据仍为 SPEC GAP，不建立数值 oracle |
| TM-ANL-019 | ANL-007、ANL-008 | 固定正文等依赖正常；脚本加载/采集端点分别失败、部分成功、CORS/拒绝、离页中断 | **SPEC GAP** BH-ANL-011/GAP-ANL-06：完整任务隔离与结果分类未采纳；局部正文/导航研究不能覆盖搜索/互动 | 本地集成故障注入，选少量关键 E2E；不直接对真实端点造载荷 | P1 | Inferred Gap：EC-ANL-007/012/013/021；Invariant：INV-ANL-05/06（候选部分）；Product Requirement：BH-ANL-010/011（候选） | 阻塞 | 四项研究观测为范围有限参考；正式故障套件未写，未验搜索/互动/真实采集失败 |
| TM-ANL-020 | ANL-007 | 统计脚本长挂起、慢设备、CSP/module/JS 不可用、其他浏览器 | **SPEC GAP** EC-ANL-014/023：支持环境、等待/性能预算未定；不要求资源耗尽时仍运行 | 隔离挂起/节流集成＋按实际受众选择兼容 E2E；禁用真实上报 | P1 | Inferred Gap：EC-ANL-014/023；Invariant：INV-ANL-05（候选）；Product Requirement：BH-ANL-011（候选） | 阻塞 | 准备环境只确认 Chromium 文件存在；没有跨浏览器或性能通过证据 |
| TM-ANL-021 | ANL-006 | 同文档重复 loader 初始化，或手动＋自动双注入 | **SPEC GAP** GAP-ANL-04/BH-ANL-012：单套接入及修复方式未采纳；不能先断言请求只能一次 | 本地组件/序列刻画；确认规则后选择初始化状态机 | P1 | Inferred Gap：EC-ANL-010；Invariant：INV-ANL-08（候选）；Product Requirement：BH-ANL-012（候选） | 阻塞 | loader 无去重是 C，不是违反已定预期的失败；正式配置及规范待确认 |
| TM-ANL-022 | ANL-004、ANL-008 | 多标签页/多设备访问中，先后查询总数与页面表、迟到更新、大列表截断/采样 | **SPEC GAP** BH-ANL-018、INV-ANL-11：元信息/精度细化未定；不要求统一事务快照或行和等于总数 | 人工快照检查；不新增并发查询客户端、压测或分布式测试 | P2 | Inferred Gap：EC-ANL-006/017/018/020；Invariant：INV-ANL-11（候选）；Product Requirement：BH-ANL-018（候选） | 阻塞 | 无真实后台样本。当前无本站多进程统计服务或自有请求竞态逻辑 |
| TM-ANL-023 | ANL-002 | 中文/英文/旧别名及无效 % 编码在后台的分组与显示 | **SPEC GAP** EC-ANL-005：路径归一化、译文/别名合并规则未定；不从浏览器未崩溃推断语义正确 | 合法路径人工核对；模糊方法评估 GP-ANL-02 暂缓，无本站解析器可测 | P2 | Inferred Gap：EC-ANL-005/008；Invariant：INV-ANL-12（候选）；Product Requirement：BH-ANL-003 | 阻塞 | 仅有本地合法别名回归及[编码样本](../tests/analytics/fixtures.json)，无后台编码结果 |

## 延期与不适用

| ID | 需求ID | 场景（输入/前置状态/操作） | 预期结果 | 测试层级与方法 | 优先级 | 来源 | 状态 | 证据 |
|---|---|---|---|---|---|---|---|---|
| TM-ANL-024 | ANL-008、ANL-014（边界） | 本地统计数据库部分写入、崩溃恢复、跨进程事务、供应商精确一次持久化 | 无本站统计数据库/队列；不制定不存在的恢复算法。可查真实数据仍由 TM-ANL-002 验证 | 不安排数据库故障注入；无对应本站测试层 | P2 | Product Requirement：BH-ANL-015/019；Inferred Gap：EC-ANL-019/020 | 不适用 | 当前架构不拥有统计存储；不代表供应商持久化已通过 |
| TM-ANL-025 | ANL-009、ANL-010、ANL-011 | 趋势比较、设备/国家、导出或自动复盘 | 未采纳的 Should/Could 不提供新增正向验收；若采纳再确定数据/过滤口径 | 暂不建新套件或自动接口 | P2 | Product Requirement：BH-ANL-016/017（候选）、DEC-ANL-04；Inferred Gap：台账 Should/Could | 延期 | 范围尚未采纳；旧服务已有维度不是本轮全部交付承诺 |
| TM-ANL-026 | ANL-012、ANL-013、ANL-014、ANL-015 | UV/事件漏斗/自建后台/告警的正向功能验收 | 本轮不实现；必要负向边界由 TM-ANL-001/007/012/014 覆盖 | 不安排这些功能的单元、集成或 E2E | P2 | Product Requirement：BH-ANL-002/008/020、DEC-ANL-01/02/04 | 不适用 | Won’t 正向能力无测试对象；私有报表和不越界约束仍在范围内 |

## 需求与风险覆盖核对

| 需求或风险 | 对应测试 | 当前未验证事项 |
| --- | --- | --- |
| ANL-001 指标规模与含义 | 001/002/014 | 本地含义与样例解释已通过；实际数据未验 |
| ANL-002 页面 | 004/015/023 | 实际后台路径未查；合法路由回归已过；归一化为 SPEC GAP |
| ANL-003 来源 | 005/017 | 真实来源与空来源分类未查 |
| ANL-004 区间/时区 | 002/004/005/018/022 | 区间、时区、等待、采样细化未定；不额外立项转换器 |
| ANL-005 私有查看/入口 | 002/003/006/007 | 入口结构及列明公开产物审阅通过；登录后的允许/拒绝未验 |
| ANL-006 主机/后台边界 | 008/009/010/011/021 | 主机组合、属性及 SW/后台回归通过；平台配置及重复初始化候选未定 |
| ANL-007 故障/恢复 | 013/019/020/027 | 正常新文档恢复机会与既有离线回归已过；真实服务恢复、完整故障隔离仍未验 |
| ANL-008 真实性/持久化可见结果 | 002/012/016/018/019/022/024 | 真实入后台未验；不要求不存在的本地事务性质 |
| Unicode/无效输入/大数据 | 015/018/022/023 | 合法路由与统计分组是不同断言；输入规则缺口保留 |
| 状态转换/重复/顺序/中断 | 013/014/016/019/021 | 不预设幂等、严格一次、按到达顺序还原操作 |
| 并发/持久化/兼容/安全 | 002/006/007/020/022/024 | 不以多设备当人数，不把模拟 auth/替身/无崩溃当供应商正确性 |

## 最小环境与准备记录

已复用 Node `24.18.0`、Python `3.12.10`、Hugo Extended `0.154.5`、Playwright `1.62.1` 与已安装 Chromium。实施阶段按原锁文件安装了项目/主题依赖，没有新增 npm 库。准备材料已扩展为正式执行入口：

- [手动运行脚本](../tests/analytics/run-local.ps1)：默认 Prepare，只构建/发现 9 条选择；Unit 运行正式 Node 测试，E2E 需显式启用且本次运行前重新构建，构建失败立即停止；拒绝混用外部 CLI 与本地 Playwright 实例。
- [专用手动配置](../tests/analytics/playwright.analytics.config.cjs)：选择 2 条既有＋7 条 ANL 正式浏览器用例，单 worker、零重试、本地端口 4186、不复用未知服务；不访问真实后台或上报合成统计。
- [合法页面/主机与候选数据](../tests/analytics/fixtures.json)、[人工证据模板](../tests/analytics/manual-evidence-template.md)：合法生成页已核对；候选状态/异常编码没有既定产品 oracle，也不发送到真实服务。

准备阶段曾完成 2 条既有用例发现；本次实施的 Prepare 完成构建、6 个页面核对和 8 条选择发现：[准备/环境快照](implementation/analytics-20261008/environment.json)。准备本身不是通过证据；实际结果另有 E-ANL-02。此前 grep 筛选错误及后来的 Playwright 双实例错误均已修复，没有作为行为红灯。

```powershell
# 工作目录：D:\mx\github\Maoxin1\mantou-blog-monitoring-plan
.\tests\analytics\run-local.ps1 -Mode Prepare
.\tests\analytics\run-local.ps1 -Mode List

# 快速正式 Node 检查；已执行通过
.\tests\analytics\run-local.ps1 -Mode Unit

# 仅明确需要时手动启用 9 条选择；会先重新构建，构建失败停止
.\tests\analytics\run-local.ps1 -Mode E2E
```

脚本优先使用本仓库 node_modules；只有本仓库未安装依赖时才复用同级工作区并核对版本。本地已安装时不可显式选择外部实例。没有下载新浏览器或升级版本，也没有增加 fast-check、pytest、模糊测试服务、Docker、额外数据库或全部浏览器引擎。

手动配置将失败产物保存在 `test-results/analytics/`，结果报告在 `playwright-report/analytics/report.json`。新增 `npm run test:analytics` 已接入现有 Validate 的快速 Node 步骤；新浏览器用例随项目既有 E2E 回归执行，未新增每次编辑后自动运行或生产巡检触发。本次实际全套结果归档在 [browser-regression.json](implementation/analytics-20261008/browser-regression.json)。

## 生成式方法的选择与预算

GP-ANL-01 已按预算实现并通过；GP-ANL-02/03 仍未实现/启用。不得为测试候选模型开发原本不存在的产品状态处理器。

| 方法 ID | 关联测试与适用性 | 有效输入与生成策略 | 判定依据 | 预算/种子 | 失败样例保留 |
| --- | --- | --- | --- | --- | --- |
| GP-ANL-01 属性测试 | TM-ANL-009；Node 内建 VM/URL/assert 执行真实 loader，[正式实现](../tests/analytics/analytics-loader.test.cjs)，无新库 | 只生成 URL 能接受的 ASCII DNS 主机；标签 1–63、主机总长≤253，先规范化 hostname，再剔除等于已批准主机的负样本；子域、前后缀、相似后缀、localhost/IPv4；正式主机固定控制，后台另用真实 HTML 验证 | BH-ANL-007、INV-ANL-03：负主机无统计 append、正向有机会，不以无崩溃代替语义 | 固定 seeds 20261008/09/10×64＝192，批次 5 秒预算；[本次覆盖记录](implementation/analytics-20261008/property-coverage.json)约 0.22 秒，全部通过 | 反例保存到 `test-results/analytics-properties/failure-*.json`，含 seed/index、输入、host、实际、source hash 和错误分类；真实反例尝试缩小，原样与缩小样例均保留。本次无反例，不声称缩小已验证 |
| GP-ANL-02 模糊测试 | TM-ANL-023；**当前不启用**：没有自有解析器，统计归一化规则仍为 SPEC GAP | 将来若有自有规则，分有效 UTF-8 URL/百分号编码与无效 `%` 序列两类，含中文组合字符、截断、重复解码、大长度；必须先确定有效/无效及合并的 oracle。不得向真实采集/后台 fuzz | 候选 INV-ANL-12 的准确路径对应/拒绝规则；只观察浏览器不崩溃不足。规则未定时只记录发现，不写通过/失败 | 启用前重新确认；候选 100 样本或 5 秒先到者，seed 20261008。当前预算投入为 0 | 将来保存原始字节/编码形式、期望、实际、seed、简化过程和版本；敏感数据禁止进入样本 |
| GP-ANL-03 状态机/随机序列 | TM-ANL-016/019/021；**当前阻塞**。现在用人工状态表，未来有自有处理器且规范采纳后再自动化 | 候选 querying/available/zero/unknown/denied/failed 与依赖状态；序列含 begin/query-error/permission-change/new-document，操作有效性由实际处理器定义；不能从不存在的产品 UI 造转移 | 采纳后用 INV-ANL-02/05/06/08：未知不产生有效零、接入层成功不伪造后台可查、隔离前提下原任务可达。现有规则未定不得断言 | 候选 seed 20261008/20261009；每 seed≤20 序列，每序列≤8 操作，总≤320 操作或 10 秒；本轮不执行 | 保存完整/最短操作序列、初始状态、seed、第一次违反的已采纳性质及原始证据；未定义结果先反馈 SPEC GAP |

如果实际用例有更简单的确定性反例，优先保留该反例，避免用生成样本数量替代覆盖说明。生成式层只测试本站控制的逻辑和解释约束，不能证明服务商采样、身份、持久化或授权全部正确。

## 开发快速检查与完整回归触发

| 触发 | 快速检查 | 手动 E2E/完整回归 |
| --- | --- | --- |
| 只改文档、矩阵或采纳记录 | 检查 ID、来源、状态/证据和本地链接，不运行功能测试 | 无需浏览器；不能因文档更新产生“通过” |
| 改测试选择/配置/数据 | `run-local.ps1 -Mode List`；数据格式/合法页面由 Prepare 核对 | 不默认运行 E2E。修改断言或 fixture 意义后再按需手动跑对应 ID |
| 后续修改统计模板/域名或公开产物 | `npm run test:analytics`、Hugo 构建与定向产物审阅 | 建议手动跑 9 条 ANL 选择，准备发布时仍需 TM-ANL-002 的真实数据证据 |
| 后续修改 SW/后台缓存边界 | 运行下方现有单个 VM 用例；只有 SW 变化才扩展文件内相关回归 | 建议跑 TM-ANL-011/027 等受影响 E2E；不把这些结果当统计入库证据 |
| 后续采纳完整失败隔离并修改核心流程 | 先解决 SPEC GAP，再选最小故障组件检查 | 建议关键正常/故障 E2E；搜索相关场景才构建 Pagefind。完整回归触发为核心流程、跨模块缓存、域名、托管/依赖升级或准备发布 |
| 普通内容发布 | 沿用已有项目验证/部署流程 | 原生产巡检保持；本矩阵不新增每次编辑后的浏览器执行或自动后台登录 |

```powershell
# SW 边界改动时的快速既有组件用例；本次已执行通过
$env:PYTHONUTF8 = '1'
py -3.12 -m unittest discover -s tests/python -p test_service_worker_reliability.py -k admin_non_get_and_cross_origin -v

# 手动挑选缓存/历史 Bug 回归，当前使用本仓库已安装依赖；本次完整回归含这两条并通过
npm run test:e2e -- tests/e2e/pwa.spec.js --grep '所有后台入口和配置'
npm run test:e2e -- tests/e2e/pwa-install.spec.js --grep 'actual HTTP redirects'
```

广泛的 `npm run test:e2e`、Python 全套、Hugo/Pagefind/链接校验仅在实际改动和发布要求触发时沿用项目流程；统计只读面板、账号数据和来源属于人工验收，不能用全套 CI 绿灯代替。

## 关键测试的 A B 解释

选择 TM-ANL-002，因为它对应“本人确实能用统计”的核心结果。

| 方式 | 能发现什么 | 不能证明什么 | 本轮如何使用 |
| --- | --- | --- | --- |
| A 本人真实后台核对 | 站点或区间选错、缺少权限、实际无可查数据、指标/路径与任务不符；配套时间与采集记录可帮助分辨接入到后台的缺口 | 不证明每个浏览请求精确一次入库、独立真人、完整历史恢复或所有故障环境；没有等待/零判据时不能把空白当失败或无读者 | 已在 DEC-ANL-04 采纳人工 A；目前 TM-ANL-002 阻塞，证据未取得 |
| B 本地脚本/入口技术检查 | 模板漏注入、主机隔离回归、链接错误、受控故障下的部分调度问题；快速且可隔离 | 不证明 Cloudflare 后台可查、真实授权或持久化，即使替身及脚本成功也不足 | 复用 TM-ANL-003/008 及未来正式化的组合用例，作为开发子证据；不替代 A，不是重新采纳自动 API 的方案 |

A/B 在这里解释的是不同测试层级，不重开范围决策。两类证据可互补；原来已选的人工方法保持，不为了教学要求用户再次批准。

## 证据与完成边界

`E-ANL-01` 为已有正式两条 E2E 的执行：同一基线；Windows amd64、Node 24.18.0、Python 3.12.10、Hugo Extended 0.154.5、Playwright 1.62.1、Chromium 151.0.7922.34。命令为现有 CLI `test --grep '非生产域名不会加载 Cloudflare 统计脚本|统计入口指向需要登录的 Cloudflare 后台' --reporter=line`，工作目录为本规划副本，NODE_PATH 指向已核对的同级依赖。原始结果为 2 passed；[版本/环境记录](research/analytics-20261008/README.md)、[日志](research/analytics-20261008/existing-e2e.log)。这只支撑 TM-ANL-003/008，来源文件和配置未改变其断言；新手动配置本阶段只有发现证据。

`E-ANL-02` 为本次[正式实施记录](implementation/analytics-20261008/README.md)：ANL Node 3/3、192 生成样本、项目 Python 122/122、既有 Node 62/62 和 E2E 123/123。新单元/E2E 与人工审阅分别有实际证据，没将研究 JSON/HTTP 样本移作正式通过。27 项矩阵现为 12 通过、12 阻塞、1 延期、2 不适用；通过只对应各行的前提与范围。

`E-ANL-03` 为本次[验收与对抗记录](acceptance/analytics-20261008/README.md)：Node 7/7、192 生成样本、新鲜构建后的手动 E2E 9/9（零重试/跳过）；BUG-ANL-QA-001 两条、QA-002 一条真失败→修复→通过的原日志保留，发现不覆盖执行报告，审计读归档证据。既有 E-ANL-02 的 122/62/123 项全回归是原记录版本，本次未重复运行全套；[证据审计](acceptance/analytics-20261008/evidence-audit.json)核对应用、既有单元检查及人工审阅文件仍一致。全部通过行只对应各自前提；14/29 不是验收完成比例。

E-ANL-03 阶段 mantou 的“未核对”保留为历史记录；最新 E-ANL-04 已人工查看报表，TM-ANL-006 因实际本人/未登录结果通过，矩阵现 15/11/1/2。路径澄清为仅网页能打开，TM-ANL-004 仍阻塞；PV/Visits/来源可显示的摘要不补出具体数据或完整查询上下文，TM-ANL-002/005 保留阻塞。零/等待等 SPEC GAP、Should/Could/Won’t 保留；ANL 整体待验收，未改代码或重跑功能测试来制造人工通过。

[E-ANL-05 截图核对](acceptance/analytics-20261008/manual-check-02.md)：当前面包屑 Dashboards/流量概览，Path=`p/20260803/`、时间 Last 24 hours，No data；没有正式 Web Analytics 站点标识。目标对象与查询条件未确认，002/004/005 保持阻塞，不能据图填写有效零或判接入故障。该当前截图没有证明此前权限测试目标相同，原 006 人工结果保留其来源/限度；后续若证实目标不同再重开受影响项。下一步先导航至正确站点报表，不修改产品预期。

[E-ANL-06 正式报表截图](acceptance/analytics-20261008/manual-check-03.md)已补当前目标：Web Analytics for mantou-blog.pages.dev，Last 7 days (GMT+8)、Path=/p/20260803/、Exclude bots=Yes，Visits 实际可读（数值/原图私有留存）。002 的 Visits/站点/显示时区和 004 的中文路径子场景有实际证据；PV 数字在画面外，英文/作品、来源及绝对端点未展示，整行仍阻塞。018 的本次显示时区子未知已解决，等待/端点等未关闭；29 行状态计数不变。旧画面的 No data 不与本次数据混用。

[E-ANL-07 中文文章双指标](acceptance/analytics-20261008/manual-check-04.md)已补同一画面的 PV，中文 Path 的 PV/Visits 均实际可读，站点/时间/GMT+8/排除机器人条件齐备；具体值与原图私有留存。002/004 中文子结果已验，英文/作品、来源及绝对端点仍缺，整行/整体验收不升级；不能把单路径值当全站汇总。下一步替换 Path 查询英文文章，避免同时保留两个路径条件。

[E-ANL-08/OBS-ANL-UI-01](acceptance/analytics-20261008/manual-check-05.md)：Add filter 不出弹窗是用户反馈，截图未含 Path，当前 Visits 为站点汇总；不赋给英文页面。按 BH-ANL-003/004 的既有目标，004 可用 Page views summary 的 Path 分组列表核对各页面 PV，005 可用 Referer 分组，具体交互尚待执行。逐页 Visits 是此前执行便利，没有升级为规范；改查看入口不降低断言、不扩大范围。状态计数不变，不把计划当实际通过。

[E-ANL-09](acceptance/analytics-20261008/manual-check-06.md)现已实际执行 Path 分组：选中 Page views、Path 高亮，英文 /en/p/20260803/ 的 PV 可读，站点 PV/Visits 可读，Last 7 days (GMT+8)、Exclude bots=Yes。002 站点指标与 004 英文子场景有实证；作品/来源/绝对区间仍缺，整行/整体未升级。左侧 Visits 不写成英文 Visits，当前英文系列不等于完整路径清单；保留两个快照的聚合差异未知。按钮问题未定位，但替代入口已可用。

[E-ANL-10 来源分组](acceptance/analytics-20261008/manual-check-07.md)已补实际供应商分类/数值和可见查询条件，005 的来源查看转通过；完整绝对区间/查询时点仍在 002/018，不降低 AC-ANL-07。Path 目前只有英文、显示数量 5 items，作品和列表完整性仍未知，不判零。OBS-ANL-UI-02 保存查询/显示状态差异，计数现 16/10/1/2；范围、优先级与旧阶段计数记录保留。

[E-ANL-11](acceptance/analytics-20261008/manual-check-08.md)：新的截图未露出显示数量选择，只有英文路径，不能推断用户已改条数；上限 5 却仅 1 条不能单独解释作品缺失，改查 URL 参数和查询上下文。新的生产 HTML GET 证实三个内容页均有声明接入，但未执行 JS/上报，004 的作品子场景仍阻塞。没有新增通过、修改预期或以静态加载器替代结果验收。

[E-ANL-12 当前 URL](acceptance/analytics-20261008/manual-check-09.md)证实仍有英文 path 条件，当前未显示作品有查询范围原因；无可见标签不代表无筛选。002 全站汇总尚未取得，先前把相关卡片称全站的解释纠正；005 来源读取的实际结果保留，但限定于该路径/查询条件，不报全站来源已验。004 作品仍待实际访问生成的作品查询；站点/排除机器人/窗口参数保持，仅替换或移除 path。没有导航执行或新增正式通过，原记录及纠正并存。

[E-ANL-13](acceptance/analytics-20261008/manual-check-10.md)作品导航后的 All 画面有真实指标，但路径归属未展示；不能仅凭之前生成的 URL 就给 004 作品或 002 全站通过。下一步实际 Path 分组确认。原图/网址已迁到独立 Git 忽略的 `.local-evidence/analytics-private-manual`，15 文件哈希保留，见 [ARCH-ANL-01](acceptance/analytics-20261008/archive-retention.md)；避免测试输出清理损失，不改变状态计数/预期。

[E-ANL-15 当前来源分组](acceptance/analytics-20261008/manual-check-12.md)已显示多条真实来源标签及数值，005 追加证据，状态计数不变。None (direct) 不等于已证明手输网址，127.0.0.1 来源不等于访客 IP 或本站非生产主机采集；共同绝对区间与查询时点仍待补，不把不同滚动快照当成固定数据集。

[E-ANL-16 日期面板](acceptance/analytics-20261008/manual-check-13.md)已记录实际绝对端点与显示时区，018 对应子未知解决；Apply 与固定区间下共同结果尚待执行，002/004/018 整行状态不变。桌面时钟仅作画面可见分钟时间，不作精确查询执行时点。

[E-ANL-17](acceptance/analytics-20261008/manual-check-14.md)工具栏已为固定日期，读到当前汇总与部分来源。端点按当前字段记录，前一张秒数差异不猜原因。固定选择子步骤已完成，不重复要求 Apply；后续核对同窗口页面与完整条件。16/10/1/2 保持。

[E-ANL-18 固定区间路径分组](acceptance/analytics-20261008/manual-check-15.md)已补作品 PV 的真实结果及英文路径标识；中文未显示、英文数值被裁切，004 整行待补。增加已有列表显示数量是查看手段，不新增需求或降低断言；16/10/1/2 不变。

[E-ANL-19](acceptance/analytics-20261008/manual-check-16.md)实际 15 items 列表补齐固定区间三类代表页面与来源，004 转通过，005 追加证据。002 数据读取子流程已验，CMS 发起流程与真实采集请求配套证据仍缺；当前 17/9/1/2，整体待验收。历史计数与失败记录保留，没有新增功能测试执行。

[E-ANL-20/21/23](acceptance/analytics-20261008/live-verification-20261009.md)新增实际生产浏览器采集/公开入口证据与部署升级适用性复核。002 仅待本人完整入口摘要，016–023 仍是未采纳候选，不默认追加为本轮门禁。当前 17/9/1/2，没有将发现/记录审计或代码路径错误当功能测试。

[E-ANL-24 本人完整入口](acceptance/analytics-20261008/manual-check-17.md)为实际操作回复，002 转通过；当前 18/8/1/2。本轮已明确采纳行为[验收通过](acceptance/analytics-20261008/final-acceptance-20261009.md)。016–023 八项未采纳候选保留原预期未知/阻塞，历史状态和失败日志不删除；本次只补人工证据与记录检查，没有功能测试重跑。
