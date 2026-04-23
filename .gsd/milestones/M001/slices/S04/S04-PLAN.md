# S04: Learning Games Redesign

**Status:** Plan approved 2026-04-23 by Alex. Supersedes the pizza-pie/10-game design in S04-MASTER-PLAN.md (kept as historical reference).

**Why this replaces the master plan:** Research (5 parallel agents + codebase inspection) surfaced that the original design had several evidence-mismatches — pizza pies for fractions, AI-stories for kid phonics, 10-game menu sprawl, and a star/leaderboard economy that would punish a struggling kid. New plan keeps the master plan's architecture rules (one agent one file, zero conflicts) and incorporates Alex's decisions about the star-to-real-reward system and the finger-swipe reading game.

---

## Approved Lineup

| # | Game | Subject | Type | Notes |
|---|------|---------|------|-------|
| 1 | **Racing** | Math drill | Upgrade | Finish in-progress lives work + math barrier timeout + 80px Luca controls + car color customization |
| 2 | **Fish** | Math drill | Upgrade | Finish in-progress lives work + fish-as-answers mechanic (3 answer fish, 2 in Luca mode) |
| 3 | **Math Monsters** | Multiplication + Division (fact families) | Merge + upgrade | Merge `MultiplicationMonsters` + `DivisionDungeon` concept. Strategy-first ordering (x2→x4→x8, x5/x10, x9 trick). Fact-family linking |
| 4 | **FractionLine** | Fractions | NEW | Number-line magnitude game, Slice Fractions-inspired. NOT pizza pies |
| 5 | **Reading** | Reading | Rewrite | Finger-swipe word-by-word mechanic. Same UI for both kids. Luca = decodable phonics. Yana = fluency passages |
| 6 | **Board Game** | Mixed | Upgrade | Potion tiles + trap tiles + 2-4 player support |
| 7 | **Parent Dashboard** | (utility) | NEW | Per-kid stats, weak areas, stars earned, rewards redemption |

**Deferred (not in S04):** `WordWarrior.jsx`, `StoryQuest.jsx` — browser Web Speech API is adult-voice-trained and unreliable for kids under 8. Don't wire until a kid-voice ASR solution is chosen.

---

## Key Decisions

1. **Pies out, number-line in** — Siegler / Slice Fractions evidence
2. **Multiplication + Division = one game** — fact-family pedagogy, not two isolated grinds
3. **Reading = single finger-swipe game** — both kids use same mechanic, content adapts per kid via `curriculum.activeSubjects`
4. **Unified star economy** — earned by *session completion* (not correctness), redeemable for parent-configured real-world rewards in Settings
5. **No streaks. No sibling leaderboards. Ever.** — kid at risk of failing 3rd grade must not see her younger brother ahead of her
6. **Avatar/cosmetics decoupled from performance** — earned by showing up, not by being right
7. **Math is the mechanic** — if stars were stripped, game still fun = correct design
8. **Math post-check mandatory** — per CLAUDE.md 5x10=40 lesson, every game with answer-checking runs `verifyMath()` before displaying answers

---

## Pre-Flight (orchestrator-only, before dispatch)

These 8 surgical edits must land before Wave 1/2 agents launch. Each agent's specs assume this scaffolding exists.

1. **Commit in-progress work** — FishGame + RacingGame lives-system upgrades (coherent mid-session work confirmed by codebase explorer; not aborted)
2. **Wire `learningStats` chain** — App.jsx subscribes to Firebase `learningStats/*`, passes to LucacLegends, which forwards to RPGCore, which includes in `gameProps`
3. **Wire `curriculum` chain** — App.jsx subscribes to Firebase `curriculum/*`, adds to `FB_KEYS`, passes to SettingsTab AND ParentDashboard AND RPGCore (so games can read `activeSubjects`)
4. **Add `verifyMath(text)` helper** — copy HomeworkHelper's proven pattern into utils.js so every game can import it
5. **Add `nextProblem(kidName, subject, difficulty)` wrapper in _shared.js** — pulls from `LearningEngine.nextProblem` when learningStats present, falls back to local generation when not. Games call this instead of inline `makeProblem`
6. **Add unified `addStars(fbSet, kidName, amount, reason)` helper** in utils.js — writes to `kidsData/{kidName}/stars` and `kidsData/{kidName}/starLog` (append-only log of reasons). Games call this on session completion
7. **Add Rewards config section to SettingsTab** — admin/parent UI to set "X stars = Y real-world reward" (data path: `rewardsConfig`)
8. **Add fractions safety comment to _shared.js** — warn that fractions case returns arithmetic, FractionLine must generate its own problems

