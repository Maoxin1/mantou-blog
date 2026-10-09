# 真实读取与采样说明验证

最新状态（2026-10-09）：真实只读读取、生产Access窄路径/匿名挑战、本人旧入口和四项Production Secret均有对应证据。新版代码已完成最新主站基线的本地回归，当前进入PR发布；新版本人网页/API真实数据、后台同窗口比对与安卓真机仍待验收。后面的早期阻塞描述保留当时的历史时点，以本摘要和最新记录为准。

2026-10-09；ANL-OVW；基线 e05bde17d7c43a7cae5d9cf382276ace662c29de 加当前未提交修改。关联 OVW-003/005/008、TM-OVW-004/005/007/009。结论：真实读取已验证，整体仍待验收，未发布。

## 已取得的实际证据

本人保存只读 Token 后，验证端点返回 active。有限 authenticated schema 探针四次 HTTP 200，确认 account 下 rumPageloadEventsAdaptiveGroups、count、sum.visits、avg.sampleInterval 与 bot 过滤类型。字段说明确认 bot=1 是服务商判断的机器人、bot=0 是其他访问；分类本身可能有误差。正式 provider 的全部聚合、每日与排名查询采用固定账户、siteTag、requestHost、bot=0，无额外路径过滤。

正式 provider 由本地只读仪器调用，四次数据请求均 HTTP 200，无 GraphQL errors；得到本期及上期指标、7 条日记录、15 条路径和 4 条来源。窗口为北京时间 2026-10-02 00:00 至 2026-10-09 00:00，前期为 2026-09-25 00:00 至 2026-10-02 00:00，结束不包含。不是受保护的网页/API 登录流程证据。

两个期间均存在采样。每日 PV 之和与总聚合不同，采样可能解释此差异，但尚未完成同窗口后台核对，不能凭此宣布所有差异合理或设定任意容忍度。中文路径未进入这次前 15 名，不代表零浏览；旧基础验收截图的 08:00 滚动窗口不能直接复用为新午夜完整日验收。

[官方采样文档](https://developers.cloudflare.com/analytics/graphql-api/sampling/)说明返回计数已是估算结果；保留 provider 返回值，不能再乘采样倍率。界面有明确采样信息时显示“约”，未提供采样信息时保留未知，机器人筛选元数据不明确时也不声称已排除。

## 新增验证与修复

| 行为 | 实际反馈与处理 | 证据文件（本地 Git 忽略目录） |
| --- | --- | --- |
| 每条查询同口径排除机器人 | 断言缺少 bot=0 失败，补齐全部查询和元数据，再通过；初次被错误包装的断言另存，最终红灯明确显示缺字段 | bot-filter-red.log / bot-filter-green.log |
| 页面显示已确认的机器人筛选 | 新鲜构建后仍显示旧“待核对”文字，断言失败；由已验证元数据生成说明，未知时不承诺 | bot-scope-ui-red.log / real-data-ui.log |
| 采样读数的解释 | 采样 fixture 应显示“约 26”，旧页面仅 26 导致失败；添加估算与期间说明并验证未知回退 | sampling-ui-red.log / real-data-ui.log |
| 已估算计数不再乘倍率 | 补充回归直接通过，原读取逻辑已经正确；未制造红灯 | real-data-unit-final.log |

执行环境：Windows、Node 24.18.0、Python 3.12、Playwright 1.62.1、Wrangler 4.146.0、Hugo 0.154.5、Pagefind 1.5.2。

| 实际命令/检查 | 结果 | 日志 |
| --- | --- | --- |
| node scripts/probe_analytics_read.mjs | 有界 4 次读取，schema 确认 | schema-probe-verified.log |
| npm run test:overview | 17/17 | real-data-unit-final.log |
| npm run test:overview:e2e（按需手动） | 6/6；真实浏览器、受控响应，含手机字号/断网恢复/采样 | real-data-ui.log |
| npm run test:feedback | 88/88 | real-data-node-regression.log |
| py -3.12 -m unittest discover -s tests/python（本进程 PYTHONUTF8=1） | 123/123，无编码异常 | real-data-python-utf8.log |
| hugo --gc --minify --cleanDestinationDir；npm run build:analytics；npx --yes pagefind@1.5.2 --site public | 全部构建成功 | real-data-build.log / real-data-functions-build.log / real-data-pagefind.log |
| 项目产物与内部链接检查 | 通过，41,552 条链接 | real-data-assets.log / real-data-links.log |
| 实际 Token 对照四个公开发布产物 | 未发现该 Token；私有凭据和真实读数记录均 Git 忽略 | secret-artifact-check.json |

初次全面 schema 探针 TypeError 未定位为具体网络原因，不判 Token 无效；缩小为有预算的四次查询后成功。初次 Python 虽报告 123 OK，却有 GBK reader thread 编码异常，保留原日志并改用进程范围 UTF-8 重跑得到干净结果。这些环境/仪器问题不作为功能测试预期红灯。

真实证据保存在 `.local-evidence/analytics-overview/`：token-verification.json、schema-1791521045009.json、schema-bot-description.json、real-overview-1791520517547.json。仓库仅保存结果摘要和[版本/日志哈希索引](real-data-verification-record.json)，不提交 Token、请求头或原始私有统计。公开产物凭据检查范围为所列四个文件，不声称扫描整个系统。

## 尚缺的验收

TM-OVW-009 仍缺同固定窗口、主机、站点与机器人筛选的 Cloudflare 后台核对；010 仍缺 Access 窄路径生产保护、线上绑定与本人/未登录流程；012 仍缺安卓安装后真实登录和联网读取。矩阵维持 9 项本地范围通过、3 项外部阻塞，不因 API 仪器成功把整体改为已验收。当前没有重新运行旧完整浏览器 144 项；它们保留原版本边界。

Zero Trust 当前只到套餐选择，尚未创建应用或变更线上策略。独立安装配置、当前测试和实际 API 读取均不能替代手机最终使用流程。
