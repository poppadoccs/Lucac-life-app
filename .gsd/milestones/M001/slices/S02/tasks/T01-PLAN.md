---
estimated_steps: 7
estimated_files: 2
skills_used:
  - react-best-practices
---

# T01: Rebuild HomeworkHelper teaching engine with detail mode, step-by-step toggle, frustration detection, and fun-facts prompt

**Slice:** S02 — Kids Homework
**Milestone:** M001

## Description

Rewrite the HomeworkHelper teaching logic to support four distinct modes that interact with the Groq system prompt and API parameters. This covers HW-01 (detail mode), HW-02 (step-by-step toggle), HW-03 (frustration detection), and HW-05 (fun facts). Also fix the broken `homeworkSessions` data path by adding it as a prop from App.jsx.

The current HomeworkHelper has a hard 100-word cap in the system prompt (`buildSystemPrompt` line ~31: "Keep responses under 100 words"), a fixed `maxTokens: 300` in `doAICall`, and a one-shot "Show me step by step" button. All of these are replaced by a mode-aware teaching engine.

**Key context from prior slice (S01):**
- `speakText` is already imported from utils.js (dedup done in S01)
- `groqFetch` is the API caller with 10s AbortController timeout
- `shouldCelebrate(text, age)` returns true when the AI response contains celebration words — the inverse of this is used for frustration detection
- All styles are inline using `V.*` theme variables
- All buttons >= 44px tap targets (mobile-first, kids use tablets)
- Alex is colorblind — never use color alone for UI

## Steps

1. **Add `homeworkSessions` prop to App.jsx HomeworkHelper render** (~line 1321):
   - Find the line: `<HomeworkHelper V={V} profiles={profiles} kidsData={kidsData} fbSet={fbSet} GROQ_KEY={GROQ_KEY} showToast={showToast} />`
   - Add `homeworkSessions={homeworkSessions}` to the props
   - This fixes the broken past-sessions data path — `homeworkSessions` is declared at App.jsx line 238 as separate top-level state, NOT nested inside `kidsData`

2. **Add new state variables and update props destructuring in HomeworkHelper**:
   - Update props: `{ V, profiles, kidsData, fbSet, GROQ_KEY, showToast, homeworkSessions }`
   - Add state: `const [detailMode, setDetailMode] = useState(false);` — HW-01
   - Add state: `const [stepByStep, setStepByStep] = useState(true);` — HW-02 (default ON, overridden from Firebase on kid selection)
   - Add ref: `const socraticAttemptsRef = useRef(0);` — HW-03 (use ref, not state, to avoid re-render on every increment; only the prompt engine reads it)
   - Add a `useEffect` that loads `stepByStep` from `kidsData?.[selectedKid]?.hwPrefs?.stepByStep` when `selectedKid` changes (default to `true` if not set)

3. **Rewrite `buildSystemPrompt()` to be mode-aware**:
   - Change signature to: `function buildSystemPrompt(name, age, subject, { detailMode, stepByStep, socraticAttempts })`
   - **Remove** the hard "Keep responses under 100 words" instruction
   - **Fun Facts branch** (`subject === "funfacts"`): Entirely different prompt. Never says "almost / try again / wrong / incorrect". Celebrates any factual or thoughtful response. Adds a related fun fact. Asks an open-ended follow-up question. Does NOT use Socratic scaffolding. Example phrasing: "You are a fun facts buddy for {name}. When {name} shares something, celebrate it enthusiastically, then share a related amazing fact, and ask an open-ended follow-up."
   - **Detail mode** (when `detailMode === true`): Prompt says "Give thorough, structured explanations. Use examples, analogies, and multiple approaches. Be comprehensive — the student wants depth."
   - **Detail mode OFF** (default): Prompt says "Be concise and clear. Get to the point quickly."
   - **Step-by-step ON** (when `stepByStep === true` and subject !== funfacts): Prompt says "Walk through your reasoning step-by-step. Show each step clearly."
   - **Step-by-step OFF**: Prompt says "Give direct answers without step-by-step scaffolding."
   - **Frustration switch** (when `socraticAttempts >= 2` and subject !== funfacts): Override the Socratic framing entirely. Prompt says "The student has struggled twice. Stop guiding — explain the concept directly with a worked example, then ask if they want another problem to try."
   - Keep the existing MATH_VERIFICATION_PROMPT appended for math subject
   - Keep the existing SAFETY prompt section
   - Keep the age-appropriate language adjustment

