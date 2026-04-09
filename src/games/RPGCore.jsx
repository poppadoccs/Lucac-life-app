import { useState, useRef, useMemo } from "react";
import { GameBtn } from "./_shared";
import { speakText } from "../utils";
import FishGame from "./FishGame";
import RacingGame from "./RacingGame";
import BoardGame from "./BoardGame";
import ReadingGame from "./ReadingGame";

// ─── CONSTANTS ───────────────────────────────────────────

const MAX_HP = 5;

const WORLDS = [
  {
    id: "forest", name: "Enchanted Forest", emoji: "🌲", color: "#2d5a27",
    unlockLevel: 0, difficulty: 1,
    scenes: [
      { type: "forest", title: "The Whispering Woods", desc: "Strange sounds echo through the ancient trees..." },
      { type: "forest", title: "The Mushroom Clearing", desc: "Giant glowing mushrooms light the path ahead." },
      { type: "forest", title: "The Troll Bridge", desc: "A grumpy troll blocks your way across the river!" },
    ],
    boss: { name: "Thornvine", title: "Guardian of the Green", emoji: "🌳", hp: 4, color: "#2d5a27",
      attacks: ["Vine Whip", "Root Slam", "Leaf Storm", "Thorn Shield"],
      taunts: ["My roots run deeper than your courage!", "The forest answers to ME!", "You are but a leaf in my wind!", "THORNVINE SMASH!"] },
  },
  {
    id: "cave", name: "Crystal Caverns", emoji: "💎", color: "#6366f1",
    unlockLevel: 1, difficulty: 2,
    scenes: [
      { type: "cave", title: "The Echoing Entrance", desc: "Dripping water echoes through the darkness..." },
      { type: "cave", title: "The Crystal Chamber", desc: "Crystals glow with mysterious energy all around you." },
      { type: "cave", title: "The Underground Lake", desc: "A vast lake stretches out in the cavern depths." },
    ],
    boss: { name: "Gloomfang", title: "The Shadow Dweller", emoji: "🦇", hp: 5, color: "#6366f1",
      attacks: ["Shadow Bite", "Echo Scream", "Dark Wing", "Void Pulse"],
      taunts: ["You fear the dark... I AM the dark!", "No light reaches my domain!", "SCREEEECH!", "Gloomfang hungers!"] },
  },
  {
    id: "mountain", name: "Skybreak Summit", emoji: "🏔️", color: "#667eea",
    unlockLevel: 2, difficulty: 3,
    scenes: [
      { type: "mountain", title: "The Frozen Trail", desc: "Ice and snow cover every step of the climb." },
      { type: "mountain", title: "The Eagle's Nest", desc: "A giant eagle watches you from above..." },
      { type: "mountain", title: "The Avalanche Pass", desc: "Rumbling snow threatens to bury you!" },
    ],
    boss: { name: "Stormwing", title: "Lord of Lightning", emoji: "🦅", hp: 6, color: "#667eea",
      attacks: ["Lightning Strike", "Thunder Clap", "Wind Slash", "Storm Fury"],
      taunts: ["The sky bows to ME!", "Feel the thunder!", "You cannot fly this high, little one!", "STORMWING DESCENDS!"] },
  },
  {
    id: "village", name: "Shadow Village", emoji: "🏘️", color: "#f59e0b",
    unlockLevel: 3, difficulty: 4,
    scenes: [
      { type: "village", title: "The Haunted Market", desc: "Empty stalls creak in the ghost wind..." },
      { type: "village", title: "The Cursed Well", desc: "Dark water bubbles and glows green." },
      { type: "village", title: "The Clock Tower", desc: "The clock strikes 13... impossible!" },
    ],
    boss: { name: "Danyells", title: "The Dark Queen", emoji: "👩‍🦳", hp: 7, color: "#f43f5e",
      attacks: ["Doom Glare", "Shadow Serve", "Dark Decree", "Ultimate Sass"],
      taunts: ["You call yourself a HERO?!", "My houseplant is braver than you!", "You are getting SERVED!", "DANYELLS ULTIMATE ATTACK! 💅"] },
  },
  {
    id: "volcano", name: "Magma Core", emoji: "🌋", color: "#ef4444",
    unlockLevel: 4, difficulty: 5,
    scenes: [
      { type: "boss_arena", title: "The Lava Fields", desc: "Rivers of lava flow all around you!" },
      { type: "boss_arena", title: "The Fire Chamber", desc: "Flames erupt from cracks in the ground!" },
      { type: "boss_arena", title: "The Dragon's Lair", desc: "A massive shadow moves in the smoke..." },
    ],
    boss: { name: "MAGMAZILLA", title: "Destroyer of Everything", emoji: "🐉", hp: 8, color: "#ef4444",
      attacks: ["Lava Breath", "Magma Slam", "Fire Storm", "MEGA ERUPTION"],
      taunts: ["MAGMAZILLA HUNGRY!", "YOUR WORLD WILL BURN!", "RAAAAWWWRRR!", "MAGMAZILLA ULTIMATE DESTRUCTION!"] },
  },
];

const ITEMS = {
  sword:  { emoji: "🗡️", name: "Sword", desc: "+2 Attack", stat: "attack", value: 2 },
  shield: { emoji: "🛡️", name: "Shield", desc: "-1 Damage taken", stat: "defense", value: 1 },
  potion: { emoji: "❤️", name: "Health Potion", desc: "+2 HP", stat: "heal", value: 2 },
  star:   { emoji: "⭐", name: "Star Token", desc: "+1 Star", stat: "star", value: 1 },
  bow:    { emoji: "🏹", name: "Bow", desc: "+1 Attack", stat: "attack", value: 1 },
  ring:   { emoji: "💍", name: "Magic Ring", desc: "+1 to all", stat: "all", value: 1 },
  boots:  { emoji: "👢", name: "Speed Boots", desc: "Dodge chance", stat: "dodge", value: 1 },
  crown:  { emoji: "👑", name: "Hero Crown", desc: "+3 Attack", stat: "attack", value: 3 },
};

