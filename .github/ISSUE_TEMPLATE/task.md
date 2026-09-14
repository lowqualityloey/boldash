---
name: Task
about: Unit of Boldash work with acceptance criteria and a verification seam
title: "<type>(<scope>): <imperative summary>"
labels: ""
---

## Context
<!-- What problem this solves. Link ARCHITECTURE.md section / roadmap phase (v0.1.0–v0.4.0+). -->

## Scope
- **Files / modules:**
- **CLI surface touched** (`boldash <cmd>`, exit codes, JSON shape, schemas): none / listed below
- **Out of scope:**

## Acceptance Criteria
- [ ] Given … When … Then …
- [ ] Given … When … Then …

## Verification
<!-- How a reviewer PROVES this works: exact command, expected output/exit code. No prose-only "it should work". -->

```bash
# expected: exit 0/1 + key output lines
```

## Principles Check
- [ ] Trivial-work path stays ceremony-free (P5)
- [ ] Any new check is code with an exit code, not a prompt (P3, P4)
- [ ] Failure modes from PROJECT OVERVIEW §"Failure Modes We Are Watching" considered
