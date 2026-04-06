---
phase: 01-foundation
plan: 01
subsystem: utils
tags: [tts, speech-synthesis, role-based-access, firebase, security]
dependency_graph:
  requires: []
  provides: [speakText, getVoicesReady, canWrite]
  affects: [src/HomeworkHelper.jsx, src/LucacLegends.jsx, src/App.jsx]
tech_stack:
  added: []
  patterns: [cancel-before-speak TTS pattern, role-based path guard, own-subtree enforcement]
key_files:
  created: []
  modified:
    - src/utils.js
decisions:
  - "guest role returns false via fallback path (no explicit if-block needed)"
  - "voicePreference param reserved as no-op slot per D-13 for future voice picker"
  - "family type maps to parent role matching App.jsx isParent check"
metrics:
  duration: "~2 minutes"
  completed: "2026-04-06"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 1
requirements_addressed: [FOUND-04, FOUND-06, SEC-01]
---

# Phase 1 Plan 01: Utils Foundation — speakText and canWrite

## One-liner

Shared TTS helper with natural voice selection and cancel-before-speak, plus role-based Firebase write guard with kid own-subtree enforcement.

## What Was Built

Two new exported functions added to `src/utils.js`, extending the existing 9 exports to 11 total:

### speakText (FOUND-06 / CLEAN-02)

```javascript
export function speakText(text, { voicePreference = null, onStop = null } = {})
```

- Calls `window.speechSynthesis.cancel()` before every `speak()` — prevents the repeat speech bug observed in HomeworkHelper and LucacLegends
- Selects the most natural-sounding English voice: prioritizes `localService` voices matching known natural names (Samantha, Karen, Daniel, Moira, Tessa, Rishi, Google), falls back to any local English voice, then any English voice
- Returns `() => window.speechSynthesis.cancel()` as a stop handle — callers store this and invoke it for stop buttons
- Returns `null` if `window.speechSynthesis` is undefined (browser unsupported, safe to ignore)
- `voicePreference` param is a reserved no-op slot per D-13 for the future voice picker

### getVoicesReady (FOUND-06)

```javascript
export function getVoicesReady()
```

- Preloads the voice list at app mount — Android Chrome returns `[]` on the first synchronous `getVoices()` call, requiring an `onvoiceschanged` hook to populate the cache

### canWrite (FOUND-04 / SEC-01)

```javascript
export function canWrite(profile, path)
```

- Admin bypasses all checks (returns `true` immediately)
- Path parsing extracts top-level segment: `"kidsData/Luca/points"` → `"kidsData"`
- `ADMIN_ONLY_PATHS`: profiles, contacts, alertMinutes, themeName, widgetPrefs, custodyPattern, custodyOverrides, callButtons, quoteMode, customQuotePrompt, themeOverrides, calendarSize, spotlightResponse
- `PARENT_WRITE_PATHS`: events, eventStyles, custodySchedule, ruleProposals, jrHistory, shoppingList, budgetData, foodLog, myFoods, nutritionGoals, trackedMacros, weightLog, myRules, theirRules, sharedRules, exchangeLog, routines, routineStyles, goals, goalStyles, chores
- `KID_WRITE_PATHS`: kidsData, homeworkSessions, jrHistory
- Kid own-subtree: `kidsData/Luca/...` allowed for Luca but blocks `kidsData/Yana/...`
- Same logic for `homeworkSessions` and `jrHistory`
- Guest role returns `false` (falls through all role checks to final `return false`)

## Commits

| Hash | Description |
|------|-------------|
| `08cfd8f` | feat(01-01): add speakText TTS helper to utils.js |
| `288a3f1` | feat(01-01): add canWrite role-based write guard to utils.js |

## Verification Results

- `npm run build`: PASS (no errors, pre-existing 500KB chunk warning is out of scope)
- All 9 existing exports intact: groqFetch, isRateLimited, setRateLimited, parseGroqJSON, cacheGet, cacheSet, SWATCH_COLORS, triggerConfetti, createSpeechRecognition
- 3 new exports added: speakText, getVoicesReady, canWrite
- No new npm packages added (package.json unchanged, 6 deps total)
- File is valid JavaScript

## Deviations from Plan

None — plan executed exactly as written.

The automated verification check for `role === "guest"` appeared to fail but the behavior is correct: the guest role is the ternary fallback (`... : "guest"`) and returns false via the final unconditional `return false` after all role-specific blocks. This is functionally equivalent to an explicit `if (role === "guest") return false` check and is cleaner code.

## Known Stubs

None — both functions are complete implementations ready for integration.

## Next Plans That Depend on This

- **Plan 02** (fbSet integration): `canWrite` gets called inside `fbSet` before every Firebase `set()` call
- **Plan 03** (HomeworkHelper): Replace local `speakText` with shared `speakText` from utils.js
- **Plan 04** (LucacLegends): Replace local `speakText` with shared `speakText` from utils.js; call `getVoicesReady()` at app mount

## Self-Check: PASSED

Files exist:
- `src/utils.js` — FOUND (modified, 292 lines)
- `.planning/phases/01-foundation/01-01-SUMMARY.md` — this file

Commits exist:
- `08cfd8f` — FOUND
- `288a3f1` — FOUND
