import { useState, useEffect, useRef, useCallback } from "react";
import { createSpeechRecognition } from "./utils";
import { runAgentLoop, getActionPreviewLabel } from "./aiAgent";

// ═══ bby sonnet Jr. — Floating Personal Assistant (v4 Agent Engine) ═══

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

const STARTER_PROMPTS = [
  "\u{1F4C5} What's my schedule today?",
  "\u{1F4B0} How much did I spend this week?",
  "\u{1F4DD} Give me a family briefing",
  "\u270D\uFE0F Help me rewrite a message",
  "\u{1F50D} Search the web for something",
];

const STARTER_PROMPTS_KID = [
  "\u2B50 How many stars do I have?",
  "\u{1F3AE} What are my tasks?",
  "\u{1F50D} Tell me something cool!",
];

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
  const [pendingActions, setPendingActions] = useState([]);
  const [clarification, setClarification] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);

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
  }, [messages, open, pendingActions, clarification]);

  // ── Track tasks done for mood ──
  useEffect(() => {
    const done = (routines || []).filter(r => r.done).length +
      (goals || []).filter(g => g.done).length;
    setTasksDone(done);
  }, [routines, goals]);

  // ══════════════════════════════════════════════════
  // BUILD APP STATE (passed to agent engine)
  // ══════════════════════════════════════════════════
  function buildAppState() {
    return {
      userName: currentProfile?.name || "User",
      userRole: currentProfile?.type || "guest",
      familyMembers: (profiles || []).map(p => p.name),
      getEventsInRange: (start, end, person) => {
        const results = [];
        const endDate = end || start;
        const isAdminUser = currentProfile?.type === "admin";
        const currentName = currentProfile?.name;
        Object.entries(events || {}).forEach(([dateKey, dayEvs]) => {
          if (dateKey >= start && dateKey <= endDate) {
            (dayEvs || []).forEach(ev => {
              // Filter private events — creator sees own, others don't
              const isPrivateEvent = ev.isPrivate ?? ev.private ?? false;
              if (isPrivateEvent && !isAdminUser) {
                if ((ev.creator ?? "admin") !== currentName) return;
              }
              if (!person || ev.who === person || !ev.who) {
                results.push({ title: ev.title, date: dateKey, time: ev.time, who: ev.who });
              }
            });
          }
        });
        return results;
      },
      getBudgetSummary: (period, category) => {
        const txns = budgetData?.transactions || [];
        const now = new Date();
        const todayDate = todayStr;
        let filtered = txns;

        // Filter by period
        if (period === "today") {
          filtered = txns.filter(t => t.date === todayDate);
        } else if (period === "this_week") {
          const d = new Date(todayDate + "T00:00:00");
          const day = d.getDay();
          const weekStart = new Date(d);
          weekStart.setDate(weekStart.getDate() - day);
          const weekStartStr = weekStart.toISOString().split("T")[0];
          filtered = txns.filter(t => t.date && t.date >= weekStartStr && t.date <= todayDate);
        } else if (period === "this_month") {
          const monthPrefix = todayDate.slice(0, 7);
          filtered = txns.filter(t => t.date && t.date.startsWith(monthPrefix));
        } else if (period === "last_month") {
          const d = new Date(todayDate + "T00:00:00");
          d.setMonth(d.getMonth() - 1);
          const lastMonthPrefix = d.toISOString().split("T")[0].slice(0, 7);
          filtered = txns.filter(t => t.date && t.date.startsWith(lastMonthPrefix));
        }

        // Filter by category
        if (category) {
          filtered = filtered.filter(t => (t.category || "").toLowerCase().includes(category.toLowerCase()));
        }

        const total = filtered.reduce((s, t) => s + (Number(t.amount) || 0), 0);

        // Category breakdown
        const catTotals = {};
        filtered.forEach(t => {
          const cat = t.category || "Other";
          catTotals[cat] = (catTotals[cat] || 0) + (Number(t.amount) || 0);
        });
        const catLines = Object.entries(catTotals)
          .sort((a, b) => b[1] - a[1])
          .map(([c, v]) => `${c}: ${formatCurrency(v)}`);

        return `Total spending: ${formatCurrency(total)} across ${filtered.length} transactions.${catLines.length > 0 ? "\nBy category: " + catLines.join(", ") : ""}`;
      },
      getKidsStatus: (kidName) => {
        const allKids = kidName === "both" ? Object.keys(kidsData || {}) : [kidName];
        return allKids.map(name => {
          const kd = (kidsData || {})[name] || {};
          const kidProfile = (profiles || []).find(p => p.name === name);
          const stars = kidProfile?.stars || kd.points || 0;
          let taskInfo = "";
          if (Array.isArray(kd.tasks)) {
            const doneTasks = kd.tasks.filter(t => t.done).length;
            const taskNames = kd.tasks.slice(0, 5).map(t => t.text + (t.done ? " [DONE]" : "")).join(", ");
            taskInfo = ` | Tasks: ${doneTasks}/${kd.tasks.length} done (${taskNames})`;
          }
          return `${name}: ${stars} stars${taskInfo}`;
        }).join("\n");
      },
      getDailyBriefingData: (forPerson) => {
        const today = todayStr;
        const isAdminUser = currentProfile?.type === "admin";
        const currentName = currentProfile?.name;
        const todayEvs = ((events || {})[today] || []).filter(e => {
          const isPrivate = e.isPrivate ?? e.private ?? false;
          if (isPrivate && !isAdminUser) return (e.creator ?? "admin") === currentName;
          return true;
        });
        const lines = [];
        lines.push(`Events today: ${todayEvs.length > 0 ? todayEvs.map(e => e.title + (e.time ? " at " + e.time : "")).join(", ") : "None"}`);
        lines.push(`Routines: ${(routines || []).filter(r => r.done).length}/${(routines || []).length} done`);
        lines.push(`Goals: ${(goals || []).filter(g => g.done).length}/${(goals || []).length} done`);

        // Kids info
        const kidProfiles = (profiles || []).filter(p => p.type === "kid");
        kidProfiles.forEach(kp => {
          const kd = (kidsData || {})[kp.name] || {};
          const tasks = Array.isArray(kd.tasks) ? kd.tasks : [];
          const doneTasks = tasks.filter(t => t.done).length;
          lines.push(`${kp.name}: ${kp.stars || 0} stars, ${doneTasks}/${tasks.length} tasks done`);
        });

        // Shopping list
        const items = (shoppingList || []).map(s => typeof s === "string" ? s : s.item || s.text || "").filter(Boolean);
        if (items.length > 0) lines.push(`Shopping list: ${items.slice(0, 10).join(", ")}`);

        return lines.join("\n");
      },
    };
  }

  // ══════════════════════════════════════════════════
  // EXECUTE CONFIRMED WRITE ACTIONS (Firebase writes)
  // ══════════════════════════════════════════════════
  async function executeActions(actions) {
    const results = [];

    for (const action of actions) {
      try {
        switch (action.function) {
          case "create_calendar_event": {
            const args = action.args;
            const date = args.date || todayStr;
            const eventData = {
              title: args.title || "Untitled",
              time: args.time || "12:00 PM",
              who: args.person || "",
              notes: "",
              duration: args.duration || 60,
              creator: userName,
            };
            if (args.repeat && args.repeat !== "none") {
              eventData.repeat = args.repeat;
            }
            if (args.isPrivate) eventData.isPrivate = true;
            if (args.alert && args.alert !== "none") eventData.alert = args.alert;
            const updated = { ...(events || {}) };
            updated[date] = [...(updated[date] || []), eventData];
            fbSet("events", updated);
            showToast(`Event added: ${eventData.title}`, "success");
            results.push(`\u2705 Added "${eventData.title}" on ${date} at ${eventData.time}`);
            break;
          }

          case "delete_event": {
            const args = action.args;
            const keyword = (args.searchTerm || "").toLowerCase();
            if (!keyword) { results.push("\u274C No keyword provided for deletion."); break; }
            const updated = { ...(events || {}) };
            let found = false;
            for (const d of Object.keys(updated)) {
              const before = (updated[d] || []).length;
              updated[d] = (updated[d] || []).filter(e => {
                if (!(e.title || "").toLowerCase().includes(keyword)) return true;
                // T05: non-admin can only delete their own events
                if (userRole !== "admin" && (e.creator ?? "admin") !== userName) return true;
                return false;
              });
              if (updated[d].length < before) found = true;
              if (updated[d].length === 0) delete updated[d];
            }
            if (found) {
              fbSet("events", updated);
              showToast(`Deleted events matching "${args.searchTerm}"`, "success");
              results.push(`\u2705 Deleted events matching "${args.searchTerm}"`);
            } else {
              results.push(`\u274C No events found matching "${args.searchTerm}"`);
            }
            break;
          }

          case "delete_events_bulk": {
            const args = action.args;
            if (userRole !== "admin") {
              results.push("\u274C Bulk delete requires admin access.");
              break;
            }
            const updated = { ...(events || {}) };
            let deletedCount = 0;
            const keyword = (args.searchTerm || "").toLowerCase();
            for (const d of Object.keys(updated)) {
              if (args.date && d !== args.date) continue;
              const before = (updated[d] || []).length;
              updated[d] = args.deleteAll && !keyword
                ? []
                : (updated[d] || []).filter(e => keyword
                    ? !(e.title || "").toLowerCase().includes(keyword)
                    : false);
              deletedCount += before - updated[d].length;
              if (updated[d].length === 0) delete updated[d];
            }
            if (deletedCount > 0) {
              fbSet("events", updated);
              showToast(`Deleted ${deletedCount} event${deletedCount !== 1 ? "s" : ""}`, "success");
              results.push(`\u2705 Deleted ${deletedCount} event${deletedCount !== 1 ? "s" : ""}`);
            } else {
              results.push("\u274C No matching events found to delete.");
            }
            break;
          }

          case "edit_event": {
            const args = action.args;
            const keyword = (args.searchTerm || "").toLowerCase();
            if (!keyword) { results.push("\u274C No keyword provided for edit."); break; }
            const updated = { ...(events || {}) };
            let edited = false;
            let permissionDenied = false;
            outer: for (const d of Object.keys(updated)) {
              const evList = updated[d] || [];
              for (let i = 0; i < evList.length; i++) {
                if ((evList[i].title || "").toLowerCase().includes(keyword)) {
                  // T05: non-admin can only edit their own events; continue searching for an owned match
                  if (userRole !== "admin" && (evList[i].creator ?? "admin") !== userName) {
                    permissionDenied = true;
                    continue; // keep looking — a later match might be owned
                  }
                  permissionDenied = false; // found an owned match, clear any prior denial
                  if (args.newTitle) evList[i].title = args.newTitle;
                  if (args.newTime) evList[i].time = args.newTime;
                  if (args.newDate && args.newDate !== d) {
                    const movedEvent = { ...evList[i] };
                    evList.splice(i, 1);
                    if (evList.length === 0) delete updated[d];
                    else updated[d] = evList;
                    updated[args.newDate] = [...(updated[args.newDate] || []), movedEvent];
                  } else {
                    updated[d] = evList;
                  }
                  edited = true;
                  break outer;
                }
              }
            }
            if (permissionDenied) {
              results.push(`\u274C You can only edit events you created.`);
            } else if (edited) {
              fbSet("events", updated);
              const changes = [];
              if (args.newTitle) changes.push(`title to "${args.newTitle}"`);
              if (args.newTime) changes.push(`time to ${args.newTime}`);
              if (args.newDate) changes.push(`date to ${args.newDate}`);
              showToast("Event updated!", "success");
              results.push(`\u2705 Updated event: changed ${changes.join(", ")}`);
            } else {
              results.push(`\u274C No events found matching "${args.searchTerm}" to edit.`);
            }
            break;
          }

          case "add_expense": {
            const args = action.args;
            const tx = {
              id: Date.now(),
              amount: args.amount || 0,
              store: args.description || "Unknown",
              category: args.category || "Other",
              date: todayStr,
              note: "",
              recurring: false,
            };
            const bd = budgetData || { transactions: [], categoryBudgets: {} };
            const updatedTx = [...(bd.transactions || []), tx];
            fbSet("budgetData", { ...bd, transactions: updatedTx });
            showToast(`Budget: ${formatCurrency(tx.amount)} at ${tx.store}`, "success");
            results.push(`\u2705 Added ${formatCurrency(tx.amount)} expense: ${tx.store} (${tx.category})`);
            break;
          }

          case "add_shopping_item": {
            const args = action.args;
            const item = args.item || "";
            if (!item) { results.push("\u274C No item specified."); break; }
            const updated = [...(shoppingList || []), { text: item, done: false, id: Date.now() }];
            fbSet("shoppingList", updated);
            showToast(`Added "${item}" to shopping list`, "success");
            results.push(`\u2705 Added "${item}" to shopping list`);
            break;
          }

          case "add_task_for_kid": {
            const args = action.args;
            const kidName = args.kidName;
            const task = args.task;
            if (!kidName || !task) { results.push("\u274C Missing kid name or task."); break; }
            const kd = { ...(kidsData || {}) };
            const kidData = kd[kidName] || { tasks: [], points: 0 };
            const tasks = Array.isArray(kidData.tasks) ? [...kidData.tasks] : [];
            tasks.push({
              id: Date.now(),
              text: task,
              emoji: args.emoji || "\u2B50",
              stars: args.stars || 5,
              done: false,
            });
            kd[kidName] = { ...kidData, tasks };
            fbSet("kidsData", kd);
            showToast(`Task assigned to ${kidName}: ${task}`, "success");
            results.push(`\u2705 Assigned to ${kidName}: "${task}" (${args.stars || 5} stars)`);
            break;
          }

          case "log_food": {
            const args = action.args;
            const entry = {
              id: Date.now(),
              name: args.food || "Food",
              calories: args.calories || 0,
              protein: args.protein || 0,
              carbs: args.carbs || 0,
              fat: args.fat || 0,
              meal: args.meal || "Snacks",
              quantity: args.quantity || "",
            };
            const todayLog = { ...(foodLog || {}) };
            todayLog[dk] = [...(todayLog[dk] || []), entry];
            fbSet("foodLog", todayLog);
            showToast(`Logged: ${entry.name}`, "success");
            results.push(`\u2705 Logged ${entry.name}: ~${entry.calories} cal`);
            break;
          }

          default:
            results.push(`\u274C Unknown action: ${action.function}`);
        }
      } catch (e) {
        results.push(`\u274C Action failed: ${e.message}`);
      }
    }

    const resultText = results.join("\n");
    setMessages(prev => [...prev, { role: "assistant", content: resultText, ts: Date.now() }]);
  }

  // ══════════════════════════════════════════════════
  // MAIN SEND MESSAGE (agent engine powered)
  // ══════════════════════════════════════════════════
  async function sendMessage(userText) {
    const text = (userText || input).trim();
    if (!text || loading) return;
    setInput("");
    setPendingActions([]);
    setClarification(null);

    const userMsg = { role: "user", content: text, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      if (!GROQ_KEY) {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "I need an API key to work! Ask the admin to set up VITE_GROQ_KEY.",
          ts: Date.now(),
        }]);
        setLoading(false);
        return;
      }

      const appState = buildAppState();
      const result = await runAgentLoop(GROQ_KEY, text, appState, conversationHistory);

      // Update conversation history for context continuity
      if (result.conversationHistory) {
        setConversationHistory(result.conversationHistory);
      }

      // Handle text response
      if (result.content) {
        // Check for clarification embedded in content
        let isClarification = false;
        try {
          // The agent may return clarification as JSON content
          if (result.content.includes('"type"') && result.content.includes('"clarification"')) {
            const parsed = JSON.parse(result.content);
            if (parsed.type === "clarification") {
              setClarification(parsed);
              isClarification = true;
            }
          }
        } catch { /* not JSON, that's fine */ }

        if (!isClarification) {
          setMessages(prev => [...prev, {
            role: "assistant",
            content: result.content,
            ts: Date.now(),
          }]);
        }
      }

      // Handle write actions — show preview cards for confirmation
      if (result.actions && result.actions.length > 0) {
        setPendingActions(result.actions);
      }

    } catch (error) {
      console.error("[Jr] Agent error:", error);
      const errMsg = error?.message || "";
      let userMsg = "I hit a snag. Try again? 🔄";
      if (errMsg.includes("429")) userMsg = "I'm being rate-limited — wait a few seconds and try again.";
      else if (errMsg.includes("401")) userMsg = "API key issue — check VITE_GROQ_KEY in settings.";
      else if (errMsg.includes("AbortError") || errMsg.includes("abort")) userMsg = "Request timed out. Try a shorter question.";
      else if (errMsg.includes("Failed to fetch") || errMsg.includes("NetworkError")) userMsg = "Can't reach AI — check your internet connection.";
      else if (errMsg) userMsg = `AI error: ${errMsg.slice(0, 100)}`;
      setMessages(prev => [...prev, {
        role: "assistant",
        content: userMsg,
        ts: Date.now(),
      }]);
    }

    setLoading(false);
  }

  // ══════════════════════════════════════════════════
  // VOICE INPUT
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
    setPendingActions([]);
    setClarification(null);
    setConversationHistory([]);
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

  // ── Role-aware starter prompts ──
  const starterPrompts = userRole === "kid" ? STARTER_PROMPTS_KID : STARTER_PROMPTS;

  // ── Confirm button style ──
  const confirmBtnStyle = {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    border: "none",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  };

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
                {/* AI-02: Role indicator badge — shows current tool tier per UI-SPEC */}
                {(() => {
                  const roleInfo = userRole === "admin"
                    ? { icon: "\u{1F451}", label: "Full access" }
                    : userRole === "parent" || userRole === "family"
                    ? { icon: "\u{1F46A}", label: "Family access" }
                    : userRole === "kid"
                    ? { icon: "\u{1F9D2}", label: "Kid mode" }
                    : { icon: "\u{1F441}", label: "View only" };
                  return (
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: V?.textDim || mutedColor,
                      background: V?.bgElevated || cardAlt,
                      border: `1px solid ${V?.borderSubtle || borderColor}`,
                      padding: "2px 8px", borderRadius: 10,
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}>
                      {roleInfo.icon} {roleInfo.label}
                    </span>
                  );
                })()}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {/* Start Fresh button */}
                <button
                  onClick={() => { setMessages([]); setPendingActions([]); setClarification(null); setConversationHistory([]); }}
                  aria-label="Start fresh conversation"
                  style={{
                    padding: "4px 10px",
                    borderRadius: 8,
                    border: `1px solid ${borderColor}`,
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: 11,
                    color: mutedColor,
                    fontWeight: 600,
                    minHeight: 28,
                  }}
                >
                  Start Fresh
                </button>
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
                  Powered by the AI agent engine
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 12 }}>
                  {starterPrompts.map((q, i) => (
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

            {/* ── Pending Action Preview Cards ── */}
            {pendingActions.length > 0 && (
              <div
                style={{
                  padding: 12,
                  background: `${accentColor}10`,
                  borderRadius: radius,
                  margin: "8px 0",
                  border: `1px solid ${accentColor}33`,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: textColor, marginBottom: 8 }}>
                  Confirm actions:
                </div>
                {pendingActions.map((action, i) => (
                  <div key={i} style={{ fontSize: 13, color: textColor, marginBottom: 4, fontWeight: 600 }}>
                    {getActionPreviewLabel(action)}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => { executeActions(pendingActions); setPendingActions([]); }}
                    aria-label="Confirm actions"
                    style={{ ...confirmBtnStyle, background: successColor }}
                  >
                    {"\u2705"} Confirm
                  </button>
                  <button
                    onClick={() => {
                      setPendingActions([]);
                      setMessages(prev => [...prev, { role: "assistant", content: "Cancelled.", ts: Date.now() }]);
                    }}
                    aria-label="Cancel actions"
                    style={{ ...confirmBtnStyle, background: cardAlt, color: mutedColor, border: `1px solid ${borderColor}` }}
                  >
                    {"\u274C"} Cancel
                  </button>
                </div>
              </div>
            )}

            {/* ── Clarification Chips ── */}
            {clarification && (
              <div style={{ padding: 8 }}>
                <div style={{ fontSize: 13, color: textColor, marginBottom: 8 }}>{clarification.question}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(clarification.options || []).map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => { setClarification(null); sendMessage(opt); }}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 20,
                        background: cardAlt,
                        border: `1px solid ${borderColor}`,
                        color: textColor,
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 600,
                        minHeight: 44,
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
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
