# Phase 1: Foundation - Research

**Researched:** 2026-04-05
**Domain:** React SPA refactoring, Web SpeechSynthesis API, Firebase RTDB write guards, role-based AI tool access
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Game File Split
- **D-01:** LucacLegends.jsx stays as the menu/shell, under 200 lines. Games extract to `src/games/` folder.
- **D-02:** Game files: FishGame.jsx, RacingGame.jsx, BoardGame.jsx, ReadingGame.jsx, AvatarCreator.jsx
- **D-03:** Three coupling points from shell to games: `addStars`, `transitionTo`, AND curriculum/difficulty settings
- **D-04:** Shell reads curriculum from Firebase ONCE, passes it as a prop so games don't each make their own Firebase read
- **D-05:** No shared constants file, no extra abstractions. Keep it simple.

#### Security & Write Guards
- **D-06:** Guard sensitive paths only, not every fbSet call. Create `canWrite(profile, path)` in utils.js
- **D-07:** Blocks: admin settings, other users' data, private events
- **D-08:** Allows: Kids writing their own scores/homework, Danyells writing her own events
- **D-09:** utils.js is a merge collision point — any round touching it runs alone per merge discipline

#### TTS Voice & Controls
- **D-10:** One shared `speakText(text, { voice, onStop } = {})` function in utils.js
- **D-11:** Kill the duplicated `speakText` versions in LucacLegends.jsx and HomeworkHelper.jsx
- **D-12:** Requirements: natural-sounding voice (not robot), returns a stop handle for stop buttons, fixes the repeat bug (cancel-before-speak)
- **D-13:** Leave `voicePreference` param slot open so users could pick voices later without a rewrite. Don't build the picker now.

#### Event Privacy Model
- **D-14:** Add `isPrivate` boolean + `createdBy` string to events
- **D-15:** Filter for non-admin: hide events where `isPrivate === true AND createdBy !== currentUser`
- **D-16:** Handle old events missing fields: if `createdBy` is missing, default to `"admin"`. If `isPrivate` is missing, default to `false`.
- **D-17:** No database backfill needed — just graceful defaults in the filter function

#### AI Assistant Per-Role Access
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | LucacLegends.jsx split into separate game files with thin shell component | LucacLegends.jsx is 2,728 lines; games live in a single monolithic export. Shell stays ≤200 lines. Boundary analysis shows 5 game screens (racing, fish, potion, reading, coop) each start at identifiable markers. |
| FOUND-02 | Shared game constants extracted to gameConstants.js | Constants in LucacLegends.jsx: WORLDS, ITEMS, STORIES, SCENE_CHOICES, DEFAULT_REWARDS, KEYFRAMES_CSS, generateMathProblem, genMathProblem, GameBtn, Avatar, BG components — all must be extracted. D-05 says NO shared constants file — see below for resolution. |
| FOUND-03 | `createdBy` field added to all new events | App.jsx already writes `creator` field (line 569, 760, 863). CONTEXT.md uses `createdBy` (D-14). There is a naming mismatch — existing field is `creator`, not `createdBy`. New code must be consistent with one name. |
| FOUND-04 | Write-side role check utility (`canWrite`) in utils.js | utils.js currently has no write guard. Sensitive Firebase paths are clear from App.jsx FB_KEYS list. |
| FOUND-05 | Firebase imports extended with `update` and `runTransaction` | App.jsx line 3: `import { getDatabase, ref, set, onValue } from "firebase/database"`. Missing `update` and `runTransaction`. |
| FOUND-06 | TTS voice helper added to utils.js | utils.js has no TTS code today. LucacLegends.jsx has a bare `speakText` (no cancel, no voice selection). HomeworkHelper.jsx has a slightly better version (cancel-before-speak, still no voice selection). Both must be replaced. |
| CLEAN-02 | Voice/TTS system overhaul | Same as FOUND-06 — covers all call sites in LucacLegends.jsx and HomeworkHelper.jsx. |
| SEC-01 | Role escalation prevention | canWrite guard prevents non-admins writing to admin-managed paths (profiles, settings, other users). |
| SEC-02 | Event visibility system end-to-end | filterEventsForRole already exists in App.jsx (line 280). It already checks `ev.private` and `ev.creator`. Needs field rename alignment (creator → createdBy or vice versa) and the `isPrivate` boolean field. |
| AI-02 | Groq assistant available on all profiles with role-appropriate responses | GroqAssistant.jsx renders only when `!guestMode` (App.jsx line 1471) — no current check for profile type. It receives `currentRole` but does not gate tool access by role. aiAgent.js has no per-role tool filtering. |
</phase_requirements>

