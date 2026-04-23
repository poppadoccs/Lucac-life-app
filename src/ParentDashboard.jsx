import { useState, useEffect } from "react";
import { getDatabase, ref, onValue } from "firebase/database";
import { callAI } from "./utils";

// Humanize game ids used in gameHistory writes (e.g. "math_monsters" → "Math Monsters")
function humanizeGameId(id) {
  if (!id) return "Game";
  const map = {
    racing: "Racing",
    fish: "Fish Eater",
    fish_eater: "Fish Eater",
    math_monsters: "Math Monsters",
    multiplication_monsters: "Math Monsters",
    division_dungeon: "Math Monsters",
    fraction_line: "Fraction Line",
    fractionline: "Fraction Line",
    reading: "Reading",
    word_warrior: "Word Warrior",
    storyquest: "Story Quest",
    story_quest: "Story Quest",
    board: "Board Game",
    boardgame: "Board Game",
    coop: "Co-op",
    versus: "Versus",
    potions: "Potions",
    mathracer: "Math Racer",
  };
  if (map[id]) return map[id];
  return String(id).replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// Relative time like "3h ago" / "just now" / "2d ago"
function relTime(tsMs) {
  const diff = Date.now() - tsMs;
  if (diff < 0 || !isFinite(diff)) return "just now";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  return `${w}w ago`;
}

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
export default function ParentDashboard({ profiles, learningStats, readingStats, groqKey, V, kidsData = {}, rewardsConfig = [], fbSet }) {
  const kids = (profiles || []).filter(p => p.type === "kid");
  const [selectedKidName, setSelectedKidName] = useState(() => kids[0]?.name || "");
  const [report, setReport] = useState("");
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState("");
  const [redeemNotice, setRedeemNotice] = useState("");

  // Subscribe to gameHistory/{selectedKidName} directly — this matches the
  // actual write path used by _shared.recordGameHistory (top-level, NOT
  // nested under kidsData). See Lessons Learned 2026-04-07: child must read
  // from the same path the writer writes to. App.jsx does not subscribe to
  // gameHistory, so the component owns its own subscription.
  const [gameHistoryForKid, setGameHistoryForKid] = useState({});
  useEffect(() => {
    if (!selectedKidName) { setGameHistoryForKid({}); return; }
    try {
      const db = getDatabase();
      const r = ref(db, `gameHistory/${selectedKidName}`);
      const unsub = onValue(r, snap => {
        setGameHistoryForKid(snap.val() || {});
      });
      return () => unsub();
    } catch {
      setGameHistoryForKid({});
    }
  }, [selectedKidName]);

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

    try {
      const result = await callAI(groqKey, [{ role: "user", content: prompt }], {
        maxTokens: 200, temperature: 0.7, timeout: 15000,
      });
      if (result.ok) {
        setReport(result.data);
      } else {
        setReportError(result.error || "Could not generate report — try again.");
      }
    } catch {
      setReportError("Could not generate report — try again.");
    } finally {
      setLoadingReport(false);
    }
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

  // ── Stars this week (derived from kidsData[name].starLog) ──────────────
  // starLog shape: { [tsMs]: { amount: number, reason: string } }
  // Written by LucacLegends shell (addStars) on session/level completion AND
  // by the redemption handler below (with negative amount).
  const kidRecord = (kidsData || {})[kid.name] || {};
  const kidStars = Number(kidRecord.points || 0);
  const starLog = kidRecord.starLog || {};
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekEntries = Object.entries(starLog)
    .map(([ts, e]) => ({ ts: Number(ts), amount: Number(e?.amount || 0), reason: e?.reason || "" }))
    .filter(e => !isNaN(e.ts) && e.ts >= weekAgo)
    .sort((a, b) => b.ts - a.ts);
  const weekStarsNet = weekEntries.reduce((sum, e) => sum + e.amount, 0);
  const weekStarsEarned = weekEntries.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const recentEntries = weekEntries.slice(0, 5);

  // ── Rewards available (read rewardsConfig) ─────────────────────────────
  const enabledRewards = (Array.isArray(rewardsConfig) ? rewardsConfig : [])
    .filter(r => r && r.enabled !== false);

  // ── Recent games played ─────────────────────────────────────────────────
  // gameHistory is a top-level Firebase path keyed by kid name — we subscribe
  // to gameHistory/{kid.name} via onValue above. gameHistoryForKid is the
  // raw object for THIS kid; we sort by ts-key descending and take the last 5.
  const recentGames = Object.entries(gameHistoryForKid || {})
    .map(([ts, g]) => ({ ts: Number(ts), ...(g || {}) }))
    .filter(g => !isNaN(g.ts))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 5);

  function handleRedeemReward(reward) {
    if (!reward || !fbSet) return;
    const cost = Number(reward.cost || 0);
    if (kidStars < cost) return;
    const confirmed = window.confirm(`Redeem ${reward.label} for ${cost} stars?`);
    if (!confirmed) return;
    const ts = Date.now();
    const newLog = {
      ...(kidRecord.starLog || {}),
      [ts]: { amount: -cost, reason: "Redeemed: " + (reward.label || "reward") },
    };
    const updatedKid = {
      ...kidRecord,
      points: Math.max(0, kidStars - cost),
      starLog: newLog,
    };
    fbSet("kidsData", { ...(kidsData || {}), [kid.name]: updatedKid });
    setRedeemNotice(`Redeemed: ${reward.label} (-${cost}⭐)`);
    setTimeout(() => setRedeemNotice(""), 3000);
  }

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
                aria-pressed={active}
                onClick={() => { setSelectedKidName(k.name); setReport(""); setReportError(""); }}
                style={{
                  padding: "10px 18px", borderRadius: 10,
                  border: `2px solid ${active ? accent : "#374151"}`,
                  background: active ? accent : "transparent",
                  color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14, minHeight: 44,
                }}
              >{active ? "✓ " : ""}{k.emoji || "👤"} {k.name}</button>
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

      {/* Stars this week */}
      <div style={{ background: "#1f2937", borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#e5e7eb", marginBottom: 12 }}>
          <span role="img" aria-label="star">⭐</span> Stars This Week
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div style={{ background: "#374151", borderRadius: 10, padding: "14px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#fbbf24", lineHeight: 1 }}>{kidStars}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 5, lineHeight: 1.3 }}>Total Stars (⭐)</div>
          </div>
          <div style={{ background: "#374151", borderRadius: 10, padding: "14px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#60a5fa", lineHeight: 1 }}>+{weekStarsEarned}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 5, lineHeight: 1.3 }}>Earned · Last 7 days</div>
          </div>
        </div>
        {weekEntries.length === 0 ? (
          <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: "8px 0" }}>
            No stars yet — play a game to start!
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>Recent activity:</div>
            {recentEntries.map((e, i) => {
              const isPositive = e.amount > 0;
              return (
                <div key={`${e.ts}-${i}`} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: "#374151", borderRadius: 8, padding: "8px 12px", marginBottom: 6, fontSize: 13,
                }}>
                  <span style={{ color: "#e5e7eb", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>
                    <span style={{ color: isPositive ? "#22c55e" : "#f87171", fontWeight: 700, marginRight: 6 }}>
                      {isPositive ? `+${e.amount}` : e.amount}
                    </span>
                    <span style={{ color: "#d1d5db" }}>{e.reason || "session"}</span>
                  </span>
                  <span style={{ color: "#9ca3af", fontSize: 11, flexShrink: 0 }}>{relTime(e.ts)}</span>
                </div>
              );
            })}
            {weekStarsNet !== weekStarsEarned && (
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, textAlign: "right" }}>
                Net this week: {weekStarsNet >= 0 ? "+" : ""}{weekStarsNet}⭐ (earned and redeemed)
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rewards available */}
      <div style={{ background: "#1f2937", borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#e5e7eb", marginBottom: 12 }}>
          <span role="img" aria-label="gift">🎁</span> Rewards Available
        </div>
        {redeemNotice && (
          <div style={{
            background: "#065f46", color: "#d1fae5", borderRadius: 8,
            padding: "8px 12px", fontSize: 13, marginBottom: 10, fontWeight: 600,
          }}>{redeemNotice}</div>
        )}
        {enabledRewards.length === 0 ? (
          <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: "8px 0" }}>
            No rewards configured yet — set them up in Settings → Rewards
          </div>
        ) : (
          enabledRewards.map((reward, i) => {
            const cost = Number(reward.cost || 0);
            const affordable = kidStars >= cost;
            const need = cost - kidStars;
            return (
              <div key={reward.id || `rw-${i}`} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "#374151", borderRadius: 10, padding: "12px 14px", marginBottom: 8, gap: 10,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#e5e7eb", fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
                    {reward.label || "Reward"}
                  </div>
                  <div style={{ fontSize: 12, color: "#fbbf24", fontWeight: 700 }}>
                    ⭐ {cost} stars
                  </div>
                  <div style={{
                    display: "inline-block", marginTop: 4, fontSize: 11, fontWeight: 700,
                    padding: "2px 8px", borderRadius: 4,
                    background: affordable ? "#065f46" : "#4b5563",
                    color: affordable ? "#d1fae5" : "#d1d5db",
                  }}>
                    {affordable ? "✓ Affordable!" : `Need ${need} more ⭐`}
                  </div>
                </div>
                <button
                  onClick={() => handleRedeemReward(reward)}
                  disabled={!affordable || !fbSet}
                  aria-label={`Mark ${reward.label} as redeemed`}
                  style={{
                    background: affordable ? "#22c55e" : "#4b5563",
                    color: "#fff", border: "none", borderRadius: 8,
                    padding: "10px 14px", fontWeight: 700, fontSize: 13,
                    cursor: affordable && fbSet ? "pointer" : "not-allowed",
                    minHeight: 44, flexShrink: 0,
                    opacity: affordable && fbSet ? 1 : 0.6,
                  }}
                >Mark Redeemed</button>
              </div>
            );
          })
        )}
      </div>

      {/* Recent games played */}
      <div style={{ background: "#1f2937", borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#e5e7eb", marginBottom: 12 }}>
          <span role="img" aria-label="game">🎮</span> Recent Games Played
        </div>
        {recentGames.length === 0 ? (
          <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: "8px 0" }}>
            No games played yet
          </div>
        ) : (
          recentGames.map((g, i) => (
            <div key={`${g.ts}-${i}`} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "#374151", borderRadius: 8, padding: "10px 12px", marginBottom: 6,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#e5e7eb", fontSize: 14, fontWeight: 600 }}>
                  {humanizeGameId(g.game)}
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                  {relTime(g.ts)}
                  {typeof g.score === "number" ? ` · score ${g.score}` : ""}
                </div>
              </div>
              <div style={{ flexShrink: 0, color: "#fbbf24", fontWeight: 700, fontSize: 13 }}>
                +{Number(g.stars || 0)} ⭐
              </div>
            </div>
          ))
        )}
      </div>

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
