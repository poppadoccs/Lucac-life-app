// ═══ SHARED UTILITIES ═══
// Used by App.jsx and all component files

// --- Groq API wrapper with timeout + error handling ---
// Rate limit tracker — shared across all Groq calls
const _rateLimitState = { retryAfter: 0 };

export async function groqFetch(apiKey, messages, opts = {}) {
  const { maxTokens = 800, timeout = 10000, model = "llama-3.1-8b-instant" } = opts;
  if (!apiKey) return { ok: false, data: null, error: "No API key" };

  // Check if we're still in a rate limit cooldown
  const now = Date.now();
  if (_rateLimitState.retryAfter > now) {
    const waitSecs = Math.ceil((_rateLimitState.retryAfter - now) / 1000);
    return { ok: false, data: null, error: `AI is resting — try again in ${waitSecs}s` };
  }

  const { temperature = 0.7 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages, temperature }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    // Handle rate limiting
    if (resp.status === 429) {
      const retryHeader = resp.headers.get("retry-after");
      const waitMs = retryHeader ? parseInt(retryHeader) * 1000 : 60000;
      _rateLimitState.retryAfter = Date.now() + waitMs;
      const waitSecs = Math.ceil(waitMs / 1000);
      return { ok: false, data: null, error: `AI is resting — try again in ${waitSecs}s` };
    }

    if (!resp.ok) {
      return { ok: false, data: null, error: "AI had a hiccup — try again" };
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "";
    return { ok: true, data: content, error: null };
  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError") {
      return { ok: false, data: null, error: "Groq took too long — try again" };
    }
    return { ok: false, data: null, error: "AI is thinking... try again in a sec" };
  }
}

// Export rate limit state so aiAgent can check it too
export function isRateLimited() {
  return _rateLimitState.retryAfter > Date.now();
}
export function setRateLimited(ms) {
  _rateLimitState.retryAfter = Date.now() + ms;
}

// callAI — unified AI call function (AI-06 foundation, provider-agnostic interface).
// Currently wraps Groq only. When AI-06 ships this will auto-fallback
// Groq → OpenRouter → Ollama without callers needing to change.
export async function callAI(apiKey, messages, opts = {}) {
  return groqFetch(apiKey, messages, opts);
}

