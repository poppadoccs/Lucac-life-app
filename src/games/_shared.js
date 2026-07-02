// ─── SHARED GAME UTILITIES ───────────────────────────────────────────────────
// Created in B0 serial pre-pass. Each game CC (B1-B4) imports from here and
// removes its local duplicate. Do NOT import here from any game file.

import React from "react";
import { cacheGet, cacheSet } from "../utils";

// ─── MATH PROBLEM GENERATOR ──────────────────────────────────────────────────
// subject parameter added for EDU-01 learning engine hookup (Wave C).
// Supported subjects: "arithmetic" (default), "multiplication", "division",
//   "fractions" (placeholder — returns arithmetic until C1 wires EDU subjects)
//
// ⚠️ S04 SAFETY NOTE: The "fractions" branch returns arithmetic, NOT real
// fraction problems. FractionLine generates its own problems from FRACTION_SETS
// and never calls this function with subject="fractions". Do NOT call
// generateMathProblem(_, "fractions") expecting real fraction content.
// S04: subjects this generator actually knows how to make problems for.
// Anything else (decimals, fractions-equiv, coordinate-plane, etc.) — the
// catalog can grow ahead of the generators. Silent fallback to arithmetic
// keeps games playable while the extended subjects wait for real generators.
const SUPPORTED_SUBJECTS = new Set(["arithmetic", "multiplication", "division"]);

// S07 / C1: difficulty finally drives operand scale. "extreme" produces
// estimation-scale problems per the approved design intent ("they should know
// the difference in 16×27 and 43×19" — CC 3.NBT.3): operands 11-99 make exact
// mental computation impractical, so smart estimation is the winning strategy.
const OPERAND_RANGES = {
  easy: [2, 5],
  medium: [2, 10],
  hard: [2, 12],
  extreme: [11, 99],
};
const randIn = ([lo, hi]) => lo + Math.floor(Math.random() * (hi - lo + 1));

export function generateMathProblem(difficulty = "easy", subject = "arithmetic") {
  if (!SUPPORTED_SUBJECTS.has(subject)) subject = "arithmetic";
  const range = OPERAND_RANGES[difficulty] || OPERAND_RANGES.easy;
  let a, b, op, answer, question;

  if (subject === "multiplication" || (subject === "arithmetic" && (difficulty === "hard" || difficulty === "extreme") && Math.random() > 0.5)) {
    a = randIn(range);
    b = randIn(range);
    answer = a * b;
    question = `${a} × ${b}`;
  } else if (subject === "division" || (subject === "arithmetic" && (difficulty === "hard" || difficulty === "extreme"))) {
    b = randIn(range);
    answer = randIn(range);
    a = answer * b;
    question = `${a} ÷ ${b}`;
  } else {
    // Arithmetic: addition / subtraction (easy 1-9, medium 1-20)
    const addMax = difficulty === "medium" ? 20 : 9;
    op = Math.random() > 0.5 ? "+" : "-";
    a = Math.floor(Math.random() * addMax) + 1;
    b = Math.floor(Math.random() * (op === "-" ? a : addMax)) + 1;
    answer = op === "+" ? a + b : a - b;
    question = `${a} ${op} ${b}`;
  }

  // Build 3 choices: 1 correct + 2 plausible wrong answers.
  // Extreme distractors are ±15-40% of the answer — at that magnitude, ±1-3
  // would force exact computation to discriminate, defeating the estimation
  // design. Magnitude-spread choices reward number sense.
  const choices = [answer];
  while (choices.length < 3) {
    const delta = difficulty === "extreme"
      ? Math.max(2, Math.round(answer * (0.15 + Math.random() * 0.25)))
      : Math.floor(Math.random() * 3) + 1;
    const wrong = answer + (Math.random() > 0.5 ? 1 : -1) * delta;
    if (wrong > 0 && !choices.includes(wrong)) choices.push(wrong);
  }
  // Fisher-Yates shuffle
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }

  return { question, answer, choices };
}

// ─── FACT CHOICES (S07 per-fact retrieval engine) ────────────────────────────
// Answer options for a specific multiplication fact a×b. Wrong answers come
// from REAL error patterns — off-by-one-operand products, a+b confusion,
// ±10 slips — because plausible distractors drive the testing effect
// (Little & Bjork 2015); ±1-3 noise trains "pick the nearest number" instead
// of retrieval. count = total options including the correct one.
export function factChoices(a, b, count = 4) {
  const answer = a * b;
  const wrongPool = [
    (a + 1) * b, (a - 1) * b, a * (b + 1), a * (b - 1),
    a + b, answer + 10, answer - 10,
  ].filter(w => w > 0 && w !== answer);
  const wrongs = [...new Set(wrongPool)];
  // Fisher-Yates the pool, take what we need, pad with ±delta if pool is thin
  for (let i = wrongs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [wrongs[i], wrongs[j]] = [wrongs[j], wrongs[i]];
  }
  const choices = [answer, ...wrongs.slice(0, count - 1)];
  while (choices.length < count) {
    const wrong = answer + (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 5) + 2);
    if (wrong > 0 && !choices.includes(wrong)) choices.push(wrong);
  }
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { question: `${a} × ${b}`, answer, choices };
}

