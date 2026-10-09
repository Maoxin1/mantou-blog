# TEST-MATRIX-OVW-001

当前独立应用修正：已实现不同origin的安装入口，Pages项目与四项私有绑定已准备，本地检查通过，正在按PR门禁发布；新增Access目的地及安卓独立图标启动/刷新仍待实际验证。旧博客应用打开统计页不等于独立统计应用已安装。见[修复记录](implementation/analytics-app-20261009/README.md)。


2026-10-09，v0.7；功能 ANL-OVW，依据 [SPEC-OVW-001](specs/analytics-overview-v1.md)。当前 10 项有限范围通过、2 项阻塞，整体待验收。代码已上线，桌面和安卓 Chrome 真实查看已观察；安卓独立应用安装尚未成功。受控响应不代替真实读取；作品点击方向已因用户澄清取消。

| ID | 需求ID | 场景（输入/前置状态/操作） | 预期结果 | 测试层级与方法 | 优先级 | 来源 | 状态 | 证据 |
|---|---|---|---|---|---|---|---|---|
| TM-OVW-001 | OVW-002 | 北京午夜、跨月/年/闰日，最近完整日与上期 | 两个相邻、不重叠 7 日，排除今天，UTC 转换正确 | Node 单元＋有约束的日期属性样本 | P0 | Product Requirement：OVW-002 | 通过 | [日期红→绿/256 属性样本](implementation/analytics-overview-20261009/README.md)：seed=20261009，3 单元通过；未发生反例/缩小 |
| TM-OVW-002 | OVW-007 | 上期为 0、相同、增加/减少、无效计数 | 不除零、不推 UV、不接受无效数值 | Node 单元/边界表 | P1 | Product Requirement：OVW-007；Inferred Gap：新增长率边界 | 通过 | [change-red/domain-green](implementation/analytics-overview-20261009/README.md)：有效变化及零基数/非法值已运行 |
| TM-OVW-003 | OVW-004/005 | 缺失/伪造/过期/错误受众或发行者/非本人 JWT | 拒绝，且不读统计；正确本人可继续 | 实际 jose 签名验证＋Node 集成 | P0 | Product Requirement：OVW-004/005 | 通过 | [access-red/auth-domain-green](implementation/analytics-overview-20261009/README.md)：实际 jose RS256 测试密钥验证，不代替线上 Access |
| TM-OVW-004 | OVW-003/006 | 正常、空、缺字段、部分 GraphQL 错误、网络错误、超时 | 严格验证同站数据；未知不填 0；整组失败不冒充完整比较 | Node 上游受控集成 | P0 | Product Requirement：OVW-003/006 | 通过 | [provider-red/provider-green](implementation/analytics-overview-20261009/README.md)：受控响应/错误处理通过；[同口径 bot 查询回归](implementation/analytics-overview-20261009/real-data.md)已红→绿；真实字段/读取已确认，后台数值比对另在 009 阻塞 |
| TM-OVW-005 | OVW-001/002/007/008 | 本人正常数据、上期为零、移动窄屏 | 一屏指标/趋势/排名可读，日期与增减解释准确 | 少量手动 E2E、真实 HTML/受控 API | P1 | Product Requirement：OVW-001/002/007；Historical Bug：BUG-OVW-QA-002 | 通过 | [ui-red/ui-green](implementation/analytics-overview-20261009/README.md)：桌面/390px、7 日数值/增减；fixtures 不是真实报表；[手机文字缩放回归](implementation/analytics-overview-20261009/pwa-entry.md)经 5px 红灯后通过；[最新 6/6](implementation/analytics-overview-20261009/real-data.md)补采样“约”、未知元数据回退及筛选说明 |
| TM-OVW-006 | OVW-005/006 | 错误→重试成功、刷新失败、重复刷新/乱序响应 | 未知不填 0、不展示旧成功为当前；避免重叠刷新污染 | Node/UI 集成＋E2E 状态转换 | P1 | Product Requirement：OVW-005/006；Inferred Gap：乱序请求 | 通过 | [handler-green/ui-green](implementation/analytics-overview-20261009/README.md)：共享在途、错误→重试、刷新后不显示旧数字；不是外部故障恢复验收；[真实jose受控JWKS服务失败与恢复](implementation/analytics-overview-20261009/jwks-outage.md)红→绿，故障503且不读数据 |
| TM-OVW-007 | OVW-004/005 | 私有页面/API 与静态博客、SW/浏览器缓存 | 未认证拒绝数据，no-store，公开博客正常；凭据不进公共产物 | Node 集成、构建检查、Wrangler 本地路由及实际生产挑战 | P0 | Product Requirement：OVW-004/005；Historical Bug：BUG-OVW-QA-003 | 通过 | [Node 14/14 与 Pages 运行边界](implementation/analytics-overview-20261009/README.md)：模块格式回归、no-store/授权先行、缺配置私有页/API 503、公开博客 200；[新版生产巡检5项与实际2项](implementation/analytics-overview-20261009/release-verification.md)已通过；新版真实 Access 全流程在 010 |
| TM-OVW-008 | OVW-009/005 | 来源/路径含 Unicode、HTML、外链/协议相对 URL | 文本安全展示；只有安全本站路径可链接 | E2E 异常输入/解析边界 | P1 | Inferred Gap：展示注入；Product Requirement：OVW-005/009 | 通过 | [ui-green](implementation/analytics-overview-20261009/README.md)：原始 HTML 文本及协议相对外链不执行/不链接；没有使用无崩溃作为判据 |
| TM-OVW-009 | OVW-003/008 | 本账户真实 RUM schema、合法读取、与后台同窗口/筛选比对 | 实际字段/权限成立，数值与范围可解释 | 限时只读 spike → 正式人工集成验收 | P0 | Product Requirement：OVW-003；Inferred Gap：接口/筛选未知 | 阻塞 | [真实 Token/schema/正式 provider 读取已验证](implementation/analytics-overview-20261009/real-data.md)；仍缺同窗口后台比对及采样聚合差异核对，未把仪器读取当作正式结果验收 |
| TM-OVW-010 | OVW-001/004 | 线上本人登录→私有概览；隔离未登录 API | 本人能查，未登录不能读；CMS 入口走通 | 关键实际人工 E2E | P0 | Product Requirement：OVW-001/004 | 通过（本行范围） | [新版生产版本/匿名API/Secret检查](implementation/analytics-overview-20261009/published-verification.md)与[本人新概览截图记录](implementation/analytics-overview-20261009/desktop-live-record.json)支持真实网页读取；CMS E-ANL-24按两入口源码未变和当前生产smoke复用。未捕获本人API原始响应；真实非本人/到期/外部故障另保留未运行，不据此声称完整安全验收 |
| TM-OVW-011 | OVW-010/011/012 | 独立安装身份、启动地址、图标、390px 安卓指引；成功→断网刷新→恢复 | 浏览器可解析独立安装配置；保持博客身份；断网不显示旧数字或零，恢复重新读取 | Node 语义/PNG 尺寸检查、Chromium 解析、受控 API E2E、本地 Pages 边界 | P1 | Product Requirement：OVW-010/011/012；Inferred Gap：安装资源与私有启动路径不同 | 通过 | [PWA 本地记录](implementation/analytics-overview-20261009/pwa-entry.md)：1 条有效红→绿，概览 15/15；界面 5/5、实际断网/恢复；不是安卓安装或真实登录证据 |
| TM-OVW-012 | OVW-010/011 | 安卓安装→桌面启动→本人授权→真实统计；授权失效/未授权 | 实际桌面入口到达正确站点数据，权限有效；记录手机浏览器及安装形态 | 按需真机人工 E2E，沿用 009 同口径检查 | P0 | Product Requirement：OVW-010/011；Inferred Gap：手机独立窗口授权与安装兼容 | 阻塞 | [安卓Chrome真实查看与用户回复](implementation/analytics-overview-20261009/android-live-record.json)：普通网页可读；桌面图标仍打开普通浏览器，安装应用未完成。手机型号/失败提示待核对，独立窗口、实际刷新及到期授权仍缺；清单正确不替代真机安装 |

