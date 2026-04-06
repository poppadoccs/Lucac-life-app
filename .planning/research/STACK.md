# Technology Stack

**Project:** Lucac Life App — Games & AI Tutoring Milestone
**Researched:** 2026-04-05
**Scope:** Canvas finger drawing, text-to-speech quality, Groq story generation, Firebase cross-device board games

---

## Existing Stack (Do Not Change)

| Technology | Version | Role |
|------------|---------|------|
| React | 18.2.0 | UI framework |
| Vite | 4.4.0 | Build tool |
| Firebase | 10.7.0 | Realtime Database + persistence |
| Groq API | (REST) | AI completions — llama-3.1-8b-instant default |
| Web Speech API | (browser native) | Voice input (already in utils.js) |
| SpeechSynthesis API | (browser native) | Read-aloud (existing but broken) |

**Constraint from PROJECT.md:** "No new dependencies. Keep bundle under control. CSS-only solutions preferred."
The constraints below are designed around ZERO new npm packages.

---

## Recommended Stack — New Capabilities

### 1. Canvas Finger Drawing (Avatar System)

**Recommendation: Raw HTML5 Canvas API with Pointer Events — zero dependencies**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| HTML5 Canvas API | Browser native | Drawing surface | Already supported everywhere; zero bundle cost |
| Pointer Events API | Browser native | Touch + mouse + stylus input | Single unified API for all input types — replaces Touch Events |
| `canvas.toDataURL()` | Browser native | Export drawing as base64 string | Stores in Firebase as a string value |

**Implementation pattern (verified against MDN Pointer Events docs):**

```jsx
// Inside AvatarDrawing component
const canvasRef = useRef(null);
const isDrawing = useRef(false);

useEffect(() => {
  const canvas = canvasRef.current;
  const ctx = canvas.getContext("2d");

  // Crisp rendering on Retina/high-DPI (verified: MDN Canvas Optimizing guide)
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const start = (e) => {
    isDrawing.current = true;
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };
  const draw = (e) => {
    if (!isDrawing.current) return;
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };
  const stop = () => { isDrawing.current = false; };

  canvas.addEventListener("pointerdown", start);
  canvas.addEventListener("pointermove", draw);
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);

  return () => {
    canvas.removeEventListener("pointerdown", start);
    canvas.removeEventListener("pointermove", draw);
    canvas.removeEventListener("pointerup", stop);
    canvas.removeEventListener("pointercancel", stop);
  };
}, []);
```

**Critical CSS rule (without this, browser scroll/zoom intercepts touch):**

```jsx
// On the canvas element
style={{ touchAction: "none" }}
```

**Saving to Firebase:**

Use `toDataURL("image/jpeg", 0.5)` — estimated 15–30 KB for a 300x300 avatar (per MDN pixel manipulation docs). Store the base64 string at `avatars/{profileName}`. Do NOT use `toBlob()` — it returns a Blob that cannot be stored directly in Firebase Realtime Database as a string value.

**Confidence: HIGH** — All core APIs are browser-native with no library dependency. Pointer Events API is well-documented at MDN and supported in all modern browsers. The devicePixelRatio pattern is verified from MDN's Optimizing Canvas tutorial.

---

### 2. Text-to-Speech (Read-Aloud, Non-Robotic)

**Recommendation: Web SpeechSynthesis API with deliberate voice selection — zero dependencies**

The existing app already uses Web Speech API for input (createSpeechRecognition in utils.js). The output side (SpeechSynthesis) exists but uses default voice, which sounds robotic.

**Root cause of "V1 Siri" problem:** The browser picks its system default voice, which on older Android and some desktop Chrome installations is a low-quality TTS engine. On modern Chrome desktop, Google's "Natural" voices are available but must be selected explicitly.

**Fix: Voice priority selection at runtime**

