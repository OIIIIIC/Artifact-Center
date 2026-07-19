# Artifact Center Product Bible

> Version: 1.0
> Status: Draft
> Last Updated: 2026-07

---

# 1. Vision

## Why does Artifact Center exist?

Artifact Center exists to make software artifact management simple, fast, and enjoyable.

Its goal is not to become another DevOps platform, nor another enterprise management system.

Instead, it focuses on a single responsibility:

> Help people find, publish, and download the right software artifact with the least amount of effort.

Whether the user is a developer, tester, product manager, or operations engineer, the system should stay out of their way and help them complete their task as quickly as possible.

The best experience is one where users spend their time thinking about their applications, not about how to use the system.

---

## Product Vision

Artifact Center aims to become the central hub for software artifacts inside an organization.

Every application should have a single place where people can:

- View the latest version
- Browse version history
- Upload new artifacts
- Download existing artifacts
- Understand release information

Everything revolves around the application itself.

The platform should feel calm, modern, and focused.

It should never feel like a traditional enterprise management system.

---

# 2. Product Positioning

## What Artifact Center is

Artifact Center is an internal software artifact management platform.

It is designed for teams that need to manage build outputs throughout the software lifecycle.

Supported artifact types include:

- Android APK
- Android AAB
- Windows EXE
- ZIP Packages

Future versions may support:

- IPA
- Firmware
- Docker Images
- Other distributable artifacts

The platform focuses on artifact organization, version management, distribution, and traceability.

---

## What Artifact Center is NOT

Artifact Center is not:

- A Dashboard
- A BI Platform
- A CI/CD System
- A Project Management Tool
- An ERP System
- An OA Platform
- A DevOps All-in-One Platform

These responsibilities belong to other systems.

Artifact Center solves only one problem exceptionally well:

> Managing software artifacts.

Anything that does not help users publish, discover, or download artifacts should be questioned before being added.

---

## Design Principle

Whenever a new feature is proposed, ask one question first:

> Does this help users manage software artifacts?

If the answer is no, the feature should probably not exist.

Focus is a product feature.

# 3. Target Users

## Purpose

Define who Artifact Center is designed for.

This document focuses on user responsibilities rather than user personas.

The product should optimize for the work users need to complete, not for demographic profiles.

---

## Primary Users

### Software Developers

Includes:

- Android Developers
- Windows Developers
- Backend Developers
- Embedded Developers

Primary Goals:

- Upload new artifacts
- Verify upload results
- Manage historical versions
- Share download links with others

Typical Workflow:

Develop → Build → Upload → Publish → Share

Success Criteria:

A developer should be able to publish a new artifact within 30 seconds without reading documentation.

---

### QA Engineers

Primary Goals:

- Find the correct version
- Verify version information
- Download artifacts
- Compare different releases

Typical Workflow:

Search → Open Application → Select Version → Download

Success Criteria:

QA engineers should never need to ask developers where an installation package is located.

---

### Product Managers

Primary Goals:

- View release information
- Confirm latest available version
- Access installation packages for demonstrations or verification

Typical Workflow:

Search → Open Application → Download Latest

Success Criteria:

Product managers should obtain the correct package without requiring technical knowledge of the build process.

---

### Operations & Release Engineers

Primary Goals:

- Publish stable releases
- Archive obsolete artifacts
- Control visibility and distribution
- Ensure release traceability

Typical Workflow:

Review → Publish → Share → Archive

Success Criteria:

Every published artifact should have clear ownership, history, and lifecycle status.

---

### Platform Administrators

Primary Goals:

- Manage storage
- Configure permissions
- Monitor system health
- Maintain retention policies

Administrators are responsible for the platform itself, not for individual applications.

Administrative functions should remain isolated from everyday workflows.

---

# 4. Core User Journey

## Purpose

Artifact Center is optimized around user journeys rather than feature lists.

Every interface should help users complete one of the following journeys with the least amount of effort.

---

## Journey 1 — Find an Artifact

This is the most common workflow.

Application List

↓

Search Application

↓

Open Application

↓

Select Version

↓

Download Artifact

The entire process should be intuitive enough that users rarely need guidance.

---

## Journey 2 — Publish an Artifact

Application

↓

Upload Artifact

↓

Verify Metadata

↓

Publish

↓

Share

Uploading is an action initiated from an application.

It is not an independent destination.

---

## Journey 3 — Review Release History

Application

↓

Version History

↓

Compare Releases

↓

Read Release Notes

↓

Download Required Version

Users should always understand which version they are viewing and why it exists.

---

## Journey 4 — Share an Artifact

Application

↓

Latest Version

↓

Generate Download Link

↓

Share

Sharing should require minimal effort while maintaining traceability and access control.

---

## Product Principle

Every page in Artifact Center should directly support at least one core journey.

If a feature cannot be mapped to one of these journeys, its necessity should be questioned before implementation.

# 5. Product Object Model

## Purpose

Define the core objects of Artifact Center.

Every page, interaction, and navigation structure should revolve around these objects.

Actions are not objects.

Statistics are not objects.

Objects represent long-lived entities within the product.

---

## Core Objects

Artifact Center contains only four first-class objects.

Application

↓

Artifact

↓

Release

↓

User

Everything else exists to serve these objects.

---

## Application

Application is the top-level object.

It represents a software product or service.

Examples:

- Mobile Banking
- CRM Desktop
- OTA Manager
- POS Terminal

Every artifact belongs to exactly one application.

An application is the entry point of almost every user journey.

---

## Artifact

Artifact is the core resource managed by the platform.

Examples:

- APK
- AAB
- EXE
- ZIP

Future support:

- IPA
- Firmware
- Docker Image

Artifacts are versioned and immutable.

Once published, an artifact represents a specific build output.

---

## Release

A Release is a meaningful publication of one or more artifacts.

It provides human-readable context.

A Release may contain:

- Version
- Release Notes
- Status
- Distribution Channel

A Release helps users understand why a version exists.

---

## User

Users interact with applications and artifacts.

Users do not define product structure.

Instead, permissions determine what users can view or modify.

---

## Relationships

Application

└── Artifact

        └── Release

User

└── Upload

└── Download

└── Publish

└── Archive

Users perform actions.

Applications own artifacts.

Artifacts belong to releases.

---

## Product Rule

Every new feature should belong to an existing object.

If a feature cannot be associated with an object,

it probably does not belong in Artifact Center.

# 6. Navigation Principles

## Purpose

Navigation should represent product objects.

Navigation should never represent actions.

---

## Object Navigation

Good

Applications

Settings

Bad

Upload

Download

Release

Dashboard

Statistics

Logs

Reports

---

## Why?

Users think in terms of applications.

They do not think in terms of upload pages.

For example:

Correct:

"I need to upload a new version of Mobile Banking."

Incorrect:

"I need to enter the Upload module."

Upload is an action.

Application is the object.

---

## Primary Navigation

Applications

Settings

Development Environment (optional)

Foundation

Design System

Layout

Playground

---

## Secondary Navigation

Tabs inside Application Detail.

Overview

Artifacts

Release Notes

Settings

Secondary navigation should always belong to a parent object.

---

## Navigation Rule

Every page should answer one question:

"What object am I currently looking at?"

If the answer is unclear,

the navigation is probably wrong.

## Agent skills

### Issue tracker

本仓库使用 GitHub Issues 跟踪需求、规格和工程任务。见 `docs/agents/issue-tracker.md`。

### Domain docs

本仓库使用单上下文领域文档：根目录 `CONTEXT.md` + `docs/adr/`。见 `docs/agents/domain.md`。
