# v27a: Security Completion + Critical Bug Fixes

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock down the remaining security gaps (PIN visibility, role escalation edge cases), fix the 3 critical bugs Alex reported (voice spam, delete command, Yana's games), and add parent event ownership.

**Architecture:** All changes are in existing files. Security fixes modify the Settings render in App.jsx. Voice fix modifies utils.js `createSpeechRecognition` defaults. Game fix verifies LucacLegends prop passing. No new files needed.

**Tech Stack:** React 18, Firebase Realtime Database, Web Speech API, Vite

---

## Chunk 1: Security — PIN Isolation & Role Lock

### Task 1: Verify role escalation is blocked

**Files:**
- Verify: `src/App.jsx:2880-2891` (role dropdown in Settings)

- [ ] **Step 1: Verify the admin-only option guard**

Read `src/App.jsx` lines 2880-2891. Confirm:
1. The role `<select>` is inside `{isAdmin && (` block
2. The `<option value="admin">` only renders when `p.type === "admin"` (existing admin keeps their role, nobody else can pick it)
3. The onChange handler rejects `"admin"` for non-admin profiles with a toast

Expected current state after hotfix:
```jsx
{p.type === "admin" && <option value="admin">👑 Admin</option>}
<option value="parent">👨‍👩‍👧 Parent</option>
```

If this is already in place, mark as done. If not, add the guard.

- [ ] **Step 2: Verify non-admin cannot see role dropdown**

Trace the render path for a parent profile (type: "parent"):
1. `isAdmin` = false (line 360: `currentProfile?.type === "admin"`)
2. The entire `{isAdmin && (` block at line 2880 is skipped
3. Parent sees only: emoji, name, role label text, color picker

Confirm no other path exposes the role selector to non-admin.

- [ ] **Step 3: Commit verification**

No code changes needed if hotfix is correct. If changes were made:
```bash
git add src/App.jsx
git commit -m "fix: verify role escalation guard is watertight"
```

### Task 2: PIN field isolation — nobody sees another user's PIN

**Files:**
- Modify: `src/App.jsx` — Settings profiles section (~line 2880-2910)

- [ ] **Step 1: Verify admin's own PIN section**

Read `src/App.jsx` "My Profile" section (~line 2826-2860). Confirm:
1. It uses `type={showPin?"text":"password"}` for masked input
2. It has a "Show/Hide" toggle button
3. It saves only to `currentProfile.id`
4. `maxLength={15}` (updated from 6 in hotfix)

- [ ] **Step 2: Verify family members list hides PINs**

Read the family members `.map()` section (~line 2864+). Confirm:
1. Inside the `{isAdmin && (` block, the PIN field shows ONLY for `p.id === currentProfile?.id` (admin's own row shows masked dots)
2. Other profiles' PINs are NEVER displayed — not even as masked dots
3. No `defaultValue={p.pin}` or `value={p.pin}` for other users' PINs

Current hotfix state should show:
```jsx
{p.id === currentProfile?.id && (
  <div style={{display:"flex",alignItems:"center",gap:4}}>
    <span>PIN:</span>
    <span>{"●".repeat((p.pin||"").length) || "none"}</span>
  </div>
)}
```

If a different user's PIN is exposed anywhere, remove it.

- [ ] **Step 3: Add parent self-PIN editor**

Currently parents see "My Profile" (name + PIN editor) because the hotfix changed `{isAdmin && (` to `{(isAdmin || isParent) && (` at the "My Profile" section. Verify this works:
1. Parent can edit their own name
2. Parent can set/change their own PIN (4-15 alphanumeric chars)
3. Parent CANNOT see admin's PIN
4. Parent CANNOT see the family members admin section (role dropdown, birthday, remove button)

If the parent's "My Profile" PIN editor works, mark done. If not, ensure:
```jsx
{(isAdmin || isParent) && (
  <div style={cardStyle}>
    <div style={{fontWeight:700,color:V.accent,marginBottom:10}}>My Profile</div>
    {/* Name editor */}
    {/* PIN editor — saves to own profile only */}
  </div>
)}
```

- [ ] **Step 4: CRITICAL — Upgrade PIN entry screen for alphanumeric PINs**

The PIN entry screen (line ~1061-1088) has a 6-digit numeric keypad with only digits 0-9 and max 6 characters. But the Settings PIN editor now allows 4-15 alphanumeric characters. **A user who sets a letter-based PIN cannot log in.**

Fix: Replace the numeric keypad with a standard text input:

```jsx
if (screen === "pin") {
  return (
    <div style={{ ...appStyle, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh" }}>
      <div style={{ fontSize:40, marginBottom:12 }}>{pinTarget?.emoji}</div>
      <div style={{ fontSize:20, fontWeight:700, color:V.accent, marginBottom:4 }}>{pinTarget?.name}</div>
      <div style={{ fontSize:13, color:V.textDim, marginBottom:24 }}>Enter your PIN</div>
      <input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handlePinSubmit()}
        placeholder="PIN" maxLength={15} autoFocus
        style={{ ...inputStyle, textAlign:"center", fontSize:24, letterSpacing:4, width:240, marginBottom:16 }} />
      {pinError && <div style={{ color:V.danger, marginBottom:12 }}>{pinError}</div>}
      <button onClick={handlePinSubmit} style={{ ...btnPrimary, width:180, padding:"12px" }}>Unlock</button>
      <button onClick={() => { setScreen("profiles"); setPinInput(""); setPinError(""); }}
        style={{ ...btnSecondary, marginTop:8, width:180, padding:"12px" }}>Back</button>
    </div>
  );
}
```

This replaces the numeric grid with a password input that accepts any characters.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "fix: PIN isolation + alphanumeric PIN entry screen"
```

### Task 3: Parent can see family members list (read-only)

**Files:**
- Modify: `src/App.jsx` — Family Members card in Settings

- [ ] **Step 1: Show family members to parent (read-only)**

The "Family Members" card at ~line 2862 currently shows for everyone, but the admin controls inside use `{isAdmin && (`. Verify that non-admin users see:
1. Profile emoji, name, role label, birthday — YES (these are outside the `isAdmin` block)
2. Color picker — YES (outside `isAdmin` block)
3. Role dropdown, birthday editor, remove button — NO (inside `isAdmin` block)
4. "Add Family Member" section — NO (inside `isAdmin` block at ~line 2936)

If parent sees too much, add `{isAdmin && (` guards. If parent sees too little (can't see member list at all), ensure the card renders.

- [ ] **Step 2: Commit**

```bash
git add src/App.jsx
git commit -m "fix: parent sees family members read-only, admin controls hidden"
```

---

## Chunk 2: Voice Input Fix

### Task 4: Fix voice input spam (50x repeat bug)

**Files:**
- Modify: `src/utils.js:113-122` (createSpeechRecognition defaults)
- Verify: `src/App.jsx:815-845` (startVoiceInput function)

- [ ] **Step 1: Update createSpeechRecognition defaults in utils.js**

Read `src/utils.js` lines 113-122. Current code sets `continuous: true` and `interimResults: true`. Change to:

```javascript
export function createSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const recognition = new SR();
  recognition.continuous = false;       // Single utterance — stops after one phrase
  recognition.interimResults = false;   // Only fire when speech is finalized
  recognition.lang = "en-US";
  recognition.maxAlternatives = 1;
  return recognition;
}
```

This fixes the root cause at the source. All consumers (App.jsx, FoodTab.jsx, HomeworkHelper.jsx) inherit these defaults.

- [ ] **Step 2: Verify App.jsx startVoiceInput is hardened**

Read `src/App.jsx` startVoiceInput (~line 815). After the hotfix it should have:
1. `sr.continuous = false` (redundant with utils.js but defensive)
2. `sr.interimResults = false`
3. `processed` debounce flag
4. Only processes `e.results[i].isFinal`
5. Calls `sr.stop()` after processing

If these are in place, no changes needed.

- [ ] **Step 3: Check HomeworkHelper.jsx voice input**

Read `src/HomeworkHelper.jsx` for speech recognition usage (~line 90-120). Verify it also handles results safely. If it sets `continuous: true` or `interimResults: true`, remove those overrides so it inherits the safe defaults from utils.js.

- [ ] **Step 4: Check FoodTab.jsx voice input**

Read `src/FoodTab.jsx` for speech recognition usage. Same check — ensure no override of the safe defaults.

- [ ] **Step 5: Commit**

```bash
git add src/utils.js src/App.jsx src/HomeworkHelper.jsx src/FoodTab.jsx
git commit -m "fix: voice input single-utterance mode — no more spam"
```

---

## Chunk 3: AI Quick Add Delete Fix

### Task 5: Debug and fix the "delete" command in Quick Add bar

**Files:**
- Modify: `src/App.jsx` — handleQuickAdd function (~line 673-760)

- [ ] **Step 1: Read and trace the delete regex**

Read `src/App.jsx` handleQuickAdd function. Find the delete regex:
```javascript
const deleteMatch = input.match(/^(delete|remove|cancel)\s+(?:my\s+|all\s+)?(.+?)(?:\s+events?)?$/i);
```

Test mentally against these inputs:
- "delete soccer" → should match, keyword = "soccer"
- "delete muffins" → should match, keyword = "muffins"
- "remove my event" → should match, keyword = "event"
- "delete" (no keyword) → should NOT match

If the regex works, the issue is likely in `searchEvents()`.

- [ ] **Step 2: Verify searchEvents function**

Read `searchEvents()` (~line 644):
```javascript
function searchEvents(keyword) {
  const matches = [];
  const kw = keyword.toLowerCase();
  Object.entries(events || {}).forEach(([dk, dayEvs]) => {
    (dayEvs || []).forEach((ev, idx) => {
      if (ev.title.toLowerCase().includes(kw)) matches.push({ dk, idx, ev });
    });
  });
  return matches;
}
```

Potential issues:
1. `events` is the raw Firebase state, NOT the expanded `displayEvents` — this is correct for deletion
2. If `events` is empty/undefined, `Object.entries({})` returns empty array — returns 0 matches
3. The function searches titles case-insensitively — correct

- [ ] **Step 3: Add empty events guard**

If `events` is empty or undefined when the user tries to delete, show a helpful message instead of silently returning:

```javascript
if (deleteMatch) {
  const keyword = deleteMatch[2].trim();
  if (!events || Object.keys(events).length === 0) {
    showToast("No events found. Try adding some first!", "info");
    setQuickAddLoading(false); setQuickAddInput(""); return;
  }
  const matches = searchEvents(keyword);
  // ... rest of delete handling
}
```

- [ ] **Step 4: Verify confirmation card renders**

After `searchEvents` returns matches:
- 0 matches: toast with upcoming events hint (already done in hotfix)
- 1 match: `setQuickAddDeleteMatches({ keyword, matches, single: true })` — renders confirmation card
- 2+ matches: `setQuickAddDeleteMatches({ keyword, matches, single: false })` — renders scrollable list

Read the JSX for `{quickAddDeleteMatches && (` to verify the confirmation card renders properly. Check that the `executeDeleteMatch` function actually deletes from Firebase.

- [ ] **Step 5: Simplify the delete regex**

Replace the complex regex with a simpler one that handles multi-word event names:
```javascript
const deleteMatch = input.match(/^(delete|remove|cancel)\s+(.+)$/i);
```
The old regex `(.+?)(?:\s+events?)?$` with lazy `.+?` and optional groups can fail with multi-word names like "delete soccer practice". The simpler regex captures everything after "delete " as the keyword.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "fix: Quick Add delete command — wider regex + empty events guard"
```

---

## Chunk 4: Game Access Fix for Yana

### Task 6: Debug why Yana can't play games

**Files:**
- Verify: `src/App.jsx` — Kids tab rendering (~line 2580-2600)
- Verify: `src/LucacLegends.jsx:734` — component props

- [ ] **Step 1: Trace the game launch path for a kid profile**

When Yana (type: "kid") is logged in:
1. `isKid` = true, `screen` = "app" → enters kid-specific render path (line 1128)
2. Kid tabs: Home, My Stuff (kids), Food
3. On "My Stuff" tab, there's a "🎮 Play LUCAC Legends" button (line 1171)
4. Clicking it sets `showGame(true)` → renders `<LucacLegends profile={currentProfile} kidsData={kidsData} fbSet={fbSet} />`

This should work for ANY kid profile. Check if:
- The `showGame` state is properly toggled
- The `<LucacLegends>` component actually renders (no conditional hiding it)
- The profile prop passes through correctly

- [ ] **Step 2: Check LucacLegends for profile.type blocks**

Search `src/LucacLegends.jsx` for any `profile.type` or `profile?.type` checks. There should be ZERO. The code path analysis shows the component accepts any profile.

If the code path works on paper but Yana still can't play, the bug is likely:
1. **Firebase data issue**: Yana's profile may have `type: "family"` instead of `type: "kid"` — check Firebase directly
2. **Screen state issue**: `showGame` may not toggle correctly in the kid view
3. **Profile prop not passed**: The `<LucacLegends>` render may receive `null` for profile

To diagnose: add a temporary `console.log("LucacLegends mounted, profile:", profile)` at the top of the component function and test with Yana's profile in the browser.

- [ ] **Step 3: Check difficulty detection**

Read how LucacLegends determines easy vs hard difficulty. Look for name-based checks:
```javascript
const isLucaMode = profile?.name?.toLowerCase?.()?.includes?.("luca");
```

If Yana's name doesn't trigger "hard" mode, fix the check to also support Yana or use age-based logic.

- [ ] **Step 4: Also verify admin game access path**

When admin views Kids tab (line 2580):
```jsx
{(isAdmin || isParent) && (
  <button onClick={()=>setShowGame(true)}>🎮 LUCAC Legends</button>
)}
```

This renders for admin and parent. Clicking launches LucacLegends with `currentProfile` as admin — games should work for testing.

- [ ] **Step 5: Commit**

```bash
git add src/LucacLegends.jsx src/App.jsx
git commit -m "fix: games accessible for all kid profiles including Yana"
```

---

## Chunk 5: Parent Event Ownership

### Task 7: Parents can delete/edit their own events

**Files:**
- Verify: `src/App.jsx` — day popup edit/delete buttons (~line 1794-1806)

- [ ] **Step 1: Verify edit/delete buttons show for event creators**

Read `src/App.jsx` day popup section. After the hotfix, buttons should use:
```jsx
{(isAdmin || ev.creator === currentProfile?.name) && <button>✏️</button>}
{(isAdmin || ev.creator === currentProfile?.name) && <button>🗑️</button>}
```

If Danielle creates an event, `ev.creator` = "Danielle". When she views it, `currentProfile.name` = "Danielle" → buttons show.
If Alex views Danielle's event, `isAdmin` = true → buttons show.
If Danielle views Alex's event, neither condition is true → buttons hidden.

- [ ] **Step 2: Ensure new events always set creator field**

Read `saveEvents()` (~line 543). Verify all events get a `creator` field:
```javascript
if (!eventPrivate && currentProfile?.name) { eventData.creator = currentProfile.name; }
```

Issue: this only sets creator when `!eventPrivate`. It should ALWAYS set creator unconditionally. Fix:
```javascript
eventData.creator = currentProfile?.name || "Unknown";
if (eventPrivate && isAdmin) { eventData.private = true; }
```

Remove the two conditional lines and replace with the unconditional version above.

- [ ] **Step 3: CRITICAL — Ensure Quick Add events also set creator**

Read `confirmQuickAdd()` (~line 762). The `eventData` object currently is:
```javascript
const eventData = { title: ev.title, time: ev.time || "12:00 PM", who: ev.who || "", notes: ev.notes || "", duration: ev.duration || 60 };
```

**This is missing `creator`!** Without it, parent ownership is completely broken for Quick Add events — Danielle can never edit/delete events she created via Quick Add. Fix:
```javascript
const eventData = { title: ev.title, time: ev.time || "12:00 PM", who: ev.who || "", notes: ev.notes || "", duration: ev.duration || 60, creator: currentProfile?.name || "Unknown" };
```

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "fix: always set event creator — enables parent ownership"
```

---

## Chunk 6: Build, Verify, Push

### Task 8: Final build and verification

**Files:**
- All modified files

- [ ] **Step 1: Run production build**

```powershell
npx vite build
```

Expected: `✓ built in ~2-3s` with no errors (chunk size warning is acceptable).

- [ ] **Step 2: Mental verification checklist**

Trace these scenarios through the code:
1. Danielle (parent) opens Settings → sees "My Profile" (name + PIN) but NOT role dropdown, NOT other users' PINs
2. Danielle opens Family → sees Schedule, My Rules, Their Rules, Shared — NOT Log, NOT Budget
3. Danielle creates event "Dentist" → `creator: "Danielle"` saved. She can edit/delete it. Alex can too (admin).
4. Alex creates private event → `private: true, creator: "Alex"`. Danielle cannot see it.
5. Yana opens Kids → My Stuff → Play LUCAC Legends → game menu renders with 4 games
6. User says "delete soccer" into Quick Add → regex matches → searchEvents runs → confirmation card appears
7. User taps mic → single utterance → processes once → stops

- [ ] **Step 3: Commit and push**

```powershell
git add src/App.jsx src/utils.js src/LucacLegends.jsx src/HomeworkHelper.jsx src/FoodTab.jsx
git commit -m "v27a security lockdown + voice fix + delete fix + game access + parent ownership"
git push
```

---

## Future Plans (not in this plan)

- **v27b:** Family tab overhaul (2-2-5-5 custody pattern, rule proposals, shared family calendar)
- **v27c:** Home customization (widget toolbars, calendar resize/float, shopping list widget, daily spotlight, birthday collapse) + Food tab MacroFactor expansion (30+ micronutrients, expenditure tracking, macro coaching)
