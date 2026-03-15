// ═══ SHARED UTILITIES ═══
// Used by App.jsx and all component files

// --- Groq API wrapper with timeout + error handling ---
export async function groqFetch(apiKey, messages, opts = {}) {
  const { maxTokens = 800, timeout = 10000, model = "llama-3.3-70b-versatile" } = opts;
  if (!apiKey) return { ok: false, data: null, error: "No API key" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
      signal: controller.signal,
    });
    clearTimeout(timer);
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
        100% { transform: translateY(100vh) rotate(${360 + Math.random() * 360}deg); opacity: 0; }
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
  return recognition;
}
