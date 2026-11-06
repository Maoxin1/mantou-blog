---
translation_source_hash: 03d0e790d4755be5f9aeb1215410df2f3599dd5fcb48387be3a34161d2ef02a3
title: "Training cards: keeping exercise, food, and recovery in one record"
date: '2026-11-06'
lastmod: '2026-11-06'
description: An offline-first personal training PWA for exercises, food, and recovery, with review exports, backups, and optional email login and cross-device sync.
home_title: "Record training, food, and recovery together"
home_status: "Source 2.3.6 · Offline-first"
home_summary: View a plan, record what happened, then export feedback and photos for review. Account sync is optional.
list_summary: Start with one exercise and bring food, recovery, and photos into the review. Conflict handling, backup restoration, and record protection are part of the tool too.
work_type: tools
stage: "Source 2.3.6 · Online entry available"
problem: Checklist records whether training happened, but not exercise sets, conditions, or detailed food and recovery feedback.
hypothesis: Keeping plans, actual activity, and recovery feedback in one low-friction tool, with exportable records, can support later review and adjustment.
constraints: Offline-first; changes follow explicit records; private photos and records stay out of this case; no diagnosis or physique prediction.
decision: Keep a local-only mode with optional account sync, and use Markdown, JSON, and photo ZIP exports for review, backups, and migration.
outcome: The repository provides exercise records, rule-based progression, food and recovery feedback, meal photos, sleep-file import, and backup restoration. The current source version is 2.3.6.
artifact_url: https://mantou-training-offline.vercel.app/
artifact_language: zh-cn
artifact_label: Open training cards
source_url: https://github.com/Maoxin1/mantou-training
source_label: Source and self-hosting guide
evidence: The GitHub test workflow passed for the 2.3.6 commit a8eb562. The changelog records the scope of sync and record-protection checks. This case adds no real-device or real-account acceptance result.
limitations: The source version is not a verified production deployment version. Automated checks do not replace phone, tablet, real-email, or camera-permission acceptance, nor establish long-term training benefits.
next_step: Keep checking record, sync, and export problems in real use, then use the feedback to decide what to change.
disclosure: public
privacy_reviewed: true
featured: false
translation_status: reviewed
translation_provider: Machine-assisted, edited against the Chinese source
---

## The problem it addresses

[Checklist](/works/mantou-checklist-pwa/) only needs reading time, exercise status, and journal completion. Reviewing training needs more detail: which exercise, actual sets and repetitions, resistance and conditions, and food and recovery afterward.

Training cards put these details in one place. Open the plan and record an exercise when needed. Records can be filled in gradually; a blank stays unknown rather than counting as completed.

## Start with one exercise

[Open training cards](https://mantou-training-offline.vercel.app/) to view a plan and record actual sets, repetitions in reserve, exercise status, and conditions. After initial online preparation shows that offline use is ready, plans, records, and exports work offline.

Progression follows preset rules: once verification is explicitly enabled, two consecutive qualifying attempts are required before advancement. Adjustments can be undone; exercises can be reduced or paused. Missing records never increase targets automatically, and neither sets nor training days increase automatically. The default plan comes from a home resistance-band and bodyweight setting and needs adapting to individual conditions.

## Bring feedback into the review

The tool also records post-training feedback, food, and next-day recovery. Meal photos are saved on the device first and can sync with an account. Export reviews as Markdown or as a ZIP with photos to bring into Obsidian. Photos support review; they do not automatically produce calorie estimates or nutrition conclusions.

Sleep records can be imported manually from a Samsung export ZIP. Select segments from the same night, preview them, and confirm the summary. The original ZIP is unpacked locally rather than uploaded; the confirmed summary uses the normal record-sync and backup paths. This is file import, not automatic watch sync.

## Local-only mode and account sync

Without login, records stay on the current device. A self-hosted copy does not connect to the author's database by default. For multiple devices, configure your own backend and email login using the [account-sync guide](https://github.com/Maoxin1/mantou-training/blob/main/ACCOUNT-SYNC.md).

Offline changes upload when the app is open and online; background sync after closing is not promised. Independent fields can merge. When both devices edit the same exercise's set array, the versions need review. Signing out on a shared device leaves unencrypted local caches, so data needs managing for that setting.

## 2.3.6: protect records before recovery

The November 6 source update focuses on record protection and backup restoration. Failed reads of local records or account caches pause writes and preserve an original copy. Photo backups split by size and count; full ZIP restoration reads both photos and text. Regression checks also cover repeated resolution of same-exercise set conflicts.

The [GitHub test workflow](https://github.com/Maoxin1/mantou-training/actions/runs/42151322312) passed for this commit. See the [changelog](https://github.com/Maoxin1/mantou-training/blob/main/CHANGELOG.md) for details. These are source capabilities and existing checks, not proof that production runs that version or a new real-device acceptance result.

The tool helps preserve facts. Whether training is suitable and recovery is sufficient still requires real feedback. This public case describes general features and includes no private training backups, photos, or health data.
