# Architecture Patterns

**Domain:** Family life management SPA — calendar, AI assistant, nutrition, budget, homework, kids' games
**Researched:** 2026-04-05
**Confidence:** HIGH (based on direct codebase analysis)

---

## Current State Analysis

The codebase is a React 18 + Vite SPA with no routing library. Navigation is pure state (`tab`, `screen`, etc). All application state lives in `App.jsx` and is passed down as props. This is intentional and working — the goal is NOT to change that architecture, but to split `LucacLegends.jsx` into manageable pieces without breaking the existing prop flow.

### What exists now

| File | Lines | Problem |
|------|-------|---------|
| `App.jsx` | ~3,093 | Bottleneck — all state, all tab routing. Can't be edited in parallel. |
| `LucacLegends.jsx` | 2,249 | ALL 5 games + RPG + shared state in one component. |
| `utils.js` | 155 | Simple Groq fetch + cache + helpers. |
| `aiAgent.js` | ~600 | Full agent loop (function calling, tool dispatch, retry). |

### Current `LucacLegends.jsx` internal structure

The file is a single function component `LucacLegends({ profile, kidsData, fbSet })` with:

- **Lines 1–730**: Constants (`WORLDS`, `ITEMS`, `STORIES`, `SCENE_CHOICES`), math generator functions, keyframe CSS strings, five background scene components (`ForestBG`, `CaveBG`, `MountainBG`, `VillageBG`, `VolcanoBG`), shared UI component `GameBtn`
- **Lines 731–920**: All game state declared together (~30 `useState` + 8 `useRef` for fish, racing, potion, reading, co-op, RPG, battle)
- **Lines 920–2249**: Render logic — one long `if (screen === "...")` chain that returns different UIs per screen

The games are coupled by `transitionTo()` (screen switcher), `addStars()` / `awardStars()` (star persistence to Firebase via `fbSet`), and `profile`/`kidsData` props. These are the only real coupling points.

---

## Recommended Architecture

### Pattern: Extract Games as Prop-Driven Components

Each game gets its own file. `LucacLegends.jsx` becomes a **thin shell** — it holds the star wallet, handles screen routing, and renders whichever game component is active. Each game is stateless with respect to the broader app: it receives `profile`, `kidsData`, `fbSet`, and two callbacks (`onBack`, `onComplete(starsEarned)`).

```
LucacLegends.jsx (shell — ~400 lines)
  ├── LucacLegendsMenu.jsx       (game picker + hero avatar display — ~150 lines)
  ├── LucacRPG.jsx               (adventure + battle + world map — ~700 lines)
  ├── FishGame.jsx               (fish eater, touch drag — ~300 lines)
  ├── RacingGame.jsx             (lane racer, gas/brake controls — ~350 lines)
  ├── BoardGame.jsx              (Monopoly-style, cross-device Firebase — ~500 lines NEW)
  ├── ReadingGame.jsx            (story fill-in-blank + Groq stories — ~250 lines)
  ├── CoopGame.jsx               (vs/co-op math battles — ~200 lines)
  └── AvatarCanvas.jsx           (finger-draw avatar, save to Firebase — ~200 lines NEW)
```

This approach:
- Enables 4+ parallel agents each editing a different game file simultaneously
- Does not require touching `App.jsx` at all (LucacLegends props stay identical)
- Does not add React Context or state management libraries
- Is compatible with the existing inline-style + Vite setup

---

## Component Boundaries

### LucacLegends.jsx (shell)

**Responsibility:** Star wallet state, screen routing (`menu`, `rpg`, `fish`, `racing`, `board`, `reading`, `coop`, `avatar`), inject `KEYFRAMES_CSS` once via `<style>` tag, forward `profile`/`kidsData`/`fbSet` to child games, collect star results via `onComplete` callback.

**State it keeps:**
- `screen` — which game is active
- `totalStarsSession` — session star accumulator (for display in menu)

