# 最新主站整合与发布前验证

最新状态（2026-10-09）：真实只读读取、生产Access窄路径/匿名挑战、本人旧入口和四项Production Secret均有对应证据。新版代码已完成最新主站基线的本地回归，当前进入PR发布；新版本人网页/API真实数据、后台同窗口比对与安卓真机仍待验收。后面的早期阻塞描述保留当时的历史时点，以本摘要和最新记录为准。

2026-10-09；ANL-OVW。用户截图显示本人能到达原 Website analytics 入口，见[用户证据记录](owner-entry-record.json)；此前实际未登录父/子路径302及公开页200检查继续有效。这不是新版概览或私有数据接口已经上线。

## 版本与已运行检查

上线准备发现远端 main/生产 version.json 都已更新到 441e0750372f4cf2f741288a0dc77e7e793ad5e3。当前工作分支从 e05bde1 快进到该版本，完整保留 #143/#144 DCA 更新；统计修改无冲突保留，没有修改其他工作区、提交、推送或部署。当前证据为新基线加未提交修改的产物，旧日志保留各自版本边界。

| 实际检查 | 最新结果 | 私有日志 |
| --- | --- | --- |
| npm run test:overview | 22/22；包括新增巡检回归5项 | release-overview-unit-final.log |
| npm run test:feedback | 94/94 | release-node-regression.log |
| Python 3.12 discover（进程范围 PYTHONUTF8=1） | 123/123，无编码异常 | release-python-regression.log |
| npm run test:overview:e2e（手动） | 6/6，受控API，不是真实数据UI | release-overview-ui.log |
| npm run test:e2e（发布准备时手动） | 146/146，4.3分钟，无失败/重试/跳过 | release-browser-regression.log |
| 生产相关 smoke（手动，--grep 正式 Sveltia/私有统计，--retries=0） | 2/2；实际3个统计路径被挑战及原CMS缓存边界 | release-live-access-smoke.log |
| Hugo、Worker编译、Pagefind | 通过 | release-hugo.log / release-worker.log / release-pagefind.log |
| 源内容/后台/翻译/作品校验与产物/短URL/SEO/Garden检查 | 全部通过；内部链接41,553，文章206篇 | release-*.py.log |
| 凭据泄漏检查 | 检查全部公开产物及指定可评审源码/文档，未发现实际读取Token | release-secret-check-final.json |

检查采用既有工具，没有新增统计服务、数据库或测试框架。全浏览器回归因集成最新生产基线和准备发布而手动启用，不改为每次操作自动执行。

## BUG-OVW-QA-003：旧巡检错误检查登录页的缓存

触发：统计入口改为实际 Access 保护。旧生产 smoke 用 request.get 默认跟随跳转，读取的是登录页200；实际复现该页面不提供 cache-control，于是旧 no-store 断言失败。问题在巡检检查对象，不是统计路径应当公开或取消缓存要求。之前“可能把200当统计可读”是风险推断，实际旧断言没有全绿，不能把推断写成已观察的假阳性。原元数据证据 smoke-follow-legacy.json 保留，不保存 Cookie、响应正文或重定向查询。

按同一个行为的小循环：提取旧检查保持原语义，加入生产资源回归；smoke-boundary-red.log 4失败/1通过，关键正常挑战用例因跟随登录、缺 no-store 失败，公开200拒绝用例也捕获旧接受条件。最小修复：私有父/子路径禁跟随重定向，验证本站/本团队 HTTPS 登录挑战和原响应 no-store；公开CMS仍保留原可读与 no-store 两个断言。smoke-boundary-green.log 5/5；最终全overview22/22，实际生产相关smoke2/2。错误团队、匿名公开200、缓存缺失回归均保留。

此修复关联 OVW-004/005、TM-OVW-007/010，属于已采纳的私有边界验证，没有增加账户系统或修改产品规范。没有为绿灯删除缓存要求，也不把仪器配置错误算作功能红灯。

## 仍需完成

[线上配置与发布路线](release-preparation.md)列出四项 Production Secret 与已有PR门禁。线上Secret未确认设置、改动尚未进入PR/部署；新版本人网页→API→真实数据显示、同午夜窗口后台比对、未授权身份/到期后的流程及安卓安装尚未验证。TM-OVW-009/010/012仍阻塞，整体待验收；9项本地通过不自动变成整体验收。

[版本/源码/产物/日志哈希](release-verification-record.json)；公开文档不保存统计Token或原始私有报表。
