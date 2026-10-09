# ANL 私有证据归档保护

记录 `ARCH-ANL-01`，2026-10-08。检查现有根 Playwright 配置未覆盖 outputDir；[官方 TestConfig 文档](https://playwright.dev/docs/api/class-testconfig#test-config-output-dir)说明默认输出为包目录下 test-results，开始运行时清理。原私有截图/网址存放于这个临时输出树，未来完整回归可能清掉它们；尚未发生丢失，不声称重现了真实数据丢失或红绿 TDD。

已在 `.gitignore` 加 `.local-evidence/`，用原生 PowerShell 在同一工作区内移动整个私有证据目录到 `.local-evidence/analytics-private-manual`，执行前核对解析后的绝对源/目标均位于项目根下、目标未存在，未覆盖其他文件。移动后逐文件核对 15 个原文件的 SHA256 全部不变；迁移清单 `archive-migration.json` 留在私有目录，包含文件名/hash，原图及原始数值不进入公开仓库。

文档引用与本地证据审计改用新位置，不改变截图内容、查询判断、产品规范、测试断言或 E2E 触发策略。后续普通测试输出清理无需碰这个独立目录。没有为验证风险而对真实证据运行清理操作。

本次只修复证据保留位置的风险；功能测试没有重新执行，功能验收状态不因目录迁移升级。审计检查新位置的截图 hash、Git 忽略规则、目录不位于 test-results/public/playwright-report 输出树，属于记录完整性检查。
