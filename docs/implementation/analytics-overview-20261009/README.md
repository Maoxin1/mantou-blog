# 私有概览页本地实现与验证

最新状态（2026-10-09）：真实只读读取、生产Access窄路径/匿名挑战、本人旧入口和四项Production Secret均有对应证据。新版代码已完成最新主站基线的本地回归，当前进入PR发布；新版本人网页/API真实数据、后台同窗口比对与安卓真机仍待验收。后面的早期阻塞描述保留当时的历史时点，以本摘要和最新记录为准。

最新发布准备：[生产主站441e075整合、22/22概览、146/146完整浏览器与实际Access巡检](release-verification.md)。此前日志保留原版本边界；源码未发布，新版数据流程仍待验收。

最新接通记录：[真实 Token/schema/provider 读取、机器人过滤与采样显示回归](real-data.md)；17/17 概览 Node、6/6 界面、88/88 既有 Node、123/123 Python 干净重跑。下面原实施步骤的“尚缺 Token/字段”仅为历史状态，以最新记录为准；未发布或验收。

最新追加：用户已明确安卓手机桌面 PWA 查看入口，见 [安装配置、手机图表回归与仍缺的实际证据](pwa-entry.md)。此前记录保留原执行版本边界；最新矩阵 v0.3 为 9 项本地范围通过、3 项外部阻塞，不将桌面配置检查当作手机已安装/已授权。

2026-10-09；功能 ANL-OVW；基线 e05bde17d7c43a7cae5d9cf382276ace662c29de，分支 codex/analytics-overview-20261009。用户采纳 DEC-ANL-08 B 与最近 7 个完整北京时间日/前 7 日比较。状态：**本地实现已具备，真实读取已验证，后台同口径比对/Access/线上验收阻塞，未发布**。不是把演示升级为已验收。

## 实际实现

- [概览 HTML](../../../static/admin/analytics/index.html)、[样式](../../../static/admin/analytics/overview.css)、[交互](../../../static/admin/analytics/overview.js)：PV/Visits、绝对增减与上期比较、7 日图表/可访问数值表、路径/来源最多 15 项、刷新/失败/空状态与原 Cloudflare 后台入口；手机宽度 390px 已检验。
- [日期/增减](../../../functions/_lib/analytics-domain.mjs)：北京时间排除今天，左闭右开两段 7 日；上期为零不除零。
- [Access 校验](../../../functions/_lib/access.mjs)、[中间件](../../../functions/admin/analytics/_middleware.js)：jose 6.2.12 验真实 RS256 签名、iss/aud/exp/iat/sub/email 与唯一配置本人，缺配置拒绝；不信自报 email，私有 no-store。Token 验证和数据读取服务端进行。
- [读取适配器](../../../functions/_lib/provider.mjs)、[接口](../../../functions/admin/analytics/data.js)：固定账号/站点/主机、同口径两段期间、每日聚合与排名；受控响应测试通过。GraphQL 字段/权限/机器人筛选尚未实测，真实读取仍阻塞。没有猜 bot 字段，页面明确机器人筛选尚未核对；不可与旧 Exclude bots=Yes 截图强行比数。
- [处理器](../../../functions/_lib/handler.mjs)：授权先于数据/缓存；短期服务端共享聚合/在途请求，浏览器 no-store，错误不填零。私有 API 位于 /admin/analytics/data，沿用 SW 对 /admin/ 全部排除，不改 SW 缓存逻辑。
- [路由](../../../static/_routes.json)、[Wrangler 配置](../../../wrangler.jsonc)与部署工作流：限制函数覆盖私有路径，编译模块目录进无凭据验证产物，避免在有部署权限的 job 混用另一版本业务源码。

## 实际红绿与故障记录

