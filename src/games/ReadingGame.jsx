import { useState, useEffect, useRef } from "react";
import { groqFetch, cacheGet, cacheSet, speakText } from "../utils";
import { GameBtn, recordGameHistory, ageBandFromProfile } from "./_shared";

const GROQ_KEY = import.meta.env.VITE_GROQ_KEY;
const STORY_MODEL = "llama-3.3-70b-versatile";
const STORY_TIMEOUT = 20000;

// ─── Static backup stories (3 per age band) ────────────────────────────────────
const BACKUP_STORIES = {
  luca: [
    {
      topic: "The Magic Puppy",
      segments: [
        "One day, Luca found a small puppy in the park. The puppy had big brown eyes and a wagging tail.\n\n\"I am Spot,\" said the puppy. \"Can you help me? I lost my golden bone!\"\n\nLuca said yes right away. They needed to look for it.",
        "They ran to the big oak tree. A squirrel sat on a branch holding something shiny! But it was just a coin, not the bone.\n\nLuca and Spot kept looking. They could try the flower garden or the fountain.",
        "Near the flower garden, Spot started to dig. His paws moved fast. Dig, dig, dig!\n\nAnd there it was — the golden bone! Spot barked with joy and did three happy spins.\n\nAs a thank-you, Spot said he could grant Luca one wish.",
        "Luca wished for a giant ice cream sundae. It appeared with a pop! Spot and Luca shared it under the tree.\n\nThey became best friends forever.\n\n— THE END —",
      ],
      choices: [
        { A: "look under the big oak tree", B: "search near the fountain" },
        { A: "follow the squirrel", B: "look in the flower garden" },
        { A: "wish for ice cream", B: "wish for a new toy" },
      ],
    },
    {
      topic: "Super Luca Saves the Day",
      segments: [
        "Luca woke up and found a red superhero cape on his bed! It had a big gold star. When he put it on, he could fly!\n\nHe zoomed up into the blue sky. The city looked tiny below.\n\nThen he heard a noise. Someone needed help!",
        "A kitten was stuck way up in a tall tree. It was too scared to climb down.\n\nLuca flew up to the branch. The kitten looked at him with big green eyes.\n\nHe had to figure out how to help.",
        "Luca wrapped the kitten gently in his cape and floated down nice and slow. The kitten purred so loudly!\n\nThe owner cried happy tears. Then the mayor of the city came running over with a surprise.",
        "\"Luca, you are our hero!\" said the mayor. He gave Luca a medal made of chocolate gold.\n\nLuca ate it on the way home and smiled the whole time.\n\nBeing a superhero was the best.\n\n— THE END —",
      ],
      choices: [
        { A: "fly toward the noise fast", B: "look from high in the sky first" },
        { A: "gently carry the kitten down", B: "ask someone for a ladder" },
        { A: "accept the chocolate medal", B: "say the kitten deserves the medal" },
      ],
    },
    {
      topic: "The Talking Robot",
      segments: [
        "Luca built a little robot out of boxes and foil. He pushed the ON button as a joke.\n\nThe robot's eyes lit up blue! \"Hello, Luca,\" it said in a tiny beeping voice. \"I am Bot-5. Let's go explore!\"\n\nLuca could not believe it. His robot was REAL!",
        "Bot-5 pointed to the backyard. \"There is buried treasure here!\" he beeped.\n\nThey dug with big spoons. After a while they hit something hard — a small metal box!\n\nLuca had to figure out how to open it.",
        "Luca noticed numbers on top: 2-4-6. He turned the dial and click — it opened! Inside was a note and a shiny marble.\n\nThe note said: \"Left by a friend. Pass it on.\"\n\nLuca thought about what to do.",
        "Luca added his own marble and buried the box again. Then he drew a treasure map for the next kid to find.\n\nBot-5 clapped his little foil hands. \"That is the best kind of treasure,\" he said.\n\n— THE END —",
      ],
      choices: [
        { A: "follow Bot-5 to the backyard", B: "explore the basement first" },
        { A: "try the number code", B: "look for a key" },
        { A: "add a marble and bury it again", B: "keep the box as a trophy" },
      ],
    },
  ],
  yana: [
    {
      topic: "The Hidden Laboratory",
      segments: [
        "Yana was returning a library book when she noticed something odd — a gap behind the tallest bookshelf. She squeezed through and found a spiral staircase leading down.\n\nAt the bottom was a gleaming laboratory filled with humming machines and glowing blue screens. A small robot rolled toward her.\n\n\"Finally,\" it chirped. \"A human with a curious mind. I am Atlas. My creator left a puzzle only a brilliant person can solve.\"",
        "Atlas explained that a mysterious signal had been scrambling the research database. Three encrypted files held the key to stopping it. The signal had a rhythm — almost like Morse code mixed with a counting sequence.\n\nYana studied the screens carefully. She could see two possible approaches.",
        "Yana focused on the counting sequence first. It was the Fibonacci pattern! She used it to decode the rhythm and traced the signal to a rogue satellite looping the same distress message for 40 years.\n\nShe re-routed the lab's antenna. The scrambling stopped. Atlas lit up every indicator light in a little victory dance.\n\nBut there was one more decision to make.",
        "Yana uploaded the decoded satellite message to every space agency on Earth. By morning, the story was on every news channel.\n\nOn a wall in the hidden lab, Atlas had added a new plaque:\n\nYANA — Discoverer of the Forgotten Signal.\n\n— THE END —",
      ],
      choices: [
        { A: "analyze the encrypted files directly", B: "study the signal's rhythm first" },
        { A: "focus on the counting sequence", B: "try to trace the signal's origin in reverse" },
        { A: "share the discovery with the world", B: "keep the lab secret to protect it" },
      ],
    },
    {
      topic: "The Dragon Cartographer",
      segments: [
        "Yana had always believed dragons were real — everyone else thought she was just imaginative. Then, hiking alone in the mountain pass, she heard the unmistakable sound of enormous wings.\n\nA copper-colored dragon landed on the ridge ahead. It didn't breathe fire. It was holding a rolled-up map in its claws.\n\n\"You,\" it said in a low rumble. \"You have the look of someone who solves things. I have a problem.\"",
        "The dragon, Orryn, explained that the ancient dragon flight-paths had been redrawn incorrectly. Dragon cubs were getting lost in the clouds.\n\nOrryn spread out the map. Yana could see the errors — the altitudes were marked in old units and the translator used the wrong conversion ratio.\n\nShe had to fix the map before the next migration in two days.",
        "Yana spent the night recalculating every altitude using the correct ratio. By dawn the map was accurate to within fifty feet — more precise than anything in the royal library.\n\nOrryn traced her corrections carefully. \"You have given our young ones safe skies,\" he said.\n\nAs payment, he offered her a choice.",
        "Yana chose the copper scale that would always point toward what she most needed to find.\n\nShe held it up. It spun — and pointed home, where her family was waiting.\n\nShe smiled, pocketed the scale, and started walking.\n\n— THE END —",
      ],
      choices: [
        { A: "offer to look at the map right away", B: "ask Orryn to explain more about the problem first" },
        { A: "recalculate the altitudes overnight", B: "fly with Orryn to check the routes in person" },
        { A: "take the compass scale", B: "ask for a ride on Orryn's back instead" },
      ],
    },
    {
      topic: "The Ocean Anomaly",
      segments: [
        "A mysterious blue circle had appeared overnight in the harbor — perfectly round, two hundred feet across, glowing beneath the surface. Scientists argued on the dock. Yana slipped away from her school group, rented a kayak, and paddled toward the center.\n\nWhen she held her hand over the glowing water, she felt a vibration — like a tuning fork struck at exactly the right frequency.\n\nSomething was down there.",
        "Yana dove. At thirty feet the glow intensified. She could make out concentric rings carved into the seafloor, like the grooves of a record.\n\nAt the very center: a smooth black octahedron the size of a shoebox, pulsing with blue light.\n\nHer breath was running out. She had to decide fast.",
        "Yana grabbed the octahedron and kicked for the surface. The moment it left the seafloor, the blue glow extinguished. The harbor went dark and calm.\n\nEvery scientist on the dock had their phone out, recording the moment the light died.\n\nYana set the object on the dock planks. It was covered in symbols no one had ever seen.\n\nOne choice remained.",
        "Yana refused to hand the octahedron to anyone until she had photographed every symbol herself.\n\nThree universities contacted her within a week. A team of linguists identified the symbols as a new writing system — possibly pre-human in origin.\n\nYana was listed as co-discoverer on every academic paper that followed.\n\n— THE END —",
      ],
      choices: [
        { A: "dive into the glow to investigate", B: "record the vibration pattern from the surface first" },
        { A: "grab the octahedron and surface fast", B: "memorize the symbols carved around it first" },
        { A: "photograph every symbol yourself before handing it over", B: "give it immediately to the scientists on the dock" },
      ],
    },
  ],
};

