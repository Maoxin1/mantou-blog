---
home_status: "Two everyday entry points · New behavior on trial"
home_title: "Understand goals, check judgments, clarify requests"
home_summary: "manuel helps me understand goals, check judgments, and take a next step; mantou helps me clarify requests. The new behavior still needs evidence from use."
title: Four recurring tasks, packaged as installable Codex agents
date: '2026-09-14'
lastmod: "2026-11-06"
description: A Codex agent package that grew from four recurring tasks into two everyday entry points, manuel and mantou, with specialist roles available separately.
list_summary: "Two default entry points and optional specialist roles. Earlier versions have seen repeated use; the new integration still needs real-task evaluation."
work_type: methodology
stage: "Current source defaults to two entry points · Historical release v0.1.1"
problem: Repeated complex tasks relied on ad hoc prompts, making task boundaries, evidence standards, and updates
  difficult to keep consistent.
hypothesis: Narrowly scoped agents, supplied with installation, validation, and release procedures, could reduce
  repeated setup while keeping clear boundaries.
constraints: No private notes, holdings, or copyrighted source material; no securities trading on behalf of users;
  configuration checks do not establish task quality.
decision: Split the work into four agents, package their TOML configurations with documentation and support files,
  and verify delivery with a PowerShell installer and regression tests.
outcome: Released codex-agents v0.1.1 with four agents. Installation can be tested in an isolated directory without
  changing the actual Codex directory.
artifact_url: https://github.com/Maoxin1/codex-agents/releases/tag/v0.1.1
artifact_label: Historical release v0.1.1
source_url: https://github.com/Maoxin1/codex-agents
source_label: Current source and installation
evidence: Version 0.1.1 is released, with repository and isolated installation checks documented. On 2026-10-24, I confirmed repeated use by colleagues and friends for prompts and reasoning checks; independently checkable task records are not yet available.
limitations: Earlier use and validation do not establish the new integration's effectiveness. Personal understanding, the five-book methods, and the research workflow still need real evaluation. A compatible Codex environment, PowerShell, and model access are required.
next_step: "Record goal confirmation, judgments, output problems, and manual corrections in real tasks using the two everyday entry points, then decide what to change."
disclosure: public
privacy_reviewed: true
featured: true
follow_ups:
- date: '2026-11-06'
  note: Updated the case against current source to cover two default entry points, optional specialist roles, and the research pilot. Earlier use and installation checks remain evidence for their own stages, not for the new behavior.
- date: '2026-10-24'
  note: Colleagues and friends have used the agents repeatedly for prompts and reasoning checks; specific task performance still needs documenting.
translation_status: reviewed
translation_provider: Machine-assisted, edited against the Chinese source
translation_source_hash: 06ea919f24312e57e20dae4bad5e6eaa6a5973907f49fb1ddaa0750a4df371f9
---

## November 6, 2026: two default entry points

