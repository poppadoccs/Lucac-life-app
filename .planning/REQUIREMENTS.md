# Requirements: Lucac Life App

**Defined:** 2026-04-05
**Core Value:** The kids' experience must be magical — games they love, homework help that actually helps, and a home screen that feels like theirs.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Foundation

- [ ] **FOUND-01**: LucacLegends.jsx split into separate game files (FishGame, RacingGame, BoardGame, ReadingGame, LucacRPG) with thin shell component
- [ ] **FOUND-02**: Shared game constants extracted to gameConstants.js (colors, star values, difficulty curves)
- [ ] **FOUND-03**: `createdBy` field added to all new events, backfilled on existing events where possible
- [ ] **FOUND-04**: Write-side role check utility (`canWrite`) so kids/guests can't write to admin-only Firebase paths
- [ ] **FOUND-05**: Firebase imports extended with `update` and `runTransaction` in App.jsx
- [ ] **FOUND-06**: TTS voice helper added to utils.js (picks best available voice, cancel-before-speak, stop function)

### Homework Helper

- [ ] **HW-01**: Tutor gives long responses (500+ words) when user explicitly asks for detail
- [ ] **HW-02**: Step-by-step toggle (on by default) that user can turn off for direct answers
- [ ] **HW-03**: Frustration detection — after 2 failed Socratic attempts, switch to direct explanation
- [ ] **HW-04**: Past sessions load correctly from Firebase and display previous conversations
- [ ] **HW-05**: Fun Facts mode celebrates all correct-ish answers instead of forcing one specific answer

### Danyells Features

- [ ] **DAN-01**: Daily Spark widget on home screen (self-growth question + joke + interesting fact, rotates daily)
- [ ] **DAN-02**: Emoji reactions on Daily Spark (no typing required, no streaks)
- [ ] **DAN-03**: Danyells can delete events she created
- [ ] **DAN-04**: Alex's private events hidden from Danyells' view
- [ ] **DAN-05**: Full customization options for Danyells (themes, widgets, contacts — minus admin features like profile management)

### Kids Experience

- [ ] **KIDS-01**: Kids' home screen shows family calendar events instead of Alex's personal events
- [ ] **KIDS-02**: Kids get personal goals on their home screen (brushing teeth, reading, etc.)
- [ ] **KIDS-03**: Kids get personal routines with streak tracking on their home screen
- [ ] **KIDS-04**: Avatar finger-drawing restored (canvas with touch, save to Firebase as base64, use in games)

### Game Upgrades

- [ ] **GAME-01**: Fish game difficulty scaling (fish size increases with level, boss fish every 5 levels, power-ups)
- [ ] **GAME-02**: Racing game full upgrade (car customization/skins, destructible obstacles, multiple tracks, power-ups, leaderboard)
- [ ] **GAME-03**: Potion game replaced with family board game (Monopoly-style board, potions as power-ups/traps, 3+ players, cross-device via Firebase)
- [ ] **GAME-04**: Reading game uses Groq-generated stories (500+ words, age-appropriate, capped with content contract)
- [ ] **GAME-05**: Read-aloud voice fixed (best available TTS voice, no repeating, can turn off mid-read)
- [ ] **GAME-06**: Age-split difficulty curves (Luca 6: can win in 30 seconds, no game-over. Yana 8: grinding for unlockables)

### Calendar

- [ ] **CAL-01**: Family calendar supports week / 2-week / 3-week / monthly views
- [ ] **CAL-02**: Calendar scroll through future months to plan events in advance

### AI Assistant

