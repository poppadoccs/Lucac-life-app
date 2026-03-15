import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";
import LucacLegends from "./LucacLegends";
import { groqFetch, parseGroqJSON, cacheGet, cacheSet, SWATCH_COLORS, triggerConfetti, createSpeechRecognition } from "./utils";
import FoodTab from "./FoodTab";
import BudgetTab from "./BudgetTab";
import HomeworkHelper from "./HomeworkHelper";
import GroqAssistant from "./GroqAssistant";

// ⚠️ PASTE YOUR FIREBASE CONFIG HERE (copy from your old App.jsx)
const firebaseConfig = {
  apiKey: "AIzaSyBJpT2hiZhKPei0NMb4d_JDd5OXgq7UvEk",
  authDomain: "lucac-life-app.firebaseapp.com",
  databaseURL: "https://lucac-life-app-default-rtdb.firebaseio.com",
  projectId: "lucac-life-app",
  storageBucket: "lucac-life-app.firebasestorage.app",
  messagingSenderId: "159387832856",
  appId: "1:159387832856:web:2b7ed2ef8a1674fab4a96d"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

const GROQ_KEY = import.meta.env.VITE_GROQ_KEY;
const TAVILY_KEY = import.meta.env.VITE_TAVILY_KEY;

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ═══ CSS VARIABLES — THEME DEFINITIONS ═══
// Shared layout values (spacing, radius) reused across all themes
const SHARED = {
  sp1: 4, sp2: 8, sp3: 12, sp4: 16, sp5: 20, sp6: 24, sp8: 32,
  r1: 6, r2: 8, r3: 12, r4: 16,
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const THEMES = {
  skylight: {
    label: "Skylight", icon: "☀️", desc: "Clean white, gold accents, minimal",
    ...SHARED,
    bgApp: "#f8f9fb", bgCard: "#ffffff", bgCardAlt: "#f4f5f7", bgInput: "#f0f1f3",
    bgElevated: "#eaedf1", bgOverlay: "rgba(0,0,0,0.3)",
    calBgCell: "#ffffff", calBgCellHover: "#f9fafb", calBgToday: "#fffbeb",
    calBgSelected: "#eef4ff", calBgHeader: "#ffffff", calBgWeekday: "#fafbfc",
    borderDefault: "#e5e7eb", borderSubtle: "#d1d5db", borderAccent: "#f59e0b", borderFocus: "#3b82f6",
    textPrimary: "#1f2937", textSecondary: "#374151", textMuted: "#6b7280", textDim: "#9ca3af",
    accent: "#f59e0b", accentGlow: "rgba(245,158,11,0.10)", accentGlowStrong: "rgba(245,158,11,0.20)",
    success: "#16a34a", danger: "#dc2626", info: "#2563eb", purple: "#7c3aed", pink: "#db2777",
    // Soft pastel event pill palette
    pillColors: ["#fce4ec","#e3f2fd","#e8f5e9","#f3e5f5","#fff8e1","#e0f7fa"],
    pillTextColors: ["#ad1457","#1565c0","#2e7d32","#6a1b9a","#f57f17","#00838f"],
    shadowCard: "0 1px 3px rgba(0,0,0,0.04), 0 1px 6px rgba(0,0,0,0.03)",
    shadowModal: "0 8px 30px rgba(0,0,0,0.12)", shadowGlow: "0 0 12px rgba(245,158,11,0.10)",
  },
  cozyla: {
    label: "Cozyla", icon: "🕯️", desc: "Warm creams, coral accents, cozy feel",
    ...SHARED, r1: 8, r2: 10, r3: 14, r4: 20,
    bgApp: "#fdf6ee", bgCard: "#fffaf3", bgCardAlt: "#f7efe4", bgInput: "#f7efe4",
    bgElevated: "#eeddc8", bgOverlay: "rgba(60,40,20,0.4)",
    calBgCell: "#fffaf3", calBgCellHover: "#fff5e8", calBgToday: "#fff0d4",
    calBgSelected: "#fde8d0", calBgHeader: "#fffaf3", calBgWeekday: "#fdf6ee",
    borderDefault: "#e8d5be", borderSubtle: "#d4bfa6", borderAccent: "#e87f5f", borderFocus: "#d97046",
    textPrimary: "#3d2b1f", textSecondary: "#5c4033", textMuted: "#8b7260", textDim: "#b09a88",
    accent: "#e87f5f", accentGlow: "rgba(232,127,95,0.14)", accentGlowStrong: "rgba(232,127,95,0.25)",
    success: "#5a9e6f", danger: "#c4453a", info: "#c47a3a", purple: "#9b6b9e", pink: "#c4637a",
    shadowCard: "0 1px 6px rgba(80,50,20,0.06), 0 2px 10px rgba(80,50,20,0.04)",
    shadowModal: "0 8px 30px rgba(80,50,20,0.18)", shadowGlow: "0 0 14px rgba(232,127,95,0.14)",
  },
  familywall: {
    label: "FamilyWall", icon: "🏠", desc: "Bright white, deep navy accents, bold",
    ...SHARED,
    bgApp: "#f0f4f8", bgCard: "#ffffff", bgCardAlt: "#edf1f7", bgInput: "#edf1f7",
    bgElevated: "#dce3ed", bgOverlay: "rgba(10,20,50,0.45)",
    calBgCell: "#ffffff", calBgCellHover: "#f5f7fa", calBgToday: "#e8edf8",
    calBgSelected: "#dbe4f4", calBgHeader: "#ffffff", calBgWeekday: "#f0f4f8",
    borderDefault: "#c8d2de", borderSubtle: "#afbccc", borderAccent: "#1e3a6e", borderFocus: "#2d5aa0",
    textPrimary: "#0f1d36", textSecondary: "#1e3050", textMuted: "#4a6080", textDim: "#8898ae",
    accent: "#1e3a6e", accentGlow: "rgba(30,58,110,0.10)", accentGlowStrong: "rgba(30,58,110,0.20)",
    success: "#1a7a42", danger: "#c0392b", info: "#2d5aa0", purple: "#5b3a8c", pink: "#b73070",
    shadowCard: "0 1px 3px rgba(10,20,50,0.07), 0 3px 10px rgba(10,20,50,0.05)",
    shadowModal: "0 10px 35px rgba(10,20,50,0.20)", shadowGlow: "0 0 12px rgba(30,58,110,0.10)",
  },
};

function formatTime(h, m, ampm) {
  const hh = String(h).padStart(2,"0");
  const mm = String(m).padStart(2,"0");
  return `${hh}:${mm} ${ampm}`;
}

function parseTime(timeStr) {
  if (!timeStr) return { h: 12, m: 0, ampm: "PM" };
  const parts = timeStr.split(" ");
  const ampm = parts[1] || "AM";
  const [hStr, mStr] = (parts[0] || "12:00").split(":");
  return { h: parseInt(hStr) || 12, m: parseInt(mStr) || 0, ampm };
}

function TimePicker({ value, onChange }) {
  const { h, m, ampm } = parseTime(value);
  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const mins = ["00","05","10","15","20","25","30","35","40","45","50","55"];
  const selStyle = { background:"#f0f1f3", color:"#1f2937", border:"1px solid #d1d5db", borderRadius:6, padding:"6px 8px", fontSize:13 };
  return (
    <div style={{ display:"flex", gap:4, alignItems:"center" }}>
      <select value={h} onChange={e => onChange(formatTime(e.target.value, m, ampm))} style={selStyle}>
        {hours.map(hh => <option key={hh} value={hh}>{hh}</option>)}
      </select>
      <span style={{ color:"#6b7280" }}>:</span>
      <select value={String(m).padStart(2,"0")} onChange={e => onChange(formatTime(h, e.target.value, ampm))} style={selStyle}>
        {mins.map(mm => <option key={mm} value={mm}>{mm}</option>)}
      </select>
      <select value={ampm} onChange={e => onChange(formatTime(h, m, e.target.value))} style={selStyle}>
        <option>AM</option>
        <option>PM</option>
      </select>
    </div>
  );
}

// SWATCH_COLORS imported from utils.js

function SwatchPicker({ value, onChange, label }) {
  const isCustom = value && !SWATCH_COLORS.some(c => c.hex === value);
  return (
    <div style={{ marginBottom:10 }}>
      {label && <div style={{ fontSize:12, color:"#6b7280", marginBottom:6 }}>{label}</div>}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:6 }}>
        {SWATCH_COLORS.map(c => {
          const sel = value === c.hex;
          return (
            <button key={c.hex} onClick={() => onChange(c.hex)} title={c.label}
              style={{ width:44, height:44, borderRadius:10, background:c.hex, border: sel ? "3px solid #fff" : "2px solid transparent",
                cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow: sel ? `0 0 0 2px ${c.hex}, 0 2px 8px ${c.hex}44` : "0 1px 3px rgba(0,0,0,0.15)",
                transition:"box-shadow 0.15s, border 0.15s" }}>
              {sel && <span style={{ color:"#fff", fontSize:18, fontWeight:700, textShadow:"0 1px 2px rgba(0,0,0,0.4)" }}>✓</span>}
            </button>
          );
        })}
        {/* Custom color option */}
        <label title="Custom color" style={{ width:44, height:44, borderRadius:10, cursor:"pointer",
          background: isCustom ? value : "conic-gradient(red,yellow,lime,aqua,blue,magenta,red)",
          border: isCustom ? "3px solid #fff" : "2px solid transparent",
          boxShadow: isCustom ? `0 0 0 2px ${value}` : "0 1px 3px rgba(0,0,0,0.15)",
          display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden" }}>
          {isCustom && <span style={{ color:"#fff", fontSize:18, fontWeight:700, textShadow:"0 1px 2px rgba(0,0,0,0.4)" }}>✓</span>}
          {!isCustom && <span style={{ fontSize:14, textShadow:"0 1px 2px rgba(0,0,0,0.4)", color:"#fff" }}>+</span>}
          <input type="color" value={value || "#3b82f6"} onChange={e => onChange(e.target.value)}
            style={{ position:"absolute", inset:0, opacity:0, cursor:"pointer", width:"100%", height:"100%" }} />
        </label>
      </div>
    </div>
  );
}

function BlockStyleEditor({ style, onChange, onClose }) {
  const s = style || {};
  const [bg, setBg] = useState(s.bg || "#3b82f6");
  const [color, setColor] = useState(s.color || "#ffffff");
  const [size, setSize] = useState(s.size || 13);
  const [bold, setBold] = useState(s.bold || false);
  const [italic, setItalic] = useState(s.italic || false);
  const [cursive, setCursive] = useState(s.cursive || false);

  function save() {
    onChange({ bg, color, size, bold, italic, cursive });
    onClose();
  }

  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.5)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:16, padding:20, width:320, border:"1px solid #e5e7eb", boxShadow:"0 12px 40px rgba(0,0,0,0.15)" }}>
        <div style={{ fontWeight:700, color:"#1f2937", marginBottom:14, fontSize:15 }}>🎨 Customize Block</div>
        <SwatchPicker label="Background Color" value={bg} onChange={setBg} />
        <SwatchPicker label="Text Color" value={color} onChange={setColor} />
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:12, color:"#6b7280", marginBottom:4 }}>Font Size: {size}px</div>
          <input type="range" min={10} max={24} value={size} onChange={e => setSize(Number(e.target.value))}
            style={{ width:"100%", accentColor:"#f59e0b" }} />
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          <button onClick={() => setBold(!bold)} style={{ padding:"6px 14px", borderRadius:8, border:"1px solid #d1d5db", background: bold ? "#f59e0b" : "#f3f4f6", color: bold ? "#fff" : "#374151", fontWeight:700, cursor:"pointer" }}>B</button>
          <button onClick={() => setItalic(!italic)} style={{ padding:"6px 14px", borderRadius:8, border:"1px solid #d1d5db", background: italic ? "#f59e0b" : "#f3f4f6", color: italic ? "#fff" : "#374151", fontStyle:"italic", cursor:"pointer" }}>I</button>
          <button onClick={() => setCursive(!cursive)} style={{ padding:"6px 14px", borderRadius:8, border:"1px solid #d1d5db", background: cursive ? "#f59e0b" : "#f3f4f6", color: cursive ? "#fff" : "#374151", fontFamily:"cursive", cursor:"pointer" }}>C</button>
        </div>
        <div style={{ background: bg, borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:size, color, fontWeight: bold ? 700 : 400, fontStyle: italic ? "italic" : "normal", fontFamily: cursive ? "cursive" : "inherit" }}>
          Preview text
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={save} style={{ flex:1, padding:"10px", borderRadius:10, background:"#f59e0b", color:"#fff", fontWeight:700, border:"none", cursor:"pointer" }}>Save</button>
          <button onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:10, background:"#f3f4f6", color:"#374151", border:"1px solid #d1d5db", cursor:"pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("profiles");
  const [profiles, setProfiles] = useState([{ id:"admin", name:"Me", emoji:"👑", type:"admin", color:"#f59e0b", pin:"1234" }]);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [tab, setTab] = useState("home");
  const [pinInput, setPinInput] = useState("");
  const [pinTarget, setPinTarget] = useState(null);
  const [pinError, setPinError] = useState("");

  // Theme
  const [themeName, setThemeName] = useState("skylight");
  const V = THEMES[themeName] || THEMES.skylight;

  // Calendar
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [calView, setCalView] = useState("M"); // "W" = week, "2W" = biweekly, "M" = month
  const [events, setEvents] = useState({});
  const [eventStyles, setEventStyles] = useState({});
  const [addingEvents, setAddingEvents] = useState([{ title:"", time:"12:00 PM", who:"", notes:"", repeat:"none", repeatEnd:"", repeatCount:0, duration:60 }]);
  const [editingStyle, setEditingStyle] = useState(null); // {dateKey, idx}

  // Routines & Goals
  const [routines, setRoutines] = useState([]);
  const [routineStyles, setRoutineStyles] = useState({});
  const [goals, setGoals] = useState([]);
  const [goalStyles, setGoalStyles] = useState({});
  const [newRoutine, setNewRoutine] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [editingRoutineStyle, setEditingRoutineStyle] = useState(null);
  const [editingGoalStyle, setEditingGoalStyle] = useState(null);

  // Food
  const [fridgeText, setFridgeText] = useState("");
  const [foodLog, setFoodLog] = useState([]);
  const [myFoods, setMyFoods] = useState([]);
  const [nutritionGoals, setNutritionGoals] = useState({});
  const [foodSearch, setFoodSearch] = useState("");
  const [foodResult, setFoodResult] = useState(null);
  const [chefResult, setChefResult] = useState("");
  const [chefLoading, setChefLoading] = useState(false);
  const [foodLoading, setFoodLoading] = useState(false);
  const [manualFood, setManualFood] = useState({ name:"", calories:0, protein:0, carbs:0, fat:0 });
  const [trackedMacros, setTrackedMacros] = useState(["calories","protein"]);
  const [foodSubTab, setFoodSubTab] = useState("fridge");

  // Kids
  const [kidsData, setKidsData] = useState({});
  const [newTask, setNewTask] = useState({});
  const [showGame, setShowGame] = useState(false);
  const [selectedTaskEmoji, setSelectedTaskEmoji] = useState("📝");
  const TASK_EMOJIS = ["🧹","🍽️","🛏️","📚","🐕","🧺","🪥","🎒","🧸","🎨","🏃","🚿","🗑️","🪴","📝","👕","🧤","🥤","🍎","✏️","🎵","🐱","🚗","💤","🪣","📖","🎮","🧹","🪥","⭐"];

  // Family
  const [custodySchedule, setCustodySchedule] = useState({});
  const [myRules, setMyRules] = useState([]);
  const [theirRules, setTheirRules] = useState([]);
  const [sharedRules, setSharedRules] = useState([]);
  const [newMyRule, setNewMyRule] = useState("");
  const [newTheirRule, setNewTheirRule] = useState("");
  const [newSharedRule, setNewSharedRule] = useState("");
  const [exchangeLog, setExchangeLog] = useState([]);
  const [exchangeTimer, setExchangeTimer] = useState(null);
  const [exchangeStart, setExchangeStart] = useState(null);
  const [familySubTab, setFamilySubTab] = useState("schedule");

  // Settings
  const [settingsSubTab, setSettingsSubTab] = useState("profiles");
  const [profileNameEdit, setProfileNameEdit] = useState("");
  const [pinEdit, setPinEdit] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmoji, setNewMemberEmoji] = useState("😊");
  const [newMemberType, setNewMemberType] = useState("family");
  const [contactDad, setContactDad] = useState("");
  const [contactMom, setContactMom] = useState("");
  const [alertMinutes, setAlertMinutes] = useState(15);
  const [saveFeedback, setSaveFeedback] = useState("");

  // AI Chat
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Daily quote
  const [quote, setQuote] = useState("Every day you show up for your kids is a win. 💙");

  // AI Quick Add
  const [quickAddInput, setQuickAddInput] = useState("");
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddPreview, setQuickAddPreview] = useState(null); // {events: [...]}
  const [quickAddDeleteMatches, setQuickAddDeleteMatches] = useState(null); // {keyword, matches: [{dk, idx, ev}]}
  const [quickAddEditPreview, setQuickAddEditPreview] = useState(null); // {dk, idx, ev, changes}

  // Widget customization (per profile)
  const [widgetPrefs, setWidgetPrefs] = useState({});
  const [editingWidget, setEditingWidget] = useState(null); // widget key being edited

  // Guest / Privacy Mode (memory only — resets on reload for safety)
  const [guestMode, setGuestMode] = useState(false);
  const [guestPinPrompt, setGuestPinPrompt] = useState(false);
  const [guestPinInput, setGuestPinInput] = useState("");

  // Voice input (shared across app)
  const [isRecording, setIsRecording] = useState(false);
  const speechRef = useRef(null);

  // AI Goals Suggester
  const [suggestedGoals, setSuggestedGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(false);

  // Budget + Shopping List + Homework
  const [budgetData, setBudgetData] = useState({ transactions: [], categoryBudgets: {} });
  const [shoppingList, setShoppingList] = useState([]);
  const [weightLog, setWeightLog] = useState({});
  const [homeworkSessions, setHomeworkSessions] = useState({});

  // Call buttons (upgradable)
  const [callButtons, setCallButtons] = useState([]);
  // Quote customization
  const [quoteMode, setQuoteMode] = useState("motivational"); // motivational, tip, dolphin, custom
  const [customQuotePrompt, setCustomQuotePrompt] = useState("");
  // Jr assistant history
  const [jrHistory, setJrHistory] = useState({});
  // PIN visibility
  const [showPin, setShowPin] = useState(false);
  // Theme customization overrides
  const [themeOverrides, setThemeOverrides] = useState({});

  // Offline + Toast infrastructure
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [toast, setToast] = useState(null); // {message, type: "success"|"error"|"info"}

  function showToast(message, type = "info", duration = 3000) {
    setToast({ message, type });
    setTimeout(() => setToast(null), duration);
  }

  // Offline detection
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => { setIsOffline(false); showToast("Back online!", "success"); };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => { window.removeEventListener("offline", goOffline); window.removeEventListener("online", goOnline); };
  }, []);

  const isAdmin = currentProfile?.type === "admin";
  const isKid = currentProfile?.type === "kid";

  // Firebase sync with localStorage cache fallback
  const FB_KEYS = ["events","eventStyles","routines","routineStyles","goals","goalStyles",
    "profiles","kidsData","custodySchedule","myRules","theirRules","sharedRules",
    "exchangeLog","foodLog","myFoods","nutritionGoals","trackedMacros","contacts","alertMinutes","themeName","widgetPrefs",
    "budgetData","shoppingList","weightLog","homeworkSessions","callButtons","quoteMode","customQuotePrompt","jrHistory","themeOverrides"];

  const fbSetters = {
    events: setEvents, eventStyles: setEventStyles, routines: setRoutines,
    routineStyles: setRoutineStyles, goals: setGoals, goalStyles: setGoalStyles,
    profiles: setProfiles, kidsData: setKidsData, custodySchedule: setCustodySchedule,
    myRules: setMyRules, theirRules: setTheirRules, sharedRules: setSharedRules,
    exchangeLog: setExchangeLog, foodLog: setFoodLog, myFoods: setMyFoods,
    nutritionGoals: v => setNutritionGoals(v || {}), trackedMacros: setTrackedMacros,
    contacts: v => { setContactDad(v?.dad||""); setContactMom(v?.mom||""); },
    alertMinutes: setAlertMinutes,
    themeName: v => { if (THEMES[v]) setThemeName(v); },
    widgetPrefs: v => setWidgetPrefs(v || {}),
    budgetData: v => setBudgetData(v || { transactions: [], categoryBudgets: {} }),
    shoppingList: v => setShoppingList(v || []),
    weightLog: v => setWeightLog(v || {}),
    homeworkSessions: v => setHomeworkSessions(v || {}),
    callButtons: v => setCallButtons(v || []),
    quoteMode: v => setQuoteMode(v || "motivational"),
    customQuotePrompt: v => setCustomQuotePrompt(v || ""),
    jrHistory: v => setJrHistory(v || {}),
    themeOverrides: v => setThemeOverrides(v || {}),
  };

  // Pre-populate from localStorage cache on mount
  useEffect(() => {
    FB_KEYS.forEach(key => {
      const cached = cacheGet(key);
      if (cached != null && fbSetters[key]) fbSetters[key](cached);
    });
  }, []);

  // Live Firebase listeners + cache writes
  useEffect(() => {
    FB_KEYS.forEach(key => {
      onValue(ref(db, key), snap => {
        if (snap.exists()) {
          const val = snap.val();
          cacheSet(key, val);
          if (fbSetters[key]) fbSetters[key](val);
        }
      });
    });
  }, []);

  function fbSet(key, val) {
    set(ref(db, key), val).catch(() => {
      // If Firebase write fails (offline), cache locally — Firebase RTDB will sync when back online
      cacheSet(key, val);
    });
  }

  function showSave(msg) {
    setSaveFeedback(msg);
    setTimeout(() => setSaveFeedback(""), 2000);
  }

  // Fetch daily quote on mount (using groqFetch wrapper)
  useEffect(() => {
    if (!GROQ_KEY) return;
    groqFetch(GROQ_KEY, [
      { role: "user", content: "Give me one short motivational quote (under 15 words) for a single dad building his own business. Just the quote, no attribution." }
    ], { maxTokens: 80 }).then(r => {
      if (r.ok && r.data) setQuote(r.data.replace(/"/g, ""));
    });
  }, []);

  // Calendar helpers
  function getDaysInMonth(y, m) { return new Date(y, m+1, 0).getDate(); }
  function getFirstDay(y, m) { return new Date(y, m, 1).getDay(); }
  function dateKey(y, m, d) { return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }
  function todayKey() { return dateKey(today.getFullYear(), today.getMonth(), today.getDate()); }

  // Birthday helpers
  function daysUntilBirthday(mmdd) {
    if (!mmdd) return 999;
    const [mm, dd] = mmdd.split("-").map(Number);
    let next = new Date(today.getFullYear(), mm - 1, dd);
    if (next < today && !(next.getMonth() === today.getMonth() && next.getDate() === today.getDate())) {
      next = new Date(today.getFullYear() + 1, mm - 1, dd);
    }
    return Math.ceil((next - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
  }
  function getUpcomingBirthdays() {
    return (profiles || []).filter(p => p.birthday).map(p => ({
      name: p.name, emoji: p.emoji, birthday: p.birthday, daysUntil: daysUntilBirthday(p.birthday)
    })).sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 3);
  }

  function generateRepeats(ev, startDate) {
    const dates = [startDate];
    if (ev.repeat === "none") return dates;
    const maxOccurrences = ev.repeatCount > 0 ? ev.repeatCount : 52;
    const endDate = ev.repeatEnd ? new Date(ev.repeatEnd + "T23:59:59") : null;
    for (let i = 1; i < maxOccurrences; i++) {
      const d = new Date(startDate);
      if (ev.repeat === "daily") d.setDate(d.getDate() + i);
      else if (ev.repeat === "weekly") d.setDate(d.getDate() + i * 7);
      else if (ev.repeat === "monthly") d.setMonth(d.getMonth() + i);
      if (endDate && d > endDate) break;
      if (d.getFullYear() > startDate.getFullYear() + 2) break;
      dates.push(d);
    }
    return dates;
  }

  function saveEvents() {
    if (!selectedDay) return;
    const valid = addingEvents.filter(e => e.title.trim());
    if (!valid.length) { setSelectedDay(null); return; }
    const updated = { ...(events || {}) };
    valid.forEach(ev => {
      const startDate = new Date(calYear, calMonth, selectedDay);
      const dates = generateRepeats(ev, startDate);
      const eventData = { title: ev.title, time: ev.time, who: ev.who, notes: ev.notes, duration: ev.duration || 60 };
      if (ev.repeat !== "none") eventData.repeat = ev.repeat;
      dates.forEach(d => {
        const dk = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
        updated[dk] = [...(updated[dk] || []), eventData];
      });
    });
    fbSet("events", updated);
    setAddingEvents([{ title:"", time:"12:00 PM", who:"", notes:"", repeat:"none", repeatEnd:"", repeatCount:0, duration:60 }]);
    setSelectedDay(null);
  }

  function deleteEvent(dk, idx) {
    const updated = { ...events, [dk]: events[dk].filter((_,i)=>i!==idx) };
    if (!updated[dk].length) delete updated[dk];
    fbSet("events", updated);
  }

  function saveEventStyle(dk, idx, style) {
    const key = `${dk}_${idx}`;
    const updated = { ...(eventStyles || {}), [key]: style };
    fbSet("eventStyles", updated);
  }

  function getEventStyle(dk, idx) {
    return (eventStyles || {})[`${dk}_${idx}`] || null;
  }

  function getPersonColor(who) {
    const p = (profiles || []).find(p => p.name === who);
    return p?.color || "#f59e0b";
  }

  // Routines
  function addRoutine() {
    if (!newRoutine.trim()) return;
    const updated = [...(routines || []), { id: Date.now(), text: newRoutine, done: false }];
    fbSet("routines", updated);
    setNewRoutine("");
  }
  function toggleRoutine(idx) {
    const updated = [...(routines || [])];
    const item = { ...updated[idx] };
    if (item.done) { item.done = false; updated[idx] = item; fbSet("routines", updated); return; }
    const td = new Date();
    const todayISO = td.getFullYear()+"-"+String(td.getMonth()+1).padStart(2,"0")+"-"+String(td.getDate()).padStart(2,"0");
    const yd = new Date(td); yd.setDate(yd.getDate()-1);
    const yesterdayISO = yd.getFullYear()+"-"+String(yd.getMonth()+1).padStart(2,"0")+"-"+String(yd.getDate()).padStart(2,"0");
    let streak = item.streakCount || 0;
    if (item.lastCompleted === todayISO) { /* no change */ }
    else if (item.lastCompleted === yesterdayISO) { streak += 1; }
    else { streak = 1; }
    item.done = true; item.streakCount = streak; item.lastCompleted = todayISO;
    if (streak >= 30) item.hasCrown = true;
    updated[idx] = item;
    fbSet("routines", updated);
    if (streak >= 7) { triggerConfetti(document.body, "big"); showToast("STREAK MASTER! 🔥", "success"); }
    else if (streak >= 3) { triggerConfetti(document.body, "small"); }
  }
  function deleteRoutine(idx) {
    fbSet("routines", (routines||[]).filter((_,i)=>i!==idx));
  }

  // Goals
  function addGoal() {
    if (!newGoal.trim()) return;
    const updated = [...(goals || []), { id: Date.now(), text: newGoal, done: false }];
    fbSet("goals", updated);
    setNewGoal("");
  }
  function toggleGoal(idx) {
    const updated = [...(goals || [])];
    updated[idx] = { ...updated[idx], done: !updated[idx].done };
    fbSet("goals", updated);
  }
  function deleteGoal(idx) {
    fbSet("goals", (goals||[]).filter((_,i)=>i!==idx));
  }

  // ═══ AI QUICK ADD ═══
  // ═══ AI QUICK ADD (with update-existing support) ═══
  // ═══ SEARCH EVENTS BY KEYWORD ═══
  function searchEvents(keyword) {
    const matches = [];
    const kw = keyword.toLowerCase();
    Object.entries(events || {}).forEach(([dk, dayEvs]) => {
      (dayEvs || []).forEach((ev, idx) => {
        if (ev.title.toLowerCase().includes(kw)) matches.push({ dk, idx, ev });
      });
    });
    return matches;
  }

  function executeDeleteMatch(dk, idx) {
    const updated = { ...(events || {}) };
    updated[dk] = (updated[dk] || []).filter((_, i) => i !== idx);
    if (!updated[dk].length) delete updated[dk];
    fbSet("events", updated);
    showToast("Event deleted!", "success");
    setQuickAddDeleteMatches(null);
  }

  function executeEditMatch(dk, idx, changes) {
    const updated = { ...(events || {}) };
    updated[dk] = [...(updated[dk] || [])];
    updated[dk][idx] = { ...updated[dk][idx], ...changes };
    fbSet("events", updated);
    showToast("Event updated!", "success");
    setQuickAddEditPreview(null);
  }

  async function handleQuickAdd() {
    if (!quickAddInput.trim()) return;
    if (!GROQ_KEY) { showToast("No Groq API key configured", "error"); return; }
    setQuickAddLoading(true);
    const members = familyNames.join(", ");
    const input = quickAddInput.trim();

    // ── DELETE: show matching events as cards ──
    const deleteMatch = input.match(/^(delete|remove|cancel)\s+(?:my\s+|all\s+)?(.+?)(?:\s+events?)?$/i);
    if (deleteMatch) {
      const keyword = deleteMatch[2].trim();
      const matches = searchEvents(keyword);
      if (matches.length === 0) {
        showToast(`I couldn't find anything called "${keyword}"`, "error");
      } else if (matches.length === 1) {
        setQuickAddDeleteMatches({ keyword, matches, single: true });
      } else {
        setQuickAddDeleteMatches({ keyword, matches, single: false });
      }
      setQuickAddLoading(false); setQuickAddInput(""); return;
    }

    // ── EDIT: change time or rename ──
    const editTimeMatch = input.match(/^(?:change|move|set)\s+(.+?)\s+to\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    const renameMatch = input.match(/^rename\s+(.+?)\s+to\s+(.+)$/i);
    if (editTimeMatch || renameMatch) {
      const keyword = (editTimeMatch ? editTimeMatch[1] : renameMatch[1]).trim();
      const matches = searchEvents(keyword);
      if (matches.length === 0) {
        showToast(`I couldn't find anything called "${keyword}"`, "error");
      } else {
        const m = matches[0]; // take first match
        const changes = editTimeMatch
          ? { time: editTimeMatch[2].trim().toUpperCase() }
          : { title: renameMatch[2].trim() };
        setQuickAddEditPreview({ ...m, changes, keyword });
      }
      setQuickAddLoading(false); setQuickAddInput(""); return;
    }

    // ── COLOR: make X red ──
    const colorMatch = input.match(/^(make|change|set|update)\s+(.+?)\s+(?:color\s+(?:to\s+)?)?(red|orange|gold|yellow|green|teal|blue|purple|pink|coral|brown|gray|#[0-9a-f]{6})/i);
    if (colorMatch) {
      const keyword = colorMatch[2].toLowerCase().replace(/\s*(events?|color|to)\s*/g," ").trim();
      const colorMap = {}; SWATCH_COLORS.forEach(c => { colorMap[c.label.toLowerCase()] = c.hex; });
      const targetColor = colorMap[colorMatch[3].toLowerCase()] || colorMatch[3];
      const matches = searchEvents(keyword);
      if (matches.length > 0) {
        const updated = { ...(eventStyles || {}) };
        matches.forEach(m => { updated[`${m.dk}_${m.idx}`] = { ...(updated[`${m.dk}_${m.idx}`] || {}), bg: targetColor }; });
        fbSet("eventStyles", updated);
        showToast(`Updated ${matches.length} event${matches.length>1?"s":""} to ${colorMatch[3]}`, "success");
      } else {
        showToast(`I couldn't find anything called "${keyword}"`, "error");
      }
      setQuickAddLoading(false); setQuickAddInput(""); return;
    }

    // ── CREATE: normal Groq event creation ──
    const result = await groqFetch(GROQ_KEY, [
      { role: "system", content: `You extract calendar events from natural language. Family members: ${members}. Today is ${todayStr}. Return ONLY valid JSON array. Each event: {"title":"string","date":"YYYY-MM-DD","time":"HH:MM AM/PM","who":"name or empty","notes":"","repeat":"none|daily|weekly|monthly","repeatCount":number_or_0,"duration":minutes}. For repeating, set repeatCount to total occurrences. Default duration 60. Return raw JSON array only.` },
      { role: "user", content: input }
    ]);

    if (!result.ok) {
      showToast(`I heard "${input}" but couldn't process it — ${result.error}`, "error");
      setQuickAddLoading(false); return;
    }

    const parsed = parseGroqJSON(result.data);
    if (Array.isArray(parsed) && parsed.length > 0) {
      let totalInstances = 0;
      parsed.forEach(ev => {
        const fakeEv = { ...ev, repeatEnd: "", repeatCount: ev.repeatCount || 0 };
        totalInstances += generateRepeats(fakeEv, new Date(ev.date + "T00:00:00")).length;
      });
      const repeatDesc = parsed.some(e => e.repeat && e.repeat !== "none")
        ? ` (${parsed[0].repeat} x${totalInstances})` : "";
      setQuickAddPreview({ events: parsed, totalInstances, repeatDesc, input });
    } else {
      showToast(`I heard "${input}" but couldn't understand it — try rephrasing`, "error");
    }
    setQuickAddLoading(false);
  }

  function confirmQuickAdd() {
    if (!quickAddPreview?.events?.length) return;
    const updated = { ...(events || {}) };
    const seenDates = new Set(); // Deduplicate: one event per unique date
    let totalCreated = 0;
    quickAddPreview.events.forEach(ev => {
      const startDate = new Date(ev.date + "T00:00:00");
      const fakeEv = { ...ev, repeatEnd: "", repeatCount: ev.repeatCount || 0 };
      const dates = generateRepeats(fakeEv, startDate);
      const eventData = { title: ev.title, time: ev.time || "12:00 PM", who: ev.who || "", notes: ev.notes || "", duration: ev.duration || 60 };
      if (ev.repeat && ev.repeat !== "none") eventData.repeat = ev.repeat;
      dates.forEach(d => {
        const dk = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
        const dedupKey = `${ev.title}_${dk}`;
        if (seenDates.has(dedupKey)) return; // Skip duplicate
        seenDates.add(dedupKey);
        // Also skip if this exact event title already exists on this date
        const existing = updated[dk] || [];
        if (existing.some(e => e.title === ev.title && e.time === eventData.time)) return;
        updated[dk] = [...existing, eventData];
        totalCreated++;
      });
    });
    fbSet("events", updated);
    showToast(`Created ${totalCreated} event${totalCreated>1?"s":""}!`, "success");
    setQuickAddPreview(null);
    setQuickAddInput("");
  }

  // ═══ WIDGET CUSTOMIZATION ═══
  function getWidgetPref(key) {
    const profilePrefs = (widgetPrefs || {})[currentProfile?.name] || {};
    return profilePrefs[key] || { name: null, hidden: false };
  }
  function setWidgetPref(key, pref) {
    const profilePrefs = { ...((widgetPrefs || {})[currentProfile?.name] || {}), [key]: pref };
    const updated = { ...(widgetPrefs || {}), [currentProfile?.name]: profilePrefs };
    fbSet("widgetPrefs", updated);
    setWidgetPrefs(updated);
  }

  // ═══ AI GOALS SUGGESTER ═══
  async function suggestGoals() {
    setGoalsLoading(true);
    const fallbacks = ["Read for 20 minutes","Walk 10,000 steps","Drink 8 glasses of water","Plan tomorrow's schedule","Send one business email"];
    const result = await groqFetch(GROQ_KEY, [
      { role: "system", content: "You are a life coach for a single dad named Alex who has a construction background, is building a tech business called Lucac LLC, and has two kids Yana (8) and Luca (6). Suggest 5 specific, actionable daily goals. Return ONLY a JSON array of 5 strings. No explanation." },
      { role: "user", content: "Suggest 5 goals for today" }
    ]);
    if (result.ok) {
      const parsed = parseGroqJSON(result.data);
      if (Array.isArray(parsed)) { setSuggestedGoals(parsed); setGoalsLoading(false); return; }
    }
    setSuggestedGoals(fallbacks);
    setGoalsLoading(false);
  }

  // ═══ VOICE INPUT HELPER ═══
  function startVoiceInput(onResult) {
    const sr = createSpeechRecognition();
    if (!sr) { showToast("Voice not supported in this browser", "error"); return; }
    speechRef.current = sr;
    let finalText = "";
    sr.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      finalText = transcript;
      // Show interim text in the input as user speaks
      onResult(transcript);
    };
    sr.onerror = (e) => {
      if (e.error !== "aborted") showToast("Couldn't hear you — try again", "error");
      setIsRecording(false);
    };
    sr.onend = () => {
      setIsRecording(false);
      if (finalText) onResult(finalText);
    };
    sr.start();
    setIsRecording(true);
    // Auto-stop after 10 seconds
    setTimeout(() => { if (speechRef.current) { try { speechRef.current.stop(); } catch(e){} } }, 10000);
  }
  function stopVoiceInput() {
    if (speechRef.current) { try { speechRef.current.stop(); } catch(e){} }
    setIsRecording(false);
  }

  // ═══ RESIZE EVENT DURATION ═══
  function updateEventDuration(dk, idx, newDuration) {
    const dayEvs = [...((events||{})[dk] || [])];
    dayEvs[idx] = { ...dayEvs[idx], duration: Math.max(30, Math.round(newDuration / 15) * 15) };
    fbSet("events", { ...(events||{}), [dk]: dayEvs });
  }

  // AI chat with Tavily
  async function sendAI() {
    if (!aiInput.trim() || !GROQ_KEY) return;
    const userMsg = aiInput.trim();
    setAiInput("");
    setAiMessages(m => [...m, { role:"user", content:userMsg }]);
    setAiLoading(true);
    try {
      let context = "";
      const searchKeywords = ["weather","news","lawyer","attorney","near me","today","current","price","latest","restaurant","doctor","school","2026"];
      const needsSearch = searchKeywords.some(k => userMsg.toLowerCase().includes(k));
      if (needsSearch && TAVILY_KEY) {
        const sr = await fetch("https://api.tavily.com/search", {
          method:"POST", headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({ api_key: TAVILY_KEY, query: userMsg, max_results: 3 })
        });
        const sd = await sr.json();
        if (sd.results?.length) {
          context = "Web search results:\n" + sd.results.map(r => `${r.title}: ${r.content?.slice(0,200)}`).join("\n") + "\n\n";
        }
      }
      const systemPrompt = `You are a helpful AI assistant for the LUCAC Life family app. The family includes: ${(profiles||[]).map(p=>p.name).join(", ")}. Be friendly and concise.`;
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${GROQ_KEY}` },
        body: JSON.stringify({ model:"llama-3.3-70b-versatile", max_tokens:300,
          messages:[{ role:"system", content: systemPrompt },
            ...aiMessages.slice(-6),
            { role:"user", content: context + userMsg }]
        })
      });
      const d = await resp.json();
      setAiMessages(m => [...m, { role:"assistant", content: d.choices?.[0]?.message?.content || "Hmm, couldn't get a response." }]);
    } catch(e) {
      setAiMessages(m => [...m, { role:"assistant", content:"Couldn't connect right now. Check your Groq key." }]);
    }
    setAiLoading(false);
  }

  // AI Fridge Chef
  async function callChef() {
    if (!fridgeText.trim() || !GROQ_KEY) return;
    setChefLoading(true);
    setChefResult("");
    try {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${GROQ_KEY}` },
        body: JSON.stringify({ model:"llama-3.3-70b-versatile", max_tokens:500,
          messages:[{ role:"user", content:`I have these ingredients: ${fridgeText}. Give me one detailed recipe I can make right now. Include: recipe name, ingredients with measurements, step by step instructions, and estimated calories/protein/carbs. Keep it practical and delicious.` }]
        })
      });
      const d = await resp.json();
      setChefResult(d.choices?.[0]?.message?.content || "No recipe found.");
    } catch { setChefResult("Couldn't connect to AI chef."); }
    setChefLoading(false);
  }

  // AI food lookup
  async function lookupFood() {
    if (!foodSearch.trim() || !GROQ_KEY) return;
    setFoodLoading(true);
    try {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${GROQ_KEY}` },
        body: JSON.stringify({ model:"llama-3.3-70b-versatile", max_tokens:200,
          messages:[{ role:"user", content:`Nutrition facts for: ${foodSearch}. Reply ONLY as JSON: {"name":"...","calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0}` }]
        })
      });
      const d = await resp.json();
      const text = d.choices?.[0]?.message?.content || "{}";
      const clean = text.replace(/```json|```/g,"").trim();
      setFoodResult(JSON.parse(clean));
    } catch { setFoodResult(null); }
    setFoodLoading(false);
  }

  function logFood(food) {
    const today = new Date().toISOString().slice(0,10);
    const updated = [...(foodLog || []), { ...food, date: today, profile: currentProfile?.name }];
    fbSet("foodLog", updated);
  }

  function saveToMyFoods(food) {
    const updated = [...(myFoods || []), food];
    fbSet("myFoods", updated);
  }

  // Today's calories for current profile
  const todayStr = new Date().toISOString().slice(0,10);
  const todayCalories = (foodLog || []).filter(f => f.date === todayStr && f.profile === currentProfile?.name)
    .reduce((s, f) => s + (f.calories || 0), 0);

  // Custody schedule helpers
  const custodyDayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  function cycleCustody(day) {
    if (!isAdmin) return;
    const current = (custodySchedule || {})[day] || "Free";
    const next = current === "Free" ? "Dad" : current === "Dad" ? "Mom" : "Free";
    fbSet("custodySchedule", { ...(custodySchedule||{}), [day]: next });
  }
  function custodyColor(val) {
    if (val === "Dad") return "#f59e0b";
    if (val === "Mom") return "#a855f7";
    return V.borderSubtle;
  }

  // Kids helpers
  function getKidData(name) { return (kidsData || {})[name] || { points: 0, tasks: [] }; }
  function addKidTask(kidName) {
    const t = (newTask[kidName] || "").trim();
    if (!t) return;
    const kd = getKidData(kidName);
    const updated = { ...(kidsData||{}), [kidName]: { ...kd, tasks: [...(kd.tasks||[]), { text:t, done:false, emoji: selectedTaskEmoji }] }};
    fbSet("kidsData", updated);
    setNewTask({...newTask, [kidName]:""}); setSelectedTaskEmoji("📝");
    showToast("Task added!", "success");
  }
  function completeKidTask(kidName, idx) {
    const kd = getKidData(kidName);
    const tasks = [...(kd.tasks||[])];
    tasks[idx] = { ...tasks[idx], done: true };
    const points = (kd.points || 0) + 10;
    const updated = { ...(kidsData||{}), [kidName]: { ...kd, tasks, points }};
    fbSet("kidsData", updated);
    triggerConfetti(document.body, "small");
    showToast("Great job! +10 points! ⭐", "success");
  }

  // Exchange log
  function startExchange() {
    const now = new Date();
    setExchangeStart(now);
    const interval = setInterval(() => {}, 1000);
    setExchangeTimer(interval);
  }
  function logArrival(notes) {
    if (!exchangeStart) return;
    clearInterval(exchangeTimer);
    const now = new Date();
    const mins = Math.round((now - exchangeStart) / 60000);
    const entry = {
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      waitMinutes: mins,
      notes: notes || "",
      timestamp: now.toISOString()
    };
    fbSet("exchangeLog", [...(exchangeLog||[]), entry]);
    setExchangeStart(null);
    setExchangeTimer(null);
  }

  const [exchangeNote, setExchangeNote] = useState("");
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!exchangeStart) { setElapsed(0); return; }
    const iv = setInterval(() => setElapsed(Math.round((new Date() - exchangeStart)/1000)), 1000);
    return () => clearInterval(iv);
  }, [exchangeStart]);

  const kidProfiles = (profiles||[]).filter(p => p.type === "kid");
  const familyNames = (profiles||[]).map(p => p.name);

  // Profile pin login
  function handleProfileSelect(profile) {
    if (profile.type === "admin") {
      setPinTarget(profile);
      setScreen("pin");
    } else {
      setCurrentProfile(profile);
      setTab("home");
      setScreen("app");
    }
  }
  function handlePinSubmit() {
    if (pinInput === pinTarget.pin) {
      setCurrentProfile(pinTarget);
      setTab("home");
      setScreen("app");
      setPinInput("");
      setPinError("");
    } else {
      setPinError("Wrong PIN 😬");
      setPinInput("");
    }
  }

  // ---- STYLES (theme-aware) ----
  const appStyle = {
    minHeight:"100vh", background: V.bgApp, color: V.textSecondary,
    fontFamily: V.fontFamily, maxWidth:900, margin:"0 auto", paddingBottom:80
  };

  const cardStyle = {
    background: V.bgCard, borderRadius: V.r3, padding:16, marginBottom:12,
    border:`1px solid ${V.borderDefault}`, boxShadow: V.shadowCard
  };

  const btnPrimary = {
    background: V.accent, color:"#fff", border:"none", borderRadius: V.r2,
    padding:"8px 16px", fontWeight:700, cursor:"pointer", fontSize:14
  };

  const btnSecondary = {
    background: V.bgElevated, color: V.textSecondary, border:`1px solid ${V.borderSubtle}`, borderRadius: V.r2,
    padding:"8px 16px", cursor:"pointer", fontSize:14
  };

  const inputStyle = {
    width:"100%", background: V.bgInput, color: V.textPrimary, border:`1px solid ${V.borderSubtle}`,
    borderRadius: V.r2, padding:"8px 12px", fontSize:14, boxSizing:"border-box"
  };

  // ---- SCREENS ----
  if (screen === "profiles") {
    return (
      <div style={{ ...appStyle, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh" }}>
        <div style={{ fontSize:32, marginBottom:8 }}>👑</div>
        <div style={{ fontSize:24, fontWeight:800, color:V.accent, marginBottom:4 }}>LUCAC Life</div>
        <div style={{ fontSize:13, color:V.textDim, marginBottom:32 }}>Who's using the app?</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:16, justifyContent:"center", maxWidth:500 }}>
          {(profiles||[]).map(p => (
            <button key={p.id} onClick={() => handleProfileSelect(p)}
              style={{ background:V.bgCard, border:`2px solid ${p.color||V.borderSubtle}`, borderRadius:16, padding:"20px 24px",
                cursor:"pointer", textAlign:"center", minWidth:120, transition:"transform 0.2s", boxShadow:V.shadowCard }}
              onMouseOver={e => e.currentTarget.style.transform="scale(1.05)"}
              onMouseOut={e => e.currentTarget.style.transform="scale(1)"}>
              <div style={{ fontSize:40, marginBottom:8 }}>{p.emoji}</div>
              <div style={{ color:p.color||V.textPrimary, fontWeight:700, fontSize:15 }}>{p.name}</div>
              <div style={{ color:V.textDim, fontSize:11, marginTop:2 }}>{p.type === "admin" ? "🔑 Admin" : p.type === "kid" ? "⭐ Kid" : "👤 Family"}</div>
            </button>
          ))}
        </div>
        <button onClick={() => { setGuestMode(true); setCurrentProfile({ id:"guest", name:"Guest", emoji:"👁️", type:"guest" }); setTab("home"); setScreen("app"); }}
          style={{ ...btnSecondary, marginTop:24, padding:"12px 24px", fontSize:14, borderRadius:20 }}>
          👁️ Guest Mode
        </button>
      </div>
    );
  }

  if (screen === "pin") {
    return (
      <div style={{ ...appStyle, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh" }}>
        <div style={{ fontSize:40, marginBottom:12 }}>{pinTarget?.emoji}</div>
        <div style={{ fontSize:20, fontWeight:700, color:V.accent, marginBottom:4 }}>{pinTarget?.name}</div>
        <div style={{ fontSize:13, color:V.textDim, marginBottom:24 }}>Enter your PIN</div>
        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          {[0,1,2,3,4,5].map(i => (
            <div key={i} style={{ width:14, height:14, borderRadius:"50%", background: i < pinInput.length ? V.accent : V.borderSubtle }} />
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:16 }}>
          {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((n,i) => (
            <button key={i} onClick={() => {
              if (n === "⌫") setPinInput(p => p.slice(0,-1));
              else if (n !== "") setPinInput(p => p.length < 6 ? p + n : p);
            }} style={{ width:64, height:64, borderRadius:12, background:V.bgCard, border:`1px solid ${V.borderSubtle}`,
              color:V.textPrimary, fontSize:22, cursor: n==="" ? "default" : "pointer", fontWeight:600, boxShadow:V.shadowCard }}>
              {n}
            </button>
          ))}
        </div>
        {pinError && <div style={{ color:V.danger, marginBottom:12 }}>{pinError}</div>}
        <button onClick={handlePinSubmit} style={{ ...btnPrimary, width:180, padding:"12px" }}>Unlock</button>
        <button onClick={() => { setScreen("profiles"); setPinInput(""); setPinError(""); }}
          style={{ ...btnSecondary, marginTop:8, width:180, padding:"12px" }}>Back</button>
      </div>
    );
  }

  // Kid profile: full tabbed experience with filtered content
  if (isKid && screen === "app") {
    const kd = getKidData(currentProfile.name);
    const kidTabs = [
      { id:"home", label:"Home", icon:"🏠" },
      { id:"kids", label:"My Stuff", icon:"⭐" },
      { id:"food", label:"Food", icon:"🍽️" },
    ];
    return (
      <div style={appStyle}>
        {/* Kid header with avatar + stars */}
        <div style={{ background:V.bgCard, padding:"10px 16px", display:"flex", justifyContent:"space-between", alignItems:"center",
          borderBottom:`1px solid ${V.borderDefault}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:24 }}>{currentProfile.emoji}</span>
            <span style={{ fontWeight:800, color:V.accent, fontSize:16 }}>{currentProfile.name}</span>
            <span style={{ fontSize:12, color:V.accent, background:`${V.accent}18`, padding:"2px 8px", borderRadius:10, fontWeight:700 }}>
              ⭐ {kd.points||0}
            </span>
          </div>
          <button onClick={() => { setCurrentProfile(null); setScreen("profiles"); }} style={{ ...btnSecondary, fontSize:12 }}>Switch</button>
        </div>

        {/* Kid tab content */}
        <div style={{ paddingBottom:80 }}>
          {tab === "home" && (
            <div style={{ padding:16 }}>
              <div style={{ ...cardStyle, textAlign:"center", padding:20 }}>
                <div style={{ fontSize:56 }}>{currentProfile.emoji}</div>
                <div style={{ fontSize:28, fontWeight:800, color:V.accent, marginTop:4 }}>⭐ {kd.points||0} Stars</div>
              </div>
              {/* Call buttons */}
              {(callButtons||[]).map(btn => (
                <button key={btn.id} onClick={()=>window.location.href=`tel:${btn.number}`}
                  style={{ background:btn.color||V.accent, color:"#fff", border:"none", borderRadius:V.r2,
                    padding:14, width:"100%", marginBottom:8, fontSize:16, cursor:"pointer", fontWeight:700 }}>
                  {btn.emoji} Call {btn.name}
                </button>
              ))}
              {/* Legacy call buttons */}
              {!callButtons?.length && contactDad && (
                <button onClick={()=>window.location.href=`tel:${contactDad}`}
                  style={{...btnPrimary,width:"100%",padding:14,marginBottom:8,fontSize:16}}>📞 Call Dada</button>
              )}
              <button onClick={()=>setShowGame(true)}
                style={{ background:"#0f766e", color:"#fff", border:"none", borderRadius:V.r2,
                  padding:14, width:"100%", marginBottom:12, fontSize:16, cursor:"pointer", fontWeight:700 }}>
                🎮 Play LUCAC Legends
              </button>
              {/* Today's events for this kid */}
              {(() => {
                const dk = todayKey();
                const myEvents = ((events||{})[dk]||[]).filter(ev => !ev.who || ev.who === currentProfile.name);
                return myEvents.length > 0 && (
                  <div style={cardStyle}>
                    <div style={{fontWeight:700,color:V.accent,marginBottom:8}}>📅 Today</div>
                    {myEvents.map((ev,i) => (
                      <div key={i} style={{fontSize:14,color:V.textSecondary,marginBottom:4}}>{ev.time} — {ev.title}</div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
          {tab === "kids" && (
            <div style={{ padding:16 }}>
              {showGame ? (
                <div>
                  <button onClick={()=>setShowGame(false)} style={{...btnSecondary,marginBottom:12}}>← Back</button>
                  <LucacLegends profile={currentProfile} kidsData={kidsData} fbSet={fbSet} />
                </div>
              ) : (
                <div>
                  <div style={cardStyle}>
                    <div style={{fontWeight:700,marginBottom:10,color:V.accent}}>My Tasks</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10}}>
                      {(kd.tasks||[]).map((task,i) => (
                        <div key={i} onClick={()=>!task.done&&completeKidTask(currentProfile.name,i)}
                          style={{minHeight:120,borderRadius:14,background:task.done?V.bgCardAlt:V.bgCard,
                            border:`2px solid ${task.done?V.borderDefault:V.accent}`,
                            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                            padding:14,cursor:task.done?"default":"pointer",opacity:task.done?0.5:1,position:"relative"}}>
                          {task.done && <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:44,zIndex:1}}>✅</div>}
                          <div style={{fontSize:44}}>{task.emoji||"📝"}</div>
                          <div style={{fontSize:13,fontWeight:700,color:V.textPrimary,textAlign:"center"}}>{task.text}</div>
                        </div>
                      ))}
                    </div>
                    {!(kd.tasks||[]).length && <div style={{color:V.textDim,fontSize:14}}>No tasks yet!</div>}
                  </div>
                  <HomeworkHelper V={V} profiles={profiles} kidsData={kidsData} fbSet={fbSet} GROQ_KEY={GROQ_KEY} showToast={showToast} />
                </div>
              )}
            </div>
          )}
          {tab === "food" && (
            <FoodTab V={V} currentProfile={currentProfile} foodLog={foodLog} myFoods={myFoods}
              nutritionGoals={nutritionGoals} fbSet={fbSet} GROQ_KEY={GROQ_KEY} showToast={showToast} profiles={profiles}
              shoppingList={shoppingList} weightLog={weightLog} isRecording={isRecording} startVoiceInput={startVoiceInput} stopVoiceInput={stopVoiceInput} />
          )}
        </div>

        {/* Kid bottom nav */}
        <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:900,
          background:V.bgCard,borderTop:`1px solid ${V.borderDefault}`,display:"flex",justifyContent:"space-around",
          padding:"8px 0",zIndex:100}}>
          {kidTabs.map(t => (
            <button key={t.id} onClick={()=>{setTab(t.id);setShowGame(false);}} style={{background:"none",border:"none",cursor:"pointer",
              display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"4px 8px",opacity:tab===t.id?1:0.5}}>
              <span style={{fontSize:22}}>{t.icon}</span>
              <span style={{fontSize:10,color:tab===t.id?V.accent:V.textDim,fontWeight:tab===t.id?700:400}}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Main app tabs
  const allTabs = [
    { id:"home", label:"Home", icon:"🏠", guest:true },
    { id:"food", label:"Food", icon:"🍽️", guest:true },
    { id:"kids", label:"Kids", icon:"⭐", guest:true },
    { id:"family", label:"Family", icon:"🤝", guest:false },
    { id:"settings", label:"Settings", icon:"⚙️", guest:false },
  ];
  const tabs = guestMode ? allTabs.filter(t => t.guest) : allTabs;

  // ---- HOME TAB — DISPATCHER ----
  function renderHome() {
    if (themeName === "cozyla") return renderHomeCozyla();
    if (themeName === "familywall") return renderHomeFamilyWall();
    return renderHomeSkylight();
  }

  // ═══════════════════════════════════════════
  // SKYLIGHT HOME — big monthly grid (default)
  // ═══════════════════════════════════════════
  function renderHomeSkylight() {
    const daysInMonth = getDaysInMonth(calYear, calMonth);
    const firstDay = getFirstDay(calYear, calMonth);
    const allCells = [];
    for (let i = 0; i < firstDay; i++) allCells.push(null);
    for (let d = 1; d <= daysInMonth; d++) allCells.push(d);
    // Filter cells based on calendar view
    let cells = allCells;
    if (calView === "W" || calView === "2W") {
      const todayDate = today.getDate();
      const todayDow = today.getDay();
      const weekStart = todayDate - todayDow;
      const daysToShow = calView === "W" ? 7 : 14;
      cells = [];
      for (let i = 0; i < daysToShow; i++) {
        const d = weekStart + i;
        if (d >= 1 && d <= daysInMonth) cells.push(d);
        else cells.push(null);
      }
      // Pad start to align with day of week
      const padStart = cells[0] ? new Date(calYear, calMonth, cells.find(d=>d)).getDay() : 0;
      for (let i = 0; i < padStart; i++) cells.unshift(null);
    }
    const isToday = (d) => d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
    const dk = selectedDay ? dateKey(calYear, calMonth, selectedDay) : null;

    const routinePref = getWidgetPref("routines");
    const goalPref = getWidgetPref("goals");
    const statsPref = getWidgetPref("stats");

    return (
      <div style={{ padding:12 }}>
        {/* ═══ AI QUICK ADD + VOICE ═══ */}
        <div style={{ display:"flex", gap:6, marginBottom:12 }}>
          <button onClick={() => isRecording ? stopVoiceInput() : startVoiceInput(text => setQuickAddInput(text))}
            style={{ width:44, height:44, borderRadius:"50%", border:"none", cursor:"pointer", fontSize:18,
              background: isRecording ? V.danger : V.bgElevated, color: isRecording ? "#fff" : V.textMuted,
              animation: isRecording ? "pulse 1s infinite" : "none", flexShrink:0 }}>
            🎤
          </button>
          <input value={quickAddInput} onChange={e => setQuickAddInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleQuickAdd()}
            placeholder="Add anything... 'Soccer every Friday for 3 months at 4PM for Luca'"
            style={{ ...inputStyle, flex:1, padding:"10px 14px", fontSize:13, borderRadius:24 }} />
          <button onClick={handleQuickAdd} disabled={quickAddLoading || !quickAddInput.trim()}
            style={{ ...btnPrimary, borderRadius:24, padding:"10px 16px", fontSize:16, opacity: quickAddLoading ? 0.6 : 1 }}>
            {quickAddLoading ? "..." : "✨"}
          </button>
        </div>

        {/* AI Quick Add Preview */}
        {quickAddPreview && (
          <div style={{ ...cardStyle, border:`2px solid ${V.accent}`, marginBottom:12 }}>
            <div style={{ fontWeight:700, color:V.accent, marginBottom:8 }}>Creating {quickAddPreview.totalInstances} event{quickAddPreview.totalInstances>1?"s":""}{quickAddPreview.repeatDesc}</div>
            {quickAddPreview.events.slice(0,5).map((ev,i) => (
              <div key={i} style={{ fontSize:13, color:V.textSecondary, marginBottom:4 }}>
                {ev.repeat && ev.repeat !== "none" && "🔁 "}{ev.title} — {ev.date} {ev.time || ""} {ev.who ? `(${ev.who})` : ""}
                {ev.repeat && ev.repeat !== "none" && ` · ${ev.repeat}${ev.repeatCount ? ` x${ev.repeatCount}` : ""}`}
              </div>
            ))}
            {quickAddPreview.events.length > 5 && <div style={{fontSize:12,color:V.textDim}}>+{quickAddPreview.events.length-5} more...</div>}
            <div style={{ display:"flex", gap:8, marginTop:10 }}>
              <button onClick={confirmQuickAdd} style={{ ...btnPrimary, flex:1 }}>Confirm</button>
              <button onClick={() => setQuickAddPreview(null)} style={{ ...btnSecondary, flex:1 }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Delete confirmation cards */}
        {quickAddDeleteMatches && (
          <div style={{ ...cardStyle, border:`2px solid ${V.danger}`, marginBottom:12 }}>
            <div style={{ fontWeight:700, color:V.danger, marginBottom:8 }}>
              🗑️ Found {quickAddDeleteMatches.matches.length} "{quickAddDeleteMatches.keyword}" event{quickAddDeleteMatches.matches.length>1?"s":""}
            </div>
            {quickAddDeleteMatches.single ? (
              <div>
                <div style={{ fontSize:13, color:V.textSecondary, marginBottom:8 }}>
                  {quickAddDeleteMatches.matches[0].ev.title} — {quickAddDeleteMatches.matches[0].dk} {quickAddDeleteMatches.matches[0].ev.time || ""}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => executeDeleteMatch(quickAddDeleteMatches.matches[0].dk, quickAddDeleteMatches.matches[0].idx)}
                    style={{ ...btnPrimary, flex:1, background:V.danger }}>Delete</button>
                  <button onClick={() => setQuickAddDeleteMatches(null)} style={{ ...btnSecondary, flex:1 }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize:12, color:V.textDim, marginBottom:8 }}>Tap the one you want to delete:</div>
                {quickAddDeleteMatches.matches.slice(0,8).map((m, i) => (
                  <div key={i} onClick={() => executeDeleteMatch(m.dk, m.idx)}
                    style={{ padding:"10px 12px", background:V.bgCardAlt, borderRadius:V.r2, marginBottom:6, cursor:"pointer",
                      border:`1px solid ${V.borderDefault}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontWeight:600, color:V.textPrimary, fontSize:13 }}>{m.ev.title}</div>
                      <div style={{ fontSize:11, color:V.textDim }}>{m.dk} {m.ev.time || ""} {m.ev.who ? `· ${m.ev.who}` : ""}</div>
                    </div>
                    <span style={{ color:V.danger, fontSize:18 }}>🗑️</span>
                  </div>
                ))}
                <button onClick={() => setQuickAddDeleteMatches(null)} style={{ ...btnSecondary, width:"100%", marginTop:4 }}>Cancel</button>
              </div>
            )}
          </div>
        )}

        {/* Edit confirmation card */}
        {quickAddEditPreview && (
          <div style={{ ...cardStyle, border:`2px solid ${V.info}`, marginBottom:12 }}>
            <div style={{ fontWeight:700, color:V.info, marginBottom:8 }}>✏️ Edit Event</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:8, alignItems:"center", marginBottom:10 }}>
              <div style={{ padding:8, background:V.bgCardAlt, borderRadius:V.r2, fontSize:13, color:V.textMuted }}>
                <div style={{ fontWeight:600 }}>{quickAddEditPreview.ev.title}</div>
                <div style={{ fontSize:11 }}>{quickAddEditPreview.ev.time || "no time"}</div>
              </div>
              <span style={{ fontSize:18 }}>→</span>
              <div style={{ padding:8, background:`${V.info}15`, borderRadius:V.r2, fontSize:13, color:V.textPrimary, border:`1px solid ${V.info}33` }}>
                <div style={{ fontWeight:600 }}>{quickAddEditPreview.changes.title || quickAddEditPreview.ev.title}</div>
                <div style={{ fontSize:11 }}>{quickAddEditPreview.changes.time || quickAddEditPreview.ev.time || "no time"}</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => executeEditMatch(quickAddEditPreview.dk, quickAddEditPreview.idx, quickAddEditPreview.changes)}
                style={{ ...btnPrimary, flex:1 }}>Confirm</button>
              <button onClick={() => setQuickAddEditPreview(null)} style={{ ...btnSecondary, flex:1 }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Quote — tap to refresh */}
        <div onClick={() => {
          const prompts = {
            motivational: "Give me one short motivational quote (under 15 words) for a single dad building his own business. Just the quote, no attribution.",
            tip: "Give me one short actionable business or productivity tip in under 15 words. No attribution.",
            dolphin: "Give me one fun dolphin fact in under 15 words. Start with 🐬.",
            custom: customQuotePrompt || "Give me a short motivational quote under 15 words."
          };
          groqFetch(GROQ_KEY, [{role:"user",content:prompts[quoteMode]||prompts.motivational}], {maxTokens:80})
            .then(r => { if(r.ok && r.data) setQuote(r.data.replace(/"/g,"")); });
        }} style={{ background: V.bgCardAlt, borderRadius:10, padding:"10px 14px", marginBottom:12,
          border:`1px solid ${V.borderDefault}`, fontSize:13, color: V.textMuted, fontStyle:"italic", cursor:"pointer" }}>
          ✦ {quote} <span style={{fontSize:10,opacity:0.5}}>tap to refresh</span>
        </div>

        {/* ═══ CALENDAR ═══ */}
        <div style={{
          background: V.bgCard, borderRadius: V.r3, border: `1px solid ${V.borderDefault}`,
          boxShadow: V.shadowCard, overflow: "hidden", marginBottom: V.sp3
        }}>
          <div style={{
            background: V.calBgHeader, padding: `${V.sp4}px ${V.sp5}px`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: `1px solid ${V.borderDefault}`
          }}>
            <button onClick={() => { if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1); }}
              style={{ width: 40, height: 40, borderRadius: V.r2, background: V.bgElevated,
                border: `1px solid ${V.borderSubtle}`, color: V.textSecondary, fontSize: 20,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              aria-label="Previous month">‹</button>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontWeight: 800, color: V.accent, fontSize: 22, letterSpacing: 0.5, lineHeight: 1.2 }}>{MONTHS[calMonth]}</div>
              <div style={{ fontSize: 13, color: V.textDim, fontWeight: 500, marginTop: 2 }}>{calYear}</div>
              <button onClick={() => { setCalMonth(today.getMonth()); setCalYear(today.getFullYear()); }}
                style={{ background: V.accentGlow, border: `1px solid ${V.accent}33`, color: V.accent, fontSize: 11, fontWeight: 600, cursor: "pointer", borderRadius: 20, padding: "3px 14px", marginTop: 6 }}>Today</button>
              <div style={{ display:"flex", gap:4, marginTop:6 }}>
                {["W","2W","M"].map(v => (
                  <button key={v} onClick={() => setCalView(v)}
                    style={{ padding:"2px 10px", borderRadius:12, fontSize:10, fontWeight:600, cursor:"pointer", border:"none",
                      background: calView === v ? V.accent : V.bgElevated, color: calView === v ? "#fff" : V.textDim }}>{v}</button>
                ))}
              </div>
            </div>
            <button onClick={() => { if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1); }}
              style={{ width: 40, height: 40, borderRadius: V.r2, background: V.bgElevated,
                border: `1px solid ${V.borderSubtle}`, color: V.textSecondary, fontSize: 20,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              aria-label="Next month">›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: V.calBgWeekday, borderBottom: `1px solid ${V.borderDefault}` }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: (d === "Sun" || d === "Sat") ? V.accent + "99" : V.textDim, padding: `${V.sp2}px 0`, letterSpacing: 0.5, textTransform: "uppercase" }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1, background: V.borderDefault, padding: 1 }}>
            {cells.map((d, i) => {
              if (!d) return <div key={i} style={{ background: V.bgApp, minHeight: 85 }} />;
              const dk2 = dateKey(calYear, calMonth, d);
              const dayEvents = (events||{})[dk2] || [];
              const isTodayCell = isToday(d);
              const selected = selectedDay === d;
              const isWeekend = (i % 7 === 0) || (i % 7 === 6);
              return (
                <div key={i}
                  onClick={() => { setSelectedDay(d); setAddingEvents([{ title:"", time:"12:00 PM", who:"", notes:"", repeat:"none", repeatEnd:"", repeatCount:0, duration:60 }]); }}
                  style={{
                    minHeight: 85, padding: V.sp1 + 2, cursor: "pointer",
                    background: selected ? V.calBgSelected : isTodayCell ? V.calBgToday : isWeekend ? V.bgApp : V.calBgCell,
                    boxShadow: isTodayCell ? `inset 0 0 0 2px ${V.accent}` : selected ? `inset 0 0 0 2px ${V.info}` : "none",
                    display: "flex", flexDirection: "column"
                  }}>
                  <div style={{ fontSize: isTodayCell ? 15 : 13, fontWeight: isTodayCell ? 800 : 500,
                    color: isTodayCell ? V.bgApp : selected ? V.textPrimary : V.textMuted, marginBottom: V.sp1,
                    display: "flex", alignItems: "center", gap: 4 }}>
                    {isTodayCell ? (
                      <span style={{ background: V.accent, color: V.bgApp, borderRadius: "50%", width: 26, height: 26,
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 800, fontSize: 13, boxShadow: `0 0 8px ${V.accentGlowStrong}` }}>{d}</span>
                    ) : <span>{d}</span>}
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, overflow: "hidden" }}>
                    {dayEvents.slice(0,3).map((ev, idx) => {
                      const s = getEventStyle(dk2, idx);
                      const hasPastel = V.pillColors && V.pillTextColors;
                      const pillBg = hasPastel ? V.pillColors[idx % V.pillColors.length] : `${s?.bg || (ev.who ? getPersonColor(ev.who) : V.info)}22`;
                      const pillText = hasPastel ? V.pillTextColors[idx % V.pillTextColors.length] : (s?.color || V.textPrimary);
                      const pillBorder = hasPastel ? V.pillTextColors[idx % V.pillTextColors.length] + "55" : (s?.bg || (ev.who ? getPersonColor(ev.who) : V.info));
                      const initials = ev.who ? ev.who.slice(0,2) : "";
                      return (
                        <div key={idx} style={{
                          background: s?.bg ? `${s.bg}22` : pillBg, borderLeft: `3px solid ${s?.bg || pillBorder}`,
                          color: s?.color || pillText, fontSize: 10, fontWeight: 600, borderRadius: V.r1, padding: "2px 5px",
                          overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", lineHeight: 1.4,
                        }}>
                          {ev.repeat && <span style={{ marginRight:2 }}>🔁</span>}
                          {initials ? <span style={{ fontWeight:700, marginRight:3, opacity:0.7 }}>{initials}</span> : null}
                          {ev.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && <div style={{ fontSize: 9, color: V.textDim, fontWeight: 600 }}>+{dayEvents.length-3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ DAY DETAIL POPUP ═══ */}
        {selectedDay && renderDayPopup(dk)}

        {/* ═══ WIDGETS: Routines + Goals ═══ */}
        {(!routinePref.hidden || !goalPref.hidden) && (
          <div style={{ display:"grid", gridTemplateColumns: routinePref.hidden || goalPref.hidden ? "1fr" : "1fr 1fr", gap:12 }}>
            {!routinePref.hidden && (
              <div style={{ ...cardStyle, margin:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <div style={{ fontWeight:700, color: V.success, fontSize:14 }}>✅ {routinePref.name || "Routines"}</div>
                  <button onClick={() => setEditingWidget("routines")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:14, padding:2 }}>✏️</button>
                </div>
                {(routines||[]).map((r, i) => {
                  const s = routineStyles?.[i] || {};
                  return (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6,
                      background: s.bg || "transparent", borderRadius:6, padding: s.bg ? "4px 6px" : "0" }}>
                      <div onClick={() => toggleRoutine(i)} style={{ width:18, height:18, borderRadius:4,
                        background: r.done ? V.success : V.borderSubtle, cursor:"pointer", flexShrink:0,
                        display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {r.done && <span style={{ color:"#fff", fontSize:11 }}>✓</span>}
                      </div>
                      <span style={{ flex:1, fontSize: s.size||13, color: s.color||(r.done? V.textDim : V.textSecondary),
                        textDecoration: r.done?"line-through":"none", fontWeight: s.bold?700:400 }}>
                        {r.text}
                        {r.streakCount > 0 && <span style={{ marginLeft:4, fontSize:11, textDecoration:"none" }}>🔥{r.streakCount}{r.hasCrown ? " 👑" : ""}</span>}
                      </span>
                      <button onClick={() => setEditingRoutineStyle(i)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:13 }}>🎨</button>
                      <button onClick={() => deleteRoutine(i)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color: V.danger }}>✕</button>
                    </div>
                  );
                })}
                <div style={{ display:"flex", gap:4, marginTop:4 }}>
                  <input value={newRoutine} onChange={e=>setNewRoutine(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addRoutine()}
                    placeholder="Add routine..." style={{ ...inputStyle, flex:1, padding:"6px 10px", fontSize:12 }} />
                  <button onClick={addRoutine} style={{ ...btnPrimary, padding:"6px 10px" }}>+</button>
                </div>
              </div>
            )}
            {!goalPref.hidden && (
              <div style={{ ...cardStyle, margin:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <div style={{ fontWeight:700, color: V.pink, fontSize:14 }}>🎯 {goalPref.name || "Goals"}</div>
                  <button onClick={() => setEditingWidget("goals")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:14, padding:2 }}>✏️</button>
                </div>
                {(goals||[]).map((g, i) => {
                  const s = goalStyles?.[i] || {};
                  return (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6,
                      background: s.bg || "transparent", borderRadius:6, padding: s.bg ? "4px 6px" : "0" }}>
                      <div onClick={() => toggleGoal(i)} style={{ width:18, height:18, borderRadius:4,
                        background: g.done ? V.pink : V.borderSubtle, cursor:"pointer", flexShrink:0,
                        display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {g.done && <span style={{ color:"#fff", fontSize:11 }}>✓</span>}
                      </div>
                      <span style={{ flex:1, fontSize: s.size||13, color: s.color||(g.done? V.textDim : V.textSecondary),
                        textDecoration: g.done?"line-through":"none", fontWeight: s.bold?700:400 }}>{g.text}</span>
                      <button onClick={() => setEditingGoalStyle(i)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:13 }}>🎨</button>
                      <button onClick={() => deleteGoal(i)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color: V.danger }}>✕</button>
                    </div>
                  );
                })}
                <div style={{ display:"flex", gap:4, marginTop:4 }}>
                  <input value={newGoal} onChange={e=>setNewGoal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addGoal()}
                    placeholder="Add goal..." style={{ ...inputStyle, flex:1, padding:"6px 10px", fontSize:12 }} />
                  <button onClick={addGoal} style={{ ...btnPrimary, padding:"6px 10px" }}>+</button>
                </div>
                <button onClick={suggestGoals} disabled={goalsLoading}
                  style={{ ...btnSecondary, width:"100%", marginTop:6, fontSize:12, padding:"6px 10px", opacity: goalsLoading ? 0.6 : 1 }}>
                  {goalsLoading ? "Thinking..." : "✨ Suggest goals"}
                </button>
                {suggestedGoals.length > 0 && (
                  <div style={{ marginTop:6 }}>
                    {suggestedGoals.map((sg, si) => (
                      <div key={si} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                        <span style={{ flex:1, fontSize:11, color:V.textMuted }}>{sg}</span>
                        <button onClick={() => {
                          const updated = [...(goals||[]), { id:Date.now()+si, text:sg, done:false }];
                          fbSet("goals", updated); showToast("Goal added!", "success");
                        }} style={{ background:"none", border:"none", cursor:"pointer", fontSize:14, color:V.success }}>+</button>
                      </div>
                    ))}
                    <button onClick={() => suggestGoals()} style={{ background:"none", border:"none", cursor:"pointer", fontSize:11, color:V.accent, padding:0, marginTop:2 }}>
                      🔄 More suggestions
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Stats row */}
        {!statsPref.hidden && (
          <div style={{ marginTop:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <div style={{ fontSize:12, fontWeight:600, color:V.textDim, textTransform:"uppercase", letterSpacing:0.5 }}>
                {statsPref.name || "Quick Stats"}
              </div>
              <button onClick={() => setEditingWidget("stats")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:14, padding:2 }}>✏️</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
              {[
                { icon:"🔥", label:"Calories", val: todayCalories },
                { icon:"✅", label:"Routines", val:`${(routines||[]).filter(r=>r.done).length}/${(routines||[]).length}` },
                { icon:"🎯", label:"Goals", val:`${(goals||[]).filter(g=>g.done).length}/${(goals||[]).length}` },
              ].map(s => (
                <div key={s.label} style={{ background: V.bgCard, borderRadius:10, padding:"10px 8px", textAlign:"center", border:`1px solid ${V.borderDefault}`, boxShadow:V.shadowCard }}>
                  <div style={{ fontSize:22 }}>{s.icon}</div>
                  <div style={{ fontSize:18, fontWeight:800, color: V.accent }}>{s.val}</div>
                  <div style={{ fontSize:11, color: V.textDim }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ BIRTHDAY COUNTDOWNS ═══ */}
        {(() => {
          const upcoming = getUpcomingBirthdays();
          const todayBdays = upcoming.filter(b => b.daysUntil === 0);
          if (todayBdays.length > 0) setTimeout(() => triggerConfetti(document.body, "big"), 300);
          return (
            <div style={{ marginTop: 12, marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: V.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>🎂 Upcoming</div>
              {todayBdays.map((b, i) => (
                <div key={"bdt"+i} style={{ padding: 14, borderRadius: V.r3, background: `linear-gradient(135deg, ${V.accent}33, ${V.accent}11)`,
                  border: "2px solid gold", textAlign: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: V.textPrimary }}>🎂 TODAY IS {b.name.toUpperCase()}'S BIRTHDAY! 👑🎉</div>
                </div>
              ))}
              {upcoming.length === 0 ? (
                <div style={{ padding: 12, borderRadius: V.r2, background: V.bgCardAlt, color: V.textDim, textAlign: "center", fontSize: 13 }}>
                  Add birthdays in Settings → Family Members
                </div>
              ) : upcoming.filter(b => b.daysUntil > 0).map((b, i) => (
                <div key={"bd"+i} style={{ padding: 12, borderRadius: V.r2, background: V.bgCard, marginBottom: 6,
                  border: b.daysUntil <= 7 ? "2px solid gold" : `1px solid ${V.borderDefault}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  boxShadow: b.daysUntil <= 7 ? "0 0 10px rgba(255,215,0,0.15)" : "none" }}>
                  <span style={{ color: V.textSecondary, fontWeight: 600, fontSize: 14 }}>
                    {b.emoji} {b.name}'s birthday in {b.daysUntil} day{b.daysUntil !== 1 ? "s" : ""}! 🎉
                  </span>
                  {b.daysUntil <= 7 && <span style={{ fontSize: 20 }}>🎂</span>}
                </div>
              ))}
            </div>
          );
        })()}

        {/* ═══ WIDGET EDIT MODAL ═══ */}
        {editingWidget && (() => {
          const wp = getWidgetPref(editingWidget);
          const defaults = { routines:"Routines", goals:"Goals", stats:"Quick Stats" };
          return (
            <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:V.bgOverlay, zIndex:1000,
              display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
              onClick={e => { if(e.target === e.currentTarget) setEditingWidget(null); }}>
              <div style={{ background:V.bgCard, borderRadius:V.r4, padding:20, width:"100%", maxWidth:340,
                border:`1px solid ${V.borderSubtle}`, boxShadow:V.shadowModal }}>
                <div style={{ fontWeight:700, color:V.textPrimary, fontSize:16, marginBottom:14 }}>
                  Edit "{wp.name || defaults[editingWidget]}" Widget
                </div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:12, color:V.textMuted, marginBottom:4 }}>Widget Name</div>
                  <input value={wp.name || ""} onChange={e => setWidgetPref(editingWidget, {...wp, name: e.target.value})}
                    placeholder={defaults[editingWidget]} style={{...inputStyle}} />
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
                  <button onClick={() => setWidgetPref(editingWidget, {...wp, hidden: !wp.hidden})}
                    style={{ width:44, height:26, borderRadius:13, border:"none", cursor:"pointer",
                      background: wp.hidden ? V.borderSubtle : V.success, position:"relative", transition:"background 0.2s" }}>
                    <div style={{ width:20, height:20, borderRadius:"50%", background:"#fff",
                      position:"absolute", top:3, left: wp.hidden ? 3 : 21, transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }} />
                  </button>
                  <span style={{ fontSize:13, color: V.textSecondary }}>{wp.hidden ? "Hidden" : "Visible"}</span>
                </div>
                <button onClick={() => setEditingWidget(null)} style={{ ...btnPrimary, width:"100%" }}>Done</button>
              </div>
            </div>
          );
        })()}

        {/* Style editors */}
        {editingStyle && (
          <BlockStyleEditor style={getEventStyle(editingStyle.dk, editingStyle.idx)}
            onChange={s => saveEventStyle(editingStyle.dk, editingStyle.idx, s)}
            onClose={() => setEditingStyle(null)} />
        )}
        {editingRoutineStyle !== null && (
          <BlockStyleEditor style={routineStyles?.[editingRoutineStyle]}
            onChange={s => { fbSet("routineStyles", {...(routineStyles||{}), [editingRoutineStyle]:s}); }}
            onClose={() => setEditingRoutineStyle(null)} />
        )}
        {editingGoalStyle !== null && (
          <BlockStyleEditor style={goalStyles?.[editingGoalStyle]}
            onChange={s => { fbSet("goalStyles", {...(goalStyles||{}), [editingGoalStyle]:s}); }}
            onClose={() => setEditingGoalStyle(null)} />
        )}
      </div>
    );
  }

  // Shared day detail popup — used by Skylight and Cozyla
  function renderDayPopup(dk) {
    return (
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: V.bgOverlay, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: V.sp4, backdropFilter: "blur(4px)"
      }}
        onClick={e => { if(e.target === e.currentTarget) setSelectedDay(null); }}>
        <div style={{
          background: V.bgCard, borderRadius: V.r4, width: "100%", maxWidth: 420,
          maxHeight: "85vh", overflowY: "auto",
          border: `1px solid ${V.borderSubtle}`, boxShadow: V.shadowModal
        }}>
          <div style={{
            padding: `${V.sp4}px ${V.sp5}px`, borderBottom: `1px solid ${V.borderDefault}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            position: "sticky", top: 0, background: V.bgCard, zIndex: 1, borderRadius: `${V.r4}px ${V.r4}px 0 0`
          }}>
            <div>
              <div style={{ fontWeight: 800, color: V.accent, fontSize: 18 }}>
                {new Date(calYear, calMonth, selectedDay).toLocaleDateString("en-US",{weekday:"long"})}
              </div>
              <div style={{ fontSize: 13, color: V.textMuted, marginTop: 2 }}>
                {MONTHS[calMonth]} {selectedDay}, {calYear}
              </div>
            </div>
            <button onClick={() => setSelectedDay(null)}
              style={{ width: 36, height: 36, borderRadius: "50%", background: V.bgElevated,
                border: `1px solid ${V.borderSubtle}`, color: V.textMuted,
                fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              ✕
            </button>
          </div>

          <div style={{ padding: V.sp5 }}>
            {((events||{})[dk]||[]).length > 0 && (
              <div style={{ marginBottom: V.sp4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: V.textDim, textTransform: "uppercase",
                  letterSpacing: 1, marginBottom: V.sp2 }}>
                  Events ({((events||{})[dk]||[]).length})
                </div>
                {((events||{})[dk]||[]).map((ev, idx) => {
                  const s = getEventStyle(dk, idx);
                  const pColor = ev.who ? getPersonColor(ev.who) : V.info;
                  const dur = ev.duration || 60;
                  return (
                    <div key={idx} style={{
                      background: V.bgCardAlt, borderRadius: V.r2,
                      padding: `${V.sp3}px ${V.sp4}px`, marginBottom: V.sp2,
                      borderLeft: `4px solid ${s?.bg || pColor}`, position:"relative",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{
                          color: s?.color || V.textPrimary, fontSize: s?.size || 15, fontWeight: s?.bold ? 700 : 600,
                        }}>
                          {ev.repeat && <span style={{ marginRight:4 }}>🔁</span>}
                          {ev.title}
                        </div>
                        <div style={{ display: "flex", gap: V.sp1, alignItems: "center" }}>
                          <button onClick={() => setEditingStyle({ dk, idx })}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 4 }}>🎨</button>
                          {isAdmin && <button onClick={() => deleteEvent(dk, idx)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: V.danger, padding: 4 }}>✕</button>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: V.sp3, marginTop: V.sp1, flexWrap: "wrap", alignItems: "center" }}>
                        {ev.time && (
                          <span style={{ fontSize: 12, color: V.textDim, display: "flex", alignItems: "center", gap: 4 }}>
                            🕐 {ev.time}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: V.textDim }}>({dur} min)</span>
                        {ev.who && (
                          <span style={{ fontSize: 11, color: pColor, background: `${pColor}22`, padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>
                            {ev.who}
                          </span>
                        )}
                      </div>
                      {ev.notes && <div style={{ fontSize: 12, color: V.textMuted, marginTop: V.sp2, lineHeight: 1.4 }}>{ev.notes}</div>}
                      {/* Resize handle */}
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:6, paddingTop:6, borderTop:`1px dashed ${V.borderDefault}` }}>
                        <span style={{ fontSize:11, color:V.textDim }}>Duration:</span>
                        <input type="range" min={30} max={480} step={15} value={dur}
                          onChange={e => updateEventDuration(dk, idx, Number(e.target.value))}
                          style={{ flex:1, accentColor: V.accent, height:4 }} />
                        <span style={{ fontSize:11, color:V.textMuted, fontWeight:600, minWidth:42 }}>{dur >= 60 ? `${Math.floor(dur/60)}h${dur%60 ? dur%60+"m":""}` : `${dur}m`}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {((events||{})[dk]||[]).length === 0 && (
              <div style={{ textAlign: "center", padding: `${V.sp5}px 0 ${V.sp4}px`, color: V.textDim, fontSize: 13 }}>
                No events yet — add one below
              </div>
            )}

            <div style={{ borderTop: `1px solid ${V.borderDefault}`, paddingTop: V.sp4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: V.textDim, textTransform: "uppercase",
                letterSpacing: 1, marginBottom: V.sp3 }}>
                Add Event{addingEvents.length > 1 ? "s" : ""}
              </div>
              {addingEvents.map((ev, i) => (
                <div key={i} style={{ background: V.bgCardAlt, borderRadius: V.r2, padding: V.sp3, marginBottom: V.sp2 }}>
                  {addingEvents.length > 1 && <div style={{ fontSize: 11, color: V.textDim, marginBottom: V.sp1, fontWeight: 600 }}>Event {i+1}</div>}
                  <input placeholder="Event title" value={ev.title} onChange={e => {
                    const u = [...addingEvents]; u[i] = {...u[i], title:e.target.value}; setAddingEvents(u);
                  }} style={{ ...inputStyle, marginBottom: V.sp2 }} />
                  <div style={{ display: "flex", gap: V.sp2, marginBottom: V.sp2, flexWrap: "wrap" }}>
                    <TimePicker value={ev.time} onChange={val => {
                      const u = [...addingEvents]; u[i] = {...u[i], time:val}; setAddingEvents(u);
                    }} />
                    <select value={ev.who} onChange={e => {
                      const u = [...addingEvents]; u[i] = {...u[i], who:e.target.value}; setAddingEvents(u);
                    }} style={{ ...inputStyle, width: "auto", flex: 1 }}>
                      <option value="">Who?</option>
                      {familyNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <input placeholder="Notes (optional)" value={ev.notes} onChange={e => {
                    const u = [...addingEvents]; u[i] = {...u[i], notes:e.target.value}; setAddingEvents(u);
                  }} style={{ ...inputStyle, marginBottom: V.sp2 }} />
                  {/* Repeat + Duration */}
                  <div style={{ display:"flex", gap:V.sp2, flexWrap:"wrap", alignItems:"center" }}>
                    <select value={ev.repeat} onChange={e => {
                      const u = [...addingEvents]; u[i] = {...u[i], repeat:e.target.value}; setAddingEvents(u);
                    }} style={{ ...inputStyle, width:"auto", flex:1 }}>
                      <option value="none">No Repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                    <select value={ev.duration} onChange={e => {
                      const u = [...addingEvents]; u[i] = {...u[i], duration:Number(e.target.value)}; setAddingEvents(u);
                    }} style={{ ...inputStyle, width:"auto" }}>
                      {[30,45,60,90,120,180,240].map(m => <option key={m} value={m}>{m >= 60 ? `${m/60}h${m%60 ? " "+m%60+"m":""}` : `${m}m`}</option>)}
                    </select>
                  </div>
                  {ev.repeat !== "none" && (
                    <div style={{ display:"flex", gap:V.sp2, marginTop:V.sp2, flexWrap:"wrap", alignItems:"center" }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11, color:V.textDim, marginBottom:2 }}>End date (optional)</div>
                        <input type="date" value={ev.repeatEnd} onChange={e => {
                          const u = [...addingEvents]; u[i] = {...u[i], repeatEnd:e.target.value}; setAddingEvents(u);
                        }} style={{ ...inputStyle, fontSize:12 }} />
                      </div>
                      <div>
                        <div style={{ fontSize:11, color:V.textDim, marginBottom:2 }}>Or # times</div>
                        <input type="number" min={0} max={100} value={ev.repeatCount||""} placeholder="0" onChange={e => {
                          const u = [...addingEvents]; u[i] = {...u[i], repeatCount:Number(e.target.value)||0}; setAddingEvents(u);
                        }} style={{ ...inputStyle, width:70, fontSize:12 }} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <button onClick={() => setAddingEvents(a => [...a, { title:"", time:"12:00 PM", who:"", notes:"", repeat:"none", repeatEnd:"", repeatCount:0, duration:60 }])}
                style={{ ...btnSecondary, width: "100%", marginBottom: V.sp2, fontSize: 13 }}>+ Add Another Event</button>
              <button onClick={saveEvents} style={{ ...btnPrimary, width: "100%" }}>
                Save {addingEvents.filter(e=>e.title.trim()).length > 1 ? `${addingEvents.filter(e=>e.title.trim()).length} Events` : "Event"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // COZYLA HOME — warm day-view timeline layout
  // ═══════════════════════════════════════════════
  function renderHomeCozyla() {
    const dk = todayKey();
    const todayEvents = (events||{})[dk] || [];
    const nowHour = today.getHours();
    const greeting = nowHour < 12 ? "Good morning" : nowHour < 17 ? "Good afternoon" : "Good evening";
    const timeSlots = [
      { label: "Morning", range: "6 AM – 12 PM", filterFn: ev => { const p = parseTime(ev.time); const h24 = p.ampm === "AM" ? (p.h === 12 ? 0 : p.h) : (p.h === 12 ? 12 : p.h + 12); return h24 >= 6 && h24 < 12; }},
      { label: "Afternoon", range: "12 PM – 5 PM", filterFn: ev => { const p = parseTime(ev.time); const h24 = p.ampm === "AM" ? (p.h === 12 ? 0 : p.h) : (p.h === 12 ? 12 : p.h + 12); return h24 >= 12 && h24 < 17; }},
      { label: "Evening", range: "5 PM – 10 PM", filterFn: ev => { const p = parseTime(ev.time); const h24 = p.ampm === "AM" ? (p.h === 12 ? 0 : p.h) : (p.h === 12 ? 12 : p.h + 12); return h24 >= 17; }},
    ];
    const todayMeals = (foodLog||[]).filter(f => f.date === todayStr && f.profile === currentProfile?.name);

    return (
      <div style={{ padding: 0 }}>
        {/* Warm gradient header */}
        <div style={{
          background: "linear-gradient(135deg, #e87f5f 0%, #f4a853 100%)",
          padding: "24px 20px 20px", color: "#fff"
        }}>
          <div style={{ fontSize: 13, opacity: 0.85, fontWeight: 500 }}>{greeting}</div>
          <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.1, marginTop: 2 }}>
            {today.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}
          </div>
          <div style={{ fontSize: 14, opacity: 0.8, marginTop: 4 }}>
            {today.toLocaleDateString("en-US", {weekday:"long", month:"long", day:"numeric"})}
          </div>
        </div>

        {/* Person bubbles */}
        <div style={{
          display: "flex", gap: 14, padding: "16px 20px 8px", overflowX: "auto",
          background: V.bgApp
        }}>
          {(profiles||[]).map(p => (
            <div key={p.id} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, minWidth:52 }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: p.color || V.accent, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 800, color: "#fff",
                border: `3px solid ${V.bgCard}`, boxShadow: `0 2px 8px ${p.color || V.accent}44`
              }}>
                {p.emoji || p.name?.charAt(0)}
              </div>
              <span style={{ fontSize: 11, color: V.textMuted, fontWeight: 600, textAlign:"center" }}>{p.name}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: "8px 14px 14px" }}>
          {/* Today's schedule — timeline */}
          <div style={{
            background: V.bgCard, borderRadius: 20, padding: 18,
            border: `1px solid ${V.borderDefault}`, boxShadow: V.shadowCard, marginBottom: 14
          }}>
            <div style={{ fontWeight: 800, color: V.textPrimary, fontSize: 16, marginBottom: 14 }}>
              Today's Schedule
            </div>
            {timeSlots.map(slot => {
              const slotEvents = todayEvents.filter(slot.filterFn);
              return (
                <div key={slot.label} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: V.accent, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {slot.label}
                    </div>
                    <div style={{ flex: 1, height: 1, background: V.borderDefault }} />
                    <div style={{ fontSize: 10, color: V.textDim }}>{slot.range}</div>
                  </div>
                  {slotEvents.length === 0 && (
                    <div style={{ fontSize: 12, color: V.textDim, fontStyle: "italic", padding: "4px 0 2px" }}>
                      Nothing scheduled
                    </div>
                  )}
                  {slotEvents.map((ev, idx) => {
                    const pColor = ev.who ? getPersonColor(ev.who) : V.accent;
                    return (
                      <div key={idx} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                        background: `${pColor}12`, borderRadius: 14, marginBottom: 6,
                        borderLeft: `4px solid ${pColor}`
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%", background: pColor,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0
                        }}>
                          {ev.who ? ev.who.charAt(0) : "?"}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: V.textPrimary }}>{ev.title}</div>
                          <div style={{ fontSize: 11, color: V.textDim, marginTop: 1 }}>
                            {ev.time}{ev.who ? ` · ${ev.who}` : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <button onClick={() => { setSelectedDay(today.getDate()); setCalMonth(today.getMonth()); setCalYear(today.getFullYear()); setAddingEvents([{ title:"", time:"12:00 PM", who:"", notes:"", repeat:"none", repeatEnd:"", repeatCount:0, duration:60 }]); }}
              style={{ ...btnPrimary, width: "100%", borderRadius: 14, background: V.accent, marginTop: 4 }}>
              + Add Event
            </button>
          </div>

          {/* Bottom two widgets */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Today's Meals */}
            <div style={{
              background: V.bgCard, borderRadius: 20, padding: 14,
              border: `1px solid ${V.borderDefault}`, boxShadow: V.shadowCard
            }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: V.textPrimary, marginBottom: 10 }}>
                🍽️ Today's Meals
              </div>
              {todayMeals.length === 0 && (
                <div style={{ fontSize: 12, color: V.textDim, fontStyle: "italic" }}>No meals logged</div>
              )}
              {todayMeals.slice(0,4).map((m, i) => (
                <div key={i} style={{
                  fontSize: 12, color: V.textSecondary, padding: "4px 0",
                  borderBottom: i < Math.min(todayMeals.length, 4) - 1 ? `1px solid ${V.borderDefault}` : "none"
                }}>
                  <div style={{ fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: V.textDim }}>{m.calories || 0} cal</div>
                </div>
              ))}
              {todayMeals.length > 4 && <div style={{ fontSize: 11, color: V.textDim }}>+{todayMeals.length-4} more</div>}
              <button onClick={() => setTab("food")}
                style={{ fontSize: 11, color: V.accent, background: "none", border: "none", cursor: "pointer", fontWeight: 700, marginTop: 6, padding: 0 }}>
                View all →
              </button>
            </div>

            {/* Task Tracking */}
            <div style={{
              background: V.bgCard, borderRadius: 20, padding: 14,
              border: `1px solid ${V.borderDefault}`, boxShadow: V.shadowCard
            }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: V.textPrimary, marginBottom: 10 }}>
                ✅ Routines
              </div>
              {(routines||[]).length === 0 && (
                <div style={{ fontSize: 12, color: V.textDim, fontStyle: "italic" }}>No routines yet</div>
              )}
              {(routines||[]).slice(0,5).map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div onClick={() => toggleRoutine(i)} style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: r.done ? V.success : "transparent",
                    border: `2px solid ${r.done ? V.success : V.borderSubtle}`,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                  }}>
                    {r.done && <span style={{ color: "#fff", fontSize: 10 }}>✓</span>}
                  </div>
                  <span style={{
                    flex: 1, fontSize: 12, color: r.done ? V.textDim : V.textSecondary,
                    textDecoration: r.done ? "line-through" : "none"
                  }}>
                    {r.text}
                    {r.streakCount > 0 && <span style={{ marginLeft:4, fontSize:11, textDecoration:"none" }}>🔥{r.streakCount}{r.hasCrown ? " 👑" : ""}</span>}
                  </span>
                </div>
              ))}
              {(routines||[]).length > 5 && <div style={{ fontSize: 11, color: V.textDim }}>+{(routines||[]).length-5} more</div>}
            </div>
          </div>
        </div>

        {/* ═══ AI QUICK ADD + VOICE (Cozyla) ═══ */}
        <div style={{ padding: "0 14px 8px" }}>
          <div style={{ display:"flex", gap:6, marginBottom:10 }}>
            <button onClick={() => isRecording ? stopVoiceInput() : startVoiceInput(text => setQuickAddInput(text))}
              style={{ width:44, height:44, borderRadius:"50%", border:"none", cursor:"pointer", fontSize:18,
                background: isRecording ? V.danger : V.bgElevated, color: isRecording ? "#fff" : V.textMuted, flexShrink:0 }}>🎤</button>
            <input value={quickAddInput} onChange={e => setQuickAddInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleQuickAdd()}
              placeholder="Add anything..."
              style={{ ...inputStyle, flex:1, padding:"10px 14px", fontSize:13, borderRadius:20 }} />
            <button onClick={handleQuickAdd} disabled={quickAddLoading || !quickAddInput.trim()}
              style={{ ...btnPrimary, borderRadius:20, padding:"10px 14px", fontSize:16, opacity: quickAddLoading ? 0.6 : 1 }}>
              {quickAddLoading ? "..." : "✨"}</button>
          </div>
          {quickAddPreview && (
            <div style={{ ...cardStyle, border:`2px solid ${V.accent}`, marginBottom:10 }}>
              <div style={{ fontWeight:700, color:V.accent, marginBottom:6 }}>Creating {quickAddPreview.totalInstances} event{quickAddPreview.totalInstances>1?"s":""}{quickAddPreview.repeatDesc}</div>
              <div style={{ display:"flex", gap:8, marginTop:8 }}>
                <button onClick={confirmQuickAdd} style={{ ...btnPrimary, flex:1 }}>Confirm</button>
                <button onClick={() => setQuickAddPreview(null)} style={{ ...btnSecondary, flex:1 }}>Cancel</button>
              </div>
            </div>
          )}
          {quickAddDeleteMatches && (
            <div style={{ ...cardStyle, border:`2px solid ${V.danger}`, marginBottom:10 }}>
              <div style={{ fontWeight:700, color:V.danger, marginBottom:6 }}>🗑️ Found {quickAddDeleteMatches.matches.length} match{quickAddDeleteMatches.matches.length>1?"es":""}</div>
              {quickAddDeleteMatches.matches.slice(0,6).map((m,i) => (
                <div key={i} onClick={() => executeDeleteMatch(m.dk, m.idx)}
                  style={{ padding:8, background:V.bgCardAlt, borderRadius:V.r2, marginBottom:4, cursor:"pointer" }}>
                  <span style={{ fontWeight:600, color:V.textPrimary, fontSize:13 }}>{m.ev.title}</span>
                  <span style={{ fontSize:11, color:V.textDim, marginLeft:6 }}>{m.dk}</span>
                </div>
              ))}
              <button onClick={() => setQuickAddDeleteMatches(null)} style={{ ...btnSecondary, width:"100%", marginTop:4 }}>Cancel</button>
            </div>
          )}
          {quickAddEditPreview && (
            <div style={{ ...cardStyle, border:`2px solid ${V.info}`, marginBottom:10 }}>
              <div style={{ fontWeight:700, color:V.info, marginBottom:6 }}>✏️ Edit: {quickAddEditPreview.ev.title} → {quickAddEditPreview.changes.title || quickAddEditPreview.changes.time}</div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => executeEditMatch(quickAddEditPreview.dk, quickAddEditPreview.idx, quickAddEditPreview.changes)} style={{ ...btnPrimary, flex:1 }}>Confirm</button>
                <button onClick={() => setQuickAddEditPreview(null)} style={{ ...btnSecondary, flex:1 }}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* ═══ BIRTHDAY COUNTDOWNS (Cozyla) ═══ */}
        <div style={{ padding: "0 14px" }}>
          {(() => {
            const upcoming = getUpcomingBirthdays();
            const todayBdays = upcoming.filter(b => b.daysUntil === 0);
            if (todayBdays.length > 0) setTimeout(() => triggerConfetti(document.body, "big"), 300);
            return upcoming.length > 0 ? (
              <div style={{ marginBottom: 10 }}>
                {todayBdays.map((b, i) => (
                  <div key={"cbdt"+i} style={{ padding:12, borderRadius:20, background:`linear-gradient(135deg, ${V.accent}33, ${V.accent}11)`,
                    border:"2px solid gold", textAlign:"center", marginBottom:8 }}>
                    <div style={{ fontSize:18, fontWeight:800, color:V.textPrimary }}>🎂 TODAY IS {b.name.toUpperCase()}'S BIRTHDAY! 👑🎉</div>
                  </div>
                ))}
                {upcoming.filter(b => b.daysUntil > 0).map((b, i) => (
                  <div key={"cbd"+i} style={{ padding:10, borderRadius:14, background:V.bgCard, marginBottom:6,
                    border: b.daysUntil <= 7 ? "2px solid gold" : `1px solid ${V.borderDefault}`,
                    display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ color:V.textSecondary, fontWeight:600, fontSize:13 }}>{b.emoji} {b.name} in {b.daysUntil}d 🎉</span>
                    {b.daysUntil <= 7 && <span style={{ fontSize:18 }}>🎂</span>}
                  </div>
                ))}
              </div>
            ) : null;
          })()}
        </div>

        {/* Day detail popup */}
        {selectedDay && renderDayPopup(dateKey(calYear, calMonth, selectedDay))}
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // FAMILYWALL HOME — bold widget grid layout
  // ═══════════════════════════════════════════════
  function renderHomeFamilyWall() {
    const nowHour = today.getHours();
    const greeting = nowHour < 12 ? "Good morning" : nowHour < 17 ? "Good afternoon" : "Good evening";
    const userName = currentProfile?.name || "there";
    const userEmoji = currentProfile?.emoji || "👑";

    // Stats for widget cards
    const dk = todayKey();
    const todayEventCount = ((events||{})[dk] || []).length;
    // Count events this week
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    let weekEventCount = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const wk = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
      weekEventCount += ((events||{})[wk] || []).length;
    }
    const routinesDone = (routines||[]).filter(r=>r.done).length;
    const routinesTotal = (routines||[]).length;
    const goalsDone = (goals||[]).filter(g=>g.done).length;
    const goalsTotal = (goals||[]).length;
    const todayMeals = (foodLog||[]).filter(f => f.date === todayStr && f.profile === currentProfile?.name);
    const allRules = [...(myRules||[]), ...(theirRules||[]), ...(sharedRules||[])];
    const recentExchanges = (exchangeLog||[]).slice(-3);

    const fwCard = {
      background: V.bgCard, borderRadius: V.r3, padding: 16,
      border: `2px solid ${V.borderDefault}`,
      boxShadow: "0 2px 6px rgba(10,20,50,0.08), 0 4px 14px rgba(10,20,50,0.04)",
      cursor: "pointer", transition: "box-shadow 0.15s, border-color 0.15s"
    };

    const widgets = [
      {
        icon: "📅", title: "Calendar", stat: `${todayEventCount} today · ${weekEventCount} this week`,
        action: () => setTab("home"),
        content: (() => {
          // Mini month grid
          const daysInMonth = getDaysInMonth(calYear, calMonth);
          const firstDay = getFirstDay(calYear, calMonth);
          const miniCells = [];
          for (let i = 0; i < firstDay; i++) miniCells.push(null);
          for (let d = 1; d <= daysInMonth; d++) miniCells.push(d);
          const isTodayD = (d) => d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
          return (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1, marginTop: 8 }}>
                {["S","M","T","W","T","F","S"].map((d,i) => (
                  <div key={i} style={{ textAlign:"center", fontSize:9, fontWeight:700, color: V.textDim, padding:"2px 0" }}>{d}</div>
                ))}
                {miniCells.map((d, i) => {
                  if (!d) return <div key={i} />;
                  const dk2 = dateKey(calYear, calMonth, d);
                  const hasEv = ((events||{})[dk2]||[]).length > 0;
                  return (
                    <div key={i} onClick={e => { e.stopPropagation(); setSelectedDay(d); setAddingEvents([{title:"",time:"12:00 PM",who:"",notes:""}]); }}
                      style={{
                        textAlign: "center", fontSize: 10, padding: "3px 0", borderRadius: "50%",
                        fontWeight: isTodayD(d) ? 800 : hasEv ? 700 : 400,
                        color: isTodayD(d) ? "#fff" : hasEv ? V.accent : V.textMuted,
                        background: isTodayD(d) ? V.accent : "transparent",
                        cursor: "pointer"
                      }}>{d}</div>
                  );
                })}
              </div>
            </div>
          );
        })()
      },
      {
        icon: "✅", title: "Routines", stat: `${routinesDone}/${routinesTotal} done`,
        action: () => {},
        content: (
          <div style={{ marginTop: 8 }}>
            {(routines||[]).slice(0,4).map((r,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                <div onClick={e => { e.stopPropagation(); toggleRoutine(i); }} style={{
                  width:16, height:16, borderRadius:3, flexShrink:0, cursor:"pointer",
                  background: r.done ? V.success : "transparent",
                  border: `2px solid ${r.done ? V.success : V.borderSubtle}`,
                  display:"flex", alignItems:"center", justifyContent:"center"
                }}>
                  {r.done && <span style={{color:"#fff",fontSize:9}}>✓</span>}
                </div>
                <span style={{ fontSize:12, color: r.done ? V.textDim : V.textPrimary,
                  textDecoration: r.done ? "line-through" : "none" }}>{r.text}</span>
              </div>
            ))}
            {routinesTotal > 4 && <div style={{fontSize:11,color:V.textDim}}>+{routinesTotal-4} more</div>}
          </div>
        )
      },
      {
        icon: "🎯", title: "Goals", stat: `${goalsDone}/${goalsTotal} achieved`,
        action: () => {},
        content: (
          <div style={{ marginTop: 8 }}>
            {(goals||[]).slice(0,4).map((g,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                <div onClick={e => { e.stopPropagation(); toggleGoal(i); }} style={{
                  width:16, height:16, borderRadius:3, flexShrink:0, cursor:"pointer",
                  background: g.done ? V.pink : "transparent",
                  border: `2px solid ${g.done ? V.pink : V.borderSubtle}`,
                  display:"flex", alignItems:"center", justifyContent:"center"
                }}>
                  {g.done && <span style={{color:"#fff",fontSize:9}}>✓</span>}
                </div>
                <span style={{ fontSize:12, color: g.done ? V.textDim : V.textPrimary,
                  textDecoration: g.done ? "line-through" : "none" }}>{g.text}</span>
              </div>
            ))}
            {goalsTotal > 4 && <div style={{fontSize:11,color:V.textDim}}>+{goalsTotal-4} more</div>}
          </div>
        )
      },
      {
        icon: "🔥", title: "Food Log", stat: `${todayCalories} cal today`,
        action: () => setTab("food"),
        content: (
          <div style={{ marginTop: 8 }}>
            {todayMeals.length === 0 && <div style={{fontSize:12,color:V.textDim,fontStyle:"italic"}}>No meals logged</div>}
            {todayMeals.slice(0,3).map((m,i) => (
              <div key={i} style={{ fontSize:12, color: V.textSecondary, marginBottom:3 }}>
                {m.name} <span style={{color:V.textDim}}>· {m.calories||0} cal</span>
              </div>
            ))}
            {todayMeals.length > 3 && <div style={{fontSize:11,color:V.textDim}}>+{todayMeals.length-3} more</div>}
          </div>
        )
      },
      {
        icon: "📋", title: "Family Rules", stat: `${allRules.length} rules`,
        action: () => { setTab("family"); setFamilySubTab("rules"); },
        content: (
          <div style={{ marginTop: 8 }}>
            {allRules.length === 0 && <div style={{fontSize:12,color:V.textDim,fontStyle:"italic"}}>No rules set</div>}
            {allRules.slice(0,3).map((r,i) => (
              <div key={i} style={{ fontSize:12, color: V.textSecondary, marginBottom:3, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                · {typeof r === "string" ? r : r.text || r}
              </div>
            ))}
            {allRules.length > 3 && <div style={{fontSize:11,color:V.textDim}}>+{allRules.length-3} more</div>}
          </div>
        )
      },
      {
        icon: "🔄", title: "Exchange Log", stat: `${(exchangeLog||[]).length} entries`,
        action: () => { setTab("family"); setFamilySubTab("exchange"); },
        content: (
          <div style={{ marginTop: 8 }}>
            {recentExchanges.length === 0 && <div style={{fontSize:12,color:V.textDim,fontStyle:"italic"}}>No exchanges yet</div>}
            {recentExchanges.map((ex,i) => (
              <div key={i} style={{ fontSize:11, color: V.textSecondary, marginBottom:3 }}>
                {typeof ex === "string" ? ex : (ex.date || "") + " " + (ex.type || ex.note || "")}
              </div>
            ))}
          </div>
        )
      },
    ];

    return (
      <div style={{ padding: 14 }}>
        {/* Big greeting */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: V.textPrimary, lineHeight: 1.2 }}>
            {greeting}, {userName}! {userEmoji}
          </div>
          <div style={{ fontSize: 13, color: V.textDim, marginTop: 4 }}>
            {today.toLocaleDateString("en-US", {weekday:"long", month:"long", day:"numeric", year:"numeric"})}
          </div>
        </div>

        {/* Widget grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {widgets.map((w, i) => (
            <div key={i} onClick={w.action} style={fwCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 24 }}>{w.icon}</span>
                <div style={{ fontWeight: 800, fontSize: 15, color: V.accent }}>{w.title}</div>
              </div>
              <div style={{ fontSize: 12, color: V.textMuted, fontWeight: 600 }}>{w.stat}</div>
              {w.content}
            </div>
          ))}
        </div>

        {/* ═══ AI QUICK ADD + VOICE (FamilyWall) ═══ */}
        <div style={{ display:"flex", gap:6, marginTop:12, marginBottom:10 }}>
          <button onClick={() => isRecording ? stopVoiceInput() : startVoiceInput(text => setQuickAddInput(text))}
            style={{ width:44, height:44, borderRadius:"50%", border:"none", cursor:"pointer", fontSize:18,
              background: isRecording ? V.danger : V.bgElevated, color: isRecording ? "#fff" : V.textMuted, flexShrink:0 }}>🎤</button>
          <input value={quickAddInput} onChange={e => setQuickAddInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleQuickAdd()}
            placeholder="Add anything..."
            style={{ ...inputStyle, flex:1, padding:"10px 14px", fontSize:13, borderRadius:V.r2 }} />
          <button onClick={handleQuickAdd} disabled={quickAddLoading || !quickAddInput.trim()}
            style={{ ...btnPrimary, borderRadius:V.r2, padding:"10px 14px", fontSize:16, opacity: quickAddLoading ? 0.6 : 1 }}>
            {quickAddLoading ? "..." : "✨"}</button>
        </div>
        {quickAddPreview && (
          <div style={{ ...cardStyle, border:`2px solid ${V.accent}`, marginBottom:10 }}>
            <div style={{ fontWeight:700, color:V.accent, marginBottom:6 }}>Creating {quickAddPreview.totalInstances} event{quickAddPreview.totalInstances>1?"s":""}{quickAddPreview.repeatDesc}</div>
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              <button onClick={confirmQuickAdd} style={{ ...btnPrimary, flex:1 }}>Confirm</button>
              <button onClick={() => setQuickAddPreview(null)} style={{ ...btnSecondary, flex:1 }}>Cancel</button>
            </div>
          </div>
        )}
        {quickAddDeleteMatches && (
          <div style={{ ...cardStyle, border:`2px solid ${V.danger}`, marginBottom:10 }}>
            <div style={{ fontWeight:700, color:V.danger, marginBottom:6 }}>🗑️ Found {quickAddDeleteMatches.matches.length} match{quickAddDeleteMatches.matches.length>1?"es":""}</div>
            {quickAddDeleteMatches.matches.slice(0,6).map((m,i) => (
              <div key={i} onClick={() => executeDeleteMatch(m.dk, m.idx)}
                style={{ padding:10, background:V.bgCardAlt, borderRadius:V.r2, marginBottom:4, cursor:"pointer",
                  border:`2px solid ${V.borderDefault}` }}>
                <span style={{ fontWeight:700, color:V.textPrimary, fontSize:14 }}>{m.ev.title}</span>
                <span style={{ fontSize:11, color:V.textDim, marginLeft:8 }}>{m.dk}</span>
              </div>
            ))}
            <button onClick={() => setQuickAddDeleteMatches(null)} style={{ ...btnSecondary, width:"100%", marginTop:4 }}>Cancel</button>
          </div>
        )}
        {quickAddEditPreview && (
          <div style={{ ...cardStyle, border:`2px solid ${V.info}`, marginBottom:10 }}>
            <div style={{ fontWeight:700, color:V.info, marginBottom:6 }}>✏️ Edit: {quickAddEditPreview.ev.title} → {quickAddEditPreview.changes.title || quickAddEditPreview.changes.time}</div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => executeEditMatch(quickAddEditPreview.dk, quickAddEditPreview.idx, quickAddEditPreview.changes)} style={{ ...btnPrimary, flex:1 }}>Confirm</button>
              <button onClick={() => setQuickAddEditPreview(null)} style={{ ...btnSecondary, flex:1 }}>Cancel</button>
            </div>
          </div>
        )}

        {/* ═══ BIRTHDAY COUNTDOWNS (FamilyWall) ═══ */}
        {(() => {
          const upcoming = getUpcomingBirthdays();
          const todayBdays = upcoming.filter(b => b.daysUntil === 0);
          if (todayBdays.length > 0) setTimeout(() => triggerConfetti(document.body, "big"), 300);
          return upcoming.length > 0 ? (
            <div style={{ marginBottom: 10 }}>
              {todayBdays.map((b, i) => (
                <div key={"fwbdt"+i} style={{ padding:14, borderRadius:V.r3, background:`${V.accent}15`,
                  border:`2px solid ${V.accent}`, textAlign:"center", marginBottom:8 }}>
                  <div style={{ fontSize:20, fontWeight:900, color:V.textPrimary }}>🎂 TODAY IS {b.name.toUpperCase()}'S BIRTHDAY! 👑🎉</div>
                </div>
              ))}
              {upcoming.filter(b => b.daysUntil > 0).map((b, i) => (
                <div key={"fwbd"+i} style={{ padding:12, borderRadius:V.r2, background:V.bgCard, marginBottom:6,
                  border: b.daysUntil <= 7 ? `2px solid ${V.accent}` : `2px solid ${V.borderDefault}`,
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  boxShadow: b.daysUntil <= 7 ? V.shadowGlow : "none" }}>
                  <span style={{ color:V.textPrimary, fontWeight:700, fontSize:14 }}>{b.emoji} {b.name} in {b.daysUntil}d 🎉</span>
                  {b.daysUntil <= 7 && <span style={{ fontSize:20 }}>🎂</span>}
                </div>
              ))}
            </div>
          ) : null;
        })()}

        {/* Day detail popup */}
        {selectedDay && renderDayPopup(dateKey(calYear, calMonth, selectedDay))}
      </div>
    );
  }

  // ---- FOOD TAB (UNUSED — replaced by FoodTab.jsx component) ----
  // TODO: Remove this dead code in next cleanup
  function renderFood() {
    const myGoals = (nutritionGoals||{})[currentProfile?.name] || { calories:2000, protein:150, carbs:200, fat:65 };
    return (
      <div style={{ padding:12 }}>
        <div style={{ display:"flex", gap:8, marginBottom:12, overflowX:"auto" }}>
          {["fridge","nutrition","myfoods","manual"].map(t => (
            <button key={t} onClick={() => setFoodSubTab(t)}
              style={{ ...foodSubTab===t ? btnPrimary : btnSecondary, whiteSpace:"nowrap", padding:"6px 14px", fontSize:13 }}>
              {t==="fridge"?"🧊 Fridge":t==="nutrition"?"📊 Nutrition":t==="myfoods"?"⭐ My Foods":"✏️ Manual"}
            </button>
          ))}
        </div>

        {foodSubTab === "fridge" && (
          <div>
            <div style={cardStyle}>
              <div style={{ fontWeight:700, color:"#f59e0b", marginBottom:8 }}>🧊 What's in your fridge?</div>
              <textarea value={fridgeText} onChange={e=>setFridgeText(e.target.value)}
                placeholder="Type anything: '3 eggs, leftover rice, some hot sauce, half onion, ox tail...'"
                style={{ ...inputStyle, minHeight:80, resize:"vertical", marginBottom:8 }} />
              <button onClick={callChef} style={{ ...btnPrimary, width:"100%" }} disabled={chefLoading}>
                {chefLoading ? "🍳 Chef is thinking..." : "👨‍🍳 What can I make?"}
              </button>
            </div>
            {chefResult && (
              <div style={{ ...cardStyle, borderLeft:"3px solid #f59e0b" }}>
                <div style={{ fontWeight:700, color:"#f59e0b", marginBottom:8 }}>👨‍🍳 Chef says:</div>
                <div style={{ fontSize:13, color:V.textSecondary, lineHeight:1.6, whiteSpace:"pre-wrap" }}>{chefResult}</div>
              </div>
            )}
            <div style={cardStyle}>
              <div style={{ fontWeight:700, color:V.textMuted, marginBottom:8, fontSize:13 }}>🔍 Look up any food</div>
              <div style={{ display:"flex", gap:8 }}>
                <input value={foodSearch} onChange={e=>setFoodSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&lookupFood()}
                  placeholder="e.g. 3 slices muenster cheese" style={{ ...inputStyle, flex:1 }} />
                <button onClick={lookupFood} style={{ ...btnPrimary }} disabled={foodLoading}>
                  {foodLoading ? "..." : "Go"}
                </button>
              </div>
              {foodResult && (
                <div style={{ background:V.bgCardAlt, borderRadius:8, padding:12, marginTop:10 }}>
                  <div style={{ fontWeight:700, color:V.textPrimary, marginBottom:6 }}>{foodResult.name}</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
                    {Object.entries(foodResult).filter(([k])=>k!=="name").map(([k,v]) => (
                      <div key={k} style={{ textAlign:"center" }}>
                        <div style={{ fontSize:16, fontWeight:700, color:"#f59e0b" }}>{v}g</div>
                        <div style={{ fontSize:11, color:V.textDim }}>{k}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:"flex", gap:6, marginTop:8 }}>
                    <button onClick={() => logFood(foodResult)} style={{ ...btnPrimary, flex:1, fontSize:12 }}>Log It</button>
                    <button onClick={() => saveToMyFoods(foodResult)} style={{ ...btnSecondary, flex:1, fontSize:12 }}>⭐ Save</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {foodSubTab === "nutrition" && (
          <div>
            <div style={cardStyle}>
              <div style={{ fontWeight:700, color:"#f59e0b", marginBottom:10 }}>📊 My Nutrition Goals</div>
              <div style={{ fontSize:12, color:V.textDim, marginBottom:10 }}>Set your own daily targets — different for each profile</div>
              {["calories","protein","carbs","fat","fiber","sugar"].map(m => (
                <div key={m} style={{ marginBottom:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                    <span style={{ fontSize:13, color:V.textSecondary }}>{m.charAt(0).toUpperCase()+m.slice(1)}</span>
                    <span style={{ fontSize:12, color:"#f59e0b" }}>{myGoals[m] || 0}{m==="calories"?"":" g"}</span>
                  </div>
                  <input type="number" value={myGoals[m]||0} onChange={e => {
                    const updated = { ...(nutritionGoals||{}), [currentProfile?.name]: { ...myGoals, [m]: Number(e.target.value) }};
                    fbSet("nutritionGoals", updated);
                  }} style={{ ...inputStyle, padding:"4px 8px" }} />
                </div>
              ))}
            </div>
            <div style={cardStyle}>
              <div style={{ fontWeight:700, color:"#f59e0b", marginBottom:8 }}>Today's Log</div>
              {(foodLog||[]).filter(f=>f.date===todayStr&&f.profile===currentProfile?.name).map((f,i)=>(
                <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${V.borderDefault}`, fontSize:13 }}>
                  <span style={{ color:V.textSecondary }}>{f.name}</span>
                  <span style={{ color:"#f59e0b" }}>{f.calories} cal</span>
                </div>
              ))}
              {!(foodLog||[]).filter(f=>f.date===todayStr&&f.profile===currentProfile?.name).length &&
                <div style={{ color:V.textDim, fontSize:13 }}>Nothing logged today</div>}
              <div style={{ marginTop:8, fontSize:13, color:"#f59e0b", fontWeight:700 }}>
                Total: {todayCalories} / {myGoals.calories || 2000} cal
              </div>
            </div>
          </div>
        )}

        {foodSubTab === "myfoods" && (
          <div>
            <div style={{ fontWeight:700, color:"#f59e0b", marginBottom:10 }}>⭐ My Saved Foods</div>
            {(myFoods||[]).map((f,i) => (
              <div key={i} style={{ ...cardStyle }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ fontWeight:600 }}>{f.name}</div>
                  <button onClick={() => logFood(f)} style={{ ...btnPrimary, padding:"4px 10px", fontSize:12 }}>Log</button>
                </div>
                <div style={{ fontSize:12, color:V.textDim, marginTop:4 }}>{f.calories} cal · {f.protein}g protein · {f.carbs}g carbs</div>
              </div>
            ))}
            {!(myFoods||[]).length && <div style={{ ...cardStyle, color:V.textDim, textAlign:"center" }}>No saved foods yet. Look up a food and save it!</div>}
          </div>
        )}

        {foodSubTab === "manual" && (
          <div style={cardStyle}>
            <div style={{ fontWeight:700, color:"#f59e0b", marginBottom:10 }}>✏️ Manual Entry</div>
            {["name","calories","protein","carbs","fat"].map(field => (
              <div key={field} style={{ marginBottom:8 }}>
                <div style={{ fontSize:12, color:V.textMuted, marginBottom:3 }}>{field.charAt(0).toUpperCase()+field.slice(1)}{field!=="name"?" (g/kcal)":""}</div>
                <input value={manualFood[field]} onChange={e=>setManualFood({...manualFood,[field]:field==="name"?e.target.value:Number(e.target.value)})}
                  type={field==="name"?"text":"number"} style={{ ...inputStyle }} />
              </div>
            ))}
            <div style={{ display:"flex", gap:8, marginTop:4 }}>
              <button onClick={()=>logFood(manualFood)} style={{ ...btnPrimary, flex:1 }}>Log It</button>
              <button onClick={()=>saveToMyFoods(manualFood)} style={{ ...btnSecondary, flex:1 }}>⭐ Save</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---- KIDS TAB ----
  function renderKids() {
    if (showGame) return (
      <div style={{ padding:12 }}>
        <button onClick={()=>setShowGame(false)} style={{...btnSecondary, marginBottom:12}}>← Back</button>
        <LucacLegends profile={currentProfile} kidsData={kidsData} fbSet={fbSet} />
      </div>
    );
    return (
      <div style={{ padding:12 }}>
        {isAdmin && (
          <button onClick={()=>setShowGame(true)} style={{...btnPrimary, width:"100%", marginBottom:12, padding:14, fontSize:15}}>
            🎮 LUCAC Legends
          </button>
        )}
        {kidProfiles.map(kid => {
          const kd = getKidData(kid.name);
          return (
            <div key={kid.id} style={cardStyle}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:24 }}>{kid.emoji}</span>
                  <div>
                    <div style={{ fontWeight:700, color:kid.color||"#f59e0b" }}>{kid.name}</div>
                    <div style={{ fontSize:12, color:V.textDim }}>⭐ {kd.points || 0} points</div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  {contactDad && <button onClick={()=>window.location.href=`tel:${contactDad}`} style={{...btnPrimary,padding:"4px 8px",fontSize:12}}>📞 Dada</button>}
                  {contactMom && <button onClick={()=>window.location.href=`tel:${contactMom}`} style={{background:"#7c3aed",color:"#fff",border:"none",borderRadius:6,padding:"4px 8px",fontSize:12,cursor:"pointer",fontWeight:700}}>📞 Mom</button>}
                </div>
              </div>
              {/* Emoji task cards */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10,marginTop:8}}>
                {(kd.tasks||[]).map((task,i) => (
                  <div key={i} onClick={()=>!task.done&&completeKidTask(kid.name,i)}
                    style={{minHeight:120,borderRadius:14,background:task.done?V.bgCardAlt:V.bgCard,
                      border:`2px solid ${task.done?V.borderDefault:V.accent}`,
                      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                      padding:14,cursor:task.done?"default":"pointer",position:"relative",
                      opacity:task.done?0.5:1,boxShadow:task.done?"none":V.shadowCard}}>
                    {task.done && <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:44,borderRadius:12,background:"rgba(255,255,255,0.3)",zIndex:1}}>✅</div>}
                    <div style={{fontSize:44,marginBottom:6}}>{task.emoji||"📝"}</div>
                    <div style={{fontSize:13,fontWeight:700,color:V.textPrimary,textAlign:"center",wordBreak:"break-word"}}>{task.text}</div>
                    {isAdmin && <button onClick={e=>{e.stopPropagation();
                      const tasks=[...(kd.tasks||[])]; tasks.splice(i,1);
                      fbSet("kidsData",{...(kidsData||{}),[kid.name]:{...kd,tasks}});
                    }} style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.1)",border:"none",borderRadius:"50%",
                      width:24,height:24,fontSize:12,color:V.textDim,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>✕</button>}
                  </div>
                ))}
              </div>
              {/* Emoji picker + add task (admin only) */}
              {isAdmin && (
                <div style={{marginTop:10}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(6,44px)",gap:4,marginBottom:8,justifyContent:"center"}}>
                    {TASK_EMOJIS.map((em,ei) => (
                      <button key={ei} onClick={()=>setSelectedTaskEmoji(em)}
                        style={{width:44,height:44,fontSize:20,borderRadius:10,cursor:"pointer",
                          border:selectedTaskEmoji===em?`2px solid ${V.accent}`:`1px solid ${V.borderSubtle}`,
                          background:selectedTaskEmoji===em?`${V.accent}22`:V.bgCardAlt,
                          display:"flex",alignItems:"center",justifyContent:"center"}}>{em}</button>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <input value={newTask[kid.name]||""} onChange={e=>setNewTask({...newTask,[kid.name]:e.target.value})}
                      onKeyDown={e=>e.key==="Enter"&&addKidTask(kid.name)}
                      placeholder="New task..." style={{...inputStyle,flex:1,padding:"8px 12px",fontSize:13}} />
                    <button onClick={()=>addKidTask(kid.name)} style={{...btnPrimary,padding:"8px 14px",fontSize:14}}>Add</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!kidProfiles.length && <div style={{...cardStyle,color:V.textDim,textAlign:"center"}}>Add kids in Settings → Profiles</div>}

        {/* 📚 Homework Helper */}
        <HomeworkHelper V={V} profiles={profiles} kidsData={kidsData} fbSet={fbSet}
          GROQ_KEY={GROQ_KEY} showToast={showToast} />
      </div>
    );
  }

  // ---- FAMILY TAB ----
  function renderFamily() {
    return (
      <div style={{padding:12}}>
        <div style={{display:"flex",gap:8,marginBottom:12,overflowX:"auto"}}>
          {["schedule","myrules","theirrules","shared","log","budget"].map(t=>(
            <button key={t} onClick={()=>setFamilySubTab(t)}
              style={{...familySubTab===t?btnPrimary:btnSecondary,whiteSpace:"nowrap",padding:"6px 12px",fontSize:12}}>
              {t==="schedule"?"📅 Schedule":t==="myrules"?"👑 My Rules":t==="theirrules"?"💜 Their Rules":t==="shared"?"🤝 Shared":t==="log"?"📋 Log":"💰 Budget"}
            </button>
          ))}
        </div>

        {familySubTab === "schedule" && (
          <div style={cardStyle}>
            <div style={{fontWeight:700,color:"#f59e0b",marginBottom:10}}>📅 Weekly Custody Schedule</div>
            <div style={{fontSize:12,color:V.textDim,marginBottom:12}}>{isAdmin?"Tap a day to change":"View only"}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6}}>
              {custodyDayNames.map(day=>{
                const val=(custodySchedule||{})[day]||"Free";
                return(
                  <div key={day} onClick={()=>cycleCustody(day)}
                    style={{textAlign:"center",padding:"10px 4px",borderRadius:8,cursor:isAdmin?"pointer":"default",
                      background:custodyColor(val),border:`1px solid ${custodyColor(val)}`}}>
                    <div style={{fontSize:11,color:V.textMuted,marginBottom:4}}>{day}</div>
                    <div style={{fontSize:12,fontWeight:700,color:val==="Free"?V.textDim:V.textPrimary}}>{val}</div>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:12,height:12,borderRadius:3,background:"#f59e0b"}}/><span style={{fontSize:12,color:V.textMuted}}>Dad</span></div>
              <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:12,height:12,borderRadius:3,background:"#a855f7"}}/><span style={{fontSize:12,color:V.textMuted}}>Mom</span></div>
              <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:12,height:12,borderRadius:3,background:V.borderSubtle}}/><span style={{fontSize:12,color:V.textMuted}}>Free</span></div>
            </div>
          </div>
        )}

        {familySubTab === "myrules" && (
          <div>
            <div style={cardStyle}>
              <div style={{fontWeight:700,color:"#f59e0b",marginBottom:10}}>👑 My House Rules</div>
              {(myRules||[]).map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${V.borderDefault}`,fontSize:13}}>
                  <span style={{color:V.textSecondary}}>• {r}</span>
                  {isAdmin&&<button onClick={()=>fbSet("myRules",(myRules||[]).filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer"}}>✕</button>}
                </div>
              ))}
              {isAdmin&&(
                <div style={{display:"flex",gap:6,marginTop:8}}>
                  <input value={newMyRule} onChange={e=>setNewMyRule(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(fbSet("myRules",[...(myRules||[]),newMyRule]),setNewMyRule(""))}
                    placeholder="Add your rule..." style={{...inputStyle,flex:1}} />
                  <button onClick={()=>{fbSet("myRules",[...(myRules||[]),newMyRule]);setNewMyRule("");}} style={{...btnPrimary}}>+</button>
                </div>
              )}
            </div>
          </div>
        )}

        {familySubTab === "theirrules" && (
          <div style={cardStyle}>
            <div style={{fontWeight:700,color:"#a855f7",marginBottom:10}}>💜 Their House Rules</div>
            {(theirRules||[]).map((r,i)=>(
              <div key={i} style={{padding:"8px 0",borderBottom:`1px solid ${V.borderDefault}`,fontSize:13,color:V.textSecondary}}>• {r}</div>
            ))}
            {isAdmin&&(
              <div style={{display:"flex",gap:6,marginTop:8}}>
                <input value={newTheirRule} onChange={e=>setNewTheirRule(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(fbSet("theirRules",[...(theirRules||[]),newTheirRule]),setNewTheirRule(""))}
                  placeholder="Add their rule..." style={{...inputStyle,flex:1}} />
                <button onClick={()=>{fbSet("theirRules",[...(theirRules||[]),newTheirRule]);setNewTheirRule("");}} style={{...btnPrimary}}>+</button>
              </div>
            )}
          </div>
        )}

        {familySubTab === "shared" && (
          <div style={cardStyle}>
            <div style={{fontWeight:700,color:"#22c55e",marginBottom:10}}>🤝 Shared Rules</div>
            {(sharedRules||[]).map((r,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${V.borderDefault}`,fontSize:13}}>
                <span style={{color:V.textSecondary}}>✓ {typeof r==="string"?r:r.text}</span>
              </div>
            ))}
            {isAdmin&&(
              <div style={{display:"flex",gap:6,marginTop:8}}>
                <input value={newSharedRule} onChange={e=>setNewSharedRule(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(fbSet("sharedRules",[...(sharedRules||[]),newSharedRule]),setNewSharedRule(""))}
                  placeholder="Propose shared rule..." style={{...inputStyle,flex:1}} />
                <button onClick={()=>{fbSet("sharedRules",[...(sharedRules||[]),newSharedRule]);setNewSharedRule("");}} style={{...btnPrimary}}>+</button>
              </div>
            )}
          </div>
        )}

        {familySubTab === "log" && isAdmin && (
          <div>
            <div style={cardStyle}>
              <div style={{fontWeight:700,color:"#f59e0b",marginBottom:8}}>⏱ Exchange Log</div>
              <div style={{fontSize:12,color:V.textDim,marginBottom:10}}>Track pickup/dropoff times. Only visible to you.</div>
              {!exchangeStart ? (
                <button onClick={startExchange} style={{...btnPrimary,width:"100%",padding:12}}>▶ Start Exchange Timer</button>
              ) : (
                <div>
                  <div style={{textAlign:"center",fontSize:32,fontWeight:800,color:"#f59e0b",marginBottom:8}}>
                    {Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,"0")}
                  </div>
                  <div style={{fontSize:12,color:V.textDim,textAlign:"center",marginBottom:10}}>Waiting since {exchangeStart.toLocaleTimeString()}</div>
                  <input value={exchangeNote} onChange={e=>setExchangeNote(e.target.value)}
                    placeholder="Notes (optional)" style={{...inputStyle,marginBottom:8}} />
                  <button onClick={()=>logArrival(exchangeNote)} style={{...btnPrimary,width:"100%",padding:12}}>✓ They Arrived</button>
                </div>
              )}
            </div>
            {(exchangeLog||[]).slice().reverse().slice(0,10).map((entry,i)=>(
              <div key={i} style={{...cardStyle,borderLeft:`3px solid ${entry.waitMinutes>15?"#ef4444":"#22c55e"}`}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontWeight:600,color:V.textSecondary,fontSize:13}}>{entry.date} {entry.time}</span>
                  <span style={{color:entry.waitMinutes>15?"#ef4444":"#22c55e",fontWeight:700,fontSize:13}}>{entry.waitMinutes} min wait</span>
                </div>
                {entry.notes&&<div style={{fontSize:12,color:V.textMuted,marginTop:4}}>{entry.notes}</div>}
              </div>
            ))}
          </div>
        )}
        {familySubTab === "log" && !isAdmin && (
          <div style={{...cardStyle,color:V.textDim,textAlign:"center"}}>Exchange log is admin only.</div>
        )}
        {familySubTab === "budget" && (
          <BudgetTab V={V} currentProfile={currentProfile} fbSet={fbSet} GROQ_KEY={GROQ_KEY}
            showToast={showToast} profiles={profiles} custodySchedule={custodySchedule}
            budgetData={budgetData} isAdmin={isAdmin} />
        )}
      </div>
    );
  }

  // ---- SETTINGS TAB ----
  function renderSettings() {
    return (
      <div style={{padding:12}}>
        {saveFeedback && (
          <div style={{background:"#22c55e",color:"#fff",borderRadius:8,padding:"8px 14px",marginBottom:10,fontWeight:700,textAlign:"center"}}>
            ✓ {saveFeedback}
          </div>
        )}
        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          {["profiles","theme","widgets","contacts","alerts"].map(t=>(
            <button key={t} onClick={()=>setSettingsSubTab(t)}
              style={{...settingsSubTab===t?btnPrimary:btnSecondary,padding:"6px 12px",fontSize:12}}>
              {t==="profiles"?"👤 Profiles":t==="theme"?"🎨 Theme":t==="widgets"?"📦 Widgets":t==="contacts"?"📞 Contacts":"🔔 Alerts"}
            </button>
          ))}
        </div>

        {settingsSubTab === "profiles" && (
          <div>
            {isAdmin && (
              <div style={cardStyle}>
                <div style={{fontWeight:700,color:"#f59e0b",marginBottom:10}}>My Profile</div>
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:12,color:V.textMuted,marginBottom:3}}>Name</div>
                  <div style={{display:"flex",gap:6}}>
                    <input value={profileNameEdit} onChange={e=>setProfileNameEdit(e.target.value)}
                      onFocus={e=>{if(!profileNameEdit)setProfileNameEdit(currentProfile?.name||"");e.target.select();}}
                      placeholder={currentProfile?.name||"Your name"}
                      style={{...inputStyle,flex:1}} />
                    <button onClick={()=>{
                      const name=profileNameEdit.trim()||currentProfile?.name;
                      const updated=(profiles||[]).map(p=>p.id===currentProfile?.id?{...p,name}:p);
                      fbSet("profiles",updated);setCurrentProfile(p=>({...p,name}));setProfileNameEdit("");showSave("Name saved!");
                    }} style={{...btnPrimary,padding:"8px 12px",fontSize:12}}>Save</button>
                  </div>
                </div>
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:12,color:V.textMuted,marginBottom:3}}>PIN (4-6 digits)</div>
                  <div style={{display:"flex",gap:6}}>
                    <div style={{flex:1,position:"relative"}}>
                      <input type={showPin?"text":"password"} value={pinEdit} onChange={e=>setPinEdit(e.target.value)}
                        placeholder="New PIN" maxLength={6} style={{...inputStyle,paddingRight:40}} />
                      <button onClick={()=>setShowPin(!showPin)} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",
                        background:"none",border:"none",cursor:"pointer",fontSize:16,padding:4}}>{showPin?"🙈":"👁"}</button>
                    </div>
                    <button onClick={()=>{
                      if(pinEdit.length>=4){
                        const updated=(profiles||[]).map(p=>p.id===currentProfile?.id?{...p,pin:pinEdit}:p);
                        fbSet("profiles",updated);setCurrentProfile(p=>({...p,pin:pinEdit}));setPinEdit("");showSave("PIN saved!");
                      }
                    }} style={{...btnPrimary,padding:"8px 12px",fontSize:12}}>Save</button>
                  </div>
                </div>
              </div>
            )}
            <div style={cardStyle}>
              <div style={{fontWeight:700,color:"#f59e0b",marginBottom:10}}>Family Members</div>
              {(profiles||[]).map((p,i)=>(
                <div key={p.id} style={{padding:"8px 0",borderBottom:`1px solid ${V.borderDefault}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:22}}>{p.emoji}</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,color:p.color||V.textPrimary,fontSize:14}}>{p.name}</div>
                      <div style={{fontSize:11,color:V.textDim}}>{p.type}{p.birthday ? ` · 🎂 ${p.birthday}` : ""}</div>
                    </div>
                    <input type="color" value={p.color||"#f59e0b"} onChange={e=>{
                      const updated=(profiles||[]).map(pp=>pp.id===p.id?{...pp,color:e.target.value}:pp);
                      fbSet("profiles",updated);
                    }} style={{width:28,height:28,border:"none",borderRadius:4,cursor:"pointer",background:"none"}} />
                  </div>
                  {isAdmin && (
                    <div style={{display:"flex",gap:6,marginTop:6,marginLeft:30}}>
                      <select value={p.birthday ? p.birthday.split("-")[0] : ""} onChange={e=>{
                        const mm=e.target.value; const dd=p.birthday?p.birthday.split("-")[1]:"01";
                        const updated=(profiles||[]).map(pp=>pp.id===p.id?{...pp,birthday:mm?mm+"-"+dd:""}:pp);
                        fbSet("profiles",updated);
                      }} style={{...inputStyle,width:"auto",flex:1,padding:"4px 8px",fontSize:12}}>
                        <option value="">Month...</option>
                        {["01-Jan","02-Feb","03-Mar","04-Apr","05-May","06-Jun","07-Jul","08-Aug","09-Sep","10-Oct","11-Nov","12-Dec"].map(m=>{
                          const [val,label]=m.split("-"); return <option key={val} value={val}>{label}</option>;
                        })}
                      </select>
                      <select value={p.birthday ? p.birthday.split("-")[1] : ""} onChange={e=>{
                        const dd=e.target.value; const mm=p.birthday?p.birthday.split("-")[0]:"01";
                        const updated=(profiles||[]).map(pp=>pp.id===p.id?{...pp,birthday:dd?mm+"-"+dd:""}:pp);
                        fbSet("profiles",updated);
                      }} style={{...inputStyle,width:"auto",flex:1,padding:"4px 8px",fontSize:12}}>
                        <option value="">Day...</option>
                        {Array.from({length:31},(_,i)=>{const d=String(i+1).padStart(2,"0"); return <option key={d} value={d}>{i+1}</option>;})}
                      </select>
                      {p.type !== "admin" && (
                        <button onClick={()=>{
                          if(confirm(`Remove ${p.name} from your family?`)){
                            const updated=(profiles||[]).filter(pp=>pp.id!==p.id);
                            fbSet("profiles",updated); showSave(`${p.name} removed`);
                          }
                        }} style={{width:36,height:36,borderRadius:8,background:`${V.danger}15`,border:`1px solid ${V.danger}33`,
                          color:V.danger,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>
                          🗑️
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {isAdmin && (
                <div style={{marginTop:10}}>
                  <div style={{fontSize:12,color:V.textMuted,marginBottom:6}}>Add Family Member</div>
                  <div style={{display:"flex",gap:6,marginBottom:6}}>
                    <input value={newMemberName} onChange={e=>setNewMemberName(e.target.value)} placeholder="Name" style={{...inputStyle,flex:1}} />
                    <input value={newMemberEmoji} onChange={e=>setNewMemberEmoji(e.target.value)} placeholder="😊" style={{...inputStyle,width:60}} />
                  </div>
                  <select value={newMemberType} onChange={e=>setNewMemberType(e.target.value)} style={{...inputStyle,marginBottom:6}}>
                    <option value="family">Family (adult)</option>
                    <option value="kid">Kid</option>
                  </select>
                  <button onClick={()=>{
                    if(!newMemberName.trim())return;
                    const newP={id:Date.now()+"",name:newMemberName,emoji:newMemberEmoji||"😊",type:newMemberType,color:"#3b82f6",pin:""};
                    fbSet("profiles",[...(profiles||[]),newP]);
                    setNewMemberName("");setNewMemberEmoji("😊");showSave("Member added!");
                  }} style={{...btnPrimary,width:"100%"}}>Add Member</button>
                </div>
              )}
            </div>
          </div>
        )}

        {settingsSubTab === "theme" && (
          <div style={cardStyle}>
            <div style={{fontWeight:700,color:V.accent,marginBottom:4,fontSize:15}}>App Theme</div>
            <div style={{fontSize:12,color:V.textMuted,marginBottom:14}}>Choose a look for the whole app</div>
            {Object.entries(THEMES).map(([key, t]) => {
              const active = themeName === key;
              return (
                <button key={key} onClick={() => { setThemeName(key); fbSet("themeName", key); showSave(`${t.label} theme applied!`); }}
                  style={{
                    display:"flex", alignItems:"center", gap:12, width:"100%",
                    background: active ? `${t.accent}15` : V.bgCardAlt,
                    border: active ? `2px solid ${t.accent}` : `2px solid transparent`,
                    borderRadius: V.r3, padding:"14px 16px", marginBottom:V.sp2,
                    cursor:"pointer", transition:"border 0.15s, background 0.15s", textAlign:"left"
                  }}>
                  <span style={{fontSize:28}}>{t.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14,color:V.textPrimary}}>
                      {t.label} {active && <span style={{fontSize:11,fontWeight:600,color:t.accent,marginLeft:6}}>Active</span>}
                    </div>
                    <div style={{fontSize:12,color:V.textMuted,marginTop:2}}>{t.desc}</div>
                  </div>
                  <div style={{display:"flex",gap:4}}>
                    {[t.bgApp, t.accent, t.calBgToday, t.textPrimary].map((c,i) => (
                      <div key={i} style={{width:16,height:16,borderRadius:"50%",background:c,
                        border:`1px solid ${t.borderSubtle}`}} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ═══ WIDGETS RESTORE (Fix: hidden widgets recoverable) ═══ */}
        {settingsSubTab === "widgets" && (
          <div style={cardStyle}>
            <div style={{fontWeight:700,color:V.accent,marginBottom:4,fontSize:15}}>Hidden Widgets</div>
            <div style={{fontSize:12,color:V.textMuted,marginBottom:14}}>Restore widgets you've hidden from the home screen</div>
            {(() => {
              const profilePrefs = (widgetPrefs || {})[currentProfile?.name] || {};
              const allWidgets = [
                {key:"routines",label:"Routines",icon:"✅"},
                {key:"goals",label:"Goals",icon:"🎯"},
                {key:"stats",label:"Quick Stats",icon:"📊"},
              ];
              const hidden = allWidgets.filter(w => profilePrefs[w.key]?.hidden);
              const visible = allWidgets.filter(w => !profilePrefs[w.key]?.hidden);
              return (
                <div>
                  {hidden.length === 0 && <div style={{fontSize:13,color:V.textDim,fontStyle:"italic",marginBottom:10}}>No hidden widgets — all widgets are visible</div>}
                  {hidden.map(w => (
                    <div key={w.key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${V.borderDefault}`}}>
                      <span style={{fontSize:14,color:V.textSecondary}}>{w.icon} {profilePrefs[w.key]?.name || w.label} <span style={{fontSize:11,color:V.textDim}}>(hidden)</span></span>
                      <button onClick={() => setWidgetPref(w.key, {...(profilePrefs[w.key]||{}), hidden:false})}
                        style={{...btnPrimary,padding:"6px 14px",fontSize:12}}>Show</button>
                    </div>
                  ))}
                  {visible.length > 0 && (
                    <div style={{marginTop:12}}>
                      <div style={{fontSize:12,color:V.textDim,marginBottom:6}}>Visible widgets:</div>
                      {visible.map(w => (
                        <div key={w.key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${V.borderDefault}`}}>
                          <span style={{fontSize:14,color:V.textSecondary}}>{w.icon} {profilePrefs[w.key]?.name || w.label}</span>
                          <span style={{fontSize:11,color:V.success}}>Visible</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {settingsSubTab === "contacts" && (
          <div style={cardStyle}>
            <div style={{fontWeight:700,color:V.accent,marginBottom:10}}>📞 Call Buttons</div>
            <div style={{fontSize:12,color:V.textMuted,marginBottom:12}}>Add call buttons for kids to use. Shows on Kids tab.</div>
            {/* Legacy buttons */}
            {(contactDad || contactMom) && !callButtons.length && (
              <div style={{fontSize:11,color:V.textDim,marginBottom:8}}>
                <button onClick={()=>{
                  const btns = [];
                  if(contactDad) btns.push({id:Date.now()+"d",name:"Dada",number:contactDad,emoji:"📞",color:"#f59e0b"});
                  if(contactMom) btns.push({id:Date.now()+"m",name:"Mom",number:contactMom,emoji:"📞",color:"#7c3aed"});
                  fbSet("callButtons",btns); setCallButtons(btns); showSave("Migrated!");
                }} style={{...btnSecondary,fontSize:11,padding:"4px 10px"}}>Migrate old contacts →</button>
              </div>
            )}
            {/* Existing buttons */}
            {(callButtons||[]).map((btn,i) => (
              <div key={btn.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:`1px solid ${V.borderDefault}`}}>
                <span style={{fontSize:20}}>{btn.emoji||"📞"}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,color:V.textPrimary,fontSize:14}}>{btn.name}</div>
                  <div style={{fontSize:11,color:V.textDim}}>{btn.number}</div>
                </div>
                <div style={{width:20,height:20,borderRadius:"50%",background:btn.color||V.accent}} />
                <button onClick={()=>{
                  const updated=(callButtons||[]).filter((_,j)=>j!==i);
                  fbSet("callButtons",updated); setCallButtons(updated);
                }} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:V.danger,padding:4}}>🗑️</button>
              </div>
            ))}
            {/* Add new button */}
            {isAdmin && (
              <div style={{marginTop:10,padding:10,background:V.bgCardAlt,borderRadius:V.r2}}>
                <div style={{fontSize:12,color:V.textMuted,marginBottom:6}}>Add Call Button</div>
                <div style={{display:"flex",gap:6,marginBottom:6}}>
                  <input id="cb-name" placeholder="Name" style={{...inputStyle,flex:1}} />
                  <input id="cb-number" placeholder="555-000-0000" style={{...inputStyle,flex:1}} />
                </div>
                <div style={{display:"flex",gap:6}}>
                  <input id="cb-emoji" placeholder="📞" style={{...inputStyle,width:50}} />
                  <input id="cb-color" type="color" defaultValue="#f59e0b" style={{width:44,height:38,border:"none",borderRadius:V.r2,cursor:"pointer"}} />
                  <button onClick={()=>{
                    const n=document.getElementById("cb-name").value.trim();
                    const num=document.getElementById("cb-number").value.trim();
                    const em=document.getElementById("cb-emoji").value||"📞";
                    const col=document.getElementById("cb-color").value;
                    if(!n||!num) return;
                    const updated=[...(callButtons||[]),{id:Date.now()+"",name:n,number:num,emoji:em,color:col}];
                    fbSet("callButtons",updated); setCallButtons(updated);
                    document.getElementById("cb-name").value=""; document.getElementById("cb-number").value="";
                    showSave("Button added!");
                  }} style={{...btnPrimary,padding:"8px 14px"}}>Add</button>
                </div>
              </div>
            )}
          </div>
        )}

        {settingsSubTab === "alerts" && (
          <div style={cardStyle}>
            <div style={{fontWeight:700,color:"#f59e0b",marginBottom:10}}>🔔 Event Reminders</div>
            <div style={{fontSize:13,color:V.textMuted,marginBottom:12}}>How many minutes before an event to get reminded?</div>
            <div style={{textAlign:"center",fontSize:36,fontWeight:800,color:"#f59e0b",marginBottom:6}}>{alertMinutes} min</div>
            <input type="range" min={1} max={120} value={alertMinutes} onChange={e=>setAlertMinutes(Number(e.target.value))}
              style={{width:"100%",accentColor:"#f59e0b",marginBottom:12}} />
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:V.textDim,marginBottom:12}}>
              <span>1 min</span><span>30 min</span><span>1 hour</span><span>2 hours</span>
            </div>
            <button onClick={()=>{fbSet("alertMinutes",alertMinutes);showSave("Alert saved!");}} style={{...btnPrimary,width:"100%"}}>💾 Save</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={appStyle}>
      {/* Header */}
      <div style={{background:V.bgCard,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",
        borderBottom:`1px solid ${V.borderDefault}`,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>👑</span>
          <span style={{fontWeight:800,color:V.accent,fontSize:16,letterSpacing:1}}>LUCAC</span>
          {isOffline
            ? <span style={{fontSize:11,color:V.danger,background:`${V.danger}18`,padding:"2px 6px",borderRadius:10}}>⚠ Offline</span>
            : <span style={{fontSize:11,color:V.success,background:`${V.success}18`,padding:"2px 6px",borderRadius:10}}>✦ Live</span>
          }
          {guestMode && <span style={{fontSize:11,color:V.info,background:`${V.info}18`,padding:"2px 6px",borderRadius:10}}>👁️ Guest</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {guestMode && (
            <button onClick={() => setGuestPinPrompt(true)}
              style={{fontSize:11,color:V.textDim,background:V.bgElevated,border:`1px solid ${V.borderSubtle}`,
                borderRadius:8,padding:"4px 10px",cursor:"pointer",fontWeight:600}}>Exit Guest</button>
          )}
          <div style={{textAlign:"right"}}>
            <div style={{fontWeight:700,color:V.textPrimary,fontSize:14}}>{new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
            <div style={{fontSize:11,color:V.textDim}}>{new Date().toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"})}</div>
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div>
        {tab === "home" && renderHome()}
        {tab === "food" && <FoodTab V={V} currentProfile={currentProfile} foodLog={foodLog} myFoods={myFoods}
          nutritionGoals={nutritionGoals} fbSet={fbSet} GROQ_KEY={GROQ_KEY} showToast={showToast} profiles={profiles}
          shoppingList={shoppingList} weightLog={weightLog} isRecording={isRecording} startVoiceInput={startVoiceInput} stopVoiceInput={stopVoiceInput} />}
        {tab === "kids" && renderKids()}
        {tab === "family" && renderFamily()}
        {tab === "settings" && renderSettings()}
      </div>

      {/* Bottom nav */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:900,
        background:V.bgCard,borderTop:`1px solid ${V.borderDefault}`,display:"flex",justifyContent:"space-around",
        padding:"8px 0",zIndex:100,boxShadow:"0 -1px 4px rgba(0,0,0,0.04)"}}>
        {tabs.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",cursor:"pointer",
            display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"4px 8px",
            opacity: tab===t.id ? 1 : 0.5}}>
            <span style={{fontSize:20}}>{t.icon}</span>
            <span style={{fontSize:10,color:tab===t.id?V.accent:V.textDim,fontWeight:tab===t.id?700:400}}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* bby sonnet Jr. — floating assistant */}
      {!guestMode && (
        <GroqAssistant V={V} currentProfile={currentProfile} profiles={profiles} events={events}
          routines={routines} goals={goals} foodLog={foodLog} shoppingList={shoppingList}
          budgetData={budgetData} custodySchedule={custodySchedule} fbSet={fbSet}
          GROQ_KEY={GROQ_KEY} TAVILY_KEY={TAVILY_KEY} showToast={showToast}
          familyNames={familyNames} dateKey={dateKey} todayStr={todayStr} />
      )}

      {/* Guest Mode PIN exit */}
      {guestPinPrompt && (
        <div style={{position:"fixed",inset:0,background:V.bgOverlay,zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
          onClick={e=>{if(e.target===e.currentTarget)setGuestPinPrompt(false);}}>
          <div style={{background:V.bgCard,borderRadius:V.r4,padding:24,width:"100%",maxWidth:300,textAlign:"center",
            border:`1px solid ${V.borderSubtle}`,boxShadow:V.shadowModal}}>
            <div style={{fontSize:16,fontWeight:700,color:V.textPrimary,marginBottom:12}}>Enter Admin PIN to Exit</div>
            <input type="password" value={guestPinInput} onChange={e=>setGuestPinInput(e.target.value)}
              placeholder="PIN" maxLength={6} style={{...inputStyle,textAlign:"center",fontSize:24,letterSpacing:8,marginBottom:12}} />
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{
                const admin=(profiles||[]).find(p=>p.type==="admin");
                if(admin&&guestPinInput===admin.pin){setGuestMode(false);setGuestPinPrompt(false);setGuestPinInput("");
                  setCurrentProfile(null);setScreen("profiles");showToast("Guest mode exited","success");}
                else{showToast("Wrong PIN","error");setGuestPinInput("");}
              }} style={{...btnPrimary,flex:1}}>Unlock</button>
              <button onClick={()=>{setGuestPinPrompt(false);setGuestPinInput("");}} style={{...btnSecondary,flex:1}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div style={{position:"fixed",top:60,left:"50%",transform:"translateX(-50%)",zIndex:9999,
          background: toast.type === "error" ? V.danger : toast.type === "success" ? V.success : V.accent,
          color:"#fff",padding:"10px 20px",borderRadius:12,fontWeight:600,fontSize:13,
          boxShadow:"0 4px 20px rgba(0,0,0,0.2)",maxWidth:340,textAlign:"center"}}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
