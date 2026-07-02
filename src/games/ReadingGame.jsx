import { useState, useEffect, useRef, useMemo } from "react";
import { increment } from "firebase/database";
import { groqFetch, cacheGet, cacheSet, speakText, triggerConfetti, playSfx, buzz, getKidDifficulty } from "../utils";
import { GameBtn, recordGameHistory, ageBandFromProfile, checkPersonalBest } from "./_shared";
import { recordAttempt } from "../LearningEngine";
import {
  BUFF_TYPES, DEBUFF_TYPES, POWERUP_NOTICE_MS, DROP_FALL_DURATION_MS,
  spawnDropPair,
} from "./_powerups";

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

// ─── READING ADVENTURE EXTENSIONS ────────────────────────────────────────────
// Yana-mode only by design — Luca's decoding mode keeps zero-shame UX per
// ReadingGame header (lines 6-19). Lives + power-ups for fluent readers only.
const LIVES_MAX_READING = 3;          // requested by feature spec
const POWERUP_INTERVAL_MS = 30_000;   // requested cadence: every 30 seconds

// S07: every effect shown to the kid must DO something in THIS game — a
// power-up that's flavor-only teaches kids the game lies. Magnet/Reverse are
// drag-modal mechanics (no drag target here); Invincible/Thunder/Freeze have
// no honest reading equivalent (freeze-blocking a kid mid-word-swipe is
// anti-motivation). Filtered out so the pools contain only wired effects:
// heart/starSurge/slowTime (buffs), loseHeart/frenzy/blind (debuffs).
const READING_BUFF_POOL = BUFF_TYPES.filter(b =>
  ["heart", "starSurge", "slowTime"].includes(b.type));
const READING_DEBUFF_POOL = DEBUFF_TYPES.filter(d =>
  ["loseHeart", "frenzy", "blind"].includes(d.type));

// ─── Luca mode: decodable phonics passages ───────────────────────────────────
// Scope-and-sequence aligned. Level 1 = CVC short-vowel (a, i, o, u, e).
// Level 2 = digraphs (sh, ch, th, wh) + common blends (st, sp, fr, fl, pl).
// Level 3 = vowel teams (ai, ee, oa, ea) + r-controlled (ar, or, er),
//           layered on all earlier patterns.
// Level 4 = two-syllable compounds of TAUGHT patterns (sunset, backpack).
// Advance Luca one level after 3 passages completed at current level.
// STRICT decodability: no word outside taught patterns + the sight words
// already used in this pool (the, a, is, in, on, has, had, can, will, when,
// come, from).
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
  // Level 3 — vowel teams (ai, ee, oa, ea)
  { level: 3, pattern: "vowel-teams", text: "The boat is in the rain. The sail is wet. Wait for the sun." },
  { level: 3, pattern: "vowel-teams", text: "See the bee nap on a leaf. The bee has a seat in the sun." },
  { level: 3, pattern: "vowel-teams", text: "The goat is on the road. A toad sat in the boat. The goat can eat a peach." },
  { level: 3, pattern: "vowel-teams", text: "Dean can read at the beach. The sea is deep. Dean can see far." },
  // Level 3 — r-controlled (ar, or, er)
  { level: 3, pattern: "vowel-teams", text: "The car is in the barn. The farm has a big red barn. A star is far off in the dark." },
  { level: 3, pattern: "vowel-teams", text: "Mark has corn for the hen. Her cat sat on the porch. The sun set on the farm." },
  // Level 4 — two-syllable compounds of taught patterns
  { level: 4, pattern: "multisyllabic", text: "The sun set on the farm. Pat can see the sunset from the hilltop. The sunset is red." },
  { level: 4, pattern: "multisyllabic", text: "Pam has a backpack. A raincoat is in the backpack. Pam can zip the backpack shut." },
  { level: 4, pattern: "multisyllabic", text: "The catfish swam in the pond. A sunfish swam past the sailboat." },
  { level: 4, pattern: "multisyllabic", text: "The teapot is hot. Mom has popcorn in a big cup. The bathtub is not for popcorn." },
];