- [x] **AI-01**: Groq personality modes cleaned up (remove sassy/helpful/woke up presets, fresh neutral start)
- [ ] **AI-02**: Groq assistant available on all profiles (not just admin) with role-appropriate responses
- [x] **AI-03**: Groq infinite spinner fixed (rate limit handling + model selection) — DONE this session
- [ ] **AI-04**: OpenRouter fallback layer (auto-switches when Groq rate limits)
- [ ] **AI-05**: Ollama local layer (unlimited AI on Alex's PC, zero rate limits)
- [ ] **AI-06**: Unified callAI function (tries Groq -> OpenRouter -> Ollama automatically)
- [ ] **AI-07**: Groq full powers (add/delete/plan/recover/lookup/verify events and data via natural language)

### Nutrition

- [ ] **NUT-01**: Full MacroFactor feature scrape and replication
- [ ] **NUT-02**: Every nutrient toggleable on/off per profile
- [ ] **NUT-03**: Voice food logging ("I ate a kiwi 86 grams" -> auto-log with macros)

### Education

- [ ] **EDU-01**: Learning Engine with admin-configurable curriculum (Alex sets topics, difficulty, schedule)
- [ ] **EDU-02**: Multiplication speed games (timed challenges, leaderboard between kids)
- [ ] **EDU-03**: Word Warrior voice reading game (read aloud, pronunciation scoring)
- [ ] **EDU-04**: Story Quest (branching narrative where choices require reading comprehension)
- [ ] **EDU-05**: Parent progress dashboard (track each kid's learning across all education features)
- [ ] **EDU-06**: Auto-adjusting difficulty (adapts to each kid's performance over time)

### Budget

- [ ] **BUD-01**: Research top 6 budget apps with CC agents (features, ratings, what works)
- [ ] **BUD-02**: Implement best features from research into BudgetTab
- [ ] **BUD-03**: Category system with visual charts (donut/bar charts per category, monthly comparisons)

### Integrations

- [ ] **INT-01**: Gmail integration (read/send from within the app for family coordination)

### Security

- [ ] **SEC-01**: Role escalation prevention (non-admins cannot change their own role type)
- [ ] **SEC-02**: Event visibility system (createdBy field + role-based read/write filtering end-to-end)

### Cleanup

- [x] **CLEAN-01**: Remove Food tab from kid profiles — DONE this session
- [ ] **CLEAN-02**: Voice/TTS system overhaul (better voice selection, stop button, no repeats — broader than GAME-05)

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Multiplayer

- **MULTI-01**: Cross-device real-time multiplayer for all Lucac Legends games (beyond board game)
- **MULTI-02**: Voice chat during board game via WebRTC

### Future Games

- **FUTURE-01**: Main Lucac Legends story game (after mini games are done and proven)

### Polish

- **POL-01**: Code-split with dynamic import() to get under 500KB bundle warning
- **POL-02**: Firebase Auth (separate Google logins per family member)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Lucac LLC website | Separate project, separate repo |
| PWA push notifications | Future milestone, current toast system works |
| Firebase Security Rules overhaul | Client-side role checks sufficient for family app |
| Cross-platform native app | Web-first, mobile browser works |
| Monetization/payments | Not relevant for family use |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| FOUND-04 | Phase 1 | Pending |
| FOUND-05 | Phase 1 | Pending |
| FOUND-06 | Phase 1 | Pending |
| HW-01 | Phase 2 | Pending |
| HW-02 | Phase 2 | Pending |
| HW-03 | Phase 2 | Pending |
| HW-04 | Phase 2 | Pending |
| HW-05 | Phase 2 | Pending |
| DAN-01 | Phase 3 | Pending |
| DAN-02 | Phase 3 | Pending |
| DAN-03 | Phase 3 | Pending |
| DAN-04 | Phase 3 | Pending |
| DAN-05 | Phase 3 | Pending |
| KIDS-01 | Phase 2 | Pending |
| KIDS-02 | Phase 2 | Pending |
| KIDS-03 | Phase 2 | Pending |
| KIDS-04 | Phase 2 | Pending |
| GAME-01 | Phase 4 | Pending |
| GAME-02 | Phase 4 | Pending |
| GAME-03 | Phase 4 | Pending |
| GAME-04 | Phase 4 | Pending |
| GAME-05 | Phase 4 | Pending |
| GAME-06 | Phase 4 | Pending |
| CAL-01 | Phase 2 | Pending |
| CAL-02 | Phase 2 | Pending |
| AI-01 | -- | Complete |
| AI-02 | Phase 1 | Pending |
| AI-03 | -- | Complete |
| AI-04 | Phase 5 | Pending |
| AI-05 | Phase 5 | Pending |
| AI-06 | Phase 5 | Pending |
| AI-07 | Phase 3 | Pending |
| NUT-01 | Phase 5 | Pending |
| NUT-02 | Phase 5 | Pending |
| NUT-03 | Phase 5 | Pending |
| BUD-01 | Phase 5 | Pending |
| BUD-02 | Phase 5 | Pending |
| SEC-01 | Phase 1 | Pending |
| SEC-02 | Phase 1 | Pending |
| CLEAN-01 | -- | Complete |
| CLEAN-02 | Phase 1 | Pending |
| EDU-01 | Phase 6 | Pending |
| EDU-02 | Phase 6 | Pending |
| EDU-03 | Phase 6 | Pending |
| EDU-04 | Phase 6 | Pending |
| EDU-05 | Phase 6 | Pending |
| EDU-06 | Phase 6 | Pending |
| BUD-03 | Phase 5 | Pending |
| INT-01 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 52 total
- Complete: 3 (AI-03, CLEAN-01, AI-01)
- Mapped to phases: 49 (all pending requirements mapped)
- Remaining: 49

---
*Requirements defined: 2026-04-05*
*Last updated: 2026-04-05 after locking final requirement list (52 total)*