---

## Summary

Phase 1 is a pure refactoring and hardening phase with zero new user-facing features. All work is in existing files. The codebase is a single-page React 18 / Vite app with no test framework and no CSS files — all styles are inline. Firebase RTDB is the only data store.

The biggest implementation challenge is the LucacLegends.jsx split. The file is 2,728 lines with all game state co-located in one component. Game screens are implemented as `if (screen === "X") return (...)` branches of the same component — meaning all game state (fish, racing, potion, reading, coop) lives in a shared `useState` pool. Splitting requires moving each game's state to its own component and threading `addStars` / `transitionTo` / curriculum props down from the shell.

The secondary challenges are: (1) a naming inconsistency in the event privacy model (`creator` vs `createdBy`), (2) the SpeechSynthesis `getVoices()` async loading behavior on Android Chrome, and (3) the AI assistant rendering — it is currently gated only on `!guestMode`, with no role-based tool filtering in the agent loop.

**Primary recommendation:** Implement in strict dependency order — utils.js changes first (FOUND-06/CLEAN-02, FOUND-04), then App.jsx hardening (FOUND-05, SEC-01, SEC-02, AI-02), then the LucacLegends split last (FOUND-01, FOUND-02). This prevents merge conflicts and ensures the split inherits the corrected speakText.

---

## Standard Stack

### Core (already in project — do not add packages)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| React | 18.2.0 | UI | All hooks pattern (useState, useEffect, useRef, useCallback) |
| Vite | 4.4.0 | Build | `import.meta.env.VITE_*` for env vars |
| Firebase | 10.7.0 | RTDB | `firebase/database` — `ref`, `set`, `onValue`. Adding `update`, `runTransaction` |
| Web SpeechSynthesis API | Browser native | TTS | Already used; needs voice selection upgrade |
| Web Speech Recognition API | Browser native | Voice input | Already wired in utils.js via `createSpeechRecognition` |

### No New Packages
CLAUDE.md explicitly requires: "No new dependencies: Keep bundle under control. CSS-only solutions preferred."

All Phase 1 capabilities use existing APIs:
- TTS: `window.speechSynthesis` + `SpeechSynthesisUtterance` (already in use)
- Firebase write guard: pure JS function in utils.js
- Component split: React import/export (already in use)
- Role-based tool access: array filter on existing tool definitions

---

## Architecture Patterns

### Recommended Project Structure After Split

```
src/
├── App.jsx              # Main shell (~3,093 lines — unchanged except AI-02 fix)
├── LucacLegends.jsx     # Games menu/shell — target ≤200 lines after split
├── games/               # NEW — extracted game components
│   ├── FishGame.jsx     # Fish Eater game (currently lines 2191-2479)
│   ├── RacingGame.jsx   # Racing game (currently lines 2050-2190)
│   ├── BoardGame.jsx    # Replaces Potion game (currently lines 2411-2479) — placeholder OK
│   ├── ReadingGame.jsx  # Reading game (currently lines 2480-2598)
│   └── AvatarCreator.jsx # Avatar component (currently lines 570-699)
├── utils.js             # Add: speakText, canWrite
├── aiAgent.js           # Add: per-role tool filtering (ROLE_TOOLS map)
├── GroqAssistant.jsx    # Update: render for all profiles, pass role to agent
└── HomeworkHelper.jsx   # Remove local speakText, use utils.js version
```

### Pattern 1: Game Component Interface (Shell → Game props contract)