const SCENE_CHOICES = {
  forest: [
    { prompt: "You hear rustling in the bushes. What do you do?",
      options: [
        { text: "🔍 Investigate carefully", correct: true, reward: "potion", msg: "You found a Health Potion hidden in the leaves!" },
        { text: "🏃 Run away fast!", correct: false, msg: "You tripped on a root! Ouch!" },
        { text: "🗣️ Call out hello!", correct: true, reward: "star", msg: "A friendly fairy gives you a star!" },
      ] },
    { prompt: "A fork in the path: left is dark, right has flowers.",
      options: [
        { text: "⬅️ Go left (dark path)", correct: true, reward: "sword", msg: "You found a shiny sword in the shadows!" },
        { text: "➡️ Go right (flowers)", correct: false, msg: "The flowers were poison ivy! Itchy!" },
        { text: "⬆️ Climb a tree to see ahead", correct: true, reward: "star", msg: "Great view! You spot a shortcut and earn a star!" },
      ] },
    { prompt: "A sleeping bear blocks the trail!",
      options: [
        { text: "🤫 Sneak past quietly", correct: true, reward: "boots", msg: "You found Speed Boots behind the bear!" },
        { text: "📢 Yell to scare it", correct: false, msg: "The bear woke up angry! It swiped at you!" },
        { text: "🍯 Leave some honey", correct: true, reward: "star", msg: "The bear loves it and moves aside! +1 star!" },
      ] },
  ],
  cave: [
    { prompt: "The cave splits into two tunnels. One glows, one is silent.",
      options: [
        { text: "✨ Follow the glow", correct: true, reward: "ring", msg: "A magic ring floats in the crystal light!" },
        { text: "🤫 Take the silent tunnel", correct: false, msg: "You walked into a spider web! Gross!" },
        { text: "👂 Listen first, then choose", correct: true, reward: "star", msg: "Smart! You hear treasure ahead. +1 star!" },
      ] },
    { prompt: "Bats swarm around you in the dark!",
      options: [
        { text: "🛡️ Duck and cover", correct: true, reward: "shield", msg: "You found a shield wedged in the rock!" },
        { text: "👊 Swing at them", correct: false, msg: "You missed and hit the wall! Ouch!" },
        { text: "🔦 Light a torch", correct: true, reward: "star", msg: "The bats flee from the light! +1 star!" },
      ] },
    { prompt: "You see strange writing on the cave wall.",
      options: [
        { text: "📖 Try to read it", correct: true, reward: "star", msg: "It is a treasure map clue! +1 star!" },
        { text: "🖐️ Touch the writing", correct: false, msg: "ZAP! It was a trap!" },
        { text: "📝 Copy it down", correct: true, reward: "potion", msg: "The writing reveals a hidden potion!" },
      ] },
  ],
  mountain: [
    { prompt: "An icy bridge stretches across a chasm!",
      options: [
        { text: "🧊 Slide across carefully", correct: true, reward: "star", msg: "Smooth crossing! +1 star!" },
        { text: "🏃 Run across fast", correct: false, msg: "You slipped on the ice!" },
        { text: "🧗 Climb underneath", correct: true, reward: "bow", msg: "You found a bow under the bridge!" },
      ] },
    { prompt: "A snow yeti appears and stares at you!",
      options: [
        { text: "🤝 Offer friendship", correct: true, reward: "potion", msg: "The yeti gives you a health potion!" },
        { text: "🏃 Run down the mountain", correct: false, msg: "You slid into a snowbank!" },
        { text: "💃 Do a funny dance", correct: true, reward: "star", msg: "The yeti laughs and lets you pass! +1 star!" },
      ] },
    { prompt: "An eagle drops something shiny near you!",
      options: [
        { text: "🖐️ Pick it up", correct: true, reward: "crown", msg: "It is a Hero Crown! +3 Attack!" },
        { text: "🦅 Chase the eagle", correct: false, msg: "You ran off a small ledge! Ouch!" },
        { text: "🙏 Thank the eagle", correct: true, reward: "star", msg: "The eagle nods and flies away! +1 star!" },
      ] },
  ],
  village: [
    { prompt: "A ghost merchant floats before you with glowing wares.",
      options: [
        { text: "🛒 Browse the shop", correct: true, reward: "shield", msg: "You got a magic shield for free!" },
        { text: "👻 Scream and run", correct: false, msg: "You tripped over a bucket!" },
        { text: "👋 Wave hello", correct: true, reward: "star", msg: "The ghost likes your bravery! +1 star!" },
      ] },
    { prompt: "The cursed well whispers your name...",
      options: [
        { text: "💧 Drop a coin in", correct: true, reward: "potion", msg: "The curse breaks! A potion floats up!" },
        { text: "👀 Look inside", correct: false, msg: "Spooky! Something splashed you!" },
        { text: "🏃 Back away slowly", correct: true, reward: "star", msg: "Wise choice! A star appears at your feet!" },
      ] },
    { prompt: "A locked chest sits in the abandoned house.",
      options: [
        { text: "🔑 Search for a key", correct: true, reward: "sword", msg: "Key found! Inside: a powerful sword!" },
        { text: "👊 Smash it open", correct: false, msg: "It was booby-trapped! BONK!" },
        { text: "🧠 Solve the riddle lock", correct: true, reward: "star", msg: "Clever! The chest opens. +1 star!" },
      ] },
  ],
  boss_arena: [
    { prompt: "Lava pools bubble ahead. Which way?",
      options: [
        { text: "⬅️ Hop left on rocks", correct: true, reward: "potion", msg: "Safe! You found a potion on a rock!" },
        { text: "➡️ Jump right", correct: false, msg: "Too hot! The rock crumbled!" },
        { text: "⬆️ Find high ground", correct: true, reward: "star", msg: "Smart! You see the path clearly. +1 star!" },
      ] },
    { prompt: "A fire spirit appears and offers a deal!",
      options: [
        { text: "🤝 Accept the deal", correct: true, reward: "sword", msg: "The spirit gives you a flame sword!" },
        { text: "👊 Fight it", correct: false, msg: "Fire burns! Bad idea!" },
        { text: "🧠 Ask what the deal is first", correct: true, reward: "star", msg: "Smart negotiation! +1 star!" },
      ] },
    { prompt: "You see dragon eggs near the final door!",
      options: [
        { text: "🥚 Leave them alone", correct: true, reward: "star", msg: "Respectful! The dragon mother gives you a star!" },
        { text: "🥚 Take one", correct: false, msg: "MAMA DRAGON IS MAD!" },
        { text: "🛡️ Guard them", correct: true, reward: "crown", msg: "The dragon blesses you with a Hero Crown!" },
      ] },
  ],
};

const DEFAULT_REWARDS = [
  { name: "30 min screen time", cost: 10, emoji: "📱" },
  { name: "Pick dinner tonight", cost: 15, emoji: "🍕" },
  { name: "Movie night choice", cost: 25, emoji: "🎬" },
  { name: "Stay up 30 min late", cost: 20, emoji: "🌙" },
  { name: "New small toy", cost: 50, emoji: "🎁" },
];

// ─── KEYFRAMES CSS ───────────────────────────────────────
const KEYFRAMES_CSS = `
@keyframes ll-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
@keyframes ll-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-6px); } 80% { transform: translateX(4px); } }
@keyframes ll-jump { 0% { transform: translateY(0) scale(1); } 30% { transform: translateY(-30px) scale(1.1); } 50% { transform: translateY(-40px) scale(1.15); } 70% { transform: translateY(-20px) scale(1.05); } 100% { transform: translateY(0) scale(1); } }
@keyframes ll-float-up { 0% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-60px) scale(1.5); } }
@keyframes ll-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
@keyframes ll-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes ll-fade-in { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes ll-slash { 0% { transform: translateX(0) rotate(0deg); opacity: 1; } 50% { transform: translateX(40px) rotate(30deg); opacity: 1; } 100% { transform: translateX(80px) rotate(60deg); opacity: 0; } }
@keyframes ll-confetti { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(200px) rotate(720deg); opacity: 0; } }
@keyframes ll-swim { 0%, 100% { transform: translateY(0); } 25% { transform: translateY(-4px) rotate(2deg); } 75% { transform: translateY(4px) rotate(-2deg); } }
@keyframes ll-bubble-rise { 0% { transform: translateY(0) scale(1); opacity: 0.7; } 100% { transform: translateY(-60px) scale(0.5); opacity: 0; } }
@keyframes ll-leaf-fall { 0% { transform: translateY(-20px) translateX(0px) rotate(0deg); opacity: 0.8; } 50% { transform: translateY(100px) translateX(30px) rotate(180deg); opacity: 0.6; } 100% { transform: translateY(220px) translateX(-10px) rotate(360deg); opacity: 0; } }
@keyframes ll-glow-eyes { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
@keyframes ll-snow-fall { 0% { transform: translateY(-10px) translateX(0); opacity: 0.9; } 100% { transform: translateY(200px) translateX(20px); opacity: 0; } }
@keyframes ll-smoke { 0% { transform: translateY(0) scale(1); opacity: 0.6; } 100% { transform: translateY(-40px) scale(2); opacity: 0; } }
@keyframes ll-lightning { 0%, 90%, 100% { opacity: 0; } 92%, 95% { opacity: 1; } }
@keyframes ll-screen-shake { 0%, 100% { transform: translate(0); } 10% { transform: translate(-4px, 2px); } 20% { transform: translate(4px, -2px); } 30% { transform: translate(-3px, 3px); } 40% { transform: translate(3px, -1px); } 50% { transform: translate(-2px, 2px); } }
@keyframes ll-damage-number { 0% { opacity: 1; transform: translateY(0) scale(1); } 60% { opacity: 1; transform: translateY(-40px) scale(1.4); } 100% { opacity: 0; transform: translateY(-70px) scale(0.8); } }
@keyframes ll-impact-text { 0% { opacity: 0; transform: scale(0.3) rotate(-10deg); } 50% { opacity: 1; transform: scale(1.3) rotate(5deg); } 100% { opacity: 0; transform: scale(1) rotate(0deg); } }
`;

// ─── BACKGROUND COMPONENTS ───────────────────────────────

