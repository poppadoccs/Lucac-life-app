---
phase: 01-foundation
plan: "04"
subsystem: game-architecture
tags: [refactor, split, lucac-legends, game-components, rpg, fish, racing, board, reading, avatar]
dependency_graph:
  requires: [01-01, 01-02, 01-03]
  provides: [FOUND-01, FOUND-02]
  affects: [src/LucacLegends.jsx, src/games/RPGCore.jsx, src/games/FishGame.jsx, src/games/RacingGame.jsx, src/games/BoardGame.jsx, src/games/ReadingGame.jsx, src/games/AvatarCreator.jsx]
tech_stack:
  added: []
  patterns: [delegation-shell-pattern, per-game-state-isolation, generateMathProblem-inline-per-game, curriculum-prop-interface]
key_files:
  created:
    - src/games/RPGCore.jsx
    - src/games/FishGame.jsx
    - src/games/RacingGame.jsx
    - src/games/BoardGame.jsx
    - src/games/ReadingGame.jsx
    - src/games/AvatarCreator.jsx
  modified:
    - src/LucacLegends.jsx
decisions:
  - "Shell is 156 lines (D-01 satisfied): menu screen + curriculum + addStars + transitionTo + RPGCore delegation only"
  - "RPGCore owns all RPG screens and mini-game delegation; mini-game files own their own state; generateMathProblem inlined per game (D-05)"
  - "lastBarrierTime/lastObstacleTime/lastStarTime moved to useRef in RacingGame — let-scoped vars reset on every useEffect re-mount when raceFrozen dep changes"
  - "RPG SCENE_CHOICES shuffle hoisted to useMemo keyed on [currentWorld, currentScene, currentSceneType] — fixes always-correct-first-button bug"
  - "Fish game rebalanced for 6-year-old reaction time: starting size 5, danger bias 15%, spawn 2.5s, 1s invincibility after hits"
  - "Racing rebalanced after barrier-ref fix exposed real difficulty: max speed 6, accel 0.1, first barrier backdated 10s"
metrics:
  duration: "~45 minutes (including two post-checkpoint fix rounds)"
  completed: "2026-04-06"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 7
requirements_addressed: [FOUND-01, FOUND-02]
---

# Phase 1 Plan 04: LucacLegends Split — Thin Shell + 6 Game Components

## One-liner

2728-line LucacLegends.jsx monolith split into a 156-line navigation shell delegating to RPGCore.jsx plus 5 standalone mini-game components, with two rounds of post-split gameplay bug fixes verified and approved by Alex.

## What Was Built

### Task 1: 6 new game component files in src/games/

Created the `src/games/` directory with 6 component files extracted from the 2728-line monolith:

**src/games/RPGCore.jsx** (~600 lines) — the largest extraction. Contains:
- All RPG screens: world_select, adventure, battle, victory, game_over, store, chores, mini_games menu, coop/versus
- All RPG state: currentWorld, currentScene, hp, maxHp, inventory, worldsCompleted, choiceResult, emotion, avatarAnim, battleState, storeItems, choresList, floatingTexts, impactText, shakeScreen, all coop state
- All shared display components: GameBtn, Avatar, HPDisplay, BossHPBar, FloatingText, ImpactText, InventoryBar, SceneBG, ForestBG, CaveBG, MountainBG, VillageBG, BossArenaBG, VictoryBG
- All RPG constants: MAX_HP, WORLDS, ITEMS, SCENE_CHOICES, DEFAULT_REWARDS, KEYFRAMES_CSS
- Helper functions: generateMathProblem, genMathProblem, addItem, takeDamage, getAttackPower, canDodge, healFromPotions, addFloatingText, showImpact
- Mini-game delegation: imports FishGame, RacingGame, BoardGame, ReadingGame and routes to them when screen matches
- Internal navigation via `localTransitionTo` (fade animation + setScreen); calls shell's `transitionTo("menu")` to exit

**src/games/FishGame.jsx** (~230 lines) — Fish Eater game (originally lines 2192-2410):
- Own state: fishSize, fishPos, fishEnemies, fishScore, fishActive, fishGameOver, fishMathBubble, fishFlashRed, fishPowerMsg + refs
- Standard props interface: `{ profile, kidsData, fbSet, addStars, transitionTo, curriculum }`
- `curriculum.isLucaMode` and `curriculum.mathDifficulty` from props (not recomputed)
- Imports `speakText` from `"../utils"` for math power-up voice feedback (D-11)

