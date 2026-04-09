import { useState, useEffect, useRef } from "react";
import { createSpeechRecognition, speakText } from "../utils";
import { GameBtn, recordGameHistory, ageBandFromProfile } from "./_shared";

// ─── WORD BANKS ────────────────────────────────────────────────────────────────
const WORDS_3 = [
  "cat","dog","sun","hat","run","big","red","hop","sit","bed",
  "cup","pig","bat","ant","owl","bug","log","fan","jet","map",
  "net","rat","tin","top","zip","mom","dad","fun","wet","fox",
];
const WORDS_4 = [
  "play","jump","swim","cake","blue","sing","book","ball","hero","kind",
  "land","leap","pick","safe","talk","warm","zoom","frog","help","kite",
  "love","nest","over","race","star","trip","wild","yard","farm","glow",
];
const SENTENCES = [
  "The cat sat on the mat",
  "I like to play in the sun",
  "The dog ran very fast today",
  "She had a big red hat",
  "He can jump over the log",
  "The ant is very small and fast",
  "My pet cat is really cute",
  "We like to swim in the lake",
  "The bird can fly up so high",
  "She ran all the way back home",
];
const PARAGRAPHS = [
  "The brave knight rode into the forest to find the lost dragon.",
  "Every morning the sun rises and the birds begin to sing.",
  "She opened the old book and found a hidden map inside the cover.",
  "The robot beeped three times and said hello to the children.",
];

const MONSTERS = ["👹","👺","🧟","👾","🐲","🦖","🧌","💀","👻","🦇"];

function wordForLevel(level) {
  if (level <= 3) return WORDS_3[Math.floor(Math.random() * WORDS_3.length)];
  if (level <= 6) return WORDS_4[Math.floor(Math.random() * WORDS_4.length)];
  if (level <= 10) return SENTENCES[Math.floor(Math.random() * SENTENCES.length)];
  return PARAGRAPHS[Math.floor(Math.random() * PARAGRAPHS.length)];
}

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function isMatch(target, spoken) {
  const t = normalize(target);
  const s = normalize(spoken);
  if (s === t || s.includes(t)) return true;
  const tWords = t.split(" ").filter(w => w.length > 2);
  if (tWords.length <= 1) return s === t;
  const sWords = new Set(s.split(" "));
  const hit = tWords.filter(w => sWords.has(w)).length;
  return hit / tWords.length >= 0.7;
}

