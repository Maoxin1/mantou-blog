# Waline 首轮失败处理验收记录

日期：2026-10-05。代码基线：`5f59d714d0155d614b0ae67711038e176aaa9c0b`。

## 本轮范围与实现

- TM-002 / WAL-002 / AC-002：服务未配置时，正文和邮件入口独立可用。原有行为直接加测通过
- TM-003 / WAL-002 / AC-003：重复打开、加载中重复触发、初始化完成后再触发，最多初始化一次。原有保护直接加测通过
- TM-005 / WAL-012 / AC-015：确定 mock 拒绝保留草稿；非零 errno 即使缺少/空错误文案，也不能清稿或发成功事件
- TM-019 / WAL-013 / AC-017：同步取得同页提交锁，覆盖 userAgent 异步准备、连续点击、Ctrl/Meta+Enter、请求和完成阶段；早退和异常通过 finally 解锁。非 Error 的准备失败也有提示
- TM-024 / WAL-011 / AC-014：明确的资源/服务错误可显式重试；校验固定版本定义的外层分页结构；GET 的非 2xx HTTP 状态优先于矛盾的成功 JSON
- 缓存交付：Hugo 为 loader 和本地 Waline bundle 生成内容 SHA-256 URL，避免新页面首次加载命中旧脚本。未修改全站 Service Worker 策略

生产配置中的 serverURL 保持为空。本地 bundle 明确标记为官方 3.15.2 加本站补丁，保留 MIT 许可；七处精确替换可由 `scripts/patch_waline_submit.cjs` 重现，原始文件 hash 不符时拒绝执行。

## 真实红灯与修复

1. 暂停 userAgent，交错两次直接提交与 Ctrl/Meta+Enter：原函数发送 4 次 mock POST，预期 1 次。提前加锁后通过
2. 外层分页字段缺失/非法：8 个用例在原 loader 中错误初始化。补齐字段校验后同组通过
3. 非零 errno 配缺失/空 errmsg，分别使用中英文：4 个用例原先清空草稿。修复后保稿、无成功事件、有提示且可明确重试
4. 旧缓存预存固定脚本 URL：新页面首次获取 loader 仍拿到旧字节。内容寻址后，4 项构建/SW-VM 测试通过；全站原缓存行为保持原样
5. userAgent 以 null、undefined、string 拒绝，分别使用中英文：6 个用例原先提示自身抛错或显示 undefined。归一化提示后通过
6. 原生 Node Response 返回 HTTP 503，但 JSON 为 errno:0：评论和计数两个 GET 用例原先仍初始化。GET 检查 Response.ok 后通过；POST 未改
7. 首次 GitHub CI 真实浏览器运行 108 项通过、1 项失败：JS 资源首次加载失败后，同 URL 的失败模块缓存导致恢复后仍无法打开。保留原断言，仅 import 失败后在原同源内容地址上增加显式 retry 键；本地可控 module-map 重放先红后绿，成功 import 遇 API 失败仍复用原模块

测试准备中的 Chromium IPC、一次 argv 大小限制和一次中间修补的变量作用域错误，均单独记录，没有当成功能红灯。已有正确行为没有故意改坏；未删除或放宽断言。

## 可运行检查

需要 Node 24、Hugo Extended 0.154.5、Python 3.12+ 和仓库现有依赖，无新增 npm 包。

```sh
npm run test:feedback
python -m unittest discover -s tests/python -p 'test_*.py'
hugo --minify --panicOnWarning --cleanDestinationDir
npm run test:e2e -- tests/e2e/reader-feedback.spec.js
```

Hugo 不在 PATH 时设置 HUGO_BIN。Node 组件测试使用显式 `--experimental-vm-modules`。

- 本地 59 项 Node 检查通过；真实 loader、vendored API、提交/快捷键函数均从实际文件执行，DOM、网络、Vue init 或闭包依赖按测试层替换
- 113 项 Python 检查通过，含 4 项新资产构建/SW-VM 测试及 16 项既有 SW 可靠性测试
- 三个固定 seed：20261005、20261006、20261007。提交与加载各 300 条有限短序列，失败输出 seed、case 和操作序列；无生成反例
- 提交每 seed 最多 100 例/30 秒，加载合计最多 300 例/30 秒；这些是测试预算，不是新产品超时阈值
- Hugo、Pagefind 1.5.2、源码和生成结果校验通过。Validate 增加 Node 反馈检查，沿用现有 Python 和浏览器流程

本地 Chromium 在测试主体执行前被 Unix socket IPC 限制阻断。首次 CI 已执行真实浏览器断言并发现上述 JS 重试问题；后续完整结果以草稿 PR 的 Validate 为准。reader-feedback.spec.js 共 9 条，包含 2 条照片/文章链接和 7 条反馈场景。

首次失败的 CI 日志保留断言和截图/trace 生成路径，但原 Validate 没有上传工件，无法取回该次截图与 trace。现为后续运行保留浏览器报告与 test-results，使用仓库既有的固定版本 upload-artifact，保留 14 天。不能用 Node/VM 通过替代真实浏览器结果。

## 保留边界

- 请求和记录均为虚构/mock，没有真实评论服务、邮件、账户或数据库操作
- 服务端幂等、跨设备/标签页去重、丢回执/未知 POST 恢复、迟到成功与新稿版本保护、超时阈值仍未验收
- 未新增完整评论行 schema、审核/通知/双语归属策略，没有开启正式评论
- 内容寻址覆盖重新导航获得新在线页面的生命周期；旧打开页、离线旧 HTML 不会自动升级。生产 serverURL 为空，缓存反例不代表已发生线上事故
- 浏览器模块失败缓存、真实 DNS/CORS/TLS 和实际存储仍需要相应层验证。已有 10s/12s 值未获本次认可为产品阈值，也未被修改
- 本 PR 保持草稿；合并和部署需要另行确认
