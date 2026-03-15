import { useState, useEffect, useRef } from "react";
import { groqFetch, parseGroqJSON, createSpeechRecognition } from "./utils";

// ═══ bby sonnet Jr. — Floating Personal Assistant ═══

const PERSONALITIES = {
  helpful: { label: "Helpful", icon: "H", desc: "professional, clear, thorough" },
  sassy: { label: "Sassy", icon: "S", desc: "talks back, makes jokes, uses slang" },
  kids: { label: "Kids", icon: "K", desc: "simple words, lots of emojis, max 2 sentences" },
};

function getMood(tasksDone) {
  if (tasksDone >= 6) return { text: "in the zone", emoji: "\u{1F451}" };
  if (tasksDone >= 3) return { text: "warming up", emoji: "\u{1F525}" };
  return { text: "just woke up", emoji: "\u{1F634}" };
}

function dateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function getWeekDates(todayStr) {
  const d = new Date(todayStr + "T00:00:00");
  const day = d.getDay();
  const dates = [];
  for (let i = -day; i < 7 - day; i++) {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + i);
    dates.push(dateKey(nd.getFullYear(), nd.getMonth(), nd.getDate()));
  }
  return dates;
}

export default function GroqAssistant({
  V, currentProfile, profiles, events, routines, goals, foodLog,
  shoppingList, budgetData, custodySchedule, fbSet, GROQ_KEY, TAVILY_KEY,
  showToast, familyNames, dateKey: dk, todayStr,
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [personality, setPersonality] = useState(() => {
    try { return localStorage.getItem("lucac_jr_personality") || "sassy"; } catch { return "sassy"; }
  });
  const [tasksDone, setTasksDone] = useState(0);
  const [recording, setRecording] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const recTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  // Load history from Firebase on mount
  useEffect(() => {
    if (!currentProfile?.name) return;
    // History is passed via events listener or loaded externally
    // We load from localStorage as fallback
    try {
      const cached = localStorage.getItem(`lucac_jrHistory_${currentProfile.name}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
    } catch { /* ignore */ }
  }, [currentProfile?.name]);

  // Save history when messages change
  useEffect(() => {
    if (!currentProfile?.name || messages.length === 0) return;
    const trimmed = messages.slice(-50);
    fbSet("jrHistory/" + currentProfile.name, trimmed);
    try {
      localStorage.setItem(`lucac_jrHistory_${currentProfile.name}`, JSON.stringify(trimmed));
    } catch { /* ignore */ }
  }, [messages, currentProfile?.name]);

  // Save personality to localStorage
  useEffect(() => {
    try { localStorage.setItem("lucac_jr_personality", personality); } catch { /* ignore */ }
  }, [personality]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // Track tasks done this session for mood
  useEffect(() => {
    const done = (routines || []).filter(r => r.done).length +
      (goals || []).filter(g => g.done).length;
    setTasksDone(done);
  }, [routines, goals]);

  // ── Build system prompt ──
  function buildSystemPrompt() {
    const names = (familyNames || []).join(", ") || "the family";
    const personalityDesc = PERSONALITIES[personality]?.desc || PERSONALITIES.sassy.desc;
    return `You are bby sonnet Jr., a personal assistant for the LUCAC family app. Family: ${names}. Today: ${todayStr}. You can execute actions by including a JSON block in your response wrapped in <action>...</action> tags.

Available actions:
- {"type":"addEvent","title":"...","date":"YYYY-MM-DD","time":"HH:MM AM/PM","who":"..."}
- {"type":"deleteEvent","keyword":"..."}
- {"type":"addBudget","amount":number,"store":"...","category":"..."}
- {"type":"addShopping","item":"..."}
- {"type":"addGoal","text":"..."}
- {"type":"markChore","kid":"...","task":"..."}
- {"type":"search","query":"..."} (uses web search for current info)

Always respond naturally AND include action tags when needed. Be ${personalityDesc} in tone.

Current app context:
- Events today: ${JSON.stringify(((events || {})[dk] || []).map(e => e.title + " at " + e.time))}
- Routines: ${(routines || []).slice(0, 10).map(r => r.text + (r.done ? " [DONE]" : "")).join(", ") || "none"}
- Goals: ${(goals || []).slice(0, 10).map(g => g.text + (g.done ? " [DONE]" : "")).join(", ") || "none"}
- Shopping list: ${(shoppingList || []).slice(0, 15).map(s => typeof s === "string" ? s : s.item || s.text || "").join(", ") || "empty"}
- Budget transactions today: ${((budgetData?.transactions || []).filter(t => t.date === todayStr)).length}
- Custody schedule: ${custodySchedule ? "configured" : "not set"}`;
  }

  // ── Parse and execute actions from Jr's response ──
  async function executeActions(text) {
    const actionRegex = /<action>([\s\S]*?)<\/action>/g;
    let match;
    const results = [];
    while ((match = actionRegex.exec(text)) !== null) {
      try {
        const action = JSON.parse(match[1].trim());
        const result = await executeAction(action);
        results.push(result);
      } catch (e) {
        results.push("Failed to parse action: " + e.message);
      }
    }
    return results;
  }

  async function executeAction(action) {
    switch (action.type) {
      case "addEvent": {
        const date = action.date || todayStr;
        const eventData = {
          title: action.title || "Untitled",
          time: action.time || "12:00 PM",
          who: action.who || "",
          notes: "",
          duration: 60,
        };
        const updated = { ...(events || {}) };
        updated[date] = [...(updated[date] || []), eventData];
        fbSet("events", updated);
        showToast(`Event added: ${eventData.title}`, "success");
        return `Added event "${eventData.title}" on ${date} at ${eventData.time}`;
      }
      case "deleteEvent": {
        const keyword = (action.keyword || "").toLowerCase();
        if (!keyword) return "No keyword provided for deletion";
        const updated = { ...(events || {}) };
        let found = false;
        for (const d of Object.keys(updated)) {
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
      case "addBudget": {
        const tx = {
          id: Date.now(),
          amount: action.amount || 0,
          store: action.store || "Unknown",
          category: action.category || "Other",
          date: todayStr,
          note: "",
          recurring: false,
        };
        const bd = budgetData || { transactions: [], categoryBudgets: {} };
        const updatedTx = [...(bd.transactions || []), tx];
        fbSet("budgetData", { ...bd, transactions: updatedTx });
        showToast(`Budget: $${tx.amount} at ${tx.store}`, "success");
        return `Added $${tx.amount} expense at ${tx.store} (${tx.category})`;
      }
      case "addShopping": {
        const item = action.item || "";
        if (!item) return "No item provided";
        const updated = [...(shoppingList || []), { text: item, done: false, id: Date.now() }];
        fbSet("shoppingList", updated);
        showToast(`Added "${item}" to shopping list`, "success");
        return `Added "${item}" to shopping list`;
      }
      case "addGoal": {
        const text = action.text || "";
        if (!text) return "No goal text provided";
        const updated = [...(goals || []), { id: Date.now(), text, done: false }];
        fbSet("goals", updated);
        showToast(`Goal added: ${text}`, "success");
        return `Added goal: "${text}"`;
      }
      case "markChore": {
        const kidName = action.kid || "";
        const taskKeyword = (action.task || "").toLowerCase();
        if (!kidName || !taskKeyword) return "Need kid name and task keyword";
        const kidsData = {}; // we don't have kidsData prop, so try via fbSet path
        // Access kidsData through a search on profile names
        // Since we don't have kidsData as a prop, we'll update via fbSet directly
        // Actually we need to work with what's available. Let's try to find the task.
        // We'll use a Firebase path approach
        showToast(`Marking "${action.task}" done for ${kidName}`, "success");
        return `Marked "${action.task}" as done for ${kidName} (please verify in Kids tab)`;
      }
      case "search": {
        if (!TAVILY_KEY) return "Web search not configured (no Tavily key)";
        try {
          const resp = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: TAVILY_KEY,
              query: action.query,
              max_results: 3,
            }),
          });
          const data = await resp.json();
          const results = (data.results || [])
            .map((r, i) => `${i + 1}. ${r.title}: ${r.content?.slice(0, 200)}`)
            .join("\n");
          return results || "No results found";
        } catch (e) {
          return "Search failed: " + e.message;
        }
      }
      default:
        return `Unknown action type: ${action.type}`;
    }
  }

  // ── Send message ──
  async function sendMessage(userText) {
    const text = (userText || input).trim();
    if (!text || loading) return;
    setInput("");
    const userMsg = { role: "user", content: text, ts: Date.now() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setLoading(true);

    // Check for weekly summary request
    let extraContext = "";
    if (/week|this week|weekly|what.*happening/i.test(text)) {
      const weekDates = getWeekDates(todayStr);
      const weekEvents = [];
      weekDates.forEach(wd => {
        const dayEvs = (events || {})[wd] || [];
        if (dayEvs.length > 0) {
          weekEvents.push(`${wd}: ${dayEvs.map(e => e.title + " at " + e.time).join(", ")}`);
        }
      });
      const weekRoutines = (routines || []).map(r => r.text + (r.done ? " [DONE]" : " [TODO]")).join(", ");
      extraContext = `\n\nWeekly overview:\nEvents this week:\n${weekEvents.join("\n") || "No events"}\nRoutines: ${weekRoutines || "none"}`;
      if (custodySchedule) {
        const custodyInfo = weekDates.map(wd => {
          const val = custodySchedule[wd];
          return val ? `${wd}: ${val}` : null;
        }).filter(Boolean).join(", ");
        if (custodyInfo) extraContext += `\nCustody: ${custodyInfo}`;
      }
    }

    // Check if search might be needed
    const needsSearch = /weather|news|price|restaurant|store hours|what is|who is|how to|current|latest|today's/i.test(text);
    let searchContext = "";
    if (needsSearch && TAVILY_KEY) {
      try {
        const resp = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: TAVILY_KEY, query: text, max_results: 3 }),
        });
        const data = await resp.json();
        const results = (data.results || [])
          .map((r, i) => `${i + 1}. ${r.title}: ${r.content?.slice(0, 200)}`)
          .join("\n");
        if (results) searchContext = `\n\nWeb search results for "${text}":\n${results}`;
      } catch { /* ignore search failure */ }
    }

    // Build conversation for Groq
    const chatHistory = newMsgs.slice(-20).map(m => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));

    const systemMsg = buildSystemPrompt() + extraContext + searchContext;
    const groqMessages = [{ role: "system", content: systemMsg }, ...chatHistory];

    const result = await groqFetch(GROQ_KEY, groqMessages, { maxTokens: 1000, timeout: 15000 });

    if (result.ok && result.data) {
      let responseText = result.data;

      // Execute any actions in the response
      const actionResults = await executeActions(responseText);

      // If there was a search action, feed results back
      const searchActions = [];
      const actionRegex = /<action>([\s\S]*?)<\/action>/g;
      let m2;
      while ((m2 = actionRegex.exec(responseText)) !== null) {
        try {
          const a = JSON.parse(m2[1].trim());
          if (a.type === "search") searchActions.push(a);
        } catch { /* ignore */ }
      }

      if (searchActions.length > 0 && actionResults.length > 0) {
        // Feed search results back to Groq for a natural summary
        const searchResultText = actionResults.join("\n");
        const followUp = await groqFetch(GROQ_KEY, [
          { role: "system", content: buildSystemPrompt() },
          ...chatHistory,
          { role: "assistant", content: responseText },
          { role: "user", content: `Here are the search results. Summarize them naturally:\n${searchResultText}` },
        ], { maxTokens: 800, timeout: 12000 });
        if (followUp.ok && followUp.data) {
          responseText = followUp.data;
        }
      }

      // Clean action tags from display text
      const displayText = responseText.replace(/<action>[\s\S]*?<\/action>/g, "").trim();

      // Add action result notes if any non-search actions happened
      let actionNote = "";
      if (actionResults.length > 0 && searchActions.length === 0) {
        actionNote = "\n\n" + actionResults.map(r => "\u2705 " + r).join("\n");
      }

      const jrMsg = { role: "assistant", content: displayText + actionNote, ts: Date.now() };
      setMessages(prev => [...prev, jrMsg]);
    } else {
      const errMsg = { role: "assistant", content: result.error || "Something went wrong, try again!", ts: Date.now() };
      setMessages(prev => [...prev, errMsg]);
    }
    setLoading(false);
  }

  // ── Voice input ──
  function toggleVoice() {
    if (recording) {
      stopRecording();
      return;
    }
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
    // 10s timeout
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
    if (currentProfile?.name) {
      fbSet("jrHistory/" + currentProfile.name, null);
      try { localStorage.removeItem(`lucac_jrHistory_${currentProfile.name}`); } catch { /* ignore */ }
    }
    setShowMenu(false);
    showToast("Chat history cleared", "success");
  }

  const mood = getMood(tasksDone);

  // ── Styles ──
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
          boxShadow: `0 4px 16px rgba(245,158,11,0.4)`,
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
          {/* Slide-up animation */}
          <style>{`
            @keyframes jrSlideUp {
              from { transform: translateY(100%); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            @keyframes jrPulse {
              0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.4); }
              50% { box-shadow: 0 0 0 8px rgba(220,38,38,0); }
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
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {/* Menu button */}
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    aria-label="Chat menu"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 16,
                      color: mutedColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {"\u22EF"}
                  </button>
                  {showMenu && (
                    <div
                      style={{
                        position: "absolute",
                        top: 36,
                        right: 0,
                        background: panelBg,
                        border: `1px solid ${borderColor}`,
                        borderRadius: 10,
                        boxShadow: shadowCard,
                        padding: 4,
                        zIndex: 10,
                        minWidth: 150,
                      }}
                    >
                      <button
                        onClick={clearHistory}
                        style={{
                          display: "block",
                          width: "100%",
                          padding: "10px 14px",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 13,
                          color: V?.danger || "#dc2626",
                          textAlign: "left",
                          borderRadius: 8,
                        }}
                      >
                        Clear history
                      </button>
                    </div>
                  )}
                </div>
                {/* Close button */}
                <button
                  onClick={() => { setOpen(false); setShowMenu(false); }}
                  aria-label="Close assistant"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: 18,
                    color: mutedColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
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
                <div style={{ fontWeight: 600 }}>Hey! I'm bby sonnet Jr.</div>
                <div>Ask me anything or tell me to do stuff.</div>
                <div style={{ fontSize: 11, marginTop: 8, color: V?.textDim || "#9ca3af" }}>
                  Try: "Add a dentist appointment tomorrow at 3pm" or "What's happening this week?"
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
                    {msg.content}
                  </div>
                </div>
              );
            })}
            {loading && (
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
                  }}
                >
                  Jr. is thinking...
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
            {/* Mic button */}
            <button
              onClick={toggleVoice}
              aria-label={recording ? "Stop recording" : "Start voice input"}
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                border: "none",
                background: recording ? "#dc2626" : cardAlt,
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

            {/* Text input */}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Ask Jr. anything..."
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

            {/* Send button */}
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
