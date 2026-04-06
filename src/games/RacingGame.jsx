import { useState, useEffect, useRef } from "react";

// ─── MATH PROBLEM GENERATOR ──────────────────────────────
function generateMathProblem(difficulty) {
  let a, b, op, answer, question;
  if (difficulty === 'easy') {
    op = Math.random() > 0.5 ? '+' : '-';
    a = Math.floor(Math.random() * 9) + 1;
    b = Math.floor(Math.random() * (op === '-' ? a : 9)) + 1;
    answer = op === '+' ? a + b : a - b;
    question = `${a} ${op} ${b}`;
  } else {
    if (Math.random() > 0.5) {
      a = Math.floor(Math.random() * 10) + 2;
      b = Math.floor(Math.random() * 10) + 2;
      answer = a * b;
      question = `${a} × ${b}`;
    } else {
      b = Math.floor(Math.random() * 9) + 2;
      answer = Math.floor(Math.random() * 10) + 1;
      a = answer * b;
      question = `${a} ÷ ${b}`;
    }
  }
  const choices = [answer];
  while (choices.length < 3) {
    const wrong = answer + (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 3) + 1);
    if (wrong > 0 && !choices.includes(wrong)) choices.push(wrong);
  }
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { question, answer, choices };
}

// ─── GAME BUTTON ─────────────────────────────────────────
function GameBtn({ children, onClick, color, disabled, big, style: extra }) {
  const bg = disabled ? "#555" : (color || "#3b82f6");
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        background: bg, color: "#fff", border: "none", borderRadius: 12,
        padding: big ? "16px 24px" : "12px 18px", fontSize: big ? 20 : 16,
        fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
        minHeight: 48, minWidth: 48, textAlign: "center",
        boxShadow: disabled ? "none" : `0 4px 12px ${bg}66`,
        opacity: disabled ? 0.5 : 1, transition: "all 0.2s", width: "100%", ...extra,
      }}
    >
      {children}
    </button>
  );
}

