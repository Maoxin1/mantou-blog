---
home_status: "Mobile-ready · Works offline"
home_title: Three daily entries, one picture to keep
home_summary: Log reading, exercise, and journaling. Save a picture; use it offline.
title: Three daily entries in an offline action-recording tool
date: '2026-08-31'
lastmod: '2026-11-10'
description: Log reading and thinking minutes, exercise status, and journal completion, then summarize the current week and export an image. Works offline, with limited customization.
list_summary: An offline launch failed on a real phone. I fixed the routing and test environment; continued use
  then led me to reduce daily input to three entries.
preview_image: /images/mantou-checklist-preview-20261005.png
preview_alt: The October 2026 mobile preview, showing the action record and PNG export with default example data
work_type: tools
stage: V2 · Deployed with limited customization
problem: The web generator was quick to use, but I still had to open a URL. Offline cold starts had not been verified
  on a real phone.
hypothesis: Installing the editor as a PWA and matching the launch URL to its cached route would let it perform
  its core task as a lightweight standalone app.
constraints: No accounts, cloud sync, or complicated settings. Keep a single page, a short interaction, and local
  data storage.
decision: Align the installation entry and Cloudflare route, make automated tests reproduce production routing,
  and retest on a real phone.
outcome: V1 added installation and offline use. V2 uses reading and thinking minutes, exercise status, and journaling status for current-week totals, 1080 × 1536 PNG export, and limited customization.
artifact_url: https://mantou-checklist.pages.dev/editor
artifact_language: zh-cn
source_url: https://github.com/Maoxin1/mantou-checklist
evidence: V1 passed five checks on a real Android phone. Production browser checks on October 5, 2026 covered
  editing, autosave, JSON backup restoration, 1080 × 1536 PNG export, and offline use in the current version.
limitations: Data stays in the current browser without automatic cross-device sync. Previous-week daily details are not retained after the week changes; cumulative journal days and stage settings remain. Export before the change if you need the details. Initial installation and updates need a connection.
next_step: Keep recording reading and thinking, exercise, and journaling, and export backups as needed. Add features only when a specific difficulty appears again.
follow_ups:
- date: '2026-11-10'
  note: Continued from the reviewed two-week trial into an ongoing three-day strength phase with a reference target of three sessions a week. Previous trial dates, daily facts, and customization remain. Exercises and calendar-week reviews stay in training cards.
- date: '2026-11-06'
  note: Updated the case against current source to cover reading and thinking labels, the removed investment field, current-week retention, and the training card's separate role. This is a documentation update, not new functionality or another real-device acceptance result.
- date: '2026-10-05'
  note: The current version opens the form first, then shows the action record in the preview tab. Warm paper colors
    and comic-style lines now match the blog. Production checks covered input, autosave, backup restoration, and
    offline image downloads. The case screenshot and cross-site test now reflect this release. Longer-term results
    still need evidence from actual use.
- date: '2026-09-21'
  note: Continued use showed that too many daily fields consumed attention. V2 reduced them to focused-reading minutes,
    exercise status, and journaling status, with automatic weekly totals. “Boundary-breaking practice” is my internal
    name for focused reading and critical-thinking practice. This feedback from actual use directly changed the
    product.
reused_in:
- title: Daily-routine experiment V1
  note: Reused installation, offline support, local storage, and PNG generation to record and share the routine
    experiment, instead of building another logging tool.
  url: /now/
- title: “I do not want my personal blog to become a display cabinet”
  note: Reused the offline failure, fix, and phone retest as a central example in a later article about how I use
    this blog.
  url: /p/blog-feedback-system/
disclosure: public
featured: true
translation_status: reviewed
translation_provider: Machine-assisted, edited against the Chinese source
translation_source_hash: 1f7d5469378dbd7ce72974276b3dc731881bde44ff5de227b6d90c958731285f
---

## November 10, 2026: current entries and data boundaries

The three daily entries are now **reading and thinking minutes, exercise status, and journal completion**. The default plan is 90 minutes a day, with a weekly minimum of 450 minutes. Time measures effort, not demonstrated understanding or skill. The current stage, reading materials, and optional weekly deliverables remain in low-frequency settings. The investment field has been removed from the form and image; old backup text is retained only for compatibility.

Records and publication dates can only be selected within the current week, with backfilling allowed inside it. When a new week begins, only its daily log is retained; cumulative journal days and stage settings remain. Export JSON before the week changes if you need previous-week details. The tool does not maintain a long-term daily archive or sync automatically between devices.

