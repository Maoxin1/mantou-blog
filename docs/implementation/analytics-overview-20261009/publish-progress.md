# ANL-OVW 发布推进

2026-10-09；mantou 在四项Production Secret保存后明确要求“继续推进”，进入按现有PR/Validate/Deploy Pages的正式发布流程。当前本地主分支基线441e075，已完成22overview、94既有Node、123Python、6概览UI、146全浏览器与2相关生产smoke。

独立只读发布审查发现Wrangler接管配置后可能删除既有HUGO_ENV。已增加env.production.vars完整包含三项Analytics公开配置与HUGO_ENV production；四Secret继续只在云端私有绑定，preview未修改。变更为保留既有运行配置，不增加产品范围；修改后22/22再次执行通过，publish-overview-unit.log保留。参考Wrangler4.146实际部署路径和官方配置source of truth/non-inheritable vars。

当前：准备PR；不得通过直接推main或本地部署绕过项目门禁。待PR线上验证、合并后精确提交验证、自动部署、生产冒烟，再核对实际版本/Secret元数据/匿名与本人新数据流程。正式上线不自动把TM-OVW-009/010/012判通过；后台同窗口比对与安卓真机仍需实际证据。

PR145首轮Validate通过；合并被未解决审查讨论阻止。唯一讨论指出JWKS依赖失败误报401，现已按[jwks-outage记录](jwks-outage.md)复现并最小修复，overview25/25和Worker编译通过。准备推修复、重新跑Validate，再解决该讨论；未使用管理员绕过或修改分支保护。