Every game component receives exactly these props from the LucacLegends shell:
```javascript
// Source: derived from CONTEXT.md D-03, D-04 and existing addStars/transitionTo signatures
function FishGame({ profile, kidsData, fbSet, addStars, transitionTo, curriculum }) {
  // curriculum = { difficulty, isLucaMode, mathDifficulty }
  // addStars(n) — writes to Firebase kidsData, shell owns the write
  // transitionTo(screen) — shell owns the fade animation + screen state
}
```

**Why this interface:** `addStars` writes to `kidsData` which requires `fbSet` + `kidsData` + `profile.name`. Passing the composed function is simpler than threading all three. `transitionTo` owns the fade animation, which lives in shell state (`fadeIn`).

### Pattern 2: Shell State After Split

The shell retains:
- `screen` state and `setScreen`
- `fadeIn` state and `transitionTo` function
- `addStars` function (closes over `kidsData`, `fbSet`, `profile`)
- Firebase curriculum read (single `onValue` or passed from App.jsx)

Each game owns only its own game state (fish position, race lane, reading story, etc.).

### Pattern 3: speakText in utils.js

```javascript
// Source: MDN SpeechSynthesisUtterance + SpeechSynthesisVoice, verified
export function speakText(text, { voicePreference = null, onStop = null } = {}) {
  if (!window.speechSynthesis) return null;
  window.speechSynthesis.cancel(); // fix repeat bug
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1.0;

  // Voice selection — pick best available natural voice
  const voices = window.speechSynthesis.getVoices();
  const natural = voices.find(v =>
    v.localService && /en/i.test(v.lang) &&
    /samantha|karen|daniel|moira|tessa|rishi/i.test(v.name)
  ) || voices.find(v => v.localService && /en/i.test(v.lang))
    || voices.find(v => /en/i.test(v.lang));
  if (natural) utterance.voice = natural;

  // voicePreference slot — no-op now, available for future picker
  // if (voicePreference) { ... }

  if (onStop) utterance.onend = onStop;
  window.speechSynthesis.speak(utterance);

  // Return stop handle for stop buttons
  return () => window.speechSynthesis.cancel();
}
```

**Key detail — Android Chrome getVoices() timing:** On Android Chrome, `getVoices()` returns an empty array synchronously on the first call. Voices load asynchronously via the `voiceschanged` event. The pattern above gracefully degrades to the default voice if the list is empty rather than crashing. An optional `getVoicesReady()` helper can pre-load voices on app mount to avoid the empty-list issue.

### Pattern 4: canWrite in utils.js

```javascript
// Source: derived from App.jsx FB_KEYS and role definitions (lines 269-272)
const ADMIN_ONLY_PATHS = [
  "profiles",      // Profile management
  "contacts",      // Contact numbers
  "alertMinutes",  // Alert settings
  "themeName",     // Theme — admin sets app-wide theme
  "widgetPrefs",   // Widget customization
  "custodyPattern",
  "custodyOverrides",
];

const PARENT_WRITE_PATHS = [
  "events",        // Danyells can write her own events
  "custodySchedule",
  "ruleProposals",
  "jrHistory",
];

const KID_WRITE_PATHS = [
  "kidsData",      // Kids write their own scores/homework
  "homeworkSessions",
];

export function canWrite(profile, path) {
  if (!profile) return false;
  const role = profile.type === "admin" ? "admin"
    : (profile.type === "parent" || profile.type === "family") ? "parent"
    : profile.type === "kid" ? "kid" : "guest";

  if (role === "admin") return true;

  const topPath = path.split("/")[0]; // "kidsData/Luca" → "kidsData"

  if (role === "parent") {
    return PARENT_WRITE_PATHS.includes(topPath) || KID_WRITE_PATHS.includes(topPath);
  }
  if (role === "kid") {
    // Kids can only write to their own subtree
    if (!KID_WRITE_PATHS.includes(topPath)) return false;
    // Extra check: kidsData/Yana — kid can only write their own name
    if (topPath === "kidsData") {
      const nameSegment = path.split("/")[1];
      return !nameSegment || nameSegment === profile.name;
    }
    return true;
  }
  return false; // guest
}
```

