# Roadmap: Lucac Life App

## Overview

This milestone upgrades the Lucac Life App from a solid v25 base into a polished, multi-user family experience. Phase 1 splits the monolithic game file and hardens security/role infrastructure — the prerequisite that unlocks everything else. Phase 2 completes the kids' experience (the app's core value). Phase 3 delivers Danyells features that make the co-parent feel included and respected. Phase 4 upgrades all four games now that parallel development is safe. Phase 5 rounds out nutrition, budget, and AI resilience as quality-of-life improvements.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Split LucacLegends, harden security/roles, fix TTS — unblocks all parallel work
- [ ] **Phase 2: Kids & Homework** - Kids' home screen, Homework Helper fixes, family calendar views
- [ ] **Phase 3: Danyells & AI** - Daily Spark, Danyells permissions, AI assistant for all profiles
- [ ] **Phase 4: Game Upgrades** - Fish, Racing, Board Game, Reading game upgrades across split files
- [ ] **Phase 5: Nutrition, Budget & AI Fallback** - MacroFactor features, budget research, OpenRouter/Ollama layers
- [ ] **Phase 6: Education & Integrations** - Learning Engine, speed games, Word Warrior, Story Quest, Gmail, progress dashboard

## Phase Details

### Phase 1: Foundation
**Goal**: The codebase is split, security is hardened, and TTS is fixed — enabling all parallel game work and safe multi-user writes
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, CLEAN-02, SEC-01, SEC-02, AI-02
**Success Criteria** (what must be TRUE):
  1. LucacLegends opens and all 5 games play correctly after the file split — no regressions
  2. A non-admin profile (Danyells or kid) cannot write to admin-only Firebase paths, even if they manipulate the UI
  3. Events created by Alex that are marked private do not appear in Danyells' or kids' calendar views
  4. The read-aloud voice in any game uses a natural-sounding voice (not V1 Siri), does not repeat itself, and has a working stop button
  5. The Groq assistant appears and responds for all profiles (not just admin), with role-appropriate tool access
**Plans:** 2/4 plans executed

Plans:
- [x] 01-01-PLAN.md — Shared utilities: speakText TTS helper + canWrite write guard in utils.js
- [x] 01-02-PLAN.md — App.jsx hardening: Firebase imports, fbSet guard, event privacy model (isPrivate + creator)
- [ ] 01-03-PLAN.md — AI role system: per-role tool filtering in aiAgent.js + all-profile assistant + HomeworkHelper TTS cleanup
- [ ] 01-04-PLAN.md — LucacLegends split: extract 5 game components to src/games/, rewrite shell

**UI hint**: yes

