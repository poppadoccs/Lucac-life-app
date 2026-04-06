import { useState } from "react";
import { speakText } from "../utils";

// ─── STORIES CONSTANT ────────────────────────────────────
const STORIES = {
  easy: [
    { title: "The Lost Puppy 🐕", sentences: ["A small ___ was lost in the park.", "It was very ___ outside.", "A kind ___ helped the puppy find home."],
      blanks: [{ options: ["🐕 dog", "🚗 car", "📚 book"], answer: "🐕 dog" }, { options: ["☀️ hot", "🥶 cold", "🟢 green"], answer: "☀️ hot" }, { options: ["👧 girl", "🪨 rock", "🐟 fish"], answer: "👧 girl" }] },
    { title: "The Magic Cat 🐱", sentences: ["A ___ cat sat on the mat.", "It could ___ very high.", "The cat loved to eat ___."],
      blanks: [{ options: ["🟠 orange", "🚀 rocket", "🌊 wave"], answer: "🟠 orange" }, { options: ["🚀 jump", "💤 sleep", "🎵 sing"], answer: "🚀 jump" }, { options: ["🐟 fish", "📚 books", "🔑 keys"], answer: "🐟 fish" }] },
    { title: "The Big Truck 🚚", sentences: ["The truck was very ___.", "It carried lots of ___.", "The driver was very ___."],
      blanks: [{ options: ["💪 big", "🐜 tiny", "🤫 quiet"], answer: "💪 big" }, { options: ["🍎 apples", "☁️ clouds", "⭐ stars"], answer: "🍎 apples" }, { options: ["😄 happy", "😢 sad", "😴 sleepy"], answer: "😄 happy" }] },
    { title: "Beach Day 🏖️", sentences: ["We went to the ___ today.", "I built a big ___ castle.", "A ___ splashed in the water."],
      blanks: [{ options: ["🏖️ beach", "🏫 school", "🏥 hospital"], answer: "🏖️ beach" }, { options: ["🏰 sand", "❄️ ice", "🍓 berry"], answer: "🏰 sand" }, { options: ["🐬 dolphin", "🐦 bird", "🐛 bug"], answer: "🐬 dolphin" }] },
    { title: "My Pet Bunny 🐰", sentences: ["My bunny is soft and ___.", "It loves to eat ___.", "At night it sleeps in a ___."],
      blanks: [{ options: ["🧸 fluffy", "🪨 hard", "💧 wet"], answer: "🧸 fluffy" }, { options: ["🥕 carrots", "🍕 pizza", "🍫 candy"], answer: "🥕 carrots" }, { options: ["🛏️ bed", "🚗 car", "🌳 tree"], answer: "🛏️ bed" }] },
  ],
  hard: [
    { title: "The Secret Garden", sentences: ["Maya discovered a ___ door behind the old bookshelf.", "Inside, she found a garden filled with ___ flowers.", "A tiny fairy ___ from behind a mushroom.", "The fairy said the garden needed a brave ___ to save it.", "Maya promised to ___ the garden every day."],
      blanks: [{ options: ["hidden", "purple", "broken"], answer: "hidden" }, { options: ["glowing", "paper", "angry"], answer: "glowing" }, { options: ["appeared", "vanished", "exploded"], answer: "appeared" }, { options: ["hero", "villain", "storm"], answer: "hero" }, { options: ["protect", "forget", "paint"], answer: "protect" }] },
    { title: "The Dragon's Riddle", sentences: ["A wise dragon lived on top of a ___ mountain.", "Anyone who solved its riddle would win a ___ prize.", "The riddle was: What gets ___ the more you take away?", "A clever girl answered: A ___!", "The dragon ___ and gave her a golden crown."],
      blanks: [{ options: ["tall", "flat", "tiny"], answer: "tall" }, { options: ["magnificent", "terrible", "invisible"], answer: "magnificent" }, { options: ["bigger", "smaller", "louder"], answer: "bigger" }, { options: ["hole", "mountain", "river"], answer: "hole" }, { options: ["smiled", "cried", "disappeared"], answer: "smiled" }] },
    { title: "Space Explorer", sentences: ["Captain Zara flew her spaceship toward a ___ planet.", "The planet had two ___ moons orbiting around it.", "She landed and ___ strange footprints in the purple sand.", "A friendly alien ___ her and offered a gift.", "Zara brought the gift back to ___ as proof of alien life."],
      blanks: [{ options: ["mysterious", "boring", "empty"], answer: "mysterious" }, { options: ["glittering", "invisible", "broken"], answer: "glittering" }, { options: ["discovered", "ignored", "painted"], answer: "discovered" }, { options: ["greeted", "frightened", "chased"], answer: "greeted" }, { options: ["Earth", "Mars", "the moon"], answer: "Earth" }] },
    { title: "The Underwater Kingdom", sentences: ["Deep beneath the ocean was a ___ kingdom of merfolk.", "The queen's crown was made of ___ pearls.", "One day, a storm ___ the crown from the palace.", "A brave young mermaid ___ to find it.", "She returned the crown and was ___ a hero forever."],
      blanks: [{ options: ["magnificent", "tiny", "boring"], answer: "magnificent" }, { options: ["shimmering", "wooden", "paper"], answer: "shimmering" }, { options: ["swept", "placed", "polished"], answer: "swept" }, { options: ["volunteered", "refused", "forgot"], answer: "volunteered" }, { options: ["called", "punished", "forgotten"], answer: "called" }] },
    { title: "Time Traveler", sentences: ["Sam found a ___ watch in his grandmother's attic.", "When he pressed the button, everything around him ___.", "He was standing in a ___ castle from long ago!", "A knight asked Sam to help ___ a baby dragon.", "Sam pressed the watch again and ___ safely home."],
      blanks: [{ options: ["golden", "plastic", "broken"], answer: "golden" }, { options: ["changed", "stopped", "melted"], answer: "changed" }, { options: ["medieval", "modern", "underwater"], answer: "medieval" }, { options: ["rescue", "capture", "forget"], answer: "rescue" }, { options: ["returned", "vanished", "stayed"], answer: "returned" }] },
  ]
};

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

