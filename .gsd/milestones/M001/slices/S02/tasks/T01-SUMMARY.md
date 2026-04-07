---
id: T01
parent: S02
milestone: M001
provides: []
requires: []
affects: []
key_files:
  - src/HomeworkHelper.jsx
key_decisions:
  - D008
  - D009
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 
verification_result: passed
completed_at: 2026-04-07
blocker_discovered: false
---
# T01: Rebuild HomeworkHelper teaching engine with detail mode, step-by-step toggle, frustration detection, and fun-facts prompt

## What Happened

Rewrote the HomeworkHelper teaching logic to support four distinct modes that interact with the Groq system prompt and API parameters: detail mode (HW-01), step-by-step toggle (HW-02), frustration detection (HW-03), and Fun Facts mode (HW-05). The App.jsx prop fix from D009 was already landed in commit `3b58416` before this session — only the HomeworkHelper-side rebuild remained.

## What Was Built

### `buildSystemPrompt` rewritten as mode-aware

New signature: `buildSystemPrompt(name, age, subject, modes)` where `modes = { detailMode, stepByStep, socraticAttempts }`. The function now branches into three top-level paths instead of one:

- **Fun Facts branch** (`subject === "funfacts"`) — dedicated celebration prompt. Never says "almost", "try again", "wrong", "incorrect", or "not quite". Celebrates any input, shares a related fun fact, asks an open-ended follow-up. No Socratic scaffolding.
- **Frustration switch branch** (`socraticAttempts >= 2`) — drops Socratic guidance entirely and explains the concept directly with a worked example, then asks if the student wants another problem to try.
- **Standard branch** — modulated by `detailMode` (brief vs comprehensive) and `stepByStep` (scaffolded vs direct). Includes the math verification prompt for math subjects and the SAFETY redirect for off-topic input. The hard "Keep responses under 100 words" cap is gone.

### State additions

- `const [detailMode, setDetailMode] = useState(false)` — HW-01
- `const [stepByStep, setStepByStep] = useState(true)` — HW-02 (default ON, hydrated from kid prefs)
- `const socraticAttemptsRef = useRef(0)` — HW-03 per D008 (ref, not state, since the counter is read inside `doAICall` and never drives a render)
- `useEffect` that loads `stepByStep` from `kidsData?.[selectedKid]?.hwPrefs?.stepByStep` when the selected kid changes (defaults to `true` unless explicitly `false`)

### `doAICall` updated for mode-aware execution

- `maxTokens` is now `detailMode ? 1500 : 300`
- The mode options object is passed to `buildSystemPrompt`
- After each assistant reply, frustration tracking runs **only when subject !== "funfacts"**:
  - `shouldCelebrate(reply, age)` → reset `socraticAttemptsRef.current = 0`
  - `/almost|try again|let'?s try|not quite/i` match → increment `socraticAttemptsRef.current`

### Toggle UI in the header

Two new toggle buttons live in the header next to the existing mute button (wrapped in a flex group that appears when `selectedKid` is truthy):
- **Brief / Detailed** — toggles `detailMode`. No persistence (session-scoped).
- **Steps / Direct** — toggles `stepByStep` AND persists to `kidsData/{kidName}/hwPrefs/stepByStep` via `fbSet`.

Both buttons reuse the existing `muteBtn` style with conditional `V.accent` background when active and `V.bgCardAlt` when inactive. Each is 44×44 minimum tap target with `aria-pressed`. Text labels (📝 Brief / 📖 Detailed / 🪜 Steps / ➡️ Direct) are visible — colorblind safe per Alex's constraint.

### Old one-shot button removed

The legacy `function handleStepByStep()` (which one-shot-sent "Can you show me step by step?") and the conditional button render that triggered it are both gone. The persistent `stepByStep` toggle replaces them.

### Frustration counter resets at all context-change points

Added `socraticAttemptsRef.current = 0` to:
- `switchSubject()` — kid changes subject
- `resetSession()` — brain-break reset
- The kid select `onChange` handler — kid switches profiles

## Commits

| Hash | Description |
|------|-------------|
| `e1e994f` | feat(homework): add detail/step/frustration teaching modes + funfacts |

## Verification Results

All 9 grep checks from T01-PLAN.md pass:

| Check | Need | Got |
|---|---|---|
| `detailMode` count | ≥3 | 14 |
| `stepByStep` count | ≥3 | 16 |
| `socraticAttempts` count | ≥3 | 9 |
| `funfacts` present | ≥1 | 4 |
| `hwPrefs` present | ≥1 | 3 |
| `handleStepByStep` count | 0 | 0 |
| `100 words` count (old cap) | 0 | 0 |
| `kidsData?.homeworkSessions` (broken path) | 0 | 0 |
| App.jsx homeworkSessions prop | ≥1 | 1 |

`npm run build` passes — `✓ built in 2.33s`. The 852 KB chunk-size warning is preexisting (already on the roadmap for code-splitting, out of scope).

## Deviations from Plan

**None.** Plan executed step-by-step in the order specified:

1. Step 1 (App.jsx prop) was already done in `3b58416` before this session — verified, no action needed.
2. Steps 2–7 executed in this order: prompt rewrite → state additions → doAICall update → toggle UI → handleStepByStep deletion → resets at all context-change points.

## Execution Context

This task was executed **outside the gsd2 dispatcher** because gsd2 (gsd-pi v2.64.0) auto-mode and `/gsd dispatch execute` and `/gsd next` all hit the per-model 30k input tokens/min Anthropic rate-limit ceiling on `claude-sonnet-4-6` when loading the slice context. Alex authorized a manual Path B bypass: edits made directly from the Claude Code session, atomic commits with the gsd2-style format preserved, and audit trail re-synced via this summary file. See `.gsd/STATE.md` and the `feedback_gsd_command_verification.md` memory entry for context.

## Known Stubs

None. All four teaching modes are wired end-to-end into the prompt engine and tested via grep + build. Real-runtime UAT (Yana and Luca actually using it) is implicit — they'll exercise it on next homework session.

## Next Tasks That Depend On This

- **T02** (past sessions UX) — uses the same `socraticAttemptsRef` and `homeworkSessions` prop introduced here.

## Self-Check: PASSED

Files modified:
- `src/HomeworkHelper.jsx` — FOUND (modified, +139 / -33 lines)

Commits exist:
- `e1e994f` — FOUND
