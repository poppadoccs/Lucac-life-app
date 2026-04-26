// ─── FRACTION LINE (EDU-03, S04-A2) ──────────────────────────────────────────
// Number-line magnitude fraction game. Research-backed pedagogy:
//   - NOT pizza pies. Pies obscure magnitude comparison.
//   - Number-line magnitude → symbol (Siegler 2011, Slice Fractions).
//   - Visual-first: kid DRAGS a marker to where a fraction sits on the line.
//   - Variant mode (Yana+ only): show a marker at a position, ask "what fraction?"
//
// Math correctness (per CLAUDE.md 5×10=40 lesson):
//   - All correctness checks are deterministic JS math (n/d compared with tolerance).
//   - Any displayed math text runs through verifyMath() before render.
//
// Stars policy: +3 on session complete, NOT per question. No shame, no timer.

import { useState, useEffect, useRef } from "react";
import { GameBtn, recordGameHistory, ageBandFromProfile } from "./_shared";
import { recordAttempt } from "../LearningEngine";
import { verifyMath } from "../utils";

// ─── FRACTION SETS ───────────────────────────────────────────────────────────
// L1: halves, thirds, fourths.   L2: + fifths, sixths, eighths.
// L3: + tenths, twelfths — includes equivalents recognition via GCD compare.
const FRACTION_SETS = [
  { level: 1, fractions: [{n:1,d:2},{n:1,d:3},{n:2,d:3},{n:1,d:4},{n:3,d:4}] },
  { level: 2, fractions: [{n:1,d:5},{n:2,d:5},{n:3,d:5},{n:4,d:5},{n:1,d:6},{n:5,d:6},{n:1,d:8},{n:3,d:8},{n:5,d:8},{n:7,d:8}] },
  { level: 3, fractions: [{n:1,d:10},{n:3,d:10},{n:7,d:10},{n:9,d:10},{n:1,d:12},{n:5,d:12},{n:7,d:12},{n:11,d:12}] },
];

const QUESTIONS_PER_LEVEL = 8;
const TOLERANCE = 0.06; // 6% of line length — bumped from 0.05 after Alex playtest 2026-04-24
const LINE_PADDING = 20; // px inset on each end for the marker
const LIVES_MAX = 5; // default starting hearts — wrong answers cost 1, lives=0 → game over

// ─── POWER-UP DROP CONFIG ────────────────────────────────────────────────────
// Two icons fall from the top of the screen with math expressions. Kid taps the
// HIGHER value → grabs power-up. Lower value → debuff. Ignoring is safe.
// Per Alex's design 2026-04-24: "the math IS the bonus, not just the mechanic."
const DROP_SPAWN_CHANCE = 0.25; // 25% per new question
const DROP_FALL_DURATION_MS = 7000; // 7s to traverse top→bottom
const POWERUP_NOTICE_MS = 2200; // toast lifetime

// Pure math-expression generator. Returns [expressionText, numericValue].
// v1: addition only, single-digit. Difficulty scaling (3.NBT.3 estimation tier
// for the extreme bucket) lands in a follow-up commit.
function generateMathExpr(_difficulty = "easy") {
  const a = 1 + Math.floor(Math.random() * 9);
  const b = 1 + Math.floor(Math.random() * 9);
  return [`${a} + ${b}`, a + b];
}

// Generate a pair of drops with DIFFERENT values (so there's always a clear winner).
function spawnDropPair() {
  const [exprA, valA] = generateMathExpr();
  let [exprB, valB] = generateMathExpr();
  let attempts = 0;
  while (valB === valA && attempts < 8) {
    [exprB, valB] = generateMathExpr();
    attempts++;
  }
  if (valB === valA) valB = valA + 1; // emergency tiebreak
  const winnerIsA = valA > valB;
  const baseId = Date.now();
  return [
    { id: baseId,     expr: exprA, value: valA, isWinner: winnerIsA,  leftPct: 22 },
    { id: baseId + 1, expr: exprB, value: valB, isWinner: !winnerIsA, leftPct: 78 },
  ];
}

