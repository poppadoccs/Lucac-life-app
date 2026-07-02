# M001: Migration

**Vision:** A family life management app for a co-parenting household — calendar, AI assistant, nutrition tracking, budget, homework help, and games for the kids.

## Success Criteria

- The kids' experience is magical: games they love and re-open on their own, homework help that actually helps.
- Multi-user safety: role permissions enforced in code (canWrite), private events invisible to non-creators, kid AI input behind a deterministic safety guard.
- The learning loop is real: per-kid difficulty reaches the generators, progress persists, Parent Dashboard reflects actual play.

## Slices

- [x] **S01: Foundation** `risk:medium` `depends:[]`
  > After this: Add two critical utility functions to utils.
- [x] **S02: Kids Homework** `risk:medium` `depends:[S01]`
  > After this: Rebuild the Homework Helper teaching modes and past-sessions UX so Yana and Luca actually get the help they need: long detailed responses on demand, toggleable step-by-step scaffolding, automatic switch to direct explanation after two failed Socratic attempts, a Fun Facts mode that celebrates instead of correcting, and tappable past sessions that load inline.
- [x] **S03: Danyells & AI** `risk:medium` `depends:[S01]` (shipped 2026-04-08, commit 220dea6 — Daily Spark, private events, parent permissions; Spark tips 9167e4c 2026-04-12; verified live in src/HomeTab.jsx by bedrock 2026-07-01)
  > After this: Danyells has a Daily Spark widget, can delete her own events, has full customization options, and the AI assistant handles natural-language event management for all profiles.
- [x] **S04: Game Upgrades** `risk:medium` `depends:[S01]` (shipped 2026-04-09 — B1 fish 99083be, B2 racing 99ad5c1, B3 cross-device BoardGame d148a07, B4 ReadingGame Groq+TTS 1f713f6, avatars 0f0aea9; extended learning-games wave 002498c→602f48d, 2026-04-23→05-17)
  > After this: Fish game has difficulty scaling and boss fish, Racing has multiple tracks and power-ups, Board game is Monopoly-style with cross-device Firebase play, Reading game generates Groq stories with natural TTS, and avatars are drawn on canvas and displayed in games.
- [ ] **S05: Nutrition, Budget & AI Fallback** `risk:medium` `depends:[S01]` (PARTIAL — budget top-features 65faf85 + nutrition TDEE/scoring/streaks/voice fbe19fb shipped 2026-04-09; NOT built: Groq→OpenRouter→Ollama fallback — src/utils.js callAI still wraps Groq only — and per-profile nutrient toggles)
  > After this: Food tab has full MacroFactor-equivalent features with toggleable nutrients and voice logging, Budget tab implements top competitive features, and AI gracefully falls back through Groq → OpenRouter → Ollama without user-visible errors.
- [x] **S06: Education & Integrations** `risk:medium` `depends:[S04]` (built 2026-04-09→12 — waveC1 3a1ce32 LearningEngine+MathRacer+curriculum, C2 52e2231 WordWarrior+StoryQuest, c3 f6c8db5 ParentDashboard, waveD 84cca4d GmailWidget, UAT 085dbc7; WordWarrior/StoryQuest deliberately unwired pending kid-voice ASR)
  > After this: Alex can configure learning curriculum per kid, kids play multiplication speed games and Word Warrior with voice feedback, Story Quest has branching narratives, parent progress dashboard shows learning stats, and Gmail integration enables family coordination.
- [ ] **S07: Finish the Phase — audit fixes + fun layer** `risk:medium` `depends:[S03,S04,S06]` (in progress 2026-07-01→02 — plan at slices/S07/S07-PLAN.md; bedrock-verified audit fixes + touchstone-grounded juice/retrieval/personal-best layer)
  > After this: gameHistory persists for kids, parent-set difficulty actually scales problems, the Jr assistant has the deterministic safety guard, star economy writes are race-free, games have sound/haptics/personal bests, MathMonsters has per-fact retrieval + Fact Map + Titan Realms, Luca's reading has Levels 3-4.