function ForestBG() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden",
      background: "linear-gradient(180deg, #1a472a 0%, #2d5a27 40%, #1a3a1a 100%)" }}>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "30%",
        background: "linear-gradient(180deg, #1a3a1a, #0d2010)" }} />
      {[10, 25, 45, 65, 80, 92].map((l, i) => (
        <div key={i} style={{ position: "absolute", bottom: "28%", left: `${l}%`,
          fontSize: i % 2 === 0 ? 48 : 36, transform: "translateX(-50%)" }}>
          {i % 2 === 0 ? "🌲" : "🌳"}
        </div>
      ))}
      {[0,1,2,3,4].map(i => (
        <div key={`leaf${i}`} style={{ position: "absolute", top: -20,
          left: `${15 + i * 18}%`, fontSize: 20,
          animation: `ll-leaf-fall ${3 + i * 0.7}s ease-in-out ${i * 0.8}s infinite` }}>🍃</div>
      ))}
      {[0,1,2].map(i => (
        <div key={`fly${i}`} style={{ position: "absolute", top: `${30 + i * 15}%`,
          left: `${20 + i * 25}%`, width: 6, height: 6, borderRadius: "50%",
          background: "#ffe066", boxShadow: "0 0 8px #ffe066",
          animation: `ll-pulse ${2 + i * 0.5}s ease-in-out infinite` }} />
      ))}
    </div>
  );
}

function CaveBG() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden",
      background: "linear-gradient(180deg, #0a0a1a 0%, #1a1a2e 50%, #16213e 100%)" }}>
      {[10, 30, 55, 75, 90].map((l, i) => (
        <div key={i} style={{ position: "absolute", top: 0, left: `${l}%`,
          width: 0, height: 0,
          borderLeft: `${8 + i * 3}px solid transparent`,
          borderRight: `${8 + i * 3}px solid transparent`,
          borderTop: `${30 + i * 10}px solid #2a2a4e` }} />
      ))}
      {[0,1,2].map(i => (
        <div key={`eyes${i}`} style={{ position: "absolute", top: `${25 + i * 20}%`,
          left: `${15 + i * 30}%`, fontSize: 20,
          animation: `ll-glow-eyes ${2 + i}s ease-in-out ${i * 0.5}s infinite` }}>👀</div>
      ))}
      {[20, 50, 80].map((l, i) => (
        <div key={`crystal${i}`} style={{ position: "absolute", bottom: `${5 + i * 5}%`,
          left: `${l}%`, fontSize: 28, animation: `ll-pulse ${3 + i}s ease-in-out infinite` }}>💎</div>
      ))}
    </div>
  );
}

function MountainBG() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden",
      background: "linear-gradient(180deg, #667eea 0%, #a8c0ff 40%, #d4e0ff 100%)" }}>
      <div style={{ position: "absolute", bottom: 0, left: "5%", width: 0, height: 0,
        borderLeft: "80px solid transparent", borderRight: "80px solid transparent",
        borderBottom: "120px solid #556b9e" }} />
      <div style={{ position: "absolute", bottom: 0, left: "35%", width: 0, height: 0,
        borderLeft: "100px solid transparent", borderRight: "100px solid transparent",
        borderBottom: "160px solid #4a5f8e" }} />
      <div style={{ position: "absolute", bottom: 0, right: "10%", width: 0, height: 0,
        borderLeft: "70px solid transparent", borderRight: "70px solid transparent",
        borderBottom: "100px solid #5e72a8" }} />
      <div style={{ position: "absolute", bottom: 130, left: "calc(35% + 50px)", width: 0, height: 0,
        borderLeft: "30px solid transparent", borderRight: "30px solid transparent",
        borderBottom: "30px solid white" }} />
      {[0,1,2,3,4,5].map(i => (
        <div key={`snow${i}`} style={{ position: "absolute", top: -10,
          left: `${8 + i * 16}%`, fontSize: 16,
          animation: `ll-snow-fall ${4 + i * 0.5}s linear ${i * 0.6}s infinite` }}>❄️</div>
      ))}
    </div>
  );
}

function VillageBG() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden",
      background: "linear-gradient(180deg, #f6d365 0%, #fda085 60%, #e8956a 100%)" }}>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "25%",
        background: "linear-gradient(180deg, #8B7355, #6B5B45)" }} />
      {[15, 40, 65, 85].map((l, i) => (
        <div key={i} style={{ position: "absolute", bottom: "23%", left: `${l}%`,
          fontSize: i % 2 === 0 ? 40 : 32, transform: "translateX(-50%)" }}>
          {i % 2 === 0 ? "🏠" : "🏡"}
        </div>
      ))}
      {[15, 65].map((l, i) => (
        <div key={`smoke${i}`} style={{ position: "absolute", bottom: "52%", left: `${l + 2}%`,
          fontSize: 20, animation: `ll-smoke 3s ease-out ${i * 1.5}s infinite` }}>☁️</div>
      ))}
      <div style={{ position: "absolute", top: 20, right: 30, fontSize: 40,
        animation: "ll-pulse 4s ease-in-out infinite" }}>🌅</div>
    </div>
  );
}

function BossArenaBG({ shake }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden",
      background: "linear-gradient(180deg, #870000 0%, #3d0000 50%, #190a05 100%)",
      animation: shake ? "ll-screen-shake 0.4s ease-in-out" : "none" }}>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "20%",
        background: "linear-gradient(180deg, #ff4500, #cc3700, #8b0000)",
        animation: "ll-pulse 2s ease-in-out infinite" }} />
      {[0,1,2].map(i => (
        <div key={`lt${i}`} style={{ position: "absolute", top: 10,
          left: `${20 + i * 30}%`, fontSize: 36,
          animation: `ll-lightning ${1.5 + i * 0.3}s ease-in-out ${i * 0.7}s infinite` }}>⚡</div>
      ))}
      {[0,1,2,3].map(i => (
        <div key={`fire${i}`} style={{ position: "absolute", bottom: "18%",
          left: `${10 + i * 25}%`, fontSize: 28,
          animation: `ll-pulse ${1 + i * 0.3}s ease-in-out infinite` }}>🔥</div>
      ))}
    </div>
  );
}

function VictoryBG() {
  const confettiEmojis = ["🎊", "🎉", "⭐", "✨", "💫", "🌟", "🎆", "🏆"];
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden",
      background: "linear-gradient(135deg, #a8edea 0%, #fed6e3 35%, #d299c2 65%, #a8edea 100%)" }}>
      {confettiEmojis.map((e, i) => (
        <div key={i} style={{ position: "absolute", top: -30,
          left: `${5 + i * 12}%`, fontSize: 28,
          animation: `ll-confetti ${2 + i * 0.3}s ease-in ${i * 0.2}s infinite` }}>{e}</div>
      ))}
      <div style={{ position: "absolute", top: "20%", left: "20%", fontSize: 50,
        animation: "ll-pulse 1s ease-in-out infinite" }}>🎆</div>
      <div style={{ position: "absolute", top: "15%", right: "20%", fontSize: 50,
        animation: "ll-pulse 1.3s ease-in-out 0.3s infinite" }}>🎇</div>
    </div>
  );
}

function SceneBG({ type, shake }) {
  switch (type) {
    case "forest": return <ForestBG />;
    case "cave": return <CaveBG />;
    case "mountain": return <MountainBG />;
    case "village": return <VillageBG />;
    case "boss_arena": return <BossArenaBG shake={shake} />;
    case "victory": return <VictoryBG />;
    default: return <ForestBG />;
  }
}

// ─── SHARED DISPLAY COMPONENTS ───────────────────────────

const EMOTION_MAP = {
  happy: "😊", scared: "😨", determined: "😤", victorious: "🎉", hurt: "😣", idle: null,
};

function Avatar({ emoji, emotion, anim, size = 60, style: extraStyle, profile }) {
  const face = EMOTION_MAP[emotion] || null;
  let animName = "none";
  if (anim === "bounce") animName = "ll-bounce 0.6s ease-in-out infinite";
  if (anim === "shake") animName = "ll-shake 0.5s ease-in-out";
  if (anim === "jump") animName = "ll-jump 0.8s ease-in-out";
  if (anim === "pulse") animName = "ll-pulse 1s ease-in-out infinite";
  const dataUrl = profile?.avatarDataUrl;
  return (
    <div style={{ position: "relative", display: "inline-block", animation: animName, ...extraStyle }}>
      {dataUrl
        ? <img src={dataUrl} alt="avatar" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }} />
        : <div style={{ fontSize: size, lineHeight: 1 }}>{emoji}</div>
      }
      {face && (
        <div style={{ position: "absolute", bottom: -4, right: -4, fontSize: size * 0.4,
          background: "rgba(0,0,0,0.5)", borderRadius: "50%", width: size * 0.45, height: size * 0.45,
          display: "flex", alignItems: "center", justifyContent: "center" }}>{face}</div>
      )}
    </div>
  );
}

