import { useState, useEffect } from "react";
import { groqFetch, parseGroqJSON } from "./utils";

// ═══ CONSTANTS ═══

const CATEGORIES = [
  { key: "Groceries", emoji: "🛒", color: "#22c55e" },
  { key: "Kids", emoji: "👶", color: "#3b82f6" },
  { key: "Transport", emoji: "🚗", color: "#f97316" },
  { key: "Bills", emoji: "💡", color: "#eab308" },
  { key: "Eating Out", emoji: "🍔", color: "#ef4444" },
  { key: "Tools/Work", emoji: "🔧", color: "#6b7280" },
  { key: "Entertainment", emoji: "🎮", color: "#7c3aed" },
  { key: "Chicken Wings", emoji: "🍗", color: "#f59e0b" },
  { key: "Other", emoji: "📦", color: "#14b8a6" },
];

const CAT_MAP = {};
CATEGORIES.forEach((c) => {
  CAT_MAP[c.key] = c;
});

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtMoney(n) {
  return "$" + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function fmtDate(d) {
  if (!d) return "";
  const parts = d.split("-");
  return `${parts[1]}/${parts[2]}`;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ═══ DONUT CHART ═══

function DonutChart({ categoryTotals, totalSpent, budgetLimit, V, onSliceClick, selectedCat }) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 80;
  const strokeWidth = 32;
  const circumference = 2 * Math.PI * radius;

  // Build slices
  const slices = [];
  let accumulated = 0;
  for (const cat of CATEGORIES) {
    const val = categoryTotals[cat.key] || 0;
    if (val <= 0) continue;
    const fraction = totalSpent > 0 ? val / totalSpent : 0;
    const dashLen = fraction * circumference;
    const gapLen = circumference - dashLen;
    const rotation = (accumulated / totalSpent) * 360 - 90;
    accumulated += val;
    const isSelected = selectedCat === cat.key;
    slices.push(
      <circle
        key={cat.key}
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={cat.color}
        strokeWidth={isSelected ? strokeWidth + 6 : strokeWidth}
        strokeDasharray={`${dashLen} ${gapLen}`}
        transform={`rotate(${rotation} ${cx} ${cy})`}
        style={{ cursor: "pointer", opacity: selectedCat && !isSelected ? 0.35 : 1, transition: "all 0.3s ease" }}
        onClick={() => onSliceClick(cat.key)}
        aria-label={`${cat.emoji} ${cat.key}: ${fmtMoney(val)}`}
      />
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Budget donut chart">
        {/* Background ring */}
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke={V.borderSubtle} strokeWidth={strokeWidth} opacity={0.3} />
        {slices}
        {/* Center text */}
        <text x={cx} y={cy - 12} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: 15, fontWeight: 700, fill: V.textPrimary }}>
          Spent {fmtMoney(totalSpent)}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: 12, fill: V.textMuted }}>
          of {fmtMoney(budgetLimit)}
        </text>
        {totalSpent > budgetLimit && budgetLimit > 0 && (
          <text x={cx} y={cy + 28} textAnchor="middle" dominantBaseline="middle"
            style={{ fontSize: 11, fontWeight: 700, fill: V.danger }}>
            OVER BUDGET
          </text>
        )}
      </svg>
    </div>
  );
}

// ═══ MAIN COMPONENT ═══

