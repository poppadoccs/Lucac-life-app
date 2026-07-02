# S07: Finish the Phase — verified audit fixes + evidence-backed fun layer

**Goal:** Every confirmed-open, decision-free defect from the 2026-04-30 audits + 2026-05-18 codex probe is fixed at HEAD, and the games gain a grounded fun layer (sound/haptics, per-fact adaptive retrieval, personal bests, Fact Map, Luca's reading runway) — so the learning loop actually works and the games grow with the kids.

**Demo:** Yana (kid profile) clears a Math Monsters world → hears the fanfare, feels the buzz, sees "NEW PERSONAL BEST", her clear PERSISTS across reload, gameHistory writes without a permission toast, Parent Dashboard shows her games, and setting her to "extreme" multiplication actually produces estimation-scale problems.

**Provenance:** Bedrock verification wf_d75868b2-53b (10 verifiers, all findings line-verified at HEAD 602f48d) + Touchstone research wf_81181be9-d1e (cited, adversarially verified). Plan approved by Alex via delegated authority 2026-07-01 ("build whatever u can that doesnt need my decisions... build it because your 100% happy with it"). Dark Queen rename explicitly approved by Alex ("keep it but make it a tiny bit less noticeable").

## Integrity gate

Before executing any task in this plan, verify it contains no `TBD`, `TODO`, `???`, or `<fill in>` markers. If found, STOP — return to the planner with the specific gap. Do not improvise around placeholder text. Line numbers were verified at HEAD 602f48d by bedrock verifiers; re-grep before each edit (the anchor snippets are authoritative, not the line numbers).

## Execution shape

```
WAVE 0 (main thread, sequential — foundation APIs everything else imports)
  utils.js → LearningEngine.js → _shared.js → _powerups.js → aiAgent.js → HomeworkHelper.jsx
  └── vite build gate
WAVE 1 (parallel agents, ONE FILE EACH, zero conflicts)
  A1 MultiplicationMonsters.jsx   A2 FishGame.jsx      A3 RacingGame.jsx
  A4 FractionLine.jsx             A5 ReadingGame.jsx   A6 RPGCore.jsx
  A7 BoardGame.jsx + LucacLegends.jsx                  A8 App.jsx
  A9 GroqAssistant.jsx            A10 FamilyTab.jsx + HomeTab.jsx
  A11 KidsTab.jsx + ParentDashboard.jsx
  └── vite build gate → live Playwright smoke → 3-lens adversarial review → codex → docs → commit → push
```

## Universal rules (every agent, non-negotiable)

1. Never color-only UI — always label/icon/pattern (Alex is deutan colorblind).
2. No new npm deps. No CSS files. Inline styles only. Browser APIs OK (Web Audio, vibrate, Pointer Events).
3. No shame framing: no "X wrong", no sibling comparison, no timed pressure added. Stars = session completion.
4. Every math answer computed by JS, never an LLM. `verifyMath` stays wherever it is.
5. Path-specific Firebase writes for anything kid-concurrent — never whole-tree `kidsData` writes.
6. Match surrounding code style (inline style objects, emoji labels, defensive `?.`).
7. Re-read your file before editing; anchors below are ground truth, line numbers advisory.
8. Do NOT touch: `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, Firebase config in App.jsx, `src/games/MathRacer.jsx`, `src/games/StoryQuest.jsx`, `src/games/WordWarrior.jsx`, `src/games/AvatarCreator.jsx` (wired by A7, not edited), `src/games/board/`.

---

## WAVE 0 — Foundations (main thread)

### W0.1 `src/utils.js`

1. **[C4/G1]** Add `"gameHistory",` to `PARENT_WRITE_PATHS` (after `"rewardsConfig"`) and to `KID_WRITE_PATHS` (after `"learningStats"`) with comment `// S07: kids write their own game completions (recordGameHistory)`. In `canWrite`'s kid block, after the `learningStats` guard and BEFORE the fall-through `return true`, add:
   ```js
   // gameHistory: kids can only write their own subtree
   if (topPath === "gameHistory") {
     const nameSegment = path.split("/")[1];
     return !nameSegment || nameSegment === profile.name;
   }
   ```
2. **[THEME-A]** Add privacy helpers (single source of truth for the 6 duplicated filters):
   ```js
   export function isEventPrivate(ev) { return ev?.isPrivate ?? ev?.private ?? false; }
   export function canSeeEvent(ev, profile) {
     if (!isEventPrivate(ev)) return true;
     if (profile?.type === "admin") return true;
     return (ev.creator ?? "admin") === profile?.name;
   }
   export function filterEventsByPrivacy(eventsObj, profile) {
     if (!eventsObj || !profile) return {};
     if (profile.type === "admin") return eventsObj;
     const filtered = {};
     Object.entries(eventsObj).forEach(([dk, evs]) => {
       const visible = (Array.isArray(evs) ? evs : []).filter(ev => canSeeEvent(ev, profile));
       if (visible.length) filtered[dk] = visible;
     });
     return filtered;
   }
   ```
3. **[JR-SAFETY extract]** Move `SAFETY_RESPONSE_TEXT`, `UNSAFE_INPUT_PATTERNS` (all 45 regexes verbatim), and `detectUnsafeInput` from `HomeworkHelper.jsx:124-186` into utils.js as named exports, keeping the BF-0 comment block. `detectUnsafeInput` gets a type guard: `if (typeof text !== "string" || !text) return false;`.
4. **[JUICE]** Add the sound/haptics engine (~80 lines): lazy `AudioContext` singleton created/resumed inside `playSfx(name)`; recipes — `correct` (2 sine blips 660→880Hz/80ms, gain 0.15), `starReveal` (523/659/784/1047Hz 60ms ascending), `powerup` (triangle sweep 300→900Hz/150ms), `levelClear` (4-note square fanfare, gain 0.12), `tryAgain` (single soft 220Hz sine 120ms, gain 0.07 — warm, never a buzzer), `newRecord` (fanfare + high sparkle 1568Hz). All wrapped in try/catch (never crash a game over audio). `buzz(pattern = [20])` wrapping `navigator.vibrate` in try/catch. Both no-op when `cacheGet("sfxMuted") === true`. Export `isSfxMuted()` and `toggleSfxMuted()` (flips + persists via cacheSet, returns new muted state).

### W0.2 `src/LearningEngine.js`

1. **[C1-LAYER-B]** Import `DIFFICULTY_LEVELS` from `./utils`. `nextProblem` gains 4th param `kidsData`; difficulty resolution becomes: `const parentDiff = kidsData?.[kidName]?.difficulty?.[subjectId]; const autoDiff = mastery > 0.7 ? "hard" : "easy"; const difficulty = DIFFICULTY_LEVELS.includes(parentDiff) ? parentDiff : autoDiff;` (raw read, NOT getKidDifficulty — unset must fall back to mastery-auto, not forced "easy").
2. **[C3+C5]** Replace private `subjectAccuracy` with exported two-tier `subjectStatus(attempts)` (confident ≥3 samples; provisional = 1-2 samples ALL wrong → `{tier:"provisional", accuracy:0, samples}`) + exported compatibility wrapper `subjectAccuracy(attempts)` (confident-tier accuracy or null). Rewrite `getWeakAreas` to return confident-weak (sorted ascending accuracy) then provisional, `.slice(0, 3)`, each entry carrying `tier` and `samples`.
3. **[C6]** `recordAttempt` key becomes `${Date.now()}-${counter}` with module-level `let _attemptCounter = 0; _attemptCounter = (_attemptCounter + 1) % 1000;`. (Do NOT change recordGameHistory's key — ParentDashboard does `Number(ts)` on those.)
4. **[FACTS — touchstone #2]** Add per-fact retrieval engine:
   - `recordFactAttempt(fbSet, learningStats, kidName, a, b, correct)` → writes `learningStats/${kidName}/facts/${a}x${b}` = `{seen: prev.seen+1, correct: prev.correct+(correct?1:0), streak: correct ? prev.streak+1 : 0, lastTs: Date.now()}` reading prev from the learningStats param. Guard all inputs.
   - `pickFact(learningStats, kidName, {tables, bMax = 12})` → candidates = each table × 1..bMax; weights: unseen 3, streak 0 → 4, streak 1-2 → 2, streak ≥3 → `0.5 + Math.min(2, daysSince(lastTs))`; with probability 0.3, pick from the mastered (streak ≥3) set when non-empty (confidence mixes — ~85% success target + Yana needs wins). Returns `{a, b}`.
   - `tableMastery(learningStats, kidName, table)` → `{mastered: count(streak≥3 among table×1..12), total: 12}`.
   - `getFactStreaks(learningStats, kidName, table)` → array of 12 `{b, fact: "TxB", streak}` for the Fact Map.

### W0.3 `src/games/_shared.js`

1. **[C1-LAYER-A]** After `SUPPORTED_SUBJECTS`: `const OPERAND_RANGES = { easy: [2,5], medium: [2,10], hard: [2,12], extreme: [11,99] };` and `const randIn = ([lo,hi]) => lo + Math.floor(Math.random() * (hi - lo + 1));`. In `generateMathProblem`: resolve `const range = OPERAND_RANGES[difficulty] || OPERAND_RANGES.easy;`; multiplication operands → `randIn(range)`; division → `b = randIn(range); answer = randIn(range); a = answer * b;`; both arithmetic-branch conditions gain `|| difficulty === "extreme"`; distractor delta becomes magnitude-aware: `const delta = difficulty === "extreme" ? Math.max(2, Math.round(answer * (0.15 + Math.random() * 0.25))) : Math.floor(Math.random() * 3) + 1;` — extreme distractors are ±15-40% so estimation (not exact computation) discriminates. Update the header comment.
2. **[FACTS]** Add `factChoices(a, b)`: correct = a*b; wrong candidates from real error patterns `[(a+1)*b, (a-1)*b, a*(b+1), a*(b-1), a+b, a*b+10, a*b-10]`, filter positive/unique/≠answer, take 3, Fisher-Yates with answer included → returns `{question: \`${a} × ${b}\`, answer, choices}`.
3. **[PB — touchstone #4]** Add `checkPersonalBest(kidName, game, score)`: reads `cacheGet(\`best_${game}_${kidName}\`)`, if `score > (prev ?? -Infinity)` → cacheSet + return `{isNewBest: prev != null, prevBest: prev, best: score}` (first-ever score sets the baseline WITHOUT a NEW RECORD banner — a record needs something to beat); else `{isNewBest: false, prevBest: prev, best: prev}`. Import `cacheGet, cacheSet` from `../utils`.

### W0.4 `src/games/_powerups.js`

**[FL9]** `generateMathExpr(difficulty = "easy")` — `const MAX = { easy: 9, medium: 19, hard: 49, extreme: 99 }[difficulty] || 9;` for both operands. `spawnDropPair(difficulty = "easy")` threads difficulty into all three `generateMathExpr` calls.

### W0.5 `src/aiAgent.js`

**[JR-SAFETY hook]** Import `detectUnsafeInput, SAFETY_RESPONSE_TEXT` from `./utils.js`. In `runAgentLoop`, immediately after the `isRateLimited()` bail, add:
```js
// S02 BF-0 port: deterministic safety guard — unsafe kid/guest input NEVER reaches the LLM.
// Covers Jr chat + QuickAdd, and the pre-built Jr kid mode before it ships.
if ((appState.userRole === "kid" || appState.userRole === "guest") && detectUnsafeInput(userMessage)) {
  return { type: "text", content: SAFETY_RESPONSE_TEXT, actions: [], conversationHistory };
}
```
Match the surrounding return-shape exactly (verify against the isRateLimited return; keep history UNCHANGED so unsafe text never enters LLM context).

### W0.6 `src/HomeworkHelper.jsx`

**[JR-SAFETY extract]** Extend the utils import with `detectUnsafeInput, SAFETY_RESPONSE_TEXT`; delete the local copies (lines ~124-186). The doAICall hook stays unchanged.

---

## WAVE 1 — Per-file agents

### A1 `src/games/MultiplicationMonsters.jsx`
- **[C1-C]** Import `getKidDifficulty` from `../utils`. Component-level `const difficulty = getKidDifficulty(kidsData, profile?.name, "multiplication");`. `makeProblem(table, curriculum, difficulty = "easy")`: free operand from `B_RANGES = { easy:[1,5], medium:[1,10], hard:[1,12], extreme:[11,99] }`; extreme wrong-answer delta magnitude-spread (same rule as _shared). Update both makeProblem callsites + pass `kidsData` as 4th arg to `nextProblem`.
- **[G3]** Persistent progression: in endBoss win branch write `fbSet(\`kidsData/${profile.name}/mathMonstersTablesCleared/${clearedTable}\`, true)`. `isUnlocked(idx)` → `idx===0 || sessionWins.has(idx-1) || !!kidsData?.[profile?.name]?.mathMonstersTablesCleared?.[WORLDS[idx-1].table]`. Delete local `subjectAccuracy` copy (~92-97) and the accuracy-heuristic unlock; update the stale header comment.
- **[BOSS RETRY]** "Try Boss Again" button → `startBoss()` directly (no more 10-monster regrind).
- **[FACTS — touchstone #2]** Battle problems: use `pickFact(learningStats, kidName, {tables:[currentTable]})` for operand selection + `factChoices(a,b)` for options; in answerBattle call `recordFactAttempt(fbSet, learningStats, profile?.name, a, b, correct)` alongside existing recordAttempt (multiplication problems with known table/operand only).
- **[BOSS REMEMBERS — touchstone #3]** `sessionMissesRef = useRef([])`; wrong branch pushes `{table, operand}` deduped; startBoss front-loads this table's misses (regenerated via factChoices), remainder random; subtitle "The boss knows the tricky ones — show it who's stronger!"; clear table's misses on boss win. NEVER display miss counts/lists.
- **[FACT MAP — touchstone #5]** World tiles show `👑 12/12 facts` when complete else `⭐ {mastered}/12 facts` (via `tableMastery`). New `My Fact Map 🗺️` button on select screen → local phase rendering per-unlocked-table rows of 12 tiles (≥44px): conquered = filled + 👑 + bold border; not-yet = outlined fact text only, NO miss info ("unopened door", never a red mark). Tap conquered tile → `playSfx("correct")`.
- **[TITAN REALMS]** Append 3 WORLDS entries after ×12: `{ table: 13, name: "Titan Peak", emoji: "🗻" }, { table: 14, name: "Star Titan", emoji: "🌟" }, { table: 15, name: "Galaxy Titan", emoji: "🌌" }` (match existing WORLDS shape exactly — copy an existing entry's fields; boss HP etc. consistent). They sit behind the ×12 unlock chain, so they are pure stretch content (Yana's stated gap runs to x15). Any grid/layout math that assumes 11 worlds must handle 14.
- **[PB]** endBoss world-clear: `checkPersonalBest(profile?.name, "monsters", score)` → banner `🏆 NEW PERSONAL BEST!` + `Your old best: {prevBest}` + `triggerConfetti(document.body,"big")` + `playSfx("newRecord")` + `buzz([40,60,40])`.
- **[JUICE]** correct → `playSfx("correct")+buzz([20])`; miss → `playSfx("tryAgain")` (no buzz); boss win → `playSfx("levelClear")+buzz([30,50,30])`.
- **LEAVE ALONE:** the 30s boss timer (Alex's open decision).

### A2 `src/games/FishGame.jsx`
- **[C1-C-FISH]** Import `getKidDifficulty, DIFFICULTY_LEVELS` from `../utils`. Answer-fish spawn: `const fishDiff = getKidDifficulty(kidsData, profile?.name, subject);` → `generateMathProblem(fishDiff, subject)`. Arithmetic bubble/boss sites: `const rawAdd = kidsData?.[profile?.name]?.difficulty?.addition; const arithDiff = DIFFICULTY_LEVELS.includes(rawAdd) ? rawAdd : mathDifficulty;` (preserves Yana's ageBand-hard default when unset). Add kidsData to the two effect deps that list mathDifficulty.
- **[G4]** Import `recordAttempt` from `../LearningEngine`. Stash `subject` + `spawnedAt` on the bubble at spawn; record correct/wrong on answer-fish collisions and on boss answers.
- **[POWER-UP RESTORE]** In the correct answer-fish branch, `applyPowerUp(POWER_UPS[Math.floor(Math.random()*POWER_UPS.length)])` — revives the shield/speed/doubleStars/size system dead since commit 8c93630.
- **[G7]** Unmount cleanup effect clearing speedBoostTimerRef + doubleStarsTimerRef.
- **[SIZE BAR]** Normalize display to the real cap: "Size: X/10", bar fills /10.
- **[PB]** Game-over/collect site: `checkPersonalBest(profile?.name, "fish", fishScore)` + banner/confetti/`playSfx("newRecord")`/buzz.
- **[JUICE]** level advance → `levelClear`; power-up pickup → `powerup`; boss defeat → `levelClear`+buzz.

### A3 `src/games/RacingGame.jsx`
- **[LEADERBOARD REMOVAL]** Delete the Yana-vs-Luca TOP SCORES block (~502-527), its subscription effect (~125-139), leaderboard state, and the now-unused firebase imports. (Violates "No sibling leaderboards. Ever." AND is broken — lowercase path vs capitalized writes.)
- **[C1-C-RACING]** Import `getKidDifficulty, DIFFICULTY_LEVELS`. In the barrier block: `const rawAdd = kidsData?.[profile?.name]?.difficulty?.addition; const barrierDiff = subject === "arithmetic" ? (DIFFICULTY_LEVELS.includes(rawAdd) ? rawAdd : mathDifficulty) : getKidDifficulty(kidsData, profile?.name, subject);` → `generateMathProblem(barrierDiff, subject)`. Add kidsData to the game-loop effect deps.
- **[TIMEOUT DOMINANCE]** Make answering always beat waiting: extend the correct-answer auto-nitro (currently Luca-only) to all kids; barrier timeout resumes at `setRaceSpeed(s => s*0.5)` with NO toast/shame text.
- **[PB]** Race finish: `checkPersonalBest(profile?.name, "racing", raceScore)` + banner/confetti/newRecord/buzz.
- **[JUICE]** star pickup → `correct`; race finish → `levelClear`+buzz([30,50,30]).

### A4 `src/games/FractionLine.jsx`
- **[FL1]** Complete (~792-794) + Victory (~818-820) screens: replace `{totalCorrect} correct out of {questionsAnswered}` with the exact positive block from Game Over (~842-851): "N fractions placed ✓" + "Best streak: 🔥 N in a row" (streak line only when ≥3). Keep Victory's "All 3 levels cleared".
- **[FL2]** Three pointer guards (~585, ~593, ~627): `locked` → `lockedRef.current`.
- **[FL7]** Delete `onClick={handleLineTap}` from the container and the handleLineTap function (pointerdown already places; the synthetic click was silently undoing Magnet snaps).
- **[FL8]** handlePointerUp: capture `wasDragging`, set draggingRef false, release pointer capture UNCONDITIONALLY, then `if (!wasDragging) return;` before the Magnet snap.
- **[FL3]** rAF-throttle handlePointerMove (rafRef; ref update always, setState once/frame); cancel pending rAF in unmount cleanup AND at top of handlePointerUp.
- **[FL9 caller]** `setDrops(spawnDropPair(getKidDifficulty(kidsData, profile?.name, "addition")))`; import getKidDifficulty.
- **[FL6]** Remove unused `rewardsConfig`, `curriculum`, `learningStats` from destructure (kidsData is now used).
- **[PB]** endSession: `checkPersonalBest(profile?.name, "fractions", totalCorrect-final)` + banner/confetti/newRecord/buzz on end screens.
- **[JUICE]** correct feedback → `playSfx("correct")+buzz([20])`; wrong → `tryAgain`; drop tap → `powerup`; endSession star reveal → `starReveal`.
- **LEAVE ALONE:** bestStreak semantics (FL5 — Alex's decision), the streak counter UI, all power-up effect logic.

### A5 `src/games/ReadingGame.jsx`
- **[STAR-FARM GATE]** finishSession: award stars + recordGameHistory ONLY when `pagesCompleted >= 1` (FractionLine's exitSession pattern).
- **[LUCA RUNWAY — touchstone #6]** (a) Append ~6 hand-authored Level-3 passages (vowel teams ai/ee/oa/ea + r-controlled ar/or/er, layered on prior levels) and ~4 Level-4 passages (two-syllable compounds of taught patterns: sunset, backpack, raincoat...) to LUCA_PASSAGES with `level` + `pattern` labels ("vowel-teams" / "multisyllabic"). Decodability rule: ONLY previously-taught patterns + the existing sight words in the current pool. (b) Raise the level cap to 4. (c) Persist: on level-up `fbSet(\`kidsData/${kidName}/readingLevel\`, newLevel)`; initialize level from `kidsData?.[kidName]?.readingLevel || 1`. (d) Full-screen 2.5s LEVEL UP banner ("📖 LEVEL UP! Level 3: Vowel Teams") + big confetti + `playSfx("levelClear")` + buzz.
- **[G12]** Per-pattern attempt subject: `"short-a"/"short-i"/"short-o"` → `reading-3letter`, `digraphs` → `reading-4letter`, `blends` → `phonics-blends`, `vowel-teams`+ → `phonics-vowel-teams`, multisyllabic → `phonics-syllables`; Yana stays `reading-sentence`. Track live passage pattern in state.
- **[G6]** Cache key gains a date: `reading_yana_${kidName}_${new Date().toISOString().slice(0,10)}_${pagesCompleted}` — fresh passages daily.
- **[REAL BUFFS — touchstone #7]** Yana-mode only (all isLucaMode gates stay): Star Surge → next page-complete awards double star (toast "⭐⭐ Double-star page!" + `powerup` sfx); Blind → `filter: blur(3px)` on not-yet-read word spans, un-blur as read; Slow Time → pause the drop-spawn timer while active; Frenzy → fish lunge mood + faster drop fall while active. Delete/replace the "flavor only" TODO comment. Every effect the kid can see must be REAL.
- **[FL9 caller]** `spawnDropPair(getKidDifficulty(kidsData, profile?.name, "addition"))`; import getKidDifficulty.
- **[PB]** Session finish (only when pagesCompleted ≥ 1): `checkPersonalBest(profile?.name, "reading", pagesCompleted)` + banner.
- **[JUICE]** page complete → `correct`; level up → `levelClear`; drop tap → `powerup`.
- **LEAVE ALONE:** Luca single-page sessions, no-drops-for-Luca, no lives for Luca (deliberate zero-shame design; parity options are Alex's decision).

### A6 `src/games/RPGCore.jsx`
- **[DARK QUEEN — Alex-approved]** Boss name `"Danyells"` → `"The Dark Queen"` (drop the separate title or set title to `"Ruler of Shadow Village"`), and the taunt `"DANYELLS ULTIMATE ATTACK! 💅"` → `"DARK QUEEN ULTIMATE ATTACK! 💅"`. Everything else (emoji, HP, attacks, other taunts) unchanged. Verify NO other "Danyells" string remains in kid-visible game content (grep the file).
- **[STARS DISPLAY]** Increment `starsEarned` everywhere addStars fires inside RPGCore (+1 item star, +5 boss victory, +3 celebrate — match the actual addStars amounts at each site) so World Complete / Game Over stop showing "0 stars earned".
- **[STAR STORE]** Store screen: when `rewardsConfig` (prop) has enabled entries, render those (`{id,label,cost,enabled}` → name=label); fall back to `kd.rewards || DEFAULT_REWARDS` only when none configured. Kids finally see the rewards parents actually set.
- **[MUTE TOGGLE]** Header row near the star counter: text button `🔊 Sound` / `🔇 Muted` calling `toggleSfxMuted()` (import from ../utils), local state for label, ≥44px.
- **[JUICE]** victory screen → `levelClear`; store purchase → `starReveal`.
- **LEAVE ALONE:** static adventure content, MathRacer tile (Alex decisions).

### A7 `src/games/BoardGame.jsx` + `src/LucacLegends.jsx`
- **[BOARD STARS]** BoardGame gameover effect: award via the existing `addStars` prop — 3 for winner, 1 for each other participant, each client awarding its OWN player only (mirrors me-scoped recordGameHistory), one-shot ref guard.
- **[ADDSTARS PATH-SPECIFIC]** LucacLegends `addStars` (~line 89): replace the whole-tree `fbSet("kidsData", {...})` with `fbSet(\`kidsData/${profile.name}/points\`, (kd.points||0)+n)` + `fbSet(\`kidsData/${profile.name}/starLog/${ts}\`, {amount:n, reason})`.
- **[AVATAR WIRING]** LucacLegends menu: import AvatarCreator, add `🎨 Draw Avatar` button near the Avatar block (~131-136) opening `<AvatarCreator profile={profile} kidsData={kidsData} fbSet={fbSet} onClose={...} />` (match AvatarCreator's actual prop signature — READ it first); pass `avatarDataUrl` (from `kidsData?.[profile?.name]?.avatarDataUrl`) into the menu Avatar so drawings show on the main menu.

### A8 `src/App.jsx`
- **[THEME-A adoption]** Import `canSeeEvent, filterEventsByPrivacy` from ./utils. `filterEventsForRole` delegates to `filterEventsByPrivacy` (preserve exact current admin/creator semantics). `getEventsInRange` (~663-682) per-event filter → `canSeeEvent(e, currentProfile)`.
- **[M1]** `getDailyBriefingData` (~708-728): filter becomes `canSeeEvent(e, currentProfile)` (fixes the own-private-events drop).
- **[M2]** In executeAgentActions create_calendar_event, before the admin gate: `if (args.isPrivate && !isAdmin) showToast("Private events are admin-only — created as public", "info");`.
- **[KIDSDATA LEAFS]** Writers at ~1105 (AI add_task_for_kid), ~1336 (addKidTask), ~1346 (completeKidTask): whole-tree `fbSet("kidsData", ...)` → per-kid leaf writes (`kidsData/${name}/tasks` array, `kidsData/${name}/points` scalar). Preserve exact data shapes.
- **[C8]** ageBand seed: grade-first (`K/1 → early, 2-5 → standard`), name-match fallback; update comment.
- **[C9]** Seed effect deps: `[profiles, isAdmin, fbSet]`, delete the eslint-disable line.

### A9 `src/GroqAssistant.jsx`
- **[H1]** create_calendar_event (~262): `if (args.isPrivate && userRole === "admin") { eventData.isPrivate = true; eventData.private = true; } else if (args.isPrivate) { results.push(\`⚠️ Private events are admin-only — "${eventData.title}" was created as public.\`); }` (+ showToast info if in scope).
- **[THEME-A adoption]** getEventsInRange (~126-146) + getDailyBriefingData (~207-215): per-event filter → `canSeeEvent(e, ...)` with the profile object available in scope (verify what identity object exists — build one `{type: userRole==="admin"?"admin":userRole, name: userName}` if needed; preserve current behavior exactly).
- **[KIDSDATA LEAF]** add_task_for_kid (~428): whole-tree → `kidsData/${kidName}/tasks` leaf write.

### A10 `src/FamilyTab.jsx` + `src/HomeTab.jsx`
- **[M3]** FamilyTab ~109: `.filter(ev => !ev.private)` → import + use `isEventPrivate`: `.filter(ev => !isEventPrivate(ev))` (keep the line — it enforces the stricter hide-from-everyone shared-grid rule).
- **[L3]** HomeTab saveSparkReaction: derive date from `sparkData?.date || today` for both cacheKey and fbSet path.
- **[BADGE]** HomeTab ~317 lock badge: use `isEventPrivate(ev) && isAdmin` (behavior-preserving refactor).
- **LEAVE ALONE:** sparkReaction key schema (L2 — Alex's decision).

### A11 `src/KidsTab.jsx` + `src/ParentDashboard.jsx`
- **[C2]** ParentDashboard handleRedeemReward: delete newLog/updatedKid construction; write `fbSet(\`kidsData/${kid.name}/points\`, Math.max(0, kidStars - cost))` + `fbSet(\`kidsData/${kid.name}/starLog/${ts}\`, {amount: -cost, reason: "Redeemed: " + (reward.label || "reward")})`.
- **[C3 polish]** Weak-areas list: render text badge `NEW — needs practice` when `tier === "provisional"` (text label, never color-only).
- **[KIDSDATA LEAFS]** KidsTab writers ~28/38/66/72/124/229: whole-tree → per-kid leaf writes (`kidsData/${name}/tasks`, `/goals`, `/points`). Preserve shapes exactly; completeKidTask writes both tasks array AND points scalar as two leaf writes.

---

## Verification (after Wave 1)

1. **Build:** `npm run build` → exit 0, only the known 1MB chunk warning.
2. **Grep gates:**
   - `grep -c "gameHistory" src/utils.js` ≥ 3
   - `grep -c "detectUnsafeInput" src/aiAgent.js` ≥ 2; `grep -c "UNSAFE_INPUT_PATTERNS" src/HomeworkHelper.jsx` = 0
   - `grep -c "Danyells" src/games/RPGCore.jsx` = 0
   - `grep -c "playSfx" src/games` (recursive) ≥ 12
   - `grep -rc "fbSet(\"kidsData\"" src/` = 0
   - `grep -c "yana\", \"luca" src/games/RacingGame.jsx` = 0
3. **Live smoke (Playwright/devtools against `npm run dev`):** kid profile → play MathMonsters world → no permission toast, gameHistory + mathMonstersTablesCleared persist; Settings → set multiplication "extreme" → problems show 2-digit operands with spread choices; Jr as guest-type profile → unsafe input gets deterministic refusal, safe input gets normal reply; FamilyTab shows no private events; ReadingGame Back button with 0 pages → no stars.
4. **3-lens adversarial review** (correctness / regression / kid-UX+policy) on the full diff, then **codex review** (default model+effort).

## Files Modified

| File | Wave | Owner |
|---|---|---|
| src/utils.js, src/LearningEngine.js, src/games/_shared.js, src/games/_powerups.js, src/aiAgent.js, src/HomeworkHelper.jsx | 0 | main thread |
| src/games/MultiplicationMonsters.jsx | 1 | A1 |
| src/games/FishGame.jsx | 1 | A2 |
| src/games/RacingGame.jsx | 1 | A3 |
| src/games/FractionLine.jsx | 1 | A4 |
| src/games/ReadingGame.jsx | 1 | A5 |
| src/games/RPGCore.jsx | 1 | A6 |
| src/games/BoardGame.jsx, src/LucacLegends.jsx | 1 | A7 |
| src/App.jsx | 1 | A8 |
| src/GroqAssistant.jsx | 1 | A9 |
| src/FamilyTab.jsx, src/HomeTab.jsx | 1 | A10 |
| src/KidsTab.jsx, src/ParentDashboard.jsx | 1 | A11 |

## Commit order (atomic, specific paths only — NEVER `git add -A`/`.`)

1. `feat(s07-w0): foundations — gameHistory permissions, privacy helpers, Jr safety guard, difficulty engine, fact engine, sfx engine`
2. `feat(s07-games): per-game fixes + fun layer` (games/* + LucacLegends)
3. `fix(s07-app): privacy consistency, path-specific kidsData writes, redemption race` (App/GroqAssistant/FamilyTab/HomeTab/KidsTab/ParentDashboard)
4. `docs(s07): roadmap checkbox sync + CLAUDE.md architecture refresh + SUPERSEDED banners + this plan`

## Deferred (explicitly OUT of tonight)

C7 gameHistory centralization; L1 dead-code removal (confirmQuickAdd); bundle code-split; whole-tree write classes B-I (needs array→keyed-object migration); ghost car; benchmark-estimation round; encore page; parent digest; Groq passage prefetch; avatar-in-games.

## Decisions for Alex (untouched, awaiting his call)

1. FL5 — best streak: all-time (chaseable record) vs per-session. 2. L2 — sparkReaction per-user vs family-shared. 3. Luca adventure parity (options a/b/c in bedrock READING-LUCA-PARITY). 4. MathMonsters 30s boss timer vs no-timed-pressure rule. 5. MathRacer's tile in the 7-game grid. 6. RPG adventure static content (needs new content design). 7. Dad/Mom identity split (codex P0-2/3).
