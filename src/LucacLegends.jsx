import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════
// GAME DATA
// ═══════════════════════════════════════════════════════════

const PLAYERS = [
  { id:"yana",  name:"Yana",  nickname:"Ya Naynay",           emoji:"👧", color:"#f43f5e", unlockLevel:0 },
  { id:"luca",  name:"Luca",  nickname:"Lulu Sama The Slayer",emoji:"👦", color:"#3b82f6", unlockLevel:0 },
  { id:"dada",  name:"Dada",  nickname:"The OG",              emoji:"👑", color:"#f59e0b", unlockLevel:0 },
  { id:"p4",    name:"Player 4", nickname:"The Newcomer",     emoji:"🌟", color:"#4ade80", unlockLevel:0 },
];

const WORLDS = [
  { id:"jungle",     name:"Jungle of Doom",     emoji:"🌴", color:"#4ade80", bg:"#0d1f12", unlockLevel:0,  boss:{ name:"Chief Stinkybreath", title:"The Gorilla Warlord",     emoji:"🦍", color:"#4ade80", hp:5, insults:["You smell like a banana peel!","My grandma swings better than you!","Even the monkeys laugh at you!","You couldn't climb a ladder!","STINKYBREATH SMASH!"] }},
  { id:"space",      name:"Outer Space",         emoji:"🚀", color:"#38bdf8", bg:"#030712", unlockLevel:5,  boss:{ name:"Emperor Zorblon",    title:"The Destroyer of Worlds",  emoji:"👾", color:"#38bdf8", hp:6, insults:["Your planet is TRASH!","I have destroyed 1000 worlds better than yours!","You are but a tiny speck!","ZORBLON OBLITERATE!","Resistance is FUTILE!"] }},
  { id:"underwater", name:"The Deep",            emoji:"🌊", color:"#06b6d4", bg:"#0c1445", unlockLevel:10, boss:{ name:"Baron Blubberfish", title:"Lord of the Deep Dark",    emoji:"🐡", color:"#06b6d4", hp:6, insults:["You can't even swim properly!","Blub blub blub LOSER!","You're all wet!","I've seen better heroes in a fish tank!","BLUBBERFISH BUBBLES OF DOOM!"] }},
  { id:"fantasy",    name:"Dark Kingdom",        emoji:"🏰", color:"#f43f5e", bg:"#1a0a10", unlockLevel:15, boss:{ name:"Danyells",           title:"The Dark Queen of Doom",  emoji:"👩‍🦹", color:"#f43f5e", hp:7, insults:["You call yourself a HERO?! HA!","My houseplant is braver than you!","You couldn't defeat a ROCK!","WHERE WERE YOU WHEN WE NEEDED YOU?!","You're getting served... DEFEAT! 💅","I've seen better heroes in a fairy tale!","DANYELLS ULTIMATE DARK ATTACK! 💅"] }},
  { id:"volcano",    name:"Volcano Peak",        emoji:"🌋", color:"#fb923c", bg:"#1a0500", unlockLevel:20, boss:{ name:"MAGMAZILLA",         title:"The Destroyer of Everything",emoji:"🦖", color:"#fb923c", hp:8, insults:["MAGMAZILLA HUNGRY!","YOUR PUNY DRAWINGS MEAN NOTHING!","MAGMAZILLA SMASH EVERYTHING!","THE VOLCANO IS MY HOUSE!","RAAAAAAAWRRRR! 🔥","MAGMAZILLA ULTIMATE LAVA DESTRUCTION!","YOU ARE NO MATCH FOR MAGMAZILLA!","FINAL FORM ACTIVATED! 💥"] }},
];