// Kid-facing level names for the LEVEL UP banner (S07 Luca runway)
const LUCA_LEVEL_NAMES = {
  1: "Letter Sounds",
  2: "Sound Teams",
  3: "Vowel Teams",
  4: "Big Words",
};
const LUCA_LEVEL_CAP = 4;

// G12: each Luca passage records under its own phonics subject so the
// learning engine tracks per-pattern accuracy instead of one blended
// "reading" blob. Yana mode stays "reading-sentence".
const PATTERN_SUBJECT_MAP = {
  "short-a": "reading-3letter",
  "short-i": "reading-3letter",
  "short-o": "reading-3letter",
  "digraphs": "reading-4letter",
  "blends": "phonics-blends",
  "vowel-teams": "phonics-vowel-teams",
  "multisyllabic": "phonics-syllables",
};

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

  // Font sizing
  const WORD_FONT = isLucaMode ? 32 : 22;
  const WORD_PADDING = isLucaMode ? "10px 14px" : "8px 12px";
  const WORD_LINE_HEIGHT = isLucaMode ? 64 : 48;

  // Session state
  const [pagesCompleted, setPagesCompleted] = useState(0); // count this session

  // Adventure-mode state (Yana mode only — gated by !isLucaMode at use sites)
  const [lives, setLives] = useState(LIVES_MAX_READING);
  const [drops, setDrops] = useState([]);
  const [powerupNotice, setPowerupNotice] = useState(null);
  // S07: activeBuff/activeDebuff are REAL now — consulted by gameplay:
  // ⭐⭐ Star Surge doubles the next page-complete star award, 🌫️ Blind blurs
  // not-yet-read words (squint challenge), 🐢 Slow Time pauses drop spawns,
  // 💨 Frenzy keeps the fish lunging + speeds up drop falls. Pools are
  // filtered to only-real effects (READING_BUFF_POOL / READING_DEBUFF_POOL).
  const [activeBuff, setActiveBuff] = useState(null); // {type, expiresAt} | null
  const [activeDebuff, setActiveDebuff] = useState(null);
  const [fishMood, setFishMood] = useState("idle"); // "idle" | "happy" | "lunge"
  const dropTimerRef = useRef(null);
  // Refs mirror buff/debuff for the 30s spawn interval closure — it re-inits
  // only on mode/finish changes, so reading state directly would go stale.
  const activeBuffRef = useRef(null);
  const activeDebuffRef = useRef(null);
  const [sessionStars, setSessionStars] = useState(0);
  const [completedTitles, setCompletedTitles] = useState([]);
  const [toast, setToast] = useState(null);
  const [lastPageStars, setLastPageStars] = useState(1); // 2 when ⭐⭐ Star Surge doubled the page
  const [levelUpBanner, setLevelUpBanner] = useState(null); // {level, name} | null — 2.5s overlay
  const [pbBanner, setPbBanner] = useState(null); // {prevBest, best} | null — 🏆 record overlay
  const levelUpTimerRef = useRef(null);
  const exitTimerRef = useRef(null);
  const finishedRef = useRef(false); // synchronous double-tap guard for finishSession

  // Current passage
  const [passageText, setPassageText] = useState("");
  const [passageSource, setPassageSource] = useState(""); // "luca-L1" / "yana-groq" / "yana-fallback"
  const [currentPattern, setCurrentPattern] = useState(null); // Luca passage phonics pattern (G12)
  const [loading, setLoading] = useState(true);
  // S07 2c: Luca's level persists across his single-page sessions — validate
  // the Firebase value before trusting it (Lessons Learned: coerce external data)
  const [lucaLevel, setLucaLevel] = useState(() => {
    const saved = kidsData?.[kidName]?.readingLevel;
    return typeof saved === "number" && saved >= 1 && saved <= LUCA_LEVEL_CAP ? saved : 1;
  });
  const [pagesAtLevel, setPagesAtLevel] = useState(() => {
    const saved = kidsData?.[kidName]?.readingPagesAtLevel;
    return typeof saved === "number" && saved >= 0 && saved < 3 ? saved : 0;
  });
  // Re-sync UPWARD if kidsData loads after mount (async Firebase) — a session
  // started at the default Level 1 must never clobber Luca's persisted higher
  // level on its next level-up write (3-lens review).
  const savedLevel = kidsData?.[kidName]?.readingLevel;
  useEffect(() => {
    if (typeof savedLevel === "number" && savedLevel >= 1 && savedLevel <= LUCA_LEVEL_CAP) {
      setLucaLevel(l => (savedLevel > l ? savedLevel : l));
    }
  }, [savedLevel]);
  const [lucaPool, setLucaPool] = useState(() => shufflePool(lucaLevel));
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
      // On unmount — cancel any TTS that's still speaking + pending banner /
      // exit timers (lesson f45f9fd: feedback timers must not outlive the game)
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (levelUpTimerRef.current) clearTimeout(levelUpTimerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the interval-closure mirrors in sync with buff/debuff state
  useEffect(() => { activeBuffRef.current = activeBuff; }, [activeBuff]);
  useEffect(() => { activeDebuffRef.current = activeDebuff; }, [activeDebuff]);

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
      setCurrentPattern(passage.pattern); // G12: drives per-pattern recordAttempt subject
      setLoading(false);
      return;
    }

    // Yana — try Groq first, cache per-kid, fall back gracefully.
    // G6: date segment keeps passages fresh daily — without it the cache
    // served the same frozen sequence forever.
    const cacheKey = `reading_yana_${kidName}_${new Date().toISOString().slice(0, 10)}_${pagesCompleted}`;
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

  // ─── Apply a buff/debuff effect. S07: every effect in the reading pools is
  //     REAL — heart/loseHeart fire instantly; ⭐⭐ Star Surge is a ONE-SHOT
  //     flag consumed at the next page completion (no wall-clock expiry — a
  //     page takes minutes, so FractionLine's 7s window would make the buff
  //     a phantom, the exact failure S07 eliminates; 3-lens review); other
  //     timed effects land in activeBuff/activeDebuff with an expiry check:
  //     🐢 Slow Time → spawn pause (drop scheduler), 🌫️ Blind → unread-word
  //     blur (word span render), 💨 Frenzy → lunging fish + faster drops.
  function applyBuff(buff) {
    if (buff.type === "heart") {
      setLives(L => Math.min(LIVES_MAX_READING, L + 1));
    } else if (buff.type === "starSurge") {
      // Consumed (setActiveBuff(null)) by the page-complete effect after
      // doubling exactly one page's star.
      setActiveBuff({ type: "starSurge", expiresAt: Infinity });
    } else if (buff.duration > 0) {
      const applied = { type: buff.type, expiresAt: Date.now() + buff.duration };
      setActiveBuff(applied);
      // Only clear the buff THIS timeout armed — a stale timeout must not
      // null a pending Star Surge picked up afterward.
      setTimeout(() => setActiveBuff(cur => (cur === applied ? null : cur)), buff.duration);
    }
    setFishMood("happy");
    setTimeout(() => setFishMood("idle"), 2000);
    setPowerupNotice({ text: buff.name, kind: "buff" });
  }

  function applyDebuff(deb) {
    if (deb.type === "loseHeart") {
      setLives(L => Math.max(0, L - 1));
    } else if (deb.duration > 0) {
      setActiveDebuff({ type: deb.type, expiresAt: Date.now() + deb.duration });
      setTimeout(() => setActiveDebuff(null), deb.duration);
    }
    setFishMood("lunge");
    // Frenzy = the fish stays in lunge mood for the whole effect window;
    // other debuffs get the brief 1.5s reaction only.
    setTimeout(() => setFishMood("idle"), deb.type === "frenzy" ? deb.duration : 1500);
    setPowerupNotice({ text: deb.name, kind: "debuff" });
  }

  function tapDrop(drop) {
    playSfx("powerup"); // juice: every drop tap makes a sound
    setDrops(prev => prev.filter(d => d.id !== drop.id && d.id !== drop.id - 1 && d.id !== drop.id + 1));
    if (drop.isWinner) {
      const buff = READING_BUFF_POOL[Math.floor(Math.random() * READING_BUFF_POOL.length)];
      applyBuff(buff);
    } else {
      const deb = READING_DEBUFF_POOL[Math.floor(Math.random() * READING_DEBUFF_POOL.length)];
      applyDebuff(deb);
    }
  }

  // Remove a drop after its CSS fall animation completes (kid didn't tap it).
  // Without this, ignored drops would persist in state and the 30-second
  // scheduler's `prev.length === 0` guard would never re-fire — so a kid who
  // misses one drop would never see another. NOT in the original plumbline
  // plan; added because the spec ("every 30 seconds") only works if untapped
  // drops eventually clear from state.
  function dropFellOff(drop) {
    setDrops(prev => prev.filter(d => d.id !== drop.id));
  }

  // ─── When all words read — record attempt, award star, await kid's Next ───
  useEffect(() => {
    if (!allRead || loading) return;
    if (tokens.length === 0) return;

    const elapsed = Date.now() - pageStartRef.current;
    // Record one successful attempt per page (not per word). G12: Luca's
    // attempts file under the passage's own phonics pattern so the learning
    // engine sees per-pattern accuracy; Yana stays "reading-sentence".
    const attemptSubject = isLucaMode
      ? (PATTERN_SUBJECT_MAP[currentPattern] || "reading-3letter")
      : "reading-sentence";
    recordAttempt(fbSet, profile?.name, attemptSubject, true, elapsed);
    // Per-page star — doubled while ⭐⭐ Star Surge is active (S07: buffs are real)
    const surgeActive = !isLucaMode && activeBuff?.type === "starSurge" &&
      activeBuff.expiresAt > Date.now();
    const pageStars = surgeActive ? 2 : 1;
    addStars?.(pageStars, "Reading page completed");
    setSessionStars(s => s + pageStars);
    setLastPageStars(pageStars);
    if (surgeActive) {
      showToast("⭐⭐ Double-star page!");
      playSfx("powerup");
      setActiveBuff(null); // surge consumed — doubles exactly this one page
    }
    playSfx("correct"); // page-complete juice
    setCompletedTitles(prev => [...prev, passageSource]);
    // "Chapter completion" confetti — small for per-page, big at session end.
    // Confetti is mode-agnostic (celebration, not adventure mechanic) so Luca
    // gets it on his single-page session too — magical kid UX.
    triggerConfetti(document.body, "small");
    // Reactive fish: page complete = happy fish (Yana mode only — fish is
    // hidden in Luca mode, so we skip the setState entirely to avoid
    // mutating dead adventure state in Luca's path).
    if (!isLucaMode) {
      setFishMood("happy");
      setTimeout(() => setFishMood("idle"), 2000);
    }

    // Update kidsData.readingStats — canonical shape per S04 spec:
    // { storiesRead, wordsRead, lastPlayed } — shared with StoryQuest + WordWarrior.
    // Atomic per-counter increments (codex S07 review): the old whole-object
    // write built from a stale kidsData snapshot could drop a concurrent
    // page completion from another device/session.
    if (fbSet && profile?.name) {
      fbSet(`kidsData/${profile.name}/readingStats/storiesRead`, increment(1));
      fbSet(`kidsData/${profile.name}/readingStats/wordsRead`, increment(tokens.length));
      fbSet(`kidsData/${profile.name}/readingStats/lastPlayed`, new Date().toISOString());
    }

    // Advance Luca level after 3 pages at current level (S07 runway: cap is
    // now Level 4). Level + page count persist to Firebase because Luca's
    // sessions are single-page by design — without persistence the counter
    // reset every session and he could never reach 3 pages at a level.
    if (isLucaMode) {
      const nextPagesAtLevel = pagesAtLevel + 1;
      if (lucaLevel < LUCA_LEVEL_CAP && nextPagesAtLevel >= 3) {
        const newLevel = lucaLevel + 1;
        setLucaLevel(newLevel);
        setPagesAtLevel(0);
        setLucaPool(shufflePool(newLevel));
        setLucaIdx(-1); // so next tick loadNextPassage advances to 0
        if (fbSet && profile?.name) {
          fbSet(`kidsData/${profile.name}/readingLevel`, newLevel);
          fbSet(`kidsData/${profile.name}/readingPagesAtLevel`, 0);
        }
        // 2.5s full-screen LEVEL UP moment — banner + confetti + sfx + haptic
        setLevelUpBanner({ level: newLevel, name: LUCA_LEVEL_NAMES[newLevel] || "" });
        triggerConfetti(document.body, "big");
        playSfx("levelClear");
        buzz([30, 50, 30]);
        if (levelUpTimerRef.current) clearTimeout(levelUpTimerRef.current);
        levelUpTimerRef.current = setTimeout(() => setLevelUpBanner(null), 2500);
      } else if (lucaLevel < LUCA_LEVEL_CAP) {
        setPagesAtLevel(nextPagesAtLevel);
        if (fbSet && profile?.name) {
          fbSet(`kidsData/${profile.name}/readingPagesAtLevel`, nextPagesAtLevel);
        }
      }
      // At the Level 4 cap there's no next level to count toward — leave
      // pagesAtLevel at 0 and keep celebrating pages via stars.
    }

    setPagesCompleted(p => p + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRead]);

  // ─── 30-second power-up drop scheduler (Yana-mode only) ──────────────────
  // Differs from FractionLine's per-question cadence by design: reading has no
  // "questions" — pages take longer than fraction problems, so wall-clock
  // cadence makes more sense than per-page cadence.
  //
  // Codex review (HIGH): `loading` was originally in deps, which meant every
  // "Next passage" tap (loading: false→true→false) tore down and recreated
  // the timer at zero. A fast reader would NEVER see a drop. Fixed by
  // removing `loading` from deps so the timer accumulates across passages.
  // A drop can now spawn during a Groq fetch — that's an acceptable UX
  // tradeoff (kid has something to tap during a brief wait).
  useEffect(() => {
    if (isLucaMode) return;          // Luca mode = no drops, no shame
    if (finishedSession) return;

    dropTimerRef.current = setInterval(() => {
      // 🐢 Slow Time (real buff): drop spawns pause while it's active
      const buff = activeBuffRef.current;
      if (buff?.type === "slowTime" && buff.expiresAt > Date.now()) return;
      setDrops(prev => {
        if (prev.length !== 0) return prev;
        // 💨 Frenzy (real debuff): drops spawned while active fall 2× faster.
        // fallMs is baked at spawn so mid-flight drops never restart their
        // CSS animation when the effect expires.
        const deb = activeDebuffRef.current;
        const frenzied = deb?.type === "frenzy" && deb.expiresAt > Date.now();
        const fallMs = frenzied ? Math.round(DROP_FALL_DURATION_MS / 2) : DROP_FALL_DURATION_MS;
        // FL9: drop math scales with the parent-set addition difficulty
        return spawnDropPair(getKidDifficulty(kidsData, profile?.name, "addition"))
          .map(d => ({ ...d, fallMs }));
      });
    }, POWERUP_INTERVAL_MS);

    return () => {
      if (dropTimerRef.current) clearInterval(dropTimerRef.current);
      dropTimerRef.current = null;
    };
  }, [isLucaMode, finishedSession]);

  // Auto-dismiss the power-up notice (matches FractionLine:702-705 lifetime)
  useEffect(() => {
    if (!powerupNotice) return;
    const t = setTimeout(() => setPowerupNotice(null), POWERUP_NOTICE_MS);
    return () => clearTimeout(t);
  }, [powerupNotice]);

  // Lives = 0 → end session early with empathy (no "GAME OVER" — matches
  // ReadingGame design intent, lines 6-19)
  useEffect(() => {
    if (isLucaMode) return;
    if (lives > 0) return;
    if (finishedSession) return;
    showToast("That was a tough one — let's stop here for now");
    finishSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lives, isLucaMode, finishedSession]);

  // ─── Exit / finish session — award session bonus + record history ─────────
  // Effort-gated (mirrors FractionLine.exitSession): this is ALSO the Back-
  // button handler, so the +3 bonus and the history entry only exist when at
  // least one page was actually read — no enter-exit star farming against
  // real-world rewards. finishedRef guards synchronously against double-taps.
  function finishSession() {
    let exitDelayMs = 0;
    if (!finishedSession && !finishedRef.current) {
      finishedRef.current = true;
      if (pagesCompleted >= 1) {
        addStars?.(3, "Reading session complete");
        setSessionStars(s => s + 3);
        recordGameHistory(fbSet, profile, "reading", pagesCompleted, sessionStars + 3, {
          passages: completedTitles,
          mode: isLucaMode ? "luca-phonics" : "yana-fluency",
        });
        // 🏆 Personal best — self-competition only (own pages-per-session record)
        const pb = checkPersonalBest(profile?.name, "reading", pagesCompleted);
        if (pb.isNewBest) {
          setPbBanner(pb);
          playSfx("newRecord");
          exitDelayMs = 2500; // let the kid SEE the record before leaving
        }
        // Session-bonus confetti (big) — only Yana mode (Luca's mode is single-
        // page by design; small confetti fired on the page completion already)
        if (!isLucaMode) {
          triggerConfetti(document.body, "big");
        }
      }
      setFinishedSession(true);
    }
    stopSpeech();
    if (dropTimerRef.current) {
      clearInterval(dropTimerRef.current);
      dropTimerRef.current = null;
    }
    if (exitDelayMs > 0) {
      exitTimerRef.current = setTimeout(() => transitionTo?.("mini_games"), exitDelayMs);
    } else {
      transitionTo?.("mini_games");
    }
  }

  // ─── Render helpers ───────────────────────────────────────────────────────
  const headerBg = isLucaMode
    ? "linear-gradient(180deg, #1e3a8a, #1e40af, #2563eb)"
    : "linear-gradient(180deg, #064e3b, #065f46, #047857)";

  // 🌫️ Blind (real debuff, Yana only): NOT-yet-read words blur into a squint
  // challenge and un-blur one by one as the kid reads them. Expiry clears via
  // the applyDebuff timeout → re-render → everything crisp again.
  const blindActive = !isLucaMode && activeDebuff?.type === "blind" &&
    activeDebuff.expiresAt > Date.now();

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

      {/* 📖 LEVEL UP banner — 2.5s full-screen moment (Luca runway) */}
      {levelUpBanner && (
        <div role="status" style={{
          position: "fixed", inset: 0, zIndex: 9998, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center",
          background: "rgba(15,23,42,0.9)", textAlign: "center", padding: 20,
        }}>
          <div style={{ fontSize: 56, marginBottom: 10 }}>📖</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#fbbf24" }}>LEVEL UP!</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginTop: 8 }}>
            Level {levelUpBanner.level}: {levelUpBanner.name}
          </div>
        </div>
      )}

      {/* 🏆 NEW PERSONAL BEST banner — shown 2.5s before the exit transition */}
      {pbBanner && (
        <div role="status" style={{
          position: "fixed", inset: 0, zIndex: 9998, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center",
          background: "rgba(15,23,42,0.9)", textAlign: "center", padding: 20,
        }}>
          <div style={{ fontSize: 56, marginBottom: 10 }}>🏆</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#fbbf24" }}>NEW PERSONAL BEST!</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginTop: 8 }}>
            {pbBanner.best} {pbBanner.best === 1 ? "page" : "pages"} read
          </div>
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>
            Your old best: {pbBanner.prevBest}
          </div>
        </div>
      )}

      <div style={{ background: headerBg, padding: 20, minHeight: 500, position: "relative" }}>
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

        {/* Lives bar — Yana mode only (anti-shame guardrail for Luca) */}
        {!isLucaMode && (
          <div role="status" aria-label={`${lives} ${lives === 1 ? "life" : "lives"} remaining`}
            style={{ textAlign: "center", marginBottom: 8, color: "#fbbf24",
                     fontSize: 18, fontWeight: 700 }}>
            <span aria-hidden="true">{"❤️".repeat(Math.max(0, lives))}</span>
            <span style={{ marginLeft: 6, fontSize: 14 }}>×{lives}</span>
          </div>
        )}

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
              Level {lucaLevel}{lucaLevel < LUCA_LEVEL_CAP
                ? ` · Page ${Math.min(pagesAtLevel + 1, 3)} of 3`
                : " · ⭐ Top level!"}
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
                    // 🌫️ Blind: unread words blur; each word un-blurs as it's read
                    filter: blindActive && !isRead ? "blur(3px)" : "none",
                    transition: "background 0.15s, box-shadow 0.15s, color 0.15s, filter 0.3s",
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
                  You earned ⭐ {lastPageStars} {lastPageStars === 1 ? "star" : "stars"} for this page
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

        {/* Reactive fish — bottom-left, Yana mode only */}
        {!isLucaMode && (
          <div aria-hidden="true" style={{
            position: "absolute", bottom: 12, left: 16, fontSize: 36,
            transition: "transform 0.3s",
            transform: fishMood === "happy" ? "translateY(-12px) rotate(-15deg)"
                     : fishMood === "lunge" ? "translateY(-22px) scale(1.2)"
                     : "translateY(0) rotate(0)",
            pointerEvents: "none",
          }}>
            🐟
          </div>
        )}

        {/* Falling power-up drops (Yana mode only) — tapping a drop applies
            its effect; a winner drop applies a random buff, a loser drop
            applies a random debuff. Pattern adapted from FractionLine.jsx
            falling-drop overlay. onAnimationEnd clears untapped drops so a
            kid who ignores them isn't permanently locked out of new spawns. */}
        {!isLucaMode && drops.map(d => (
          <button key={d.id} onClick={() => tapDrop(d)}
            onAnimationEnd={() => dropFellOff(d)}
            aria-label={`Power-up: ${d.expr}`}
            style={{
              position: "absolute", left: `${d.leftPct}%`, top: 0,
              transform: "translateX(-50%)",
              animation: `dropFall ${d.fallMs || DROP_FALL_DURATION_MS}ms linear forwards`,
              background: "rgba(15,23,42,0.85)", color: "#fbbf24",
              border: "2px solid #fbbf24", borderRadius: 12,
              padding: "8px 12px", fontWeight: 800, fontSize: 16,
              minHeight: 44, minWidth: 44, cursor: "pointer", zIndex: 10,
            }}>
            {d.expr}
          </button>
        ))}

        {/* Power-up notice toast */}
        {powerupNotice && (
          <div role="status" style={{
            position: "absolute", top: 70, left: "50%", transform: "translateX(-50%)",
            background: powerupNotice.kind === "buff" ? "#15803d" : "#991b1b",
            color: "#fff", padding: "10px 18px", borderRadius: 10, fontWeight: 800,
            border: "2px solid rgba(255,255,255,0.4)", zIndex: 20,
          }}>
            {powerupNotice.text}
          </div>
        )}

        {/* Adventure-mode keyframes — dropFall is not in RPGCore's shared
            KEYFRAMES_CSS (verified at FractionLine.jsx:1169 — defined inline
            inside that game's own <style> block), so we mirror the local-
            scope pattern here. */}
        <style>{`
          @keyframes dropFall {
            from { top: -10%; }
            to   { top: 100%; }
          }
        `}</style>
      </div>
    </div>
  );
}