**What it passes down:**
```
profile        — kid identity (name, emoji, color)
kidsData       — current points for all kids
fbSet          — Firebase write function
onBack         — () => transitionTo("menu")
onComplete     — (starsEarned: number) => addStars + return to menu
groqKey        — only for games that use AI (ReadingGame)
```

**Communicates with:** `App.jsx` (receives props, no upward calls except what fbSet handles)

---

### LucacRPG.jsx

**Responsibility:** The adventure/battle RPG. World map, scene choices, boss battles, inventory, HP.

**State:** `hp`, `inventory`, `worldsCompleted`, `currentWorld`, `currentScene`, `bossHp`, `battlePhase`, `floatingTexts`, etc. — all the RPG state currently in LucacLegends.jsx lines 798–820.

**Constants it owns:** `WORLDS`, `ITEMS`, `SCENE_CHOICES`, `DEFAULT_REWARDS`, all background scene components (`ForestBG`, `CaveBG`, etc.), `genMathProblem` (legacy wrapper).

**Communicates with:** `LucacLegends.jsx` via `onComplete(stars)` when world is cleared. Writes directly to Firebase via `fbSet("kidsData", ...)` for star persistence. Uses `profile.name` to key Firebase writes.

---

### FishGame.jsx

**Responsibility:** Touch/click drag to eat smaller fish, grow to size 10.

**State:** `fishSize`, `fishPos`, `fishEnemies`, `fishScore`, `fishActive`, `fishGameOver`, `fishMathBubble`, `fishFlashRed`, `fishPowerMsg` + `useRef` for pos/size/anim/drag.

**Communicates with:** `LucacLegends.jsx` via `onComplete(starsEarned)` and `onBack()`. No Firebase reads — writes only through `onComplete` which triggers the shell's `addStars`.

---

### RacingGame.jsx

**Responsibility:** Lane-based infinite runner with gas/brake touch controls, obstacle avoidance, math barriers.

**State:** `raceLane`, `raceSpeed`, `raceScore`, `raceActive`, `raceObstacles`, `raceStarPickups`, `raceHits`, `raceMathBarrier`, `raceShake`, `raceFrozen`, `raceRoadOffset` + animation refs.

**Communicates with:** `LucacLegends.jsx` via `onComplete(starsEarned)`. Optionally writes game history via `fbSet(`gameHistory/${profile.name}/${Date.now()}`, {...})` — this call can stay inside the game since it already uses `fbSet`.

---

### BoardGame.jsx (NEW — replaces Potion game)

**Responsibility:** Monopoly-style family board game. Cross-device via Firebase Realtime Database.

**Firebase data path:** `boardGame/activeSession` — a single object that ALL devices listen to simultaneously.

**State split — local vs Firebase:**

| State | Where | Reason |
|-------|-------|--------|
| `myPiecePosition` | Firebase | Must sync across devices |
| `allPiecesPositions` | Firebase | Must sync across devices |
| `currentTurnPlayerId` | Firebase | Must sync across devices |
| `boardSquares` (static) | Local constant | Never changes mid-game |
| `diceRollAnimation` | Local | Visual only, not shared |
| `localMessage` | Local | "It's your turn!" toast — per device |

**Firebase sync pattern for BoardGame:**

```js
// On mount — subscribe to live session
useEffect(() => {
  const sessionRef = ref(db, "boardGame/activeSession");
  const unsub = onValue(sessionRef, snap => {
    setGameState(snap.val());
  });
  return () => unsub();
}, []);

// On action — write new state (optimistic)
function rollDice() {
  const newPos = calculateMove(gameState.pieces[myId], diceResult);
  fbSet("boardGame/activeSession", {
    ...gameState,
    pieces: { ...gameState.pieces, [myId]: newPos },
    currentTurn: nextPlayerId
  });
}
```

**Communicates with:** `LucacLegends.jsx` via `onComplete(starsEarned)`. Firebase directly for cross-device sync. Does NOT go through App.jsx for game state.

---

### ReadingGame.jsx

**Responsibility:** Story fill-in-blank reading comprehension. Hardcoded `STORIES` for now; Groq-generated stories as upgrade.