### Pattern 5: Per-Role Tool Access in aiAgent.js

```javascript
// Source: derived from CONTEXT.md D-19, existing TOOLS array in aiAgent.js
const ROLE_TOOLS = {
  admin: null, // null = all tools
  parent: [
    "get_calendar_events", "create_calendar_event", "delete_event", "edit_event",
    "get_budget_summary", "add_expense",
    "add_shopping_item", "get_shopping_list",
    "ask_clarification", "emotional_support", "web_search",
    "get_daily_spark" // DAN-01 placeholder — no-op until Phase 3
  ],
  kid: [
    "emotional_support", "get_kids_status",
    "ask_clarification",
    // fun_facts and game_tips are new tools to add — return hardcoded text, no Firebase write
  ],
  guest: [],
};

// In runAgentLoop, before calling Groq:
const allowedTools = ROLE_TOOLS[appState.userRole] === null
  ? TOOLS
  : TOOLS.filter(t => (ROLE_TOOLS[appState.userRole] || []).includes(t.function.name));
```

### Pattern 6: Existing `creator` Field — Naming Decision

The codebase already stores `creator` (not `createdBy`) on events in 3 places (App.jsx lines 569, 760, 863). The filter at line 289 also reads `ev.creator`.

**Decision required by planner:** Either:
1. Keep field name as `creator` throughout (less code change, consistent with existing data)
2. Rename to `createdBy` everywhere (matches REQUIREMENTS.md FOUND-03 language, D-14 language)

**Recommendation:** Keep `creator` — it is already in Firebase for all existing events and the filter already works. FOUND-03/D-14 language is informal, not a hard field-name contract. Rename is risky with no migration and creates a split where some events have `creator` and some have `createdBy`.

The `isPrivate` field (D-14) is new — add it. The existing field is `private` (boolean, no wrapper). CONTEXT.md D-14 calls it `isPrivate`. **Use `isPrivate` for the new field** to distinguish from the existing `private` field. The filter at App.jsx line 289 reads `ev.private` — update it to read `ev.isPrivate ?? ev.private` for backward compatibility.

### Anti-Patterns to Avoid

- **Lifting all game state into the shell:** The shell must stay under 200 lines. Each game owns its own state. Only the `screen`, `fadeIn`, and `addStars` stay in the shell.
- **Adding Firebase reads inside game components:** Shell reads curriculum once, passes as prop (D-04). Games that make their own `onValue` calls create orphan listeners.
- **Using `window.speechSynthesis.getVoices()` without checking for empty array:** On Android Chrome it returns `[]` on first call. Always guard.
- **Calling `speakText` before `window.speechSynthesis.cancel()`:** The repeat bug. The new shared function handles this, but callers using the old local speakText must be replaced.
- **Generic `canWrite(profile, "kidsData")` without checking the full path:** Kids must only write to their own `kidsData/[name]` subtree, not `kidsData/Yana` if they are Luca. Parse the full path.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Voice quality improvement | Custom audio synthesis | SpeechSynthesis `localService` voice selection | Browser local voices (Samantha on iOS, Daniel/Google on Android) are high quality; no server needed |
| Event deduplication | Custom ID scheme | Existing `displayEvents` dedup layer in App.jsx | Already handles repeat event expansion and title+time dedup |
| Firebase write batching | Manual queue | `update()` for multi-path writes | Firebase RTDB `update()` is atomic multi-path — built in, already imported after FOUND-05 |
| Role detection | Redundant role logic | `currentRole` computed at App.jsx line 272 | Already computed and passed as prop; do not recompute in child components |
| TTS stop button state | Custom boolean flag | Return value of `speakText()` (the stop handle) | The handle IS the stop function; no extra state needed |

**Key insight:** This project has zero test infrastructure and a strict no-new-packages rule. Every solution must be pure JS / browser native APIs. The patterns above achieve all Phase 1 goals without adding anything new to `package.json`.

---

## Runtime State Inventory