const LEVELS = [
  // Jungle
  { world:"jungle", level:1, title:"The Fallen Tree",       puzzle:"A huge tree blocks the path! Draw something to get past it.",          solutions:["axe","saw","chainsaw","ladder","bridge","ramp","jump","wings","rocket","fly","sword","knife","cut"], reward:5,  bg:"🌿🌴🌿" },
  { world:"jungle", level:2, title:"The Hungry Tiger",      puzzle:"A tiger is blocking the cave entrance! Draw something to scare it away.",solutions:["fire","torch","water gun","spray","noise","drum","gun","shield","armor","cage","net","trap","mouse","cat"],    reward:6,  bg:"🐅🌴🌿" },
  { world:"jungle", level:3, title:"The Wide River",        puzzle:"The river is too wide to jump! Draw something to cross it.",            solutions:["bridge","boat","raft","swim","rope","vine","plank","surfboard","canoe","helicopter","fly","wings"],             reward:7,  bg:"🌊🌴💧" },
  { world:"jungle", level:4, title:"The Poison Berries",    puzzle:"You're hungry but all the berries are poison! Draw safe food.",         solutions:["apple","bread","sandwich","pizza","chicken","fruit","banana","mango","fish","coconut","candy","cake"],          reward:8,  bg:"🍒🌿🌴" },
  { world:"jungle", level:5, title:"BOSS: Chief Stinkybreath", puzzle:"CHIEF STINKYBREATH appears! Draw your weapon to defeat him!",        solutions:["sword","spear","bow","arrow","gun","laser","shield","armor","potion","magic","wand","bomb","trap","cage","net","banana","banana peel"], reward:15, boss:true, bg:"🦍💥🌴" },
  // Space
  { world:"space",  level:1, title:"Broken Rocket",         puzzle:"Your rocket has a hole in it! Draw something to fix it.",               solutions:["patch","tape","glue","weld","seal","bandage","metal","shield","cover","fill","plug"],                            reward:8,  bg:"🚀⭐🌑" },
  { world:"space",  level:2, title:"The Asteroid Field",    puzzle:"Asteroids are flying at you! Draw something to survive!",               solutions:["shield","laser","gun","dodge","rocket","boost","wall","barrier","helmet","armor","deflector","force field"],     reward:9,  bg:"☄️🚀⭐" },
  { world:"space",  level:3, title:"Zero Gravity",          puzzle:"You're floating away into space! Draw something to stay grounded.",      solutions:["anchor","rope","magnet","hook","boots","glue","weight","chain","tether","gravity gun","jetpack"],                reward:10, bg:"🌌⭐🚀" },
  { world:"space",  level:4, title:"The Alien Lockbox",     puzzle:"An alien locked a door with a weird code! Draw the key.",               solutions:["key","code","laser","hacksaw","password","computer","hack","drill","bomb","crowbar","magnet","sonic screwdriver"], reward:11, bg:"👽🔒⭐" },
  { world:"space",  level:5, title:"BOSS: Emperor Zorblon", puzzle:"EMPEROR ZORBLON appears to destroy your world! Draw your weapon!",      solutions:["laser","cannon","missile","sword","shield","bomb","rocket","spaceship","armor","force field","black hole","sun"], reward:20, boss:true, bg:"👾💥🚀" },
  // Underwater
  { world:"underwater", level:1, title:"The Shark",         puzzle:"A great white shark is chasing you! Draw something to escape!",         solutions:["cage","submarine","speed","torpedo","spear","knife","repellent","noise","electric","shield","rocket","jet","bubble"],reward:10, bg:"🦈🌊💧" },
  { world:"underwater", level:2, title:"The Dark Deep",     puzzle:"It's pitch black down here! Draw something to see.",                    solutions:["flashlight","torch","lamp","lantern","light","glow","fire","candle","headlamp","submarine light","bioluminescence"], reward:11, bg:"🌑🌊🐟" },
  { world:"underwater", level:3, title:"The Whirlpool",     puzzle:"A massive whirlpool is pulling you in! Draw something to escape!",      solutions:["anchor","rope","submarine","rocket","boost","motor","propeller","hook","chain","jetpack","swim fast"],             reward:12, bg:"🌀🌊💧" },
  { world:"underwater", level:4, title:"The Sunken Chest",  puzzle:"A treasure chest is locked at the bottom! Draw something to open it.", solutions:["key","crowbar","drill","bomb","laser","hacksaw","pickaxe","hammer","chisel","dynamite","magic wand"],              reward:13, bg:"💰🌊🐙" },
  { world:"underwater", level:5, title:"BOSS: Baron Blubberfish", puzzle:"BARON BLUBBERFISH rises from the deep! Draw your weapon!",        solutions:["harpoon","net","hook","torpedo","electric","spear","laser","cage","submarine","giant fork","fishing rod","shark","whale"], reward:25, boss:true, bg:"🐡💥🌊" },
  // Fantasy
  { world:"fantasy", level:1, title:"The Dragon Gate",      puzzle:"A sleeping dragon guards the gate! Draw something to sneak past.",      solutions:["invisible","cloak","silence","distract","food","sheep","decoy","invisibility potion","shadow","stealth","disguise"], reward:12, bg:"🐉🏰✨" },
  { world:"fantasy", level:2, title:"The Cursed Bridge",    puzzle:"The bridge crumbles when you step on it! Draw something to cross.",     solutions:["fly","wings","dragon","magic carpet","rope","zipline","teleport","portal","jump","trampoline","balloon","broom"],   reward:13, bg:"🌉🏰⚡" },
  { world:"fantasy", level:3, title:"The Spell Lock",       puzzle:"An evil spell is blocking the door! Draw something to break it.",       solutions:["magic wand","counter spell","sword","shield","crystal","potion","staff","rune","holy water","rainbow","light","sun"],  reward:14, bg:"🔮🏰✨" },
  { world:"fantasy", level:4, title:"The Evil Mirror",      puzzle:"The evil mirror shows your worst fear! Draw something brave!",          solutions:["shield","sword","courage","mirror","smash","hammer","rock","truth","light","love","heart","family","friendship"],      reward:15, bg:"🪞🏰😨" },
  { world:"fantasy", level:5, title:"BOSS: DANYELLS",       puzzle:"DANYELLS the Dark Queen appears and unleashes her dark powers! Draw your weapon to defeat her!!", solutions:["shield","earmuffs","lawyer","judge","restraining order","sword","armor","magic","love","family","heart","court","bodyguard","light","rainbow"], reward:30, boss:true, bg:"👩‍🦹💅🏰" },
  // Volcano
  { world:"volcano", level:1, title:"The Lava Floor",       puzzle:"The floor is literally lava! Draw something to walk on!",              solutions:["stilts","platform","bridge","rock","stone","metal boots","hover","fly","wings","jump pads","trampoline","skateboard"], reward:15, bg:"🌋🔥💥" },
  { world:"volcano", level:2, title:"The Fire Bats",        puzzle:"Fire bats are dive bombing you! Draw something to protect yourself!",   solutions:["shield","helmet","armor","net","racket","bat","swatter","water","ice","fan","umbrella","force field"],               reward:16, bg:"🦇🔥🌋" },
  { world:"volcano", level:3, title:"The Magma River",      puzzle:"A river of magma blocks the path! Draw something to cross!",            solutions:["ice bridge","metal bridge","flying machine","wings","helicopter","rocket","jump","pole vault","freeze ray","water cannon"],reward:17, bg:"🌊🔥🌋" },
  { world:"volcano", level:4, title:"The Volcano Rumbles",  puzzle:"The volcano is about to explode! Draw something to stop it!",          solutions:["cork","plug","seal","giant rock","ice","water","drain","valve","stopper","bomb it first","nuclear option","science"],   reward:18, bg:"💥🌋🔥" },
  { world:"volcano", level:5, title:"BOSS: MAGMAZILLA",     puzzle:"MAGMAZILLA FINAL BOSS ULTIMATE DESTRUCTION MODE ACTIVATED! Draw the most powerful thing you can imagine!!", solutions:["ice cannon","water bomb","freeze ray","ocean","glacier","blizzard","mega sword","nuclear","giant","mega","ultimate","anything"], reward:50, boss:true, bg:"🦖💥🌋" },
];

const DRAW_PROMPTS = [
  "What are you drawing? 🤔",
  "Hmm let me think about this...",
  "Interesting choice! 🧐",
  "That could work!",
  "Getting creative! 🎨",
];

const store = {
  get: async (k) => { try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; } catch { return null; } },
  set: async (k, v) => { try { await window.storage.set(k, JSON.stringify(v)); } catch {} },
};

