// ─── LEARNING ENGINE (EDU-01) ────────────────────────────────────────────────
// Adaptive learning utilities for Yana (3rd, struggling) and Luca (K, gifted).
// Pure functions (data-in → data-out) except recordAttempt (Firebase write)
// and getELI5 (AI network call).
//
// Subject catalog is grounded in docs/curriculum-standards.md — CC codes for
// math, Scarborough's Rope + SoR scope-and-sequence for reading. When adding
// a subject, cite a primary source in the `notes` field. Never let an LLM
// hallucinate grade assignments (CLAUDE.md Lessons Learned 2026-04-07 rule).

import { callAI } from "./utils";
import { generateMathProblem } from "./games/_shared";

// Schema per subject:
//   id             — stable string key, referenced in Firebase paths
//   label          — human-readable display
//   strand         — "math" | "reading"
//   gradeIntroduced — earliest grade typically introduced (K=0 … 5)
//   gradeMastered  — typical mastery grade (K=0 … 5)
//   prerequisites  — subject ids that should be solid first
//   testedOn       — state tests that assess this topic (text badges, no color)
//   gameMechanic   — "quickfire" | "fraction-line" | "finger-swipe" | "placeholder"
//                    Dictates which game shell renders this subject's problems.
//                    "placeholder" means the catalog has the subject but no
//                    real generator exists yet — games fall back to arithmetic.
//   notes          — primary source citation (CC code or SoR paper)
export const LEARNING_SUBJECTS = [
  // ─── Math K-2 foundations ─────────────────────────────────────────────
  { id: "addition", label: "Addition", strand: "math",
    gradeIntroduced: 0, gradeMastered: 2,
    prerequisites: [], testedOn: ["STAAR","CAASPP","NextGen","B.E.S.T."],
    gameMechanic: "quickfire", notes: "CC K.OA, 1.OA, 2.OA.2" },
  { id: "subtraction", label: "Subtraction", strand: "math",
    gradeIntroduced: 0, gradeMastered: 2,
    prerequisites: ["addition"], testedOn: ["STAAR","CAASPP","NextGen","B.E.S.T."],
    gameMechanic: "quickfire", notes: "CC K.OA, 1.OA, 2.OA.2" },
  { id: "time", label: "Telling Time", strand: "math",
    gradeIntroduced: 1, gradeMastered: 3,
    prerequisites: [], testedOn: ["STAAR","CAASPP"],
    gameMechanic: "placeholder", notes: "CC 1.MD.3, 3.MD.1" },
  { id: "money", label: "Money Math", strand: "math",
    gradeIntroduced: 2, gradeMastered: 4,
    prerequisites: ["addition"], testedOn: ["STAAR","CAASPP"],
    gameMechanic: "placeholder", notes: "CC 2.MD.8" },

  // ─── Math grade 3 focus (Yana's year) ─────────────────────────────────
  { id: "multiplication", label: "Multiplication", strand: "math",
    gradeIntroduced: 2, gradeMastered: 3,
    prerequisites: ["addition"], testedOn: ["STAAR","CAASPP","NextGen","B.E.S.T."],
    gameMechanic: "quickfire",
    notes: "CC 3.OA.7 — know products of 2 one-digit numbers from memory by end of grade 3" },
  { id: "division", label: "Division", strand: "math",
    gradeIntroduced: 3, gradeMastered: 4,
    prerequisites: ["multiplication"], testedOn: ["STAAR","CAASPP","NextGen","B.E.S.T."],
    gameMechanic: "quickfire", notes: "CC 3.OA.6" },
  { id: "fractions", label: "Fractions (Intro)", strand: "math",
    gradeIntroduced: 3, gradeMastered: 3,
    prerequisites: ["division"], testedOn: ["STAAR","CAASPP","NextGen","B.E.S.T."],
    gameMechanic: "fraction-line", notes: "CC 3.NF.1-3 (denominators 2,3,4,6,8)" },
  { id: "area", label: "Area & Perimeter", strand: "math",
    gradeIntroduced: 3, gradeMastered: 5,
    prerequisites: ["multiplication"], testedOn: ["STAAR","CAASPP","NextGen","B.E.S.T."],
    gameMechanic: "placeholder", notes: "CC 3.MD.7-8" },

  // ─── Math grade 4 ─────────────────────────────────────────────────────
  { id: "fractions-equiv", label: "Equivalent Fractions", strand: "math",
    gradeIntroduced: 4, gradeMastered: 4,
    prerequisites: ["fractions"], testedOn: ["STAAR","CAASPP","NextGen","B.E.S.T."],
    gameMechanic: "fraction-line", notes: "CC 4.NF.1" },
  { id: "fractions-ops", label: "Fraction Add/Subtract", strand: "math",
    gradeIntroduced: 4, gradeMastered: 5,
    prerequisites: ["fractions-equiv"], testedOn: ["STAAR","CAASPP","NextGen","B.E.S.T."],
    gameMechanic: "placeholder", notes: "CC 4.NF.3, 5.NF.1 (same then unlike denominators)" },
  { id: "decimals", label: "Decimals", strand: "math",
    gradeIntroduced: 4, gradeMastered: 5,
    prerequisites: ["fractions"], testedOn: ["STAAR","CAASPP","NextGen","B.E.S.T."],
    gameMechanic: "placeholder", notes: "CC 4.NF.6, 5.NBT.7" },

  // ─── Math grade 5 ─────────────────────────────────────────────────────
  { id: "order-of-operations", label: "Order of Operations", strand: "math",
    gradeIntroduced: 5, gradeMastered: 5,
    prerequisites: ["multiplication","division"], testedOn: ["STAAR","CAASPP","NextGen","B.E.S.T."],
    gameMechanic: "placeholder", notes: "CC 5.OA.1 (parentheses, brackets, braces)" },
  { id: "volume", label: "Volume", strand: "math",
    gradeIntroduced: 5, gradeMastered: 5,
    prerequisites: ["area"], testedOn: ["STAAR","CAASPP","NextGen","B.E.S.T."],
    gameMechanic: "placeholder", notes: "CC 5.MD.3-5 (L×W×H rectangular prisms)" },
  { id: "coordinate-plane", label: "Coordinate Plane", strand: "math",
    gradeIntroduced: 5, gradeMastered: 5,
    prerequisites: [], testedOn: ["STAAR","CAASPP","NextGen","B.E.S.T."],
    gameMechanic: "placeholder", notes: "CC 5.G.1-2 (first quadrant)" },

  // ─── Reading: phonics scope-and-sequence (Luca's foundation + Yana gap-check) ──
  { id: "reading-3letter", label: "Short-Vowel CVC Words", strand: "reading",
    gradeIntroduced: 0, gradeMastered: 0,
    prerequisites: [], testedOn: [],
    gameMechanic: "finger-swipe", notes: "SoR Level 1 phonics (cat, sit, hop)" },
  { id: "reading-4letter", label: "Consonant Digraphs", strand: "reading",
    gradeIntroduced: 0, gradeMastered: 1,
    prerequisites: ["reading-3letter"], testedOn: [],
    gameMechanic: "finger-swipe", notes: "SoR Level 2 (sh, ch, th, wh, ck)" },
  { id: "phonics-blends", label: "Consonant Blends", strand: "reading",
    gradeIntroduced: 1, gradeMastered: 1,
    prerequisites: ["reading-4letter"], testedOn: [],
    gameMechanic: "finger-swipe", notes: "SoR Level 3 (st, bl, gr, fr)" },
  { id: "phonics-vowel-teams", label: "Vowel Teams & R-Controlled", strand: "reading",
    gradeIntroduced: 1, gradeMastered: 2,
    prerequisites: ["phonics-blends"], testedOn: [],
    gameMechanic: "finger-swipe", notes: "SoR Level 4-5 (ai, ee, oa, ar, er, ir, or, ur)" },
  { id: "phonics-syllables", label: "Multisyllabic Decoding", strand: "reading",
    gradeIntroduced: 2, gradeMastered: 3,
    prerequisites: ["phonics-vowel-teams"], testedOn: [],
    gameMechanic: "placeholder", notes: "SoR Level 6 (six syllable types)" },

  // ─── Reading: fluency & comprehension (Yana's focus) ──────────────────
  { id: "reading-sentence", label: "Sentence Reading", strand: "reading",
    gradeIntroduced: 1, gradeMastered: 5,
    prerequisites: ["reading-4letter"], testedOn: [],
    gameMechanic: "finger-swipe", notes: "bridge to connected-text fluency" },
  { id: "fluency-oral", label: "Oral Reading Fluency (WCPM)", strand: "reading",
    gradeIntroduced: 1, gradeMastered: 5,
    prerequisites: ["reading-sentence"], testedOn: [],
    gameMechanic: "placeholder",
    notes: "Hasbrouck & Tindal 2017: G3 target 83/97/112 (Fall/Winter/Spring). Guided Repeated Oral Reading d=0.55 (NRP 2000)." },
  { id: "morphology-affixes", label: "Prefixes & Suffixes", strand: "reading",
    gradeIntroduced: 3, gradeMastered: 5,
    prerequisites: ["phonics-syllables"], testedOn: [],
    gameMechanic: "placeholder",
    notes: "Goodwin 2024 meta-analysis — d=0.59 decoding / 0.34 vocab. ES preliminary, warrants primary-source confirmation." },
  { id: "spelling", label: "Spelling", strand: "reading",
    gradeIntroduced: 0, gradeMastered: 5,
    prerequisites: ["reading-3letter"], testedOn: ["STAAR"],
    gameMechanic: "placeholder", notes: "encoding counterpart to decoding" },
];