```js
// Add to utils.js alongside createSpeechRecognition
export function getBestVoice(lang = "en-US") {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  // Priority 1: Google Natural voices (Chrome, best quality)
  const googleNatural = voices.find(v =>
    v.lang.startsWith(lang.split("-")[0]) &&
    v.name.toLowerCase().includes("google") &&
    v.name.toLowerCase().includes("natural")
  );
  if (googleNatural) return googleNatural;

  // Priority 2: Any Google voice (still better than system default)
  const googleVoice = voices.find(v =>
    v.lang.startsWith(lang.split("-")[0]) &&
    v.name.toLowerCase().includes("google")
  );
  if (googleVoice) return googleVoice;

  // Priority 3: Non-local (cloud-based) voice — generally higher quality
  const cloudVoice = voices.find(v =>
    v.lang.startsWith(lang.split("-")[0]) &&
    !v.localService
  );
  if (cloudVoice) return cloudVoice;

  // Fallback: system default
  return voices.find(v => v.default) || voices[0];
}
```

**Key insight from MDN SpeechSynthesisVoice docs:** The `localService` property is `false` for cloud-based voices. Cloud voices are almost always higher quality than local TTS engines. Prefer `localService: false` when available.

**Preventing the "repeating" bug:** The existing app likely calls `synth.speak()` without canceling first. Always call `synth.cancel()` before a new utterance.

```js
export function speak(text, lang = "en-US") {
  const synth = window.speechSynthesis;
  synth.cancel(); // Kill any in-progress speech first
  const utter = new SpeechSynthesisUtterance(text);
  utter.voice = getBestVoice(lang);
  utter.rate = 0.9;   // Slightly slower than default — better for kids
  utter.pitch = 1.0;  // Natural pitch
  synth.speak(utter);
  return utter; // Caller can attach onend/onerror handlers
}
```

**Add a speak() export to utils.js** — replaces all ad-hoc SpeechSynthesisUtterance calls scattered through components.

**Voices timing note:** `getVoices()` returns empty array on first call in Chrome. Must use `speechSynthesis.onvoiceschanged` event or retry after a short delay:

```js
function getVoicesReady() {
  return new Promise(resolve => {
    const voices = speechSynthesis.getVoices();
    if (voices.length) return resolve(voices);
    speechSynthesis.onvoiceschanged = () => resolve(speechSynthesis.getVoices());
  });
}
```

**Confidence: HIGH** — Web Speech API is well-documented at MDN. Voice selection logic is derived from the SpeechSynthesisVoice property spec. The `localService` / Google Natural priority chain is the standard community pattern for getting the best available voice without external APIs.

**What NOT to use:**
- ElevenLabs, AWS Polly, Google Cloud TTS — all require paid API keys, network calls, and violate the "no new paid APIs" constraint
- ResponsiveVoice.js — was free-to-use but is now commercial and adds ~200KB
- Web Audio API synthesis from scratch — extremely complex, not appropriate here

---

### 3. Groq-Powered Story Generation for Kids

**Recommendation: groqFetch() (existing) with llama-3.3-70b-versatile model for stories**

The existing `groqFetch` in `utils.js` handles everything. The story feature is purely a prompting and UX problem, not a library problem.

**Model selection:**

| Model | Best For | Context | Speed |
|-------|----------|---------|-------|
| `llama-3.1-8b-instant` | Quick tasks, parsing, Q&A | 128k | Fastest |
| `llama-3.3-70b-versatile` | Creative writing, stories, nuanced output | 128k | Fast |
| `llama3-8b-8192` | Legacy fallback | 8k | Fast |

**Use `llama-3.3-70b-versatile` for story generation.** The 8b model produces generic, repetitive stories. The 70b model generates vivid, age-appropriate narratives with character consistency. Both are on the Groq free tier.

**Confidence: MEDIUM** — Model naming based on training data knowledge of Groq's model catalog as of mid-2025. The `llama-3.3-70b-versatile` model was available at knowledge cutoff. Verify against the Groq console before shipping — model names on Groq sometimes change with new releases.

**Prompting pattern for 500+ word kids stories:**

```js
const storyPrompt = [
  {
    role: "system",
    content: `You are a children's story author writing for ${kidName}, age ${kidAge}.
Write vivid, age-appropriate adventure stories with clear heroes, a problem, and a satisfying ending.
Use short paragraphs (2-3 sentences each). Include the child's name as the hero.
Never include violence, scary monsters for young kids, or adult themes.
Always end happily.`
  },
  {
    role: "user",
    content: `Write a ${storyLength}-word story about ${kidName} and ${storyPrompt}.
