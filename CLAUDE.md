# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Rules

- **ONLY edit `src/App.jsx` and `src/LucacLegends.jsx`** — NEVER touch `package.json`, `vite.config.js`, `index.html`, or `src/main.jsx`
- **Firebase config stays hardcoded in App.jsx** — never move it to environment variables
- **Push command**: `git add . && git commit -m "description" && git push`
- **Alex is colorblind** — never give color-only UI instructions; always use labels, icons, or patterns alongside color
- **Danyells (ex) will judge this app** — always build it looking polished and professional
- **Current version**: v13 Skylight Edition — live at lucac-life-app.vercel.app

## Next Build Roadmap

1. Beautiful calendar UI
2. CSS variables
3. Theme switcher

## Build & Dev Commands

- `npm run dev` — Start Vite dev server
- `npm run build` — Production build
- `npm run preview` — Preview production build

No test framework or linter is configured.

## Architecture

This is a single-page React 18 app built with Vite. It has two main components, both large single-file modules with inline styles (no CSS files):

- **`src/App.jsx`** — The main "LUCAC Life App": a family productivity/life-management app with calendar, events, tasks, habits, Skylight integration, and an AI assistant. Uses Firebase Realtime Database for persistence. All UI sections (calendar, events, habits, tasks, AI chat, etc.) are defined as inline components within this single file.
- **`src/LucacLegends.jsx`** — "Lucac Legends": a turn-based RPG mini-game with multiple worlds, bosses, and multiplayer support. Entirely self-contained with its own game state management.

`src/main.jsx` renders `<App />` into the root. `App.jsx` imports and conditionally renders `LucacLegends` as a game mode.

## Key Technical Details

- **Firebase**: Initialized directly in `App.jsx` with hardcoded config. Uses `firebase/database` (Realtime Database) with `ref`, `set`, `onValue` for all data persistence.
- **External API keys**: Groq and Tavily API keys are loaded via `import.meta.env.VITE_GROQ_KEY` and `import.meta.env.VITE_TAVILY_KEY` (environment variables).
- **No routing library**: Navigation between views (calendar, events, habits, tasks, game, etc.) is handled via React state (`currentView`).
- **Mobile-first**: The app targets mobile with viewport meta tags disabling zoom and touch highlight suppression.
- **All styles are inline**: No separate CSS files; all styling is done via inline style objects in JSX.