**State:** `readingStory`, `readingSentenceIdx`, `readingScore`, `readingComplete`, `readingWrong`.

**Constants it owns:** `STORIES` (easy + hard variants), `generateMathProblem` (shared helper — move to `utils.js`).

**Groq integration:** When `groqKey` is present, can call `groqFetch` to generate a 500+ word story, then parse it into the fill-in-blank format. Falls back to hardcoded `STORIES` if Groq is unavailable or rate-limited.

**Communicates with:** `LucacLegends.jsx` via `onComplete(starsEarned)`.

---

### CoopGame.jsx

**Responsibility:** Two-player math vs/co-op on the same device. Left side vs right side.

**State:** `coopScoreLeft`, `coopScoreRight`, `coopRound`, `coopProblemLeft`, `coopProblemRight`, `coopVersus`, `coopRoundWinner`.

**Communicates with:** `LucacLegends.jsx` via `onComplete(starsEarned)`. No Firebase needed — same-device only.

---

### AvatarCanvas.jsx (NEW)

**Responsibility:** Finger-draw avatar on HTML5 canvas. Save PNG to Firebase (base64 string). Load in games as player icon.

**Technical approach:**

```js
// Draw on canvas
const canvasRef = useRef(null);
// ... touch/mouse event handlers write to canvas context

// Save — convert canvas to base64, store in Firebase
function saveAvatar() {
  const dataUrl = canvasRef.current.toDataURL("image/png");
  // Stored at: profiles/{name}/avatarDataUrl
  fbSet(`profiles/${profile.name}/avatarDataUrl`, dataUrl);
}
```

**Firebase storage note:** Base64 PNG of a small canvas (200x200px) is ~30-50KB as a base64 string. Firebase Realtime Database strings have a 10MB node limit — this is well within bounds. Firebase Storage (the separate product) is NOT needed and is NOT in the current stack.

**Communicates with:** `LucacLegends.jsx` (and indirectly `App.jsx` which already reads `profiles`) via `fbSet`. Avatar data flows: AvatarCanvas writes → Firebase → App.jsx reads `profiles` → passes `profile` prop which includes `avatarDataUrl` → games display it.

---

### Shared constants/helpers

Move these out of `LucacLegends.jsx` into a `src/gameConstants.js` file:

- `WORLDS`
- `ITEMS`
- `STORIES`
- `SCENE_CHOICES`
- `DEFAULT_REWARDS`
- `generateMathProblem` (currently duplicated as `genMathProblem` and `generateMathProblem`)
- `KEYFRAMES_CSS` (injected once by the shell)
- `GameBtn` component
- `speakText` helper

This eliminates duplication if multiple games eventually use the same data.

---

## AI Calling Paths — Two-Path Coordination

Currently there are two distinct paths for calling Groq:

| Path | File | Pattern | Used For |
|------|------|---------|---------|
| Simple fetch | `utils.js groqFetch()` | Single HTTP call, 10s timeout, rate-limit check | Food tab, Budget tab, Homework Helper, Home tab AI Quick Add |
| Agent loop | `aiAgent.js runAgentLoop()` | Multi-turn function calling, max 5 iterations | GroqAssistant (bby sonnet Jr.) |

**These two paths share rate limit state correctly.** `utils.js` exports `isRateLimited()` and `setRateLimited()`. `aiAgent.js` imports and uses both. `callGroqWithRetry` in `aiAgent.js` also calls `setRateLimited` on 429 responses.

**Recommended pattern — keep them separate, enforce the shared rate limit:**

```
groqFetch (utils.js)
  ├── checks _rateLimitState before any fetch
  ├── sets _rateLimitState on 429
  └── used by: FoodTab, BudgetTab, HomeworkHelper, HomeTab

runAgentLoop (aiAgent.js)
  ├── imports isRateLimited / setRateLimited from utils.js (already done)
  ├── callGroqWithRetry sets rate limit on 429 (already done)
  └── used by: GroqAssistant only

ReadingGame (NEW Groq usage)
  └── uses groqFetch — simpler path is correct for one-shot story generation
```