// ═══════════════════════════════════════════════════════════
// DRAWING CANVAS
// ═══════════════════════════════════════════════════════════
function DrawingCanvas({ onSave, onClose, title, subtitle, color, height = 280, showLabel = true }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [label, setLabel] = useState("");
  const [hasDrawn, setHasDrawn] = useState(false);
  const lastPos = useRef(null);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0] || e;
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    setDrawing(true);
    setHasDrawn(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    lastPos.current = pos;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!drawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.strokeStyle = color || "#f59e0b";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => setDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const saveDrawing = () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL();
    onSave(dataUrl, label);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:1000, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"16px" }}>
      <div style={{ width:"100%", maxWidth:"480px" }}>
        <div style={{ textAlign:"center", marginBottom:"14px" }}>
          <div style={{ fontSize:"22px", fontWeight:"bold", color: color||"#f59e0b", fontFamily:"Georgia,serif" }}>{title}</div>
          {subtitle && <div style={{ fontSize:"13px", color:"#94a3b8", marginTop:"4px" }}>{subtitle}</div>}
        </div>

        <div style={{ position:"relative", borderRadius:"16px", overflow:"hidden", border:`3px solid ${color||"#f59e0b"}`, boxShadow:`0 0 30px ${color||"#f59e0b"}44` }}>
          <canvas
            ref={canvasRef}
            width={440}
            height={height}
            style={{ display:"block", background:"#0a0a1a", width:"100%", touchAction:"none", cursor:"crosshair" }}
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
          />
          {!hasDrawn && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
              <div style={{ color:"#ffffff22", fontSize:"18px", textAlign:"center", fontFamily:"Georgia,serif" }}>✏️ Draw here with your finger!</div>
            </div>
          )}
        </div>

        {showLabel && (
          <input
            style={{ width:"100%", background:"#1a1a2e", border:`1px solid ${color||"#f59e0b"}44`, borderRadius:"10px", padding:"10px 14px", color:"white", fontSize:"14px", marginTop:"10px", boxSizing:"border-box", fontFamily:"Georgia,serif" }}
            placeholder="What did you draw? (type it here)"
            value={label}
            onChange={e => setLabel(e.target.value)}
          />
        )}

        <div style={{ display:"flex", gap:"10px", marginTop:"12px" }}>
          <button onClick={clearCanvas} style={{ flex:1, background:"none", border:"1px solid #444", borderRadius:"10px", padding:"12px", color:"#94a3b8", fontSize:"14px", cursor:"pointer" }}>🗑️ Clear</button>
          {onClose && <button onClick={onClose} style={{ flex:1, background:"none", border:"1px solid #444", borderRadius:"10px", padding:"12px", color:"#94a3b8", fontSize:"14px", cursor:"pointer" }}>Cancel</button>}
          <button onClick={saveDrawing} disabled={!hasDrawn} style={{ flex:2, background:hasDrawn?(color||"#f59e0b"):"#333", border:"none", borderRadius:"10px", padding:"12px", color:hasDrawn?"#000":"#666", fontSize:"14px", fontWeight:"bold", cursor:hasDrawn?"pointer":"not-allowed" }}>
            {hasDrawn ? "✅ Use This!" : "Draw something first!"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// AI PUZZLE JUDGE
// ═══════════════════════════════════════════════════════════
async function judgeDrawing(levelData, drawnLabel) {
  const label = drawnLabel.toLowerCase().trim();
  if (!label) return { success: false, message: "Type what you drew first! 🎨" };

  // Check local solutions first for speed
  const localMatch = levelData.solutions.some(sol =>
    label.includes(sol) || sol.includes(label) ||
    label.split(" ").some(word => sol.includes(word) && word.length > 2)
  );
  if (localMatch) {
    const wins = ["AMAZING!! That works perfectly! 🎉", "GENIUS!! You figured it out! 🔥", "WOW!! Perfect solution! ⭐", "INCREDIBLE!! Great thinking! 💪", "YES!! That's exactly right! 🏆"];
    return { success: true, message: wins[Math.floor(Math.random() * wins.length)] };
  }

  // Ask AI for creative solutions
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514", max_tokens: 150,
        messages: [{ role: "user", content: `A child drew "${drawnLabel}" to solve this puzzle: "${levelData.puzzle}". Would this creative solution work? Be very generous and fun for kids. Reply with JSON only: {"success":true/false,"message":"fun encouraging message under 20 words"}` }]
      })
    });
    const data = await res.json();
    const text = data.content.map(c => c.text || "").join("");
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    return parsed;
  } catch {
    // Fallback — be generous with kids
    const creative = ["That's a VERY creative solution! We'll allow it! 🎨✅", "Wow that's outside the box thinking! It works! 🧠✅", "Nobody's ever tried that before! Brilliant! 🌟✅"];
    return { success: true, message: creative[Math.floor(Math.random() * creative.length)] };
  }
}

