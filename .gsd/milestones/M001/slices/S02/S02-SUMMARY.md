---
id: S02
parent: M001
milestone: M001
provides: []
requires:
  - S01
affects: []
key_files:
  - src/HomeworkHelper.jsx
  - src/App.jsx
key_decisions:
  - D007
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
# S02: Kids Homework

## What Happened

Rebuilt the HomeworkHelper teaching modes and past-sessions UX so Yana and Luca actually get the help they need. Two atomic task commits (T01 + T02) landed on `main`, both verified by grep checks and `npm run build`. The slice's five must-haves (HW-01 through HW-05) and the App.jsx prop wiring are all in place.

Total diff: `src/HomeworkHelper.jsx` +216 / -52 lines across two commits. No other files touched in this slice (App.jsx prop wiring landed in `3b58416` before this session as an emergency fix).

## What Was Built

### HW-01: Detail mode toggle (T01)

A `📝 Brief / 📖 Detailed` toggle in the HomeworkHelper header. When OFF (default), responses are concise with `maxTokens: 300`. When ON, the system prompt asks for thorough structured explanations and `maxTokens` jumps to 1500. The hard "Keep responses under 100 words" cap that used to live in `buildSystemPrompt` is gone.

### HW-02: Step-by-step toggle, persisted per-kid (T01)

A `🪜 Steps / ➡️ Direct` toggle. State default is `true` (most kids learn better with scaffolding). On change, persists to Firebase at `kidsData/{kidName}/hwPrefs/stepByStep` so each kid's preference survives reloads. A `useEffect` loads the persisted preference when the kid selection changes — defaults to `true` unless explicitly set to `false`.

### HW-03: Frustration detection with auto-switch to direct explanation (T01)

`socraticAttemptsRef` (a `useRef` per D008 — never drives a render) counts inverse-celebrate phrases (`/almost|try again|let'?s try|not quite/i`) in the AI's responses. After **2** failed Socratic attempts, `buildSystemPrompt` returns a different prompt entirely: "Stop guiding with questions — explain the concept DIRECTLY with a clear worked example." Counter resets on celebration AND on subject change, kid change, and brain-break reset.

### HW-04: Tappable past sessions with Resume + 50-session auto-prune (T02)

Past session rows are now native `<button>` elements (so keyboard activation works for free) with a visible **▶ Resume** label in `V.accent`. Tapping a session loads its messages into the current chat, generates a new sessionId, resets the frustration counter, and closes the panel. The original Firebase record stays immutable. A separate `useEffect` watches `homeworkSessions` and auto-prunes the oldest sessions (sorted by `updatedAt`) when a kid's count exceeds 50.

### HW-05: Fun Facts mode — celebration prompt (T01)

When `subject === "funfacts"`, `buildSystemPrompt` returns a completely different prompt: "When {name} shares a thought, idea, or guess: celebrate it enthusiastically. Then share a related amazing fun fact. Then ask an open-ended follow-up question. NEVER say 'almost', 'try again', 'not quite', 'wrong', or 'incorrect'. There are no wrong answers in fun facts mode — only curiosity." Frustration tracking is disabled for funfacts subject because there's no Socratic scaffolding to fail at.

### homeworkSessions prop wiring (already done pre-session)