This phase involves adding new fields (`isPrivate`, `createdBy`/`creator` alignment) to Firebase event data but explicitly requires NO database backfill (D-17).

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Firebase RTDB: existing events have `private` (boolean) and `creator` (string) fields on some events. ~3 duplicate "Eating wings" entries noted in CLAUDE.md. | No migration — graceful defaults in filter only |
| Live service config | Firebase RTDB accessed by Vercel-hosted app at lucac-life-app.vercel.app | None — no path names changing |
| OS-registered state | None | None |
| Secrets/env vars | `VITE_GROQ_KEY`, `VITE_TAVILY_KEY` in Vercel env | None — no key names changing |
| Build artifacts | `dist/` directory present in working tree (gitignored) | Rebuild on next deploy — no action |

**No database migration required.** Existing events missing `isPrivate` default to `false` (visible to all). Existing events missing `creator` default to `"admin"` (Alex made them all). Both defaults are implemented in the filter function, not as a migration script.

---

## Common Pitfalls

### Pitfall 1: LucacLegends state references across game screens

**What goes wrong:** All game state (fish position, race lane, reading story index, potion round) currently lives in a single `useState` pool in the LucacLegends component. When extracting a game to its own file, a developer may try to pass state from the parent rather than moving `useState` declarations.

**Why it happens:** The screen-render pattern (`if (screen === "fish") return (...)`) looks like a render branch of the parent, not a child component. It is easy to see `fishSize`, `fishPos`, etc. at the top of the file and assume they must stay there.

**How to avoid:** Each extracted game component declares its own `useState` for its own game variables. The shell passes only: `{ profile, kidsData, fbSet, addStars, transitionTo, curriculum }`. Zero game state lives in the shell after the split.

**Warning signs:** Shell component growing past 200 lines is a signal that game state leaked back up.

### Pitfall 2: Android Chrome getVoices() empty array

**What goes wrong:** `window.speechSynthesis.getVoices()` returns `[]` on the first synchronous call in Chrome on Android. Code that calls this once at render time and caches the result gets an empty voice list, falls through with no voice selection, and speaks in the default robot voice.

**Why it happens:** Chrome loads voices asynchronously and fires `voiceschanged` event when ready. The first synchronous call before the event fires returns empty.

**How to avoid:** In the `speakText` function, call `getVoices()` fresh each time (voices will be populated after the first utterance triggers async load). Optionally call a `getVoicesReady()` helper at app mount that fires a silent utterance to trigger the load.

**Warning signs:** Voice works on iOS/desktop but is robot on Android.

### Pitfall 3: SpeechSynthesis Chrome bug — `speak()` hangs when tab loses focus

**What goes wrong:** On Chrome desktop and Android Chrome, if the tab loses focus while `speak()` is queued, the synthesis hangs indefinitely. Subsequent `cancel()` + `speak()` calls do nothing.

**Why it happens:** Chrome pauses the speech synthesis queue on tab visibility change. Known long-standing Chrome bug (present since ~2015).

**How to avoid:** Add a `visibilitychange` listener that calls `window.speechSynthesis.cancel()` when tab goes hidden. The games are mobile-only so the user is unlikely to switch tabs mid-game, but the HomeworkHelper is a longer session.

**Warning signs:** Read-aloud stops after switching apps on Android, then refuses to restart.

### Pitfall 4: utils.js merge collision

**What goes wrong:** Two tasks simultaneously editing utils.js produce a merge conflict that breaks all imports.

**Why it happens:** utils.js is the only shared utility file. Multiple Phase 1 changes add to it: `speakText` (FOUND-06/CLEAN-02) and `canWrite` (FOUND-04).

**How to avoid:** Per CONTEXT.md D-09, any work touching utils.js runs alone in its own commit wave before any parallel work begins. All utils.js additions must be in a single wave.

**Warning signs:** Two tasks both assigned to edit utils.js in the same wave.

### Pitfall 5: GroqAssistant receives isAdmin/currentRole but aiAgent does not filter tools

**What goes wrong:** The assistant renders for all profiles after the AI-02 fix, but kids can ask it to delete events and it will try. The role is passed to the component but the agent loop in aiAgent.js has no per-role tool filter today.