**src/games/RacingGame.jsx** (~220 lines) — Racing game (originally lines 2051-2191):
- Own state: raceLane, raceSpeed, raceScore, raceActive, raceObstacles, raceStarPickups, raceHits, raceMathBarrier, raceShake, raceFrozen, raceRoadOffset + refs
- `lastBarrierTime`, `lastObstacleTime`, `lastStarTime` as useRef (critical — prevents reset on effect re-mount)
- generateMathProblem inlined per D-05

**src/games/BoardGame.jsx** (~130 lines) — Potion/Board game (originally lines 2411-2480):
- Own state: potionRound, potionScore, potionProblems, potionChosen, potionResult, potionComplete
- Phase 4 placeholder — will become the Monopoly-style board game; potion game is fully functional in the interim

**src/games/ReadingGame.jsx** (~180 lines) — Reading game (originally lines 2481-2598):
- Own state: readingStory, readingSentenceIdx, readingScore, readingComplete, readingWrong
- STORIES constant inlined (only reading game uses it, per D-05)
- Imports `speakText` from `"../utils"` for read-aloud (D-11)

**src/games/AvatarCreator.jsx** (32 lines) — Avatar display component (originally lines 570-699):
- Avatar display with EMOTION_MAP constant
- Display-only; canvas finger drawing is Phase 2 KIDS-04

### Task 2: LucacLegends.jsx rewritten as thin shell (156 lines, D-01)

Shell retains only:
1. Imports: React hooks, RPGCore from `./games/RPGCore`, speakText from `"./utils"`
2. Menu screen: game title, session stars, Start Adventure / Mini Games / Star Store / My Chores buttons, quick stats
3. Shell state: `screen` and `fadeIn` only
4. Curriculum computation: `{ isLucaMode, mathDifficulty, kidAge }` computed once from profile name (D-04)
5. `addStars(n)`: writes star awards to Firebase via fbSet
6. `transitionTo(newScreen)`: fade animation + screen state change
7. Screen dispatch: menu renders inline, everything else passes to `<RPGCore initialScreen={screen} />`

Removed from shell: all fish/racing/potion/reading/RPG state declarations; all screen rendering blocks except menu; local `function speakText(text)` (D-11 — now imported from utils.js).

App.jsx import of LucacLegends is unchanged.

### Task 3: Human verification — APPROVED

Alex tested all games in the dev server after two rounds of bug fixes and confirmed approval: "approved".

## Commits

| Hash | Description |
|------|-------------|
| `1a947cb` | feat(01-04): extract 6 game components to src/games/ |
| `3502ea3` | feat(01-04): rewrite LucacLegends.jsx as thin shell (156 lines, D-01) |
| `74e7cb2` | fix(01-04): three gameplay bugs found during Phase 1 verification |
| `11e08e9` | fix(01-04): rebalance racing + fish games after first-pass fix exposed latent difficulty |

## Verification Results

- All 6 files in src/games/ with correct exports: PASS
- LucacLegends.jsx is 156 lines (under 200, D-01): PASS
- Shell contains `import RPGCore`: PASS
- Shell contains no fish/racing/potion/reading/RPG state: PASS
- Shell contains no adventure/battle screen rendering: PASS
- Shell contains no local speakText: PASS
- `npm run build`: PASS (pre-existing 500KB chunk warning is out of scope per CLAUDE.md)
- Human verification by Alex: APPROVED

## Deviations from Plan

### Post-checkpoint Bug Fixes (Round 1) — commit 74e7cb2

Three gameplay regressions were found during human verification. Fixed under Rule 1 (bug fix — broken behavior).

**[Rule 1 - Bug] Racing: barrier timer reset on every math solve**
- **Found during:** Task 3 human verification
- **Issue:** `lastBarrierTime`, `lastObstacleTime`, `lastStarTime` declared with `let` inside the component body. The racing animation `useEffect` depends on `raceFrozen`. Every time the player answered a math barrier, `raceFrozen` flipped, the effect unmounted/remounted, and all three `let` vars reset to 0 — causing a new barrier to spawn instantly after every correct answer.
- **Fix:** Moved all three timing vars to `useRef`. Refs persist across effect re-mounts.
- **Files modified:** src/games/RacingGame.jsx
- **Commit:** 74e7cb2