// ─── RACING GAME ─────────────────────────────────────────
export default function RacingGame({ profile, kidsData, fbSet, addStars, transitionTo, curriculum }) {
  const { mathDifficulty } = curriculum;

  const [raceLane, setRaceLane] = useState(1);
  const [raceSpeed, setRaceSpeed] = useState(0);
  const [raceScore, setRaceScore] = useState(0);
  const [raceActive, setRaceActive] = useState(true);
  const [raceObstacles, setRaceObstacles] = useState([]);
  const [raceStarPickups, setRaceStarPickups] = useState([]);
  const [raceHits, setRaceHits] = useState(0);
  const [raceMathBarrier, setRaceMathBarrier] = useState(null);
  const [raceShake, setRaceShake] = useState(false);
  const [raceFrozen, setRaceFrozen] = useState(false);
  const [raceRoadOffset, setRaceRoadOffset] = useState(0);

  const raceAnimRef = useRef(null);
  const raceSpeedRef = useRef(0);
  const gasRef = useRef(false);
  const brakeRef = useRef(false);

  useEffect(() => { raceSpeedRef.current = raceSpeed; }, [raceSpeed]);

  // ─── Animation loop ───────────────────────────────────
  useEffect(() => {
    if (!raceActive) return;
    let lastObstacleTime = Date.now();
    let lastStarTime = Date.now();
    let lastBarrierTime = 0;
    const OBSTACLE_EMOJIS = ['🪨','🌳','🚧'];
    const loop = () => {
      if (gasRef.current && !raceFrozen) {
        setRaceSpeed(s => Math.min(10, s + 0.15));
      } else if (brakeRef.current) {
        setRaceSpeed(s => Math.max(0, s - 0.3));
      } else {
        setRaceSpeed(s => Math.max(0, s - 0.03));
      }
      const spd = raceSpeedRef.current;
      setRaceRoadOffset(o => (o + spd * 3) % 40);
      setRaceObstacles(obs => {
        const next = [];
        for (const o of obs) {
          const ny = o.y + spd * 2;
          if (ny > 110) continue;
          if (ny > 75 && ny < 95 && o.lane === raceLane) {
            setRaceScore(sc => Math.max(0, sc - 50));
            setRaceHits(h => h + 1);
            setRaceSpeed(0);
            setRaceShake(true);
            setTimeout(() => setRaceShake(false), 400);
            continue;
          }
          next.push({ ...o, y: ny });
        }
        return next;
      });
      setRaceStarPickups(stars => {
        const next = [];
        for (const s of stars) {
          const ny = s.y + spd * 2;
          if (ny > 110) continue;
          if (ny > 75 && ny < 95 && s.lane === raceLane) {
            setRaceScore(sc => sc + 25);
            continue;
          }
          next.push({ ...s, y: ny });
        }
        return next;
      });
      const now = Date.now();
      if (now - lastObstacleTime > 2000 && spd > 1) {
        lastObstacleTime = now;
        const lane = Math.floor(Math.random() * 3);
        const emoji = OBSTACLE_EMOJIS[Math.floor(Math.random() * OBSTACLE_EMOJIS.length)];
        setRaceObstacles(obs => [...obs, { id: now, lane, y: -10, emoji }]);
      }
      if (now - lastStarTime > 3000 && spd > 0.5) {
        lastStarTime = now;
        const lane = Math.floor(Math.random() * 3);
        setRaceStarPickups(s => [...s, { id: now, lane, y: -10 }]);
      }
      if (now - lastBarrierTime > 20000 && spd > 2 && !raceMathBarrier) {
        lastBarrierTime = now;
        const prob = generateMathProblem(mathDifficulty);
        setRaceMathBarrier(prob);
        setRaceFrozen(true);
        setRaceSpeed(0);
      }
      raceAnimRef.current = requestAnimationFrame(loop);
    };
    raceAnimRef.current = requestAnimationFrame(loop);
    return () => { if (raceAnimRef.current) cancelAnimationFrame(raceAnimRef.current); };
  }, [raceActive, raceLane, raceFrozen, mathDifficulty]);

  const raceOver = raceHits >= 3;
  if (raceOver && raceActive) { setRaceActive(false); }
  const raceStarsEarned = raceScore <= 100 ? 1 : raceScore <= 300 ? 2 : 3;
  const laneX = [15, 50, 85];
  const speedInt = Math.round(raceSpeed);

  const containerStyle = {
    position: "relative", minHeight: 500, borderRadius: 16, overflow: "hidden",
    overflowX: "hidden", maxWidth: "100vw", width: "100%", boxSizing: "border-box",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    animation: "ll-fade-in 0.4s ease-out", opacity: 1, transition: "opacity 0.3s",
  };

  return (
    <div style={containerStyle}>
      <div style={{ minHeight:500, background:"linear-gradient(180deg, #1a1a2e, #16213e)", padding:0, animation: raceShake ? "ll-screen-shake 0.4s" : "none" }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", flexWrap:"wrap", gap:4 }}>
          <GameBtn color="#475569" onClick={() => { setRaceActive(false); transitionTo("mini_games"); }}
            style={{ width:"auto", padding:"8px 14px", minHeight:44 }}>← Back</GameBtn>
          <div style={{ color:"#fbbf24", fontWeight:700, fontSize:14 }}>Score: {raceScore}</div>
          <div style={{ color:"#fff", fontWeight:700, fontSize:14 }}>Speed: {speedInt}/10 | Hits: {raceHits}/3</div>
        </div>
        {/* Speed bar */}
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"0 12px 6px" }}>
          <span style={{ color:"#94a3b8", fontSize:12, minWidth:48 }}>Speed:</span>
          <div style={{ flex:1, height:12, background:"#1e293b", borderRadius:6, overflow:"hidden" }}>
            <div style={{ width:`${raceSpeed*10}%`, height:"100%", borderRadius:6, transition:"width 0.1s",
              background: raceSpeed > 7 ? "linear-gradient(90deg, #f59e0b, #ef4444)" : "linear-gradient(90deg, #22c55e, #f59e0b)" }} />
          </div>
          <span style={{ color:"#fff", fontSize:13, fontWeight:700, minWidth:20 }}>{speedInt}</span>
        </div>
        {/* Road */}
        <div style={{ position:"relative", width:"60%", margin:"0 auto", height:300, background:"#374151", borderRadius:8,
          overflow:"hidden", border:"2px solid #4b5563" }}>
          <div style={{ position:"absolute", top:0, bottom:0, left:-4, width:4, background:"#22c55e" }} />
          <div style={{ position:"absolute", top:0, bottom:0, right:-4, width:4, background:"#22c55e" }} />
          <div style={{ position:"absolute", left:"50%", top:0, bottom:0, width:3, transform:"translateX(-50%)",
            backgroundImage:`repeating-linear-gradient(0deg, #fbbf24 0px, #fbbf24 20px, transparent 20px, transparent 40px)`,
            backgroundPositionY: raceRoadOffset }} />
          <div style={{ position:"absolute", left:"33.3%", top:0, bottom:0, width:1, background:"rgba(255,255,255,0.15)" }} />
          <div style={{ position:"absolute", left:"66.6%", top:0, bottom:0, width:1, background:"rgba(255,255,255,0.15)" }} />
          {/* Player car */}
          <div style={{ position:"absolute", bottom:20, left:`${laneX[raceLane]}%`, transform:"translateX(-50%)",
            fontSize:36, transition:"left 0.15s ease-out", zIndex:5 }}>🏎️</div>
          {/* Obstacles */}
          {raceObstacles.map(o => (
            <div key={o.id} style={{ position:"absolute", top:`${o.y}%`, left:`${laneX[o.lane]}%`,
              transform:"translateX(-50%)", fontSize:28, zIndex:3 }}>{o.emoji}</div>
          ))}
          {/* Star pickups */}
          {raceStarPickups.map(s => (
            <div key={s.id} style={{ position:"absolute", top:`${s.y}%`, left:`${laneX[s.lane]}%`,
              transform:"translateX(-50%)", fontSize:24, zIndex:3 }}>⭐</div>
          ))}
          {/* Math barrier overlay */}
          {raceMathBarrier && (
            <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.75)", zIndex:10,
              display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12 }}>
              <div style={{ fontSize:14, color:"#fbbf24", fontWeight:700 }}>MATH BARRIER!</div>
              <div style={{ fontSize:24, fontWeight:900, color:"#fff" }}>{raceMathBarrier.question} = ?</div>
              <div style={{ display:"flex", gap:10 }}>
                {raceMathBarrier.choices.map((c, i) => (
                  <button key={i} onClick={() => {
                    if (c === raceMathBarrier.answer) {
                      setRaceScore(s => s + 100); setRaceSpeed(5);
                    } else {
                      setRaceScore(s => Math.max(0, s - 50));
                      setRaceFrozen(true);
                      setTimeout(() => setRaceFrozen(false), 2000);
                    }
                    setRaceMathBarrier(null); setRaceFrozen(false);
                  }} style={{ minWidth:64, minHeight:64, borderRadius:14, border:"3px solid #fbbf24",
                    background:"rgba(59,130,246,0.8)", color:"#fff", fontSize:22, fontWeight:800, cursor:"pointer" }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Game over overlay */}
          {raceOver && (
            <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.8)", zIndex:20,
              display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
              <div style={{ fontSize:48 }}>🏁</div>
              <div style={{ fontSize:28, fontWeight:900, color:"#fbbf24", marginTop:8 }}>Race Over!</div>
              <div style={{ fontSize:18, color:"#fff", marginTop:4 }}>Score: {raceScore}</div>
              <div style={{ fontSize:16, color:"#fbbf24", marginTop:4 }}>⭐ {raceStarsEarned} Stars!</div>
            </div>
          )}
        </div>
        {/* Controls */}
        {!raceOver && !raceMathBarrier && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, padding:"8px 12px" }}>
              <button onClick={() => setRaceLane(l => Math.max(0, l-1))}
                style={{ minHeight:60, fontSize:20, fontWeight:700, background:"#3b82f6", color:"#fff",
                  border:"none", borderRadius:12, cursor:"pointer" }}>⬅️ Left</button>
              <button onClick={() => setRaceLane(l => Math.min(2, l+1))}
                style={{ minHeight:60, fontSize:20, fontWeight:700, background:"#3b82f6", color:"#fff",
                  border:"none", borderRadius:12, cursor:"pointer" }}>➡️ Right</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, padding:"0 12px 12px" }}>
              <button
                onTouchStart={() => { gasRef.current = true; }}
                onTouchEnd={() => { gasRef.current = false; }}
                onMouseDown={() => { gasRef.current = true; }}
                onMouseUp={() => { gasRef.current = false; }}
                onMouseLeave={() => { gasRef.current = false; }}
                style={{ minHeight:80, fontSize:22, fontWeight:800, background:"linear-gradient(135deg, #16a34a, #22c55e)",
                  color:"#fff", border:"none", borderRadius:14, cursor:"pointer",
                  boxShadow:"0 4px 12px rgba(34,197,94,0.4)", touchAction:"none" }}>🚀 GAS</button>
              <button
                onTouchStart={() => { brakeRef.current = true; }}
                onTouchEnd={() => { brakeRef.current = false; }}
                onMouseDown={() => { brakeRef.current = true; }}
                onMouseUp={() => { brakeRef.current = false; }}
                onMouseLeave={() => { brakeRef.current = false; }}
                style={{ minHeight:80, fontSize:22, fontWeight:800, background:"linear-gradient(135deg, #dc2626, #ef4444)",
                  color:"#fff", border:"none", borderRadius:14, cursor:"pointer",
                  boxShadow:"0 4px 12px rgba(239,68,68,0.4)", touchAction:"none" }}>🔴 BRAKE</button>
            </div>
          </>
        )}
        {/* Collect stars after game over */}
        {raceOver && (
          <div style={{ textAlign:"center", padding:"16px 12px" }}>
            <GameBtn color="#22c55e" onClick={() => {
              addStars(raceStarsEarned);
              if (fbSet && profile?.name) fbSet(`gameHistory/${profile.name}/${Date.now()}`, { game:'racing', score:raceScore, stars:raceStarsEarned, timestamp:new Date().toISOString(), profile:profile.name });
              transitionTo("mini_games");
            }} style={{ minHeight:80, fontSize:20 }}>
              Collect ⭐ {raceStarsEarned} Stars! 🏁
            </GameBtn>
          </div>
        )}
      </div>
    </div>
  );
}
