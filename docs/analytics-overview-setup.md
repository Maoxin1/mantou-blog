# 私有概览页配置：凭据只放本地私有文件或 Pages Secret

最新状态（2026-10-09）：真实只读读取、生产Access窄路径/匿名挑战、本人旧入口和四项Production Secret均有对应证据。新版代码已完成最新主站基线的本地回归，当前进入PR发布；新版本人网页/API真实数据、后台同窗口比对与安卓真机仍待验收。后面的早期阻塞描述保留当时的历史时点，以本摘要和最新记录为准。

本功能 ANL-OVW 尚未发布；2026-10-09 Token 已保存并验证 active，实际 schema 和正式 provider 读取成功，见[接通记录](implementation/analytics-overview-20261009/real-data.md)。本人截图已确认 Zero Trust Free 启用，团队名 frosty-fire-be92；统计 Access 应用尚未确认创建；`.dev.vars` 已 Git 忽略，勿在聊天、截图、公开代码或 HAR 中提供 Token。当前 API/身份参数未配置时，私有页与接口拒绝读取，公开博客仍可访问。

## 先创建只读统计 Token

1. 打开 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) → Create Token → Custom token。
2. 名称 mantou-blog-analytics-read，权限 Account → Account Analytics → Read；资源只选择博客所属账户，核对 summary 后创建。不要选择 Edit 权限或增加全账户部署权限。
3. 复制 Token，打开本工作区 `.dev.vars`，将 `ANALYTICS_API_TOKEN=""` 的空引号替换为实际值并保存。其他已写的 account/site/host 不用变。
4. 只回复“已保存”；我会做只读 schema/能力核对，日志不保存 Token 或原始请求头。

来源：[官方 Analytics Token 指南](https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/)。如界面字段不同，按实际画面核对，不要求额外权限填补猜测。

### 找不到权限项时：官方预填方式（2026-10-09）

