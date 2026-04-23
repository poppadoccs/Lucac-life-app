import { useState } from "react";
import RPGCore from "./games/RPGCore";

// ─── KEYFRAMES CSS (used by menu screen animations) ──────
const KEYFRAMES_CSS = `
@keyframes ll-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
@keyframes ll-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
@keyframes ll-fade-in { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
`;

// ─── AVATAR (used by menu screen) ────────────────────────
function Avatar({ emoji, emotion, anim, size = 60, style: extraStyle }) {
  const face = emotion === "happy" ? "😊" : emotion === "victorious" ? "🎉" : null;
  let animName = "none";
  if (anim === "bounce") animName = "ll-bounce 0.6s ease-in-out infinite";
  if (anim === "pulse") animName = "ll-pulse 1s ease-in-out infinite";
  return (
    <div style={{ position: "relative", display: "inline-block", animation: animName, ...extraStyle }}>
      <div style={{ fontSize: size, lineHeight: 1 }}>{emoji}</div>
      {face && (
        <div style={{ position: "absolute", bottom: -4, right: -4, fontSize: size * 0.4,
          background: "rgba(0,0,0,0.5)", borderRadius: "50%", width: size * 0.45, height: size * 0.45,
          display: "flex", alignItems: "center", justifyContent: "center" }}>{face}</div>
      )}
    </div>
  );
}

// ─── GAME BUTTON (used by menu screen) ───────────────────
function GameBtn({ children, onClick, color, big, style: extra }) {
  const bg = color || "#3b82f6";
  return (
    <button onClick={onClick} style={{
      background: bg, color: "#fff", border: "none", borderRadius: 12,
      padding: big ? "16px 24px" : "12px 18px", fontSize: big ? 20 : 16,
      fontWeight: 700, cursor: "pointer", minHeight: 48, minWidth: 48,
      textAlign: "center", boxShadow: `0 4px 12px ${bg}66`,
      transition: "all 0.2s", width: "100%", ...extra,
    }}>{children}</button>
  );
}

// ═══════════════════════════════════════════════════════════
// LUCAC LEGENDS — Thin Navigation Shell (under 200 lines)
// All game logic lives in src/games/. This shell owns ONLY:
//   menu screen, curriculum, addStars, transitionTo, RPGCore delegation
// ═══════════════════════════════════════════════════════════

