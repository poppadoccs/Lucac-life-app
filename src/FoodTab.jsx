import { useState, useEffect, useRef, useMemo } from "react";
import { groqFetch, parseGroqJSON, cacheGet, cacheSet, createSpeechRecognition, callAI } from "./utils";

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

function calendarDaysBetween(startDate, endDate) {
  const [sy, sm, sd] = String(startDate).split("-").map(Number);
  const [ey, em, ed] = String(endDate).split("-").map(Number);
  return (Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000;
}

const ALL_MICRO_KEYS = [
  "fiber","sodium","sugar","iron","vitC",
  "vitA","vitB1","vitB2","vitB3","vitB6","vitB9","vitB12","vitD","vitE","vitK",
  "calcium","magnesium","phosphorus","potassium","zinc","selenium",
  "satFat","transFat","cholesterol","addedSugar","water"
];

const DEFAULT_TRACKED = ["calories", "protein", "carbs", "fat", "fiber"];

const TRACKING_PRESETS = {
  "Just Macros": ["calories","protein","carbs","fat","fiber"],
  "Weight Loss": ["calories","protein","carbs","fat","fiber","sodium","sugar","water"],
  "General Health": ["calories","protein","carbs","fat","fiber","vitA","vitC","vitD","vitB12","iron","calcium"],
  "Track Everything": null,
};

// All trackable nutrient keys with display info for the modal
const ALL_TRACKABLE = [
  { section: "Macros", items: [
    { key: "calories", name: "Calories" },
    { key: "protein", name: "Protein" },
    { key: "carbs", name: "Carbs" },
    { key: "fat", name: "Fat" },
  ]},
  { section: "Vitamins", items: [
    { key: "vitA", name: "Vitamin A" },
    { key: "vitB1", name: "B1 Thiamine" },
    { key: "vitB2", name: "B2 Riboflavin" },
    { key: "vitB3", name: "B3 Niacin" },
    { key: "vitB6", name: "Vitamin B6" },
    { key: "vitB9", name: "B9 Folate" },
    { key: "vitB12", name: "Vitamin B12" },
    { key: "vitC", name: "Vitamin C" },
    { key: "vitD", name: "Vitamin D" },
    { key: "vitE", name: "Vitamin E" },
    { key: "vitK", name: "Vitamin K" },
  ]},
  { section: "Minerals", items: [
    { key: "calcium", name: "Calcium" },
    { key: "iron", name: "Iron" },
    { key: "magnesium", name: "Magnesium" },
    { key: "phosphorus", name: "Phosphorus" },
    { key: "potassium", name: "Potassium" },
    { key: "sodium", name: "Sodium" },
    { key: "zinc", name: "Zinc" },
    { key: "selenium", name: "Selenium" },
  ]},
  { section: "Fats", items: [
    { key: "satFat", name: "Saturated Fat" },
    { key: "transFat", name: "Trans Fat" },
    { key: "cholesterol", name: "Cholesterol" },
  ]},
  { section: "Other", items: [
    { key: "fiber", name: "Fiber" },
    { key: "sugar", name: "Sugar" },
    { key: "addedSugar", name: "Added Sugar" },
    { key: "water", name: "Water" },
  ]},
];

function sumMacros(items) {
  let cal = 0, protein = 0, carbs = 0, fat = 0;
  const micros = {};
  for (const k of ALL_MICRO_KEYS) micros[k] = 0;
  for (const it of items) {
    cal += Number(it.calories) || 0;
    protein += Number(it.protein) || 0;
    carbs += Number(it.carbs) || 0;
    fat += Number(it.fat) || 0;
    for (const k of ALL_MICRO_KEYS) {
      micros[k] += Number(it[k]) || 0;
    }
  }
  return { cal, protein, carbs, fat, ...micros };
}

const MICRO_SECTIONS = [
  {
    title: "Vitamins",
    items: [
      { key: "vitA", name: "Vitamin A", unit: "\u03BCg", rda: 900 },
      { key: "vitB1", name: "B1 Thiamine", unit: "mg", rda: 1.2 },
      { key: "vitB2", name: "B2 Riboflavin", unit: "mg", rda: 1.3 },
      { key: "vitB3", name: "B3 Niacin", unit: "mg", rda: 16 },
      { key: "vitB6", name: "Vitamin B6", unit: "mg", rda: 1.7 },
      { key: "vitB9", name: "B9 Folate", unit: "\u03BCg", rda: 400 },
      { key: "vitB12", name: "Vitamin B12", unit: "\u03BCg", rda: 2.4 },
      { key: "vitC", name: "Vitamin C", unit: "mg", rda: 90 },
      { key: "vitD", name: "Vitamin D", unit: "\u03BCg", rda: 20 },
      { key: "vitE", name: "Vitamin E", unit: "mg", rda: 15 },
      { key: "vitK", name: "Vitamin K", unit: "\u03BCg", rda: 120 },
    ]
  },
  {
    title: "Minerals",
    items: [
      { key: "calcium", name: "Calcium", unit: "mg", rda: 1000 },
      { key: "iron", name: "Iron", unit: "mg", rda: 18 },
      { key: "magnesium", name: "Magnesium", unit: "mg", rda: 420 },
      { key: "phosphorus", name: "Phosphorus", unit: "mg", rda: 700 },
      { key: "potassium", name: "Potassium", unit: "mg", rda: 4700 },
      { key: "sodium", name: "Sodium", unit: "mg", rda: 2300 },
      { key: "zinc", name: "Zinc", unit: "mg", rda: 11 },
      { key: "selenium", name: "Selenium", unit: "\u03BCg", rda: 55 },
    ]
  },
  {
    title: "Fats Breakdown",
    items: [
      { key: "satFat", name: "Saturated Fat", unit: "g", ceiling: 22 },
      { key: "transFat", name: "Trans Fat", unit: "g", ceiling: 2 },
      { key: "cholesterol", name: "Cholesterol", unit: "mg", ceiling: 300 },
    ]
  },
  {
    title: "Other",
    items: [
      { key: "sugar", name: "Sugar", unit: "g", rda: 50, ceiling: 75 },
      { key: "addedSugar", name: "Added Sugar", unit: "g", ceiling: 25 },
      { key: "fiber", name: "Fiber", unit: "g", rda: 25 },
      { key: "water", name: "Water", unit: "ml", rda: 3700 },
    ]
  },
];

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

function MicroBar({ name, value, unit, rda, ceiling, V }) {
  // rda = recommended daily allowance (target), ceiling = upper limit
  const target = rda || ceiling || 1;
  const rdaPct = Math.round((value / target) * 100);
  const barPct = Math.min(rdaPct, 100);

  let status, barColor;
  if (ceiling && !rda) {
    // ceiling-only items (sat fat, trans fat, cholesterol, added sugar)
    if (value <= ceiling * 0.5) { status = "Low"; barColor = V.success; }
    else if (value <= ceiling) { status = "Good"; barColor = "#F1C40F"; }
    else { status = "High"; barColor = "#E67E22"; }
  } else {
    // RDA-based items
    if (rdaPct < 50) { status = "Low"; barColor = "#F1C40F"; }
    else if (rdaPct <= 150) { status = "Good"; barColor = V.success; }
    else { status = "High"; barColor = "#E67E22"; }
  }

  const displayVal = value < 10 ? value.toFixed(1) : fmt(value);
  const displayTarget = rda ? (rda < 10 ? rda.toFixed(1) : fmt(rda)) : (ceiling < 10 ? ceiling.toFixed(1) : fmt(ceiling));

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3, flexWrap: "wrap", gap: 2 }}>
        <span style={{ color: V.textPrimary, fontWeight: 600 }}>{name}</span>
        <span style={{ color: V.textMuted }}>
          {displayVal} / {displayTarget} {unit} ({rdaPct}%) — <span style={{ color: barColor, fontWeight: 600 }}>[{status}]</span>
        </span>
      </div>
      <div style={{ height: 8, background: V.bgInput, borderRadius: 4, overflow: "hidden", position: "relative" }}>
        <div style={{
          height: "100%", width: `${barPct}%`, background: barColor,
          borderRadius: 4, transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}

function NetCarbsDisplay({ carbs, fiber, V }) {
  const netCarbs = Math.max(0, Math.round(carbs - fiber));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: V.textMuted, marginTop: 4, paddingLeft: 4 }}>
      <span style={{ fontWeight: 600, color: V.textSecondary }}>Net Carbs:</span>
      <span>{netCarbs}g</span>
      <span style={{ fontSize: 10, color: V.textDim }}>(carbs {fmt(carbs)}g - fiber {fmt(fiber)}g)</span>
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

