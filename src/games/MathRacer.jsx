// ─── MATH RACER (EDU-02) ─────────────────────────────────────────────────────
// 4-lane falling-answer game. Multiplication times tables from 2× to 12×.
// Player moves a lane catcher left/right; correct answer in the right lane = score.
// Integrates with LearningEngine.recordAttempt for adaptive learning.

import { useState, useEffect, useRef } from "react";
import { GameBtn, recordGameHistory, ageBandFromProfile } from "./_shared";
import { recordAttempt } from "../LearningEngine";

const LANE_COLORS = ["#60a5fa", "#34d399", "#f87171", "#a78bfa"];

// Generate a multiplication problem for the given times table
function makeRacerProblem(table) {
  const b = Math.floor(Math.random() * 12) + 1;
  const answer = table * b;
  const question = `${table} × ${b} = ?`;
  const choices = [answer];
  while (choices.length < 4) {
    const delta = (Math.floor(Math.random() * 6) + 1) * (Math.random() > 0.5 ? 1 : -1);
    const wrong = answer + delta;
    if (wrong > 0 && !choices.includes(wrong)) choices.push(wrong);
  }
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { question, answer, choices };
}

export default function MathRacer({ profile, kidsData, fbSet, addStars, transitionTo, curriculum }) {
  const isLuca = ageBandFromProfile(profile) === "luca";
  const startTable = isLuca ? 2 : 3;
  const CORRECT_PER_LEVEL = 10;
  const SPEED = isLuca ? 1.2 : 2.0; // fallerY units per 40ms tick

  const [phase, setPhase] = useState("idle"); // idle | playing | gameover | victory
  const [table, setTable] = useState(startTable);
  const [problem, setProblem] = useState(null);
  const [catcher, setCatcher] = useState(1);
  const [fallerY, setFallerY] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [levelCorrect, setLevelCorrect] = useState(0);
  const [flash, setFlash] = useState(null); // "hit" | "miss" | null
  const [stars, setStars] = useState(0);
  const [hint, setHint] = useState(false);

  // Refs — needed by interval callbacks to avoid stale closures
  const catcherRef      = useRef(1);
  const problemRef      = useRef(null);
  const livesRef        = useRef(3);
  const levelCorrectRef = useRef(0);
  const tableRef        = useRef(startTable);
  const starsRef        = useRef(0);
  const scoreRef        = useRef(0);
  const flashingRef     = useRef(false); // block double-evaluate during flash
  const startTimeRef    = useRef(0);

  useEffect(() => { catcherRef.current = catcher; }, [catcher]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { starsRef.current = stars; }, [stars]);

  // ── startRound — always has latest state via ref pattern ──────────────────
  const startRoundRef = useRef(null);
  startRoundRef.current = function startRound(t) {
    const prob = makeRacerProblem(t ?? tableRef.current);
    setProblem(prob);
    problemRef.current = prob;
    setFallerY(0);
    setHint(false);
    flashingRef.current = false;
    startTimeRef.current = Date.now();
  };

  // ── evaluate — called when faller reaches bottom ──────────────────────────
  const evaluateRef = useRef(null);
  evaluateRef.current = function evaluate() {
    if (flashingRef.current) return;
    const prob = problemRef.current;
    if (!prob) return;

    const correctLane = prob.choices.indexOf(prob.answer);
    const timeMs = Date.now() - startTimeRef.current;
    const correct = catcherRef.current === correctLane;

    recordAttempt(fbSet, profile?.name, "multiplication", correct, timeMs);
    flashingRef.current = true;

    if (correct) {
      setFlash("hit");
      const newScore = scoreRef.current + 10;
      setScore(newScore);
      scoreRef.current = newScore;

      const newLC = levelCorrectRef.current + 1;
      levelCorrectRef.current = newLC;
      setLevelCorrect(newLC);

      // Star every 3 correct
      if (newLC % 3 === 0) {
        addStars?.(1);
        const newStars = starsRef.current + 1;
        setStars(newStars);
        starsRef.current = newStars;
      }

      // Level up after CORRECT_PER_LEVEL correct on this table
      if (newLC >= CORRECT_PER_LEVEL) {
        const nextTable = tableRef.current + 1;
        if (nextTable > 12) {
          recordGameHistory(fbSet, profile, "mathracer", scoreRef.current, starsRef.current, { table: tableRef.current });
          setTimeout(() => { setPhase("victory"); }, 700);
          return;
        }
        tableRef.current = nextTable;
        levelCorrectRef.current = 0;
        setTable(nextTable);
        setLevelCorrect(0);
      }

      setTimeout(() => { setFlash(null); startRoundRef.current(tableRef.current); }, 600);
    } else {
      setFlash("miss");
      setHint(true);
      const newLives = livesRef.current - 1;
      livesRef.current = newLives;
      setLives(newLives);

      if (newLives <= 0) {
        recordGameHistory(fbSet, profile, "mathracer", scoreRef.current, starsRef.current, { table: tableRef.current });
        setTimeout(() => { setPhase("gameover"); }, 700);
        return;
      }
      setTimeout(() => { setFlash(null); startRoundRef.current(tableRef.current); }, 1000);
    }
  };

  // ── Faller animation — ticks every 40ms, restarts when problem changes ────
  useEffect(() => {
    if (phase !== "playing" || !problem) return;
    const iv = setInterval(() => {
      setFallerY(y => {
        const next = y + SPEED;
        if (next >= 100) {
          evaluateRef.current?.();
          return 100; // Hold at 100 until startRound resets it via setProblem
        }
        return next;
      });
    }, 40);
    return () => clearInterval(iv);
  // problem.question changes per round; SPEED and phase stable during play
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, problem?.question]);

  // ── Keyboard controls ─────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    function onKey(e) {
      if (e.key === "ArrowLeft")  moveCatcher(-1);
      if (e.key === "ArrowRight") moveCatcher(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  function moveCatcher(dir) {
    setCatcher(l => {
      const v = Math.max(0, Math.min(3, l + dir));
      catcherRef.current = v;
      return v;
    });
  }

  function startGame() {
    livesRef.current = 3;
    levelCorrectRef.current = 0;
    tableRef.current = startTable;
    scoreRef.current = 0;
    starsRef.current = 0;
    setLives(3); setLevelCorrect(0); setTable(startTable);
    setScore(0); setStars(0); setCatcher(1); catcherRef.current = 1;
    setPhase("playing");
    startRoundRef.current(startTable);
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const wrap = {
    minHeight: "100vh", background: "linear-gradient(180deg, #0f172a 0%, #1e3a5f 100%)",
    display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif",
    overflow: "hidden", position: "relative", userSelect: "none",
  };

  if (phase === "idle") return (
    <div style={wrap}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
        <div style={{ fontSize: 56 }}>⚡</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: "#60a5fa" }}>Math Racer</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", textAlign: "center", maxWidth: 280 }}>
          Numbers fall — catch the correct answer in your lane! Use Left / Right to steer.
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
          Starting at {startTable}× table · {CORRECT_PER_LEVEL} correct per level
        </div>
        <div style={{ marginTop: 16, width: "100%", maxWidth: 240, display: "flex", flexDirection: "column", gap: 10 }}>
          <GameBtn big onClick={startGame} color="#3b82f6">▶ Start Racing</GameBtn>
          <GameBtn color="#475569" onClick={() => transitionTo("mini_games")}>← Back</GameBtn>
        </div>
      </div>
    </div>
  );

  if (phase === "gameover") return (
    <div style={wrap}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
        <div style={{ fontSize: 48 }}>💥</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#ef4444" }}>Game Over!</div>
        <div style={{ fontSize: 18, color: "#fbbf24" }}>Score: {score}</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>⭐ {stars} stars earned</div>
        <div style={{ marginTop: 16, width: "100%", maxWidth: 240, display: "flex", flexDirection: "column", gap: 10 }}>
          <GameBtn big onClick={startGame} color="#3b82f6">Try Again</GameBtn>
          <GameBtn color="#475569" onClick={() => transitionTo("mini_games")}>← Back</GameBtn>
        </div>
      </div>
    </div>
  );

  if (phase === "victory") return (
    <div style={wrap}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
        <div style={{ fontSize: 56 }}>🏆</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#fbbf24" }}>Tables Mastered!</div>
        <div style={{ fontSize: 18, color: "#60a5fa" }}>Score: {score}</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>⭐ {stars} stars earned</div>
        <div style={{ marginTop: 16, width: "100%", maxWidth: 240, display: "flex", flexDirection: "column", gap: 10 }}>
          <GameBtn big onClick={startGame} color="#22c55e">Play Again</GameBtn>
          <GameBtn color="#475569" onClick={() => transitionTo("mini_games")}>← Back</GameBtn>
        </div>
      </div>
    </div>
  );

  // ── Playing screen ────────────────────────────────────────────────────────
  return (
    <div style={{ ...wrap, justifyContent: "space-between" }}>
      {/* HUD */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px" }}>
        <div style={{ color: "#fbbf24", fontWeight: 700 }}>⭐ {stars}</div>
        <div style={{ color: "#fff", fontWeight: 800 }}>{table}× Table · {levelCorrect}/{CORRECT_PER_LEVEL}</div>
        <div style={{ fontSize: 18 }}>{"❤️".repeat(Math.max(0, lives))}</div>
      </div>

      {/* Problem */}
      <div style={{ textAlign: "center", padding: "0 16px" }}>
        <div style={{
          fontSize: 38, fontWeight: 900, color: "#fff",
          textShadow: flash === "hit" ? "0 0 24px #22c55e" : flash === "miss" ? "0 0 24px #ef4444" : "none",
          transition: "text-shadow 0.2s",
          minHeight: 50,
        }}>
          {problem?.question}
        </div>
        {hint && problem && (
          <div style={{ fontSize: 13, color: "#fbbf24", marginTop: 4 }}>
            Correct answer: {problem.answer}
          </div>
        )}
      </div>

      {/* Lane area */}
      <div style={{ position: "relative", flex: 1, display: "flex", minHeight: 200, maxHeight: 280, overflow: "hidden" }}>
        {(problem?.choices || [0, 0, 0, 0]).map((val, i) => (
          <div key={i} style={{
            flex: 1, position: "relative", display: "flex", flexDirection: "column", alignItems: "center",
            borderRight: i < 3 ? "1px solid rgba(255,255,255,0.08)" : "none",
            background: i === catcher ? `${LANE_COLORS[i]}18` : "transparent",
            transition: "background 0.15s",
          }}>
            {/* Lane letter label */}
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontWeight: 700, marginTop: 4 }}>
              {["A","B","C","D"][i]}
            </div>
            {/* Falling number */}
            <div style={{
              position: "absolute", top: `${fallerY}%`, transform: "translateY(-50%)",
              fontSize: 24, fontWeight: 800,
              color: LANE_COLORS[i],
              textShadow: `0 0 8px ${LANE_COLORS[i]}88`,
            }}>
              {val}
            </div>
          </div>
        ))}

        {/* Catcher bar at bottom */}
        <div style={{
          position: "absolute", bottom: 10,
          left: `${(catcher / 4) * 100}%`, width: "25%",
          height: 14, borderRadius: 7,
          background: LANE_COLORS[catcher],
          boxShadow: `0 0 14px ${LANE_COLORS[catcher]}`,
          transition: "left 0.08s ease, background 0.15s",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>{profile?.emoji || "🚗"}</span>
        </div>

        {/* Flash overlay */}
        {flash && (
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: flash === "hit" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 44,
          }}>
            {flash === "hit" ? "✅" : "❌"}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ padding: "8px 16px 16px", boxSizing: "border-box" }}>
        <div style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
          Score: {score}
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
          <GameBtn color="#1e40af" onClick={() => moveCatcher(-1)} big style={{ flex: 1 }}>◀ Left</GameBtn>
          <GameBtn color="#1e40af" onClick={() => moveCatcher(1)} big style={{ flex: 1 }}>Right ▶</GameBtn>
        </div>
        <GameBtn color="#1e293b" onClick={() => transitionTo("mini_games")}>← Menu</GameBtn>
      </div>
    </div>
  );
}
