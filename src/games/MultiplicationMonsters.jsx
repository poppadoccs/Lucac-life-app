// ─── MATH MONSTERS (EDU-02, S04-A1) ──────────────────────────────────────────
// Merged multiplication + division (fact families) monster battler.
// 11 worlds, one per times table, ordered by STRATEGY not sequentially:
//   x2 (doubles) → x4 → x8 → x10 (anchor) → x5 → x9 (trick) → x3 → x6 → x11 → x7 → x12
// Each world: 10 monsters + boss fight. Problems mix × and ÷ as fact families.
// After correct answers there's a 20% chance of a fact-family hint
// (e.g. solved 12÷4=3 → "Did you know? 4 × 3 = 12 too!").
// Worlds unlock when previous table accuracy ≥ 60% OR cleared this session.
// NOTE: File name stays MultiplicationMonsters.jsx — RPGCore imports by path.
//       Wave 3 (W1) will rename the file and update the import.

import { useState, useEffect, useRef } from "react";
import { GameBtn, recordGameHistory, ageBandFromProfile } from "./_shared";
import { recordAttempt, nextProblem } from "../LearningEngine";
import { verifyMath } from "../utils";

// Strategy-first ordering. Each world keeps its original art/theme.
const WORLDS = [
  { table: 2,  emoji: "🟢", name: "Slime Swamp",     bg: "linear-gradient(135deg, #064e3b, #059669)", color: "#34d399" },
  { table: 4,  emoji: "💀", name: "Skeleton Crypt",  bg: "linear-gradient(135deg, #1f2937, #374151)", color: "#d1d5db" },
  { table: 8,  emoji: "🐺", name: "Werewolf Wastes", bg: "linear-gradient(135deg, #1c1917, #78350f)", color: "#fbbf24" },
  { table: 10, emoji: "⚔️", name: "Dark Citadel",    bg: "linear-gradient(135deg, #1e1b4b, #4338ca)", color: "#818cf8" },
  { table: 5,  emoji: "🐲", name: "Dragon Peak",     bg: "linear-gradient(135deg, #7f1d1d, #ef4444)", color: "#fca5a5" },
  { table: 9,  emoji: "🗿", name: "Giant's Gorge",   bg: "linear-gradient(135deg, #0f172a, #1e3a5f)", color: "#7dd3fc" },
  { table: 3,  emoji: "👺", name: "Goblin Grove",    bg: "linear-gradient(135deg, #1a1a2e, #16213e)", color: "#60a5fa" },
  { table: 6,  emoji: "🧙", name: "Witch's Wood",    bg: "linear-gradient(135deg, #312e81, #7c3aed)", color: "#a78bfa" },
  { table: 11, emoji: "👤", name: "Shadow Realm",    bg: "linear-gradient(135deg, #0f0f0f, #1f2937)", color: "#9ca3af" },
  { table: 7,  emoji: "🧛", name: "Vampire Vault",   bg: "linear-gradient(135deg, #4c0519, #be123c)", color: "#fb7185" },
  { table: 12, emoji: "👑", name: "Final Fortress",  bg: "linear-gradient(135deg, #78350f, #d97706)", color: "#fcd34d" },
];
const MONSTERS_PER_WORLD = 10;
const BOSS_PROBLEMS      = 10;
const BOSS_SECONDS       = 30;

// makeProblem — generates a multiplication OR division problem for this table.
// curriculum.activeSubjects weights the mix:
//   - "multiplication" only → 80/20 favor multiplication
//   - "division" only       → 80/20 favor division
//   - both or neither       → 50/50
function makeProblem(table, curriculum) {
  const active = Array.isArray(curriculum?.activeSubjects) ? curriculum.activeSubjects : [];
  const hasMult = active.includes("multiplication");
  const hasDiv = active.includes("division");

  let multBias = 0.5;
  if (hasMult && !hasDiv) multBias = 0.8;
  else if (hasDiv && !hasMult) multBias = 0.2;

  const isMultiplication = Math.random() < multBias;
  const b = Math.floor(Math.random() * 12) + 1;

  let question, answer, subjectId;
  if (isMultiplication) {
    answer = table * b;
    question = `${table} × ${b} = ?`;
    subjectId = "multiplication";
  } else {
    // Division: (table * b) ÷ table = b. Uses the fact-family partner so the
    // answer is always a clean whole number the kid can solve from their table.
    const dividend = table * b;
    answer = b;
    question = `${dividend} ÷ ${table} = ?`;
    subjectId = "division";
  }

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
  return { question, answer, choices, subjectId, table, operand: b, isMultiplication };
}

