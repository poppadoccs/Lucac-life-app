# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules
- Before writing ANY code, read the Lessons Learned section first
- Always validate and coerce data types after parsing external API responses
- Every time a bug is found and fixed, add a Lessons Learned entry using this format:

### YYYY-MM-DD: Short title
- WHAT WENT WRONG: describe the bug
- ROOT CAUSE: why it happened
- FIX: what solved it
- RULE FOR NEXT TIME: the permanent rule to prevent it from ever happening again

- Read ALL Lessons Learned entries before starting any task
- These rules apply to EVERY project in this repo, not just Groq

## Critical Rules

- **Edit `src/App.jsx`, `src/LucacLegends.jsx`, and any `src/*.jsx` component files** — NEVER touch `package.json`, `vite.config.js`, `index.html`, or `src/main.jsx`
- **Component files allowed**: Split features into `src/FoodTab.jsx`, `src/BudgetTab.jsx`, `src/HomeworkHelper.jsx`, `src/utils.js`, etc. and import into App.jsx
- **Firebase config stays hardcoded in App.jsx** — never move it to environment variables
- **Push command**: `git add . && git commit -m "description" && git push`
- **Alex is colorblind** — never give color-only UI instructions; always use labels, icons, or patterns alongside color
- **Danyells (ex) will judge this app** — always build it looking polished and professional
- **Current version**: v25 — live at lucac-life-app.vercel.app
- **11 MCPs connected**: GitHub, Playwright, Context7, Filesystem, Memory (active) + Sentry, Vercel, Zapier, Puppeteer, Reddit, WhatsApp (need API keys)
- **Commit co-author**: Sonnet kicked Dad (Opus) out of commit credits. Use `Co-Authored-By: Claude Sonnet <noreply@anthropic.com>`

## Claude Code Setup

- **Model**: Claude Opus 4.6 (1M context) with Sonnet co-author line
- **MCPs**: GitHub (gh CLI), Playwright (browser testing), Context7 (library docs), Filesystem, Memory + 6 more needing API keys
- **Plugins**: Superpowers (brainstorming, plans, TDD, debugging, code review)
- **Parallel agents**: Used extensively — up to 3 sub-agents building component files simultaneously while main thread edits App.jsx. Wave-based builds (Wave 1 → test → Wave 2 → test → Wave 3 → test)
- **PowerShell**: All commands must be PowerShell-compatible (no `&&` operator, use `;` or separate commands)

## Version History (this session)

| Version | Commit | What Changed |
|---------|--------|-------------|
| v14 | `3c5000a` | Calendar redesign: big monthly grid, CSS variables (`V` object), light Skylight theme |
| v15 | `6f7821d` | Theme switcher: Skylight/Cozyla/FamilyWall with Firebase persistence |
| v16 | (merged) | Each theme gets a unique HOME tab layout (Skylight=month grid, Cozyla=day timeline, FamilyWall=widget grid) |
| v17 | `c61e32c` | Repeating events, color swatches, widget customization, AI Quick Add, resizable blocks |
| v18 | `ab43275` | MEGA BUILD: 10 features, 3 component files (FoodTab, BudgetTab, HomeworkHelper), utils.js |
| v19 | `205c207` | Full audit: theme parity fixes, 35+ hardcoded colors replaced, Cozyla/FamilyWall feature parity |
| v20 | `4a3cbc4` | 15 bug fixes + LucacLegends overhaul (avatar, 5 worlds, CSS scenes) + HomeworkHelper upgrades |
| v21 | `9bc3ee7` | bby sonnet Jr. assistant, budget overhaul, kid profiles, 14 features |
| v22 | `1666858` | Lucac Legends mini-games: Racing, Fish Eater, Potions, Reading, Co-op |
| v23 | `eff1e54` | Versus mode, manual racing controls, PWA installable |
| v24 | `a7fd07d` | Full audit round 2: 10 bugs fixed, GroqAssistant rewrite with confirmations |
| v25 | `02a703a` | Playwright automated audit: 8 bugs fixed, displayEvents architectural refactor, favicon, edit/delete buttons |

## Build & Dev Commands

- `npm run dev` — Start Vite dev server
- `npm run build` — Production build
- `npm run preview` — Preview production build

No test framework or linter is configured.

## Architecture

Single-page React 18 app built with Vite. 8 source files in `src/`:

| File | Lines | Purpose |
|------|-------|---------|
| `src/App.jsx` | ~3,093 | Main shell: Firebase init, all state, routing, themes (`V`/`THEMES`), 3 home layouts, calendar with `displayEvents` dedup layer, settings, kids, family tabs. Imports all component files. |
| `src/FoodTab.jsx` | ~1,141 | MacroFactor-style nutrition: SVG macro rings, 4 meal sections, AI voice logging, weight trend chart, micronutrient bars, shopping list, goal modes |
| `src/BudgetTab.jsx` | ~1,458 | Budget tracker: Groq-powered expense parsing, SVG donut chart, custom categories, period views, Dad vs Mom weeks, bulk delete, summaries |
| `src/GroqAssistant.jsx` | ~1,282 | bby sonnet Jr.: floating AI assistant with full app powers, Tavily web search, 3 personalities, mood system, preview confirmations |
| `src/HomeworkHelper.jsx` | ~746 | AI tutor: kid selector, 4 subjects, age-appropriate responses, read-aloud, math verification, 20-msg rate limit, session saving |
| `src/LucacLegends.jsx` | ~2,249 | RPG game + mini-games: 5 worlds, avatar system, Racing, Fish Eater, Potions, Reading, Versus, Co-op (self-contained, do NOT modify) |
| `src/utils.js` | ~122 | Shared helpers: `groqFetch` (10s timeout), `parseGroqJSON`, `cacheGet`/`cacheSet` (localStorage), `triggerConfetti` (CSS-only), `createSpeechRecognition`, `SWATCH_COLORS` |

`src/main.jsx` renders `<App />` into the root.

## All Features (v25)

### Home Tab (all 3 themes have feature parity)
- AI Quick Add bar with 🎤 voice mic button (Web Speech API → Groq)
- Update-existing events via natural language ("make muffin events red")
- Big monthly calendar (Skylight), day timeline (Cozyla), widget grid (FamilyWall)
- Repeating events: daily/weekly/monthly with end date or occurrence count, 🔁 icon. Events stored ONCE at base date, expanded virtually via `displayEvents` layer with title+time dedup
- Routines with 🔥 streak tracking (3-day small confetti, 7-day big + STREAK MASTER toast, 30-day 👑 crown)
- Goals with ✨ AI Suggest button (Groq suggests 5 goals, one-tap add)
- Widget customization: rename/hide routines, goals, stats per profile
- 🎂 Birthday countdowns with gold glow within 7 days, full confetti on the day
- Daily motivational quote (Groq)

### Food Tab (`src/FoodTab.jsx`)
- Configurable dashboard hat: Daily rings / Weekly bars / Energy balance
- 4 SVG macro progress rings (Calories blue, Protein red, Carbs yellow, Fat purple)
- 4 collapsible meal sections (Breakfast/Lunch/Dinner/Snacks) with per-meal calorie totals
- AI food search (Groq estimates macros per 100g from USDA data)
- AI voice food logging (speak naturally, Groq extracts food items + macros)
- Meal memory (last 10 foods, tap to re-log)
- Goal modes: Lose/Maintain/Gain with aggressiveness slider
- Weight trend chart (SVG line + 7-day moving average)
- Micronutrient bars (Fiber, Sodium, Sugar, Iron, Vitamin C) with floor/target/ceiling
- Shopping list (manual + auto-detect from voice)
- Adherence-neutral language throughout (never "failed" or "over budget")

### Kids Tab
- Emoji task icons: 30-emoji picker, large 120px cards, tap to complete with confetti
- Only admin can add/edit/delete tasks; kids can only complete
- 📚 Homework Helper: age-appropriate AI tutor, subject buttons, voice input, 20-msg limit, safety prompt, session history saved to Firebase

### Family Tab
- Custody schedule (tap to cycle Dad/Mom/Free)
- House rules (My Rules / Their Rules / Shared)
- Exchange log (admin only)
- 💰 Budget sub-tab: Groq expense parsing, SVG donut chart, 9 categories with emoji, monthly limits, recurring expenses, Dad vs Mom week spending, copy summary

### Settings Tab
- Profile management with color picker and 🎂 birthday picker (month + day)
- 🎨 Theme switcher (Skylight/Cozyla/FamilyWall) with live preview swatches
- Contact numbers, alert timing
- All settings persist to Firebase

### Infrastructure
- **Guest/Privacy Mode**: button on profile screen, hides Family/Settings, shows 👁️ badge, PIN to exit, memory-only (resets on reload)
- **Offline resilience**: `navigator.onLine` detection, header indicator (✦ Live / ⚠ Offline), localStorage cache for all Firebase reads, graceful write queueing
- **Toast notifications**: success/error/info with auto-dismiss
- **AI error handling**: all Groq calls use `groqFetch` with 10s `AbortController` timeout, try/catch, friendly toast on failure, never crashes
- **Confetti**: CSS-only (no library), `triggerConfetti("small"/"big")` from utils.js
- **Voice input**: Web Speech API, auto-stop after 10s silence, red pulse while recording, hidden if browser unsupported

## Key Technical Details

