---
estimated_steps: 4
estimated_files: 1
skills_used:
  - react-best-practices
---

# T02: Wire clickable past sessions with inline resume and 50-session auto-prune

**Slice:** S02 — Kids Homework
**Milestone:** M001

## Description

Upgrade the past-sessions panel in HomeworkHelper so sessions are tappable (not just display-only), loading the selected session's messages as scrollback under a new sessionId. Add auto-prune on the write path to keep at most 50 sessions per kid. This is HW-04.

**Depends on T01 output:** T01 already added the `homeworkSessions` prop from App.jsx and restructured state (added `detailMode`, `stepByStep`, `socraticAttemptsRef`). This task reads the `homeworkSessions` prop in `loadPastSessions` and in the session save effect.

**Key behavior rules (from context decisions D-06 through D-09):**
- Tapping a past session loads prior messages into the current chat as scrollback
- A NEW sessionId is generated — the original session record stays immutable in Firebase
- Auto-prune at 50 sessions per kid, oldest-first by `updatedAt`, on the write path
- Past sessions panel keeps 220px max height + 10-most-recent display
- Each row gets >= 44px tap target and a "Resume" affordance (not color-only — Alex is colorblind)

**Current broken state:** `loadPastSessions()` reads from `kidsData?.homeworkSessions?.[kidName]` which is always undefined because `homeworkSessions` is a separate top-level state in App.jsx, not nested in `kidsData`. T01 added the prop — this task uses it.

## Steps

1. **Update `loadPastSessions` to use the `homeworkSessions` prop**:
   - Replace `const sessions = kidsData?.homeworkSessions?.[kidName] || null;` with `const sessions = homeworkSessions?.[kidName] || null;`
   - This is the root cause fix — past sessions data now flows correctly

2. **Make past session rows clickable with resume behavior**:
   - Each session row in the `pastSessions` map gets an `onClick` handler:
     ```
     onClick={() => {
       setMessages(data.messages || []);
       setSubject(data.subject || "math");
       setMsgCount((data.messages || []).length);
       socraticAttemptsRef.current = 0;
       // Generate new sessionId so subsequent messages save to a new record
       const d = new Date();
       setSessionId(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}_${d.getTime()}`);
       setShowPastSessions(false);
     }}
     ```
   - Style rows as tappable: `cursor: "pointer"`, `minHeight: 44`, add hover-like active state via inline style
   - Add a `▶ Resume` label on each row (text affordance — not color-only for colorblind safety)
   - Each row shows: date (from sessionId split), subject icon+label (from SUBJECTS array lookup), message count, and Resume label

3. **Add 50-session auto-prune on the write path**:
   - In the existing Firebase save `useEffect` that writes `homeworkSessions/${kidName}/${sessionId}`:
     - After the `fbSet` call, check `homeworkSessions?.[kidName]`
     - Count sessions: `const sessionKeys = Object.keys(homeworkSessions[kidName] || {});`
     - If `sessionKeys.length > 50`:
       - Sort by `updatedAt` ascending (oldest first)
       - Compute keys to delete: `sessionKeys.slice(0, sessionKeys.length - 50)`
       - Delete each: `fbSet(\`homeworkSessions/${kidName}/${oldKey}\`, null)`
     - Guard: skip pruning if `homeworkSessions[kidName]` is falsy
   - The +1 for the current session being written means this runs after 51 total, keeping 50

4. **Polish the past-sessions panel UI**:
   - Update each row's layout to be a flex row with:
     - Left: date + subject with icon (e.g., "🔢 Math" or "🌟 Fun Facts")
     - Center: message count ("12 msgs")
     - Right: "▶ Resume" button/label
   - Keep existing 220px max-height scrollable container
   - Keep newest-first sort (already `b.localeCompare(a)` on session keys)
   - Limit display to 10 most recent (already `.slice(0, 10)`)
   - Add a subtle border-bottom separator between rows for visual clarity

## Failure Modes

| Dependency | On error | On timeout | On malformed response |
|------------|----------|-----------|----------------------|
| Firebase (homeworkSessions read) | Panel shows "No past sessions found" — graceful degradation | Same as error — Firebase onValue has its own timeout | Null-coalesce: `homeworkSessions?.[kidName] \|\| null` handles missing/malformed |
| Firebase (prune write) | Prune silently fails — sessions accumulate beyond 50 but app works fine | Same — fbSet is fire-and-forget with catch | N/A — writing null to a path always works |

## Negative Tests

- **Empty sessions**: If `homeworkSessions[kidName]` is undefined or empty object, panel shows "No past sessions found" (existing behavior preserved)
- **Session with no messages**: If `data.messages` is undefined/empty, resume loads empty chat (fresh start), does not crash
- **Prune with < 50 sessions**: Skip pruning entirely, no fbSet calls to delete
- **Session without updatedAt**: Sort gracefully handles missing `updatedAt` by treating as 0 (sorts to oldest, gets pruned first — safe default)

## Must-Haves

- [ ] Past sessions read from `homeworkSessions` prop (not `kidsData.homeworkSessions`)
- [ ] Tapping a past session loads its messages as scrollback under a new sessionId
- [ ] Original session record in Firebase is never mutated after resume
- [ ] Auto-prune deletes oldest sessions when count exceeds 50 per kid
- [ ] Each session row has >= 44px tap target and a text-based "Resume" affordance
- [ ] Session panel closes after selecting a session to resume
- [ ] `socraticAttemptsRef` resets to 0 on resume (from T01)

## Verification

- `npm run build` passes with no new errors
- `grep -q "homeworkSessions\b" src/HomeworkHelper.jsx` at the props line confirms prop is destructured (not reading from kidsData)
- `grep -q "Resume" src/HomeworkHelper.jsx` confirms resume affordance text exists
- `grep -q "50" src/HomeworkHelper.jsx` confirms pruning threshold exists
- `grep -q "setShowPastSessions(false)" src/HomeworkHelper.jsx` confirms panel closes on resume
- `grep -q "onClick" src/HomeworkHelper.jsx` in the pastSessions rendering section confirms clickable rows
- The string `kidsData?.homeworkSessions` or `kidsData.homeworkSessions` does NOT appear in the file (broken path removed)

## Inputs

- `src/HomeworkHelper.jsx` — T01 output with homeworkSessions prop destructured, socraticAttemptsRef, detailMode/stepByStep state, rebuilt buildSystemPrompt, and existing past-sessions panel with loadPastSessions function

## Expected Output

- `src/HomeworkHelper.jsx` — past sessions panel with clickable resume rows, new-sessionId-on-resume behavior, 50-session auto-prune on write path, loadPastSessions reading from homeworkSessions prop instead of kidsData