// Build the fact-family partner sentence for a just-solved problem.
// e.g. solved "12 ÷ 4 = 3" → "Did you know? 4 × 3 = 12 too!"
//      solved "4 × 3 = 12" → "Did you know? 12 ÷ 4 = 3 too!"
// Runs through verifyMath so a JS check confirms correctness before display.
function factFamilyHint(problem) {
  if (!problem || typeof problem.table !== "number" || typeof problem.operand !== "number") return null;
  const { table, operand, isMultiplication } = problem;
  const raw = isMultiplication
    ? `Did you know? ${table * operand} ÷ ${table} = ${operand} too!`
    : `Did you know? ${table} × ${operand} = ${table * operand} too!`;
  return verifyMath(raw);
}

function subjectAccuracy(attempts) {
  if (!attempts || typeof attempts !== "object") return null;
  const list = Object.values(attempts);
  if (list.length < 3) return null;
  return list.filter(a => a.correct).length / list.length;
}

export default function MathMonsters({
  profile, kidsData, fbSet, addStars, transitionTo, curriculum,
  learningStats = {},
}) {
  const isLuca = ageBandFromProfile(profile) === "luca";

  const [phase, setPhase] = useState("select"); // select | battle | boss | bossResult | complete | victory
  const [worldIdx, setWorldIdx] = useState(0);
  const [monNum, setMonNum]     = useState(0);
  const [monHp, setMonHp]       = useState(3);
  const [problem, setProblem]   = useState(null);
  const [flash, setFlash]       = useState(null); // "hit" | "miss" | null
  const [stars, setStars]       = useState(0);
  const [score, setScore]       = useState(0);
  const [bossTime, setBossTime] = useState(BOSS_SECONDS);
  const [bossProbs, setBossProbs] = useState([]);
  const [bossIdx, setBossIdx]   = useState(0);
  const [bossCorrect, setBossCorrect] = useState(0);
  const [sessionWins, setSessionWins] = useState(new Set());
  const [hint, setHint]         = useState(null); // short fact-family hint string

  const flashingRef     = useRef(false);
  const starsRef        = useRef(0);
  const scoreRef        = useRef(0);
  const startTimeRef    = useRef(0);
  const bossCorrectRef  = useRef(0);
  const bossEndedRef    = useRef(false);
  const battleCountRef  = useRef(0); // counts problems served in current world (for every-3rd adaptive pull)

  useEffect(() => { starsRef.current = stars; }, [stars]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { bossCorrectRef.current = bossCorrect; }, [bossCorrect]);

  // hasAdaptiveData — true when this kid has any recorded attempts.
  function hasAdaptiveData() {
    const kid = profile?.name;
    if (!kid || !learningStats?.[kid]) return false;
    return Object.keys(learningStats[kid]).length > 0;
  }

  // pickProblem — every 3rd problem use LearningEngine.nextProblem() to surface
  // weak areas (when we have data); otherwise fall back to table-specific makeProblem.
  // Falls back gracefully if nextProblem returns something unusable (e.g. fractions
  // placeholder, per _shared.js safety note).
  function pickProblem(table) {
    battleCountRef.current += 1;
    const useAdaptive = hasAdaptiveData() && battleCountRef.current % 3 === 0;
    if (useAdaptive) {
      const p = nextProblem(curriculum, learningStats, profile?.name);
      if (p && typeof p.answer === "number" && Array.isArray(p.choices) && p.choices.length >= 2) {
        // Normalize shape. Adaptive problems don't know the table, mark isMultiplication
        // from subjectId so we skip the fact-family hint if subject isn't ×/÷.
        return {
          question: p.question?.endsWith("=") || p.question?.endsWith("?") ? p.question : `${p.question} = ?`,
          answer: p.answer,
          choices: p.choices,
          subjectId: p.subjectId || "multiplication",
          table: null,
          operand: null,
          isMultiplication: p.subjectId === "multiplication",
        };
      }
    }
    return makeProblem(table, curriculum);
  }

  // ── Unlock logic ──────────────────────────────────────────────────────────
  function isUnlocked(idx) {
    if (idx === 0) return true;
    if (sessionWins.has(idx - 1)) return true;
    const prevTable = WORLDS[idx - 1].table;
    const kid = profile?.name;
    const stats = learningStats?.[kid];
    // Unlock if either mult or div for the previous table shows ≥ 60% accuracy.
    const multAcc = subjectAccuracy(stats?.[`multiplication_${prevTable}`])
                 ?? subjectAccuracy(stats?.multiplication);
    const divAcc  = subjectAccuracy(stats?.[`division_${prevTable}`])
                 ?? subjectAccuracy(stats?.division);
    const best = Math.max(multAcc ?? 0, divAcc ?? 0);
    return best >= 0.6;
  }

  // ── Start battle ──────────────────────────────────────────────────────────
  function enterWorld(idx) {
    setWorldIdx(idx);
    setMonNum(0);
    setMonHp(isLuca ? 2 : 3);
    battleCountRef.current = 0;
    const prob = pickProblem(WORLDS[idx].table);
    setProblem(prob);
    setHint(null);
    startTimeRef.current = Date.now();
    flashingRef.current = false;
    setPhase("battle");
  }

  // ── Answer a battle problem ───────────────────────────────────────────────
  function answerBattle(choice) {
    if (flashingRef.current || phase !== "battle") return;
    const correct = choice === problem.answer;
    const timeMs = Date.now() - startTimeRef.current;
    const subjectForRecord = problem.isMultiplication ? "multiplication" : "division";
    recordAttempt(fbSet, profile?.name, subjectForRecord, correct, timeMs);
    flashingRef.current = true;

    if (correct) {
      setFlash("hit");

      // 20% chance of fact-family hint — only when we have a real table/operand
      // from the local makeProblem (adaptive problems may not have them).
      if (problem.table != null && problem.operand != null && Math.random() < 0.2) {
        const hintText = factFamilyHint(problem);
        if (hintText) {
          setHint(hintText);
          setTimeout(() => setHint(null), 2000);
        }
      }

      const newHp = monHp - 1;
      setMonHp(newHp);

      if (newHp <= 0) {
        const nextMon = monNum + 1;
        if (nextMon >= MONSTERS_PER_WORLD) {
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
          const prob = pickProblem(WORLDS[worldIdx].table);
          setProblem(prob);
          startTimeRef.current = Date.now();
        }, 500);
      } else {
        setTimeout(() => {
          setFlash(null);
          flashingRef.current = false;
          const prob = pickProblem(WORLDS[worldIdx].table);
          setProblem(prob);
          startTimeRef.current = Date.now();
        }, 400);
      }
    } else {
      // Neutral "Try again" feedback — no shame, no punishment.
      setFlash("miss");
      setTimeout(() => {
        setFlash(null);
        flashingRef.current = false;
        const prob = pickProblem(WORLDS[worldIdx].table);
        setProblem(prob);
        startTimeRef.current = Date.now();
      }, 600);
    }
  }

  // ── Boss fight ────────────────────────────────────────────────────────────
  function startBoss() {
    const probs = Array.from({ length: BOSS_PROBLEMS }, () => makeProblem(WORLDS[worldIdx].table, curriculum));
    setBossProbs(probs);
    setBossIdx(0);
    setBossCorrect(0);
    bossCorrectRef.current = 0;
    bossEndedRef.current = false;
    setBossTime(BOSS_SECONDS);
    setPhase("boss");
  }

  useEffect(() => {
    if (phase !== "boss") return;
    if (bossTime <= 0) {
      if (!bossEndedRef.current) endBoss(bossCorrectRef.current);
      return;
    }
    const t = setTimeout(() => setBossTime(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, bossTime]);

  function answerBoss(choice) {
    if (phase !== "boss" || bossIdx >= BOSS_PROBLEMS) return;
    const bp = bossProbs[bossIdx];
    const correct = choice === bp?.answer;
    const subjectForRecord = bp?.isMultiplication ? "multiplication" : "division";
    recordAttempt(fbSet, profile?.name, subjectForRecord, correct, 0);
    const newCorrect = bossCorrectRef.current + (correct ? 1 : 0);
    bossCorrectRef.current = newCorrect;
    setBossCorrect(newCorrect);
    const nextIdx = bossIdx + 1;
    setBossIdx(nextIdx);
    if (nextIdx >= BOSS_PROBLEMS) {
      endBoss(newCorrect);
    }
  }

  function endBoss(correctCount) {
    if (bossEndedRef.current) return;
    bossEndedRef.current = true;
    const won = correctCount >= Math.ceil(BOSS_PROBLEMS * 0.6);
    if (won) {
      // S04 policy: stars awarded ONLY on world clear, not per-problem. The math
      // is the reward; stars are for showing up + completing chunks.
      const clearedTable = WORLDS[worldIdx].table;
      addStars?.(3, `MathMonsters table ${clearedTable} world cleared`);
      const newStars = starsRef.current + 3;
      setStars(newStars); starsRef.current = newStars;
      const newScore = scoreRef.current + correctCount * 15;
      setScore(newScore); scoreRef.current = newScore;

      setSessionWins(sw => new Set([...sw, worldIdx]));
      recordGameHistory(fbSet, profile, "monsters", scoreRef.current, starsRef.current, {
        world: clearedTable, bossScore: correctCount,
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
        <div style={{ fontSize: 28, fontWeight: 900, color: "#fbbf24" }}>👾 Math Monsters</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Multiply AND divide to battle!</div>
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
        {/* Neutral retry hint on miss, fact-family hint on hit */}
        {flash === "miss" && (
          <div style={{ marginTop: 10, fontSize: 14, color: "#fde68a", fontWeight: 600 }}>
            Try again — you've got this!
          </div>
        )}
        {hint && (
          <div style={{
            marginTop: 10, fontSize: 14, color: "#a7f3d0", fontWeight: 600,
            background: "rgba(6, 78, 59, 0.6)", borderRadius: 10, padding: "6px 10px",
            display: "inline-block",
          }}>
            💡 {hint}
          </div>
        )}
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
          Math MASTER!
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