**[Rule 1 - Bug] RPG: correct answer was always the first button**
- **Found during:** Task 3 human verification
- **Issue:** `SCENE_CHOICES.options` declared with `correct: true` at index 0. Options were not shuffled — player could always tap the first button to win every scene.
- **Fix:** Hoisted a `useMemo` shuffle of `SCENE_CHOICES.options` to the top of RPGCore, keyed on `[currentWorld, currentScene, currentSceneType]`. Shuffle runs on scene change, not every render.
- **Files modified:** src/games/RPGCore.jsx
- **Commit:** 74e7cb2

**[Rule 1 - Bug] Fish: eager spawn on mount and excessive danger bias**
- **Found during:** Task 3 human verification
- **Issue:** An eager `spawn()` call on mount created a swarm of enemies immediately. Danger bias was 40% — too many dangerous fish for a 6-year-old to manage.
- **Fix:** Removed eager spawn call on mount; reduced danger bias from 40% to 30%.
- **Files modified:** src/games/FishGame.jsx
- **Commit:** 74e7cb2

### Post-checkpoint Bug Fixes (Round 2) — commit 11e08e9

Fixing the barrier-reset bug in Racing revealed the game's existing difficulty values were secretly tuned around the broken behavior (the barrier bug was resetting speed to 0 on every solve, acting as an accidental difficulty brake). Similarly, the Fish spawn fix showed the remaining settings were still too hard for Luca (age 6).

**[Rule 1 - Bug] Racing: difficulty exposed after barrier-ref fix**
- **Found during:** Post-Round-1 retest
- **Issue:** Max speed 10, acceleration 0.15, obstacle movement `spd*2`. These values only worked in the broken state where barriers kept resetting speed. After the fix, the game was nearly unplayable.
- **Fix:** Max speed 10→6, acceleration 0.15→0.1, obstacle movement `spd*2`→`spd*0.8`, first barrier backdated by 10s so math appears at ~10s of gameplay (gentle ramp-up).
- **Files modified:** src/games/RacingGame.jsx
- **Commit:** 11e08e9

**[Rule 1 - Bug] Fish: still too difficult for age-6 after Round 1**
- **Found during:** Post-Round-1 retest
- **Issue:** Game was still too hard for Luca (age 6) — starting fish size too small, enemies too fast, too many dangerous fish, no forgiveness on hits.
- **Fix:** Starting size 3→5, danger bias 30%→15%, enemy speed range 0.3-1.3→0.2-0.7, spawn interval 1.5s→2.5s, first math bubble 8s→3s, added 1s invincibility after hits, max enemies 10→8. Designed for a 6-year-old's reaction time.
- **Files modified:** src/games/FishGame.jsx
- **Commit:** 11e08e9

### Minor: worldsCompleted in shell menu always shows 0

The shell's menu shows "Worlds Beaten" using a local `worldsCompleted` state that starts at 0. RPGCore has its own `worldsCompleted` for unlock logic. These are not synced. This is not a regression — the original monolith also used session-only state for this stat (not persisted to Firebase). Cross-component session sync is out of scope for this split plan.

### Minor: KEYFRAMES_CSS duplicated in shell and RPGCore

Both files contain the keyframe CSS for animations. The shell only needs a few keyframes for the menu, but including all is harmless and avoids a shared dependency (per D-05: no extra abstractions). Duplication is ~20 lines total.

## Known Stubs

- **BoardGame.jsx** is currently the Potion Brewing game — intentional per plan. Explicitly noted as the Phase 4 placeholder for the Monopoly-style board game. Potion game is fully functional.
- **worldsCompleted in shell menu** always shows 0 (session state not synced across shell/RPGCore boundary). Cosmetic only — RPGCore unlock logic is correct.

## Self-Check: PASSED

Files exist:
- src/games/RPGCore.jsx — FOUND
- src/games/FishGame.jsx — FOUND
- src/games/RacingGame.jsx — FOUND
- src/games/BoardGame.jsx — FOUND
- src/games/ReadingGame.jsx — FOUND
- src/games/AvatarCreator.jsx — FOUND
- src/LucacLegends.jsx — FOUND (modified, 156 lines)
- .planning/phases/01-foundation/01-04-SUMMARY.md — this file

Commits exist:
- 1a947cb — FOUND (feat(01-04): extract 6 game components)
- 3502ea3 — FOUND (feat(01-04): rewrite thin shell)
- 74e7cb2 — FOUND (fix(01-04): three gameplay bugs)
- 11e08e9 — FOUND (fix(01-04): rebalance racing + fish)