const CURRICULUM_DEFAULTS = {
  activeSubjects: ["addition", "multiplication"],
  mastery: {},
};

// gameMechanic enum → RPGCore screen key (used for routing + recommendations)
const MECHANIC_TO_SCREEN = {
  "quickfire": "monsters",
  "fraction-line": "fractions",
  "finger-swipe": "reading",
};

// isPlayable — true if the subject has a real game generator (not placeholder).
// Lets the catalog grow ahead of game implementations without breaking anything.
function isPlayable(id) {
  const subj = LEARNING_SUBJECTS.find(x => x.id === id);
  return !!(subj?.gameMechanic && subj.gameMechanic !== "placeholder");
}

// getCurriculum — extract a kid's config from the Firebase curriculum object.
// curriculum shape: { [kidName]: { activeSubjects: string[], mastery: { [id]: 0–1 } } }
export function getCurriculum(curriculum, kidName) {
  if (!curriculum || !kidName) return { ...CURRICULUM_DEFAULTS };
  return { ...CURRICULUM_DEFAULTS, ...(curriculum[kidName] || {}) };
}

// getSubjectLabel — single source of truth for display name, with id fallback.
// Prefer this over duplicating label maps in each view component.
export function getSubjectLabel(id) {
  const subj = LEARNING_SUBJECTS.find(s => s.id === id);
  return subj?.label || id;
}

