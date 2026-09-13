# 博客关注功能运行手册

## 当前能力

- 首页、顶部导航与文章结尾都提供统一的“关注”入口。
- 支持原地弹窗；不支持 `<dialog>` 或禁用 JavaScript 时，会回退到 `/follow/`。
- RSS 地址为 `https://mantou-blog.pages.dev/index.xml`，并提供 Inoreader、Feedly、复制地址和原始 Feed 四种入口。
- 邮箱表单由 follow.it 接收，follow.it 从本站 RSS 自动发现新文章并发送提醒。

## 邮箱提醒配置

1. 在 follow.it 的 publisher 后台维护本站 Feed：`https://mantou-blog.pages.dev/index.xml`。
2. `hugo.toml` 的 `[params.follow].followitAction` 保存 follow.it 生成的公开表单地址。
3. Feed 已认领到发布者账号；一次性网站所有权验证码已在认领成功后移除。
4. 在 follow.it 中保持邮箱确认流程，避免他人代填邮箱。
5. 在预览部署中确认表单地址、字段名和提交方式没有被模板改坏。
6. 上线后用测试邮箱完成“提交 → 确认 → 收到新文章 → 退订”全链路验收。

表单使用 follow.it 生成的标准公开 endpoint，不通过 JavaScript `fetch` 提交；这样输入错误、确认和退订流程仍由服务方处理。表单地址可以公开，账户密码和其他凭据不应加入仓库。

## 发布前验收

- 桌面与手机上，首页按钮均能打开关注窗口。
- `Escape`、关闭按钮和点击遮罩都能关闭窗口。
- 禁用 JavaScript 后，首页关注链接能进入 `/follow/`。
- 表单 action 必须指向 `https://api.follow.it/subscription-form/`。
- 确认邮件、更新邮件和退订链接均能正常工作。
- `/index.xml` 返回成功，并包含最新公开文章。

## 分享链接约定

后台创建新文章时，“分享短链接”必须填写小写英文、数字或连字符，例如 `memory-sector-review`。它会成为公开网址的一部分；发布后应保持稳定。需要修改既有文章地址时，必须把旧路径加入 `aliases`，确保聊天记录和外部引用仍能跳转。
