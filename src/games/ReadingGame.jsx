import { useState, useEffect, useRef, useMemo } from "react";
import { groqFetch, cacheGet, cacheSet, speakText } from "../utils";
import { GameBtn, recordGameHistory, ageBandFromProfile } from "./_shared";
import { recordAttempt } from "../LearningEngine";

// ─── ReadingGame (S04 A6 rewrite) ────────────────────────────────────────────
// Finger-swipe word-by-word reader. Same UI for both kids; content adapts to
// age band. NO timed reading, NO WPM, NO buzzer — research says shame kills
// reading motivation. Kid earns stars by completing pages, not by speed.
//
// Luca (6, decoding): hardcoded decodable phonics passages aligned to a
// scope-and-sequence (short-a, short-i, short-o, digraphs, blends). NO AI
// story generation — AI-generated text violates phonics scope and trains
// listening, not decoding.
//
// Yana (8+, fluency): Groq-generated short passages (3-5 sentences) with a
// hardcoded fallback pool when Groq fails / is rate-limited. Same finger-
// swipe overlay as Luca — no silent listening.
// ────────────────────────────────────────────────────────────────────────────

const GROQ_KEY = import.meta.env.VITE_GROQ_KEY;
const STORY_MODEL = "llama-3.3-70b-versatile";
const STORY_TIMEOUT = 20000;

// ─── Luca mode: decodable phonics passages ───────────────────────────────────
// Scope-and-sequence aligned. Level 1 = CVC short-vowel (a, i, o, u, e).
// Level 2 = digraphs (sh, ch, th, wh) + common blends (st, sp, fr, fl, pl).
// Advance Luca one level after 3 passages completed at current level.
const LUCA_PASSAGES = [
  // Level 1 — short-a CVC
  { level: 1, pattern: "short-a", text: "The cat sat on the mat. The fat rat ran fast. Pat had a hat." },
  { level: 1, pattern: "short-a", text: "A bat is in a bag. The man can tap. Sam has a map." },
  // Level 1 — short-i CVC
  { level: 1, pattern: "short-i", text: "Tim hit the pin. The pig is big. Sit in the bin." },
  { level: 1, pattern: "short-i", text: "Kim has a wig. Pip will sit. The fish is in the dish." },
  // Level 1 — short-o CVC
  { level: 1, pattern: "short-o", text: "Tom got a top. The dog sat on a log. A fox is in the box." },
  { level: 1, pattern: "short-o", text: "Mom has a pot. The mop is wet. Hop on the rock." },
  // Level 2 — digraphs
  { level: 2, pattern: "digraphs", text: "The fish swam in the dish. A chick can chop. Beth has a moth." },
  { level: 2, pattern: "digraphs", text: "When will the ship come? The shop is shut. The chimp is on a chair." },
  // Level 2 — blends
  { level: 2, pattern: "blends", text: "The frog will jump in the pond. Stop and spin. The flag is on the mast." },
  { level: 2, pattern: "blends", text: "A plum fell from the plant. Fred and Stan ran fast. The clam is in a pool." },
];

// ─── Yana mode: fluency fallback passages (~6) ───────────────────────────────
const YANA_FALLBACK_PASSAGES = [
  "The old lighthouse stood on a rocky cliff above the roaring sea. Every night for a hundred years, its beam had guided ships safely home through the fog. Tonight, the light would need to work harder than ever.",
  "Maya tiptoed down the creaking stairs, careful not to wake anyone. The kitchen smelled of cinnamon and warm bread. On the counter sat a note: meet me at the orchard before sunrise. She smiled and grabbed her boots.",
  "Deep in the rainforest, a tiny tree frog watched the rain drip from leaf to leaf. Each drop caught the sunlight and flashed like a small jewel. The frog's bright green skin blended perfectly with the moss on the branch.",
  "The library at midnight felt different than in the day. Shelves stretched up into shadows, and the old wooden floors whispered under careful footsteps. Somewhere among the dusty books, a story was waiting to be found.",
  "The red fox moved quickly across the snow, her orange tail flicking behind her. Winter had turned the fields white, and food was harder to find. But tonight she could smell something interesting under the pine trees.",
  "Captain Reyes studied the star chart one more time before climbing into the cockpit. Her ship was small but fast, and the journey to the outer ring would take three days. She buckled in, fired the thrusters, and pointed the nose toward space.",
];