// ─── Parse a story chunk from Groq ─────────────────────────────────────────────
// Returns { storyText, choiceA, choiceB, isEnd }
function parseChunk(raw) {
  const isEnd = /THE\s+END/i.test(raw);
  const choiceIdx = raw.search(/\[CHOICE\]/i);

  if (choiceIdx === -1 || isEnd) {
    const text = raw
      .replace(/---?\s*THE\s+END\s*---?/gi, "— THE END —")
      .replace(/\bTHE\s+END\b/gi, "— THE END —")
      .trim();
    return { storyText: text, choiceA: null, choiceB: null, isEnd: true };
  }

  const storyText = raw.slice(0, choiceIdx).trim();
  const afterChoice = raw.slice(choiceIdx + 8).trim(); // skip "[CHOICE]"

  // Match "A) text / B) text" or "A) text\nB) text"
  const m = afterChoice.match(
    /A\)\s*(.+?)\s*(?:\/\s*B\)\s*|[\n\r]+\s*B\)\s*)(.+?)(?:[\n\r]|$)/i
  );
  if (m) {
    return { storyText, choiceA: m[1].trim(), choiceB: m[2].trim(), isEnd: false };
  }

  // Choice format didn't match — treat full response as ending text
  return { storyText: raw.trim(), choiceA: null, choiceB: null, isEnd: true };
}

