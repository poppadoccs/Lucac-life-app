import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";
import LucacLegends from "./LucacLegends";

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
    bgApp: "#f8f9fb", bgCard: "#ffffff", bgCardAlt: "#f3f4f6", bgInput: "#f3f4f6",
    bgElevated: "#e8eaef", bgOverlay: "rgba(0,0,0,0.35)",
    calBgCell: "#ffffff", calBgCellHover: "#f9fafb", calBgToday: "#fffbeb",
    calBgSelected: "#eef4ff", calBgHeader: "#ffffff", calBgWeekday: "#f8f9fb",
    borderDefault: "#e5e7eb", borderSubtle: "#d1d5db", borderAccent: "#f59e0b", borderFocus: "#3b82f6",
    textPrimary: "#1f2937", textSecondary: "#374151", textMuted: "#6b7280", textDim: "#9ca3af",
    accent: "#f59e0b", accentGlow: "rgba(245,158,11,0.12)", accentGlowStrong: "rgba(245,158,11,0.22)",
    success: "#16a34a", danger: "#dc2626", info: "#2563eb", purple: "#7c3aed", pink: "#db2777",
    shadowCard: "0 1px 4px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)",
    shadowModal: "0 8px 30px rgba(0,0,0,0.15)", shadowGlow: "0 0 12px rgba(245,158,11,0.12)",
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
  return (
    <div style={{ display:"flex", gap:4, alignItems:"center" }}>
      <select value={h} onChange={e => onChange(formatTime(e.target.value, m, ampm))}
        style={{ background:"#1e2235", color:"#e2e8f0", border:"1px solid #334155", borderRadius:6, padding:"4px 6px", fontSize:13 }}>
        {hours.map(hh => <option key={hh} value={hh}>{hh}</option>)}
      </select>
      <span style={{ color:"#94a3b8" }}>:</span>
      <select value={String(m).padStart(2,"0")} onChange={e => onChange(formatTime(h, e.target.value, ampm))}
        style={{ background:"#1e2235", color:"#e2e8f0", border:"1px solid #334155", borderRadius:6, padding:"4px 6px", fontSize:13 }}>
        {mins.map(mm => <option key={mm} value={mm}>{mm}</option>)}
      </select>
      <select value={ampm} onChange={e => onChange(formatTime(h, m, e.target.value))}
        style={{ background:"#1e2235", color:"#e2e8f0", border:"1px solid #334155", borderRadius:6, padding:"4px 6px", fontSize:13 }}>
        <option>AM</option>
        <option>PM</option>
      </select>
    </div>
  );
}

function ColorPicker({ label, value, onChange }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
      <span style={{ fontSize:12, color:"#94a3b8", width:80 }}>{label}</span>
      <input type="color" value={value || "#f59e0b"} onChange={e => onChange(e.target.value)}
        style={{ width:36, height:28, border:"none", borderRadius:6, cursor:"pointer", background:"none" }} />
      <span style={{ fontSize:12, color:"#94a3b8" }}>{value}</span>
    </div>
  );
}

