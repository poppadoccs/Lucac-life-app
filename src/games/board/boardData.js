// ─── BOARD TILE DEFINITIONS ───────────────────────────────────────────────────
// 24 tiles in a clockwise rectangular loop.
// Types: "start" | "free" | "potion" | "trap" | "bonus" | "jail" | "math"

export const BOARD_TILES = [
  { type: "start",  label: "GO",     emoji: "🏁", color: "#fbbf24" }, //  0
  { type: "free",   label: "Lucky",  emoji: "🍀", color: "#22c55e" }, //  1
  { type: "potion", label: "Brew!",  emoji: "🧪", color: "#a855f7" }, //  2
  { type: "trap",   label: "Trap!",  emoji: "🕳️", color: "#ef4444" }, //  3
  { type: "math",   label: "Math!",  emoji: "🔢", color: "#3b82f6" }, //  4
  { type: "bonus",  label: "+5★",    emoji: "⭐", color: "#f59e0b" }, //  5
  { type: "potion", label: "Brew!",  emoji: "🧪", color: "#a855f7" }, //  6
  { type: "jail",   label: "Jail",   emoji: "🔒", color: "#64748b" }, //  7
  { type: "math",   label: "Math!",  emoji: "🔢", color: "#3b82f6" }, //  8
  { type: "trap",   label: "Trap!",  emoji: "🕳️", color: "#ef4444" }, //  9
  { type: "potion", label: "Brew!",  emoji: "🧪", color: "#a855f7" }, // 10
  { type: "bonus",  label: "+5★",    emoji: "⭐", color: "#f59e0b" }, // 11
  { type: "math",   label: "Math!",  emoji: "🔢", color: "#3b82f6" }, // 12
  { type: "free",   label: "Rest",   emoji: "😴", color: "#22c55e" }, // 13
  { type: "potion", label: "Brew!",  emoji: "🧪", color: "#a855f7" }, // 14
  { type: "trap",   label: "Trap!",  emoji: "🕳️", color: "#ef4444" }, // 15
  { type: "jail",   label: "Jail",   emoji: "🔒", color: "#64748b" }, // 16
  { type: "bonus",  label: "+5★",    emoji: "⭐", color: "#f59e0b" }, // 17
  { type: "potion", label: "Brew!",  emoji: "🧪", color: "#a855f7" }, // 18
  { type: "free",   label: "Free",   emoji: "🌟", color: "#22c55e" }, // 19
  { type: "math",   label: "Math!",  emoji: "🔢", color: "#3b82f6" }, // 20
  { type: "trap",   label: "Trap!",  emoji: "🕳️", color: "#ef4444" }, // 21
  { type: "potion", label: "Brew!",  emoji: "🧪", color: "#a855f7" }, // 22
  { type: "bonus",  label: "+5★",    emoji: "⭐", color: "#f59e0b" }, // 23
];

// ─── GRID POSITIONS ────────────────────────────────────────────────────────────
// Board is rendered as an 8-col × 6-row CSS grid.
// Tiles occupy the perimeter only; the 6×4 center area is the info panel.
//
// Clockwise from top-left:
//   Top row    (tiles  0–7 ): row 1, cols 1–8  (left→right)
//   Right col  (tiles  8–11): rows 2–5, col 8  (top→bottom)
//   Bottom row (tiles 12–19): row 6, cols 8–1  (right→left)
//   Left col   (tiles 20–23): rows 5–2, col 1  (bottom→top)
//
// Total: 8 + 4 + 8 + 4 = 24 tiles.
export const TILE_POSITIONS = (() => {
  const pos = [];
  for (let i = 0; i <= 7; i++) pos.push({ r: 1, c: i + 1 });   // top row
  for (let i = 0; i <= 3; i++) pos.push({ r: i + 2, c: 8 });   // right col
  for (let i = 0; i <= 7; i++) pos.push({ r: 6, c: 8 - i });   // bottom row (R→L)
  for (let i = 0; i <= 3; i++) pos.push({ r: 5 - i, c: 1 });   // left col (B→T)
  return pos;
})();