// ─── COMPONENT ─────────────────────────────────────────────────────────────────
export default function WordWarrior({ profile, kidsData, fbSet, addStars, transitionTo }) {
  const ageBand   = ageBandFromProfile(profile);
  // Yana starts at 4-letter words; Luca starts at 3-letter
  const startLevel = ageBand === "yana" ? 4 : 1;

  const [level, setLevel]     = useState(startLevel);
  const [kills, setKills]     = useState(0);
  const [hits, setHits]       = useState(0);         // hits on current monster
  const [word, setWord]       = useState(() => wordForLevel(startLevel));
  const [monsterX, setMonsterX] = useState(82);      // % left offset in arena
  const [phase, setPhase]     = useState("listening"); // listening|hit|wrong|dead|complete
  const [feedback, setFeedback] = useState("");
  const [srAvailable, setSrAvailable] = useState(true);
  const [earnedStars, setEarnedStars] = useState(0);

  // Refs that shadow state so SR callbacks read current values without stale closures
  const wordRef    = useRef(word);
  const levelRef   = useRef(level);
  const phaseRef   = useRef("listening");
  const hitsRef    = useRef(0);
  const killsRef   = useRef(0);
  const monXRef    = useRef(82);
  const recogRef   = useRef(null);
  const listeningRef = useRef(false);
  const stopSpeakRef = useRef(null);
  const mountedRef   = useRef(true);

  const syncPhase = (p) => { phaseRef.current = p; setPhase(p); };
  const syncHits  = (n) => { hitsRef.current  = n; setHits(n);  };
  const syncKills = (n) => { killsRef.current  = n; setKills(n); };

  // ── Monster walking animation ──────────────────────────────────────────────
  useEffect(() => {
    if (phase === "dead" || phase === "complete") return;
    const id = setInterval(() => {
      if (monXRef.current > 40) {
        monXRef.current -= 0.35;
        setMonsterX(monXRef.current);
      }
    }, 80);
    return () => clearInterval(id);
  }, [phase]);

  // ── Speech recognition ─────────────────────────────────────────────────────
  function startListening() {
    if (listeningRef.current) return;
    const recog = createSpeechRecognition();
    if (!recog) { setSrAvailable(false); return; }
    recogRef.current = recog;

    recog.onresult = (e) => {
      const spoken = e.results[0][0].transcript || "";
      handleSpoken(spoken);
    };
    recog.onerror = () => { listeningRef.current = false; };
    recog.onend = () => {
      listeningRef.current = false;
      if (phaseRef.current === "listening") {
        setTimeout(() => { if (mountedRef.current) startListening(); }, 350);
      }
    };
    listeningRef.current = true;
    try { recog.start(); } catch { listeningRef.current = false; }
  }

  function stopListening() {
    listeningRef.current = false;
    try { if (recogRef.current) recogRef.current.stop(); } catch {}
    recogRef.current = null;
  }

  // Start on mount; restart whenever phase returns to "listening"
  useEffect(() => {
    startListening();
    return () => { mountedRef.current = false; stopListening(); if (stopSpeakRef.current) stopSpeakRef.current(); };
  }, []); // eslint-disable-line
  useEffect(() => { if (phase === "listening") startListening(); }, [phase]); // eslint-disable-line

  // ── Voice match handler ────────────────────────────────────────────────────
  function handleSpoken(spoken) {
    if (phaseRef.current !== "listening") return;
    stopListening();

    if (isMatch(wordRef.current, spoken)) {
      const newHits = hitsRef.current + 1;
      syncHits(newHits);

      if (newHits >= 3) {
        // Monster slain
        const newKills = killsRef.current + 1;
        syncKills(newKills);
        const stars = Math.max(Math.floor(newKills / 3), 1);
        setEarnedStars(stars);
        setFeedback("💥 Slain!");
        syncPhase("dead");
        setTimeout(() => { if (mountedRef.current) advanceMonster(newKills); }, 1400);
      } else {
        setFeedback(`✅ Hit! ${3 - newHits} more!`);
        syncPhase("hit");
        setTimeout(() => { if (mountedRef.current) { setFeedback(""); syncPhase("listening"); } }, 900);
      }
    } else {
      // Miss — speak the target word so kid can repeat it
      setFeedback(`👂 Say: "${wordRef.current}"`);
      syncPhase("wrong");
      if (stopSpeakRef.current) stopSpeakRef.current();
      stopSpeakRef.current = speakText(wordRef.current, {
        onStop: () => {
          stopSpeakRef.current = null;
          setTimeout(() => { if (mountedRef.current) { setFeedback(""); syncPhase("listening"); } }, 400);
        },
      });
    }
  }

  function advanceMonster(killCount) {
    // Level up every 3 kills, cap at 12
    const newLevel = Math.min(startLevel + Math.floor(killCount / 3), 12);
    levelRef.current = newLevel;
    setLevel(newLevel);

    const newWord = wordForLevel(newLevel);
    wordRef.current = newWord;
    setWord(newWord);

    syncHits(0);
    monXRef.current = 82;
    setMonsterX(82);

    if (fbSet && profile?.name) {
      fbSet(`kidsData/${profile.name}/wwLevel`, newLevel);
    }

    if (killCount >= 9) {
      syncPhase("complete");
    } else {
      setFeedback("");
      syncPhase("listening");
    }
  }

  function collectAndExit() {
    const finalStars = Math.max(earnedStars, 3);
    addStars(finalStars);
    recordGameHistory(fbSet, profile, "word_warrior", kills * 10, finalStars, { level });
    const prev = (kidsData || {})[profile.name]?.readingStats || {};
    if (fbSet && profile?.name) {
      fbSet(`kidsData/${profile.name}/readingStats`, {
        ...prev,
        wordsRead: (prev.wordsRead || 0) + kills,
        lastPlayed: new Date().toISOString(),
      });
    }
    if (stopSpeakRef.current) stopSpeakRef.current();
    stopListening();
    transitionTo("mini_games");
  }

  const monsterEmoji = MONSTERS[kills % MONSTERS.length];
  const healthPct = ((3 - hits) / 3) * 100;
  const healthColor = hits === 0 ? "#22c55e" : hits === 1 ? "#f97316" : "#ef4444";
  const levelLabel  = level <= 3 ? "3-letter words" : level <= 6 ? "4-letter words"
    : level <= 10 ? "Sentences" : "Paragraphs";

  return (
    <div style={{
      minHeight: 500, background: "linear-gradient(180deg, #0f172a, #1e1b4b, #312e81)",
      borderRadius: 16, overflow: "hidden",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px" }}>
        <GameBtn color="#475569" onClick={() => { stopListening(); if (stopSpeakRef.current) stopSpeakRef.current(); transitionTo("mini_games"); }}
          style={{ width:"auto", padding:"10px 16px", fontSize:14 }}>
          ← Back
        </GameBtn>
        <div style={{ color:"#fbbf24", fontWeight:800, fontSize:17 }}>⚔️ Word Warrior</div>
        <div style={{ color:"#fbbf24", fontWeight:700, fontSize:14, textAlign:"right" }}>
          <div>Lvl {level}</div>
          <div>⭐ {earnedStars}</div>
        </div>
      </div>

      {/* Mic status */}
      <div style={{ textAlign:"center", minHeight:28, marginBottom:4, paddingBottom:4 }}>
        {!srAvailable && (
          <div style={{ color:"#ef4444", fontSize:13 }}>⚠️ Mic unavailable on this device</div>
        )}
        {srAvailable && phase === "listening" && (
          <div style={{ color:"#4ade80", fontSize:13, fontWeight:700 }}>🎤 Listening — say the word!</div>
        )}
        {feedback && (
          <div style={{ color: phase === "hit" || phase === "dead" ? "#4ade80" : "#fbbf24", fontSize:15, fontWeight:800 }}>
            {feedback}
          </div>
        )}
      </div>

      {/* Game arena or complete screen */}
      {phase !== "complete" ? (
        <div style={{ position:"relative", height:230, margin:"0 12px", background:"rgba(0,0,0,0.3)", borderRadius:16, overflow:"hidden" }}>
          {/* Ground */}
          <div style={{ position:"absolute", bottom:0, left:0, right:0, height:44,
            background:"linear-gradient(180deg,#1e3a1e,#14532d)", borderRadius:"0 0 16px 16px" }} />

          {/* Kid + speech bubble */}
          <div style={{ position:"absolute", bottom:44, left:"6%", textAlign:"center" }}>
            <div style={{ fontSize:52 }}>{profile?.emoji || "🧒"}</div>
            <div style={{
              position:"absolute", bottom:"110%", left:"50%", transform:"translateX(-50%)",
              background:"#fff", color:"#1e293b", borderRadius:12, padding:"8px 12px",
              fontSize: level <= 6 ? 22 : 13, fontWeight:800,
              boxShadow:"0 4px 16px rgba(0,0,0,0.4)", minWidth:80, maxWidth:180,
              textAlign:"center", lineHeight:1.35,
            }}>
              {word}
              {/* Bubble tail */}
              <div style={{ position:"absolute", bottom:-8, left:"50%", transform:"translateX(-50%)",
                width:0, height:0,
                borderLeft:"8px solid transparent", borderRight:"8px solid transparent",
                borderTop:"8px solid #fff" }} />
            </div>
          </div>

          {/* Monster */}
          {phase !== "dead" && (
            <div style={{ position:"absolute", bottom:44, left:`${monsterX}%`, textAlign:"center" }}>
              <div style={{ fontSize:52 }}>{monsterEmoji}</div>
              <div style={{ width:52, height:7, background:"#374151", borderRadius:4, margin:"4px auto 0" }}>
                <div style={{ width:`${healthPct}%`, height:"100%", background:healthColor, borderRadius:4, transition:"width 0.25s" }} />
              </div>
            </div>
          )}

          {phase === "dead" && (
            <div style={{ position:"absolute", bottom:60, left:"52%", fontSize:44 }}>💥</div>
          )}
        </div>
      ) : (
        <div style={{ textAlign:"center", padding:"24px 20px" }}>
          <div style={{ fontSize:64 }}>🏆</div>
          <div style={{ fontSize:26, fontWeight:800, color:"#fbbf24", marginTop:8 }}>Word Warrior!</div>
          <div style={{ fontSize:15, color:"rgba(255,255,255,0.75)", marginTop:8 }}>
            {kills} monsters defeated · Level {level} reader!
          </div>
          <div style={{ fontSize:36, margin:"14px 0" }}>{"⭐".repeat(Math.min(Math.max(earnedStars, 3), 5))}</div>
          <GameBtn color="#22c55e" big onClick={collectAndExit}>
            Collect ⭐ {Math.max(earnedStars, 3)} Stars!
          </GameBtn>
        </div>
      )}

      {/* Stats bar */}
      {phase !== "complete" && (
        <div style={{ display:"flex", justifyContent:"space-around", padding:"14px 16px" }}>
          {[
            { icon:"💀", val:kills, label:"Slain" },
            { icon:"⚔️", val:`${hits}/3`, label:"Hits" },
            { icon:"📚", val:`Lvl ${level}`, label:levelLabel },
          ].map(s => (
            <div key={s.label} style={{ textAlign:"center" }}>
              <div style={{ fontSize:22 }}>{s.icon}</div>
              <div style={{ color:"#fff", fontWeight:700, fontSize:14 }}>{s.val}</div>
              <div style={{ color:"rgba(255,255,255,0.45)", fontSize:11 }}>{s.label}</div>
            </div>
          ))}
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:22, opacity: phase === "listening" ? 1 : 0.35 }}>🎤</div>
            <div style={{ color: phase === "listening" ? "#4ade80" : "rgba(255,255,255,0.45)", fontWeight:700, fontSize:14 }}>
              {phase === "listening" ? "ON" : "—"}
            </div>
            <div style={{ color:"rgba(255,255,255,0.45)", fontSize:11 }}>Voice</div>
          </div>
        </div>
      )}
    </div>
  );
}
