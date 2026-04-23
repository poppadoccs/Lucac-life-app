import { useState, useEffect, useRef } from "react";
import { getDatabase, ref, onValue } from "firebase/database";
import { generateMathProblem, GameBtn, recordGameHistory, ageBandFromProfile } from "./_shared";

// ─── CONSTANTS ───────────────────────────────────────────

const CARS = ["🏎️", "🏁", "🚗", "🚙", "🚕", "🚓"];

const TRACKS = {
  highway: {
    name: "Highway 🛣️",
    bg: "linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)",
    trackColor: "#374151",
    softObstacles: ["🚧", "🛢️"],
    hardObstacles: ["🪨", "🌳"],
  },
  beach: {
    name: "Beach 🏖️",
    bg: "linear-gradient(180deg, #0ea5e9 0%, #38bdf8 35%, #fde68a 65%, #d97706 100%)",
    trackColor: "#d4a574",
    softObstacles: ["🪣", "🏐"],
    hardObstacles: ["🌴", "🪨"],
  },
  mountain: {
    name: "Mountain 🏔️",
    bg: "linear-gradient(180deg, #2563eb 0%, #7c3aed 40%, #4b5563 70%, #374151 100%)",
    trackColor: "#4b5563",
    softObstacles: ["❄️", "🎋"],
    hardObstacles: ["🌲", "🪨"],
  },
};

const POWERUP_TYPES = ["nitro", "shield", "magnet"];
const POWERUP_EMOJI = { nitro: "⚡", shield: "🛡️", magnet: "🧲" };
const LANE_X = [15, 50, 85];

// ─── RACING GAME ─────────────────────────────────────────