App.jsx line 1321 passes `homeworkSessions={homeworkSessions}` to HomeworkHelper. This was a one-line emergency fix in commit `3b58416` (per D009). HomeworkHelper now reads past sessions from this prop instead of `kidsData?.homeworkSessions` (which was always undefined — the bug captured in CLAUDE.md's 2026-04-07 lessons learned entry).

### Old `handleStepByStep` removed (T01)

The legacy one-shot "📝 Show me step by step" button (which sent a literal "Can you show me step by step?" message) and its handler function are both gone. The persistent `stepByStep` toggle in the header replaces it.

## Commits

| Hash | Description |
|------|-------------|
| `e1e994f` | feat(homework): add detail/step/frustration teaching modes + funfacts (T01) |
| `4a83cc8` | feat(homework): tappable past sessions with Resume + 50-session auto-prune (T02) |

(Commit `3b58416 fix(homework): wire homeworkSessions prop to HomeworkHelper` from earlier in the session is the prerequisite that made the rest of the slice possible — see D009.)

## Verification Results

All 16 grep checks across both task plans passed. `npm run build` clean on both commits (✓ built in 2.33s and 2.35s).

| Plan | Checks | Status |
|---|---|---|
| T01-PLAN.md | 9 grep checks | All pass |
| T02-PLAN.md | 7 grep checks | All pass |
| Build | npm run build | Clean (preexisting 852KB chunk warning out of scope) |

## Deviations from Plan

**T01:** None. Plan executed exactly as written, in order.

**T02:** Pruning was implemented as a **separate `useEffect`** that watches `homeworkSessions`, instead of inlined into the existing save useEffect as the plan specified. The plan's approach would have read a stale closure of `homeworkSessions` and miscounted the just-written session. The separate-effect pattern self-stabilizes after pruning, has no closure issues, and also auto-prunes pre-existing overflow on app load. Same end-state, cleaner mechanics. Documented in T02-SUMMARY.md and the T02 commit message body.

## Execution Context — Manual Path B Bypass

This slice was executed **outside the gsd2 dispatcher**.

gsd2 (gsd-pi v2.64.0) auto-mode and `/gsd dispatch execute` and `/gsd next` all hit the per-model 30,000 input tokens/min Anthropic rate-limit ceiling on `claude-sonnet-4-6` when loading the slice context for dispatch. The killer payload appears to be `M001-RESEARCH.md` (≈94 KB / ~25k tokens) being reloaded on every dispatch attempt. Three different gsd2 entry points were tried:

| Command | Result |
|---|---|
| `/gsd auto` | 429 sonnet-4-6 (auto-mode planning loop) |
| `/gsd dispatch execute` | "Cannot dispatch execute-task: no active task" — DB/markdown desync from prior crash |
| `/gsd next` | 429 sonnet-4-6 (same dispatch path as auto) |

After Alex authorized a manual bypass, T01 and T02 were executed directly from the Claude Code Opus 4.6 (1M context) session. Atomic commits preserved the gsd2-style format. Verifications were run from the plan files. This summary file (and the per-task summaries) was written manually so the audit trail looks gsd-native rather than empty.

The relevant memory note for future instances is `feedback_gsd_command_verification.md` — always verify gsd command names against `gsd-pi/src/resources/extensions/gsd/commands/catalog.ts` before invoking. The Claude Code skill list still shows gsd1 names like `gsd-execute-phase` that don't exist in gsd2.

## Known Stubs

- **No real-runtime UAT yet.** Yana and Luca haven't actually used the new modes yet. The grep + build verification proves structural correctness; the kids using it will prove functional correctness. Recommend Alex try the four toggle combinations + one funfacts session + one past-session resume after deploy.
- **stepByStep and detailMode persistence asymmetry.** `stepByStep` persists per-kid via `hwPrefs/stepByStep`. `detailMode` is session-scoped (resets to `false` on remount). This was the plan's choice — detail mode is more situational ("explain this hard one in depth"), step-by-step is more of a learning style preference. Can revisit if Alex wants both persistent.

## Next Slices That Depend On This

- **S03 (Danyells & AI)** — independent; depends only on S01.
- **S04 (Game Upgrades)** — independent; depends only on S01.
- **S05 (Nutrition, Budget & AI Fallback)** — independent; depends only on S01.
- **S06 (Education & Integrations)** — depends on S04.

S02 doesn't gate any other slice. The slice DAG branches out from S01 and S02 is one of the leaves.

## Self-Check: PASSED

Files modified:
- `src/HomeworkHelper.jsx` — FOUND (modified across two commits, +216 / -52 lines net)
- `src/App.jsx` — FOUND (already had the prop wired before this session via `3b58416`)

Plan files:
- `.gsd/milestones/M001/slices/S02/S02-PLAN.md` — FOUND
- `.gsd/milestones/M001/slices/S02/tasks/T01-PLAN.md` — FOUND
- `.gsd/milestones/M001/slices/S02/tasks/T02-PLAN.md` — FOUND

Summary files:
- `.gsd/milestones/M001/slices/S02/tasks/T01-SUMMARY.md` — FOUND
- `.gsd/milestones/M001/slices/S02/tasks/T02-SUMMARY.md` — FOUND
- `.gsd/milestones/M001/slices/S02/S02-SUMMARY.md` — this file

Commits exist:
- `e1e994f` — FOUND (T01)
- `4a83cc8` — FOUND (T02)
