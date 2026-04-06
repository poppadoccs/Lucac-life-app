# Lucac Life App

## What This Is

A family life management app for a co-parenting household — calendar, AI assistant, nutrition tracking, budget, homework help, and games for the kids. Built as a mobile-first React SPA, used daily by Alex (admin/dad), Danyells (co-parent), Yana (8), and Luca (6). Live at lucac-life-app.vercel.app.

## Core Value

The kids' experience must be magical — games they love, homework help that actually helps, and a home screen that feels like theirs. If the kids don't want to open the app, nothing else matters.

## Requirements

### Validated

- ✓ Monthly calendar with event creation — existing (v14+)
- ✓ Three theme layouts (Skylight/Cozyla/FamilyWall) — existing (v15-v16)
- ✓ Repeating events with virtual expansion — existing (v17+)
- ✓ AI Quick Add bar with voice input — existing (v17+)
- ✓ Routine streaks with confetti — existing (v17+)
- ✓ Food/nutrition tracker (MacroFactor-inspired) — existing (v18+)
- ✓ Budget tracker with Groq parsing — existing (v18+)
- ✓ Homework Helper AI tutor — existing (v18+)
- ✓ Lucac Legends mini-games (5 games) — existing (v20-v23)
- ✓ bby sonnet Jr. AI assistant with 16 tools — existing (v21+)
- ✓ Profile system with admin/parent/kid roles — existing (v21+)
- ✓ Guest/Privacy mode — existing (v21+)
- ✓ Offline resilience with localStorage cache — existing (v25+)
- ✓ Groq rate limit handling + model selection — existing (this session)
- ✓ Food tab hidden from kid profiles — existing (this session)

### Active

- [ ] Homework Helper allows long responses when asked (500+ words)
- [ ] Homework Helper step-by-step toggle (on by default)
- [ ] Homework Helper past sessions work correctly
- [ ] Danyells gets Daily Spark widget (self-growth questions + jokes + facts)
- [ ] Danyells can delete her own events
- [ ] Danyells has full customization options (minus admin features)
- [ ] Alex's private events hidden from Danyells' view
- [ ] Kids get personal goals and routines on their home screen
- [ ] Kids' home shows family calendar instead of Alex's personal events
- [ ] Split LucacLegends into separate game files (FishGame, RacingGame, BoardGame, ReadingGame)
- [ ] Fish game difficulty scaling (bigger fish, levels, boss fish)
- [ ] Racing game full upgrade (customization, obstacles, power-ups, multiple tracks)
- [ ] Potion game remade as family board game (Monopoly-style, cross-device via Firebase)
- [ ] Reading game with Groq-generated stories (500+ words, age-appropriate)
- [ ] Avatar drawing restored (finger-draw, save to Firebase, use in games)
- [ ] Read-aloud voice fixed (no V1 Siri, stop repeating, can turn off)
- [ ] Family calendar views (week/2wk/3wk/monthly + scroll future months)
- [ ] Groq personality modes cleaned up (remove sassy/helpful/woke up, fresh start)

### Out of Scope

- Cross-device multiplayer for Lucac Legends — deferred until mini-games are solid
- OpenRouter/Ollama fallback AI layers — deferred until Groq proves unreliable after fix
- Full MacroFactor feature replication — deferred, current Food tab works
- Budget tracker scrape top 6 apps — deferred to future milestone
- Firebase Auth (separate Google logins) — deferred, current profile system works
- Lucac LLC website — separate project
- PWA push notifications — future milestone

## Context

- **Stack**: React 18 + Vite, Firebase Realtime Database, Groq API (Llama models), inline styles with theme variables
- **Users**: Alex (admin, colorblind), Danyells (parent, needs to be impressed), Yana (8, power user), Luca (6, chaotic genius)
- **Deploy**: Vercel auto-deploy on push to main
- **Dev tooling**: Claude Code with parallel agents, Playwright for testing, GSD for project management
- **Key constraint**: Single App.jsx (~3000 lines) + 6 component files. No routing library. All state in App.jsx.
- **Prior work**: 25+ versions across multiple sessions. Architecture is stable but component files need splitting (especially LucacLegends at 2249 lines)

## Constraints

- **Colorblind**: Never use color alone for UI — always labels, icons, or patterns alongside (Alex is deutan colorblind)
- **Mobile-first**: All buttons >= 44px tap targets. Kids use tablets with touch.
- **Free tier APIs**: Groq free tier has rate limits. Build with rate limit awareness.
- **No new dependencies**: Keep bundle under control. CSS-only solutions preferred.
- **LucacLegends.jsx**: Currently self-contained — needs splitting BEFORE parallel game upgrades
- **File conflicts**: App.jsx is the bottleneck. Minimize concurrent edits to it.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep Groq as primary AI | Already integrated, fast, free tier sufficient after rate limit fix | -- Pending |
| Coarse phases (3-5) | Matches round-based plan from previous session, faster iteration | -- Pending |
| Split games before upgrading | 4 CCs can't edit same file — split enables parallel game work | -- Pending |
| Fix before feature | Groq + Homework Helper fixes before new features (Daily Spark, games) | -- Pending |
| Danyells' approval matters | If she's impressed, the app succeeds. Her requests get priority. | -- Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check -- still the right priority?
3. Audit Out of Scope -- reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-05 after initialization*
