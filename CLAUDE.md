# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Rules

- **Edit `src/App.jsx`, `src/LucacLegends.jsx`, and any `src/*.jsx` component files** — NEVER touch `package.json`, `vite.config.js`, `index.html`, or `src/main.jsx`
- **Component files allowed**: Split features into separate files (`src/FoodTab.jsx`, `src/BudgetTab.jsx`, `src/HomeworkHelper.jsx`, etc.) and import them into App.jsx
- **Firebase config stays hardcoded in App.jsx** — never move it to environment variables
- **Push command**: `git add . && git commit -m "description" && git push`
- **Alex is colorblind** — never give color-only UI instructions; always use labels, icons, or patterns alongside color
- **Danyells (ex) will judge this app** — always build it looking polished and professional
- **Current version**: v17 — live at lucac-life-app.vercel.app
- **All 3 MCPs working**: GitHub, Playwright, Context7

## What's New in v17

- Theme switcher: Skylight (light), Cozyla (warm), FamilyWall (bold) with Firebase persistence
- Each theme has a completely different HOME tab layout
- Calendar rebuilt: big monthly grid, pastel pills, modal popup
- CSS variables (`V` object) + `THEMES` object at top of App.jsx
- Repeating events with daily/weekly/monthly + end date/count
- Color swatch picker (12 preset dots, 44px mobile-friendly)
- Widget customization (rename/hide routines, goals, stats per profile)
- AI Quick Add bar (Groq-powered natural language → events)
- Resizable event blocks (duration slider 30min-8hrs)

## Build & Dev Commands

- `npm run dev` — Start Vite dev server
- `npm run build` — Production build
- `npm run preview` — Preview production build

No test framework or linter is configured.

## Architecture

Single-page React 18 app built with Vite. Component files in `src/`:

- **`src/App.jsx`** — Main shell: Firebase init, state, routing, themes, calendar, home layouts, settings. Imports feature components.
- **`src/LucacLegends.jsx`** — Turn-based RPG mini-game (self-contained, do NOT modify)
- **`src/FoodTab.jsx`** — MacroFactor-style nutrition tracking (macro rings, meal logging, AI voice, weight trends, shopping list)
- **`src/BudgetTab.jsx`** — Budget tracker with Groq-powered expense logging, donut chart, categories
- **`src/HomeworkHelper.jsx`** — Age-appropriate AI tutor for kids with safety guardrails

`src/main.jsx` renders `<App />` into the root.

## Key Technical Details

- **Firebase**: Initialized directly in `App.jsx` with hardcoded config. Uses `firebase/database` (Realtime Database) with `ref`, `set`, `onValue` for all data persistence. The `db` and `fbSet` references are passed as props to component files.
- **External API keys**: Groq and Tavily API keys are loaded via `import.meta.env.VITE_GROQ_KEY` and `import.meta.env.VITE_TAVILY_KEY` (environment variables). Passed as props to components that need them.
- **No routing library**: Navigation between views handled via React state (`tab`, `currentView`).
- **Mobile-first**: Viewport meta tags disabling zoom, touch highlight suppression. All buttons ≥44px tap targets.
- **All styles are inline**: No separate CSS files; all styling via inline style objects in JSX.
- **CSS Variables**: `THEMES` object defines 3 themes (skylight/cozyla/familywall). Active theme = `V` object. All components receive `V` as a prop for consistent theming.
- **AI Error Handling**: All Groq calls wrapped in try/catch with 10s timeout, loading states, friendly error toasts. Never crash on AI failure.
- **Offline Resilience**: Firebase reads have localStorage fallback. Writes queue for retry. Header shows offline indicator when disconnected.
