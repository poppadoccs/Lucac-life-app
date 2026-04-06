# Phase 2: Kids & Homework - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 02-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 02-kids-homework
**Areas discussed:** Homework Helper teaching modes, Past Sessions UX, Kids' home content & data model, Calendar views + Avatar drawing, Kid layout style, Past-session resume behavior

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Homework Helper teaching modes | HW-01, HW-02, HW-03, HW-05 — current 100-word cap, no toggle, always Socratic | ✓ |
| Past Sessions UX (HW-04) | Currently shows metadata only, no click-to-open | ✓ |
| Kids' home content & data model | KIDS-01/02/03 — kid home is bare; routines/goals are global, not per-profile | ✓ |
| Calendar views + Avatar drawing | CAL-01 add 3W view, KIDS-04 build canvas drawing | ✓ |

**User's choice:** All four areas selected, with extensive inline notes pre-filling most decisions.

**User notes (verbatim):**
> 1. Homework: kill 100-word cap, add mode switching (Socratic default but switches to direct after 2 wrong answers), Fun Facts never forces one answer, step-by-step toggle ON by default
> 2. Past Sessions: open-in-place, full replay, auto-prune 50 per kid
> 3. Kids data: profile namespace (profiles/{kidId}/routines), family event = not private + created by admin or tagged shared
> 4. Avatar stays Phase 2 with game split, 3-week calendar is simple add

---

## Data Model (canWrite reconciliation)

| Option | Description | Selected |
|--------|-------------|----------|
| Move to kidsData subtree | Store at `kidsData/{name}/routines` and `kidsData/{name}/goals`. Phase 1 already allows kid writes there. | |
| Carve exception in canWrite | Keep `profiles/{kidId}/routines` and add a path-prefix exception. Slightly leakier security. | |
| Hybrid | Definitions in `profiles/{kidId}/routines` (admin-defined), completion state in `kidsData/{name}/routineState/{date}` (kid-writable). | ✓ |

**User's choice:** Hybrid
**Notes:** Cleanest separation of admin-config vs kid-data. Reconciles the user's "profile namespace" preference from the inline notes with Phase 1's canWrite security model — admin owns the definitions, kid owns the completion state.

---

## Wrong-Answer Detection

| Option | Description | Selected |
|--------|-------------|----------|
| Inverse-celebrate heuristic | Reuse `shouldCelebrate()` — last 2 non-celebratory replies with "almost / try again" phrasing = frustration cycle. Zero new infrastructure. | ✓ |
| Parse JSON tag from AI | `[STATUS:correct\|partial\|wrong]` prepended to AI replies, parsed and stripped. More accurate but adds parsing surface. | |
| User-tap escalation | Add an "I'm stuck" button. Loses auto-switch promise but dead simple. | |

**User's choice:** Inverse-celebrate heuristic
**Notes:** Piggybacks on existing helper. Implementation is a 5-line counter that resets on celebration or subject/kid change.

---

## Avatar UX

| Option | Description | Selected |
|--------|-------------|----------|
| Admin draws for each kid | Drawing UI in admin profile editor. Matches Phase 4 SC #5 phrasing ("Alex can draw"). | |
| Kids draw their own | Drawing UI in kid 'My Stuff' tab. Kid writes to their own kidsData subtree. | ✓ |
| Both | Drawing UI in both places. Doubles UI surface. | |

**User's choice:** Kids draw their own
**Notes:** Empowers kids, matches the kid-experience-first core value, and keeps the new component's footprint contained inside the existing kid tab branch in App.jsx.

---

## Detail-Mode Token Cap

| Option | Description | Selected |
|--------|-------------|----------|
| 1500 tokens (~1100 words) | Comfortably exceeds 500-word floor with headroom. | ✓ |
| 1000 tokens (~750 words) | Tight buffer over 500-word floor. | |
| 2500 tokens (~1900 words) | Very generous, room for full lessons. | |

**User's choice:** 1500 tokens (~1100 words)
**Notes:** Default tutoring stays at 300 tokens; the bump to 1500 only happens when `detailMode === true`.

---

## Wrap-up Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Write context now | Decisions captured. | |
| Dig into kid home layout | Big tablet cards vs admin HomeTab mirror. | |
| Dig into past-session resume | Read-only vs continue conversation. | |
| Both kid layout AND past-session resume | Cover both. | ✓ |

**User's choice:** Both kid layout AND past-session resume

---

## Kid Home Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Big tablet cards | Min 80px touch targets, big emoji icons, no edit pencils, streak fire 🔥. Matches existing kid task grid style. | ✓ |
| Mirror admin HomeTab | Reuse WidgetSystem wholesale. Less code, less special. | |
| Hybrid | Big cards for routines/goals, admin calendar widget unchanged. Mixed density. | |

**User's choice:** Big tablet cards
**Notes:** Edits live in admin profile editor only — kids never see edit pencils. Streak fire visible on each routine card.

---

## Past-Session Resume

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only replay | Show full chat scrollback, no input bar. Simpler. | |
| Resume in place | Past session loads into current state, can keep talking. Bumps rate limit. | |
| Resume with new sessionId | Loads prior messages as AI context but starts a new session record. Original session untouched. | ✓ |

**User's choice:** Resume with new sessionId
**Notes:** Two records per topic, but original sessions stay immutable. Kids can pick up mid-question without polluting the history.

---

## Claude's Discretion

Per CONTEXT.md, the following implementation details are left to the planning/execution agents:
- Exact placement of detailMode and stepByStep toggles in HomeworkHelper header
- Exact phrasing of new system prompts (Socratic, direct-explain, fun-facts, detail mode)
- "Resume" affordance UI on past session rows
- Admin-side UX for editing kids' routines and goals
- AvatarDrawing modal layout
- Backfill behavior for `creator` and `tag` fields on legacy events

## Deferred Ideas

Per CONTEXT.md `<deferred>` section:
- Avatar use in games (Phase 4)
- Kid-side editing of own routines/goals (future)
- Per-routine point values (out of scope)
- Multi-color brush / layers / undo for avatars (out of scope)
- Multiple event tag types beyond "shared" (future)
- Push notifications on routine completion (Phase 6 candidate)
- Same-session-record resume (rejected in favor of new-sessionId)
- CLAUDE.md file-architecture table refresh (separate todo, not blocking)

---

*Discussion conducted via /gsd:discuss-phase 2*
*All decisions reflect user input from this session*
