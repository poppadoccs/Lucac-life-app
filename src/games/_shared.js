// ─── SHARED GAME UTILITIES ───────────────────────────────────────────────────
// Created in B0 serial pre-pass. Each game CC (B1-B4) imports from here and
// removes its local duplicate. Do NOT import here from any game file.

import React from "react";

// ─── MATH PROBLEM GENERATOR ──────────────────────────────────────────────────
// subject parameter added for EDU-01 learning engine hookup (Wave C).
// Supported subjects: "arithmetic" (default), "multiplication", "division",
//   "fractions" (placeholder — returns arithmetic until C1 wires EDU subjects)
//
// ⚠️ S04 SAFETY NOTE: The "fractions" branch returns arithmetic, NOT real
// fraction problems. FractionLine generates its own problems from FRACTION_SETS
// and never calls this function with subject="fractions". Do NOT call
// generateMathProblem(_, "fractions") expecting real fraction content.
export function generateMathProblem(difficulty = "easy", subject = "arithmetic") {
  let a, b, op, answer, question;

  if (subject === "multiplication" || (subject === "arithmetic" && difficulty === "hard" && Math.random() > 0.5)) {
    a = Math.floor(Math.random() * 10) + 2;
    b = Math.floor(Math.random() * 10) + 2;
    answer = a * b;
    question = `${a} × ${b}`;
  } else if (subject === "division" || (subject === "arithmetic" && difficulty === "hard")) {
    b = Math.floor(Math.random() * 9) + 2;
    answer = Math.floor(Math.random() * 10) + 1;
    a = answer * b;
    question = `${a} ÷ ${b}`;
  } else {
    // Easy arithmetic: addition / subtraction
    op = Math.random() > 0.5 ? "+" : "-";
    a = Math.floor(Math.random() * 9) + 1;
    b = Math.floor(Math.random() * (op === "-" ? a : 9)) + 1;
    answer = op === "+" ? a + b : a - b;
    question = `${a} ${op} ${b}`;
  }

  // Build 3 choices: 1 correct + 2 plausible wrong answers
  const choices = [answer];
  while (choices.length < 3) {
    const wrong = answer + (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 3) + 1);
    if (wrong > 0 && !choices.includes(wrong)) choices.push(wrong);
  }
  // Fisher-Yates shuffle
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }

  return { question, answer, choices };
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
// C1 may extend this with birthday-based logic; names are the reliable signal now.
export function ageBandFromProfile(profile) {
  if (!profile?.name) return "other";
  const name = profile.name.toLowerCase();
  if (name === "luca") return "luca";
  if (name === "yana") return "yana";
  return "other";
}