The [current source and installation guide](https://github.com/Maoxin1/codex-agents#readme) now start with two everyday entry points: `_manuel` helps understand goals, check judgments, and take a next step; `_mantou` helps clarify requests.

The default installer installs both, along with the five-book method materials used by manuel. The earlier book-specific advisers remain available as compatibility entry points, and fact-checking and investment research are optional specialist roles. Use `-All` to install all eight roles. A default update does not automatically remove roles already installed.

As of this update, the latest formal GitHub Release is still the [historical v0.1.1 package](https://github.com/Maoxin1/codex-agents/releases/tag/v0.1.1). Follow the current source README to try the new behavior. The release package, current source, and results in real tasks each need to be checked separately.

On November 3, the Chinese case recorded the expansion to eight agents. This update changes the default entry points. The four-agent and v0.1.1 descriptions below remain records of the earlier stage. The new integration and research workflow are on trial; earlier installation checks and answer records do not establish their effectiveness. See the [verification status](https://github.com/Maoxin1/codex-agents/blob/main/docs/verification-status.md).

## What you can use it for

I now start with the two everyday entry points and choose other roles when a task calls for them.

Start with `_mantou` to clarify a vague request, or try `_manuel` to understand a goal, compare choices, or examine assumptions and inferences. manuel can use five-book methods as needed and consult notes you authorize. Its understanding of you is open to correction, not mind-reading; there is no automatic chat import or background monitoring.

manuel also offers a [research and analysis-learning pilot](https://github.com/Maoxin1/codex-agents/blob/main/agents/_manuel/research.md): check sources, examine assumptions and contrary evidence, and learn a transferable method around a concrete question. Its effectiveness still needs testing in use; it does not promise accurate market predictions.

These entry points help organize and check work; their output still needs your judgment.

The GitHub repository contains [installation instructions and requirements](https://github.com/Maoxin1/codex-agents). You need a compatible Codex environment, PowerShell, and access to a supported model.

## Use of earlier versions

Besides my own use, colleagues and friends have used the agents repeatedly, mainly to improve prompts and find gaps in wording and reasoning.

I have not yet compiled complete task comparisons showing which changes were adopted and which outputs still needed manual correction. These experiences are worth documenting, but do not yet establish effectiveness across different tasks.

If you have tried them, [leave feedback](#comments): what you wanted to do, what helped, and what you still needed to change. For installation problems, you can also [email me](mailto:2114206091@qq.com). Remove private information before sharing examples.

## The problem and the idea

I repeatedly handle four kinds of work: refining prompts, examining arguments, checking facts, and auditing investment theses. Each time, I used to explain the task boundaries, evidence standards, and restrictions again. The prompts grew longer, yet behavior still drifted between conversations.

The idea I wanted to test was simple: **could narrowly scoped custom agents, delivered with an installer, documentation, and regression checks, be more consistent and easier to maintain than a few saved prompts?**

The Codex documentation describes personal or project-level custom agents defined in separate TOML files, each with a name, description, and instructions. This repository is my personal configuration package built on that mechanism. It is not an official OpenAI product or agent collection.

## Constraints and decisions

I divided the work into four roles according to the kind of judgment involved:

- `_mantou` clarifies and refines prompts without carrying out the tasks inside them.
- `_manuel` uses a critical-thinking framework to examine questions, evidence, and inferences.
- `_factbot` separates claims, evidence, inferences, and opinions, checking source independence and uncertainty.
- `_invest` supports long-term investment research and thesis review, without executing securities trades.

The boundary around public material is part of the package. Personal Obsidian paths and case indexes live in ignored local files. The repository contains no private notes, actual holdings, credentials, or source texts from reference books.

## What I shipped and checked

The version released at that stage was [v0.1.1](https://github.com/Maoxin1/codex-agents/releases/tag/v0.1.1). Source code and full instructions are in the [GitHub repository](https://github.com/Maoxin1/codex-agents). This stage delivered:

- Configurations, role descriptions, and invocation examples for four agents;
- A PowerShell installer with preview and forced-update options;
- Isolated installation regression tests that do not write to the real Codex directory;
- Checks for configuration syntax, file integrity, privacy boundaries, and installation results;
- Documentation covering compatibility, contributions, security, changes, and releases;
- A versioned GitHub Release with change notes.

Both repository validation and isolated installation from the release archive passed. Version v0.1.1 also fixed validation on Windows systems where `python` is not available: the scripts try the standard `py -3` launcher.

## Limitations

- Automated tests establish that configuration and installation behave as expected. They do not guarantee correct answers.
- Different models, reasoning settings, Codex versions, and permissions can produce different results.
- Fact-checking and investment research still require checking sources; an agent's name is no guarantee of reliability.
- `_invest` supports research and review only. It cannot trade automatically.
- The official custom-agent format may evolve, so compatibility needs ongoing attention.

## What comes next

This stage turned prompts I often use into a configuration package that can be installed, checked, and updated. Installation checks are documented; performance in real tasks still needs more evidence.

Next I will document specific tasks, output problems, and manual corrections from existing use, then use those records to decide what to change.

For the platform mechanism and configuration boundaries, refer to the [official Codex documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents).