export default function RacingGame({ profile, kidsData, fbSet, addStars, transitionTo, curriculum }) {
  const { mathDifficulty } = curriculum;
  const ageBand = ageBandFromProfile(profile);
  const isLucaMode = ageBand === "luca";
  const MAX_HITS = isLucaMode ? 8 : 5;
  const SPEED_MAX = isLucaMode ? 4 : 6;

  // ─── Screen ───────────────────────────────────────────
  const [screen, setScreen] = useState("menu"); // "menu" | "race" | "gameover"

  // ─── Menu state ───────────────────────────────────────
  const savedCar = kidsData?.[profile?.name]?.favoriteCar || CARS[0];
  const [selectedCar, setSelectedCar] = useState(savedCar);
  const [selectedTrack, setSelectedTrack] = useState("highway");
  const [leaderboard, setLeaderboard] = useState({ yana: [], luca: [] });

  // ─── Race state ───────────────────────────────────────
  const [raceLane, setRaceLane] = useState(1);
  const [raceSpeed, setRaceSpeed] = useState(0);
  const [raceScore, setRaceScore] = useState(0);
  const [raceActive, setRaceActive] = useState(false);
  const [raceObstacles, setRaceObstacles] = useState([]);
  const [raceStarPickups, setRaceStarPickups] = useState([]);
  const [racePowerupItems, setRacePowerupItems] = useState([]);
  const [raceHits, setRaceHits] = useState(0);
  const [raceMathBarrier, setRaceMathBarrier] = useState(null);
  const [raceShake, setRaceShake] = useState(false);
  const [raceFrozen, setRaceFrozen] = useState(false);
  const [raceRoadOffset, setRaceRoadOffset] = useState(0);
  const [distance, setDistance] = useState(0);

  // ─── Power-up state ───────────────────────────────────
  const [nitroActive, setNitroActive] = useState(false);
  const [shieldActive, setShieldActive] = useState(false);
  const [magnetActive, setMagnetActive] = useState(false);
  const [slowPenalty, setSlowPenalty] = useState(false);

  // ─── Toast ───────────────────────────────────────────
  const [toast, setToast] = useState(null);

  // ─── Refs (stable across re-renders inside rAF) ───────
  const raceAnimRef = useRef(null);
  const raceSpeedRef = useRef(0);
  const gasRef = useRef(false);
  const brakeRef = useRef(false);
  const lastBarrierTimeRef = useRef(Date.now() - 10000);
  const lastObstacleTimeRef = useRef(Date.now());
  const lastStarTimeRef = useRef(Date.now());
  const lastPowerupTimeRef = useRef(Date.now() - 8000);
  // Mutable game flags read inside rAF without stale closures
  const shieldRef = useRef(false);
  const magnetRef = useRef(false);
  const nitroRef = useRef(false);
  const slowRef = useRef(false);
  const hitInvincibleUntilRef = useRef(0);

  // Keep refs in sync with state
  useEffect(() => { raceSpeedRef.current = raceSpeed; }, [raceSpeed]);
  useEffect(() => { shieldRef.current = shieldActive; }, [shieldActive]);
  useEffect(() => { magnetRef.current = magnetActive; }, [magnetActive]);
  useEffect(() => { nitroRef.current = nitroActive; }, [nitroActive]);
  useEffect(() => { slowRef.current = slowPenalty; }, [slowPenalty]);

  // ─── Leaderboard load ─────────────────────────────────
  useEffect(() => {
    const db = getDatabase();
    const unsubs = ["yana", "luca"].map(name => {
      const r = ref(db, `gameHistory/${name}`);
      return onValue(r, snap => {
        const data = snap.val() || {};
        const races = Object.values(data)
          .filter(e => e.game === "racing")
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);
        setLeaderboard(prev => ({ ...prev, [name]: races }));
      });
    });
    return () => unsubs.forEach(u => u());
  }, []);

  // ─── Game-over trigger (avoid setState-in-render) ─────
  useEffect(() => {
    if (raceHits >= MAX_HITS && raceActive) {
      setRaceActive(false);
      setScreen("gameover");
    }
  }, [raceHits, raceActive, MAX_HITS]);

  // ─── Toast helper ─────────────────────────────────────
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  // ─── Start race ───────────────────────────────────────
  const startRace = () => {
    if (fbSet && profile?.name) fbSet(`kidsData/${profile.name}/favoriteCar`, selectedCar);
    setRaceLane(1);
    setRaceSpeed(0);
    setRaceScore(0);
    setRaceHits(0);
    setRaceObstacles([]);
    setRaceStarPickups([]);
    setRacePowerupItems([]);
    setRaceMathBarrier(null);
    setRaceFrozen(false);
    setRaceShake(false);
    setDistance(0);
    setNitroActive(false); nitroRef.current = false;
    setShieldActive(false); shieldRef.current = false;
    setMagnetActive(false); magnetRef.current = false;
    setSlowPenalty(false); slowRef.current = false;
    lastBarrierTimeRef.current = Date.now() - 10000;
    lastObstacleTimeRef.current = Date.now();
    lastStarTimeRef.current = Date.now();
    lastPowerupTimeRef.current = Date.now() - 8000;
    hitInvincibleUntilRef.current = 0;
    setRaceActive(true);
    setScreen("race");
  };

  // ─── Animation loop ────────────────────────────────────
  useEffect(() => {
    if (!raceActive) return;
    const track = TRACKS[selectedTrack];
    const MOVE_MULT = 0.8;

    const loop = () => {
      const isFrozen = raceFrozen;
      const isSlow = slowRef.current;
      const isNitro = nitroRef.current;

      // Speed update
      if (gasRef.current && !isFrozen) {
        const boost = isNitro ? 0.3 : 0.1;
        const cap = isSlow
          ? (isLucaMode ? SPEED_MAX * 0.7 : SPEED_MAX * 0.5)
          : isNitro ? Math.min(SPEED_MAX + 2, 8)
          : SPEED_MAX;
        setRaceSpeed(s => Math.min(cap, s + boost));
      } else if (brakeRef.current) {
        setRaceSpeed(s => Math.max(0, s - 0.3));
      } else if (!isFrozen) {
        // Auto-accelerate to a base speed; drag more if slow penalty
        const drag = isSlow ? 0.2 : 0.03;
        const floor = isSlow ? 0 : 1.5; // car always rolls at min 1.5
        setRaceSpeed(s => Math.max(floor, s - drag));
      }

      const spd = raceSpeedRef.current;
      setRaceRoadOffset(o => (o + spd * 3) % 40);
      setDistance(d => d + spd * 0.1);

      // ── Obstacles ──────────────────────────────────────
      setRaceObstacles(obs => {
        const next = [];
        for (const o of obs) {
          const ny = o.y + spd * MOVE_MULT;
          if (ny > 110) continue;
          if (ny > 75 && ny < 95 && o.lane === raceLane) {
            if (shieldRef.current) {
              setShieldActive(false); shieldRef.current = false;
              setToast("🛡️ Shield blocked!");
              continue;
            }
            if (o.type === "soft") {
              // Cones / barrels — break harmlessly, tiny score
              setRaceScore(sc => sc + 5);
              continue;
            } else {
              // Rocks / trees — slow penalty (skip if invincible)
              if (Date.now() < hitInvincibleUntilRef.current) {
                next.push({ ...o, y: ny });
                continue;
              }
              hitInvincibleUntilRef.current = Date.now() + 1500;
              const dur = isLucaMode ? 1500 : 3000;
              setSlowPenalty(true); slowRef.current = true;
              setTimeout(() => { setSlowPenalty(false); slowRef.current = false; }, dur);
              setRaceScore(sc => Math.max(0, sc - 30));
              setRaceHits(h => h + 1);
              setRaceShake(true);
              setTimeout(() => setRaceShake(false), 400);
              continue;
            }
          }
          next.push({ ...o, y: ny });
        }
        return next;
      });

      // ── Star pickups ────────────────────────────────────
      setRaceStarPickups(stars => {
        const next = [];
        for (const s of stars) {
          const ny = s.y + spd * MOVE_MULT;
          if (ny > 110) continue;
          // Magnet: wider catch window
          const collected = magnetRef.current
            ? ny > 40 && s.lane === raceLane
            : ny > 75 && ny < 95 && s.lane === raceLane;
          if (collected) { setRaceScore(sc => sc + 25); continue; }
          next.push({ ...s, y: ny });
        }
        return next;
      });

      // ── Power-up items ──────────────────────────────────
      setRacePowerupItems(items => {
        const next = [];
        for (const p of items) {
          const ny = p.y + spd * MOVE_MULT;
          if (ny > 110) continue;
          if (ny > 75 && ny < 95 && p.lane === raceLane) {
            if (p.powerup === "nitro") {
              setNitroActive(true); nitroRef.current = true;
              setTimeout(() => { setNitroActive(false); nitroRef.current = false; }, 3000);
              setToast("⚡ Nitro! 3s boost!");
            } else if (p.powerup === "shield") {
              setShieldActive(true); shieldRef.current = true;
              setToast("🛡️ Shield ready!");
            } else if (p.powerup === "magnet") {
              setMagnetActive(true); magnetRef.current = true;
              setTimeout(() => { setMagnetActive(false); magnetRef.current = false; }, 5000);
              setToast("🧲 Magnet! 5s!");
            }
            continue;
          }
          next.push({ ...p, y: ny });
        }
        return next;
      });

      const now = Date.now();

      // Spawn obstacle
      if (now - lastObstacleTimeRef.current > 2800 && spd > 1) {
        lastObstacleTimeRef.current = now;
        const lane = Math.floor(Math.random() * 3);
        const isSoftSpawn = Math.random() > 0.4;
        const src = isSoftSpawn ? track.softObstacles : track.hardObstacles;
        const emoji = src[Math.floor(Math.random() * src.length)];
        setRaceObstacles(obs => [...obs, { id: now, lane, y: -10, emoji, type: isSoftSpawn ? "soft" : "hard" }]);
      }

      // Spawn star
      if (now - lastStarTimeRef.current > 3000 && spd > 0.5) {
        lastStarTimeRef.current = now;
        const lane = Math.floor(Math.random() * 3);
        setRaceStarPickups(s => [...s, { id: now, lane, y: -10 }]);
      }

      // Spawn power-up
      if (now - lastPowerupTimeRef.current > 12000 && spd > 1) {
        lastPowerupTimeRef.current = now;
        const lane = Math.floor(Math.random() * 3);
        const powerup = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
        setRacePowerupItems(p => [...p, { id: now, lane, y: -10, powerup }]);
      }

      // Math barrier
      if (now - lastBarrierTimeRef.current > 20000 && spd > 2 && !raceMathBarrier) {
        lastBarrierTimeRef.current = now;
        const prob = generateMathProblem(mathDifficulty);
        setRaceMathBarrier(prob);
        setRaceFrozen(true);
        setRaceSpeed(0);
      }

      raceAnimRef.current = requestAnimationFrame(loop);
    };

    raceAnimRef.current = requestAnimationFrame(loop);
    return () => { if (raceAnimRef.current) cancelAnimationFrame(raceAnimRef.current); };
  }, [raceActive, raceLane, raceFrozen, mathDifficulty, selectedTrack, isLucaMode, SPEED_MAX]);

  // ─── Math barrier answer ──────────────────────────────
  const handleMathAnswer = (c) => {
    if (c === raceMathBarrier.answer) {
      setRaceScore(s => s + 100);
      setRaceSpeed(5);
      if (isLucaMode) {
        // Auto-nitro for Luca on correct answer
        setNitroActive(true); nitroRef.current = true;
        setTimeout(() => { setNitroActive(false); nitroRef.current = false; }, 3000);
        showToast("⚡ Auto-Nitro! Great job!");
      }
    } else {
      // Wrong: speed drops 50% for 3s, no permanent freeze
      setRaceSpeed(s => s * 0.5);
      setSlowPenalty(true); slowRef.current = true;
      setTimeout(() => { setSlowPenalty(false); slowRef.current = false; }, 3000);
    }
    setRaceMathBarrier(null);
    setRaceFrozen(false);
  };

  // ─── Collect stars + save history ────────────────────
  const raceStarsEarned = raceScore <= 100 ? 1 : raceScore <= 300 ? 2 : 3;

  const handleCollect = () => {
    addStars(raceStarsEarned);
    recordGameHistory(fbSet, profile, "racing", raceScore, raceStarsEarned, {
      track: selectedTrack,
      car: selectedCar,
      distance: Math.round(distance),
    });
    setScreen("menu");
    setRaceActive(false);
  };

  const track = TRACKS[selectedTrack];
  const speedInt = Math.round(raceSpeed);

  // ─────────────────────────────────────────────────────
  // RENDER: MENU
  // ─────────────────────────────────────────────────────
  if (screen === "menu") {
    return (
      <div style={{
        minHeight: 500, background: "#0f172a", padding: "12px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#fff",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <GameBtn color="#475569" onClick={() => transitionTo("mini_games")}
            style={{ width: "auto", padding: "8px 14px", minHeight: 44 }}>← Back</GameBtn>
          <div style={{ fontWeight: 800, fontSize: 18 }}>🏎️ Racing Game</div>
        </div>

        {/* Car picker */}
        <div style={{ background: "#1e293b", borderRadius: 12, padding: "12px", marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "#94a3b8" }}>CHOOSE YOUR CAR</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
            {CARS.map(car => (
              <button key={car} onClick={() => setSelectedCar(car)} style={{
                fontSize: 26, padding: "8px 4px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                border: `3px solid ${selectedCar === car ? "#fbbf24" : "transparent"}`,
                background: selectedCar === car ? "rgba(251,191,36,0.2)" : "rgba(255,255,255,0.05)",
              }}>
                {car}
                {selectedCar === car && <div style={{ fontSize: 9, color: "#fbbf24", fontWeight: 700, marginTop: 1 }}>PICK!</div>}
              </button>
            ))}
          </div>
        </div>

        {/* Track picker */}
        <div style={{ background: "#1e293b", borderRadius: 12, padding: "12px", marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "#94a3b8" }}>CHOOSE TRACK</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {Object.entries(TRACKS).map(([key, t]) => (
              <button key={key} onClick={() => setSelectedTrack(key)} style={{
                padding: "10px 6px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                border: `3px solid ${selectedTrack === key ? "#fbbf24" : "transparent"}`,
                background: selectedTrack === key ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.05)",
              }}>
                <div style={{ height: 28, borderRadius: 6, background: t.bg, marginBottom: 4 }} />
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 11 }}>{t.name}</div>
                {selectedTrack === key && <div style={{ fontSize: 9, color: "#fbbf24", fontWeight: 700, marginTop: 2 }}>SELECTED</div>}
              </button>
            ))}
          </div>
        </div>

        {/* Leaderboard — text-labeled columns, not color-only */}
        <div style={{ background: "#1e293b", borderRadius: 12, padding: "12px", marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "#94a3b8" }}>TOP SCORES 🏆</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {["yana", "luca"].map(name => (
              <div key={name}>
                <div style={{ fontWeight: 800, fontSize: 13, color: "#fbbf24", marginBottom: 4 }}>
                  {name === "yana" ? "Yana 👧" : "Luca 👦"}
                </div>
                {leaderboard[name].length === 0
                  ? <div style={{ fontSize: 11, color: "#475569" }}>No races yet</div>
                  : leaderboard[name].map((r, i) => (
                    <div key={i} style={{
                      fontSize: 11, color: "#cbd5e1",
                      display: "flex", justifyContent: "space-between", padding: "3px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                    }}>
                      <span>{i + 1}. {r.car || "🏎️"} {r.track || ""}</span>
                      <span style={{ fontWeight: 700 }}>{r.score}pts</span>
                    </div>
                  ))
                }
              </div>
            ))}
          </div>
        </div>

        {isLucaMode && (
          <div style={{
            background: "rgba(251,191,36,0.12)", border: "1px solid #fbbf24",
            borderRadius: 8, padding: "6px 10px", marginBottom: 10,
            fontSize: 12, color: "#fbbf24",
          }}>
            ⭐ Luca Mode — softer obstacles, auto-nitro on correct math!
          </div>
        )}

        <GameBtn color="#22c55e" onClick={startRace} big style={{ minHeight: 80, fontSize: 22 }}>
          🏁 Start Race!
        </GameBtn>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────
  // RENDER: RACE + GAMEOVER
  // ─────────────────────────────────────────────────────
  return (
    <div style={{
      position: "relative", minHeight: 500, borderRadius: 16, overflow: "hidden",
      maxWidth: "100vw", width: "100%", boxSizing: "border-box",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      animation: raceShake ? "ll-screen-shake 0.4s" : "none",
    }}>
      <div style={{ minHeight: 500, background: track.bg, padding: 0 }}>

        {/* Header bar */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 12px", flexWrap: "wrap", gap: 4, background: "rgba(0,0,0,0.45)",
        }}>
          <GameBtn color="#475569"
            onClick={() => { setRaceActive(false); transitionTo("mini_games"); }}
            style={{ width: "auto", padding: "8px 14px", minHeight: 44 }}>← Back</GameBtn>
          <div style={{ color: "#fbbf24", fontWeight: 700, fontSize: 13 }}>Score: {raceScore}</div>
          <div style={{ display: "flex", gap: 2 }} aria-label={`${MAX_HITS - raceHits} lives remaining`}>
            {Array.from({ length: MAX_HITS }).map((_, i) => (
              <span key={i} style={{ fontSize: 14 }}>{i < MAX_HITS - raceHits ? "❤️" : "🖤"}</span>
            ))}
          </div>
        </div>

        {/* Active power-up badges — text-labeled */}
        <div style={{ display: "flex", gap: 6, padding: "4px 12px", background: "rgba(0,0,0,0.3)", minHeight: 26 }}>
          {nitroActive && <span style={{ background: "#f59e0b", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, color: "#000" }}>⚡ NITRO</span>}
          {shieldActive && <span style={{ background: "#3b82f6", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>🛡️ SHIELD</span>}
          {magnetActive && <span style={{ background: "#8b5cf6", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>🧲 MAGNET</span>}
          {slowPenalty && <span style={{ background: "#dc2626", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>🐢 SLOWED</span>}
          <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{track.name}</span>
        </div>

        {/* Speed bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 12px" }}>
          <span style={{ color: "#94a3b8", fontSize: 11, minWidth: 44 }}>Speed:</span>
          <div style={{ flex: 1, height: 10, background: "rgba(0,0,0,0.4)", borderRadius: 5, overflow: "hidden" }}>
            <div style={{
              width: `${(raceSpeed / SPEED_MAX) * 100}%`, height: "100%", borderRadius: 5,
              transition: "width 0.1s",
              background: raceSpeed > SPEED_MAX * 0.75
                ? "linear-gradient(90deg, #f59e0b, #ef4444)"
                : "linear-gradient(90deg, #22c55e, #f59e0b)",
            }} />
          </div>
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, minWidth: 16 }}>{speedInt}</span>
        </div>

        {/* Road */}
        <div style={{
          position: "relative", width: "60%", margin: "0 auto", height: 300,
          background: track.trackColor, borderRadius: 8, overflow: "hidden",
          border: "2px solid rgba(255,255,255,0.2)",
        }}>
          {/* Lane markings */}
          <div style={{ position: "absolute", top: 0, bottom: 0, left: -3, width: 4, background: "#22c55e" }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, right: -3, width: 4, background: "#22c55e" }} />
          <div style={{
            position: "absolute", left: "50%", top: 0, bottom: 0, width: 3,
            transform: "translateX(-50%)",
            backgroundImage: `repeating-linear-gradient(0deg, #fbbf24 0px, #fbbf24 20px, transparent 20px, transparent 40px)`,
            backgroundPositionY: raceRoadOffset,
          }} />
          <div style={{ position: "absolute", left: "33.3%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.15)" }} />
          <div style={{ position: "absolute", left: "66.6%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.15)" }} />

          {/* Player car */}
          <div style={{
            position: "absolute", bottom: 20, left: `${LANE_X[raceLane]}%`,
            transform: "translateX(-50%)", fontSize: 36,
            transition: "left 0.15s ease-out", zIndex: 5,
            filter: shieldActive
              ? "drop-shadow(0 0 8px #3b82f6)"
              : nitroActive ? "drop-shadow(0 0 8px #f59e0b)" : "none",
          }}>{selectedCar}</div>

          {/* Obstacles — soft ones shown slightly faded */}
          {raceObstacles.map(o => (
            <div key={o.id} style={{
              position: "absolute", top: `${o.y}%`, left: `${LANE_X[o.lane]}%`,
              transform: "translateX(-50%)", fontSize: 26, zIndex: 3,
              opacity: o.type === "soft" ? 0.8 : 1,
            }}>{o.emoji}</div>
          ))}

          {/* Star pickups */}
          {raceStarPickups.map(s => (
            <div key={s.id} style={{
              position: "absolute", top: `${s.y}%`, left: `${LANE_X[s.lane]}%`,
              transform: "translateX(-50%)", fontSize: 22, zIndex: 3,
            }}>⭐</div>
          ))}

          {/* Power-up items */}
          {racePowerupItems.map(p => (
            <div key={p.id} style={{
              position: "absolute", top: `${p.y}%`, left: `${LANE_X[p.lane]}%`,
              transform: "translateX(-50%)", fontSize: 24, zIndex: 3,
            }}>{POWERUP_EMOJI[p.powerup]}</div>
          ))}

          {/* Toast */}
          {toast && (
            <div style={{
              position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.78)", color: "#fbbf24", fontWeight: 700,
              fontSize: 12, padding: "4px 12px", borderRadius: 8, zIndex: 15, whiteSpace: "nowrap",
            }}>{toast}</div>
          )}

          {/* Math barrier overlay */}
          {raceMathBarrier && (
            <div style={{
              position: "absolute", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 10,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
            }}>
              <div style={{ fontSize: 14, color: "#fbbf24", fontWeight: 700 }}>MATH BARRIER!</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#fff" }}>{raceMathBarrier.question} = ?</div>
              <div style={{ display: "flex", gap: 10 }}>
                {raceMathBarrier.choices.map((c, i) => (
                  <button key={i} onClick={() => handleMathAnswer(c)} style={{
                    minWidth: 64, minHeight: 64, borderRadius: 14,
                    border: "3px solid #fbbf24", background: "rgba(59,130,246,0.85)",
                    color: "#fff", fontSize: 22, fontWeight: 800, cursor: "pointer",
                  }}>{c}</button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Wrong = 3s speed drop</div>
            </div>
          )}

          {/* Game over overlay */}
          {screen === "gameover" && (
            <div style={{
              position: "absolute", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 20,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ fontSize: 48 }}>🏁</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#fbbf24", marginTop: 8 }}>Race Over!</div>
              <div style={{ fontSize: 18, color: "#fff", marginTop: 4 }}>Score: {raceScore}</div>
              <div style={{ fontSize: 13, color: "#94a3b8" }}>Distance: {Math.round(distance)} m</div>
              <div style={{ fontSize: 16, color: "#fbbf24", marginTop: 4 }}>⭐ {raceStarsEarned} Stars!</div>
            </div>
          )}
        </div>

        {/* Controls — ≥ 80px height per spec */}
        {screen !== "gameover" && !raceMathBarrier && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "8px 12px" }}>
              <button onClick={() => setRaceLane(l => Math.max(0, l - 1))} style={{
                minHeight: 64, fontSize: 20, fontWeight: 700,
                background: "#3b82f6", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer",
              }}>⬅ Left</button>
              <button onClick={() => setRaceLane(l => Math.min(2, l + 1))} style={{
                minHeight: 64, fontSize: 20, fontWeight: 700,
                background: "#3b82f6", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer",
              }}>➡ Right</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "0 12px 12px" }}>
              <button
                onTouchStart={() => { gasRef.current = true; }}
                onTouchEnd={() => { gasRef.current = false; }}
                onMouseDown={() => { gasRef.current = true; }}
                onMouseUp={() => { gasRef.current = false; }}
                onMouseLeave={() => { gasRef.current = false; }}
                style={{
                  minHeight: 80, fontSize: 22, fontWeight: 800,
                  background: "linear-gradient(135deg, #16a34a, #22c55e)",
                  color: "#fff", border: "none", borderRadius: 14, cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(34,197,94,0.4)", touchAction: "none",
                }}>🚀 GAS</button>
              <button
                onTouchStart={() => { brakeRef.current = true; }}
                onTouchEnd={() => { brakeRef.current = false; }}
                onMouseDown={() => { brakeRef.current = true; }}
                onMouseUp={() => { brakeRef.current = false; }}
                onMouseLeave={() => { brakeRef.current = false; }}
                style={{
                  minHeight: 80, fontSize: 22, fontWeight: 800,
                  background: "linear-gradient(135deg, #dc2626, #ef4444)",
                  color: "#fff", border: "none", borderRadius: 14, cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(239,68,68,0.4)", touchAction: "none",
                }}>🔴 BRAKE</button>
            </div>
          </>
        )}

        {/* Collect stars */}
        {screen === "gameover" && (
          <div style={{ textAlign: "center", padding: "16px 12px" }}>
            <GameBtn color="#22c55e" onClick={handleCollect} style={{ minHeight: 80, fontSize: 20 }}>
              Collect ⭐ {raceStarsEarned} Stars! 🏁
            </GameBtn>
          </div>
        )}
      </div>
    </div>
  );
}
