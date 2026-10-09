# ANL 当前多来源分组：实际来源可查

证据 `E-ANL-15`，2026-10-09（Asia/Shanghai）审阅。用户按上一轮指导打开 Referer 分组；截图原件、实际数值、审阅时点和 SHA256 保存于 Git 忽略的 `.local-evidence/analytics-private-manual/E-ANL-15.png`、`E-ANL-15.json`。审阅时点不冒充查询时点。

当前选择 Page views、Referer，站点 mantou-blog.pages.dev，Last 7 days (GMT+8)，Exclude bots=Yes。五条来源分别为 `None (direct)`、`mantou-blog.pages.dev`、`127.0.0.1`、`weixin110.qq.com`、`bing.com`，数值均实际可读。卡片 PV/Visits 及来源分组汇总也可读；当前可见来源数值之和与卡片相同，仅记录这次观察，不引入永久的明细求和约束。

这证明本次查询支持来源读取，不识别具体个人或活动渠道。None (direct) 不能证明访客手输网址；127.0.0.1 位于来源维度，不是访客 IP，也不能仅凭这一行判定非生产主机运行了本站采集。其他域名也只按原标签记录，不将其解释为确定的分享方式。当前未展示地址栏，不能单凭无可见 Path 标签保证没有其他筛选。

关联 [TM-ANL-005](../../test-matrix-analytics.md)：已有通过状态新增真实多来源证据，未增加测试范围。TM-ANL-017 缺失来源的完整分类、受控边界与解释口径仍未闭合；TM-ANL-002/004/018 所需共同绝对区间与查询时点仍缺。维持 16 通过、10 阻塞、1 延期、2 不适用，ANL 整体待验收。

下一步点击右上角 Last 7 days (GMT+8) 日期选择器，查看是否展示绝对起止时间；先核对实际画面，不猜自定义按钮名称或端点。若滚动窗口无法恢复，选择一个固定区间后复核必要的汇总、页面和来源。没有新增功能代码、采集请求或功能测试执行。
