# Phase 2: Kids & Homework - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the kids' home screen show their own routines, goals, and family events (not Alex's personal events), build a touchscreen finger-drawing avatar for each kid, fix the Homework Helper so it can give long detailed responses / switch between Socratic and direct teaching / show past sessions properly, and add a 3-week calendar view to the existing W/2W/M switcher.

This phase is about kid experience polish and homework usability. It does NOT touch the games (Phase 4), Danyells features (Phase 3), or AI fallbacks (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Homework Helper — Teaching Modes (HW-01, HW-02, HW-03, HW-05)

- **D-01:** Kill the hard 100-word cap in `buildSystemPrompt()` (`HomeworkHelper.jsx:31`). The cap currently lives in the system-prompt instruction itself (`"Keep responses under 100 words"`). Replace with mode-aware phrasing.
- **D-02:** Add a `detailMode` state. When OFF (default), system prompt asks for concise tutoring. When ON, prompt explicitly invites long, structured explanations and `maxTokens` bumps from `300` → **`1500`** (~1100 words, comfortably exceeds the 500-word floor in HW-01).
- **D-03:** Add a `stepByStep` toggle, **persistent per-kid** in `kidsData/{name}/hwPrefs/stepByStep`. Default ON. When ON, the system prompt instructs the model to walk through reasoning step-by-step. When OFF, the model gives direct answers without scaffolding. Toggle is rendered in the HomeworkHelper header next to the existing mute button. The current "Show me step by step" one-shot button (`HomeworkHelper.jsx:647`) becomes redundant — delete it.
- **D-04:** **HW-03 frustration detection** uses the **inverse-celebrate heuristic**:
  - Track an in-memory `socraticAttempts` counter per session
  - After every assistant reply: if `shouldCelebrate(reply, age) === false` AND the reply contains the phrasing `/almost|try again|let'?s try|not quite/i`, increment `socraticAttempts`
  - If `shouldCelebrate(reply) === true`, reset to 0
  - When `socraticAttempts >= 2`, switch the system prompt for the next call to a **direct-explain mode** that says: "The student has tried twice. Stop guiding — explain the concept directly with a worked example, then ask if they want another problem to try."
  - Reset `socraticAttempts` on subject change, kid change, and resetSession
- **D-05:** **HW-05 Fun Facts mode** gets its own dedicated system prompt branch in `buildSystemPrompt()`. Fun Facts must NOT say "almost / try again" — instead, it celebrates any factual or thoughtful response, adds a related fact, and asks an open follow-up. Keep `shouldCelebrate()` as-is for the regular subjects but bypass the "guide them to the answer" framing entirely for `subject === "funfacts"`.

### Homework Helper — Past Sessions (HW-04)

- **D-06:** Past sessions list (`loadPastSessions`, `HomeworkHelper.jsx:236`) becomes **clickable**. Tapping a session row loads it for in-place review.
- **D-07:** **Open behavior: Resume with new sessionId** — clicking a past session loads the prior messages into the current chat (so the kid sees the full scrollback) but starts a NEW `sessionId`. The original session record stays untouched in Firebase. Subsequent messages create a new session record.
- **D-08:** **Auto-prune at 50 sessions per kid.** When writing a new session, if `Object.keys(homeworkSessions[kidName]).length > 50`, delete the oldest sessions (sorted by `updatedAt`) until 50 remain. Pruning happens on the write path, not as a separate background job.
- **D-09:** Past sessions panel keeps the existing 220px max height + 10-most-recent display, but each row gets a tap target ≥ 44px and a "Resume" affordance. No separate modal — open in place per the user's preference.

### Kids Home — Data Model (KIDS-01, KIDS-02, KIDS-03)

- **D-10:** **Hybrid data model** for kid routines and goals:
  - **Definitions** (admin-controlled): `profiles/{kidId}/routines` and `profiles/{kidId}/goals`. Only admin can write — uses existing `canWrite` ADMIN_ONLY_PATHS rule unchanged. Each entry: `{ id, text, emoji, order }`.
  - **Completion state** (kid-writable): `kidsData/{name}/routineState/{dateKey}` and `kidsData/{name}/goalState/{goalId}`. Kid writes to their own subtree — already permitted by Phase 1 D-08.
  - Routine state per day: `{ "2026-04-06": { routineId1: true, routineId2: true } }`. Reset implicitly each day.
  - Goal state: persistent until the goal is removed by admin.
- **D-11:** **Streak tracking** computes from `kidsData/{name}/routineState` history (count consecutive days where ALL routines for that kid had `true`). Streak fires (🔥) and crowns (👑) reuse the same thresholds as the admin home: 3-day small confetti, 7-day big + STREAK MASTER toast, 30-day crown. The existing `triggerConfetti` from utils.js handles this.
- **D-12:** **KIDS-01 family-event filter rule:** A "family event" visible to a kid satisfies `!ev.isPrivate && (ev.creator === "admin" || ev.tag === "shared")`. This is in addition to (not instead of) the existing `who === currentProfile.name` filter. So a kid sees: (a) any non-private event Alex created, (b) any event tagged shared, (c) their own personal events. Implemented as an extension of `filterEventsForRole` in App.jsx — keep the existing privacy logic, layer the new rule on top.
- **D-13:** **Kid home layout: Big tablet cards.** Routines and goals render as touch-friendly cards (min 80px tap target, big emoji icons, kid name color accent). NO edit pencils on the kid screen — admin edits routines/goals from a new section in the admin profile editor. Streak fire 🔥 still appears on each routine card. Layout matches the existing `kd.tasks` grid style at `App.jsx:1278` (`gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))"`) for visual consistency.

### Avatar Drawing (KIDS-04)

- **D-14:** **Kids draw their own avatars.** Drawing UI lives in the kid's "My Stuff" tab (`tab === "kids"` branch in App.jsx:1267). New component: `src/AvatarDrawing.jsx`.
- **D-15:** Canvas implementation per the PROJECT.md tech-stack research: HTML5 Canvas + Pointer Events API + `devicePixelRatio` scaling. No new npm packages. Saved as base64 JPEG via `canvas.toDataURL("image/jpeg", 0.5)` for size control. Stored at `kidsData/{name}/avatar` — kid is permitted to write this path by Phase 1 canWrite rules.
- **D-16:** **Phase 2 finish line for avatars:** draw + save + **display in the kid header** (replaces the emoji at `App.jsx:1217`). The kid header should show the drawn avatar if `kidsData/{name}/avatar` exists, otherwise fall back to `currentProfile.emoji`. Game integration is Phase 4 (per ROADMAP.md Phase 4 success criterion #5).
- **D-17:** Drawing UX: full-screen canvas modal triggered from a "🎨 Draw your face" button in My Stuff. Tools = single brush, color picker (5-6 swatches from `SWATCH_COLORS` in utils.js), clear button, save button. No layers, no undo, no fancy brushes — Luca is 6, keep it dead simple.

### Calendar Views (CAL-01, CAL-02)

- **D-18:** **CAL-01: Add "3W" view.** Extend the existing W/2W/M switcher at `HomeTab.jsx:639`. The button array becomes `["W","2W","3W","M"]`. Display label: "3 Weeks". Layout: 3 rows of 7 days (21 days total starting from the start of the current week). Existing logic at `HomeTab.jsx:410-414` already does dynamic row counts for W and 2W — extend the `daysToShow` formula to include `calView === "3W" ? 21 : ...`.
- **D-19:** **CAL-02: Future-month scroll** — the existing `calMonth` / `calYear` state in HomeTab.jsx already supports forward navigation. Verify during planning that there is no upper bound on `calMonth` advancement. If there is, remove it. No new state required.

### Claude's Discretion

- Exact placement of the `detailMode` and `stepByStep` toggles in the HomeworkHelper header layout
- The exact phrasing of the new system prompts (Socratic default, direct-explain after fail, fun-facts mode, detail mode) — must satisfy the rules in D-01..D-05 but the wording is Claude's call
- The exact UI affordance for "Resume" on past session rows (icon, label, button vs row tap)
- Admin-side UX for editing kids' routines and goals (where in the admin profile editor it lives, copy/paste vs inline edit)
- Layout details of the AvatarDrawing modal — toolbar position, canvas aspect ratio, save/cancel button placement
- Backfill behavior for `creator` and `tag` fields on legacy events (Phase 1 already established `ev.creator ?? "admin"` fallback — extend the same defaulting pattern for `tag`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — Vision, constraints (colorblind, mobile-first, no new deps), Active requirements list
- `.planning/REQUIREMENTS.md` §Homework Helper, §Kids Experience, §Calendar — full requirement text for HW-01..05, KIDS-01..04, CAL-01..02
- `.planning/ROADMAP.md` §"Phase 2: Kids & Homework" — phase goal and 5 success criteria
- `CLAUDE.md` — file architecture table (NOTE: file line counts in CLAUDE.md are stale post Phase 1 split; verify with `wc -l` before planning)

### Phase 1 inheritance (still in force)
- `.planning/phases/01-foundation/01-CONTEXT.md` §decisions — D-06..D-09 (canWrite security model), D-10..D-13 (TTS), D-14..D-17 (event privacy), D-18..D-20 (ROLE_TOOLS)
- `.planning/phases/01-foundation/01-VERIFICATION.md` — confirms canWrite, filterEventsForRole, speakText behavior

### Code references — Homework Helper
- `src/HomeworkHelper.jsx:21-37` — `buildSystemPrompt()` (the 100-word cap and Socratic framing live here)
- `src/HomeworkHelper.jsx:39-45` — `shouldCelebrate()` heuristic (basis for D-04 inverse-celebrate detection)
- `src/HomeworkHelper.jsx:121-130` — Firebase save effect (where the 50-session prune for D-08 hooks in)
- `src/HomeworkHelper.jsx:154-175` — `doAICall()` (where `maxTokens` is set; D-02 changes this)
- `src/HomeworkHelper.jsx:236-242` — `loadPastSessions()` (the panel that needs click-to-resume per D-06/D-07)
- `src/HomeworkHelper.jsx:647-651` — current one-shot "Show me step by step" button (delete per D-03)

### Code references — Kid home + data model
- `src/App.jsx:1205-1342` — kid app shell (the screen Phase 2 augments)
- `src/App.jsx:1217` — kid header emoji (the spot where the drawn avatar replaces the emoji per D-16)
- `src/App.jsx:1278` — existing kid task grid layout (template for D-13 big-card style)
- `src/App.jsx:280-295` — `filterEventsForRole` (extend per D-12 family-event rule)
- `src/utils.js:206` — `ADMIN_ONLY_PATHS` array including `profiles` (the constraint that drove D-10 hybrid model)
- `src/utils.js:247` — `canWrite()` (kid kidsData subtree allowance — already supports D-10 completion state writes)

### Code references — Calendar
- `src/HomeTab.jsx:125` — `calView, setCalView` props
- `src/HomeTab.jsx:410-425` — week/biweekly grid logic (extend to 21-day grid per D-18)
- `src/HomeTab.jsx:639-644` — view switcher button array (add "3W" per D-18)

### Tech stack research (still relevant)
- `CLAUDE.md` §"Recommended Stack" §Canvas Finger Drawing — Pointer Events API + `devicePixelRatio` + `canvas.toDataURL("image/jpeg", 0.5)` — drives D-15

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`triggerConfetti(target, "small"/"big")` from utils.js** — already used by HomeworkHelper for celebrations and admin home for streaks. Reuse for kid streak celebrations per D-11.
- **`shouldCelebrate(text, age)` in HomeworkHelper.jsx** — already detects positive AI replies. Inverse it for D-04 frustration detection, no new helper needed.
- **`filterEventsForRole` in App.jsx** — Phase 1 extended this for privacy. Extend again for the family-event rule per D-12. Keep the layered approach (privacy filter THEN role-relevance filter).
- **`SWATCH_COLORS` in utils.js** — color palette for the avatar drawing color picker per D-17.
- **Kid task grid pattern at App.jsx:1278** — `gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))"` is the visual template for the new big-card routines/goals per D-13.
- **`calView` switcher pattern at HomeTab.jsx:639** — minimal extension for 3W view per D-18.
- **`canWrite()` kid kidsData subtree allowance** — kids already permitted to write `kidsData/{name}/...` per Phase 1 D-08, so D-10 completion state and D-15 avatar storage need zero canWrite changes.

### Established Patterns
- All components receive `V` (theme), `currentProfile`, `fbSet`, `GROQ_KEY`, `showToast` as props from App.jsx — new components (AvatarDrawing) follow the same prop shape.
- Inline styles only — no CSS files. Use `V.*` theme variables for everything.
- Firebase paths are kebab-case top-level keys; sub-paths use slashes; per-kid data lives under `kidsData/{name}/...`
- All buttons ≥ 44px tap target (mobile-first constraint, especially critical for kids on tablets — D-13 raises this to 80px for kid home cards)
- Colorblind-safe: never color-only state; always icon or label alongside (D-13 uses 🔥 for streak, not just color)

### Integration Points
- `src/HomeworkHelper.jsx` is imported into `App.jsx` (line 11) and rendered inside the kid `tab === "kids"` branch (App.jsx:1321) — modifications stay inside HomeworkHelper.jsx + a new prop or two from App.jsx if needed for kid-scoped session prefs
- New `src/AvatarDrawing.jsx` will be imported into App.jsx and rendered conditionally inside the kid `tab === "kids"` branch
- `HomeTab.jsx` is imported by App.jsx — calendar view extension stays inside HomeTab.jsx
- The hybrid routine/goal model needs admin-side editing UI — most natural location is `SettingsTab.jsx` or a sub-section of the existing profile editor, not a new tab

### Merge collision points (Phase 1 lesson)
- `src/utils.js` — none expected (no new exports needed for Phase 2 unless an admin canWrite path tweak emerges)
- `src/App.jsx:280-295` (filterEventsForRole) — single edit point, sequential plans only
- `src/App.jsx:1205-1342` (kid shell) — single edit point, sequential plans only

</code_context>

<specifics>
## Specific Ideas

- **Kill the 100-word cap from inside the system prompt itself**, not just as a maxTokens bump. The current prompt actively tells the model to be brief — bumping maxTokens alone would not free it.
- **Two-strike inverse-celebrate detection** is the chosen approach because it piggybacks on existing `shouldCelebrate()` and adds zero parsing surface.
- **Resume past session = new sessionId, prior messages as context.** Original session record never mutates after creation.
- **Auto-prune ceiling = 50 sessions per kid.** Pruning is on the write path, oldest-first by `updatedAt`.
- **Hybrid routine/goal model** keeps admin in control of what kids work on while letting kids own their completion state — no canWrite exception needed.
- **Family event rule:** `!isPrivate && (creator === "admin" || tag === "shared")`. Kid still also sees `who === their name` events.
- **Big tablet cards** for kid home routines/goals — min 80px touch, no edit pencils on kid screen.
- **Kids draw their own avatars** in My Stuff tab. Phase 2 ends at draw + save + show in header (NOT in games).
- **3-week view** is a 21-day grid (3 rows of 7), added to the existing W/2W/M switcher.
- **Tag field on events** — needed for the "shared" family event marker. Default missing-tag to `null`. Add to event creation form (admin-only) so Alex can mark events as shared without making them visible to kids by default.

</specifics>

<deferred>
## Deferred Ideas

- **Drawing avatars in games** — KIDS-04 says "use in games" but games are Phase 4. Phase 2 stops at displaying the drawn avatar in the kid header. Phase 4 wires it into the games (matches Phase 4 success criterion #5).
- **Kid-side editing of their own routines/goals** — admin-only for now per D-13. Could add a kid-suggest feature later.
- **Per-routine goal weights / point values** — not in scope. Routines are binary done/not-done.
- **Multi-color brush, layers, undo for avatar drawing** — out of scope. Single brush + 5-6 colors + clear is the whole tool.
- **Family event categories beyond "shared"** — `tag` is a single string for now. If multiple tag types emerge later, that's a future phase.
- **Push notifications when a kid completes a routine** — out of scope, could be a future Phase 6 polish item.
- **Resume conversation in same session record (no new sessionId)** — considered and rejected; the new-sessionId approach keeps old sessions immutable and is cleaner for HW-04's "read past sessions" use case.
- **CLAUDE.md file-architecture table is stale** — App.jsx is 1527 lines now, not 3093, and HomeTab/KidsTab/FamilyTab/SettingsTab/WidgetSystem/shared.js exist. Worth a CLAUDE.md update entry, but not blocking Phase 2. Tracked as a separate todo.

</deferred>

---

*Phase: 02-kids-homework*
*Context gathered: 2026-04-06*
