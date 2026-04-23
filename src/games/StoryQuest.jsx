import { useState, useEffect, useRef } from "react";
import { callAI, speakText, createSpeechRecognition, cacheGet, cacheSet } from "../utils";
import { GameBtn, recordGameHistory, ageBandFromProfile } from "./_shared";

const GROQ_KEY    = import.meta.env.VITE_GROQ_KEY;
const STORY_MODEL = "llama-3.3-70b-versatile";
const STORY_TIMEOUT = 20000;

// ─── STATIC FALLBACK STORIES ──────────────────────────────────────────────────
// One fallback per age band — used when offline or Groq fails
const FALLBACK = {
  luca: {
    topic: "The Magic Treehouse",
    segments: [
      "Luca climbed up into the old treehouse and found a glowing door. He opened it and stepped into a world full of talking animals!\n\nA fox in a red hat said, \"Welcome! We need a brave helper today.\"",
      "The fox explained that the river was rising and the animal homes would flood. They needed someone to find the magic stone that stopped the water.\n\nLuca looked around. He could see two paths.",
      "Luca found the stone behind a waterfall. He placed it in the river and the water went down right away!\n\nAll the animals cheered. \"You saved us!\" said the fox.",
      "The fox gave Luca a small golden acorn to remember the day. When Luca got home, it turned into a real chocolate one.\n\nHe ate it and smiled. — THE END —",
    ],
    choices: [
      { A: "follow the fox into the forest", B: "climb the hill to look around first" },
      { A: "take the path by the river", B: "take the path through the tall grass" },
      { A: "reach behind the waterfall", B: "ask the beaver to help dig" },
    ],
  },
  yana: {
    topic: "The Clockwork City",
    segments: [
      "Yana found a pocket watch in her grandmother's attic. When she wound it, the room around her shifted — she was standing in a brass city where gears turned in the sky.\n\nA tall woman in goggles strode toward her. \"Perfect timing. The city is slowing down and we need an engineer.\"",
      "The chief engineer explained that the Great Gear — the one that kept all the city's machines running — had cracked. Two repair teams had different plans to fix it.\n\nYana studied both proposals carefully.",
      "Yana chose the harmonic resonance approach. She tuned four small gears to precise frequencies and set them spinning together. The Great Gear absorbed the vibration and the crack sealed itself.\n\nThe city surged back to full speed. \"Remarkable,\" the engineer breathed.",
      "The city council gave Yana a spare gear the size of her palm, engraved with her name.\n\nWhen she wound the pocket watch again she was back in the attic, gear in hand.\n\nShe already knew what her next invention would be. — THE END —",
    ],
    choices: [
      { A: "inspect the Great Gear yourself first", B: "ask both teams to explain their plans" },
      { A: "try the harmonic resonance approach", B: "use the molecular bonding approach" },
      { A: "accept the gear as a keepsake", B: "ask to stay and keep helping the city" },
    ],
  },
};

// ─── STORY PARSING (reused from ReadingGame pattern) ──────────────────────────
function parseChunk(raw) {
  const isEnd = /THE\s+END/i.test(raw);
  const choiceIdx = raw.search(/\[CHOICE\]/i);
  if (choiceIdx === -1 || isEnd) {
    return { storyText: raw.replace(/---?\s*THE\s+END\s*---?/gi, "— THE END —").trim(), choiceA: null, choiceB: null, isEnd: true };
  }
  const storyText = raw.slice(0, choiceIdx).trim();
  const after = raw.slice(choiceIdx + 8).trim();
  const m = after.match(/A\)\s*(.+?)\s*(?:\/\s*B\)\s*|[\n\r]+\s*B\)\s*)(.+?)(?:[\n\r]|$)/i);
  if (m) return { storyText, choiceA: m[1].trim(), choiceB: m[2].trim(), isEnd: false };
  return { storyText: raw.trim(), choiceA: null, choiceB: null, isEnd: true };
}

