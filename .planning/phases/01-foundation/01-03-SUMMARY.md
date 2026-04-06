---
phase: 01-foundation
plan: "03"
subsystem: ai-assistant
tags: [role-based-access, tool-filtering, tts-dedup, groq-assistant, homework-helper]
dependency_graph:
  requires: [01-01]
  provides: [AI-02, CLEAN-02]
  affects: [src/aiAgent.js, src/GroqAssistant.jsx, src/HomeworkHelper.jsx]
tech_stack:
  added: []
  patterns: [ROLE_TOOLS-allowlist, filteredTools-pattern, UI-SPEC-badge]
key_files:
  created: []
  modified:
    - src/aiAgent.js
    - src/GroqAssistant.jsx
    - src/HomeworkHelper.jsx
decisions:
  - "ROLE_TOOLS uses null for admin (all tools) and explicit arrays for parent/kid/guest — D-19/D-20"
  - "filteredTools derived pre-loop in runAgentLoop so filtering happens once per call, not per iteration"
  - "Role badge replaced existing plain-text role label with UI-SPEC-compliant badge (Full access/Family access/Kid mode)"
  - "HomeworkHelper speakText import is backward-compatible — old calls speakText(text) still work with new utils.js signature"
metrics:
  duration: "12 minutes"
  completed_date: "2026-04-05"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Phase 1 Plan 03: AI Role-Based Tool Access and TTS Dedup Summary

**One-liner:** Role-filtered Groq tool access via ROLE_TOOLS allowlists (admin=all, parent=12 tools, kid=4 safe tools, guest=none), UI-SPEC role indicator badge, and HomeworkHelper local speakText replaced with shared utils.js version.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add ROLE_TOOLS map and per-role tool filtering to aiAgent.js | c98a901 | src/aiAgent.js |
| 2 | Role indicator badge in GroqAssistant, speakText dedup in HomeworkHelper | 0fa67cb | src/GroqAssistant.jsx, src/HomeworkHelper.jsx |

## What Was Built

### aiAgent.js — ROLE_TOOLS Map and Tool Filtering

Added `ROLE_TOOLS` constant after `WRITE_ACTIONS`:

- `admin: null` — null means all tools, no filtering
- `parent: [12 tools]` — calendar read/write, budget, shopping, food, emotional support, search, daily briefing
- `kid: [4 tools]` — emotional_support, get_kids_status, ask_clarification, web_search
- `guest: []` — empty array, no tools at all

In `runAgentLoop`, before the iteration loop, derives `filteredTools` from `ROLE_TOOLS[appState.userRole]` and passes it to `callGroqWithRetry` instead of the full `TOOLS` array. Kids literally never receive write tool definitions in the API call — Groq cannot call what it cannot see.

Updated `buildSystemPrompt` to append a `## Your Access Level` section explaining the current role's capabilities in plain language, so Groq understands its tool context before making calls.

### GroqAssistant.jsx — UI-SPEC Role Indicator Badge

Replaced the existing plain-text role label (which showed "Admin"/"Kid"/"Parent"/"Guest" with color-only differentiation) with the UI-SPEC-compliant badge:

- Admin: crown emoji + "Full access"
- Parent/family: family emoji + "Family access"
- Kid: child emoji + "Kid mode"
- Guest: eye emoji + "View only"

Styling matches UI-SPEC: `fontSize: 11`, `fontWeight: 700`, `color: V.textDim`, `background: V.bgElevated`, `border: 1px solid V.borderSubtle`, `borderRadius: 10`.

The `starterPrompts` variable (already using `STARTER_PROMPTS_KID` for kid role) and empty-state role-aware text were already correctly implemented — no changes needed.

The `buildAppState()` function already included `userRole: currentProfile?.type || "guest"` — confirmed passing to `runAgentLoop`.

### HomeworkHelper.jsx — speakText Dedup (D-11)

- Added `speakText` to the existing import from `"./utils"`: `import { groqFetch, createSpeechRecognition, triggerConfetti, speakText } from "./utils"`
- Removed the 8-line local `speakText(text)` function definition
- All call sites remain unchanged — the utils.js signature `speakText(text, { voicePreference, onStop } = {})` is backward-compatible with `speakText(text)` calls

## Verification

- `npm run build` passes (chunk size warning is pre-existing, not caused by these changes)
- All 15 automated checks pass including: ROLE_TOOLS structure, filteredTools usage, badge labels, speakText import/removal

## Deviations from Plan

None — plan executed exactly as written.

The GroqAssistant already had most of Task 2's requirements in place (role-aware starter prompts, userRole in appState). The role badge was the only GroqAssistant change needed beyond what already existed.

## Known Stubs

None. All role filtering is wired end-to-end: `appState.userRole` flows from `currentProfile.type` → `buildAppState()` → `runAgentLoop` → `ROLE_TOOLS[userRole]` → `filteredTools` → Groq API call.

## Self-Check: PASSED

Files exist:
- src/aiAgent.js — FOUND
- src/GroqAssistant.jsx — FOUND
- src/HomeworkHelper.jsx — FOUND

Commits exist:
- c98a901 — FOUND (feat(01-03): add ROLE_TOOLS map...)
- 0fa67cb — FOUND (feat(01-03): role indicator badge...)
