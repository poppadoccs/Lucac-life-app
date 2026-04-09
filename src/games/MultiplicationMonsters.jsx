// ─── MULTIPLICATION MONSTERS (EDU-02) ────────────────────────────────────────
// 12 worlds (one per times table 2×–12×).
// Each world: 10 monsters defeated by answering multiplication correctly.
// Boss fight at the end: 10 problems in 30 seconds.
// Worlds unlock when the previous table accuracy ≥ 60% OR was cleared this session.

import { useState, useEffect, useRef } from "react";
import { GameBtn, recordGameHistory, ageBandFromProfile } from "./_shared";
import { recordAttempt } from "../LearningEngine";

const WORLDS = [
  { table: 2,  emoji: "🟢", name: "Slime Swamp",    bg: "linear-gradient(135deg, #064e3b, #059669)", color: "#34d399" },
  { table: 3,  emoji: "👺", name: "Goblin Grove",   bg: "linear-gradient(135deg, #1a1a2e, #16213e)", color: "#60a5fa" },
  { table: 4,  emoji: "💀", name: "Skeleton Crypt", bg: "linear-gradient(135deg, #1f2937, #374151)", color: "#d1d5db" },
  { table: 5,  emoji: "🐲", name: "Dragon Peak",    bg: "linear-gradient(135deg, #7f1d1d, #ef4444)", color: "#fca5a5" },
  { table: 6,  emoji: "🧙", name: "Witch's Wood",   bg: "linear-gradient(135deg, #312e81, #7c3aed)", color: "#a78bfa" },
  { table: 7,  emoji: "🧛", name: "Vampire Vault",  bg: "linear-gradient(135deg, #4c0519, #be123c)", color: "#fb7185" },
  { table: 8,  emoji: "🐺", name: "Werewolf Wastes",bg: "linear-gradient(135deg, #1c1917, #78350f)", color: "#fbbf24" },
  { table: 9,  emoji: "🗿", name: "Giant's Gorge",  bg: "linear-gradient(135deg, #0f172a, #1e3a5f)", color: "#7dd3fc" },
  { table: 10, emoji: "⚔️", name: "Dark Citadel",   bg: "linear-gradient(135deg, #1e1b4b, #4338ca)", color: "#818cf8" },
  { table: 11, emoji: "👤", name: "Shadow Realm",   bg: "linear-gradient(135deg, #0f0f0f, #1f2937)", color: "#9ca3af" },
  { table: 12, emoji: "👑", name: "Final Fortress",  bg: "linear-gradient(135deg, #78350f, #d97706)", color: "#fcd34d" },
];
const MONSTERS_PER_WORLD = 10;
const BOSS_PROBLEMS     = 10;
const BOSS_SECONDS      = 30;

function makeProblem(table) {
  const b = Math.floor(Math.random() * 12) + 1;
  const answer = table * b;
  const question = `${table} × ${b} = ?`;
  const choices = [answer];
  while (choices.length < 4) {
    const delta = (Math.floor(Math.random() * 8) + 1) * (Math.random() > 0.5 ? 1 : -1);
    const wrong = answer + delta;
    if (wrong > 0 && !choices.includes(wrong)) choices.push(wrong);
  }
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { question, answer, choices };
}

function subjectAccuracy(attempts) {
  if (!attempts || typeof attempts !== "object") return null;
  const list = Object.values(attempts);
  if (list.length < 3) return null;
  return list.filter(a => a.correct).length / list.length;
}

