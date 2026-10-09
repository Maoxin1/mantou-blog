# ANL 筛选弹窗操作问题与页面分组替代入口

证据 `E-ANL-08`，观察 `OBS-ANL-UI-01`；2026-10-08 06:37:52 UTC 只读审阅。用户报告“Add filter 选择后无法显示”。截图直接显示正确 Web Analytics 站点、Last 7 days (GMT+8)、Site/Exclude bots 两个可见条件、没有 Path 条件；Visits 是当前站点汇总，Page views 值在截图外。原图和具体数值保存在 Git 忽略的 `.local-evidence/analytics-private-manual/E-ANL-08.png`、`E-ANL-08.json`。

没有独立复现用户的点击过程，也没有错误日志；不将无弹窗猜成浏览器拦截、JS 报错、Cloudflare 上游回归或本站代码 Bug。[官方筛选步骤](https://developers.cloudflare.com/web-analytics/configuration-options/filters/)仍要求打开 Add filter 后设置条件，文档无法解释本账户当前失败原因。本轮未声称查完新的上游 Issue/Commit/Release Note。

已有可用线索：用户 E-ANL-07 的实际画面中，左侧 Page views 选中时，右侧出现 Page views summary，标签有 All、Referer、Host、Country、Path、Browser。下一步可用这个现有 Path 分组入口查看各页面 PV；不依赖新增接口，也不先修改站点配置。

范围依据：BH-ANL-003 要求实际页面路径可辨识浏览情况，TM-ANL-004 不要求每个页面都必须取得独立 Visits。先前逐页同时观察 PV/Visits 是方便的执行方法，不是新增必须约束；改用 Path 列表核对 PV 仍在原范围。没有 Path 筛选时，左侧 Visits 保持全站汇总含义，不能抄成英文/作品 Visits。

计划：点左侧 Page views 卡片，让右侧切到 Page views summary；点 Path 标签并保存实际列表。若这些交互也无响应，再在同一范围下做刷新/另一浏览器隔离对照，观察是否可重复；不先关掉全部安全功能、升级依赖或调用管理 API。实际按钮原因尚未知；替代入口尚待用户操作，不能提前标通过。

本次只补站点 Visits 子证据与操作限制，矩阵 15/11/1/2 不变。英文/作品、全站 PV、来源及绝对区间还缺，整体待验收。没有新的产品行为或 MoSCoW 变更。
