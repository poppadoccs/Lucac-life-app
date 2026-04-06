# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 01-foundation
**Areas discussed:** Game file split, Security & write guards, TTS voice & controls, Event privacy model, AI per-role access

---

## Game File Split Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| One file per game | FishGame, RacingGame, BoardGame, ReadingGame, CoopGame + thin shell. 6 files. | |
| Games + RPG separate | Same but also split RPG adventure/battle. 7 files. | |
| You decide | Let Claude pick. | |

**User's choice:** Custom — LucacLegends stays as shell under 200 lines. Games to `src/games/`: FishGame, RacingGame, BoardGame, ReadingGame, AvatarCreator. Three coupling points (addStars, transitionTo, curriculum). Shell reads curriculum from Firebase once, passes as prop. No shared constants file.

---

## Security & Write Guards

| Option | Description | Selected |
|--------|-------------|----------|
| Guard sensitive paths only | Wrap fbSet for profiles, events, kidsData, settings. Kids can still complete tasks. | ✓ |
| Guard everything | Every fbSet call checks role. | |
| You decide | Let Claude determine. | |

**User's choice:** Guard sensitive paths only. `canWrite(profile, path)` in utils.js. Blocks admin settings, other users' data, private events. Allows kids' own scores/homework. Note: utils.js is merge collision point.

---

## TTS Voice & Controls

| Option | Description | Selected |
|--------|-------------|----------|
| Shared util in utils.js | One speak() with voice selection, cancel-before-speak, stop export. | ✓ |
| Per-component | Each file keeps own speakText but improved. | |
| You decide | Let Claude pick. | |

**User's choice:** Shared `speakText(text, { voice, onStop })` in utils.js. Kill duplicates. Natural voice, stop handle, repeat bug fix. Leave voicePreference param open for future picker.

---

## Event Privacy Model

| Option | Description | Selected |
|--------|-------------|----------|
| createdBy + isPrivate flag | Every event gets createdBy + admin can mark private. Extend filterEventsForRole. | ✓ |
| Role-based visibility lists | visibleTo array per event. More granular but complex. | |
| You decide | Simplest approach. | |

**User's choice:** isPrivate boolean + createdBy string. Filter: hide where isPrivate && createdBy !== currentUser. Old events: default createdBy to "admin", isPrivate to false. No backfill.

---

## AI Per-Role Access (added by user)

**User's choice:** AI assistant on every profile. Three explicit tool arrays:
- Admin: all tools
- Parent: calendar, budget, events, shopping list, daily spark
- Kid: emotional support, homework help, fun facts, game tips
Checked before tool execution. No vague rules — explicit lists.

---

## Claude's Discretion

- File naming within src/games/
- canWrite path matching implementation
- Voice selection algorithm internals
- filterEventsForRole privacy extension approach

## Deferred Ideas

None
