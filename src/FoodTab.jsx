import { useState, useEffect, useRef } from "react";
import { groqFetch, parseGroqJSON, cacheGet, cacheSet, createSpeechRecognition } from "./utils";

// ═══ HELPER FUNCTIONS ═══

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function weekDates() {
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return dates;
}

function dayLabel(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
}

function sumMacros(items) {
  let cal = 0, protein = 0, carbs = 0, fat = 0;
  let fiber = 0, sodium = 0, sugar = 0, iron = 0, vitC = 0;
  for (const it of items) {
    cal += Number(it.calories) || 0;
    protein += Number(it.protein) || 0;
    carbs += Number(it.carbs) || 0;
    fat += Number(it.fat) || 0;
    fiber += Number(it.fiber) || 0;
    sodium += Number(it.sodium) || 0;
    sugar += Number(it.sugar) || 0;
    iron += Number(it.iron) || 0;
    vitC += Number(it.vitC) || 0;
  }
  return { cal, protein, carbs, fat, fiber, sodium, sugar, iron, vitC };
}

function fmt(n) {
  return Math.round(n).toLocaleString();
}

// ═══ SVG RING COMPONENT ═══

function MacroRing({ value, target, color, label, unit, size = 70, strokeWidth = 7 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = target > 0 ? Math.min(value / target, 1.5) : 0;
  const offset = circumference - Math.min(pct, 1) * circumference;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
        <text
          x={size / 2} y={size / 2 - 6}
          textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: 11, fontWeight: 700, fill: color }}
        >
          {fmt(value)}
        </text>
        <text
          x={size / 2} y={size / 2 + 8}
          textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: 9, fill: "#9ca3af" }}
        >
          / {fmt(target)}
        </text>
      </svg>
      <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}</span>
      <span style={{ fontSize: 10, color: "#9ca3af" }}>{unit}</span>
    </div>
  );
}

// ═══ MICRONUTRIENT BAR ═══

function MicroBar({ name, value, floor, target, ceiling, V }) {
  const pct = target > 0 ? Math.min((value / ceiling) * 100, 100) : 0;
  let status = "In Range";
  let barColor = V.success;
  if (value <= floor) { status = "Below Target"; barColor = "#F1C40F"; }
  else if (value > ceiling) { status = "Above Target"; barColor = "#E67E22"; }

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: V.textPrimary, fontWeight: 600 }}>{name}</span>
        <span style={{ color: V.textMuted }}>{fmt(value)} / {fmt(target)} — <span style={{ color: barColor, fontWeight: 600 }}>{status}</span></span>
      </div>
      <div style={{ height: 8, background: V.bgInput, borderRadius: 4, overflow: "hidden", position: "relative" }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: barColor,
          borderRadius: 4, transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}

// ═══ WEIGHT CHART ═══

