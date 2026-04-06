# Domain Pitfalls

**Domain:** Family life management app — React SPA, Firebase RTDB, Groq AI, kids games
**Researched:** 2026-04-05
**Confidence:** HIGH (grounded directly in this codebase's history and architecture)

---

## Critical Pitfalls

Mistakes that cause rewrites, broken sessions, or data loss.

---

### Pitfall 1: Duplicate Helper Functions When Splitting Files

**What goes wrong:** When LucacLegends.jsx is split into FishGame.jsx, RacingGame.jsx, etc., each agent copies helpers like `speakText`, `generateMathProblem`, or animation constants into their own file. Later, a bug fix in one copy is not replicated in the others. After a month, four slightly different versions of the same logic exist.

**Why it happens:** The file is self-contained by design ("do NOT modify" in CLAUDE.md). When splitting it, the path of least resistance is to copy-paste helpers rather than create a new shared module. Parallel agents working on separate game files make this worse — they each solve the same problem independently.

**Evidence in this codebase:** `parseTime` already exists in three places: `src/shared.js`, `src/HomeTab.jsx` (lines 14-20, copied as a "local helper"), and `src/App.jsx` (imported from shared). This drift happened during the v25 refactor and is a documented pattern here.

**Consequences:** Bug fixes that only land in one copy, inconsistent behavior between games, test failures that are hard to diagnose.

**Prevention:**
1. Before splitting LucacLegends, audit every function inside it. Move anything used by 2+ games to `src/utils.js` or a new `src/gameUtils.js` FIRST.
2. The split phase must be a single-agent sequential task — not parallelized — until shared utilities are extracted and all imports are wired.
3. After splitting: run a grep for function signatures (e.g., `function speakText`, `function generateMathProblem`) across all game files. Any duplicate = bug waiting to happen.

**Warning signs:** Two game files both define `function speakText`. Any file with the comment "// copied from LucacLegends".

**Phase:** Must be addressed in the LucacLegends split phase, before any game upgrade begins.

---

### Pitfall 2: App.jsx State Passed as Props — Breaking Boundaries When Splitting Games

**What goes wrong:** Games in LucacLegends.jsx currently receive no props — the component is fully self-contained. When split into separate files and re-integrated, developers are tempted to wire each game directly into App.jsx state (e.g., `fbSet`, `currentProfile`, `GROQ_KEY`). This turns 4 game files into 4 new App.jsx tentacles, making App.jsx even harder to modify.

**Why it happens:** The AI assistant (bby sonnet Jr.) has 16 tools and already receives 14+ props from App.jsx. Agents follow that pattern as a template.

**Evidence in this codebase:** `GroqAssistant.jsx` receives 14 named props. `HomeworkHelper.jsx` receives ~10. The prop surface area is already at maximum tolerable complexity. Adding 4 game files at the same prop depth would make App.jsx JSX unreadable.

**Consequences:** App.jsx becomes untestable. Any change to `currentProfile` shape breaks 4+ files simultaneously. Parallel agent work becomes impossible because every game file depends on App.jsx's render tree.

**Prevention:**
1. Games should receive only what they need: `V` (theme), `currentProfile` (for avatar/name), `fbSet` (for score saving), `GROQ_KEY` (for Reading game only). Avoid passing `events`, `routines`, `goals` into games.
2. Create a `gameProps` object in App.jsx that is the single source for all game dependencies. Pass it as one prop: `<LucacLegends gameProps={gameProps} />`. Game files destructure from it internally.
3. Score/progress data should live under a single Firebase path `gameData/` not spread across multiple FB_KEYS.

**Warning signs:** A game file imports more than 5 named props. A game file directly calls `fbSet("events", ...)`.

**Phase:** LucacLegends split phase design must mandate the prop boundary before any code is written.

---

### Pitfall 3: Firebase Realtime Database — onValue Listener Leaks

**What goes wrong:** Each time a component mounts that registers a new `onValue` listener on Firebase, and that component unmounts without detaching the listener, the listener accumulates. With game files mounting/unmounting as players switch games, Firebase fires stale updates into detached component state, causing silent memory leaks and ghost state updates.

**Why it happens:** Firebase RTDB's `onValue` returns an `unsubscribe` function that must be called in a `useEffect` cleanup. If the game files are written by agents who copy the App.jsx pattern (which uses a single mount-once `useEffect` for all listeners), the cleanup is skipped.

**Evidence in this codebase:** `App.jsx` lines 341-351 registers all listeners in a single `useEffect(() => { ... }, [])` with no cleanup return. This works because App.jsx never unmounts. Game files that mount/unmount will need cleanup, which is a different pattern.

**Consequences:** After navigating between games several times, multiple listeners fire for the same data path. Score updates trigger twice. The app feels laggy. In Realtime Database, this also increases billing reads.

**Prevention:**
1. Any game file that registers `onValue` must return the unsubscribe function from the useEffect: `return () => unsubscribeFn()`.
2. For the board game (Monopoly-style multiplayer), all shared game state should live under ONE Firebase path (e.g., `gameData/boardgame`) with a single listener in App.jsx, not individual listeners in each player's game component.
3. Use a pattern audit: grep for `onValue(` in all new game files and verify each one has a corresponding `useEffect` cleanup.

**Warning signs:** Console shows "Warning: Can't perform a React state update on an unmounted component." Firebase usage dashboard shows read count spike when switching games.

**Phase:** Critical for the board game multiplayer phase. Lower risk for single-player game upgrades.

---

### Pitfall 4: Role-Based Permissions Applied Only to UI, Not to Firebase Writes

**What goes wrong:** The `isAdmin` / `isParent` / `isKid` checks exist in the UI layer — buttons are hidden, tabs are not rendered. But Firebase writes (`fbSet`) are not protected. A determined parent (or a bug) can trigger `fbSet("events", ...)` from a non-admin profile.

**Why it happens:** Firebase RTDB security rules are not configured in this project (hardcoded config, no auth, no rules). All security is client-side JavaScript. When new features add write paths (e.g., "Danyells can delete her own events"), the agent writes the feature without checking the adjacent write paths that should remain admin-only.

**Evidence in this codebase:** `filterEventsForRole` (App.jsx lines 280-295) correctly filters what is displayed. But `fbSet("events", ...)` is called directly in several places (lines 583, 595, 603, 644) without a role check before the write. The `eventPrivate` flag (line 571) checks `isAdmin` — but the adjacent `fbSet("events", ...)` call on line 583 would succeed for any profile.

**Consequences:** A parent-role user could edit or delete admin-private events if a bug skips the UI guard. A kid profile could theoretically trigger writes if the hidden button JSX is somehow rendered.

**Prevention:**
1. Add a `canWrite(action, profile)` utility function in `utils.js` that centralizes permission checks. Call it before every `fbSet` that modifies sensitive data.
2. For Danyells' features ("delete own events"), implement at the data level: events have a `creator` field. The delete action checks `ev.creator === currentProfile.name` OR `isAdmin`. Never just `isParent`.
3. Private events must check `ev.private && ev.creator !== currentProfile.name` as a write guard, not just a display guard.

**Warning signs:** A new feature does `fbSet(...)` without an adjacent `if (isAdmin || ...)` check. A "Danyells can delete" implementation that checks `isParent` broadly instead of checking `ev.creator`.

**Phase:** Must be resolved in the permissions/Danyells features phase, before deploying.

---

### Pitfall 5: Groq Story Generation — Repetition and Content Creep

**What goes wrong:** The Reading game uses hardcoded stories (5 easy, 5 hard, in STORIES object). The Active requirements call for Groq-generated stories (500+ words, age-appropriate). When implemented naively, Groq will:
- Use the same story structure every time (hero goes somewhere, faces obstacle, wins).
- Include scary/violent content at higher difficulty (dragons killing, villains dying) because the model isn't sufficiently constrained.
- Generate stories that are technically 500+ words but padded with repetitive filler.
- Return content that breaks the fill-in-the-blank or comprehension question format the Reading game depends on.

**Why it happens:** Groq's Llama models default to adult story conventions. Without a very tight system prompt specifying format, age group, and content constraints, the output drifts.

**Evidence in this codebase:** The existing STORIES object (LucacLegends.jsx lines 137-162) was hardcoded specifically because Groq was removed from LucacLegends: "// groqFetch/parseGroqJSON no longer needed — all game content is hardcoded." This is a deliberate architectural choice. The regression risk is real.

**Consequences:** A 6-year-old reads a Groq story that includes combat death, emotional manipulation, or simply repeats the same "brave child saves the day" template five times. The kids lose interest or a parent (Danyells) is alarmed.

**Prevention:**
1. System prompt must specify: max Flesch-Kincaid grade level by profile age, no violence/death/weapons, no romantic content, no scary imagery beyond "spooky in a fun way", must end happily.
2. Use structured output: the prompt must instruct Groq to return a JSON object with `{ title, story_text, vocabulary_words: [], comprehension_questions: [] }`. Parse this with `parseGroqJSON` — if parse fails, fall back to hardcoded stories.
3. Cache generated stories in localStorage under `lucac_stories_${kidName}_${date}` so the same story is not regenerated multiple times per session.
4. Add a "thumbs down" button that flags a story and pulls the next one — this gives Yana and Luca agency without exposing why (Groq misbehaved).
5. Test with both `llama-3.1-8b-instant` (fast) and `llama-3.3-70b-versatile` (better quality) — 8b may produce lower-quality story structure for 500+ word stories.

**Warning signs:** Stories consistently end with the same sentence structure. Any story mentioning "blood," "died," "killed," or "weapon" in a literal context. Stories that exceed 700 words but have low actual narrative content.

**Phase:** Reading game upgrade phase. Do NOT ship Groq stories without a human review pass on 5+ samples first.

---

## Moderate Pitfalls

---

### Pitfall 6: "Mega-Prompt" Build — Too Many Changes in One Phase

**What goes wrong:** Previous sessions documented "mega-prompt problems — too many changes at once." When a single phase tries to: split LucacLegends + upgrade fish game + add Danyells features + fix Homework Helper, the App.jsx merge surface explodes. Import errors in one component block testing of all others. Playwright testing can't isolate which feature broke what.

**Why it happens:** The GSD roadmap may group features by theme ("Games Phase") without considering which files each feature touches. Multiple features that all modify App.jsx are dangerous to parallelize.

**Prevention:**
1. Order phases by which files they touch. Phase 1 = fixes to existing files only (HomeworkHelper, App.jsx imports). Phase 2 = split LucacLegends (touches App.jsx once, then never again). Phase 3 = individual game files (no App.jsx changes needed). Phase 4 = Danyells/permissions (targeted App.jsx changes only).
2. Each phase must pass Playwright smoke test before the next phase begins.
3. Maximum 2 files with simultaneous modifications per "wave." If a task requires 3+ files, split into sequential sub-waves.

**Warning signs:** A phase description says "and also" more than twice. A phase modifies both `App.jsx` and `LucacLegends.jsx` and a new game file simultaneously.

**Phase:** Applies to roadmap design. Not a code bug — a planning bug.

---

### Pitfall 7: Board Game Multiplayer — Race Conditions in Firebase RTDB

**What goes wrong:** The Monopoly-style board game requires multiple devices (Alex's phone, Danyells' phone, Yana's tablet) to share game state in real-time. Firebase RTDB's `set()` is a full overwrite. If two players take actions within milliseconds of each other, the second write overwrites the first.

**Why it happens:** `fbSet` in this app is a wrapper around `set(ref(db, key), val)` — a full path overwrite. Multiplayer games require atomic field updates (`update()`) or transactions (`runTransaction()`), neither of which are currently imported.

**Evidence in this codebase:** `App.jsx` imports only `{ ref, set, onValue }` from firebase/database (line 3). `runTransaction` and `update` are not imported anywhere.

**Consequences:** In a 3-player board game, two players rolling dice simultaneously results in one player's roll being silently lost. Scores diverge. The game state becomes inconsistent across devices.

**Prevention:**
1. All board game state mutations must use Firebase `update()` for partial writes (e.g., update only the current player's position, not the entire game object).
2. Turn validation must be server-enforced: the game state object must include `currentTurnPlayerId`. Any write from a non-current-turn player should be rejected client-side before it reaches Firebase.
3. For dice rolls and card draws, use Firebase `runTransaction()` to prevent double-write races on shared counters.
4. Add `import { update, runTransaction } from "firebase/database"` before writing any multiplayer code.
5. Design the data shape FIRST: `gameData/boardgame/{ state, players, currentTurn, board, log[] }`. Do not let individual game files define their own Firebase paths.

**Warning signs:** Board game component uses `fbSet("gameData", { ...entire_game_state })`. Game state includes a counter that increments — without `runTransaction`, this will race.

**Phase:** Board game phase only. Single-player games (Fish, Racing, Reading) do not have this risk.

---

### Pitfall 8: Kids' Game Difficulty — Static Difficulty Means Kids Disengage Quickly

**What goes wrong:** The current Fish game and Racing game have static difficulty. Yana (8) is a "power user" who will master the current difficulty within a session and disengage. Luca (6) is described as "chaotic genius" — he may find static hard mode impossible and refuse to play.

**Why it happens:** Static difficulty is easy to implement. Adaptive difficulty requires tracking player history, which requires Firebase reads and writes per session.

**Evidence in this codebase:** `generateMathProblem(difficulty)` takes a fixed `'easy'` or `'hard'` argument (LucacLegends.jsx line 88). The difficulty is not derived from player history. Fish Eater has no documented difficulty scaling in the codebase.

**Consequences:** Both kids plateau and stop opening the app. The core value ("The kids' experience must be magical") fails.

**Prevention:**
1. Implement a simple "3 wins → step up, 3 losses → step down" adaptive difficulty model. This requires only 2 integers in localStorage per game per player — no Firebase needed.
2. Visible progression markers: level number, star count, or unlockable cosmetic items tied to performance. Kids need to see growth.
3. For the Fish game: difficulty scaling = fish size variety + fish speed. Boss fish at round 5 is a natural milestone. These are CSS/animation changes, not logic changes — low risk.
4. Do NOT use Groq to generate difficulty — latency kills gameplay flow. All difficulty logic must be synchronous.

**Warning signs:** Yana completes the highest difficulty in under 5 minutes on first try. Luca does not return to a game after the first session.

**Phase:** Game upgrade phases. Fish game and Racing game each need their own difficulty curve defined before implementation begins.

---

### Pitfall 9: Role Permissions — "Parent" Type Is Ambiguous

**What goes wrong:** The app has `type: "admin"`, `type: "parent"`, `type: "family"`, and `type: "kid"`. The code treats `parent` and `family` as equivalent (App.jsx line 271: `profile.type === "parent" || profile.type === "family"`). Danyells is a parent. The "Danyells can delete her own events" feature assumes Danyells has `type: "parent"`. But what stops Alex from accidentally creating a profile for Yana with `type: "parent"`?

**Why it happens:** Profile types are free-form strings stored in Firebase with no schema validation. The `isParent` check uses an OR of two string values, suggesting the type system evolved organically.

**Evidence in this codebase:** The profiles state is initialized with a single admin profile. Additional profiles are created via the Settings UI. The profile type is set by a UI control — but that control's allowed values are not visible in the snippet read.

**Consequences:** A mis-typed profile (e.g., `type: "Parent"` with capital P) silently fails the `isParent` check and gets no permissions. A kid accidentally given parent type sees delete buttons and can remove events. The Danyells-specific features get triggered for any parent-type profile, not just Danyells.

**Prevention:**
1. Define a typed enum for roles: `const PROFILE_TYPES = ["admin", "parent", "kid"]` in `shared.js`. The Settings UI must use this array for the type selector — no free text input.
2. Retire the `"family"` type or map it explicitly: `const isParent = ["parent", "family"].includes(profile?.type)` is fine, but add a JSDoc comment explaining why both exist.
3. For Danyells-specific features, check by `profile.name === "Danyells"` OR by a boolean flag `profile.isCoParent = true` stored on the profile. Do not rely solely on the type string, which any future parent profile would also have.

**Warning signs:** A new profile is created with an unrecognized type and silently gets no permissions. A feature works for "Danyells" in testing but breaks when a second parent profile is created.

**Phase:** Permissions/Danyells features phase.

---

## Minor Pitfalls

---

### Pitfall 10: Speech Synthesis — "V1 Siri" Voice and Repeat Bug

**What goes wrong:** `speakText()` in LucacLegends.jsx (line 164-169) calls `window.speechSynthesis.speak()` without canceling any active utterance first. If a child taps "read aloud" twice quickly, or navigates between stories, the previous utterance continues while the new one starts. On iOS, the default voice sounds robotic. The read-aloud requirement in Active requirements explicitly calls this out as a known bug.

**Prevention:**
1. Always call `window.speechSynthesis.cancel()` before calling `.speak()`.
2. Store the utterance in a `useRef` so it can be stopped on component unmount.
3. Let voice selection be user-configurable: store preferred voice name in `lucac_voice` localStorage key. Default to the first `en-US` voice with "Samantha" or "Google US English" as fallback — both sound natural on iOS/Android.
4. Add a visible "Stop" button while speech is active (a `window.speechSynthesis.speaking` check).

**Phase:** Any phase that touches the Reading game or HomeworkHelper read-aloud feature.

---

### Pitfall 11: localStorage Cache Key Collisions

**What goes wrong:** `cacheSet` prefixes all keys with `lucac_`. Game files that implement their own caching (e.g., `lucac_stories_Yana`, `lucac_fishgame_highscore`) can silently stomp on each other if two agents independently choose the same key name.

**Prevention:**
1. Maintain a `CACHE_KEYS` constant in `shared.js` that lists all localStorage key names. Any new cache key must be added to this list — agents can't guess names in use.
2. Namespace game-specific keys: `lucac_game_fish_${profileId}`, not `lucac_fish_score`.

**Phase:** Low risk until game files start writing their own cache entries.

---

### Pitfall 12: Groq Rate Limit — Shared State Across Tabs

**What goes wrong:** `_rateLimitState` in `utils.js` is a module-level object. If the user has the app open in two browser tabs, each tab maintains its own rate limit countdown. A 429 in Tab 1 does not prevent Tab 2 from immediately firing more requests, burning through the retry window.

**Prevention:** Store `retryAfter` in `localStorage` (key: `lucac_groq_rate_limit`) so all tabs read the same cooldown. The `isRateLimited()` function should check localStorage first, then the in-memory state.

**Phase:** Low priority — already fixed per v25 commit notes, but the multi-tab case is unaddressed.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| LucacLegends split | Duplicate helper functions across game files | Extract shared helpers FIRST into `gameUtils.js` before any splitting |
| LucacLegends split | App.jsx prop explosion | Design a `gameProps` object; treat games as a black box consuming one prop |
| Fish game upgrade | Static difficulty + no progression markers | Implement 3-win/3-loss adaptive ladder + visual level counter before launch |
| Racing game upgrade | Same | Same |
| Reading game + Groq stories | Inappropriate/repetitive content | Strict system prompt + JSON structure contract + fallback to hardcoded pool |
| Board game multiplayer | Firebase write race conditions | Use `update()` not `set()` for all game state; add `runTransaction()` for shared counters |
| Danyells features | Write permissions bypass | `canWrite()` utility + creator-field checks on every `fbSet` call |
| Danyells features | Ambiguous "parent" role | Fix type enum in `shared.js` + use `profile.isCoParent` flag for Danyells-specific gates |
| Kids' home screen | Showing wrong events | Role-filtered `visibleEvents` already exists — use it, don't bypass it |
| Homework Helper long responses | Groq token limit | Use `llama-3.3-70b-versatile` with `maxTokens: 2000` for long-form mode, not 8b-instant |
| Any new game file | Firebase `onValue` listener leak | Require `useEffect` cleanup return in code review / Playwright test navigation |

---

## Sources

- Direct code analysis: `src/App.jsx`, `src/LucacLegends.jsx`, `src/utils.js`, `src/shared.js`, `src/GroqAssistant.jsx`, `src/HomeTab.jsx`
- Project history documented in `CLAUDE.md` (Lessons Learned section, version history)
- Project requirements in `.planning/PROJECT.md`
- Confidence: HIGH — all pitfalls are grounded in observed code patterns and documented prior bugs in this specific codebase, not generic advice