mantou 在实际个人 Token 界面未找到 Account Analytics；官方文字及配置截图仍是该名称，缺项原因尚未确定，不把 Analytics/Access/Account Settings 自动当作等价项。官方支持通过 [模板 URL](https://developers.cloudflare.com/fundamentals/api/how-to/account-owned-token-template/#analytics-and-monitoring)预填 account_analytics/read。

使用[本博客账户的只读预填表单](https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22account_analytics%22%2C%22type%22%3A%22read%22%7D%5D&accountId=60fce3c87fe0af3ac0a66d4b03594598&zoneId=all&name=mantou-blog-analytics-read)。这是根据官方参数构造的链接，本人实际截图已确认预填正确的权限与本博客账户，随后 Token 验证及读取成功；仅预填表单，不会自动创建 Token。打开后核对只出现统计 Read 权限，Account Resources 限定本博客账户；若未预填或出现不相关权限，先记录实际表单/错误，不创建更大权限 Token。zoneId=all 是官方模板参数，但此链接没有请求 Zone 权限。

用户/账户 Token 的可授予权限受创建者成员权限约束；目前没有证据认定这是此次缺项原因，也不要求新增管理员权限。真实 Token 已验证，接口实际读取成功；矩阵 009 的后台同口径比对仍未完成。

## 随后配置本站私有登录

Cloudflare 控制台登录不等于本站登录。概览采用 Cloudflare Access，并在服务端验证 JWT，团队域名、应用 AUD 和本人允许身份是不同于统计读取 Token 的配置。

需要收集非密钥配置：Access 团队域名 `<team>.cloudflareaccess.com`、该应用 AUD、唯一允许查看的本人邮箱；写入 `.dev.vars` 中 ACCESS_TEAM_DOMAIN、ACCESS_AUD、ACCESS_OWNER_EMAIL。邮箱不必发聊天，直接填写本地私有文件。

平台配置的最终步骤须根据当前账户/Pages UI 核对。保护范围限定 `mantou-blog.pages.dev/admin/analytics` 及其子路径（包含 data）；**不能把整个公开博客锁住**。只有本人 allow 策略，未经验证不加 Bypass/Everyone 规则。官方 [路径规则](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)、[Pages Access 注意事项](https://developers.cloudflare.com/pages/platform/known-issues/)、[JWT 验证](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)供实际设置时参考；没有声称当前 Access 应用已经创建。

## 发布时的私有绑定与验收

### 2026-10-09 平台复核：先核对生产保护方式

官方 Pages [预览保护](https://developers.cloudflare.com/pages/configuration/preview-deployments/#customize-preview-deployments-access)默认只保护随机预览 URL；[生产 pages.dev 配置](https://developers.cloudflare.com/pages/platform/known-issues/#enable-access-on-your-pagesdev-domain)要求管理 Pages 自动生成的 Access 应用。不能把“preview 已启用”当成生产已保护，也不能直接照删除主机通配符的示例提交整站保护。

普通 [Self-hosted 应用指南](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)要求账户内 active zone；当前只知道 pages.dev，不假定它会出现在普通 Domain 下拉框，不新增 pages.dev Zone/DNS。采用 Pages 已生成应用并限定 Path 的方案，是由生产支持与一般路径规则组合得到的推论，**尚未实测**。这项技术未知不阻断先验证统计 Token，但阻断线上权限验收。

先查看实际应用能否在同一个保存动作中限定生产 Host 和 admin/analytics 路径，再决定设置；路径规则明确仅通配 admin/analytics/* 不覆盖父路径。应用须覆盖父路径和子路径，并实际证明公开首页/文章/安装元信息未被锁住。若平台不能提供该边界，暂停此项，另提出自定义域名或独立私有 Pages 项目两种范围选择，未经采纳不切换主机或购买域名。

现有服务端代码仅验证 Access 提供的 JWT，并不发起登录挑战；仅填写 ACCESS_* 变量不能生成登录页，也不会自动设置线上绑定。真实记录使用[人工验收模板](acceptance/analytics-overview-20261009/manual-live-check.md)，模板状态保持未执行。

将 ANALYTICS_API_TOKEN 存 Pages Secret；Access 身份配置作为私有环境绑定，Account/Site/Host 是固定非密钥配置。不要把 .dev.vars 上传到 GitHub，或把读取 Token 复用成部署 Token。绑定/策略真实设置与发布尚未执行，不能据本地 mock 验收替代。

本地只读取证：`node scripts/probe_analytics_read.mjs`，预算最多四次有界 schema 请求、每次 15 秒、总预算 45 秒，输出私有 metadata 与不含 Token 的摘要；失败不继续暴力重试。若接口支持与读取权限成立，后续按同一完整日区间核对真实 PV/Visits/日趋势/排名，再以隔离未登录窗口检查私有 API。

首次 Zero Trust 设置：当前界面选左侧 Free（截图 $0/seat/month，50 用户上限）。[官方入门](https://developers.cloudflare.com/cloudflare-one/setup/)说明免费套餐也可能要求付款信息但不收费；本人仅在 Cloudflare 页面填写。团队名称用于 `<team>.cloudflareaccess.com`。应用保护路径/本人 Allow 策略另行核对，选套餐不等于私有路径已被保护。

最新实际界面（2026-10-09）：Cloudflare One Overview 的 Account details 显示 Plan=Zero Trust Free、Team name=frosty-fire-be92。只确认组织/套餐已启用，不确认应用保护已创建。下一步查看 Pages 项目 Settings 的 Enable access policy / Manage；从 Pages 生成应用复核生产 Host+admin/analytics 路径，保留前述窄路径 SPEC GAP。当前不修改博客线上保护规则。

2026-10-09 界面纠正：本人截图显示 Delete Worker、Edit code 和独立 Access 标签，属于 Worker 设置布局，与仓库 wrangler pages deploy --project-name=mantou-blog 的 Pages 部署目标不符。截图未证明两个资源是否同名或发生迁移，先定位实际 mantou-blog.pages.dev Pages 项目，不据此迁移方案。官方 Workers Access（https://developers.cloudflare.com/workers/configuration/cloudflare-access/）说明 Protect one Worker 会覆盖该 Worker 的全部域名/路由；不能将它作为只保护统计路径的等价操作。当前只修正导航并记录证据，未改任何云配置。

2026-10-09 Pages 实际应用进度：本人正确 Pages 设置截图显示 Preview access restricted；随后 Manage 打开 mantou-blog - Cloudflare Pages 应用，Public hostnames 当前为 Subdomain=*、Domain=mantou-blog.pages.dev、Path 空。这确认预览应用已生成，不证明实际未登录挑战或生产保护。拟在同一配置中删 Subdomain 通配符、Path 填 admin/analytics，并核对仅本人 Allow 后保存；字段可编辑/保存结果及实际路径保护仍未知，不关闭 010。父路径和子路径继承来自官方 app-paths，不能用单独 admin/analytics/* 取代父路径。将预览应用改为生产窄路径后，预览是否需独立恢复保护另作记录，不宣称原预览规则继续有效。

SPEC GAP ACCESS-UI-01（2026-10-09）：mantou 实际反馈现有 Pages Access 应用的 Subdomain/Domain/Path 无法编辑。官方 Pages known-issues 仍描述 Configure 后可删 wildcard，但未找到解释当前锁定的官方证据。不能认定是成员权限、永久平台限制或可用 API 绕过；不让用户扩大 Analytics Token 权限。下一项有限只读诊断：从 Applications 列表检查该应用的 Configure/Edit 操作入口与应用类型，若仍同样锁定再评估范围替代，不删除现有应用、不改全站保护。当前 UI 不可编辑是实际阻塞证据，未计作软件 TDD 红灯。

ACCESS-UI-01 更新（2026-10-09）：本人通过 Applications 列表右侧菜单 Edit 进入后，字段可编辑，截图确认 Subdomain 空、Domain mantou-blog.pages.dev、Path admin/analytics，尚未 Save。编辑入口问题已解决；不再列为平台字段限制，不需要 API 绕过/增加 Token 权限或切换部署范围。生产保存、本人 Allow 策略及实际窄路径访问仍未验证，TM-OVW-010/012 保持阻塞。下一步核对 Policies 中现有 Allow Members - Cloudflare Pages 的实际规则，名称不证明仅本人访问。

2026-10-09 本人规则实际复核：应用列表只有一个 Allow 策略/一条规则；本人展开该策略的截图显示 Include→Emails 为单一完整本人邮箱，没有将整个账户成员或邮箱域视为本人。现有已保存应用关联仍显示 *.mantou-blog.pages.dev，说明拟修改正式主机/路径尚不能判定保存成功。可关闭策略详情，回原应用核对目的地主机与 admin/analytics 路径后保存；后续仍需实际匿名/本人访问验收。团队域名与本人邮箱已补本地 Git 忽略配置，AUD 尚缺；公开文档不写本人邮箱。预览保护后续单独核对，未发布概览代码。

AUD 指引纠正（2026-10-09）：本人 Details 截图仅有 Name/Session Duration，此前引导该处找 AUD 不适用。已核对官方 validating-json 的 Get your AUD tag：Configure→Additional settings→Application Audience (AUD) Tag（https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/#get-your-aud-tag）。优先这个明确入口，不要求用户复制整份 JSON、登录 Cookie 或扩大 API 权限；AUD 尚未取得，主机/路径保存尚无成功证据。Copy as JSON 为官方可用备用方式，但尚未执行，不假定导出必含 aud。

2026-10-09 AUD 与生产访问进度：本人 Additional settings→AUD tag 截图提供正确应用标识，已填本地 .dev.vars，四项所需私有配置齐全。[生产匿名路径实际检查](implementation/analytics-overview-20261009/access-anonymous.md)确认统计父路径、尾斜杠路径、data 子路径均 302 到本团队 Access 登录，首页/中英文文章/作品保持200、相似路径未被额外挑战。生产窄路径生效有证据，不再把保存未知作为阻塞原因；本人授权返回、私有线上绑定、新版概览发布和安卓仍未验收。

最新上线准备：[四项Production Secret及PR发布路线](implementation/analytics-overview-20261009/release-preparation.md)，[主站441e075整合与已实际运行的回归](implementation/analytics-overview-20261009/release-verification.md)。本人旧入口截图有证据，新版概览尚未发布或验收。

2026-10-09 线上 Secret 设置界面已核对：本人 Pages Settings 截图环境为 Production，Variables and secrets 当前仅见 HUGO_ENV=production（Text），下方另有 Bindings 的 Add。四项统计/Access 私有绑定尚无保存证据；应使用 Variables and secrets 的 Add，类型 Secret，值从 Git 忽略 .dev.vars 对应行复制，不含引号，不改原 HUGO_ENV。本人之前请求的同一私有文件已重新用记事本打开，供本人填写；未读出或打印凭据，未使用下方资源绑定入口。

最新状态：本人明确要求自动填写后，[四项Production Secret已经API加密保存和元数据核对](implementation/analytics-overview-20261009/production-secrets.md)，既有HUGO_ENV、预览env_vars和正式部署未改变。无需本人重复填写；新版运行时实际读取仍需发布后的端到端证据。

发布授权与配置保留：用户明确继续推进发布，已在wrangler.jsonc的env.production.vars保留线上HUGO_ENV=production及三项Analytics公开配置；四Secret仍云端加密。当前等待PR/自动发布，不把已保存Secret当新版运行结果。
