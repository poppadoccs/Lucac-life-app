import { useState } from "react";

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

// ─── BOARD GAME (Potion Brewing) ─────────────────────────
// Currently renders the Potion Brewing game. Will be replaced
// with the Monopoly-style family board game in Phase 4.
export default function BoardGame({ profile, kidsData, fbSet, addStars, transitionTo, curriculum }) {
  const { mathDifficulty } = curriculum;

  const [potionRound, setPotionRound] = useState(() => {
    return 1;
  });
  const [potionScore, setPotionScore] = useState(0);
  const [potionProblems, setPotionProblems] = useState(() => {
    const l = generateMathProblem(mathDifficulty);
    const r = generateMathProblem(mathDifficulty);
    return { left: l, right: r };
  });
  const [potionChosen, setPotionChosen] = useState(null);
  const [potionResult, setPotionResult] = useState(null);
  const [potionComplete, setPotionComplete] = useState(false);

  const potionStarsEarned = potionScore >= 5 ? 3 : potionScore >= 3 ? 2 : 1;

  const containerStyle = {
    position: "relative", minHeight: 500, borderRadius: 16, overflow: "hidden",
    overflowX: "hidden", maxWidth: "100vw", width: "100%", boxSizing: "border-box",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    animation: "ll-fade-in 0.4s ease-out", opacity: 1, transition: "opacity 0.3s",
  };

  return (
    <div style={containerStyle}>
      <div style={{ minHeight:500, background:"linear-gradient(180deg, #2d1b4e, #1e1040, #2d1b4e)", padding:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <GameBtn color="#475569" onClick={() => transitionTo("mini_games")}>← Back</GameBtn>
          <div style={{ color:"#fbbf24", fontWeight:700, fontSize:16 }}>Round {potionRound}/5 | Score: {potionScore}</div>
        </div>
        <div style={{ textAlign:"center", marginBottom:16 }}>
          <div style={{ fontSize:60, animation: potionResult === "correct" ? "ll-jump 0.5s ease-out" : potionResult === "wrong" ? "ll-shake 0.5s" : "ll-pulse 1.5s ease-in-out infinite",
            filter: potionResult === "correct" ? "drop-shadow(0 0 20px gold)" : "none" }}>🧪</div>
          <div style={{ fontSize:18, fontWeight:700, color:"#c084fc", marginTop:4 }}>Pick the STRONGER potion!</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)" }}>(Higher answer = stronger)</div>
          {potionResult === "correct" && <div style={{ fontSize:16, color:"#fbbf24", fontWeight:700, marginTop:4, animation:"ll-float-up 1s ease-out" }}>POWERFUL BREW!</div>}
          {potionResult === "wrong" && <div style={{ fontSize:16, color:"rgba(255,255,255,0.5)", marginTop:4 }}>Weak potion...</div>}
        </div>
        {!potionComplete && potionProblems && (
          <div style={{ display:"flex", gap:16, justifyContent:"center", marginTop:20 }}>
            {[{side:"left",p:potionProblems.left,color:"#a855f7"},{side:"right",p:potionProblems.right,color:"#22c55e"}].map(({side,p,color}) => (
              <div key={side} onClick={() => {
                if (potionChosen) return;
                setPotionChosen(side);
                const leftAns = potionProblems.left.answer;
                const rightAns = potionProblems.right.answer;
                const correct = side === "left" ? leftAns >= rightAns : rightAns >= leftAns;
                setPotionResult(correct ? "correct" : "wrong");
                if (correct) setPotionScore(s => s + 1);
                setTimeout(() => {
                  if (potionRound >= 5) { setPotionComplete(true); return; }
                  const l = generateMathProblem(mathDifficulty), r = generateMathProblem(mathDifficulty);
                  setPotionProblems({ left: l, right: r });
                  setPotionRound(rnd => rnd + 1); setPotionChosen(null); setPotionResult(null);
                }, 1500);
              }} style={{
                background: potionChosen === side ? (potionResult === "correct" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.15)") : `${color}22`,
                border: `3px solid ${potionChosen === side ? (potionResult === "correct" ? "#22c55e" : "#ef4444") : color}`,
                borderRadius:20, padding:"24px 16px", flex:1, maxWidth:200, textAlign:"center",
                cursor: potionChosen ? "default" : "pointer", minHeight:140 }}>
                <div style={{ fontSize:40 }}>🧪</div>
                <div style={{ fontSize:24, fontWeight:800, color:"#fff", marginTop:8 }}>{p.question}</div>
                {potionChosen && <div style={{ fontSize:18, color:"#fbbf24", marginTop:8, fontWeight:700 }}>= {p.answer}</div>}
              </div>
            ))}
          </div>
        )}
        {potionComplete && (
          <div style={{ textAlign:"center", marginTop:20 }}>
            <div style={{ fontSize:28, fontWeight:800, color:"#fbbf24" }}>Brewing Complete!</div>
            <div style={{ fontSize:18, color:"#fff", marginTop:8 }}>{potionScore}/5 powerful potions brewed!</div>
            <div style={{ fontSize:40, marginTop:8 }}>{"⭐".repeat(potionStarsEarned)}</div>
            <GameBtn color="#22c55e" onClick={() => {
              addStars(potionStarsEarned);
              if (fbSet && profile?.name) fbSet(`gameHistory/${profile.name}/${Date.now()}`, { game:'potion', score:potionScore*50, stars:potionStarsEarned, timestamp:new Date().toISOString(), profile:profile.name });
              transitionTo("mini_games");
            }} style={{ marginTop:12, minHeight:80, fontSize:20 }}>
              Collect ⭐ {potionStarsEarned} Stars!
            </GameBtn>
          </div>
        )}
      </div>
    </div>
  );
}
