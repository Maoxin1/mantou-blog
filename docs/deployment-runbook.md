# 部署运行手册

这份手册覆盖`mantou-blog`及独立统计应用`mantou-blog-data`到Cloudflare Pages的发布路径。两者使用同一已校验源码，部署凭据继续与未经信任的PR代码隔开。

## 日常发布

1. 通过PR合并到`main`；禁止直接向`main`推送。
2. `Validate`对合并后的精确提交再次运行。
3. 只有该次验证成功，`Deploy Pages`才构建同一提交并自动发布正式站。
4. `Deploy Pages` 正式发布成功后触发 `Production smoke`，核对该次部署的精确源码版本并检查正式域名；每日和手动检查继续保留。工作流失败时先保留日志和失败证据，不降低门禁换取全绿。

正式发布无需人工点击，也无需在本地保存Cloudflare凭据。

独立统计应用由`build_analytics_app.mjs`在无凭据阶段从已构建产物按白名单打包为`analytics-public/`，独立artifact传递到受保护deploy阶段。仅自动main发布更新`mantou-blog-data`，手动preview仍只更新博客预览。两项目写入同一源码/分支/部署运行与批次的version.json；任一发布失败保留失败状态，生产smoke继续只跟随实际成功的正式deploy任务。

`mantou-blog-data`的生产配置由`deploy/analytics/wrangler.jsonc`管理三项公开数据源变量，四项统计/Access Secret由云端保存。Pages发布使用`--cwd deploy/analytics`读取标准文件名配置，输出目录相对该目录解析；Pages不支持自定义`--config`路径。新增安装域名需在现有Access应用增加`mantou-blog-data.pages.dev/admin/analytics`，沿用本人Allow；安装清单与图标公开，页面/接口保持登录和no-store。生产smoke会核对新应用版本、图标与真实登录挑战，安装结果仍由安卓真机验收。

## 按需在线预览

在线预览不是每个PR的默认成本。只有视觉或真实网络环境需要人工确认时才执行：

1. 打开GitHub仓库的`Actions` → `Deploy Pages` → `Run workflow`。
2. `Use workflow from`必须选择`main`。
3. 在`source_ref`填写要预览的分支、标签或完整提交SHA，然后运行。
4. 全部校验和部署成功后，打开`https://manual-preview.mantou-blog.pages.dev/`。

手动预览永远使用Cloudflare的`manual-preview`分支，不会覆盖正式站。若源码引用不存在，或任一校验失败，不会进入持有部署凭据的任务。

## 权限边界

- `Validate`只有仓库内容只读权限，不引用`CLOUDFLARE_API_TOKEN`。
- `Deploy Pages / build`可以检出指定源码并上传静态构建产物，但没有部署Secret。
- `Deploy Pages / deploy`只从可信`main`取得固定版本的部署工具，下载前一步产物，并读取`pages-deploy` Environment中的Secret。
- `pages-deploy`只允许`main`分支发起部署。
- `Production smoke`只在成功的自动正式部署后启动部署验收，先用 Actions 只读接口确认该次运行、该次重试的 `deploy` 任务确实成功，排除 PR 验证后所有部署任务跳过的“成功”运行；同时跳过手动预览、失败及取消的部署。它用已有临时 `GITHUB_TOKEN` 的 `actions: read` 权限读取任务状态和同次运行的版本元数据，不读取 Cloudflare 凭据，不新增长期凭据或写权限。
- Cloudflare使用独立的Account API Token，仅授权当前账户的Cloudflare Pages编辑权限；不使用Global API Key。

这些边界由`tests/python/test_deployment_workflow.py`持续检查。修改工作流时，先更新安全契约测试，再修改实现。

## 已发布版本核对

部署任务把构建任务记录的 `commit_sha`、目标分支、部署运行 ID 和重试批次写入 `public/version.json`，同时保存独立的版本元数据产物。正式域名的 `/version.json` 设置 `Cache-Control: no-store`。部署后冒烟下载触发它的那次运行、那次重试的元数据，先确认目标是 `main`，再与正式站返回的数据完整比较；最多等待两分钟，覆盖短暂的发布传播延迟。

不要用 `Production smoke` 的 `github.sha` 或其上游 `workflow_run.head_sha` 替代源码版本：`Deploy Pages` 本身由 `workflow_run` 触发，工作流所在的默认分支版本可能与它实际构建的已验证提交不同。每日和手动冒烟没有指定发布运行，只检查线上版本格式、正式分支与功能。手动预览始终不成为正式版本的期待值。

## 凭据轮换

轮换周期为12个月，提前30天提醒。轮换不直接覆盖或撤销旧Token：

1. 创建新的Account API Token，权限仍为当前账户的Cloudflare Pages编辑，设置一年有效期。
2. 用新Token调用Cloudflare Pages只读接口，确认账户与项目访问范围正确。
3. 更新GitHub `pages-deploy` Environment中的`CLOUDFLARE_API_TOKEN`。
4. 从`main`运行一次手动预览并确认页面可访问，再通过一次正常`main`发布和正式站烟雾测试。
5. 全部通过后撤销旧Token，并确认GitHub仓库级同名Secret不存在。

维护记录只保存Token名称、权限范围、创建日、到期日、提醒日和撤销状态，绝不保存Token值。若Token疑似泄露、权限扩大、维护者变化或部署出现无法解释的调用，应立即提前轮换。

当前轮换记录：

| Token名称 | 类型与权限 | 创建日 | 到期日 | 提醒日 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `mantou-blog-pages-deploy` | Account API Token；当前账户Pages写入 | 2026-08-31 | 2027-09-01（北京时间） | 2027-08-02 | 已验证并保存到`pages-deploy` Environment |
| `mantou-blog build token` | 旧User API Token | 未记录 | — | — | 账户持有人于2026-08-31确认已撤销；仓库级同名Secret已复核不存在 |

到期日以Cloudflare API返回的`2027-08-31T23:59:59Z`为准。新凭据已完成手动预览、正式发布和两组线上烟雾测试后，旧User API Token才被撤销。

## 故障处理

- `Validate`失败：这是代码或内容问题，不应尝试部署。
- `build`失败：修复指定源码；部署Secret未被读取。
- `deploy`失败：先检查Environment授权、Token有效期、Pages项目名和Cloudflare状态；不要把Secret复制到日志或PR。
- 正式站异常但部署成功：检查该次 `Production smoke` 日志中的期望版本，以及正式站 `/version.json`；若期间已有后续正式发布，应比对最新部署的检查结果。必要时通过新的修复PR前滚，不直接绕过`main`门禁。