---

## Waves

**Pre-flight → Wave 1+2 (6 agents in parallel, zero file conflicts) → Wave 3 (1 agent)**

### Wave 1 + 2 (6 parallel agents)

| Agent | File | Task |
|-------|------|------|
| **A1** | `src/games/MultiplicationMonsters.jsx` | Rename component to `MathMonsters`. Merge division. Add fact-family interleaving. Strategy-first world ordering (not 2→3→4→5; use x2→x4→x8 chain, x5/x10 anchors, x9 trick, then derived). Wire `learningStats` + `curriculum.activeSubjects`. Use `verifyMath` + `nextProblem` + `addStars`. |
| **A2** | `src/games/FractionLine.jsx` (NEW) | Number-line fraction magnitude game. SVG horizontal bar, drag fraction piece to position. Start: halves/thirds/fourths. Level up: equivalents. Use `verifyMath` + `addStars`. No pizza pies anywhere. |
| **A3** | `src/games/ParentDashboard.jsx` (NEW) | Kid selector, per-subject accuracy/attempts (from `learningStats`), weak areas (`getWeakAreas`), recent games played, stars earned this week, rewards redemption UI (reads `rewardsConfig`). |
| **A4** | `src/games/FishGame.jsx` | Fish-as-answers: when math problem triggers, spawn 3 answer-labeled enemy fish (2 in Luca mode). Player eats correct-answer fish to pass. Wrong = flash + retry, never punish. Use `verifyMath` + `nextProblem` + `addStars` on level complete. |
| **A5** | `src/games/RacingGame.jsx` | Math barrier 5s timeout (no infinite freeze). Luca mode: 80px lane buttons. Car color customization (6 colors, `kidsData/{kid}/favoriteCarColor`). Use `verifyMath` + `nextProblem` + `addStars`. |
| **A6** | `src/games/ReadingGame.jsx` | REWRITE. Finger-swipe word-by-word mechanic. Word highlights as finger crosses, optional audio. Per-kid content: Luca = decodable phonics passages (hardcoded by level, aligned to phonics scope), Yana = fluency passages (grade-appropriate, can include pre-generated stories). NO AI story generation for Luca mode. `addStars` on page/session completion. |

### Wave 3 (1 agent, after Wave 1+2 complete)

| Agent | File | Task |
|-------|------|------|
| **W1** | `src/games/RPGCore.jsx` | Remove DivisionDungeon/FractionFeast references if any. Add imports for FractionLine + ParentDashboard. Update mini_games menu to 6-game grid (Fish/Racing/Math Monsters/FractionLine/Reading/Board). Add Parent Dashboard button below grid. Highlight games matching `curriculum.activeSubjects` for current kid (visual "★ Today's focus" badge). |

---

## Verification Gate (per agent, non-negotiable)

Every agent's work is rejected unless:

1. **Math correctness** — `verifyMath()` wraps every answer display where the game has computed a correct answer
2. **Problem selection** — adaptive math games call `nextProblem()`, not inline `makeProblem`, when learningStats is populated
3. **Stars** — `addStars()` called on session/page/level completion, NOT per correct answer (kids earn for showing up, not for getting right)
4. **Curriculum respect** — reads `curriculum.activeSubjects` to weight problem types when applicable
5. **No shame** — no timed pressure, no buzzer sounds on wrong, no sibling comparison UI, no streak-loss panic
6. **Dev-server clean** — game launches without console errors in browser
7. **Prop signature** — exact match with what RPGCore passes in Wave 3

---

## Codex Review (final gate)

After Wave 3 completes, Codex reviews the full diff. Looking for: missed verifyMath calls, broken prop chains, regressions in uncommitted protected areas (Firebase transactions, invite codes, jail mechanic), accessibility issues for kid hands (tap target sizes).

---

## Handoff Note for Future Context

If this session gets compacted or a new Claude instance picks this up:
- **Where we are:** [update as we go]
- **What's done:** [list committed changes]
- **What's next:** [next immediate action]
- **Context the next instance needs:** Read this file + read the 5 research reports via `.gsd/milestones/M001/slices/S04/research/` (to be written if context gets tight)

Current state as of plan approval (before any pre-flight): `M src/games/FishGame.jsx`, `M src/games/RacingGame.jsx` uncommitted. Curriculum + learningStats wiring ~60% complete per codebase explorer report. 6 kids games exist functionally, 2 (WordWarrior/StoryQuest) unwired and deferred.
