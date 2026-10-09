# 安卓统计桌面入口：本地实现与证据

2026-10-09；ANL-OVW，DEC-OVW-02；基线 e05bde17d7c43a7cae5d9cf382276ace662c29de。状态：**安装配置本地已验证，真实数据、Access、部署及安卓真机验收仍阻塞**。没有提交、推送、部署或创建 D1/Umami。点击统计方向被用户澄清替代，其旧提问记录保留历史含义。

## 实现与边界

- [独立安装清单](../../../static/analytics-app.webmanifest)：名称“mantou · 网站数据”，short_name“网站数据”，id/start_url/scope 为 /admin/analytics/，display=standalone，复用已存在的 192/512 图标。
- [概览 HTML](../../../static/admin/analytics/index.html)增加清单、图标/主题元信息和安卓安装指引；桌面图标启动目标是概览，不是博客首页。
- [图表](../../../static/admin/analytics/overview.js)按容器实际宽度布局，并在旋转/窗口变化时重绘；失败清空后不会因重绘恢复旧曲线。修复 BUG-OVW-QA-002：原固定 1040 宽 SVG 在 390px 手机只剩约 5px 字高，原“无横向溢出”检查遗漏可读性。
- 安装清单仅含公开的非敏感元信息，放在私有 Access 路径之外；概览与数据仍受既有中间件保护。公开清单不包含统计数字、凭据或身份信息。
- 保留 /site.webmanifest、/en/site.webmanifest 的博客 App 身份和根 SW；没有追加 SW 或离线报表缓存。既有 SW 对 /admin 整体放行，不能把公共内容的缓存策略套到报表。
- 安装资源能读取不代表安装后已授权，也不代表 Token/真实接口已接通。安装形态取决于实际安卓设备/浏览器；手机未提供独立安装时可继续网页查看，不承诺所有机型都提供 WebAPK。

[MDN 安装要求](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)与[独立 App 身份](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/id)足以支持本次最小实现，未展开无关开源比较。MDN 明确安装不以新 SW 为必要前提；本项目选择在线数据访问，不用离线能力演示替代真实统计。

## 本次实际执行

日志保存在 Git 忽略的 .local-evidence/analytics-overview，见 [文件及日志哈希](pwa-verification-record.json)。

| 检查 | 命令/证据 | 结果及限制 |
| --- | --- | --- |
| 独立启动与身份、图标尺寸 | node --test tests/overview/pwa.test.mjs；pwa-red.log → pwa-green.log | 原页面缺清单链接触发有效断言失败；最小实现后 1/1 通过。不是依赖/语法失败 |
| 概览集成回归 | npm run test:overview；pwa-unit-final.log | 15/15，包括原授权/日期/上游故障与 256 日期样本；新条目只验证安装配置 |
| 界面/浏览器解析/断网恢复 | npm run test:overview:e2e；最终 pwa-ui-final-2.log | 5/5；390px 无横向溢出，图表标注实际字高 ≥10px，Chromium CDP 解析清单与图标、安装指引、实际断网后清空旧指标/曲线，恢复重新读取受控数据；不是真机安装 |
| BUG-OVW-QA-002 手机图表可读性 | pwa-mobile-chart-red.log → pwa-ui-final-2.log | 手机预览发现缩放文字过小；新增实际几何检查失败，收到 5px <10px；最小改为按容器宽度绘制、resize 重绘且清空时丢弃旧曲线，最终 5/5。保留有效回归，不改统计口径 |
| 新用例预期修正 | pwa-ui.log 保留 4 通过/1 失败 | 恢复测试误要求 data-error=false；实现原本移除标记，符合错误状态解除规则。依据 refresh 开始时删除标记的代码修正为无 true 标记且成功提示，不改功能、不删除清空/恢复数字断言；不算产品 Bug 红→绿 |
| 既有 Node 回归 | npm run test:feedback；pwa-node-regression.log | 88/88 |
| 相关 SW 边界回归 | py -3.12 -m unittest discover -s tests/python -p test_service_worker_reliability.py；pwa-sw-regression.log | 18/18；首次 python 命令不可用是环境入口错误，不算测试通过/功能红灯 |
| 构建 | hugo --gc --minify --cleanDestinationDir；npm run build:analytics；npx --yes pagefind@1.5.2 --site public | 最终 pwa-build-final.log / pwa-functions-build-final.log / pwa-pagefind.log；Hugo、实际 Worker 与搜索索引构建通过 |
| 本地 Pages 边界 | Wrangler pages dev public --port 4192；pwa-runtime-boundaries.json | 公开博客与非敏感清单 200；当前缺授权配置的私有页/API 503 且 private,no-store。仅证明未配置时拒绝，未验证真实 Access |

没有因小范围安装元信息改动重复全套 144 浏览器/123 Python；以前的完整回归保持原版本证据。本次服务器已停止，未建立后台常驻进程。

手机 [预览截图](../../../.local-evidence/analytics-overview/pwa-mobile-preview.png)已加测试数据提示；最初补截图单独执行 pwa-mobile-preview.log 1/1，后续图表修复又执行最终 5/5，不累加测试数量。API 和授权实现未在图表修复中改变，15/15 与 88/88 的执行版本边界以哈希记录为准。

## 待真实验收 TM-OVW-012

1. 先完成 009 的真实读取/同口径比较、010 的 Access 配置及发布流程。
2. 在 mantou 的安卓手机，记录浏览器和实际安装形态；本人登录后用浏览器菜单安装或添加到桌面。
3. 从“网站数据”桌面图标启动，确认到达正确站点概览并读取真实数据。授权过期时重新登录，不以“首次安装成功”保证永远免登录。
4. 隔离未授权访问仍拒绝；断网/读取失败不能冒充当前零流量。手机流程须保留实际记录，桌面 Chromium/CDP 及受控数据都不能替代。

当前结束点是本地入口已具备并完成相关检查，整个 ANL-OVW 仍待外部验收。三句复盘示例：本轮选择安卓桌面统计入口；依据是复用 B 的单页概览和现有私有边界即可减少找入口；下次根据真机安装、登录与真实读数结果调整。复盘示例不计入软件验收。
