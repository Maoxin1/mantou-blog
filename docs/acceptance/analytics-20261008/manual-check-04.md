# ANL 中文文章 PV 与 Visits 核对 04

证据 `E-ANL-07`；mantou 操作并提供实际后台截图，Codex 只读审阅；审阅时间 2026-10-08 06:29:21 UTC。原图及两个指标值保存在 Git 忽略的 `.local-evidence/analytics-private-manual/E-ANL-07.png`、`E-ANL-07.json`，公开记录只记验收结论。

同一画面同时可见正式 Web Analytics 站点 `mantou-blog.pages.dev`、Last 7 days (GMT+8)、Path=/p/20260803/、Exclude bots=Yes，Visits 与 Page views 都有实际数字。右侧 Page views summary 的 Total page views 与左侧卡片显示一致；这里只记录本次观察一致，不新增恒等性质或独立人数解释。已有明确数值不是有效零分类的测试。

已补：TM-ANL-002 的中文路径 PV/Visits 可查结果，TM-ANL-004 的中文文章子场景；保留筛选范围，不能当作全站汇总。还缺英文/作品路径、来源及绝对查询端点；不推断精确查询时刻或部署提交。两条矩阵整行仍阻塞，当前 15/11/1/2、ANL 整体待验收。没有改功能代码、重复跑无关 E2E或新增性能验收。

下一步仅替换 Path 为 `/en/p/20260803/`，保留相同站点、时间、排除机器人条件，观察英文文章的 PV/Visits。原中文筛选需先移除，避免保留多个不相容的路径条件。若无数据，记录实际画面，不能先填有效零或判 Bug。
