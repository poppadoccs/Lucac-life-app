// ─── SHARED POWER-UP EFFECT POOLS ────────────────────────────────────────────
// Lifted from FractionLine.jsx (commits 7ea33fb + eb74959) so other games can
// reuse the buff/debuff catalog without copy-pasting the 16-effect array.
//
// Each game owns its own effect *application* logic — Magnet/Reverse are
// FractionLine-drag-modal specific and a noop in games without dragging.
// ReadingGame's application set is: heart, starSurge, invincible, slowTime
// (buffs); loseHeart, frenzy, thunder, blind, freeze (debuffs).

export const BUFF_TYPES = [
  { type: "heart",      name: "❤️ +1 Heart",     duration: 0     },
  { type: "starSurge",  name: "⭐⭐ Star Surge",  duration: 7000  },
  { type: "invincible", name: "⚡ Invincible",    duration: 7000  },
  { type: "slowTime",   name: "🐢 Slow Time",    duration: 7000  },
  { type: "magnet",     name: "🧲 Magnet",       duration: 7000  },
];

export const DEBUFF_TYPES = [
  { type: "loseHeart",  name: "💀 -1 Heart",     duration: 0     },
  { type: "frenzy",     name: "💨 Frenzy",       duration: 7000  },
  { type: "thunder",    name: "⛈️ Thunder",      duration: 7000  },
  { type: "blind",      name: "🌫️ Blind",       duration: 7000  },
  { type: "reverse",    name: "🔄 Reverse",      duration: 5000  },
  { type: "freeze",     name: "❄️ Freeze",       duration: 3000  },
];

export const POWERUP_NOTICE_MS = 2200;
export const DROP_FALL_DURATION_MS = 7000;

// Pure math-expression generator. Returns [expressionText, numericValue].
// Lifted verbatim from FractionLine.jsx:72-76.
export function generateMathExpr() {
  const a = 1 + Math.floor(Math.random() * 9);
  const b = 1 + Math.floor(Math.random() * 9);
  return [`${a} + ${b}`, a + b];
}

// Generate a pair of drops with DIFFERENT values (always a clear winner).
// Lifted from FractionLine.jsx:79-94. Caller decides leftPct / placement.
export function spawnDropPair() {
  const [exprA, valA] = generateMathExpr();
  let [exprB, valB] = generateMathExpr();
  let attempts = 0;
  while (valB === valA && attempts < 8) {
    [exprB, valB] = generateMathExpr();
    attempts++;
  }
  if (valB === valA) valB = valA + 1; // emergency tiebreak
  const winnerIsA = valA > valB;
  const baseId = Date.now();
  return [
    { id: baseId,     expr: exprA, value: valA, isWinner: winnerIsA,  leftPct: 22 },
    { id: baseId + 1, expr: exprB, value: valB, isWinner: !winnerIsA, leftPct: 78 },
  ];
}