- **Firebase**: Initialized directly in `App.jsx` with hardcoded config. Uses `firebase/database` (Realtime Database) with `ref`, `set`, `onValue`. The `fbSet` helper is passed as prop to all component files.
- **External API keys**: `import.meta.env.VITE_GROQ_KEY` and `import.meta.env.VITE_TAVILY_KEY`. Passed as props to components.
- **No routing library**: Navigation via React state (`tab`, `familySubTab`, `foodSubTab`, etc.)
- **Mobile-first**: All buttons ≥44px tap targets. Viewport meta disables zoom.
- **All styles are inline**: No CSS files. All styling via inline style objects referencing `V.*` theme variables.
- **CSS Variables**: `THEMES` object at top of App.jsx defines 3 themes. Active theme = `V` object. All components receive `V` as prop. ~35 hardcoded colors were replaced with `V.*` references in the v19 audit.
- **Firebase data paths**: events, eventStyles, routines, goals, profiles, kidsData, custodySchedule, myRules/theirRules/sharedRules, exchangeLog, foodLog, myFoods, nutritionGoals, weightLog, shoppingList, budgetData, homeworkSessions, widgetPrefs, themeName, alertMinutes, contacts
- **displayEvents layer** (v25): Computed object that expands repeat events virtually and deduplicates by title+time. All display code uses `displayEvents[dk]`, all write code uses raw `events`. Virtual events carry `_baseDk`/`_baseIdx` for source reference.
- **Event edit/delete** (v25): Admin can edit (pre-fills form) and delete (with `window.confirm()` warning about series) existing events in the day detail popup
- **Favicon**: `public/favicon.svg` — gold crown on amber background

## Next Session Roadmap

- Firebase cleanup: delete 3 duplicate "Eating wings" entries (old corrupt data with different times)
- Cross-device multiplayer for Lucac Legends
- Lucac LLC website (professional landing page)
- Configure MCP API keys: Sentry, Vercel, Zapier, Reddit, WhatsApp
- Add adaptive calorie suggestions (after 14 days of weight + food data)
- Performance: code-split with dynamic `import()` to get under 500KB warning

## Lessons Learned

### 2026-03-16: Groq tool argument types
- **WHAT WENT WRONG**: Groq returns `"false"` (string) instead of `false` (boolean), `"60"` (string) instead of `60` (number)
- **ROOT CAUSE**: Groq's function calling serializes all argument values as strings regardless of the declared type in the schema
- **FIX**: Added type coercion after `JSON.parse` — convert string booleans and string numbers to real types
- **RULE FOR NEXT TIME**: Always coerce tool call arguments after parsing — never trust that an LLM API returns correct JSON types

### 2026-03-16: Tool schema validation
- **WHAT WENT WRONG**: Two tools missing `required:[]` arrays broke ALL 16 tools
- **ROOT CAUSE**: Groq validates every schema before processing — one bad schema rejects the entire request
- **FIX**: Added `required:[]` to every tool definition
- **RULE FOR NEXT TIME**: Every tool definition MUST have `parameters.type`, `parameters.properties`, and `parameters.required` (even if empty array)

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Lucac Life App**

A family life management app for a co-parenting household — calendar, AI assistant, nutrition tracking, budget, homework help, and games for the kids. Built as a mobile-first React SPA, used daily by Alex (admin/dad), Danyells (co-parent), Yana (8), and Luca (6). Live at lucac-life-app.vercel.app.

**Core Value:** The kids' experience must be magical — games they love, homework help that actually helps, and a home screen that feels like theirs. If the kids don't want to open the app, nothing else matters.

### Constraints