function WeightChart({ entries, V }) {
  if (!entries || entries.length < 2) {
    return <div style={{ fontSize: 13, color: V.textMuted, textAlign: "center", padding: 16 }}>Log at least 2 weights to see a chart.</div>;
  }

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  const weights = sorted.map(e => Number(e.weight));
  const minW = Math.min(...weights) - 2;
  const maxW = Math.max(...weights) + 2;
  const range = maxW - minW || 1;

  const W = 300, H = 120, padX = 30, padY = 15;
  const plotW = W - padX * 2, plotH = H - padY * 2;

  const points = sorted.map((e, i) => {
    const x = padX + (i / Math.max(sorted.length - 1, 1)) * plotW;
    const y = padY + plotH - ((Number(e.weight) - minW) / range) * plotH;
    return { x, y };
  });

  const polyline = points.map(p => `${p.x},${p.y}`).join(" ");

  // 7-day moving average
  const avgPoints = [];
  for (let i = 0; i < weights.length; i++) {
    const windowStart = Math.max(0, i - 6);
    const window = weights.slice(windowStart, i + 1);
    const avg = window.reduce((s, v) => s + v, 0) / window.length;
    const x = padX + (i / Math.max(sorted.length - 1, 1)) * plotW;
    const y = padY + plotH - ((avg - minW) / range) * plotH;
    avgPoints.push({ x, y });
  }
  const avgPolyline = avgPoints.map(p => `${p.x},${p.y}`).join(" ");

  // Trend text
  const last7 = weights.slice(-7);
  const trendDiff = last7.length >= 2 ? last7[last7.length - 1] - last7[0] : 0;
  const trendText = trendDiff > 0 ? `+${trendDiff.toFixed(1)} lbs this week` : `${trendDiff.toFixed(1)} lbs this week`;

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(frac => {
          const y = padY + plotH - frac * plotH;
          const val = (minW + frac * range).toFixed(0);
          return (
            <g key={frac}>
              <line x1={padX} y1={y} x2={W - padX} y2={y} stroke={V.borderSubtle} strokeWidth={0.5} strokeDasharray="3,3" />
              <text x={padX - 4} y={y + 3} textAnchor="end" style={{ fontSize: 9, fill: V.textMuted }}>{val}</text>
            </g>
          );
        })}
        {/* Trend line (moving avg) */}
        <polyline points={avgPolyline} fill="none" stroke={V.accent} strokeWidth={2} strokeDasharray="4,3" />
        {/* Data line */}
        <polyline points={polyline} fill="none" stroke="#4A90D9" strokeWidth={2} />
        {/* Data dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="#4A90D9" stroke="#fff" strokeWidth={1.5} />
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "center", gap: 16, fontSize: 11, color: V.textMuted, marginTop: 4 }}>
        <span><span style={{ display: "inline-block", width: 12, height: 2, background: "#4A90D9", verticalAlign: "middle", marginRight: 4 }}></span>Weight</span>
        <span><span style={{ display: "inline-block", width: 12, height: 2, background: V.accent, verticalAlign: "middle", marginRight: 4, borderTop: "1px dashed " + V.accent }}></span>7-Day Avg</span>
      </div>
      <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: V.textPrimary, marginTop: 6 }}>
        Trend: {trendText}
      </div>
    </div>
  );
}

// ═══ MAIN COMPONENT ═══

export default function FoodTab({ V, currentProfile, foodLog, myFoods, nutritionGoals, fbSet, GROQ_KEY, showToast, profiles }) {
  // ── State ──
  const [hatMode, setHatMode] = useState(() => cacheGet("foodHatMode") || "daily");
  const [expandedMeals, setExpandedMeals] = useState({ Breakfast: true, Lunch: true, Dinner: true, Snacks: true });
  const [addPopup, setAddPopup] = useState(null); // meal name or null
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [servingSize, setServingSize] = useState(100);
  const [isRecording, setIsRecording] = useState(false);
  const [voicePreview, setVoicePreview] = useState(null);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [goalMode, setGoalMode] = useState((nutritionGoals && nutritionGoals.mode) || "maintain");
  const [goalDeficit, setGoalDeficit] = useState((nutritionGoals && nutritionGoals.deficit) || 0);
  const [manualCal, setManualCal] = useState((nutritionGoals && nutritionGoals.calories) || 2200);
  const [manualProtein, setManualProtein] = useState((nutritionGoals && nutritionGoals.protein) || 150);
  const [manualCarbs, setManualCarbs] = useState((nutritionGoals && nutritionGoals.carbs) || 250);
  const [manualFat, setManualFat] = useState((nutritionGoals && nutritionGoals.fat) || 70);
  const [weightInput, setWeightInput] = useState("");
  const [weightLog, setWeightLog] = useState([]);
  const [showWeightSection, setShowWeightSection] = useState(false);
  const [shoppingList, setShoppingList] = useState([]);
  const [shoppingInput, setShoppingInput] = useState("");
  const [quickCalories, setQuickCalories] = useState("");
  const [quickProtein, setQuickProtein] = useState("");
  const [quickCarbs, setQuickCarbs] = useState("");
  const [quickFat, setQuickFat] = useState("");
  const [quickName, setQuickName] = useState("");
  const [addMode, setAddMode] = useState(null); // "search" | "voice" | "quick"

  const recognitionRef = useRef(null);
  const voiceTimerRef = useRef(null);

  // ── Derived values ──
  const today = todayStr();
  const log = Array.isArray(foodLog) ? foodLog : [];
  const todayLog = log.filter(f => f.date === today && f.profile === currentProfile);
  const goals = nutritionGoals || { calories: 2200, protein: 150, carbs: 250, fat: 70 };
  const todayMacros = sumMacros(todayLog);

  // ── Effects ──
  useEffect(() => {
    cacheSet("foodHatMode", hatMode);
  }, [hatMode]);

  useEffect(() => {
    if (nutritionGoals) {
      setGoalMode(nutritionGoals.mode || "maintain");
      setGoalDeficit(nutritionGoals.deficit || 0);
      setManualCal(nutritionGoals.calories || 2200);
      setManualProtein(nutritionGoals.protein || 150);
      setManualCarbs(nutritionGoals.carbs || 250);
      setManualFat(nutritionGoals.fat || 70);
    }
  }, [nutritionGoals]);

  // Load weight log & shopping list from cache on mount, sync from firebase if available
  useEffect(() => {
    const cached = cacheGet("weightLog_" + currentProfile);
    if (cached) setWeightLog(cached);
    const cachedShop = cacheGet("shoppingList_" + currentProfile);
    if (cachedShop) setShoppingList(cachedShop);
  }, [currentProfile]);

  // ── Meal Memory: last 10 unique foods ──
  const mealMemory = (() => {
    const profileLog = log.filter(f => f.profile === currentProfile);
    const seen = new Set();
    const items = [];
    for (let i = profileLog.length - 1; i >= 0 && items.length < 10; i--) {
      const key = profileLog[i].name;
      if (key && !seen.has(key)) {
        seen.add(key);
        items.push(profileLog[i]);
      }
    }
    return items;
  })();

  // ── Handlers ──

  function toggleMeal(meal) {
    setExpandedMeals(prev => ({ ...prev, [meal]: !prev[meal] }));
  }

  function deleteFood(index) {
    const newLog = [...log];
    // Find actual index in full log
    const todayItems = [];
    for (let i = 0; i < newLog.length; i++) {
      if (newLog[i].date === today && newLog[i].profile === currentProfile) {
        todayItems.push(i);
      }
    }
    if (todayItems[index] !== undefined) {
      newLog.splice(todayItems[index], 1);
      fbSet("foodLog", newLog);
      showToast("Removed");
    }
  }

  function deleteFoodByMealIndex(meal, idx) {
    const mealItems = todayLog.filter(f => f.meal === meal);
    if (!mealItems[idx]) return;
    const target = mealItems[idx];
    // Find in full log
    const fullIdx = log.findIndex(f =>
      f.date === target.date && f.profile === target.profile &&
      f.meal === target.meal && f.name === target.name &&
      f.calories === target.calories
    );
    if (fullIdx >= 0) {
      const newLog = [...log];
      newLog.splice(fullIdx, 1);
      fbSet("foodLog", newLog);
      showToast("Removed");
    }
  }

  function addFood(item, meal) {
    const entry = {
      name: item.name || item.food || "Unknown Food",
      calories: Math.round(Number(item.calories || item.cal) || 0),
      protein: Math.round(Number(item.protein) || 0),
      carbs: Math.round(Number(item.carbs) || 0),
      fat: Math.round(Number(item.fat) || 0),
      fiber: Math.round(Number(item.fiber) || 0),
      sodium: Math.round(Number(item.sodium) || 0),
      sugar: Math.round(Number(item.sugar) || 0),
      iron: Number(item.iron || 0),
      vitC: Number(item.vitC || 0),
      date: today,
      profile: currentProfile,
      meal: meal,
    };
    const newLog = [...log, entry];
    fbSet("foodLog", newLog);
    showToast(`Added ${entry.name}`);
    setAddPopup(null);
    setAddMode(null);
    setSearchResults(null);
    setSearchQuery("");
    setServingSize(100);
  }

  async function searchFood() {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchResults(null);
    const cached = cacheGet("food_" + searchQuery.trim().toLowerCase());
    if (cached) {
      setSearchResults(cached);
      setSearchLoading(false);
      return;
    }
    const res = await groqFetch(GROQ_KEY, [
      { role: "system", content: "You are a nutrition database. Return ONLY valid JSON, no explanation." },
      { role: "user", content: `Estimate macros for "${searchQuery.trim()}". Return JSON: {"food":"name","cal":number,"protein":number,"carbs":number,"fat":number,"fiber":number,"sodium":number,"sugar":number} per 100g. Use USDA data.` }
    ], { maxTokens: 300 });
    setSearchLoading(false);
    if (res.ok) {
      const parsed = parseGroqJSON(res.data);
      if (parsed) {
        cacheSet("food_" + searchQuery.trim().toLowerCase(), parsed);
        setSearchResults(parsed);
      } else {
        showToast("Could not parse nutrition data");
      }
    } else {
      showToast(res.error || "Search failed");
    }
  }

  function confirmSearchResult(meal) {
    if (!searchResults) return;
    const factor = servingSize / 100;
    addFood({
      name: searchResults.food || searchQuery,
      calories: (searchResults.cal || 0) * factor,
      protein: (searchResults.protein || 0) * factor,
      carbs: (searchResults.carbs || 0) * factor,
      fat: (searchResults.fat || 0) * factor,
      fiber: (searchResults.fiber || 0) * factor,
      sodium: (searchResults.sodium || 0) * factor,
      sugar: (searchResults.sugar || 0) * factor,
    }, meal);
  }

  function startVoice() {
    const recognition = createSpeechRecognition();
    if (!recognition) {
      showToast("Speech recognition not supported");
      return;
    }
    recognitionRef.current = recognition;
    setIsRecording(true);

    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      setIsRecording(false);
      clearTimeout(voiceTimerRef.current);
      setVoiceLoading(true);

      const res = await groqFetch(GROQ_KEY, [
        { role: "system", content: "You are a nutrition extractor. Return ONLY valid JSON array, no explanation." },
        { role: "user", content: `Extract food items from: "${transcript}". Return JSON array: [{"food":"name","qty":number,"unit":"g or oz or cup or piece","meal":"Breakfast or Lunch or Dinner or Snacks","cal":number,"protein":number,"carbs":number,"fat":number}]. Use USDA data. If meal not mentioned, use "Snacks".` }
      ], { maxTokens: 600 });
      setVoiceLoading(false);

      if (res.ok) {
        const parsed = parseGroqJSON(res.data);
        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
          setVoicePreview(parsed);
        } else {
          showToast("Could not understand food items");
        }
      } else {
        showToast(res.error || "Voice processing failed");
      }
    };

    recognition.onerror = () => {
      setIsRecording(false);
      clearTimeout(voiceTimerRef.current);
      showToast("Voice recognition failed — try again");
    };

    recognition.onend = () => {
      setIsRecording(false);
      clearTimeout(voiceTimerRef.current);
    };

    recognition.start();
    voiceTimerRef.current = setTimeout(() => {
      try { recognition.stop(); } catch (_) {}
    }, 10000);
  }

  function confirmVoiceItems() {
    if (!voicePreview) return;
    for (const item of voicePreview) {
      addFood({
        name: item.food,
        calories: item.cal,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
      }, item.meal || "Snacks");
    }
    setVoicePreview(null);
    showToast(`Logged ${voicePreview.length} item(s)`);
  }

  function saveGoals() {
    const data = {
      mode: goalMode,
      deficit: goalDeficit,
      calories: Number(manualCal) || 2200,
      protein: Number(manualProtein) || 150,
      carbs: Number(manualCarbs) || 250,
      fat: Number(manualFat) || 70,
    };
    fbSet("nutritionGoals", data);
    showToast("Goals saved");
    setShowGoals(false);
  }

  function logWeight() {
    const w = Number(weightInput);
    if (!w || w < 50 || w > 600) {
      showToast("Enter a valid weight");
      return;
    }
    const newLog = [...weightLog, { date: today, weight: w }];
    // Deduplicate by date, keep latest
    const byDate = {};
    for (const entry of newLog) byDate[entry.date] = entry;
    const dedupedLog = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
    setWeightLog(dedupedLog);
    cacheSet("weightLog_" + currentProfile, dedupedLog);
    fbSet("weightLog", dedupedLog);
    setWeightInput("");
    showToast("Weight logged");
  }

  function addShoppingItem() {
    if (!shoppingInput.trim()) return;
    const item = { text: shoppingInput.trim(), bought: false, id: Date.now() };
    const newList = [...shoppingList, item];
    setShoppingList(newList);
    cacheSet("shoppingList_" + currentProfile, newList);
    fbSet("shoppingList", newList);
    setShoppingInput("");
  }

  function toggleShoppingItem(id) {
    const newList = shoppingList.map(it => it.id === id ? { ...it, bought: !it.bought } : it);
    // Sort: unbought first, bought last
    newList.sort((a, b) => (a.bought === b.bought ? 0 : a.bought ? 1 : -1));
    setShoppingList(newList);
    cacheSet("shoppingList_" + currentProfile, newList);
    fbSet("shoppingList", newList);
  }

  function deleteShoppingItem(id) {
    const newList = shoppingList.filter(it => it.id !== id);
    setShoppingList(newList);
    cacheSet("shoppingList_" + currentProfile, newList);
    fbSet("shoppingList", newList);
  }

  function quickAddFood(meal) {
    if (!quickName.trim()) {
      showToast("Enter a food name");
      return;
    }
    addFood({
      name: quickName.trim(),
      calories: Number(quickCalories) || 0,
      protein: Number(quickProtein) || 0,
      carbs: Number(quickCarbs) || 0,
      fat: Number(quickFat) || 0,
    }, meal);
    setQuickName("");
    setQuickCalories("");
    setQuickProtein("");
    setQuickCarbs("");
    setQuickFat("");
  }

  function reLogFood(item, meal) {
    addFood({
      name: item.name,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      fiber: item.fiber,
      sodium: item.sodium,
      sugar: item.sugar,
    }, meal || addPopup || "Snacks");
  }

  // ── Styles ──
  const card = {
    background: V.bgCard, borderRadius: V.r3, padding: V.sp4,
    boxShadow: V.shadowCard, marginBottom: V.sp3,
  };
  const btnBase = {
    minHeight: 44, minWidth: 44, border: "none", borderRadius: V.r2,
    cursor: "pointer", fontWeight: 600, fontSize: 13,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.15s ease",
  };
  const btnPrimary = { ...btnBase, background: V.accent, color: "#fff", padding: "0 16px" };
  const btnOutline = { ...btnBase, background: "transparent", color: V.accent, border: `1.5px solid ${V.accent}`, padding: "0 14px" };
  const btnDanger = { ...btnBase, background: V.danger, color: "#fff", padding: "0 12px", fontSize: 12 };
  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: V.r2,
    border: `1px solid ${V.borderDefault}`, background: V.bgInput,
    color: V.textPrimary, fontSize: 14, outline: "none",
    boxSizing: "border-box",
  };

  // ── Meals config ──
  const MEALS = [
    { key: "Breakfast", icon: "\u{1F305}", label: "Breakfast" },
    { key: "Lunch", icon: "\u{1F31E}", label: "Lunch" },
    { key: "Dinner", icon: "\u{1F319}", label: "Dinner" },
    { key: "Snacks", icon: "\u{1F37F}", label: "Snacks" },
  ];

  // ── Weekly data ──
  const week = weekDates();
  const weekData = week.map(d => {
    const dayLog = log.filter(f => f.date === d && f.profile === currentProfile);
    return { date: d, ...sumMacros(dayLog) };
  });

  // ── Micro targets ──
  const microTargets = {
    fiber: { floor: 20, target: 25, ceiling: 40 },
    sodium: { floor: 500, target: 2300, ceiling: 3000 },
    sugar: { floor: 0, target: 50, ceiling: 75 },
    iron: { floor: 8, target: 18, ceiling: 45 },
    vitC: { floor: 60, target: 90, ceiling: 2000 },
  };

  // ═══ RENDER ═══

  return (
    <div style={{ padding: V.sp3, maxWidth: 480, margin: "0 auto" }}>

      {/* ── HAT MODE TOGGLE ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: V.sp3, justifyContent: "center" }}>
        {[
          { key: "daily", label: "Daily" },
          { key: "weekly", label: "Weekly" },
          { key: "energy", label: "Energy" },
        ].map(m => (
          <button
            key={m.key}
            onClick={() => setHatMode(m.key)}
            style={{
              ...btnBase,
              padding: "6px 16px",
              background: hatMode === m.key ? V.accent : V.bgCardAlt,
              color: hatMode === m.key ? "#fff" : V.textSecondary,
              fontSize: 13,
            }}
          >
            {m.label}
          </button>
        ))}
        <button
          onClick={() => setShowGoals(true)}
          style={{ ...btnBase, padding: "6px 12px", background: V.bgCardAlt, color: V.textMuted, fontSize: 18 }}
          title="Nutrition Goals"
        >
          &#9881;
        </button>
      </div>

      {/* ── DASHBOARD HAT: DAILY ── */}
      {hatMode === "daily" && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 8 }}>
            <MacroRing value={todayMacros.cal} target={goals.calories || 2200} color="#4A90D9" label="Calories" unit="cal" size={76} />
            <MacroRing value={todayMacros.protein} target={goals.protein || 150} color="#E74C3C" label="Protein" unit="g" size={76} />
            <MacroRing value={todayMacros.carbs} target={goals.carbs || 250} color="#F1C40F" label="Carbs" unit="g" size={76} />
            <MacroRing value={todayMacros.fat} target={goals.fat || 70} color="#9B59B6" label="Fat" unit="g" size={76} />
          </div>
          <div style={{ textAlign: "center", marginTop: 10, fontSize: 13, color: V.textMuted, fontWeight: 600 }}>
            Net: {fmt(todayMacros.cal)} cal
          </div>
        </div>
      )}

      {/* ── DASHBOARD HAT: WEEKLY ── */}
      {hatMode === "weekly" && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-end", height: 100, gap: 4 }}>
            {weekData.map((d, i) => {
              const maxCal = Math.max(...weekData.map(w => w.cal), goals.calories || 2200);
              const h = maxCal > 0 ? (d.cal / maxCal) * 80 : 0;
              const isToday = d.date === today;
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                  <div style={{ fontSize: 9, color: V.textMuted, marginBottom: 2 }}>{fmt(d.cal)}</div>
                  <div style={{
                    width: 20, height: Math.max(h, 4), borderRadius: 4,
                    background: isToday ? V.accent : "#4A90D9",
                    transition: "height 0.4s ease",
                  }} />
                  <div style={{ fontSize: 10, color: isToday ? V.accent : V.textMuted, marginTop: 4, fontWeight: isToday ? 700 : 400 }}>
                    {dayLabel(d.date)}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ textAlign: "center", marginTop: 8, fontSize: 12, color: V.textMuted }}>
            Week total: {fmt(weekData.reduce((s, d) => s + d.cal, 0))} cal
          </div>
        </div>
      )}

      {/* ── DASHBOARD HAT: ENERGY ── */}
      {hatMode === "energy" && (
        <div style={{ ...card, display: "flex", justifyContent: "center" }}>
          <MacroRing value={todayMacros.cal} target={goals.calories || 2200} color="#4A90D9" label="Net Energy" unit="cal" size={120} strokeWidth={10} />
        </div>
      )}

      {/* ── MICRONUTRIENT BARS ── */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: V.textPrimary, marginBottom: 8 }}>Micronutrients</div>
        <MicroBar name="Fiber" value={todayMacros.fiber} floor={microTargets.fiber.floor} target={microTargets.fiber.target} ceiling={microTargets.fiber.ceiling} V={V} />
        <MicroBar name="Sodium" value={todayMacros.sodium} floor={microTargets.sodium.floor} target={microTargets.sodium.target} ceiling={microTargets.sodium.ceiling} V={V} />
        <MicroBar name="Sugar" value={todayMacros.sugar} floor={microTargets.sugar.floor} target={microTargets.sugar.target} ceiling={microTargets.sugar.ceiling} V={V} />
        <MicroBar name="Iron" value={todayMacros.iron} floor={microTargets.iron.floor} target={microTargets.iron.target} ceiling={microTargets.iron.ceiling} V={V} />
        <MicroBar name="Vitamin C" value={todayMacros.vitC} floor={microTargets.vitC.floor} target={microTargets.vitC.target} ceiling={microTargets.vitC.ceiling} V={V} />
      </div>

      {/* ── MEAL SECTIONS ── */}
      {MEALS.map(meal => {
        const mealItems = todayLog.filter(f => f.meal === meal.key);
        const mealCals = mealItems.reduce((s, f) => s + (Number(f.calories) || 0), 0);
        const expanded = expandedMeals[meal.key];

        return (
          <div key={meal.key} style={{ ...card, padding: 0, overflow: "hidden" }}>
            {/* Meal Header */}
            <button
              onClick={() => toggleMeal(meal.key)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: `${V.sp3}px ${V.sp4}px`, border: "none", background: "transparent",
                cursor: "pointer", minHeight: 48,
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: V.textPrimary }}>
                {meal.icon} {meal.label}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: V.textMuted, fontWeight: 600 }}>{fmt(mealCals)} cal</span>
                <span style={{ fontSize: 16, color: V.textMuted, transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                  &#9660;
                </span>
              </span>
            </button>

            {expanded && (
              <div style={{ padding: `0 ${V.sp4}px ${V.sp3}px` }}>
                {/* Food rows */}
                {mealItems.length === 0 && (
                  <div style={{ fontSize: 12, color: V.textDim, padding: "8px 0", textAlign: "center" }}>
                    No foods logged yet
                  </div>
                )}
                {mealItems.map((food, idx) => (
                  <div key={idx} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 0", borderBottom: idx < mealItems.length - 1 ? `1px solid ${V.borderSubtle}` : "none",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: V.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {food.name}
                      </div>
                      <div style={{ fontSize: 11, color: V.textMuted }}>
                        {fmt(food.calories)} cal &middot; P {fmt(food.protein)}g &middot; C {fmt(food.carbs)}g &middot; F {fmt(food.fat)}g
                      </div>
                    </div>
                    <button
                      onClick={() => deleteFoodByMealIndex(meal.key, idx)}
                      style={{ ...btnBase, minWidth: 36, minHeight: 36, padding: 0, background: "transparent", color: V.danger, fontSize: 16 }}
                      title="Remove"
                    >
                      &#10005;
                    </button>
                  </div>
                ))}

                {/* Add button */}
                {addPopup !== meal.key ? (
                  <button
                    onClick={() => { setAddPopup(meal.key); setAddMode(null); }}
                    style={{ ...btnOutline, width: "100%", marginTop: 8, fontSize: 14 }}
                  >
                    + Add Food
                  </button>
                ) : (
                  <div style={{ marginTop: 8 }}>
                    {/* Mode selector */}
                    {!addMode && (
                      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                        <button onClick={() => setAddMode("search")} style={{ ...btnPrimary, flex: 1, fontSize: 12 }}>
                          &#128269; Search
                        </button>
                        <button onClick={() => { setAddMode("voice"); startVoice(); }} style={{ ...btnPrimary, flex: 1, fontSize: 12, background: isRecording ? V.danger : V.accent }}>
                          &#127908; Voice
                        </button>
                        <button onClick={() => setAddMode("quick")} style={{ ...btnPrimary, flex: 1, fontSize: 12 }}>
                          &#9889; Quick
                        </button>
                        <button onClick={() => setAddPopup(null)} style={{ ...btnBase, padding: "0 10px", background: V.bgCardAlt, color: V.textMuted }}>
                          &#10005;
                        </button>
                      </div>
                    )}

                    {/* ── SEARCH MODE ── */}
                    {addMode === "search" && (
                      <div>
                        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                          <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && searchFood()}
                            placeholder="Search food (e.g. chicken breast)"
                            style={{ ...inputStyle, flex: 1 }}
                          />
                          <button onClick={searchFood} disabled={searchLoading} style={btnPrimary}>
                            {searchLoading ? "..." : "Go"}
                          </button>
                          <button onClick={() => { setAddMode(null); setSearchResults(null); setSearchQuery(""); }} style={{ ...btnBase, background: V.bgCardAlt, color: V.textMuted, padding: "0 10px" }}>
                            &#8592;
                          </button>
                        </div>
                        {searchResults && (
                          <div style={{ background: V.bgCardAlt, borderRadius: V.r2, padding: V.sp3, marginBottom: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: V.textPrimary, marginBottom: 6 }}>
                              {searchResults.food}
                            </div>
                            <div style={{ fontSize: 12, color: V.textMuted, marginBottom: 8 }}>
                              Per 100g: {searchResults.cal} cal &middot; P {searchResults.protein}g &middot; C {searchResults.carbs}g &middot; F {searchResults.fat}g
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                              <label style={{ fontSize: 12, color: V.textSecondary, fontWeight: 600 }}>Serving (g):</label>
                              <input
                                type="number" value={servingSize}
                                onChange={e => setServingSize(Number(e.target.value) || 0)}
                                style={{ ...inputStyle, width: 80 }}
                              />
                            </div>
                            <div style={{ fontSize: 12, color: V.textMuted, marginBottom: 8 }}>
                              Adjusted: {fmt((searchResults.cal || 0) * servingSize / 100)} cal &middot;
                              P {fmt((searchResults.protein || 0) * servingSize / 100)}g &middot;
                              C {fmt((searchResults.carbs || 0) * servingSize / 100)}g &middot;
                              F {fmt((searchResults.fat || 0) * servingSize / 100)}g
                            </div>
                            <button onClick={() => confirmSearchResult(meal.key)} style={{ ...btnPrimary, width: "100%" }}>
                              Add to {meal.label}
                            </button>
                          </div>
                        )}

                        {/* Meal Memory */}
                        {mealMemory.length > 0 && !searchResults && (
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: V.textMuted, marginBottom: 6 }}>Recent Foods</div>
                            {mealMemory.map((item, i) => (
                              <button
                                key={i}
                                onClick={() => reLogFood(item, meal.key)}
                                style={{
                                  display: "flex", justifyContent: "space-between", alignItems: "center",
                                  width: "100%", padding: "8px 10px", marginBottom: 4,
                                  background: V.bgCardAlt, border: `1px solid ${V.borderSubtle}`,
                                  borderRadius: V.r2, cursor: "pointer", textAlign: "left",
                                  minHeight: 44,
                                }}
                              >
                                <span style={{ fontSize: 13, color: V.textPrimary, fontWeight: 500 }}>{item.name}</span>
                                <span style={{ fontSize: 11, color: V.textMuted }}>{fmt(item.calories)} cal</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── VOICE MODE ── */}
                    {addMode === "voice" && (
                      <div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                          <button
                            onClick={() => { if (isRecording) { try { recognitionRef.current.stop(); } catch (_) {} } else { startVoice(); } }}
                            style={{
                              ...btnPrimary,
                              background: isRecording ? V.danger : V.accent,
                              flex: 1,
                            }}
                          >
                            {isRecording ? "Recording... tap to stop" : voiceLoading ? "Processing..." : "Tap to Record"}
                          </button>
                          <button onClick={() => { setAddMode(null); setVoicePreview(null); setIsRecording(false); }} style={{ ...btnBase, background: V.bgCardAlt, color: V.textMuted, padding: "0 10px" }}>
                            &#8592;
                          </button>
                        </div>
                        {isRecording && (
                          <div style={{ textAlign: "center", fontSize: 12, color: V.danger, fontWeight: 600, marginBottom: 8 }}>
                            &#9679; Listening... (auto-stops in 10s)
                          </div>
                        )}
                        {voiceLoading && (
                          <div style={{ textAlign: "center", fontSize: 12, color: V.textMuted, marginBottom: 8 }}>
                            Analyzing your food...
                          </div>
                        )}
                        {voicePreview && (
                          <div style={{ background: V.bgCardAlt, borderRadius: V.r2, padding: V.sp3 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: V.textPrimary, marginBottom: 8 }}>Review Items</div>
                            {voicePreview.map((item, i) => (
                              <div key={i} style={{ padding: "6px 0", borderBottom: i < voicePreview.length - 1 ? `1px solid ${V.borderSubtle}` : "none" }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: V.textPrimary }}>
                                  {item.food} {item.qty ? `(${item.qty} ${item.unit || ""})` : ""}
                                </div>
                                <div style={{ fontSize: 11, color: V.textMuted }}>
                                  {item.cal} cal &middot; P {item.protein}g &middot; C {item.carbs}g &middot; F {item.fat}g &middot; {item.meal || "Snacks"}
                                </div>
                              </div>
                            ))}
                            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                              <button onClick={confirmVoiceItems} style={{ ...btnPrimary, flex: 1 }}>
                                Log All
                              </button>
                              <button onClick={() => setVoicePreview(null)} style={{ ...btnOutline, flex: 1 }}>
                                Discard
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── QUICK ADD MODE ── */}
                    {addMode === "quick" && (
                      <div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: V.textPrimary }}>Quick Add</span>
                          <div style={{ flex: 1 }} />
                          <button onClick={() => { setAddMode(null); }} style={{ ...btnBase, background: V.bgCardAlt, color: V.textMuted, padding: "0 10px" }}>
                            &#8592;
                          </button>
                        </div>
                        <input
                          value={quickName} onChange={e => setQuickName(e.target.value)}
                          placeholder="Food name" style={{ ...inputStyle, marginBottom: 6 }}
                        />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                          <input value={quickCalories} onChange={e => setQuickCalories(e.target.value)} placeholder="Calories" type="number" style={inputStyle} />
                          <input value={quickProtein} onChange={e => setQuickProtein(e.target.value)} placeholder="Protein (g)" type="number" style={inputStyle} />
                          <input value={quickCarbs} onChange={e => setQuickCarbs(e.target.value)} placeholder="Carbs (g)" type="number" style={inputStyle} />
                          <input value={quickFat} onChange={e => setQuickFat(e.target.value)} placeholder="Fat (g)" type="number" style={inputStyle} />
                        </div>
                        <button onClick={() => quickAddFood(meal.key)} style={{ ...btnPrimary, width: "100%" }}>
                          Add to {meal.label}
                        </button>

                        {/* Meal Memory in quick mode too */}
                        {mealMemory.length > 0 && (
                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: V.textMuted, marginBottom: 6 }}>Recent Foods</div>
                            {mealMemory.map((item, i) => (
                              <button
                                key={i}
                                onClick={() => reLogFood(item, meal.key)}
                                style={{
                                  display: "flex", justifyContent: "space-between", alignItems: "center",
                                  width: "100%", padding: "8px 10px", marginBottom: 4,
                                  background: V.bgCardAlt, border: `1px solid ${V.borderSubtle}`,
                                  borderRadius: V.r2, cursor: "pointer", textAlign: "left",
                                  minHeight: 44,
                                }}
                              >
                                <span style={{ fontSize: 13, color: V.textPrimary, fontWeight: 500 }}>{item.name}</span>
                                <span style={{ fontSize: 11, color: V.textMuted }}>{fmt(item.calories)} cal</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ── WEIGHT TRACKING ── */}
      <div style={card}>
        <button
          onClick={() => setShowWeightSection(!showWeightSection)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            border: "none", background: "transparent", cursor: "pointer", padding: 0, minHeight: 44,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: V.textPrimary }}>&#9878; Weight Tracking</span>
          <span style={{ fontSize: 16, color: V.textMuted, transform: showWeightSection ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
            &#9660;
          </span>
        </button>
        {showWeightSection && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                type="number" value={weightInput}
                onChange={e => setWeightInput(e.target.value)}
                placeholder="Weight (lbs)"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={logWeight} style={btnPrimary}>Log Weight</button>
            </div>
            <WeightChart entries={weightLog} V={V} />
          </div>
        )}
      </div>

      {/* ── SHOPPING LIST ── */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: V.textPrimary, marginBottom: 10 }}>&#128722; Shopping List</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            value={shoppingInput}
            onChange={e => setShoppingInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addShoppingItem()}
            placeholder="Add item..."
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={addShoppingItem} style={btnPrimary}>Add</button>
        </div>
        {shoppingList.length === 0 && (
          <div style={{ fontSize: 12, color: V.textDim, textAlign: "center", padding: 8 }}>
            No items yet
          </div>
        )}
        {shoppingList.map(item => (
          <div key={item.id} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "8px 0",
            borderBottom: `1px solid ${V.borderSubtle}`,
            opacity: item.bought ? 0.5 : 1,
          }}>
            <button
              onClick={() => toggleShoppingItem(item.id)}
              style={{
                ...btnBase, minWidth: 32, minHeight: 32, padding: 0,
                background: item.bought ? V.success : V.bgCardAlt,
                color: item.bought ? "#fff" : V.textMuted,
                borderRadius: 6, fontSize: 14,
                border: item.bought ? "none" : `1.5px solid ${V.borderDefault}`,
              }}
              title={item.bought ? "Mark unbought" : "Mark bought"}
            >
              {item.bought ? "✓" : ""}
            </button>
            <span style={{
              flex: 1, fontSize: 13, color: V.textPrimary,
              textDecoration: item.bought ? "line-through" : "none",
            }}>
              {item.text}
            </span>
            <button
              onClick={() => deleteShoppingItem(item.id)}
              style={{ ...btnBase, minWidth: 36, minHeight: 36, padding: 0, background: "transparent", color: V.danger, fontSize: 15 }}
              title="Remove"
            >
              &#10005;
            </button>
          </div>
        ))}
      </div>

      {/* ── GOAL SETTINGS MODAL ── */}
      {showGoals && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: V.bgOverlay, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowGoals(false); }}
        >
          <div style={{
            background: V.bgCard, borderRadius: V.r4, padding: V.sp5,
            width: "100%", maxWidth: 400, boxShadow: V.shadowModal,
            maxHeight: "85vh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: V.textPrimary }}>Nutrition Goals</span>
              <button onClick={() => setShowGoals(false)} style={{ ...btnBase, minWidth: 36, minHeight: 36, padding: 0, background: "transparent", color: V.textMuted, fontSize: 18 }}>
                &#10005;
              </button>
            </div>

            {/* Goal Mode */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: V.textSecondary, marginBottom: 8 }}>Goal Mode</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { key: "lose", label: "Lose", desc: "Deficit" },
                  { key: "maintain", label: "Maintain", desc: "Balance" },
                  { key: "gain", label: "Gain", desc: "Surplus" },
                ].map(g => (
                  <button
                    key={g.key}
                    onClick={() => setGoalMode(g.key)}
                    style={{
                      ...btnBase, flex: 1, flexDirection: "column", padding: "10px 6px",
                      background: goalMode === g.key ? V.accent : V.bgCardAlt,
                      color: goalMode === g.key ? "#fff" : V.textSecondary,
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{g.label}</span>
                    <span style={{ fontSize: 10, opacity: 0.8 }}>{g.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Deficit/Surplus selector */}
            {goalMode !== "maintain" && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: V.textSecondary, marginBottom: 8 }}>
                  {goalMode === "lose" ? "Daily Deficit" : "Daily Surplus"}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[250, 500, 750].map(val => {
                    const actualVal = goalMode === "lose" ? -val : val;
                    return (
                      <button
                        key={val}
                        onClick={() => setGoalDeficit(actualVal)}
                        style={{
                          ...btnBase, flex: 1, padding: "8px 0",
                          background: goalDeficit === actualVal ? V.accent : V.bgCardAlt,
                          color: goalDeficit === actualVal ? "#fff" : V.textSecondary,
                        }}
                      >
                        {goalMode === "lose" ? "-" : "+"}{val} cal
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Manual targets */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: V.textSecondary, marginBottom: 8 }}>Daily Targets</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: V.textMuted, fontWeight: 600 }}>Calories</label>
                  <input type="number" value={manualCal} onChange={e => setManualCal(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: V.textMuted, fontWeight: 600 }}>Protein (g)</label>
                  <input type="number" value={manualProtein} onChange={e => setManualProtein(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: V.textMuted, fontWeight: 600 }}>Carbs (g)</label>
                  <input type="number" value={manualCarbs} onChange={e => setManualCarbs(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: V.textMuted, fontWeight: 600 }}>Fat (g)</label>
                  <input type="number" value={manualFat} onChange={e => setManualFat(e.target.value)} style={inputStyle} />
                </div>
              </div>
            </div>

            <button onClick={saveGoals} style={{ ...btnPrimary, width: "100%" }}>
              Save Goals
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