// ─── Parse the initial Groq story (may contain multiple [CHOICE] markers) ──────
// Returns array of { type:"text"|"choice", content?, A?, B?, chosen? }
function parseInitialStory(raw) {
  const parts = raw.split(/\[CHOICE\]/i);
  const items = [];

  if (parts[0].trim()) {
    items.push({ type: "text", content: parts[0].trim() });
  }

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    const m = part.match(
      /^A\)\s*(.+?)\s*(?:\/\s*B\)\s*|[\n\r]+\s*B\)\s*)(.+?)(?:[\n\r]|$)/i
    );
    if (m) {
      items.push({ type: "choice", A: m[1].trim(), B: m[2].trim(), chosen: null });
      // Any text after the choice line
      const after = part.slice(part.indexOf(m[2]) + m[2].length).trim();
      if (after) items.push({ type: "text", content: after });
    } else {
      items.push({ type: "text", content: part });
    }
  }

  return items;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ReadingGame({ profile, kidsData, fbSet, addStars, transitionTo, curriculum }) {
  const ageBand = ageBandFromProfile(profile);
  const isLucaMode = ageBand === "luca";
  const kidAge = isLucaMode ? 6 : 8;
  const kidName = profile?.name || "the hero";

  // Story items: [{type:"text",content},{type:"choice",A,B,chosen}]
  const [storyItems, setStoryItems] = useState([]);
  const [phase, setPhase] = useState("loading"); // loading|reading|choice|continuing|complete
  const [choicesMade, setChoicesMade] = useState([]); // text of each chosen option
  const [storyTopic, setStoryTopic] = useState("");
  const [isFallback, setIsFallback] = useState(false);
  // Fallback story for mid-adventure offline recovery
  const fallbackRef = useRef(null);

  // TTS
  const [autoRead, setAutoRead] = useState(isLucaMode);
  const [speaking, setSpeaking] = useState(false);
  const stopRef = useRef(null);
  const lastSpokenRef = useRef("");

  // Toast
  const [toast, setToast] = useState(null);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const choiceCount = Math.min(choicesMade.length, 3);
  const totalStars = choiceCount + (phase === "complete" ? 2 : 0);

  // Items to display: all up to and including the first unchosen choice
  const displayItems = (() => {
    for (let i = 0; i < storyItems.length; i++) {
      if (storyItems[i].type === "choice" && !storyItems[i].chosen) {
        return storyItems.slice(0, i + 1);
      }
    }
    return storyItems;
  })();

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function showToast(msg, ms = 3500) {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  }

  function speak(text) {
    if (stopRef.current) stopRef.current();
    if (lastSpokenRef.current === text) return;
    lastSpokenRef.current = text;
    setSpeaking(true);
    stopRef.current = speakText(text, {
      onStop: () => { setSpeaking(false); stopRef.current = null; },
    });
  }

  function stopSpeech() {
    if (stopRef.current) stopRef.current();
    setSpeaking(false);
    stopRef.current = null;
    lastSpokenRef.current = "";
  }

  // Auto-read newest text segment when it appears
  useEffect(() => {
    if (!autoRead) return;
    const texts = storyItems.filter(i => i.type === "text");
    if (!texts.length) return;
    const last = texts[texts.length - 1].content;
    if (last && last !== lastSpokenRef.current) speak(last);
  }, [storyItems.length, autoRead]); // eslint-disable-line

  // Cleanup TTS on unmount
  useEffect(() => () => stopSpeech(), []); // eslint-disable-line

  // ── Load initial story ────────────────────────────────────────────────────────
  useEffect(() => { loadInitialStory(); }, []); // eslint-disable-line

  async function loadInitialStory() {
    // Check cache (keyed per kid+band so Luca and Yana get different stories)
    const cacheKey = `story_${kidName}_${ageBand}`;
    const cached = cacheGet(cacheKey);
    if (cached?.raw) {
      const items = parseInitialStory(cached.raw);
      setStoryTopic(cached.topic || `${kidName}'s Adventure`);
      applyInitialItems(items);
      return;
    }

    const vocabNote = isLucaMode
      ? "Use very simple words a 6-year-old knows. Short sentences of 5-7 words. Lots of exciting action."
      : "Use rich vocabulary and vivid descriptions for a clever 8-year-old. Include mystery and problem-solving.";

    const prompt =
      `Write a 500-word adventure story where ${kidName} is the main hero. ` +
      `Age: ${kidAge} years old. ${vocabNote}\n\n` +
      `Include EXACTLY 3 choice points. Format each choice EXACTLY like this:\n` +
      `[CHOICE]\n` +
      `A) first option / B) second option\n\n` +
      `Write story text before the first [CHOICE], between each [CHOICE], and after the third [CHOICE]. ` +
      `Stop writing after the third [CHOICE] and its two options. Do NOT write the story ending yet. ` +
      `Keep the full text under 650 words.`;

    const result = await groqFetch(
      GROQ_KEY,
      [
        { role: "system", content: "You are a master storyteller who writes captivating adventure stories for children. Always follow the exact format given." },
        { role: "user", content: prompt },
      ],
      { model: STORY_MODEL, maxTokens: 1300, timeout: STORY_TIMEOUT }
    );

    if (!result.ok) {
      activateFallback();
      return;
    }

    const topic = `${kidName}'s Adventure`;
    cacheSet(cacheKey, { raw: result.data, topic });
    const items = parseInitialStory(result.data);
    setStoryTopic(topic);
    applyInitialItems(items);
  }

  function applyInitialItems(items) {
    setStoryItems(items);
    const hasActiveChoice = items.some(i => i.type === "choice" && !i.chosen);
    setPhase(hasActiveChoice ? "choice" : "reading");
  }

  // ── Fallback ──────────────────────────────────────────────────────────────────
  function activateFallback(existingChoices = []) {
    const pool = isLucaMode ? BACKUP_STORIES.luca : BACKUP_STORIES.yana;
    const story = pool[Math.floor(Math.random() * pool.length)];
    fallbackRef.current = story;
    setIsFallback(true);
    setStoryTopic(story.topic);
    showToast("Offline — playing a saved story");

    const segIdx = existingChoices.length; // resume at the right segment
    const items = [{ type: "text", content: story.segments[segIdx] }];
    if (story.choices[segIdx]) {
      items.push({ type: "choice", A: story.choices[segIdx].A, B: story.choices[segIdx].B, chosen: null });
    }

    setStoryItems(prev => {
      // If we already had story items (mid-adventure fallback), append; otherwise replace
      if (prev.length > 0) return [...prev, ...items];
      return items;
    });
    setPhase(story.choices[segIdx] ? "choice" : "complete");
  }

  // ── Handle choice selection ───────────────────────────────────────────────────
  async function handleChoice(choiceLabel, choiceText) {
    const newChoicesMade = [...choicesMade, choiceText];
    setChoicesMade(newChoicesMade);

    // Mark the current (last unchosen) choice as chosen
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

    const isLastChoice = newChoicesMade.length >= 3;

    // Fallback mode — use pre-written story continuation
    if (isFallback || fallbackRef.current) {
      handleFallbackContinuation(newChoicesMade, isLastChoice);
      return;
    }

    setPhase("continuing");

    const endInstruction = isLastChoice
      ? "Write a satisfying conclusion (about 150 words) and end with THE END on the final line."
      : "Continue for about 150 words, then end this segment with exactly one more choice in this format:\n[CHOICE]\nA) first option / B) second option";

    const result = await groqFetch(
      GROQ_KEY,
      [
        { role: "system", content: "You are continuing a children's adventure story. Follow the format exactly." },
        {
          role: "user",
          content: `Continue the story: ${kidName} chose to ${choiceText}. ${endInstruction}`,
        },
      ],
      { model: STORY_MODEL, maxTokens: 450, timeout: STORY_TIMEOUT }
    );

    if (!result.ok) {
      // Mid-adventure fallback
      activateFallback(newChoicesMade);
      return;
    }

    const chunk = parseChunk(result.data);
    const newItems = [];
    if (chunk.storyText) newItems.push({ type: "text", content: chunk.storyText });
    if (chunk.choiceA && chunk.choiceB && !isLastChoice) {
      newItems.push({ type: "choice", A: chunk.choiceA, B: chunk.choiceB, chosen: null });
    }

    setStoryItems(prev => [...prev, ...newItems]);
    setPhase(chunk.choiceA && !isLastChoice ? "choice" : "complete");
  }

  function handleFallbackContinuation(newChoicesMade, isLastChoice) {
    const story = fallbackRef.current;
    if (!story) return;
    const segIdx = newChoicesMade.length; // 1-indexed segment
    const nextSegment = story.segments[segIdx];
    const nextChoice = !isLastChoice ? story.choices[segIdx] : null;

    const newItems = [];
    if (nextSegment) newItems.push({ type: "text", content: nextSegment });
    if (nextChoice) newItems.push({ type: "choice", A: nextChoice.A, B: nextChoice.B, chosen: null });

    setStoryItems(prev => [...prev, ...newItems]);
    setPhase(nextChoice ? "choice" : "complete");
  }

  // ── Collect stars + write Firebase ───────────────────────────────────────────
  function collectStars() {
    const finalStars = Math.min(choicesMade.length, 3) + 2;
    addStars(finalStars);

    const wordsRead = storyItems
      .filter(i => i.type === "text")
      .reduce((sum, i) => sum + i.content.split(/\s+/).length, 0);

    recordGameHistory(fbSet, profile, "reading", choicesMade.length * 100, finalStars, {
      storyTopic,
      choicesMade,
    });

    if (fbSet && profile?.name) {
      const prev = kidsData?.readingStats?.[profile.name] || {};
      fbSet(`readingStats/${profile.name}`, {
        totalStories: (prev.totalStories || 0) + 1,
        totalWordsRead: (prev.totalWordsRead || 0) + wordsRead,
        lastPlayed: new Date().toISOString(),
      });
    }

    transitionTo("mini_games");
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: 500, borderRadius: 16, overflow: "hidden", maxWidth: "100vw",
      width: "100%", boxSizing: "border-box",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          background: "#1e293b", color: "#fbbf24", padding: "10px 20px",
          borderRadius: 12, fontWeight: 700, fontSize: 14, zIndex: 9999,
          border: "2px solid #fbbf24", boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          whiteSpace: "nowrap",
        }}>
          {toast}
        </div>
      )}

      <div style={{ background: "linear-gradient(180deg, #064e3b, #065f46, #047857)", padding: 20, minHeight: 500 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 }}>
          <GameBtn color="#475569" onClick={() => { stopSpeech(); transitionTo("mini_games"); }}
            style={{ width: "auto", padding: "10px 16px", fontSize: 14 }}>
            ← Back
          </GameBtn>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => { if (autoRead) stopSpeech(); setAutoRead(r => !r); }}
              style={{
                background: autoRead ? "#fbbf24" : "rgba(255,255,255,0.2)",
                border: "none", borderRadius: 8, padding: "8px 14px",
                color: autoRead ? "#064e3b" : "#fff", fontSize: 14, fontWeight: 700,
                cursor: "pointer", minHeight: 40,
              }}>
              {autoRead ? "🔊 Auto-read ON" : "🔇 Auto-read OFF"}
            </button>
            {speaking && (
              <button
                onClick={stopSpeech}
                style={{
                  background: "#ef4444", border: "none", borderRadius: 8,
                  padding: "8px 14px", color: "#fff", fontSize: 14, fontWeight: 700,
                  cursor: "pointer", minHeight: 40,
                }}>
                ⏹ Stop
              </button>
            )}
          </div>

          <div style={{ color: "#fbbf24", fontWeight: 700, fontSize: 16, whiteSpace: "nowrap" }}>
            ⭐ {totalStars}
          </div>
        </div>

        {/* Story title */}
        {storyTopic && (
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fbbf24" }}>📖 {storyTopic}</div>
            {isFallback && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
                📦 Saved story
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {phase === "loading" && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
            <div style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>Writing your story…</div>
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, marginTop: 8 }}>
              This takes a few seconds
            </div>
          </div>
        )}

        {/* Story items */}
        {phase !== "loading" && displayItems.map((item, idx) => {
          if (item.type === "text") {
            return (
              <div key={idx} style={{
                background: "rgba(255,255,255,0.08)", borderRadius: 16, padding: 16,
                marginBottom: 12,
              }}>
                {item.content.split("\n").map((line, li) => (
                  <p key={li} style={{
                    margin: "0 0 8px 0", color: "#fff",
                    fontSize: isLucaMode ? 20 : 16, lineHeight: 1.85,
                  }}>
                    {line}
                  </p>
                ))}
                {!autoRead && (
                  <button
                    onClick={() => speak(item.content)}
                    style={{
                      marginTop: 6, background: "rgba(255,255,255,0.15)",
                      border: "2px solid rgba(255,255,255,0.3)", borderRadius: 10,
                      padding: "6px 14px", fontSize: 16, cursor: "pointer", color: "#fff",
                    }}>
                    🔊 Read aloud
                  </button>
                )}
              </div>
            );
          }

          if (item.type === "choice") {
            if (item.chosen) {
              // Already chosen — show as a confirmation badge
              return (
                <div key={idx} style={{
                  textAlign: "center", marginBottom: 12, padding: "10px 16px",
                  background: "rgba(34,197,94,0.15)", borderRadius: 12,
                  color: "#86efac", fontSize: 14, fontWeight: 700,
                  border: "1px solid rgba(34,197,94,0.35)",
                }}>
                  ✓ {kidName} chose: {item.chosen === "A" ? item.A : item.B}
                </div>
              );
            }

            // Active choice
            return (
              <div key={idx} style={{ marginBottom: 16 }}>
                <div style={{
                  textAlign: "center", color: "#fbbf24", fontWeight: 800,
                  fontSize: isLucaMode ? 18 : 16, marginBottom: 12,
                }}>
                  What does {kidName} do?
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <button
                    onClick={() => handleChoice("A", item.A)}
                    style={{
                      minHeight: 64, fontSize: isLucaMode ? 20 : 17, fontWeight: 700,
                      background: "rgba(99,102,241,0.35)", color: "#fff",
                      border: "2px solid rgba(99,102,241,0.6)", borderRadius: 14,
                      cursor: "pointer", padding: "14px 20px", textAlign: "left",
                    }}>
                    A) {item.A}
                  </button>
                  <button
                    onClick={() => handleChoice("B", item.B)}
                    style={{
                      minHeight: 64, fontSize: isLucaMode ? 20 : 17, fontWeight: 700,
                      background: "rgba(236,72,153,0.3)", color: "#fff",
                      border: "2px solid rgba(236,72,153,0.5)", borderRadius: 14,
                      cursor: "pointer", padding: "14px 20px", textAlign: "left",
                    }}>
                    B) {item.B}
                  </button>
                </div>
              </div>
            );
          }

          return null;
        })}

        {/* Continuing spinner */}
        {phase === "continuing" && (
          <div style={{
            textAlign: "center", padding: "20px 0", marginBottom: 8,
            color: "#fbbf24", fontSize: 16, fontWeight: 700,
          }}>
            📝 Continuing {kidName}'s story…
          </div>
        )}

        {/* Complete */}
        {phase === "complete" && (
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: "#fbbf24" }}>📖 Story Complete!</div>
            <div style={{ fontSize: 44, marginTop: 10 }}>
              {"⭐".repeat(Math.min(totalStars, 5))}
            </div>
            <div style={{ fontSize: 16, color: "rgba(255,255,255,0.8)", marginTop: 8 }}>
              {choicesMade.length} {choicesMade.length === 1 ? "choice" : "choices"} made + story finished!
            </div>
            <div style={{ marginTop: 20 }}>
              <GameBtn color="#22c55e" big onClick={collectStars}
                style={{ minHeight: 80, fontSize: 20 }}>
                Collect ⭐ {totalStars} Stars!
              </GameBtn>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
