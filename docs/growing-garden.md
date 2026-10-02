# 生长花园改版

以第二版设计板为方向：温暖的浅绿底色、桌面左栏、宋体标题，以及文章、阅读、随记、工具的不同内容区域。所有卡片标题、摘要、日期与状态来自既有 Hugo 内容或首页数据；没有新增虚构作品或经历。

## 改动边界

- `assets/css/_garden.scss` 是独立增量样式层，最后由 `_custom.scss` 导入；不修改 vendored LoveIt。
- `layouts/index.html` 重新组织首页。首页精选文章在 `data/home.yaml` 中指向已有的博客反思文章；阅读入口沿用 `selected` 中的 `readingPractice`。
- 全站共享左侧导航、浅绿配色、宋体标题和键盘跳转正文链接；手机使用原有折叠菜单，保留语言切换和主题切换。
- 保留文章、作品、近况、关于、搜索、关注、RSS、照片、文章永久地址、翻译标记、CMS 和反馈组件。反馈服务原本未配置，本次没有启用或向第三方发送新数据。
- 文章目录在所有宽度统一使用文章内的可展开目录，避免左栏与主题固定目录互相遮挡。
- 新增中英双语界面字符串。英文入口沿用真实英文内容和原有翻译说明。

## 本地检查

按 README 的固定版本安装依赖，然后执行：

```sh
python -m unittest discover -s tests/python -p 'test_*.py'
hugo --minify --panicOnWarning --cleanDestinationDir
npx --yes pagefind@1.5.2 --site public
python scripts/check_runtime_assets.py
python scripts/check_internal_links.py
python scripts/check_short_post_urls.py
python scripts/check_portfolio_output.py
python scripts/check_seo_output.py
python scripts/check_garden_output.py
npm run test:e2e
```

新增 `garden-layout.spec.js` 用于验证桌面左栏、手机导航、搜索/语言入口、深色模式、文章溢出与跳转；这些检查仍应在实际 Chromium 中通过后再合并。

## 验证限制

实现环境的 Chromium 被 socket 权限限制阻止启动；云浏览器访问本地预览被客户端拦截。没有规避这些限制，也没有声称真实浏览器验收通过。交付中的静态渲染只用于查看布局与排版方向，不能证明 JavaScript、菜单、Pagefind 或浏览器兼容性。最终视觉验收需使用本地预览或经授权的分支预览。

原仓库固定依赖另有 npm audit 告警；改版没有改动依赖。依赖修复应单独验证，不应通过忽略告警来宣称 CI 全绿。

实现先在本地分支完成检查；随后按授权提交独立分支和草稿 PR。合并与生产部署仍需另行批准。
