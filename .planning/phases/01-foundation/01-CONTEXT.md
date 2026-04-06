# Phase 1: Foundation - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Split LucacLegends.jsx into separate game files, harden security with write-side role checks, fix TTS voice quality and controls, add event privacy model (createdBy + isPrivate), and make the AI assistant available to all profiles with explicit role-based tool access. This phase unblocks all parallel work in Phases 2-6.

</domain>

<decisions>
## Implementation Decisions

### Game File Split
- **D-01:** LucacLegends.jsx stays as the menu/shell, under 200 lines. Games extract to `src/games/` folder.
- **D-02:** Game files: FishGame.jsx, RacingGame.jsx, BoardGame.jsx, ReadingGame.jsx, AvatarCreator.jsx
- **D-03:** Three coupling points from shell to games: `addStars`, `transitionTo`, AND curriculum/difficulty settings
- **D-04:** Shell reads curriculum from Firebase ONCE, passes it as a prop so games don't each make their own Firebase read
- **D-05:** No shared constants file, no extra abstractions. Keep it simple.

### Security & Write Guards
- **D-06:** Guard sensitive paths only, not every fbSet call. Create `canWrite(profile, path)` in utils.js
- **D-07:** Blocks: admin settings, other users' data, private events
- **D-08:** Allows: Kids writing their own scores/homework, Danyells writing her own events
- **D-09:** utils.js is a merge collision point — any round touching it runs alone per merge discipline

### TTS Voice & Controls
- **D-10:** One shared `speakText(text, { voice, onStop } = {})` function in utils.js
- **D-11:** Kill the duplicated `speakText` versions in LucacLegends.jsx and HomeworkHelper.jsx
- **D-12:** Requirements: natural-sounding voice (not robot), returns a stop handle for stop buttons, fixes the repeat bug (cancel-before-speak)
- **D-13:** Leave `voicePreference` param slot open so users could pick voices later without a rewrite. Don't build the picker now.

### Event Privacy Model
- **D-14:** Add `isPrivate` boolean + `createdBy` string to events
- **D-15:** Filter for non-admin: hide events where `isPrivate === true AND createdBy !== currentUser`
- **D-16:** Handle old events missing fields: if `createdBy` is missing, default to `"admin"` (Alex made them all). If `isPrivate` is missing, default to `false` (visible).
- **D-17:** No database backfill needed — just graceful defaults in the filter function

### AI Assistant Per-Role Access
- **D-18:** AI assistant available to every profile (admin, parent, kid)
- **D-19:** Tool access is explicit per role — three arrays checked before tool execution:
  - Admin: all tools
  - Parent: calendar, budget, events, shopping list, daily spark
  - Kid: emotional support, homework help, fun facts, game tips
- **D-20:** No vague "kids don't get admin stuff" — explicit allowlists per role

### Claude's Discretion
- File naming conventions within `src/games/`
- Internal implementation of `canWrite` path matching
- Voice selection algorithm in `speakText` (as long as it picks a natural voice)
- How to extend `filterEventsForRole` for the privacy model

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Game Split
- `src/LucacLegends.jsx` — Current 2249-line monolith to split. Lines 832 (addStars), 893 (transitionTo) are the coupling points.
- `.planning/research/ARCHITECTURE.md` — Component boundaries and data flow for the split

### Security
- `src/App.jsx` — Lines 269-272 (role detection), 280+ (filterEventsForRole), 353 (fbSet)
- `src/utils.js` — Where canWrite will be added
- `.planning/research/PITFALLS.md` — Documents the fbSet write-side gap and permission bypass risk

### TTS
- `src/LucacLegends.jsx:164-168` — Current speakText (no voice selection, no stop)
- `src/HomeworkHelper.jsx:47-53` — Duplicate speakText (has cancel but no voice selection)
- `.planning/research/STACK.md` — TTS voice selection recommendations (getBestVoice pattern)

### AI Assistant
- `src/aiAgent.js` — Agent loop, tool definitions, WRITE_ACTIONS set
- `src/GroqAssistant.jsx` — UI for the assistant

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `filterEventsForRole` in App.jsx — already does display-side role filtering, extend for privacy
- `fbSet` wrapper in App.jsx — single write point, perfect place to add canWrite guard
- `isAdmin` / `isKid` / `isParent` / `currentRole` — already computed in App.jsx lines 269-272
- `groqFetch` and `callGroqWithRetry` — already coordinated via shared rate limit state

### Established Patterns
- All components receive `V` (theme), `currentProfile`, `fbSet`, `GROQ_KEY` as props from App.jsx
- Games receive `profile`, `kidsData`, `fbSet` as props from LucacLegends shell
- No routing library — all navigation via React state

### Integration Points
- App.jsx imports LucacLegends — will need to import new shell that imports game files
- App.jsx tab rendering — AI assistant visibility check needs role-based logic
- utils.js — shared speakText + canWrite both go here (merge collision point)

</code_context>

<specifics>
## Specific Ideas

- Shell under 200 lines — Alex wants it lean, not a mini-App.jsx
- Three explicit tool arrays for AI access — not an inheritance model, literal arrays
- Voice preference param slot — future-proofing without building the feature now
- Graceful defaults for old events — no migration script needed

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-05*