export default function LucacLegends({ profile, kidsData, fbSet, learningStats = {}, curriculumData = {}, rewardsConfig = [] }) {
  const [screen, setScreen] = useState("menu");
  const [fadeIn, setFadeIn] = useState(true);
  const [starsEarned, setStarsEarned] = useState(0);
  const [totalStarsSession, setTotalStarsSession] = useState(0);
  const [worldsCompleted, setWorldsCompleted] = useState([]);

  // ─── Curriculum (D-04 + S04: shell-computed metadata + Firebase parent-set focus) ──
  const kidAge = profile?.name === "Luca" ? 6 : profile?.name === "Yana" ? 8 : 7;
  const isLucaMode = kidAge <= 7;
  const mathDifficulty = isLucaMode ? "easy" : "hard";
  const kidCurriculum = curriculumData?.[profile?.name] || {};
  const curriculum = {
    isLucaMode, mathDifficulty, kidAge,
    activeSubjects: kidCurriculum.activeSubjects || [],
    mastery: kidCurriculum.mastery || {},
  };

  const playerName = profile?.name || "Hero";
  const playerEmoji = profile?.emoji || "🦸";
  const kd = kidsData?.[playerName] || {};
  const currentPoints = kd.points || 0;

  // ─── addStars: shell owns the Firebase write ────────────
  // S04: optional `reason` is logged to kidsData/{name}/starLog/{ts} so the
  // Parent Dashboard can show "this week" earnings + reasons. Earning is
  // tied to session/page/level completion, NOT per correct answer.
  function addStars(n, reason = "") {
    if (!n) return;
    setStarsEarned(s => s + n);
    setTotalStarsSession(s => s + n);
    if (fbSet && kidsData && profile?.name) {
      const ts = Date.now();
      const newLog = { ...(kd.starLog || {}), [ts]: { amount: n, reason: reason || "session" } };
      const updated = { ...kd, points: (kd.points || 0) + n, starLog: newLog };
      fbSet("kidsData", { ...kidsData, [profile.name]: updated });
    }
  }

  // ─── transitionTo: shell owns fade animation ─────────────
  function transitionTo(newScreen) {
    setFadeIn(false);
    setTimeout(() => { setScreen(newScreen); setFadeIn(true); }, 300);
  }

  const fadeStyle = {
    animation: fadeIn ? "ll-fade-in 0.4s ease-out" : "none",
    opacity: fadeIn ? 1 : 0,
    transition: "opacity 0.3s",
  };
  const containerStyle = {
    position: "relative", minHeight: 500, borderRadius: 16, overflow: "hidden",
    overflowX: "hidden", maxWidth: "100vw", width: "100%", boxSizing: "border-box",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", ...fadeStyle,
  };

  // ─── MENU SCREEN (the only screen the shell renders) ─────
  if (screen === "menu") {
    return (
      <>
        <style>{KEYFRAMES_CSS}</style>
        <div style={containerStyle}>
          <div style={{ position: "relative", minHeight: 500,
            background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)", padding: 20 }}>
            {/* Decorative stars */}
            {[0,1,2,3,4,5,6,7].map(i => (
              <div key={i} style={{ position: "absolute",
                top: `${10 + (i * 13) % 60}%`, left: `${5 + (i * 17) % 90}%`,
                fontSize: 14 + (i % 3) * 6, opacity: 0.3,
                animation: `ll-pulse ${2 + i * 0.3}s ease-in-out ${i * 0.2}s infinite` }}>✨</div>
            ))}
            <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
              {/* Title */}
              <div style={{ fontSize: 32, fontWeight: 900, color: "#fbbf24",
                textShadow: "0 0 20px rgba(251,191,36,0.5), 2px 2px 0 #92400e",
                marginBottom: 8, letterSpacing: 2 }}>LUCAC LEGENDS</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 20 }}>An Epic Adventure Awaits</div>
              {/* Avatar */}
              <div style={{ marginBottom: 16 }}>
                <Avatar emoji={playerEmoji} emotion="idle" anim="pulse" size={70} />
                <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginTop: 8 }}>{playerName}</div>
                <div style={{ fontSize: 14, color: "#fbbf24" }}>⭐ {currentPoints} stars</div>
              </div>
              {/* Main buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 300, margin: "0 auto" }}>
                <GameBtn color="#22c55e" big onClick={() => transitionTo("world_select")}>⚔️ Start Adventure</GameBtn>
                <GameBtn color="#3b82f6" big onClick={() => transitionTo("mini_games")}>🎮 Mini Games</GameBtn>
                <GameBtn color="#8b5cf6" onClick={() => transitionTo("store")}>🏪 Star Store</GameBtn>
                <GameBtn color="#f59e0b" onClick={() => transitionTo("chores")}>📋 My Chores</GameBtn>
              </div>
              {/* Quick stats */}
              <div style={{ marginTop: 20, display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 14px" }}>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Worlds Beaten</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#22c55e" }}>{worldsCompleted.length}</div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 14px" }}>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Stars Today</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#fbbf24" }}>{totalStarsSession}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── Everything else delegates to RPGCore ────────────────
  const rpgProps = { profile, kidsData, fbSet, addStars, transitionTo, curriculum, learningStats, rewardsConfig, initialScreen: screen };
  return (
    <>
      <style>{KEYFRAMES_CSS}</style>
      <RPGCore {...rpgProps} />
    </>
  );
}