生成式日期检查约束：2020–2035 合法 UTC 毫秒，无 NaN/Infinity；固定 seed 20261009，256 样本/2 秒；判定相邻 7×24 小时、各端点北京时间午夜、today 不包含。失败保留 seed/input，先按日期/午夜相邻缩小；无反例不称已验证缩小。模糊测试先用路径/文本固定边界表，当前不需要 fuzz 框架。授权与错误序列用有限随机/状态表，不把“没有崩溃”当语义通过。

快速检查：新增 Node overview 用例；后端/前端完成时 Hugo、Wrangler 编译和手动选择 E2E；阶段结束按最新基线跑项目 Python/Node 与相关浏览器回归。没有新变更/风险时不重复全套；E2E 不自动每次编辑后执行。

历史 v0.4 为9项本地有限范围通过、3项真实外部验收阻塞，12个稳定ID与优先级不变。最新基线已同步到生产/远端441e075，见[发布前整合证据](implementation/analytics-overview-20261009/release-verification.md)：overview22/22、界面6/6、既有Node94/94、Python123/123、完整浏览器146/146（按需手动）、实际生产相关smoke2/2；构建/内容/产物校验及41,553条链接通过。保留BUG-OVW-QA-003回归与原失败；未降低规范或删除阻塞项。本人能看旧入口与匿名被挑战已有实际证据，仍不替代新版真实API网页流程、后台同窗口比对和安卓真机验收。原版本日志均保留历史含义。