export default function MultiplicationMonsters({
  profile, kidsData, fbSet, addStars, transitionTo, curriculum,
  learningStats = {},
}) {
  const isLuca = ageBandFromProfile(profile) === "luca";

  const [phase, setPhase] = useState("select"); // select | battle | boss | bossResult | complete | victory
  const [worldIdx, setWorldIdx] = useState(0);  // index into WORLDS
  const [monNum, setMonNum]     = useState(0);   // 0-9 current monster
  const [monHp, setMonHp]       = useState(3);
  const [problem, setProblem]   = useState(null);
  const [flash, setFlash]       = useState(null); // "hit" | "miss" | null
  const [stars, setStars]       = useState(0);
  const [score, setScore]       = useState(0);
  const [bossTime, setBossTime] = useState(BOSS_SECONDS);
  const [bossProbs, setBossProbs] = useState([]);
  const [bossIdx, setBossIdx]   = useState(0);
  const [bossCorrect, setBossCorrect] = useState(0);
  const [sessionWins, setSessionWins] = useState(new Set()); // world indices cleared this session

  const flashingRef  = useRef(false);
  const starsRef     = useRef(0);
  const scoreRef     = useRef(0);
  const startTimeRef = useRef(0);

  useEffect(() => { starsRef.current = stars; }, [stars]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  // ── Unlock logic ──────────────────────────────────────────────────────────
  function isUnlocked(idx) {
    if (idx === 0) return true; // 2× always open
    if (sessionWins.has(idx - 1)) return true;
    const prevTable = WORLDS[idx - 1].table;
    const prevStats = learningStats?.[profile?.name]?.[`multiplication_${prevTable}`]
                   || learningStats?.[profile?.name]?.multiplication;
    const acc = subjectAccuracy(prevStats);
    return acc !== null && acc >= 0.6;
  }

  // ── Start battle ──────────────────────────────────────────────────────────
  function enterWorld(idx) {
    setWorldIdx(idx);
    setMonNum(0);
    setMonHp(isLuca ? 2 : 3);
    const prob = makeProblem(WORLDS[idx].table);
    setProblem(prob);
    startTimeRef.current = Date.now();
    flashingRef.current = false;
    setPhase("battle");
  }

  // ── Answer a battle problem ───────────────────────────────────────────────
  function answerBattle(choice) {
    if (flashingRef.current || phase !== "battle") return;
    const correct = choice === problem.answer;
    const timeMs = Date.now() - startTimeRef.current;
    recordAttempt(fbSet, profile?.name, "multiplication", correct, timeMs);
    flashingRef.current = true;

    if (correct) {
      setFlash("hit");
      const newHp = monHp - 1;
      setMonHp(newHp);

      if (newHp <= 0) {
        // Monster defeated
        const nextMon = monNum + 1;
        if (nextMon >= MONSTERS_PER_WORLD) {
          // All monsters down — start boss fight
          setTimeout(() => {
            setFlash(null);
            flashingRef.current = false;
            startBoss();
          }, 500);
          return;
        }
        const newScore = scoreRef.current + 10;
        setScore(newScore); scoreRef.current = newScore;
        setTimeout(() => {
          setFlash(null);
          flashingRef.current = false;
          setMonNum(nextMon);
          setMonHp(isLuca ? 2 : 3);
          const prob = makeProblem(WORLDS[worldIdx].table);
          setProblem(prob);
          startTimeRef.current = Date.now();
        }, 500);
      } else {
        // Monster hit but still alive
        setTimeout(() => {
          setFlash(null);
          flashingRef.current = false;
          const prob = makeProblem(WORLDS[worldIdx].table);
          setProblem(prob);
          startTimeRef.current = Date.now();
        }, 400);
      }
    } else {
      setFlash("miss");
      setTimeout(() => {
        setFlash(null);
        flashingRef.current = false;
        // Same monster, new problem
        const prob = makeProblem(WORLDS[worldIdx].table);
        setProblem(prob);
        startTimeRef.current = Date.now();
      }, 600);
    }
  }

  // ── Boss fight ────────────────────────────────────────────────────────────
  function startBoss() {
    const probs = Array.from({ length: BOSS_PROBLEMS }, () => makeProblem(WORLDS[worldIdx].table));
    setBossProbs(probs);
    setBossIdx(0);
    setBossCorrect(0);
    setBossTime(BOSS_SECONDS);
    setPhase("boss");
  }

  // Boss countdown timer
  useEffect(() => {
    if (phase !== "boss") return;
    if (bossTime <= 0) {
      setBossCorrect(c => { endBoss(c); return c; });
      return;
    }
    const t = setTimeout(() => setBossTime(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, bossTime]);

  function answerBoss(choice) {
    if (phase !== "boss" || bossIdx >= BOSS_PROBLEMS) return;
    const correct = choice === bossProbs[bossIdx]?.answer;
    recordAttempt(fbSet, profile?.name, "multiplication", correct, 0);
    const newCorrect = bossCorrect + (correct ? 1 : 0);
    setBossCorrect(newCorrect);
    const nextIdx = bossIdx + 1;
    setBossIdx(nextIdx);
    if (nextIdx >= BOSS_PROBLEMS) {
      endBoss(newCorrect);
    }
  }

  function endBoss(correctCount) {
    const won = correctCount >= Math.ceil(BOSS_PROBLEMS * 0.6);
    if (won) {
      addStars?.(3);
      const newStars = starsRef.current + 3;
      setStars(newStars); starsRef.current = newStars;
      const newScore = scoreRef.current + correctCount * 15;
      setScore(newScore); scoreRef.current = newScore;

      setSessionWins(sw => new Set([...sw, worldIdx]));
      recordGameHistory(fbSet, profile, "monsters", scoreRef.current, starsRef.current, {
        world: WORLDS[worldIdx].table, bossScore: correctCount,
      });
      if (worldIdx >= WORLDS.length - 1) {
        setPhase("victory");
      } else {
        setPhase("complete");
      }
    } else {
      setPhase("bossResult");
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const world = WORLDS[worldIdx];
  const wrapBase = {
    minHeight: "100vh", fontFamily: "system-ui, sans-serif",
    display: "flex", flexDirection: "column", userSelect: "none",
  };

  // ── WORLD SELECT ──────────────────────────────────────────────────────────
  if (phase === "select") return (
    <div style={{ ...wrapBase, background: "#0f172a", padding: 16 }}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: "#fbbf24" }}>👾 Multiplication Monsters</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Pick a world to battle!</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {WORLDS.map((w, i) => {
          const unlocked = isUnlocked(i);
          return (
            <div key={i} onClick={() => unlocked && enterWorld(i)}
              style={{
                background: unlocked ? w.bg : "#1e293b",
                borderRadius: 14, padding: 14, textAlign: "center",
                cursor: unlocked ? "pointer" : "not-allowed",
                opacity: unlocked ? 1 : 0.5, minHeight: 100,
                border: `1px solid ${unlocked ? w.color + "44" : "transparent"}`,
              }}>
              <div style={{ fontSize: 28 }}>{unlocked ? w.emoji : "🔒"}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: unlocked ? "#fff" : "#6b7280", marginTop: 4 }}>
                {w.table}× Table
              </div>
              <div style={{ fontSize: 11, color: unlocked ? "rgba(255,255,255,0.6)" : "#4b5563" }}>
                {w.name}
              </div>
            </div>
          );
        })}
      </div>
      <GameBtn color="#475569" onClick={() => transitionTo("mini_games")}>← Back to Menu</GameBtn>
    </div>
  );

  // ── BATTLE ────────────────────────────────────────────────────────────────
  if (phase === "battle") return (
    <div style={{ ...wrapBase, background: world.bg, justifyContent: "space-between" }}>
      {/* HUD */}
      <div style={{ padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
          Monster {monNum + 1}/{MONSTERS_PER_WORLD}
        </div>
        <div style={{ fontWeight: 800, color: world.color }}>{world.table}× {world.name}</div>
        <div style={{ color: "#fbbf24", fontWeight: 700 }}>⭐ {stars}</div>
      </div>

      {/* Monster */}
      <div style={{ textAlign: "center", padding: 16 }}>
        <div style={{
          fontSize: 72,
          filter: flash === "hit" ? "brightness(2) drop-shadow(0 0 16px #22c55e)" : flash === "miss" ? "brightness(0.5)" : "none",
          transition: "filter 0.2s",
        }}>
          {world.emoji}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginTop: 6 }}>{world.name} Monster</div>
        {/* HP bar */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 8 }}>
          {Array.from({ length: isLuca ? 2 : 3 }, (_, i) => (
            <div key={i} style={{
              width: 24, height: 24, borderRadius: "50%", fontSize: 14,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {i < monHp ? "❤️" : "🖤"}
            </div>
          ))}
        </div>
      </div>

      {/* Problem */}
      <div style={{ textAlign: "center", padding: "0 16px" }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: "#fff", marginBottom: 16 }}>
          {problem?.question}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {(problem?.choices || []).map((v, i) => (
            <GameBtn key={i} color={["#1d4ed8","#065f46","#7f1d1d","#4c1d95"][i]}
              onClick={() => answerBattle(v)} disabled={!!flash}>
              {["A","B","C","D"][i]}) {v}
            </GameBtn>
          ))}
        </div>
      </div>

      <div style={{ padding: "12px 16px 20px" }}>
        <GameBtn color="#1e293b" onClick={() => setPhase("select")}>← Retreat</GameBtn>
      </div>
    </div>
  );

  // ── BOSS FIGHT ────────────────────────────────────────────────────────────
  if (phase === "boss") {
    const bossProblem = bossProbs[bossIdx];
    return (
      <div style={{ ...wrapBase, background: "linear-gradient(135deg, #1a0030, #4a0080)", justifyContent: "space-between" }}>
        <div style={{ padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 900, color: "#f59e0b", fontSize: 16 }}>⚔️ BOSS FIGHT</div>
          <div style={{ fontWeight: 800, color: bossTime <= 10 ? "#ef4444" : "#fff", fontSize: 20 }}>
            ⏱ {bossTime}s
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{bossCorrect}/{BOSS_PROBLEMS} ✓</div>
        </div>

        <div style={{ textAlign: "center", padding: 16 }}>
          <div style={{ fontSize: 64 }}>{world.emoji}</div>
          <div style={{ fontSize: 18, color: "#e879f9", fontWeight: 700 }}>{world.name} BOSS!</div>
        </div>

        <div style={{ padding: "0 16px" }}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textAlign: "center", marginBottom: 4 }}>
            Problem {Math.min(bossIdx + 1, BOSS_PROBLEMS)} of {BOSS_PROBLEMS}
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, color: "#fff", textAlign: "center", marginBottom: 12 }}>
            {bossProblem?.question}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {(bossProblem?.choices || []).map((v, i) => (
              <GameBtn key={i} color="#6d28d9" onClick={() => answerBoss(v)}>
                {["A","B","C","D"][i]}) {v}
              </GameBtn>
            ))}
          </div>
        </div>
        <div style={{ height: 24 }} />
      </div>
    );
  }

  // ── BOSS RESULT (lost) ────────────────────────────────────────────────────
  if (phase === "bossResult") return (
    <div style={{ ...wrapBase, background: world.bg, alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", padding: 32 }}>
        <div style={{ fontSize: 56 }}>💪</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#fbbf24", marginTop: 8 }}>So close! Keep training.</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginTop: 4, marginBottom: 24 }}>
          Got {bossCorrect}/{BOSS_PROBLEMS} — need {Math.ceil(BOSS_PROBLEMS * 0.6)} to win
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 240, margin: "0 auto" }}>
          <GameBtn big onClick={() => enterWorld(worldIdx)} color="#7c3aed">Try Boss Again</GameBtn>
          <GameBtn color="#475569" onClick={() => setPhase("select")}>← World Select</GameBtn>
        </div>
      </div>
    </div>
  );

  // ── WORLD COMPLETE ────────────────────────────────────────────────────────
  if (phase === "complete") return (
    <div style={{ ...wrapBase, background: world.bg, alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", padding: 32 }}>
        <div style={{ fontSize: 56 }}>🎉</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#fbbf24" }}>{world.name} Cleared!</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginTop: 4, marginBottom: 24 }}>
          ⭐ {stars} stars · Score: {score}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 240, margin: "0 auto" }}>
          {worldIdx < WORLDS.length - 1 && (
            <GameBtn big onClick={() => enterWorld(worldIdx + 1)} color="#22c55e">
              Next: {WORLDS[worldIdx + 1].table}× {WORLDS[worldIdx + 1].emoji}
            </GameBtn>
          )}
          <GameBtn color="#475569" onClick={() => setPhase("select")}>World Select</GameBtn>
          <GameBtn color="#1e293b" onClick={() => transitionTo("mini_games")}>← Menu</GameBtn>
        </div>
      </div>
    </div>
  );

  // ── FULL VICTORY ──────────────────────────────────────────────────────────
  if (phase === "victory") return (
    <div style={{ ...wrapBase, background: "linear-gradient(135deg, #78350f, #d97706)", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", padding: 32 }}>
        <div style={{ fontSize: 64 }}>👑</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#fcd34d" }}>ALL MONSTERS DEFEATED!</div>
        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.8)", marginTop: 8 }}>
          Multiplication MASTER!
        </div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginTop: 4, marginBottom: 24 }}>
          ⭐ {stars} stars · Score: {score}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 240, margin: "0 auto" }}>
          <GameBtn big onClick={() => { setSessionWins(new Set()); setPhase("select"); }} color="#f59e0b">
            Play Again
          </GameBtn>
          <GameBtn color="#475569" onClick={() => transitionTo("mini_games")}>← Menu</GameBtn>
        </div>
      </div>
    </div>
  );

  return null;
}