function HPDisplay({ current, max, label, color }) {
  const hearts = [];
  for (let i = 0; i < max; i++) {
    hearts.push(
      <span key={i} style={{ fontSize: 22, opacity: i < current ? 1 : 0.25,
        transition: "opacity 0.3s, transform 0.3s",
        transform: i < current ? "scale(1)" : "scale(0.8)",
        filter: i < current ? "none" : "grayscale(1)" }}>❤️</span>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      {label && <span style={{ fontSize: 14, fontWeight: 700, color: color || "#fff",
        textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>{label}</span>}
      <div style={{ display: "flex", gap: 2 }}>{hearts}</div>
    </div>
  );
}

function BossHPBar({ current, max, emoji, name, color }) {
  const pct = Math.max(0, (current / max) * 100);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 32 }}>{emoji}</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: "#fff",
          textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>{name}</span>
      </div>
      <div style={{ background: "rgba(0,0,0,0.5)", borderRadius: 10, height: 20,
        overflow: "hidden", border: "2px solid rgba(255,255,255,0.3)" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 8,
          background: pct > 50 ? (color || "#ef4444") : pct > 25 ? "#f59e0b" : "#ef4444",
          transition: "width 0.5s ease-out",
          boxShadow: `0 0 10px ${pct > 50 ? (color || "#ef4444") : "#ef4444"}` }} />
      </div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", textAlign: "right", marginTop: 2,
        textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>{current} / {max} HP</div>
    </div>
  );
}

function FloatingText({ text, color, x, y }) {
  return (
    <div style={{ position: "absolute", left: x || "50%", top: y || "40%",
      transform: "translateX(-50%)", color: color || "#fff",
      fontSize: 28, fontWeight: 900, textShadow: `0 0 10px ${color || "#fff"}`,
      animation: "ll-damage-number 1s ease-out forwards", pointerEvents: "none", zIndex: 100 }}>
      {text}
    </div>
  );
}

function ImpactText({ text }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 100, pointerEvents: "none" }}>
      <div style={{ fontSize: 48, fontWeight: 900, color: "#fff",
        textShadow: "0 0 20px #ff0, 0 0 40px #f80, 2px 2px 0 #000",
        animation: "ll-impact-text 0.8s ease-out forwards", letterSpacing: 4 }}>{text}</div>
    </div>
  );
}