// ─── Tokenize passage into words preserving punctuation attached to word ─────
// Splits on whitespace; each token retains its punctuation so display reads naturally.
function tokenize(text) {
  return text.split(/\s+/).filter(Boolean).map((raw, i) => {
    // Strip trailing/leading punctuation to get the "spoken" form for TTS
    const spoken = raw.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, "") || raw;
    return { id: i, display: raw, spoken };
  });
}

export default function ReadingGame({
  profile,
  kidsData,
  fbSet,
  addStars,
  transitionTo,
  curriculum, // eslint-disable-line no-unused-vars
  learningStats = {}, // eslint-disable-line no-unused-vars
  rewardsConfig = [], // eslint-disable-line no-unused-vars
}) {
  const ageBand = ageBandFromProfile(profile);
  const isLucaMode = ageBand === "luca";
  const kidName = profile?.name || "Reader";
  const subjectId = isLucaMode ? "reading-3letter" : "reading-sentence";

  // Font sizing
  const WORD_FONT = isLucaMode ? 32 : 22;
  const WORD_PADDING = isLucaMode ? "10px 14px" : "8px 12px";
  const WORD_LINE_HEIGHT = isLucaMode ? 64 : 48;

  // Session state
  const [pagesCompleted, setPagesCompleted] = useState(0); // count this session
  const [sessionStars, setSessionStars] = useState(0);
  const [completedTitles, setCompletedTitles] = useState([]);
  const [toast, setToast] = useState(null);

  // Current passage
  const [passageText, setPassageText] = useState("");
  const [passageSource, setPassageSource] = useState(""); // "luca-L1" / "yana-groq" / "yana-fallback"
  const [loading, setLoading] = useState(true);
  const [lucaLevel, setLucaLevel] = useState(1);
  const [pagesAtLevel, setPagesAtLevel] = useState(0);
  const [lucaPool, setLucaPool] = useState(() => shufflePool(1));
  const [lucaIdx, setLucaIdx] = useState(0);
  const [yanaIdx, setYanaIdx] = useState(0);
  const [finishedSession, setFinishedSession] = useState(false); // Luca-mode single-page finish

  // Swipe state
  const [readSet, setReadSet] = useState(() => new Set());
  const [draggingWord, setDraggingWord] = useState(null);
  const isDraggingRef = useRef(false);
  const lastSpokenIdRef = useRef(-1);
  const wordRefs = useRef({});
  const pageStartRef = useRef(Date.now());

  // Derived tokens (stable for current passage)
  const tokens = useMemo(() => tokenize(passageText || ""), [passageText]);
  const allRead = tokens.length > 0 && readSet.size >= tokens.length;

  // ─── Luca pool shuffling ──────────────────────────────────────────────────
  function shufflePool(level) {
    const eligible = LUCA_PASSAGES.filter(p => p.level <= level);
    // Fisher-Yates shallow shuffle
    const arr = [...eligible];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ─── Load initial passage on mount ────────────────────────────────────────
  useEffect(() => {
    loadNextPassage(true);
    return () => {
      // On unmount — cancel any TTS that's still speaking
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Load next passage (per-mode logic) ───────────────────────────────────
  async function loadNextPassage(isFirst = false) {
    setLoading(true);
    setReadSet(new Set());
    lastSpokenIdRef.current = -1;
    pageStartRef.current = Date.now();

    if (isLucaMode) {
      // Luca — pick next from shuffled pool at current level
      let pool = lucaPool;
      let idx = isFirst ? 0 : lucaIdx + 1;

      if (idx >= pool.length) {
        pool = shufflePool(lucaLevel);
        idx = 0;
        setLucaPool(pool);
      }

      const passage = pool[idx] || LUCA_PASSAGES[0];
      setLucaIdx(idx);
      setPassageText(passage.text);
      setPassageSource(`luca-L${passage.level}-${passage.pattern}`);
      setLoading(false);
      return;
    }

    // Yana — try Groq first, cache per-kid, fall back gracefully
    const cacheKey = `reading_yana_${kidName}_${pagesCompleted}`;
    const cached = cacheGet(cacheKey);
    if (cached?.text) {
      setPassageText(cached.text);
      setPassageSource("yana-cached");
      setLoading(false);
      return;
    }

    if (!GROQ_KEY) {
      // No key configured — straight to fallback pool
      useFallbackYana();
      return;
    }

    const prompt =
      `Write ONE short reading passage (3 to 5 sentences, about 40-60 words) for an 8-year-old fluent reader. ` +
      `The passage should be a self-contained vivid scene: a moment in a story, a nature observation, a small adventure. ` +
      `Use rich but age-appropriate vocabulary. No dialogue tags. No title. No numbering. Just the passage text.`;

    const result = await groqFetch(
      GROQ_KEY,
      [
        { role: "system", content: "You write short reading passages for children practicing fluency. Reply with ONLY the passage text, nothing else." },
        { role: "user", content: prompt },
      ],
      { model: STORY_MODEL, maxTokens: 200, timeout: STORY_TIMEOUT }
    );

    if (!result.ok || !result.data) {
      useFallbackYana();
      return;
    }

    const clean = result.data.trim().replace(/^["']|["']$/g, "");
    cacheSet(cacheKey, { text: clean });
    setPassageText(clean);
    setPassageSource("yana-groq");
    setLoading(false);
  }

  function useFallbackYana() {
    const idx = yanaIdx % YANA_FALLBACK_PASSAGES.length;
    setPassageText(YANA_FALLBACK_PASSAGES[idx]);
    setPassageSource("yana-fallback");
    setYanaIdx(i => i + 1);
    setLoading(false);
    showToast("Offline — loaded a saved passage");
  }

  function showToast(msg, ms = 2800) {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  }

  // ─── Speak a word (cancel-before-speak, no stacking) ──────────────────────
  function speakWord(wordText) {
    if (!wordText) return;
    // speakText already calls speechSynthesis.cancel() internally, but call
    // again here to be safe when words fire in rapid succession.
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    speakText(wordText);
  }

  function speakWholePassage() {
    if (!passageText) return;
    speakText(passageText);
  }

  function stopSpeech() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  // ─── Swipe: mark a word as read and speak it (first touch only) ───────────
  function markWord(wordId) {
    if (readSet.has(wordId)) return;
    const token = tokens[wordId];
    if (!token) return;
    setReadSet(prev => {
      const next = new Set(prev);
      next.add(wordId);
      return next;
    });
    if (lastSpokenIdRef.current !== wordId) {
      lastSpokenIdRef.current = wordId;
      speakWord(token.spoken);
    }
  }

  // ─── Pointer handlers — track word under finger via elementFromPoint ──────
  function pointerDown(e, wordId) {
    isDraggingRef.current = true;
    setDraggingWord(wordId);
    markWord(wordId);
    // Capture pointer so move events keep firing even off-element
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {} // eslint-disable-line no-empty
  }

  function pointerMove(e) {
    if (!isDraggingRef.current) return;
    const x = e.clientX;
    const y = e.clientY;
    if (typeof x !== "number" || typeof y !== "number") return;
    const el = document.elementFromPoint(x, y);
    if (!el) return;
    // Walk up to find a word span
    const wordEl = el.closest?.("[data-word-id]");
    if (!wordEl) return;
    const id = parseInt(wordEl.getAttribute("data-word-id"), 10);
    if (!Number.isNaN(id)) {
      setDraggingWord(id);
      markWord(id);
    }
  }

  function pointerUp() {
    isDraggingRef.current = false;
    setDraggingWord(null);
  }

  // ─── When all words read — record attempt, award star, await kid's Next ───
  useEffect(() => {
    if (!allRead || loading) return;
    if (tokens.length === 0) return;

    const elapsed = Date.now() - pageStartRef.current;
    // Record one successful attempt per page (not per word)
    recordAttempt(fbSet, profile?.name, subjectId, true, elapsed);
    // Per-page star
    addStars?.(1, "Reading page completed");
    setSessionStars(s => s + 1);
    setCompletedTitles(prev => [...prev, passageSource]);

    // Update kidsData.readingStats
    if (fbSet && profile?.name) {
      const prev = kidsData?.[profile.name]?.readingStats || kidsData?.readingStats?.[profile.name] || {};
      const wordsMastered = (prev.wordsMastered || 0) + tokens.length;
      const storiesRead = (prev.storiesRead || 0) + 1;
      const level = isLucaMode ? lucaLevel : (prev.level || 1);
      fbSet(`kidsData/${profile.name}/readingStats`, {
        level,
        wordsMastered,
        storiesRead,
        lastPlayed: new Date().toISOString(),
      });
    }

    // Advance Luca level after 3 pages at current level
    if (isLucaMode) {
      const nextPagesAtLevel = pagesAtLevel + 1;
      if (nextPagesAtLevel >= 3 && lucaLevel < 2) {
        setLucaLevel(2);
        setPagesAtLevel(0);
        setLucaPool(shufflePool(2));
        setLucaIdx(-1); // so next tick loadNextPassage advances to 0
        showToast("Level up! New word patterns unlocked");
      } else {
        setPagesAtLevel(nextPagesAtLevel);
      }
    }

    setPagesCompleted(p => p + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRead]);

  // ─── Exit / finish session — award session bonus + record history ─────────
  function finishSession() {
    if (!finishedSession) {
      addStars?.(3, "Reading session complete");
      setSessionStars(s => s + 3);
      recordGameHistory(fbSet, profile, "reading", pagesCompleted, sessionStars + 3, {
        passages: completedTitles,
        mode: isLucaMode ? "luca-phonics" : "yana-fluency",
      });
      setFinishedSession(true);
    }
    stopSpeech();
    transitionTo?.("mini_games");
  }

  // ─── Render helpers ───────────────────────────────────────────────────────
  const headerBg = isLucaMode
    ? "linear-gradient(180deg, #1e3a8a, #1e40af, #2563eb)"
    : "linear-gradient(180deg, #064e3b, #065f46, #047857)";

  return (
    <div style={{
      minHeight: 500, borderRadius: 16, overflow: "hidden", maxWidth: "100vw",
      width: "100%", boxSizing: "border-box",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      userSelect: "none", WebkitUserSelect: "none",
    }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          background: "#1e293b", color: "#fbbf24", padding: "10px 20px",
          borderRadius: 12, fontWeight: 700, fontSize: 14, zIndex: 9999,
          border: "2px solid #fbbf24", boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          maxWidth: "90vw", textAlign: "center",
        }}>
          {toast}
        </div>
      )}

      <div style={{ background: headerBg, padding: 20, minHeight: 500 }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 14, gap: 8, flexWrap: "wrap",
        }}>
          <GameBtn color="#475569" onClick={finishSession}
            style={{ width: "auto", padding: "10px 16px", fontSize: 14 }}>
            ← Back
          </GameBtn>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={speakWholePassage}
              disabled={loading || !passageText}
              style={{
                background: "rgba(255,255,255,0.18)", color: "#fff",
                border: "2px solid rgba(255,255,255,0.3)", borderRadius: 10,
                padding: "10px 14px", fontSize: 14, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer", minHeight: 44,
                opacity: loading ? 0.5 : 1,
              }}>
              🔊 Read passage
            </button>
            <button
              onClick={stopSpeech}
              style={{
                background: "#ef4444", color: "#fff", border: "none",
                borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 700,
                cursor: "pointer", minHeight: 44,
              }}>
              ⏹ Stop
            </button>
          </div>

          <div style={{ color: "#fbbf24", fontWeight: 700, fontSize: 16, whiteSpace: "nowrap" }}>
            ⭐ {sessionStars}
          </div>
        </div>

        {/* Title / subtitle */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fbbf24" }}>
            📖 {isLucaMode ? "Word by Word" : "Reading Time"}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 4 }}>
            {isLucaMode
              ? "Drag your finger across each word"
              : "Swipe through each word as you read"}
          </div>
          {isLucaMode && (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
              Level {lucaLevel} · Page {pagesAtLevel + 1} of 3
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>📚</div>
            <div style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>
              Getting your words ready…
            </div>
          </div>
        )}

        {/* Passage — swipe surface */}
        {!loading && tokens.length > 0 && (
          <div
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={pointerUp}
            onPointerLeave={pointerUp}
            style={{
              background: "rgba(255,255,255,0.08)",
              borderRadius: 18,
              padding: 20,
              marginBottom: 16,
              minHeight: 240,
              touchAction: "none", // critical for Pointer Events to not fight scroll
              display: "flex",
              flexWrap: "wrap",
              gap: isLucaMode ? 8 : 6,
              alignContent: "flex-start",
              lineHeight: 1,
            }}
          >
            {tokens.map(tok => {
              const isRead = readSet.has(tok.id);
              const isActive = draggingWord === tok.id;
              return (
                <span
                  key={tok.id}
                  ref={el => { wordRefs.current[tok.id] = el; }}
                  data-word-id={tok.id}
                  onPointerDown={e => pointerDown(e, tok.id)}
                  onPointerEnter={() => { if (isDraggingRef.current) markWord(tok.id); }}
                  style={{
                    display: "inline-block",
                    fontSize: WORD_FONT,
                    fontWeight: 700,
                    padding: WORD_PADDING,
                    margin: 0,
                    borderRadius: 10,
                    lineHeight: `${WORD_LINE_HEIGHT}px`,
                    background: isRead
                      ? "rgba(251,191,36,0.85)"
                      : isActive
                        ? "rgba(255,255,255,0.22)"
                        : "rgba(255,255,255,0.04)",
                    color: isRead ? "#1e293b" : "#fff",
                    border: isRead
                      ? "2px solid #fbbf24"
                      : "2px solid rgba(255,255,255,0.1)",
                    boxShadow: isRead ? "0 0 12px rgba(251,191,36,0.5)" : "none",
                    transition: "background 0.15s, box-shadow 0.15s, color 0.15s",
                    touchAction: "none",
                    cursor: "pointer",
                  }}
                >
                  {tok.display}
                </span>
              );
            })}
          </div>
        )}

        {/* Progress + Next */}
        {!loading && tokens.length > 0 && (
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontSize: 14, color: "rgba(255,255,255,0.75)", marginBottom: 10,
              fontWeight: 600,
            }}>
              {readSet.size} / {tokens.length} words read
            </div>

            {allRead ? (
              <div style={{ marginTop: 4 }}>
                <div style={{
                  fontSize: isLucaMode ? 28 : 22, fontWeight: 800, color: "#fbbf24",
                  marginBottom: 10,
                }}>
                  {isLucaMode ? "🎉 Great job!" : "✨ Page complete!"}
                </div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", marginBottom: 14 }}>
                  You earned ⭐ 1 star for this page
                </div>
                <div style={{
                  display: "flex", gap: 10, flexDirection: "column",
                  maxWidth: 320, margin: "0 auto",
                }}>
                  {/* Luca mode = 1 passage per session by design, so offer Done only */}
                  {!isLucaMode && (
                    <GameBtn color="#22c55e" big onClick={() => loadNextPassage(false)}
                      style={{ minHeight: 60, fontSize: 18 }}>
                      Next passage →
                    </GameBtn>
                  )}
                  <GameBtn color="#3b82f6" big onClick={finishSession}
                    style={{ minHeight: 60, fontSize: 18 }}>
                    ⭐ Finish + collect session bonus
                  </GameBtn>
                </div>
              </div>
            ) : (
              <div style={{
                fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 4,
              }}>
                Keep going — words light up when you touch them
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