| 行为/故障 | 红灯与修复 | 当前实际证据 |
| --- | --- | --- |
| 完整日、日期边界 | periods-red.log 的期望区间与未实现 null 不符 → 完整日实现 | periods-green.log、periods-properties.log；3 单元/256 seed=20261009 日期样本，无实际反例，缩小尚未执行 |
| 上期零/增长率 | change-red.log 未返回正确变化 → 正确增减/零基数 | domain-green.log |
| 真实 JWT 校验 | access-red.log 未拒绝无效 JWT/未配置 → 标准签名/claim/本人验证 | auth-domain-green.log；固定测试 RSA 密钥与时点，不是真实 Access 政策验收 |
| 读取/部分失败 | provider-red.log 未实现返回对象不符合预期 → 聚合与严格响应验证 | provider-green.log；仅受控 API 响应，不是 Cloudflare schema 通过 |
| 授权/共享/缓存 | handler-red.log 未返回拒绝/共享结果 → 授权先行/在途共享/no-store | handler-green.log |
| HTML 响应保真 | middleware-red.log 将 Response 当 body，丢正文 → body/status/headers 保真包装 | backend-green.log；真实缺陷回归 middleware.test.mjs 保留 |
| UI 日期/数字与刷新 | 初次服务器 cwd 错误为配置失败，保留 ui-setup-failure.log，不算红灯；修正后 ui-red.log 确认旧页面缺概览 → UI 实现 | ui-green.log：3/3；preview-e2e.log：一条截图准备重跑，不把数量累计 |
| 桌面首屏可读 | first-screen-red.log 排名首条落在桌面首屏外 → 缩紧私有页布局，保持字号/手机布局与可访问数值表 | ui-final.log 3/3，首屏元素坐标 ≤900px，新的带测试提示预览已生成 |
| 产物打包顺序 | deploy-red.log 未在无凭据构建阶段编译 → 工作流补编译 | overview-unit-final.log |
| BUG-OVW-QA-001 模块格式 | 旧 --outfile 编译退出 0 却输出 multipart，实际运行时报语法解析失败；新 bundle.test.mjs 在成功编译后检查格式，bundle-red.log 为有效断言红灯 → --outdir 模块目录 | overview-unit-final.log：14/14；旧二进制与运行日志私有保存。初次运行语法错误不作为 TDD 红灯 |
| 运行时兼容日期 | 锁定 workerd 不支持 2026-10-09，此配置失败不是功能红灯；固定到已支持 2026-10-01，不升级依赖 | runtime-boundaries.json：博客 / 200，未配置私有页/API 503 且 private,no-store |

## 回归与当前限制

Node 概览 14/14；Python 123/123；既有 Node 88/88。既有 Node 首次因 Windows 换行改变校验锁定 Waline 字节失败，node-regression.log 保留；仅从本基线 Git blob 恢复原字节并添加 .gitattributes -text 保护，node-regression-final.log 通过，未修改 vendor 逻辑或下降 hash 断言。Pagefind 建索引后内部链接 41,549 项通过；未建 Pagefind 时的缺文件是环境准备不足，不判功能 Bug。runtime assets/portfolio 产物检查通过。

新增概览 E2E 最终 ui-final.log 3/3、既有相关 E2E 4/4 均实际手动运行；完整浏览器回归已手动执行，browser-regression.log 为 144/144（零失败/跳过/重试）。其后仅私有页 CSS/对应首屏断言改变，已定向重跑 3/3；不把分开执行的 3 条概览 E2E 合称一次 147 项全套。图片 `.local-evidence/analytics-overview/overview-preview.png` 是明确加“本地测试示意”的 synthetic fixture 界面，仅用于视觉评审。真实数据/权限用户流程还未运行，不能标功能完成。

新增依赖只有零依赖的 jose，npm 安装审计零漏洞。开发快速跑 npm run test:overview；手动 E2E：先 Hugo 新构建/必要 Pagefind，再 npm run test:overview:e2e；发布前编译 npm run build:analytics、项目约定回归、真实 RUM 与隔离未登录检查。E2E 不自动每次编辑执行。

## 尚缺与下一步

1. 本人按[设置指南](../../../docs/analytics-overview-setup.md)创建 Account Analytics Read Token，保存 Git 忽略的 .dev.vars。当前解析仅报告未配置，未发送有权请求；scripts/probe_analytics_read.mjs 是有限只读 schema 取证，不能替代正式数值比对。
2. 验证实际 GraphQL 字段、查询/采样/机器人筛选与后台同口径；若失败只修相应适配器，不从 UI fixture 造数。
3. 配置 Cloudflare Access 仅保护私有路径、本人 allow 策略；服务端团队域名/AUD/本人身份和 Token 设置为 Pages 私有绑定。此前 Cloudflare 后台登录不自动授权本站页面。
4. 部署前提供可评审产物与待验项；目前未提交/推送/部署。授权成功与未登录实际检查完成后才标本功能已验收。旧基础统计里程碑维持已验收，不与 B 混写。

最终记录见 [源码/产物与日志 SHA256](verification-record.json)。最终 UI 3/3、Node 14/14 已按当前私有页样式/图表与构建助手重跑；jose 的 MIT 许可完整附入分发模块，未复制无许可证代码。完整 144 项是明确记录版本的回归，后续仅私有展示调整由定向用例覆盖。
