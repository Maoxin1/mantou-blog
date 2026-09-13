# 文章短网址迁移

## 规则

- 历史文章使用 `/p/YYYYMMDD/`，同一天第二篇使用 `/p/YYYYMMDD-2/`。
- 新文章使用 `/p/<short-slug>/`，后台限制为最多 32 个小写字母、数字或连字符。
- 每篇迁移文章都把迁移前的公开地址写入 `aliases`，旧聊天记录和外部引用会跳转至新地址。
- `slug` 发布后保持不变；修改标题不会改变永久地址。

## 一次性迁移命令

先预览，再写入：

```powershell
python scripts/migrate_short_post_urls.py
python scripts/migrate_short_post_urls.py --write
```

完成后运行 Hugo、内部链接检查和浏览器测试。迁移脚本重复运行不会再次修改已经分配好短编号的文章。
