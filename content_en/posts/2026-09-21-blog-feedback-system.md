---
title: I no longer want my blog to be a display cabinet
date: 2026-09-21
slug: blog-feedback-system
draft: false
description: I am trying to make this blog feed back into what I do next, through real-world checks, responses to
  published work, and reuse.
categories:
- essays
tags:
- 写作博客
- 成长反思
translation_status: reviewed
translation_provider: Edited against the Chinese original
translation_source_hash: 422d85bb6434eed2a921d0b2900911481a420385ba78d7543ca48bfab6636c9f
---

I recently realized that the most dangerous state for a personal blog is not having no readers.

It is preserving the past without influencing the future.

An article gets written, published, and archived. A finished project goes into the portfolio. Years later, those things can still show:

> I once thought about these questions and made these things.

But if a published article never affects a later judgment, and a finished project never makes the next undertaking easier, the blog is essentially an increasingly polished filing cabinet.

I do not really want to keep doing that.

Recently, I started rebuilding my blog. I wanted to test something, rather than simply add pages:

> **Can something I put into the world come back and influence my next action?**

## A real failure changed what a “project” meant to me

The change began with a small project.

I had turned my daily practice checklist into a PWA that could be installed on a phone. Once development was finished, all the local automated tests passed: desktop startup, saving data, offline use, and image export appeared to work.

Then I took out my phone, disconnected it from the network, and launched the app again.

It failed.

The app would not open from a cold start while offline.

Investigation revealed that the deployed environment handled paths differently from the local test environment. In other words:

**My tests passed, but actual use did not.**

I changed the startup path, offline cache, and test environment, then checked again on the same phone. Only then could I consider the work accepted.

I kept the full account of that failure in the [public project record](/works/mantou-checklist-pwa/).

It strengthened a conviction:

> **A result must be checked in the real environment before it can count as evidence.**

After that, I started asking the blog’s project pages to explain more than what I had made. What was the problem? What did I initially assume? What constraints applied? Why did I choose that approach? What happened? What evidence supports the result? What failed? What limitations remain? Should I continue, change course, or stop?

The blog began moving from displaying finished objects toward recording how reality tested my judgment.

Then I encountered a second problem.

## Why should a project end at publication?

Previously, a project’s life looked something like this:

> Problem → making → verification → publication → the end.

But reality is different.

Much of the value arrives after publication.

Someone uses the thing and finds a problem I missed. Months later, I reuse the method in another project. Reality overturns an earlier judgment. A mistake saves me a detour the second time. A project might even introduce me to someone I would otherwise never have met.

Previously, I had nowhere to record those things.

So I recently added two simple areas to the project pages:

**What came back.**

And:

**Where it was used later.**

For now, most of those areas are empty.

That is deliberate.

Adding two fields should not tempt me to pretend a project is certain to create future value. I will record something only after it happens.

If nothing has happened after six months, that is a real result too. At least it tells me:

> I finished the project, but it did not produce the compounding value I imagined.

## I care more about what comes back

The question that matters to me is less how much I publish, and more:

> **What returns after publication?**

Did it clarify my thinking? Did someone point out an error? Did it lead to a worthwhile discussion? Was it reused in the next project? Did it reduce the cost of later work? Did it create a relationship, collaboration, or opportunity?

For now, I think of this as work feeding back into my practice.

My old understanding of working in public looked like this:

```text
Me
↓
Make something
↓
Publish it
↓
Other people see it
```

That is a one-way process.

Now I would like it to look more like this:

```text
Problem
↓
Action
↓
Project
↓
Publication
↓
Feedback
↓
Review
↓
Influence the next action
↺
```

Publication should become an input to the next round of work, as well as the end of the current round.

## `/now/`: the page itself is not the real experiment

During this rebuild, I also added a [“What I am working on” page](/now/).

It is neither a to-do list nor a complete project list. I allow myself only a few things that are currently receiving real attention.

At present, there are three:

* An active investing system.
* Daily routine experiment V1.
* mantou-blog.

Each must answer two questions:

> **What, exactly, am I testing now?**

And:

> **At what point must I reconsider?**

For example, the daily routine experiment is about more than whether I can get up at five.

I want to know whether reorganizing sleep, energy supply, and morning time can reliably give me focused attention from 5:00 to 8:00 each day, with at least part of that time devoted to “Beyond Boundaries”—my reading and critical-thinking practice.

At the checkpoint, the project cannot stay “in progress” forever. I must decide again: continue, adjust, or pause.

But that may not be the page’s most important function for me.

## If I want to do a fourth thing, which one is it worth replacing?

I increasingly find that my scarce resource is attention, rather than ideas.

New projects, research directions, software, and questions never run out. When I used to encounter something interesting, I would easily think:

> Should I do this on the side too?

Now `/now/` imposes a constraint:

> **If I add this, which current commitment is it worth displacing?**

If none of the current commitments is worth stopping, the answer becomes clear:

**Do not start it now.**

On the surface, `/now/` is a public page. The real experiment is whether it can change one of my own decisions.

If it stops me from starting even one project I should not take on yet, it may have produced more value than many more complicated features.

## The engineering is sufficient; more features are not the next priority

When improving the blog, I easily notice more engineering problems: search, the CMS, page design, automated tests, deployment, mobile layouts, dark mode.

I gradually addressed most of those.

There will always be room to improve the site itself. But I have begun to recognize something:

> **More complete website engineering does not necessarily mean a more valuable website for me.**

If there is no new work, no real feedback, no judgment changed by publishing, and no past experience informing the next action, adding more pages will not solve the underlying problem.

So I am setting another constraint:

> **Without a real problem, do not rush to add another feature.**

For example, I considered adding a Notes section, but have not proceeded.

The problem should appear first. If I repeatedly find things worth keeping that fit neither an article nor a project, I can address that then. I do not need to anticipate every possible need and build the whole system in advance.

## Rethinking the personal blog

I used to see a blog as:

> **A place to preserve what I have done.**

Now I hope it can gradually become:

> **A record of what I am testing, which judgments reality has changed, and how past work goes on to influence the future.**

Alongside “What has mantou done before?”, it should begin to answer:

> What is mantou testing now?

> What happened to those projects after publication?

> Which methods were actually reused?

> Which judgments turned out to be wrong?

> Why did one thing continue while another stopped?

When I open this site again in a few years, I hope to see more than a row of increasingly attractive projects. I want a trail of cause and effect:

> This question led to that experiment.

> The experiment left behind a method.

> The method was used in another project.

> External feedback changed the next decision.

That may be what I really want from a personal blog.

## The real experiment begins now

The `/now/` page is running. Project pages can record feedback and reuse after publication. But it is too early to say whether those features are valuable.

What matters next is whether:

* `/now/` actually helps me turn down a new temptation.
* A published project receives its first response worth adding to the record.
* Earlier work really reduces the cost of the next project.
* Someone I did not know finds me through a specific problem, because I published my work.

If none of that happens, I should revise these mechanisms—or remove them.

If it does happen, the blog will begin moving from **preserving the past** toward **participating in the future**.

I want to test something harder:

> **Can what I have already put into the world actually change my future self?**

If you maintain a personal website over the long term, I am curious:

**Does it mainly preserve your past, or has it started influencing what you do next?**