// ─── MATH HELPERS ────────────────────────────────────────────────────────────
function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}
function simplify(n, d) {
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
function equivalent(a, b) {
  const sa = simplify(a.n, a.d);
  const sb = simplify(b.n, b.d);
  return sa.n === sb.n && sa.d === sb.d;
}
function fractionValue(f) {
  return f.n / f.d;
}

// Pick a random fraction from the current level (+ optional prior-level pool for variety).
// `recent` is a list of recently-shown fractions to AVOID picking again — prevents the
// "1/2 → 3/4 → 3/4 → 1/2 → 1/2" repeat clusters Alex hit during the 2026-04-24 playtest.
//
// Luca-mode: K-age (CC: thirds is a Grade 3 concept, NOT kindergarten). Pool restricted
// to halves + fourths so the constant tick scaffold (1/4, 1/2, 3/4) always cleanly
// represents the question. Per persona-review (Luca): "dad why do the sticks change."
function pickFraction(level, isLuca, recent = []) {
  // Luca never auto-advances; always pull from L1 pool.
  const effectiveLevel = isLuca ? 1 : level;
  let pool = [];
  for (let i = 0; i < effectiveLevel; i++) {
    pool.push(...FRACTION_SETS[i].fractions);
  }
  if (isLuca) {
    // Halves + fourths only — keeps tick scaffold constant per question.
    pool = pool.filter(f => f.d === 2 || f.d === 4);
  }
  const filtered = pool.filter(f => !recent.some(r => r.n === f.n && r.d === f.d));
  let actualPool = filtered;
  if (actualPool.length === 0) {
    // Pool exhausted by recency buffer (common for Luca: 3-item pool + 3-deep buffer).
    // Fall back to excluding ONLY the most recent fraction, so we never immediately
    // repeat the just-shown one even when we have to relax the rule. (Codex LOW 2026-04-25)
    const last = recent[recent.length - 1];
    actualPool = last
      ? pool.filter(f => f.n !== last.n || f.d !== last.d)
      : pool;
    if (actualPool.length === 0) actualPool = pool;
  }
  return actualPool[Math.floor(Math.random() * actualPool.length)];
}

// Random marker start position that won't accidentally land on the answer.
// If random pick is within 2× tolerance of the answer, push it to the opposite end.
function randomStartPos(answer) {
  let pos = Math.random();
  if (Math.abs(pos - answer) < TOLERANCE * 2) {
    pos = answer < 0.5 ? 0.85 + Math.random() * 0.1 : 0.05 + Math.random() * 0.1;
  }
  return pos;
}

// Pick plausible wrong-answer fractions for multiple-choice variant mode.
// Excludes equivalents to the correct answer (via GCD simplification).
function pickWrongChoices(correct, level) {
  const poolRaw = [];
  for (let i = 0; i <= level - 1; i++) {
    poolRaw.push(...FRACTION_SETS[i].fractions);
  }
  // Remove anything equivalent to correct.
  const pool = poolRaw.filter(f => !equivalent(f, correct));
  // Shuffle and take 3.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

// ─── STACKED FRACTION DISPLAY ────────────────────────────────────────────────
// Renders n over d with a horizontal divider — more readable than "n/d".
function StackedFraction({ n, d, size = 28, color = "#fff" }) {
  return (
    <div style={{
      display: "inline-flex", flexDirection: "column", alignItems: "center",
      lineHeight: 1, fontFamily: "Georgia, serif", fontWeight: 700, color,
      padding: "0 4px", verticalAlign: "middle",
    }}>
      <div style={{ fontSize: size }}>{n}</div>
      <div style={{ width: "100%", height: 2, background: color, margin: "2px 0" }} />
      <div style={{ fontSize: size }}>{d}</div>
    </div>
  );
}

export default function FractionLine({
  profile, kidsData, fbSet, addStars, transitionTo,
  curriculum, learningStats = {}, rewardsConfig = [],
}) {
  const isLuca = ageBandFromProfile(profile) === "luca";
  const MARKER_SIZE = isLuca ? 80 : 56;

  // ── Phase & session state ──────────────────────────────────────────────────
  const [phase, setPhase] = useState("intro"); // intro | play | complete | victory | gameOver
  const [level, setLevel] = useState(1);
  const [levelCorrect, setLevelCorrect] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [lives, setLives] = useState(LIVES_MAX); // hearts — wrong answer costs 1; 0 → game over
  const [streak, setStreak] = useState(0); // current correct-in-a-row count — resets on wrong
  const [bestStreak, setBestStreak] = useState(0); // peak streak this session — persists for Game Over screen
  const [usedFreeThisQuestion, setUsedFreeThisQuestion] = useState(false); // shows "free try" banner
  const [drops, setDrops] = useState([]); // active falling power-up drops (0 or 2 at a time)
  const [powerupNotice, setPowerupNotice] = useState(null); // { text, kind } toast for last applied effect

  // ── Current question state ────────────────────────────────────────────────
  const [mode, setMode] = useState("drag"); // "drag" or "identify" (variant)
  const [targetFraction, setTargetFraction] = useState({ n: 1, d: 2 });
  const [shownPosition, setShownPosition] = useState(0.5); // for identify mode
  const [identifyChoices, setIdentifyChoices] = useState([]);
  const [markerPos, setMarkerPos] = useState(0.5); // 0..1 along line
  const [feedback, setFeedback] = useState(null); // null | "correct" | "incorrect"
  const [showTruth, setShowTruth] = useState(false);
  const [locked, setLocked] = useState(false); // during feedback animation

  // ── Refs ───────────────────────────────────────────────────────────────────
  const questionStartRef = useRef(0);
  const lineRef = useRef(null);
  const draggingRef = useRef(false);
  const markerPosRef = useRef(0.5);
  const starsEarnedRef = useRef(0);
  const sessionEndedRef = useRef(false);
  const recentFractionsRef = useRef([]); // last 3 fractions shown — pickFraction filters these out
  const freeRetryUsedRef = useRef(false); // first wrong of session is "free" — no heart loss, retry same Q
  const lockedRef = useRef(false); // synchronous double-tap guard — `locked` state is async (Codex MEDIUM 2026-04-25)

  useEffect(() => { markerPosRef.current = markerPos; }, [markerPos]);

  // ── New question setup ────────────────────────────────────────────────────
  function newQuestion(currentLevel) {
    const f = pickFraction(currentLevel, isLuca, recentFractionsRef.current);
    recentFractionsRef.current = [...recentFractionsRef.current, f].slice(-3);
    setTargetFraction(f);
    const startPos = randomStartPos(fractionValue(f));
    setMarkerPos(startPos);
    markerPosRef.current = startPos;
    setFeedback(null);
    setShowTruth(false);
    setLocked(false);
    lockedRef.current = false;
    setUsedFreeThisQuestion(false);

    // Power-up drop spawn — 25% chance per new question. Two icons fall, kid taps
    // higher math value for a buff or lower for a debuff. Ignoring is safe.
    if (Math.random() < DROP_SPAWN_CHANCE) {
      setDrops(spawnDropPair());
    } else {
      setDrops([]);
    }

    // Luca never sees identify-mode (per plan). Otherwise ~35% identify, 65% drag.
    const useIdentify = !isLuca && Math.random() < 0.35;
    if (useIdentify) {
      setMode("identify");
      // Place marker at the exact true position of a random fraction
      setShownPosition(fractionValue(f));
      const wrongs = pickWrongChoices(f, currentLevel);
      const options = [f, ...wrongs];
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }
      setIdentifyChoices(options);
    } else {
      setMode("drag");
      setIdentifyChoices([]);
    }

    questionStartRef.current = Date.now();
  }

  // ── Start session ─────────────────────────────────────────────────────────
  function startPlay() {
    setLevel(1);
    setLevelCorrect(0);
    setTotalCorrect(0);
    setQuestionsAnswered(0);
    setLives(LIVES_MAX);
    setStreak(0);
    setBestStreak(0);
    starsEarnedRef.current = 0;
    sessionEndedRef.current = false;
    recentFractionsRef.current = [];
    freeRetryUsedRef.current = false;
    lockedRef.current = false;
    setDrops([]);
    setPowerupNotice(null);
    newQuestion(1);
    setPhase("play");
  }

  // ── End session → stars + history (called once) ───────────────────────────
  // `stats` parameter is REQUIRED at every deferred (setTimeout) call site because
  // closure-captured questionsAnswered/totalCorrect/level are stale after their
  // setX() calls inside finishQuestion (per Codex MEDIUM 2026-04-25).
  function endSession(victoryBonus = false, stats = null) {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    const baseStars = 3;
    const bonusStars = victoryBonus ? 2 : 0;
    const total = baseStars + bonusStars;
    starsEarnedRef.current = total;
    addStars?.(total, victoryBonus
      ? "FractionLine full victory — all 3 levels"
      : "FractionLine session complete");
    const finalCorrect = stats?.totalCorrect ?? totalCorrect;
    const finalQA = stats?.questionsAnswered ?? questionsAnswered;
    const finalLevel = stats?.level ?? level;
    recordGameHistory(fbSet, profile, "fraction_line", finalCorrect, total, {
      level: finalLevel,
      questionsAnswered: finalQA,
      victory: victoryBonus,
    });
  }

  // ── Answer submission (drag mode) ─────────────────────────────────────────
  // Synchronous lockedRef guard prevents double-tap re-entry; setLocked() is async
  // so checking only the state value lets a fast second tap pass before re-render.
  function submitDragAnswer() {
    if (lockedRef.current || mode !== "drag") return;
    lockedRef.current = true;
    const truePos = fractionValue(targetFraction);
    const kidPos = markerPosRef.current;
    const diff = Math.abs(kidPos - truePos);
    const correct = diff < TOLERANCE;
    finishQuestion(correct);
  }

  // ── Answer submission (identify mode) ─────────────────────────────────────
  function submitIdentifyAnswer(choice) {
    if (lockedRef.current || mode !== "identify") return;
    lockedRef.current = true;
    // Correct if the chosen fraction equals the shown-at fraction
    // (equivalents count — e.g. if shown at 0.5 and kid picks 2/4, that's fine).
    const shownAsFrac = targetFraction; // target IS what's shown at that position
    const correct = equivalent(choice, shownAsFrac) ||
                    Math.abs(fractionValue(choice) - shownPosition) < 1e-9;
    finishQuestion(correct);
  }

  // ── Common finish path — record + feedback + advance ──────────────────────
  function finishQuestion(correct) {
    setLocked(true);
    setFeedback(correct ? "correct" : "incorrect");
    if (!correct) setShowTruth(true);

    const timeMs = Date.now() - questionStartRef.current;
    recordAttempt(fbSet, profile?.name, "fractions", correct, timeMs);

    const newQA = questionsAnswered + 1;
    setQuestionsAnswered(newQA);

    if (correct) {
      const newLevelCorrect = levelCorrect + 1;
      const newTotal = totalCorrect + 1;
      const newStreak = streak + 1;
      setLevelCorrect(newLevelCorrect);
      setTotalCorrect(newTotal);
      setStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);

      // Luca: never auto-advance. All 3 kids eventually, but Luca stays on L1 forever.
      const canAdvance = !isLuca;

      // Bumped to 1300ms (from 900) per persona-review finding: "green sparkle too brief,
      // cat's eye left immediately = kid won't feel the win." Extra time lets the win land.
      setTimeout(() => {
        // Snapshot of fresh stats — pass to endSession to avoid closure staleness.
        const freshStats = { totalCorrect: newTotal, questionsAnswered: newQA, level };
        if (newLevelCorrect >= QUESTIONS_PER_LEVEL) {
          // Level clear
          if (level >= 3 || !canAdvance) {
            // Full victory (or Luca completing an L1 batch → count as complete)
            if (level >= 3) {
              endSession(true, freshStats);
              setPhase("victory");
            } else {
              // Luca hit 8 in L1 → gentle complete screen, no advance
              endSession(false, freshStats);
              setPhase("complete");
            }
          } else {
            const nextLevel = level + 1;
            setLevel(nextLevel);
            setLevelCorrect(0);
            newQuestion(nextLevel);
          }
        } else {
          newQuestion(level);
        }
      }, 1300);
      return;
    }

    // Wrong path
    setStreak(0);

    // First wrong of session is a "free try" — show truth + retry same question, no
    // heart loss. Per persona-review (Yana): the heart cascade itself is the worst part
    // ("by heart 3 i already knew"). One soft entry lets her settle in without the
    // first miss feeling like a death sentence. Subsequent wrongs cost a heart normally.
    if (!freeRetryUsedRef.current) {
      freeRetryUsedRef.current = true;
      setUsedFreeThisQuestion(true);
      setTimeout(() => {
        setFeedback(null);
        setShowTruth(false);
        setLocked(false);
        lockedRef.current = false;
        // CLEAR free-try indicator at the END of the free-try moment — otherwise
        // it persists into the next attempt and mis-renders "Heart safe!" while
        // the heart actually drops on the 2nd wrong (Playwright finding 2026-04-26).
        setUsedFreeThisQuestion(false);
        const startPos = randomStartPos(fractionValue(targetFraction));
        setMarkerPos(startPos);
        markerPosRef.current = startPos;
        questionStartRef.current = Date.now();
      }, 1500);
      return;
    }

    // Subsequent wrongs: lose a heart, advance to a new fraction (or game over).
    // recordAttempt above feeds the adaptive weak-area system in LearningEngine,
    // so missed fractions resurface naturally without us forcing repetition here.
    const newLives = lives - 1;
    setLives(newLives);
    setTimeout(() => {
      if (newLives <= 0) {
        // Game over — pass fresh stats explicitly (questionsAnswered was just bumped
        // to newQA above; totalCorrect/level unchanged in wrong path).
        endSession(false, { totalCorrect, questionsAnswered: newQA, level });
        setPhase("gameOver");
      } else {
        newQuestion(level);
      }
    }, 1500);
  }

  // ── Pointer Events for drag (touch + mouse + stylus uniform) ──────────────
  function getLineRect() {
    return lineRef.current?.getBoundingClientRect();
  }

  function clientXToPos(clientX) {
    const r = getLineRect();
    if (!r) return 0.5;
    const usable = r.width - LINE_PADDING * 2;
    const rel = clientX - (r.left + LINE_PADDING);
    return Math.max(0, Math.min(1, rel / usable));
  }

  function handlePointerDown(e) {
    if (locked || mode !== "drag") return;
    draggingRef.current = true;
    const pos = clientXToPos(e.clientX);
    setMarkerPos(pos);
    markerPosRef.current = pos;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function handlePointerMove(e) {
    if (!draggingRef.current || locked || mode !== "drag") return;
    const pos = clientXToPos(e.clientX);
    setMarkerPos(pos);
    markerPosRef.current = pos;
  }
  function handlePointerUp(e) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch {}
  }

  // Also allow tap-on-line to place marker (mobile ergonomics).
  function handleLineTap(e) {
    if (locked || mode !== "drag") return;
    const pos = clientXToPos(e.clientX);
    setMarkerPos(pos);
    markerPosRef.current = pos;
  }

  // ── Exit mid-session → still grant partial stars if they answered ─────────
  function exitSession() {
    if (!sessionEndedRef.current && questionsAnswered >= 3) {
      // Give the 3 stars if they put in real effort
      endSession(false, { totalCorrect, questionsAnswered, level });
    }
    transitionTo("mini_games");
  }

  // ── Power-up drop tap handler ─────────────────────────────────────────────
  // Kid tapped one of the falling icons. If they picked the higher-value math
  // expression they get a buff; lower → debuff. v1 implements +1 Heart (buff)
  // and -1 Heart (debuff) only — additional effects (Slow Time, Magnet, Reverse,
  // Freeze, Rotate, Star Surge, Invincible, Frenzy, Thunder, Blind) land in
  // a follow-up commit. Mechanic itself is the validated piece here.
  function onTapDrop(drop) {
    setDrops([]); // both icons disappear when one is tapped
    if (drop.isWinner) {
      // BUFF: +1 Heart (capped at LIVES_MAX)
      setLives(prev => Math.min(LIVES_MAX, prev + 1));
      setPowerupNotice({
        text: `❤️ +1 Heart! (${drop.expr} = ${drop.value} was higher)`,
        kind: "buff",
      });
    } else {
      // DEBUFF: -1 Heart (but not below 0; if it'd hit 0, end the run)
      setLives(prev => {
        const next = Math.max(0, prev - 1);
        return next;
      });
      setPowerupNotice({
        text: `💀 -1 Heart (${drop.expr} = ${drop.value} was lower)`,
        kind: "debuff",
      });
    }
  }

  // Auto-dismiss the power-up notice after POWERUP_NOTICE_MS.
  useEffect(() => {
    if (!powerupNotice) return;
    const t = setTimeout(() => setPowerupNotice(null), POWERUP_NOTICE_MS);
    return () => clearTimeout(t);
  }, [powerupNotice]);

  // If a debuff (or sequence of effects) drops lives to 0 outside the wrong-answer
  // path, end the session here. sessionEndedRef guards against double-ending.
  useEffect(() => {
    if (lives <= 0 && phase === "play" && !sessionEndedRef.current) {
      endSession(false, { totalCorrect, questionsAnswered, level });
      setPhase("gameOver");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lives, phase]);

  // ── Styles ────────────────────────────────────────────────────────────────
  const wrapBase = {
    minHeight: "100vh", fontFamily: "system-ui, sans-serif",
    display: "flex", flexDirection: "column", userSelect: "none",
    touchAction: "none", // prevent browser scroll-during-drag
    background: "linear-gradient(135deg, #0c4a6e, #155e75)",
    color: "#fff",
  };

  // Play-phase wrap: pond profile — sky at top, water deepening to murky bottom.
  // Intro/complete/victory/gameOver still use the dark wrapBase.
  // FIXED-POSITION OVERLAY: per Playwright playtest 2026-04-26, the app's bottom
  // nav bar (Home / My Stuff) was bisecting the game UI between Check Answer and
  // Exit. Making play phase a fullscreen overlay covers the nav bar; Exit button
  // remains accessible inside the overlay. zIndex: 50 sits above the app shell.
  const wrapPlay = {
    ...wrapBase,
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    minHeight: "auto",
    height: "100vh",
    overflowY: "auto",
    zIndex: 50,
    background: "linear-gradient(180deg, #87ceeb 0%, #4ba8d8 28%, #1e6091 60%, #0c3a5e 100%)",
  };

  // ─── INTRO SCREEN ─────────────────────────────────────────────────────────
  if (phase === "intro") return (
    <div style={{ ...wrapBase, padding: 16, alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div style={{ fontSize: 64, marginBottom: 8 }}>📏</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: "#7dd3fc", marginBottom: 6 }}>
          Fraction Line
        </div>
        <div style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", marginBottom: 18, lineHeight: 1.5 }}>
          Drag the marker to where each fraction lives on the line from 0 to 1.
          {isLuca ? " Go at your own speed — no timer!" : " 8 right = level up!"}
        </div>

        {/* Preview line */}
        <div style={{
          margin: "20px auto", maxWidth: 360, padding: "30px 20px",
          background: "rgba(0,0,0,0.25)", borderRadius: 14,
        }}>
          <div style={{ position: "relative", height: 40 }}>
            <div style={{
              position: "absolute", top: 18, left: 0, right: 0, height: 4,
              background: "#7dd3fc", borderRadius: 2,
            }} />
            <div style={{ position: "absolute", left: 0, top: 10, width: 2, height: 20, background: "#fff" }} />
            <div style={{ position: "absolute", right: 0, top: 10, width: 2, height: 20, background: "#fff" }} />
            <div style={{ position: "absolute", left: "50%", top: 10, width: 2, height: 20, background: "rgba(255,255,255,0.5)" }} />
            <div style={{ position: "absolute", left: "-6px", top: 34, fontSize: 14, fontWeight: 700 }}>0</div>
            <div style={{ position: "absolute", right: "-6px", top: 34, fontSize: 14, fontWeight: 700 }}>1</div>
            <div style={{ position: "absolute", left: "calc(50% - 18px)", top: -8, fontSize: 16 }}>
              <StackedFraction n={1} d={2} size={14} />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 260, margin: "0 auto" }}>
          <GameBtn big color="#0ea5e9" onClick={startPlay}>Start</GameBtn>
          <GameBtn color="#475569" onClick={() => transitionTo("mini_games")}>← Back to Menu</GameBtn>
        </div>
      </div>
    </div>
  );

  // ─── COMPLETE SCREEN ──────────────────────────────────────────────────────
  if (phase === "complete") return (
    <div style={{ ...wrapBase, alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", padding: 32 }}>
        <div style={{ fontSize: 64 }}>🎉</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#7dd3fc" }}>Great job!</div>
        <div style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", marginTop: 6, marginBottom: 4 }}>
          {totalCorrect} correct out of {questionsAnswered}
        </div>
        <div style={{ fontSize: 16, color: "#fbbf24", fontWeight: 700, marginBottom: 24 }}>
          ⭐ +{starsEarnedRef.current} stars earned
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 260, margin: "0 auto" }}>
          <GameBtn big color="#0ea5e9" onClick={startPlay}>Play Again</GameBtn>
          <GameBtn color="#475569" onClick={() => transitionTo("mini_games")}>← Back to Menu</GameBtn>
        </div>
      </div>
    </div>
  );

  // ─── VICTORY SCREEN ───────────────────────────────────────────────────────
  if (phase === "victory") return (
    <div style={{ ...wrapBase,
      background: "linear-gradient(135deg, #4c1d95, #0ea5e9)",
      alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ textAlign: "center", padding: 32 }}>
        <div style={{ fontSize: 72 }}>🏆</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: "#fcd34d" }}>FRACTION CHAMPION!</div>
        <div style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", marginTop: 8 }}>
          All 3 levels cleared
        </div>
        <div style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>
          {totalCorrect} correct out of {questionsAnswered}
        </div>
        <div style={{ fontSize: 18, color: "#fbbf24", fontWeight: 700, marginTop: 10, marginBottom: 24 }}>
          ⭐ +{starsEarnedRef.current} stars (with bonus!)
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 260, margin: "0 auto" }}>
          <GameBtn big color="#f59e0b" onClick={startPlay}>Play Again</GameBtn>
          <GameBtn color="#475569" onClick={() => transitionTo("mini_games")}>← Back to Menu</GameBtn>
        </div>
      </div>
    </div>
  );

  // ─── GAME OVER SCREEN ─────────────────────────────────────────────────────
  // POSITIVE-ONLY framing — per persona-review (Yana): "the 7 is louder than the 3 …
  // out loud where Luca could hear." Every visible number was a deficit indicator.
  // Now: only show what she EARNED (stars + correct count). No ratio, no "reached
  // level" (which read as condescending when she was already at that level).
  if (phase === "gameOver") return (
    <div style={{ ...wrapBase, alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", padding: 32 }}>
        <div style={{ fontSize: 64 }}>💔</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#fbbf24" }}>Out of Hearts</div>
        {totalCorrect > 0 && (
          <div style={{ fontSize: 17, color: "#a7f3d0", fontWeight: 700, marginTop: 14 }}>
            {totalCorrect} {totalCorrect === 1 ? "fraction" : "fractions"} placed ✓
          </div>
        )}
        {bestStreak >= 3 && (
          <div style={{ fontSize: 14, color: "#fb923c", fontWeight: 700, marginTop: 4 }}>
            Best streak: 🔥 {bestStreak} in a row
          </div>
        )}
        <div style={{ fontSize: 18, color: "#fbbf24", fontWeight: 800, marginTop: 14, marginBottom: 28 }}>
          ⭐ +{starsEarnedRef.current} stars
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 260, margin: "0 auto" }}>
          <GameBtn big color="#0ea5e9" onClick={startPlay}>Try Again</GameBtn>
          <GameBtn color="#475569" onClick={() => transitionTo("mini_games")}>← Back to Menu</GameBtn>
        </div>
      </div>
    </div>
  );

  // ─── PLAY PHASE ───────────────────────────────────────────────────────────
  const truePos = fractionValue(targetFraction); // deterministic JS truth
  const displayPos = mode === "identify" ? shownPosition : markerPos;

  // Text for the current question, guarded by verifyMath even though no arithmetic
  // is displayed — defense in depth per CLAUDE.md 5×10=40 lesson.
  const levelLabel = verifyMath(`Level ${level} of 3`);

  return (
    <div style={{ ...wrapPlay, padding: 16 }}>
      {/* HUD — level on left, hearts in center, level-correct count on right */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
          {isLuca ? "Level 1" : levelLabel}
        </div>
        <div role="status" aria-live="polite" aria-atomic="true"
             aria-label={`${lives} ${lives === 1 ? "life" : "lives"} remaining`}
             style={{ fontSize: 14, color: "#fca5a5", fontWeight: 800, letterSpacing: 1 }}>
          <span aria-hidden="true">{"❤️".repeat(Math.max(0, lives))}</span>
          <span aria-hidden="true" style={{ color: "#fff", fontSize: 12, marginLeft: 4, fontWeight: 700 }}>
            ×{lives}
          </span>
        </div>
        <div style={{ fontSize: 13, color: "#fde68a", fontWeight: 700 }}>
          {levelCorrect}/{QUESTIONS_PER_LEVEL}
        </div>
      </div>

      {/* Prompt */}
      <div style={{ textAlign: "center", marginTop: 12, marginBottom: 18 }}>
        {mode === "drag" ? (
          <>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", marginBottom: 8 }}>
              Hop the frog to:
            </div>
            <div style={{ display: "inline-block" }}>
              <StackedFraction n={targetFraction.n} d={targetFraction.d} size={42} />
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", marginBottom: 4 }}>
              What lilypad is the frog sitting on?
            </div>
          </>
        )}
      </div>

      {/* Pond — number line lives inside as the lilypad row.
          Container height bumped from 120 → 170 to give the fish room to swim in
          the water below the lily row. */}
      <div
        ref={lineRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleLineTap}
        style={{
          position: "relative",
          height: 170,
          margin: "20px 0",
          padding: `0 ${LINE_PADDING}px`,
          touchAction: "none",
          cursor: mode === "drag" && !locked ? "pointer" : "default",
        }}
      >
        {/* Water surface — subtle pale stripe at the lily row's height */}
        <div style={{
          position: "absolute",
          top: 62, left: LINE_PADDING, right: LINE_PADDING,
          height: 2, background: "rgba(255,255,255,0.25)", borderRadius: 1,
          pointerEvents: "none",
        }} />
        {/* Sandy bottom — gives the pond depth */}
        <div style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0,
          height: 14,
          background: "linear-gradient(180deg, rgba(140,98,55,0.0) 0%, rgba(140,98,55,0.6) 100%)",
          pointerEvents: "none",
        }} />

        {/* 0 and 1 endpoint ticks */}
        <div style={{
          position: "absolute", left: LINE_PADDING, top: 50, width: 3, height: 26,
          background: "#fff", borderRadius: 2,
        }} />
        <div style={{
          position: "absolute", right: LINE_PADDING, top: 50, width: 3, height: 26,
          background: "#fff", borderRadius: 2,
        }} />
        <div style={{ position: "absolute", left: LINE_PADDING - 4, top: 82, fontSize: 16, fontWeight: 800 }}>
          0
        </div>
        <div style={{ position: "absolute", right: LINE_PADDING - 4, top: 82, fontSize: 16, fontWeight: 800 }}>
          1
        </div>

        {/* Lilypads — replace the abstract tick marks with concrete pads the frog
            can land on. Visually communicates "fractions = equal divisions" without
            requiring the kid to interpret tick semantics. Banks at 0 and 1 are sandy
            shore (where the frog starts / finishes). Interior pads are floating green
            lily. L3 hides interior pads (banks only) to force magnitude estimation. */}
        {(() => {
          let positions = [];
          let strength = "strong";
          if (isLuca) {
            positions = [0, 0.25, 0.5, 0.75, 1];
            strength = "strong";
          } else if (level === 1) {
            positions = Array.from({ length: targetFraction.d + 1 }, (_, i) => i / targetFraction.d);
            strength = "strong";
          } else if (level === 2) {
            positions = Array.from({ length: targetFraction.d + 1 }, (_, i) => i / targetFraction.d);
            strength = "subtle";
          } else {
            positions = [0, 1]; // L3: banks only, no scaffolding
            strength = "strong"; // banks are always visible regardless
          }
          return positions.map((pos, i) => {
            const isBank = pos === 0 || pos === 1;
            const w = strength === "strong" ? (isBank ? 38 : 30) : (isBank ? 38 : 22);
            const h = w * 0.55;
            const opacity = strength === "subtle" && !isBank ? 0.55 : 1;
            const bg = isBank
              ? "linear-gradient(180deg, #d6a76c 0%, #a0764a 60%, #6b4d2e 100%)"  // sandy bank
              : "linear-gradient(180deg, #84cc16 0%, #65a30d 55%, #3f6212 100%)"; // lily
            return (
              <div key={`pad-${i}`} style={{
                position: "absolute",
                left: `calc(${LINE_PADDING}px + ${pos} * (100% - ${LINE_PADDING * 2}px))`,
                top: 60 - h / 2 + 2, // sits centered on the line
                width: w,
                height: h,
                transform: "translateX(-50%)",
                background: bg,
                borderRadius: "50%",
                boxShadow: "0 3px 6px rgba(0,0,0,0.35), inset 0 -2px 3px rgba(0,0,0,0.25), inset 0 2px 3px rgba(255,255,255,0.4)",
                opacity,
                pointerEvents: "none",
                zIndex: 1,
              }} />
            );
          });
        })()}

        {/* Truth marker — shown when kid is wrong */}
        {showTruth && (
          <div style={{
            position: "absolute",
            left: `calc(${LINE_PADDING}px + ${truePos} * (100% - ${LINE_PADDING * 2}px))`,
            top: 44,
            transform: "translateX(-50%)",
            pointerEvents: "none",
          }}>
            <div style={{
              width: 0, height: 0,
              borderLeft: "8px solid transparent",
              borderRight: "8px solid transparent",
              borderTop: "12px solid #22c55e",
              margin: "0 auto",
            }} />
            <div style={{
              width: 4, height: 40, background: "#22c55e",
              margin: "0 auto", borderRadius: 2,
              boxShadow: "0 0 8px #22c55e",
            }} />
            <div style={{
              fontSize: 11, color: "#22c55e", fontWeight: 800,
              marginTop: 2, textAlign: "center", whiteSpace: "nowrap",
            }}>
              ✓ HERE
            </div>
          </div>
        )}

        {/* The Frog — replaces the yellow marker. Position math unchanged.
            On correct: frog leaps up high (escapes the fish below).
            On incorrect: frog shakes (the fish reaches it). */}
        <div style={{
          position: "absolute",
          left: `calc(${LINE_PADDING}px + ${displayPos} * (100% - ${LINE_PADDING * 2}px))`,
          top: 60 - MARKER_SIZE / 2 - 4,
          width: MARKER_SIZE,
          height: MARKER_SIZE,
          transform: "translateX(-50%)",
          // Frog font sized at 0.6× MARKER_SIZE (was 0.95×) so it visually fits ON
          // a single lilypad instead of covering two. Container size stays for hit
          // target (≥44px tap target). Playwright finding 2026-04-26.
          fontSize: MARKER_SIZE * 0.6,
          textAlign: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
          cursor: locked ? "default" : "grab",
          userSelect: "none",
          pointerEvents: mode === "identify" ? "none" : "auto",
          filter: feedback === "incorrect"
            ? "grayscale(0.4) brightness(0.8)"
            : feedback === "correct"
              ? "drop-shadow(0 0 12px #fde68a)"
              : "drop-shadow(0 3px 4px rgba(0,0,0,0.4))",
          transition: feedback ? "filter 0.2s" : "none",
          animation: feedback === "incorrect"
            ? "frogShake 0.5s"
            : feedback === "correct"
              ? "frogLeap 1.1s ease-out"
              : "none",
          zIndex: 10,
        }}>
          🐸
        </div>

        {/* The Fish — lurks below the lilypad row. Swims back and forth idly.
            On Check + wrong: lunges UP to the frog's position (chomp).
            On Check + correct: stays low (frog leapt out of reach).
            Hidden in identify mode where the frog isn't a moving target. */}
        {mode === "drag" && (
          <div style={{
            position: "absolute",
            left: `calc(${LINE_PADDING}px + ${
              feedback === "incorrect" ? displayPos : 0.5
            } * (100% - ${LINE_PADDING * 2}px))`,
            top: 102,
            fontSize: 30,
            transform: "translateX(-50%)",
            pointerEvents: "none",
            filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.4))",
            animation: feedback === "incorrect"
              ? "fishLunge 1.4s ease-in"
              : "fishSwim 3.2s ease-in-out infinite",
            zIndex: 5,
          }}>
            🐟
          </div>
        )}

        {/* Animation keyframes (injected once per render — React dedupes) */}
        <style>{`
          @keyframes frogShake {
            0%, 100% { transform: translateX(-50%) rotate(0); }
            25% { transform: translateX(-50%) rotate(-12deg); }
            50% { transform: translateX(-50%) rotate(10deg); }
            75% { transform: translateX(-50%) rotate(-6deg); }
          }
          @keyframes frogLeap {
            0%   { transform: translateX(-50%) translateY(0)    scale(1); }
            30%  { transform: translateX(-50%) translateY(-58px) scale(1.15); }
            55%  { transform: translateX(-50%) translateY(-58px) scale(1.15); }
            100% { transform: translateX(-50%) translateY(0)    scale(1); }
          }
          @keyframes fishSwim {
            0%, 100% { transform: translateX(-50%) translateX(-28px) scaleX(1); }
            45%      { transform: translateX(-50%) translateX(28px)  scaleX(1); }
            50%      { transform: translateX(-50%) translateX(28px)  scaleX(-1); }
            95%      { transform: translateX(-50%) translateX(-28px) scaleX(-1); }
          }
          @keyframes fishLunge {
            0%   { transform: translateX(-50%) translateY(0); }
            30%  { transform: translateX(-50%) translateY(-72px); }
            55%  { transform: translateX(-50%) translateY(-72px); }
            100% { transform: translateX(-50%) translateY(0); }
          }
          @keyframes dropFall {
            from { top: -10%; }
            to   { top: 100%; }
          }
          @keyframes noticeIn {
            from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
            to   { opacity: 1; transform: translateX(-50%) translateY(0); }
          }
        `}</style>
      </div>

      {/* Action zone — varies by mode */}
      {mode === "drag" && (
        <div style={{ padding: "0 4px", marginTop: 8 }}>
          <GameBtn big color={feedback === "correct" ? "#22c55e" : feedback === "incorrect" ? "#ef4444" : "#0ea5e9"}
                   disabled={locked} onClick={submitDragAnswer}>
            {locked && feedback === "correct" ? "✓ Correct!"
             : locked && feedback === "incorrect" ? "✗ Almost! Try again"
             : "Check Answer"}
          </GameBtn>
        </div>
      )}

      {mode === "identify" && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {identifyChoices.map((f, i) => {
              const isThisCorrect = locked && feedback === "correct" &&
                                    (equivalent(f, targetFraction) ||
                                     Math.abs(fractionValue(f) - shownPosition) < 1e-9);
              return (
                <GameBtn key={i}
                  color={isThisCorrect ? "#22c55e" : "#1e40af"}
                  disabled={locked}
                  onClick={() => submitIdentifyAnswer(f)}>
                  <StackedFraction n={f.n} d={f.d} size={20} />
                </GameBtn>
              );
            })}
          </div>
          {locked && feedback === "incorrect" && (
            <div style={{ textAlign: "center", marginTop: 10, fontSize: 14, color: "#fde68a", fontWeight: 600 }}>
              Almost! Look where the dot is on the line.
            </div>
          )}
        </div>
      )}

      {/* Encouragement on correct */}
      {locked && feedback === "correct" && (
        <div style={{
          textAlign: "center", marginTop: 14, fontSize: 16, color: "#a7f3d0", fontWeight: 700,
        }}>
          Nice work! ✓
        </div>
      )}

      {/* Free-try banner — shows on the first wrong of session.
          Per persona-review (Yana): heart cascade is the painful part. One free entry. */}
      {locked && feedback === "incorrect" && usedFreeThisQuestion && (
        <div style={{
          textAlign: "center", marginTop: 14, fontSize: 15, color: "#fde68a", fontWeight: 700,
        }}>
          ✨ Free try! Heart safe — careful next time.
        </div>
      )}

      {/* Streak counter — appears at 3+ in a row. Per persona-review (cat): the
          single green sparkle is too brief; per Yana's competitive vibe streaks
          accumulate visible pride without amplifying losses. */}
      {streak >= 3 && !locked && (
        <div style={{
          textAlign: "center", marginTop: 12,
          fontSize: streak >= 10 ? 22 : streak >= 5 ? 18 : 15,
          fontWeight: 800,
          color: streak >= 10 ? "#fcd34d" : streak >= 5 ? "#fb923c" : "#f87171",
          textShadow: streak >= 10 ? "0 0 12px rgba(252,211,77,0.55)" : "none",
        }}>
          🔥 {streak} in a row!
        </div>
      )}

      {/* Exit */}
      <div style={{ marginTop: "auto", paddingTop: 20 }}>
        <GameBtn color="#1e293b" onClick={exitSession}>← Exit</GameBtn>
      </div>

      {/* Falling power-up drops — overlay layer. Two icons fall from the top with
          math expressions; kid taps the higher value for a buff (lower → debuff).
          Ignoring is safe: drops self-remove via onAnimationEnd if untapped. */}
      {drops.length > 0 && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          pointerEvents: "none", zIndex: 100,
        }}>
          {drops.map(drop => (
            <div key={drop.id}
              onClick={() => onTapDrop(drop)}
              onAnimationEnd={() => setDrops(prev => prev.filter(x => x.id !== drop.id))}
              style={{
                position: "absolute",
                left: `${drop.leftPct}%`,
                top: 0,
                transform: "translateX(-50%)",
                padding: "12px 18px",
                background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 60%, #b45309 100%)",
                border: "3px solid #fff",
                borderRadius: 18,
                boxShadow: "0 8px 22px rgba(0,0,0,0.45), inset 0 -2px 4px rgba(0,0,0,0.25)",
                fontSize: 24, fontWeight: 800, color: "#1e293b",
                fontFamily: "Georgia, serif",
                cursor: "pointer",
                pointerEvents: "auto",
                animation: `dropFall ${DROP_FALL_DURATION_MS}ms linear forwards`,
                userSelect: "none",
                whiteSpace: "nowrap",
              }}>
              {drop.expr}
            </div>
          ))}
        </div>
      )}

      {/* Toast banner — what just got applied. */}
      {powerupNotice && (
        <div style={{
          position: "fixed", top: 80, left: "50%",
          padding: "12px 22px", borderRadius: 16,
          background: powerupNotice.kind === "buff"
            ? "linear-gradient(135deg, rgba(34,197,94,0.97), rgba(21,128,61,0.97))"
            : "linear-gradient(135deg, rgba(239,68,68,0.97), rgba(153,27,27,0.97))",
          color: "#fff", fontSize: 15, fontWeight: 800,
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          zIndex: 200, pointerEvents: "none",
          animation: "noticeIn 0.3s ease-out",
          maxWidth: "92vw", textAlign: "center",
          transform: "translateX(-50%)",
        }}>
          {powerupNotice.text}
        </div>
      )}
    </div>
  );
}
