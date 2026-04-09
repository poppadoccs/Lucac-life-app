import { useState } from "react";
import { callAI } from "./utils";

// Display names for subject IDs written by LearningEngine (C1)
const SUBJECT_LABELS = {
  arithmetic: "Arithmetic",
  multiplication: "Multiplication",
  division: "Division",
  fractions: "Fractions",
  reading: "Reading",
};

// Return top-3 weak items across all subjects, sorted by lowest accuracy
function getWeakAreas(subjectStats) {
  const areas = [];
  for (const [subjectId, stats] of Object.entries(subjectStats || {})) {
    for (const [item, ws] of Object.entries(stats?.weakItems || {})) {
      if ((ws.attempts || 0) >= 2) {
        areas.push({
          item,
          subject: SUBJECT_LABELS[subjectId] || subjectId,
          pct: Math.round((ws.correct / ws.attempts) * 100),
        });
      }
    }
  }
  return areas.sort((a, b) => a.pct - b.pct).slice(0, 3);
}

// Horizontal accuracy bar with numeric label — colorblind-safe (text label + bar fill)
function AccuracyBar({ label, correct, attempts, avgTimeMs }) {
  const pct = attempts > 0 ? Math.round((correct / attempts) * 100) : null;
  const fillColor = pct === null ? "#374151" : pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";
  const fillLabel = pct === null ? "No data" : pct >= 80 ? "Strong" : pct >= 50 ? "OK" : "Needs work";
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ color: "#e5e7eb", fontSize: 14, fontWeight: 600 }}>{label}</span>
        <span style={{ color: "#9ca3af", fontSize: 12 }}>
          {pct !== null ? `${pct}% (${attempts} tries)` : "—"}
          {avgTimeMs ? `  ·  ${(avgTimeMs / 1000).toFixed(1)}s avg` : ""}
        </span>
      </div>
      <div style={{ background: "#374151", borderRadius: 6, height: 10, overflow: "hidden" }}>
        <div style={{ background: fillColor, height: "100%", width: `${pct || 0}%`, transition: "width 0.4s ease", borderRadius: 6 }} />
      </div>
      <div style={{ fontSize: 11, color: fillColor, marginTop: 2 }}>{fillLabel}</div>
    </div>
  );
}

