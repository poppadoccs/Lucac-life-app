# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Rules

- **Edit `src/App.jsx`, `src/LucacLegends.jsx`, and any `src/*.jsx` component files** — NEVER touch `package.json`, `vite.config.js`, `index.html`, or `src/main.jsx`
- **Component files allowed**: Split features into `src/FoodTab.jsx`, `src/BudgetTab.jsx`, `src/HomeworkHelper.jsx`, `src/utils.js`, etc. and import into App.jsx
- **Firebase config stays hardcoded in App.jsx** — never move it to environment variables
- **Push command**: `git add . && git commit -m "description" && git push`
- **Alex is colorblind** — never give color-only UI instructions; always use labels, icons, or patterns alongside color
- **Danyells (ex) will judge this app** — always build it looking polished and professional
- **Current version**: v19 — live at lucac-life-app.vercel.app
- **All 3 MCPs working**: GitHub, Playwright, Context7
- **Commit co-author**: Sonnet kicked Dad (Opus) out of commit credits. Use `Co-Authored-By: Claude Sonnet <noreply@anthropic.com>`

## Claude Code Setup

- **Model**: Claude Opus 4.6 (1M context) with Sonnet co-author line
- **MCPs**: GitHub (gh CLI), Playwright (browser testing), Context7 (library docs)
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

## Build & Dev Commands

- `npm run dev` — Start Vite dev server
- `npm run build` — Production build
- `npm run preview` — Preview production build

No test framework or linter is configured.

## Architecture

Single-page React 18 app built with Vite. 6 source files in `src/`:

| File | Lines | Purpose |
|------|-------|---------|
| `src/App.jsx` | ~2700 | Main shell: Firebase init, all state, routing, themes (`V`/`THEMES`), 3 home layouts, calendar, settings, kids, family tabs. Imports all component files. |
| `src/FoodTab.jsx` | ~1140 | MacroFactor-style nutrition: SVG macro rings, 4 meal sections, AI voice logging, weight trend chart, micronutrient bars, shopping list, goal modes |
| `src/BudgetTab.jsx` | ~660 | Budget tracker: Groq-powered expense parsing, SVG donut chart, 9 categories, Dad vs Mom weeks, copy summary |
| `src/HomeworkHelper.jsx` | ~540 | AI tutor: kid selector, 4 subjects, age-appropriate responses, 20-msg rate limit, safety guardrails, session saving |
| `src/LucacLegends.jsx` | ~2000 | Turn-based RPG mini-game (self-contained, do NOT modify) |
| `src/utils.js` | ~120 | Shared helpers: `groqFetch` (10s timeout), `parseGroqJSON`, `cacheGet`/`cacheSet` (localStorage), `triggerConfetti` (CSS-only), `createSpeechRecognition`, `SWATCH_COLORS` |

`src/main.jsx` renders `<App />` into the root.

## All Features (v19)

### Home Tab (all 3 themes have feature parity)
- AI Quick Add bar with 🎤 voice mic button (Web Speech API → Groq)
- Update-existing events via natural language ("make muffin events red")
- Big monthly calendar (Skylight), day timeline (Cozyla), widget grid (FamilyWall)
- Repeating events: daily/weekly/monthly with end date or occurrence count, 🔁 icon
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
- **Dead code**: Old `renderFood()` function still exists in App.jsx (replaced by FoodTab.jsx component) — safe to delete in next cleanup

## Next Session Roadmap

- Delete dead `renderFood()` code from App.jsx
- Add adaptive calorie suggestions (after 14 days of weight + food data, Groq suggests adjustments)
- Add barcode scanner for food logging (if camera API available)
- Progress photos with before/after overlay
- Performance: code-split with dynamic `import()` to get under 500KB warning
