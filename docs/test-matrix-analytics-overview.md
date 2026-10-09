# TEST-MATRIX-OVW-001

2026-10-09，v0.4；功能 ANL-OVW，依据 [SPEC-OVW-001](specs/analytics-overview-v1.md)。当前计划不等于验收。状态/来源沿用原矩阵；通过须实际证据，受控响应不代替真实 Cloudflare 读取。 安卓 PWA 入口已采纳，作品点击方向已因用户澄清取消。

| ID | 需求ID | 场景（输入/前置状态/操作） | 预期结果 | 测试层级与方法 | 优先级 | 来源 | 状态 | 证据 |
|---|---|---|---|---|---|---|---|---|
| TM-OVW-001 | OVW-002 | 北京午夜、跨月/年/闰日，最近完整日与上期 | 两个相邻、不重叠 7 日，排除今天，UTC 转换正确 | Node 单元＋有约束的日期属性样本 | P0 | Product Requirement：OVW-002 | 通过 | [日期红→绿/256 属性样本](implementation/analytics-overview-20261009/README.md)：seed=20261009，3 单元通过；未发生反例/缩小 |
| TM-OVW-002 | OVW-007 | 上期为 0、相同、增加/减少、无效计数 | 不除零、不推 UV、不接受无效数值 | Node 单元/边界表 | P1 | Product Requirement：OVW-007；Inferred Gap：新增长率边界 | 通过 | [change-red/domain-green](implementation/analytics-overview-20261009/README.md)：有效变化及零基数/非法值已运行 |
| TM-OVW-003 | OVW-004/005 | 缺失/伪造/过期/错误受众或发行者/非本人 JWT | 拒绝，且不读统计；正确本人可继续 | 实际 jose 签名验证＋Node 集成 | P0 | Product Requirement：OVW-004/005 | 通过 | [access-red/auth-domain-green](implementation/analytics-overview-20261009/README.md)：实际 jose RS256 测试密钥验证，不代替线上 Access |
| TM-OVW-004 | OVW-003/006 | 正常、空、缺字段、部分 GraphQL 错误、网络错误、超时 | 严格验证同站数据；未知不填 0；整组失败不冒充完整比较 | Node 上游受控集成 | P0 | Product Requirement：OVW-003/006 | 通过 | [provider-red/provider-green](implementation/analytics-overview-20261009/README.md)：受控响应/错误处理通过；[同口径 bot 查询回归](implementation/analytics-overview-20261009/real-data.md)已红→绿；真实字段/读取已确认，后台数值比对另在 009 阻塞 |
| TM-OVW-005 | OVW-001/002/007/008 | 本人正常数据、上期为零、移动窄屏 | 一屏指标/趋势/排名可读，日期与增减解释准确 | 少量手动 E2E、真实 HTML/受控 API | P1 | Product Requirement：OVW-001/002/007；Historical Bug：BUG-OVW-QA-002 | 通过 | [ui-red/ui-green](implementation/analytics-overview-20261009/README.md)：桌面/390px、7 日数值/增减；fixtures 不是真实报表；[手机文字缩放回归](implementation/analytics-overview-20261009/pwa-entry.md)经 5px 红灯后通过；[最新 6/6](implementation/analytics-overview-20261009/real-data.md)补采样“约”、未知元数据回退及筛选说明 |
| TM-OVW-006 | OVW-005/006 | 错误→重试成功、刷新失败、重复刷新/乱序响应 | 未知不填 0、不展示旧成功为当前；避免重叠刷新污染 | Node/UI 集成＋E2E 状态转换 | P1 | Product Requirement：OVW-005/006；Inferred Gap：乱序请求 | 通过 | [handler-green/ui-green](implementation/analytics-overview-20261009/README.md)：共享在途、错误→重试、刷新后不显示旧数字；不是外部故障恢复验收 |
| TM-OVW-007 | OVW-004/005 | 私有页面/API 与静态博客、SW/浏览器缓存 | 未认证拒绝数据，no-store，公开博客正常；凭据不进公共产物 | Node 集成、构建检查、Wrangler 本地路由及实际生产挑战 | P0 | Product Requirement：OVW-004/005；Historical Bug：BUG-OVW-QA-003 | 通过 | [Node 14/14 与 Pages 运行边界](implementation/analytics-overview-20261009/README.md)：模块格式回归、no-store/授权先行、缺配置私有页/API 503、公开博客 200；[新版生产巡检5项与实际2项](implementation/analytics-overview-20261009/release-verification.md)已通过；新版真实 Access 全流程在 010 |
| TM-OVW-008 | OVW-009/005 | 来源/路径含 Unicode、HTML、外链/协议相对 URL | 文本安全展示；只有安全本站路径可链接 | E2E 异常输入/解析边界 | P1 | Inferred Gap：展示注入；Product Requirement：OVW-005/009 | 通过 | [ui-green](implementation/analytics-overview-20261009/README.md)：原始 HTML 文本及协议相对外链不执行/不链接；没有使用无崩溃作为判据 |
| TM-OVW-009 | OVW-003/008 | 本账户真实 RUM schema、合法读取、与后台同窗口/筛选比对 | 实际字段/权限成立，数值与范围可解释 | 限时只读 spike → 正式人工集成验收 | P0 | Product Requirement：OVW-003；Inferred Gap：接口/筛选未知 | 阻塞 | [真实 Token/schema/正式 provider 读取已验证](implementation/analytics-overview-20261009/real-data.md)；仍缺同窗口后台比对及采样聚合差异核对，未把仪器读取当作正式结果验收 |
| TM-OVW-010 | OVW-001/004 | 线上本人登录→私有概览；隔离未登录 API | 本人能查，未登录不能读；CMS 入口走通 | 关键实际人工 E2E | P0 | Product Requirement：OVW-001/004 | 阻塞 | [生产匿名路径检查](implementation/analytics-overview-20261009/access-anonymous.md)已运行：统计父/子路径 302 登录，公开页 200；本地配置齐全。[本人可到达旧入口](implementation/analytics-overview-20261009/owner-entry-record.json)已有用户截图；[真实GET挑战/缓存巡检](implementation/analytics-overview-20261009/release-verification.md)已通过。[四项Production Secret已自动加密保存并经API核对](implementation/analytics-overview-20261009/production-secrets.md)；仍缺新版发布后的真实网页/API数据流程 |
| TM-OVW-011 | OVW-010/011/012 | 独立安装身份、启动地址、图标、390px 安卓指引；成功→断网刷新→恢复 | 浏览器可解析独立安装配置；保持博客身份；断网不显示旧数字或零，恢复重新读取 | Node 语义/PNG 尺寸检查、Chromium 解析、受控 API E2E、本地 Pages 边界 | P1 | Product Requirement：OVW-010/011/012；Inferred Gap：安装资源与私有启动路径不同 | 通过 | [PWA 本地记录](implementation/analytics-overview-20261009/pwa-entry.md)：1 条有效红→绿，概览 15/15；界面 5/5、实际断网/恢复；不是安卓安装或真实登录证据 |
| TM-OVW-012 | OVW-010/011 | 安卓安装→桌面启动→本人授权→真实统计；授权失效/未授权 | 实际桌面入口到达正确站点数据，权限有效；记录手机浏览器及安装形态 | 按需真机人工 E2E，沿用 009 同口径检查 | P0 | Product Requirement：OVW-010/011；Inferred Gap：手机独立窗口授权与安装兼容 | 阻塞 | 真实数据源、生产Access挑战和Secret元数据已验证，新版部署/手机真实流程仍缺；已说明安卓，未执行真机安装，不能用桌面 Chromium 解析替代 |

