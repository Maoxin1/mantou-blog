# 网站数据独立应用入口修复

2026-10-09；ANL-OVW；BUG-OVW-QA-005。从生产 `8cb9052` 开始，在独立工作区 `mantou-blog-analytics-app` 实施；此前桌面/手机真实概览和发布证据已带入本分支，私有截图与配置不提交。

## 实际问题和目标

用户实际确认：Chrome菜单“已安装此应用”可以在没有地址栏的窗口显示数据，但应用列表只有博客图标，从该图标启动回到博客首页。创建的“网站数据”快捷方式则在普通Chrome中打开；独立统计桌面入口未交付。

此前仅核对不同manifest ID，没有覆盖已安装博客根scope包含统计路径的情况。[Google官方说明](https://web.dev/articles/building-multiple-pwas-on-the-same-domain)列出嵌套PWA的安装提示及链接捕获限制，并推荐不同origin承载独立应用。本站的实际结果与该限制一致；未捕获手机安装数据库或manifest ID，不将其称为已证实的Chrome新版本Bug。

实际结果目标：安卓Chrome可把独立“网站数据”应用装入应用列表/桌面，从应用图标启动直接进入概览，显示真实数据且刷新有效。普通网页可读和在旧博客应用中打开数据不能替代该结果。

## 实现

- 安装入口：`https://mantou-blog-data.pages.dev/admin/analytics/`，与博客分开origin，保留统计启动路径、名称、图标与standalone配置。
- 新Pages项目只发布统计HTML/JS/CSS、安装元信息/图标、已验证的同一后端模块及发布版本；不复制博客正文、博客SW、CMS配置或本地私有文件。
- 数据源仍固定为`mantou-blog.pages.dev`，日期/机器人筛选/采样口径与读取Token权限不变。四项生产Secret已加密保存，值不进入代码或产物；见[项目准备元数据](project-setup-record.json)。
- 新页面的博客首页、CMS与文章链接回到原博客。概览明确提供“独立应用入口”，安装指引区分应用与普通快捷方式。
- 复用既有Access应用/AUD/本人Allow策略，需添加第二个主机的`admin/analytics`目的地。自动化OAuth只有Pages管理权限，没有Access规则编辑权限；用户保存结果仍待实际核对。未配置挑战时后端继续拒绝读取，不扩展匿名权限。
- 两项目都从通过Validate的精确main提交构建，独立应用在无凭据build阶段打包、上传，再由同一受保护deploy阶段发布。手动预览不更新独立正式应用；两份version元信息保持同一源码/运行批次。生产smoke新增独立应用版本、安装资源与登录挑战检查。

## 验证和限制

### 当前发布核查（2026-10-09）

[PR #146](https://github.com/Maoxin1/mantou-blog/pull/146) 已合并为 `53cf91cc25c7558600742cc13e3c709c63170980`；[Validate](https://github.com/Maoxin1/mantou-blog/actions/runs/37907162835) 与 [Deploy Pages](https://github.com/Maoxin1/mantou-blog/actions/runs/37907664483) 成功。博客和独立统计站点 `/version.json` 均指向该提交及同一部署批次。

[首次 Production smoke](https://github.com/Maoxin1/mantou-blog/actions/runs/37907805688) 为 7 通过、2 失败，原记录保留：

- 独立统计入口两次实际返回 `401`、`{"error":{"code":"UNAUTHORIZED"}}` 和 `private, no-store`，未满足预期 Access 登录挑战。该结果证明当时请求被拒绝，不证明本人登录可用，也不应当作通过。
- 清单 PR #17 已将页面标题改为“mantou 定投清单”，博客仍断言旧标题；下载文件名也保留了旧断言，需一起更新并执行填写、保存、重新打开和下载流程。

后续匿名复查中，新主机 `/admin/analytics/` 和 `/admin/analytics/data` 均返回 `302`，重定向到正确 Access 团队的本站登录路径，并带有 `no-store`。这只关闭当前匿名挑战检查，不推断此前 `401` 的配置根因或传播时序。完整线上浏览器复验仍须另有结果。

本轮的停止条件：现有生产检查通过，当前状态与发布证据一致。TM-OVW-009 同窗口后台比对，以及 TM-OVW-012 安卓独立图标启动、本人授权、真实数据与刷新继续保留，等待实际使用证据；不新增采集指标或统计服务。

### 发布前历史记录

原源码对独立安装入口回归有效失败：没有独立origin入口；相同回归在修复后通过。实际手机失败保留在[安卓观察元数据](../analytics-overview-20261009/android-live-record.json)，不是通过增加无效SW或更名manifest宣称修复。

已执行：概览28/28、界面7/7（含受控独立HTTPS页面及浏览器manifest解析）、部署安全契约13/13、完整既有Python/Node回归、Hugo与后端/独立产物构建。具体计数、日志哈希与后续发布检查保存在执行记录。界面数据为fixtures，不替代新网址本人登录或安卓实际安装。

现阶段独立应用尚待正式发布、Access目的地生效核对及安卓从真实应用图标启动/刷新。TM-OVW-012继续阻塞；TM-OVW-009同窗口后台比对也保留。原统计私有查看010的有限通过不自动覆盖新主机全部流程；整体未验收。

PR #146 发布审查发现旧命令的 `--config` 不被 Pages 支持；已改为独立目录标准配置及 `--cwd`。新增回归实际运行固定版本的 Pages `build-env` 配置读取，不认证或发布；部署契约 14/14 通过。此前测试只断言命令文本，未覆盖 CLI 兼容性，这一遗漏已补充。
