import { useState, useEffect, useRef, useCallback } from "react";

const THEMES = {
  midnight: { bg:"#0f0f1a", card:"#1a1a2e", accent:"#f59e0b", text:"#f1f5f9", sub:"#94a3b8", border:"#2d2d4e", label:"Midnight" },
  ocean:    { bg:"#0c1445", card:"#132057", accent:"#38bdf8", text:"#f0f9ff", sub:"#93c5fd", border:"#1e3a8a", label:"Ocean" },
  forest:   { bg:"#0d1f12", card:"#132a1a", accent:"#4ade80", text:"#f0fdf4", sub:"#86efac", border:"#166534", label:"Forest" },
  rose:     { bg:"#1a0a10", card:"#2a1020", accent:"#f43f5e", text:"#fff1f2", sub:"#fda4af", border:"#9f1239", label:"Rose" },
  violet:   { bg:"#0f0a1e", card:"#1a1030", accent:"#a78bfa", text:"#f5f3ff", sub:"#c4b5fd", border:"#4c1d95", label:"Violet" },
  sunset:   { bg:"#1a0f00", card:"#2a1a00", accent:"#fb923c", text:"#fff7ed", sub:"#fdba74", border:"#9a3412", label:"Sunset" },
  arctic:   { bg:"#f0f9ff", card:"#ffffff", accent:"#0ea5e9", text:"#0c4a6e", sub:"#475569", border:"#bae6fd", label:"Arctic" },
  cream:    { bg:"#fdfaf5", card:"#fffef9", accent:"#b45309", text:"#1c1917", sub:"#78716c", border:"#e7e5e4", label:"Cream" },
  graphite: { bg:"#111111", card:"#1c1c1c", accent:"#e2e8f0", text:"#f8fafc", sub:"#64748b", border:"#2d2d2d", label:"Graphite" },
  mint:     { bg:"#f0fdf4", card:"#ffffff", accent:"#059669", text:"#064e3b", sub:"#6b7280", border:"#d1fae5", label:"Mint" },
};

const ALL_MACROS = [
  { key:"calories", label:"Calories", unit:"kcal", color:"#f59e0b" },
  { key:"protein",  label:"Protein",  unit:"g",    color:"#3b82f6" },
  { key:"carbs",    label:"Carbs",    unit:"g",    color:"#8b5cf6" },
  { key:"fat",      label:"Fat",      unit:"g",    color:"#f43f5e" },
  { key:"fiber",    label:"Fiber",    unit:"g",    color:"#4ade80" },
  { key:"sugar",    label:"Sugar",    unit:"g",    color:"#fb923c" },
  { key:"sodium",   label:"Sodium",   unit:"mg",   color:"#94a3b8" },
];

const STAR_TYPES = [
  { emoji:"⭐", pts:1, speed:4000, size:44, color:"#f59e0b" },
  { emoji:"🌟", pts:2, speed:3200, size:48, color:"#38bdf8" },
  { emoji:"💫", pts:3, speed:2600, size:52, color:"#a78bfa" },
  { emoji:"☄️", pts:5, speed:2000, size:40, color:"#f43f5e" },
  { emoji:"💣", pts:-2, speed:3500, size:44, color:"#ef4444", isBomb:true },
];

const QUOTES = [
  "Small steps every day lead to giant leaps over time.",
  "You don't have to be great to start, but you have to start to be great.",
  "Every expert was once a beginner. Keep going.",
  "Your only competition is who you were yesterday.",
  "Discipline is choosing what you want most over what you want now.",
  "Progress, not perfection. You've got this.",
  "Believe in yourself and all that you are.",
  "Success is the sum of small efforts repeated daily.",
  "Dream big, start small, act now.",
  "Your future self is watching. Make them proud.",
];

const RECIPES = [
  { name:"Scrambled Eggs", ingredients:["eggs","butter","salt"], nutrition:{calories:220,protein:18,carbs:2,fat:16,fiber:0,sugar:1,sodium:320}, steps:["Crack 3 eggs, whisk with salt","Melt butter on medium heat","Stir gently until fluffy"] },
  { name:"Pasta with Butter", ingredients:["pasta","butter","salt"], nutrition:{calories:380,protein:10,carbs:62,fat:12,fiber:3,sugar:2,sodium:280}, steps:["Boil salted water","Cook pasta 8-10 min","Drain and toss with butter"] },
  { name:"Chicken Stir Fry", ingredients:["chicken","onion","oil","salt"], nutrition:{calories:310,protein:35,carbs:8,fat:15,fiber:2,sugar:4,sodium:420}, steps:["Cut chicken into strips","Cook in hot oil 5-6 min","Add onion 3 more min, season"] },
  { name:"Veggie Omelette", ingredients:["eggs","onion","oil"], nutrition:{calories:180,protein:14,carbs:5,fat:12,fiber:1,sugar:3,sodium:210}, steps:["Whisk 2 eggs","Sauté onion in oil 2 min","Pour eggs over, fold when set"] },
  { name:"Rice & Beans", ingredients:["rice","beans","salt","oil"], nutrition:{calories:420,protein:14,carbs:78,fat:6,fiber:12,sugar:2,sodium:380}, steps:["Cook rice per package","Heat beans with oil","Season, serve beans over rice"] },
  { name:"Banana Oat Breakfast", ingredients:["banana","oats","milk"], nutrition:{calories:290,protein:9,carbs:54,fat:5,fiber:6,sugar:18,sodium:90}, steps:["Cook oats with milk 5 min","Top with sliced banana"] },
  { name:"Grilled Cheese", ingredients:["bread","butter","cheese"], nutrition:{calories:350,protein:14,carbs:28,fat:22,fiber:1,sugar:3,sodium:620}, steps:["Butter both sides of bread","Layer cheese inside","Cook 2-3 min per side until golden"] },
  { name:"Tuna on Bread", ingredients:["tuna","bread","salt","oil"], nutrition:{calories:320,protein:28,carbs:30,fat:8,fiber:2,sugar:2,sodium:540}, steps:["Drain tuna, mix with oil and salt","Pile onto bread"] },
  { name:"Garlic Pasta", ingredients:["pasta","garlic","oil","salt"], nutrition:{calories:410,protein:11,carbs:64,fat:14,fiber:3,sugar:2,sodium:300}, steps:["Cook pasta","Sauté garlic in oil 1 min","Toss together, season"] },
  { name:"Potato Soup", ingredients:["potato","onion","butter","salt","milk"], nutrition:{calories:280,protein:7,carbs:42,fat:10,fiber:4,sugar:8,sodium:480}, steps:["Cook diced potato and onion in butter","Add milk and salt, simmer 15 min","Mash lightly until creamy"] },
  { name:"Fried Rice", ingredients:["rice","eggs","oil","salt"], nutrition:{calories:360,protein:12,carbs:58,fat:10,fiber:1,sugar:1,sodium:520}, steps:["Stir fry day-old rice in hot oil","Push aside, scramble eggs in","Mix together, season"] },
  { name:"French Toast", ingredients:["bread","eggs","milk","butter","sugar"], nutrition:{calories:320,protein:12,carbs:38,fat:14,fiber:1,sugar:14,sodium:310}, steps:["Dip bread in whisked eggs+milk+sugar","Cook in butter 2-3 min per side"] },
  { name:"Chicken & Rice", ingredients:["chicken","rice","salt","oil"], nutrition:{calories:450,protein:40,carbs:48,fat:10,fiber:1,sugar:0,sodium:440}, steps:["Season and cook chicken in oil 6-8 min per side","Serve over cooked rice"] },
  { name:"Tomato Pasta", ingredients:["pasta","tomato","garlic","oil","salt"], nutrition:{calories:390,protein:11,carbs:68,fat:10,fiber:5,sugar:8,sodium:340}, steps:["Cook pasta","Sauté garlic, add tomatoes 10 min","Toss together"] },
  { name:"Egg & Cheese Toast", ingredients:["eggs","cheese","bread","butter"], nutrition:{calories:310,protein:18,carbs:22,fat:18,fiber:1,sugar:2,sodium:560}, steps:["Toast bread","Fry egg in butter","Top with egg and cheese"] },
  { name:"Cheesy Rice", ingredients:["rice","cheese","butter","salt"], nutrition:{calories:400,protein:14,carbs:52,fat:16,fiber:1,sugar:1,sodium:540}, steps:["Cook rice","Stir in butter and cheese while hot","Season with salt"] },
  { name:"Banana Pancakes", ingredients:["banana","eggs","flour","milk"], nutrition:{calories:340,protein:12,carbs:54,fat:8,fiber:3,sugar:18,sodium:200}, steps:["Mash banana, mix with eggs, flour, milk","Cook spoonfuls 2-3 min per side"] },
  { name:"Chicken Soup", ingredients:["chicken","onion","salt","garlic"], nutrition:{calories:220,protein:30,carbs:8,fat:8,fiber:1,sugar:3,sodium:560}, steps:["Boil chicken with onion and garlic 20-25 min","Shred chicken, return to broth, season"] },
  { name:"Bean Soup", ingredients:["beans","onion","garlic","oil","salt"], nutrition:{calories:240,protein:12,carbs:38,fat:6,fiber:14,sugar:4,sodium:420}, steps:["Sauté onion and garlic","Add beans, simmer 15 min","Partially mash, season"] },
  { name:"Yogurt Parfait", ingredients:["yogurt","banana","sugar"], nutrition:{calories:200,protein:10,carbs:36,fat:2,fiber:1,sugar:28,sodium:80}, steps:["Layer yogurt in cup","Top with sliced banana and sugar"] },
  { name:"Potato Hash", ingredients:["potato","onion","oil","salt"], nutrition:{calories:290,protein:5,carbs:46,fat:10,fiber:4,sugar:4,sodium:360}, steps:["Dice potato and onion","Cook in hot oil 10 min until crispy","Add onion, cook 5 more min, season"] },
  { name:"Garlic Bread", ingredients:["bread","butter","garlic"], nutrition:{calories:220,protein:4,carbs:26,fat:12,fiber:1,sugar:2,sodium:340}, steps:["Mix butter with minced garlic","Spread on bread","Toast until golden"] },
  { name:"Cheese Omelette", ingredients:["eggs","cheese","butter","salt"], nutrition:{calories:310,protein:20,carbs:2,fat:24,fiber:0,sugar:1,sodium:580}, steps:["Whisk 3 eggs with salt","Cook in butter","Add cheese, fold, cook 1 min more"] },
  { name:"Rice Pudding", ingredients:["rice","milk","sugar","salt"], nutrition:{calories:250,protein:6,carbs:50,fat:4,fiber:0,sugar:24,sodium:120}, steps:["Combine all in pot","Cook on low 30 min stirring often","Until thick and creamy"] },
  { name:"Milk & Oats", ingredients:["oats","milk","sugar","butter"], nutrition:{calories:310,protein:9,carbs:50,fat:8,fiber:4,sugar:16,sodium:120}, steps:["Cook oats in warm milk 5 min","Stir in butter and sugar","Serve hot"] },
];