- **Colorblind**: Never use color alone for UI — always labels, icons, or patterns alongside (Alex is deutan colorblind)
- **Mobile-first**: All buttons >= 44px tap targets. Kids use tablets with touch.
- **Free tier APIs**: Groq free tier has rate limits. Build with rate limit awareness.
- **No new dependencies**: Keep bundle under control. CSS-only solutions preferred.
- **LucacLegends.jsx**: Currently self-contained — needs splitting BEFORE parallel game upgrades
- **File conflicts**: App.jsx is the bottleneck. Minimize concurrent edits to it.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Existing Stack (Do Not Change)
| Technology | Version | Role |
|------------|---------|------|
| React | 18.2.0 | UI framework |
| Vite | 4.4.0 | Build tool |
| Firebase | 10.7.0 | Realtime Database + persistence |
| Groq API | (REST) | AI completions — llama-3.1-8b-instant default |
| Web Speech API | (browser native) | Voice input (already in utils.js) |
| SpeechSynthesis API | (browser native) | Read-aloud (existing but broken) |
## Recommended Stack — New Capabilities
### 1. Canvas Finger Drawing (Avatar System)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| HTML5 Canvas API | Browser native | Drawing surface | Already supported everywhere; zero bundle cost |
| Pointer Events API | Browser native | Touch + mouse + stylus input | Single unified API for all input types — replaces Touch Events |
| `canvas.toDataURL()` | Browser native | Export drawing as base64 string | Stores in Firebase as a string value |
### 2. Text-to-Speech (Read-Aloud, Non-Robotic)
- ElevenLabs, AWS Polly, Google Cloud TTS — all require paid API keys, network calls, and violate the "no new paid APIs" constraint
- ResponsiveVoice.js — was free-to-use but is now commercial and adds ~200KB
- Web Audio API synthesis from scratch — extremely complex, not appropriate here
### 3. Groq-Powered Story Generation for Kids
| Model | Best For | Context | Speed |
|-------|----------|---------|-------|
| `llama-3.1-8b-instant` | Quick tasks, parsing, Q&A | 128k | Fastest |
| `llama-3.3-70b-versatile` | Creative writing, stories, nuanced output | 128k | Fast |
| `llama3-8b-8192` | Legacy fallback | 8k | Fast |
### 4. Cross-Device Real-Time Board Game via Firebase
- Spark plan: 1 GB storage, 10 GB/month transfer, 100 simultaneous connections
- A 4-player board game with ~100 moves each generates roughly 10 KB of data — well within limits
- `onValue` listeners count toward simultaneous connections — 4 players = 4 connections, far below limit
- Firebase Firestore — more complex pricing, transactions work differently, overkill for this use case. Realtime Database is already wired in
- socket.io — requires a server, not compatible with Vercel static hosting without a separate backend
- Partykit / Liveblocks — paid services with free tier limits that add npm dependencies
- Firebase Cloud Functions — no backend needed; client-side transactions are sufficient for turn enforcement in a family game
## Summary: No New npm Packages Required
| Capability | Solution | New Package? |
|------------|----------|--------------|
| Canvas finger drawing | HTML5 Canvas + Pointer Events API | None |
| Crisp retina canvas | `devicePixelRatio` + `ctx.scale()` | None |
| Save avatar to Firebase | `canvas.toDataURL("image/jpeg", 0.5)` | None |
| Better TTS voice | `getBestVoice()` helper in utils.js | None |
| No repeat speech bug | `synth.cancel()` before each utterance | None |
| Kids story generation | `groqFetch()` with 70b model + 20s timeout | None |
| Story caching | `cacheSet/cacheGet` (existing) | None |
| Cross-device board game | Firebase `onValue` + `runTransaction` | None |
| Player presence | Firebase `onDisconnect` | None |
## Files to Modify / Create
| File | Change |
|------|--------|
| `src/utils.js` | Add `getBestVoice()`, `speak()`, `getVoicesReady()` helpers |
| `src/LucacLegends.jsx` | Split into game files BEFORE modifying (per PROJECT.md decision) |
| `src/AvatarDrawing.jsx` | New component — canvas finger draw, save to Firebase |
| `src/BoardGame.jsx` | New component — Monopoly-style, Firebase cross-device |
| `src/FishGame.jsx` | Split from LucacLegends.jsx |
| `src/RacingGame.jsx` | Split from LucacLegends.jsx |
| `src/ReadingGame.jsx` | New — Groq story gen + SpeechSynthesis read-aloud |
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Touch drawing | Pointer Events API (native) | react-sketch-canvas, Fabric.js | Adds npm dependency; overkill for avatar drawing |
| TTS quality | SpeechSynthesis voice selection | ElevenLabs, AWS Polly | Paid APIs violate free-tier constraint |
| TTS quality | SpeechSynthesis voice selection | ResponsiveVoice.js | Now commercial; adds 200KB |
| Story gen AI | Groq (existing) | OpenAI GPT-4o | Already paid; Groq is free for this use case |
| Board game sync | Firebase Realtime DB (existing) | Socket.io | Requires server — Vercel is static hosting |
| Board game sync | Firebase Realtime DB | Firestore | Already use Realtime DB; Firestore pricing more complex |
| Board game sync | Firebase Realtime DB | Liveblocks/Partykit | New paid dependency |
## Sources
- MDN Pointer Events API: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events (HIGH confidence)
- MDN Canvas Optimizing (devicePixelRatio): https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas (HIGH confidence)
- MDN HTMLCanvasElement.toDataURL: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL (HIGH confidence)
- MDN SpeechSynthesisVoice: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice (HIGH confidence — localService property documented)
- MDN SpeechSynthesisUtterance: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance (HIGH confidence)
- Firebase SDK version: package.json `firebase: ^10.7.0` (HIGH confidence — verified in codebase)
- Groq model selection: training data knowledge of Groq model catalog (MEDIUM confidence — verify model names in Groq console before shipping)
- Groq timeout recommendation: derived from existing `groqFetch` implementation in `src/utils.js` (HIGH confidence)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