// getPrereqs — returns array of prerequisite subject ids (empty for root topics).
export function getPrereqs(id) {
  const subj = LEARNING_SUBJECTS.find(s => s.id === id);
  return subj?.prerequisites || [];
}

// getSubjectsForGrade — filter catalog by grade (K=0 … 5).
// Shows the grade's topics + one grade behind (remediation) + one ahead (acceleration).
// Returns full catalog when no grade set (backward-compatible default).
// Accepts "K" or 0 for kindergarten; numeric strings ("3") and numbers (3) both work.
export function getSubjectsForGrade(grade) {
  if (grade == null || grade === "") return LEARNING_SUBJECTS;
  const g = grade === "K" ? 0 : Number(grade);
  if (Number.isNaN(g)) return LEARNING_SUBJECTS;
  return LEARNING_SUBJECTS.filter(s => {
    const intro = s.gradeIntroduced ?? 0;
    const master = s.gradeMastered ?? 5;
    return intro <= g + 1 && master >= g - 1;
  });
}

// subjectAccuracy — 0–1 accuracy for a subject attempt record, or null if < 3 samples.
// attempts shape: { [timestamp]: { correct: boolean, timeMs: number } }
function subjectAccuracy(attempts) {
  if (!attempts || typeof attempts !== "object") return null;
  const list = Object.values(attempts);
  if (list.length < 3) return null;
  return list.filter(a => a.correct).length / list.length;
}

