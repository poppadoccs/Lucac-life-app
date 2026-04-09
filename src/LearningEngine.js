// ─── LEARNING ENGINE (EDU-01) ────────────────────────────────────────────────
// Adaptive learning utilities for Yana and Luca.
// Pure functions (data-in → data-out) except recordAttempt (Firebase write)
// and getELI5 (AI network call).

import { callAI } from "./utils";
import { generateMathProblem, ageBandFromProfile } from "./games/_shared";

// Subject catalog — used by SettingsTab curriculum builder and all EDU games
export const LEARNING_SUBJECTS = [
  { id: "addition",         label: "Addition",          gradeLevel: 1 },
  { id: "subtraction",      label: "Subtraction",       gradeLevel: 1 },
  { id: "multiplication",   label: "Multiplication",    gradeLevel: 2 },
  { id: "division",         label: "Division",          gradeLevel: 3 },
  { id: "fractions",        label: "Fractions",         gradeLevel: 3 },
  { id: "area",             label: "Area & Perimeter",  gradeLevel: 3 },
  { id: "time",             label: "Telling Time",      gradeLevel: 2 },
  { id: "money",            label: "Money Math",        gradeLevel: 2 },
  { id: "reading-3letter",  label: "3-Letter Words",    gradeLevel: 0 },
  { id: "reading-4letter",  label: "4-Letter Words",    gradeLevel: 1 },
  { id: "reading-sentence", label: "Reading Sentences", gradeLevel: 2 },
  { id: "spelling",         label: "Spelling",          gradeLevel: 2 },
];

const CURRICULUM_DEFAULTS = {
  activeSubjects: ["addition", "multiplication"],
  mastery: {},
};

// getCurriculum — extract a kid's config from the Firebase curriculum object.
// curriculum shape: { [kidName]: { activeSubjects: string[], mastery: { [id]: 0–1 } } }
export function getCurriculum(curriculum, kidName) {
  if (!curriculum || !kidName) return { ...CURRICULUM_DEFAULTS };
  return { ...CURRICULUM_DEFAULTS, ...(curriculum[kidName] || {}) };
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
export function nextProblem(curriculumData, learningStats, kidName) {
  const config = getCurriculum(curriculumData, kidName);
  const weak = getWeakAreas(learningStats, kidName);
  const useWeak = weak.length > 0 && Math.random() < 0.6;
  let subjectId;
  if (useWeak) {
    subjectId = weak[Math.floor(Math.random() * weak.length)].id;
  } else {
    const active = config.activeSubjects.length ? config.activeSubjects : ["multiplication"];
    subjectId = active[Math.floor(Math.random() * active.length)];
  }
  const mastery = config.mastery?.[subjectId] ?? 0;
  const difficulty = mastery > 0.7 ? "hard" : "easy";
  return { ...generateMathProblem(difficulty, subjectId), subjectId };
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
  const subj = LEARNING_SUBJECTS.find(s => s.id === subjectId);
  const label = subj?.label || subjectId;
  const result = await callAI(apiKey, [{
    role: "user",
    content: `Explain "${label}" in 2–3 sentences a parent can use to help their child practice it at home. Be concrete. No jargon.`,
  }], { maxTokens: 200, temperature: 0.5 });
  return result.ok && result.data
    ? result.data
    : "Couldn't load explanation — check your connection and try again.";
}