export default function BudgetTab({ V, currentProfile, fbSet, GROQ_KEY, showToast, profiles, custodySchedule, budgetData, shoppingList }) {
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedCat, setSelectedCat] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [recurring, setRecurring] = useState(false);

  const transactions = budgetData?.transactions || [];
  const categoryBudgets = budgetData?.categoryBudgets || {};

  // Current month filter
  const month = currentMonth();
  const monthTx = transactions.filter((t) => t.date && t.date.startsWith(month));

  // Category totals for current month
  const categoryTotals = {};
  let totalSpent = 0;
  for (const t of monthTx) {
    const cat = t.category || "Other";
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(t.amount) || 0);
    totalSpent += Number(t.amount) || 0;
  }

  // Total budget limit
  let budgetLimit = 0;
  for (const cat of CATEGORIES) {
    budgetLimit += Number(categoryBudgets[cat.key]) || 0;
  }
  if (budgetLimit === 0) budgetLimit = 2000; // default

  // Filtered transactions
  const displayTx = selectedCat ? monthTx.filter((t) => t.category === selectedCat) : monthTx;
  const sortedTx = [...displayTx].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  // ─── Dad weeks vs Mom weeks ───
  function getCustodyParent(dateStr) {
    if (!custodySchedule || !Array.isArray(custodySchedule)) return null;
    for (const block of custodySchedule) {
      if (dateStr >= block.start && dateStr <= block.end) return block.parent;
    }
    return null;
  }

  let dadTotal = 0, momTotal = 0, dadDays = new Set(), momDays = new Set();
  for (const t of monthTx) {
    const parent = getCustodyParent(t.date);
    if (parent === "Dad") {
      dadTotal += Number(t.amount) || 0;
      dadDays.add(t.date);
    } else if (parent === "Mom") {
      momTotal += Number(t.amount) || 0;
      momDays.add(t.date);
    }
  }
  const dadAvg = dadDays.size > 0 ? dadTotal / dadDays.size : 0;
  const momAvg = momDays.size > 0 ? momTotal / momDays.size : 0;

  // ─── Groq AI input ───
  async function handleAIInput() {
    if (!inputText.trim() || loading) return;
    setLoading(true);
    const today = todayStr();
    const sysPrompt = `Extract expense data from text. Return JSON: {"amount": number, "store": string, "category": string, "date": "YYYY-MM-DD", "note": string}. Categories: Groceries, Kids, Transport, Bills, Eating Out, Tools/Work, Entertainment, Chicken Wings, Other. Today is ${today}. Return only JSON, no explanation.`;
    const result = await groqFetch(GROQ_KEY, [
      { role: "system", content: sysPrompt },
      { role: "user", content: inputText },
    ]);
    setLoading(false);
    if (!result.ok) {
      showToast(result.error || "AI error");
      return;
    }
    const parsed = parseGroqJSON(result.data);
    if (!parsed || typeof parsed.amount !== "number") {
      showToast("Could not understand that. Try: 'spent $47 at Walmart on groceries'");
      return;
    }
    // Default missing fields
    if (!parsed.date) parsed.date = today;
    if (!parsed.category) parsed.category = "Other";
    if (!parsed.store) parsed.store = "Unknown";
    if (!parsed.note) parsed.note = "";
    setPreview(parsed);
  }

  function confirmPreview() {
    if (!preview) return;
    const newTx = {
      id: uid(),
      amount: preview.amount,
      store: preview.store,
      category: preview.category,
      date: preview.date,
      note: preview.note,
      recurring: recurring,
    };
    const updated = [...transactions, newTx];
    fbSet("budgetData", { ...budgetData, transactions: updated, categoryBudgets });
    setPreview(null);
    setInputText("");
    setRecurring(false);
    showToast(`Added ${fmtMoney(preview.amount)} at ${preview.store}`);
  }

  function cancelPreview() {
    setPreview(null);
  }

  function deleteTransaction(id) {
    const updated = transactions.filter((t) => t.id !== id);
    fbSet("budgetData", { ...budgetData, transactions: updated, categoryBudgets });
    showToast("Transaction deleted");
  }

  function saveBudgetLimit(catKey, value) {
    const newBudgets = { ...categoryBudgets, [catKey]: Number(value) || 0 };
    fbSet("budgetData", { ...budgetData, transactions, categoryBudgets: newBudgets });
  }

  function handleSliceClick(catKey) {
    setSelectedCat(selectedCat === catKey ? null : catKey);
  }

  function copyExport() {
    const lines = ["LUCAC Budget Summary — " + month, ""];
    for (const cat of CATEGORIES) {
      const total = categoryTotals[cat.key];
      if (total > 0) lines.push(`${cat.emoji} ${cat.key}: ${fmtMoney(total)}`);
    }
    lines.push("", `Total: ${fmtMoney(totalSpent)} / ${fmtMoney(budgetLimit)}`, "");
    lines.push("Transactions:");
    for (const t of sortedTx) {
      const catInfo = CAT_MAP[t.category] || CAT_MAP["Other"];
      lines.push(`  ${fmtDate(t.date)} ${catInfo.emoji} ${t.store} — ${fmtMoney(t.amount)}${t.recurring ? " 🔁" : ""}`);
    }
    navigator.clipboard.writeText(lines.join("\n")).then(() => showToast("Summary copied!")).catch(() => showToast("Copy failed"));
  }

  // ═══ STYLES ═══

  const cardStyle = {
    background: V.bgCard,
    borderRadius: V.r3,
    padding: V.sp4,
    marginBottom: V.sp3,
    boxShadow: V.shadowCard,
    border: `1px solid ${V.borderSubtle}`,
  };

  const chipBase = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    minHeight: 44,
    minWidth: 44,
    border: "2px solid transparent",
    transition: "all 0.2s ease",
  };

  const btnPrimary = {
    background: V.accent,
    color: "#fff",
    border: "none",
    borderRadius: V.r2,
    padding: "12px 20px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    minHeight: 44,
    minWidth: 44,
    transition: "opacity 0.2s",
  };

  const btnSecondary = {
    background: V.bgCardAlt || V.bgInput,
    color: V.textPrimary,
    border: `1px solid ${V.borderDefault}`,
    borderRadius: V.r2,
    padding: "10px 16px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    minHeight: 44,
    minWidth: 44,
  };

  const inputStyle = {
    background: V.bgInput,
    color: V.textPrimary,
    border: `1px solid ${V.borderDefault}`,
    borderRadius: V.r2,
    padding: "12px 14px",
    fontSize: 15,
    flex: 1,
    minHeight: 44,
    outline: "none",
  };

  // ═══ RENDER ═══

  return (
    <div style={{ padding: V.sp3, maxWidth: 600, margin: "0 auto" }}>

      {/* ─── AI Input Bar ─── */}
      <div style={cardStyle}>
        <div style={{ fontSize: 15, fontWeight: 700, color: V.textPrimary, marginBottom: 10 }}>
          Add Expense (AI)
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={inputStyle}
            placeholder='e.g. "spent $47 at Walmart on groceries"'
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAIInput()}
            aria-label="Describe your expense"
          />
          <button
            style={{ ...btnPrimary, opacity: loading ? 0.6 : 1, whiteSpace: "nowrap" }}
            onClick={handleAIInput}
            disabled={loading}
            aria-label="Send to AI"
          >
            {loading ? "..." : "Add"}
          </button>
        </div>

        {/* Recurring toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          <button
            style={{
              ...chipBase,
              padding: "6px 12px",
              fontSize: 12,
              background: recurring ? V.accent + "22" : V.bgInput,
              borderColor: recurring ? V.accent : V.borderSubtle,
              color: recurring ? V.accent : V.textMuted,
            }}
            onClick={() => setRecurring(!recurring)}
            aria-label={recurring ? "Recurring enabled" : "Recurring disabled"}
            aria-pressed={recurring}
          >
            🔁 Recurring {recurring ? "(ON)" : "(OFF)"}
          </button>
        </div>

        {/* Preview Card */}
        {preview && (
          <div style={{
            marginTop: 14,
            padding: 14,
            background: V.bgElevated || V.bgCardAlt || V.bgApp,
            borderRadius: V.r2,
            border: `2px solid ${V.accent}`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: V.accent, marginBottom: 8 }}>
              Preview — Confirm this expense?
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 14, color: V.textPrimary }}>
              <span style={{ fontWeight: 600 }}>Amount:</span>
              <span>{fmtMoney(preview.amount)}</span>
              <span style={{ fontWeight: 600 }}>Store:</span>
              <span>{preview.store}</span>
              <span style={{ fontWeight: 600 }}>Category:</span>
              <span>{(CAT_MAP[preview.category]?.emoji || "📦")} {preview.category}</span>
              <span style={{ fontWeight: 600 }}>Date:</span>
              <span>{preview.date}</span>
              {preview.note && <>
                <span style={{ fontWeight: 600 }}>Note:</span>
                <span>{preview.note}</span>
              </>}
              {recurring && <>
                <span style={{ fontWeight: 600 }}>Recurring:</span>
                <span>🔁 Monthly</span>
              </>}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button style={btnPrimary} onClick={confirmPreview} aria-label="Confirm expense">
                Confirm
              </button>
              <button style={btnSecondary} onClick={cancelPreview} aria-label="Cancel expense">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Category Chips ─── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: V.sp3 }}>
        {CATEGORIES.map((cat) => {
          const isActive = selectedCat === cat.key;
          const catTotal = categoryTotals[cat.key] || 0;
          return (
            <button
              key={cat.key}
              style={{
                ...chipBase,
                background: isActive ? cat.color + "22" : V.bgCard,
                borderColor: isActive ? cat.color : V.borderSubtle,
                color: isActive ? cat.color : V.textSecondary,
                boxShadow: isActive ? `0 0 0 1px ${cat.color}44` : "none",
              }}
              onClick={() => setSelectedCat(selectedCat === cat.key ? null : cat.key)}
              aria-label={`${cat.key}: ${fmtMoney(catTotal)}`}
              aria-pressed={isActive}
            >
              <span>{cat.emoji}</span>
              <span>{cat.key}</span>
              {catTotal > 0 && (
                <span style={{ fontSize: 11, opacity: 0.8 }}>{fmtMoney(catTotal)}</span>
              )}
            </button>
          );
        })}
        {selectedCat && (
          <button
            style={{ ...chipBase, background: V.danger + "18", color: V.danger, borderColor: V.danger + "44" }}
            onClick={() => setSelectedCat(null)}
            aria-label="Clear filter"
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* ─── Donut Chart ─── */}
      <div style={cardStyle}>
        <DonutChart
          categoryTotals={categoryTotals}
          totalSpent={totalSpent}
          budgetLimit={budgetLimit}
          V={V}
          onSliceClick={handleSliceClick}
          selectedCat={selectedCat}
        />
        {/* Legend */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 }}>
          {CATEGORIES.map((cat) => {
            const val = categoryTotals[cat.key] || 0;
            if (val <= 0) return null;
            const limit = Number(categoryBudgets[cat.key]) || 0;
            const overBudget = limit > 0 && val > limit;
            return (
              <div
                key={cat.key}
                style={{
                  display: "flex", alignItems: "center", gap: 4, fontSize: 12,
                  color: overBudget ? V.danger : V.textSecondary,
                  fontWeight: overBudget ? 700 : 500,
                  cursor: "pointer",
                }}
                onClick={() => handleSliceClick(cat.key)}
                role="button"
                tabIndex={0}
                aria-label={`${cat.key}: ${fmtMoney(val)}${limit > 0 ? ` of ${fmtMoney(limit)} limit` : ""}`}
              >
                <span style={{
                  width: 10, height: 10, borderRadius: "50%", background: cat.color,
                  display: "inline-block", border: overBudget ? `2px solid ${V.danger}` : "none",
                }} />
                <span>{cat.emoji} {cat.key}</span>
                {overBudget && <span style={{ fontSize: 10 }}>(OVER)</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Dad/Mom Weeks Card ─── */}
      {custodySchedule && custodySchedule.length > 0 && (
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 700, color: V.textPrimary, marginBottom: 10 }}>
            Custody Spending Breakdown
          </div>
          <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
            <div style={{
              flex: 1, textAlign: "center", padding: 12, borderRadius: V.r2,
              background: V.accent + "12", border: `1px solid ${V.accent}44`,
            }}>
              <div style={{ fontSize: 12, color: V.textMuted, marginBottom: 4 }}>Dad Weeks</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: V.accent }}>{fmtMoney(dadTotal)}</div>
              <div style={{ fontSize: 11, color: V.textDim }}>{fmtMoney(dadAvg)}/day avg</div>
            </div>
            <div style={{
              flex: 1, textAlign: "center", padding: 12, borderRadius: V.r2,
              background: V.success + "12", border: `1px solid ${V.success}44`,
            }}>
              <div style={{ fontSize: 12, color: V.textMuted, marginBottom: 4 }}>Mom Weeks</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: V.success }}>{fmtMoney(momTotal)}</div>
              <div style={{ fontSize: 11, color: V.textDim }}>{fmtMoney(momAvg)}/day avg</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Transaction List ─── */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: V.textPrimary }}>
            Transactions {selectedCat ? `— ${selectedCat}` : ""}
            <span style={{ fontSize: 12, fontWeight: 400, color: V.textMuted, marginLeft: 8 }}>
              ({sortedTx.length})
            </span>
          </div>
        </div>

        {sortedTx.length === 0 && (
          <div style={{ textAlign: "center", color: V.textMuted, padding: 20, fontSize: 14 }}>
            No transactions this month.
          </div>
        )}

        {sortedTx.map((t) => {
          const catInfo = CAT_MAP[t.category] || CAT_MAP["Other"];
          const isAdmin = currentProfile === "Dad" || currentProfile === "Admin";
          return (
            <div
              key={t.id}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 0",
                borderBottom: `1px solid ${V.borderSubtle}`,
              }}
            >
              <span style={{ fontSize: 22, minWidth: 32, textAlign: "center" }}>{catInfo.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: V.textPrimary, display: "flex", alignItems: "center", gap: 6 }}>
                  {t.store || "Unknown"}
                  {t.recurring && <span title="Recurring monthly" style={{ fontSize: 12 }}>🔁</span>}
                </div>
                <div style={{ fontSize: 12, color: V.textMuted }}>
                  {catInfo.key} · {fmtDate(t.date)}
                  {t.note ? ` · ${t.note}` : ""}
                </div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: V.textPrimary, whiteSpace: "nowrap" }}>
                {fmtMoney(t.amount)}
              </div>
              {isAdmin && (
                <button
                  style={{
                    background: V.danger + "18",
                    color: V.danger,
                    border: `1px solid ${V.danger}44`,
                    borderRadius: V.r2,
                    padding: "6px 10px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    minHeight: 44,
                    minWidth: 44,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onClick={() => deleteTransaction(t.id)}
                  aria-label={`Delete transaction: ${t.store} ${fmtMoney(t.amount)}`}
                >
                  Delete
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Budget Settings ─── */}
      <div style={cardStyle}>
        <button
          style={{
            ...btnSecondary,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
          onClick={() => setShowSettings(!showSettings)}
          aria-expanded={showSettings}
          aria-label="Toggle monthly budget limits"
        >
          <span style={{ fontWeight: 700 }}>Monthly Budget Limits</span>
          <span style={{ fontSize: 18 }}>{showSettings ? "▲" : "▼"}</span>
        </button>

        {showSettings && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {CATEGORIES.map((cat) => {
              const currentVal = categoryBudgets[cat.key] || "";
              const spent = categoryTotals[cat.key] || 0;
              const limit = Number(currentVal) || 0;
              const overBudget = limit > 0 && spent > limit;
              return (
                <div key={cat.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18, minWidth: 28, textAlign: "center" }}>{cat.emoji}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: V.textPrimary, minWidth: 100 }}>
                    {cat.key}
                  </span>
                  <input
                    type="number"
                    style={{
                      ...inputStyle,
                      flex: "0 0 90px",
                      textAlign: "right",
                      borderColor: overBudget ? V.danger : V.borderDefault,
                    }}
                    value={currentVal}
                    placeholder="0"
                    min={0}
                    onChange={(e) => saveBudgetLimit(cat.key, e.target.value)}
                    aria-label={`Budget limit for ${cat.key}`}
                  />
                  {limit > 0 && (
                    <span style={{
                      fontSize: 11,
                      color: overBudget ? V.danger : V.textMuted,
                      fontWeight: overBudget ? 700 : 400,
                      whiteSpace: "nowrap",
                    }}>
                      {fmtMoney(spent)}/{fmtMoney(limit)}
                      {overBudget ? " OVER" : ""}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Export Button ─── */}
      <button
        style={{ ...btnSecondary, width: "100%", textAlign: "center", marginBottom: V.sp4 }}
        onClick={copyExport}
        aria-label="Copy budget summary to clipboard"
      >
        📋 Copy Summary
      </button>
    </div>
  );
}
