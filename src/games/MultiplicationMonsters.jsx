// ─── MATH MONSTERS (EDU-02, S04-A1) ──────────────────────────────────────────
// Merged multiplication + division (fact families) monster battler.
// 14 worlds, one per times table, ordered by STRATEGY not sequentially:
//   x2 (doubles) → x4 → x8 → x10 (anchor) → x5 → x9 (trick) → x3 → x6 → x11 → x7 → x12
//   → x13/x14/x15 Titan Realms (pure stretch content past the ×12 chain)
// Each world: 10 monsters + boss fight. Problems mix × and ÷ as fact families.
// After correct answers there's a 20% chance of a fact-family hint
// (e.g. solved 12÷4=3 → "Did you know? 4 × 3 = 12 too!").
// Worlds unlock when the previous world's boss was beaten — this session
// (sessionWins) or ever (persisted at kidsData/{kid}/mathMonstersTablesCleared).
// NOTE: File name stays MultiplicationMonsters.jsx — RPGCore imports by path.
//       Wave 3 (W1) will rename the file and update the import.

import { useState, useEffect, useRef } from "react";
import { GameBtn, recordGameHistory, ageBandFromProfile, factChoices, checkPersonalBest } from "./_shared";
import { recordAttempt, nextProblem, recordFactAttempt, pickFact, tableMastery, getFactStreaks } from "../LearningEngine";
import { verifyMath, DIFFICULTY_LEVELS, playSfx, buzz, triggerConfetti } from "../utils";

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
  // Titan Realms — stretch tables past the standard ×12 chain (Yana's x13-x15 gap).
  { table: 13, emoji: "🗻", name: "Titan Peak",      bg: "linear-gradient(135deg, #1e293b, #64748b)", color: "#cbd5e1" },
  { table: 14, emoji: "🌟", name: "Star Titan",      bg: "linear-gradient(135deg, #713f12, #eab308)", color: "#fde047" },
  { table: 15, emoji: "🌌", name: "Galaxy Titan",    bg: "linear-gradient(135deg, #2e1065, #7c3aed)", color: "#c4b5fd" },
];
const MONSTERS_PER_WORLD = 10;
const BOSS_PROBLEMS      = 10;
const BOSS_SECONDS       = 30;

// Free-operand range per parent-set difficulty (S07 / C1-C). "extreme" is
// estimation-scale: 2-digit operands with magnitude-spread wrong answers.
const B_RANGES = { easy: [1, 5], medium: [1, 10], hard: [1, 12], extreme: [11, 99] };