// ═══ MEAL SCORER (Task 4) ═══
function scoreMeal(items) {
  if (!items || items.length === 0) return null;
  const totalCal = items.reduce((s, f) => s + (Number(f.calories) || 0), 0);
  if (totalCal < 50) return null;
  const protein = items.reduce((s, f) => s + (Number(f.protein) || 0), 0);
  const fiber = items.reduce((s, f) => s + (Number(f.fiber) || 0), 0);
  const sugar = items.reduce((s, f) => s + (Number(f.sugar) || 0), 0);
  const satFat = items.reduce((s, f) => s + (Number(f.satFat) || 0), 0);

  let score = 100;
  const proteinRatio = totalCal > 0 ? (protein * 4) / totalCal : 0;
  if (proteinRatio >= 0.30) score += 0;
  else if (proteinRatio >= 0.20) score -= 10;
  else score -= 25;
  if (fiber >= 5) score += 0;
  else if (fiber >= 3) score -= 5;
  else score -= 15;
  if (sugar <= 15) score += 0;
  else if (sugar <= 30) score -= 10;
  else score -= 25;
  if (satFat <= 8) score += 0;
  else if (satFat <= 15) score -= 10;
  else score -= 20;

  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

// ═══ MAIN COMPONENT ═══

export default function FoodTab({ V, currentProfile, foodLog, myFoods, nutritionGoals, fbSet, GROQ_KEY, showToast, profiles, weightLog: weightLogProp = [] }) {
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
  const [expandedMicroSections, setExpandedMicroSections] = useState({});
  const [trackedNutrients, setTrackedNutrients] = useState(null); // null = use defaults
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [pendingTracked, setPendingTracked] = useState(null); // editing state in modal

  const recognitionRef = useRef(null);
  const voiceTimerRef = useRef(null);

  // ── Derived values ──
  const today = todayStr();
  const log = Array.isArray(foodLog) ? foodLog : [];
  const profileId = typeof currentProfile === "string" ? currentProfile : currentProfile?.name;
  const todayLog = log.filter(f => f.date === today && f.profile === currentProfile);
  const goals = nutritionGoals || { calories: 2200, protein: 150, carbs: 250, fat: 70 };
  const todayMacros = sumMacros(todayLog);

  // ── Adaptive TDEE (Task 3) ──
  const tdeeResult = useMemo(() => {
    const profileLog = (Array.isArray(foodLog) ? foodLog : []).filter(f =>
      f.profile === profileId || f.profile?.name === profileId
    );
    const sorted = [...(weightLogProp.length > 0 ? weightLogProp : weightLog)]
      .sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 2) return null;

    const startDate = sorted[0].date;
    const endDate = sorted[sorted.length - 1].date;

    const daysWithFood = {};
    for (const entry of profileLog) {
      if (entry.date >= startDate && entry.date <= endDate) {
        daysWithFood[entry.date] = (daysWithFood[entry.date] || 0) + (Number(entry.calories) || 0);
      }
    }
    const foodDays = Object.keys(daysWithFood);
    if (foodDays.length < 7) return null;

    const elapsedDays = calendarDaysBetween(startDate, endDate);
    if (!Number.isFinite(elapsedDays) || elapsedDays <= 0) return null;

    const avgCal = foodDays.reduce((s, d) => s + daysWithFood[d], 0) / foodDays.length;
    const startWeight = Number(sorted[0].weight);
    const endWeight = Number(sorted[sorted.length - 1].weight);
    const weightChangeLbs = endWeight - startWeight;
    const energyStoredPerDay = (weightChangeLbs * 3500) / elapsedDays;
    const tdee = Math.round(avgCal - energyStoredPerDay);

    if (tdee < 800 || tdee > 6000) return null;
    return { tdee, days: foodDays.length, weightChange: weightChangeLbs.toFixed(1) };
  }, [foodLog, weightLogProp, weightLog, profileId]);

  // ── Logging streak (Task 5) ──
  const loggingStreak = useMemo(() => {
    const profileLog = (Array.isArray(foodLog) ? foodLog : []).filter(f =>
      f.profile === profileId || f.profile?.name === profileId
    );
    if (profileLog.length === 0) return 0;
    const loggedDays = new Set(profileLog.map(f => f.date));
    let streak = 0;
    const d = new Date();
    while (true) {
      const dk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (!loggedDays.has(dk)) break;
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }, [foodLog, profileId]);

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

  // Load tracked nutrients from Firebase nutritionGoals
  useEffect(() => {
    if (nutritionGoals && currentProfile) {
      const profileName = typeof currentProfile === "string" ? currentProfile : currentProfile?.name;
      const profileTracked = nutritionGoals[profileName]?.tracked;
      if (profileTracked) {
        setTrackedNutrients(profileTracked);
      } else if (nutritionGoals.tracked) {
        setTrackedNutrients(nutritionGoals.tracked);
      } else {
        setTrackedNutrients(null); // will use DEFAULT_TRACKED
      }
    }
  }, [nutritionGoals, currentProfile]);

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
      date: today,
      profile: currentProfile,
      meal: meal,
    };
    // Copy all micronutrient fields
    for (const k of ALL_MICRO_KEYS) {
      entry[k] = Number(item[k]) || 0;
    }
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
      { role: "user", content: `Estimate macros for "${searchQuery.trim()}". Return JSON: {"food":"name","cal":number,"protein":number,"carbs":number,"fat":number,"fiber":number,"sodium":number,"sugar":number,"vitA":number,"vitB1":number,"vitB2":number,"vitB3":number,"vitB6":number,"vitB9":number,"vitB12":number,"vitC":number,"vitD":number,"vitE":number,"vitK":number,"calcium":number,"iron":number,"magnesium":number,"phosphorus":number,"potassium":number,"zinc":number,"selenium":number,"satFat":number,"transFat":number,"cholesterol":number,"addedSugar":number,"water":number} per 100g. Use USDA data. All values as numbers.` }
    ], { maxTokens: 600 });
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
    const item = {
      name: searchResults.food || searchQuery,
      calories: (searchResults.cal || 0) * factor,
      protein: (searchResults.protein || 0) * factor,
      carbs: (searchResults.carbs || 0) * factor,
      fat: (searchResults.fat || 0) * factor,
    };
    // Scale all micronutrient fields
    for (const k of ALL_MICRO_KEYS) {
      item[k] = (Number(searchResults[k]) || 0) * factor;
    }
    addFood(item, meal);
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

      const res = await callAI(GROQ_KEY, [
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
    const newEntries = voicePreview.map(item => {
      const entry = {
        name: item.name || item.food || "Unknown Food",
        calories: Math.round(Number(item.calories || item.cal) || 0),
        protein: Math.round(Number(item.protein) || 0),
        carbs: Math.round(Number(item.carbs) || 0),
        fat: Math.round(Number(item.fat) || 0),
        date: today,
        profile: currentProfile,
        meal: item.meal || "Snacks",
      };
      for (const k of ALL_MICRO_KEYS) {
        entry[k] = Number(item[k]) || 0;
      }
      return entry;
    });
    fbSet("foodLog", [...log, ...newEntries]);
    setAddPopup(null);
    setAddMode(null);
    setSearchResults(null);
    setSearchQuery("");
    setServingSize(100);
    setVoicePreview(null);
    showToast(`Logged ${newEntries.length} item(s)`);
  }

  function dedupeWeightLog(entries) {
    const byDate = {};
    for (const entry of entries) {
      if (entry?.date) byDate[entry.date] = entry;
    }
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
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
    const effectiveWeightLog = dedupeWeightLog([...(Array.isArray(weightLogProp) ? weightLogProp : []), ...weightLog]);
    const dedupedLog = dedupeWeightLog([...effectiveWeightLog, { date: today, weight: w }]);
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
    const reItem = {
      name: item.name,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
    };
    for (const k of ALL_MICRO_KEYS) {
      reItem[k] = Number(item[k]) || 0;
    }
    addFood(reItem, meal || addPopup || "Snacks");
  }

  function quickAddMacro(macro, amount) {
    const item = { name: "Quick add", calories: 0, protein: 0, carbs: 0, fat: 0 };
    if (macro === "calories") item.calories = amount;
    else if (macro === "protein") item.protein = amount;
    else if (macro === "carbs") item.carbs = amount;
    else if (macro === "fat") item.fat = amount;
    addFood(item, "Snacks");
  }

  function toggleMicroSection(title) {
    setExpandedMicroSections(prev => ({ ...prev, [title]: !prev[title] }));
  }

  // Resolved tracked list: null means "track everything"
  const activeTracked = trackedNutrients === null ? null : (trackedNutrients || DEFAULT_TRACKED);

  function isTracked(key) {
    if (activeTracked === null) return true; // Track Everything
    return activeTracked.includes(key);
  }

  function openTrackingModal() {
    // Initialize pending state from current tracked
    setPendingTracked(activeTracked === null ? null : [...activeTracked]);
    setShowTrackingModal(true);
  }

  function togglePendingNutrient(key) {
    setPendingTracked(prev => {
      if (prev === null) {
        // "Track Everything" active — switching to explicit list minus this key
        const allKeys = ALL_TRACKABLE.flatMap(s => s.items.map(i => i.key));
        return allKeys.filter(k => k !== key);
      }
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      }
      return [...prev, key];
    });
  }

  function applyPreset(presetName) {
    const preset = TRACKING_PRESETS[presetName];
    setPendingTracked(preset === null ? null : [...preset]);
  }

  function saveTracking() {
    const profileName = typeof currentProfile === "string" ? currentProfile : currentProfile?.name;
    setTrackedNutrients(pendingTracked);
    // Save to Firebase under nutritionGoals
    const updatedGoals = { ...nutritionGoals };
    if (profileName) {
      updatedGoals[profileName] = { ...(updatedGoals[profileName] || {}), tracked: pendingTracked };
    } else {
      updatedGoals.tracked = pendingTracked;
    }
    fbSet("nutritionGoals", updatedGoals);
    showToast("Tracking preferences saved");
    setShowTrackingModal(false);
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

  // Net carbs (computed)
  const netCarbs = Math.max(0, Math.round(todayMacros.carbs - todayMacros.fiber));

  // ═══ RENDER ═══

  return (
    <div style={{ padding: V.sp3, maxWidth: 480, margin: "0 auto" }}>

      {/* ── LOGGING STREAK ── */}
      {(Array.isArray(foodLog) ? foodLog : []).some(f => f.profile === profileId || f.profile?.name === profileId) && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 6, marginBottom: 10, padding: "8px 16px",
          background: loggingStreak > 0 ? V.bgCardAlt : "transparent",
          borderRadius: V.r2, fontSize: 13, fontWeight: 600, color: V.textPrimary,
        }}>
          {loggingStreak > 0
            ? <><span>🔥</span><span>{loggingStreak}-day logging streak</span></>
            : <span style={{ color: V.textMuted, fontWeight: 400 }}>Log today to start a streak!</span>
          }
        </div>
      )}

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
        <button
          onClick={openTrackingModal}
          style={{ ...btnBase, padding: "6px 12px", background: V.bgCardAlt, color: V.textMuted, fontSize: 12, fontWeight: 600 }}
          title="Customize Tracking"
        >
          &#9776; Track
        </button>
      </div>

      {/* ── DASHBOARD HAT: DAILY ── */}
      {hatMode === "daily" && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 8 }}>
            {isTracked("calories") && <MacroRing value={todayMacros.cal} target={goals.calories || 2200} color="#4A90D9" label="Calories" unit="cal" size={76} />}
            {isTracked("protein") && <MacroRing value={todayMacros.protein} target={goals.protein || 150} color="#E74C3C" label="Protein" unit="g" size={76} />}
            {isTracked("carbs") && <MacroRing value={todayMacros.carbs} target={goals.carbs || 250} color="#F1C40F" label="Carbs" unit="g" size={76} />}
            {isTracked("fat") && <MacroRing value={todayMacros.fat} target={goals.fat || 70} color="#9B59B6" label="Fat" unit="g" size={76} />}
          </div>
          {isTracked("calories") && (
            <div style={{ textAlign: "center", marginTop: 10, fontSize: 13, color: V.textMuted, fontWeight: 600 }}>
              Net: {fmt(todayMacros.cal)} cal
            </div>
          )}
          {isTracked("carbs") && isTracked("fiber") && (
            <NetCarbsDisplay carbs={todayMacros.carbs} fiber={todayMacros.fiber} V={V} />
          )}
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
        <div style={{ ...card, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <MacroRing value={todayMacros.cal} target={goals.calories || 2200} color="#4A90D9" label="Net Energy" unit="cal" size={120} strokeWidth={10} />
          <div style={{ textAlign: "center" }}>
            {tdeeResult ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: V.textPrimary }}>
                  Est. TDEE: {tdeeResult.tdee} cal/day
                </div>
                <div style={{ fontSize: 12, color: V.textMuted, marginTop: 2 }}>
                  ({tdeeResult.days}-day average · {Math.abs(tdeeResult.weightChange)} lb {Number(tdeeResult.weightChange) >= 0 ? "gained" : "lost"})
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: V.textMuted }}>
                Log 7+ days of weight &amp; food to unlock TDEE
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MICRONUTRIENT SECTIONS (collapsible, filtered by tracked) ── */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: V.textPrimary, marginBottom: 8 }}>Micronutrients</div>
        {MICRO_SECTIONS.map(section => {
          const trackedItems = section.items.filter(item => isTracked(item.key));
          if (trackedItems.length === 0) return null;
          const isOpen = !!expandedMicroSections[section.title];
          return (
            <div key={section.title} style={{ marginBottom: 4 }}>
              <button
                onClick={() => toggleMicroSection(section.title)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 4px", border: "none", background: "transparent",
                  cursor: "pointer", minHeight: 44, borderBottom: `1px solid ${V.borderSubtle}`,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: V.textSecondary }}>{section.title}</span>
                <span style={{ fontSize: 14, color: V.textMuted, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                  &#9660;
                </span>
              </button>
              {isOpen && (
                <div style={{ padding: "8px 0" }}>
                  {trackedItems.map(item => {
                    const val = todayMacros[item.key] || 0;
                    if (item.key === "netCarbs") {
                      return (
                        <div key={item.key} style={{ fontSize: 12, color: V.textMuted, padding: "4px 0", fontWeight: 500 }}>
                          Net Carbs: {netCarbs}g (display only)
                        </div>
                      );
                    }
                    return (
                      <MicroBar
                        key={item.key}
                        name={item.name}
                        value={val}
                        unit={item.unit}
                        rda={item.rda || null}
                        ceiling={item.ceiling || null}
                        V={V}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── QUICK ADD MACRO BUTTONS ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={() => quickAddMacro("calories", 100)} style={{ ...btnBase, flex: 1, minWidth: 80, padding: "6px 10px", background: V.bgCardAlt, color: V.textSecondary, fontSize: 12 }}>
          +100 Cal
        </button>
        <button onClick={() => quickAddMacro("protein", 10)} style={{ ...btnBase, flex: 1, minWidth: 80, padding: "6px 10px", background: V.bgCardAlt, color: V.textSecondary, fontSize: 12 }}>
          +10g Protein
        </button>
        <button onClick={() => quickAddMacro("carbs", 15)} style={{ ...btnBase, flex: 1, minWidth: 80, padding: "6px 10px", background: V.bgCardAlt, color: V.textSecondary, fontSize: 12 }}>
          +15g Carbs
        </button>
        <button onClick={() => quickAddMacro("fat", 5)} style={{ ...btnBase, flex: 1, minWidth: 80, padding: "6px 10px", background: V.bgCardAlt, color: V.textSecondary, fontSize: 12 }}>
          +5g Fat
        </button>
      </div>

      {/* ── MEAL SECTIONS ── */}
      {MEALS.map(meal => {
        const mealItems = todayLog.filter(f => f.meal === meal.key);
        const mealCals = mealItems.reduce((s, f) => s + (Number(f.calories) || 0), 0);
        const expanded = expandedMeals[meal.key];
        const grade = scoreMeal(mealItems);

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
                {grade && (
                  <span style={{
                    fontSize: 12, fontWeight: 700, marginLeft: 6, padding: "1px 6px",
                    borderRadius: V.r1 || 4,
                    background: grade === "A" ? "#22c55e" : grade === "B" ? "#3b82f6" : grade === "C" ? "#f59e0b" : grade === "D" ? "#f97316" : "#ef4444",
                    color: "#fff",
                  }} aria-label={`Meal grade ${grade}`}>
                    {grade}
                  </span>
                )}
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

      {/* ── CUSTOMIZE TRACKING MODAL ── */}
      {showTrackingModal && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: V.bgOverlay, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowTrackingModal(false); }}
        >
          <div style={{
            background: V.bgCard, borderRadius: V.r4, padding: V.sp5,
            width: "100%", maxWidth: 420, boxShadow: V.shadowModal,
            maxHeight: "85vh", overflowY: "auto",
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: V.textPrimary }}>Customize Tracking</span>
              <button onClick={() => setShowTrackingModal(false)} style={{ ...btnBase, minWidth: 36, minHeight: 36, padding: 0, background: "transparent", color: V.textMuted, fontSize: 18 }}>
                &#10005;
              </button>
            </div>

            {/* Presets */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: V.textSecondary, marginBottom: 8 }}>Quick Presets</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.keys(TRACKING_PRESETS).map(presetName => {
                  const presetVal = TRACKING_PRESETS[presetName];
                  const isActive = pendingTracked === null
                    ? presetVal === null
                    : presetVal !== null && JSON.stringify([...presetVal].sort()) === JSON.stringify([...pendingTracked].sort());
                  return (
                    <button
                      key={presetName}
                      onClick={() => applyPreset(presetName)}
                      style={{
                        ...btnBase, padding: "8px 14px", fontSize: 12,
                        background: isActive ? V.accent : V.bgCardAlt,
                        color: isActive ? "#fff" : V.textSecondary,
                        border: isActive ? "none" : `1px solid ${V.borderDefault}`,
                      }}
                    >
                      {presetName}
                      {isActive ? " (Active)" : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nutrient Toggles by Section */}
            {ALL_TRACKABLE.map(group => (
              <div key={group.section} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: V.textPrimary, marginBottom: 6, borderBottom: `1px solid ${V.borderSubtle}`, paddingBottom: 4 }}>
                  {group.section}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  {group.items.map(item => {
                    const on = pendingTracked === null ? true : pendingTracked.includes(item.key);
                    const val = todayMacros[item.key] || todayMacros[item.key === "calories" ? "cal" : item.key] || 0;
                    return (
                      <button
                        key={item.key}
                        onClick={() => togglePendingNutrient(item.key)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "8px 10px", minHeight: 44,
                          background: on ? V.bgCardAlt : "transparent",
                          border: `1.5px solid ${on ? V.accent : V.borderSubtle}`,
                          borderRadius: V.r2, cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: on ? V.textPrimary : V.textDim }}>
                            {item.name}
                          </span>
                          {on && val > 0 && (
                            <span style={{ fontSize: 10, color: V.textMuted }}>
                              Today: {val < 10 ? val.toFixed(1) : fmt(val)}
                            </span>
                          )}
                        </div>
                        {/* Toggle indicator with text label */}
                        <span style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          minWidth: 36, height: 22, borderRadius: 11, fontSize: 10, fontWeight: 700,
                          background: on ? V.accent : V.borderSubtle,
                          color: on ? "#fff" : V.textDim,
                          transition: "all 0.15s ease",
                        }}>
                          {on ? "ON" : "OFF"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Summary + Save */}
            <div style={{ fontSize: 12, color: V.textMuted, textAlign: "center", marginBottom: 12 }}>
              {pendingTracked === null
                ? "Tracking all nutrients"
                : `Tracking ${pendingTracked.length} nutrient${pendingTracked.length !== 1 ? "s" : ""}`}
            </div>
            <button onClick={saveTracking} style={{ ...btnPrimary, width: "100%" }}>
              Save Tracking Preferences
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
