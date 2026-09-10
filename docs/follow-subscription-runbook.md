# 博客关注功能运行手册

## 当前能力

- 首页、顶部导航与文章结尾都提供统一的“关注”入口。
- 支持原地弹窗；不支持 `<dialog>` 或禁用 JavaScript 时，会回退到 `/follow/`。
- RSS 地址为 `https://mantou-blog.pages.dev/index.xml`，并提供 Inoreader、Feedly、复制地址和原始 Feed 四种入口。
- 邮箱服务未配置时，不渲染不可用的提交表单，只显示诚实的准备状态。

## 开通邮箱提醒

1. 创建 Buttondown newsletter，确定公开用户名。
2. 在 `hugo.toml` 的 `[params.follow]` 中填写 `buttondownUsername`。
3. 在 Buttondown 中保持 double opt-in，避免他人代填邮箱。
4. 将本站 RSS `https://mantou-blog.pages.dev/index.xml` 添加为 external feed automation，并选择新条目发布后发送邮件。
5. 在预览部署中用一个测试邮箱完成“提交 → 确认 → 收到新文章 → 退订”全链路验收。

表单使用 Buttondown 官方的标准 HTML endpoint，不通过 JavaScript `fetch` 提交；这样 CAPTCHA、输入错误和确认流程仍由服务方完整处理。用户名是公开配置，API 密钥不应加入仓库。

## 发布前验收

- 桌面与手机上，首页按钮均能打开关注窗口。
- `Escape`、关闭按钮和点击遮罩都能关闭窗口。
- 禁用 JavaScript 后，首页关注链接能进入 `/follow/`。
- 表单只有在 newsletter 已真实创建后才启用。
- 确认邮件、更新邮件和退订链接均能正常工作。
- `/index.xml` 返回成功，并包含最新公开文章。

## 分享链接约定

后台创建新文章时，“分享短链接”必须填写小写英文、数字或连字符，例如 `memory-sector-review`。它会成为公开网址的一部分；发布后应保持稳定。需要修改既有文章地址时，必须把旧路径加入 `aliases`，确保聊天记录和外部引用仍能跳转。
