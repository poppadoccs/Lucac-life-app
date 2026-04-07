import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, update, runTransaction } from "firebase/database";
import * as Sentry from "@sentry/react";
import LucacLegends from "./LucacLegends";
import { groqFetch, parseGroqJSON, cacheGet, cacheSet, SWATCH_COLORS, triggerConfetti, createSpeechRecognition, canWrite } from "./utils";
import { DAYS, MONTHS, dateKey, parseTime } from "./shared";
import { getWidgetPref as _getWidgetPref, setWidgetPref as _setWidgetPref } from "./WidgetSystem";
import FoodTab from "./FoodTab";
import BudgetTab from "./BudgetTab";
import HomeworkHelper from "./HomeworkHelper";
import GroqAssistant from "./GroqAssistant";
import SettingsTab from "./SettingsTab";
import HomeTab from "./HomeTab";
import KidsTab from "./KidsTab";
import FamilyTab from "./FamilyTab";
import { runAgentLoop, getActionPreviewLabel, testGroqConnection } from "./aiAgent";

// ═══ SENTRY ERROR MONITORING ═══
Sentry.init({
  dsn: "https://a455b66904781b4971757005dabead83@o4511050464690176.ingest.us.sentry.io/4511050481467392",
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.3,
  environment: window.location.hostname === "localhost" ? "development" : "production",
  enabled: window.location.hostname !== "localhost",
});

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
if (typeof window !== 'undefined') console.log('[App] GROQ_KEY present:', !!GROQ_KEY, 'length:', GROQ_KEY?.length);

// DAYS, MONTHS imported from shared.js

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