// ─── READING GAME ─────────────────────────────────────────
export default function ReadingGame({ profile, kidsData, fbSet, addStars, transitionTo, curriculum }) {
  const { isLucaMode } = curriculum;

  const [readingStory] = useState(() => {
    const pool = isLucaMode ? STORIES.easy : STORIES.hard;
    return pool[Math.floor(Math.random() * pool.length)];
  });
  const [readingSentenceIdx, setReadingSentenceIdx] = useState(0);
  const [readingScore, setReadingScore] = useState(0);
  const [readingComplete, setReadingComplete] = useState(false);
  const [readingWrong, setReadingWrong] = useState(false);

  const story = readingStory;
  const sentIdx = readingSentenceIdx;
  const currentSentence = story?.sentences?.[sentIdx] || "";
  const currentBlank = story?.blanks?.[sentIdx];
  const isComplete = readingComplete;

  // Shuffle options once per sentence using a stable sort based on sentence index
  const shuffledOptions = currentBlank ? [...currentBlank.options].sort((a, b) => {
    const ha = (sentIdx * 97 + a.charCodeAt(0)) % 3;
    const hb = (sentIdx * 97 + b.charCodeAt(0)) % 3;
    return ha - hb;
  }) : [];

  const containerStyle = {
    position: "relative", minHeight: 500, borderRadius: 16, overflow: "hidden",
    overflowX: "hidden", maxWidth: "100vw", width: "100%", boxSizing: "border-box",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    animation: "ll-fade-in 0.4s ease-out", opacity: 1, transition: "opacity 0.3s",
  };

  return (
    <div style={containerStyle}>
      <div style={{ minHeight:500, background:"linear-gradient(180deg, #064e3b, #065f46, #047857)", padding:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <GameBtn color="#475569" onClick={() => transitionTo("mini_games")}>← Back</GameBtn>
          <div style={{ color:"#fbbf24", fontWeight:700, fontSize:16 }}>📖 {readingScore}/{story?.blanks?.length || 0} correct</div>
        </div>
        {story && (
          <>
            {/* Story title */}
            <div style={{ textAlign:"center", marginBottom:16 }}>
              <div style={{ fontSize:22, fontWeight:800, color:"#fbbf24" }}>{story.title}</div>
              <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)" }}>Sentence {Math.min(sentIdx + 1, story.sentences.length)} of {story.sentences.length}</div>
            </div>
            {/* Previous sentences */}
            <div style={{ background:"rgba(255,255,255,0.1)", borderRadius:16, padding:16, marginBottom:12 }}>
              {story.sentences.map((sent, i) => {
                if (i > sentIdx) return null;
                const blank = story.blanks[i];
                const filled = i < sentIdx;
                const isCurrent = i === sentIdx && !isComplete;
                return (
                  <div key={i} style={{ fontSize: isLucaMode ? 20 : 17, color:"#fff", lineHeight:1.8, marginBottom:6,
                    opacity: filled ? 0.7 : 1 }}>
                    {filled
                      ? sent.replace("___", blank.answer)
                      : isCurrent
                        ? sent.replace("___", " _____ ")
                        : isComplete ? sent.replace("___", blank.answer) : null
                    }
                    {filled && <span style={{ color:"#22c55e", marginLeft:4 }}>✓</span>}
                  </div>
                );
              })}
              {/* Read aloud button for Luca */}
              {isLucaMode && (
                <button onClick={() => speakText(currentSentence.replace("___", "blank"))}
                  style={{ marginTop:8, background:"rgba(255,255,255,0.15)", border:"2px solid rgba(255,255,255,0.3)",
                    borderRadius:12, padding:"8px 16px", fontSize:18, cursor:"pointer", color:"#fff" }}>
                  🔊 Read Aloud
                </button>
              )}
            </div>
            {/* Answer buttons */}
            {currentBlank && !isComplete && (
              <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:16 }}>
                <div style={{ textAlign:"center", fontSize:15, color:"rgba(255,255,255,0.7)", marginBottom:4 }}>
                  Pick the word that fits:
                </div>
                {shuffledOptions.map((word, i) => (
                  <button key={`${sentIdx}-${i}`} onClick={() => {
                    if (word === currentBlank.answer) {
                      setReadingScore(s => s + 1);
                      setReadingWrong(false);
                      if (isLucaMode) speakText(word);
                      if (sentIdx + 1 >= story.sentences.length) {
                        setReadingComplete(true);
                        if (isLucaMode) setTimeout(() => speakText("Story complete! Great job!"), 500);
                      } else {
                        setReadingSentenceIdx(idx => idx + 1);
                        if (isLucaMode) setTimeout(() => speakText(story.sentences[sentIdx + 1].replace("___", "blank")), 300);
                      }
                    } else {
                      setReadingWrong(true);
                      if (isLucaMode) speakText("Try again!");
                    }
                  }} style={{
                    minHeight:60, fontSize: isLucaMode ? 20 : 18, fontWeight:700,
                    background: readingWrong && word !== currentBlank.answer ? "rgba(255,255,255,0.05)" : "rgba(99,102,241,0.3)",
                    color:"#fff", border:"2px solid rgba(99,102,241,0.5)", borderRadius:14,
                    cursor:"pointer", padding:"12px 20px", textAlign:"center",
                    animation: readingWrong ? "ll-shake 0.3s" : "none"
                  }}>
                    {word}
                  </button>
                ))}
                {readingWrong && <div style={{ textAlign:"center", color:"#fbbf24", fontSize:14 }}>Not quite - try again! No penalty.</div>}
              </div>
            )}
            {/* Complete */}
            {isComplete && (
              <div style={{ textAlign:"center", marginTop:20 }}>
                <div style={{ fontSize:28, fontWeight:800, color:"#fbbf24" }}>📖 Story Complete!</div>
                <div style={{ fontSize:40, marginTop:8 }}>⭐⭐⭐</div>
                <div style={{ fontSize:16, color:"#fff", marginTop:8 }}>{readingScore} words correct!</div>
                <GameBtn color="#22c55e" onClick={() => {
                  addStars(3);
                  if (fbSet && profile?.name) fbSet(`gameHistory/${profile.name}/${Date.now()}`, { game:'reading', score:readingScore*100, stars:3, timestamp:new Date().toISOString(), profile:profile.name });
                  transitionTo("mini_games");
                }} style={{ marginTop:12, minHeight:80, fontSize:20 }}>
                  Collect ⭐ 3 Stars!
                </GameBtn>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