// getWeakAreas — top-3 subjects by lowest accuracy (min 3 attempts each).
export function getWeakAreas(learningStats, kidName) {
  if (!learningStats?.[kidName]) return [];
  const kidStats = learningStats[kidName];
  return LEARNING_SUBJECTS
    .map(subj => {
      const acc = subjectAccuracy(kidStats[subj.id]);
      return acc !== null ? { ...subj, accuracy: acc } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);
}

// nextProblem — adaptive problem selection for a kid.
// 60% from weak areas, 40% from active subjects.
// S04: filters out subjects with gameMechanic:"placeholder" — catalog can
// grow ahead of generators without games breaking.
export function nextProblem(curriculumData, learningStats, kidName) {
  const config = getCurriculum(curriculumData, kidName);
  const weakPlayable = getWeakAreas(learningStats, kidName).filter(s => isPlayable(s.id));
  const activePlayable = (config.activeSubjects || []).filter(isPlayable);
  const useWeak = weakPlayable.length > 0 && Math.random() < 0.6;
  let subjectId;
  if (useWeak) {
    subjectId = weakPlayable[Math.floor(Math.random() * weakPlayable.length)].id;
  } else {
    const active = activePlayable.length ? activePlayable : ["multiplication"];
    subjectId = active[Math.floor(Math.random() * active.length)];
  }
  const mastery = config.mastery?.[subjectId] ?? 0;
  const difficulty = mastery > 0.7 ? "hard" : "easy";
  return { ...generateMathProblem(difficulty, subjectId), subjectId };
}

// recommendGames — pick the top game tile to surface in the mini-games menu.
// Priority: weak ∩ active > weakest overall > first active.
// Returns { screen, subjectId, subjectLabel, reason } or null when no signal.
// Subjects without a real generator (placeholder mechanic) are skipped.
export function recommendGames(curriculumData, learningStats, kidName) {
  const config = getCurriculum(curriculumData, kidName);
  const active = config.activeSubjects || [];
  const weak = getWeakAreas(learningStats, kidName);

  const priority = weak.find(w => active.includes(w.id) && isPlayable(w.id));
  const fallbackWeak = weak.find(w => isPlayable(w.id));
  const fallbackActiveId = active.find(isPlayable);

  let subj;
  let reason;
  if (priority) { subj = priority; reason = "weak + active"; }
  else if (fallbackWeak) { subj = fallbackWeak; reason = "weakest"; }
  else if (fallbackActiveId) {
    subj = LEARNING_SUBJECTS.find(s => s.id === fallbackActiveId);
    reason = "active focus";
  }
  if (!subj) return null;

  const screen = MECHANIC_TO_SCREEN[subj.gameMechanic] || null;
  if (!screen) return null;

  return { screen, subjectId: subj.id, subjectLabel: subj.label, reason };
}

// recordAttempt — write one attempt to Firebase.
// Path: learningStats/{kidName}/{subjectId}/{timestamp}
export function recordAttempt(fbSet, kidName, subjectId, correct, timeMs) {
  if (!fbSet || !kidName || !subjectId) return;
  fbSet(`learningStats/${kidName}/${subjectId}/${Date.now()}`, {
    correct: Boolean(correct),
    timeMs: Math.round(timeMs || 0),
    ts: new Date().toISOString(),
  });
}

// getELI5 — AI-generated plain-language refresher for a parent.
export async function getELI5(apiKey, kidName, subjectId) {
  const label = getSubjectLabel(subjectId);
  const result = await callAI(apiKey, [{
    role: "user",
    content: `Explain "${label}" in 2–3 sentences a parent can use to help their child practice it at home. Be concrete. No jargon.`,
  }], { maxTokens: 200, temperature: 0.5 });
  return result.ok && result.data
    ? result.data
    : "Couldn't load explanation — check your connection and try again.";
}
