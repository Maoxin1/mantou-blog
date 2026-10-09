# 作品打开点击：ANL-CLK

**当前状态更正：已被用户澄清替代，不实施。** mantou 明确“退回本次交流”，真正需要的是把博客流量概览作为安卓手机桌面 PWA 入口，而不是统计作品点击。下文保留此前选择/解释的历史记录，不再视为现行范围；DEC-CLK-01 未采纳任何路线，没有创建 D1、Umami 或点击代码。当前范围回到 ANL-OVW，增补移动 PWA 入口。

2026-10-09；父功能 ANL，关联原 ANL-013。状态：**点击次数这一目标已采纳，采集与保存方案待确认，未实现/未验收**。不改变 ANL-OVW 已采纳范围及其真实数据/Access 阻塞状态。

## 已明确的实际结果

mantou 已选择“统计博客‘查看作品’按钮的点击次数”。希望知道作品介绍页的浏览中，有多少次触发打开作品的动作；点击次数不等于人数，也不证明目标 PWA 成功加载或被使用。清单 PWA 是首个实际验收对象；不自动扩大到 PWA 内部编辑、安装、订阅或完整漏斗。

| 稳定 ID | 需求/决定 | 状态 |
| --- | --- | --- |
| CLK-001 | 记录博客作品详情页主“查看作品”按钮的点击次数，并能查看清单 PWA 的结果 | 目标已采纳；代码未实现 |
| CLK-002 | 能按明确时间区间读取点击汇总 | 需随展示方案确定；建议复用 OVW 北京时间两个完整 7 日，不自动升级为点击验收要求 |
| CLK-003 | 点击正常打开作品；采集失败不阻断外链打开、不伪造计数 | 推荐行为待确认；必须验证异常/中断而非只检查事件请求发出 |
| CLK-004 | 同一次上报重试与用户重复点击如何计数；仅清单 PWA 还是全部作品主按钮 | SPEC GAP；不擅自把重试次数或访问人数写为点击量 |
| CLK-005 | 汇总保持本人可读，限制公开写入输入/滥用，凭据不进入前端 | 推荐边界待确认；新公开事件写入口与已有私有报表边界不同 |

## 已有证据与复用范围

- 当前作品模板普通外链已有打开行为，没有点击事件钩子：[模板](../../layouts/works/single.html)；[清单 PWA 配置](../../content/works/mantou-checklist-pwa.md)指向独立作品域名。
- 复用 [RES-ANL-001](../research/analytics-20261008/README.md) 的 PR #114 Umami 候选记录。本轮只读复核本地 Git 对象 52c37696a95bea98fe13fb458c596f676498b100（2026-09-26），无需 fetch/clone/checkout；没有重新查询远程 PR 状态。已有历史版本不等于已部署/适配现主分支。
- 候选在[详情按钮](https://github.com/Maoxin1/mantou-blog/blob/52c37696a95bea98fe13fb458c596f676498b100/layouts/works/single.html#L17)、作品卡和旧首页标记 artifact_open，但没有作品 ID，多个作品共用页面时不能直接区分目标；入口位置也待本轮确认，不整包迁入。已找到的[候选测试](https://github.com/Maoxin1/mantou-blog/blob/52c37696a95bea98fe13fb458c596f676498b100/tests/e2e/portfolio.spec.js#L308)仅用替身验证订阅事件，没有作品点击持久化证据，本轮未执行。
- 若选择 A，匿名事件采集必须位于现有 /admin/analytics 私有 Access 子树之外，并加入现有 _routes 及统一 _worker.js 编译；目前没有 D1 绑定。公开写入与私有读取需要分别验证，不能只添加 HTML 事件属性。
- Cloudflare Web Analytics 当前不支持自定义事件：[官方 FAQ](https://developers.cloudflare.com/web-analytics/faq/)。此前 Analytics Read Token 用于读取访问数据，不能据此启用按钮点击。
- Umami 官方支持元素/JavaScript 事件：[事件说明](https://docs.umami.is/docs/track-events)。不为只记录主按钮而引入候选中的全部 RSS/邮件漏斗。

## 保存方式：DEC-CLK-01，待用户选择

| 选项 | 实际结果 | 依赖与代价 |
| --- | --- | --- |
| A Cloudflare Pages Functions + D1（推荐） | 保存少量点击数据，再由私有概览读取 | 新增 D1 云数据库及绑定、写入安全/计数维护；沿用当前 Pages、Wrangler 和 Access，不需另一个统计供应商。推荐是基于已采纳的博客概览入口，不代表数据库已创建或方案已采纳 |
| B Umami 事件后台 | 新增统计账号后，从 Umami 后台查看作品点击 | 可复用现有候选研究，但当前没有配置 Website ID/账号证据；免费托管方案的 API 接入不在套餐能力中，接入自有概览需另评付费或自托管成本 |

依据：[Pages D1 绑定](https://developers.cloudflare.com/pages/functions/bindings/#d1-databases)、[D1 费用](https://developers.cloudflare.com/d1/platform/pricing/)、[Umami 当前套餐](https://umami.is/pricing)，核对日期 2026-10-09。D1 有免费额度，但未核对本人实际套餐和其他用量，不承诺永久零费用；Umami Hobby 当前 1 网站/100K 事件每月，Pro API 套餐当前 $20/月，未创建账号或购买服务。

## 当前阶段与结束点

先澄清核心计数与保存方案，再增量建立正式规范/矩阵并实现。已授权的点击目标不自动采纳全部 ANL-013 或改变旧轮 Won’t；原决策与证据保留。本记录阶段只更新文档，不修改功能代码、创建云资源或发布。

必须补的实际证据包括：动作能打开 PWA、点击记录与私有查看贯通、未点击不产生事件、采集失败仍可打开；重复/重试、权限、非法输入与持久化按选定方案明确后加入正式测试。实验成功不能替代线上验收。
