import { useState, useEffect, useRef } from "react";
import { speakText } from "../utils";

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

// ─── FISH GAME ───────────────────────────────────────────
export default function FishGame({ profile, kidsData, fbSet, addStars, transitionTo, curriculum }) {
  const { isLucaMode, mathDifficulty } = curriculum;

  const [fishSize, setFishSize] = useState(3);
  const [fishPos, setFishPos] = useState({ x: 50, y: 50 });
  const [fishEnemies, setFishEnemies] = useState([]);
  const [fishScore, setFishScore] = useState(0);
  const [fishActive, setFishActive] = useState(true);
  const [fishGameOver, setFishGameOver] = useState(false);
  const [fishMathBubble, setFishMathBubble] = useState(null);
  const [fishFlashRed, setFishFlashRed] = useState(false);
  const [fishPowerMsg, setFishPowerMsg] = useState(null);

  const fishPosRef = useRef({ x: 50, y: 50 });
  const fishSizeRef = useRef(3);
  const fishAnimRef = useRef(null);
  const fishDragRef = useRef(false);

  useEffect(() => { fishPosRef.current = fishPos; }, [fishPos]);
  useEffect(() => { fishSizeRef.current = fishSize; }, [fishSize]);

  // ─── Enemy spawner ────────────────────────────────────
  useEffect(() => {
    if (!fishActive || fishSize >= 10 || fishGameOver) return;
    const FISH_EMOJIS = ['🐠','🐡','🐟','🐠','🐡','🐟','🦈'];
    const spawn = () => {
      setFishEnemies(enemies => {
        if (enemies.length >= 10) return enemies;
        const playerSz = fishSizeRef.current;
        const sizeBase = Math.random() < 0.6
          ? Math.max(1, playerSz - 1 - Math.random() * 3)
          : playerSz + 1 + Math.random() * 3;
        const size = Math.max(1, Math.min(12, sizeBase));
        const fromLeft = Math.random() > 0.5;
        const emoji = size > playerSz + 1
          ? (Math.random() > 0.5 ? '🐡' : '🦈')
          : FISH_EMOJIS[Math.floor(Math.random() * 5)];
        return [...enemies, {
          id: Date.now() + Math.random(),
          x: fromLeft ? -8 : 108,
          y: Math.random() * 70 + 10,
          size, emoji,
          speed: (Math.random() * 1.0 + 0.3) * (fromLeft ? 1 : -1),
        }];
      });
    };
    spawn();
    const iv = setInterval(spawn, 1500);
    return () => clearInterval(iv);
  }, [fishActive, fishGameOver]);

  // ─── Movement + collision loop ────────────────────────
  useEffect(() => {
    if (!fishActive || fishGameOver) return;
    const iv = setInterval(() => {
      const pos = fishPosRef.current;
      const sz = fishSizeRef.current;
      setFishEnemies(enemies => {
        const surviving = [];
        for (const enemy of enemies) {
          const movedX = enemy.x + enemy.speed;
          if (movedX < -15 || movedX > 115) continue;
          const dx = movedX - pos.x;
          const dy = enemy.y - pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const collisionDist = 6 + sz * 1.2;
          if (dist < collisionDist) {
            if (enemy.size < sz) {
              setFishScore(s => s + 10);
              setFishSize(s => Math.min(10, s + 0.5));
              setFishPowerMsg("CHOMP! +10");
              setTimeout(() => setFishPowerMsg(null), 600);
              continue;
            } else if (enemy.size > sz + 0.5) {
              setFishScore(s => Math.max(0, s - 20));
              setFishSize(s => {
                const newSz = s - 1;
                if (newSz <= 0) setFishGameOver(true);
                return Math.max(0.5, newSz);
              });
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
  }, [fishActive, fishGameOver]);

  // ─── Math bonus bubble every 15s ─────────────────────
  useEffect(() => {
    if (!fishActive || fishSize >= 10 || fishGameOver) return;
    const iv = setInterval(() => {
      if (!fishMathBubble) {
        const prob = generateMathProblem(mathDifficulty);
        setFishMathBubble({ ...prob, x: Math.random() * 60 + 20, y: Math.random() * 50 + 15 });
      }
    }, 15000);
    const firstTimeout = setTimeout(() => {
      const prob = generateMathProblem(mathDifficulty);
      setFishMathBubble({ ...prob, x: Math.random() * 60 + 20, y: Math.random() * 50 + 15 });
    }, 8000);
    return () => { clearInterval(iv); clearTimeout(firstTimeout); };
  }, [fishActive, fishGameOver, mathDifficulty]);

  const handleFishMove = (clientX, clientY, rect) => {
    if (!fishActive || fishGameOver || fishSize >= 10) return;
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    setFishPos({ x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(90, y)) });
  };
  const handleOceanTouch = (e) => {
    e.preventDefault();
    if (!fishActive || fishGameOver || fishSize >= 10) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e.changedTouches ? e.changedTouches[0] : e;
    handleFishMove(touch.clientX, touch.clientY, rect);
  };
  const handleOceanClick = (e) => {
    if (!fishActive || fishGameOver || fishSize >= 10) return;
    const rect = e.currentTarget.getBoundingClientRect();
    handleFishMove(e.clientX, e.clientY, rect);
  };

  const sizeRounded = Math.round(fishSize);
  const fishStarsEarned = fishScore <= 100 ? 1 : fishScore <= 300 ? 2 : 3;
  const fishDone = fishSize >= 10 || fishGameOver;

  const containerStyle = {
    position: "relative", minHeight: 500, borderRadius: 16, overflow: "hidden",
    overflowX: "hidden", maxWidth: "100vw", width: "100%", boxSizing: "border-box",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    animation: "ll-fade-in 0.4s ease-out", opacity: 1, transition: "opacity 0.3s",
  };

  return (
    <div style={containerStyle}>
      <div style={{ minHeight:500, background:"linear-gradient(180deg, #0c4a6e, #0369a1, #0284c7)", padding:12,
        ...(fishFlashRed ? { boxShadow:"inset 0 0 60px rgba(239,68,68,0.6)" } : {}) }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, flexWrap:"wrap", gap:4 }}>
          <GameBtn color="#475569" onClick={() => { setFishActive(false); transitionTo("mini_games"); }}
            style={{ width:"auto", padding:"8px 14px", minHeight:44 }}>← Back</GameBtn>
          <div style={{ color:"#fbbf24", fontWeight:700, fontSize:16 }}>Score: {fishScore}</div>
          <div style={{ color:"#22d3ee", fontWeight:700, fontSize:14 }}>Size: {sizeRounded}/10</div>
        </div>
        {/* Size bar */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, padding:"0 4px" }}>
          <span style={{ color:"#22d3ee", fontSize:12, fontWeight:600 }}>Size:</span>
          <div style={{ flex:1, height:12, background:"rgba(0,0,0,0.3)", borderRadius:6, overflow:"hidden" }}>
            <div style={{ width:`${(fishSize/10)*100}%`, height:"100%", borderRadius:6, transition:"width 0.3s",
              background: fishSize > 7 ? "linear-gradient(90deg, #22c55e, #fbbf24)" : "linear-gradient(90deg, #22d3ee, #22c55e)" }} />
          </div>
          <span style={{ color:"#fff", fontSize:13, fontWeight:700 }}>{sizeRounded}</span>
        </div>
        {/* Ocean */}
        <div
          onClick={handleOceanClick}
          onTouchStart={handleOceanTouch}
          onTouchMove={handleOceanTouch}
          style={{ background:"linear-gradient(180deg, #0c4a6e, #164e63, #0a3d5c)", borderRadius:16,
            width:"100%", paddingBottom:"80%", position:"relative",
            overflow:"hidden", border:"2px solid #22d3ee", touchAction:"none" }}>
          {/* Wave */}
          <div style={{ position:"absolute", top:0, left:0, right:0, height:8,
            background:"linear-gradient(90deg, rgba(34,211,238,0.5), rgba(34,211,238,0.15), rgba(34,211,238,0.5))",
            animation:"ll-pulse 2s ease-in-out infinite" }} />
          {/* Seaweed */}
          {[8,25,50,72,90].map((x,i) => (
            <div key={`w${i}`} style={{ position:"absolute", bottom:0, left:`${x}%`, fontSize:16+i*3,
              opacity:0.35, animation:`ll-pulse ${2+i*0.4}s ease-in-out infinite` }}>🌿</div>
          ))}
          {/* Bubbles decoration */}
          {[0,1,2].map(i => (
            <div key={`db${i}`} style={{ position:"absolute", bottom:`${10+i*25}%`, left:`${20+i*25}%`,
              fontSize:10, opacity:0.25, animation:`ll-bubble-rise ${3+i}s ease-in-out ${i}s infinite` }}>🫧</div>
          ))}
          {/* Power up message */}
          {fishPowerMsg && (
            <div style={{ position:"absolute", top:"40%", left:"50%", transform:"translate(-50%,-50%)",
              fontSize:20, fontWeight:900, color:"#4ade80", textShadow:"0 0 10px #22c55e",
              animation:"ll-float-up 0.6s ease-out forwards", zIndex:15, pointerEvents:"none" }}>
              {fishPowerMsg}
            </div>
          )}
          {/* Player fish */}
          <div style={{ position:"absolute", left:`${fishPos.x}%`, top:`${fishPos.y}%`,
            fontSize: 20 + sizeRounded * 4, zIndex:5,
            transition:"left 0.15s ease-out, top 0.15s ease-out, font-size 0.3s",
            transform:"translateX(-50%) translateY(-50%)",
            filter:"drop-shadow(0 0 8px rgba(34,211,238,0.6))",
            animation:"ll-swim 1.5s ease-in-out infinite" }}>
            🐠
          </div>
          {/* Enemy fish */}
          {fishEnemies.map(enemy => {
            const isSmaller = enemy.size < fishSize;
            const isBigger = enemy.size > fishSize + 0.5;
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
                <div style={{ position:"absolute", top:-14, left:"50%", transform:"translateX(-50%)",
                  fontSize:10, fontWeight:800, whiteSpace:"nowrap",
                  color: isSmaller ? "#4ade80" : isBigger ? "#fca5a5" : "#fde68a",
                  textShadow:"0 1px 3px rgba(0,0,0,0.9)",
                  background: isSmaller ? "rgba(34,197,94,0.4)" : isBigger ? "rgba(239,68,68,0.4)" : "rgba(251,191,36,0.3)",
                  padding:"2px 6px", borderRadius:4 }}>
                  {isSmaller ? "EAT" : isBigger ? "DANGER" : "SAME"}
                </div>
              </div>
            );
          })}
          {/* Math bonus bubble */}
          {fishMathBubble && !fishDone && (
            <div style={{ position:"absolute", left:`${fishMathBubble.x}%`, top:`${fishMathBubble.y}%`,
              transform:"translate(-50%,-50%)", zIndex:10, display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
              <div style={{ background:"rgba(251,191,36,0.4)", borderRadius:14, padding:"6px 14px",
                color:"#fbbf24", fontWeight:800, fontSize:14, border:"2px solid rgba(251,191,36,0.7)",
                animation:"ll-pulse 1.2s ease-in-out infinite", whiteSpace:"nowrap",
                boxShadow:"0 0 20px rgba(251,191,36,0.3)" }}>
                BONUS: {fishMathBubble.question} = ?
              </div>
              <div style={{ display:"flex", gap:8 }}>
                {fishMathBubble.choices.map((c, ci) => (
                  <button key={ci} onClick={(e) => { e.stopPropagation();
                    if (c === fishMathBubble.answer) {
                      setFishSize(s => Math.min(10, s + 2)); setFishScore(s => s + 50);
                      setFishPowerMsg("POWER UP! +2 Size!");
                      setTimeout(() => setFishPowerMsg(null), 800);
                      if (isLucaMode) speakText("Power up!");
                    } else {
                      setFishSize(s => Math.max(0.5, s - 1));
                      setFishFlashRed(true);
                      setTimeout(() => setFishFlashRed(false), 300);
                    }
                    setFishMathBubble(null);
                  }} style={{ minWidth:60, minHeight:60, borderRadius:14, border:"3px solid rgba(251,191,36,0.7)",
                    background:"rgba(59,130,246,0.8)", color:"#fff", fontSize:20, fontWeight:800, cursor:"pointer" }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Win overlay */}
          {fishSize >= 10 && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
              background:"rgba(0,0,0,0.6)", zIndex:20 }}>
              <div style={{ textAlign:"center", color:"#fbbf24" }}>
                <div style={{ fontSize:48 }}>🎉🐠</div>
                <div style={{ fontSize:28, fontWeight:800 }}>BIGGEST FISH!</div>
                <div style={{ fontSize:18, marginTop:4 }}>Score: {fishScore} | ⭐ {fishStarsEarned} Stars!</div>
              </div>
            </div>
          )}
          {/* Game over overlay */}
          {fishGameOver && fishSize < 10 && (
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
          Tap or drag to swim! Eat smaller fish (EAT label) — avoid bigger fish (DANGER label)!
        </div>
        {/* D-pad controls */}
        <div style={{ display:"flex", justifyContent:"center", marginTop:8 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:6, width:210 }}>
            <div />
            <button onClick={() => setFishPos(p => ({...p, y:Math.max(5,p.y-8)}))}
              style={{ minHeight:60, minWidth:60, fontSize:24, background:"#0369a1",
                border:"2px solid #22d3ee", borderRadius:12, color:"#fff", cursor:"pointer" }}>⬆️</button>
            <div />
            <button onClick={() => setFishPos(p => ({...p, x:Math.max(5,p.x-8)}))}
              style={{ minHeight:60, minWidth:60, fontSize:24, background:"#0369a1",
                border:"2px solid #22d3ee", borderRadius:12, color:"#fff", cursor:"pointer" }}>⬅️</button>
            <div style={{ minHeight:60, minWidth:60, display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:22, color:"rgba(255,255,255,0.3)" }}>🐠</div>
            <button onClick={() => setFishPos(p => ({...p, x:Math.min(95,p.x+8)}))}
              style={{ minHeight:60, minWidth:60, fontSize:24, background:"#0369a1",
                border:"2px solid #22d3ee", borderRadius:12, color:"#fff", cursor:"pointer" }}>➡️</button>
            <div />
            <button onClick={() => setFishPos(p => ({...p, y:Math.min(90,p.y+8)}))}
              style={{ minHeight:60, minWidth:60, fontSize:24, background:"#0369a1",
                border:"2px solid #22d3ee", borderRadius:12, color:"#fff", cursor:"pointer" }}>⬇️</button>
            <div />
          </div>
        </div>
        {/* Collect stars */}
        {fishDone && (
          <div style={{ textAlign:"center", marginTop:12 }}>
            <GameBtn color="#22c55e" onClick={() => {
              addStars(fishStarsEarned);
              if (fbSet && profile?.name) fbSet(`gameHistory/${profile.name}/${Date.now()}`, { game:'fish', score:fishScore, stars:fishStarsEarned, timestamp:new Date().toISOString(), profile:profile.name });
              transitionTo("mini_games");
            }} style={{ minHeight:80, fontSize:20 }}>
              Collect ⭐ {fishStarsEarned} Stars!
            </GameBtn>
            <GameBtn color="#3b82f6" onClick={() => {
              setFishSize(3); setFishPos({x:50,y:50}); setFishEnemies([]); setFishScore(0);
              setFishActive(true); setFishGameOver(false); setFishMathBubble(null);
            }} style={{ marginTop:8, minHeight:60, fontSize:18 }}>
              Play Again 🔄
            </GameBtn>
          </div>
        )}
      </div>
    </div>
  );
}