**Do NOT unify them into a single path.** The agent loop has fundamentally different semantics (multi-turn, tool calling, conversation history). Merging them would add complexity for no benefit. The shared `_rateLimitState` object in `utils.js` is the right coordination point.

**One fix needed:** `callGroqWithRetry` in `aiAgent.js` duplicates the rate-limit 429 handling that `groqFetch` already does. On a 429, both functions set the shared state. This is harmless but redundant. The fix is to have `callGroqWithRetry` import and call `setRateLimited` from `utils.js` (it already does this — confirmed at line 403 of `aiAgent.js`). No action required.

---

## Data Flow

```
Firebase Realtime Database
        |
        | onValue() listeners
        v
App.jsx (holds all Firebase state in useState)
        |
        | props down
        v
   ┌────────────────────────────────────────────────┐
   │  Tab components (HomeTab, FoodTab, KidsTab...) │
   │  Each receives: V, profile, fbSet, groqKey...  │
   └────────────────────────────────────────────────┘
        |
        | Same prop contract
        v
LucacLegends.jsx (shell)
   receives: profile, kidsData, fbSet
        |
        | screen routing + star wallet
        v
   ┌─────────────────────────────────────────────┐
   │  Game components (FishGame, RacingGame...)  │
   │  Each receives: profile, kidsData, fbSet,   │
   │  onBack(), onComplete(stars)                │
   └─────────────────────────────────────────────┘
        |
        | onComplete(starsEarned) callback
        v
LucacLegends.jsx shell calls addStars(n)
        |
        | fbSet("kidsData", {...})
        v
Firebase (persists star total)
        |
        | onValue propagates to App.jsx
        v
App.jsx re-renders, passes updated kidsData down
```

**BoardGame Firebase path (cross-device):**
```
Device A: BoardGame.jsx writes fbSet("boardGame/activeSession", newState)
        |
        v
Firebase Realtime Database
        |
        | onValue fires on ALL connected devices
        v
Device B: BoardGame.jsx receives updated gameState, re-renders
```

BoardGame state does NOT flow through App.jsx. It has its own Firebase path. App.jsx does not need to know about `boardGame/activeSession` — BoardGame subscribes directly.

---

## Suggested Build Order

Dependencies determine order. Each phase can be parallelized within it, but not across phases.

### Phase 1: Extract constants + shell (1 agent, ~2 hours)

Create `src/gameConstants.js` with all constants. Refactor `LucacLegends.jsx` to be the shell. Verify app still works identically.

**Why first:** Every subsequent agent needs the shell and constants to exist before they can work independently. This is the unblocking step.

**Output:** `LucacLegends.jsx` (shell, ~400 lines), `src/gameConstants.js` (~300 lines)

### Phase 2: Extract existing games in parallel (4 agents simultaneously)

Each game extraction is independent after Phase 1.

- Agent A: `FishGame.jsx` (self-contained, no Firebase reads, no Groq)
- Agent B: `RacingGame.jsx` (self-contained, optional Firebase write for history)
- Agent C: `ReadingGame.jsx` + move `STORIES` constant from gameConstants
- Agent D: `CoopGame.jsx` (self-contained)

`LucacRPG.jsx` is larger and more complex — separate agent, may take longer than others.

**Why parallel:** After Phase 1, each game file has no dependencies on the others. They share `gameConstants.js` (read-only) and receive the same prop contract from the shell.

### Phase 3: New game features (parallel after Phase 2)

- `BoardGame.jsx` (new, Firebase cross-device sync — requires Firebase `onValue` directly, not through App.jsx)
- `AvatarCanvas.jsx` (new, canvas + base64 Firebase storage)
- `ReadingGame.jsx` Groq integration (Groq-generated stories via `groqFetch`)
- RPG upgrades (fish difficulty, racing obstacles, power-ups)