function parseInitialStory(raw) {
  const parts = raw.split(/\[CHOICE\]/i);
  const items = [];
  if (parts[0].trim()) items.push({ type: "text", content: parts[0].trim() });
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    const m = part.match(/^A\)\s*(.+?)\s*(?:\/\s*B\)\s*|[\n\r]+\s*B\)\s*)(.+?)(?:[\n\r]|$)/i);
    if (m) {
      items.push({ type: "choice", A: m[1].trim(), B: m[2].trim(), chosen: null });
      const after = part.slice(part.indexOf(m[2]) + m[2].length).trim();
      if (after) items.push({ type: "text", content: after });
    } else {
      items.push({ type: "text", content: part });
    }
  }
  return items;
}

// ─── VOICE MATCHING ───────────────────────────────────────────────────────────
function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

// Returns "A", "B", or null
function matchChoice(spoken, optA, optB) {
  const s = normalize(spoken);
  // Direct letter match: user says "A" or "B"
  if (/^(a|ay|option a|choice a|pick a)$/.test(s)) return "A";
  if (/^(b|bee|option b|choice b|pick b)$/.test(s)) return "B";
  // Text match: check if spoken overlaps with option content
  const wordsA = normalize(optA).split(" ").filter(w => w.length > 3);
  const wordsB = normalize(optB).split(" ").filter(w => w.length > 3);
  const sWords = new Set(s.split(" "));
  const hitA = wordsA.filter(w => sWords.has(w)).length;
  const hitB = wordsB.filter(w => sWords.has(w)).length;
  if (hitA > 0 && hitA >= hitB) return "A";
  if (hitB > 0 && hitB > hitA)  return "B";
  return null;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function StoryQuest({ profile, kidsData, fbSet, addStars, transitionTo }) {
  const ageBand  = ageBandFromProfile(profile);
  const kidName  = profile?.name || "the hero";
  const isLuca   = ageBand === "luca";
  const kidAge   = isLuca ? 6 : 8;

  // Unlock gate: WordWarrior level must be ≥ 7 (sentence level)
  const wwLevel = (kidsData || {})[profile?.name]?.wwLevel || 0;
  const locked  = wwLevel < 7;

  const [storyItems, setStoryItems]     = useState([]);
  const [phase, setPhase]               = useState("loading"); // loading|reading|choice|voice_choice|continuing|complete
  const [choicesMade, setChoicesMade]   = useState([]);
  const [storyTopic, setStoryTopic]     = useState("");
  const [isFallback, setIsFallback]     = useState(false);
  const [voiceHint, setVoiceHint]       = useState(""); // feedback to display during voice choice
  const [autoRead, setAutoRead]         = useState(isLuca);
  const [speaking, setSpeaking]         = useState(false);

  const fallbackRef      = useRef(null);
  const stopSpeakRef     = useRef(null);
  const lastSpokenRef    = useRef("");
  const phaseRef         = useRef("loading");
  const recogRef         = useRef(null);
  const listeningRef     = useRef(false);
  const mountedRef       = useRef(true);
  const choicesMadeRef   = useRef([]); // mirrors choicesMade for async/SR callbacks
  const isChoosingRef    = useRef(false); // prevents voice+tap double-fire
  // Current pending choice options (for SR callback)
  const pendingChoiceRef = useRef({ A: "", B: "" });

  const syncPhase = (p) => { phaseRef.current = p; setPhase(p); };

  // ── TTS helpers ──────────────────────────────────────────────────────────────
  function speak(text) {
    if (stopSpeakRef.current) stopSpeakRef.current();
    if (lastSpokenRef.current === text) return;
    lastSpokenRef.current = text;
    setSpeaking(true);
    stopSpeakRef.current = speakText(text, {
      onStop: () => { setSpeaking(false); stopSpeakRef.current = null; },
    });
  }

  function stopSpeech() {
    if (stopSpeakRef.current) stopSpeakRef.current();
    setSpeaking(false);
    stopSpeakRef.current = null;
    lastSpokenRef.current = "";
  }

  // Auto-read newest text segment
  useEffect(() => {
    if (!autoRead) return;
    const texts = storyItems.filter(i => i.type === "text");
    if (!texts.length) return;
    const last = texts[texts.length - 1].content;
    if (last && last !== lastSpokenRef.current) speak(last);
  }, [storyItems.length, autoRead]); // eslint-disable-line

  useEffect(() => () => { mountedRef.current = false; stopSpeech(); stopListening(); }, []); // eslint-disable-line

  // ── Voice recognition for choices ────────────────────────────────────────────
  function startChoiceListening(optA, optB) {
    pendingChoiceRef.current = { A: optA, B: optB };
    if (listeningRef.current) return;
    const recog = createSpeechRecognition();
    if (!recog) return; // no mic — fall back to tap buttons shown below
    recogRef.current = recog;

    recog.onresult = (e) => {
      const spoken = e.results[0][0].transcript || "";
      const pick = matchChoice(spoken, pendingChoiceRef.current.A, pendingChoiceRef.current.B);
      if (pick) {
        setVoiceHint(`✅ Heard "${pick}" — choosing!`);
        stopListening();
        setTimeout(() => { if (mountedRef.current) handleChoice(pick, pick === "A" ? pendingChoiceRef.current.A : pendingChoiceRef.current.B); }, 600);
      } else {
        setVoiceHint(`🎤 Say "A" or "B" — try again`);
        listeningRef.current = false;
        setTimeout(() => { if (mountedRef.current) startChoiceListening(pendingChoiceRef.current.A, pendingChoiceRef.current.B); }, 400);
      }
    };
    recog.onerror = () => {
      listeningRef.current = false;
      setTimeout(() => { if (mountedRef.current) startChoiceListening(pendingChoiceRef.current.A, pendingChoiceRef.current.B); }, 600);
    };
    recog.onend = () => {
      listeningRef.current = false;
      if (phaseRef.current === "voice_choice") {
        setTimeout(() => { if (mountedRef.current) startChoiceListening(pendingChoiceRef.current.A, pendingChoiceRef.current.B); }, 400);
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

  // Start choice listening whenever we enter voice_choice phase
  useEffect(() => {
    if (phase === "voice_choice") {
      isChoosingRef.current = false; // reset guard when ready for next choice
      const items = storyItems;
      const active = items.slice().reverse().find(i => i.type === "choice" && !i.chosen);
      if (active) {
        setVoiceHint("🎤 Say \"A\" or \"B\" to choose!");
        startChoiceListening(active.A, active.B);
      }
    } else {
      stopListening();
    }
  }, [phase]); // eslint-disable-line

  // ── Story loading ─────────────────────────────────────────────────────────────
  useEffect(() => { loadInitialStory(); }, []); // eslint-disable-line

  async function loadInitialStory() {
    const cacheKey = `storyquest_${kidName}_${ageBand}`;
    const cached = cacheGet(cacheKey);
    if (cached?.raw) {
      setStoryTopic(cached.topic || `${kidName}'s Quest`);
      applyItems(parseInitialStory(cached.raw));
      return;
    }

    const vocabNote = isLuca
      ? "Use very simple words a 6-year-old knows. Short sentences. Exciting action."
      : "Use vivid vocabulary for an intelligent 8-year-old. Mystery and problem-solving.";

    const prompt =
      `Write a 500-word adventure story where ${kidName} (age ${kidAge}) is the hero. ${vocabNote}\n\n` +
      `Include EXACTLY 3 choice points formatted like this:\n[CHOICE]\nA) first option / B) second option\n\n` +
      `Write story text before each [CHOICE] and after the third. Stop after the third [CHOICE] options. ` +
      `Keep under 650 words total.`;

    const result = await callAI(GROQ_KEY,
      [
        { role: "system", content: "You are a master children's storyteller. Follow the exact format provided." },
        { role: "user",   content: prompt },
      ],
      { model: STORY_MODEL, maxTokens: 1300, timeout: STORY_TIMEOUT }
    );

    if (!mountedRef.current) return;
    if (!result.ok) { activateFallback(); return; }

    const topic = `${kidName}'s Quest`;
    cacheSet(cacheKey, { raw: result.data, topic });
    setStoryTopic(topic);
    applyItems(parseInitialStory(result.data));
  }

  function applyItems(items) {
    setStoryItems(items);
    const hasChoice = items.some(i => i.type === "choice" && !i.chosen);
    syncPhase(hasChoice ? "voice_choice" : "reading");
  }

  function activateFallback(existingChoices = []) {
    const story = FALLBACK[ageBand] || FALLBACK.yana;
    fallbackRef.current = story;
    setIsFallback(true);
    setStoryTopic(story.topic);
    const segIdx = existingChoices.length;
    const items = [{ type: "text", content: story.segments[segIdx] }];
    if (story.choices[segIdx]) {
      items.push({ type: "choice", A: story.choices[segIdx].A, B: story.choices[segIdx].B, chosen: null });
    }
    setStoryItems(prev => prev.length > 0 ? [...prev, ...items] : items);
    syncPhase(story.choices[segIdx] ? "voice_choice" : "complete");
  }

  // ── Choice handling ───────────────────────────────────────────────────────────
  async function handleChoice(choiceLabel, choiceText) {
    if (isChoosingRef.current) return; // prevent voice+tap double-fire
    isChoosingRef.current = true;
    const newChoices = [...choicesMadeRef.current, choiceText];
    choicesMadeRef.current = newChoices;
    setChoicesMade(newChoices);
    setVoiceHint("");

    setStoryItems(prev => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].type === "choice" && !next[i].chosen) {
          next[i] = { ...next[i], chosen: choiceLabel };
          break;
        }
      }
      return next;
    });

    const isLast = newChoices.length >= 3;

    if (isFallback || fallbackRef.current) {
      const story = fallbackRef.current;
      if (!story) return;
      const segIdx = newChoices.length;
      const newItems = [];
      if (story.segments[segIdx]) newItems.push({ type: "text", content: story.segments[segIdx] });
      if (!isLast && story.choices[segIdx]) {
        newItems.push({ type: "choice", A: story.choices[segIdx].A, B: story.choices[segIdx].B, chosen: null });
      }
      setStoryItems(prev => [...prev, ...newItems]);
      syncPhase(isLast ? "complete" : "voice_choice");
      return;
    }

    syncPhase("continuing");

    const endInstruction = isLast
      ? "Write a satisfying conclusion (~150 words) ending with THE END."
      : "Continue ~150 words, then add exactly one more choice:\n[CHOICE]\nA) option / B) option";

    const result = await callAI(GROQ_KEY,
      [
        { role: "system", content: "You are continuing a children's adventure story. Follow the exact format." },
        { role: "user",   content: `${kidName} chose to ${choiceText}. ${endInstruction}` },
      ],
      { model: STORY_MODEL, maxTokens: 450, timeout: STORY_TIMEOUT }
    );

    if (!mountedRef.current) return;
    if (!result.ok) { activateFallback(newChoices); return; }

    const chunk = parseChunk(result.data);
    const newItems = [];
    if (chunk.storyText) newItems.push({ type: "text", content: chunk.storyText });
    if (chunk.choiceA && chunk.choiceB && !isLast) {
      newItems.push({ type: "choice", A: chunk.choiceA, B: chunk.choiceB, chosen: null });
    }
    setStoryItems(prev => [...prev, ...newItems]);
    syncPhase(chunk.choiceA && !isLast ? "voice_choice" : "complete");
  }

  // ── Complete + collect ────────────────────────────────────────────────────────
  function collectStars() {
    const stars = Math.min(choicesMade.length, 3) + 2;
    addStars(stars);
    const wordCount = storyItems
      .filter(i => i.type === "text")
      .reduce((n, i) => n + i.content.split(/\s+/).length, 0);
    recordGameHistory(fbSet, profile, "story_quest", choicesMade.length * 100, stars, { storyTopic, choicesMade });
    if (fbSet && profile?.name) {
      const prev = (kidsData || {})[profile.name]?.readingStats || {};
      // S04 canonical shape: { storiesRead, wordsRead, lastPlayed }
      fbSet(`kidsData/${profile.name}/readingStats`, {
        ...prev,
        storiesRead: (prev.storiesRead || 0) + 1,
        wordsRead: (prev.wordsRead || 0) + wordCount,
        lastPlayed: new Date().toISOString(),
      });
    }
    stopSpeech();
    transitionTo("mini_games");
  }

  const totalStars = Math.min(choicesMade.length, 3) + (phase === "complete" ? 2 : 0);

  // Items to show: all up to and including the first unchosen choice
  const displayItems = (() => {
    for (let i = 0; i < storyItems.length; i++) {
      if (storyItems[i].type === "choice" && !storyItems[i].chosen) return storyItems.slice(0, i + 1);
    }
    return storyItems;
  })();

  // ── LOCKED SCREEN ────────────────────────────────────────────────────────────
  if (locked) {
    return (
      <div style={{
        minHeight: 400, background: "linear-gradient(180deg, #1a0a2e, #0f172a)",
        borderRadius: 16, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: 24,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
        <div style={{ fontSize: 64 }}>🔒</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#fbbf24", marginTop: 12 }}>Story Quest Locked</div>
        <div style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", marginTop: 10, textAlign: "center", maxWidth: 280 }}>
          Reach Level 7 in Word Warrior to unlock voice-choice adventures!
        </div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginTop: 8 }}>
          Your Word Warrior level: {wwLevel} / 7 needed
        </div>
        <div style={{ marginTop: 24 }}>
          <GameBtn color="#475569" onClick={() => transitionTo("mini_games")}>← Back</GameBtn>
        </div>
      </div>
    );
  }

  // ── MAIN RENDER ──────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: 500, borderRadius: 16, overflow: "hidden",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ background: "linear-gradient(180deg, #064e3b, #065f46, #047857)", padding: 20, minHeight: 500 }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, gap:8 }}>
          <GameBtn color="#475569" onClick={() => { stopSpeech(); stopListening(); transitionTo("mini_games"); }}
            style={{ width:"auto", padding:"10px 16px", fontSize:14 }}>
            ← Back
          </GameBtn>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button onClick={() => { if (autoRead) stopSpeech(); setAutoRead(r => !r); }}
              style={{ background: autoRead ? "#fbbf24" : "rgba(255,255,255,0.2)",
                border:"none", borderRadius:8, padding:"8px 14px",
                color: autoRead ? "#064e3b" : "#fff", fontSize:14, fontWeight:700,
                cursor:"pointer", minHeight:40 }}>
              {autoRead ? "🔊 Read: ON" : "🔇 Read: OFF"}
            </button>
            {speaking && (
              <button onClick={stopSpeech}
                style={{ background:"#ef4444", border:"none", borderRadius:8,
                  padding:"8px 14px", color:"#fff", fontSize:14, fontWeight:700,
                  cursor:"pointer", minHeight:40 }}>
                ⏹ Stop
              </button>
            )}
          </div>
          <div style={{ color:"#fbbf24", fontWeight:700, fontSize:16 }}>⭐ {totalStars}</div>
        </div>

        {/* Title */}
        {storyTopic && (
          <div style={{ textAlign:"center", marginBottom:16 }}>
            <div style={{ fontSize:20, fontWeight:800, color:"#fbbf24" }}>📖 {storyTopic}</div>
            {isFallback && <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginTop:4 }}>📦 Saved story</div>}
          </div>
        )}

        {/* Loading */}
        {phase === "loading" && (
          <div style={{ textAlign:"center", padding:"40px 20px" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>✨</div>
            <div style={{ color:"#fff", fontSize:20, fontWeight:700 }}>Writing your story…</div>
          </div>
        )}

        {/* Story body */}
        {phase !== "loading" && displayItems.map((item, idx) => {
          if (item.type === "text") {
            return (
              <div key={idx} style={{ background:"rgba(255,255,255,0.08)", borderRadius:16, padding:16, marginBottom:12 }}>
                {item.content.split("\n").map((line, li) => (
                  <p key={li} style={{ margin:"0 0 8px 0", color:"#fff", fontSize: isLuca ? 20 : 16, lineHeight:1.85 }}>
                    {line}
                  </p>
                ))}
                {!autoRead && (
                  <button onClick={() => speak(item.content)}
                    style={{ marginTop:6, background:"rgba(255,255,255,0.15)",
                      border:"2px solid rgba(255,255,255,0.3)", borderRadius:10,
                      padding:"6px 14px", fontSize:16, cursor:"pointer", color:"#fff" }}>
                    🔊 Read aloud
                  </button>
                )}
              </div>
            );
          }

          if (item.type === "choice") {
            if (item.chosen) {
              return (
                <div key={idx} style={{ textAlign:"center", marginBottom:12, padding:"10px 16px",
                  background:"rgba(34,197,94,0.15)", borderRadius:12,
                  color:"#86efac", fontSize:14, fontWeight:700,
                  border:"1px solid rgba(34,197,94,0.35)" }}>
                  ✓ {kidName} chose: {item.chosen === "A" ? item.A : item.B}
                </div>
              );
            }

            // Active choice — voice-first, tap as fallback
            return (
              <div key={idx} style={{ marginBottom:16 }}>
                <div style={{ textAlign:"center", color:"#fbbf24", fontWeight:800,
                  fontSize: isLuca ? 18 : 16, marginBottom:8 }}>
                  What does {kidName} do?
                </div>

                {/* Voice status */}
                <div style={{ textAlign:"center", marginBottom:10, minHeight:24 }}>
                  <span style={{ color:"#4ade80", fontWeight:700, fontSize:14 }}>{voiceHint}</span>
                </div>

                {/* Tap fallback buttons — always visible so kids can proceed without mic */}
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <button onClick={() => handleChoice("A", item.A)}
                    style={{ minHeight:64, fontSize: isLuca ? 20 : 17, fontWeight:700,
                      background:"rgba(99,102,241,0.35)", color:"#fff",
                      border:"2px solid rgba(99,102,241,0.6)", borderRadius:14,
                      cursor:"pointer", padding:"14px 20px", textAlign:"left" }}>
                    A) {item.A}
                  </button>
                  <button onClick={() => handleChoice("B", item.B)}
                    style={{ minHeight:64, fontSize: isLuca ? 20 : 17, fontWeight:700,
                      background:"rgba(236,72,153,0.3)", color:"#fff",
                      border:"2px solid rgba(236,72,153,0.5)", borderRadius:14,
                      cursor:"pointer", padding:"14px 20px", textAlign:"left" }}>
                    B) {item.B}
                  </button>
                </div>
                <div style={{ textAlign:"center", color:"rgba(255,255,255,0.4)", fontSize:12, marginTop:8 }}>
                  Say "A" or "B" aloud, or tap a button
                </div>
              </div>
            );
          }
          return null;
        })}

        {/* Continuing spinner */}
        {phase === "continuing" && (
          <div style={{ textAlign:"center", padding:"20px 0", color:"#fbbf24", fontSize:16, fontWeight:700 }}>
            📝 Continuing {kidName}'s story…
          </div>
        )}

        {/* Complete */}
        {phase === "complete" && (
          <div style={{ textAlign:"center", marginTop:24 }}>
            <div style={{ fontSize:30, fontWeight:800, color:"#fbbf24" }}>📖 Quest Complete!</div>
            <div style={{ fontSize:44, marginTop:10 }}>{"⭐".repeat(Math.min(totalStars, 5))}</div>
            <div style={{ fontSize:16, color:"rgba(255,255,255,0.8)", marginTop:8 }}>
              {choicesMade.length} {choicesMade.length === 1 ? "choice" : "choices"} made!
            </div>
            <div style={{ marginTop:20 }}>
              <GameBtn color="#22c55e" big onClick={collectStars} style={{ minHeight:80, fontSize:20 }}>
                Collect ⭐ {totalStars} Stars!
              </GameBtn>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
