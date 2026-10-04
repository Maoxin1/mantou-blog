# mantou 视觉改版

2026-10-04 的已选方案：01 软团字、P1 圆头小人、原版厚页翻开的书。整体构图采用暖纸色页面、左文右图首屏、左一张大卡片与右两张小卡片。

## 实现范围

沿用 Hugo Extended 0.154.5 与现有 LoveIt 主题。首页真实文章、阅读与生活精选、作品、最近更新、照片入口均来自原站内容与 data/home.yaml；没有复制样稿中的示例文章。中英双语、Pagefind、订阅、反馈、RSS、文章短地址、CMS 和 PWA 继续使用现有实现。

头部改为顶部导航，手机端保留折叠菜单。暖纸 #fffaf1、墨色 #292824、陶土 #a84e32、正文次级色 #6b6258；深色模式使用对应暖灰与浅陶。文章最大宽 700 px，正文桌面 18 px / 1.9、手机 17 px / 1.9；正文区不叠加纹理。

## 文件与维护

- layouts/index.html：首屏、三张真实内容卡片与作品入口。
- layouts/partials/header.html / footer.html：01 字标、双语导航与页脚。
- assets/css/_visual-identity.scss：新视觉层和响应式；_custom.scss 最后导入它。旧 _garden.scss 保留为历史文件，已不加载。
- static/images/identity/：已选字标、P1 三个路径 SVG、P1 头像与两张 WebP 场景图。
- favicon 与安装图标：小尺寸继续使用字标衍生的 o 图形；个人形象使用 P1。
- i18n/*：identity 开头的新增键为本轮页面文案；未改写文章正文和译文。

人物只用圆头、两只眼睛和几笔四肢。保持提供的 SVG，不在每张卡片上堆角色。书与纸路是当前主页主视觉，不自动替换成未选中的书本候选。

字体调用 Noto Sans SC → PingFang SC → Microsoft YaHei → Noto Sans CJK SC → sans-serif。生产页面不嵌入只覆盖样稿字符的子集，不增加外部字体请求。不同系统的完整中文字体会有细微字形差异；截图环境安装了 Noto Sans SC，原许可见 NotoSansSC-OFL.txt。

## 验证与发布

按 README 的构建和验证流程执行。原侧栏布局的验收已更新为新顶部导航、已选素材、双语标题和 700 px 阅读栏要求；其余访客功能验证保留。

本轮本地检查：Hugo Extended 0.154.5 与 Pagefind 1.5.2 构建成功；65 项 Python 单元检查、206 篇文章及译文校验、39,328 个内部链接、短地址、作品、SEO 与运行时资源检查通过。73 项本地可运行的浏览器检查通过；最后调整手机导航淡出与深色底色后，相关 20 项导航、对比度和反馈检查再次通过。

未将全部 80 项浏览器检查报告为本地通过：6 项 CMS 登录或 CDN 回退检查受到 unpkg.com / cdn.jsdelivr.net 的 ERR_EMPTY_RESPONSE 阻断，未改版的基线构建也出现相同错误，两个后台入口文件与基线完全相同；1 项旧中文地址的浏览器跳转需要访问线上域名，当前环境无法完成。206 篇文章的旧地址与目标已通过静态校验。仓库测试仍保留全部 80 项，需由 PR 的完整 Validate 流程确认。

桌面 1280 px、手机 390 px、中英文及深色的实际构建截图已检查；可见图片均加载成功，页面宽度未超出视口。中文字体仍由访问者设备决定，本轮截图不是跨操作系统字体测试。读者反馈与长期辨识度没有进行外部测试。

PR 首次完整验证被旧主题的开发依赖审计阻断：Babel 7 CLI 的 Chokidar 3 链带入无修复版的 braces 漏洞（[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)）。改为配套的 Babel CLI/Core/Preset Env 8.0.6，按[官方迁移说明](https://babeljs.io/docs/v8-migration)调整 targets 并声明 Node 要求；其余四个主题直接依赖保持原锁定版本。此项只更新主题开发工具，已随仓库提供的浏览器运行时脚本没有重新编译或替换。依赖锁由 npm 重新生成，发布审计门槛保持不变。主题 npm ci、npm audit（0 项漏洞）、源码编译及生成脚本语法检查已通过。

改版在独立分支审阅，不改写历史文章。原始项目需求要求不自动发布现有网站，因此发布须在改版确认后单独推进。合并到 main 后现有 Validate / Deploy Pages 流程会自动部署；不要在审阅前合并。
