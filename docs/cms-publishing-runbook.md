# 后台发布手册

稳定后台位于`https://mantou-blog.pages.dev/admin/`；Sveltia灰度后台位于
`https://mantou-blog.pages.dev/admin/sveltia/`。灰度期间默认继续使用稳定后台，只有在
验证Sveltia兼容性时才使用灰度入口。两者负责编辑仓库中的内容，不直接绕过测试发布
到正式站。

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
