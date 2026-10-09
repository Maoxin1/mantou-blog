# ANL URL 筛选核对：英文路径条件仍存在

证据 `E-ANL-12`；mantou 提供当前普通报表 URL，2026-10-08 07:40:11 UTC 收录/解析。原始网址及生成的两个导航链接保存在 Git 忽略的 `.local-evidence/analytics-private-manual/E-ANL-12.json`，不在公开记录复制账户/站点标识或具体计数。

直接证据：解码得到 `path=/en/p/20260803/`，并有 siteTag~in、excludeBots=Yes、time-window=10080。当前网址仍限定英文路径，虽然前几张截图没有渲染可见 Path 条件标签。time-window 与界面过去 7 天一致，是相对窗口；不能据此补造绝对端点或精确查询时间。

必须修正的解释：E-ANL-08～11 中“没有可见 Path”只是画面观察，不证明查询无路径条件。我先前将相关卡片称为全站汇总缺少依据，应撤回这个范围解释。原数字、英文路径和供应商来源分类的实际可读观察保留；E-ANL-10 的来源读取通过限定于已观察的页面/查询条件，不升级为全站来源已验。历史截图各自 URL 未留存，不能断言所有历史操作完全相同；全站汇总需重新取得没有 path 的实际查询证据。

OBS-ANL-UI-02 的当前仅英文/作品未出现已有直接查询原因：path 限定英文。它不是作品零访问或缺少 loader 的证明，也不是显示 5 条造成的完整列表截断。OBS-ANL-UI-01 的 Add filter 不出弹窗仍未定位，未声称修复服务商 UI。

下一步构造同一路由的作品查询：仅将 path 改为 `/works/mantou-checklist-pwa/`，保留 siteTag、excludeBots、time-window。另构造去掉 path 的站点查询供后续汇总/来源核对。使用本地 URL 解析检查三项参数、域名、路由保持一致，路径替换/移除符合预期；只生成导航链接，未访问账户、调用管理/读取 API或执行正式产品测试。导航后的实际结果还需本人提供，计划链接不能标验收通过。

技术辨析：服务商官方定义 site_tag 为站点标识、site_token 为采集 token，[字段说明](https://developers.cloudflare.com/api/typescript/resources/rum/subresources/site_info/methods/get/)。不能仅因 URL siteTag 字符与 HTML 采集标识不同就判配置错误；本次没有获取账户映射或站点管理配置，也不借此启用自动 API验收。

矩阵仍 16 通过、10 阻塞、1 延期、2 不适用；005 是实际来源读取的有限范围通过，002 全站/完整上下文与 004 作品还阻塞，整体待验收。原判断及其纠正均保留，规范/优先级/MoSCoW 不改，不以解释调整制造整体验收。
