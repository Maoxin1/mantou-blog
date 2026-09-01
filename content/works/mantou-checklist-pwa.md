---
title: "把个人定投清单做成可离线运行的手机 PWA"
date: "2026-08-31"
description: "把已有网页生成器补齐为可从桌面启动、自动保存并离线生成图片的轻量应用。"
work_type: "tools"
stage: "V1 · 已完成"
problem: "网页生成器虽然操作很快，但仍需先打开网址；断网冷启动也没有被真实验证。"
hypothesis: "如果将编辑器安装为 PWA，并让启动地址与缓存路由保持一致，就能像轻量 App 一样独立完成核心任务。"
constraints: "不增加账号、云同步和复杂配置；继续保持单页、低操作成本与本地数据边界。"
decision: "统一安装入口与 Cloudflare 路由，并让自动化测试模拟正式部署环境，再用真实手机复验。"
outcome: "从手机桌面直接进入编辑器，无地址栏运行；断网后仍可填写并下载 1080 × 1536 PNG。"
artifact_url: "https://mantou-checklist.pages.dev/editor"
source_url: "https://github.com/Maoxin1/mantou-checklist"
evidence: "本地和正式域名自动化测试通过，并在真实 Android 手机上完成五项验收。"
limitations: "数据只保存在当前浏览器，不自动跨设备同步；首次安装和获取更新仍需要联网。"
next_step: "先作为自己的日常工具持续使用；只有出现真实阻力时才继续增加功能。"
disclosure: "public"
featured: true
---

## 问题与假设

定投清单网页已经能够快速生成图片，实际使用耗时很低，也不需要额外处理。但我仍要先打开网址，它在使用感受上更像一个网页工具，而不是每天可以直接调用的轻量应用。

这一阶段要检验的不是“能否做出更多功能”，而是一个更具体的假设：**如果把现有编辑器安装到手机桌面，并统一启动路径与离线缓存，它就能以独立窗口运行，在断网时继续完成核心任务。**

## 约束与关键决策

这次迭代主动保留了三条约束：不增加账号、不增加云同步、不把它扩张成通用习惯追踪器。产品仍然只围绕一个高频任务：在手机上填写当天信息并导出公开清单。

关键决策是统一 PWA 的安装入口、启动地址和离线缓存路径，同时让本地测试服务器模拟 Cloudflare Pages 的路由规范化行为。这样，测试面对的是接近正式环境的路径，而不是一个更容易通过的理想环境。

## 本阶段产出与验证

- 可以安装到手机桌面的 PWA；
- 点击图标后直接进入编辑器，以无地址栏的独立窗口运行；
- 表单内容自动保存在当前浏览器；
- 实时生成 1080 × 1536 清单预览；
- 支持 PNG 下载、JSON 备份和离线使用。

你可以[在线打开编辑器](https://mantou-checklist.pages.dev/editor)，也可以在 [GitHub 仓库](https://github.com/Maoxin1/mantou-checklist)查看源码、测试和使用说明。

技术层先用自动化检查启动入口、独立显示模式、自动保存、备份恢复、图片尺寸和离线下载；随后在真实 Android 手机上逐项验收：

<section class="verification-matrix" data-verification-matrix aria-label="真实手机验收结果">
  <div class="verification-matrix__heading">
    <span>REAL DEVICE ACCEPTANCE</span>
    <strong>真实 Android 手机 · 5 / 5 通过</strong>
  </div>
  <ol>
    <li><span>桌面图标能够启动</span><strong>通过</strong></li>
    <li><span>启动后没有浏览器地址栏</span><strong>通过</strong></li>
    <li><span>直接进入编辑器</span><strong>通过</strong></li>
    <li><span>关闭后数据仍然保留</span><strong>通过</strong></li>
    <li><span>断网后能够填写并下载图片</span><strong>先失败，修复后通过</strong></li>
  </ol>
</section>

第五项第一次测试失败：应用在断网冷启动时显示 `ERR_FAILED`。本地测试此前却是通过的，这说明测试环境没有复现正式部署环境。

排查后发现，Cloudflare Pages 会把 `/editor.html` 规范化跳转到 `/editor`，而旧离线缓存与安装入口使用了不同的路由。修复时统一了启动和缓存路径，并把本地测试服务器改为模拟 Cloudflare Pages 路由。随后，本地、正式域名自动测试以及同一台手机复验全部通过。

## 反证、限制与边界

- 数据默认只存在当前浏览器的本地存储中；
- 清理站点数据或卸载浏览器可能造成数据丢失，需要主动导出备份；
- 第一次安装和获取新版本需要网络；
- 当前字段首先服务于我自己的定投清单，并不是一款通用习惯追踪器；
- 本轮证明了技术可用性，没有把短期体验夸大为长期效率提升。

## 复盘与下一步

这次最有价值的结果不是“所有测试最终通过”，而是手机上的真实失败暴露了自动化测试的盲区。测试只有覆盖真实部署环境和真实使用路径时，才有资格成为证据。

后续迭代继续遵循一个简单规则：没有真实失败或明确需求，就不为了显得完整而增加功能。