// computeExpr — safe sandboxed math evaluator.
// Returns the numeric result of an arithmetic expression string, or null if
// the expression contains unsafe chars or throws.  Kid-friendly operators
// (x, ×, ÷) are normalised to JS operators before evaluation.
// Exported separately so callers can compute deterministic math outside the
// regex-scanner context (e.g., unit tests, future math widgets).
export function computeExpr(expr) {
  if (typeof expr !== "string" || !expr.trim()) return null;
  const normalized = expr.replace(/[x×]/gi, "*").replace(/÷/g, "/");
  // Whitelist: only digits, operators, decimal points, whitespace — no keywords or function calls
  if (!/^[\d\s+\-*/.]+$/.test(normalized)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${normalized});`)();
    if (typeof result !== "number" || !isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

// verifyMath — scan AI text and silently correct wrong arithmetic before display.
// Moved here from HomeworkHelper.jsx so it is reusable across all components.
// Scans for "<expr> = <answer>" patterns; replaces wrong answers with the
// correct value from computeExpr.  Float-tolerance comparison prevents
// 0.1+0.2 = 0.30000000000000004 false-positive corrections.
// Background: the "5×10=40 incident" — LLMs pattern-match tokens, they don't
// compute.  Prompt-level "please double-check" fails ~5% of the time.
// This is the hard guarantee: JavaScript computes the truth, not the LLM.
export function verifyMath(text) {
  if (typeof text !== "string" || !text) return text;
  const pattern = /(\d+(?:\.\d+)?(?:\s*[+\-*x×/÷]\s*\d+(?:\.\d+)?)+)\s*=\s*(-?\d+(?:\.\d+)?)/gi;
  return text.replace(pattern, (match, expr, statedAnswer) => {
    const trueAnswer = computeExpr(expr);
    if (trueAnswer === null) return match;
    if (Math.abs(Number(statedAnswer) - trueAnswer) < 1e-9) return match;
    return `${expr} = ${trueAnswer}`;
  });
}

// --- Parse JSON from Groq response (strips markdown fences) ---
export function parseGroqJSON(raw) {
  try {
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// --- localStorage cache layer ---
export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(`lucac_${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function cacheSet(key, val) {
  try {
    localStorage.setItem(`lucac_${key}`, JSON.stringify(val));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

// --- Per-kid per-subject difficulty (S04) ---
// Parent-controlled via Settings → Learning. Drives problem scaling in games.
// Decoupled from ageBand (which only affects UI ergonomics). A gifted 6yo can
// be ageBand=early (big buttons) + difficulty=hard (challenging problems).
// Path: kidsData/{kidName}/difficulty/{subjectId} → "easy"|"medium"|"hard"|"extreme"
export const DIFFICULTY_LEVELS = ["easy", "medium", "hard", "extreme"];

export function getKidDifficulty(kidsData, kidName, subjectId) {
  if (!kidName || !subjectId) return "easy";
  const diff = kidsData?.[kidName]?.difficulty?.[subjectId];
  return DIFFICULTY_LEVELS.includes(diff) ? diff : "easy";
}

// --- Color swatch presets ---
export const SWATCH_COLORS = [
  { hex: "#ef4444", label: "Red" },
  { hex: "#f97316", label: "Orange" },
  { hex: "#f59e0b", label: "Gold" },
  { hex: "#eab308", label: "Yellow" },
  { hex: "#22c55e", label: "Green" },
  { hex: "#14b8a6", label: "Teal" },
  { hex: "#3b82f6", label: "Blue" },
  { hex: "#7c3aed", label: "Purple" },
  { hex: "#ec4899", label: "Pink" },
  { hex: "#f87171", label: "Coral" },
  { hex: "#92400e", label: "Brown" },
  { hex: "#6b7280", label: "Gray" },
];

// --- Confetti helper (pure CSS, no library) ---
export function triggerConfetti(container, intensity = "small") {
  if (!container) return;
  const count = intensity === "big" ? 60 : 20;
  const colors = ["#f59e0b", "#22c55e", "#3b82f6", "#ec4899", "#7c3aed", "#ef4444"];
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    const size = Math.random() * 8 + 4;
    el.style.cssText = `
      position:fixed; width:${size}px; height:${size}px; border-radius:${Math.random() > 0.5 ? "50%" : "2px"};
      background:${colors[Math.floor(Math.random() * colors.length)]};
      left:${Math.random() * 100}vw; top:-10px; z-index:9999;
      pointer-events:none; opacity:1;
      animation: confettiFall ${1.5 + Math.random() * 2}s ease-out forwards;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
  // Inject animation keyframes once
  if (!document.getElementById("confetti-style")) {
    const style = document.createElement("style");
    style.id = "confetti-style";
    style.textContent = `
      @keyframes confettiFall {
        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
      }
      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.8; }
      }
    `;
    document.head.appendChild(style);
  }
}

// --- Speech recognition helper ---
export function createSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";
  recognition.maxAlternatives = 1;
  return recognition;
}

// --- TTS voice helper (FOUND-06 / CLEAN-02) ---
// Shared speakText: natural voice selection, cancel-before-speak, stop handle
// Per D-10: single shared function replacing duplicates in LucacLegends and HomeworkHelper
export function speakText(text, { voicePreference = null, onStop = null } = {}) {
  if (!window.speechSynthesis) return null;
  window.speechSynthesis.cancel(); // Fix repeat bug (D-12)
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1.0;

  // Voice selection — pick best available natural English voice
  const voices = window.speechSynthesis.getVoices();
  const NATURAL_VOICES = ["samantha", "karen", "daniel", "moira", "tessa", "rishi", "google"];
  const natural = voices.find(v =>
    v.localService && /en/i.test(v.lang) &&
    NATURAL_VOICES.some(n => v.name.toLowerCase().includes(n))
  ) || voices.find(v => v.localService && /en/i.test(v.lang))
    || voices.find(v => /en/i.test(v.lang));
  if (natural) utterance.voice = natural;

  // voicePreference slot (D-13) — ready for future voice picker, no-op now
  // if (voicePreference) { const match = voices.find(...); if (match) utterance.voice = match; }

  if (onStop) utterance.onend = onStop;
  window.speechSynthesis.speak(utterance);

  // Return stop handle for stop buttons (D-12)
  return () => window.speechSynthesis.cancel();
}

// Pre-load voices on app mount (Android Chrome returns [] synchronously on first call)
export function getVoicesReady() {
  if (!window.speechSynthesis) return;
  // Trigger async voice loading
  window.speechSynthesis.getVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices(); // cache the loaded list
    };
  }
}

// --- Role-based write guard (FOUND-04 / SEC-01) ---
// Guards sensitive Firebase paths. Called by fbSet before set().
// Per D-06: guard sensitive paths only, not every path.
const ADMIN_ONLY_PATHS = [
  "profiles",
  "alertMinutes",
  "custodyPattern",
  "custodyOverrides",
  "quoteMode",
  "customQuotePrompt",
  "themeOverrides",
  "calendarSize",
  // S04: curriculum (parent-set subject focus per kid) — admin configures only
  "curriculum",
];

const PARENT_WRITE_PATHS = [
  "events",
  "eventStyles",
  "custodySchedule",
  "ruleProposals",
  "jrHistory",
  "shoppingList",
  "budgetData",
  "foodLog",
  "myFoods",
  "nutritionGoals",
  "trackedMacros",
  "weightLog",
  "myRules",
  "theirRules",
  "sharedRules",
  "exchangeLog",
  "routines",
  "routineStyles",
  "goals",
  "goalStyles",
  "chores",
  // T06: unblock Danyells customization
  "themeName",
  "widgetPrefs",
  "callButtons",
  "contacts",
  "spotlightResponse",
  "sparkReaction",
  // S04: parents can write learningStats too (for agent-seeded data / imports)
  "learningStats",
  // S04: admin and parents both configure the real-world reward menu
  "rewardsConfig",
];

const KID_WRITE_PATHS = [
  "kidsData",
  "homeworkSessions",
  "jrHistory",
  "routineState",  // A0: kid completion state for daily routines
  "boardGames",    // B0: shared multiplayer board game rooms
  // S04: kids write their own attempts via LearningEngine.recordAttempt
  // Path is learningStats/{kidName}/{subjectId}/{ts} — top-level key is scoped
  // by {kidName} segment and records are append-only timestamps
  "learningStats",
];

export function canWrite(profile, path) {
  if (!profile) return false;
  const role = profile.type === "admin" ? "admin"
    : (profile.type === "parent" || profile.type === "family") ? "parent"
    : profile.type === "kid" ? "kid" : "guest";

  // Admin can write to anything
  if (role === "admin") return true;

  // Extract top-level path segment: "kidsData/Luca/points" -> "kidsData"
  const topPath = path.split("/")[0];

  // Block admin-only paths for everyone except admin
  if (ADMIN_ONLY_PATHS.includes(topPath)) return false;

  if (role === "parent") {
    // Parents can write to parent paths AND kid paths
    return PARENT_WRITE_PATHS.includes(topPath) || KID_WRITE_PATHS.includes(topPath);
  }

  if (role === "kid") {
    if (!KID_WRITE_PATHS.includes(topPath)) return false;
    // Kids can only write to their OWN subtree within kidsData
    if (topPath === "kidsData") {
      const nameSegment = path.split("/")[1];
      // Allow "kidsData" (full object) only if no name segment — but in practice
      // kids should always write "kidsData/TheirName/..."
      return !nameSegment || nameSegment === profile.name;
    }
    // homeworkSessions: kids can write their own sessions
    if (topPath === "homeworkSessions") {
      const nameSegment = path.split("/")[1];
      return !nameSegment || nameSegment === profile.name;
    }
    // jrHistory: kids can write their own chat history
    if (topPath === "jrHistory") {
      const nameSegment = path.split("/")[1];
      return !nameSegment || nameSegment === profile.name;
    }
    // routineState: kids can only write their own completion state
    if (topPath === "routineState") {
      const nameSegment = path.split("/")[1];
      return !nameSegment || nameSegment === profile.name;
    }
    // boardGames: shared multi-kid tree — any kid can create/join rooms
    if (topPath === "boardGames") return true;
    // S04: learningStats is keyed by kid name — kids can only write their own
    // subtree. Prevents kid client from corrupting another kid's stats.
    if (topPath === "learningStats") {
      const nameSegment = path.split("/")[1];
      return !nameSegment || nameSegment === profile.name;
    }
    return true;
  }

  // Guest cannot write anything
  return false;
}
