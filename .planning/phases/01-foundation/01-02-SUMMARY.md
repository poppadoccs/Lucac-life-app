---
phase: 01-foundation
plan: 02
subsystem: App.jsx security hardening
tags: [security, firebase, role-based-access, privacy, events]
dependency_graph:
  requires: [01-01]
  provides: [canWrite-in-fbSet, isPrivate-event-model, filterEventsForRole-backward-compat]
  affects: [src/App.jsx, src/HomeTab.jsx]
tech_stack:
  added: [update, runTransaction from firebase/database]
  patterns: [canWrite guard before Firebase write, isPrivate dual-field forward/backward compat, admin-only badge guard]
key_files:
  created: []
  modified:
    - src/App.jsx
    - src/HomeTab.jsx
decisions:
  - "Write both isPrivate (new) and private (legacy) fields on event creates — ensures filterEventsForRole works for old and new events without migration"
  - "canWrite guard calls showToast before returning — user always gets feedback on permission block"
  - "🔒 Private badge moved after ev.title in markup — avoids breaking title truncation with inline badge"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-06"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
requirements_addressed: [FOUND-03, FOUND-05, SEC-01, SEC-02]
---

# Phase 1 Plan 02: App.jsx Security Hardening

## One-liner

Firebase write guard via canWrite + backward-compatible isPrivate event privacy model with admin toggle and styled badge.

## What Was Built

Four targeted changes to `src/App.jsx` plus one badge upgrade in `src/HomeTab.jsx`:

### Firebase Imports Extended (FOUND-05)

```javascript
import { getDatabase, ref, set, onValue, update, runTransaction } from "firebase/database";
```

`update` and `runTransaction` added. Required for Phase 4 board game turn enforcement and multi-path atomic writes.

### canWrite Guard in fbSet (SEC-01)

```javascript
function fbSet(key, val) {
  if (!canWrite(currentProfile, key)) {
    showToast("You don't have permission to do that.", "error");
    return;
  }
  set(ref(db, key), val).catch(() => { cacheSet(key, val); });
}
```

Every Firebase write in the app now passes through the role-based guard from `src/utils.js`. Non-admins writing to admin-only paths (profiles, contacts, themeName, etc.) are blocked with a toast. Guest role always returns false.

### filterEventsForRole Updated (SEC-02)

```javascript
const isPrivateEvent = ev.isPrivate ?? ev.private ?? false;
if (isPrivateEvent) {
  const eventCreator = ev.creator ?? "admin";
  return eventCreator === profile.name;
}
```

Backward-compatible triple-null-coalesce: new events use `isPrivate`, old Firebase events use `private`, missing field defaults to `false` (D-16/D-17). `creator ?? "admin"` ensures old events without a creator field are treated as admin-owned (safe default).

### isPrivate Field on All Event Writes

All three event creation paths now write the `isPrivate` field:

- `saveEvents()` — manual form: writes `isPrivate: true` + `private: true` when admin toggles private; `isPrivate: false` otherwise
- `executeAgentActions()` — Jr. agent creates: `isPrivate: false` by default; respects `args.isPrivate` if AI passes it
- `confirmQuickAdd()` — AI quick add: `isPrivate: false` always (AI-created events are never private)

### Private Badge Upgrade (HomeTab.jsx, UI-SPEC)

Upgraded from a bare `🔒` emoji to the full styled badge per 01-UI-SPEC.md:

```jsx
{(ev.isPrivate || ev.private) && isAdmin && (
  <span style={{
    fontSize: 11, fontWeight: 700, color: V.accent,
    background: `${V.accent}18`, padding: "2px 8px",
    borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 4,
    marginLeft: 6
  }}>
    🔒 Private
  </span>
)}
```

Badge only renders for admin — non-admins never reach this code path since `filterEventsForRole` removes private events before render.

## Commits

| Hash | Description |
|------|-------------|
| `17baf24` | feat(01-02): extend Firebase imports, add canWrite guard to fbSet, update filterEventsForRole |
| `9e40a40` | feat(01-02): add isPrivate field to event writes, upgrade private badge to UI-SPEC style |

## Verification Results

- All 8 success criteria: PASS
- `npm run build`: PASS (pre-existing 500KB chunk warning is out of scope)
- Firebase import line: `update, runTransaction` confirmed present
- fbSet: `canWrite(currentProfile, key)` guard confirmed present
- filterEventsForRole: `ev.isPrivate ?? ev.private ?? false` and `ev.creator ?? "admin"` confirmed
- isPrivate toggle: exists in HomeTab.jsx (passed via `eventPrivate` prop from App.jsx line 130)
- Private badge: `🔒 Private` with `fontSize: 11, fontWeight: 700` confirmed in HomeTab.jsx
- All event writes include `isPrivate`: confirmed across saveEvents, executeAgentActions, confirmQuickAdd

## Deviations from Plan

### Pre-existing work (not deviations — plan aligned with actual state)

The plan specified adding `newEventPrivate` state and a new toggle JSX. On inspection, `eventPrivate` / `setEventPrivate` (line 130 of App.jsx) and the form toggle (HomeTab.jsx lines 367-374) already existed as `eventPrivate`. The plan description used `newEventPrivate` as a placeholder name — the pre-existing `eventPrivate` name is functionally identical and the correct choice (changing it would break the existing toggle flow).

**Action taken:** Used the pre-existing `eventPrivate` state and toggle rather than adding a duplicate. The toggle already met spec requirements — only the badge styling upgrade was needed.

### Dual-field write (Rule 2 — missing critical functionality)

The plan said to write `isPrivate` field. The existing code only wrote `private: true`. To maintain full backward compatibility without a data migration, both `isPrivate` and `private` are now written together on new events. This ensures `filterEventsForRole` works correctly whether an event was created before or after this change.

## Known Stubs

None — all changes are complete implementations.

## Self-Check: PASSED

Files modified:
- `src/App.jsx` — FOUND (modified)
- `src/HomeTab.jsx` — FOUND (modified)

Commits exist:
- `17baf24` — FOUND
- `9e40a40` — FOUND