Include dialogue. Make it exciting and fun.`
  }
];

const result = await groqFetch(apiKey, storyPrompt, {
  maxTokens: 1200,   // ~900 words output buffer
  model: "llama-3.3-70b-versatile",
  timeout: 20000     // Stories take longer — increase timeout from 10s to 20s
});
```

**Critical: Increase timeout for stories.** The existing `groqFetch` defaults to 10s. A 500-word story from the 70b model can take 8–15 seconds. Pass `timeout: 20000` explicitly.

**Rate limit awareness:** Stories consume ~1,200 tokens. On Groq's free tier, this represents significant token usage. Cache generated stories in localStorage using the existing `cacheSet` utility. Key by `story_${kidName}_${theme}` to avoid regenerating the same story.

```js
// Before calling Groq
const cacheKey = `story_${kidName}_${theme}`;
const cached = cacheGet(cacheKey);
if (cached) return cached;

// After calling Groq
cacheSet(cacheKey, storyText);
```

**Confidence: HIGH** for the implementation pattern. MEDIUM for specific model name — verify at runtime.

---

### 4. Cross-Device Real-Time Board Game via Firebase

**Recommendation: Firebase Realtime Database with transaction-based turn enforcement — zero new dependencies**

The app already uses Firebase 10 Realtime Database. The board game (replacing Potion game with Monopoly-style) needs cross-device turn-based play among Alex, Danyells, Yana, and Luca.

**Data structure for a cross-device board game:**

```
/boardGame/
  activeGame/
    gameId: "game_1712345678"
    status: "active"          // "lobby" | "active" | "ended"
    currentTurn: "Alex"       // Profile name whose turn it is
    turnNumber: 4
    players: {
      Alex:    { position: 12, money: 1400, color: "#3b82f6", connected: true }
      Danyells: { position: 7,  money: 1600, color: "#ec4899", connected: true }
      Yana:    { position: 3,  money: 1200, color: "#22c55e", connected: false }
      Luca:    { position: 9,  money: 800,  color: "#f59e0b", connected: true }
    }
    board: {
      // Only owned/modified spaces stored; derive rest from static BOARD_SPACES config
      "5":  { owner: "Alex",    house: 1 }
      "12": { owner: "Danyells", house: 0 }
    }
    lastMove: {
      player: "Alex"
      dice: [3, 4]
      action: "moved_to_12"
      timestamp: 1712345678000
    }
    log: {
      "1712345678000": "Alex rolled 7 and moved to Park Place"
      "1712345679000": "Danyells bought Boardwalk for $400"
    }
  settings/
    maxPlayers: 4
    boardTheme: "lucac"
```

**Turn enforcement pattern:**

The key problem in cross-device board games is preventing two players from acting simultaneously. Firebase Realtime Database has `runTransaction()` for atomic reads+writes.

```js
import { ref, runTransaction, onValue } from "firebase/database";

async function takeTurn(db, profileName, action) {
  const gameRef = ref(db, "boardGame/activeGame");
  const result = await runTransaction(gameRef, (game) => {
    if (!game) return; // Abort if no game exists
    if (game.currentTurn !== profileName) return; // Not your turn — abort
    // Apply action atomically
    game.players[profileName].position = action.newPosition;
    game.currentTurn = action.nextPlayer;
    game.turnNumber = (game.turnNumber || 0) + 1;
    game.lastMove = { player: profileName, dice: action.dice, timestamp: Date.now() };
    return game;
  });
  return result.committed; // false = turn already taken (race condition prevented)
}
```

**Listening for game state across devices:**

```js
// In BoardGame component — all players subscribe to same path
useEffect(() => {
  const gameRef = ref(db, "boardGame/activeGame");
  const unsub = onValue(gameRef, (snapshot) => {
    setGameState(snapshot.val());
  });
  return () => unsub();
}, [db]);
```

**Presence (knowing who is connected):**

```js
import { ref, onValue, onDisconnect, set } from "firebase/database";

// Mark player as connected; auto-clear on disconnect
const presenceRef = ref(db, `boardGame/activeGame/players/${profileName}/connected`);
set(presenceRef, true);
onDisconnect(presenceRef).set(false);
```