**Why it happens:** `isAdmin` and `currentRole` are passed as props (App.jsx line 1477) but GroqAssistant.jsx line 76 only reads `currentProfile.type` — it does not gate tool access. The ROLE_TOOLS pattern must be added to `runAgentLoop` in aiAgent.js.

**How to avoid:** Filter `TOOLS` array in `runAgentLoop` before passing to Groq, using a `ROLE_TOOLS` map keyed by `appState.userRole`.

**Warning signs:** Kid profile can trigger write tools (create_calendar_event, add_expense).

### Pitfall 6: `creator` vs `createdBy` field name collision

**What goes wrong:** New code adds `createdBy` to events while existing filter reads `ev.creator`. Events created before the fix have `creator`. Events created after have `createdBy`. The filter only checks one field — half the events ignore the privacy rule.

**Why it happens:** REQUIREMENTS.md/CONTEXT.md use `createdBy` language but the actual codebase uses `creator` (written in 3 places, read in 1 place).

**How to avoid:** Pick one name and use it everywhere. Recommended: keep `creator` (backward compatible with existing Firebase data). Update any new code that would write `createdBy` to write `creator` instead. Update the filter to read `ev.creator ?? "admin"`.

**Warning signs:** Privacy filter not hiding Alex's private events from Danyells in testing.

---

## Code Examples

Verified patterns from the actual codebase:

### Existing filterEventsForRole (App.jsx lines 280-295)
```javascript
// Source: src/App.jsx lines 280-295 — verified by direct read
function filterEventsForRole(eventsObj, profile) {
  if (!eventsObj || !profile) return {};
  const role = profile.type === "admin" ? "admin"
    : (profile.type === "parent" || profile.type === "family") ? "parent"
    : profile.type === "kid" ? "kid" : "guest";
  if (role === "admin") return eventsObj;
  const filtered = {};
  Object.entries(eventsObj).forEach(([dk, dayEvs]) => {
    const visible = (Array.isArray(dayEvs) ? dayEvs : []).filter(ev => {
      if (ev.private) return ev.creator === profile.name;
      return true;
    });
    if (visible.length > 0) filtered[dk] = visible;
  });
  return filtered;
}
```
**Required update:** Change `ev.private` check to `ev.isPrivate ?? ev.private` and `ev.creator` lookup to `ev.creator ?? "admin"`. This is backward-compatible with all existing Firebase data.

### Existing fbSet (App.jsx lines 353-358)
```javascript
// Source: src/App.jsx lines 353-358 — verified by direct read
function fbSet(key, val) {
  set(ref(db, key), val).catch(() => {
    cacheSet(key, val);
  });
}
```
**Required update for SEC-01:** Wrap with `canWrite` check before `set()`. Pattern: `if (!canWrite(currentProfile, key)) { showToast("Permission denied", "error"); return; }`. Note: `currentProfile` must be in scope — since `fbSet` is defined inside the component function, it has access to the state variable.

### Existing LucacLegends addStars (lines 832-839)
```javascript
// Source: src/LucacLegends.jsx lines 832-839 — verified by direct read
function addStars(n) {
  setStarsEarned(s => s + n);
  setTotalStarsSession(s => s + n);
  if (fbSet && kidsData && profile?.name) {
    const updated = { ...kd, points: (kd.points || 0) + n };
    fbSet("kidsData", { ...kidsData, [profile.name]: updated });
  }
}
```
This function closes over `kd`, `kidsData`, `fbSet`, `profile`, and two setter functions. After the split, it lives in the shell and is passed as a prop to game components.

### Existing transitionTo (lines 893-899)
```javascript
// Source: src/LucacLegends.jsx lines 893-899 — verified by direct read
function transitionTo(newScreen) {
  setFadeIn(false);
  setTimeout(() => {
    setScreen(newScreen);
    setFadeIn(true);
  }, 300);
}
```
This closes over `setFadeIn` and `setScreen` — both must stay in the shell. Passed as a prop to game components.

