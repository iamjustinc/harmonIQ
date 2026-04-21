# harmonIQ

**Agentic Data Harmonization Studio**

harmonIQ is a web-based AI-assisted workspace that helps operations teams turn messy CRM and customer data into business-ready records through profiling, natural-language transformation suggestions, and visual human-in-the-loop review.

## Overview

Business teams rely on clean customer and account data to power reporting, routing, segmentation, forecasting, planning, and activation. In reality, operational datasets are often full of duplicate records, inconsistent formatting, missing ownership fields, invalid contact information, and schema mismatches.

harmonIQ is designed to make that cleanup process faster, clearer, and more trustworthy.

Instead of forcing non-technical users to clean data manually in spreadsheets or wait on technical teams, harmonIQ provides a guided workflow:

- upload a messy CSV
- profile the dataset
- detect the highest-impact issues
- generate AI-assisted cleanup suggestions
- let users review, approve, reject, or edit changes
- show before-and-after readiness improvements
- export a cleaned dataset and transformation log

## Problem

Operational teams often face messy CRM-style data before important workflows like:

- quarterly reporting
- lead routing updates
- campaign launches
- account planning
- segmentation
- forecasting

But current cleanup options are weak:

- manual spreadsheet cleanup is slow and error-prone
- technical tools are often inaccessible to non-technical users
- black-box automation is difficult to trust for business-critical data
- downstream teams lose time waiting for clean data before they can act

harmonIQ solves this by combining AI speed with explainability, review controls, and business-facing workflow design.

## Core Value Proposition

harmonIQ helps users move from messy records to business-ready data with a workflow that is:

- **AI-assisted**, not fully opaque
- **business-first**, not tool-first
- **reviewable**, with visible rationale and change previews
- **trustworthy**, through human approval for important transformations
- **outcome-oriented**, focused on downstream readiness

## Who It’s For

### Primary users
- Revenue Operations
- Sales Operations
- Business Operations

### Secondary users
- Business systems analysts
- Data analysts
- Customer operations managers

## Key Features

- CSV upload and dataset parsing
- profiling summary after upload
- issue detection across common CRM data problems
- prioritization by business impact, not just frequency
- AI-generated transformation suggestions in plain English
- confidence, rationale, and preview for each suggested change
- visual review workspace for accepting, rejecting, or editing changes
- before-and-after readiness reporting
- cleaned dataset export
- transformation log / “what changed” summary

## V1 Issue Types Supported

harmonIQ focuses on common CRM-style issues such as:

- null or missing values
- duplicate account names
- duplicate contacts by email or domain similarity
- inconsistent state and country formatting
- phone formatting inconsistencies
- improper capitalization
- full-name field splitting
- missing owner or segment values
- schema mismatches or unexpected column names

## Product Principles

harmonIQ is built around a few core principles:

### 1. Business-first, not tool-first
Users should understand why an issue matters to reporting, routing, segmentation, or planning — not just what is technically wrong.

### 2. AI as copilot, not black box
The system suggests and explains changes, but the user remains in control of business-critical decisions.

### 3. Trust through visibility
Every meaningful transformation should be inspectable before approval.

### 4. Time-to-value in minutes
The workflow should feel fast, guided, and outcome-oriented.

### 5. Progress over perfection
The product helps users resolve the highest-value issues first instead of overwhelming them with every possible cleanup rule.

## Product Flow

harmonIQ V1 is designed around a focused 4-screen workflow:

### 1. Upload
- drag-and-drop CSV upload
- sample dataset option
- parsed file summary
- confirmation of detected columns
- preview of supported issue types

### 2. Profile Overview
- data readiness score
- issue count by category
- top issues by business risk
- dataset summary
- business-readiness explanation

### 3. Suggestion Review Workspace
- issue categories and recommendation queue
- row-level or field-level change preview
- rationale, confidence, business impact, and approval controls

### 4. Results
- before-and-after comparison
- issue reduction summary
- readiness score improvement
- cleaned dataset preview
- export actions
- transformation log

## How It Works

harmonIQ combines deterministic logic with AI assistance.

### Deterministic logic handles:
- null detection
- format validation
- duplicate heuristics
- scoring
- change previews
- readiness calculations

### AI handles:
- summarizing issue clusters
- recommending transformations
- explaining rationale in business language
- interpreting simple natural-language cleanup commands

This split is intentional: AI is used where interpretation helps, and deterministic logic is used where consistency matters.

## Example Use Case

A Revenue Operations manager receives a CRM export before a campaign launch or planning cycle. The dataset contains duplicate accounts, inconsistent state values, blank ownership fields, invalid emails, and missing segmentation data.

With harmonIQ, they can:

1. upload the dataset
2. identify the highest-risk issues quickly
3. review suggested fixes in plain English
4. approve or edit changes visually
5. export a cleaner, more trustworthy dataset
6. share a clear summary of what changed and why

## Why This Project Matters

harmonIQ is more than a data-cleaning utility. It is a **business-readiness workflow**.

It demonstrates:
- AI-native product thinking
- human-in-the-loop workflow design
- enterprise UX judgment
- explainability and trust design
- strong PM and Solutions Engineering storytelling
- clear translation of technical complexity into business value

## Tech Stack

- **Next.js**
- **TypeScript**
- **Tailwind CSS**

Planned architecture includes:
- CSV parsing and lightweight processing
- issue detection and profiling logic
- structured AI recommendation outputs
- transformation state tracking
- before-and-after readiness reporting
- exportable action logs

## MVP Scope

V1 is intentionally narrow and focused on one compelling workflow:

**AI-assisted profiling and harmonization of messy CRM-style operational data**

It does not aim to:
- replace a full ETL platform
- integrate with live Salesforce or production CRMs
- support large-scale scheduled pipelines
- apply high-risk changes without review
- solve long-term master data management

## Success Metrics

Example metrics for harmonIQ include:

- time from upload to first actionable recommendation
- percentage of high-priority issues surfaced first
- suggestion review and approval rate
- reduction in issue count after harmonization
- readiness score improvement
- reduction in manual cleanup effort

## Positioning

harmonIQ can be described as:

- an AI-assisted data product
- a business-readiness workflow
- a human-in-the-loop harmonization system
- a live, demoable enterprise prototype
