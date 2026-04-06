# Research Summary: Lucac Life App — Games & AI Tutoring Milestone

**Domain:** Kid-focused family life management app — games, AI tutoring, co-parenting features
**Researched:** 2026-04-05
**Overall confidence:** HIGH for implementation patterns; MEDIUM for Groq model names (verify at runtime)

---

## Executive Summary

This milestone adds four new technical capabilities to the existing React 18 + Vite + Firebase + Groq app: canvas-based finger drawing for avatar creation, natural-sounding text-to-speech for the reading game, Groq-powered story generation, and cross-device real-time board game play.

The most important finding: all four capabilities are achievable with zero new npm packages. The browser's native APIs — Pointer Events for canvas drawing, SpeechSynthesis for read-aloud, the existing groqFetch utility for stories, and Firebase Realtime Database's runTransaction for board game turn enforcement — cover every requirement. Bundle size impact is zero.

The second most important finding: the existing "V1 Siri" TTS problem is a voice selection problem, not a library problem. Modern Chrome has Google Natural voices available but they must be selected explicitly at runtime using getVoices() and filtering for Google/cloud-based voices before falling back to the system default. Adding synth.cancel() before every new utterance fixes the "keeps repeating" bug.

The largest risk in this milestone is the LucacLegends.jsx file split. At 2,249 lines, all game upgrades require editing this single file simultaneously, which causes merge conflicts in parallel development. The split into FishGame.jsx, RacingGame.jsx, BoardGame.jsx, and ReadingGame.jsx must happen before any game feature work starts — this is already logged as a key decision in PROJECT.md and confirmed by the ARCHITECTURE.md and PITFALLS.md from the parallel research thread.

---

## Key Findings

**Stack:** Zero new npm packages needed — all capabilities use browser-native APIs plus existing Firebase + Groq
**Architecture:** LucacLegends.jsx split is the critical prerequisite that unlocks all parallel game development
**Critical pitfall:** Canvas touch drawing breaks silently without touch-action:none CSS on the canvas element — browser scroll intercepts pointer events before they reach the canvas

---

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Phase 1: Infrastructure + Fixes** — Split LucacLegends, fix TTS voice selection, add speak() to utils.js
   - Addresses: "Split LucacLegends into separate game files", "Read-aloud voice fixed"
   - Avoids: File conflict paralysis — no parallel game work can happen safely until this is done
   - Risk: Low — mechanical split with no behavior change

2. **Phase 2: Avatar Drawing + Reading Game** — AvatarDrawing.jsx (canvas), ReadingGame.jsx (Groq stories + TTS)
   - Addresses: "Avatar drawing restored", "Reading game with Groq-generated stories"
   - Avoids: Running story generation against rate limits without caching
   - Risk: Medium — story quality depends on prompt engineering, not library risk

3. **Phase 3: Fish + Racing Game Upgrades** — FishGame.jsx difficulty scaling, RacingGame.jsx power-ups
   - Addresses: "Fish game difficulty scaling", "Racing game full upgrade"
   - Avoids: Nothing new technically — pure game logic work after split
   - Risk: Low — no new APIs

4. **Phase 4: Board Game (Cross-Device)** — BoardGame.jsx with Firebase runTransaction
   - Addresses: "Potion game remade as family board game, cross-device via Firebase"
   - Avoids: Race conditions via transaction-based turn enforcement
   - Risk: Medium — real-time synchronization needs testing across actual devices, not just browser tabs

**Phase ordering rationale:**
- Phase 1 is a hard prerequisite: cannot safely parallelize game work in a single 2249-line file
- Phase 2 (Avatar + Reading) chosen before game upgrades because kids need the reading game and avatar for engagement before they care about difficulty scaling
- Phase 3 (Fish + Racing) is pure enhancement with no new technical risk
- Phase 4 (Board Game) is last because it is the highest complexity feature and most likely to surface edge cases during family testing

**Research flags for phases:**
- Phase 2: Groq model name for story generation — verify llama-3.3-70b-versatile is still available in Groq console before coding
- Phase 4: Firebase Security Rules — the existing open rules are fine for a family game; client-side runTransaction provides sufficient turn enforcement
- Phase 1: TTS voice availability varies by device — test speak() helper on Alex's and kids' actual devices before finalizing the voice priority chain

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Canvas drawing (Pointer Events) | HIGH | Verified against MDN official docs — pointer events, touch-action, pointerId |
| devicePixelRatio canvas setup | HIGH | Verified against MDN Canvas Optimizing tutorial |
| Avatar save to Firebase (toDataURL) | HIGH | ~15-30KB at JPEG 0.5 quality per MDN pixel manipulation docs |
| TTS voice selection logic | HIGH | Verified localService + name pattern from MDN SpeechSynthesisVoice spec |
| TTS repeat bug fix | HIGH | synth.cancel() is documented SpeechSynthesis API |
| Groq story generation pattern | HIGH | Uses verified groqFetch utility already in src/utils.js |
| Groq model names | MEDIUM | llama-3.3-70b-versatile correct at training cutoff — verify in console |
| Firebase runTransaction for turns | HIGH | firebase@10.7.0 already in package.json, API well-established |
| Firebase onDisconnect presence | HIGH | Stable Firebase API at existing installed version |
| Bundle size impact | HIGH | Zero new packages confirmed by checking package.json |

---

## Gaps to Address

- Groq model availability: verify exact model names available on free tier in Groq console at development time — do not assume training data model names are current
- TTS device testing: the voice priority chain was designed from MDN spec but actual voice names are OS-dependent — test on Android (kids' tablets) and iOS specifically
- Firebase Security Rules: current rules are open (works for a trusted family app) but board game turn enforcement in rules would add an extra layer — decide whether to add rules or rely purely on client-side transaction logic
- Canvas coordinate accuracy: Pointer Events clientX/clientY must be adjusted for canvas position using getBoundingClientRect() — include this in implementation to prevent offset drawing bugs
- aiAgent.js: the parallel research found this file exists but it was not in the architecture table in CLAUDE.md — confirm its current state before any refactoring