// ─── PERSONAL BEST (S07 juice layer) ─────────────────────────────────────────
// Self-competition only: renders ONLY the current kid's own best, never a
// sibling's (mastery-approach feedback sustains motivation where normative
// comparison corrodes it — Elliot & McGregor 2001). localStorage = offline-
// safe, per-device, no Firebase schema change. The FIRST-ever score sets the
// baseline silently — a record needs something to beat.
export function checkPersonalBest(kidName, game, score) {
  if (!kidName || typeof score !== "number" || Number.isNaN(score)) {
    return { isNewBest: false, prevBest: null, best: score };
  }
  const key = `best_${game}_${kidName}`;
  const prev = cacheGet(key);
  if (prev == null || score > prev) {
    cacheSet(key, score);
    return { isNewBest: prev != null, prevBest: prev, best: score };
  }
  return { isNewBest: false, prevBest: prev, best: prev };
}

// ─── GAME BUTTON ─────────────────────────────────────────────────────────────
// Shared styled button used by all 4 mini-games. Each B1-B4 CC replaces its
// local GameBtn with this import.
export function GameBtn({ children, onClick, color, disabled, big, style: extra }) {
  const bg = disabled ? "#555" : (color || "#3b82f6");
  return React.createElement("button", {
    onClick: disabled ? undefined : onClick,
    style: {
      background: bg, color: "#fff", border: "none", borderRadius: 12,
      padding: big ? "16px 24px" : "12px 18px", fontSize: big ? 20 : 16,
      fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
      minHeight: 48, minWidth: 48, textAlign: "center",
      boxShadow: disabled ? "none" : `0 4px 12px ${bg}66`,
      opacity: disabled ? 0.5 : 1, transition: "all 0.2s", width: "100%",
      ...extra,
    },
  }, children);
}

// ─── RECORD GAME HISTORY ──────────────────────────────────────────────────────
// Uniform Firebase write for all game completions.
// Path: gameHistory/{profile.name}/{timestamp}
// extra: any game-specific fields (e.g. { level, bossesDefeated, track, car })
export function recordGameHistory(fbSet, profile, game, score, stars, extra = {}) {
  if (!fbSet || !profile?.name) return;
  fbSet(`gameHistory/${profile.name}/${Date.now()}`, {
    game,
    score,
    stars,
    timestamp: new Date().toISOString(),
    profile: profile.name,
    ...extra,
  });
}

// ─── AGE BAND FROM PROFILE ───────────────────────────────────────────────────
// Maps profile to an age band used for difficulty splitting (GAME-06).
// Returns: "luca" (youngest / easiest), "yana" (middle), "other" (unknown/adult)
//
// S04: prefers the explicit `profile.ageBand` field ("early"|"standard") set by
// parents in Settings — name-matching is a fallback. Rename a kid profile and
// difficulty no longer breaks silently. Return values are preserved for
// backward compatibility with games that check `ageBand === "luca"`.
export function ageBandFromProfile(profile) {
  if (!profile) return "other";
  // Prefer explicit ageBand (set by parent in Settings → Learning)
  if (profile.ageBand === "early") return "luca";
  if (profile.ageBand === "standard") return "yana";
  // Legacy fallback: name match
  if (!profile.name) return "other";
  const name = profile.name.toLowerCase();
  if (name === "luca") return "luca";
  if (name === "yana") return "yana";
  return "other";
}

// ─── IS EARLY LEARNER ────────────────────────────────────────────────────────
// Preferred going forward. Explicit boolean check that doesn't leak legacy
// "luca"/"yana" strings into game logic. Drives UI ergonomics (tap target
// size, font size, simpler UI) — NOT math difficulty. Math difficulty comes
// from kidsData/{name}/difficulty/{subjectId} via getKidDifficulty in utils.
export function isEarlyLearner(profile) {
  if (!profile) return false;
  if (profile.ageBand === "early") return true;
  if (profile.ageBand === "standard") return false;
  // Legacy fallback: name match
  return (profile?.name || "").toLowerCase() === "luca";
}
