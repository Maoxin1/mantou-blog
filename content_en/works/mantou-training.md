---
translation_source_hash: a58e4c5ccae6048fc502d6500bd0cd549e417fc42fc65064e1cdf62a2955297b
title: "Training cards: keeping exercise, food, and recovery in one record"
date: '2026-11-06'
lastmod: '2026-11-10'
description: An offline-first personal training PWA for exercises, food, and recovery, with review exports, backups, and optional email login and cross-device sync.
home_title: "Record training, food, and recovery together"
home_status: "2.4.0 live · Ongoing three-day phase"
home_summary: View a plan, record what happened, then export feedback and photos for review. Account sync is optional.
list_summary: Start with one exercise and bring food, recovery, and photos into the review. Conflict handling, backup restoration, and record protection are part of the tool too.
work_type: tools
stage: "2.4.0 live · Core device acceptance passed"
problem: Checklist records whether training happened, but not exercise sets, conditions, or detailed food and recovery feedback.
hypothesis: Keeping plans, actual activity, and recovery feedback in one low-friction tool, with exportable records, can support later review and adjustment.
constraints: Offline-first; changes follow explicit records; private photos and records stay out of this case; no diagnosis or physique prediction.
decision: Keep a local-only mode with optional account sync, and use Markdown, JSON, and photo ZIP exports for review, backups, and migration.
outcome: Version 2.4.0 is live with explicit activation of an ongoing A/B/C phase, session target snapshots, and calendar-week reviews. Food, recovery, photos, sleep ZIP import, backups, and account sync remain.
artifact_url: https://mantou-training-offline.vercel.app/
artifact_language: zh-cn
artifact_label: Open training cards
source_url: https://github.com/Maoxin1/mantou-training
source_label: Source and self-hosting guide
evidence: Release PR 8 and main CI passed, with 104 module tests and six browser flows. The owner confirmed two-device upgrades retaining records and photos, phase sync, and offline reopening on the phone. First real session creation and exercise entry remain pending actual training.
limitations: Software acceptance does not establish training benefits, working loads, or a 30-minute session. The first real session still needs checking. Automatic scoring, progression suggestions, and automatic watch connections are not delivered.
next_step: Check session creation and exercise entries during the first real workout, then review execution, recovery, and food by calendar week. Change only what actual evidence supports.
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

The current plan is an ongoing three-day A/B/C phase. Review the exercises and equipment, then explicitly activate it; deployment does not rewrite the real account plan. Future target changes show old values, new values, and reasons before confirmation. Only newly created sessions use them; earlier sessions keep their targets, exercise versions, and loads. Automatic scoring and progression suggestions have not been delivered; the manual review guide is not an automated engine.

## Bring feedback into the review

The tool also records post-training feedback, food, and next-day recovery. Meal photos are saved on the device first and can sync with an account. Export reviews as Markdown or as a ZIP with photos to bring into Obsidian. Photos support review; they do not automatically produce calorie estimates or nutrition conclusions.

Sleep records can be imported manually from a Samsung export ZIP. Preview nights in a batch and check duplicates. New nights are preselected; revisions require manual selection. Cross-device edits whose order cannot be established retain both versions for review. The original ZIP is unpacked locally rather than uploaded; the confirmed summary uses the normal record-sync and backup paths. This is file import, not automatic watch sync.

## Local-only mode and account sync

Without login, records stay on the current device. A self-hosted copy does not connect to the author's database by default. For multiple devices, configure your own backend and email login using the [account-sync guide](https://github.com/Maoxin1/mantou-training/blob/main/ACCOUNT-SYNC.md).

Offline changes upload when the app is open and online; background sync after closing is not promised. Independent fields can merge. When both devices edit the same exercise's set array, the versions need review. Signing out on a shared device leaves unencrypted local caches, so data needs managing for that setting.

## 2.4.0: continuing into an ongoing three-day phase

[Version 2.4.0 (PR 8)](https://github.com/Maoxin1/mantou-training/pull/8), released November 10, adds explicit activation, A/B/C session snapshots, and calendar-week reviews. The previous two-week phase remains available for review and export. The schedule is Monday A, Wednesday B, Friday C, and badminton once at the weekend; it does not restart a two-week trial.

Version 2.3.7 added manual adjustment previews, confirmation, and conflict blocking; 2.3.8 added batch duplicate checks for Samsung sleep ZIPs. Version 2.4.0 retains these along with photos, backups, account sync, and offline records.

[Main CI](https://github.com/Maoxin1/mantou-training/actions/runs/42750777434) and isolated cross-version regression passed. The owner confirmed retained records and photos on both upgraded devices, phase visibility across devices, and the new plan after reopening the phone offline. First real session creation and exercise entry will be checked during actual training, without inventing workout records for a test.

## History: record protection and recovery in 2.3.6

The November 6 source update focuses on record protection and backup restoration. Failed reads of local records or account caches pause writes and preserve an original copy. Photo backups split by size and count; full ZIP restoration reads both photos and text. Regression checks also cover repeated resolution of same-exercise set conflicts.

The [GitHub test workflow](https://github.com/Maoxin1/mantou-training/actions/runs/42151322312) passed for this commit. See the [changelog](https://github.com/Maoxin1/mantou-training/blob/main/CHANGELOG.md) for details. These describe the checks for 2.3.6 at that time. Current production and device acceptance are recorded above under 2.4.0.

The tool helps preserve facts. Whether training is suitable and recovery is sufficient still requires real feedback. This public case describes general features and includes no private training backups, photos, or health data.