生成式日期检查约束：2020–2035 合法 UTC 毫秒，无 NaN/Infinity；固定 seed 20261009，256 样本/2 秒；判定相邻 7×24 小时、各端点北京时间午夜、today 不包含。失败保留 seed/input，先按日期/午夜相邻缩小；无反例不称已验证缩小。模糊测试先用路径/文本固定边界表，当前不需要 fuzz 框架。授权与错误序列用有限随机/状态表，不把“没有崩溃”当语义通过。

快速检查：新增 Node overview 用例；后端/前端完成时 Hugo、Wrangler 编译和手动选择 E2E；阶段结束按最新基线跑项目 Python/Node 与相关浏览器回归。没有新变更/风险时不重复全套；E2E 不自动每次编辑后执行。

当前 v0.4 为9项本地有限范围通过、3项真实外部验收阻塞，12个稳定ID与优先级不变。最新基线已同步到生产/远端441e075，见[发布前整合证据](implementation/analytics-overview-20261009/release-verification.md)：overview22/22、界面6/6、既有Node94/94、Python123/123、完整浏览器146/146（按需手动）、实际生产相关smoke2/2；构建/内容/产物校验及41,553条链接通过。保留BUG-OVW-QA-003回归与原失败；未降低规范或删除阻塞项。本人能看旧入口与匿名被挑战已有实际证据，仍不替代新版真实API网页流程、后台同窗口比对和安卓真机验收。原版本日志均保留历史含义。

追加执行证据：用户授权自动填写后，四项Production Secret已保存，既有变量/预览/正式部署保留；010继续因新版尚未发布及实际数据流程未验而阻塞。此追加关闭“线上Secret尚缺”这一个条件，不把矩阵或整体状态改成通过。