**Why after Phase 2:** Building new features into extracted files is far safer than building them into the 2249-line monolith. Phase 2 creates the stable foundation.

### Phase 4: App.jsx bottleneck reduction (optional, last)

If App.jsx needs to be split further (e.g., HomeTab.jsx already exists — confirm it's actually imported), verify all tab components are fully extracted. App.jsx should ideally only contain: Firebase init, all state declarations, the tab router, and prop passing.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Lifting game state into App.jsx

**What goes wrong:** Moving fish position, race score, battle HP etc. into App.jsx to "share state."
**Why bad:** App.jsx re-renders on every game loop tick (60fps for fish movement), causing ALL tab components to re-render. Catastrophic performance.
**Instead:** Keep all game-local state inside the game component. Only star totals flow back up via `onComplete(stars)`.

---

### Anti-Pattern 2: Using React Context for cross-game state

**What goes wrong:** Adding a `GameContext` or `LucacLegendsContext` that wraps all game components.
**Why bad:** Adds a dependency pattern that doesn't match the rest of the app. The rest of the app uses props. Mixing patterns creates confusion. Context is not needed — games communicate only through the thin shell.
**Instead:** Use the callback pattern (`onComplete`, `onBack`). It's explicit and easy to trace.

---

### Anti-Pattern 3: Routing library for games

**What goes wrong:** Adding React Router (or similar) to handle game navigation.
**Why bad:** The entire app deliberately avoids routing libraries to keep the bundle small. Adding a router for just the games section breaks this constraint and adds complexity.
**Instead:** `transitionTo(screen)` in the shell is correct and sufficient. Keep it.

---

### Anti-Pattern 4: Firebase Storage for avatars

**What goes wrong:** Integrating Firebase Storage (the separate blob storage product) for avatar images.
**Why bad:** Requires a new Firebase SDK import, storage bucket setup, CORS configuration, and authentication. Significantly more complexity than needed.
**Instead:** Store avatar as a base64 string in Firebase Realtime Database. A 200x200px drawing is 30–50KB as base64, well within Firebase Realtime Database limits. Already works with the existing `fbSet` helper.

---

### Anti-Pattern 5: Splitting at the wrong granularity

**What goes wrong:** Splitting into too many files (one per background scene, one per game screen, etc.)
**Why bad:** Increases import complexity. The background scene components (`ForestBG`, `CaveBG`, etc.) are small (20–30 lines each). Splitting them out adds file overhead for no parallelism benefit.
**Instead:** Keep background scenes in `LucacRPG.jsx` since only the RPG uses them. Keep `GameBtn` in `gameConstants.js` since all games use it.

---

## Scalability Considerations

| Concern | Now (4 users) | Future (if app grows) |
|---------|---------------|-----------------------|
| Bundle size | Single 3MB+ bundle hits Vite warning | Use dynamic `import()` for LucacLegends — it's only needed on Games tab |
| Firebase reads | All state in one `onValue` listener each | Fine for family-scale; partition paths if needed |
| BoardGame sync latency | Firebase Realtime Database ~100-200ms globally | Sufficient for a turn-based board game |
| Canvas avatar size | 30-50KB base64 per kid | 2 kids = 100KB, trivial |
| Groq rate limits | Already handled via shared `_rateLimitState` | Reading games add one more call path — stays within free tier |

---

## Sources

- Direct analysis of `src/LucacLegends.jsx` (2,249 lines, 2026-04-05)
- Direct analysis of `src/utils.js`, `src/aiAgent.js`, `src/shared.js`
- `.planning/PROJECT.md` — milestone requirements and constraints
- `CLAUDE.md` — architecture constraints (no new dependencies, no routing library, inline styles)
- Firebase Realtime Database documented limits: 10MB per node (string data), real-time `onValue` listeners (HIGH confidence — well-established Firebase API)
- React 18 prop drilling vs Context tradeoffs (HIGH confidence — core React pattern)
- HTML5 Canvas `toDataURL("image/png")` for base64 export (HIGH confidence — standard Web API)
