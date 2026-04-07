# S02: Kids Homework

**Goal:** Rebuild HomeworkHelper teaching modes and past-sessions UX: detail mode for long responses, persistent step-by-step toggle, frustration-aware auto-switch from Socratic to direct explanation, dedicated Fun Facts celebration mode, and clickable past sessions that resume inline with auto-prune.
**Demo:** Rebuild the Homework Helper teaching modes and past-sessions UX so Yana and Luca actually get the help they need: long detailed responses on demand, toggleable step-by-step scaffolding, automatic switch to direct explanation after two failed Socratic attempts, a Fun Facts mode that celebrates instead of correcting, and tappable past sessions that load inline.

## Must-Haves

- HW-01: `detailMode` toggle removes 100-word cap and bumps maxTokens from 300 to 1500
- HW-02: `stepByStep` toggle persistent per-kid in `kidsData/{name}/hwPrefs/stepByStep`, controls system prompt scaffolding
- HW-03: `socraticAttempts` counter uses inverse-celebrate heuristic — after 2 failed attempts, system prompt switches to direct-explain mode
- HW-05: `subject === "funfacts"` gets dedicated prompt that never says "almost / try again" — celebrates any response, adds related fact, asks open follow-up
- HW-04: Past sessions are clickable, load as scrollback under a new sessionId (original immutable), auto-prune at 50 sessions per kid on write path
- App.jsx passes `homeworkSessions` prop to HomeworkHelper (fixes broken data path where past sessions read from wrong prop)
- Old one-shot "Show me step by step" button is deleted (replaced by persistent toggle)

## Threat Surface

- **Abuse**: Kid input reaches Groq API — existing safety prompt and ROLE_TOOLS (kid=4 safe tools) already constrain this. No new attack surface.
- **Data exposure**: Homework session messages stored in Firebase — already accessible to admin. No new PII exposure.
- **Input trust**: Kid text input → Groq system prompt → AI response. Existing safety prompt redirects off-topic questions. No filesystem or DB injection path.

## Proof Level

- This slice proves: integration (HomeworkHelper + Firebase session persistence + Groq prompt modes)
- Real runtime required: yes (Groq API and Firebase needed for full verification)
- Human/UAT required: no (build verification + grep checks sufficient for structural correctness)

## Verification

- `npm run build` passes with no new errors
- `grep -c "detailMode" src/HomeworkHelper.jsx` returns >= 3 (state + toggle + maxTokens gate)
- `grep -c "stepByStep" src/HomeworkHelper.jsx` returns >= 3 (state + toggle + prompt gate)
- `grep -c "socraticAttempts" src/HomeworkHelper.jsx` returns >= 3 (counter + increment + reset)
- `grep -q "funfacts" src/HomeworkHelper.jsx` confirms fun-facts prompt branch exists
- `grep -q "homeworkSessions" src/App.jsx` at the HomeworkHelper render line confirms prop is passed
- `grep -c "onClick" src/HomeworkHelper.jsx` in past-sessions section confirms clickable rows
- `grep -q "50" src/HomeworkHelper.jsx` confirms session pruning logic exists
- Old "Show me step by step" one-shot button is gone: `grep -c "handleStepByStep" src/HomeworkHelper.jsx` returns 0

## Observability / Diagnostics

- Runtime signals: Groq API calls with mode-dependent maxTokens (300 vs 1500) — observable in browser network tab
- Inspection surfaces: Firebase `homeworkSessions/{kidName}/` and `kidsData/{kidName}/hwPrefs/` paths viewable in Firebase console
- Failure visibility: `showToast` on Groq API failure; session count visible in past-sessions panel header
- Redaction constraints: none (homework messages are educational content, not PII)

## Integration Closure

- Upstream surfaces consumed: `src/utils.js` (speakText, groqFetch, triggerConfetti — unchanged), `src/App.jsx` (props interface — one new prop added)
- New wiring introduced: `homeworkSessions` prop from App.jsx → HomeworkHelper, `hwPrefs` persistent toggle path in Firebase via fbSet
- What remains before the milestone is truly usable end-to-end: S03-S06 deliver other features (Danyells, games, nutrition, education)

## Tasks

- [ ] **T01: Rebuild HomeworkHelper teaching engine with detail mode, step-by-step toggle, frustration detection, and fun-facts prompt** `est:1h30m`
  - Why: HW-01 through HW-03 and HW-05 all modify the same teaching logic in HomeworkHelper — the system prompt, maxTokens, and response handling. Building them together ensures the modes interact correctly (e.g., frustration detection resets when subject changes to fun-facts).
  - Files: `src/HomeworkHelper.jsx`, `src/App.jsx`
  - Do: (1) Add `homeworkSessions` prop to App.jsx HomeworkHelper render. (2) Add `detailMode`, `stepByStep`, `socraticAttempts` state. (3) Rewrite `buildSystemPrompt()` as mode-aware with fun-facts branch. (4) Update `doAICall()` for mode-dependent maxTokens and frustration tracking. (5) Add toggle buttons in header. (6) Delete old `handleStepByStep` function and button. (7) Reset `socraticAttempts` on subject/kid/session change.
  - Verify: `npm run build` passes; `grep -c "detailMode" src/HomeworkHelper.jsx` >= 3; `grep -c "socraticAttempts" src/HomeworkHelper.jsx` >= 3; `grep -q "homeworkSessions={homeworkSessions}" src/App.jsx`; `grep -c "handleStepByStep" src/HomeworkHelper.jsx` == 0
  - Done when: All four teaching modes (detail, step-by-step, frustration-switch, fun-facts) are wired into the prompt engine, the App.jsx prop fix is in place, and `npm run build` passes.

- [ ] **T02: Wire clickable past sessions with inline resume and 50-session auto-prune** `est:1h`
  - Why: HW-04 past-sessions UX is distinct from the teaching-mode logic — it's about session lifecycle (load, resume, prune), not prompt engineering. Separating it keeps T01 focused and makes this work independently testable.
  - Files: `src/HomeworkHelper.jsx`
  - Do: (1) Update `loadPastSessions` to read from `homeworkSessions` prop. (2) Make session rows clickable — load messages as scrollback under new sessionId. (3) Add 50-session auto-prune on write path. (4) Polish UI with Resume affordance and 44px tap targets.
  - Verify: `npm run build` passes; `grep -q "Resume" src/HomeworkHelper.jsx`; `grep -q "50" src/HomeworkHelper.jsx`; past-session rows have onClick handlers
  - Done when: Tapping a past session loads it for review, original session is immutable, sessions auto-prune at 50 per kid, and `npm run build` passes.

## Files Likely Touched

- `src/HomeworkHelper.jsx`
- `src/App.jsx`
