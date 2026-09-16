---
name: "playwright-test-targeting"
description: "Use exact, normalized Playwright test titles when debugging one failing scenario."
domain: "testing"
confidence: "high"
source: "team lesson from repeated DB Viewer Playwright regressions"
---

## Context

When a single Playwright scenario is failing, the goal is to isolate one exact test and run it by a unique title match. Do not use broad entity names or loose keywords during the debugging loop. The reporter UI may render nested titles with separators like `>>` or `›`, but the real grep input must use the normalized title with spaces between sections.

## Required Pattern

- Start with one exact failing test title only
- Match the full scenario title, not just the entity name
- Use plain spaces between title sections
- Avoid broad filters like `Job Posting`, `AI Prompt`, or `DB Viewer` while debugging a single regression
- After the targeted fix passes, widen the grep only intentionally

## Examples

✓ Correct:

- `--grep "Feature: DB Viewer Scenario Outline: Referenced records show incoming references in the Referenced By section Entity: Job Posting"`
- `--grep "Referenced records show incoming references in the Referenced By section Entity: Job Posting"`

✗ Incorrect:

- `--grep "Entity: Job Posting"`
- `--grep "DB Viewer"`
- `--grep "Scenario Outline: Referenced records show incoming references in the Referenced By section >> Entity: Job Posting"`
- `--grep "Scenario Outline: Referenced records show incoming references in the Referenced By section › Entity: Job Posting"`

## Why this matters

The reporter separators are display-only. They do not reflect the actual matching pattern Playwright uses for `--grep`. A broad or incorrectly formatted grep either matches too much or matches nothing, which increases noise and slows down bug fixing.

## Working rule

When debugging one failing test, use a single exact grep that uniquely identifies that scenario title and nothing else. Only broaden once the exact fix is verified.
