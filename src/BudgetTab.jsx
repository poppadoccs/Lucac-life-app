import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { groqFetch, parseGroqJSON, cacheGet, cacheSet, SWATCH_COLORS } from "./utils";

// ═══ CONSTANTS ═══

const PRESET_CATEGORIES = [
  { key: "Groceries", emoji: "\u{1F6D2}", color: "#22c55e" },
  { key: "Kids", emoji: "\u{1F476}", color: "#3b82f6" },
  { key: "Transport", emoji: "\u{1F697}", color: "#f97316" },
  { key: "Bills", emoji: "\u{1F4A1}", color: "#eab308" },
  { key: "Eating Out", emoji: "\u{1F354}", color: "#ef4444" },
  { key: "Tools/Work", emoji: "\u{1F527}", color: "#6b7280" },
  { key: "Entertainment", emoji: "\u{1F3AE}", color: "#7c3aed" },
  { key: "Chicken Wings", emoji: "\u{1F357}", color: "#f59e0b" },
  { key: "Other", emoji: "\u{1F4E6}", color: "#14b8a6" },
];

const EMOJI_PICKS = [
  "\u{1F3E0}", "\u{1F4B0}", "\u{2764}\u{FE0F}", "\u{1F381}", "\u{1F4DA}",
  "\u{1F3CB}\u{FE0F}", "\u{2615}", "\u{1F48A}", "\u{1F6CD}\u{FE0F}", "\u{1F3B5}",
  "\u{1F4BB}", "\u{2708}\u{FE0F}", "\u{1F436}", "\u{1F431}", "\u{1F37D}\u{FE0F}",
  "\u{1F9F9}", "\u{1F6BF}", "\u{1F4F1}", "\u{1F3A8}", "\u{1F48E}",
];

const PERIOD_OPTIONS = [
  { key: "weekly", label: "Weekly" },
  { key: "biweekly", label: "Bi-weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

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

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Advance a YYYY-MM-DD date string by one frequency unit
function advanceDate(dateStr, frequency) {
  const d = new Date(dateStr + "T00:00:00");
  if (frequency === "weekly")       d.setDate(d.getDate() + 7);
  else if (frequency === "monthly") d.setMonth(d.getMonth() + 1);
  else if (frequency === "yearly")  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

// ═══ DATE PERIOD HELPERS ═══

function getWeekRange(date) {
  const d = new Date(date + "T00:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d);
  start.setDate(diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
  };
}

function getBiweeklyRange(date) {
  const d = new Date(date + "T00:00:00");
  const year = d.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((d - startOfYear) / 86400000);
  const biweekIndex = Math.floor(dayOfYear / 14);
  const start = new Date(startOfYear);
  start.setDate(start.getDate() + biweekIndex * 14);
  const end = new Date(start);
  end.setDate(start.getDate() + 13);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
  };
}

function getMonthRange(date) {
  const d = new Date(date + "T00:00:00");
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  };
}

function getYearRange(date) {
  const d = new Date(date + "T00:00:00");
  const y = d.getFullYear();
  return {
    start: `${y}-01-01`,
    end: `${y}-12-31`,
    label: `${y}`,
  };
}

function getPreviousPeriodRange(period, currentRange) {
  const startDate = new Date(currentRange.start + "T00:00:00");
  if (period === "weekly") {
    startDate.setDate(startDate.getDate() - 7);
    return getWeekRange(startDate.toISOString().slice(0, 10));
  }
  if (period === "biweekly") {
    startDate.setDate(startDate.getDate() - 14);
    return getBiweeklyRange(startDate.toISOString().slice(0, 10));
  }
  if (period === "monthly") {
    startDate.setMonth(startDate.getMonth() - 1);
    return getMonthRange(startDate.toISOString().slice(0, 10));
  }
  startDate.setFullYear(startDate.getFullYear() - 1);
  return getYearRange(startDate.toISOString().slice(0, 10));
}

function getRangeForPeriod(period, date) {
  switch (period) {
    case "weekly": return getWeekRange(date);
    case "biweekly": return getBiweeklyRange(date);
    case "monthly": return getMonthRange(date);
    case "yearly": return getYearRange(date);
    default: return getMonthRange(date);
  }
}

// ═══ DONUT CHART ═══

function DonutChart({ allCategories, catMap, categoryTotals, totalSpent, budgetLimit, V, onSliceClick, selectedCat }) {
  const [hoverCat, setHoverCat] = useState(null);
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 80;
  const strokeWidth = 32;
  const circumference = 2 * Math.PI * radius;

  const slices = [];
  let accumulated = 0;
  for (const cat of allCategories) {
    const val = categoryTotals[cat.key] || 0;
    if (val <= 0) continue;
    const fraction = totalSpent > 0 ? val / totalSpent : 0;
    const pct = (fraction * 100).toFixed(1);
    const dashLen = fraction * circumference;
    const gapLen = circumference - dashLen;
    const rotation = totalSpent > 0 ? (accumulated / totalSpent) * 360 - 90 : -90;
    accumulated += val;
    const isSelected = selectedCat === cat.key;
    const isHovered = hoverCat === cat.key;
    slices.push(
      <circle
        key={cat.key}
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={cat.color}
        strokeWidth={isSelected || isHovered ? strokeWidth + 6 : strokeWidth}
        strokeDasharray={`${dashLen} ${gapLen}`}
        transform={`rotate(${rotation} ${cx} ${cy})`}
        style={{
          cursor: "pointer",
          opacity: selectedCat && !isSelected ? 0.35 : 1,
          transition: "all 0.3s ease",
        }}
        onClick={() => onSliceClick(cat.key)}
        onMouseEnter={() => setHoverCat(cat.key)}
        onMouseLeave={() => setHoverCat(null)}
        onTouchStart={() => setHoverCat(cat.key)}
        onTouchEnd={() => setTimeout(() => setHoverCat(null), 1500)}
        aria-label={`${cat.emoji} ${cat.key}: ${fmtMoney(val)} (${pct}%)`}
      />
    );
  }

  const displayCat = hoverCat || selectedCat;
  const displayInfo = displayCat ? catMap[displayCat] : null;
  const displayVal = displayCat ? (categoryTotals[displayCat] || 0) : totalSpent;
  const displayPct = displayCat && totalSpent > 0 ? ((displayVal / totalSpent) * 100).toFixed(1) + "%" : "";

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Budget donut chart">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke={V.borderSubtle} strokeWidth={strokeWidth} opacity={0.3} />
        {slices}
        {displayCat ? (
          <>
            <text x={cx} y={cy - 16} textAnchor="middle" dominantBaseline="middle"
              style={{ fontSize: 18, fill: V.textPrimary }}>{displayInfo?.emoji || ""}</text>
            <text x={cx} y={cy + 4} textAnchor="middle" dominantBaseline="middle"
              style={{ fontSize: 14, fontWeight: 700, fill: V.textPrimary }}>{fmtMoney(displayVal)}</text>
            <text x={cx} y={cy + 22} textAnchor="middle" dominantBaseline="middle"
              style={{ fontSize: 11, fill: V.textMuted }}>{displayPct}</text>
          </>
        ) : (
          <>
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
                style={{ fontSize: 11, fontWeight: 700, fill: "#f97316" }}>
                ABOVE TARGET
              </text>
            )}
          </>
        )}
      </svg>
    </div>
  );
}