**Firebase free tier constraints:**
- Spark plan: 1 GB storage, 10 GB/month transfer, 100 simultaneous connections
- A 4-player board game with ~100 moves each generates roughly 10 KB of data — well within limits
- `onValue` listeners count toward simultaneous connections — 4 players = 4 connections, far below limit

**Confidence: HIGH** — Firebase Realtime Database `runTransaction`, `onValue`, and `onDisconnect` are all well-established, stable Firebase APIs used extensively in multiplayer game examples. The `firebase` package is already installed at version 10.7.0 which includes all these APIs.

**What NOT to use:**
- Firebase Firestore — more complex pricing, transactions work differently, overkill for this use case. Realtime Database is already wired in
- socket.io — requires a server, not compatible with Vercel static hosting without a separate backend
- Partykit / Liveblocks — paid services with free tier limits that add npm dependencies
- Firebase Cloud Functions — no backend needed; client-side transactions are sufficient for turn enforcement in a family game

---

## Summary: No New npm Packages Required

| Capability | Solution | New Package? |
|------------|----------|--------------|
| Canvas finger drawing | HTML5 Canvas + Pointer Events API | None |
| Crisp retina canvas | `devicePixelRatio` + `ctx.scale()` | None |
| Save avatar to Firebase | `canvas.toDataURL("image/jpeg", 0.5)` | None |
| Better TTS voice | `getBestVoice()` helper in utils.js | None |
| No repeat speech bug | `synth.cancel()` before each utterance | None |
| Kids story generation | `groqFetch()` with 70b model + 20s timeout | None |
| Story caching | `cacheSet/cacheGet` (existing) | None |
| Cross-device board game | Firebase `onValue` + `runTransaction` | None |
| Player presence | Firebase `onDisconnect` | None |

All four capabilities are achievable using browser-native APIs and the existing Firebase + Groq stack. Bundle size impact: zero.

---

## Files to Modify / Create

| File | Change |
|------|--------|
| `src/utils.js` | Add `getBestVoice()`, `speak()`, `getVoicesReady()` helpers |
| `src/LucacLegends.jsx` | Split into game files BEFORE modifying (per PROJECT.md decision) |
| `src/AvatarDrawing.jsx` | New component — canvas finger draw, save to Firebase |
| `src/BoardGame.jsx` | New component — Monopoly-style, Firebase cross-device |
| `src/FishGame.jsx` | Split from LucacLegends.jsx |
| `src/RacingGame.jsx` | Split from LucacLegends.jsx |
| `src/ReadingGame.jsx` | New — Groq story gen + SpeechSynthesis read-aloud |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Touch drawing | Pointer Events API (native) | react-sketch-canvas, Fabric.js | Adds npm dependency; overkill for avatar drawing |
| TTS quality | SpeechSynthesis voice selection | ElevenLabs, AWS Polly | Paid APIs violate free-tier constraint |
| TTS quality | SpeechSynthesis voice selection | ResponsiveVoice.js | Now commercial; adds 200KB |
| Story gen AI | Groq (existing) | OpenAI GPT-4o | Already paid; Groq is free for this use case |
| Board game sync | Firebase Realtime DB (existing) | Socket.io | Requires server — Vercel is static hosting |
| Board game sync | Firebase Realtime DB | Firestore | Already use Realtime DB; Firestore pricing more complex |
| Board game sync | Firebase Realtime DB | Liveblocks/Partykit | New paid dependency |

---

## Sources

- MDN Pointer Events API: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events (HIGH confidence)
- MDN Canvas Optimizing (devicePixelRatio): https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas (HIGH confidence)
- MDN HTMLCanvasElement.toDataURL: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL (HIGH confidence)
- MDN SpeechSynthesisVoice: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice (HIGH confidence — localService property documented)
- MDN SpeechSynthesisUtterance: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance (HIGH confidence)
- Firebase SDK version: package.json `firebase: ^10.7.0` (HIGH confidence — verified in codebase)
- Groq model selection: training data knowledge of Groq model catalog (MEDIUM confidence — verify model names in Groq console before shipping)
- Groq timeout recommendation: derived from existing `groqFetch` implementation in `src/utils.js` (HIGH confidence)