// ─── PARENT DASHBOARD ────────────────────────────────────────────────────────
// Props:
//   profiles      — array of profile objects (App.jsx state)
//   learningStats — { [kidName]: { [subjectId]: { attempts, correct, avgTimeMs, weakItems } } }
//                   Written by LearningEngine.recordAttempt (C1). May be empty.
//   readingStats  — { [kidName]: { level, wordsMastered, storiesRead } }
//                   Written by WordWarrior (C2). May be empty.
//   groqKey       — string, import.meta.env.VITE_GROQ_KEY passed from App.jsx
//   V             — active theme variables object
// Hidden from kid profiles — App.jsx shows this tab only when isAdmin || isParent.
export default function ParentDashboard({ profiles, learningStats, readingStats, groqKey, V }) {
  const kids = (profiles || []).filter(p => p.type === "kid");
  const [selectedKidName, setSelectedKidName] = useState(() => kids[0]?.name || "");
  const [report, setReport] = useState("");
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState("");

  async function handleGenerateReport() {
    if (!groqKey) { setReportError("No AI key configured."); return; }
    setLoadingReport(true);
    setReport("");
    setReportError("");

    const kidStats = learningStats?.[selectedKidName] || {};
    const rStats = readingStats?.[selectedKidName] || {};

    // Pass real numbers to the prompt — AI narrates, JS supplies the facts
    const subjectSummary = Object.entries(kidStats).map(([subj, s]) => {
      const pct = (s.attempts || 0) > 0 ? Math.round(((s.correct || 0) / s.attempts) * 100) : null;
      return `${SUBJECT_LABELS[subj] || subj}: ${pct !== null ? pct + "% correct" : "not attempted"} (${s.attempts || 0} tries)`;
    }).join("; ") || "no learning data yet";

    const weakAreas = getWeakAreas(kidStats).map(a => `${a.item} (${a.pct}%)`).join(", ") || "none identified";

    const prompt = `You are a warm, encouraging parent assistant for a family learning app.
Write a brief weekly learning summary for ${selectedKidName}.

Data:
- Subject accuracy: ${subjectSummary}
- Weak areas: ${weakAreas}
- Reading level: ${rStats.level || "not started"}
- Words mastered: ${rStats.wordsMastered || 0}
- Stories read: ${rStats.storiesRead || 0}

Write 3–4 sentences max. Be specific and encouraging. Mention one clear strength and one area to practice. Suggest one fun activity they can try this week.`;

    const result = await callAI(groqKey, [{ role: "user", content: prompt }], {
      maxTokens: 200, temperature: 0.7, timeout: 15000,
    });

    if (result.ok) {
      setReport(result.data);
    } else {
      setReportError(result.error || "Could not generate report — try again.");
    }
    setLoadingReport(false);
  }

  if (kids.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#9ca3af", fontSize: 15 }}>
        No kid profiles found. Add kids in Settings to track their progress.
      </div>
    );
  }

  const kid = kids.find(k => k.name === selectedKidName) || kids[0];
  const kidStats = learningStats?.[kid.name] || {};
  const rStats = readingStats?.[kid.name] || {};
  const weakAreas = getWeakAreas(kidStats);
  const hasAnyData = Object.keys(kidStats).length > 0 || rStats.level || rStats.wordsMastered;

  const accent = V?.accent || "#3b82f6";

  return (
    <div style={{ padding: 16, maxWidth: 520, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ fontSize: 20, fontWeight: 800, color: V?.textPrimary || "#f9fafb", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
        📊 Learning Progress
      </div>
      <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 20 }}>Parent view — not visible to kids</div>

      {/* Kid selector tabs */}
      {kids.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {kids.map(k => {
            const active = k.name === (kid.name);
            return (
              <button
                key={k.name}
                onClick={() => { setSelectedKidName(k.name); setReport(""); setReportError(""); }}
                style={{
                  padding: "10px 18px", borderRadius: 10,
                  border: `2px solid ${active ? accent : "#374151"}`,
                  background: active ? accent : "transparent",
                  color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14, minHeight: 44,
                }}
              >{k.emoji || "👤"} {k.name}</button>
            );
          })}
        </div>
      )}

      {!hasAnyData && (
        <div style={{ background: "#1f2937", borderRadius: 14, padding: 20, marginBottom: 16, textAlign: "center", color: "#6b7280", fontSize: 14 }}>
          {kid.name} hasn't played any learning games yet. Stats will appear here after their first session.
        </div>
      )}

      {/* Subject accuracy */}
      {Object.keys(kidStats).length > 0 && (
        <div style={{ background: "#1f2937", borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#e5e7eb", marginBottom: 14 }}>Subject Accuracy</div>
          {Object.entries(kidStats).map(([subj, s]) => (
            <AccuracyBar
              key={subj}
              label={SUBJECT_LABELS[subj] || subj}
              correct={s.correct || 0}
              attempts={s.attempts || 0}
              avgTimeMs={s.avgTimeMs || 0}
            />
          ))}
        </div>
      )}

      {/* Weak areas */}
      {weakAreas.length > 0 && (
        <div style={{ background: "#1f2937", borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#e5e7eb", marginBottom: 10 }}>Needs Practice (Top 3)</div>
          {weakAreas.map((a, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 8, background: "#374151", borderRadius: 8, padding: "10px 14px",
            }}>
              <span style={{ color: "#e5e7eb", fontSize: 14 }}>
                <span style={{ color: "#9ca3af", fontSize: 12 }}>{a.subject} · </span>
                {a.item}
              </span>
              <span style={{ fontWeight: 700, fontSize: 14, color: a.pct < 50 ? "#ef4444" : "#f59e0b" }}>
                {a.pct}% correct
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Reading stats */}
      {(rStats.level || rStats.wordsMastered || rStats.storiesRead) && (
        <div style={{ background: "#1f2937", borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#e5e7eb", marginBottom: 12 }}>Reading Progress</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              { label: "Reading Level", value: rStats.level || 1 },
              { label: "Words Mastered", value: rStats.wordsMastered || 0 },
              { label: "Stories Read",   value: rStats.storiesRead   || 0 },
            ].map(stat => (
              <div key={stat.label} style={{ background: "#374151", borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#60a5fa" }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3, lineHeight: 1.3 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly report */}
      <div style={{ background: "#1f2937", borderRadius: 14, padding: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#e5e7eb", marginBottom: 10 }}>Weekly AI Report</div>
        {report && (
          <div style={{ background: "#374151", borderRadius: 10, padding: 14, marginBottom: 12, color: "#e5e7eb", fontSize: 14, lineHeight: 1.65 }}>
            {report}
          </div>
        )}
        {reportError && (
          <div style={{ color: "#f87171", fontSize: 13, marginBottom: 10 }}>{reportError}</div>
        )}
        <button
          onClick={handleGenerateReport}
          disabled={loadingReport}
          style={{
            background: loadingReport ? "#374151" : accent,
            color: "#fff", border: "none", borderRadius: 10,
            padding: "14px 20px", cursor: loadingReport ? "not-allowed" : "pointer",
            fontWeight: 700, fontSize: 15, width: "100%", minHeight: 48,
            opacity: loadingReport ? 0.7 : 1, transition: "opacity 0.2s",
          }}
        >{loadingReport ? "Generating..." : "📝 Generate Weekly Report"}</button>
      </div>
    </div>
  );
}
