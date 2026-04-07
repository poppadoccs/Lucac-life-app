# M001: Migration

**Vision:** A family life management app for a co-parenting household — calendar, AI assistant, nutrition tracking, budget, homework help, and games for the kids.

## Success Criteria


## Slices

- [x] **S01: Foundation** `risk:medium` `depends:[]`
  > After this: Add two critical utility functions to utils.
- [x] **S02: Kids Homework** `risk:medium` `depends:[S01]`
  > After this: Rebuild the Homework Helper teaching modes and past-sessions UX so Yana and Luca actually get the help they need: long detailed responses on demand, toggleable step-by-step scaffolding, automatic switch to direct explanation after two failed Socratic attempts, a Fun Facts mode that celebrates instead of correcting, and tappable past sessions that load inline.
- [ ] **S03: Danyells & AI** `risk:medium` `depends:[S01]`
  > After this: Danyells has a Daily Spark widget, can delete her own events, has full customization options, and the AI assistant handles natural-language event management for all profiles.
- [ ] **S04: Game Upgrades** `risk:medium` `depends:[S01]`
  > After this: Fish game has difficulty scaling and boss fish, Racing has multiple tracks and power-ups, Board game is Monopoly-style with cross-device Firebase play, Reading game generates Groq stories with natural TTS, and avatars are drawn on canvas and displayed in games.
- [ ] **S05: Nutrition, Budget & AI Fallback** `risk:medium` `depends:[S01]`
  > After this: Food tab has full MacroFactor-equivalent features with toggleable nutrients and voice logging, Budget tab implements top competitive features, and AI gracefully falls back through Groq → OpenRouter → Ollama without user-visible errors.
- [ ] **S06: Education & Integrations** `risk:medium` `depends:[S04]`
  > After this: Alex can configure learning curriculum per kid, kids play multiplication speed games and Word Warrior with voice feedback, Story Quest has branching narratives, parent progress dashboard shows learning stats, and Gmail integration enables family coordination.
