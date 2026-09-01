# 后台发布手册

稳定后台位于`https://mantou-blog.pages.dev/admin/`；Sveltia灰度后台位于
`https://mantou-blog.pages.dev/admin/sveltia/`。灰度期间默认继续使用稳定后台，只有在
验证Sveltia兼容性时才使用灰度入口。两者负责编辑仓库中的内容，不直接绕过测试发布
到正式站。

截至2026-09-01，Sveltia已经通过真实GitHub草稿、单字段最小差异、
`草稿 → 审核中 → 就绪 → 草稿`状态流转和放弃草稿验收。它可以用于下一项真实作品的
发布验收；在首次真实发布、合并与正式部署全部通过前，`/admin/`仍保留为默认稳定入口。

## 发布一项阶段作品

1. 登录后台，进入“作品集”，选择“新建作品集”。
2. 先填写要解决的问题、假设、约束和验收证据，再补充结果、限制与下一步。
3. 投资作品发布前完成公开边界复核；不公开金额、仓位和账户总收益，具体标的遵循延迟公开规则。
4. 保存草稿。后台会创建`cms/...`分支和GitHub PR，不会直接修改`main`。
5. 等待PR中的`validate`通过。若作品涉及布局或外部链接，再从受保护的`main`手动运行`Deploy Pages`，把`source_ref`填写为该`cms/...`分支进行在线预览。
6. 确认内容和检查结果后，在后台发布。Decap CMS使用压缩合并保持线性历史；合并后的`main`会再次验证并自动发布正式站。

## 发布失败时

- 保存失败：检查GitHub登录授权是否仍有效，以及OAuth代理是否可访问。
- 没有出现PR：不要尝试直接推送`main`；确认`publish_mode: editorial_workflow`仍存在。
- 发布按钮失败：打开对应GitHub PR，确认`validate`成功、分支未落后、讨论已解决，然后重试发布。
- 正式站未更新：依次检查`Validate`、`Deploy Pages / build`和`Deploy Pages / deploy`，不要把Cloudflare Token复制到日志或后台。

## 验收标准

- 后台保存只产生内容分支和PR；
- Sveltia灰度后台保存Draft时，GitHub PR本身必须是Draft，而不只是带有draft标签；
- 修改一个字段不能重写无关的Front Matter；
- 未通过`validate`的内容不能进入`main`；
- 合并记录保持线性；
- `main`成功后自动部署，正式页面能找到新增作品；
- 删除测试草稿或关闭测试PR后，正式站不出现测试内容。

首次使用Sveltia灰度后台保存测试草稿后，不要立即发布。记录PR编号，并在本地执行：

```powershell
python scripts/verify_cms_pr.py <PR编号> `
  --expected-file content/works/<测试文件>.md `
  --allowed-key stage
```

该命令只读GitHub数据，不改变PR；它会确认PR本身是Draft、只修改预期文件，并且没有
借修改一个字段重写其他Front Matter。验证完成后从后台Discard测试草稿，再确认PR已关闭、
测试分支已删除。

状态变化后可使用同一脚本复核GitHub状态和Sveltia标签：

```powershell
# 草稿：GitHub Draft + sveltia-cms/draft
python scripts/verify_cms_pr.py <PR编号> --expected-status draft `
  --expected-file content/works/<测试文件>.md --allowed-key stage

# 审核中：非GitHub Draft + sveltia-cms/pending_review
python scripts/verify_cms_pr.py <PR编号> --expected-status pending_review `
  --expected-file content/works/<测试文件>.md --allowed-key stage

# 就绪：非GitHub Draft + sveltia-cms/pending_publish
python scripts/verify_cms_pr.py <PR编号> --expected-status pending_publish `
  --expected-file content/works/<测试文件>.md --allowed-key stage
```

“就绪”只代表可以发布，不应自动合并。测试内容必须先改回草稿再Discard；真实内容则在
`validate`通过、公开边界复核完成后才能点击发布。

## Sveltia真实验收记录

- PR #47首次暴露日期引号和空投资字段污染最小差异，修复由PR #48合并；
- PR #49确认真实GitHub Draft、单文件单字段差异和Discard均正常；
- PR #50确认`draft`、`pending_review`、`pending_publish`再回到`draft`时，GitHub Draft
  状态与`Sveltia CMS`标签同步，内容提交没有变化，且“就绪”不会自动合并；
- 所有验收草稿均未合并，PR已关闭，临时分支已删除。

当前仍未证明：Sveltia发布一项真实作品后能完成压缩合并、`main`二次验证、Cloudflare
正式部署和线上页面检查。该步骤必须随下一项可公开的真实作品完成，不能用测试文案冒充。

## 安装为桌面内容工作台

Sveltia灰度后台可以安装为`mantou 内容工作台`，用于缩短“打开浏览器—输入网址—进入
后台”的路径。它仍是在线网页应用，不是具备离线编辑能力的原生客户端。

1. 使用最新版Edge或Chrome打开`https://mantou-blog.pages.dev/admin/sveltia/`；
2. 使用地址栏中的安装图标，或浏览器菜单中的“应用/安装此站点为应用”完成安装；
3. 确认名称为`mantou 内容工作台`、图标为mantou头像，并允许创建桌面或任务栏快捷方式；
4. 关闭浏览器标签页后，从桌面图标启动，确认应用以独立窗口打开并进入Sveltia后台；
5. 确认GitHub会话仍有效；若会话已过期，正常重新登录即可。

若旧安装仍显示`Sveltia CMS`或旧图标，先卸载旧应用，再从灰度入口重新安装。断网时不应
继续编辑或发布；恢复联网后重试。Sveltia不可用时仍从`/admin/`进入Decap稳定后台。