// ═══════════════════════════════════════════════════════════
// MAIN GAME
// ═══════════════════════════════════════════════════════════
export default function LucacLegends() {
  const [screen, setScreen] = useState("title");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [playerData, setPlayerData] = useState({});
  const [showAvatarDraw, setShowAvatarDraw] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [selectedWorld, setSelectedWorld] = useState(null);
  const [currentLevel, setCurrentLevel] = useState(null);
  const [showDrawCanvas, setShowDrawCanvas] = useState(false);
  const [drawLabel, setDrawLabel] = useState("");
  const [judging, setJudging] = useState(false);
  const [judgeResult, setJudgeResult] = useState(null);
  const [bossHP, setBossHP] = useState(0);
  const [bossAttacking, setBossAttacking] = useState(false);
  const [bossInsult, setBossInsult] = useState("");
  const [currentInsultIdx, setCurrentInsultIdx] = useState(0);
  const [showLevelComplete, setShowLevelComplete] = useState(false);
  const [showWorldComplete, setShowWorldComplete] = useState(false);
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    (async () => {
      const pd = await store.get("legendsPlayerData");
      if (pd) setPlayerData(pd);
    })();
  }, []);

  const savePlayerData = (data) => { setPlayerData(data); store.set("legendsPlayerData", data); };

  const getPlayer = (pid) => playerData[pid] || { totalPoints: 0, completedLevels: [], avatar: null, avatarCount: 0 };

  const selectPlayer = (player) => {
    setSelectedPlayer(player);
    const pd = getPlayer(player.id);
    // Check if should upgrade avatar
    const milestones = [25, 50, 100, 200];
    if (pd.avatar && milestones.includes(pd.totalPoints) && !pd[`upgraded_${pd.totalPoints}`]) {
      setShowUpgradePrompt(true);
    } else if (!pd.avatar) {
      setShowAvatarDraw(true);
    } else {
      setScreen("worldmap");
    }
  };

  const saveAvatar = (dataUrl, label) => {
    const pd = getPlayer(selectedPlayer.id);
    const updated = { ...playerData, [selectedPlayer.id]: { ...pd, avatar: dataUrl, avatarLabel: label || "My Character", avatarCount: (pd.avatarCount || 0) + 1 } };
    if (showUpgradePrompt) {
      const pts = pd.totalPoints;
      updated[selectedPlayer.id][`upgraded_${pts}`] = true;
    }
    savePlayerData(updated);
    setShowAvatarDraw(false);
    setShowUpgradePrompt(false);
    setScreen("worldmap");
  };

  const startLevel = (levelData) => {
    setCurrentLevel(levelData);
    setJudgeResult(null);
    setDrawLabel("");
    if (levelData.boss) {
      const world = WORLDS.find(w => w.id === levelData.world);
      setBossHP(world.boss.hp);
      setCurrentInsultIdx(0);
    }
    setScreen("level");
  };

  const submitDrawing = async () => {
    if (!drawLabel.trim()) { setJudgeResult({ success: false, message: "Type what you drew first! ✏️" }); return; }
    setJudging(true);
    setShowDrawCanvas(false);

    if (currentLevel.boss) {
      // Boss fight logic
      const world = WORLDS.find(w => w.id === currentLevel.world);
      const result = await judgeDrawing(currentLevel, drawLabel);
      setJudging(false);

      if (result.success) {
        const newHP = bossHP - 1;
        setBossHP(newHP);
        if (newHP <= 0) {
          setJudgeResult({ success: true, message: result.message, bossDefeated: true });
          completeLevelSuccess();
        } else {
          // Boss counter attacks
          setBossAttacking(true);
          const insult = world.boss.insults[currentInsultIdx % world.boss.insults.length];
          setBossInsult(insult);
          setCurrentInsultIdx(i => i + 1);
          setTimeout(() => setBossAttacking(false), 2000);
          setJudgeResult({ success: true, message: `${result.message} Boss HP: ${newHP}/${world.boss.hp} ❤️`, bossHit: true });
        }
      } else {
        // Boss taunts on miss
        setBossAttacking(true);
        const insult = world.boss.insults[currentInsultIdx % world.boss.insults.length];
        setBossInsult(insult);
        setCurrentInsultIdx(i => i + 1);
        setTimeout(() => setBossAttacking(false), 2000);
        setJudgeResult({ success: false, message: result.message || "That didn't work! Try again! 💪" });
      }
    } else {
      const result = await judgeDrawing(currentLevel, drawLabel);
      setJudging(false);
      setJudgeResult(result);
      if (result.success) completeLevelSuccess();
    }
  };

  const completeLevelSuccess = () => {
    const pd = getPlayer(selectedPlayer.id);
    const levelKey = `${currentLevel.world}_${currentLevel.level}`;
    const alreadyDone = pd.completedLevels?.includes(levelKey);
    const newPoints = pd.totalPoints + (alreadyDone ? 0 : currentLevel.reward);
    const newCompleted = alreadyDone ? pd.completedLevels : [...(pd.completedLevels || []), levelKey];

    // Spawn particles
    setParticles([...Array(12)].map((_, i) => ({ id: i, x: 20 + Math.random() * 60, delay: i * 0.1 })));
    setTimeout(() => setParticles([]), 2000);

    const updated = { ...playerData, [selectedPlayer.id]: { ...pd, totalPoints: newPoints, completedLevels: newCompleted } };
    savePlayerData(updated);

    setTimeout(() => {
      if (currentLevel.boss) setShowWorldComplete(true);
      else setShowLevelComplete(true);
    }, 1500);
  };

  const pd = selectedPlayer ? getPlayer(selectedPlayer.id) : null;
  const totalLevelsCompleted = pd?.completedLevels?.length || 0;
  const worldLevels = selectedWorld ? LEVELS.filter(l => l.world === selectedWorld.id) : [];

  const isLevelComplete = (l) => pd?.completedLevels?.includes(`${l.world}_${l.level}`);
  const isLevelUnlocked = (l, idx) => idx === 0 || isLevelComplete(worldLevels[idx - 1]);
  const isWorldUnlocked = (w) => totalLevelsCompleted >= w.unlockLevel;

  // ── TITLE SCREEN
  if (screen === "title") return (
    <div style={{ minHeight:"100vh", background:"#030712", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"20px", fontFamily:"Georgia,serif", overflow:"hidden", position:"relative" }}>
      <div style={{ position:"absolute", inset:0, overflow:"hidden" }}>
        {[...Array(30)].map((_,i) => (
          <div key={i} style={{ position:"absolute", width:"2px", height:"2px", background:"white", borderRadius:"50%", left:`${(i*7+3)%100}%`, top:`${(i*11+5)%100}%`, opacity:0.6, animation:`twinkle ${2+Math.random()*3}s infinite`, animationDelay:`${Math.random()*3}s` }}/>
        ))}
      </div>
      <style>{`@keyframes twinkle{0%,100%{opacity:0.2}50%{opacity:1}} @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}} @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}`}</style>

      <div style={{ textAlign:"center", zIndex:1 }}>
        <div style={{ fontSize:"64px", animation:"float 3s infinite", marginBottom:"8px" }}>👑</div>
        <div style={{ fontSize:"36px", fontWeight:"bold", background:"linear-gradient(135deg, #f59e0b, #f43f5e, #a78bfa)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", letterSpacing:"3px", marginBottom:"4px" }}>LUCAC</div>
        <div style={{ fontSize:"24px", color:"#f59e0b", letterSpacing:"6px", marginBottom:"4px" }}>LEGENDS</div>
        <div style={{ color:"#64748b", fontSize:"12px", letterSpacing:"2px", marginBottom:"32px" }}>DRAW YOUR WAY TO VICTORY</div>

        <button onClick={() => setScreen("players")} style={{ background:"linear-gradient(135deg, #f59e0b, #f97316)", border:"none", borderRadius:"16px", padding:"16px 48px", fontSize:"20px", fontWeight:"bold", color:"#000", cursor:"pointer", boxShadow:"0 0 30px #f59e0b66", letterSpacing:"1px" }}>
          ▶ PLAY
        </button>
        <button onClick={() => setScreen("leaderboard")} style={{ display:"block", margin:"14px auto 0", background:"none", border:"1px solid #f59e0b44", borderRadius:"12px", padding:"10px 28px", fontSize:"14px", color:"#f59e0b", cursor:"pointer" }}>
          🏆 LEADERBOARD
        </button>
      </div>
    </div>
  );

  // ── PLAYER SELECT
  if (screen === "players") return (
    <div style={{ minHeight:"100vh", background:"#030712", fontFamily:"Georgia,serif", padding:"20px" }}>
      <div style={{ textAlign:"center", marginBottom:"28px" }}>
        <div style={{ fontSize:"22px", fontWeight:"bold", color:"#f59e0b", letterSpacing:"2px" }}>WHO'S PLAYING?</div>
        <div style={{ color:"#64748b", fontSize:"13px", marginTop:"4px" }}>Choose your hero</div>
      </div>

      {PLAYERS.map(player => {
        const pd = getPlayer(player.id);
        return (
          <div key={player.id} onClick={() => selectPlayer(player)}
            style={{ background:`linear-gradient(135deg, #0f0f1a, #1a1a2e)`, border:`2px solid ${player.color}44`, borderRadius:"20px", padding:"18px", marginBottom:"14px", cursor:"pointer", display:"flex", alignItems:"center", gap:"16px", boxShadow:`0 4px 20px ${player.color}22` }}>
            {pd.avatar
              ? <img src={pd.avatar} style={{ width:"64px", height:"64px", borderRadius:"50%", border:`3px solid ${player.color}`, objectFit:"cover", background:"#0a0a1a" }} alt="avatar"/>
              : <div style={{ width:"64px", height:"64px", borderRadius:"50%", border:`3px solid ${player.color}`, background:"#0a0a1a", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"28px" }}>{player.emoji}</div>
            }
            <div style={{ flex:1 }}>
              <div style={{ fontSize:"18px", fontWeight:"bold", color:player.color }}>{player.name}</div>
              <div style={{ fontSize:"12px", color:"#64748b", marginTop:"2px" }}>{player.nickname}</div>
              <div style={{ fontSize:"12px", color:"#f59e0b", marginTop:"4px" }}>⭐ {pd.totalPoints} pts • {pd.completedLevels?.length || 0} levels</div>
            </div>
            <div style={{ fontSize:"24px" }}>▶</div>
          </div>
        );
      })}

      <button onClick={() => setScreen("title")} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:"14px", display:"block", margin:"16px auto" }}>← Back</button>

      {showAvatarDraw && (
        <DrawingCanvas
          title={`Draw your character, ${selectedPlayer?.name}! 🎨`}
          subtitle="This is YOUR hero! Draw them with your finger!"
          color={selectedPlayer?.color}
          onSave={saveAvatar}
          onClose={() => { setShowAvatarDraw(false); setSelectedPlayer(null); }}
          height={300}
        />
      )}

      {showUpgradePrompt && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", zIndex:1000, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"20px" }}>
          <div style={{ textAlign:"center", maxWidth:"360px" }}>
            <div style={{ fontSize:"48px", marginBottom:"12px" }}>🎨</div>
            <div style={{ fontSize:"22px", fontWeight:"bold", color:selectedPlayer?.color, marginBottom:"8px" }}>LEVEL UP YOUR AVATAR!</div>
            <div style={{ color:"#94a3b8", fontSize:"14px", marginBottom:"24px", lineHeight:1.7 }}>
              You've earned {pd?.totalPoints} points {selectedPlayer?.name}!<br/>
              You can redraw your character to show how far you've come! 💪
            </div>
            <div style={{ display:"flex", gap:"12px", justifyContent:"center" }}>
              <button onClick={() => { setShowUpgradePrompt(false); setShowAvatarDraw(true); }} style={{ background:selectedPlayer?.color, border:"none", borderRadius:"12px", padding:"12px 24px", fontSize:"15px", fontWeight:"bold", color:"#000", cursor:"pointer" }}>✏️ Redraw!</button>
              <button onClick={() => { setShowUpgradePrompt(false); setScreen("worldmap"); }} style={{ background:"none", border:`1px solid ${selectedPlayer?.color}`, borderRadius:"12px", padding:"12px 24px", fontSize:"15px", color:selectedPlayer?.color, cursor:"pointer" }}>Keep Mine</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── LEADERBOARD
  if (screen === "leaderboard") return (
    <div style={{ minHeight:"100vh", background:"#030712", fontFamily:"Georgia,serif", padding:"20px" }}>
      <div style={{ textAlign:"center", marginBottom:"24px" }}>
        <div style={{ fontSize:"40px" }}>🏆</div>
        <div style={{ fontSize:"22px", fontWeight:"bold", color:"#f59e0b", letterSpacing:"2px" }}>LEADERBOARD</div>
      </div>
      {[...PLAYERS].sort((a, b) => getPlayer(b.id).totalPoints - getPlayer(a.id).totalPoints).map((player, i) => {
        const pd = getPlayer(player.id);
        const medals = ["🥇","🥈","🥉","🏅"];
        return (
          <div key={player.id} style={{ background:`linear-gradient(135deg, #0f0f1a, #1a1a2e)`, border:`2px solid ${i===0?"#f59e0b":player.color}44`, borderRadius:"16px", padding:"16px", marginBottom:"10px", display:"flex", alignItems:"center", gap:"14px" }}>
            <div style={{ fontSize:"28px" }}>{medals[i]}</div>
            {pd.avatar
              ? <img src={pd.avatar} style={{ width:"48px", height:"48px", borderRadius:"50%", border:`2px solid ${player.color}`, objectFit:"cover", background:"#0a0a1a" }} alt="avatar"/>
              : <div style={{ width:"48px", height:"48px", borderRadius:"50%", border:`2px solid ${player.color}`, background:"#0a0a1a", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"22px" }}>{player.emoji}</div>
            }
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:"bold", color:player.color }}>{player.name}</div>
              <div style={{ fontSize:"12px", color:"#64748b" }}>{pd.completedLevels?.length || 0} levels complete</div>
            </div>
            <div style={{ fontSize:"20px", fontWeight:"bold", color:"#f59e0b" }}>⭐ {pd.totalPoints}</div>
          </div>
        );
      })}
      <button onClick={() => setScreen("title")} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:"14px", display:"block", margin:"16px auto" }}>← Back</button>
    </div>
  );

  // ── WORLD MAP
  if (screen === "worldmap") return (
    <div style={{ minHeight:"100vh", background:"#030712", fontFamily:"Georgia,serif", padding:"20px", paddingBottom:"40px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"20px" }}>
        {pd?.avatar
          ? <img src={pd.avatar} style={{ width:"44px", height:"44px", borderRadius:"50%", border:`2px solid ${selectedPlayer?.color}`, objectFit:"cover", background:"#0a0a1a" }} alt="avatar"/>
          : <div style={{ width:"44px", height:"44px", borderRadius:"50%", border:`2px solid ${selectedPlayer?.color}`, background:"#0a0a1a", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px" }}>{selectedPlayer?.emoji}</div>
        }
        <div>
          <div style={{ fontWeight:"bold", color:selectedPlayer?.color, fontSize:"16px" }}>{selectedPlayer?.name}</div>
          <div style={{ fontSize:"12px", color:"#f59e0b" }}>⭐ {pd?.totalPoints || 0} pts</div>
        </div>
        <button onClick={() => setScreen("players")} style={{ marginLeft:"auto", background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:"20px" }}>←</button>
      </div>

      <div style={{ textAlign:"center", marginBottom:"20px" }}>
        <div style={{ fontSize:"20px", fontWeight:"bold", color:"#f59e0b", letterSpacing:"2px" }}>CHOOSE YOUR WORLD</div>
        <div style={{ fontSize:"12px", color:"#64748b", marginTop:"4px" }}>Complete levels to unlock new worlds!</div>
      </div>

      {WORLDS.map((world) => {
        const unlocked = isWorldUnlocked(world);
        const worldComplete = LEVELS.filter(l => l.world === world.id).every(l => isLevelComplete(l));
        const completedCount = LEVELS.filter(l => l.world === world.id && isLevelComplete(l)).length;
        return (
          <div key={world.id} onClick={() => { if(unlocked){ setSelectedWorld(world); setScreen("levels"); } }}
            style={{ background:`linear-gradient(135deg, #0f0f1a, ${unlocked?world.bg:"#0a0a0a"})`, border:`2px solid ${unlocked?world.color:"#333"}`, borderRadius:"20px", padding:"18px", marginBottom:"14px", cursor:unlocked?"pointer":"not-allowed", opacity:unlocked?1:0.5, position:"relative", overflow:"hidden" }}>
            {worldComplete && <div style={{ position:"absolute", top:"10px", right:"10px", background:"#f59e0b", borderRadius:"20px", padding:"2px 10px", fontSize:"11px", fontWeight:"bold", color:"#000" }}>✅ DONE!</div>}
            <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
              <div style={{ fontSize:"44px" }}>{world.emoji}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:"18px", fontWeight:"bold", color:unlocked?world.color:"#444" }}>{world.name}</div>
                <div style={{ fontSize:"12px", color:"#64748b", marginTop:"3px" }}>{completedCount}/5 levels • Boss: {world.boss.name}</div>
                {!unlocked && <div style={{ fontSize:"11px", color:"#64748b", marginTop:"3px" }}>🔒 Complete {world.unlockLevel} levels to unlock</div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── LEVEL SELECT
  if (screen === "levels" && selectedWorld) return (
    <div style={{ minHeight:"100vh", background:selectedWorld.bg, fontFamily:"Georgia,serif", padding:"20px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"24px" }}>
        <button onClick={() => setScreen("worldmap")} style={{ background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:"20px" }}>←</button>
        <div style={{ fontSize:"32px" }}>{selectedWorld.emoji}</div>
        <div>
          <div style={{ fontSize:"18px", fontWeight:"bold", color:selectedWorld.color }}>{selectedWorld.name}</div>
          <div style={{ fontSize:"12px", color:"#64748b" }}>Defeat {selectedWorld.boss.name} to conquer this world!</div>
        </div>
      </div>

      {worldLevels.map((level, idx) => {
        const done = isLevelComplete(level);
        const unlocked = isLevelUnlocked(level, idx);
        return (
          <div key={idx} onClick={() => unlocked && startLevel(level)}
            style={{ background:done?"#0f2010":unlocked?"#1a1a2e":"#0a0a0a", border:`2px solid ${done?"#4ade80":unlocked?selectedWorld.color:"#222"}`, borderRadius:"16px", padding:"16px", marginBottom:"12px", cursor:unlocked?"pointer":"not-allowed", opacity:unlocked?1:0.5, display:"flex", alignItems:"center", gap:"14px" }}>
            <div style={{ width:"44px", height:"44px", borderRadius:"50%", background:done?"#4ade8022":unlocked?`${selectedWorld.color}22`:"#222", border:`2px solid ${done?"#4ade80":unlocked?selectedWorld.color:"#333"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", flexShrink:0 }}>
              {done?"✅":unlocked?level.boss?"👾":"⚔️":"🔒"}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:"bold", color:done?"#4ade80":unlocked?selectedWorld.color:"#444", fontSize:"15px" }}>{level.title}</div>
              <div style={{ fontSize:"12px", color:"#64748b", marginTop:"3px" }}>{level.bg}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:"13px", color:"#f59e0b", fontWeight:"bold" }}>+{level.reward}⭐</div>
              {done && <div style={{ fontSize:"10px", color:"#4ade80" }}>Done!</div>}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── LEVEL SCREEN
  if (screen === "level" && currentLevel) {
    const world = WORLDS.find(w => w.id === currentLevel.world);
    return (
      <div style={{ minHeight:"100vh", background:world.bg, fontFamily:"Georgia,serif", padding:"20px", position:"relative" }}>
        <style>{`@keyframes bossShake{0%,100%{transform:scale(1) rotate(0)}25%{transform:scale(1.1) rotate(-3deg)}75%{transform:scale(1.1) rotate(3deg)}} @keyframes popUp{0%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-200%) scale(1.5)}}`}</style>

        {/* Particles */}
        {particles.map(p => (
          <div key={p.id} style={{ position:"fixed", left:`${p.x}%`, top:"50%", fontSize:"24px", animation:`popUp 1s ease-out forwards`, animationDelay:`${p.delay}s`, zIndex:999, pointerEvents:"none", transform:"translate(-50%,-50%)" }}>⭐</div>
        ))}

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"16px" }}>
          <button onClick={() => { setScreen("levels"); setJudgeResult(null); }} style={{ background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:"20px" }}>←</button>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:"16px", fontWeight:"bold", color:world.color }}>{currentLevel.title}</div>
            <div style={{ fontSize:"11px", color:"#64748b" }}>Reward: +{currentLevel.reward}⭐</div>
          </div>
          <div style={{ fontSize:"12px", color:"#f59e0b" }}>⭐ {pd?.totalPoints}</div>
        </div>

        {/* Boss HP bar */}
        {currentLevel.boss && (
          <div style={{ background:"#1a1a2e", border:`1px solid ${world.color}`, borderRadius:"12px", padding:"12px", marginBottom:"14px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
              <span style={{ color:world.color, fontWeight:"bold", fontSize:"14px" }}>{world.boss.name}</span>
              <span style={{ color:"#f43f5e", fontSize:"13px" }}>{[...Array(bossHP)].map(()=>"❤️").join("")}</span>
            </div>
            <div style={{ background:"#0a0a1a", borderRadius:"8px", height:"8px", overflow:"hidden" }}>
              <div style={{ height:"100%", background:"#f43f5e", width:`${(bossHP/world.boss.hp)*100}%`, transition:"width 0.5s", borderRadius:"8px" }}/>
            </div>
          </div>
        )}

        {/* Boss emoji */}
        {currentLevel.boss && (
          <div style={{ textAlign:"center", marginBottom:"14px", position:"relative" }}>
            <div style={{ fontSize:"80px", animation:bossAttacking?"bossShake 0.5s infinite":"none", display:"inline-block" }}>{world.boss.emoji}</div>
            {bossAttacking && bossInsult && (
              <div style={{ background:"#1a0a10", border:"2px solid #f43f5e", borderRadius:"12px", padding:"10px 14px", marginTop:"8px", color:"#fda4af", fontSize:"14px", fontStyle:"italic", textAlign:"center" }}>
                💬 "{bossInsult}"
              </div>
            )}
          </div>
        )}

        {/* Puzzle */}
        <div style={{ background:"#1a1a2e", border:`1px solid ${world.color}44`, borderRadius:"16px", padding:"16px", marginBottom:"16px" }}>
          <div style={{ fontSize:"11px", color:"#64748b", textTransform:"uppercase", letterSpacing:"1px", marginBottom:"8px" }}>THE PUZZLE</div>
          <div style={{ fontSize:"15px", lineHeight:1.7, color:"#f1f5f9" }}>{currentLevel.puzzle}</div>
        </div>

        {/* Judge result */}
        {judging && (
          <div style={{ background:"#1a1a2e", borderRadius:"16px", padding:"20px", textAlign:"center", marginBottom:"16px" }}>
            <div style={{ fontSize:"32px", marginBottom:"8px" }}>🤔</div>
            <div style={{ color:"#94a3b8", fontSize:"14px" }}>Hmm, let me think about this...</div>
          </div>
        )}

        {judgeResult && !judging && (
          <div style={{ background:judgeResult.success?"#0f2010":"#1a0a0a", border:`2px solid ${judgeResult.success?"#4ade80":"#f43f5e"}`, borderRadius:"16px", padding:"16px", marginBottom:"16px", textAlign:"center" }}>
            <div style={{ fontSize:"32px", marginBottom:"8px" }}>{judgeResult.bossDefeated?"🏆":judgeResult.success?"🎉":"😤"}</div>
            <div style={{ color:judgeResult.success?"#4ade80":"#f43f5e", fontSize:"15px", fontWeight:"bold" }}>{judgeResult.message}</div>
          </div>
        )}

        {/* Draw button */}
        {!judgeResult?.bossDefeated && (
          <button onClick={() => setShowDrawCanvas(true)} style={{ width:"100%", background:`linear-gradient(135deg, ${world.color}, ${world.color}88)`, border:"none", borderRadius:"16px", padding:"16px", fontSize:"18px", fontWeight:"bold", color:"#000", cursor:"pointer", marginBottom:"12px", boxShadow:`0 4px 20px ${world.color}44` }}>
            ✏️ {judgeResult ? "Try Again! Draw Something Else!" : "Draw Your Solution!"}
          </button>
        )}

        {judgeResult?.bossDefeated && (
          <button onClick={() => setShowWorldComplete(true)} style={{ width:"100%", background:"linear-gradient(135deg, #f59e0b, #f97316)", border:"none", borderRadius:"16px", padding:"16px", fontSize:"18px", fontWeight:"bold", color:"#000", cursor:"pointer" }}>
            🏆 WORLD CONQUERED! Continue!
          </button>
        )}

        {/* Drawing canvas */}
        {showDrawCanvas && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.95)", zIndex:500, display:"flex", flexDirection:"column", padding:"20px" }}>
            <div style={{ textAlign:"center", marginBottom:"14px" }}>
              <div style={{ fontSize:"18px", fontWeight:"bold", color:world.color }}>✏️ Draw your solution!</div>
              <div style={{ fontSize:"13px", color:"#64748b", marginTop:"4px" }}>{currentLevel.puzzle}</div>
            </div>
            <canvas
              id="solveCanvas"
              width={400} height={260}
              style={{ background:"#0a0a1a", borderRadius:"14px", border:`2px solid ${world.color}`, width:"100%", touchAction:"none" }}
              onMouseDown={e=>{const c=e.target;const ctx=c.getContext("2d");ctx.beginPath();const r=c.getBoundingClientRect();ctx.moveTo(e.clientX-r.left,e.clientY-r.top);c._drawing=true;}}
              onMouseMove={e=>{const c=e.target;if(!c._drawing)return;const ctx=c.getContext("2d");const r=c.getBoundingClientRect();ctx.lineWidth=4;ctx.lineCap="round";ctx.strokeStyle=world.color;ctx.lineTo(e.clientX-r.left,e.clientY-r.top);ctx.stroke();ctx.beginPath();ctx.moveTo(e.clientX-r.left,e.clientY-r.top);}}
              onMouseUp={e=>e.target._drawing=false}
              onTouchStart={e=>{e.preventDefault();const c=e.target;const ctx=c.getContext("2d");const r=c.getBoundingClientRect();const t=e.touches[0];ctx.beginPath();ctx.moveTo(t.clientX-r.left,t.clientY-r.top);c._drawing=true;}}
              onTouchMove={e=>{e.preventDefault();const c=e.target;if(!c._drawing)return;const ctx=c.getContext("2d");const r=c.getBoundingClientRect();const t=e.touches[0];ctx.lineWidth=4;ctx.lineCap="round";ctx.strokeStyle=world.color;ctx.lineTo(t.clientX-r.left,t.clientY-r.top);ctx.stroke();ctx.beginPath();ctx.moveTo(t.clientX-r.left,t.clientY-r.top);}}
              onTouchEnd={e=>e.target._drawing=false}
            />
            <input
              style={{ background:"#1a1a2e", border:`1px solid ${world.color}44`, borderRadius:"10px", padding:"10px 14px", color:"white", fontSize:"15px", marginTop:"10px", fontFamily:"Georgia,serif" }}
              placeholder="What did you draw? Type it here!"
              value={drawLabel}
              onChange={e => setDrawLabel(e.target.value)}
              onKeyDown={e => e.key==="Enter" && submitDrawing()}
            />
            <div style={{ display:"flex", gap:"10px", marginTop:"10px" }}>
              <button onClick={() => setShowDrawCanvas(false)} style={{ flex:1, background:"none", border:"1px solid #444", borderRadius:"10px", padding:"12px", color:"#94a3b8", cursor:"pointer" }}>Cancel</button>
              <button onClick={submitDrawing} style={{ flex:2, background:world.color, border:"none", borderRadius:"10px", padding:"12px", fontWeight:"bold", color:"#000", cursor:"pointer", fontSize:"15px" }}>
                🎯 Submit Drawing!
              </button>
            </div>
          </div>
        )}

        {/* Level complete modal */}
        {showLevelComplete && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:900, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"20px" }}>
            <div style={{ textAlign:"center", maxWidth:"360px" }}>
              <div style={{ fontSize:"72px", marginBottom:"12px" }}>🎉</div>
              <div style={{ fontSize:"26px", fontWeight:"bold", color:"#4ade80", marginBottom:"8px" }}>LEVEL COMPLETE!</div>
              <div style={{ color:"#f59e0b", fontSize:"20px", marginBottom:"6px" }}>+{currentLevel.reward} ⭐ STARS!</div>
              <div style={{ color:"#94a3b8", fontSize:"14px", marginBottom:"24px" }}>Total: {pd?.totalPoints} stars</div>
              <div style={{ display:"flex", gap:"12px", justifyContent:"center" }}>
                <button onClick={() => { setShowLevelComplete(false); setScreen("levels"); setJudgeResult(null); }} style={{ background:"linear-gradient(135deg,#4ade80,#22c55e)", border:"none", borderRadius:"14px", padding:"14px 28px", fontSize:"16px", fontWeight:"bold", color:"#000", cursor:"pointer" }}>Next Level! ▶</button>
                <button onClick={() => { setShowLevelComplete(false); setJudgeResult(null); setDrawLabel(""); }} style={{ background:"none", border:"1px solid #4ade80", borderRadius:"14px", padding:"14px 20px", fontSize:"14px", color:"#4ade80", cursor:"pointer" }}>Play Again</button>
              </div>
            </div>
          </div>
        )}

        {/* World complete modal */}
        {showWorldComplete && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.95)", zIndex:900, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"20px" }}>
            <div style={{ textAlign:"center", maxWidth:"380px" }}>
              <div style={{ fontSize:"72px", marginBottom:"12px" }}>🏆</div>
              <div style={{ fontSize:"28px", fontWeight:"bold", color:world.color, marginBottom:"6px" }}>{world.name}</div>
              <div style={{ fontSize:"20px", color:"#4ade80", marginBottom:"8px" }}>CONQUERED! 👑</div>
              <div style={{ background:"#1a1a2e", borderRadius:"14px", padding:"16px", marginBottom:"20px" }}>
                <div style={{ color:"#f59e0b", fontSize:"22px", fontWeight:"bold", marginBottom:"4px" }}>+{currentLevel.reward} ⭐</div>
                <div style={{ color:"#64748b", fontSize:"13px" }}>{world.boss.name} has been defeated!</div>
                {currentLevel.world === "fantasy" && <div style={{ color:"#f43f5e", fontSize:"13px", marginTop:"8px", fontStyle:"italic" }}>Danyells has been defeated! 💅👊</div>}
              </div>
              <button onClick={() => { setShowWorldComplete(false); setScreen("worldmap"); setJudgeResult(null); }} style={{ background:`linear-gradient(135deg, ${world.color}, #f59e0b)`, border:"none", borderRadius:"14px", padding:"16px 40px", fontSize:"18px", fontWeight:"bold", color:"#000", cursor:"pointer" }}>
                🗺️ Back to World Map!
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return <div style={{ minHeight:"100vh", background:"#030712", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontFamily:"Georgia,serif" }}>Loading LUCAC LEGENDS... 👑</div>;
}