The [training card](https://github.com/Maoxin1/mantou-training) handles exercises, training feedback, food, and recovery; Checklist handles the three daily facts and the public image. The October 27–November 9 trial has been reviewed. From November 10, Checklist continues into an ongoing three-day strength phase: Monday A, Wednesday B, Friday C, and badminton once at the weekend. Previous trial dates remain; no new two-week trial begins. The reference target is three strength sessions, separate from actual completion. Badminton does not count as strength. Checklist does not connect to the training-card account; daily facts still need entering.

## November 3, 2026: limited customization from reader feedback

Following a reader's suggestion in [Issue #25](https://github.com/Maoxin1/mantou-checklist/issues/25), the tool added customization for the PNG title, the three entry labels, and additional exercise options without changing the three input types. [PR #26](https://github.com/Maoxin1/mantou-checklist/pull/26) was merged. Production desktop and mobile-editor code checks passed, automated tests cover the feature, and the production smoke check passed.

This is not a general-purpose habit tracker: the input types remain minutes, an activity selection, and a completion status. Additional activities do not automatically count toward weekly strength sessions. There are no accounts or automatic cross-device sync; backups remain manual. Automated browser regression covers customization, but production source checks are not a complete production end-to-end test of those interactions. Further changes depend on a concrete difficulty in use.

## The problem and the idea

The checklist website already generated images quickly, with little effort or extra processing. But I still had to open its URL. It felt like a web tool rather than a small app I could reach for every day.

At this stage, the question was specific: **if I installed the editor on my phone's home screen and aligned its launch URL with the offline cache, could it run in a standalone window and keep doing its core job without a connection?**

## Constraints and decisions

I kept three constraints: no accounts, no cloud sync, and no expansion into a general-purpose habit tracker. The product remained focused on a recurring task: entering the day's information on a phone and exporting a checklist to share.

The key decision was to align the PWA installation entry, launch URL, and offline cache path, and make the local test server reproduce Cloudflare Pages' URL normalization. Tests would then face routes closer to production, instead of an ideal environment that was easier to pass.

## What I made and checked

- A PWA that can be installed on the phone's home screen;
- An icon that opens the checklist workspace in a standalone window, without a browser address bar; the form opens first, and the preview tab shows the updated record;
- Automatic saving in the current browser;
- A live 1080 × 1536 checklist preview;
- PNG downloads, JSON backups, and offline use.

You can [open the editor](https://mantou-checklist.pages.dev/editor) or find the source, tests, and instructions in the [GitHub repository](https://github.com/Maoxin1/mantou-checklist). The tool's interface is in Chinese.

For V1, automated checks covered the launch entry, standalone mode, autosave, backup restoration, image dimensions, and offline downloads. I then tested each item on a real Android phone:

<section class="verification-matrix" data-verification-matrix aria-label="Real-phone test results">
  <div class="verification-matrix__heading"><span>REAL DEVICE ACCEPTANCE</span><strong>V1 · Real Android phone · 5 / 5 passed</strong></div>
  <ol>
    <li><span>Launches from the home-screen icon</span><strong>Passed</strong></li>
    <li><span>No browser address bar after launch</span><strong>Passed</strong></li>
    <li><span>Opens the editor directly</span><strong>Passed</strong></li>
    <li><span>Data remains after closing</span><strong>Passed</strong></li>
    <li><span>Can edit and download an image offline</span><strong>Failed initially; passed after the fix</strong></li>
  </ol>
</section>

The fifth check failed on the first attempt: a cold start without a connection produced `ERR_FAILED`. Local tests had passed, so the test environment clearly did not reproduce deployment behavior.

Cloudflare Pages redirects `/editor.html` to the normalized `/editor` route. The old offline cache and installation entry used different routes. I aligned the launch and cache paths and changed the local server to reproduce Cloudflare Pages routing. Local tests, automated checks on the production domain, and a retest on the same phone then passed.

## V2: reducing daily input to three facts

V1 established that the tool could be installed, run offline, and export images. Continued use revealed another problem: **too many daily fields made the tool itself compete for my attention.**

V2 reduced daily input to three things:

- Minutes of “boundary-breaking practice”—my name for focused reading and critical-thinking practice;
- Today's exercise status;
- Whether I had finished my journal.

The reading entry changed from keyboard input to a **slider from 0–180 minutes in 5-minute steps**, with 90 minutes marked as the current target. Moving it updates the value, weekly totals, and public PNG together. Exercise and journaling remain status choices.

At that stage, the tool began totaling practice time and strength sessions instead of asking for weekly information twice, while other information moved to low-frequency settings. The current label is “reading and thinking,” and the investment field has since been removed. See the update at the beginning for current behavior.

The original boundaries remain:

- No accounts;
- No cloud sync;
- No attempt to become a complete health database;
- No publication of private blood-glucose, symptom, or raw sleep records;
- Browser-local storage and manual backups remain the main approach.

Deployment stayed simple too. Checklist uses Cloudflare Pages Direct Upload, with a single deployment command run locally. GitHub Actions validates the code; it does not maintain additional Cloudflare secrets.

The tool now has another role: **a low-effort way to record and share my daily-routine experiment.** The more complicated judgments stay in the blog and experiment reviews. Checklist takes today's facts and handles the totals and image generation.

## October 5, 2026: bringing the public case up to date

This release brings warm paper colors and comic-style lines to the checklist, matching the blog. It also opens the form first: update the day's three facts, switch to the preview to see the action record, then download the image. The screenshot at the top uses default data from the current production site to show the interface.

I checked editing, autosave, JSON backup restoration, 1080 × 1536 PNG export, and offline editing and downloads on the production domain. The blog's cross-site test now follows the case's artifact link and checks input, persistence after reload, preview switching, and an actual download. These checks establish the browser flow for this release. The Android results above belong to V1; longer-term benefits still require records from actual use.

## Limits and boundaries

- Data lives in the current browser's local storage by default.
- Only the current week's daily details are retained. When the week changes, cumulative journal days and stage settings remain; export beforehand if you need previous-week details.
- Clearing site data or uninstalling the browser can lose it; backups must be exported deliberately.
- Initial installation and new versions require a connection.
- The fields serve my own practice checklist, rather than a general-purpose habit tracker.
- This stage established technical usability. It did not establish long-term gains in efficiency.

## What I learned and what comes next

The most useful result was the real phone failure that exposed a blind spot in the automated tests. Tests become evidence only when they cover real deployment behavior and real use.

My rule for further changes is simple: without an actual failure or a clear need, I will not add features merely to make the product look complete.