追加执行证据：用户授权自动填写后，四项Production Secret已保存，既有变量/预览/正式部署保留；010继续因新版尚未发布及实际数据流程未验而阻塞。此追加关闭“线上Secret尚缺”这一个条件，不把矩阵或整体状态改成通过。

发布审查补充（v0.5）：BUG-OVW-QA-004来自PR145实际Issue并核对固定jose实现，补DNS/TLS/HTTP/坏JSON/JWKS/超时、恢复与安全拒绝测试，overview25/25。新增证据关联003/006/007，来源Issue、Product Requirement与Historical Bug；不增加需求、改变9/3验收状态或删除旧失败。新提交重新验证后才可合并。

上线实际证据补充（v0.6）：PR145生产8cb9052及三项正式CI成功，完整生产检查、本人新概览/手机Chrome截图已记录；010在既定范围转通过，009/012保持阻塞。安卓用户实际报告安装应用不能完成且图标打开普通浏览器，作为未解决现象保留，不推断根因。当前10/2不删除历史9/3记录；最近验收更新仅本地保存。

安卓菜单后续澄清：用户提供的新截图明确显示“已安装此应用”，另一选项“创建快捷方式”注明在Chrome中打开；没有新的安装进度或失败提示截图。已安装项对应旧博客还是新概览尚未确认，正在核对点击该项后的结果；012仍阻塞，不把该截图推断为安装服务故障或旧博客冲突已确诊。

安卓进一步实际结果：用户点击Chrome“已安装此应用”后确认“网站数据，且没有Chrome地址栏”。已观察应用窗口真实展示；此前桌面快捷方式打开Chrome仍是有效历史记录。正在核对应用列表/桌面真实应用图标直接启动及刷新；未捕获已安装manifestId，不宣称旧博客冲突已确诊。012继续仅部分通过。

BUG-OVW-QA-005补充：用户确认应用列表只有博客图标、启动博客首页；原nested-origin安装未满足012。修复为独立origin安装与产物，新增28/28概览、7/7界面及部署安全回归，不改变稳定需求ID/优先级。012继续等待新部署/Access/真机证据；009后台比对仍阻塞，010仅原网址私有查看范围通过。