4. **Update `doAICall()` for mode-aware maxTokens and frustration tracking**:
   - Change `maxTokens: 300` to `maxTokens: detailMode ? 1500 : 300`
   - Pass the new options to buildSystemPrompt: `buildSystemPrompt(kidName, kidAge, subject, { detailMode, stepByStep, socraticAttempts: socraticAttemptsRef.current })`
   - After receiving assistant reply (`result.data`):
     - If `shouldCelebrate(result.data, kidAge)` is true → `socraticAttemptsRef.current = 0`
     - Else if reply matches `/almost|try again|let'?s try|not quite/i` → `socraticAttemptsRef.current += 1`
   - Keep existing confetti trigger on celebration

5. **Add toggle UI in the header area** (next to the existing mute button):
   - `detailMode` toggle: `📝 Brief` / `📖 Detailed` — styled like the existing `muteBtn` pattern
   - `stepByStep` toggle: `🪜 Steps` / `➡️ Direct` — same style
   - On `stepByStep` change, persist to Firebase: `fbSet(\`kidsData/${kidName}/hwPrefs/stepByStep\`, newValue)`
   - Both toggles visible only when `selectedKid` is truthy (same condition as mute button)
   - Use `V.accent` background when active, `V.bgCardAlt` when inactive
   - All buttons: `minWidth: 44, minHeight: 44` (existing pattern from `muteBtn`)

6. **Delete the old one-shot `handleStepByStep` function and button**:
   - Remove the `function handleStepByStep()` definition (~line 180)
   - Remove the conditional button that renders "📝 Show me step by step" after math assistant replies (~line 647 area)
   - The persistent `stepByStep` toggle replaces this entirely

7. **Reset `socraticAttempts` in all context-change points**:
   - In `switchSubject()`: add `socraticAttemptsRef.current = 0;`
   - In `resetSession()`: add `socraticAttemptsRef.current = 0;`
   - In kid selection `onChange`: add `socraticAttemptsRef.current = 0;`

## Must-Haves

- [ ] `detailMode` state toggles between brief (maxTokens 300) and detailed (maxTokens 1500) modes
- [ ] `stepByStep` toggle is persistent per-kid via `kidsData/{name}/hwPrefs/stepByStep` in Firebase
- [ ] `socraticAttempts` counter (as ref) increments on inverse-celebrate detection, resets on celebration or context change
- [ ] When `socraticAttempts >= 2`, system prompt switches to direct-explain mode
- [ ] Fun Facts subject gets its own prompt branch that never uses corrective language
- [ ] `homeworkSessions` prop added to HomeworkHelper in App.jsx (one-line change at line ~1321)
- [ ] Old `handleStepByStep` function and button are removed
- [ ] All new buttons are >= 44px tap targets with V.* theme variables
- [ ] `buildSystemPrompt` no longer contains "under 100 words"
- [ ] All resets (subject change, kid change, session reset) zero out socraticAttempts

## Verification

- `npm run build` passes with no new errors
- `grep -c "detailMode" src/HomeworkHelper.jsx` returns >= 3
- `grep -c "stepByStep" src/HomeworkHelper.jsx` returns >= 3
- `grep -c "socraticAttempts" src/HomeworkHelper.jsx` returns >= 3
- `grep -q "funfacts" src/HomeworkHelper.jsx` exits 0 (fun-facts prompt branch exists)
- `grep -q "homeworkSessions={homeworkSessions}" src/App.jsx` exits 0 (prop wired)
- `grep -c "handleStepByStep" src/HomeworkHelper.jsx` returns 0 (old function removed)
- `grep -qv "under 100 words" src/HomeworkHelper.jsx` — the string "100 words" does NOT appear in the file
- `grep -q "hwPrefs" src/HomeworkHelper.jsx` exits 0 (Firebase persistence path present)

## Inputs

- `src/HomeworkHelper.jsx` — current 738-line file with buildSystemPrompt (100-word cap at line 31), shouldCelebrate heuristic (line 39), doAICall with maxTokens:300 (line 154), handleStepByStep one-shot button (line 180), and mute toggle UI pattern to replicate for new toggles
- `src/App.jsx` — line 1321 renders HomeworkHelper without homeworkSessions prop; line 238 declares homeworkSessions as separate top-level state; must add homeworkSessions={homeworkSessions} to the HomeworkHelper JSX
- `src/utils.js` — exports speakText, groqFetch, triggerConfetti, shouldCelebrate consumed as-is (unchanged)

## Expected Output

- `src/HomeworkHelper.jsx` — rebuilt with detailMode, stepByStep, socraticAttemptsRef state; mode-aware buildSystemPrompt; fun-facts prompt branch; toggle UI in header; handleStepByStep removed
- `src/App.jsx` — one-line change adding homeworkSessions={homeworkSessions} prop at the HomeworkHelper render site (~line 1321)
