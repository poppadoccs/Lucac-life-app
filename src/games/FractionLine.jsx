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
const TOLERANCE = 0.05; // 5% of line length
const LINE_PADDING = 20; // px inset on each end for the marker

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
function pickFraction(level, isLuca) {
  // Luca never auto-advances; always pull from L1 pool.
  const effectiveLevel = isLuca ? 1 : level;
  const pool = [];
  for (let i = 0; i < effectiveLevel; i++) {
    pool.push(...FRACTION_SETS[i].fractions);
  }
  return pool[Math.floor(Math.random() * pool.length)];
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
  const [phase, setPhase] = useState("intro"); // intro | play | complete | victory
  const [level, setLevel] = useState(1);
  const [levelCorrect, setLevelCorrect] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);

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

  useEffect(() => { markerPosRef.current = markerPos; }, [markerPos]);

  // ── New question setup ────────────────────────────────────────────────────
  function newQuestion(currentLevel) {
    const f = pickFraction(currentLevel, isLuca);
    setTargetFraction(f);
    setMarkerPos(0.5);
    markerPosRef.current = 0.5;
    setFeedback(null);
    setShowTruth(false);
    setLocked(false);

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
    starsEarnedRef.current = 0;
    sessionEndedRef.current = false;
    newQuestion(1);
    setPhase("play");
  }

  // ── End session → stars + history (called once) ───────────────────────────
  function endSession(victoryBonus = false) {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    const baseStars = 3;
    const bonusStars = victoryBonus ? 2 : 0;
    const total = baseStars + bonusStars;
    starsEarnedRef.current = total;
    addStars?.(total, victoryBonus
      ? "FractionLine full victory — all 3 levels"
      : "FractionLine session complete");
    recordGameHistory(fbSet, profile, "fraction_line", totalCorrect, total, {
      level,
      questionsAnswered,
      victory: victoryBonus,
    });
  }

  // ── Answer submission (drag mode) ─────────────────────────────────────────
  function submitDragAnswer() {
    if (locked || mode !== "drag") return;
    const truePos = fractionValue(targetFraction);
    const kidPos = markerPosRef.current;
    const diff = Math.abs(kidPos - truePos);
    const correct = diff < TOLERANCE;
    finishQuestion(correct);
  }

  // ── Answer submission (identify mode) ─────────────────────────────────────
  function submitIdentifyAnswer(choice) {
    if (locked || mode !== "identify") return;
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
      setLevelCorrect(newLevelCorrect);
      setTotalCorrect(newTotal);

      // Luca: never auto-advance. All 3 kids eventually, but Luca stays on L1 forever.
      const canAdvance = !isLuca;

      setTimeout(() => {
        if (newLevelCorrect >= QUESTIONS_PER_LEVEL) {
          // Level clear
          if (level >= 3 || !canAdvance) {
            // Full victory (or Luca completing an L1 batch → count as complete)
            if (level >= 3) {
              endSession(true);
              setPhase("victory");
            } else {
              // Luca hit 8 in L1 → gentle complete screen, no advance
              endSession(false);
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
      }, 900);
    } else {
      // Wrong: gentle shake, show truth, auto-retry same question after a beat
      setTimeout(() => {
        setFeedback(null);
        setShowTruth(false);
        setLocked(false);
        // Keep same targetFraction so kid can try again — reset marker center.
        setMarkerPos(0.5);
        markerPosRef.current = 0.5;
        questionStartRef.current = Date.now();
      }, 1500);
    }
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
      endSession(false);
    }
    transitionTo("mini_games");
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const wrapBase = {
    minHeight: "100vh", fontFamily: "system-ui, sans-serif",
    display: "flex", flexDirection: "column", userSelect: "none",
    touchAction: "none", // prevent browser scroll-during-drag
    background: "linear-gradient(135deg, #0c4a6e, #155e75)",
    color: "#fff",
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

  // ─── PLAY PHASE ───────────────────────────────────────────────────────────
  const truePos = fractionValue(targetFraction); // deterministic JS truth
  const displayPos = mode === "identify" ? shownPosition : markerPos;

  // Text for the current question, guarded by verifyMath even though no arithmetic
  // is displayed — defense in depth per CLAUDE.md 5×10=40 lesson.
  const levelLabel = verifyMath(`Level ${level} of 3`);

  return (
    <div style={{ ...wrapBase, padding: 16 }}>
      {/* HUD */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
          {isLuca ? "Level 1" : levelLabel}
        </div>
        <div style={{ fontSize: 13, color: "#fde68a", fontWeight: 700 }}>
          {levelCorrect}/{QUESTIONS_PER_LEVEL}
        </div>
      </div>

      {/* Prompt */}
      <div style={{ textAlign: "center", marginTop: 12, marginBottom: 18 }}>
        {mode === "drag" ? (
          <>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
              Drag the marker to:
            </div>
            <div style={{ display: "inline-block" }}>
              <StackedFraction n={targetFraction.n} d={targetFraction.d} size={42} />
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>
              What fraction is shown?
            </div>
          </>
        )}
      </div>

      {/* Number line */}
      <div
        ref={lineRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleLineTap}
        style={{
          position: "relative",
          height: 120,
          margin: "20px 0",
          padding: `0 ${LINE_PADDING}px`,
          touchAction: "none",
          cursor: mode === "drag" && !locked ? "pointer" : "default",
        }}
      >
        {/* Line */}
        <div style={{
          position: "absolute",
          top: 60, left: LINE_PADDING, right: LINE_PADDING,
          height: 6, background: "#7dd3fc", borderRadius: 3,
          boxShadow: "0 0 12px rgba(125,211,252,0.5)",
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

        {/* Subtle mid tick */}
        <div style={{
          position: "absolute", left: `calc(50% )`, top: 54, width: 2, height: 18,
          background: "rgba(255,255,255,0.25)", borderRadius: 1,
          transform: "translateX(-1px)",
        }} />

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

        {/* Draggable / displayed marker */}
        <div style={{
          position: "absolute",
          left: `calc(${LINE_PADDING}px + ${displayPos} * (100% - ${LINE_PADDING * 2}px))`,
          top: 63 - MARKER_SIZE / 2,
          width: MARKER_SIZE, height: MARKER_SIZE,
          transform: "translateX(-50%)",
          borderRadius: "50%",
          background: feedback === "correct" ? "#22c55e"
                    : feedback === "incorrect" ? "#ef4444"
                    : "#fbbf24",
          border: "4px solid #fff",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: MARKER_SIZE * 0.38, fontWeight: 900, color: "#1e293b",
          transition: feedback ? "background 0.2s, transform 0.2s" : "none",
          animation: feedback === "incorrect" ? "fractionShake 0.5s" : feedback === "correct" ? "fractionBounce 0.5s" : "none",
          pointerEvents: mode === "identify" ? "none" : "auto",
        }}>
          {feedback === "correct" ? "✓" : feedback === "incorrect" ? "✗" : "●"}
        </div>

        {/* Shake + bounce animations (inject once) */}
        <style>{`
          @keyframes fractionShake {
            0%, 100% { transform: translateX(-50%) translateX(0); }
            20% { transform: translateX(-50%) translateX(-10px); }
            40% { transform: translateX(-50%) translateX(10px); }
            60% { transform: translateX(-50%) translateX(-6px); }
            80% { transform: translateX(-50%) translateX(6px); }
          }
          @keyframes fractionBounce {
            0%, 100% { transform: translateX(-50%) scale(1); }
            50% { transform: translateX(-50%) scale(1.2); }
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

      {/* Exit */}
      <div style={{ marginTop: "auto", paddingTop: 20 }}>
        <GameBtn color="#1e293b" onClick={exitSession}>← Exit</GameBtn>
      </div>
    </div>
  );
}