// makeProblem — generates a multiplication OR division problem for this table.
// curriculum.activeSubjects weights the mix:
//   - "multiplication" only → 80/20 favor multiplication
//   - "division" only       → 80/20 favor division
//   - both or neither       → 50/50
function makeProblem(table, curriculum, difficulty = "easy") {
  const active = Array.isArray(curriculum?.activeSubjects) ? curriculum.activeSubjects : [];
  const hasMult = active.includes("multiplication");
  const hasDiv = active.includes("division");

  let multBias = 0.5;
  if (hasMult && !hasDiv) multBias = 0.8;
  else if (hasDiv && !hasMult) multBias = 0.2;

  const isMultiplication = Math.random() < multBias;
  const [bMin, bMax] = B_RANGES[difficulty] || B_RANGES.easy;
  const b = Math.floor(Math.random() * (bMax - bMin + 1)) + bMin;

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
    // Extreme spreads wrong answers by magnitude (±15-40% of the answer) so
    // ballpark estimation can't rule them out; other levels keep small deltas.
    const magnitude = difficulty === "extreme"
      ? Math.max(2, Math.round(answer * (0.15 + Math.random() * 0.25)))
      : Math.floor(Math.random() * 8) + 1;
    const delta = magnitude * (Math.random() > 0.5 ? 1 : -1);
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

export default function MathMonsters({
  profile, kidsData, fbSet, addStars, transitionTo, curriculum,
  learningStats = {},
}) {
  const isLuca = ageBandFromProfile(profile) === "luca";
  // Parent-set difficulty for this kid (S07 / C1-C). When the knob is UNSET
  // (the default), fall back to the ageBand-derived mathDifficulty ("hard"
  // for Yana's standard band) — a blanket "easy" default would silently
  // DOWNGRADE content below what shipped pre-S07 (3-lens review).
  const rawMult = kidsData?.[profile?.name]?.difficulty?.multiplication;
  const difficulty = DIFFICULTY_LEVELS.includes(rawMult)
    ? rawMult
    : (curriculum?.mathDifficulty || "easy");

  const [phase, setPhase] = useState("select"); // select | factmap | battle | boss | bossResult | complete | victory
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
  const [newBest, setNewBest]   = useState(null); // {isNewBest, prevBest} from checkPersonalBest

  const flashingRef     = useRef(false);
  const starsRef        = useRef(0);
  const scoreRef        = useRef(0);
  const startTimeRef    = useRef(0);
  const bossCorrectRef  = useRef(0);
  const bossEndedRef    = useRef(false);
  const battleCountRef  = useRef(0); // counts problems served in current world (for every-3rd adaptive pull)
  const sessionMissesRef = useRef([]); // missed facts [{table, operand}] — the boss re-asks them, NEVER displayed
  const worldStartScoreRef = useRef(0); // score when this world was entered — PB compares ONE world's points, not the session total

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
      // LearningEngine.nextProblem expects {[kidName]: {activeSubjects, mastery}}.
      // LucacLegends passes a per-kid flattened `curriculum` object — wrap it back
      // into the engine's expected kid-keyed shape.
      const curriculumForEngine = {
        [profile?.name]: {
          activeSubjects: curriculum.activeSubjects || [],
          mastery: curriculum.mastery || {},
        },
      };
      const p = nextProblem(curriculumForEngine, learningStats, profile?.name, kidsData);
      // Only accept multiplication/division in this game. Cross-domain adaptive
      // pulls (e.g. addition) would confuse a kid in a ×/÷ world and would get
      // mis-recorded — fall through to makeBattleProblem(table) instead.
      const isMathMonstersSubject = p?.subjectId === "multiplication" || p?.subjectId === "division";
      if (p && typeof p.answer === "number" && Array.isArray(p.choices) && p.choices.length >= 2 && isMathMonstersSubject) {
        // generateMathProblem returns 3 choices while this game's own problems
        // show 4 — pad to 4 so adaptive pulls aren't visually "off" (S07 smoke).
        const choices = [...p.choices];
        while (choices.length < 4) {
          const wrong = p.answer + (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 8) + 1);
          if (wrong > 0 && !choices.includes(wrong)) choices.push(wrong);
        }
        for (let i = choices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [choices[i], choices[j]] = [choices[j], choices[i]];
        }
        return {
          question: p.question?.endsWith("=") || p.question?.endsWith("?") ? p.question : `${p.question} = ?`,
          answer: p.answer,
          choices,
          subjectId: p.subjectId,
          table: null,
          operand: null,
          isMultiplication: p.subjectId === "multiplication",
        };
      }
    }
    return makeBattleProblem(table);
  }

  // makeBattleProblem — battle problems for this world. Multiplication picks
  // its operand via the per-fact retrieval engine (pickFact) so practice aims
  // at exactly the facts this kid hasn't conquered yet; division keeps the
  // fact-family generator. Extreme difficulty also keeps makeProblem — its
  // 11-99 operands live outside the 12-fact map.
  function makeBattleProblem(table) {
    const prob = makeProblem(table, curriculum, difficulty);
    if (!prob.isMultiplication || difficulty === "extreme") return prob;
    // Fact universe is ALWAYS the full 1..12 map (pickFact default) — the
    // difficulty knob shapes only free-operand/division/extreme problems.
    // Capping bMax by difficulty would make the Fact Map's 👑 12/12 crown
    // mathematically unattainable for easy-set kids (3-lens review).
    const fact = pickFact(learningStats, profile?.name, { tables: [table] });
    if (!fact) return prob;
    const fc = factChoices(fact.a, fact.b, 4);
    return {
      question: `${fc.question} = ?`,
      answer: fc.answer,
      choices: fc.choices,
      subjectId: "multiplication",
      table: fact.a,
      operand: fact.b,
      isMultiplication: true,
    };
  }

  // ── Unlock logic ──────────────────────────────────────────────────────────
  // A world unlocks when the previous world's boss was beaten — this session
  // (sessionWins) or ever (persisted mathMonstersTablesCleared, S07 / G3).
  function isUnlocked(idx) {
    return idx === 0
      || sessionWins.has(idx - 1)
      || !!kidsData?.[profile?.name]?.mathMonstersTablesCleared?.[WORLDS[idx - 1].table];
  }

  // ── Start battle ──────────────────────────────────────────────────────────
  function enterWorld(idx) {
    setWorldIdx(idx);
    setMonNum(0);
    setMonHp(isLuca ? 2 : 3);
    battleCountRef.current = 0;
    worldStartScoreRef.current = scoreRef.current;
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
    // Prefer subjectId from the problem (set on both adaptive and local paths).
    // Fall back to the legacy boolean only if subjectId is somehow missing.
    const subjectForRecord = problem.subjectId || (problem.isMultiplication ? "multiplication" : "division");
    recordAttempt(fbSet, profile?.name, subjectForRecord, correct, timeMs);
    // Per-fact retrieval tracking (S07) — multiplication facts with a known
    // table/operand feed the fact map + pickFact weighting.
    if (problem.isMultiplication && problem.table != null && problem.operand != null) {
      recordFactAttempt(fbSet, learningStats, profile?.name, problem.table, problem.operand, correct);
    }
    flashingRef.current = true;

    if (correct) {
      setFlash("hit");
      playSfx("correct");
      buzz([20]);

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
      // Quietly stash the missed fact (deduped) so the boss can re-ask it —
      // never shown to the kid as a count or list.
      if (problem.table != null && problem.operand != null) {
        const missKey = `${problem.table}x${problem.operand}`;
        if (!sessionMissesRef.current.some(m => `${m.table}x${m.operand}` === missKey)) {
          sessionMissesRef.current.push({ table: problem.table, operand: problem.operand });
        }
      }
      playSfx("tryAgain");
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
    const table = WORLDS[worldIdx].table;
    // The boss remembers: this table's missed facts come FIRST, regenerated
    // via factChoices so the option order differs from the battle round.
    const missProbs = sessionMissesRef.current
      .filter(m => m.table === table)
      .slice(0, BOSS_PROBLEMS)
      .map(m => {
        const fc = factChoices(m.table, m.operand, 4);
        return {
          question: `${fc.question} = ?`, answer: fc.answer, choices: fc.choices,
          subjectId: "multiplication", table: m.table, operand: m.operand, isMultiplication: true,
        };
      });
    const probs = [
      ...missProbs,
      ...Array.from({ length: Math.max(0, BOSS_PROBLEMS - missProbs.length) }, () => makeProblem(table, curriculum, difficulty)),
    ];
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
    if (correct) { playSfx("correct"); buzz([20]); } else { playSfx("tryAgain"); }
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
      // Persistent progression (S07 / G3) — unlocks survive reloads + devices.
      if (profile?.name) fbSet(`kidsData/${profile.name}/mathMonstersTablesCleared/${clearedTable}`, true);
      // Boss beaten — this table's tricky facts are conquered; forget them.
      sessionMissesRef.current = sessionMissesRef.current.filter(m => m.table !== clearedTable);
      const newStars = starsRef.current + 3;
      setStars(newStars); starsRef.current = newStars;
      const newScore = scoreRef.current + correctCount * 15;
      setScore(newScore); scoreRef.current = newScore;

      // Personal best — self-competition only, never a sibling's score.
      // newRecord's recipe is a superset of levelClear, so play one or the
      // other — layering both doubles the arpeggio and sounds muddy.
      // Per-world PB (3-lens review): the session score is cumulative and
      // never resets, so comparing it fired a false "NEW PERSONAL BEST" on
      // every world clear after the first AND stored an unbeatable multi-world
      // bar. Compare ONE world's points under a per-table key instead —
      // "beat my best on the ×7 world" is a genuinely chaseable record.
      const pb = checkPersonalBest(profile?.name, `monsters_${clearedTable}`, newScore - worldStartScoreRef.current);
      if (pb.isNewBest) {
        setNewBest(pb);
        triggerConfetti(document.body, "big");
        playSfx("newRecord");
        buzz([40, 60, 40]);
      } else {
        setNewBest(null);
        playSfx("levelClear");
        buzz([30, 50, 30]);
      }

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
          const tm = tableMastery(learningStats, profile?.name, w.table);
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
              {unlocked && (
                <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2, color: tm.mastered === 12 ? "#fcd34d" : "rgba(255,255,255,0.75)" }}>
                  {tm.mastered === 12 ? "👑" : "⭐"} {tm.mastered}/12 facts
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <GameBtn color="#0e7490" onClick={() => setPhase("factmap")}>My Fact Map 🗺️</GameBtn>
        <GameBtn color="#475569" onClick={() => transitionTo("mini_games")}>← Back to Menu</GameBtn>
      </div>
    </div>
  );

  // ── FACT MAP ──────────────────────────────────────────────────────────────
  // One row per unlocked table. Conquered facts (streak ≥ 3) are filled with a
  // 👑 + bold border; not-yet facts are plain outlined doors — fact text only,
  // NEVER a miss count or a red mark.
  if (phase === "factmap") return (
    <div style={{ ...wrapBase, background: "#0f172a", padding: 16 }}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#fbbf24" }}>🗺️ My Fact Map</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>👑 = conquered — tap a crown to hear it ring!</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
        {WORLDS.map((w, i) => {
          if (!isUnlocked(i)) return null;
          const streaks = getFactStreaks(learningStats, profile?.name, w.table);
          return (
            <div key={w.table}>
              <div style={{ fontSize: 13, fontWeight: 700, color: w.color, marginBottom: 6 }}>
                {w.emoji} {w.table}× {w.name}
              </div>
              <div style={{ overflowX: "auto", paddingBottom: 4 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(44px, 1fr))", gap: 4 }}>
                  {streaks.map(f => {
                    const conquered = f.streak >= 3;
                    return (
                      <div key={f.b} onClick={() => conquered && playSfx("correct")}
                        style={{
                          minWidth: 44, minHeight: 44, borderRadius: 8,
                          display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 700,
                          background: conquered ? w.color + "33" : "transparent",
                          border: conquered ? `2px solid ${w.color}` : "1px solid rgba(255,255,255,0.25)",
                          color: conquered ? "#fff" : "rgba(255,255,255,0.6)",
                          cursor: conquered ? "pointer" : "default",
                        }}>
                        {conquered && <div style={{ fontSize: 12, lineHeight: 1 }}>👑</div>}
                        <div>{f.fact}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <GameBtn color="#475569" onClick={() => setPhase("select")}>← Back to Worlds</GameBtn>
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
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 4 }}>
            The boss knows the tricky ones — show it who's stronger!
          </div>
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
          <GameBtn big onClick={() => startBoss()} color="#7c3aed">Try Boss Again</GameBtn>
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
        {newBest?.isNewBest && (
          <div style={{ background: "rgba(0,0,0,0.35)", borderRadius: 12, padding: "8px 14px", display: "inline-block", marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#fcd34d" }}>🏆 NEW PERSONAL BEST!</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Your old best: {newBest.prevBest}</div>
          </div>
        )}
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
        {newBest?.isNewBest && (
          <div style={{ background: "rgba(0,0,0,0.35)", borderRadius: 12, padding: "8px 14px", display: "inline-block", marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#fcd34d" }}>🏆 NEW PERSONAL BEST!</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Your old best: {newBest.prevBest}</div>
          </div>
        )}
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
