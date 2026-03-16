import { useState, useEffect, useRef, useCallback } from "react";
import { groqFetch, parseGroqJSON, createSpeechRecognition } from "./utils";

// ═══ bby sonnet Jr. — Floating Personal Assistant (v3 Enhanced) ═══

const PERSONALITIES = {
  helpful: { label: "Helpful", icon: "H", desc: "professional, clear, thorough" },
  sassy: { label: "Sassy", icon: "S", desc: "talks back, makes jokes, uses slang, throws shade lovingly" },
  kids: { label: "Kids", icon: "K", desc: "simple words, lots of emojis, max 2 sentences, encouraging" },
};

function getMood(tasksDone) {
  if (tasksDone >= 6) return { text: "in the zone", emoji: "\u{1F451}" };
  if (tasksDone >= 3) return { text: "warming up", emoji: "\u{1F525}" };
  return { text: "just woke up", emoji: "\u{1F634}" };
}

function makeDateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function getWeekDates(todayStr) {
  const d = new Date(todayStr + "T00:00:00");
  const day = d.getDay();
  const dates = [];
  for (let i = -day; i < 7 - day; i++) {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + i);
    dates.push(makeDateKey(nd.getFullYear(), nd.getMonth(), nd.getDate()));
  }
  return dates;
}

function formatCurrency(n) {
  return "$" + Number(n || 0).toFixed(2);
}