### SpeechSynthesis voice selection (MDN-verified pattern)
```javascript
// Source: MDN SpeechSynthesisVoice API — pattern verified against existing CLAUDE.md stack research
export function speakText(text, { voicePreference = null, onStop = null } = {}) {
  if (!window.speechSynthesis) return null;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const NATURAL_VOICES = ["samantha", "karen", "daniel", "moira", "tessa", "rishi", "google"];
  const natural = voices.find(v =>
    v.localService && /en/i.test(v.lang) &&
    NATURAL_VOICES.some(n => v.name.toLowerCase().includes(n))
  ) || voices.find(v => v.localService && /en/i.test(v.lang))
    || voices.find(v => /en/i.test(v.lang));
  if (natural) utterance.voice = natural;

  if (onStop) utterance.onend = onStop;
  window.speechSynthesis.speak(utterance);
  return () => window.speechSynthesis.cancel();
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| All games in LucacLegends.jsx monolith | Split to `src/games/` components | This phase implements the split |
| `speakText` duplicated in 2 files, no voice selection | Single shared `speakText` in utils.js with `localService` voice selection | This phase implements the shared version |
| fbSet writes to Firebase with no role check | fbSet checks `canWrite(profile, path)` first | This phase adds the guard |
| AI assistant only visible when `!guestMode` (all profiles see it, but no role-aware tools) | AI assistant visible to all non-guest profiles, tools filtered by ROLE_TOOLS map | This phase adds role-based tool filtering |
| Events have `private` + `creator` fields (inconsistent naming vs requirements) | Events gain `isPrivate` field, filter checks `isPrivate ?? private` | Backward-compatible bridge pattern |

---

## Open Questions

1. **FOUND-02 vs D-05 conflict: shared constants file**
   - What we know: REQUIREMENTS.md FOUND-02 says "Shared game constants extracted to gameConstants.js". CONTEXT.md D-05 says "No shared constants file, no extra abstractions."
   - What's unclear: These are contradictory. CONTEXT.md was gathered after REQUIREMENTS.md and represents a more specific decision.
   - Recommendation: D-05 wins (CONTEXT.md is more specific and more recent). Inline constants into each game file that needs them. Constants used by multiple games (KEYFRAMES_CSS, generateMathProblem, GameBtn, Avatar, BG components) go into the shell file and are imported by games via the shell's prop interface or direct import from LucacLegends.jsx (which remains in src/). Plan FOUND-02 as "No separate file; shared helpers stay importable from the shell module."

2. **AvatarCreator.jsx — what does it replace?**
   - What we know: D-02 lists AvatarCreator.jsx as a game file. LucacLegends.jsx lines 570-699 contain an `Avatar` component (a character display, not a drawing tool). KIDS-04 (Phase 2) covers "Avatar finger-drawing restored."
   - What's unclear: Is AvatarCreator in Phase 1 the extraction of the existing display Avatar, or is it a stub for KIDS-04?
   - Recommendation: Extract the existing display `Avatar` component as `AvatarCreator.jsx`. Do not implement canvas drawing — that is KIDS-04 (Phase 2). The split just moves what exists.

3. **`curriculum` prop — what Firebase path?**
   - What we know: D-04 says "Shell reads curriculum from Firebase ONCE, passes as prop." No curriculum path exists in FB_KEYS list in App.jsx.
   - What's unclear: Does curriculum data exist in Firebase yet? Is it the same as `kidsData` difficulty settings?
   - Recommendation: For Phase 1, derive curriculum from the profile name (Luca = easy, Yana = hard) as the shell already does at line 739. Pass `{ isLucaMode, mathDifficulty, kidAge }` as the `curriculum` prop. Actual admin-configurable curriculum (EDU-01) is Phase 6. The prop slot is established now; Phase 6 fills it.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 1 is pure code/config changes. No external tools, databases, or CLIs beyond the existing Node.js + npm stack are required. All capabilities use browser native APIs already present in the codebase.

---

## Validation Architecture

nyquist_validation is explicitly set to `false` in `.planning/config.json`. This section is skipped.

---

## Project Constraints (from CLAUDE.md)

| Directive | Category | Impact on Phase 1 |
|-----------|----------|--------------------|
| Never touch `package.json`, `vite.config.js`, `index.html`, `src/main.jsx` | File restriction | No impact — Phase 1 only touches src/ component files and utils.js |
| Firebase config stays hardcoded in App.jsx | Architecture | No impact — not moving Firebase config |
| No new dependencies | Package restriction | All Phase 1 solutions use browser native APIs only |
| Alex is colorblind — never use color alone | Accessibility | No new UI in Phase 1; existing color usage unchanged |
| All styles are inline — no CSS files | Style | Any new UI elements (e.g., stop button) use inline styles with V.* theme vars |
| PowerShell: no && operator, use ; or separate commands | Shell commands | Does not affect source code, only affects any terminal commands in plans |
| Edit `src/*.jsx` component files only | File scope | Confirmed — Phase 1 changes: LucacLegends.jsx, games/ (new), utils.js, App.jsx, aiAgent.js, GroqAssistant.jsx, HomeworkHelper.jsx |
| Commit co-author: Claude Sonnet | Git | Include in all commit messages |
| Read ALL Lessons Learned before starting | Process | Plans must reference: (1) coerce Groq types, (2) every tool needs `required: []` |
| Every bug found gets a Lessons Learned entry | Process | Planner should add a verification step for this |
| Danyells will judge this app — polish and professional | Quality | AvatarCreator and any UI surface must not regress visual quality |
| LucacLegends.jsx: self-contained, do NOT modify (v25 CLAUDE.md) | Warning | **Resolved by Phase 1 itself** — the split IS the modification. This warning was written before the split was decided. D-01 through D-05 supersede this note. |

---

## Sources

### Primary (HIGH confidence)
- `src/LucacLegends.jsx` — Direct read of all 2,728 lines. Game section boundaries, addStars (line 832), transitionTo (line 893), speakText (line 164), all game state locations confirmed.
- `src/App.jsx` — Direct read of lines 1-30, 260-400, 560-570, 760-770, 1468-1478. filterEventsForRole (line 280), fbSet (line 353), role detection (lines 269-272), GroqAssistant render (line 1471) confirmed.
- `src/utils.js` — Full file read. No TTS or write guard functions currently present. Confirmed.
- `src/HomeworkHelper.jsx` — Lines 40-120 read. Local speakText (line 47) confirmed — has cancel-before-speak but no voice selection.
- `src/GroqAssistant.jsx` — Lines 1-120, 118-200 read. `userRole` is derived from `currentProfile.type` (line 76) but not used to filter tools.
- `src/aiAgent.js` — Lines 260-360 read. WRITE_ACTIONS set (line 267) confirmed. No per-role tool filtering exists.
- `.planning/phases/01-foundation/01-CONTEXT.md` — All decisions (D-01 through D-20) read.
- `.planning/REQUIREMENTS.md` — All Phase 1 requirements (FOUND-01 through FOUND-06, SEC-01, SEC-02, CLEAN-02, AI-02) read.
- `CLAUDE.md` — All constraints, lessons learned, architecture table read.

### Secondary (MEDIUM confidence)
- MDN SpeechSynthesisVoice — `localService` property and `voiceschanged` event behavior documented in CLAUDE.md stack research section (confirmed in project context, browser API stable)
- Android Chrome `getVoices()` async behavior — documented in CLAUDE.md stack research, consistent with known Chrome behavior since Chrome 33+

### Tertiary (LOW confidence)
- None for this phase. All findings are grounded in direct codebase reads and well-established browser APIs.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all verified from package.json and existing imports
- Architecture: HIGH — game boundaries identified by direct line-number reads, prop interface derived from existing function signatures
- Pitfalls: HIGH — naming conflicts verified by direct code comparison, TTS issues verified against existing browser-native patterns in CLAUDE.md
- Security patterns: HIGH — role detection code read directly, Firebase path list read from App.jsx FB_KEYS

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable browser APIs; Firebase SDK not changing)
