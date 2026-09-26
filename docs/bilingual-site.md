# 中英双语、首页维护与统计

本站采用文章与作品并列的首页。中文地址保持不变，英文位于 `/en/`；两种语言使用同一组模板、不同的内容目录。

## 内容与首页

- 中文：`content/`；英文：`content_en/`。同一内容保留相同的相对文件路径与 `slug`，由 Hugo 关联译文。
- 首页重点文章、作品与三项精选在 `data/home.yaml` 中选择，标题和摘要取自内容文件。
- 作品可用 `home_title`、`home_summary` 提供适合首页的简短介绍。完整标题仍用于作品详情。
- 最近发表按文章发布日期自动排列；作品记录独立展示，避免作品更新混淆为新文章。
- 作品的问题、假设、约束、决策和下一步为选填；实际结果、证据、限制和公开边界仍需提供。图表保留在结果区，目录可以展开。

## 翻译与发布

截至 2026-09-26，现有 206 篇文章的英文版均已对照中文原文逐篇审校，页面保留中文原文链接。英文版采用编辑性翻译，保留文章的主要内容与作者视角，部分重复表达会压缩；如需核对完整原文，应使用页面上的中文原文链接。历史初译曾使用 Google Translate，限流后以本地 Argos Translate 1.9 补充；临时翻译工具和模型不进入仓库、构建或访客浏览器。`translation_status: reviewed` 仅用于实际逐篇审校过的内容；未来新增文章仍可先标注 `machine`，待审校后再改为 `reviewed`。

发布或修改中文内容时：

1. 在 `content_en/` 中创建或更新同路径的英文文件。日期、slug、作品类型及标签标识保持对应，英文文件不复制中文 `aliases`。
2. 检查正文、标题、摘要、数字、链接、图片说明、表格和引用。保留原文的语气，不把日记重写为项目报告。
3. 更新译文后记录对应原文版本：

   ```powershell
   py -3.12 scripts/validate_translations.py --record-source "content_en/posts/对应文件.md"
   py -3.12 scripts/validate_translations.py
   ```

   此命令只记录同步版本，不会自动把机器译文改成已审校。

4. 可以一同提交两个版本，也可以先发布中文、稍后补译。CI 对缺失或过期译文给出提醒，不阻塞中文写作；错误的 slug、日期及译文结构仍会阻止发布。未翻译的页面将英文切换显示为“待译”，过期译文会提示中文原文已有更新。上面的严格检查命令可用于核对全站翻译进度。

内容后台增加了现有英文文章编辑入口。新译文需在仓库创建同路径文件，可与中文一起提交或随后补充；后台目前不调用在线翻译服务。界面文案位于 `i18n/zh-cn.json` 与 `i18n/en.json`。标签保留共同标识，英文显示名称由 `content_en/tags/` 提供。

页面语言决定 Pagefind 使用的搜索索引。每篇译文具有独立 canonical，并通过 `hreflang` 关联另一语言。中文原有短地址和历史重定向保持有效。

## 订阅

- 中文 RSS：`https://mantou-blog.pages.dev/index.xml`
- 英文 RSS：`https://mantou-blog.pages.dev/en/index.xml`

两者各自包含文章与作品。现有 follow.it 邮件服务订阅的是中文源；英文页面只提供英文 RSS，并明确说明邮件当前仅提供中文。开通英文邮件需要在 follow.it 账户中创建独立英文源，再配置对应表单，不复用中文表单冒充英文邮件。

## 私有流量后台

入口：`https://mantou-blog.pages.dev/admin/analytics/`，也可从两个内容后台右下角打开。它链接到 Cloudflare 账户内的 Web Analytics，需要本人登录有权限的账户。入口页不存放凭据或访问数据，不将统计公开嵌入博客。

选择 `mantou-blog.pages.dev`，查看最近 7 天或 30 天的浏览量、访问次数、热门页面、来源、设备和加载性能。根据 Path 区分 `/en/` 英文内容、`/p/` 中文文章、`/works/` 中文作品。Visits 是访问次数，不是去重后的访客人数；本模块不统计按钮点击、订阅转化或“阅读完成”。

当前采集只允许正式域名，本地与预览域名不加载脚本。更换域名时需同步更新 `layouts/partials/analytics.html` 和 Cloudflare 的站点规则。站点采集请求返回成功不等同于已经核对后台历史数据；当前本地部署凭据没有 Analytics 读取权限，历史数据需在本人登录的控制台确认。

参考：[Hugo 多语言](https://gohugo.io/content-management/multilingual/)、[Pagefind 多语言](https://pagefind.app/docs/multilingual/)、[Cloudflare 指标](https://developers.cloudflare.com/web-analytics/data-metrics/high-level-metrics/)。