function BlockStyleEditor({ style, onChange, onClose }) {
  const s = style || {};
  const [bg, setBg] = useState(s.bg || "#1e3a5f");
  const [color, setColor] = useState(s.color || "#f8fafc");
  const [size, setSize] = useState(s.size || 13);
  const [bold, setBold] = useState(s.bold || false);
  const [italic, setItalic] = useState(s.italic || false);
  const [cursive, setCursive] = useState(s.cursive || false);

  function save() {
    onChange({ bg, color, size, bold, italic, cursive });
    onClose();
  }

  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.7)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#1e2235", borderRadius:12, padding:20, width:300, border:"1px solid #334155" }}>
        <div style={{ fontWeight:700, color:"#f8fafc", marginBottom:14, fontSize:15 }}>🎨 Customize Block</div>
        <ColorPicker label="Background" value={bg} onChange={setBg} />
        <ColorPicker label="Font Color" value={color} onChange={setColor} />
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:12, color:"#94a3b8", marginBottom:4 }}>Font Size: {size}px</div>
          <input type="range" min={10} max={24} value={size} onChange={e => setSize(Number(e.target.value))}
            style={{ width:"100%", accentColor:"#f59e0b" }} />
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          <button onClick={() => setBold(!bold)} style={{ padding:"4px 10px", borderRadius:6, border:"1px solid #334155", background: bold ? "#f59e0b" : "#2d3748", color: bold ? "#0f172a" : "#e2e8f0", fontWeight:700, cursor:"pointer" }}>B</button>
          <button onClick={() => setItalic(!italic)} style={{ padding:"4px 10px", borderRadius:6, border:"1px solid #334155", background: italic ? "#f59e0b" : "#2d3748", color: italic ? "#0f172a" : "#e2e8f0", fontStyle:"italic", cursor:"pointer" }}>I</button>
          <button onClick={() => setCursive(!cursive)} style={{ padding:"4px 10px", borderRadius:6, border:"1px solid #334155", background: cursive ? "#f59e0b" : "#2d3748", color: cursive ? "#0f172a" : "#e2e8f0", fontFamily:"cursive", cursor:"pointer" }}>C</button>
        </div>
        <div style={{ background: bg, borderRadius:8, padding:"8px 12px", marginBottom:14, fontSize:size, color, fontWeight: bold ? 700 : 400, fontStyle: italic ? "italic" : "normal", fontFamily: cursive ? "cursive" : "inherit" }}>
          Preview text ✨
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={save} style={{ flex:1, padding:"8px", borderRadius:8, background:"#f59e0b", color:"#0f172a", fontWeight:700, border:"none", cursor:"pointer" }}>Save</button>
          <button onClick={onClose} style={{ flex:1, padding:"8px", borderRadius:8, background:"#2d3748", color:"#e2e8f0", border:"none", cursor:"pointer" }}>Cancel</button>
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
  const [events, setEvents] = useState({});
  const [eventStyles, setEventStyles] = useState({});
  const [addingEvents, setAddingEvents] = useState([{ title:"", time:"12:00 PM", who:"", notes:"" }]);
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

  const isAdmin = currentProfile?.type === "admin";
  const isKid = currentProfile?.type === "kid";

  // Firebase sync
  useEffect(() => {
    const keys = ["events","eventStyles","routines","routineStyles","goals","goalStyles",
      "profiles","kidsData","custodySchedule","myRules","theirRules","sharedRules",
      "exchangeLog","foodLog","myFoods","nutritionGoals","trackedMacros","contacts","alertMinutes","themeName"];
    keys.forEach(key => {
      onValue(ref(db, key), snap => {
        if (snap.exists()) {
          const val = snap.val();
          if (key === "events") setEvents(val);
          else if (key === "eventStyles") setEventStyles(val);
          else if (key === "routines") setRoutines(val);
          else if (key === "routineStyles") setRoutineStyles(val);
          else if (key === "goals") setGoals(val);
          else if (key === "goalStyles") setGoalStyles(val);
          else if (key === "profiles") setProfiles(val);
          else if (key === "kidsData") setKidsData(val);
          else if (key === "custodySchedule") setCustodySchedule(val);
          else if (key === "myRules") setMyRules(val);
          else if (key === "theirRules") setTheirRules(val);
          else if (key === "sharedRules") setSharedRules(val);
          else if (key === "exchangeLog") setExchangeLog(val);
          else if (key === "foodLog") setFoodLog(val);
          else if (key === "myFoods") setMyFoods(val);
          else if (key === "nutritionGoals") setNutritionGoals(val || {});
          else if (key === "trackedMacros") setTrackedMacros(val);
          else if (key === "contacts") { setContactDad(val.dad||""); setContactMom(val.mom||""); }
          else if (key === "alertMinutes") setAlertMinutes(val);
          else if (key === "themeName") { if (THEMES[val]) setThemeName(val); }
        }
      });
    });
  }, []);

  function fbSet(key, val) { set(ref(db, key), val); }

  function showSave(msg) {
    setSaveFeedback(msg);
    setTimeout(() => setSaveFeedback(""), 2000);
  }

  // Fetch daily quote on mount
  useEffect(() => {
    if (!GROQ_KEY) return;
    fetch("https://api.groq.com/openai/v1/chat/completions", {
      method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${GROQ_KEY}` },
      body: JSON.stringify({ model:"llama-3.3-70b-versatile", max_tokens:80,
        messages:[{ role:"user", content:"Give me one short motivational quote (under 15 words) for a single dad building his own business. Just the quote, no attribution." }]
      })
    }).then(r=>r.json()).then(d => {
      if (d.choices?.[0]?.message?.content) setQuote(d.choices[0].message.content.replace(/"/g,""));
    }).catch(()=>{});
  }, []);

  // Calendar helpers
  function getDaysInMonth(y, m) { return new Date(y, m+1, 0).getDate(); }
  function getFirstDay(y, m) { return new Date(y, m, 1).getDay(); }
  function dateKey(y, m, d) { return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }
  function todayKey() { return dateKey(today.getFullYear(), today.getMonth(), today.getDate()); }

  function saveEvents() {
    if (!selectedDay) return;
    const dk = dateKey(calYear, calMonth, selectedDay);
    const valid = addingEvents.filter(e => e.title.trim());
    if (!valid.length) { setSelectedDay(null); return; }
    const updated = { ...(events || {}), [dk]: [...(events?.[dk] || []), ...valid] };
    fbSet("events", updated);
    setAddingEvents([{ title:"", time:"12:00 PM", who:"", notes:"" }]);
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
    updated[idx] = { ...updated[idx], done: !updated[idx].done };
    fbSet("routines", updated);
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
    return "#334155";
  }

  // Kids helpers
  function getKidData(name) { return (kidsData || {})[name] || { points: 0, tasks: [] }; }
  function addKidTask(kidName) {
    const t = (newTask[kidName] || "").trim();
    if (!t) return;
    const kd = getKidData(kidName);
    const updated = { ...(kidsData||{}), [kidName]: { ...kd, tasks: [...(kd.tasks||[]), { text:t, done:false }] }};
    fbSet("kidsData", updated);
    setNewTask({...newTask, [kidName]:""});
  }
  function completeKidTask(kidName, idx) {
    const kd = getKidData(kidName);
    const tasks = [...(kd.tasks||[])];
    tasks[idx] = { ...tasks[idx], done: true };
    const points = (kd.points || 0) + 10;
    const updated = { ...(kidsData||{}), [kidName]: { ...kd, tasks, points }};
    fbSet("kidsData", updated);
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

  // ---- STYLES ----
  const appStyle = {
    minHeight:"100vh", background:"#0f1729", color:"#e2e8f0",
    fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    maxWidth:900, margin:"0 auto", paddingBottom:80
  };

  const cardStyle = {
    background:"#1a2035", borderRadius:12, padding:16, marginBottom:12, border:"1px solid #1e2d4a"
  };

  const btnPrimary = {
    background:"#f59e0b", color:"#0f172a", border:"none", borderRadius:8,
    padding:"8px 16px", fontWeight:700, cursor:"pointer", fontSize:14
  };

  const btnSecondary = {
    background:"#1e2d4a", color:"#e2e8f0", border:"1px solid #334155", borderRadius:8,
    padding:"8px 16px", cursor:"pointer", fontSize:14
  };

  const inputStyle = {
    width:"100%", background:"#1e2235", color:"#e2e8f0", border:"1px solid #334155",
    borderRadius:8, padding:"8px 12px", fontSize:14, boxSizing:"border-box"
  };

  // ---- SCREENS ----
  if (screen === "profiles") {
    return (
      <div style={{ ...appStyle, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh" }}>
        <div style={{ fontSize:32, marginBottom:8 }}>👑</div>
        <div style={{ fontSize:24, fontWeight:800, color:"#f59e0b", marginBottom:4 }}>LUCAC Life</div>
        <div style={{ fontSize:13, color:"#64748b", marginBottom:32 }}>Who's using the app?</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:16, justifyContent:"center", maxWidth:500 }}>
          {(profiles||[]).map(p => (
            <button key={p.id} onClick={() => handleProfileSelect(p)}
              style={{ background:"#1a2035", border:`2px solid ${p.color||"#334155"}`, borderRadius:16, padding:"20px 24px",
                cursor:"pointer", textAlign:"center", minWidth:120, transition:"transform 0.2s" }}
              onMouseOver={e => e.currentTarget.style.transform="scale(1.05)"}
              onMouseOut={e => e.currentTarget.style.transform="scale(1)"}>
              <div style={{ fontSize:40, marginBottom:8 }}>{p.emoji}</div>
              <div style={{ color:p.color||"#e2e8f0", fontWeight:700, fontSize:15 }}>{p.name}</div>
              <div style={{ color:"#64748b", fontSize:11, marginTop:2 }}>{p.type === "admin" ? "🔑 Admin" : p.type === "kid" ? "⭐ Kid" : "👤 Family"}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (screen === "pin") {
    return (
      <div style={{ ...appStyle, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh" }}>
        <div style={{ fontSize:40, marginBottom:12 }}>{pinTarget?.emoji}</div>
        <div style={{ fontSize:20, fontWeight:700, color:"#f59e0b", marginBottom:4 }}>{pinTarget?.name}</div>
        <div style={{ fontSize:13, color:"#64748b", marginBottom:24 }}>Enter your PIN</div>
        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          {[0,1,2,3,4,5].map(i => (
            <div key={i} style={{ width:14, height:14, borderRadius:"50%", background: i < pinInput.length ? "#f59e0b" : "#334155" }} />
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:16 }}>
          {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((n,i) => (
            <button key={i} onClick={() => {
              if (n === "⌫") setPinInput(p => p.slice(0,-1));
              else if (n !== "") setPinInput(p => p.length < 6 ? p + n : p);
            }} style={{ width:64, height:64, borderRadius:12, background:"#1a2035", border:"1px solid #334155",
              color:"#e2e8f0", fontSize:22, cursor: n==="" ? "default" : "pointer", fontWeight:600 }}>
              {n}
            </button>
          ))}
        </div>
        {pinError && <div style={{ color:"#ef4444", marginBottom:12 }}>{pinError}</div>}
        <button onClick={handlePinSubmit} style={{ ...btnPrimary, width:180, padding:"12px" }}>Unlock</button>
        <button onClick={() => { setScreen("profiles"); setPinInput(""); setPinError(""); }}
          style={{ ...btnSecondary, marginTop:8, width:180, padding:"12px" }}>Back</button>
      </div>
    );
  }

  // If kid, only show stars + game
  if (isKid && screen === "app") {
    const kd = getKidData(currentProfile.name);
    return (
      <div style={appStyle}>
        <div style={{ background:"#1a2035", padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:22 }}>{currentProfile.emoji}</span>
            <span style={{ fontWeight:700, color:"#f59e0b" }}>{currentProfile.name}</span>
          </div>
          <button onClick={() => { setCurrentProfile(null); setScreen("profiles"); }} style={{ ...btnSecondary, fontSize:12 }}>Switch</button>
        </div>
        {showGame ? (
          <div style={{ padding:16 }}>
            <button onClick={() => setShowGame(false)} style={{ ...btnSecondary, marginBottom:12 }}>← Back</button>
            <LucacLegends profile={currentProfile} kidsData={kidsData} fbSet={fbSet} />
          </div>
        ) : (
          <div style={{ padding:16 }}>
            <div style={{ ...cardStyle, textAlign:"center" }}>
              <div style={{ fontSize:48 }}>⭐</div>
              <div style={{ fontSize:36, fontWeight:800, color:"#f59e0b" }}>{kd.points || 0}</div>
              <div style={{ color:"#94a3b8" }}>Total Points</div>
            </div>
            {contactDad && (
              <button onClick={() => window.location.href = `tel:${contactDad}`}
                style={{ ...btnPrimary, width:"100%", padding:14, marginBottom:8, fontSize:16 }}>
                📞 Call Dada
              </button>
            )}
            {contactMom && (
              <button onClick={() => window.location.href = `tel:${contactMom}`}
                style={{ background:"#7c3aed", color:"#fff", border:"none", borderRadius:8,
                  padding:14, width:"100%", marginBottom:8, fontSize:16, cursor:"pointer", fontWeight:700 }}>
                📞 Call Mom
              </button>
            )}
            <button onClick={() => setShowGame(true)}
              style={{ background:"#0f766e", color:"#fff", border:"none", borderRadius:8,
                padding:14, width:"100%", marginBottom:12, fontSize:16, cursor:"pointer", fontWeight:700 }}>
              🎮 Play LUCAC Legends
            </button>
            <div style={cardStyle}>
              <div style={{ fontWeight:700, marginBottom:10, color:"#f59e0b" }}>My Tasks</div>
              {(kd.tasks||[]).map((task, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <span style={{ flex:1, color: task.done ? "#64748b" : "#e2e8f0", textDecoration: task.done?"line-through":"none" }}>{task.text}</span>
                  {!task.done && <button onClick={() => completeKidTask(currentProfile.name, i)} style={{ ...btnPrimary, padding:"4px 10px", fontSize:12 }}>✓ +10pts</button>}
                  {task.done && <span style={{ color:"#22c55e", fontSize:12 }}>✓ Done!</span>}
                </div>
              ))}
              {!(kd.tasks||[]).length && <div style={{ color:"#64748b", fontSize:13 }}>No tasks yet!</div>}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main app tabs
  const tabs = [
    { id:"home", label:"Home", icon:"🏠" },
    { id:"food", label:"Food", icon:"🍽️" },
    { id:"kids", label:"Kids", icon:"⭐" },
    { id:"family", label:"Family", icon:"🤝" },
    { id:"settings", label:"Settings", icon:"⚙️" },
  ];

  // ---- HOME TAB ----
  function renderHome() {
    const daysInMonth = getDaysInMonth(calYear, calMonth);
    const firstDay = getFirstDay(calYear, calMonth);
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    const isToday = (d) => d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
    const dk = selectedDay ? dateKey(calYear, calMonth, selectedDay) : null;

    return (
      <div style={{ padding:12 }}>
        {/* Quote */}
        <div style={{ background:"#1a2035", borderRadius:10, padding:"10px 14px", marginBottom:12,
          border:"1px solid #1e3a5f", fontSize:13, color:"#94a3b8", fontStyle:"italic" }}>
          ✦ {quote}
        </div>

        {/* ═══ CALENDAR ═══ */}
        <div style={{
          background: V.bgCard, borderRadius: V.r3, border: `1px solid ${V.borderDefault}`,
          boxShadow: V.shadowCard, overflow: "hidden", marginBottom: V.sp3
        }}>
          {/* Month header */}
          <div style={{
            background: V.calBgHeader, padding: `${V.sp4}px ${V.sp5}px`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: `1px solid ${V.borderDefault}`
          }}>
            <button onClick={() => { if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1); }}
              style={{ width: 40, height: 40, borderRadius: V.r2, background: V.bgElevated,
                border: `1px solid ${V.borderSubtle}`, color: V.textSecondary, fontSize: 20,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s" }}
              aria-label="Previous month">
              ‹
            </button>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontWeight: 800, color: V.accent, fontSize: 22, letterSpacing: 0.5, lineHeight: 1.2 }}>
                {MONTHS[calMonth]}
              </div>
              <div style={{ fontSize: 13, color: V.textDim, fontWeight: 500, marginTop: 2 }}>{calYear}</div>
              <button onClick={() => { setCalMonth(today.getMonth()); setCalYear(today.getFullYear()); }}
                style={{ background: V.accentGlow, border: `1px solid ${V.accent}33`,
                  color: V.accent, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  borderRadius: 20, padding: "3px 14px", marginTop: 6, transition: "background 0.15s" }}>
                Today
              </button>
            </div>
            <button onClick={() => { if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1); }}
              style={{ width: 40, height: 40, borderRadius: V.r2, background: V.bgElevated,
                border: `1px solid ${V.borderSubtle}`, color: V.textSecondary, fontSize: 20,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s" }}
              aria-label="Next month">
              ›
            </button>
          </div>

          {/* Weekday headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)",
            background: V.calBgWeekday, borderBottom: `1px solid ${V.borderDefault}` }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 700,
                color: (d === "Sun" || d === "Sat") ? V.accent + "99" : V.textDim,
                padding: `${V.sp2}px 0`, letterSpacing: 0.5, textTransform: "uppercase" }}>{d}</div>
            ))}
          </div>

          {/* Day cells grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1,
            background: V.borderDefault, padding: 1 }}>
            {cells.map((d, i) => {
              if (!d) return <div key={i} style={{ background: V.bgApp, minHeight: 85 }} />;
              const dk2 = dateKey(calYear, calMonth, d);
              const dayEvents = (events||{})[dk2] || [];
              const isTodayCell = isToday(d);
              const selected = selectedDay === d;
              const isWeekend = (i % 7 === 0) || (i % 7 === 6);
              return (
                <div key={i}
                  onClick={() => { setSelectedDay(d); setAddingEvents([{ title:"", time:"12:00 PM", who:"", notes:"" }]); }}
                  style={{
                    minHeight: 85, padding: V.sp1 + 2, cursor: "pointer",
                    background: selected ? V.calBgSelected
                      : isTodayCell ? V.calBgToday
                      : isWeekend ? V.bgApp
                      : V.calBgCell,
                    position: "relative",
                    transition: "background 0.15s, box-shadow 0.15s",
                    boxShadow: isTodayCell ? `inset 0 0 0 2px ${V.accent}` : selected ? `inset 0 0 0 2px ${V.info}` : "none",
                    display: "flex", flexDirection: "column"
                  }}>
                  {/* Day number */}
                  <div style={{
                    fontSize: isTodayCell ? 15 : 13,
                    fontWeight: isTodayCell ? 800 : 500,
                    color: isTodayCell ? V.bgApp : selected ? V.textPrimary : V.textMuted,
                    marginBottom: V.sp1,
                    display: "flex", alignItems: "center", gap: 4
                  }}>
                    {isTodayCell ? (
                      <span style={{
                        background: V.accent, color: V.bgApp,
                        borderRadius: "50%", width: 26, height: 26,
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 800, fontSize: 13, boxShadow: `0 0 8px ${V.accentGlowStrong}`
                      }}>{d}</span>
                    ) : (
                      <span>{d}</span>
                    )}
                  </div>
                  {/* Event pills */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, overflow: "hidden" }}>
                    {dayEvents.slice(0,3).map((ev, idx) => {
                      const s = getEventStyle(dk2, idx);
                      const pColor = ev.who ? getPersonColor(ev.who) : V.info;
                      const initials = ev.who ? ev.who.slice(0,2) : "";
                      return (
                        <div key={idx} style={{
                          background: `${s?.bg || pColor}22`,
                          borderLeft: `3px solid ${s?.bg || pColor}`,
                          color: s?.color || V.textPrimary,
                          fontSize: 10, fontWeight: 600,
                          borderRadius: V.r1, padding: "2px 5px",
                          overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                          lineHeight: 1.4,
                          fontStyle: s?.italic ? "italic" : "normal",
                          fontFamily: s?.cursive ? "cursive" : "inherit",
                        }}>
                          {initials ? <span style={{ fontWeight:700, marginRight:3, opacity:0.7 }}>{initials}</span> : null}
                          {ev.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div style={{ fontSize: 9, color: V.textDim, fontWeight: 600, padding: "0 2px" }}>
                        +{dayEvents.length-3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ DAY DETAIL POPUP ═══ */}
        {selectedDay && (
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
              {/* Popup header */}
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

              {/* Existing events */}
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
                      return (
                        <div key={idx} style={{
                          background: V.bgCardAlt, borderRadius: V.r2,
                          padding: `${V.sp3}px ${V.sp4}px`, marginBottom: V.sp2,
                          borderLeft: `4px solid ${s?.bg || pColor}`,
                          transition: "background 0.15s"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{
                              color: s?.color || V.textPrimary, fontSize: s?.size || 15, fontWeight: s?.bold ? 700 : 600,
                              fontStyle: s?.italic ? "italic" : "normal", fontFamily: s?.cursive ? "cursive" : "inherit"
                            }}>
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
                            {ev.who && (
                              <span style={{
                                fontSize: 11, color: pColor, background: `${pColor}22`,
                                padding: "2px 8px", borderRadius: 20, fontWeight: 600
                              }}>
                                {ev.who}
                              </span>
                            )}
                          </div>
                          {ev.notes && <div style={{ fontSize: 12, color: V.textMuted, marginTop: V.sp2, lineHeight: 1.4 }}>{ev.notes}</div>}
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

                {/* Add new events */}
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
                      }} style={inputStyle} />
                    </div>
                  ))}
                  <button onClick={() => setAddingEvents(a => [...a, { title:"", time:"12:00 PM", who:"", notes:"" }])}
                    style={{ ...btnSecondary, width: "100%", marginBottom: V.sp2, fontSize: 13 }}>+ Add Another Event</button>
                  <button onClick={saveEvents} style={{ ...btnPrimary, width: "100%" }}>
                    Save {addingEvents.filter(e=>e.title.trim()).length > 1 ? `${addingEvents.filter(e=>e.title.trim()).length} Events` : "Event"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Routines + Goals */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {/* Routines */}
          <div style={{ ...cardStyle, margin:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={{ fontWeight:700, color:"#22c55e", fontSize:14 }}>✅ Routines</div>
            </div>
            {(routines||[]).map((r, i) => {
              const s = routineStyles?.[i] || {};
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6,
                  background: s.bg || "transparent", borderRadius:6, padding: s.bg ? "4px 6px" : "0" }}>
                  <div onClick={() => toggleRoutine(i)} style={{ width:18, height:18, borderRadius:4,
                    background: r.done ? "#22c55e" : "#334155", cursor:"pointer", flexShrink:0,
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {r.done && <span style={{ color:"#fff", fontSize:11 }}>✓</span>}
                  </div>
                  <span style={{ flex:1, fontSize: s.size||13, color: s.color||(r.done?"#64748b":"#e2e8f0"),
                    textDecoration: r.done?"line-through":"none", fontWeight: s.bold?700:400,
                    fontStyle: s.italic?"italic":"normal", fontFamily: s.cursive?"cursive":"inherit" }}>
                    {r.text}
                  </span>
                  <button onClick={() => setEditingRoutineStyle(i)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:13 }}>🎨</button>
                  <button onClick={() => deleteRoutine(i)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color:"#ef4444" }}>✕</button>
                </div>
              );
            })}
            <div style={{ display:"flex", gap:4, marginTop:4 }}>
              <input value={newRoutine} onChange={e=>setNewRoutine(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addRoutine()}
                placeholder="Add routine..." style={{ ...inputStyle, flex:1, padding:"6px 10px", fontSize:12 }} />
              <button onClick={addRoutine} style={{ ...btnPrimary, padding:"6px 10px" }}>+</button>
            </div>
          </div>

          {/* Goals */}
          <div style={{ ...cardStyle, margin:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={{ fontWeight:700, color:"#ec4899", fontSize:14 }}>🎯 Goals</div>
            </div>
            {(goals||[]).map((g, i) => {
              const s = goalStyles?.[i] || {};
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6,
                  background: s.bg || "transparent", borderRadius:6, padding: s.bg ? "4px 6px" : "0" }}>
                  <div onClick={() => toggleGoal(i)} style={{ width:18, height:18, borderRadius:4,
                    background: g.done ? "#ec4899" : "#334155", cursor:"pointer", flexShrink:0,
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {g.done && <span style={{ color:"#fff", fontSize:11 }}>✓</span>}
                  </div>
                  <span style={{ flex:1, fontSize: s.size||13, color: s.color||(g.done?"#64748b":"#e2e8f0"),
                    textDecoration: g.done?"line-through":"none", fontWeight: s.bold?700:400,
                    fontStyle: s.italic?"italic":"normal", fontFamily: s.cursive?"cursive":"inherit" }}>
                    {g.text}
                  </span>
                  <button onClick={() => setEditingGoalStyle(i)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:13 }}>🎨</button>
                  <button onClick={() => deleteGoal(i)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color:"#ef4444" }}>✕</button>
                </div>
              );
            })}
            <div style={{ display:"flex", gap:4, marginTop:4 }}>
              <input value={newGoal} onChange={e=>setNewGoal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addGoal()}
                placeholder="Add goal..." style={{ ...inputStyle, flex:1, padding:"6px 10px", fontSize:12 }} />
              <button onClick={addGoal} style={{ ...btnPrimary, padding:"6px 10px" }}>+</button>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginTop:12 }}>
          {[
            { icon:"🔥", label:"Calories", val: todayCalories },
            { icon:"✅", label:"Routines", val:`${(routines||[]).filter(r=>r.done).length}/${(routines||[]).length}` },
            { icon:"🎯", label:"Goals", val:`${(goals||[]).filter(g=>g.done).length}/${(goals||[]).length}` },
          ].map(s => (
            <div key={s.label} style={{ background:"#1a2035", borderRadius:10, padding:"10px 8px", textAlign:"center", border:"1px solid #1e2d4a" }}>
              <div style={{ fontSize:22 }}>{s.icon}</div>
              <div style={{ fontSize:18, fontWeight:800, color:"#f59e0b" }}>{s.val}</div>
              <div style={{ fontSize:11, color:"#64748b" }}>{s.label}</div>
            </div>
          ))}
        </div>

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

  // ---- FOOD TAB ----
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
                <div style={{ fontSize:13, color:"#e2e8f0", lineHeight:1.6, whiteSpace:"pre-wrap" }}>{chefResult}</div>
              </div>
            )}
            <div style={cardStyle}>
              <div style={{ fontWeight:700, color:"#94a3b8", marginBottom:8, fontSize:13 }}>🔍 Look up any food</div>
              <div style={{ display:"flex", gap:8 }}>
                <input value={foodSearch} onChange={e=>setFoodSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&lookupFood()}
                  placeholder="e.g. 3 slices muenster cheese" style={{ ...inputStyle, flex:1 }} />
                <button onClick={lookupFood} style={{ ...btnPrimary }} disabled={foodLoading}>
                  {foodLoading ? "..." : "Go"}
                </button>
              </div>
              {foodResult && (
                <div style={{ background:"#161e30", borderRadius:8, padding:12, marginTop:10 }}>
                  <div style={{ fontWeight:700, color:"#f8fafc", marginBottom:6 }}>{foodResult.name}</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
                    {Object.entries(foodResult).filter(([k])=>k!=="name").map(([k,v]) => (
                      <div key={k} style={{ textAlign:"center" }}>
                        <div style={{ fontSize:16, fontWeight:700, color:"#f59e0b" }}>{v}g</div>
                        <div style={{ fontSize:11, color:"#64748b" }}>{k}</div>
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
              <div style={{ fontSize:12, color:"#64748b", marginBottom:10 }}>Set your own daily targets — different for each profile</div>
              {["calories","protein","carbs","fat","fiber","sugar"].map(m => (
                <div key={m} style={{ marginBottom:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                    <span style={{ fontSize:13, color:"#e2e8f0" }}>{m.charAt(0).toUpperCase()+m.slice(1)}</span>
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
                <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #1e2d4a", fontSize:13 }}>
                  <span style={{ color:"#e2e8f0" }}>{f.name}</span>
                  <span style={{ color:"#f59e0b" }}>{f.calories} cal</span>
                </div>
              ))}
              {!(foodLog||[]).filter(f=>f.date===todayStr&&f.profile===currentProfile?.name).length &&
                <div style={{ color:"#64748b", fontSize:13 }}>Nothing logged today</div>}
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
                <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>{f.calories} cal · {f.protein}g protein · {f.carbs}g carbs</div>
              </div>
            ))}
            {!(myFoods||[]).length && <div style={{ ...cardStyle, color:"#64748b", textAlign:"center" }}>No saved foods yet. Look up a food and save it!</div>}
          </div>
        )}

        {foodSubTab === "manual" && (
          <div style={cardStyle}>
            <div style={{ fontWeight:700, color:"#f59e0b", marginBottom:10 }}>✏️ Manual Entry</div>
            {["name","calories","protein","carbs","fat"].map(field => (
              <div key={field} style={{ marginBottom:8 }}>
                <div style={{ fontSize:12, color:"#94a3b8", marginBottom:3 }}>{field.charAt(0).toUpperCase()+field.slice(1)}{field!=="name"?" (g/kcal)":""}</div>
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
                    <div style={{ fontSize:12, color:"#64748b" }}>⭐ {kd.points || 0} points</div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  {contactDad && <button onClick={()=>window.location.href=`tel:${contactDad}`} style={{...btnPrimary,padding:"4px 8px",fontSize:12}}>📞 Dada</button>}
                  {contactMom && <button onClick={()=>window.location.href=`tel:${contactMom}`} style={{background:"#7c3aed",color:"#fff",border:"none",borderRadius:6,padding:"4px 8px",fontSize:12,cursor:"pointer",fontWeight:700}}>📞 Mom</button>}
                </div>
              </div>
              {(kd.tasks||[]).map((task,i) => (
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <div onClick={()=>!task.done&&completeKidTask(kid.name,i)} style={{width:20,height:20,borderRadius:4,
                    background:task.done?"#22c55e":"#334155",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {task.done&&<span style={{color:"#fff",fontSize:12}}>✓</span>}
                  </div>
                  <span style={{flex:1,color:task.done?"#64748b":"#e2e8f0",textDecoration:task.done?"line-through":"none",fontSize:13}}>{task.text}</span>
                  {task.done&&<span style={{color:"#22c55e",fontSize:11}}>+10pts</span>}
                </div>
              ))}
              {isAdmin && (
                <div style={{display:"flex",gap:6,marginTop:6}}>
                  <input value={newTask[kid.name]||""} onChange={e=>setNewTask({...newTask,[kid.name]:e.target.value})}
                    onKeyDown={e=>e.key==="Enter"&&addKidTask(kid.name)}
                    placeholder="Add task..." style={{...inputStyle,flex:1,padding:"6px 10px",fontSize:12}} />
                  <button onClick={()=>addKidTask(kid.name)} style={{...btnPrimary,padding:"6px 10px"}}>+</button>
                </div>
              )}
            </div>
          );
        })}
        {!kidProfiles.length && <div style={{...cardStyle,color:"#64748b",textAlign:"center"}}>Add kids in Settings → Profiles</div>}
      </div>
    );
  }

  // ---- FAMILY TAB ----
  function renderFamily() {
    return (
      <div style={{padding:12}}>
        <div style={{display:"flex",gap:8,marginBottom:12,overflowX:"auto"}}>
          {["schedule","myrules","theirrules","shared","log"].map(t=>(
            <button key={t} onClick={()=>setFamilySubTab(t)}
              style={{...familySubTab===t?btnPrimary:btnSecondary,whiteSpace:"nowrap",padding:"6px 12px",fontSize:12}}>
              {t==="schedule"?"📅 Schedule":t==="myrules"?"👑 My Rules":t==="theirrules"?"💜 Their Rules":t==="shared"?"🤝 Shared":"📋 Log"}
            </button>
          ))}
        </div>

        {familySubTab === "schedule" && (
          <div style={cardStyle}>
            <div style={{fontWeight:700,color:"#f59e0b",marginBottom:10}}>📅 Weekly Custody Schedule</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:12}}>{isAdmin?"Tap a day to change":"View only"}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6}}>
              {custodyDayNames.map(day=>{
                const val=(custodySchedule||{})[day]||"Free";
                return(
                  <div key={day} onClick={()=>cycleCustody(day)}
                    style={{textAlign:"center",padding:"10px 4px",borderRadius:8,cursor:isAdmin?"pointer":"default",
                      background:custodyColor(val),border:`1px solid ${custodyColor(val)}`}}>
                    <div style={{fontSize:11,color:"#94a3b8",marginBottom:4}}>{day}</div>
                    <div style={{fontSize:12,fontWeight:700,color:val==="Free"?"#64748b":"#f8fafc"}}>{val}</div>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:12,height:12,borderRadius:3,background:"#f59e0b"}}/><span style={{fontSize:12,color:"#94a3b8"}}>Dad</span></div>
              <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:12,height:12,borderRadius:3,background:"#a855f7"}}/><span style={{fontSize:12,color:"#94a3b8"}}>Mom</span></div>
              <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:12,height:12,borderRadius:3,background:"#334155"}}/><span style={{fontSize:12,color:"#94a3b8"}}>Free</span></div>
            </div>
          </div>
        )}

        {familySubTab === "myrules" && (
          <div>
            <div style={cardStyle}>
              <div style={{fontWeight:700,color:"#f59e0b",marginBottom:10}}>👑 My House Rules</div>
              {(myRules||[]).map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #1e2d4a",fontSize:13}}>
                  <span style={{color:"#e2e8f0"}}>• {r}</span>
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
              <div key={i} style={{padding:"8px 0",borderBottom:"1px solid #1e2d4a",fontSize:13,color:"#e2e8f0"}}>• {r}</div>
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
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #1e2d4a",fontSize:13}}>
                <span style={{color:"#e2e8f0"}}>✓ {typeof r==="string"?r:r.text}</span>
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
              <div style={{fontSize:12,color:"#64748b",marginBottom:10}}>Track pickup/dropoff times. Only visible to you.</div>
              {!exchangeStart ? (
                <button onClick={startExchange} style={{...btnPrimary,width:"100%",padding:12}}>▶ Start Exchange Timer</button>
              ) : (
                <div>
                  <div style={{textAlign:"center",fontSize:32,fontWeight:800,color:"#f59e0b",marginBottom:8}}>
                    {Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,"0")}
                  </div>
                  <div style={{fontSize:12,color:"#64748b",textAlign:"center",marginBottom:10}}>Waiting since {exchangeStart.toLocaleTimeString()}</div>
                  <input value={exchangeNote} onChange={e=>setExchangeNote(e.target.value)}
                    placeholder="Notes (optional)" style={{...inputStyle,marginBottom:8}} />
                  <button onClick={()=>logArrival(exchangeNote)} style={{...btnPrimary,width:"100%",padding:12}}>✓ They Arrived</button>
                </div>
              )}
            </div>
            {(exchangeLog||[]).slice().reverse().slice(0,10).map((entry,i)=>(
              <div key={i} style={{...cardStyle,borderLeft:`3px solid ${entry.waitMinutes>15?"#ef4444":"#22c55e"}`}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontWeight:600,color:"#e2e8f0",fontSize:13}}>{entry.date} {entry.time}</span>
                  <span style={{color:entry.waitMinutes>15?"#ef4444":"#22c55e",fontWeight:700,fontSize:13}}>{entry.waitMinutes} min wait</span>
                </div>
                {entry.notes&&<div style={{fontSize:12,color:"#94a3b8",marginTop:4}}>{entry.notes}</div>}
              </div>
            ))}
          </div>
        )}
        {familySubTab === "log" && !isAdmin && (
          <div style={{...cardStyle,color:"#64748b",textAlign:"center"}}>Exchange log is admin only.</div>
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
          {["profiles","theme","contacts","alerts"].map(t=>(
            <button key={t} onClick={()=>setSettingsSubTab(t)}
              style={{...settingsSubTab===t?btnPrimary:btnSecondary,padding:"6px 12px",fontSize:12}}>
              {t==="profiles"?"👤 Profiles":t==="theme"?"🎨 Theme":t==="contacts"?"📞 Contacts":"🔔 Alerts"}
            </button>
          ))}
        </div>

        {settingsSubTab === "profiles" && (
          <div>
            {isAdmin && (
              <div style={cardStyle}>
                <div style={{fontWeight:700,color:"#f59e0b",marginBottom:10}}>My Profile</div>
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:12,color:"#94a3b8",marginBottom:3}}>Name</div>
                  <div style={{display:"flex",gap:6}}>
                    <input value={profileNameEdit||currentProfile?.name} onChange={e=>setProfileNameEdit(e.target.value)}
                      style={{...inputStyle,flex:1}} />
                    <button onClick={()=>{
                      const updated=(profiles||[]).map(p=>p.id===currentProfile?.id?{...p,name:profileNameEdit||p.name}:p);
                      fbSet("profiles",updated);setCurrentProfile(p=>({...p,name:profileNameEdit||p.name}));showSave("Name saved!");
                    }} style={{...btnPrimary,padding:"8px 12px",fontSize:12}}>Save</button>
                  </div>
                </div>
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:12,color:"#94a3b8",marginBottom:3}}>PIN (4-6 digits)</div>
                  <div style={{display:"flex",gap:6}}>
                    <input type="password" value={pinEdit} onChange={e=>setPinEdit(e.target.value)}
                      placeholder="New PIN" maxLength={6} style={{...inputStyle,flex:1}} />
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
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px solid #1e2d4a"}}>
                  <span style={{fontSize:22}}>{p.emoji}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,color:p.color||"#e2e8f0",fontSize:14}}>{p.name}</div>
                    <div style={{fontSize:11,color:"#64748b"}}>{p.type}</div>
                  </div>
                  <input type="color" value={p.color||"#f59e0b"} onChange={e=>{
                    const updated=(profiles||[]).map(pp=>pp.id===p.id?{...pp,color:e.target.value}:pp);
                    fbSet("profiles",updated);
                  }} style={{width:28,height:28,border:"none",borderRadius:4,cursor:"pointer",background:"none"}} />
                </div>
              ))}
              {isAdmin && (
                <div style={{marginTop:10}}>
                  <div style={{fontSize:12,color:"#94a3b8",marginBottom:6}}>Add Family Member</div>
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

        {settingsSubTab === "contacts" && (
          <div style={cardStyle}>
            <div style={{fontWeight:700,color:"#f59e0b",marginBottom:10}}>📞 Call Button Numbers</div>
            <div style={{marginBottom:8}}>
              <div style={{fontSize:12,color:"#94a3b8",marginBottom:3}}>Dada's Number</div>
              <input value={contactDad} onChange={e=>setContactDad(e.target.value)} placeholder="555-000-0000" style={{...inputStyle}} />
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:"#94a3b8",marginBottom:3}}>Mom's Number</div>
              <input value={contactMom} onChange={e=>setContactMom(e.target.value)} placeholder="555-000-0000" style={{...inputStyle}} />
            </div>
            <button onClick={()=>{fbSet("contacts",{dad:contactDad,mom:contactMom});showSave("Contacts saved!");}}
              style={{...btnPrimary,width:"100%"}}>💾 Save Contacts</button>
          </div>
        )}

        {settingsSubTab === "alerts" && (
          <div style={cardStyle}>
            <div style={{fontWeight:700,color:"#f59e0b",marginBottom:10}}>🔔 Event Reminders</div>
            <div style={{fontSize:13,color:"#94a3b8",marginBottom:12}}>How many minutes before an event to get reminded?</div>
            <div style={{textAlign:"center",fontSize:36,fontWeight:800,color:"#f59e0b",marginBottom:6}}>{alertMinutes} min</div>
            <input type="range" min={1} max={120} value={alertMinutes} onChange={e=>setAlertMinutes(Number(e.target.value))}
              style={{width:"100%",accentColor:"#f59e0b",marginBottom:12}} />
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#64748b",marginBottom:12}}>
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
      <div style={{background:"#1a2035",padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #1e2d4a"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>👑</span>
          <span style={{fontWeight:800,color:"#f59e0b",fontSize:16,letterSpacing:1}}>LUCAC</span>
          <span style={{fontSize:11,color:"#22c55e",background:"#0d2818",padding:"2px 6px",borderRadius:10}}>✦ Live</span>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontWeight:700,color:"#e2e8f0",fontSize:14}}>{new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
          <div style={{fontSize:11,color:"#64748b"}}>{new Date().toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"})}</div>
        </div>
      </div>

      {/* Tab content */}
      <div>
        {tab === "home" && renderHome()}
        {tab === "food" && renderFood()}
        {tab === "kids" && renderKids()}
        {tab === "family" && renderFamily()}
        {tab === "settings" && renderSettings()}
      </div>

      {/* Bottom nav */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:900,
        background:"#1a2035",borderTop:"1px solid #1e2d4a",display:"flex",justifyContent:"space-around",padding:"8px 0",zIndex:100}}>
        {tabs.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",cursor:"pointer",
            display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"4px 8px",
            opacity: tab===t.id ? 1 : 0.5}}>
            <span style={{fontSize:20}}>{t.icon}</span>
            <span style={{fontSize:10,color:tab===t.id?"#f59e0b":"#64748b",fontWeight:tab===t.id?700:400}}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Floating AI */}
      <button onClick={()=>setAiOpen(!aiOpen)} style={{position:"fixed",bottom:70,right:16,width:50,height:50,borderRadius:"50%",
        background:"#f59e0b",border:"none",cursor:"pointer",fontSize:22,boxShadow:"0 4px 12px rgba(245,158,11,0.4)",zIndex:200}}>
        🤖
      </button>
      {aiOpen && (
        <div style={{position:"fixed",bottom:130,right:16,width:320,height:400,background:"#1a2035",borderRadius:16,
          border:"1px solid #334155",display:"flex",flexDirection:"column",boxShadow:"0 8px 32px rgba(0,0,0,0.5)",zIndex:200}}>
          <div style={{padding:"12px 16px",borderBottom:"1px solid #334155",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontWeight:700,color:"#f59e0b",fontSize:14}}>🤖 Ask the App</span>
            <button onClick={()=>setAiOpen(false)} style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:18}}>✕</button>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:12,display:"flex",flexDirection:"column",gap:8}}>
            {aiMessages.map((m,i) => (
              <div key={i} style={{background:m.role==="user"?"#1e3a5f":"#1e2235",borderRadius:10,padding:"8px 12px",
                alignSelf:m.role==="user"?"flex-end":"flex-start",maxWidth:"85%",fontSize:13,color:"#e2e8f0",lineHeight:1.5}}>
                {m.content}
              </div>
            ))}
            {aiLoading && <div style={{background:"#1e2235",borderRadius:10,padding:"8px 12px",fontSize:13,color:"#64748b"}}>thinking...</div>}
            {!aiMessages.length && <div style={{color:"#64748b",fontSize:12,textAlign:"center",marginTop:20}}>Ask me anything! Weather, recipes, advice...</div>}
          </div>
          <div style={{padding:8,borderTop:"1px solid #334155",display:"flex",gap:6}}>
            <input value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendAI()}
              placeholder="Ask anything..." style={{...inputStyle,flex:1,padding:"6px 10px",fontSize:13}} />
            <button onClick={sendAI} style={{...btnPrimary,padding:"6px 10px"}} disabled={aiLoading}>→</button>
          </div>
        </div>
      )}
    </div>
  );
}
