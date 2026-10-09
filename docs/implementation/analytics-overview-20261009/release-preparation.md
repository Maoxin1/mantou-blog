# 私有概览的线上配置与发布准备

功能 ANL-OVW；生产对象 mantou-blog Pages，正式入口 /admin/analytics/。本地已在 2026-10-09 快进同步到生产/远端 main 的 441e0750372f4cf2f741288a0dc77e7e793ad5e3（保留 #143/#144 DCA 更新）；统计修改尚未提交、推送、合并或发布。原 e05bde1 的验证记录保留原版本含义。

最新进度：[四项Production Secret已经自动保存](production-secrets.md)，原待填写说明保留配置方法；尚未发布。

## 上线前的私有运行配置

本地 .dev.vars 已齐全。线上四项现已通过实际API元数据核对；不能将加密保存成功当作新版运行时使用成功。使用真正 Pages 项目的 Settings→Variables and secrets，选择 Production，依次增加以下四项，类型统一为 Secret（或 Encrypt）；值从本地对应行复制，不包含两侧双引号，不截图或粘贴到聊天。它们由服务器读取。

| 名称 | 对应本地值 | 用途 |
| --- | --- | --- |
| ANALYTICS_API_TOKEN | 同名配置 | Cloudflare Account Analytics Read，仅服务端读数据 |
| ACCESS_TEAM_DOMAIN | 同名配置 | 验证 JWT 发行团队 |
| ACCESS_AUD | 同名配置 | 验证 JWT 的应用受众 |
| ACCESS_OWNER_EMAIL | 同名配置 | 限定唯一允许读取的本人 |

固定账户/siteTag/host 三项随仓库 wrangler.jsonc 的 vars 部署，私有四项不写入 vars。Wrangler 文件将成为可配置字段的来源；不把读取 Token 写入版本库或替代现有部署 Token。官方 [Pages Secrets](https://developers.cloudflare.com/pages/functions/bindings/#secrets)明确 Secret 需在使用它的部署之前设置，设置后不能在后台再查看明文；与普通环境变量一样通过 context.env 使用。

## 可评审变更与发布路线

变更包括私有入口概览、服务端读取与本人 JWT 校验、独立安卓安装清单、构建脚本/验证工作流及正式测试。原有公开博客采集脚本与原 PWA 身份保持既有实现；仅私有入口进入新概览。已有实际匿名检查显示公开页面正常、统计父/子路径要求 Access，用户截图显示本人可以看到原入口；这些不等于新代码已上线。

按现有部署运行手册通过 PR 进入 main，经 Validate、Deploy Pages 与生产冒烟；不直接推 main、不绕过门禁本地覆盖正式站。不合并与本轮无关的 PR 或更改 Pages 项目类型。发布具体源码应再次核对 main 是否前进；本次保留所有历史失败/缺证据，不降低验收口径。

发布后的验收：本人从 CMS/统计桌面入口打开新概览、返回真实数据；固定北京时间两个完整 7 日与后台同筛选核对，注明采样估算；未登录/无权/失效不得读数据、公开页面仍可访问；安卓安装并从图标重新打开。前两类实际技术证据已取得部分，后台校准和真机仍需本人结果。

当前阶段结束点：可评审的新版产物与最新基线回归证据准备完成后，继续配置线上 Secret；确认准备情况并获得明确发布采纳后进入 PR/部署流程。整体保持待验收，不把准备完成写成上线或已验收。