### Phase 2: Kids & Homework
**Goal**: The kids' home screen shows their own goals, routines, and family events — and the Homework Helper actually teaches them well
**Depends on**: Phase 1
**Requirements**: HW-01, HW-02, HW-03, HW-04, HW-05, KIDS-01, KIDS-02, KIDS-03, KIDS-04, CAL-01, CAL-02
**Success Criteria** (what must be TRUE):
  1. When Yana or Luca opens the app, their home screen shows family calendar events (not Alex's personal events), their own personal goals, and their own routines with streak tracking
  2. Yana asks the Homework Helper "explain this in detail" and gets a 500+ word response; she can also toggle off step-by-step mode for direct answers
  3. After two Socratic back-and-forth attempts, the Homework Helper switches to directly explaining the concept instead of continuing to prompt
  4. Yana opens a past homework session from last week and reads the full conversation history
  5. The calendar shows week, 2-week, 3-week, and monthly views, and Alex can scroll forward to plan events months in advance
**Plans**: TBD
**UI hint**: yes

### Phase 3: Danyells & AI
**Goal**: Danyells has a personalized home experience, can manage her own events, and the AI assistant is useful for all family members
**Depends on**: Phase 1
**Requirements**: DAN-01, DAN-02, DAN-03, DAN-04, DAN-05, AI-07
**Success Criteria** (what must be TRUE):
  1. Danyells' home screen shows a Daily Spark widget with a self-growth question, a joke, and an interesting fact that rotates daily — she can react with an emoji, no typing required
  2. Danyells can delete an event she created without needing to ask Alex
  3. An event Alex marks private is invisible to Danyells — she cannot see it in any calendar view
  4. Danyells can change her theme, customize her widgets, and manage her contacts without access to admin features like profile management
  5. Alex can tell the AI assistant "add a dentist appointment for Yana next Tuesday at 3pm" and it creates the event via natural language — and can also delete, update, or look up events the same way
**Plans**: TBD
**UI hint**: yes

### Phase 4: Game Upgrades
**Goal**: All four split game files are upgraded with difficulty scaling, content, and the board game is live across devices
**Depends on**: Phase 1
**Requirements**: GAME-01, GAME-02, GAME-03, GAME-04, GAME-05, GAME-06
**Success Criteria** (what must be TRUE):
  1. Luca can win the fish game in 30 seconds on his setting; Yana faces bigger fish, boss fish every 5 levels, and earns unlockables — neither sees a confusing game-over screen at their difficulty
  2. The racing game has at least 2 tracks, car customization/skins, obstacles, and power-ups — Yana can see her best lap time on a leaderboard
  3. Alex, Danyells, Yana, and Luca can all join the board game from different devices, take turns in order (enforced), and use potions as power-ups or traps
  4. The reading game generates a Groq story of 500+ words appropriate for the selected kid's age, and the read-aloud plays with the natural TTS voice from Phase 1 without repeating
  5. Alex can draw Yana and Luca's avatars on a touchscreen canvas, save them, and the avatars appear in the games they play
**Plans**: TBD
**UI hint**: yes

### Phase 5: Nutrition, Budget & AI Fallback
**Goal**: The food tracker has full MacroFactor parity, the budget tracker is informed by competitive research, and the AI falls back gracefully when Groq rate limits
**Depends on**: Phase 1
**Requirements**: NUT-01, NUT-02, NUT-03, BUD-01, BUD-02, BUD-03, AI-04, AI-05, AI-06
**Success Criteria** (what must be TRUE):
  1. Every nutrient in the Food tab can be toggled on or off per profile, and voice logging ("I ate a kiwi 86 grams") auto-logs with estimated macros
  2. The Food tab has full MacroFactor-equivalent features (adaptive calorie suggestions, trend analysis, micronutrient targets)
  3. The Budget tab implements the top 3 features identified from research into competing apps
  4. When Groq hits a rate limit, the AI assistant automatically retries via OpenRouter without any error shown to the user
  5. If OpenRouter also fails, the AI falls back to Ollama on Alex's PC — the user never sees a spinner that never resolves
**Plans**: TBD

### Phase 6: Education & Integrations
**Goal**: A full learning system where Alex sets the curriculum, kids play educational games, and parents track progress — plus Gmail integration for family coordination
**Depends on**: Phase 1, Phase 4 (game infrastructure)
**Requirements**: EDU-01, EDU-02, EDU-03, EDU-04, EDU-05, EDU-06, INT-01
**Success Criteria** (what must be TRUE):
  1. Alex can configure learning topics and difficulty levels per kid from the admin dashboard
  2. Luca and Yana play multiplication speed games with timed challenges and a leaderboard between them
  3. Word Warrior has voice reading with pronunciation feedback; Story Quest has branching narratives requiring reading comprehension
  4. Alex opens the parent progress dashboard and sees each kid's learning stats across all education features, with auto-adjusting difficulty visible
  5. Alex can read and send Gmail from within the app for family coordination
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2/3/4 (parallel) → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/4 | In Progress|  |
| 2. Kids & Homework | 0/TBD | Not started | - |
| 3. Danyells & AI | 0/TBD | Not started | - |
| 4. Game Upgrades | 0/TBD | Not started | - |
| 5. Nutrition, Budget & AI Fallback | 0/TBD | Not started | - |
| 6. Education & Integrations | 0/TBD | Not started | - |