// ── Render helpers for message content (handles markdown-like bold) ──
function renderText(text) {
  if (!text) return null;
  // Split on **bold** patterns
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

// ── Fallback help message builder (role-aware) ──
function buildFallbackMessage(originalText, role, personality) {
  const baseItems = [
    { icon: "\u{1F4C5}", label: "Calendar", text: "Add, edit, or delete calendar events" },
    { icon: "\u2B50", label: "Stars", text: "See kids' progress and stars" },
    { icon: "\u{1F50D}", label: "Search", text: "Search the web for anything" },
  ];

  // Admin/parent get budget + food
  if (role === "admin" || role === "parent") {
    baseItems.splice(1, 0, { icon: "\u{1F4B0}", label: "Budget", text: "Check your budget and spending" });
    baseItems.splice(3, 0, { icon: "\u{1F34E}", label: "Food", text: "Log meals and check nutrition" });
  }

  // Kids get simpler list
  if (role === "kid") {
    return `Hmm, I'm not sure what "${originalText}" means! Here's what I can help with:\n\n` +
      `\u2B50 Check your stars and tasks\n` +
      `\u{1F3AE} Talk about Lucac Legends\n` +
      `\u{1F4DA} Help with homework\n` +
      `\u{1F50D} Search for cool stuff\n\n` +
      `Try again?`;
  }

  const prefix = personality === "sassy"
    ? `I heard you say "${originalText}" and honestly? No clue what to do with that.`
    : personality === "kids"
      ? `Hmm I don't understand "${originalText}" yet!`
      : `I heard you say "${originalText}" \u2014 I'm not sure what to do with that.`;

  const itemLines = baseItems.map(i => `${i.icon} ${i.text}`).join("\n");
  return `${prefix} Here's what I can help with:\n\n${itemLines}\n\nTry again?`;
}

export default function GroqAssistant({
  V, currentProfile, profiles, events, routines, goals, foodLog,
  shoppingList, budgetData, custodySchedule, kidsData, fbSet, GROQ_KEY, TAVILY_KEY,
  showToast, familyNames, dateKey: dk, todayStr,
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [personality, setPersonality] = useState(() => {
    try { return localStorage.getItem("lucac_jr_personality") || "sassy"; } catch { return "sassy"; }
  });
  const [tasksDone, setTasksDone] = useState(0);
  const [recording, setRecording] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // {action, description, msgIndex}
  const [deleteOptions, setDeleteOptions] = useState(null); // [{event, date, index}, ...]

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const recTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  // ── Current user role (for role-aware responses) ──
  const userRole = currentProfile?.type || "guest";
  const userName = currentProfile?.name || "Unknown";

  // ── Load history from Firebase/localStorage on mount ──
  useEffect(() => {
    if (!currentProfile?.name) return;
    try {
      const cached = localStorage.getItem(`lucac_jrHistory_${currentProfile.name}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
    } catch { /* ignore */ }
  }, [currentProfile?.name]);

  // ── Save history when messages change ──
  useEffect(() => {
    if (!currentProfile?.name || messages.length === 0) return;
    const trimmed = messages.slice(-50);
    try { fbSet("jrHistory/" + currentProfile.name, trimmed); } catch { /* ignore */ }
    try {
      localStorage.setItem(`lucac_jrHistory_${currentProfile.name}`, JSON.stringify(trimmed));
    } catch { /* ignore */ }
  }, [messages, currentProfile?.name]);

  // ── Save personality ──
  useEffect(() => {
    try { localStorage.setItem("lucac_jr_personality", personality); } catch { /* ignore */ }
  }, [personality]);

  // ── Scroll to bottom ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, pendingAction, deleteOptions]);

  // ── Track tasks done for mood ──
  useEffect(() => {
    const done = (routines || []).filter(r => r.done).length +
      (goals || []).filter(g => g.done).length;
    setTasksDone(done);
  }, [routines, goals]);

  // ══════════════════════════════════════════════════
  // 1. FULL APP CONTEXT BUILDER (refreshed before every Groq call)
  // ══════════════════════════════════════════════════
  function buildAppContext() {
    const lines = [];

    // Calendar this week
    try {
      const weekDates = getWeekDates(todayStr);
      const weekEvents = [];
      weekDates.forEach(wd => {
        const dayEvs = (events || {})[wd] || [];
        if (dayEvs.length > 0) {
          const dayName = new Date(wd + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          weekEvents.push(`${dayName}: ${dayEvs.map(e => e.title + (e.time ? " at " + e.time : "")).join(", ")}`);
        }
      });
      lines.push("Calendar this week: " + (weekEvents.length > 0 ? weekEvents.join("; ") : "No events scheduled."));
    } catch { lines.push("Calendar: unable to load."); }

    // Today's events specifically
    try {
      const todayEvs = (events || {})[dk] || [];
      if (todayEvs.length > 0) {
        lines.push("Today's events: " + todayEvs.map(e => e.title + (e.time ? " at " + e.time : "")).join(", "));
      } else {
        lines.push("Today: No events.");
      }
    } catch { /* skip */ }

    // Budget (only for admin/parent)
    if (userRole === "admin" || userRole === "parent") {
      try {
        const txns = budgetData?.transactions || [];
        const weekDates = getWeekDates(todayStr);
        const weekTxns = txns.filter(t => weekDates.includes(t.date));
        const totalWeek = weekTxns.reduce((s, t) => s + Number(t.amount || 0), 0);
        const totalMonth = txns.filter(t => t.date && t.date.slice(0, 7) === todayStr.slice(0, 7))
          .reduce((s, t) => s + Number(t.amount || 0), 0);
        // Category breakdown for month
        const catTotals = {};
        txns.filter(t => t.date && t.date.slice(0, 7) === todayStr.slice(0, 7)).forEach(t => {
          const cat = t.category || "Other";
          catTotals[cat] = (catTotals[cat] || 0) + Number(t.amount || 0);
        });
        const biggest = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 3);
        const biggestStr = biggest.map(([c, v]) => `${c} ${formatCurrency(v)}`).join(", ");
        lines.push(`Budget: Spent ${formatCurrency(totalWeek)} this week, ${formatCurrency(totalMonth)} this month.${biggestStr ? " Top: " + biggestStr + "." : ""}`);
      } catch { lines.push("Budget: unable to load."); }
    }

    // Routines
    try {
      const rList = routines || [];
      const doneCount = rList.filter(r => r.done).length;
      lines.push(`Routines: ${doneCount}/${rList.length} done.${rList.length > 0 ? " Items: " + rList.slice(0, 8).map(r => r.text + (r.done ? " [DONE]" : "")).join(", ") : ""}`);
    } catch { lines.push("Routines: unable to load."); }

    // Goals
    try {
      const gList = goals || [];
      const doneCount = gList.filter(g => g.done).length;
      lines.push(`Goals: ${doneCount}/${gList.length} done.${gList.length > 0 ? " Items: " + gList.slice(0, 8).map(g => g.text + (g.done ? " [DONE]" : "")).join(", ") : ""}`);
    } catch { lines.push("Goals: unable to load."); }

    // Family members
    try {
      const names = (familyNames || []).join(", ");
      lines.push("Family members: " + (names || "not set"));
    } catch { /* skip */ }

    // Kids stars and tasks (from kidsData prop)
    try {
      const kidProfiles = (profiles || []).filter(p => p.type === "kid");
      if (kidProfiles.length > 0) {
        const kidsInfo = kidProfiles.map(kp => {
          const kidName = kp.name;
          const stars = kp.stars || 0;
          // Check kidsData for task info
          const kidTasks = kidsData && kidsData[kidName] ? kidsData[kidName] : null;
          let taskInfo = "";
          if (kidTasks && Array.isArray(kidTasks.tasks)) {
            const doneTasks = kidTasks.tasks.filter(t => t.done).length;
            const taskNames = kidTasks.tasks.slice(0, 5).map(t => t.text + (t.done ? " [DONE]" : "")).join(", ");
            taskInfo = ` | Tasks: ${doneTasks}/${kidTasks.tasks.length} done (${taskNames})`;
          } else if (kidTasks && typeof kidTasks === "object") {
            // Try to extract tasks from object format
            const taskEntries = Object.values(kidTasks).filter(v => v && typeof v === "object" && v.text);
            if (taskEntries.length > 0) {
              const doneTasks = taskEntries.filter(t => t.done).length;
              const taskNames = taskEntries.slice(0, 5).map(t => t.text + (t.done ? " [DONE]" : "")).join(", ");
              taskInfo = ` | Tasks: ${doneTasks}/${taskEntries.length} done (${taskNames})`;
            }
          }
          return `${kidName}: ${stars} stars${taskInfo}`;
        });
        lines.push("Kids: " + kidsInfo.join("; "));
      }
    } catch { /* skip */ }

    // Shopping list (only for admin/parent)
    if (userRole === "admin" || userRole === "parent") {
      try {
        const items = (shoppingList || []).map(s => typeof s === "string" ? s : s.item || s.text || "").filter(Boolean);
        lines.push("Shopping list: " + (items.length > 0 ? items.slice(0, 15).join(", ") : "empty"));
      } catch { lines.push("Shopping list: unable to load."); }
    }

    // Food log today
    try {
      const todayFood = (foodLog || {})[dk] || [];
      if (todayFood.length > 0) {
        const totalCal = todayFood.reduce((s, f) => s + Number(f.calories || 0), 0);
        lines.push(`Food log today: ${todayFood.length} entries, ~${totalCal} cal. Items: ${todayFood.map(f => f.name || f.item || "food").join(", ")}`);
      } else {
        lines.push("Food log today: nothing logged yet.");
      }
    } catch { /* skip */ }

    // Custody (only for admin)
    if (userRole === "admin") {
      try {
        if (custodySchedule) {
          const weekDates = getWeekDates(todayStr);
          const custInfo = weekDates.map(wd => {
            const val = custodySchedule[wd];
            return val ? `${new Date(wd + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })}: ${val}` : null;
          }).filter(Boolean);
          if (custInfo.length > 0) lines.push("Custody this week: " + custInfo.join(", "));
        }
      } catch { /* skip */ }
    }

    // All events (for search/delete) — provide a summary of ALL upcoming
    try {
      const allDates = Object.keys(events || {}).sort();
      const upcoming = allDates.filter(d => d >= todayStr).slice(0, 14);
      const allEvList = [];
      upcoming.forEach(d => {
        (events[d] || []).forEach((e, idx) => {
          allEvList.push(`${d} "${e.title}" at ${e.time || "?"} (index ${idx})`);
        });
      });
      if (allEvList.length > 0) {
        lines.push("All upcoming events (for search/delete): " + allEvList.join("; "));
      }
    } catch { /* skip */ }

    // Current user info
    lines.push(`Current user: ${userName} (role: ${userRole})`);
    lines.push(`Today: ${todayStr}`);

    return lines.join("\n");
  }

  // ══════════════════════════════════════════════════
  // 2. SYSTEM PROMPT BUILDER (with role awareness)
  // ══════════════════════════════════════════════════
  function buildSystemPrompt() {
    const personalityDesc = PERSONALITIES[personality]?.desc || PERSONALITIES.sassy.desc;
    const appContext = buildAppContext();

    const errorInstructions = personality === "sassy"
      ? `If you can't understand or find something, respond sassily like: "Uhh... I heard '[input]' and I got nothing. Try again?"`
      : personality === "kids"
        ? `If you can't understand, respond like: "Hmm I don't understand that yet! Try asking differently"`
        : `If you can't understand, respond helpfully like: "I wasn't able to find that. Could you try rephrasing?"`;

    // Role-based instructions
    let roleInstructions = "";
    switch (userRole) {
      case "kid":
        roleInstructions = `\n\nROLE: The user is a CHILD named ${userName}. Use simple, friendly language. Only discuss their own games, stars, tasks, and homework. Do NOT reveal budget, spending, custody, exchange log, or other adult information. Keep things fun and encouraging!`;
        break;
      case "parent":
        roleInstructions = `\n\nROLE: The user is a PARENT named ${userName}. They can see calendar, routines, goals, and kids info. Do NOT reveal private events created by the admin, budget details, or exchange log information. Be helpful but respect privacy boundaries.`;
        break;
      case "guest":
        roleInstructions = `\n\nROLE: The user is a GUEST. Only help with general questions, web searches, and publicly visible calendar events. Do NOT reveal budget, custody, family details, or private information.`;
        break;
      case "admin":
      default:
        roleInstructions = `\n\nROLE: The user is the ADMIN (${userName}). Full access to all features and data. They can add, edit, delete anything.`;
        break;
    }

    return `You are bby sonnet Jr., a personal assistant for the LUCAC family app. Today is ${todayStr}. You must be ${personalityDesc} in tone. Always respond naturally in conversation.

${errorInstructions}
${roleInstructions}

IMPORTANT \u2014 You have FULL access to the app's current state below. Use it to answer ALL questions accurately. Never say "I don't have access" \u2014 you DO.

\u2550\u2550\u2550 CURRENT APP STATE \u2550\u2550\u2550
${appContext}
\u2550\u2550\u2550 END APP STATE \u2550\u2550\u2550

You can execute actions by including a JSON block wrapped in <action>...</action> tags in your response. You may include MULTIPLE action tags.

Available actions:
- {"type":"addEvent","title":"...","date":"YYYY-MM-DD","time":"HH:MM AM/PM","who":"..."}
- {"type":"deleteEvent","keyword":"...","date":"YYYY-MM-DD"}
  (keyword = partial match on event title; date is optional to narrow scope)
- {"type":"editEvent","keyword":"...","date":"YYYY-MM-DD","newTitle":"...","newTime":"...","newDate":"..."}
- {"type":"addBudget","amount":number,"store":"...","category":"..."}
- {"type":"addShopping","item":"..."}
- {"type":"addGoal","text":"..."}
- {"type":"addFood","name":"...","calories":number,"protein":number,"carbs":number,"fat":number}
- {"type":"search","query":"..."} (web search for weather, news, prices, restaurants, anything external)

RULES:
1. When the user asks about calendar/events/schedule \u2014 ALWAYS check the app state above and give a specific answer.
2. When asked to delete/edit \u2014 search for the event in app state, confirm what you found, then include the action tag.
3. When asked about budget/spending \u2014 calculate from the transactions in app state.
4. When asked about tasks/goals/routines \u2014 reference the app state.
5. For weather, news, prices, "search for X", "what is X" \u2014 include a search action.
6. For food logging \u2014 include addFood action with estimated macros.
7. For reminders \u2014 add as a goal with addGoal action.
8. ALWAYS describe what you're about to do BEFORE the action tag so the user sees a preview.
9. Never include raw JSON in your visible response \u2014 keep action tags for the system only.
10. When asked "what tasks does [kid] have?" \u2014 look at the Kids section of app state for their stars and tasks.
11. EVERY message MUST get a response. If confused, list what you CAN help with.
12. Keep responses concise (2-3 sentences max for simple questions). Be warm but efficient.`;
  }

  // ══════════════════════════════════════════════════
  // 3. TAVILY WEB SEARCH
  // ══════════════════════════════════════════════════
  async function tavilySearch(query) {
    if (!TAVILY_KEY) return null;
    try {
      const resp = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: TAVILY_KEY, query, max_results: 3 }),
      });
      const data = await resp.json();
      return (data.results || [])
        .map((r, i) => `${i + 1}. ${r.title}: ${r.content?.slice(0, 250)}`)
        .join("\n");
    } catch {
      return null;
    }
  }

  // ══════════════════════════════════════════════════
  // 4. ACTION PARSER (extracts <action> tags)
  // ══════════════════════════════════════════════════
  function parseActions(text) {
    const actionRegex = /<action>([\s\S]*?)<\/action>/g;
    const actions = [];
    let match;
    while ((match = actionRegex.exec(text)) !== null) {
      try {
        actions.push(JSON.parse(match[1].trim()));
      } catch { /* skip bad JSON */ }
    }
    return actions;
  }

  function cleanActionTags(text) {
    return text.replace(/<action>[\s\S]*?<\/action>/g, "").trim();
  }

  // ══════════════════════════════════════════════════
  // 5. ACTION EXECUTOR (runs after user confirms)
  // ══════════════════════════════════════════════════
  async function executeAction(action) {
    // Role-based gating: kids and guests cannot perform mutating actions
    if (userRole === "kid" || userRole === "guest") {
      if (["deleteEvent", "editEvent", "addBudget"].includes(action.type)) {
        return `Sorry, ${userName} \u2014 you don't have permission to do that. Ask an admin for help!`;
      }
    }
    if (userRole === "guest") {
      // Guests can only do searches
      if (action.type !== "search") {
        return "Guests can only search the web. Please sign in for full access!";
      }
    }

    try {
      switch (action.type) {
        case "addEvent": {
          const date = action.date || todayStr;
          const eventData = {
            title: action.title || "Untitled",
            time: action.time || "12:00 PM",
            who: action.who || "",
            notes: action.notes || "",
            duration: action.duration || 60,
          };
          const updated = { ...(events || {}) };
          updated[date] = [...(updated[date] || []), eventData];
          fbSet("events", updated);
          showToast(`Event added: ${eventData.title}`, "success");
          return `Added "${eventData.title}" on ${date} at ${eventData.time}`;
        }

        case "deleteEvent": {
          const keyword = (action.keyword || "").toLowerCase();
          if (!keyword) return "No keyword provided for deletion.";
          const targetDate = action.date;
          const updated = { ...(events || {}) };
          let found = false;
          const datesToCheck = targetDate ? [targetDate] : Object.keys(updated);
          for (const d of datesToCheck) {
            const before = (updated[d] || []).length;
            updated[d] = (updated[d] || []).filter(
              e => !(e.title || "").toLowerCase().includes(keyword)
            );
            if (updated[d].length < before) found = true;
            if (updated[d].length === 0) delete updated[d];
          }
          if (found) {
            fbSet("events", updated);
            showToast(`Deleted events matching "${action.keyword}"`, "success");
            return `Deleted events matching "${action.keyword}"`;
          }
          return `No events found matching "${action.keyword}"`;
        }

        case "editEvent": {
          const keyword = (action.keyword || "").toLowerCase();
          if (!keyword) return "No keyword provided for edit.";
          const updated = { ...(events || {}) };
          let edited = false;
          const datesToCheck = action.date ? [action.date] : Object.keys(updated);
          for (const d of datesToCheck) {
            const evList = updated[d] || [];
            for (let i = 0; i < evList.length; i++) {
              if ((evList[i].title || "").toLowerCase().includes(keyword)) {
                if (action.newTitle) evList[i].title = action.newTitle;
                if (action.newTime) evList[i].time = action.newTime;
                // If moving to a new date
                if (action.newDate && action.newDate !== d) {
                  const movedEvent = { ...evList[i] };
                  evList.splice(i, 1);
                  if (evList.length === 0) delete updated[d];
                  else updated[d] = evList;
                  updated[action.newDate] = [...(updated[action.newDate] || []), movedEvent];
                } else {
                  updated[d] = evList;
                }
                edited = true;
                break;
              }
            }
            if (edited) break;
          }
          if (edited) {
            fbSet("events", updated);
            const changes = [];
            if (action.newTitle) changes.push(`title to "${action.newTitle}"`);
            if (action.newTime) changes.push(`time to ${action.newTime}`);
            if (action.newDate) changes.push(`date to ${action.newDate}`);
            showToast(`Event updated!`, "success");
            return `Updated event: changed ${changes.join(", ")}`;
          }
          return `No events found matching "${action.keyword}" to edit.`;
        }

        case "addBudget": {
          const tx = {
            id: Date.now(),
            amount: action.amount || 0,
            store: action.store || "Unknown",
            category: action.category || "Other",
            date: todayStr,
            note: action.note || "",
            recurring: false,
          };
          const bd = budgetData || { transactions: [], categoryBudgets: {} };
          const updatedTx = [...(bd.transactions || []), tx];
          fbSet("budgetData", { ...bd, transactions: updatedTx });
          showToast(`Budget: ${formatCurrency(tx.amount)} at ${tx.store}`, "success");
          return `Added ${formatCurrency(tx.amount)} expense at ${tx.store} (${tx.category})`;
        }

        case "addShopping": {
          const item = action.item || "";
          if (!item) return "No item specified.";
          const updated = [...(shoppingList || []), { text: item, done: false, id: Date.now() }];
          fbSet("shoppingList", updated);
          showToast(`Added "${item}" to shopping list`, "success");
          return `Added "${item}" to shopping list`;
        }

        case "addGoal": {
          const text = action.text || "";
          if (!text) return "No goal text provided.";
          const updated = [...(goals || []), { id: Date.now(), text, done: false }];
          fbSet("goals", updated);
          showToast(`Goal added: ${text}`, "success");
          return `Added goal: "${text}"`;
        }

        case "addFood": {
          const entry = {
            id: Date.now(),
            name: action.name || "Food",
            calories: action.calories || 0,
            protein: action.protein || 0,
            carbs: action.carbs || 0,
            fat: action.fat || 0,
          };
          const todayLog = { ...(foodLog || {}) };
          todayLog[dk] = [...(todayLog[dk] || []), entry];
          fbSet("foodLog", todayLog);
          showToast(`Logged: ${entry.name} (${entry.calories} cal)`, "success");
          return `Logged ${entry.name}: ${entry.calories} cal, ${entry.protein}g protein, ${entry.carbs}g carbs, ${entry.fat}g fat`;
        }

        case "search": {
          // This is handled separately in sendMessage flow
          return "Search handled externally.";
        }

        default:
          return `Unknown action type: ${action.type}`;
      }
    } catch (e) {
      return `Action failed: ${e.message}`;
    }
  }

  // ══════════════════════════════════════════════════
  // 6. FIND EVENTS BY KEYWORD (for delete/edit with multiple matches)
  // ══════════════════════════════════════════════════
  function findEventsByKeyword(keyword) {
    const kw = (keyword || "").toLowerCase();
    if (!kw) return [];
    const results = [];
    const allDates = Object.keys(events || {}).sort();
    allDates.forEach(d => {
      (events[d] || []).forEach((e, idx) => {
        if ((e.title || "").toLowerCase().includes(kw)) {
          results.push({ ...e, date: d, index: idx });
        }
      });
    });
    return results;
  }

  // ══════════════════════════════════════════════════
  // 7. CONFIRM PENDING ACTION
  // ══════════════════════════════════════════════════
  async function confirmPendingAction() {
    if (!pendingAction) return;
    setLoading(true);
    try {
      const results = [];
      for (const action of pendingAction.actions) {
        if (action.type === "search") continue; // skip search in confirm
        const result = await executeAction(action);
        results.push(result);
      }
      const resultText = results.map(r => "\u2705 " + r).join("\n");
      const confirmMsg = { role: "assistant", content: resultText, ts: Date.now() };
      setMessages(prev => [...prev, confirmMsg]);
    } catch (e) {
      const errMsg = { role: "assistant", content: "Something went wrong executing that: " + e.message, ts: Date.now() };
      setMessages(prev => [...prev, errMsg]);
    }
    setPendingAction(null);
    setLoading(false);
  }

  function cancelPendingAction() {
    const cancelMsg = { role: "assistant", content: "No worries, cancelled!", ts: Date.now() };
    setMessages(prev => [...prev, cancelMsg]);
    setPendingAction(null);
  }

  // ══════════════════════════════════════════════════
  // 8. DELETE FROM OPTIONS LIST
  // ══════════════════════════════════════════════════
  async function deleteSpecificEvent(ev) {
    try {
      const updated = { ...(events || {}) };
      const dayEvs = updated[ev.date] || [];
      updated[ev.date] = dayEvs.filter((_, i) => i !== ev.index);
      if (updated[ev.date].length === 0) delete updated[ev.date];
      fbSet("events", updated);
      showToast(`Deleted: ${ev.title}`, "success");
      const msg = { role: "assistant", content: `\u2705 Deleted "${ev.title}" on ${ev.date}.`, ts: Date.now() };
      setMessages(prev => [...prev, msg]);
    } catch (e) {
      const msg = { role: "assistant", content: `Failed to delete: ${e.message}`, ts: Date.now() };
      setMessages(prev => [...prev, msg]);
    }
    setDeleteOptions(null);
  }

  // ══════════════════════════════════════════════════
  // 9. MAIN SEND MESSAGE (every input MUST get a visible response)
  // ══════════════════════════════════════════════════
  async function sendMessage(userText) {
    const text = (userText || input).trim();
    if (!text || loading) return;
    setInput("");
    setPendingAction(null);
    setDeleteOptions(null);

    const userMsg = { role: "user", content: text, ts: Date.now() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setLoading(true);

    // Safety net: track whether we produced a response
    let respondedSuccessfully = false;

    try {
      // Check if GROQ_KEY is available
      if (!GROQ_KEY) {
        const errMsg = { role: "assistant", content: "I need an API key to work! Ask the admin to set up VITE_GROQ_KEY.", ts: Date.now() };
        setMessages(prev => [...prev, errMsg]);
        setLoading(false);
        return;
      }

      // Detect if web search is likely needed
      const needsSearch = /weather|news|price|restaurant|store hours|what is|who is|how to|current|latest|today's|search for|look up|find me|recipe/i.test(text);
      let searchContext = "";

      if (needsSearch && TAVILY_KEY) {
        setSearching(true);
        const results = await tavilySearch(text);
        setSearching(false);
        if (results) {
          searchContext = `\n\n\u2550\u2550\u2550 WEB SEARCH RESULTS for "${text}" \u2550\u2550\u2550\n${results}\n\u2550\u2550\u2550 END SEARCH \u2550\u2550\u2550\nUse these results to give a helpful answer.`;
        }
      }

      // Build conversation history (last 6 messages for context)
      const recentHistory = newMsgs.slice(-12).map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      }));

      const systemMsg = buildSystemPrompt() + searchContext;
      const groqMessages = [{ role: "system", content: systemMsg }, ...recentHistory];

      const result = await groqFetch(GROQ_KEY, groqMessages, { maxTokens: 1200, timeout: 18000 });

      if (result.ok && result.data) {
        let responseText = result.data;
        const actions = parseActions(responseText);
        const displayText = cleanActionTags(responseText);

        // Check for search actions — execute immediately and feed back
        const searchActions = actions.filter(a => a.type === "search");
        const mutatingActions = actions.filter(a => a.type !== "search");

        if (searchActions.length > 0 && TAVILY_KEY) {
          setSearching(true);
          const searchResults = [];
          for (const sa of searchActions) {
            const r = await tavilySearch(sa.query);
            if (r) searchResults.push(r);
          }
          setSearching(false);

          if (searchResults.length > 0) {
            // Feed results back to Groq for natural summary
            const followUpMessages = [
              { role: "system", content: buildSystemPrompt() },
              ...recentHistory,
              { role: "assistant", content: displayText },
              { role: "user", content: `Here are the search results. Summarize them naturally and helpfully:\n${searchResults.join("\n\n")}` },
            ];
            const followUp = await groqFetch(GROQ_KEY, followUpMessages, { maxTokens: 1000, timeout: 15000 });
            if (followUp.ok && followUp.data) {
              const cleanFollowUp = cleanActionTags(followUp.data);
              const jrMsg = { role: "assistant", content: cleanFollowUp, ts: Date.now() };
              setMessages(prev => [...prev, jrMsg]);
              respondedSuccessfully = true;
              setLoading(false);
              return;
            }
          }
        }

        // If there are mutating actions, show preview and ask for confirmation
        if (mutatingActions.length > 0) {
          // Build a human-readable description
          const descriptions = mutatingActions.map(a => {
            switch (a.type) {
              case "addEvent": return `Add event: "${a.title}" on ${a.date || todayStr} at ${a.time || "12:00 PM"}${a.who ? " for " + a.who : ""}`;
              case "deleteEvent": {
                // Find matching events for smarter delete
                const matches = findEventsByKeyword(a.keyword);
                if (matches.length === 0) return `Delete: No events found matching "${a.keyword}"`;
                if (matches.length === 1) return `Delete: "${matches[0].title}" on ${matches[0].date} at ${matches[0].time || "?"}`;
                // Multiple matches — we'll show options
                return `Delete: Found ${matches.length} events matching "${a.keyword}"`;
              }
              case "editEvent": {
                const changes = [];
                if (a.newTitle) changes.push(`title to "${a.newTitle}"`);
                if (a.newTime) changes.push(`time to ${a.newTime}`);
                if (a.newDate) changes.push(`date to ${a.newDate}`);
                return `Edit event matching "${a.keyword}": change ${changes.join(", ")}`;
              }
              case "addBudget": return `Log expense: ${formatCurrency(a.amount)} at ${a.store || "?"} (${a.category || "Other"})`;
              case "addShopping": return `Add to shopping list: "${a.item}"`;
              case "addGoal": return `Add goal/reminder: "${a.text}"`;
              case "addFood": return `Log food: ${a.name} (~${a.calories || 0} cal)`;
              default: return `Action: ${a.type}`;
            }
          });

          // Check for multi-match delete
          const deleteAction = mutatingActions.find(a => a.type === "deleteEvent");
          if (deleteAction) {
            const matches = findEventsByKeyword(deleteAction.keyword);
            if (matches.length > 1) {
              // Show options to pick
              const jrMsg = { role: "assistant", content: displayText || `I found ${matches.length} events matching "${deleteAction.keyword}". Which one do you want to delete?`, ts: Date.now() };
              setMessages(prev => [...prev, jrMsg]);
              setDeleteOptions(matches);
              respondedSuccessfully = true;
              setLoading(false);
              return;
            }
            if (matches.length === 0) {
              const personalityError = personality === "sassy"
                ? `Uhh... I looked everywhere for "${deleteAction.keyword}" and got nothing. You sure that's right?`
                : personality === "kids"
                  ? `Hmm I couldn't find anything called "${deleteAction.keyword}"! Try a different name?`
                  : `I couldn't find any events matching "${deleteAction.keyword}". Could you try a different keyword?`;
              const jrMsg = { role: "assistant", content: personalityError, ts: Date.now() };
              setMessages(prev => [...prev, jrMsg]);
              respondedSuccessfully = true;
              setLoading(false);
              return;
            }
          }

          // Show preview card
          const previewText = displayText + (displayText ? "\n\n" : "") + descriptions.join("\n");
          const jrMsg = { role: "assistant", content: previewText, ts: Date.now(), isPreview: true };
          setMessages(prev => [...prev, jrMsg]);
          setPendingAction({ actions: mutatingActions, descriptions });
          respondedSuccessfully = true;
          setLoading(false);
          return;
        }

        // No actions — just a conversational response
        if (displayText || responseText) {
          const jrMsg = { role: "assistant", content: displayText || responseText, ts: Date.now() };
          setMessages(prev => [...prev, jrMsg]);
          respondedSuccessfully = true;
        }

      } else {
        // Error from Groq — check if timeout
        const isTimeout = (result.error || "").toLowerCase().includes("too long") || (result.error || "").toLowerCase().includes("abort");
        if (isTimeout) {
          const timeoutMsg = personality === "sassy"
            ? "Jr. got confused trying to think about that. Say it differently?"
            : personality === "kids"
              ? "Oops, my brain got tired! Try again?"
              : "Jr. got confused. Try saying it differently?";
          const errMsg = { role: "assistant", content: timeoutMsg, ts: Date.now() };
          setMessages(prev => [...prev, errMsg]);
          respondedSuccessfully = true;
        } else {
          const personalityError = personality === "sassy"
            ? `Look, something went sideways with my brain. ${result.error || "Try again?"}`
            : personality === "kids"
              ? `Oops! My brain got confused. Try asking again!`
              : `I ran into an issue: ${result.error || "Please try again."}`;
          const errMsg = { role: "assistant", content: personalityError, ts: Date.now() };
          setMessages(prev => [...prev, errMsg]);
          respondedSuccessfully = true;
        }
      }
    } catch (e) {
      const personalityError = personality === "sassy"
        ? `Yo, I just crashed trying to do that. My bad: ${e.message}`
        : personality === "kids"
          ? `Uh oh! Something broke. Try again!`
          : `An unexpected error occurred: ${e.message}. Please try again.`;
      const errMsg = { role: "assistant", content: personalityError, ts: Date.now() };
      setMessages(prev => [...prev, errMsg]);
      respondedSuccessfully = true;
    }

    // SAFETY NET: If somehow no response was generated, show fallback
    if (!respondedSuccessfully) {
      const fallback = buildFallbackMessage(text, userRole, personality);
      const fallbackMsg = { role: "assistant", content: fallback, ts: Date.now() };
      setMessages(prev => [...prev, fallbackMsg]);
    }

    setSearching(false);
    setLoading(false);
  }

  // ══════════════════════════════════════════════════
  // 10. VOICE INPUT
  // ══════════════════════════════════════════════════
  function toggleVoice() {
    if (recording) { stopRecording(); return; }
    const rec = createSpeechRecognition();
    if (!rec) {
      showToast("Voice not supported in this browser", "danger");
      return;
    }
    recognitionRef.current = rec;
    let transcript = "";
    rec.onresult = (e) => {
      transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setInput(transcript);
    };
    rec.onerror = () => stopRecording();
    rec.onend = () => setRecording(false);
    rec.start();
    setRecording(true);
    recTimeoutRef.current = setTimeout(() => stopRecording(), 10000);
  }

  function stopRecording() {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    if (recTimeoutRef.current) {
      clearTimeout(recTimeoutRef.current);
      recTimeoutRef.current = null;
    }
    setRecording(false);
  }

  function clearHistory() {
    setMessages([]);
    setPendingAction(null);
    setDeleteOptions(null);
    if (currentProfile?.name) {
      try { fbSet("jrHistory/" + currentProfile.name, null); } catch { /* ignore */ }
      try { localStorage.removeItem(`lucac_jrHistory_${currentProfile.name}`); } catch { /* ignore */ }
    }
    setShowMenu(false);
    showToast("Chat history cleared", "success");
  }

  const mood = getMood(tasksDone);

  // ── Theme Colors ──
  const goldAccent = "#f59e0b";
  const panelBg = V?.bgCard || "#ffffff";
  const textColor = V?.textPrimary || "#1f2937";
  const mutedColor = V?.textMuted || "#6b7280";
  const borderColor = V?.borderDefault || "#e5e7eb";
  const accentColor = V?.accent || goldAccent;
  const inputBg = V?.bgInput || "#f0f1f3";
  const cardAlt = V?.bgCardAlt || "#f4f5f7";
  const shadowCard = V?.shadowCard || "0 1px 3px rgba(0,0,0,0.04)";
  const shadowModal = V?.shadowModal || "0 8px 30px rgba(0,0,0,0.12)";
  const radius = V?.r3 || 12;
  const dangerColor = V?.danger || "#dc2626";
  const successColor = V?.success || "#22c55e";

  // ── Role-aware quick suggestions ──
  const quickSuggestions = userRole === "kid"
    ? [
        "How many stars do I have?",
        "What are my tasks?",
        "Tell me something cool!",
      ]
    : userRole === "guest"
      ? [
          "What's happening this week?",
          "What's the weather?",
          "Search for something",
        ]
      : [
          "What's happening this week?",
          "How much did I spend?",
          "What's the weather?",
        ];

  // ══════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════
  return (
    <>
      {/* ── Floating Button ── */}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Open bby sonnet Jr. assistant"
        style={{
          position: "fixed",
          bottom: 80,
          right: 16,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: goldAccent,
          border: "none",
          cursor: "pointer",
          zIndex: 200,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 16px rgba(245,158,11,0.4)",
          transition: "transform 0.2s, box-shadow 0.2s",
          transform: open ? "scale(0.9)" : "scale(1)",
        }}
      >
        <span style={{ fontSize: 22, lineHeight: 1 }}>{"\u{1F451}"}</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", marginTop: -2, letterSpacing: 0.5 }}>Jr.</span>
      </button>

      {/* ── Chat Panel ── */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: "70vh",
            background: panelBg,
            zIndex: 201,
            display: "flex",
            flexDirection: "column",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            boxShadow: shadowModal,
            animation: "jrSlideUp 0.3s ease-out",
          }}
        >
          <style>{`
            @keyframes jrSlideUp {
              from { transform: translateY(100%); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            @keyframes jrPulse {
              0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.4); }
              50% { box-shadow: 0 0 0 8px rgba(220,38,38,0); }
            }
            @keyframes jrSpin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes jrDots {
              0%, 20% { content: '.'; }
              40% { content: '..'; }
              60%, 100% { content: '...'; }
            }
            @keyframes jrThinkPulse {
              0%, 100% { opacity: 0.4; }
              50% { opacity: 1; }
            }
          `}</style>

          {/* ── Header ── */}
          <div
            style={{
              padding: "12px 16px 8px",
              borderBottom: `1px solid ${borderColor}`,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: textColor }}>
                  bby sonnet Jr. {"\u{1F451}"}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: mutedColor,
                    background: cardAlt,
                    padding: "2px 8px",
                    borderRadius: 10,
                  }}
                >
                  {mood.text} {mood.emoji}
                </span>
                {/* Role badge */}
                <span
                  style={{
                    fontSize: 10,
                    color: userRole === "admin" ? goldAccent : userRole === "kid" ? successColor : mutedColor,
                    background: cardAlt,
                    padding: "2px 6px",
                    borderRadius: 8,
                    fontWeight: 600,
                  }}
                >
                  {userRole === "admin" ? "Admin" : userRole === "kid" ? "Kid" : userRole === "parent" ? "Parent" : "Guest"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    aria-label="Chat menu"
                    style={{
                      width: 32, height: 32, borderRadius: 8,
                      border: "none", background: "transparent",
                      cursor: "pointer", fontSize: 16, color: mutedColor,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {"\u22EF"}
                  </button>
                  {showMenu && (
                    <div
                      style={{
                        position: "absolute", top: 36, right: 0,
                        background: panelBg, border: `1px solid ${borderColor}`,
                        borderRadius: 10, boxShadow: shadowCard,
                        padding: 4, zIndex: 10, minWidth: 150,
                      }}
                    >
                      <button
                        onClick={clearHistory}
                        style={{
                          display: "block", width: "100%", padding: "10px 14px",
                          background: "none", border: "none", cursor: "pointer",
                          fontSize: 13, color: dangerColor, textAlign: "left", borderRadius: 8,
                        }}
                      >
                        Clear history
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { setOpen(false); setShowMenu(false); }}
                  aria-label="Close assistant"
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    border: "none", background: "transparent",
                    cursor: "pointer", fontSize: 18, color: mutedColor,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {"\u2715"}
                </button>
              </div>
            </div>

            {/* Personality pills */}
            <div style={{ display: "flex", gap: 6 }}>
              {Object.entries(PERSONALITIES).map(([key, p]) => (
                <button
                  key={key}
                  onClick={() => setPersonality(key)}
                  aria-label={`${p.label} personality mode`}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 20,
                    border: `1px solid ${personality === key ? accentColor : borderColor}`,
                    background: personality === key ? accentColor : "transparent",
                    color: personality === key ? "#fff" : mutedColor,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    minHeight: 28,
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Messages ── */}
          <div
            onClick={() => setShowMenu(false)}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {messages.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  color: mutedColor,
                  fontSize: 13,
                  marginTop: 40,
                  lineHeight: 1.6,
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>{"\u{1F451}"}</div>
                <div style={{ fontWeight: 600 }}>
                  Hey{userName !== "Unknown" ? ` ${userName}` : ""}! I'm bby sonnet Jr.
                </div>
                <div>
                  {userRole === "kid"
                    ? "Ask me about your stars, tasks, or anything fun!"
                    : "Ask me anything or tell me to do stuff."
                  }
                </div>
                <div style={{ fontSize: 11, marginTop: 8, color: V?.textDim || "#9ca3af" }}>
                  {userRole === "kid"
                    ? "Try: \"How many stars do I have?\" or \"What are my tasks?\""
                    : "Try: \"What's on my calendar this week?\" or \"Add dentist tomorrow at 3pm\""
                  }
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 12 }}>
                  {quickSuggestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 16,
                        border: `1px solid ${borderColor}`,
                        background: "transparent",
                        color: accentColor,
                        fontSize: 11,
                        cursor: "pointer",
                        minHeight: 32,
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: isUser ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "82%",
                      padding: "10px 14px",
                      borderRadius: radius,
                      background: isUser ? accentColor : cardAlt,
                      color: isUser ? "#fff" : textColor,
                      fontSize: 13,
                      lineHeight: 1.5,
                      borderLeft: isUser ? "none" : `3px solid ${goldAccent}`,
                      borderRight: isUser ? `3px solid ${accentColor}` : "none",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {renderText(msg.content)}
                  </div>
                </div>
              );
            })}

            {/* ── Pending Action Confirmation Card ── */}
            {pendingAction && (
              <div
                style={{
                  background: cardAlt,
                  border: `2px solid ${accentColor}`,
                  borderRadius: radius,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: textColor }}>
                  Confirm action:
                </div>
                {pendingAction.descriptions.map((d, i) => (
                  <div key={i} style={{ fontSize: 12, color: textColor, padding: "4px 0" }}>
                    {d}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={confirmPendingAction}
                    aria-label="Confirm action"
                    style={{
                      flex: 1,
                      minHeight: 44,
                      borderRadius: 10,
                      border: "none",
                      background: successColor,
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {"\u2705"} Yes, do it
                  </button>
                  <button
                    onClick={cancelPendingAction}
                    aria-label="Cancel action"
                    style={{
                      flex: 1,
                      minHeight: 44,
                      borderRadius: 10,
                      border: `1px solid ${borderColor}`,
                      background: "transparent",
                      color: mutedColor,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {"\u274C"} Cancel
                  </button>
                </div>
              </div>
            )}

            {/* ── Delete Options (multiple matches) ── */}
            {deleteOptions && deleteOptions.length > 0 && (
              <div
                style={{
                  background: cardAlt,
                  border: `2px solid ${dangerColor}`,
                  borderRadius: radius,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: textColor }}>
                  Which one do you want to delete?
                </div>
                {deleteOptions.map((ev, i) => (
                  <button
                    key={i}
                    onClick={() => deleteSpecificEvent(ev)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: `1px solid ${borderColor}`,
                      background: panelBg,
                      cursor: "pointer",
                      minHeight: 44,
                      textAlign: "left",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: textColor }}>{ev.title}</div>
                      <div style={{ fontSize: 11, color: mutedColor }}>{ev.date} at {ev.time || "?"}</div>
                    </div>
                    <span style={{ fontSize: 16, color: dangerColor }}>Delete</span>
                  </button>
                ))}
                <button
                  onClick={() => setDeleteOptions(null)}
                  style={{
                    padding: "8px",
                    borderRadius: 8,
                    border: `1px solid ${borderColor}`,
                    background: "transparent",
                    color: mutedColor,
                    fontSize: 12,
                    cursor: "pointer",
                    minHeight: 36,
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* ── Loading / Searching indicators (animated dots) ── */}
            {(loading || searching) && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    maxWidth: "82%",
                    padding: "10px 14px",
                    borderRadius: radius,
                    background: cardAlt,
                    color: mutedColor,
                    fontSize: 13,
                    borderLeft: `3px solid ${goldAccent}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 14,
                      height: 14,
                      border: `2px solid ${accentColor}`,
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "jrSpin 0.8s linear infinite",
                    }}
                  />
                  <span>
                    {searching ? "Searching the web" : "Jr. is thinking"}
                    <span style={{ display: "inline-block" }}>
                      <span style={{ animation: "jrThinkPulse 1.4s ease-in-out infinite", animationDelay: "0s" }}>.</span>
                      <span style={{ animation: "jrThinkPulse 1.4s ease-in-out infinite", animationDelay: "0.2s" }}>.</span>
                      <span style={{ animation: "jrThinkPulse 1.4s ease-in-out infinite", animationDelay: "0.4s" }}>.</span>
                    </span>
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Input Bar ── */}
          <div
            style={{
              padding: "10px 12px",
              borderTop: `1px solid ${borderColor}`,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
              paddingBottom: "max(10px, env(safe-area-inset-bottom))",
            }}
          >
            <button
              onClick={toggleVoice}
              aria-label={recording ? "Stop recording" : "Start voice input"}
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                border: "none",
                background: recording ? dangerColor : cardAlt,
                color: recording ? "#fff" : mutedColor,
                cursor: "pointer",
                fontSize: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                animation: recording ? "jrPulse 1.2s infinite" : "none",
                transition: "background 0.2s",
              }}
            >
              {"\u{1F3A4}"}
            </button>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={userRole === "kid" ? "Ask Jr. about your stars..." : "Ask Jr. anything..."}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 22,
                border: `1px solid ${borderColor}`,
                background: inputBg,
                padding: "0 16px",
                fontSize: 14,
                color: textColor,
                outline: "none",
                minWidth: 0,
              }}
            />

            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              aria-label="Send message"
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                border: "none",
                background: input.trim() && !loading ? accentColor : cardAlt,
                color: input.trim() && !loading ? "#fff" : mutedColor,
                cursor: input.trim() && !loading ? "pointer" : "default",
                fontSize: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background 0.2s",
              }}
            >
              {"\u2191"}
            </button>
          </div>
        </div>
      )}

      {/* Overlay behind panel */}
      {open && (
        <div
          onClick={() => { setOpen(false); setShowMenu(false); }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: "70vh",
            background: V?.bgOverlay || "rgba(0,0,0,0.3)",
            zIndex: 200,
          }}
        />
      )}
    </>
  );
}