// ═══ MONTHLY TREND BAR CHART ═══

function MonthlyTrendChart({ transactions, V }) {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const start = new Date(y, m, 1).toISOString().slice(0, 10);
    const end   = new Date(y, m + 1, 0).toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-US", { month: "short" });
    const total = transactions
      .filter((t) => t.date >= start && t.date <= end)
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    months.push({ label, total });
  }

  const maxVal = Math.max(...months.map((m) => m.total), 1);
  const svgH = 120;
  const barW = 32;
  const barGap = 8;
  const padT = 20;
  const padB = 24;
  const svgW = months.length * (barW + barGap) + barGap;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        width="100%"
        viewBox={`0 0 ${svgW} ${svgH}`}
        role="img"
        aria-label="Monthly spending trend bar chart"
        style={{ display: "block", minWidth: svgW }}
      >
        {months.map((m, i) => {
          const x    = barGap + i * (barW + barGap);
          const barH = m.total > 0
            ? Math.max(4, (m.total / maxVal) * (svgH - padT - padB))
            : 2;
          const y = svgH - padB - barH;
          const isCurrentMonth = i === 5;
          return (
            <g key={i}>
              <rect
                x={x} y={y} width={barW} height={barH}
                fill={isCurrentMonth ? V.accent : (V.accent + "88")}
                rx={3}
                aria-label={`${m.label}: ${fmtMoney(m.total)}`}
              />
              {m.total > 0 && (
                <text
                  x={x + barW / 2} y={Math.max(y - 3, padT - 2)}
                  textAnchor="middle"
                  style={{ fontSize: 9, fill: V.textSecondary, fontWeight: isCurrentMonth ? 700 : 400 }}
                >
                  {fmtMoney(m.total).replace("$", "$")}
                </text>
              )}
              <text
                x={x + barW / 2} y={svgH - 6}
                textAnchor="middle"
                style={{ fontSize: 10, fill: isCurrentMonth ? V.textPrimary : V.textMuted, fontWeight: isCurrentMonth ? 700 : 400 }}
              >
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ═══ MAIN COMPONENT ═══

export default function BudgetTab({ V, currentProfile, fbSet, GROQ_KEY, showToast, profiles, custodySchedule, budgetData, isAdmin }) {
  // ─── State ───
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedCat, setSelectedCat] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [period, setPeriod] = useState(() => cacheGet("budgetPeriod") || "monthly");
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualAmount, setManualAmount] = useState("");
  const [manualStore, setManualStore] = useState("");
  const [manualCategory, setManualCategory] = useState("Other");
  const [manualDate, setManualDate] = useState(todayStr());
  const [manualNote, setManualNote] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [showCatEditor, setShowCatEditor] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("\u{1F3E0}");
  const [newCatColor, setNewCatColor] = useState("#3b82f6");
  const [renamingCat, setRenamingCat] = useState(null);
  const [renameVal, setRenameVal] = useState("");
  const [aiMode, setAiMode] = useState("add"); // "add" | "ask"
  const [aiResponse, setAiResponse] = useState("");

  // ─── Recurring expenses ───
  const [showRecurring, setShowRecurring] = useState(false);
  const [recDescription, setRecDescription] = useState("");
  const [recAmount, setRecAmount] = useState("");
  const [recCategory, setRecCategory] = useState("Bills");
  const [recFrequency, setRecFrequency] = useState("monthly");
  const [recStartDate, setRecStartDate] = useState(() => todayStr());

  // ─── Derived data ───
  const transactions = budgetData?.transactions || [];
  const categoryBudgets = budgetData?.categoryBudgets || {};
  const customCategories = budgetData?.customCategories || [];
  const recurringExpenses = budgetData?.recurringExpenses || [];

  const allCategories = useMemo(() => {
    const customs = customCategories.map((c) => ({
      key: c.key,
      emoji: c.emoji || "\u{1F4E6}",
      color: c.color || "#6b7280",
      custom: true,
    }));
    return [...PRESET_CATEGORIES, ...customs];
  }, [customCategories]);

  const catMap = useMemo(() => {
    const m = {};
    allCategories.forEach((c) => { m[c.key] = c; });
    return m;
  }, [allCategories]);

  // Period range
  const today = todayStr();
  const currentRange = useMemo(() => getRangeForPeriod(period, today), [period, today]);
  const prevRange = useMemo(() => getPreviousPeriodRange(period, currentRange), [period, currentRange]);

  // Save period pref
  useEffect(() => { cacheSet("budgetPeriod", period); }, [period]);

  // Filter transactions by period
  const periodTx = useMemo(() =>
    transactions.filter((t) => t.date && t.date >= currentRange.start && t.date <= currentRange.end),
    [transactions, currentRange]
  );
  const prevPeriodTx = useMemo(() =>
    transactions.filter((t) => t.date && t.date >= prevRange.start && t.date <= prevRange.end),
    [transactions, prevRange]
  );

  // Category totals
  const categoryTotals = useMemo(() => {
    const totals = {};
    for (const t of periodTx) {
      const cat = t.category || "Other";
      totals[cat] = (totals[cat] || 0) + (Number(t.amount) || 0);
    }
    return totals;
  }, [periodTx]);

  const totalSpent = useMemo(() =>
    periodTx.reduce((s, t) => s + (Number(t.amount) || 0), 0),
    [periodTx]
  );

  const prevTotalSpent = useMemo(() =>
    prevPeriodTx.reduce((s, t) => s + (Number(t.amount) || 0), 0),
    [prevPeriodTx]
  );

  // Budget limit - scale to period
  const monthlyBudget = useMemo(() => {
    let total = 0;
    for (const cat of allCategories) {
      total += Number(categoryBudgets[cat.key]) || 0;
    }
    return total || 2000;
  }, [allCategories, categoryBudgets]);

  const budgetLimit = useMemo(() => {
    if (period === "weekly") return monthlyBudget / 4.33;
    if (period === "biweekly") return monthlyBudget / 2.17;
    if (period === "yearly") return monthlyBudget * 12;
    return monthlyBudget;
  }, [period, monthlyBudget]);

  // Safe to spend (PocketGuard-inspired)
  const safeToSpend = budgetLimit - totalSpent;
  const daysLeftInPeriod = useMemo(() => {
    const end = new Date(currentRange.end + "T00:00:00");
    const now = new Date();
    return Math.max(0, Math.ceil((end - now) / 86400000));
  }, [currentRange.end]);
  const safePerDay = daysLeftInPeriod > 0 ? safeToSpend / daysLeftInPeriod : 0;

  // Biggest category
  const biggestCategory = useMemo(() => {
    let maxK = null, maxV = 0;
    for (const [k, v] of Object.entries(categoryTotals)) {
      if (v > maxV) { maxK = k; maxV = v; }
    }
    return maxK;
  }, [categoryTotals]);

  // Filtered + sorted transactions
  const displayTx = selectedCat ? periodTx.filter((t) => t.category === selectedCat) : periodTx;
  const sortedTx = [...displayTx].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  // ─── Custody / Dad vs Mom ───
  function getCustodyParent(dateStr) {
    if (!custodySchedule) return null;
    // Support object format: { "Monday": "Dad", "Tuesday": "Mom", ... }
    if (typeof custodySchedule === "object" && !Array.isArray(custodySchedule)) {
      const d = new Date(dateStr + "T00:00:00");
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayName = dayNames[d.getDay()];
      const val = custodySchedule[dayName];
      if (val === "Dad" || val === "Mom") return val;
      return null;
    }
    // Support array format: [{start, end, parent}]
    if (Array.isArray(custodySchedule)) {
      for (const block of custodySchedule) {
        if (dateStr >= block.start && dateStr <= block.end) return block.parent;
      }
    }
    return null;
  }

  const custodyStats = useMemo(() => {
    let dadTotal = 0, momTotal = 0, dadDays = new Set(), momDays = new Set();
    for (const t of periodTx) {
      const parent = getCustodyParent(t.date);
      if (parent === "Dad") {
        dadTotal += Number(t.amount) || 0;
        dadDays.add(t.date);
      } else if (parent === "Mom") {
        momTotal += Number(t.amount) || 0;
        momDays.add(t.date);
      }
    }
    return {
      dadTotal, momTotal,
      dadAvg: dadDays.size > 0 ? dadTotal / dadDays.size : 0,
      momAvg: momDays.size > 0 ? momTotal / momDays.size : 0,
      hasCustody: dadDays.size > 0 || momDays.size > 0,
    };
  }, [periodTx, custodySchedule]);

  // ─── Firebase save helper ───
  function saveBudget(patch) {
    fbSet("budgetData", { ...budgetData, transactions, categoryBudgets, customCategories, recurringExpenses, ...patch });
  }

  // ─── Auto-process recurring expenses on load ───
  // When a recurring entry's nextDate <= today, auto-add transaction + advance nextDate.
  // Safe: after Firebase writes, nextDates advance → effect re-runs but finds nothing due.
  useEffect(() => {
    if (!budgetData) return;
    const todayDate = todayStr();
    const currentRE = budgetData.recurringExpenses || [];
    const due = currentRE.filter((re) => re.nextDate && re.nextDate <= todayDate);
    if (due.length === 0) return;
    const newTx = [...(budgetData.transactions || [])];
    const updatedRE = currentRE.map((re) => {
      if (!re.nextDate || re.nextDate > todayDate) return re;
      newTx.push({
        id: uid(), amount: re.amount, store: re.description,
        category: re.category, date: re.nextDate,
        note: "Auto-recurring", recurring: true,
      });
      return { ...re, nextDate: advanceDate(re.nextDate, re.frequency) };
    });
    fbSet("budgetData", { ...budgetData, transactions: newTx, recurringExpenses: updatedRE });
  }, [budgetData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Category management ───
  function addCustomCategory() {
    const name = newCatName.trim();
    if (!name) { showToast("Enter a category name"); return; }
    if (catMap[name]) { showToast("Category already exists"); return; }
    const updated = [...customCategories, { key: name, emoji: newCatEmoji, color: newCatColor }];
    saveBudget({ customCategories: updated });
    setNewCatName("");
    setNewCatEmoji("\u{1F3E0}");
    setNewCatColor("#3b82f6");
    showToast(`Added category: ${newCatEmoji} ${name}`);
  }

  function deleteCustomCategory(catKey) {
    const updated = customCategories.filter((c) => c.key !== catKey);
    const updatedTx = transactions.map((t) =>
      t.category === catKey ? { ...t, category: "Other" } : t
    );
    saveBudget({ customCategories: updated, transactions: updatedTx });
    if (selectedCat === catKey) setSelectedCat(null);
    showToast(`Removed "${catKey}" - transactions moved to Other`);
  }

  function renameCategory(oldKey, newKey) {
    const trimmed = newKey.trim();
    if (!trimmed || trimmed === oldKey) { setRenamingCat(null); return; }
    if (catMap[trimmed]) { showToast("Name already in use"); return; }
    const updatedCats = customCategories.map((c) =>
      c.key === oldKey ? { ...c, key: trimmed } : c
    );
    const updatedTx = transactions.map((t) =>
      t.category === oldKey ? { ...t, category: trimmed } : t
    );
    const updatedBudgets = { ...categoryBudgets };
    if (updatedBudgets[oldKey] !== undefined) {
      updatedBudgets[trimmed] = updatedBudgets[oldKey];
      delete updatedBudgets[oldKey];
    }
    saveBudget({ customCategories: updatedCats, transactions: updatedTx, categoryBudgets: updatedBudgets });
    if (selectedCat === oldKey) setSelectedCat(trimmed);
    setRenamingCat(null);
    showToast(`Renamed to "${trimmed}"`);
  }

  // ─── Groq AI ───
  const allCatNames = allCategories.map((c) => c.key).join(", ");

  async function handleAIInput() {
    if (!inputText.trim() || loading) return;
    setLoading(true);
    setAiResponse("");

    if (aiMode === "ask") {
      await handleAIQuery();
      return;
    }

    const sysPrompt = `Extract expense data from text. Return JSON: {"amount": number, "store": string, "category": string, "date": "YYYY-MM-DD", "note": string}. Categories: ${allCatNames}. Today is ${today}. If unclear, pick the closest category. Return only JSON, no explanation.`;
    const result = await groqFetch(GROQ_KEY, [
      { role: "system", content: sysPrompt },
      { role: "user", content: inputText },
    ]);
    setLoading(false);
    if (!result.ok) { showToast(result.error || "AI error"); return; }
    const parsed = parseGroqJSON(result.data);
    if (!parsed || typeof parsed.amount !== "number") {
      showToast("Could not understand that. Try: 'spent $47 at Walmart on groceries'");
      return;
    }
    if (!parsed.date) parsed.date = today;
    if (!parsed.category || !catMap[parsed.category]) parsed.category = "Other";
    if (!parsed.store) parsed.store = "Unknown";
    if (!parsed.note) parsed.note = "";
    setPreview(parsed);
  }

  async function handleAIQuery() {
    const txSummary = allCategories.map((c) => {
      const total = categoryTotals[c.key] || 0;
      return total > 0 ? `${c.emoji} ${c.key}: $${total.toFixed(2)}` : null;
    }).filter(Boolean).join("\n");

    const top5 = [...periodTx].sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0)).slice(0, 5);
    const topStr = top5.map((t) => `${t.store}: $${Number(t.amount).toFixed(2)} (${t.category})`).join("\n");

    const sysPrompt = `You are a helpful budget assistant. The user has a ${period} budget of $${budgetLimit.toFixed(2)}. They've spent $${totalSpent.toFixed(2)} this period (${currentRange.label}).

Category breakdown:
${txSummary}

Top 5 expenses:
${topStr}

Previous period total: $${prevTotalSpent.toFixed(2)}
Categories available: ${allCatNames}

Answer naturally and concisely. If asked to organize, group by category and find patterns. If asked about spending, analyze honestly. You can suggest budget amounts based on spending patterns. Keep response under 200 words.`;

    const result = await groqFetch(GROQ_KEY, [
      { role: "system", content: sysPrompt },
      { role: "user", content: inputText },
    ], { maxTokens: 600 });
    setLoading(false);
    if (!result.ok) { showToast(result.error || "AI error"); return; }
    setAiResponse(result.data);
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
    saveBudget({ transactions: updated });
    setPreview(null);
    setInputText("");
    setRecurring(false);
    showToast(`Added ${fmtMoney(preview.amount)} at ${preview.store}`);
  }

  function cancelPreview() { setPreview(null); }

  // ─── Manual add ───
  function handleManualAdd() {
    const amt = parseFloat(manualAmount);
    if (!amt || amt <= 0) { showToast("Enter a valid amount"); return; }
    const newTx = {
      id: uid(),
      amount: amt,
      store: manualStore.trim() || "Manual",
      category: manualCategory,
      date: manualDate || today,
      note: manualNote.trim(),
      recurring: false,
    };
    const updated = [...transactions, newTx];
    saveBudget({ transactions: updated });
    setManualAmount("");
    setManualStore("");
    setManualCategory("Other");
    setManualDate(todayStr());
    setManualNote("");
    showToast(`Added ${fmtMoney(amt)}`);
  }

  // ─── Delete ───
  function deleteTransaction(id) {
    const updated = transactions.filter((t) => t.id !== id);
    saveBudget({ transactions: updated });
    showToast("Transaction deleted");
  }

  function handleBulkDelete() {
    if (bulkSelected.size === 0) return;
    const updated = transactions.filter((t) => !bulkSelected.has(t.id));
    saveBudget({ transactions: updated });
    showToast(`Deleted ${bulkSelected.size} transaction${bulkSelected.size > 1 ? "s" : ""}`);
    setBulkSelected(new Set());
    setBulkMode(false);
    setShowBulkConfirm(false);
  }

  function toggleBulkItem(id) {
    const next = new Set(bulkSelected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setBulkSelected(next);
  }

  // ─── Recurring expense management ───
  function addRecurringExpense() {
    const amt = parseFloat(recAmount);
    if (!amt || amt <= 0) { showToast("Enter a valid amount"); return; }
    const desc = recDescription.trim();
    if (!desc) { showToast("Enter a description"); return; }
    const newRE = {
      id: uid(), description: desc, amount: amt,
      category: recCategory, frequency: recFrequency, nextDate: recStartDate,
    };
    saveBudget({ recurringExpenses: [...recurringExpenses, newRE] });
    setRecDescription(""); setRecAmount(""); setRecFrequency("monthly"); setRecStartDate(todayStr());
    showToast(`Added recurring: ${desc}`);
  }

  function deleteRecurringExpense(id) {
    saveBudget({ recurringExpenses: recurringExpenses.filter((re) => re.id !== id) });
    showToast("Recurring expense removed");
  }

  // ─── CSV export ───
  function downloadCSV() {
    const rows = [
      ["Date", "Store", "Category", "Amount", "Note", "Recurring"],
      ...sortedTx.map((t) => [
        t.date || "",
        `"${(t.store || "").replace(/"/g, '""')}"`,
        t.category || "Other",
        (Number(t.amount) || 0).toFixed(2),
        `"${(t.note || "").replace(/"/g, '""')}"`,
        t.recurring ? "Yes" : "No",
      ]),
    ];
    const csvText = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvText], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget-${currentRange.label.replace(/[^a-zA-Z0-9]/g, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("CSV downloaded!");
  }

  // ─── Budget limits ───
  function saveBudgetLimit(catKey, value) {
    const newBudgets = { ...categoryBudgets, [catKey]: Number(value) || 0 };
    saveBudget({ categoryBudgets: newBudgets });
  }

  function handleSliceClick(catKey) {
    setSelectedCat(selectedCat === catKey ? null : catKey);
  }

  // ─── Export ───
  function copyExport() {
    const lines = [
      `LUCAC Budget Summary`,
      `Period: ${currentRange.label} (${period})`,
      `Total Spent: ${fmtMoney(totalSpent)} / ${fmtMoney(budgetLimit)}`,
      "",
      "Category Breakdown:",
    ];
    for (const cat of allCategories) {
      const total = categoryTotals[cat.key];
      if (total > 0) {
        const limit = Number(categoryBudgets[cat.key]) || 0;
        const limitStr = limit > 0 ? ` (limit: ${fmtMoney(limit)})` : "";
        lines.push(`  ${cat.emoji} ${cat.key}: ${fmtMoney(total)}${limitStr}`);
      }
    }
    if (biggestCategory) {
      lines.push("", `Biggest category: ${catMap[biggestCategory]?.emoji || ""} ${biggestCategory} (${fmtMoney(categoryTotals[biggestCategory])})`);
    }
    const diff = totalSpent - prevTotalSpent;
    lines.push(`vs previous period: ${diff >= 0 ? "+" : "-"}${fmtMoney(Math.abs(diff))}`);
    lines.push("", "Top Expenses:");
    const top = [...periodTx].sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0)).slice(0, 5);
    for (const t of top) {
      const ci = catMap[t.category] || catMap["Other"];
      lines.push(`  ${fmtDate(t.date)} ${ci.emoji} ${t.store} - ${fmtMoney(t.amount)}`);
    }
    if (custodyStats.hasCustody) {
      lines.push("", "Custody Breakdown:");
      lines.push(`  Dad days: ${fmtMoney(custodyStats.dadTotal)} (${fmtMoney(custodyStats.dadAvg)}/day avg)`);
      lines.push(`  Mom days: ${fmtMoney(custodyStats.momTotal)} (${fmtMoney(custodyStats.momAvg)}/day avg)`);
    }
    lines.push("", "Transactions:");
    for (const t of sortedTx) {
      const ci = catMap[t.category] || catMap["Other"];
      lines.push(`  ${fmtDate(t.date)} ${ci.emoji} ${t.store} - ${fmtMoney(t.amount)}${t.recurring ? " (recurring)" : ""}`);
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

  const btnDanger = {
    background: "#f9731618",
    color: "#f97316",
    border: "1px solid #f9731644",
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

  const pillContainer = {
    display: "flex",
    background: V.bgInput,
    borderRadius: 24,
    padding: 3,
    gap: 2,
    marginBottom: V.sp3,
  };

  function pillStyle(active) {
    return {
      flex: 1,
      padding: "10px 8px",
      borderRadius: 22,
      border: "none",
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
      textAlign: "center",
      minHeight: 44,
      background: active ? V.accent : "transparent",
      color: active ? "#fff" : V.textMuted,
      transition: "all 0.2s ease",
    };
  }

  const progressBarBg = {
    height: 8,
    borderRadius: 4,
    background: V.bgInput,
    overflow: "hidden",
    flex: 1,
  };

  // ═══ RENDER ═══

  return (
    <div style={{ padding: V.sp3, maxWidth: 600, margin: "0 auto" }}>

      {/* ─── Period Toggle Pills ─── */}
      <div style={pillContainer}>
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            style={pillStyle(period === opt.key)}
            onClick={() => setPeriod(opt.key)}
            aria-label={`View ${opt.label}`}
            aria-pressed={period === opt.key}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Period label */}
      <div style={{ textAlign: "center", fontSize: 14, fontWeight: 600, color: V.textSecondary, marginBottom: V.sp3 }}>
        {currentRange.label}
      </div>

      {/* ─── Summary Card ─── */}
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 700, color: V.textPrimary, marginBottom: 10 }}>
          {period === "weekly" || period === "biweekly" ? "Period" : period === "yearly" ? "Year" : "Month"} Summary
        </div>

        {/* Total + biggest + vs last period */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{
            flex: "1 1 120px", padding: 12, borderRadius: V.r2,
            background: V.accent + "12", border: `1px solid ${V.accent}33`, textAlign: "center",
          }}>
            <div style={{ fontSize: 11, color: V.textMuted, marginBottom: 2 }}>Total Spent</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: V.accent }}>{fmtMoney(totalSpent)}</div>
          </div>
          {biggestCategory && (
            <div style={{
              flex: "1 1 120px", padding: 12, borderRadius: V.r2,
              background: (catMap[biggestCategory]?.color || "#6b7280") + "12",
              border: `1px solid ${(catMap[biggestCategory]?.color || "#6b7280")}33`, textAlign: "center",
            }}>
              <div style={{ fontSize: 11, color: V.textMuted, marginBottom: 2 }}>Biggest</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: V.textPrimary }}>
                {catMap[biggestCategory]?.emoji} {biggestCategory}
              </div>
              <div style={{ fontSize: 12, color: V.textMuted }}>{fmtMoney(categoryTotals[biggestCategory])}</div>
            </div>
          )}
          <div style={{
            flex: "1 1 120px", padding: 12, borderRadius: V.r2,
            background: V.bgInput, border: `1px solid ${V.borderSubtle}`, textAlign: "center",
          }}>
            <div style={{ fontSize: 11, color: V.textMuted, marginBottom: 2 }}>vs Last {period === "yearly" ? "Year" : period === "monthly" ? "Month" : "Period"}</div>
            {(() => {
              const diff = totalSpent - prevTotalSpent;
              const up = diff >= 0;
              return (
                <div style={{ fontSize: 16, fontWeight: 700, color: up ? "#f97316" : V.success }}>
                  {up ? "+" : "-"}{fmtMoney(Math.abs(diff))}
                </div>
              );
            })()}
          </div>
          {budgetLimit > 0 && (
            <div style={{
              flex: "1 1 120px", padding: 12, borderRadius: V.r2,
              background: safeToSpend >= 0 ? (V.success || "#22c55e") + "12" : "#f9731612",
              border: `1px solid ${safeToSpend >= 0 ? (V.success || "#22c55e") + "44" : "#f9731644"}`,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 11, color: V.textMuted, marginBottom: 2 }}>Safe to Spend</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: safeToSpend >= 0 ? V.success || "#22c55e" : "#f97316" }}>
                {safeToSpend >= 0 ? fmtMoney(safeToSpend) : "-" + fmtMoney(Math.abs(safeToSpend))}
              </div>
              {daysLeftInPeriod > 0 && (
                <div style={{ fontSize: 10, color: V.textMuted }}>
                  {safePerDay >= 0 ? fmtMoney(safePerDay) : "-" + fmtMoney(Math.abs(safePerDay))}/day · {daysLeftInPeriod}d left
                </div>
              )}
            </div>
          )}
        </div>

        {/* Per-category progress bars */}
        {(period === "monthly" || period === "yearly") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {allCategories.map((cat) => {
              const spent = categoryTotals[cat.key] || 0;
              if (spent <= 0) return null;
              const limit = Number(categoryBudgets[cat.key]) || 0;
              if (limit <= 0) return null;
              const pct = Math.min((spent / limit) * 100, 100);
              const over = spent > limit;
              return (
                <div key={cat.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, minWidth: 24, textAlign: "center" }}>{cat.emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: V.textSecondary, minWidth: 80 }}>{cat.key}</span>
                  <div style={progressBarBg}>
                    <div style={{
                      height: "100%",
                      width: `${pct}%`,
                      borderRadius: 4,
                      background: over ? "#f97316" : cat.color,
                      transition: "width 0.3s ease",
                    }} />
                  </div>
                  <span style={{ fontSize: 11, color: over ? "#f97316" : V.textMuted, fontWeight: over ? 700 : 400, minWidth: 80, textAlign: "right" }}>
                    {fmtMoney(spent)}/{fmtMoney(limit)}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: over ? "#f97316" : V.success, minWidth: 60 }}>
                    {over ? "Above target" : "On track"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── AI Input Bar ─── */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: V.textPrimary, flex: 1 }}>
            AI Assistant
          </div>
          {/* AI mode toggle */}
          <div style={{ display: "flex", background: V.bgInput, borderRadius: 16, padding: 2 }}>
            <button
              style={{
                padding: "6px 12px", borderRadius: 14, border: "none", fontSize: 12, fontWeight: 600,
                cursor: "pointer", minHeight: 32,
                background: aiMode === "add" ? V.accent : "transparent",
                color: aiMode === "add" ? "#fff" : V.textMuted,
              }}
              onClick={() => { setAiMode("add"); setAiResponse(""); }}
              aria-label="AI add expense mode"
              aria-pressed={aiMode === "add"}
            >
              Add
            </button>
            <button
              style={{
                padding: "6px 12px", borderRadius: 14, border: "none", fontSize: 12, fontWeight: 600,
                cursor: "pointer", minHeight: 32,
                background: aiMode === "ask" ? V.accent : "transparent",
                color: aiMode === "ask" ? "#fff" : V.textMuted,
              }}
              onClick={() => { setAiMode("ask"); setPreview(null); }}
              aria-label="AI ask about budget mode"
              aria-pressed={aiMode === "ask"}
            >
              Ask
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={inputStyle}
            placeholder={aiMode === "add"
              ? 'e.g. "spent $47 at Walmart on groceries"'
              : 'e.g. "What am I spending most on?"'}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAIInput()}
            aria-label={aiMode === "add" ? "Describe your expense" : "Ask about your budget"}
          />
          <button
            style={{ ...btnPrimary, opacity: loading ? 0.6 : 1, whiteSpace: "nowrap" }}
            onClick={handleAIInput}
            disabled={loading}
            aria-label="Send to AI"
          >
            {loading ? "..." : aiMode === "add" ? "Add" : "Ask"}
          </button>
        </div>

        {/* Recurring toggle (only in add mode) */}
        {aiMode === "add" && (
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
              Recurring {recurring ? "(ON)" : "(OFF)"}
            </button>
          </div>
        )}

        {/* AI Response (ask mode) */}
        {aiResponse && (
          <div style={{
            marginTop: 14, padding: 14,
            background: V.bgElevated || V.bgCardAlt || V.bgApp,
            borderRadius: V.r2,
            border: `1px solid ${V.accent}44`,
            fontSize: 14, color: V.textPrimary, lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}>
            {aiResponse}
          </div>
        )}

        {/* Preview Card (add mode) */}
        {preview && (
          <div style={{
            marginTop: 14, padding: 14,
            background: V.bgElevated || V.bgCardAlt || V.bgApp,
            borderRadius: V.r2,
            border: `2px solid ${V.accent}`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: V.accent, marginBottom: 8 }}>
              Preview - Confirm this expense?
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 14, color: V.textPrimary }}>
              <span style={{ fontWeight: 600 }}>Amount:</span>
              <span>{fmtMoney(preview.amount)}</span>
              <span style={{ fontWeight: 600 }}>Store:</span>
              <span>{preview.store}</span>
              <span style={{ fontWeight: 600 }}>Category:</span>
              <span>{(catMap[preview.category]?.emoji || "\u{1F4E6}")} {preview.category}</span>
              <span style={{ fontWeight: 600 }}>Date:</span>
              <span>{preview.date}</span>
              {preview.note && <>
                <span style={{ fontWeight: 600 }}>Note:</span>
                <span>{preview.note}</span>
              </>}
              {recurring && <>
                <span style={{ fontWeight: 600 }}>Recurring:</span>
                <span>Monthly</span>
              </>}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button style={btnPrimary} onClick={confirmPreview} aria-label="Confirm expense">Confirm</button>
              <button style={btnSecondary} onClick={cancelPreview} aria-label="Cancel expense">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Manual Add Form ─── */}
      <div style={cardStyle}>
        <button
          style={{ ...btnSecondary, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}
          onClick={() => setShowManualForm(!showManualForm)}
          aria-expanded={showManualForm}
          aria-label="Toggle manual add form"
        >
          <span style={{ fontWeight: 700 }}>Manual Add</span>
          <span style={{ fontSize: 18 }}>{showManualForm ? "\u25B2" : "\u25BC"}</span>
        </button>
        {showManualForm && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={{ ...inputStyle, flex: "0 0 100px" }}
                type="number"
                placeholder="Amount"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                min="0"
                step="0.01"
                aria-label="Amount"
              />
              <input
                style={inputStyle}
                placeholder="Store name"
                value={manualStore}
                onChange={(e) => setManualStore(e.target.value)}
                aria-label="Store"
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <select
                style={{ ...inputStyle, flex: "1 1 auto" }}
                value={manualCategory}
                onChange={(e) => setManualCategory(e.target.value)}
                aria-label="Category"
              >
                {allCategories.map((c) => (
                  <option key={c.key} value={c.key}>{c.emoji} {c.key}</option>
                ))}
              </select>
              <input
                style={{ ...inputStyle, flex: "0 0 140px" }}
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                aria-label="Date"
              />
            </div>
            <input
              style={inputStyle}
              placeholder="Note (optional)"
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              aria-label="Note"
            />
            <button style={btnPrimary} onClick={handleManualAdd} aria-label="Add expense manually">
              Add Expense
            </button>
          </div>
        )}
      </div>

      {/* ─── Recurring Expenses ─── */}
      <div style={cardStyle}>
        <button
          style={{ ...btnSecondary, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}
          onClick={() => setShowRecurring(!showRecurring)}
          aria-expanded={showRecurring}
          aria-label="Toggle recurring expenses"
        >
          <span style={{ fontWeight: 700 }}>
            Recurring Expenses
            {recurringExpenses.length > 0 && (
              <span style={{ fontSize: 12, fontWeight: 400, color: V.textMuted, marginLeft: 8 }}>({recurringExpenses.length})</span>
            )}
          </span>
          <span style={{ fontSize: 18 }}>{showRecurring ? "\u25B2" : "\u25BC"}</span>
        </button>

        {showRecurring && (
          <div style={{ marginTop: 14 }}>
            {/* Add form */}
            <div style={{ fontSize: 13, fontWeight: 700, color: V.textPrimary, marginBottom: 8 }}>Add Recurring Expense</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <input
                style={{ ...inputStyle, flex: "1 1 140px" }}
                placeholder="Description (e.g. Spotify)"
                value={recDescription}
                onChange={(e) => setRecDescription(e.target.value)}
                aria-label="Recurring expense description"
              />
              <input
                style={{ ...inputStyle, flex: "0 0 90px" }}
                type="number"
                placeholder="Amount"
                value={recAmount}
                onChange={(e) => setRecAmount(e.target.value)}
                min="0"
                step="0.01"
                aria-label="Recurring amount"
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <select
                style={{ ...inputStyle, flex: "1 1 120px" }}
                value={recCategory}
                onChange={(e) => setRecCategory(e.target.value)}
                aria-label="Recurring category"
              >
                {allCategories.map((c) => (
                  <option key={c.key} value={c.key}>{c.emoji} {c.key}</option>
                ))}
              </select>
              <select
                style={{ ...inputStyle, flex: "0 0 120px" }}
                value={recFrequency}
                onChange={(e) => setRecFrequency(e.target.value)}
                aria-label="Frequency"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              <input
                style={{ ...inputStyle, flex: "0 0 140px" }}
                type="date"
                value={recStartDate}
                onChange={(e) => setRecStartDate(e.target.value)}
                aria-label="Next due date"
              />
            </div>
            <button style={btnPrimary} onClick={addRecurringExpense} aria-label="Add recurring expense">
              Add Recurring
            </button>

            {/* Existing recurring list */}
            {recurringExpenses.length > 0 && (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: V.textPrimary }}>Scheduled</div>
                {recurringExpenses.map((re) => {
                  const catInfo = catMap[re.category] || catMap["Other"];
                  return (
                    <div key={re.id} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                      background: V.bgInput, borderRadius: V.r2,
                    }}>
                      <span style={{ fontSize: 20 }}>{catInfo?.emoji || "\u{1F4E6}"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: V.textPrimary }}>{re.description}</div>
                        <div style={{ fontSize: 11, color: V.textMuted }}>
                          {re.category} · {re.frequency} · next: {fmtDate(re.nextDate)}
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: V.textPrimary, whiteSpace: "nowrap" }}>
                        {fmtMoney(re.amount)}
                      </div>
                      <button
                        style={btnDanger}
                        onClick={() => deleteRecurringExpense(re.id)}
                        aria-label={`Remove recurring ${re.description}`}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Category Chips ─── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: V.sp3 }}>
        {allCategories.map((cat) => {
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
            style={{ ...chipBase, background: "#f9731618", color: "#f97316", borderColor: "#f9731644" }}
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
          allCategories={allCategories}
          catMap={catMap}
          categoryTotals={categoryTotals}
          totalSpent={totalSpent}
          budgetLimit={budgetLimit}
          V={V}
          onSliceClick={handleSliceClick}
          selectedCat={selectedCat}
        />
        {/* Legend */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 }}>
          {allCategories.map((cat) => {
            const val = categoryTotals[cat.key] || 0;
            if (val <= 0) return null;
            const limit = Number(categoryBudgets[cat.key]) || 0;
            const overBudget = limit > 0 && val > limit;
            const pct = totalSpent > 0 ? ((val / totalSpent) * 100).toFixed(1) : "0";
            return (
              <div
                key={cat.key}
                style={{
                  display: "flex", alignItems: "center", gap: 4, fontSize: 12,
                  color: overBudget ? "#f97316" : V.textSecondary,
                  fontWeight: overBudget ? 700 : 500,
                  cursor: "pointer",
                }}
                onClick={() => handleSliceClick(cat.key)}
                role="button"
                tabIndex={0}
                aria-label={`${cat.key}: ${fmtMoney(val)} (${pct}%)${limit > 0 ? ` of ${fmtMoney(limit)} limit` : ""}`}
              >
                <span style={{
                  width: 10, height: 10, borderRadius: "50%", background: cat.color,
                  display: "inline-block", border: overBudget ? "2px solid #f97316" : "none",
                }} />
                <span>{cat.emoji} {cat.key}</span>
                <span style={{ opacity: 0.7 }}>{pct}%</span>
                {overBudget && <span style={{ fontSize: 10 }}>(OVER)</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Monthly Trend Chart ─── */}
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 700, color: V.textPrimary, marginBottom: 10 }}>
          6-Month Spending Trend
        </div>
        <MonthlyTrendChart transactions={transactions} V={V} />
        <div style={{ fontSize: 11, color: V.textMuted, textAlign: "center", marginTop: 4 }}>
          Current month highlighted · bars labeled with totals
        </div>
      </div>

      {/* ─── Dad/Mom Weeks Card ─── */}
      {custodySchedule && custodyStats.hasCustody && (
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 700, color: V.textPrimary, marginBottom: 10 }}>
            Custody Spending Breakdown
          </div>
          <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
            <div style={{
              flex: 1, textAlign: "center", padding: 12, borderRadius: V.r2,
              background: V.accent + "12", border: `1px solid ${V.accent}44`,
            }}>
              <div style={{ fontSize: 12, color: V.textMuted, marginBottom: 4 }}>Dad Days</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: V.accent }}>{fmtMoney(custodyStats.dadTotal)}</div>
              <div style={{ fontSize: 11, color: V.textDim || V.textMuted }}>{fmtMoney(custodyStats.dadAvg)}/day avg</div>
            </div>
            <div style={{
              flex: 1, textAlign: "center", padding: 12, borderRadius: V.r2,
              background: (V.success || "#22c55e") + "12", border: `1px solid ${V.success || "#22c55e"}44`,
            }}>
              <div style={{ fontSize: 12, color: V.textMuted, marginBottom: 4 }}>Mom Days</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: V.success || "#22c55e" }}>{fmtMoney(custodyStats.momTotal)}</div>
              <div style={{ fontSize: 11, color: V.textDim || V.textMuted }}>{fmtMoney(custodyStats.momAvg)}/day avg</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Transaction List ─── */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: V.textPrimary }}>
            Transactions {selectedCat ? `\u2014 ${selectedCat}` : ""}
            <span style={{ fontSize: 12, fontWeight: 400, color: V.textMuted, marginLeft: 8 }}>
              ({sortedTx.length})
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              style={{
                ...chipBase, padding: "6px 12px", fontSize: 12,
                background: bulkMode ? V.accent + "22" : V.bgInput,
                borderColor: bulkMode ? V.accent : V.borderSubtle,
                color: bulkMode ? V.accent : V.textMuted,
              }}
              onClick={() => { setBulkMode(!bulkMode); setBulkSelected(new Set()); setShowBulkConfirm(false); }}
              aria-label={bulkMode ? "Exit bulk mode" : "Enter bulk select mode"}
              aria-pressed={bulkMode}
            >
              {bulkMode ? "Cancel Bulk" : "Bulk Select"}
            </button>
          </div>
        </div>

        {/* Bulk delete bar */}
        {bulkMode && bulkSelected.size > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
            background: "#f9731612", borderRadius: V.r2, marginBottom: 10,
            border: "1px solid #f9731633",
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: V.textPrimary, flex: 1 }}>
              {bulkSelected.size} selected
            </span>
            {!showBulkConfirm ? (
              <button
                style={{ ...btnDanger, padding: "8px 14px", fontSize: 13 }}
                onClick={() => setShowBulkConfirm(true)}
                aria-label="Delete selected transactions"
              >
                Delete Selected
              </button>
            ) : (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#f97316", fontWeight: 600 }}>Are you sure?</span>
                <button
                  style={{ ...btnDanger, padding: "8px 14px", fontSize: 13, background: "#f97316", color: "#fff" }}
                  onClick={handleBulkDelete}
                  aria-label="Confirm delete selected"
                >
                  Yes, Delete
                </button>
                <button
                  style={{ ...btnSecondary, padding: "8px 12px", fontSize: 12 }}
                  onClick={() => setShowBulkConfirm(false)}
                  aria-label="Cancel bulk delete"
                >
                  No
                </button>
              </div>
            )}
          </div>
        )}

        {sortedTx.length === 0 && (
          <div style={{ textAlign: "center", color: V.textMuted, padding: 20, fontSize: 14 }}>
            No transactions this period.
          </div>
        )}

        {sortedTx.map((t) => {
          const catInfo = catMap[t.category] || catMap["Other"];
          return (
            <div
              key={t.id}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 0",
                borderBottom: `1px solid ${V.borderSubtle}`,
              }}
            >
              {bulkMode && (
                <input
                  type="checkbox"
                  checked={bulkSelected.has(t.id)}
                  onChange={() => toggleBulkItem(t.id)}
                  style={{ width: 20, height: 20, cursor: "pointer", minWidth: 20 }}
                  aria-label={`Select ${t.store} ${fmtMoney(t.amount)}`}
                />
              )}
              <span style={{ fontSize: 22, minWidth: 32, textAlign: "center" }}>{catInfo?.emoji || "\u{1F4E6}"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: V.textPrimary, display: "flex", alignItems: "center", gap: 6 }}>
                  {t.store || "Unknown"}
                  {t.recurring && <span title="Recurring monthly" style={{ fontSize: 12 }}>(recurring)</span>}
                </div>
                <div style={{ fontSize: 12, color: V.textMuted }}>
                  {catInfo?.key || "Other"} \u00B7 {fmtDate(t.date)}
                  {t.note ? ` \u00B7 ${t.note}` : ""}
                </div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: V.textPrimary, whiteSpace: "nowrap" }}>
                {fmtMoney(t.amount)}
              </div>
              {!bulkMode && (
                <button
                  style={btnDanger}
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

      {/* ─── Category Manager ─── */}
      <div style={cardStyle}>
        <button
          style={{ ...btnSecondary, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}
          onClick={() => setShowCatEditor(!showCatEditor)}
          aria-expanded={showCatEditor}
          aria-label="Toggle category manager"
        >
          <span style={{ fontWeight: 700 }}>Manage Categories</span>
          <span style={{ fontSize: 18 }}>{showCatEditor ? "\u25B2" : "\u25BC"}</span>
        </button>

        {showCatEditor && (
          <div style={{ marginTop: 14 }}>
            {/* Add new category */}
            <div style={{ fontSize: 13, fontWeight: 700, color: V.textPrimary, marginBottom: 8 }}>Add Custom Category</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <input
                style={{ ...inputStyle, flex: "1 1 140px" }}
                placeholder="Category name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                maxLength={24}
                aria-label="New category name"
              />
              <button style={btnPrimary} onClick={addCustomCategory} aria-label="Add category">
                Add
              </button>
            </div>

            {/* Emoji picker row */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: V.textMuted, marginBottom: 4 }}>Pick Emoji:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {EMOJI_PICKS.map((em) => (
                  <button
                    key={em}
                    style={{
                      width: 40, height: 40, fontSize: 20, borderRadius: 8, border: "2px solid",
                      borderColor: newCatEmoji === em ? V.accent : V.borderSubtle,
                      background: newCatEmoji === em ? V.accent + "22" : V.bgInput,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    onClick={() => setNewCatEmoji(em)}
                    aria-label={`Select emoji ${em}`}
                    aria-pressed={newCatEmoji === em}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            {/* Color swatch picker */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: V.textMuted, marginBottom: 4 }}>Pick Color:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {SWATCH_COLORS.map((sw) => (
                  <button
                    key={sw.hex}
                    style={{
                      width: 32, height: 32, borderRadius: "50%", border: "3px solid",
                      borderColor: newCatColor === sw.hex ? V.textPrimary : "transparent",
                      background: sw.hex, cursor: "pointer",
                      boxShadow: newCatColor === sw.hex ? `0 0 0 2px ${sw.hex}44` : "none",
                    }}
                    onClick={() => setNewCatColor(sw.hex)}
                    aria-label={`Color: ${sw.label}`}
                    aria-pressed={newCatColor === sw.hex}
                    title={sw.label}
                  />
                ))}
              </div>
            </div>

            {/* Existing custom categories */}
            {customCategories.length > 0 && (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: V.textPrimary, marginBottom: 8 }}>Custom Categories</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {customCategories.map((cat) => (
                    <div key={cat.key} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                      background: V.bgInput, borderRadius: V.r2,
                    }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: "50%", background: cat.color,
                        display: "inline-block", flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 18 }}>{cat.emoji}</span>
                      {renamingCat === cat.key ? (
                        <input
                          style={{ ...inputStyle, fontSize: 13, padding: "6px 8px", minHeight: 32 }}
                          value={renameVal}
                          onChange={(e) => setRenameVal(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") renameCategory(cat.key, renameVal); if (e.key === "Escape") setRenamingCat(null); }}
                          onBlur={() => renameCategory(cat.key, renameVal)}
                          autoFocus
                          aria-label={`Rename category ${cat.key}`}
                        />
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 600, color: V.textPrimary, flex: 1 }}>{cat.key}</span>
                      )}
                      <button
                        style={{ ...chipBase, padding: "4px 10px", fontSize: 11, minHeight: 36, minWidth: 36 }}
                        onClick={() => { setRenamingCat(cat.key); setRenameVal(cat.key); }}
                        aria-label={`Rename ${cat.key}`}
                      >
                        Rename
                      </button>
                      <button
                        style={{ ...btnDanger, minHeight: 36, minWidth: 36, padding: "4px 10px", fontSize: 11 }}
                        onClick={() => deleteCustomCategory(cat.key)}
                        aria-label={`Delete category ${cat.key}`}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── Budget Settings ─── */}
      <div style={cardStyle}>
        <button
          style={{
            ...btnSecondary, width: "100%", display: "flex",
            alignItems: "center", justifyContent: "space-between",
          }}
          onClick={() => setShowSettings(!showSettings)}
          aria-expanded={showSettings}
          aria-label="Toggle monthly budget limits"
        >
          <span style={{ fontWeight: 700 }}>Monthly Budget Limits</span>
          <span style={{ fontSize: 18 }}>{showSettings ? "\u25B2" : "\u25BC"}</span>
        </button>

        {showSettings && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {allCategories.map((cat) => {
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
                      borderColor: overBudget ? "#f97316" : V.borderDefault,
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
                      color: overBudget ? "#f97316" : V.textMuted,
                      fontWeight: overBudget ? 700 : 400,
                      whiteSpace: "nowrap",
                    }}>
                      {fmtMoney(spent)}/{fmtMoney(limit)}
                      {overBudget ? " Above target" : ""}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Export Buttons ─── */}
      <div style={{ display: "flex", gap: 8, marginBottom: V.sp4 }}>
        <button
          style={{ ...btnSecondary, flex: 1, textAlign: "center" }}
          onClick={copyExport}
          aria-label="Copy budget summary to clipboard"
        >
          Copy Summary
        </button>
        <button
          style={{ ...btnSecondary, flex: 1, textAlign: "center" }}
          onClick={downloadCSV}
          aria-label="Download transactions as CSV file"
        >
          Download CSV
        </button>
      </div>
    </div>
  );
}
