import { useState, useEffect, useRef } from "react";
import { speakText, verifyMath } from "../utils";
import { generateMathProblem, GameBtn, recordGameHistory, ageBandFromProfile } from "./_shared";

// ─── FISH GAME ───────────────────────────────────────────────────────────────
export default function FishGame({ profile, kidsData, fbSet, addStars, transitionTo, curriculum, learningStats, rewardsConfig }) {
  const { mathDifficulty } = curriculum || { mathDifficulty: "easy" };
  const activeSubjects = curriculum?.activeSubjects || [];
  const isLucaMode = ageBandFromProfile(profile) === "luca";

  // ── Answer-fish subject rotator (alternates multiplication/division if both active) ──
  const subjectToggleRef = useRef(0);
  const pickMathSubject = () => {
    const hasMul = activeSubjects.includes("multiplication");
    const hasDiv = activeSubjects.includes("division");
    if (hasMul && hasDiv) {
      subjectToggleRef.current = (subjectToggleRef.current + 1) % 2;
      return subjectToggleRef.current === 0 ? "multiplication" : "division";
    }
    if (hasMul) return "multiplication";
    if (hasDiv) return "division";
    return "arithmetic";
  };

  // ── Core state ──────────────────────────────────────────────────────────────
  const [fishSize, setFishSize]       = useState(5);
  const [fishPos, setFishPos]         = useState({ x: 50, y: 50 });
  const [fishEnemies, setFishEnemies] = useState([]);
  const [fishScore, setFishScore]     = useState(0);
  const [fishActive, setFishActive]   = useState(true);
  const [fishGameOver, setFishGameOver] = useState(false);
  const [fishMathBubble, setFishMathBubble] = useState(null);
  const [fishFlashRed, setFishFlashRed] = useState(false);
  const [fishPowerMsg, setFishPowerMsg] = useState(null);

  // ── Answer fish (fish-as-answers mechanic) ─────────────────────────────────
  // Populated when fishMathBubble becomes non-null. Each: { id, x, y, vx, value, isCorrect, pausedUntil, spawnedAt }
  const [answerFish, setAnswerFish] = useState([]);
  const answerCooldownRef = useRef(0);

  // ── Lives ─────────────────────────────────────────────────────────────────────
  const MAX_LIVES = isLucaMode ? 3 : 2;
  const [lives, setLives]              = useState(isLucaMode ? 3 : 2);

  // ── Level system ─────────────────────────────────────────────────────────────
  const [level, setLevel]             = useState(1);
  const levelRef                      = useRef(1);

  // ── Boss state ───────────────────────────────────────────────────────────────
  const [boss, setBoss]               = useState(null); // null | { hp, maxHp, x, y, mathProblem }
  const [bossesDefeated, setBossesDefeated] = useState(0);
  const bossesDefeatedRef             = useRef(0);
  const bossRef                       = useRef(null);

  // ── Victory ──────────────────────────────────────────────────────────────────
  const [victory, setVictory]         = useState(false);

  // ── Power-ups ────────────────────────────────────────────────────────────────
  const [shield, setShield]           = useState(false);
  const [speedBoost, setSpeedBoost]   = useState(false);
  const [doubleStars, setDoubleStars] = useState(false);
  const shieldRef                     = useRef(false);
  const doubleStarsRef                = useRef(false);

  // ── Refs for interval closures ────────────────────────────────────────────────
  const fishPosRef              = useRef({ x: 50, y: 50 });
  const fishSizeRef             = useRef(5);
  const fishInvincibleUntilRef  = useRef(0);
  const speedBoostTimerRef      = useRef(null);
  const doubleStarsTimerRef     = useRef(null);

  // Keep refs in sync
  useEffect(() => { fishPosRef.current = fishPos; },           [fishPos]);
  useEffect(() => { fishSizeRef.current = fishSize; },         [fishSize]);
  useEffect(() => { levelRef.current = level; },               [level]);
  useEffect(() => { bossRef.current = boss; },                 [boss]);
  useEffect(() => { shieldRef.current = shield; },             [shield]);
  useEffect(() => { doubleStarsRef.current = doubleStars; },   [doubleStars]);
  useEffect(() => { bossesDefeatedRef.current = bossesDefeated; }, [bossesDefeated]);

  // ─── Level timer — tick every 30s ─────────────────────────────────────────
  useEffect(() => {
    if (!fishActive || fishGameOver || victory) return;
    const iv = setInterval(() => {
      setLevel(l => {
        if (l >= 15) return l;
        const newLevel = l + 1;
        // Spawn boss at levels 5, 10, 15
        if (newLevel % 5 === 0 && !bossRef.current) {
          const maxHp = isLucaMode ? 2 : 3;
          setBoss({
            hp: maxHp, maxHp,
            x: 50, y: 35,
            mathProblem: generateMathProblem(mathDifficulty),
          });
          if (isLucaMode) speakText("Boss fish incoming!");
        }
        return newLevel;
      });
    }, 30000);
    return () => clearInterval(iv);
  }, [fishActive, fishGameOver, victory, isLucaMode, mathDifficulty]);

  // ─── Enemy spawner — rate and max enemies scale with level ────────────────
  useEffect(() => {
    if (!fishActive || fishGameOver || victory) return;
    const FISH_EMOJIS = ["🐠","🐡","🐟","🐠","🐡","🐟","🦈"];
    const spawn = () => {
      setFishEnemies(enemies => {
        const maxEnemies = Math.min(8 + levelRef.current, 15);
        if (enemies.length >= maxEnemies) return enemies;
        const playerSz = fishSizeRef.current;
        const sizeBase = Math.random() < 0.85
          ? Math.max(1, playerSz - 1 - Math.random() * 3)
          : playerSz + 1 + Math.random() * 3;
        const size = Math.max(1, Math.min(12, sizeBase));
        const fromLeft = Math.random() > 0.5;
        const emoji = size > playerSz + 1
          ? (Math.random() > 0.5 ? "🐡" : "🦈")
          : FISH_EMOJIS[Math.floor(Math.random() * 5)];
        // +0.02 speed per level; Luca mode 30% slower
        const levelBonus = (levelRef.current - 1) * 0.02;
        const lucaMult   = isLucaMode ? 0.7 : 1.0;
        const baseSpeed  = (Math.random() * 0.5 + 0.2 + levelBonus) * lucaMult;
        return [...enemies, {
          id: Date.now() + Math.random(),
          x: fromLeft ? -8 : 108,
          y: Math.random() * 70 + 10,
          size, emoji,
          speed: baseSpeed * (fromLeft ? 1 : -1),
        }];
      });
    };
    // Spawn interval shrinks with level (min 1.5s)
    const spawnInterval = Math.max(1500, 2500 - (level - 1) * 100);
    const iv = setInterval(spawn, spawnInterval);
    return () => clearInterval(iv);
  }, [fishActive, fishGameOver, victory, level, isLucaMode]);

  // ─── Movement + collision loop ────────────────────────────────────────────
  useEffect(() => {
    if (!fishActive || fishGameOver || victory) return;
    const iv = setInterval(() => {
      const pos = fishPosRef.current;
      const sz  = fishSizeRef.current;
      setFishEnemies(enemies => {
        const surviving = [];
        for (const enemy of enemies) {
          const movedX = enemy.x + enemy.speed;
          if (movedX < -15 || movedX > 115) continue;
          const dx   = movedX - pos.x;
          const dy   = enemy.y - pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 6 + sz * 1.2) {
            if (enemy.size < sz) {
              const bonus = doubleStarsRef.current ? 20 : 10;
              setFishScore(s => s + bonus);
              setFishSize(s => Math.min(10, s + 0.5));
              setFishPowerMsg(`CHOMP! +${bonus}`);
              setTimeout(() => setFishPowerMsg(null), 600);
              continue;
            } else if (enemy.size > sz + 0.5) {
              if (Date.now() < fishInvincibleUntilRef.current) {
                surviving.push({ ...enemy, x: movedX });
                continue;
              }
              if (shieldRef.current) {
                setShield(false);
                setFishPowerMsg("SHIELD BLOCKED! 🛡️");
                setTimeout(() => setFishPowerMsg(null), 800);
                fishInvincibleUntilRef.current = Date.now() + 1000;
                surviving.push({ ...enemy, x: movedX });
                continue;
              }
              fishInvincibleUntilRef.current = Date.now() + 1500;
              setFishScore(s => Math.max(0, s - 20));
              setFishSize(s => Math.max(1, s - 1));
              setLives(l => { const n = l - 1; if (n <= 0) setFishGameOver(true); return Math.max(0, n); });
              setFishFlashRed(true);
              setTimeout(() => setFishFlashRed(false), 300);
              continue;
            }
          }
          surviving.push({ ...enemy, x: movedX });
        }
        return surviving;
      });
    }, 50);
    return () => clearInterval(iv);
  }, [fishActive, fishGameOver, victory]);

  // ─── Math bonus trigger — now spawns answer-fish instead of popup bubble ──
  useEffect(() => {
    if (!fishActive || fishGameOver || victory || boss) return;
    const show = () => {
      // Functional form avoids stale closure on fishMathBubble
      setFishMathBubble(prev => {
        if (prev) return prev;
        const subject = pickMathSubject();
        const prob = generateMathProblem(mathDifficulty, subject);
        // Spawn answer fish: 2 in Luca mode, 3 otherwise. Use the problem's choices.
        const numFish = isLucaMode ? 2 : 3;
        // Pick distinct choices: correct answer + enough wrong ones
        const wrongs = prob.choices.filter(c => c !== prob.answer);
        const chosen = [prob.answer, ...wrongs.slice(0, numFish - 1)];
        // Shuffle (Fisher-Yates)
        for (let i = chosen.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
        }
        // Spread start positions across screen width, random y, random drift
        const now = Date.now();
        const newAnswerFish = chosen.map((value, idx) => {
          const fromLeft = idx % 2 === 0;
          const yBand = 20 + (idx * (55 / Math.max(1, numFish - 1 || 1)));
          const vx = (Math.random() * 0.2 + 0.15) * (fromLeft ? 1 : -1) * (isLucaMode ? 0.6 : 1.0);
          return {
            id: now + idx + Math.random(),
            x: fromLeft ? Math.random() * 20 + 5 : Math.random() * 20 + 75,
            y: yBand + (Math.random() * 10 - 5),
            vx,
            value,
            isCorrect: value === prob.answer,
            pausedUntil: 0,
            spawnedAt: now,
          };
        });
        setAnswerFish(newAnswerFish);
        answerCooldownRef.current = 0;
        return { ...prob };
      });
    };
    const iv      = setInterval(show, 12000);
    const timeout = setTimeout(show, 3000);
    return () => { clearInterval(iv); clearTimeout(timeout); };
  }, [fishActive, fishGameOver, victory, mathDifficulty, boss, isLucaMode]);

  // ─── Answer-fish movement, collision, and 12s despawn ─────────────────────
  useEffect(() => {
    if (!fishActive || fishGameOver || victory || boss) return;
    if (!fishMathBubble || answerFish.length === 0) return;

    const iv = setInterval(() => {
      const pos = fishPosRef.current;
      const sz  = fishSizeRef.current;
      const now = Date.now();

      setAnswerFish(prev => {
        const updated = [];
        let collidedCorrect = false;
        for (const af of prev) {
          // Despawn after 12s since spawn
          if (now - af.spawnedAt > 12000) continue;
          // Move unless paused
          const isPaused = af.pausedUntil > now;
          const newX = isPaused ? af.x : af.x + af.vx;
          // Wrap / bounce lightly at edges
          let wrappedX = newX;
          if (newX < -10) wrappedX = 108;
          else if (newX > 110) wrappedX = -8;

          // Collision check against player fish (similar radius to enemy collision)
          const dx = wrappedX - pos.x;
          const dy = af.y - pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // Answer fish are fixed ~size 4 for collision
          if (dist < 6 + 4 * 1.2 && now > answerCooldownRef.current) {
            if (af.isCorrect) {
              collidedCorrect = true;
              // Skip pushing — it's eaten
              continue;
            } else {
              // Wrong: flash red, short cooldown, pause this fish for 1s.
              // NO life lost. Keep wrong fish on screen (paused).
              setFishFlashRed(true);
              setTimeout(() => setFishFlashRed(false), 300);
              setFishPowerMsg("Try another!");
              setTimeout(() => setFishPowerMsg(null), 700);
              answerCooldownRef.current = now + 500;
              updated.push({ ...af, x: wrappedX, pausedUntil: now + 1000 });
              continue;
            }
          }
          updated.push({ ...af, x: wrappedX });
        }

        if (collidedCorrect) {
          // Bonus score + celebration, clear bubble + all answer fish
          const bonus = doubleStarsRef.current ? 20 : 10;
          setFishScore(s => s + bonus);
          setFishPowerMsg(`Correct! +${bonus} ✨`);
          setTimeout(() => setFishPowerMsg(null), 800);
          setFishMathBubble(null);
          return [];
        }

        return updated;
      });
    }, 50);
    return () => clearInterval(iv);
  }, [fishActive, fishGameOver, victory, boss, fishMathBubble, answerFish.length]);

  // ─── Clear answer fish + bubble if all despawn (gives a fresh problem) ────
  useEffect(() => {
    if (!fishMathBubble) return;
    if (answerFish.length === 0) {
      // Give a short breather before next problem
      const t = setTimeout(() => setFishMathBubble(null), 300);
      return () => clearTimeout(t);
    }
  }, [fishMathBubble, answerFish.length]);

  // ─── Power-up applicator ─────────────────────────────────────────────────
  const POWER_UPS = ["size", "speed", "shield", "doubleStars"];

  const applyPowerUp = (type) => {
    if (type === "size") {
      setFishSize(s => Math.min(10, s + 2));
      setFishScore(s => s + 50);
      setFishPowerMsg("POWER UP! +2 Size! ✨");
      setTimeout(() => setFishPowerMsg(null), 800);
    } else if (type === "speed") {
      if (speedBoostTimerRef.current) clearTimeout(speedBoostTimerRef.current);
      setSpeedBoost(true);
      setFishPowerMsg("SPEED BOOST! ⚡ 8s");
      speedBoostTimerRef.current = setTimeout(() => { setSpeedBoost(false); setFishPowerMsg(null); }, 8000);
    } else if (type === "shield") {
      setShield(true);
      setFishPowerMsg("SHIELD ACTIVE! 🛡️");
      setTimeout(() => setFishPowerMsg(null), 800);
    } else if (type === "doubleStars") {
      if (doubleStarsTimerRef.current) clearTimeout(doubleStarsTimerRef.current);
      setDoubleStars(true);
      setFishPowerMsg("DOUBLE STARS! ⭐⭐ 15s");
      doubleStarsTimerRef.current = setTimeout(() => { setDoubleStars(false); setFishPowerMsg(null); }, 15000);
    }
    if (isLucaMode) speakText("Power up!");
  };

  // ─── Boss math answer handler ─────────────────────────────────────────────
  const handleBossAnswer = (c) => {
    if (!boss) return;
    if (c === boss.mathProblem.answer) {
      const newHp = boss.hp - 1;
      if (newHp <= 0) {
        setBoss(null);
        const newDefeated = bossesDefeatedRef.current + 1;
        setBossesDefeated(newDefeated);
        setFishScore(s => s + 200);
        setFishPowerMsg("BOSS DEFEATED! +200 🎉");
        setTimeout(() => setFishPowerMsg(null), 1500);
        if (levelRef.current >= 15) setVictory(true);
      } else {
        setBoss(b => ({ ...b, hp: newHp, mathProblem: generateMathProblem(mathDifficulty) }));
        setFishPowerMsg(`Boss hit! ${newHp} HP left 💥`);
        setTimeout(() => setFishPowerMsg(null), 800);
      }
    } else {
      // Wrong — take hit (shield absorbs)
      if (shieldRef.current) {
        setShield(false);
        setFishPowerMsg("SHIELD BLOCKED! 🛡️");
        setTimeout(() => setFishPowerMsg(null), 800);
      } else {
        setFishSize(s => Math.max(1, s - 1));
        setLives(l => { const n = l - 1; if (n <= 0) setFishGameOver(true); return Math.max(0, n); });
        setFishFlashRed(true);
        setTimeout(() => setFishFlashRed(false), 300);
      }
      setBoss(b => ({ ...b, mathProblem: generateMathProblem(mathDifficulty) }));
    }
  };

  // ─── Input handlers ───────────────────────────────────────────────────────
  const canMove = fishActive && !fishGameOver && !victory;

  const handleFishMove = (clientX, clientY, rect) => {
    if (!canMove) return;
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    setFishPos({ x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(90, y)) });
  };
  const handleOceanTouch = (e) => {
    e.preventDefault();
    if (!canMove) return;
    const rect  = e.currentTarget.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e.changedTouches[0];
    handleFishMove(touch.clientX, touch.clientY, rect);
  };
  const handleOceanClick = (e) => {
    if (!canMove) return;
    const rect = e.currentTarget.getBoundingClientRect();
    handleFishMove(e.clientX, e.clientY, rect);
  };

  // ─── Derived values ───────────────────────────────────────────────────────
  const dpadStep      = speedBoost ? 14 : 8;
  const sizeRounded   = Math.round(fishSize);
  const baseStars     = fishScore <= 100 ? 1 : fishScore <= 300 ? 2 : 3;
  const fishStarsEarned = doubleStars ? Math.min(6, baseStars * 2) : baseStars;
  const fishDone      = fishGameOver || victory;

  const resetGame = () => {
    setFishSize(5); setFishPos({ x: 50, y: 50 }); setFishEnemies([]); setFishScore(0);
    setFishActive(true); setFishGameOver(false); setFishMathBubble(null);
    setAnswerFish([]);
    setLevel(1); setBoss(null); setBossesDefeated(0); setVictory(false);
    setShield(false); setSpeedBoost(false); setDoubleStars(false);
    fishInvincibleUntilRef.current = 0;
    answerCooldownRef.current = 0;
    setLives(isLucaMode ? 3 : 2);
  };

  // ─── Award stars on level advance (level clear) ───────────────────────────
  // Per S04 plan: stars on level clear, NOT per math problem solved.
  // Kids earn for showing up and progressing, not for correctness.
  const lastAwardedLevelRef = useRef(1);
  useEffect(() => {
    if (level > lastAwardedLevelRef.current && !fishGameOver && !victory) {
      lastAwardedLevelRef.current = level;
      // 1 star per level advance — the in-game game-end bundle is the big reward.
      if (typeof addStars === "function") {
        try {
          addStars(1, `FishGame level ${level} cleared`);
        } catch (_) {
          // addStars signature may be just (amount) in older RPGCore — fall back
          try { addStars(1); } catch (_) { /* non-fatal */ }
        }
      }
    }
  }, [level, fishGameOver, victory, addStars]);

  return (
    <div style={{
      position: "relative", minHeight: 500, borderRadius: 16, overflow: "hidden",
      overflowX: "hidden", maxWidth: "100vw", width: "100%", boxSizing: "border-box",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      animation: "ll-fade-in 0.4s ease-out",
    }}>
      <div style={{
        minHeight: 500, background: "linear-gradient(180deg, #0c4a6e, #0369a1, #0284c7)", padding: 12,
        ...(fishFlashRed ? { boxShadow: "inset 0 0 60px rgba(239,68,68,0.6)" } : {}),
      }}>
        {/* ── Header ── */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, flexWrap:"wrap", gap:4 }}>
          <GameBtn color="#475569"
            onClick={() => { setFishActive(false); transitionTo("mini_games"); }}
            style={{ width:"auto", padding:"8px 14px", minHeight:44 }}>← Back</GameBtn>

          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            <div style={{ color:"#fbbf24", fontWeight:700, fontSize:16 }}>Score: {fishScore}</div>
            <div style={{ color:"#a78bfa", fontWeight:700, fontSize:14, background:"rgba(167,139,250,0.15)", padding:"2px 8px", borderRadius:8 }}>
              Lv {level}/15
            </div>
            {bossesDefeated > 0 && (
              <div style={{ color:"#f472b6", fontSize:13, fontWeight:700 }} aria-label={`${bossesDefeated} bosses defeated`}>
                👹 ×{bossesDefeated}
              </div>
            )}
          </div>

          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            {shield     && <span style={{ fontSize:18 }} aria-label="Shield active">🛡️</span>}
            {speedBoost && <span style={{ fontSize:18 }} aria-label="Speed boost active">⚡</span>}
            {doubleStars && <span style={{ fontSize:14, fontWeight:700, color:"#fbbf24" }} aria-label="Double stars active">×2⭐</span>}
            <div style={{ display:"flex", gap:2 }} aria-label={`${lives} lives remaining`}>
              {Array.from({ length: MAX_LIVES }).map((_, i) => (
                <span key={i} style={{ fontSize:16 }}>{i < lives ? "❤️" : "🖤"}</span>
              ))}
            </div>
            <div style={{ color:"#22d3ee", fontWeight:700, fontSize:14 }}>Size: {sizeRounded}/20</div>
          </div>
        </div>

        {/* ── Size bar ── */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, padding:"0 4px" }}>
          <span style={{ color:"#22d3ee", fontSize:12, fontWeight:600 }}>Size:</span>
          <div style={{ flex:1, height:12, background:"rgba(0,0,0,0.3)", borderRadius:6, overflow:"hidden" }}>
            <div style={{
              width:`${(fishSize/20)*100}%`, height:"100%", borderRadius:6, transition:"width 0.3s",
              background: fishSize > 15 ? "linear-gradient(90deg, #22c55e, #fbbf24)" : "linear-gradient(90deg, #22d3ee, #22c55e)",
            }} />
          </div>
          <span style={{ color:"#fff", fontSize:13, fontWeight:700 }}>{sizeRounded}</span>
        </div>

        {/* ── Ocean ── */}
        <div
          onClick={handleOceanClick}
          onTouchStart={handleOceanTouch}
          onTouchMove={handleOceanTouch}
          style={{
            background:"linear-gradient(180deg, #0c4a6e, #164e63, #0a3d5c)", borderRadius:16,
            width:"100%", paddingBottom:"80%", position:"relative",
            overflow:"hidden", border:"2px solid #22d3ee", touchAction:"none",
          }}>

          {/* Wave */}
          <div style={{ position:"absolute", top:0, left:0, right:0, height:8,
            background:"linear-gradient(90deg, rgba(34,211,238,0.5), rgba(34,211,238,0.15), rgba(34,211,238,0.5))",
            animation:"ll-pulse 2s ease-in-out infinite" }} />

          {/* Seaweed */}
          {[8,25,50,72,90].map((x,i) => (
            <div key={`w${i}`} style={{ position:"absolute", bottom:0, left:`${x}%`, fontSize:16+i*3,
              opacity:0.35, animation:`ll-pulse ${2+i*0.4}s ease-in-out infinite` }}>🌿</div>
          ))}

          {/* Ambient bubbles */}
          {[0,1,2].map(i => (
            <div key={`db${i}`} style={{ position:"absolute", bottom:`${10+i*25}%`, left:`${20+i*25}%`,
              fontSize:10, opacity:0.25, animation:`ll-bubble-rise ${3+i}s ease-in-out ${i}s infinite` }}>🫧</div>
          ))}

          {/* Float-up message */}
          {fishPowerMsg && (
            <div style={{ position:"absolute", top:"40%", left:"50%", transform:"translate(-50%,-50%)",
              fontSize:20, fontWeight:900, color:"#4ade80", textShadow:"0 0 10px #22c55e",
              animation:"ll-float-up 0.6s ease-out forwards", zIndex:15, pointerEvents:"none" }}>
              {fishPowerMsg}
            </div>
          )}

          {/* Player fish */}
          <div style={{
            position:"absolute", left:`${fishPos.x}%`, top:`${fishPos.y}%`,
            fontSize: 20 + sizeRounded * 4, zIndex:5,
            transition:"left 0.15s ease-out, top 0.15s ease-out, font-size 0.3s",
            transform:"translateX(-50%) translateY(-50%)",
            filter: shield
              ? "drop-shadow(0 0 12px rgba(168,85,247,0.9))"
              : "drop-shadow(0 0 8px rgba(34,211,238,0.6))",
            animation:"ll-swim 1.5s ease-in-out infinite",
          }}>🐠</div>

          {/* Enemy fish */}
          {fishEnemies.map(enemy => {
            const isSmaller = enemy.size < fishSize;
            const isBigger  = enemy.size > fishSize + 0.5;
            return (
              <div key={enemy.id} style={{
                position:"absolute", left:`${enemy.x}%`, top:`${enemy.y}%`,
                fontSize: 14 + Math.round(enemy.size) * 3.5,
                transform:`translateX(-50%) translateY(-50%) scaleX(${enemy.speed > 0 ? 1 : -1})`,
                zIndex:3, pointerEvents:"none",
                filter: isBigger ? "drop-shadow(0 0 6px rgba(239,68,68,0.5))" : isSmaller ? "drop-shadow(0 0 4px rgba(34,197,94,0.4))" : "none",
                animation:"ll-swim 1.2s ease-in-out infinite",
              }}>
                {enemy.emoji}
                <div style={{
                  position:"absolute", top:-14, left:"50%", transform:"translateX(-50%)",
                  fontSize:10, fontWeight:800, whiteSpace:"nowrap",
                  color: isSmaller ? "#4ade80" : isBigger ? "#fca5a5" : "#fde68a",
                  textShadow:"0 1px 3px rgba(0,0,0,0.9)",
                  background: isSmaller ? "rgba(34,197,94,0.4)" : isBigger ? "rgba(239,68,68,0.4)" : "rgba(251,191,36,0.3)",
                  padding:"2px 6px", borderRadius:4,
                }}>
                  {isSmaller ? "EAT" : isBigger ? "DANGER" : "SAME"}
                </div>
              </div>
            );
          })}

          {/* Boss fish */}
          {boss && (
            <div style={{
              position:"absolute", left:`${boss.x}%`, top:`${boss.y}%`,
              transform:"translateX(-50%) translateY(-50%)",
              zIndex:12, display:"flex", flexDirection:"column", alignItems:"center", gap:4,
            }}>
              {/* Boss HP pips */}
              <div style={{ display:"flex", gap:4, marginBottom:2 }}>
                {Array.from({ length: boss.maxHp }).map((_, i) => (
                  <div key={i} style={{
                    width:20, height:10, borderRadius:4,
                    background: i < boss.hp ? "#ef4444" : "rgba(255,255,255,0.2)",
                    border:"1px solid rgba(255,255,255,0.4)",
                  }} />
                ))}
              </div>
              <div style={{ fontSize:72, animation:"ll-swim 1.2s ease-in-out infinite",
                filter:"drop-shadow(0 0 16px rgba(239,68,68,0.9))" }}>🦈</div>
              <div style={{ color:"#fca5a5", fontWeight:900, fontSize:13,
                background:"rgba(0,0,0,0.5)", padding:"2px 8px", borderRadius:6 }}>BOSS — Level {level}</div>

              {/* Boss math challenge */}
              {boss.mathProblem && (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, marginTop:4 }}>
                  <div style={{
                    background:"rgba(239,68,68,0.5)", borderRadius:10, padding:"4px 12px",
                    color:"#fff", fontWeight:800, fontSize:13,
                    border:"2px solid rgba(239,68,68,0.8)", whiteSpace:"nowrap",
                    boxShadow:"0 0 20px rgba(239,68,68,0.4)",
                  }}>
                    ⚔️ Solve to hit: {boss.mathProblem.question} = ?
                  </div>
                  <div style={{ display:"flex", gap:6 }}>
                    {boss.mathProblem.choices.map((c, ci) => (
                      <button key={ci}
                        onClick={(e) => { e.stopPropagation(); handleBossAnswer(c); }}
                        style={{
                          minWidth:52, minHeight:52, borderRadius:10,
                          border:"2px solid rgba(239,68,68,0.7)",
                          background:"rgba(127,29,29,0.8)", color:"#fff",
                          fontSize:18, fontWeight:800, cursor:"pointer",
                        }}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Math question banner (fish-as-answers mechanic) ── */}
          {fishMathBubble && !fishDone && !boss && (
            <div style={{
              position:"absolute", top:6, left:"50%", transform:"translateX(-50%)",
              background:"rgba(251,191,36,0.45)", borderRadius:12, padding:"4px 14px",
              color:"#fff", fontWeight:800, fontSize: isLucaMode ? 16 : 14,
              border:"2px solid rgba(251,191,36,0.8)",
              textShadow:"0 1px 3px rgba(0,0,0,0.8)",
              boxShadow:"0 0 20px rgba(251,191,36,0.3)",
              whiteSpace:"nowrap", zIndex:11,
            }}>
              🍽️ Eat the fish with: {verifyMath(`${fishMathBubble.question} = ?`)}
            </div>
          )}

          {/* ── Answer fish — hidden during boss fights ── */}
          {fishMathBubble && !fishDone && !boss && answerFish.map(af => (
            <div key={af.id} style={{
              position:"absolute", left:`${af.x}%`, top:`${af.y}%`,
              transform:`translateX(-50%) translateY(-50%) scaleX(${af.vx >= 0 ? 1 : -1})`,
              zIndex:4, pointerEvents:"none",
              filter: af.isCorrect
                ? "drop-shadow(0 0 8px rgba(251,191,36,0.6))"
                : "drop-shadow(0 0 6px rgba(59,130,246,0.4))",
              animation:"ll-swim 1.2s ease-in-out infinite",
              display:"flex", flexDirection:"column", alignItems:"center",
            }}>
              <div style={{ fontSize: isLucaMode ? 44 : 36 }}>🐠</div>
              <div style={{
                fontSize: isLucaMode ? 24 : 20, fontWeight:900, color:"#fff",
                textShadow:"0 1px 3px rgba(0,0,0,1), 0 0 2px rgba(0,0,0,1)",
                background:"rgba(0,0,0,0.45)", padding:"2px 8px", borderRadius:6,
                marginTop:-4, whiteSpace:"nowrap",
                transform: af.vx < 0 ? "scaleX(-1)" : "none",
              }}>
                {af.value}
              </div>
            </div>
          ))}

          {/* Victory overlay — level 15 boss defeated */}
          {victory && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
              background:"rgba(0,0,0,0.7)", zIndex:20 }}>
              <div style={{ textAlign:"center", color:"#fbbf24" }}>
                <div style={{ fontSize:48 }}>🏆🐠👑</div>
                <div style={{ fontSize:28, fontWeight:800 }}>OCEAN CHAMPION!</div>
                <div style={{ fontSize:18, marginTop:4 }}>Score: {fishScore} | ⭐ {fishStarsEarned} Stars!</div>
                <div style={{ fontSize:14, marginTop:4, color:"#a78bfa" }}>Bosses defeated: {bossesDefeated}</div>
              </div>
            </div>
          )}

          {/* Game over overlay */}
          {fishGameOver && !victory && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
              background:"rgba(0,0,0,0.6)", zIndex:20 }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:48 }}>😱🐡</div>
                <div style={{ fontSize:28, fontWeight:800, color:"#ef4444" }}>EATEN!</div>
                <div style={{ fontSize:16, marginTop:4, color:"#fbbf24" }}>Score: {fishScore} | ⭐ {fishStarsEarned} Stars</div>
              </div>
            </div>
          )}
        </div>

        {/* Touch hint */}
        <div style={{ textAlign:"center", color:"rgba(255,255,255,0.5)", fontSize:11, marginTop:4 }}>
          Tap or drag to swim! Eat smaller fish (EAT) — avoid bigger (DANGER). When a math question appears, eat the fish with the right answer!
        </div>

        {/* D-pad controls */}
        <div style={{ display:"flex", justifyContent:"center", marginTop:8 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:6, width:210 }}>
            <div />
            <button onClick={() => canMove && setFishPos(p => ({ ...p, y: Math.max(5, p.y - dpadStep) }))}
              disabled={!canMove}
              style={{ minHeight:60, minWidth:60, fontSize:24, background:"#0369a1",
                border:"2px solid #22d3ee", borderRadius:12, color:"#fff", cursor: canMove ? "pointer" : "default", opacity: canMove ? 1 : 0.4 }}>⬆️</button>
            <div />
            <button onClick={() => canMove && setFishPos(p => ({ ...p, x: Math.max(5, p.x - dpadStep) }))}
              disabled={!canMove}
              style={{ minHeight:60, minWidth:60, fontSize:24, background:"#0369a1",
                border:"2px solid #22d3ee", borderRadius:12, color:"#fff", cursor: canMove ? "pointer" : "default", opacity: canMove ? 1 : 0.4 }}>⬅️</button>
            <div style={{ minHeight:60, minWidth:60, display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:22, color:"rgba(255,255,255,0.3)" }}>🐠</div>
            <button onClick={() => canMove && setFishPos(p => ({ ...p, x: Math.min(95, p.x + dpadStep) }))}
              disabled={!canMove}
              style={{ minHeight:60, minWidth:60, fontSize:24, background:"#0369a1",
                border:"2px solid #22d3ee", borderRadius:12, color:"#fff", cursor: canMove ? "pointer" : "default", opacity: canMove ? 1 : 0.4 }}>➡️</button>
            <div />
            <button onClick={() => canMove && setFishPos(p => ({ ...p, y: Math.min(90, p.y + dpadStep) }))}
              disabled={!canMove}
              style={{ minHeight:60, minWidth:60, fontSize:24, background:"#0369a1",
                border:"2px solid #22d3ee", borderRadius:12, color:"#fff", cursor: canMove ? "pointer" : "default", opacity: canMove ? 1 : 0.4 }}>⬇️</button>
            <div />
          </div>
        </div>

        {/* Collect stars / play again */}
        {fishDone && (
          <div style={{ textAlign:"center", marginTop:12 }}>
            <GameBtn color="#22c55e" onClick={() => {
              addStars(fishStarsEarned);
              recordGameHistory(fbSet, profile, "fish", fishScore, fishStarsEarned, {
                level, bossesDefeated,
              });
              transitionTo("mini_games");
            }} style={{ minHeight:80, fontSize:20 }}>
              Collect ⭐ {fishStarsEarned} Stars!
            </GameBtn>
            <GameBtn color="#3b82f6" onClick={resetGame} style={{ marginTop:8, minHeight:60, fontSize:18 }}>
              Play Again 🔄
            </GameBtn>
          </div>
        )}
      </div>
    </div>
  );
}