const FRIDGE_ITEMS = ["eggs","butter","milk","chicken","pasta","rice","beans","bread","cheese","onion","banana","oats","tuna","oil","salt","pepper","garlic","potato","tomato","apple","yogurt","flour","sugar"];

const store = {
  get: async (k) => { try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; } catch { return null; } },
  set: async (k, v) => { try { await window.storage.set(k, JSON.stringify(v)); } catch {} },
};

const todayKey = () => new Date().toISOString().split("T")[0];
const timeNow  = () => new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
const greet    = () => { const h = new Date().getHours(); return h<12?"Good Morning":h<17?"Good Afternoon":"Good Evening"; };
const fmtDate  = (d) => { try { return new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}); } catch { return d; } };

const DEFAULT_PROFILES = [{ id:"admin", name:"Me", emoji:"👑", type:"admin", pin:"1234" }];
const DEFAULT_NUT_GOALS = { calories:2000, protein:150, carbs:250, fat:65, fiber:25, sugar:50, sodium:2300 };
const DEFAULT_TRACKED = ["calories","protein"];

// ══════════════════════════════════════════════════
// STAR CATCHER GAME
// ══════════════════════════════════════════════════
function StarCatcherGame({ onEarnPoints, kidName, T }) {
  const [gameState, setGameState] = useState("idle"); // idle | playing | gameover
  const [score, setScore]         = useState(0);
  const [lives, setLives]         = useState(5);
  const [stars, setStars]         = useState([]);
  const [pops, setPops]           = useState([]);
  const [highScore, setHighScore] = useState(0);
  const [earnedPts, setEarnedPts] = useState(0);
  const nextId = useRef(0);
  const gameRef = useRef(null);
  const intervalRef = useRef(null);
  const livesRef = useRef(5);
  const scoreRef = useRef(0);

  livesRef.current = lives;
  scoreRef.current = score;

  const spawnStar = useCallback(() => {
    const type = STAR_TYPES[Math.floor(Math.random() * STAR_TYPES.length)];
    const x = 5 + Math.random() * 80;
    const id = nextId.current++;
    const star = { id, ...type, x, createdAt: Date.now() };
    setStars(s => [...s, star]);

    // Auto-remove if not caught
    setTimeout(() => {
      setStars(s => {
        const still = s.find(st => st.id === id);
        if (still && !still.isBomb) {
          setLives(l => {
            const nl = l - 1;
            if (nl <= 0) endGame();
            return Math.max(nl, 0);
          });
        }
        return s.filter(st => st.id !== id);
      });
    }, type.speed);
  }, []);

  const endGame = useCallback(() => {
    setGameState("gameover");
    clearInterval(intervalRef.current);
    const pts = Math.max(scoreRef.current, 0);
    setEarnedPts(pts);
    if (pts > 0) onEarnPoints(pts);
    setHighScore(h => Math.max(h, scoreRef.current));
  }, [onEarnPoints]);

  const startGame = () => {
    setGameState("playing");
    setScore(0); setLives(5); setStars([]); setPops([]); setEarnedPts(0);
    scoreRef.current = 0; livesRef.current = 5;
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(spawnStar, 900);
    spawnStar();
  };

  useEffect(() => () => clearInterval(intervalRef.current), []);

  useEffect(() => {
    if (gameState === "playing" && lives <= 0) endGame();
  }, [lives, gameState, endGame]);

  const catchStar = (star, e) => {
    e.stopPropagation();
    if (gameState !== "playing") return;

    // Pop effect
    const rect = gameRef.current?.getBoundingClientRect();
    const touch = e.touches?.[0] || e;
    const px = (touch.clientX - (rect?.left||0));
    const py = (touch.clientY - (rect?.top||0));
    setPops(p => [...p, { id: Date.now(), x: px, y: py, text: star.isBomb ? "💥 -2!" : `+${star.pts}⭐`, color: star.isBomb ? "#ef4444" : star.color }]);
    setTimeout(() => setPops(p => p.slice(1)), 800);

    if (star.isBomb) {
      setLives(l => Math.max(l - 1, 0));
    } else {
      setScore(s => s + star.pts);
    }
    setStars(s => s.filter(st => st.id !== star.id));
  };

  const heartColor = "#f43f5e";

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "16px", overflow: "hidden", marginBottom: "14px" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1a0a2e, #0f0f3a)", padding: "16px", textAlign: "center" }}>
        <div style={{ fontSize: "28px", fontWeight: "bold", color: "#f59e0b", letterSpacing: "2px" }}>⭐ STAR CATCHER ⭐</div>
        <div style={{ color: "#c4b5fd", fontSize: "13px", marginTop: "4px" }}>Catch stars to earn real reward points!</div>
        {highScore > 0 && <div style={{ color: "#f59e0b", fontSize: "12px", marginTop: "4px" }}>🏆 Best: {highScore} pts</div>}
      </div>

      {/* IDLE */}
      {gameState === "idle" && (
        <div style={{ padding: "24px", textAlign: "center" }}>
          <div style={{ fontSize: "60px", marginBottom: "12px" }}>🌟</div>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: T.text, marginBottom: "8px" }}>
            Hey {kidName}! Ready to play? 👋
          </div>
          <div style={{ color: T.sub, fontSize: "13px", marginBottom: "20px", lineHeight: 1.7 }}>
            Tap falling stars to catch them!<br/>
            ⭐ = 1pt &nbsp; 🌟 = 2pts &nbsp; 💫 = 3pts &nbsp; ☄️ = 5pts<br/>
            💣 = Bomb! Avoid those! (-1 life)<br/>
            Miss a star = lose a life. 5 lives total.<br/>
            <span style={{ color: "#f59e0b", fontWeight: "bold" }}>Points go to your REAL reward total!</span>
          </div>
          <button onClick={startGame} style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)", border: "none", borderRadius: "14px", padding: "14px 40px", fontSize: "18px", fontWeight: "bold", color: "#fff", cursor: "pointer", boxShadow: "0 4px 20px rgba(245,158,11,0.4)" }}>
            🚀 Start Game!
          </button>
        </div>
      )}

      {/* PLAYING */}
      {gameState === "playing" && (
        <div>
          {/* HUD */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: "14px", fontWeight: "bold", color: "#f59e0b" }}>⭐ {score} pts</div>
            <div style={{ display: "flex", gap: "4px" }}>
              {[...Array(5)].map((_, i) => (
                <span key={i} style={{ fontSize: "18px", opacity: i < lives ? 1 : 0.2 }}>❤️</span>
              ))}
            </div>
          </div>

          {/* Game Area */}
          <div ref={gameRef} style={{ position: "relative", height: "380px", background: "linear-gradient(180deg, #0a0a1a 0%, #1a0a2e 50%, #0f1a2e 100%)", overflow: "hidden", cursor: "pointer", userSelect: "none" }}>
            {/* Stars background */}
            {[...Array(20)].map((_, i) => (
              <div key={i} style={{ position: "absolute", width: "2px", height: "2px", background: "white", borderRadius: "50%", left: `${(i * 17 + 3) % 100}%`, top: `${(i * 13 + 7) % 100}%`, opacity: 0.4 }} />
            ))}

            {/* Falling items */}
            {stars.map(star => (
              <div
                key={star.id}
                onTouchStart={(e) => catchStar(star, e)}
                onClick={(e) => catchStar(star, e)}
                style={{
                  position: "absolute",
                  left: `${star.x}%`,
                  top: 0,
                  fontSize: `${star.size}px`,
                  lineHeight: 1,
                  cursor: "pointer",
                  animation: `fallDown ${star.speed}ms linear forwards`,
                  filter: star.isBomb ? "drop-shadow(0 0 8px #ef4444)" : `drop-shadow(0 0 6px ${star.color})`,
                  zIndex: 10,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {star.emoji}
              </div>
            ))}

            {/* Pop effects */}
            {pops.map(pop => (
              <div key={pop.id} style={{ position: "absolute", left: pop.x, top: pop.y, fontSize: "16px", fontWeight: "bold", color: pop.color, pointerEvents: "none", animation: "popUp 0.8s ease-out forwards", zIndex: 20, whiteSpace: "nowrap", transform: "translate(-50%, -50%)" }}>
                {pop.text}
              </div>
            ))}

            {/* Ground */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "4px", background: "linear-gradient(90deg, #f59e0b, #f97316, #f59e0b)" }} />
          </div>

          <style>{`
            @keyframes fallDown { from { top: -60px; } to { top: 400px; } }
            @keyframes popUp { 0% { opacity:1; transform:translate(-50%,-50%) scale(1); } 100% { opacity:0; transform:translate(-50%,-120%) scale(1.4); } }
          `}</style>
        </div>
      )}

      {/* GAME OVER */}
      {gameState === "gameover" && (
        <div style={{ padding: "24px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "10px" }}>🎮</div>
          <div style={{ fontSize: "22px", fontWeight: "bold", color: T.text, marginBottom: "6px" }}>Game Over!</div>
          <div style={{ fontSize: "32px", fontWeight: "bold", color: "#f59e0b", marginBottom: "6px" }}>⭐ {score} pts</div>
          {earnedPts > 0
            ? <div style={{ background: "linear-gradient(135deg, #166534, #14532d)", borderRadius: "12px", padding: "14px", marginBottom: "18px" }}>
                <div style={{ color: "#4ade80", fontWeight: "bold", fontSize: "15px" }}>🎉 +{earnedPts} points added to your rewards!</div>
                <div style={{ color: "#86efac", fontSize: "12px", marginTop: "4px" }}>Check your Stars tab to see your total!</div>
              </div>
            : <div style={{ color: T.sub, fontSize: "14px", marginBottom: "18px" }}>Keep trying to earn points!</div>
          }
          {score >= highScore && score > 0 && (
            <div style={{ color: "#f59e0b", fontSize: "14px", marginBottom: "12px" }}>🏆 NEW HIGH SCORE!</div>
          )}
          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            <button onClick={startGame} style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)", border: "none", borderRadius: "12px", padding: "12px 28px", fontSize: "16px", fontWeight: "bold", color: "#fff", cursor: "pointer" }}>
              🔄 Play Again!
            </button>
            <button onClick={() => setGameState("idle")} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: "12px", padding: "12px 20px", fontSize: "14px", color: T.sub, cursor: "pointer" }}>
              Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════
export default function LifeApp() {
  const [screen, setScreen]       = useState("profiles");
  const [profiles, setProfiles]   = useState(DEFAULT_PROFILES);
  const [current, setCurrent]     = useState(null);
  const [pending, setPending]     = useState(null);
  const [pinIn, setPinIn]         = useState("");
  const [pinErr, setPinErr]       = useState(false);
  const [theme, setTheme]         = useState("midnight");
  const [showTheme, setShowTheme] = useState(false);
  const [tab, setTab]             = useState("home");

  const [fridge, setFridge]           = useState([]);
  const [sharedCal, setSharedCal]     = useState([]);
  const [workCal, setWorkCal]         = useState([]);
  const [kids, setKids]               = useState([]);
  const [allNutrition, setAllNutrition] = useState({});
  const [allGoals, setAllGoals]       = useState({});
  const [matched, setMatched]         = useState([]);
  const [selRecipe, setSelRecipe]     = useState(null);
  const [addedCal, setAddedCal]       = useState(false);

  const [appt, setAppt]         = useState({ title:"", date:"", time:"", note:"" });
  const [kidName, setKidName]   = useState("");
  const [kidEmoji, setKidEmoji] = useState("🧒");
  const [taskText, setTaskText] = useState("");
  const [taskPts, setTaskPts]   = useState("10");
  const [activeKid, setActiveKid] = useState(null);
  const [aiEmail, setAiEmail]   = useState("");
  const [aiLoad, setAiLoad]     = useState(false);
  const [aiRes, setAiRes]       = useState(null);
  const [subSet, setSubSet]     = useState("profile");
  const [newPName, setNewPName] = useState("");
  const [newPEmoji, setNewPEmoji] = useState("😊");
  const [newPType, setNewPType] = useState("family");
  const [newPin, setNewPin]     = useState("");
  const [newGoal, setNewGoal]   = useState("");
  const [logLabel, setLogLabel] = useState("");
  const [logNut, setLogNut]     = useState({});
  const [histView, setHistView] = useState("week");
  const [selDay, setSelDay]     = useState(null);
  const [calGoalIn, setCalGoalIn] = useState("");

  const T   = THEMES[theme];
  const pid = current?.id;

  useEffect(() => {
    (async () => {
      const p  = await store.get("profiles");     if(p)  setProfiles(p);
      const f  = await store.get("fridge");       if(f)  setFridge(f);
      const sc = await store.get("sharedCal");    if(sc) setSharedCal(sc);
      const wc = await store.get("workCal");      if(wc) setWorkCal(wc);
      const k  = await store.get("kids");         if(k)  setKids(k);
      const an = await store.get("allNutrition"); if(an) setAllNutrition(an);
      const ag = await store.get("allGoals");     if(ag) setAllGoals(ag);
      const th = await store.get("theme");        if(th) setTheme(th);
    })();
  }, []);

  const sv = (key, setter) => (v) => { setter(v); store.set(key, v); };
  const saveProfiles = sv("profiles",    setProfiles);
  const saveFridge   = sv("fridge",      setFridge);
  const saveShared   = sv("sharedCal",   setSharedCal);
  const saveWork     = sv("workCal",     setWorkCal);
  const saveKids     = sv("kids",        setKids);
  const saveTheme    = (v) => { setTheme(v); store.set("theme", v); };

  const myNut      = allNutrition[pid] || {};
  const myTracked  = myNut.tracked   || DEFAULT_TRACKED;
  const myNutGoals = myNut.goals     || DEFAULT_NUT_GOALS;
  const todayLog   = myNut[todayKey()] || [];
  const myGoals    = allGoals[pid]   || [];

  const saveNut   = (v) => { const n={...allNutrition,[pid]:v}; setAllNutrition(n); store.set("allNutrition",n); };
  const saveGoals = (v) => { const n={...allGoals,[pid]:v};     setAllGoals(n);     store.set("allGoals",n); };

  const todayTotals = todayLog.reduce((acc, item) => {
    ALL_MACROS.forEach(m => { acc[m.key] = (acc[m.key]||0) + (item.nutrition?.[m.key]||0); });
    return acc;
  }, {});

  const addEntry = (label, nutrition) => saveNut({ ...myNut, [todayKey()]: [...todayLog, { label, nutrition, time:timeNow(), id:Date.now() }] });
  const removeEntry = (id) => saveNut({ ...myNut, [todayKey()]: todayLog.filter(e => e.id !== id) });
  const updateTracked = (key) => saveNut({ ...myNut, tracked: myTracked.includes(key) ? myTracked.filter(k=>k!==key) : [...myTracked, key] });
  const updateGoal    = (key, val) => saveNut({ ...myNut, goals: { ...myNutGoals, [key]: parseInt(val)||0 } });

  useEffect(() => {
    if(!fridge.length){ setMatched([]); return; }
    setMatched(RECIPES.filter(r => r.ingredients.every(i => fridge.includes(i))));
    setSelRecipe(null); setAddedCal(false);
  }, [fridge]);

  const getHistDays = () => {
    const days = Object.keys(myNut).filter(k=>k.match(/^\d{4}-\d{2}-\d{2}$/)).sort().reverse();
    const now = new Date();
    const ms = { week:7, month:30, year:365 }[histView] * 86400000;
    return days.filter(d => now - new Date(d+"T12:00:00") < ms);
  };

  const tapProfile = (p) => {
    if(p.type==="admin"){ setPending(p); setPinIn(""); setPinErr(false); setScreen("pin"); }
    else { setCurrent(p); setTab(p.type==="kid"?"rewards":"home"); setScreen("app"); }
  };

  const handlePin = (d) => {
    if(d==="DEL"){ setPinIn(x=>x.slice(0,-1)); return; }
    const n = pinIn+d; setPinIn(n);
    if(n.length===4){
      if(n===pending.pin){ setCurrent(pending); setTab("home"); setScreen("app"); setPinErr(false); }
      else { setPinErr(true); setTimeout(()=>{ setPinIn(""); setPinErr(false); },900); }
    }
  };

  const parseEmail = async () => {
    if(!aiEmail.trim()) return;
    setAiLoad(true); setAiRes(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:400,
          messages:[{role:"user",content:`Extract appointment from this email. Return ONLY valid JSON: {"title":"string","date":"YYYY-MM-DD","time":"HH:MM","note":"string"}. If no date use ${todayKey()}. If no time use "09:00". Email: ${aiEmail}`}]
        })
      });
      const data = await res.json();
      const text = data.content.map(c=>c.text||"").join("");
      setAiRes(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch { setAiRes({error:"Couldn't read that — try pasting more of the email!"}); }
    setAiLoad(false);
  };

  // Game: earn real points for kid profile
  const handleGamePoints = useCallback((pts) => {
    if(!pid) return;
    const kidIdx = kids.findIndex(k => k.name === current?.name);
    if(kidIdx === -1) return;
    const updated = kids.map((k, i) => i === kidIdx ? { ...k, points: k.points + pts } : k);
    saveKids(updated);
  }, [kids, current, pid]);

  const isAdmin = current?.type==="admin";
  const isKid   = current?.type==="kid";

  const tabs = isKid
    ? [{id:"rewards",icon:"⭐",label:"Stars"},{id:"game",icon:"🎮",label:"Game"},{id:"calendar",icon:"📅",label:"Events"}]
    : [{id:"home",icon:"🏠",label:"Home"},{id:"food",icon:"🍽️",label:"Food"},{id:"nutrition",icon:"🔥",label:"Nutrition"},{id:"goals",icon:"🎯",label:"Goals"},{id:"kids",icon:"⭐",label:"Kids"},{id:"calendar",icon:"📅",label:"Calendar"},
       ...(isAdmin?[{id:"work",icon:"💼",label:"Work"},{id:"settings",icon:"⚙️",label:"Settings"}]:[])];

  const s = {
    wrap: {minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"Georgia,serif",paddingBottom:"80px"},
    hdr:  {background:T.card,borderBottom:`1px solid ${T.border}`,padding:"13px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100},
    logo: {fontSize:"16px",fontWeight:"bold",color:T.accent,letterSpacing:"2px"},
    page: {padding:"16px"},
    card: {background:T.card,border:`1px solid ${T.border}`,borderRadius:"16px",padding:"16px",marginBottom:"14px"},
    h2:   {fontSize:"17px",fontWeight:"bold",color:T.accent,margin:"0 0 12px 0"},
    h3:   {fontSize:"11px",color:T.sub,marginBottom:"8px",textTransform:"uppercase",letterSpacing:"1px"},
    inp:  {background:T.bg,border:`1px solid ${T.border}`,borderRadius:"10px",padding:"10px 14px",color:T.text,fontSize:"14px",width:"100%",boxSizing:"border-box",fontFamily:"Georgia,serif"},
    txa:  {background:T.bg,border:`1px solid ${T.border}`,borderRadius:"10px",padding:"10px 14px",color:T.text,fontSize:"14px",width:"100%",boxSizing:"border-box",fontFamily:"Georgia,serif",minHeight:"80px",resize:"vertical"},
    btn:  {background:T.accent,color:T.bg,border:"none",borderRadius:"10px",padding:"10px 18px",fontWeight:"bold",fontSize:"14px",cursor:"pointer",fontFamily:"Georgia,serif"},
    btnSm:{background:T.accent,color:T.bg,border:"none",borderRadius:"8px",padding:"7px 12px",fontWeight:"bold",fontSize:"12px",cursor:"pointer"},
    btnO: {background:"none",color:T.accent,border:`1px solid ${T.accent}`,borderRadius:"10px",padding:"8px 14px",fontSize:"13px",cursor:"pointer"},
    nav:  {position:"fixed",bottom:0,left:0,right:0,background:T.card,borderTop:`1px solid ${T.border}`,display:"flex",justifyContent:"space-around",padding:"8px 0 14px",zIndex:100},
    nBtn: (a)=>({background:"none",border:"none",color:a?T.accent:T.sub,fontSize:"9px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:"2px",fontFamily:"Georgia,serif",padding:"0 2px"}),
    tag:  (a,c)=>({background:a?(c||T.accent):T.bg,color:a?T.bg:T.sub,border:`1px solid ${a?(c||T.accent):T.border}`,borderRadius:"20px",padding:"5px 11px",fontSize:"12px",cursor:"pointer",margin:"3px",display:"inline-block"}),
    row:  {display:"flex",gap:"8px"},
    g2:   {display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"},
    pbar: {background:T.border,borderRadius:"10px",height:"8px",overflow:"hidden",margin:"4px 0"},
    pfill:(p,c)=>({height:"100%",borderRadius:"10px",background:p>=100?"#ef4444":(c||T.accent),width:Math.min(p,100)+"%"}),
    box:  {background:T.bg,borderRadius:"12px",padding:"12px",textAlign:"center"},
    irow: {display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.border}`},
  };

  // ── PROFILES
  if(screen==="profiles") return (
    <div style={{...s.wrap,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:"20px"}}>
      <div style={{textAlign:"center",marginBottom:"32px"}}>
        <div style={{fontSize:"28px",fontWeight:"bold",color:T.accent,letterSpacing:"3px"}}>LUCAC ✦</div>
        <div style={{color:T.sub,fontSize:"14px",marginTop:"6px"}}>Who's using the app?</div>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",justifyContent:"center",gap:"14px",maxWidth:"380px"}}>
        {profiles.map(p=>(
          <div key={p.id} onClick={()=>tapProfile(p)} style={{background:T.card,border:`2px solid ${p.type==="admin"?T.accent:T.border}`,borderRadius:"20px",padding:"20px 22px",textAlign:"center",cursor:"pointer",minWidth:"110px"}}>
            <div style={{fontSize:"38px"}}>{p.emoji}</div>
            <div style={{fontWeight:"bold",marginTop:"8px",fontSize:"14px"}}>{p.name}</div>
            <div style={{fontSize:"11px",color:p.type==="admin"?T.accent:T.sub,marginTop:"3px"}}>{p.type==="admin"?"🔒 Admin":p.type==="kid"?"👦 Kid":"👤 Family"}</div>
          </div>
        ))}
        <div onClick={()=>{setCurrent({id:"guest",name:"Guest",type:"guest"});setTab("home");setScreen("app");}}
          style={{background:"none",border:`2px dashed ${T.border}`,borderRadius:"20px",padding:"20px 22px",textAlign:"center",cursor:"pointer",minWidth:"110px",color:T.sub}}>
          <div style={{fontSize:"38px"}}>👤</div>
          <div style={{fontSize:"14px",marginTop:"8px"}}>Guest</div>
        </div>
      </div>
    </div>
  );

  // ── PIN
  if(screen==="pin") return (
    <div style={{...s.wrap,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
      <div style={{fontSize:"40px",marginBottom:"8px"}}>{pending?.emoji}</div>
      <div style={{fontSize:"18px",fontWeight:"bold"}}>{pending?.name}</div>
      <div style={{color:T.sub,fontSize:"14px",marginTop:"4px",marginBottom:"28px"}}>Enter your PIN</div>
      <div style={{display:"flex",gap:"14px",marginBottom:"28px"}}>
        {[0,1,2,3].map(i=>(<div key={i} style={{width:"15px",height:"15px",borderRadius:"50%",background:i<pinIn.length?T.accent:T.border}}/>))}
      </div>
      {pinErr&&<div style={{color:"#ef4444",fontSize:"14px",marginBottom:"16px"}}>Wrong PIN — try again</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,72px)",gap:"12px"}}>
        {[1,2,3,4,5,6,7,8,9,"",0,"DEL"].map((d,i)=>(
          <button key={i} onClick={()=>d!==""&&handlePin(String(d))}
            style={{height:"68px",borderRadius:"50%",background:d===""?"transparent":T.card,border:d===""?"none":`1px solid ${T.border}`,color:d==="DEL"?T.sub:T.text,fontSize:d==="DEL"?"14px":"22px",cursor:d===""?"default":"pointer",fontWeight:"bold",fontFamily:"Georgia,serif"}}>
            {d}
          </button>
        ))}
      </div>
      <button onClick={()=>setScreen("profiles")} style={{marginTop:"24px",background:"none",border:"none",color:T.sub,cursor:"pointer",fontSize:"14px"}}>← Back</button>
    </div>
  );

  const quote = QUOTES[new Date().getDay() % QUOTES.length];

  return (
    <div style={s.wrap}>
      {/* HEADER */}
      <div style={s.hdr}>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <span style={{fontSize:"22px",cursor:"pointer"}} onClick={()=>setScreen("profiles")}>{current?.emoji||"👤"}</span>
          <div style={s.logo}>LUCAC ✦</div>
        </div>
        <div style={{display:"flex",gap:"8px",alignItems:"center",position:"relative"}}>
          <div style={{fontSize:"11px",color:T.sub}}>{new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
          <button onClick={()=>setShowTheme(x=>!x)} style={s.btnSm}>🎨</button>
          {showTheme&&(
            <div style={{position:"absolute",top:"38px",right:0,background:T.card,border:`1px solid ${T.border}`,borderRadius:"14px",padding:"14px",display:"flex",flexWrap:"wrap",gap:"10px",zIndex:200,boxShadow:"0 10px 40px rgba(0,0,0,0.5)",width:"220px"}}>
              {Object.entries(THEMES).map(([name,t])=>(
                <div key={name} onClick={()=>{saveTheme(name);setShowTheme(false);}} title={t.label} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",cursor:"pointer"}}>
                  <div style={{width:"30px",height:"30px",borderRadius:"50%",background:t.accent,border:theme===name?"3px solid white":"3px solid transparent",boxShadow:theme===name?"0 0 8px "+t.accent:"none"}}/>
                  <div style={{fontSize:"9px",color:T.sub}}>{t.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={s.page}>

        {/* HOME */}
        {tab==="home"&&(<>
          <div style={{...s.card,borderLeft:`4px solid ${T.accent}`}}>
            <div style={{fontSize:"10px",color:T.sub,marginBottom:"6px",letterSpacing:"1.5px",textTransform:"uppercase"}}>✦ Today's Quote</div>
            <div style={{fontStyle:"italic",lineHeight:1.7,fontSize:"15px"}}>"{quote}"</div>
          </div>
          <div style={s.card}>
            <div style={s.h2}>{greet()}, {current?.name?.split(" ")[0]}! 👋</div>
            <div style={s.g2}>
              {[{icon:"🔥",label:"Calories",val:`${todayTotals.calories||0}/${myNutGoals.calories}`},{icon:"🎯",label:"Goals Done",val:`${myGoals.filter(g=>g.done).length}/${myGoals.length}`},{icon:"📅",label:"Events",val:sharedCal.length+(isAdmin?workCal.length:0)},{icon:"⭐",label:"Kid Points",val:kids.reduce((s,k)=>s+k.points,0)+" pts"}].map((it,i)=>(
                <div key={i} style={s.box}>
                  <div style={{fontSize:"24px"}}>{it.icon}</div>
                  <div style={{fontSize:"12px",color:T.sub,marginTop:"4px"}}>{it.label}</div>
                  <div style={{fontSize:"14px",fontWeight:"bold",color:T.accent,marginTop:"2px"}}>{it.val}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={s.card}>
            <div style={s.h2}>Today's Nutrition</div>
            {myTracked.map(key=>{
              const m=ALL_MACROS.find(x=>x.key===key); if(!m) return null;
              const val=todayTotals[key]||0; const goal=myNutGoals[key]||1; const pct=(val/goal)*100;
              return(<div key={key} style={{marginBottom:"10px"}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:"13px",marginBottom:"2px"}}><span style={{color:T.sub}}>{m.label}</span><span style={{fontWeight:"bold",color:pct>=100?"#ef4444":m.color}}>{val}{m.unit} <span style={{color:T.sub,fontWeight:"normal"}}>/ {goal}{m.unit}</span></span></div>
                <div style={s.pbar}><div style={s.pfill(pct,m.color)}/></div>
              </div>);
            })}
          </div>
          {(sharedCal.length>0||(isAdmin&&workCal.length>0))&&(
            <div style={s.card}>
              <div style={s.h2}>📅 Coming Up</div>
              {[...sharedCal,...(isAdmin?workCal.map(a=>({...a,_w:true})):[])].sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(0,4).map((a,i)=>(
                <div key={i} style={{display:"flex",gap:"10px",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${T.border}`}}>
                  <div style={{background:a._w?"#3b82f6":T.accent,color:T.bg,borderRadius:"8px",padding:"5px 10px",fontSize:"11px",fontWeight:"bold",whiteSpace:"nowrap",minWidth:"68px",textAlign:"center"}}>{fmtDate(a.date)}</div>
                  <div><div style={{fontSize:"14px",fontWeight:"bold"}}>{a.title}{a._w?" 💼":""}</div>{a.time&&<div style={{fontSize:"11px",color:T.sub}}>{a.time}</div>}</div>
                </div>
              ))}
            </div>
          )}
        </>)}

        {/* FOOD */}
        {tab==="food"&&(<>
          <div style={s.card}>
            <div style={s.h2}>🧊 What's In Your Fridge?</div>
            <div style={{color:T.sub,fontSize:"13px",marginBottom:"12px"}}>Tap what you have — I'll find recipes using ONLY those ingredients!</div>
            <div>{FRIDGE_ITEMS.map(item=>(<span key={item} style={s.tag(fridge.includes(item))} onClick={()=>saveFridge(fridge.includes(item)?fridge.filter(f=>f!==item):[...fridge,item])}>{item}</span>))}</div>
            {fridge.length>0&&<div style={{marginTop:"10px",color:T.sub,fontSize:"12px"}}>{fridge.length} ingredient{fridge.length>1?"s":""} selected</div>}
          </div>
          {fridge.length>0&&matched.length===0&&<div style={{...s.card,textAlign:"center",color:T.sub,padding:"24px"}}><div style={{fontSize:"32px",marginBottom:"8px"}}>🥄</div>No full recipe matches yet — add more ingredients!</div>}
          {matched.map((r,i)=>(
            <div key={i} style={s.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:"bold",fontSize:"15px"}}>{r.name}</div>
                  <div style={{color:T.accent,fontSize:"13px",marginTop:"3px"}}>🔥 {r.nutrition.calories} cal • 💪 {r.nutrition.protein}g protein</div>
                </div>
                <button style={s.btnO} onClick={()=>setSelRecipe(selRecipe?.name===r.name?null:r)}>{selRecipe?.name===r.name?"Close ▲":"View ▼"}</button>
              </div>
              {selRecipe?.name===r.name&&(<div style={{marginTop:"14px"}}>
                <div style={{background:T.bg,borderRadius:"12px",padding:"14px",marginBottom:"14px",border:`1px solid ${T.border}`}}>
                  <div style={{fontWeight:"bold",fontSize:"14px",marginBottom:"10px",color:T.accent}}>📊 Nutrition Facts (per serving)</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>
                    {ALL_MACROS.map(m=>(<div key={m.key} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${T.border}`}}><span style={{fontSize:"13px",color:T.sub}}>{m.label}</span><span style={{fontSize:"13px",fontWeight:"bold",color:myTracked.includes(m.key)?m.color:T.text}}>{r.nutrition[m.key]||0}{m.unit}</span></div>))}
                  </div>
                </div>
                <div style={s.h3}>Steps</div>
                {r.steps.map((step,si)=>(<div key={si} style={{display:"flex",gap:"10px",marginBottom:"10px"}}><div style={{background:T.accent,color:T.bg,borderRadius:"50%",width:"24px",height:"24px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:"bold",flexShrink:0}}>{si+1}</div><div style={{fontSize:"14px",lineHeight:1.6}}>{step}</div></div>))}
                <button style={{...s.btn,width:"100%",marginTop:"12px",opacity:addedCal?0.65:1}} onClick={()=>{if(!addedCal){addEntry(r.name,r.nutrition);setAddedCal(true);setTimeout(()=>setAddedCal(false),2500);}}}>
                  {addedCal?"✅ Logged!":"➕ Log This Meal"}
                </button>
              </div>)}
            </div>
          ))}
        </>)}

        {/* NUTRITION */}
        {tab==="nutrition"&&(<>
          <div style={s.card}>
            <div style={s.h2}>🔥 Today — {todayKey()}</div>
            {myTracked.map(key=>{
              const m=ALL_MACROS.find(x=>x.key===key); if(!m) return null;
              const val=todayTotals[key]||0; const goal=myNutGoals[key]||1; const pct=(val/goal)*100;
              return(<div key={key} style={{marginBottom:"14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:"14px",marginBottom:"4px"}}><span style={{fontWeight:"bold",color:m.color}}>{m.label}</span><span>{val}{m.unit} <span style={{color:T.sub}}>/ {goal}{m.unit}</span></span></div>
                <div style={s.pbar}><div style={s.pfill(pct,m.color)}/></div>
                <div style={{fontSize:"11px",color:pct>=100?"#ef4444":T.sub,textAlign:"right",marginTop:"2px"}}>{pct>=100?"🚨 Over goal!":`${goal-val}${m.unit} remaining`}</div>
              </div>);
            })}
          </div>
          <div style={s.card}>
            <div style={s.h2}>➕ Log Food Manually</div>
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              <input style={s.inp} placeholder="Food name..." value={logLabel} onChange={e=>setLogLabel(e.target.value)}/>
              <div style={{color:T.sub,fontSize:"12px"}}>Fill in what you know:</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
                {ALL_MACROS.map(m=>(<div key={m.key}><div style={{fontSize:"11px",color:m.color,marginBottom:"3px",fontWeight:myTracked.includes(m.key)?"bold":"normal"}}>{m.label} ({m.unit}){myTracked.includes(m.key)?" ★":""}</div><input style={{...s.inp,padding:"8px 10px",fontSize:"13px"}} type="number" placeholder="0" value={logNut[m.key]||""} onChange={e=>setLogNut(n=>({...n,[m.key]:e.target.value?parseInt(e.target.value):0}))}/></div>))}
              </div>
              <button style={s.btn} onClick={()=>{if(!logLabel.trim())return;addEntry(logLabel,logNut);setLogLabel("");setLogNut({});}}>Add to Log</button>
            </div>
          </div>
          {todayLog.length>0&&(
            <div style={s.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
                <div style={{fontWeight:"bold",fontSize:"17px",color:T.accent}}>Today's Log</div>
                <button style={{...s.btnO,fontSize:"11px",padding:"4px 10px"}} onClick={()=>saveNut({...myNut,[todayKey()]:[]})}>Clear</button>
              </div>
              {todayLog.map((e,i)=>(
                <div key={e.id||i} style={{background:T.bg,borderRadius:"12px",padding:"12px",marginBottom:"8px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:"bold",fontSize:"14px"}}>{e.label}</div>
                      <div style={{fontSize:"11px",color:T.sub,marginTop:"2px"}}>{e.time}</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:"5px",marginTop:"7px"}}>
                        {myTracked.map(key=>{const m=ALL_MACROS.find(x=>x.key===key);const val=e.nutrition?.[key]||0;return val>0?<span key={key} style={{background:T.card,border:`1px solid ${m.color}`,color:m.color,borderRadius:"12px",padding:"2px 8px",fontSize:"11px"}}>{m.label}: {val}{m.unit}</span>:null;})}
                      </div>
                    </div>
                    <span onClick={()=>removeEntry(e.id)} style={{color:T.sub,cursor:"pointer",fontSize:"20px",marginLeft:"10px"}}>×</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={s.card}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
              <div style={{fontWeight:"bold",fontSize:"17px",color:T.accent}}>📊 History</div>
              <div style={{display:"flex",gap:"5px"}}>
                {[["week","7d"],["month","30d"],["year","1yr"]].map(([v,l])=>(<button key={v} style={{...s.btnO,padding:"4px 9px",fontSize:"11px",background:histView===v?T.accent:"none",color:histView===v?T.bg:T.accent}} onClick={()=>setHistView(v)}>{l}</button>))}
              </div>
            </div>
            {getHistDays().length===0&&<div style={{color:T.sub,textAlign:"center",padding:"16px",fontSize:"14px"}}>No history yet — start logging!</div>}
            {getHistDays().map(date=>{
              const log=myNut[date]||[];
              const tots=log.reduce((acc,item)=>{ALL_MACROS.forEach(m=>{acc[m.key]=(acc[m.key]||0)+(item.nutrition?.[m.key]||0);});return acc;},{});
              const isSel=selDay===date;
              return(<div key={date} style={{marginBottom:"10px",background:T.bg,borderRadius:"12px",padding:"12px",cursor:"pointer"}} onClick={()=>setSelDay(isSel?null:date)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
                  <span style={{fontWeight:"bold",fontSize:"14px"}}>{fmtDate(date)}</span>
                  <span style={{fontSize:"12px",color:T.sub}}>{log.length} meal{log.length!==1?"s":""}</span>
                </div>
                {myTracked.slice(0,2).map(key=>{const m=ALL_MACROS.find(x=>x.key===key);if(!m)return null;const val=tots[key]||0;const goal=myNutGoals[key]||1;const pct=(val/goal)*100;const over=pct>=100;return(<div key={key} style={{marginBottom:"5px"}}><div style={{display:"flex",justifyContent:"space-between",fontSize:"12px",marginBottom:"2px"}}><span style={{color:T.sub}}>{m.label}</span><span style={{color:over?"#ef4444":m.color,fontWeight:"bold"}}>{val}{m.unit}{over?" 🚨":""}</span></div><div style={s.pbar}><div style={s.pfill(pct,m.color)}/></div></div>);})}
                {isSel&&(<div style={{marginTop:"12px",borderTop:`1px solid ${T.border}`,paddingTop:"10px"}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px",marginBottom:"10px"}}>{ALL_MACROS.map(m=>tots[m.key]>0?<div key={m.key} style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:"13px",color:T.sub}}>{m.label}</span><span style={{fontSize:"13px",fontWeight:"bold",color:m.color}}>{tots[m.key]}{m.unit}</span></div>:null)}</div>
                  <div style={{fontSize:"12px",color:T.sub,marginBottom:"6px",textTransform:"uppercase",letterSpacing:"1px"}}>Meals</div>
                  {log.map((e,i)=><div key={i} style={{fontSize:"13px",padding:"4px 0",borderBottom:`1px solid ${T.border}`}}>• {e.label}</div>)}
                </div>)}
              </div>);
            })}
          </div>
        </>)}

        {/* GOALS */}
        {tab==="goals"&&(
          <div style={s.card}>
            <div style={s.h2}>🎯 Daily Goals</div>
            <div style={{...s.row,marginBottom:"16px"}}>
              <input style={{...s.inp,flex:1}} placeholder="Add a new goal..." value={newGoal} onChange={e=>setNewGoal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newGoal.trim()){saveGoals([...myGoals,{text:newGoal,done:false,id:Date.now()}]);setNewGoal("");}}}/>
              <button style={s.btn} onClick={()=>{if(newGoal.trim()){saveGoals([...myGoals,{text:newGoal,done:false,id:Date.now()}]);setNewGoal("");}}}>+</button>
            </div>
            {myGoals.length===0&&<div style={{color:T.sub,textAlign:"center",padding:"20px",fontSize:"14px"}}>No goals yet! Add one above 💪</div>}
            {myGoals.map((g,i)=>(<div key={g.id||i} style={s.irow}>
              <div style={{display:"flex",alignItems:"center",gap:"12px",flex:1}}>
                <div onClick={()=>saveGoals(myGoals.map((gm,idx)=>idx===i?{...gm,done:!gm.done}:gm))} style={{width:"24px",height:"24px",borderRadius:"50%",border:`2px solid ${g.done?T.accent:T.border}`,background:g.done?T.accent:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{g.done&&<span style={{color:T.bg,fontSize:"13px"}}>✓</span>}</div>
                <span style={{fontSize:"15px",textDecoration:g.done?"line-through":"none",color:g.done?T.sub:T.text}}>{g.text}</span>
              </div>
              <span onClick={()=>saveGoals(myGoals.filter((_,idx)=>idx!==i))} style={{color:T.sub,cursor:"pointer",fontSize:"22px",marginLeft:"10px"}}>×</span>
            </div>))}
            {myGoals.length>0&&<div style={{textAlign:"center",color:T.sub,fontSize:"13px",marginTop:"12px"}}>{myGoals.filter(g=>g.done).length} of {myGoals.length} — {myGoals.every(g=>g.done)?"🎉 All done!":"keep going!"}</div>}
          </div>
        )}

        {/* KIDS / REWARDS */}
        {(tab==="kids"||tab==="rewards")&&(<>
          {isAdmin&&tab==="kids"&&(
            <div style={s.card}>
              <div style={s.h2}>⭐ Add a Kid</div>
              <div style={s.row}>
                <input style={{...s.inp,flex:2}} placeholder="Kid's name..." value={kidName} onChange={e=>setKidName(e.target.value)}/>
                <input style={{...s.inp,flex:1,maxWidth:"58px"}} placeholder="😀" value={kidEmoji} onChange={e=>setKidEmoji(e.target.value)}/>
                <button style={s.btn} onClick={()=>{if(!kidName.trim())return;saveKids([...kids,{id:Date.now(),name:kidName,emoji:kidEmoji||"🧒",points:0,tasks:[]}]);setKidName("");setKidEmoji("🧒");}}>Add</button>
              </div>
            </div>
          )}
          {kids.length===0&&<div style={{...s.card,textAlign:"center",color:T.sub,padding:"24px"}}><div style={{fontSize:"32px"}}>👧👦</div><div style={{marginTop:"8px"}}>No kids yet!</div></div>}
          {kids.filter(k=>isKid?k.name===current?.name:true).map((kid)=>{
            const ri=kids.indexOf(kid); const lvl=Math.floor(kid.points/100); const prog=kid.points%100;
            return(<div key={kid.id} style={s.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                  <span style={{fontSize:"28px"}}>{kid.emoji}</span>
                  <div><div style={{fontSize:"17px",fontWeight:"bold"}}>{kid.name}</div><div style={{fontSize:"12px",color:T.sub}}>🏆 Level {lvl} — {kid.points} pts total</div></div>
                </div>
                <div style={{background:T.accent,color:T.bg,borderRadius:"20px",padding:"5px 14px",fontWeight:"bold",fontSize:"14px"}}>⭐ {kid.points}</div>
              </div>
              <div style={{marginBottom:"14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:"12px",color:T.sub,marginBottom:"4px"}}><span>Progress to reward</span><span>{prog}/100</span></div>
                <div style={s.pbar}><div style={s.pfill(prog)}/></div>
                {prog===0&&kid.points>0&&<div style={{color:T.accent,fontSize:"13px",textAlign:"center",marginTop:"6px"}}>🎉 Reward unlocked! Level {lvl}!</div>}
              </div>
              {isAdmin&&(<div style={{marginBottom:"12px"}}>
                <div style={s.h3}>Add Task</div>
                <div style={s.row}>
                  <input style={{...s.inp,flex:3}} placeholder="Task..." value={activeKid===ri?taskText:""} onChange={e=>{setTaskText(e.target.value);setActiveKid(ri);}}/>
                  <input style={{...s.inp,flex:1,maxWidth:"58px"}} type="number" placeholder="pts" value={activeKid===ri?taskPts:"10"} onChange={e=>{setTaskPts(e.target.value);setActiveKid(ri);}}/>
                  <button style={s.btnSm} onClick={()=>{if(!taskText.trim())return;saveKids(kids.map((k,i)=>i===ri?{...k,tasks:[...k.tasks,{text:taskText,done:false,pts:parseInt(taskPts)||10,id:Date.now()}]}:k));setTaskText("");setTaskPts("10");}}>+</button>
                </div>
              </div>)}
              {kid.tasks.length===0&&<div style={{color:T.sub,fontSize:"13px",textAlign:"center",padding:"8px"}}>No tasks yet!</div>}
              {kid.tasks.map((task,ti)=>(<div key={task.id||ti} style={s.irow}>
                <span style={{fontSize:"14px",textDecoration:task.done?"line-through":"none",color:task.done?T.sub:T.text,flex:1}}>{task.text}</span>
                {!task.done?<button style={s.btnSm} onClick={()=>saveKids(kids.map((k,i)=>i===ri?{...k,points:k.points+(task.pts||10),tasks:k.tasks.map((t,tii)=>tii===ti?{...t,done:true}:t)}:k))}>✓ +{task.pts||10}pts</button>:<span style={{color:T.accent,fontSize:"12px"}}>✅ +{task.pts||10}</span>}
              </div>))}
              {isAdmin&&(<div style={{display:"flex",gap:"8px",marginTop:"14px"}}>
                <button style={{...s.btnO,fontSize:"12px"}} onClick={()=>saveKids(kids.map((k,i)=>i===ri?{...k,points:0,tasks:k.tasks.map(t=>({...t,done:false}))}:k))}>Reset</button>
                <button style={{...s.btnO,fontSize:"12px",borderColor:"#ef4444",color:"#ef4444"}} onClick={()=>saveKids(kids.filter((_,i)=>i!==ri))}>Remove</button>
              </div>)}
            </div>);
          })}
        </>)}

        {/* 🎮 GAME TAB */}
        {tab==="game"&&(
          <>
            <StarCatcherGame
              onEarnPoints={handleGamePoints}
              kidName={current?.name || "Player"}
              T={T}
            />
            <div style={{...s.card, textAlign:"center"}}>
              <div style={s.h3}>How Points Work</div>
              <div style={{color:T.sub, fontSize:"13px", lineHeight:1.8}}>
                ⭐ Normal star = 1 pt<br/>
                🌟 Glowing star = 2 pts<br/>
                💫 Shooting star = 3 pts<br/>
                ☄️ Comet = 5 pts<br/>
                💣 Bomb = lose a life!<br/>
                <span style={{color:T.accent, fontWeight:"bold"}}>All points go to your real reward total!</span>
              </div>
            </div>
          </>
        )}

        {/* CALENDAR */}
        {tab==="calendar"&&(<>
          {!isKid&&(<div style={s.card}>
            <div style={s.h2}>📅 Add Family Event</div>
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              <input style={s.inp} placeholder="Event title..." value={appt.title} onChange={e=>setAppt(a=>({...a,title:e.target.value}))}/>
              <input style={s.inp} type="date" value={appt.date} onChange={e=>setAppt(a=>({...a,date:e.target.value}))}/>
              <input style={s.inp} type="time" value={appt.time} onChange={e=>setAppt(a=>({...a,time:e.target.value}))}/>
              <input style={s.inp} placeholder="Notes (optional)" value={appt.note} onChange={e=>setAppt(a=>({...a,note:e.target.value}))}/>
              <button style={s.btn} onClick={()=>{if(!appt.title||!appt.date)return;saveShared([...sharedCal,{...appt,id:Date.now()}]);setAppt({title:"",date:"",time:"",note:""});}}>Save</button>
            </div>
          </div>)}
          <div style={s.card}>
            <div style={s.h2}>📋 Family Events</div>
            {sharedCal.length===0&&<div style={{color:T.sub,textAlign:"center",padding:"16px"}}>No family events yet!</div>}
            {[...sharedCal].sort((a,b)=>new Date(a.date)-new Date(b.date)).map((a,i)=>(
              <div key={i} style={{background:T.bg,borderRadius:"12px",padding:"13px",marginBottom:"8px"}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <div><div style={{fontWeight:"bold"}}>{a.title}</div><div style={{color:T.accent,fontSize:"13px",marginTop:"3px"}}>{fmtDate(a.date)}{a.time?` at ${a.time}`:""}</div>{a.note&&<div style={{color:T.sub,fontSize:"12px",marginTop:"3px"}}>{a.note}</div>}</div>
                  {!isKid&&<span onClick={()=>saveShared(sharedCal.filter((_,idx)=>idx!==i))} style={{color:T.sub,cursor:"pointer",fontSize:"22px",marginLeft:"10px"}}>×</span>}
                </div>
              </div>
            ))}
          </div>
        </>)}

        {/* WORK */}
        {tab==="work"&&isAdmin&&(<>
          <div style={{...s.card,borderLeft:"4px solid #3b82f6"}}>
            <div style={{fontSize:"17px",fontWeight:"bold",color:"#3b82f6",marginBottom:"4px"}}>💼 Work Calendar</div>
            <div style={{color:T.sub,fontSize:"12px",marginBottom:"14px"}}>🔒 Private — only visible to you</div>
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              <input style={s.inp} placeholder="Work event..." value={appt.title} onChange={e=>setAppt(a=>({...a,title:e.target.value}))}/>
              <input style={s.inp} type="date" value={appt.date} onChange={e=>setAppt(a=>({...a,date:e.target.value}))}/>
              <input style={s.inp} type="time" value={appt.time} onChange={e=>setAppt(a=>({...a,time:e.target.value}))}/>
              <input style={s.inp} placeholder="Notes..." value={appt.note} onChange={e=>setAppt(a=>({...a,note:e.target.value}))}/>
              <button style={{...s.btn,background:"#3b82f6"}} onClick={()=>{if(!appt.title||!appt.date)return;saveWork([...workCal,{...appt,id:Date.now()}]);setAppt({title:"",date:"",time:"",note:""});}}>Save Work Event</button>
            </div>
          </div>
          <div style={{...s.card,borderLeft:"4px solid #8b5cf6"}}>
            <div style={{fontSize:"17px",fontWeight:"bold",color:"#8b5cf6",marginBottom:"4px"}}>🤖 AI: Email → Calendar</div>
            <div style={{color:T.sub,fontSize:"13px",marginBottom:"12px"}}>Paste a work email — AI pulls out the appointment automatically!</div>
            <textarea style={s.txa} placeholder="Paste email text here..." value={aiEmail} onChange={e=>setAiEmail(e.target.value)}/>
            <button style={{...s.btn,background:"#8b5cf6",width:"100%",marginTop:"10px"}} onClick={parseEmail} disabled={aiLoad}>{aiLoad?"🤖 Reading...":"🤖 Extract Appointment"}</button>
            {aiRes&&!aiRes.error&&(<div style={{background:T.bg,borderRadius:"12px",padding:"14px",marginTop:"12px"}}>
              <div style={{color:"#8b5cf6",fontWeight:"bold",marginBottom:"10px"}}>✅ Found:</div>
              {[["Title",aiRes.title],["Date",aiRes.date],["Time",aiRes.time],["Note",aiRes.note]].map(([k,v])=>v?<div key={k} style={{fontSize:"14px",marginBottom:"5px"}}><span style={{color:T.sub}}>{k}: </span><b>{v}</b></div>:null)}
              <div style={{...s.row,marginTop:"12px"}}>
                <button style={{...s.btn,flex:1,background:"#3b82f6",fontSize:"13px"}} onClick={()=>{saveWork([...workCal,{...aiRes,id:Date.now()}]);setAiRes(null);setAiEmail("");}}>Add to Work 💼</button>
                <button style={{...s.btn,flex:1,fontSize:"13px"}} onClick={()=>{saveShared([...sharedCal,{...aiRes,id:Date.now()}]);setAiRes(null);setAiEmail("");}}>Add to Family 📅</button>
              </div>
            </div>)}
            {aiRes?.error&&<div style={{color:"#ef4444",marginTop:"10px",fontSize:"14px"}}>⚠️ {aiRes.error}</div>}
          </div>
          <div style={s.card}>
            <div style={{fontWeight:"bold",fontSize:"17px",color:"#3b82f6",marginBottom:"12px"}}>Your Work Events</div>
            {workCal.length===0&&<div style={{color:T.sub,textAlign:"center",padding:"16px"}}>No work events yet!</div>}
            {[...workCal].sort((a,b)=>new Date(a.date)-new Date(b.date)).map((a,i)=>(<div key={i} style={{background:T.bg,borderRadius:"12px",padding:"13px",marginBottom:"8px"}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <div><div style={{fontWeight:"bold"}}>{a.title}</div><div style={{color:"#3b82f6",fontSize:"13px"}}>{fmtDate(a.date)}{a.time?` at ${a.time}`:""}</div>{a.note&&<div style={{color:T.sub,fontSize:"12px"}}>{a.note}</div>}</div>
                <span onClick={()=>saveWork(workCal.filter((_,idx)=>idx!==i))} style={{color:T.sub,cursor:"pointer",fontSize:"22px",marginLeft:"10px"}}>×</span>
              </div>
            </div>))}
          </div>
        </>)}

        {/* SETTINGS */}
        {tab==="settings"&&isAdmin&&(
          <div style={s.card}>
            <div style={s.h2}>⚙️ Settings</div>
            <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"18px"}}>
              {[["profile","Profile"],["nutrition","Nutrition"],["profiles","Family"],["info","Info"]].map(([id,lbl])=>(<button key={id} style={{...s.btnO,background:subSet===id?T.accent:"none",color:subSet===id?T.bg:T.accent,fontSize:"12px",padding:"7px 12px"}} onClick={()=>setSubSet(id)}>{lbl}</button>))}
            </div>

            {subSet==="profile"&&(<div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
              <div style={s.h3}>Display Name</div>
              <input style={s.inp} defaultValue={current?.name} onChange={e=>saveProfiles(profiles.map(p=>p.id===current.id?{...p,name:e.target.value}:p))}/>
              <div style={s.h3}>Change Admin PIN</div>
              <input style={s.inp} type="password" maxLength={4} placeholder="New 4-digit PIN..." value={newPin} onChange={e=>{setNewPin(e.target.value);if(e.target.value.length===4){saveProfiles(profiles.map(p=>p.id==="admin"?{...p,pin:e.target.value}:p));setTimeout(()=>setNewPin(""),500);}}}/>
              <div style={{color:T.sub,fontSize:"12px"}}>Saves automatically after 4 digits</div>
            </div>)}

            {subSet==="nutrition"&&(<div>
              <div style={s.h3}>Which macros do YOU track?</div>
              <div style={{marginBottom:"18px"}}>
                {ALL_MACROS.map(m=>(<span key={m.key} style={s.tag(myTracked.includes(m.key),m.color)} onClick={()=>updateTracked(m.key)}>{myTracked.includes(m.key)?"★ ":""}{m.label}</span>))}
                <div style={{color:T.sub,fontSize:"12px",marginTop:"8px"}}>Each family member sets their own!</div>
              </div>
              <div style={s.h3}>Daily Goals</div>
              {ALL_MACROS.filter(m=>myTracked.includes(m.key)).map(m=>(<div key={m.key} style={{...s.row,marginBottom:"10px",alignItems:"center"}}>
                <span style={{color:m.color,fontSize:"13px",minWidth:"80px",fontWeight:"bold"}}>{m.label}</span>
                <input style={{...s.inp,flex:1}} type="number" value={myNutGoals[m.key]||""} placeholder={String(DEFAULT_NUT_GOALS[m.key])} onChange={e=>updateGoal(m.key,e.target.value)}/>
                <span style={{color:T.sub,fontSize:"12px",minWidth:"30px"}}>{m.unit}</span>
              </div>))}
            </div>)}

            {subSet==="profiles"&&(<div>
              <div style={s.h3}>Add Family Member</div>
              <div style={{display:"flex",flexDirection:"column",gap:"8px",marginBottom:"18px"}}>
                <input style={s.inp} placeholder="Name..." value={newPName} onChange={e=>setNewPName(e.target.value)}/>
                <div style={s.row}>
                  <input style={{...s.inp,flex:1}} placeholder="Emoji 😊" value={newPEmoji} onChange={e=>setNewPEmoji(e.target.value)}/>
                  <select style={{...s.inp,flex:1}} value={newPType} onChange={e=>setNewPType(e.target.value)}>
                    <option value="family">Family (adult)</option>
                    <option value="kid">Kid (limited)</option>
                  </select>
                </div>
                <button style={s.btn} onClick={()=>{if(!newPName.trim())return;saveProfiles([...profiles,{id:`p_${Date.now()}`,name:newPName,emoji:newPEmoji||"😊",type:newPType}]);setNewPName("");setNewPEmoji("😊");}}>Add</button>
              </div>
              <div style={s.h3}>All Profiles</div>
              {profiles.map((p,i)=>(<div key={i} style={s.irow}>
                <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
                  <span style={{fontSize:"26px"}}>{p.emoji}</span>
                  <div><div style={{fontSize:"14px",fontWeight:"bold"}}>{p.name}</div><div style={{fontSize:"12px",color:T.sub}}>{p.type}{p.id==="admin"?" (you)":""}</div></div>
                </div>
                {p.id!=="admin"&&<span onClick={()=>saveProfiles(profiles.filter((_,idx)=>idx!==i))} style={{color:T.sub,cursor:"pointer",fontSize:"22px"}}>×</span>}
              </div>))}
            </div>)}

            {subSet==="info"&&(<div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
              {[["🌐 Timezone",Intl.DateTimeFormat().resolvedOptions().timeZone],["🕐 Time",new Date().toLocaleString()],[`🍳 Recipes`,`${RECIPES.length} recipes`],["🎮 Game","Star Catcher — earn real points!"],["📱 Version","LUCAC Life v4.0"],["🏢 By","Lucac LLC"]].map(([l,v])=>(<div key={l} style={{background:T.bg,borderRadius:"12px",padding:"12px"}}><div style={{color:T.sub,fontSize:"12px"}}>{l}</div><div style={{fontWeight:"bold",fontSize:"14px",marginTop:"3px"}}>{v}</div></div>))}
            </div>)}
          </div>
        )}

      </div>

      {/* NAV */}
      <nav style={s.nav}>
        {tabs.map(t=>(<button key={t.id} style={s.nBtn(tab===t.id)} onClick={()=>setTab(t.id)}><span style={{fontSize:"19px"}}>{t.icon}</span><span>{t.label}</span></button>))}
      </nav>
    </div>
  );
}