// formatTime, parseTime, TimePicker, SwatchPicker, BlockStyleEditor moved to HomeTab.jsx

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
  const [eventPrivate, setEventPrivate] = useState(false); // Private event toggle (admin only)

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
  const [custodyPattern, setCustodyPattern] = useState(null); // {pattern: ["D","D","M","M",...], startDate: "2026-01-05", preset: "2-2-5-5"}
  const [custodyOverrides, setCustodyOverrides] = useState({}); // {"2026-03-20": "Mom"}
  const [myRules, setMyRules] = useState([]);
  const [theirRules, setTheirRules] = useState([]);
  const [sharedRules, setSharedRules] = useState([]);
  const [ruleProposals, setRuleProposals] = useState([]); // [{id, text, proposedBy, status, rewriteText, timestamp}]
  // Family editing state moved to FamilyTab.jsx
  const [exchangeLog, setExchangeLog] = useState([]);
  // exchangeTimer/exchangeStart moved to FamilyTab.jsx
  // familySubTab moved to FamilyTab.jsx
  // Home widget state
  const [calendarSize, setCalendarSize] = useState("default"); // compact, default, expanded
  const [calendarSticky, setCalendarSticky] = useState(false);
  const [birthdayExpanded, setBirthdayExpanded] = useState(false);
  const [spotlightResponse, setSpotlightResponse] = useState("");
  const [spotlightInput, setSpotlightInput] = useState("");
  const [spotlightLoading, setSpotlightLoading] = useState(false);
  const [shoppingInput, setShoppingInput] = useState("");
  // Custody custom editor state moved to FamilyTab.jsx
  // Chores
  const [chores, setChores] = useState([]);
  const [newChoreName, setNewChoreName] = useState("");
  const [newChoreEmoji, setNewChoreEmoji] = useState("🧹");
  const [newChoreKid, setNewChoreKid] = useState("");
  const [newChoreStars, setNewChoreStars] = useState(5);

  // Settings state moved to SettingsTab.jsx
  const [contactDad, setContactDad] = useState("");
  const [contactMom, setContactMom] = useState("");
  const [alertMinutes, setAlertMinutes] = useState(15);
  // saveFeedback moved to SettingsTab.jsx

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
  const [agentActions, setAgentActions] = useState([]); // pending write actions from AI agent
  const [agentResponse, setAgentResponse] = useState(""); // text response from agent
  const [agentClarification, setAgentClarification] = useState(null); // {question, options}
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

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
  // showPin moved to SettingsTab.jsx
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
  const isParent = currentProfile?.type === "parent" || currentProfile?.type === "family";
  const currentRole = isAdmin ? "admin" : isKid ? "kid" : isParent ? "parent" : "guest";

  // ═══ ROLE-BASED EVENT FILTERING ═══
  // Filters events based on current user's role:
  //   admin  → sees everything
  //   parent → sees non-private events + own events
  //   kid    → sees non-private events (read-only)
  //   guest  → sees non-private events (read-only)
  function filterEventsForRole(eventsObj, profile) {
    if (!eventsObj || !profile) return {};
    const role = profile.type === "admin" ? "admin"
      : (profile.type === "parent" || profile.type === "family") ? "parent"
      : profile.type === "kid" ? "kid" : "guest";
    if (role === "admin") return eventsObj;
    const filtered = {};
    Object.entries(eventsObj).forEach(([dk, dayEvs]) => {
      const visible = (Array.isArray(dayEvs) ? dayEvs : []).filter(ev => {
        // SEC-02: isPrivate field (D-14) with backward-compatible fallback to ev.private
        // D-16: missing creator defaults to "admin", missing isPrivate defaults to false
        const isPrivateEvent = ev.isPrivate ?? ev.private ?? false;
        if (isPrivateEvent) {
          const eventCreator = ev.creator ?? "admin";
          return eventCreator === profile.name;
        }
        return true;
      });
      if (visible.length > 0) filtered[dk] = visible;
    });
    return filtered;
  }

  // Firebase sync with localStorage cache fallback
  const FB_KEYS = ["events","eventStyles","routines","routineStyles","goals","goalStyles",
    "profiles","kidsData","custodySchedule","myRules","theirRules","sharedRules",
    "exchangeLog","foodLog","myFoods","nutritionGoals","trackedMacros","contacts","alertMinutes","themeName","widgetPrefs",
    "budgetData","shoppingList","weightLog","homeworkSessions","callButtons","quoteMode","customQuotePrompt","jrHistory","themeOverrides",
    "custodyPattern","custodyOverrides","ruleProposals","spotlightResponse","calendarSize","chores"];

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
    custodyPattern: v => setCustodyPattern(v || null),
    custodyOverrides: v => setCustodyOverrides(v || {}),
    ruleProposals: v => setRuleProposals(v || []),
    spotlightResponse: v => setSpotlightResponse(v || ""),
    calendarSize: v => setCalendarSize(v || "default"),
    chores: v => setChores(v || []),
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
    // SEC-01: Role-based write guard — blocks non-admins from sensitive paths
    if (!canWrite(currentProfile, key)) {
      showToast("You don't have permission to do that.", "error");
      return;
    }
    set(ref(db, key), val).catch(() => {
      // If Firebase write fails (offline), cache locally — Firebase RTDB will sync when back online
      cacheSet(key, val);
    });
  }

  // showSave moved to SettingsTab.jsx

  // ═══ EVENT ALERT NOTIFICATIONS ═══
  useEffect(() => {
    if (!events || typeof Notification === "undefined") return;
    // Request permission on first load
    if (Notification.permission === "default") Notification.requestPermission();
    const checkAlerts = () => {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const todayDk = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEvs = (events || {})[todayDk] || [];
      todayEvs.forEach(ev => {
        if (!ev.alert || ev.alert === "none") return;
        const alertMin = parseInt(ev.alert) || 0;
        const p = parseTime(ev.time);
        let evMin = (p.ampm === "PM" && p.h !== 12 ? p.h + 12 : p.ampm === "AM" && p.h === 12 ? 0 : p.h) * 60 + p.m;
        const triggerMin = evMin - alertMin;
        if (nowMin === triggerMin) {
          const msg = alertMin === 0 ? `${ev.title} is starting now!` : `${ev.title} in ${alertMin} minutes`;
          if (Notification.permission === "granted") {
            new Notification("LUCAC Life", { body: msg, icon: "/favicon.svg" });
          } else {
            showToast(`🔔 ${msg}`, "info", 5000);
          }
        }
      });
    };
    const interval = setInterval(checkAlerts, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [events]);

  // ═══ QUICK ADD — ROTATING PLACEHOLDER ═══
  const QUICK_ADD_HINTS = [
    "Try: 'add soccer Tuesday 4pm for Luca'",
    "Try: 'how much did I spend this week?'",
    "Try: 'add milk to shopping list'",
    "Try: 'what's on the schedule tomorrow?'",
    "Try: 'rewrite this nicely: you were late again'",
    "Try: 'give me today's family briefing'",
  ];
  useEffect(() => {
    const iv = setInterval(() => setPlaceholderIdx(i => (i + 1) % QUICK_ADD_HINTS.length), 5000);
    return () => clearInterval(iv);
  }, []);

  // ═══ APP STATE BUILDER (for AI agent) ═══
  function buildAppState() {
    return {
      userName: currentProfile?.name || 'User',
      userRole: currentProfile?.type || 'guest',
      familyMembers: (profiles || []).map(p => p.name),
      getEventsInRange: (start, end, person) => {
        const results = [];
        const endD = end || start;
        Object.entries(events || {}).forEach(([dk, dayEvs]) => {
          if (dk >= start && dk <= endD) {
            (dayEvs || []).forEach(ev => {
              if (!person || ev.who === person || !ev.who) {
                results.push({ title: ev.title, date: dk, time: ev.time, who: ev.who });
              }
            });
          }
        });
        return results;
      },
      getBudgetSummary: (period) => {
        const txns = budgetData?.transactions || [];
        const now = new Date();
        let filtered = txns;
        if (period === "this_week") {
          const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
          filtered = txns.filter(t => (t.date || '') >= weekAgo);
        } else if (period === "this_month") {
          const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
          filtered = txns.filter(t => (t.date || '') >= monthStart);
        }
        const total = filtered.reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const cats = {};
        filtered.forEach(t => { cats[t.category || 'Other'] = (cats[t.category || 'Other'] || 0) + (Number(t.amount) || 0); });
        const topCats = Object.entries(cats).sort((a,b) => b[1] - a[1]).slice(0, 3).map(([c, v]) => `${c}: $${v.toFixed(2)}`).join(', ');
        return `Total: $${total.toFixed(2)} (${filtered.length} transactions)${topCats ? '. Top: ' + topCats : ''}`;
      },
      getKidsStatus: (kidName) => {
        const names = kidName === 'both' ? (profiles || []).filter(p => p.type === 'kid').map(p => p.name) : [kidName];
        return names.map(name => {
          const kd = (kidsData || {})[name] || {};
          const pendingChores = (chores || []).filter(c => c.assignedTo === name && c.completedBy && !c.verified).length;
          return `${name}: ${kd.points || 0} stars, ${(kd.tasks || []).length} tasks${pendingChores ? ', ' + pendingChores + ' chores pending approval' : ''}`;
        }).join('\n');
      },
      getDailyBriefingData: () => {
        const td = todayStr;
        const todayEvs = (events || {})[td] || [];
        const custody = getCustodyForDate(td);
        const lines = [];
        lines.push(`📅 Events today: ${todayEvs.length > 0 ? todayEvs.map(e => `${e.title}${e.time ? ' at ' + e.time : ''}`).join(', ') : 'None'}`);
        lines.push(`🏠 Custody: ${custody}`);
        lines.push(`✅ Routines: ${(routines || []).filter(r => r.done).length}/${(routines || []).length} done`);
        lines.push(`🎯 Goals: ${(goals || []).filter(g => g.done).length}/${(goals || []).length} done`);
        const kidsInfo = (profiles || []).filter(p => p.type === 'kid').map(p => {
          const kd = (kidsData || {})[p.name] || {};
          return `${p.name}: ${kd.points || 0}⭐`;
        }).join(', ');
        if (kidsInfo) lines.push(`👧 Kids: ${kidsInfo}`);
        const upcoming = getUpcomingBirthdays().filter(b => b.daysUntil <= 7);
        if (upcoming.length) lines.push(`🎂 ${upcoming.map(b => `${b.name} in ${b.daysUntil}d`).join(', ')}`);
        return lines.join('\n');
      }
    };
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
  // dateKey imported from shared.js
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

  // ═══ DISPLAY EVENTS — virtual repeat expansion + deduplication ═══
  // Computes all events for display: expands repeat events virtually,
  // deduplicates by title+time per day. Each event carries _baseDk/_baseIdx
  // to reference its source in Firebase for edits/deletes.
  const displayEvents = (() => {
    const result = {};
    const allEvents = events || {};
    Object.entries(allEvents).forEach(([dk, dayEvs]) => {
      if (!Array.isArray(dayEvs)) return;
      dayEvs.forEach((ev, idx) => {
        if (ev.repeat && ev.repeat !== "none") {
          // Expand repeat instances virtually
          const baseDate = new Date(dk + "T00:00:00");
          const dates = generateRepeats(ev, baseDate);
          dates.forEach(d => {
            const targetDk = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
            if (!result[targetDk]) result[targetDk] = [];
            result[targetDk].push({ ...ev, _baseDk: dk, _baseIdx: idx });
          });
        } else {
          if (!result[dk]) result[dk] = [];
          result[dk].push({ ...ev, _baseDk: dk, _baseIdx: idx });
        }
      });
    });
    // Deduplicate each day by title+time
    Object.keys(result).forEach(dk => {
      const seen = new Set();
      result[dk] = result[dk].filter(ev => {
        const key = `${ev.title}|${ev.time}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });
    return result;
  })();

  // Role-filtered view of displayEvents — this is what gets rendered
  const visibleEvents = filterEventsForRole(displayEvents, currentProfile);

  function saveEvents() {
    if (!selectedDay) return;
    const valid = addingEvents.filter(e => e.title.trim());
    if (!valid.length) { setSelectedDay(null); return; }
    const updated = { ...(events || {}) };
    const baseDk = dateKey(calYear, calMonth, selectedDay);
    valid.forEach(ev => {
      const eventData = { title: ev.title, time: ev.time, who: ev.who, notes: ev.notes, duration: ev.duration || 60, creator: currentProfile?.name || "Unknown" };
      if (ev.alert && ev.alert !== "none") eventData.alert = ev.alert;
      // Write both isPrivate (new) and private (backward compat for existing filterEventsForRole readers)
      if (eventPrivate && isAdmin) { eventData.isPrivate = true; eventData.private = true; }
      else { eventData.isPrivate = false; }
      if (ev.repeat && ev.repeat !== "none") {
        eventData.repeat = ev.repeat;
        if (ev.repeatEnd) eventData.repeatEnd = ev.repeatEnd;
        if (ev.repeatCount) eventData.repeatCount = ev.repeatCount;
      }
      // Dedup: skip if same title+time already exists on this date
      const existing = updated[baseDk] || [];
      if (!existing.some(e => e.title === eventData.title && e.time === eventData.time)) {
        updated[baseDk] = [...existing, eventData];
      }
    });
    fbSet("events", updated);
    setAddingEvents([{ title:"", time:"12:00 PM", who:"", notes:"", repeat:"none", repeatEnd:"", repeatCount:0, duration:60 }]);
    setEventPrivate(false);
    setSelectedDay(null);
  }

  function deleteEvent(dk, idx, ev) {
    const actualDk = ev?._baseDk || dk;
    const actualIdx = ev?._baseIdx != null ? ev._baseIdx : idx;
    const dayEvs = (events || {})[actualDk] || [];
    const updated = { ...events, [actualDk]: dayEvs.filter((_,i)=>i!==actualIdx) };
    if (!updated[actualDk] || !updated[actualDk].length) delete updated[actualDk];
    fbSet("events", updated);
  }

  function saveEventStyle(dk, idx, style, ev) {
    const actualDk = ev?._baseDk || dk;
    const actualIdx = ev?._baseIdx != null ? ev._baseIdx : idx;
    const key = `${actualDk}_${actualIdx}`;
    const updated = { ...(eventStyles || {}), [key]: style };
    fbSet("eventStyles", updated);
  }

  function getEventStyle(dk, idx, ev) {
    const actualDk = ev?._baseDk || dk;
    const actualIdx = ev?._baseIdx != null ? ev._baseIdx : idx;
    return (eventStyles || {})[`${actualDk}_${actualIdx}`] || null;
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

  // ═══ AI AGENT — QUICK ADD (replaces all regex parsing) ═══
  async function handleQuickAdd() {
    if (!quickAddInput.trim()) return;
    if (!GROQ_KEY) { showToast("No Groq API key configured", "error"); return; }
    setQuickAddLoading(true);
    setAgentActions([]); setAgentResponse(""); setAgentClarification(null);
    const input = quickAddInput.trim();
    setQuickAddInput("");

    try {
      const appState = buildAppState();
      const result = await runAgentLoop(GROQ_KEY, input, appState);

      // Text response
      if (result.content) setAgentResponse(result.content);

      // Write actions → show preview cards for confirmation
      if (result.actions && result.actions.length > 0) {
        setAgentActions(result.actions);
      }

      // Check for clarification in the response
      if (result.content) {
        try {
          // The agent may embed clarification JSON in tool responses
          const lines = result.content.split('\n');
          for (const line of lines) {
            if (line.includes('"type":"clarification"') || line.includes('"type": "clarification"')) {
              const parsed = JSON.parse(line);
              if (parsed.type === 'clarification') {
                setAgentClarification(parsed);
                break;
              }
            }
          }
        } catch {}
      }

      // If no response AND no actions, something went wrong
      if (!result.content && (!result.actions || result.actions.length === 0)) {
        showToast("Jr. didn't understand that. Try rephrasing?", "error");
      }
    } catch (error) {
      console.error("[QuickAdd] Agent error:", error);
      const msg = error?.message || "";
      if (msg.includes("429")) {
        showToast("AI is busy — try again in a few seconds", "error");
      } else if (msg.includes("AbortError") || msg.includes("timeout")) {
        showToast("Request timed out — try a shorter command", "error");
      } else {
        showToast(`Jr. had trouble: ${msg.slice(0, 80) || "try rephrasing"}`, "error");
      }
    }
    setQuickAddLoading(false);
  }

  // Execute confirmed agent write actions
  function executeAgentActions(actions) {
    for (const action of actions) {
      const { args } = action;
      switch (action.function) {
        case 'create_calendar_event': {
          const dk = args.date;
          const eventData = {
            title: args.title, time: args.time || "12:00 PM", who: args.person || "",
            duration: args.duration || 60, creator: currentProfile?.name || "Unknown",
            repeat: args.repeat || "none",
            isPrivate: false
          };
          if (args.alert && args.alert !== "none") eventData.alert = args.alert;
          if (args.isPrivate && isAdmin) { eventData.isPrivate = true; eventData.private = true; }
          const updated = { ...(events || {}) };
          updated[dk] = [...(updated[dk] || []), eventData];
          fbSet("events", updated);
          showToast(`Created "${args.title}" on ${args.date}`, "success");
          break;
        }
        case 'delete_event': {
          const matches = searchEvents(args.searchTerm);
          if (matches.length > 0) {
            const m = matches[0];
            const updated = { ...(events || {}) };
            updated[m.dk] = (updated[m.dk] || []).filter((_, i) => i !== m.idx);
            if (!updated[m.dk]?.length) delete updated[m.dk];
            fbSet("events", updated);
            showToast(`Deleted "${m.ev.title}"`, "success");
          } else {
            showToast(`Couldn't find "${args.searchTerm}"`, "error");
          }
          break;
        }
        case 'delete_events_bulk': {
          const updated = { ...(events || {}) };
          if (args.deleteAll) {
            fbSet("events", {});
            showToast("All events deleted", "success");
          } else if (args.date) {
            if (args.searchTerm) {
              // Delete matching events on that date
              const kw = args.searchTerm.toLowerCase();
              updated[args.date] = (updated[args.date] || []).filter(ev => !(ev.title || "").toLowerCase().includes(kw));
              if (!updated[args.date]?.length) delete updated[args.date];
            } else {
              delete updated[args.date];
            }
            fbSet("events", updated);
            showToast(`Deleted events on ${args.date}`, "success");
          }
          break;
        }
        case 'edit_event': {
          const matches = searchEvents(args.searchTerm);
          if (matches.length > 0) {
            const m = matches[0];
            const updated = { ...(events || {}) };
            updated[m.dk] = [...(updated[m.dk] || [])];
            const changes = {};
            if (args.newTitle) changes.title = args.newTitle;
            if (args.newTime) changes.time = args.newTime;
            if (args.newDate && args.newDate !== m.dk) {
              // Move to new date
              updated[m.dk] = updated[m.dk].filter((_, i) => i !== m.idx);
              if (!updated[m.dk]?.length) delete updated[m.dk];
              updated[args.newDate] = [...(updated[args.newDate] || []), { ...m.ev, ...changes }];
            } else {
              updated[m.dk][m.idx] = { ...updated[m.dk][m.idx], ...changes };
            }
            fbSet("events", updated);
            showToast(`Updated "${m.ev.title}"`, "success");
          } else {
            showToast(`Couldn't find "${args.searchTerm}"`, "error");
          }
          break;
        }
        case 'add_expense': {
          const txn = { id: Date.now() + "", amount: args.amount, description: args.description, category: args.category || "Other", date: todayStr };
          fbSet("budgetData", { ...(budgetData || {}), transactions: [...(budgetData?.transactions || []), txn] });
          showToast(`Logged $${args.amount} — ${args.description}`, "success");
          break;
        }
        case 'add_shopping_item': {
          fbSet("shoppingList", [...(shoppingList || []), { id: Date.now(), text: args.item, bought: false }]);
          showToast(`Added "${args.item}" to shopping list`, "success");
          break;
        }
        case 'add_task_for_kid': {
          const kd = getKidData(args.kidName);
          const task = { text: args.task, done: false, emoji: args.emoji || "📝" };
          fbSet("kidsData", { ...(kidsData || {}), [args.kidName]: { ...kd, tasks: [...(kd.tasks || []), task] } });
          showToast(`Assigned "${args.task}" to ${args.kidName}`, "success");
          break;
        }
        case 'log_food': {
          const entry = { name: args.food, calories: 0, protein: 0, carbs: 0, fat: 0, date: todayStr, profile: currentProfile?.name, meal: args.meal || "Snacks" };
          fbSet("foodLog", [...(foodLog || []), entry]);
          showToast(`Logged ${args.food}`, "success");
          break;
        }
      }
    }
    setAgentActions([]);
  }

  function confirmQuickAdd() {
    if (!quickAddPreview?.events?.length) return;
    const updated = { ...(events || {}) };
    let totalCreated = 0;
    quickAddPreview.events.forEach(ev => {
      const baseDk = ev.date; // "YYYY-MM-DD"
      const eventData = { title: ev.title, time: ev.time || "12:00 PM", who: ev.who || "", notes: ev.notes || "", duration: ev.duration || 60, creator: currentProfile?.name || "Unknown", isPrivate: false };
      if (ev.repeat && ev.repeat !== "none") {
        eventData.repeat = ev.repeat;
        if (ev.repeatCount) eventData.repeatCount = ev.repeatCount;
      }
      // Dedup: skip if same title+time already exists on base date
      const existing = updated[baseDk] || [];
      if (!existing.some(e => e.title === eventData.title && e.time === eventData.time)) {
        updated[baseDk] = [...existing, eventData];
        totalCreated++;
      }
    });
    fbSet("events", updated);
    const repeatInfo = quickAddPreview.events.some(e => e.repeat && e.repeat !== "none") ? " (repeating)" : "";
    showToast(`Created ${totalCreated} event${totalCreated>1?"s":""}${repeatInfo}!`, "success");
    setQuickAddPreview(null);
    setQuickAddInput("");
  }

  // ═══ WIDGET CUSTOMIZATION — imported from WidgetSystem.jsx ═══
  // Wrapper functions that bind state to the imported pure functions
  function getWidgetPref(key) { return _getWidgetPref(widgetPrefs, currentProfile, key); }
  function setWidgetPref(key, pref) { _setWidgetPref(widgetPrefs, currentProfile, fbSet, setWidgetPrefs, key, pref); }

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
    // Single utterance mode — stops after one phrase, no spam
    sr.continuous = false;
    sr.interimResults = false; // Only fire when speech is finalized
    let processed = false; // Debounce guard
    sr.onresult = (e) => {
      if (processed) return;
      // Only process final results
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          processed = true;
          const transcript = e.results[i][0].transcript;
          onResult(transcript);
          try { sr.stop(); } catch(_) {}
          return;
        }
      }
    };
    sr.onerror = (e) => {
      if (e.error !== "aborted") showToast("Couldn't hear you — try again", "error");
      setIsRecording(false);
    };
    sr.onend = () => {
      setIsRecording(false);
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
  function updateEventDuration(dk, idx, newDuration, ev) {
    const actualDk = ev?._baseDk || dk;
    const actualIdx = ev?._baseIdx != null ? ev._baseIdx : idx;
    const dayEvs = [...((events||{})[actualDk] || [])];
    dayEvs[actualIdx] = { ...dayEvs[actualIdx], duration: Math.max(30, Math.round(newDuration / 15) * 15) };
    fbSet("events", { ...(events||{}), [actualDk]: dayEvs });
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

  // ═══ CUSTODY SCHEDULE — PATTERN-BASED (2-2-5-5 etc.) ═══
  // CUSTODY_PRESETS, custodyDayNames moved to FamilyTab.jsx

  // Get custody for a specific date using pattern + overrides + fallback to legacy
  function getCustodyForDate(dateStr) {
    // Check manual overrides first
    if (custodyOverrides && custodyOverrides[dateStr]) return custodyOverrides[dateStr];
    // Pattern-based computation
    if (custodyPattern && custodyPattern.pattern && custodyPattern.startDate) {
      const start = new Date(custodyPattern.startDate + "T00:00:00");
      const target = new Date(dateStr + "T00:00:00");
      const diffDays = Math.round((target - start) / 86400000);
      const cycleLen = custodyPattern.pattern.length;
      const idx = ((diffDays % cycleLen) + cycleLen) % cycleLen; // handle negative
      const val = custodyPattern.pattern[idx];
      return val === "D" ? "Dad" : val === "M" ? "Mom" : "Free";
    }
    // Fallback to legacy day-of-week schedule
    const dayName = DAYS[new Date(dateStr + "T00:00:00").getDay()];
    return (custodySchedule || {})[dayName] || "Free";
  }

  // cycleCustodyOverride, setCustodyPreset, custodyColor, custodyTextColor moved to FamilyTab.jsx

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

  // Exchange log functions + state moved to FamilyTab.jsx

  const kidProfiles = (profiles||[]).filter(p => p.type === "kid");
  // Also expose isParent in the kid view so parent profiles see Kids tab correctly
  const familyNames = (profiles||[]).map(p => p.name);

  // Profile pin login
  function handleProfileSelect(profile) {
    if (profile.pin && profile.pin.length >= 4) {
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
              <div style={{ color:V.textDim, fontSize:11, marginTop:2 }}>{p.type === "admin" ? "👑 Admin" : p.type === "parent" || p.type === "family" ? "👨‍👩‍👧 Parent" : p.type === "kid" ? "🧒 Kid" : "👤 Guest"}</div>
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
        <input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handlePinSubmit()}
          placeholder="PIN" maxLength={15} autoFocus
          style={{ ...inputStyle, textAlign:"center", fontSize:24, letterSpacing:4, width:240, marginBottom:16 }} />
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
              <button onClick={()=>{setShowGame(true);setTab("kids");}}
                style={{ background:"#0f766e", color:"#fff", border:"none", borderRadius:V.r2,
                  padding:14, width:"100%", marginBottom:12, fontSize:16, cursor:"pointer", fontWeight:700 }}>
                🎮 Play LUCAC Legends
              </button>
              {/* Today's events for this kid */}
              {(() => {
                const dk = todayKey();
                const myEvents = (visibleEvents[dk]||[]).filter(ev => !ev.who || ev.who === currentProfile.name);
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
                  {/* Chores for this kid */}
                  {(chores||[]).filter(c=>!c.assignedTo||c.assignedTo===currentProfile.name).filter(c=>!c.verified).length > 0 && (
                    <div style={cardStyle}>
                      <div style={{fontWeight:700,marginBottom:10,color:V.accent}}>📋 My Chores</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10}}>
                        {(chores||[]).filter(c=>(!c.assignedTo||c.assignedTo===currentProfile.name)&&!c.verified).map((chore,i) => {
                          const completed = chore.completedBy === currentProfile.name;
                          return (
                            <div key={chore.id||i} onClick={()=>{
                              if(completed) return;
                              const updated = (chores||[]).map(c=>c.id===chore.id?{...c,completedBy:currentProfile.name}:c);
                              fbSet("chores",updated);
                              showToast("Done! Waiting for parent to verify ⏳","info");
                            }}
                              style={{minHeight:120,borderRadius:14,background:completed?`${V.accent}15`:V.bgCard,
                                border:`2px solid ${completed?V.accent:V.borderDefault}`,
                                display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                                padding:14,cursor:completed?"default":"pointer",position:"relative"}}>
                              {completed && <div style={{position:"absolute",top:4,right:6,fontSize:10,color:V.accent,fontWeight:700}}>⏳ Pending</div>}
                              <div style={{fontSize:44}}>{chore.emoji||"📝"}</div>
                              <div style={{fontSize:13,fontWeight:700,color:V.textPrimary,textAlign:"center"}}>{chore.name}</div>
                              <div style={{fontSize:11,color:V.accent,fontWeight:600}}>⭐ {chore.stars||5}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <HomeworkHelper V={V} profiles={profiles} kidsData={kidsData} fbSet={fbSet} GROQ_KEY={GROQ_KEY} showToast={showToast} homeworkSessions={homeworkSessions} />
                </div>
              )}
            </div>
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

  // Main app tabs — filtered by role
  const allTabs = [
    { id:"home", label:"Home", icon:"🏠", roles:["admin","parent","kid","guest"] },
    { id:"food", label:"Food", icon:"🍽️", roles:["admin","parent"] },
    { id:"kids", label:"Kids", icon:"⭐", roles:["admin","parent","kid"] },
    { id:"family", label:"Family", icon:"🤝", roles:["admin","parent"] },
    { id:"settings", label:"Settings", icon:"⚙️", roles:["admin","parent"] },
  ];
  const tabs = guestMode
    ? allTabs.filter(t => t.roles.includes("guest"))
    : allTabs.filter(t => t.roles.includes(currentRole));

  // ---- HOME TAB → moved to HomeTab.jsx ----
  // ---- FOOD TAB (dead code) removed — was already replaced by FoodTab.jsx ----

  // ---- KIDS TAB → moved to KidsTab.jsx ----

  // ---- FAMILY TAB → moved to FamilyTab.jsx ----

  // ---- SETTINGS TAB → moved to SettingsTab.jsx ----

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
        {tab === "home" && <HomeTab
          V={V} themeName={themeName} profiles={profiles} currentProfile={currentProfile}
          calYear={calYear} calMonth={calMonth} setCalMonth={setCalMonth} setCalYear={setCalYear}
          calView={calView} setCalView={setCalView} selectedDay={selectedDay} setSelectedDay={setSelectedDay}
          calendarSize={calendarSize} setCalendarSize={setCalendarSize}
          events={events} visibleEvents={visibleEvents} eventStyles={eventStyles}
          addingEvents={addingEvents} setAddingEvents={setAddingEvents}
          editingStyle={editingStyle} setEditingStyle={setEditingStyle}
          eventPrivate={eventPrivate} setEventPrivate={setEventPrivate}
          routines={routines} routineStyles={routineStyles} goals={goals} goalStyles={goalStyles}
          newRoutine={newRoutine} setNewRoutine={setNewRoutine} newGoal={newGoal} setNewGoal={setNewGoal}
          editingRoutineStyle={editingRoutineStyle} setEditingRoutineStyle={setEditingRoutineStyle}
          editingGoalStyle={editingGoalStyle} setEditingGoalStyle={setEditingGoalStyle}
          quickAddInput={quickAddInput} setQuickAddInput={setQuickAddInput} quickAddLoading={quickAddLoading}
          quickAddPreview={quickAddPreview} setQuickAddPreview={setQuickAddPreview}
          quickAddDeleteMatches={quickAddDeleteMatches} setQuickAddDeleteMatches={setQuickAddDeleteMatches}
          quickAddEditPreview={quickAddEditPreview} setQuickAddEditPreview={setQuickAddEditPreview}
          agentActions={agentActions} setAgentActions={setAgentActions}
          agentResponse={agentResponse} setAgentResponse={setAgentResponse}
          agentClarification={agentClarification} setAgentClarification={setAgentClarification}
          spotlightInput={spotlightInput} setSpotlightInput={setSpotlightInput}
          spotlightResponse={spotlightResponse} setSpotlightResponse={setSpotlightResponse}
          spotlightLoading={spotlightLoading} setSpotlightLoading={setSpotlightLoading}
          shoppingInput={shoppingInput} setShoppingInput={setShoppingInput} shoppingList={shoppingList}
          editingWidget={editingWidget} setEditingWidget={setEditingWidget} widgetPrefs={widgetPrefs}
          birthdayExpanded={birthdayExpanded} setBirthdayExpanded={setBirthdayExpanded}
          quote={quote} setQuote={setQuote}
          suggestedGoals={suggestedGoals} setSuggestedGoals={setSuggestedGoals} goalsLoading={goalsLoading}
          placeholderIdx={placeholderIdx}
          isRecording={isRecording} startVoiceInput={startVoiceInput} stopVoiceInput={stopVoiceInput}
          isAdmin={isAdmin} isParent={isParent} fbSet={fbSet} showToast={showToast} GROQ_KEY={GROQ_KEY}
          cardStyle={cardStyle} btnPrimary={btnPrimary} btnSecondary={btnSecondary} inputStyle={inputStyle}
          todayStr={todayStr} todayCalories={todayCalories} foodLog={foodLog}
          handleQuickAdd={handleQuickAdd} confirmQuickAdd={confirmQuickAdd}
          executeDeleteMatch={executeDeleteMatch} executeEditMatch={executeEditMatch}
          executeAgentActions={executeAgentActions}
          saveEvents={saveEvents} deleteEvent={deleteEvent}
          saveEventStyle={saveEventStyle} getEventStyle={getEventStyle} getPersonColor={getPersonColor}
          updateEventDuration={updateEventDuration} getWidgetPref={getWidgetPref} setWidgetPref={setWidgetPref}
          addRoutine={addRoutine} toggleRoutine={toggleRoutine} deleteRoutine={deleteRoutine}
          addGoal={addGoal} toggleGoal={toggleGoal} deleteGoal={deleteGoal} suggestGoals={suggestGoals}
          getUpcomingBirthdays={getUpcomingBirthdays} getDaysInMonth={getDaysInMonth} getFirstDay={getFirstDay}
          generateRepeats={generateRepeats}
          todayKey={todayKey} familyNames={familyNames}
          getCustodyForDate={getCustodyForDate}
          myRules={myRules} theirRules={theirRules} sharedRules={sharedRules} exchangeLog={exchangeLog}
          tab={tab} setTab={setTab}
        />}
        {tab === "food" && <FoodTab V={V} currentProfile={currentProfile} foodLog={foodLog} myFoods={myFoods}
          nutritionGoals={nutritionGoals} fbSet={fbSet} GROQ_KEY={GROQ_KEY} showToast={showToast} profiles={profiles}
          shoppingList={shoppingList} weightLog={weightLog} isRecording={isRecording} startVoiceInput={startVoiceInput} stopVoiceInput={stopVoiceInput} />}
        {tab === "kids" && <KidsTab V={V} profiles={profiles} currentProfile={currentProfile}
          kidsData={kidsData} chores={chores} fbSet={fbSet} showToast={showToast}
          isAdmin={isAdmin} isParent={isParent} cardStyle={cardStyle} btnPrimary={btnPrimary}
          btnSecondary={btnSecondary} inputStyle={inputStyle} contactDad={contactDad}
          contactMom={contactMom} GROQ_KEY={GROQ_KEY} />}
        {tab === "family" && <FamilyTab V={V} profiles={profiles} currentProfile={currentProfile}
          events={events} visibleEvents={visibleEvents} custodySchedule={custodySchedule}
          custodyPattern={custodyPattern} custodyOverrides={custodyOverrides}
          myRules={myRules} theirRules={theirRules} sharedRules={sharedRules}
          ruleProposals={ruleProposals} exchangeLog={exchangeLog} budgetData={budgetData}
          fbSet={fbSet} showToast={showToast} isAdmin={isAdmin} isParent={isParent}
          cardStyle={cardStyle} btnPrimary={btnPrimary} btnSecondary={btnSecondary}
          inputStyle={inputStyle} getCustodyForDate={getCustodyForDate} todayStr={todayStr}
          GROQ_KEY={GROQ_KEY} />}
        {tab === "settings" && <SettingsTab V={V} THEMES={THEMES} themeName={themeName}
          setThemeName={setThemeName} profiles={profiles} currentProfile={currentProfile}
          setCurrentProfile={setCurrentProfile} widgetPrefs={widgetPrefs}
          setWidgetPref={setWidgetPref} fbSet={fbSet} showToast={showToast}
          isAdmin={isAdmin} isParent={isParent} GROQ_KEY={GROQ_KEY} cardStyle={cardStyle}
          btnPrimary={btnPrimary} btnSecondary={btnSecondary} inputStyle={inputStyle}
          alertMinutes={alertMinutes} setAlertMinutes={setAlertMinutes}
          callButtons={callButtons} setCallButtons={setCallButtons}
          contactDad={contactDad} contactMom={contactMom} />}
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
          familyNames={familyNames} dateKey={dateKey} todayStr={todayStr}
          kidsData={kidsData} isAdmin={isAdmin} currentRole={currentRole} />
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
