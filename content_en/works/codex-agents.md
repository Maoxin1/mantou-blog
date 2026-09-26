---
home_status: "Four installable agents"
title: Four recurring tasks, packaged as installable Codex agents
date: '2026-09-14'
description: A set of custom agents for refining prompts, critical thinking, fact-checking, and investment research,
  with installation and validation tools.
list_summary: Four agents have been released and their installation tested. Their performance on real tasks still
  needs to be documented.
work_type: methodology
stage: v0.1.1 · Released
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
source_url: https://github.com/Maoxin1/codex-agents
evidence: Repository checks and isolated installation regression tests passed. Version 0.1.1 is available as a GitHub
  Release with release notes.
limitations: Tests cover configuration, file integrity, and installation, not long-term output quality across models
  and real tasks. Users need a compatible Codex environment, PowerShell, and access to a supported model.
next_step: Record successes, failures, and human corrections on real tasks before adding roles or more systematic
  behavioral evaluations.
disclosure: public
privacy_reviewed: true
featured: false
translation_status: reviewed
translation_provider: Machine-assisted, edited against the Chinese source
translation_source_hash: 6a1b2353b31110c3bdcfb5c81775f2f7c1cf9b4d8a98865602fdae5ed7f920f7
---

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

The current public version is [v0.1.1](https://github.com/Maoxin1/codex-agents/releases/tag/v0.1.1). Source code and full instructions are in the [GitHub repository](https://github.com/Maoxin1/codex-agents). This stage delivered:

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

This stage turned a few prompts I often use into a versioned package that can be installed, checked, updated, and tested again. Engineering completeness is only the first layer of evidence. Its value still depends on real task performance.

Before adding a fifth agent, I will document real uses of the existing four: the task, where the first answer failed, the corrections I made, and whether a repeated task required less work. Those records will determine whether to add roles or more systematic behavioral evaluations.

For the platform mechanism and configuration boundaries, refer to the [official Codex documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents).