function InventoryBar({ inventory }) {
  if (!inventory || inventory.length === 0) return null;
  const counts = {};
  inventory.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "6px 0" }}>
      {Object.entries(counts).map(([id, count]) => {
        const item = ITEMS[id];
        if (!item) return null;
        return (
          <div key={id} style={{ background: "rgba(255,255,255,0.15)", borderRadius: 8,
            padding: "4px 8px", display: "flex", alignItems: "center", gap: 4,
            border: "1px solid rgba(255,255,255,0.2)" }}>
            <span style={{ fontSize: 18 }}>{item.emoji}</span>
            {count > 1 && <span style={{ fontSize: 12, color: "#fff", fontWeight: 700 }}>x{count}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─── RPG CORE ────────────────────────────────────────────

export default function RPGCore({ profile, kidsData, fbSet, addStars, transitionTo, curriculum, initialScreen }) {
  const { isLucaMode, mathDifficulty } = curriculum;

  // Internal screen state — RPGCore manages its own navigation
  const [screen, setScreen] = useState(initialScreen || "world_select");
  const [fadeIn, setFadeIn] = useState(true);

  // RPG state
  const [currentWorld, setCurrentWorld] = useState(0);
  const [currentScene, setCurrentScene] = useState(0);
  const [hp, setHp] = useState(MAX_HP);
  const [inventory, setInventory] = useState([]);
  const [starsEarned, setStarsEarned] = useState(0);
  const [worldsCompleted, setWorldsCompleted] = useState([]);
  const [choiceResult, setChoiceResult] = useState(null);
  const [emotion, setEmotion] = useState("idle");
  const [avatarAnim, setAvatarAnim] = useState("bounce");

  // Battle state
  const [bossHp, setBossHp] = useState(0);
  const [bossMaxHp, setBossMaxHp] = useState(0);
  const [battlePhase, setBattlePhase] = useState("intro");
  const [battleMsg, setBattleMsg] = useState("");
  const [floatingTexts, setFloatingTexts] = useState([]);
  const [impactText, setImpactText] = useState(null);
  const [screenShake, setScreenShake] = useState(false);
  const [battleTurn, setBattleTurn] = useState(0);

  // Co-op state
  const [coopScoreLeft, setCoopScoreLeft] = useState(0);
  const [coopScoreRight, setCoopScoreRight] = useState(0);
  const [coopRound, setCoopRound] = useState(0);
  const [coopProblemLeft, setCoopProblemLeft] = useState(null);
  const [coopProblemRight, setCoopProblemRight] = useState(null);
  const [coopVersus, setCoopVersus] = useState(false);
  const [coopRoundWinner, setCoopRoundWinner] = useState(null);

  const floatIdRef = useRef(0);

  // Adventure scene option shuffle — hoisted here so it obeys rules of hooks.
  // The original had the correct answer pinned to the top button because
  // SCENE_CHOICES lists the correct option first. Shuffling keyed to scene
  // identity keeps the order stable while the player reads.
  const currentSceneType = WORLDS[currentWorld]?.scenes?.[currentScene]?.type || "forest";
  const currentChoiceSet = SCENE_CHOICES[currentSceneType]
    ? SCENE_CHOICES[currentSceneType][currentScene % SCENE_CHOICES[currentSceneType].length]
    : null;
  const shuffledOptions = useMemo(() => {
    if (!currentChoiceSet?.options) return [];
    const copy = [...currentChoiceSet.options];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, [currentWorld, currentScene, currentSceneType]);

  const playerName = profile?.name || "Hero";
  const playerEmoji = profile?.emoji || "🦸";
  const playerColor = profile?.color || "#3b82f6";
  const kd = kidsData?.[playerName] || {};
  const currentPoints = kd.points || 0;

  // ─── Internal navigation ─────────────────────────────
  function localTransitionTo(newScreen) {
    setFadeIn(false);
    setTimeout(() => { setScreen(newScreen); setFadeIn(true); }, 300);
  }

  // ─── RPG helpers ─────────────────────────────────────
  function addItem(itemId) {
    if (ITEMS[itemId]) {
      setInventory(inv => [...inv, itemId]);
      if (itemId === "star") addStars(1);
    }
  }

  function takeDamage(amount) {
    const defense = inventory.filter(i => i === "shield").length + inventory.filter(i => i === "ring").length;
    const actual = Math.max(1, amount - defense);
    setHp(h => {
      const newHp = Math.max(0, h - actual);
      if (newHp <= 0) setTimeout(() => setScreen("game_over"), 800);
      return newHp;
    });
    setEmotion("hurt");
    setAvatarAnim("shake");
    setTimeout(() => { setEmotion("determined"); setAvatarAnim("bounce"); }, 1000);
    return actual;
  }

  function getAttackPower() {
    let base = 1;
    inventory.forEach(id => {
      const item = ITEMS[id];
      if (item && item.stat === "attack") base += item.value;
      if (item && item.stat === "all") base += item.value;
    });
    return base;
  }

  function canDodge() {
    return inventory.some(id => id === "boots") && Math.random() < 0.25;
  }

  function healFromPotions() {
    const potionIdx = inventory.indexOf("potion");
    if (potionIdx >= 0) {
      setInventory(inv => { const next = [...inv]; next.splice(potionIdx, 1); return next; });
      setHp(h => Math.min(MAX_HP, h + 2));
      return true;
    }
    return false;
  }

  function addFloatingText(text, color) {
    const id = ++floatIdRef.current;
    setFloatingTexts(ft => [...ft, { id, text, color }]);
    setTimeout(() => setFloatingTexts(ft => ft.filter(f => f.id !== id)), 1000);
  }

  function showImpact(text) {
    setImpactText(text);
    setTimeout(() => setImpactText(null), 800);
  }

  function triggerShake() {
    setScreenShake(true);
    setTimeout(() => setScreenShake(false), 400);
  }

  function startWorld(worldIdx) {
    setCurrentWorld(worldIdx);
    setCurrentScene(0);
    setChoiceResult(null);
    setEmotion("determined");
    setAvatarAnim("bounce");
    localTransitionTo("adventure");
  }

  function startBoss() {
    const world = WORLDS[currentWorld];
    const boss = world.boss;
    setBossHp(boss.hp);
    setBossMaxHp(boss.hp);
    setBattlePhase("intro");
    setBattleMsg(`${boss.emoji} ${boss.name} appears! "${boss.taunts[0]}"`);
    setBattleTurn(0);
    setEmotion("scared");
    setAvatarAnim("shake");
    localTransitionTo("battle");
    setTimeout(() => {
      setBattlePhase("player_turn");
      setEmotion("determined");
      setAvatarAnim("bounce");
      setBattleMsg("Your turn! Choose your action!");
    }, 2000);
  }

  function handleChoice(option) {
    if (option.correct) {
      setEmotion("happy");
      setAvatarAnim("jump");
      if (option.reward) addItem(option.reward);
      setChoiceResult({ correct: true, msg: option.msg, reward: option.reward });
      addFloatingText("+1 ⭐", "#fbbf24");
    } else {
      const dmg = takeDamage(1);
      setChoiceResult({ correct: false, msg: option.msg });
      addFloatingText(`-${dmg} HP`, "#ef4444");
    }
  }

  function nextScene() {
    const world = WORLDS[currentWorld];
    const nextIdx = currentScene + 1;
    setChoiceResult(null);
    if (nextIdx >= world.scenes.length) {
      startBoss();
    } else {
      setCurrentScene(nextIdx);
      setEmotion("determined");
      setAvatarAnim("bounce");
    }
  }

  function playerAttack() {
    if (battlePhase !== "player_turn") return;
    const power = getAttackPower();
    const damage = Math.min(power, bossHp);
    setBossHp(h => Math.max(0, h - damage));
    showImpact("SLASH!");
    addFloatingText(`-${damage}`, "#ef4444");
    triggerShake();
    setEmotion("determined");
    setAvatarAnim("jump");
    if (bossHp - damage <= 0) {
      setTimeout(() => {
        setBattlePhase("won");
        setBattleMsg("VICTORY! The boss is defeated!");
        setEmotion("victorious");
        setAvatarAnim("jump");
        addStars(5);
        addFloatingText("+5 ⭐", "#fbbf24");
        setWorldsCompleted(wc => [...wc, WORLDS[currentWorld].id]);
      }, 600);
    } else {
      setBattlePhase("boss_turn");
      setBattleMsg("Boss is attacking...");
      setTimeout(() => bossTurn(), 1200);
    }
  }

  function playerDefend() {
    if (battlePhase !== "player_turn") return;
    setBattlePhase("boss_turn");
    setBattleMsg("You brace yourself! Damage reduced!");
    setEmotion("determined");
    setTimeout(() => {
      const world = WORLDS[currentWorld];
      const boss = world.boss;
      const atkIdx = Math.min(battleTurn, boss.attacks.length - 1);
      const baseDmg = Math.ceil(world.difficulty / 2);
      if (canDodge()) {
        showImpact("DODGE!");
        addFloatingText("MISS!", "#22c55e");
        setBattleMsg("You dodged the attack!");
      } else {
        const reducedDmg = Math.max(1, baseDmg - 1);
        takeDamage(reducedDmg);
        showImpact(boss.attacks[atkIdx] + "!");
        addFloatingText(`-${reducedDmg}`, "#ef4444");
        triggerShake();
        setBattleMsg(`${boss.name} used ${boss.attacks[atkIdx]}! But your defense helped!`);
      }
      setBattleTurn(t => t + 1);
      setTimeout(() => {
        setBattlePhase("player_turn");
        setBattleMsg("Your turn! Choose your action!");
        setEmotion("determined");
        setAvatarAnim("bounce");
      }, 1200);
    }, 800);
  }

  function playerHeal() {
    if (battlePhase !== "player_turn") return;
    if (healFromPotions()) {
      addFloatingText("+2 HP", "#22c55e");
      showImpact("HEAL!");
      setBattleMsg("You used a Health Potion! +2 HP!");
      setEmotion("happy");
      setBattlePhase("boss_turn");
      setTimeout(() => bossTurn(), 1200);
    } else {
      setBattleMsg("No potions left! Choose another action.");
    }
  }

  function bossTurn() {
    const world = WORLDS[currentWorld];
    const boss = world.boss;
    const atkIdx = Math.min(battleTurn, boss.attacks.length - 1);
    const tauntIdx = Math.min(battleTurn + 1, boss.taunts.length - 1);
    const baseDmg = Math.ceil(world.difficulty * 0.8);
    if (canDodge()) {
      showImpact("DODGE!");
      addFloatingText("MISS!", "#22c55e");
      setBattleMsg(`${boss.name}: "${boss.taunts[tauntIdx]}" — but you dodged!`);
    } else {
      const dmg = takeDamage(baseDmg);
      showImpact(boss.attacks[atkIdx] + "!");
      addFloatingText(`-${dmg}`, "#ef4444");
      triggerShake();
      setBattleMsg(`${boss.name} used ${boss.attacks[atkIdx]}! "${boss.taunts[tauntIdx]}"`);
    }
    setBattleTurn(t => t + 1);
    setTimeout(() => {
      if (hp > 0) {
        setBattlePhase("player_turn");
        setBattleMsg("Your turn! Choose your action!");
        setEmotion("determined");
        setAvatarAnim("bounce");
      }
    }, 1200);
  }

  function retryWorld() {
    setHp(MAX_HP);
    setCurrentScene(0);
    setChoiceResult(null);
    setStarsEarned(0);
    setEmotion("determined");
    setAvatarAnim("bounce");
    localTransitionTo("adventure");
  }

  function backToMenu() {
    setHp(MAX_HP);
    setStarsEarned(0);
    setInventory([]);
    setChoiceResult(null);
    setEmotion("idle");
    setAvatarAnim("bounce");
    // Exit RPGCore entirely back to shell menu
    transitionTo("menu");
  }

  const fadeStyle = {
    animation: fadeIn ? "ll-fade-in 0.4s ease-out" : "none",
    opacity: fadeIn ? 1 : 0,
    transition: "opacity 0.3s",
  };
  const containerStyle = {
    position: "relative", minHeight: 500, borderRadius: 16, overflow: "hidden",
    overflowX: "hidden", maxWidth: "100vw", width: "100%", boxSizing: "border-box",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    ...fadeStyle,
  };

  // ─── Mini-game delegation ─────────────────────────────
  const gameProps = { profile, kidsData, fbSet, addStars, transitionTo: localTransitionTo, curriculum };
  if (screen === "fish") return <><style>{KEYFRAMES_CSS}</style><FishGame {...gameProps} /></>;
  if (screen === "racing") return <><style>{KEYFRAMES_CSS}</style><RacingGame {...gameProps} /></>;
  if (screen === "board") return <><style>{KEYFRAMES_CSS}</style><BoardGame {...gameProps} /></>;
  if (screen === "reading") return <><style>{KEYFRAMES_CSS}</style><ReadingGame {...gameProps} /></>;

  // ─── WORLD SELECT ─────────────────────────────────────
  if (screen === "world_select") {
    return (
      <>
        <style>{KEYFRAMES_CSS}</style>
        <div style={containerStyle}>
          <div style={{ position: "relative", minHeight: 500,
            background: "linear-gradient(180deg, #0f0c29, #302b63)", padding: 16 }}>
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <GameBtn color="#64748b" onClick={backToMenu} style={{ width: "auto", padding: "10px 16px" }}>← Back</GameBtn>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>Choose Your World</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {WORLDS.map((world, idx) => {
                  const locked = idx > worldsCompleted.length;
                  const beaten = worldsCompleted.includes(world.id);
                  return (
                    <button key={world.id} onClick={() => !locked && startWorld(idx)}
                      style={{
                        background: locked ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg, ${world.color}33, ${world.color}11)`,
                        border: `2px solid ${locked ? "rgba(255,255,255,0.1)" : world.color}`,
                        borderRadius: 14, padding: 16, display: "flex", alignItems: "center", gap: 14,
                        cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.4 : 1,
                        transition: "all 0.2s", width: "100%", textAlign: "left",
                      }}>
                      <div style={{ fontSize: 40 }}>{locked ? "🔒" : world.emoji}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
                          {world.name}{beaten && <span style={{ marginLeft: 8, fontSize: 14 }}>✅</span>}
                        </div>
                        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>Boss: {world.boss.emoji} {world.boss.name}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Difficulty: {"⭐".repeat(world.difficulty)}</div>
                      </div>
                      {!locked && !beaten && <div style={{ fontSize: 24, animation: "ll-bounce 1s ease-in-out infinite" }}>▶️</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── ADVENTURE SCENE ──────────────────────────────────
  if (screen === "adventure") {
    const world = WORLDS[currentWorld];
    const scene = world.scenes[currentScene];
    const sceneType = scene?.type || "forest";
    const choices = SCENE_CHOICES[sceneType];
    const choiceSet = choices ? choices[currentScene % choices.length] : null;
    // shuffledOptions is computed at the top of the component (rules of hooks)
    return (
      <>
        <style>{KEYFRAMES_CSS}</style>
        <div style={containerStyle}>
          <SceneBG type={sceneType} />
          {floatingTexts.map(ft => <FloatingText key={ft.id} text={ft.text} color={ft.color} />)}
          <div style={{ position: "relative", zIndex: 1, padding: 16, minHeight: 500, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div>
                <HPDisplay current={hp} max={MAX_HP} label={playerName} color={playerColor} />
                <InventoryBar inventory={inventory} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: "4px 10px", fontSize: 14, color: "#fbbf24", fontWeight: 700 }}>⭐ {starsEarned}</div>
                <GameBtn color="#64748b" onClick={backToMenu} style={{ width: "auto", padding: "6px 12px", minHeight: 36, fontSize: 14 }}>✕</GameBtn>
              </div>
            </div>
            <div style={{ background: "rgba(0,0,0,0.5)", borderRadius: 14, padding: 16, marginBottom: 12, backdropFilter: "blur(4px)" }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>{world.emoji} {world.name} — Scene {currentScene + 1}/{world.scenes.length}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 6 }}>{scene.title}</div>
              <div style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>{scene.desc}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <Avatar emoji={playerEmoji} emotion={emotion} anim={avatarAnim} size={56} profile={profile} />
            </div>
            {!choiceResult && choiceSet && (
              <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 12, textAlign: "center" }}>{choiceSet.prompt}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {shuffledOptions.map((opt, i) => (
                    <GameBtn key={i} color={["#3b82f6", "#8b5cf6", "#06b6d4"][i]} onClick={() => handleChoice(opt)}>{opt.text}</GameBtn>
                  ))}
                </div>
              </div>
            )}
            {choiceResult && (
              <div style={{ background: choiceResult.correct ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
                border: `2px solid ${choiceResult.correct ? "#22c55e" : "#ef4444"}`,
                borderRadius: 14, padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{choiceResult.correct ? "✅" : "💥"}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{choiceResult.correct ? "Great Choice!" : "Ouch!"}</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", marginBottom: 4 }}>{choiceResult.msg}</div>
                {choiceResult.reward && ITEMS[choiceResult.reward] && (
                  <div style={{ fontSize: 14, color: "#fbbf24", marginTop: 4 }}>Found: {ITEMS[choiceResult.reward].emoji} {ITEMS[choiceResult.reward].name}!</div>
                )}
                <div style={{ marginTop: 14 }}>
                  {hp > 0 ? (
                    <GameBtn color="#22c55e" big onClick={nextScene}>
                      {currentScene + 1 >= world.scenes.length ? "⚔️ Face the Boss!" : "➡️ Continue"}
                    </GameBtn>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ─── BOSS BATTLE ──────────────────────────────────────
  if (screen === "battle") {
    const world = WORLDS[currentWorld];
    const boss = world.boss;
    const hasPotions = inventory.includes("potion");
    return (
      <>
        <style>{KEYFRAMES_CSS}</style>
        <div style={containerStyle}>
          <BossArenaBG shake={screenShake} />
          {floatingTexts.map(ft => <FloatingText key={ft.id} text={ft.text} color={ft.color} />)}
          {impactText && <ImpactText text={impactText} />}
          <div style={{ position: "relative", zIndex: 1, padding: 16, minHeight: 500, display: "flex", flexDirection: "column" }}>
            <BossHPBar current={bossHp} max={bossMaxHp} emoji={boss.emoji} name={boss.name} color={boss.color} />
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 64, animation: bossHp > 0 ? "ll-pulse 2s ease-in-out infinite" : "ll-shake 0.5s ease-in-out",
                filter: bossHp <= 0 ? "grayscale(1)" : "none", transition: "filter 0.5s" }}>{boss.emoji}</div>
            </div>
            <div style={{ textAlign: "center", fontSize: 14, fontWeight: 900, color: "#fbbf24",
              textShadow: "0 0 10px #fbbf24", marginBottom: 4, letterSpacing: 4 }}>─── VS ───</div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
              <Avatar emoji={playerEmoji} emotion={emotion} anim={avatarAnim} size={52} profile={profile} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <HPDisplay current={hp} max={MAX_HP} label={playerName} color={playerColor} />
              <InventoryBar inventory={inventory} />
            </div>
            <div style={{ background: "rgba(0,0,0,0.6)", borderRadius: 12, padding: 14, marginBottom: 12,
              textAlign: "center", minHeight: 50, border: "1px solid rgba(255,255,255,0.15)" }}>
              <div style={{ fontSize: 15, color: "#fff", fontWeight: 600, lineHeight: 1.5 }}>{battleMsg}</div>
            </div>
            {battlePhase === "player_turn" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, animation: "ll-fade-in 0.3s ease-out" }}>
                <GameBtn color="#ef4444" big onClick={playerAttack}>⚔️ Attack! (Power: {getAttackPower()})</GameBtn>
                <div style={{ display: "flex", gap: 10 }}>
                  <GameBtn color="#3b82f6" onClick={playerDefend}>🛡️ Defend</GameBtn>
                  <GameBtn color="#22c55e" onClick={playerHeal} disabled={!hasPotions}>❤️ Heal {hasPotions ? "" : "(empty)"}</GameBtn>
                </div>
              </div>
            )}
            {battlePhase === "boss_turn" && (
              <div style={{ textAlign: "center", padding: 20 }}>
                <div style={{ fontSize: 40, animation: "ll-spin 1s linear infinite" }}>⏳</div>
              </div>
            )}
            {battlePhase === "won" && (
              <div style={{ textAlign: "center", animation: "ll-fade-in 0.5s ease-out" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🏆</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#fbbf24", textShadow: "0 0 15px #fbbf24", marginBottom: 8 }}>VICTORY!</div>
                <div style={{ fontSize: 15, color: "#fff", marginBottom: 4 }}>You defeated {boss.name}!</div>
                <div style={{ fontSize: 16, color: "#fbbf24", fontWeight: 700, marginBottom: 16 }}>+5 ⭐ Stars Earned!</div>
                <GameBtn color="#22c55e" big onClick={() => { addStars(3); localTransitionTo("victory"); }}>🎉 Celebrate! (+3 bonus stars)</GameBtn>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ─── VICTORY SCREEN ───────────────────────────────────
  if (screen === "victory") {
    const world = WORLDS[currentWorld];
    return (
      <>
        <style>{KEYFRAMES_CSS}</style>
        <div style={containerStyle}>
          <VictoryBG />
          <div style={{ position: "relative", zIndex: 1, padding: 20, minHeight: 500,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <div style={{ fontSize: 60, marginBottom: 8, animation: "ll-jump 1s ease-in-out infinite" }}>🏆</div>
            <Avatar emoji={playerEmoji} emotion="victorious" anim="jump" size={64} profile={profile} />
            <div style={{ fontSize: 28, fontWeight: 900, color: "#7c3aed", textShadow: "0 2px 0 rgba(0,0,0,0.1)", margin: "12px 0 4px" }}>WORLD COMPLETE!</div>
            <div style={{ fontSize: 18, color: "#4c1d95", fontWeight: 600, marginBottom: 6 }}>{world.emoji} {world.name} conquered!</div>
            <div style={{ fontSize: 16, color: "#6d28d9", marginBottom: 16 }}>{playerName} is a true LEGEND!</div>
            <div style={{ background: "rgba(255,255,255,0.7)", borderRadius: 16, padding: 16, marginBottom: 20, width: "100%", maxWidth: 280 }}>
              <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 4 }}>Stars earned this run</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: "#f59e0b" }}>⭐ {starsEarned}</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Total stars: {currentPoints}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 280 }}>
              {currentWorld + 1 < WORLDS.length && (
                <GameBtn color="#8b5cf6" big onClick={() => startWorld(currentWorld + 1)}>➡️ Next World!</GameBtn>
              )}
              <GameBtn color="#3b82f6" onClick={backToMenu}>🏠 Back to Menu</GameBtn>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── GAME OVER ────────────────────────────────────────
  if (screen === "game_over") {
    return (
      <>
        <style>{KEYFRAMES_CSS}</style>
        <div style={containerStyle}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #1a0000, #000)" }} />
          <div style={{ position: "relative", zIndex: 1, padding: 20, minHeight: 500,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <Avatar emoji={playerEmoji} emotion="hurt" anim="shake" size={64} profile={profile} />
            <div style={{ fontSize: 28, fontWeight: 900, color: "#ef4444", textShadow: "0 0 20px rgba(239,68,68,0.5)", margin: "16px 0 8px" }}>GAME OVER</div>
            <div style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>The adventure is not over yet!</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>You earned {starsEarned} ⭐ stars before falling.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 280 }}>
              <GameBtn color="#f59e0b" big onClick={retryWorld}>🔄 Try Again!</GameBtn>
              <GameBtn color="#64748b" onClick={backToMenu}>🏠 Back to Menu</GameBtn>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── STAR STORE ───────────────────────────────────────
  if (screen === "store") {
    const rewards = kd.rewards || DEFAULT_REWARDS;
    return (
      <>
        <style>{KEYFRAMES_CSS}</style>
        <div style={containerStyle}>
          <div style={{ position: "relative", minHeight: 500, background: "linear-gradient(180deg, #1e1b4b, #312e81, #1e1b4b)", padding: 16 }}>
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <GameBtn color="#64748b" onClick={backToMenu} style={{ width: "auto", padding: "10px 16px" }}>← Back</GameBtn>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>🏪 Star Store</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 14, padding: 16, textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Your Stars</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: "#fbbf24", animation: "ll-pulse 2s ease-in-out infinite" }}>⭐ {currentPoints}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {rewards.map((reward, i) => {
                  const canAfford = currentPoints >= reward.cost;
                  const needed = reward.cost - currentPoints;
                  return (
                    <div key={i} style={{ background: canAfford ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.08)",
                      border: `2px solid ${canAfford ? "#22c55e" : "rgba(255,255,255,0.15)"}`,
                      borderRadius: 14, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ fontSize: 32 }}>{reward.emoji || "🎁"}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{reward.name}</div>
                        <div style={{ fontSize: 13, color: "#fbbf24", fontWeight: 600, marginTop: 2 }}>⭐ {reward.cost} stars</div>
                        {!canAfford && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>You need {needed} more stars!</div>}
                      </div>
                      <div style={{ background: canAfford ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)",
                        borderRadius: 10, padding: "8px 12px", fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 600,
                        textAlign: "center", minWidth: 70 }}>
                        {canAfford ? "Ask parent\nto approve" : "🔒 Locked"}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                Earn stars by completing adventures and chores!
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── CHORES SCREEN ────────────────────────────────────
  if (screen === "chores") {
    const tasks = kd.tasks || [];
    const pendingTasks = tasks.filter(t => !t.done);
    const completedTasks = tasks.filter(t => t.done && !t.verified);
    const verifiedTasks = tasks.filter(t => t.done && t.verified);
    return (
      <>
        <style>{KEYFRAMES_CSS}</style>
        <div style={containerStyle}>
          <div style={{ position: "relative", minHeight: 500, background: "linear-gradient(180deg, #0c4a6e, #164e63, #0e3a4f)", padding: 16 }}>
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <GameBtn color="#64748b" onClick={backToMenu} style={{ width: "auto", padding: "10px 16px" }}>← Back</GameBtn>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>📋 My Chores</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 14, padding: 14, marginBottom: 16, textAlign: "center" }}>
                <div style={{ fontSize: 15, color: "#fbbf24", fontWeight: 700 }}>Complete chores to earn stars! ⭐</div>
              </div>
              {pendingTasks.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.6)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>To Do ({pendingTasks.length})</div>
                  {pendingTasks.map((task, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: 12, marginBottom: 8,
                      display: "flex", alignItems: "center", gap: 10, border: "1px solid rgba(255,255,255,0.1)" }}>
                      <div style={{ fontSize: 24 }}>⬜</div>
                      <div style={{ fontSize: 15, color: "#fff", fontWeight: 600 }}>{task.name || task.text || "Chore"}</div>
                    </div>
                  ))}
                </div>
              )}
              {completedTasks.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.6)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Waiting for Parent ({completedTasks.length})</div>
                  {completedTasks.map((task, i) => (
                    <div key={i} style={{ background: "rgba(251,191,36,0.1)", borderRadius: 10, padding: 12, marginBottom: 8,
                      display: "flex", alignItems: "center", gap: 10, border: "1px solid rgba(251,191,36,0.3)" }}>
                      <div style={{ fontSize: 24 }}>⏳</div>
                      <div>
                        <div style={{ fontSize: 15, color: "#fff", fontWeight: 600 }}>{task.name || task.text || "Chore"}</div>
                        <div style={{ fontSize: 12, color: "#fbbf24" }}>Waiting for parent to verify</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {verifiedTasks.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.6)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Completed! ({verifiedTasks.length})</div>
                  {verifiedTasks.map((task, i) => (
                    <div key={i} style={{ background: "rgba(34,197,94,0.1)", borderRadius: 10, padding: 12, marginBottom: 8,
                      display: "flex", alignItems: "center", gap: 10, border: "1px solid rgba(34,197,94,0.3)" }}>
                      <div style={{ fontSize: 24 }}>✅</div>
                      <div>
                        <div style={{ fontSize: 15, color: "#fff", fontWeight: 600 }}>{task.name || task.text || "Chore"}</div>
                        <div style={{ fontSize: 12, color: "#22c55e" }}>+1 ⭐ Earned!</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {tasks.length === 0 && (
                <div style={{ textAlign: "center", padding: 40 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                  <div style={{ fontSize: 18, color: "#fff", fontWeight: 700, marginBottom: 8 }}>No chores right now!</div>
                  <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>Go play some adventures and earn stars!</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── MINI GAMES MENU ──────────────────────────────────
  if (screen === "mini_games") {
    return (
      <>
        <style>{KEYFRAMES_CSS}</style>
        <div style={containerStyle}>
          <div style={{ minHeight:500, background:"linear-gradient(135deg, #1a1040, #0f2027, #203a43)", padding:20 }}>
            <div style={{ textAlign:"center", marginBottom:20 }}>
              <div style={{ fontSize:28, fontWeight:900, color:"#60a5fa", textShadow:"0 0 20px rgba(96,165,250,0.4)", marginBottom:4 }}>🎮 MINI GAMES</div>
              <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)" }}>Learn while you play!</div>
              <Avatar emoji={playerEmoji} emotion="happy" anim="bounce" size={50} profile={profile} />
              <div style={{ fontSize:14, color:"#fbbf24", marginTop:4 }}>⭐ {currentPoints} Total Stars</div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, maxWidth:400, margin:"0 auto" }}>
              {[
                { emoji:"🐟", name:"Fish Eater", desc:"Eat fish & grow!", bg:"linear-gradient(135deg, #0369a1, #22d3ee)", screen:"fish" },
                { emoji:"🏎️", name:"Racing", desc:"Dodge & drive!", bg:"linear-gradient(135deg, #dc2626, #f97316)", screen:"racing" },
                { emoji:"🎲", name:"Board Game", desc:"Play together!", bg:"linear-gradient(135deg, #7c3aed, #a855f7)", screen:"board" },
                { emoji:"📖", name:"Reading", desc:"Complete stories!", bg:"linear-gradient(135deg, #059669, #34d399)", screen:"reading" },
              ].map((g, i) => (
                <div key={i} onClick={() => localTransitionTo(g.screen)}
                  style={{ background:g.bg, borderRadius:16, padding:20, textAlign:"center", cursor:"pointer", minHeight:120 }}>
                  <div style={{ fontSize:48 }}>{g.emoji}</div>
                  <div style={{ fontSize:17, fontWeight:700, color:"#fff", marginTop:8 }}>{g.name}</div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.7)" }}>{g.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:16, maxWidth:340, margin:"16px auto 0", display:"flex", flexDirection:"column", gap:8 }}>
              <GameBtn color="#f59e0b" onClick={() => { setCoopScoreLeft(0); setCoopScoreRight(0); setCoopRound(0); setCoopVersus(false); setCoopProblemLeft(null); setCoopProblemRight(null); localTransitionTo("coop"); }}>
                👫 Play Together (Co-op)
              </GameBtn>
              <GameBtn color="#ef4444" onClick={() => { setCoopScoreLeft(0); setCoopScoreRight(0); setCoopRound(0); setCoopVersus(true); setCoopProblemLeft(null); setCoopProblemRight(null); localTransitionTo("coop"); }}>
                🏆 Play Against Each Other
              </GameBtn>
            </div>
            <div style={{ marginTop:12, textAlign:"center" }}>
              <GameBtn color="#475569" onClick={backToMenu}>← Back to Menu</GameBtn>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── CO-OP / VERSUS MODE ──────────────────────────────
  if (screen === "coop") {
    const maxRounds = 10;
    const coopDone = coopRound >= maxRounds;

    // Generate problems for new round
    function generateMathProblemLocal(difficulty) {
      let a, b, op, answer, question;
      if (difficulty === 'easy') {
        op = Math.random() > 0.5 ? '+' : '-';
        a = Math.floor(Math.random() * 9) + 1;
        b = Math.floor(Math.random() * (op === '-' ? a : 9)) + 1;
        answer = op === '+' ? a + b : a - b;
        question = `${a} ${op} ${b}`;
      } else {
        if (Math.random() > 0.5) {
          a = Math.floor(Math.random() * 10) + 2; b = Math.floor(Math.random() * 10) + 2;
          answer = a * b; question = `${a} × ${b}`;
        } else {
          b = Math.floor(Math.random() * 9) + 2; answer = Math.floor(Math.random() * 10) + 1;
          a = answer * b; question = `${a} ÷ ${b}`;
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

    if (!coopProblemLeft && !coopDone) {
      setCoopProblemLeft(generateMathProblemLocal('hard'));
      setCoopProblemRight(generateMathProblemLocal('easy'));
      setCoopRoundWinner(null);
    }

    const handleCoopAnswer = (side, correct) => {
      if (!correct) return;
      if (coopVersus) {
        if (side === "left") { setCoopScoreLeft(s => s + 2); setCoopScoreRight(s => s + 1); setCoopRoundWinner("left"); }
        else { setCoopScoreRight(s => s + 2); setCoopScoreLeft(s => s + 1); setCoopRoundWinner("right"); }
      } else {
        if (side === "left") setCoopScoreLeft(s => s + 2);
        else setCoopScoreRight(s => s + 2);
      }
      setTimeout(() => {
        setCoopRound(r => r + 1); setCoopProblemLeft(null); setCoopProblemRight(null); setCoopRoundWinner(null);
      }, coopVersus ? 800 : 400);
    };

    const vsWinner = coopScoreLeft > coopScoreRight ? "Yana" : coopScoreRight > coopScoreLeft ? "Luca" : "TIE";
    return (
      <>
        <style>{KEYFRAMES_CSS}</style>
        <div style={containerStyle}>
          <div style={{ minHeight:500, background: coopVersus ? "linear-gradient(135deg, #2d0a0a, #1a0a2e)" : "linear-gradient(135deg, #1e1040, #0f2027)", padding:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <GameBtn color="#475569" onClick={() => localTransitionTo("mini_games")}>← Back</GameBtn>
              <div style={{ color:"#fbbf24", fontWeight:700 }}>
                {coopVersus ? "🏆 VERSUS" : "👫 CO-OP"} | Round {Math.min(coopRound+1, maxRounds)}/{maxRounds}
              </div>
            </div>
            <div style={{ textAlign:"center", marginBottom:12 }}>
              {coopVersus ? (
                <div style={{ fontSize:18, fontWeight:800, color:"#fff" }}>
                  <span style={{ color:"#c084fc" }}>Yana: {coopScoreLeft}</span>
                  <span style={{ color:"#fbbf24", margin:"0 10px" }}>VS</span>
                  <span style={{ color:"#22d3ee" }}>Luca: {coopScoreRight}</span>
                </div>
              ) : (
                <div style={{ fontSize:20, fontWeight:800, color:"#fbbf24" }}>👫 TEAM: {coopScoreLeft + coopScoreRight}</div>
              )}
              {coopRoundWinner && coopVersus && (
                <div style={{ fontSize:16, color: coopRoundWinner === "left" ? "#c084fc" : "#22d3ee", fontWeight:700, marginTop:4, animation:"ll-pulse 0.5s ease" }}>
                  {coopRoundWinner === "left" ? "Yana wins this round!" : "Luca wins this round!"}
                </div>
              )}
            </div>
            {!coopDone && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 4px 1fr", gap:0 }}>
                <div style={{ padding:8, textAlign:"center" }}>
                  <div style={{ fontSize:14, fontWeight:700, color:"#c084fc", marginBottom:8 }}>Yana ⭐{coopScoreLeft}</div>
                  {coopProblemLeft && !coopRoundWinner && (
                    <div>
                      <div style={{ fontSize:20, fontWeight:800, color:"#fff", marginBottom:8 }}>{coopProblemLeft.question} = ?</div>
                      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                        {coopProblemLeft.choices.map((c, i) => (
                          <button key={i} onClick={() => handleCoopAnswer("left", c === coopProblemLeft.answer)}
                            style={{ minHeight:48, fontSize:18, fontWeight:700, background:"rgba(192,132,252,0.3)",
                              color:"#fff", border:"2px solid #c084fc", borderRadius:10, cursor:"pointer" }}>{c}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ background: coopVersus ? "#ef4444" : "#fbbf24", borderRadius:2 }} />
                <div style={{ padding:8, textAlign:"center" }}>
                  <div style={{ fontSize:14, fontWeight:700, color:"#22d3ee", marginBottom:8 }}>Luca ⭐{coopScoreRight}</div>
                  {coopProblemRight && !coopRoundWinner && (
                    <div>
                      <div style={{ fontSize:20, fontWeight:800, color:"#fff", marginBottom:8 }}>{coopProblemRight.question} = ?</div>
                      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                        {coopProblemRight.choices.map((c, i) => (
                          <button key={i} onClick={() => handleCoopAnswer("right", c === coopProblemRight.answer)}
                            style={{ minHeight:48, fontSize:18, fontWeight:700, background:"rgba(34,211,238,0.3)",
                              color:"#fff", border:"2px solid #22d3ee", borderRadius:10, cursor:"pointer" }}>{c}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {coopDone && (
              <div style={{ textAlign:"center", marginTop:20 }}>
                {coopVersus ? (
                  <>
                    <div style={{ fontSize:32, fontWeight:900, color:"#fbbf24" }}>🏆 {vsWinner === "TIE" ? "IT'S A TIE!" : `${vsWinner.toUpperCase()} WINS!`}</div>
                    <div style={{ fontSize:16, color:"#fff", marginTop:8 }}>Yana: {coopScoreLeft} | Luca: {coopScoreRight}</div>
                    <div style={{ display:"flex", gap:8, justifyContent:"center", marginTop:16 }}>
                      <GameBtn color="#ef4444" onClick={() => { setCoopScoreLeft(0); setCoopScoreRight(0); setCoopRound(0); setCoopProblemLeft(null); setCoopProblemRight(null); setCoopRoundWinner(null); }}>🔥 REMATCH!</GameBtn>
                      <GameBtn color="#475569" onClick={() => localTransitionTo("mini_games")}>Done</GameBtn>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize:28, fontWeight:800, color:"#fbbf24" }}>👫 TEAMWORK!</div>
                    <div style={{ fontSize:20, color:"#fff", marginTop:8 }}>Team Score: {coopScoreLeft + coopScoreRight}</div>
                    <div style={{ fontSize:14, color:"#c084fc", marginTop:4 }}>⭐ {Math.round((coopScoreLeft + coopScoreRight) / 5)} stars EACH!</div>
                    <GameBtn color="#22c55e" onClick={() => { addStars(Math.round((coopScoreLeft + coopScoreRight) / 5)); localTransitionTo("mini_games"); }}>Collect Stars!</GameBtn>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ─── FALLBACK ─────────────────────────────────────────
  return (
    <>
      <style>{KEYFRAMES_CSS}</style>
      <div style={containerStyle}>
        <div style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 18, color: "#fff" }}>Loading...</div>
          <GameBtn color="#3b82f6" onClick={backToMenu}>Back to Menu</GameBtn>
        </div>
      </div>
    </>
  );
}
